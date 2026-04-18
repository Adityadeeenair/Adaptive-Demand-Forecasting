"""
backend/services/data_adapter.py
==================================
Data Adapter Layer — converts ANY reasonable time-series sales CSV into
the exact format expected by the downstream pipeline.

Position in the flow:
    upload CSV → data_adapter.adapt() → cleaned DataFrame
                                      → data_loader.load_adapted()
                                      → segmentation → feature engineering → inference

This module is the only thing between a raw user upload and the pipeline.
The existing pipeline (segmentation, feature_engineering, inference_pipeline)
is not modified at all.

WHAT IT HANDLES:
  1.  Column detection  — maps arbitrary column names to date/store/item/sales
  2.  Date parsing      — 12 formats tried in order, pandas inference fallback
  3.  Missing store/item— assigns default "1" when absent
  4.  Frequency detect  — daily, weekly, monthly, irregular
  5.  Date continuity   — fills date gaps with interpolated values per series
  6.  Missing values    — interpolation primary, ffill/bfill fallback, 0 last resort
  7.  Outlier handling  — IQR×4 per series, replaces with interpolated value
  8.  Duplicate dates   — sum(min_count=1) per (store, item, date) — NaN preserved
  9.  Negative values   — clipped to 0
  10. Per-series ops    — all cleaning done independently per (store, item) group

KEY BUG FIXED (vs. earlier version):
  The internal duplicate-aggregation step inside _ensure_continuous_dates was
  calling groupby().sum() without min_count=1, silently converting NaN-only
  groups to 0.0. This meant missing sales values were zeroed instead of
  being interpolated from neighbours.
  Fix: sum(min_count=1) used everywhere. NaN groups stay NaN and are then
  correctly handled by _fill_series() via time-based interpolation.

OUTPUT CONTRACT:
  Columns:  date (datetime64), store (str), item (str), sales (float32),
            product_id (str)
  Guarantees:
    - No NaN or NaT in any column
    - sales >= 0 everywhere
    - Sorted by (product_id, date) ascending
    - Continuous daily timestamps per product (no gaps)
    - product_id = store + "_" + item
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, Dict
import warnings

warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)

from backend.services.logger import get_logger, Timer

log = get_logger(__name__)


# ── Custom exception ──────────────────────────────────────────────────────────

class AdapterError(Exception):
    """
    Raised when the dataset cannot be usefully adapted.
    Message is shown directly to the user — keep it clear and actionable.
    """


# ── Column name vocabularies ──────────────────────────────────────────────────
# Scoring: exact match=3, prefix/suffix match=2, substring match=1, none=0

_DATE_NAMES: frozenset = frozenset({
    "date", "datetime", "timestamp", "time", "day", "week", "month",
    "period", "date_time", "week_start", "week_end", "transaction_date",
    "order_date", "sale_date", "ds", "dt", "invoice_date",
    "report_date", "fiscal_date", "calendar_date", "posting_date",
    "start_date", "end_date", "start", "end", "t", "index",
})

_TARGET_NAMES: frozenset = frozenset({
    "sales", "demand", "quantity", "qty", "revenue", "units", "volume",
    "amount", "value", "orders", "transactions", "count", "target",
    "y", "actual", "sold", "qty_sold", "net_sales", "gross_sales",
    "total_sales", "total_demand", "receipts", "turnover", "invoices",
    "net_revenue", "gross_revenue", "forecast",
})

_STORE_NAMES: frozenset = frozenset({
    "store", "store_id", "store_code", "shop", "location", "branch",
    "outlet", "region", "site", "warehouse", "channel", "market",
    "territory", "location_id", "location_code", "branch_id", "shop_id",
    "store_name", "retailer", "vendor", "supplier",
})

_ITEM_NAMES: frozenset = frozenset({
    "item", "item_id", "item_code", "product", "product_id", "sku",
    "article", "commodity", "category", "part", "model", "variant",
    "product_code", "pid", "asin", "barcode", "upc", "material",
    "material_id", "style", "style_id", "reference",
})

_DATE_FORMATS = [
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y/%m/%d",
    "%d-%m-%Y",
    "%m-%d-%Y",
    "%d.%m.%Y",
    "%Y%m%d",
    "%Y-%m-%d %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
]


# ── Column detection ──────────────────────────────────────────────────────────

def _score_column(col_name: str, vocab: frozenset) -> int:
    """Score a column name against a role vocabulary. Returns 0-3."""
    c = col_name.lower().strip().replace("-", "_").replace(" ", "_")
    if c in vocab:
        return 3
    if any(c.startswith(k) or c.endswith(k) for k in vocab):
        return 2
    if any(k in c for k in vocab):
        return 1
    return 0


def _detect_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    """
    Detect which column plays each role: date, target, store, item.

    Algorithm:
    1. Score every column against every role vocabulary
    2. Assign greedily: date first (most critical), then target, store, item
    3. Never assign the same column to two roles
    4. For the date role, also verify the column is actually parseable
    5. Return None for any role with no suitable candidate
    """
    remaining = set(df.columns)
    mapping: Dict[str, Optional[str]] = {}

    def _pick(vocab: frozenset, role: str, verify_parseable: bool = False):
        if not remaining:
            mapping[role] = None
            return
        scores = {c: _score_column(c, vocab) for c in remaining}
        best_col   = max(scores, key=scores.get)
        best_score = scores[best_col]

        if best_score > 0 and verify_parseable:
            sample = df[best_col].dropna().head(10).astype(str)
            if _try_parse_dates(sample) is None:
                best_score = 0

        if best_score > 0:
            mapping[role] = best_col
            remaining.discard(best_col)
        else:
            mapping[role] = None

    _pick(_DATE_NAMES,   "date",   verify_parseable=True)
    _pick(_TARGET_NAMES, "target")
    _pick(_STORE_NAMES,  "store")
    _pick(_ITEM_NAMES,   "item")

    # If store found but no item: promote any low-cardinality remaining column
    if mapping.get("store") is not None and mapping.get("item") is None:
        for c in sorted(remaining):
            if df[c].dtype == object or df[c].nunique() < 500:
                mapping["item"] = c
                remaining.discard(c)
                break

    return mapping


# ── Date parsing ──────────────────────────────────────────────────────────────

def _try_parse_dates(series: pd.Series) -> Optional[pd.Series]:
    """Try all known formats; fall back to pandas inference. Returns None on total failure."""
    str_series = series.astype(str)
    for fmt in _DATE_FORMATS:
        try:
            return pd.to_datetime(str_series, format=fmt)
        except Exception:
            continue
    try:
        return pd.to_datetime(str_series)
    except Exception:
        return None


def _parse_dates(series: pd.Series, col_name: str) -> pd.Series:
    """Parse a date column. Raises AdapterError with a clear message on failure."""
    result = _try_parse_dates(series)
    if result is None:
        sample = series.dropna().head(5).tolist()
        raise AdapterError(
            f"Cannot parse column '{col_name}' as dates.\n"
            f"Sample values: {sample}\n"
            f"Supported: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, ISO 8601."
        )
    return result


# ── Frequency detection ───────────────────────────────────────────────────────

def _detect_frequency(dates: pd.Series) -> str:
    """
    Infer temporal frequency from the median gap between consecutive dates.
    Using the median makes this robust to occasional missing dates.
    """
    if len(dates) < 3:
        return "daily"
    diffs      = dates.sort_values().diff().dropna().dt.days
    median_gap = float(diffs.median())

    if median_gap <= 1.5:   return "daily"
    if median_gap <= 8:     return "weekly"
    if median_gap <= 32:    return "monthly"
    return "irregular"


# ── Outlier handling ──────────────────────────────────────────────────────────

def _handle_outliers(series: pd.Series, multiplier: float = 4.0) -> pd.Series:
    """
    Replace extreme outliers with linearly interpolated values.

    Conservative IQR × 4 multiplier ensures only truly anomalous spikes are
    touched — genuine demand peaks (promotions, Black Friday) are preserved.

    When IQR ≈ 0 (stable flat-line series): falls back to 5-sigma bounds.

    Replacement: set outlier positions to NaN, then interpolate linearly.
    This respects the local level/trend rather than hard-clipping to a cap.

    Input: time-sorted Series (DatetimeIndex = dates, values = sales).
    Existing NaN values pass through unchanged (handled by _fill_series later).
    """
    if len(series) < 4:
        return series

    s     = series.copy().astype(float)
    valid = s.dropna()
    if len(valid) < 4:
        return s

    Q1, Q3 = float(valid.quantile(0.25)), float(valid.quantile(0.75))
    IQR    = Q3 - Q1

    if IQR < 1e-6:
        mean, std = float(valid.mean()), float(valid.std())
        if std < 1e-6:
            return s
        upper = mean + 5.0 * std
        lower = max(0.0, mean - 5.0 * std)
    else:
        upper = Q3 + multiplier * IQR
        lower = max(0.0, Q1 - multiplier * IQR)

    outlier_mask = (s > upper) | (s < lower)
    n_out = int(outlier_mask.sum())
    if n_out == 0:
        return s

    s[outlier_mask] = np.nan
    s = s.interpolate(method="linear", limit_direction="both")
    s = s.ffill().bfill()
    s = s.clip(lower=0.0)

    log.debug(f"Outliers: replaced {n_out} values (upper={upper:.1f}, mult={multiplier}x IQR)")
    return s


# ── Missing value filling ─────────────────────────────────────────────────────

def _fill_series(series: pd.Series) -> pd.Series:
    """
    Fill NaN values in a time-indexed Series.

    Strategy (stops at the first step that eliminates all NaN):
      1. Time-based interpolation  — respects uneven temporal spacing
      2. Forward fill              — handles NaN at the series tail
      3. Backward fill             — handles NaN at the series head
      4. Zero fill                 — absolute last resort (should never trigger)

    The Series must have a DatetimeIndex for method="time" to work correctly.
    Falls back to linear interpolation for non-datetime indexes.
    """
    if series.isna().sum() == 0:
        return series

    s = series.copy().astype(float)

    if isinstance(s.index, pd.DatetimeIndex):
        s = s.interpolate(method="time", limit_direction="both")
    else:
        s = s.interpolate(method="linear", limit_direction="both")

    if s.isna().any():
        s = s.ffill().bfill()

    if s.isna().any():
        log.warning("_fill_series: zero-fill fallback triggered — check input data")
        s = s.fillna(0.0)

    return s.clip(lower=0.0)


# ── Date continuity ───────────────────────────────────────────────────────────

def _ensure_continuous_dates(
    group: pd.DataFrame,
    date_col: str,
    sales_col: str,
) -> pd.DataFrame:
    """
    Reindex a per-product DataFrame to cover every calendar day from
    its first to its last date. Gaps are filled by interpolation.

    CRITICAL FIX: uses sum(min_count=1) for duplicate aggregation.
      - sum()            → NaN-only groups become 0.0  ← WRONG (zeroed gaps)
      - sum(min_count=1) → NaN-only groups stay NaN   ← CORRECT (gets interpolated)

    This is the root cause that was fixed: missing values in the original
    CSV were being zeroed rather than interpolated, because the internal
    aggregation silently converted NaN groups to 0.0.

    Input:  DataFrame with [date_col, sales_col]; sales may contain NaN.
    Output: DataFrame with continuous daily dates; no NaN in sales.
    """
    g = group.sort_values(date_col).copy()
    g[date_col] = pd.to_datetime(g[date_col])

    # Aggregate duplicates — min_count=1 preserves NaN for empty groups
    g_series = (
        g.set_index(date_col)[sales_col]
        .groupby(level=0)
        .sum(min_count=1)    # ← the fix
    )

    # Reindex to full daily range (new dates appear as NaN)
    full_idx = pd.date_range(
        start=g_series.index.min(),
        end=g_series.index.max(),
        freq="D",
    )
    g_series = g_series.reindex(full_idx)

    # Fill all NaN: both original missing values and newly inserted gap dates
    g_series = _fill_series(g_series)

    return pd.DataFrame({date_col: g_series.index, sales_col: g_series.values})


# ── Public API ────────────────────────────────────────────────────────────────

def adapt(path: str) -> pd.DataFrame:
    """
    Read a raw user-uploaded CSV and return a clean, pipeline-ready DataFrame.

    Output columns:
        date       — datetime64, one row per calendar day per product
        store      — str ("1" if not present in input)
        item       — str ("1" if not present in input)
        sales      — float32, non-negative, no NaN
        product_id — str, store + "_" + item

    Raises AdapterError (shown directly to the user) for hard failures:
        - Empty or unreadable file
        - No detectable date column
        - No detectable numeric target column
        - Fewer than 30 usable rows after parsing

    All other issues (gaps, NaN, outliers, weekly data, duplicates) are
    handled automatically with appropriate logging.
    """
    path = Path(path)

    # ── 1. Read CSV ────────────────────────────────────────────────────────
    with Timer("Adapter: CSV read", log):
        try:
            raw = pd.read_csv(path, low_memory=False)
        except pd.errors.EmptyDataError:
            raise AdapterError("The uploaded file is empty.")
        except pd.errors.ParserError as e:
            raise AdapterError(f"Cannot parse CSV file: {e}")
        except Exception as e:
            raise AdapterError(f"File read error: {e}")

    if len(raw) == 0:
        raise AdapterError("The uploaded CSV has no data rows.")

    log.info("Adapter: raw CSV read", extra={"rows": len(raw), "columns": list(raw.columns)})

    # ── 2. Detect column roles ─────────────────────────────────────────────
    with Timer("Adapter: column detection", log):
        col_map = _detect_columns(raw)

    date_col   = col_map["date"]
    target_col = col_map["target"]
    store_col  = col_map["store"]
    item_col   = col_map["item"]

    log.info("Adapter: column mapping", extra={
        "date": date_col, "target": target_col,
        "store": store_col, "item": item_col,
    })

    # ── 3. Validate required columns ───────────────────────────────────────
    if date_col is None:
        raise AdapterError(
            f"No date column detected.\n"
            f"Your CSV columns: {list(raw.columns)}\n"
            f"Please include a column named 'date', 'timestamp', 'day', etc."
        )
    if target_col is None:
        raise AdapterError(
            f"No sales/demand column detected.\n"
            f"Your CSV columns: {list(raw.columns)}\n"
            f"Please include a column named 'sales', 'demand', 'quantity', etc."
        )
    if len(raw) < 30:
        raise AdapterError(
            f"Dataset too small: {len(raw)} rows found, minimum 30 required.\n"
            f"Please upload a dataset with more historical data."
        )

    # ── 4. Parse dates ─────────────────────────────────────────────────────
    with Timer("Adapter: date parsing", log):
        raw[date_col] = _parse_dates(raw[date_col].astype(str), date_col)
        n_nat = int(raw[date_col].isna().sum())
        if n_nat > 0:
            log.warning(f"Adapter: dropping {n_nat} rows with unparseable dates")
            raw = raw.dropna(subset=[date_col])

    # ── 5. Parse target column ─────────────────────────────────────────────
    with Timer("Adapter: target column", log):
        raw[target_col] = pd.to_numeric(raw[target_col], errors="coerce")
        n_coerced = int(raw[target_col].isna().sum())
        if n_coerced > 0:
            log.warning(
                f"Adapter: {n_coerced} non-numeric target values coerced to NaN "
                f"(will be interpolated)"
            )

    if raw[target_col].notna().sum() < 30:
        raise AdapterError(
            f"Target column '{target_col}' has too few valid numeric values "
            f"({int(raw[target_col].notna().sum())} found, need at least 30)."
        )

    # ── 6. Detect frequency ────────────────────────────────────────────────
    freq = _detect_frequency(raw[date_col].dropna())
    log.info(f"Adapter: detected frequency = {freq}")

    # ── 7. Build store/item columns ────────────────────────────────────────
    if store_col is not None:
        raw["_store"] = raw[store_col].astype(str).str.strip()
    else:
        raw["_store"] = "1"
        log.info("Adapter: no store column — using default store id='1'")

    if item_col is not None:
        raw["_item"] = raw[item_col].astype(str).str.strip()
    else:
        raw["_item"] = "1"
        log.info("Adapter: no item column — using default item id='1'")

    # ── 8. Per-(store, item) cleaning ──────────────────────────────────────
    # Every operation is applied INDEPENDENTLY per product series so that:
    #   - Outlier thresholds are calibrated to each series' own distribution
    #   - Interpolation cannot bleed across product boundaries
    #   - A noisy product cannot distort a stable one
    with Timer("Adapter: per-series processing", log):
        records   = []
        n_skipped = 0

        for (store, item), group in raw.groupby(["_store", "_item"], sort=False):
            g = group[[date_col, target_col]].copy()

            # 8a. Aggregate duplicates.
            #     sum(min_count=1): NaN-only groups remain NaN (not 0.0).
            #     This is essential — NaN rows must be interpolated, not zeroed.
            g = (
                g.groupby(date_col)[target_col]
                .sum(min_count=1)
                .reset_index()
            )

            # 8b. Clip negatives before outlier detection so they don't
            #     skew the IQR lower bound.
            g[target_col] = g[target_col].clip(lower=0.0)

            # 8c. Replace extreme outliers with interpolated values.
            g_series = g.set_index(date_col)[target_col].sort_index()
            g_series = _handle_outliers(g_series)
            g = g_series.reset_index()
            g.columns = [date_col, target_col]

            # 8d. Ensure continuous daily coverage and fill all gaps.
            #     This handles: date gaps, weekly→daily, remaining NaN.
            g = _ensure_continuous_dates(g, date_col, target_col)

            # 8e. Skip series too short to be useful to the pipeline.
            if len(g) < 10:
                log.warning(
                    f"Adapter: skipping ({store}, {item}) — "
                    f"only {len(g)} rows after cleaning"
                )
                n_skipped += 1
                continue

            # 8f. Belt-and-suspenders final NaN catch.
            if g[target_col].isna().any():
                g[target_col] = g[target_col].fillna(0.0)
            g[target_col] = g[target_col].clip(lower=0.0)

            g["_store"] = str(store)
            g["_item"]  = str(item)
            records.append(g)

    if n_skipped > 0:
        log.warning(f"Adapter: {n_skipped} series skipped (too short after cleaning)")

    if not records:
        raise AdapterError(
            "No valid data remaining after processing.\n"
            "Check that your dataset has at least 10 rows per product."
        )

    # ── 9. Assemble final DataFrame ────────────────────────────────────────
    with Timer("Adapter: assemble output", log):
        df = pd.concat(records, ignore_index=True)
        df = df.rename(columns={
            date_col:   "date",
            target_col: "sales",
            "_store":   "store",
            "_item":    "item",
        })
        df["date"]       = pd.to_datetime(df["date"])
        df["store"]      = df["store"].astype(str)
        df["item"]       = df["item"].astype(str)
        df["sales"]      = df["sales"].astype("float32")
        df["product_id"] = df["store"] + "_" + df["item"]
        df = df.sort_values(["product_id", "date"]).reset_index(drop=True)

    # ── 10. Output contract verification ───────────────────────────────────
    violations = []
    if df["date"].isna().sum() > 0:      violations.append("NaT in date")
    if df["sales"].isna().sum() > 0:     violations.append("NaN in sales")
    if (df["sales"] < 0).any():          violations.append("negative sales")
    if len(df) < 30:                     violations.append(f"only {len(df)} rows")
    if violations:
        raise RuntimeError(
            f"Adapter output contract violated: {'; '.join(violations)}. "
            "This is an internal bug — please report it."
        )

    log.info("Adapter: complete", extra={
        "rows":       len(df),
        "products":   df["product_id"].nunique(),
        "stores":     df["store"].nunique(),
        "items":      df["item"].nunique(),
        "date_range": f"{df['date'].min().date()} → {df['date'].max().date()}",
        "frequency":  freq,
        "col_map":    {k: v for k, v in col_map.items() if v is not None},
    })
    return df


# ── Diagnostic helper ─────────────────────────────────────────────────────────

def describe_adaptation(path: str) -> dict:
    """
    Run the adapter and return a summary dict.
    For debugging and manual inspection — not called in production.
    """
    df = adapt(path)
    return {
        "rows":           len(df),
        "products":       df["product_id"].nunique(),
        "date_range":     f"{df['date'].min().date()} → {df['date'].max().date()}",
        "stores":         sorted(df["store"].unique().tolist()),
        "items":          sorted(df["item"].unique().tolist()),
        "columns_output": list(df.columns),
        "sales_stats": {
            "min":  round(float(df["sales"].min()), 2),
            "max":  round(float(df["sales"].max()), 2),
            "mean": round(float(df["sales"].mean()), 2),
            "null": int(df["sales"].isna().sum()),
        },
    }

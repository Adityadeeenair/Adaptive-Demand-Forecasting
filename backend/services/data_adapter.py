import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, Dict
import warnings

warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)

from backend.services.logger import get_logger, Timer

log = get_logger(__name__)


class AdapterError(Exception):
    """
    Raised when the dataset cannot be usefully adapted.
    Message is shown directly to the user — keep it clear and actionable.
    """


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


def _score_column(col_name: str, vocab: frozenset) -> int:
    """Score a column name against a role vocabulary. Returns 0–3."""
    c = col_name.lower().strip().replace("-", "_").replace(" ", "_")
    if c in vocab:
        return 3
    if any(c.startswith(k) or c.endswith(k) for k in vocab):
        return 2
    if any(k in c for k in vocab):
        return 1
    return 0


def _is_grouping_column(series: pd.Series, n_rows: int) -> bool:

    if series.nunique(dropna=True) <= 1:
        return False   

    if series.dtype in (float, np.float32, np.float64):
        return False   

    if series.dtype != object:
        cardinality_ratio = series.nunique(dropna=True) / max(n_rows, 1)
        if cardinality_ratio > 0.5:
            return False

    return True


def _detect_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:

    remaining = set(df.columns)
    mapping: Dict[str, Optional[str]] = {}

    def _pick_by_vocab(vocab: frozenset, role: str,
                       verify_parseable: bool = False):
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

    _pick_by_vocab(_DATE_NAMES,   "date",   verify_parseable=True)
    _pick_by_vocab(_TARGET_NAMES, "target")
    _pick_by_vocab(_STORE_NAMES,  "store")
    _pick_by_vocab(_ITEM_NAMES,   "item")


    date_col   = mapping.get("date")
    target_col = mapping.get("target")
    excluded   = {c for c in [date_col, target_col] if c is not None}


    candidates = sorted(
        c for c in df.columns
        if c not in excluded
        and c not in {mapping.get("store"), mapping.get("item")}
    )

    if mapping.get("store") is None:
        for c in candidates:
            if _is_grouping_column(df[c], len(df)):
                mapping["store"] = c
                remaining.discard(c)
                log.info(
                    f"Adapter: structural fallback → '{c}' assigned as store "
                    f"(nunique={df[c].nunique()}, dtype={df[c].dtype})"
                )
                break

    # Update candidates after store assignment
    candidates = sorted(
        c for c in df.columns
        if c not in excluded
        and c not in {mapping.get("store"), mapping.get("item")}
        and c != mapping.get("store")
    )

    if mapping.get("item") is None:
        for c in candidates:
            if _is_grouping_column(df[c], len(df)):
                mapping["item"] = c
                remaining.discard(c)
                log.info(
                    f"Adapter: structural fallback → '{c}' assigned as item "
                    f"(nunique={df[c].nunique()}, dtype={df[c].dtype})"
                )
                break

    return mapping


# ── Date parsing ──────────────────────────────────────────────────────────────

def _try_parse_dates(series: pd.Series) -> Optional[pd.Series]:
    """Try all known formats; fall back to pandas inference. Returns None on failure."""
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
    """Infer frequency from median gap. Median is robust to occasional missing dates."""
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
    log.debug(f"Outliers: replaced {n_out} values (upper={upper:.1f})")
    return s



def _fill_series(series: pd.Series) -> pd.Series:

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
        log.warning("_fill_series: zero-fill fallback — all values were NaN in this window")
        s = s.fillna(0.0)

    return s.clip(lower=0.0)


def _ensure_continuous_dates(
    group: pd.DataFrame,
    date_col: str,
    sales_col: str,
) -> pd.DataFrame:

    g = group.sort_values(date_col).copy()
    g[date_col] = pd.to_datetime(g[date_col])

    g_series = (
        g.set_index(date_col)[sales_col]
        .groupby(level=0)
        .sum(min_count=1)    # preserves NaN for empty groups
    )

    full_idx = pd.date_range(
        start=g_series.index.min(),
        end=g_series.index.max(),
        freq="D",
    )
    g_series = g_series.reindex(full_idx)
    g_series = _fill_series(g_series)

    return pd.DataFrame({date_col: g_series.index, sales_col: g_series.values})



def adapt(path: str) -> pd.DataFrame:

    path = Path(path)

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

    log.info("Adapter: raw CSV read", extra={
        "rows": len(raw), "columns": list(raw.columns)
    })


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

    with Timer("Adapter: date parsing", log):
        raw[date_col] = _parse_dates(raw[date_col].astype(str), date_col)
        n_nat = int(raw[date_col].isna().sum())
        if n_nat > 0:
            log.warning(f"Adapter: dropping {n_nat} rows with unparseable dates")
            raw = raw.dropna(subset=[date_col])

    with Timer("Adapter: target column", log):
        raw[target_col] = pd.to_numeric(raw[target_col], errors="coerce")
        n_coerced = int(raw[target_col].isna().sum())
        if n_coerced > 0:
            log.warning(
                f"Adapter: {n_coerced} non-numeric target values → NaN "
                f"(will be interpolated, not dropped)"
            )

    if raw[target_col].notna().sum() < 30:
        raise AdapterError(
            f"Target column '{target_col}' has too few valid numeric values "
            f"({int(raw[target_col].notna().sum())} found, need at least 30)."
        )

    freq = _detect_frequency(raw[date_col].dropna())
    log.info(f"Adapter: detected frequency = {freq}")

    if store_col is not None:
        raw["_store"] = raw[store_col].astype(str).str.strip()
        log.info(f"Adapter: store column = '{store_col}' "
                 f"({raw[store_col].nunique()} unique values)")
    else:
        raw["_store"] = "1"
        log.info("Adapter: no store column found — using default store='1'")

    if item_col is not None:
        raw["_item"] = raw[item_col].astype(str).str.strip()
        log.info(f"Adapter: item column = '{item_col}' "
                 f"({raw[item_col].nunique()} unique values)")
    else:
        raw["_item"] = "1"
        log.info("Adapter: no item column found — using default item='1'")


    with Timer("Adapter: per-series processing", log):
        records   = []
        n_skipped = 0

        for (store, item), group in raw.groupby(["_store", "_item"], sort=False):
            g = group[[date_col, target_col]].copy()

            g = (
                g.groupby(date_col)[target_col]
                .sum(min_count=1)
                .reset_index()
            )

            g[target_col] = g[target_col].clip(lower=0.0)

            g_series = g.set_index(date_col)[target_col].sort_index()
            g_series = _handle_outliers(g_series)
            g = g_series.reset_index()
            g.columns = [date_col, target_col]

            g = _ensure_continuous_dates(g, date_col, target_col)

            if len(g) < 10:
                log.warning(
                    f"Adapter: skipping ({store}, {item}) — "
                    f"only {len(g)} rows after cleaning"
                )
                n_skipped += 1
                continue

            if g[target_col].isna().any():
                g[target_col] = g[target_col].fillna(0.0)
            g[target_col] = g[target_col].clip(lower=0.0)

            g["_store"] = str(store)
            g["_item"]  = str(item)
            records.append(g)

    if n_skipped > 0:
        log.warning(f"Adapter: {n_skipped} series skipped (< 10 rows after cleaning)")

    if not records:
        raise AdapterError(
            "No valid data remaining after processing.\n"
            "Check that your dataset has at least 10 rows per product."
        )

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

    violations = []
    if df["date"].isna().sum() > 0:   violations.append("NaT in date")
    if df["sales"].isna().sum() > 0:  violations.append("NaN in sales")
    if (df["sales"] < 0).any():       violations.append("negative sales")
    if len(df) < 30:                  violations.append(f"only {len(df)} rows")
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



def describe_adaptation(path: str) -> dict:
    """Run adapter and return summary. For debugging — not called in production."""
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

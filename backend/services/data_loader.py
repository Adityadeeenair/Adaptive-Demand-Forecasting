"""
backend/services/data_loader.py
================================
Loads the raw retail CSV, validates schema, cleans data,
and returns a guaranteed-clean DataFrame.

Replaces: src/real_data_loader.py

Key improvements:
  - Validates all required columns exist before doing anything
  - Checks date format and reports clearly what went wrong
  - Clips negative sales and fills nulls with explanations logged
  - Raises specific exceptions the API layer can catch and report nicely

Usage:
    from backend.services.data_loader import load_data
    df = load_data()                          # uses config.yaml path
    df = load_data("data/retail_raw/train.csv")  # explicit path
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Union
import yaml

from backend.services.logger import get_logger, Timer

log = get_logger(__name__)


# ── Custom exceptions ─────────────────────────────────────────────────────────

class DataLoadError(Exception):
    """File not found or cannot be read."""

class SchemaValidationError(Exception):
    """Required columns missing or wrong data types."""

class InsufficientDataError(Exception):
    """Dataset too small to be useful."""


# ── Config helper ─────────────────────────────────────────────────────────────

def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


# ── Main loader ───────────────────────────────────────────────────────────────

def load_data(path: Union[str, Path] = None) -> pd.DataFrame:
    """
    Load, validate, and clean the retail sales CSV.

    What this does step by step:
        1. Resolve path from argument or config.yaml
        2. Read CSV with correct dtypes for memory efficiency
        3. Validate all required columns are present
        4. Parse date column — reports bad format clearly
        5. Validate sales is numeric and non-negative
        6. Create product_id = store + "_" + item
        7. Sort by product_id + date
        8. Remove duplicate (product, date) rows
        9. Check minimum row count

    Args:
        path: CSV file path. If None, uses config.yaml → paths.raw_data

    Returns:
        Clean pd.DataFrame with columns:
            date (datetime64), store (int32), item (int32),
            sales (float32), product_id (str)

    Raises:
        DataLoadError         — file missing or unreadable
        SchemaValidationError — bad columns or types
        InsufficientDataError — fewer than 100 rows
    """
    full_cfg   = _cfg()
    data_cfg   = full_cfg["data"]
    paths_cfg  = full_cfg["paths"]

    # ── 1. Resolve path ───────────────────────────────────────────────────
    if path is None:
        # Build absolute path from project root
        project_root = Path(__file__).resolve().parents[2]
        path = project_root / paths_cfg["raw_data"]
    else:
        path = Path(path)

    if not path.exists():
        raise DataLoadError(
            f"CSV file not found: {path}\n"
            f"Check 'paths.raw_data' in backend/config.yaml"
        )

    log.info("Loading data", extra={"path": str(path)})

    # ── 2. Read CSV ───────────────────────────────────────────────────────
    with Timer("CSV read", log):
        try:
            df = pd.read_csv(
                path,
                dtype={
                    data_cfg["store_column"]:  "int32",
                    data_cfg["item_column"]:   "int32",
                    data_cfg["target_column"]: "float32",
                },
            )
        except pd.errors.EmptyDataError:
            raise DataLoadError(f"File is empty: {path}")
        except pd.errors.ParserError as e:
            raise DataLoadError(f"Cannot parse CSV: {e}")
        except Exception as e:
            raise DataLoadError(f"Read error: {e}")

    # ── 3. Validate columns ───────────────────────────────────────────────
    required = data_cfg["required_columns"]
    missing  = [c for c in required if c not in df.columns]
    if missing:
        raise SchemaValidationError(
            f"Missing columns: {missing}\n"
            f"Your CSV has: {list(df.columns)}\n"
            f"Required:     {required}"
        )

    # ── 4. Parse dates ────────────────────────────────────────────────────
    date_col = data_cfg["date_column"]
    try:
        df[date_col] = pd.to_datetime(df[date_col], format=data_cfg["date_format"])
    except ValueError:
        try:
            df[date_col] = pd.to_datetime(df[date_col], infer_datetime_format=True)
            log.warning("Date format auto-detected (consider setting date_format in config)")
        except Exception as e:
            raise SchemaValidationError(
                f"Cannot parse '{date_col}' as dates.\n"
                f"Expected format: {data_cfg['date_format']}\n"
                f"Sample values:   {df[date_col].head(3).tolist()}\n"
                f"Error: {e}"
            )

    # ── 5. Validate sales ─────────────────────────────────────────────────
    target = data_cfg["target_column"]

    if not pd.api.types.is_numeric_dtype(df[target]):
        raise SchemaValidationError(
            f"'{target}' must be numeric, got: {df[target].dtype}"
        )

    # Clip negatives
    n_neg = int((df[target] < 0).sum())
    if n_neg > 0:
        log.warning("Negative sales clipped to 0", extra={"count": n_neg})
        df[target] = df[target].clip(lower=0)

    # Fill nulls
    n_null = int(df[target].isna().sum())
    if n_null > 0:
        log.warning("Null sales filled with 0", extra={"count": n_null})
        df[target] = df[target].fillna(0)

    # ── 6. Create product_id ──────────────────────────────────────────────
    store_col = data_cfg["store_column"]
    item_col  = data_cfg["item_column"]
    prod_col  = data_cfg["product_id_col"]

    df[prod_col] = df[store_col].astype(str) + "_" + df[item_col].astype(str)

    # ── 7. Sort ───────────────────────────────────────────────────────────
    df = df.sort_values([prod_col, date_col]).reset_index(drop=True)

    # ── 8. Drop duplicates ────────────────────────────────────────────────
    n_before = len(df)
    df = df.drop_duplicates(subset=[prod_col, date_col], keep="last")
    n_dupes = n_before - len(df)
    if n_dupes > 0:
        log.warning("Duplicate (product, date) rows removed", extra={"count": n_dupes})

    # ── 9. Minimum size check ─────────────────────────────────────────────
    if len(df) < 100:
        raise InsufficientDataError(
            f"Only {len(df)} rows after cleaning. Need at least 100."
        )

    # ── Summary log ───────────────────────────────────────────────────────
    date_min = df[date_col].min()
    date_max = df[date_col].max()

    log.info(
        "Data loaded successfully",
        extra={
            "rows":     len(df),
            "products": df[prod_col].nunique(),
            "stores":   df[store_col].nunique(),
            "items":    df[item_col].nunique(),
            "date_range": f"{date_min.date()} → {date_max.date()}",
            "memory_mb":  round(df.memory_usage(deep=True).sum() / 1e6, 2),
        }
    )

    return df


# ── Single product extractor ─────────────────────────────────────────────────

def get_product_series(
    df: pd.DataFrame,
    store: int,
    item: int,
) -> pd.Series:
    """
    Extract the sales time series for one store-item pair.

    Args:
        df:    Full clean DataFrame from load_data()
        store: Store integer ID
        item:  Item integer ID

    Returns:
        pd.Series of sales values, indexed by date, sorted ascending.

    Raises:
        ValueError if product not found or has too few rows.
    """
    cfg      = _cfg()["data"]
    prod_col = cfg["product_id_col"]
    date_col = cfg["date_column"]
    tgt_col  = cfg["target_column"]
    min_rows = cfg["min_rows_per_product"]

    pid    = f"{store}_{item}"
    subset = df[df[prod_col] == pid]

    if len(subset) == 0:
        available = sorted(df[cfg["store_column"]].unique())
        raise ValueError(
            f"Product '{pid}' not found. "
            f"Available stores: {available}"
        )

    if len(subset) < min_rows:
        raise ValueError(
            f"Product '{pid}' has {len(subset)} rows "
            f"(minimum required: {min_rows})."
        )

    return subset.set_index(date_col)[tgt_col].sort_index()


# ── Dataset summary (for /upload API response) ────────────────────────────────

def get_dataset_summary(df: pd.DataFrame) -> dict:
    """
    Returns a JSON-serialisable summary shown to users after upload.
    """
    cfg      = _cfg()["data"]
    date_col = cfg["date_column"]
    prod_col = cfg["product_id_col"]
    str_col  = cfg["store_column"]
    itm_col  = cfg["item_column"]
    tgt_col  = cfg["target_column"]

    sizes = df.groupby(prod_col).size()

    return {
        "rows":           len(df),
        "products":       df[prod_col].nunique(),
        "stores":         df[str_col].nunique(),
        "items":          df[itm_col].nunique(),
        "date_min":       str(df[date_col].min().date()),
        "date_max":       str(df[date_col].max().date()),
        "date_span_days": (df[date_col].max() - df[date_col].min()).days,
        "avg_daily_sales": round(float(df[tgt_col].mean()), 2),
        "memory_mb":      round(df.memory_usage(deep=True).sum() / 1e6, 2),
        "thin_products":  int((sizes < 60).sum()),
        "sample_products": df[prod_col].unique()[:5].tolist(),
    }

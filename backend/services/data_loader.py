import pandas as pd
import numpy as np
from pathlib import Path
from typing import Union
import yaml

from backend.services.logger import get_logger, Timer

log = get_logger(__name__)

MAX_FILE_MB = 200


class DataLoadError(Exception):
    """File not found or cannot be read."""

class SchemaValidationError(Exception):
    """Required columns missing or wrong data types."""

class InsufficientDataError(Exception):
    """Dataset too small to be useful."""


def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


def _normalise_columns(df: pd.DataFrame, required: list):
    col_map = {c.lower().strip(): c for c in df.columns}
    rename, missing = {}, []
    for req in required:
        if req in df.columns:
            continue
        if req.lower() in col_map:
            rename[col_map[req.lower()]] = req
        else:
            missing.append(req)
    if rename:
        df = df.rename(columns=rename)
        log.info("Columns normalised", extra={"renamed": rename})
    return df, missing



def _parse_dates(series: pd.Series, configured_fmt: str) -> pd.Series:
    sample = series.dropna().head(5).tolist()
    for fmt in [configured_fmt,
                "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d",
                "%d-%m-%Y", "%m-%d-%Y", "%d.%m.%Y", "%Y%m%d"]:
        try:
            return pd.to_datetime(series, format=fmt)
        except Exception:
            continue
    try:
        parsed = pd.to_datetime(series)
        log.warning("Date format auto-inferred", extra={"sample": sample})
        return parsed
    except Exception as e:
        raise SchemaValidationError(
            f"Cannot parse date column as dates.\n"
            f"Sample values: {sample}\n"
            f"Tried: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY and others.\n"
            f"Error: {e}"
        )



def load_data(path: Union[str, Path] = None) -> pd.DataFrame:

    full_cfg  = _cfg()
    data_cfg  = full_cfg["data"]
    paths_cfg = full_cfg["paths"]

    if path is None:
        project_root = Path(__file__).resolve().parents[2]
        path = project_root / paths_cfg["raw_data"]
    else:
        path = Path(path)

    if not path.exists():
        raise DataLoadError(f"CSV file not found: {path}")

    size_mb = path.stat().st_size / 1e6
    if size_mb > MAX_FILE_MB:
        raise DataLoadError(
            f"File is {size_mb:.0f} MB — maximum allowed is {MAX_FILE_MB} MB."
        )

    log.info("Loading data", extra={"path": str(path), "size_mb": round(size_mb, 2)})

    with Timer("CSV read", log):
        try:
            df = pd.read_csv(path, low_memory=False)
        except pd.errors.EmptyDataError:
            raise DataLoadError("Uploaded file is empty.")
        except pd.errors.ParserError as e:
            raise DataLoadError(f"Cannot parse CSV: {e}")
        except Exception as e:
            raise DataLoadError(f"Read error: {e}")

    if len(df) == 0:
        raise DataLoadError("CSV has no data rows.")

    required = data_cfg["required_columns"]
    df, missing = _normalise_columns(df, required)
    if missing:
        raise SchemaValidationError(
            f"Required columns not found: {missing}\n"
            f"Your CSV has: {list(df.columns)}\n"
            f"Required (case-insensitive): {required}"
        )

    date_col  = data_cfg["date_column"]
    store_col = data_cfg["store_column"]
    item_col  = data_cfg["item_column"]
    target    = data_cfg["target_column"]
    prod_col  = data_cfg["product_id_col"]

    df[date_col]  = _parse_dates(df[date_col], data_cfg["date_format"])
    df[store_col] = df[store_col].astype(str).str.strip()
    df[item_col]  = df[item_col].astype(str).str.strip()

    df[target] = pd.to_numeric(df[target], errors="coerce")
    n_null = int(df[target].isna().sum())
    if n_null > 0:
        log.warning("Null sales filled with 0", extra={"count": n_null})
        df[target] = df[target].fillna(0)
    df[target] = df[target].astype("float32")

    n_neg = int((df[target] < 0).sum())
    if n_neg > 0:
        log.warning("Negative sales clipped to 0", extra={"count": n_neg})
        df[target] = df[target].clip(lower=0)

    df[prod_col] = df[store_col] + "_" + df[item_col]
    df = df.sort_values([prod_col, date_col]).reset_index(drop=True)
    n_before = len(df)
    df = df.drop_duplicates(subset=[prod_col, date_col], keep="last")
    if (n_dupes := n_before - len(df)) > 0:
        log.warning("Duplicate rows removed", extra={"count": n_dupes})

    if len(df) < 100:
        raise InsufficientDataError(
            f"Only {len(df)} rows after cleaning. Need at least 100."
        )

    log.info("Data loaded successfully", extra={
        "rows": len(df), "products": df[prod_col].nunique(),
        "stores": df[store_col].nunique(), "items": df[item_col].nunique(),
        "date_range": f"{df[date_col].min().date()} → {df[date_col].max().date()}",
    })
    return df



def load_adapted(df: pd.DataFrame) -> pd.DataFrame:

    required = ["date", "store", "item", "sales", "product_id"]
    missing  = [c for c in required if c not in df.columns]
    if missing:
        raise SchemaValidationError(
            f"Adapter output missing columns: {missing}. "
            "This is an internal bug — please report it."
        )

    df = df.copy()
    df["date"]       = pd.to_datetime(df["date"])
    df["store"]      = df["store"].astype(str)
    df["item"]       = df["item"].astype(str)
    df["sales"]      = pd.to_numeric(df["sales"], errors="coerce").fillna(0.0).astype("float32")
    df["product_id"] = df["store"] + "_" + df["item"]

    n_neg = int((df["sales"] < 0).sum())
    if n_neg > 0:
        df["sales"] = df["sales"].clip(lower=0)

    n_before = len(df)
    df = df.drop_duplicates(subset=["product_id", "date"], keep="last")
    if (n_dupes := n_before - len(df)) > 0:
        log.warning("load_adapted: duplicate rows removed", extra={"count": n_dupes})

    df = df.sort_values(["product_id", "date"]).reset_index(drop=True)

    if len(df) < 30:
        raise InsufficientDataError(
            f"Only {len(df)} rows after processing. "
            f"Please upload a dataset with more historical data."
        )

    log.info("load_adapted: validated", extra={
        "rows":       len(df),
        "products":   df["product_id"].nunique(),
        "date_range": f"{df['date'].min().date()} → {df['date'].max().date()}",
    })
    return df



def get_product_series(df: pd.DataFrame, store, item) -> pd.Series:
    
    cfg      = _cfg()["data"]
    prod_col = cfg["product_id_col"]
    date_col = cfg["date_column"]
    tgt_col  = cfg["target_column"]
    min_rows = cfg["min_rows_per_product"]

    pid    = f"{store}_{item}"
    subset = df[df[prod_col] == pid]

    if len(subset) == 0:
        available = sorted(df[cfg["store_column"]].unique().tolist())[:10]
        raise ValueError(
            f"Product '{pid}' not found.\n"
            f"Available stores (first 10): {available}"
        )
    if len(subset) < min_rows:
        raise ValueError(
            f"Product '{pid}' has only {len(subset)} days of history "
            f"(minimum required: {min_rows})."
        )

    series = subset.set_index(date_col)[tgt_col].sort_index()
    if series.index.duplicated().any():
        series = series[~series.index.duplicated(keep="last")]
    return series



def get_dataset_summary(df: pd.DataFrame) -> dict:
   
    date_col = "date"
    str_col  = "store"
    itm_col  = "item"
    tgt_col  = "sales"
    prod_col = "product_id"

    if prod_col not in df.columns:
        try:
            cfg      = _cfg()["data"]
            date_col = cfg["date_column"]
            str_col  = cfg["store_column"]
            itm_col  = cfg["item_column"]
            tgt_col  = cfg["target_column"]
            prod_col = cfg["product_id_col"]
        except Exception:
            pass 

    sizes = df.groupby(prod_col).size()

    return {
        "rows":            len(df),
        "products":        int(df[prod_col].nunique()),
        "stores":          int(df[str_col].nunique()),
        "items":           int(df[itm_col].nunique()),
        "date_min":        str(df[date_col].min().date()),
        "date_max":        str(df[date_col].max().date()),
        "date_span_days":  int((df[date_col].max() - df[date_col].min()).days),
        "avg_daily_sales": round(float(df[tgt_col].mean()), 2),
        "memory_mb":       round(df.memory_usage(deep=True).sum() / 1e6, 2),
        "thin_products":   int((sizes < 60).sum()),
        "sample_products": df[prod_col].unique()[:5].tolist(),
    }

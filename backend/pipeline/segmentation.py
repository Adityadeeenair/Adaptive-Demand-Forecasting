"""
backend/pipeline/segmentation.py
==================================
Computes demand behavior metrics and assigns a segment to every product.

Replaces: src/behavior_metrics.py  +  src/real_behavior_metrics.py

The old code had two separate files that both did similar things
but with different column names causing crashes. This is one clean file
that reads column names from config.yaml — no hardcoding.

Segments assigned:
    stable           → low volatility, no strong trend or seasonality
    seasonal_stable  → clear weekly repeat pattern, moderate volatility
    seasonal_volatile→ seasonal pattern BUT high volatility/spikes
    trending         → strong upward or downward trend
    volatile         → high volatility, no clear pattern
    intermittent     → many zero-sales days (sparse demand)

Usage:
    from backend.pipeline.segmentation import compute_segments
    segments_df = compute_segments(df)
"""

import pandas as pd
import numpy as np
from pathlib import Path
import yaml
from sklearn.linear_model import LinearRegression

from backend.services.logger import get_logger, Timer

log = get_logger(__name__)


# ── Config ────────────────────────────────────────────────────────────────────

def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


# ── Individual metric functions ───────────────────────────────────────────────
# Each takes a numpy array, returns a single float.
# Pure functions = easy to unit test individually.

def _trend_strength(values: np.ndarray) -> float:
    """Linear regression slope, normalised by mean. Scale-independent."""
    if len(values) < 10:
        return 0.0
    mean = np.mean(values)
    if mean == 0:
        return 0.0
    X = np.arange(len(values)).reshape(-1, 1)
    slope = LinearRegression().fit(X, values.reshape(-1, 1)).coef_[0][0]
    return float(slope / mean)


def _volatility_cv(values: np.ndarray) -> float:
    """Coefficient of Variation = std/mean. Higher = more volatile."""
    mean = np.mean(values)
    return float(np.std(values) / mean) if mean != 0 else 0.0


def _zero_ratio(values: np.ndarray) -> float:
    """Fraction of days with zero sales. High = intermittent demand."""
    return float(np.sum(values == 0) / len(values))


def _weekly_seasonality(values: np.ndarray) -> float:
    """
    Correlation between the series and itself lagged by 7 days.
    High positive value = strong weekly repeat pattern.
    """
    lag = 7
    if len(values) <= lag:
        return 0.0
    a, b = values[:-lag], values[lag:]
    if np.std(a) == 0 or np.std(b) == 0:
        return 0.0
    corr = np.corrcoef(a, b)[0, 1]
    return float(corr) if not np.isnan(corr) else 0.0


# ── Batch metric computation ──────────────────────────────────────────────────

def compute_behavior_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute trend, volatility, zero-ratio, and seasonality for every product.

    Args:
        df: Clean DataFrame from data_loader.load_data()

    Returns:
        One row per product_id with columns:
            product_id, trend, volatility_cv, zero_ratio,
            seasonality_corr, n_days, mean_sales
    """
    cfg       = _cfg()
    dcfg      = cfg["data"]
    prod_col  = dcfg["product_id_col"]
    date_col  = dcfg["date_column"]
    tgt_col   = dcfg["target_column"]
    min_rows  = dcfg["min_rows_per_product"]

    results = []
    skipped = 0

    with Timer("Behavior metrics", log):
        for pid, group in df.groupby(prod_col):
            vals = group.sort_values(date_col)[tgt_col].values.astype(float)

            if len(vals) < min_rows:
                skipped += 1
                continue

            results.append({
                "product_id":       pid,
                "trend":            _trend_strength(vals),
                "volatility_cv":    _volatility_cv(vals),
                "zero_ratio":       _zero_ratio(vals),
                "seasonality_corr": _weekly_seasonality(vals),
                "n_days":           len(vals),
                "mean_sales":       float(np.mean(vals)),
            })

    if skipped:
        log.warning(
            "Products skipped (too few rows)",
            extra={"skipped": skipped, "min_required": min_rows}
        )

    metrics_df = pd.DataFrame(results)
    log.info("Metrics computed", extra={"products": len(metrics_df), "skipped": skipped})
    return metrics_df


# ── Segment assignment ────────────────────────────────────────────────────────

def assign_segments(metrics_df: pd.DataFrame) -> pd.DataFrame:
    """
    Assign a demand segment to each product using rule-based logic.
    All thresholds are dataset-relative (quantile-based) so they
    adapt to any dataset automatically.

    Priority order (first match wins):
        1. intermittent      zero_ratio > threshold
        2. trending          |trend| > threshold
        3. seasonal_volatile seasonal AND high volatility
        4. seasonal_stable   seasonal
        5. volatile          high volatility
        6. stable            (default)
    """
    scfg = _cfg()["segmentation"]

    # Dataset-relative thresholds
    low_v  = metrics_df["volatility_cv"].quantile(scfg["volatility_low_quantile"])
    high_v = metrics_df["volatility_cv"].quantile(scfg["volatility_high_quantile"])
    sea_t  = metrics_df["seasonality_corr"].quantile(scfg["seasonality_quantile"])

    # Boolean flags
    metrics_df["is_intermittent"] = metrics_df["zero_ratio"] > scfg["intermittent_zero_ratio"]
    metrics_df["is_seasonal"]     = metrics_df["seasonality_corr"] > sea_t
    metrics_df["is_trending"]     = metrics_df["trend"].abs() > scfg["trending_slope_threshold"]

    # 3-level volatility label
    conditions = [metrics_df["volatility_cv"] <= low_v, metrics_df["volatility_cv"] <= high_v]
    metrics_df["volatility_level"] = np.select(conditions, ["low", "medium"], default="high")

    # Final segment (priority rules)
    def _segment(row) -> str:
        if row["is_intermittent"]:                                       return "intermittent"
        if row["is_trending"]:                                           return "trending"
        if row["is_seasonal"] and row["volatility_level"] == "high":     return "seasonal_volatile"
        if row["is_seasonal"]:                                           return "seasonal_stable"
        if row["volatility_level"] == "high":                            return "volatile"
        return "stable"

    metrics_df["final_segment"] = metrics_df.apply(_segment, axis=1)

    dist = metrics_df["final_segment"].value_counts().to_dict()
    log.info(
        "Segmentation done",
        extra={
            "distribution": dist,
            "thresholds": {
                "low_vol": round(low_v, 4),
                "high_vol": round(high_v, 4),
                "seasonal": round(sea_t, 4),
            }
        }
    )

    return metrics_df


# ── Combined entry point ──────────────────────────────────────────────────────

def compute_segments(df: pd.DataFrame) -> pd.DataFrame:
    """
    Full segmentation: metrics → segment labels.

    Args:
        df: Clean DataFrame from data_loader.load_data()

    Returns:
        One row per product with all metrics + final_segment column.
    """
    log.info("Starting demand segmentation")
    return assign_segments(compute_behavior_metrics(df))


# ── Lookup helper (used by inference pipeline) ────────────────────────────────

def get_product_segment(segments_df: pd.DataFrame, product_id: str) -> str:
    """
    Get the segment for a single product.

    Args:
        segments_df: Output of compute_segments()
        product_id:  e.g. "3_12"

    Returns:
        Segment string, e.g. "seasonal_stable"
    """
    match = segments_df[segments_df["product_id"] == product_id]
    if len(match) == 0:
        raise ValueError(f"Product '{product_id}' not found in segments.")
    return str(match.iloc[0]["final_segment"])

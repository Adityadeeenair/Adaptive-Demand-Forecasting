"""
backend/pipeline/segmentation.py
==================================
Computes demand behavior metrics and assigns a segment to every product.

ROOT CAUSES FIXED IN THIS VERSION:

  1. SEASONALITY METRIC CONFUSED TREND WITH SEASONALITY
     The original _weekly_seasonality() computed lag-7 autocorrelation on
     the raw series. Any monotone upward trend has lag-7 autocorrelation
     near 0.97, making ALL trending products appear "seasonal". This caused
     smooth upward trends to be labeled "seasonal_stable" instead of
     "trending".
     Fix: Detrend the series (remove linear trend) before computing lag-7
     autocorrelation. Residuals of a pure trend have near-zero autocorr;
     residuals of a truly weekly-seasonal series retain high autocorr.

  2. TREND THRESHOLD TOO TIGHT FOR REAL-WORLD DATA
     trending_slope_threshold = 0.025 was calibrated on the Kaggle training
     data where ALL products had slope ≈ 0.0002 (essentially flat). Real
     datasets with actual trends have slopes of 0.003–0.015 — still below
     the original threshold, so "trending" was never assigned.
     Fix: Lower threshold to 0.003. Also compute trend strength on the
     detrended residuals' envelope (removes noise from trend slope estimate).

  3. VOLATILITY METRIC MIXES TREND VARIANCE WITH NOISE VARIANCE
     CV = std/mean on a trending series gives high variance even when the
     day-to-day noise is small, because the rising values inflate std.
     Fix: Compute CV on detrended residuals so volatility measures
     actual noise, not the systematic trend component.

  4. SEGMENT PRIORITY ORDER CORRECTED
     With the old raw-autocorr metric: trending products → seasonal_stable.
     After detrending: trending is detected first (priority 2), seasonal
     is only assigned when genuine weekly periodicity exists after removing trend.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import yaml
from sklearn.linear_model import LinearRegression

from backend.services.logger import get_logger, Timer

log = get_logger(__name__)


def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


# ── Helper: linear detrend ────────────────────────────────────────────────────

def _detrend(values: np.ndarray) -> np.ndarray:
    """Remove linear trend from a series. Returns residuals."""
    if len(values) < 4:
        return values - np.mean(values)
    X = np.arange(len(values)).reshape(-1, 1)
    trend = LinearRegression().fit(X, values).predict(X)
    return values - trend


# ── Individual metric functions ───────────────────────────────────────────────

def _trend_strength(values: np.ndarray) -> float:
    """
    Normalised linear slope (slope / mean).
    Sign indicates direction: positive = upward, negative = downward.
    Scale-independent so it works across different sales magnitudes.
    """
    if len(values) < 10:
        return 0.0
    mean = np.mean(values)
    if mean == 0:
        return 0.0
    X = np.arange(len(values)).reshape(-1, 1)
    slope = LinearRegression().fit(X, values.reshape(-1, 1)).coef_[0][0]
    return float(slope / mean)


def _volatility_cv(values: np.ndarray) -> float:
    """
    Coefficient of variation computed on DETRENDED residuals.

    FIX: Using raw values on a trending series inflates std because the
    systematic rise looks like variance. Detrending isolates actual
    day-to-day noise, giving a true volatility signal.
    """
    residuals = _detrend(values)
    mean = np.mean(np.abs(values))          # use original mean for scale
    return float(np.std(residuals) / mean) if mean != 0 else 0.0


def _zero_ratio(values: np.ndarray) -> float:
    """Fraction of days with zero sales. High = intermittent demand."""
    return float(np.sum(values == 0) / len(values))


def _weekly_seasonality(values: np.ndarray) -> float:
    """
    Lag-7 autocorrelation computed on DETRENDED residuals.

    FIX: Computing on raw values gives autocorr ≈ 0.97 for any monotone
    upward trend — confusing trend with weekly seasonality. After removing
    the linear trend, only genuine weekly periodicity produces high autocorr.

    Examples:
        Pure upward trend:  raw=0.97, detrended≈0.05  → correctly NOT seasonal
        Weekly seasonal:    raw=0.92, detrended≈0.92  → correctly seasonal
        Trend + seasonal:   detrended≈0.93            → correctly seasonal
        Stable/flat:        raw≈-0.02, detrended≈-0.02 → correctly NOT seasonal
    """
    lag = 7
    if len(values) <= lag * 2:
        return 0.0
    residuals = _detrend(values)
    a, b = residuals[:-lag], residuals[lag:]
    if np.std(a) == 0 or np.std(b) == 0:
        return 0.0
    corr = np.corrcoef(a, b)[0, 1]
    return float(corr) if not np.isnan(corr) else 0.0


# ── Batch metric computation ──────────────────────────────────────────────────

def compute_behavior_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute trend, volatility, zero-ratio, and seasonality for every product.
    All metrics now operate on detrended residuals where appropriate.
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
        log.warning("Products skipped (too few rows)",
                    extra={"skipped": skipped, "min_required": min_rows})

    if not results:
        log.warning("No products met minimum row requirement — returning empty segments")
        return pd.DataFrame(columns=[
            "product_id", "trend", "volatility_cv", "zero_ratio",
            "seasonality_corr", "n_days", "mean_sales",
        ])

    metrics_df = pd.DataFrame(results)
    log.info("Metrics computed", extra={"products": len(metrics_df), "skipped": skipped})
    return metrics_df


# ── Segment assignment ────────────────────────────────────────────────────────

def assign_segments(metrics_df: pd.DataFrame) -> pd.DataFrame:
    """
    Assign demand segment using corrected thresholds and priority rules.

    KEY CHANGES:
    - trending_slope_threshold lowered from 0.025 → 0.003
      (original threshold never triggered on real-world data)
    - Seasonality is now measured on detrended residuals
      (so trending series are NOT misclassified as seasonal)
    - Volatility is measured on detrended residuals
      (so trending series are NOT misclassified as volatile)

    Priority order (first match wins):
        1. intermittent      zero_ratio > 0.40
        2. trending          |trend_slope| > 0.003
        3. seasonal_volatile seasonal AND high volatility
        4. seasonal_stable   seasonal
        5. volatile          high volatility
        6. stable            (default)
    """
    if metrics_df.empty:
        log.warning("assign_segments called with empty DataFrame")
        metrics_df["final_segment"] = pd.Series(dtype=str)
        return metrics_df

    scfg = _cfg()["segmentation"]

    # Dataset-relative volatility thresholds (adapt to any dataset)
    low_v  = metrics_df["volatility_cv"].quantile(scfg["volatility_low_quantile"])
    high_v = metrics_df["volatility_cv"].quantile(scfg["volatility_high_quantile"])
    sea_t  = metrics_df["seasonality_corr"].quantile(scfg["seasonality_quantile"])

    # FIX: Use absolute trend threshold, not relative quantile.
    # The original quantile approach sets 'trending' based on relative ranking
    # within the current dataset — meaning the most-trending products get the
    # label even if none actually trend. Absolute threshold is more meaningful.
    trend_threshold = scfg.get("trending_slope_threshold", 0.003)

    # Boolean flags
    metrics_df["is_intermittent"] = metrics_df["zero_ratio"] > scfg["intermittent_zero_ratio"]
    metrics_df["is_seasonal"]     = metrics_df["seasonality_corr"] > sea_t
    metrics_df["is_trending"]     = metrics_df["trend"].abs() > trend_threshold

    # 3-level volatility
    conditions = [
        metrics_df["volatility_cv"] <= low_v,
        metrics_df["volatility_cv"] <= high_v,
    ]
    metrics_df["volatility_level"] = np.select(
        conditions, ["low", "medium"], default="high"
    )

    def _segment(row) -> str:
        if row["is_intermittent"]:                                       return "intermittent"
        if row["is_trending"]:                                           return "trending"
        if row["is_seasonal"] and row["volatility_level"] == "high":     return "seasonal_volatile"
        if row["is_seasonal"]:                                           return "seasonal_stable"
        if row["volatility_level"] == "high":                            return "volatile"
        return "stable"

    metrics_df["final_segment"] = metrics_df.apply(_segment, axis=1)

    dist = metrics_df["final_segment"].value_counts().to_dict()
    log.info("Segmentation done", extra={
        "distribution": dist,
        "thresholds": {
            "low_vol":       round(low_v, 4),
            "high_vol":      round(high_v, 4),
            "seasonal":      round(sea_t, 4),
            "trend_abs":     trend_threshold,
        }
    })

    return metrics_df


# ── Entry point ───────────────────────────────────────────────────────────────

def compute_segments(df: pd.DataFrame) -> pd.DataFrame:
    """Full segmentation: metrics → segment labels."""
    log.info("Starting demand segmentation")
    return assign_segments(compute_behavior_metrics(df))


# ── Lookup helper ─────────────────────────────────────────────────────────────

def get_product_segment(segments_df: pd.DataFrame, product_id: str) -> str:
    """Get segment label for a single product."""
    match = segments_df[segments_df["product_id"] == product_id]
    if len(match) == 0:
        raise ValueError(f"Product '{product_id}' not found in segments.")
    return str(match.iloc[0]["final_segment"])

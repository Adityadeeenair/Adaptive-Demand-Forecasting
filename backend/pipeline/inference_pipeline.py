"""
backend/pipeline/inference_pipeline.py
========================================
Loads saved models and generates forecasts.

KEY ARCHITECTURAL CHANGE: SINGLE SOURCE OF TRUTH FOR SEGMENTS

  The mismatch between the product list segment and the forecast segment
  was caused by two completely independent segment lookups:

    PATH 1 — GET /products/{session_id}:
      forecast.py → _get_segments(session_id, df)
                 → compute_segments(uploaded_df)   ← correct 2021 segments

    PATH 2 — POST /forecast → run_inference():
      inference_pipeline.py → _store.segments_df
                            → joblib.load("segments.pkl")  ← WRONG: Kaggle 2013-2017

  Because the product IDs in the 2021 dataset (e.g. "1_1") do not exist in
  the Kaggle training segments, get_product_segment() raised ValueError and
  fell back to "unknown" — a completely different label from the product list.

  FIX: run_inference() now accepts segment as an explicit parameter.
  The caller (forecast.py) supplies it from the session-scoped cache,
  which is the same cache used by the product list. One computation,
  one result, used everywhere.

SEGMENT-AWARE FORECASTING

  Different demand types require different inference behaviour:

  TRENDING:   Strong trend continuation, light smoothing, responsive EMA
  VOLATILE:   No smoothing, no trend forcing — preserve natural variance
  SEASONAL:   Moderate smoothing to dampen DOW artifact, keep periodicity
  STABLE:     Strong smoothing, no drift
  INTERMITTENT: Max smoothing, hard zero floor
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional
import yaml
import joblib
from sklearn.linear_model import LinearRegression
from scipy.ndimage import uniform_filter1d

from backend.services.logger import get_logger, Timer
from backend.services.data_loader import get_product_series
from backend.pipeline.ensemble import NNLSEnsemble

log = get_logger(__name__)


def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


def _models_dir() -> Path:
    root = Path(__file__).resolve().parents[2]
    return root / _cfg()["paths"]["saved_models"]


# ── Model store singleton ─────────────────────────────────────────────────────

class _ModelStore:
    """Loads all pkl files once on first request, reuses forever."""
    _instance: Optional["_ModelStore"] = None
    _loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self) -> None:
        if self._loaded:
            return

        d = _models_dir()
        required = [
            "random_forest.pkl", "xgboost.pkl", "lightgbm.pkl",
            "meta_model.pkl", "quantile_lower.pkl", "quantile_upper.pkl",
            "feature_list.pkl",
        ]
        missing = [f for f in required if not (d / f).exists()]
        if missing:
            raise FileNotFoundError(
                f"Model files not found: {missing}\n"
                f"Run: python -m backend.pipeline.training_pipeline"
            )

        with Timer("Loading models from disk", log):
            self.rf           = joblib.load(d / "random_forest.pkl")
            self.xgb_model    = joblib.load(d / "xgboost.pkl")
            self.lgb_model    = joblib.load(d / "lightgbm.pkl")
            self.meta_model   = joblib.load(d / "meta_model.pkl")
            self.q_lower      = joblib.load(d / "quantile_lower.pkl")
            self.q_upper      = joblib.load(d / "quantile_upper.pkl")
            self.feature_list = joblib.load(d / "feature_list.pkl")

            # Note: segments.pkl is intentionally NOT loaded here.
            # Segments are computed per-session from uploaded data and
            # passed in via run_inference(segment=...) from forecast.py.
            # Loading the training-era segments.pkl caused the mismatch.

            enc_d = d
            self.store_encoder = (
                joblib.load(enc_d / "store_encoder.pkl")
                if (enc_d / "store_encoder.pkl").exists() else {}
            )
            self.item_encoder = (
                joblib.load(enc_d / "item_encoder.pkl")
                if (enc_d / "item_encoder.pkl").exists() else {}
            )

        self._loaded = True
        log.info("All models loaded into memory", extra={
            "store_encoder_size": len(self.store_encoder),
            "item_encoder_size":  len(self.item_encoder),
        })

    def reset(self) -> None:
        self._loaded = False


_store = _ModelStore()


# ── Encoding helper ───────────────────────────────────────────────────────────

def _encode(value, encoder: dict, col_name: str) -> int:
    """Map raw store/item value → training-time code. -1 for unseen values."""
    key = str(value).strip()
    if key in encoder:
        return int(encoder[key])
    log.warning(f"Unseen {col_name} value '{key}' — using code -1")
    return -1


# ── Segment-aware inference parameters ───────────────────────────────────────

# Each segment gets its own set of inference parameters.
# These control EMA smoothing, post-processing smoothing, and trend continuation.
#
# ema_alpha:        How quickly the EMA tracks new predictions.
#                   1.0 = no smoothing (lag_1 = raw last pred)
#                   0.0 = never updates (lag_1 = history end forever)
#                   0.35 = default balanced value
#
# smooth_raw_frac:  Fraction of RAW predictions kept in the final blend.
#                   1.0 = all raw (no smoothing)
#                   0.35 = 35% raw + 65% 3-day moving average
#
# smooth_window:    Size of the centered moving average window.
#                   1 = no effect (identity), 3 = gentle, 5 = stronger
#
# trend_max_weight: Maximum blend weight toward the trend projection.
#                   0.0 = ignore trend entirely
#                   0.5 = up to 50% trend blending
#
# trend_min_slope:  Minimum |normalised slope| to trigger trend adjustment.

_SEGMENT_PARAMS: Dict[str, dict] = {
    "trending": {
        # Trending: preserve direction, reduce oscillation, allow movement
        "ema_alpha":        0.50,   # responsive — tracks trend changes quickly
        "smooth_raw_frac":  0.45,   # moderate smoothing — keep directional movement
        "smooth_window":    3,
        "trend_max_weight": 0.45,   # strong trend continuation
        "trend_min_slope":  0.002,
    },
    "volatile": {
        # Volatile: preserve variance — NO smoothing, NO trend forcing
        "ema_alpha":        1.00,   # no EMA (lag_1 = raw last prediction)
        "smooth_raw_frac":  1.00,   # no smoothing — preserve natural noise
        "smooth_window":    1,      # identity (no effect)
        "trend_max_weight": 0.00,   # no trend forcing on volatile series
        "trend_min_slope":  999.0,  # effectively disabled
    },
    "seasonal_volatile": {
        # Seasonal + volatile: moderate smoothing to reduce DOW artifact
        # but keep enough variance to reflect the volatile character
        "ema_alpha":        0.60,
        "smooth_raw_frac":  0.55,   # keep more raw to preserve volatility
        "smooth_window":    3,
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
    },
    "seasonal_stable": {
        # Seasonal: moderate smoothing to dampen DOW artifact from training data
        # while preserving the genuine weekly periodicity in the data
        "ema_alpha":        0.40,
        "smooth_raw_frac":  0.45,   # moderate blend
        "smooth_window":    3,
        "trend_max_weight": 0.00,   # seasonal, not trending
        "trend_min_slope":  999.0,
    },
    "stable": {
        # Stable: strong smoothing — predictions should be low-variance
        "ema_alpha":        0.30,   # slowest update — most stable
        "smooth_raw_frac":  0.25,   # mostly smoothed
        "smooth_window":    3,
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
    },
    "intermittent": {
        # Intermittent: maximum smoothing, hard zero floor
        "ema_alpha":        0.25,
        "smooth_raw_frac":  0.20,
        "smooth_window":    5,      # stronger smoothing
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
    },
    "unknown": {
        # Fallback — balanced defaults
        "ema_alpha":        0.35,
        "smooth_raw_frac":  0.35,
        "smooth_window":    3,
        "trend_max_weight": 0.20,
        "trend_min_slope":  0.002,
    },
}

def _get_params(segment: str) -> dict:
    """Return inference parameters for a given segment, with safe fallback."""
    return _SEGMENT_PARAMS.get(segment, _SEGMENT_PARAMS["unknown"])


# ── Trend helpers ─────────────────────────────────────────────────────────────

def _estimate_trend_slope(values: np.ndarray, window: int = 28) -> float:
    """Normalised recent slope (slope / mean). Scale-independent."""
    tail = values[-window:] if len(values) >= window else values
    if len(tail) < 7:
        return 0.0
    mean = np.mean(np.abs(tail))
    if mean == 0:
        return 0.0
    X = np.arange(len(tail)).reshape(-1, 1)
    slope = LinearRegression().fit(X, tail.reshape(-1, 1)).coef_[0][0]
    return float(slope / mean)


def _estimate_recent_level(values: np.ndarray, window: int = 14) -> float:
    """Exponentially weighted recent mean — more weight on recent days."""
    tail = values[-window:] if len(values) >= window else values
    if len(tail) == 0:
        return 0.0
    weights = np.exp(np.linspace(-1, 0, len(tail)))
    return float(np.average(tail, weights=weights))


# ── Recursive feature builder ─────────────────────────────────────────────────

def _build_recursive_features(
    history: pd.Series,
    horizon: int,
    store_code: int,
    item_code: int,
    feature_list: list,
    rf_model,
    xgb_model,
    lgb_model,
    meta_model,
    ema_alpha: float,
) -> tuple:
    """
    Multi-step recursive forecast.

    EMA smoothing on lag_1:
    - lag_1 uses the EMA-smoothed value instead of raw last prediction
    - This breaks the DOW × lag_1 zig-zag feedback loop
    - alpha controlled per segment: volatile=1.0 (no smoothing), stable=0.3

    Returns:
        future_X   — (horizon, n_features) DataFrame for quantile models
        rf_preds, xgb_preds, lgb_preds, ens_preds — per-step arrays
    """
    cfg       = _cfg()["features"]
    lag_wins  = cfg["lag_windows"]
    roll_wins = cfg["rolling_windows"]

    vals       = list(history.values.astype(float))
    mean_sales = float(np.mean(vals)) if vals else 0.0

    start = history.index[-1] + pd.Timedelta(days=1)
    dates = pd.date_range(start=start, periods=horizon, freq="D")

    rf_preds  = []
    xgb_preds = []
    lgb_preds = []
    ens_preds = []
    all_rows  = []

    smoothed_val = float(vals[-1])

    for date in dates:
        row = {}

        for lag in lag_wins:
            if lag == 1:
                row["lag_1"] = smoothed_val
            elif len(vals) >= lag:
                row[f"lag_{lag}"] = float(vals[-lag])
            else:
                row[f"lag_{lag}"] = mean_sales

        for w in roll_wins:
            window = vals[-w:] if len(vals) >= w else vals
            row[f"rolling_mean_{w}"] = float(np.mean(window)) if window else mean_sales

        w7 = vals[-7:] if len(vals) >= 7 else vals
        row["rolling_std_7"] = float(np.std(w7)) if len(w7) > 1 else 0.0

        row["day_of_week"]   = int(date.dayofweek)
        row["week_of_year"]  = int(date.isocalendar()[1])
        row["month_of_year"] = int(date.month)
        row["quarter"]       = int(date.quarter)
        row["year"]          = int(date.year)
        row["is_weekend"]    = int(date.dayofweek >= 5)
        row["store"]         = store_code
        row["item"]          = item_code

        feat_row = {col: row.get(col, 0.0) for col in feature_list}
        all_rows.append(feat_row)

        X_step = pd.DataFrame([feat_row])[feature_list].astype(float)

        rf_p  = float(np.clip(rf_model.predict(X_step)[0],  0.0, None))
        xgb_p = float(np.clip(xgb_model.predict(X_step)[0], 0.0, None))
        lgb_p = float(np.clip(lgb_model.predict(X_step)[0], 0.0, None))
        base  = np.array([[rf_p, xgb_p, lgb_p]])
        ens_p = float(meta_model.predict(base)[0])

        rf_preds.append(rf_p)
        xgb_preds.append(xgb_p)
        lgb_preds.append(lgb_p)
        ens_preds.append(ens_p)

        # EMA update — alpha=1.0 means no smoothing (volatile segment)
        smoothed_val = ema_alpha * ens_p + (1.0 - ema_alpha) * smoothed_val
        vals.append(ens_p)

    future_X = pd.DataFrame(all_rows)[feature_list].astype(float)
    return (
        future_X,
        np.array(rf_preds),
        np.array(xgb_preds),
        np.array(lgb_preds),
        np.array(ens_preds),
    )


# ── Segment-aware post-processing ────────────────────────────────────────────

def _apply_trend_continuation(
    predictions: np.ndarray,
    history_vals: np.ndarray,
    horizon: int,
    trend_max_weight: float,
    trend_min_slope: float,
) -> np.ndarray:
    """
    Blend model predictions with a trend-projected baseline.
    Disabled (returns unchanged) for segments where trend_max_weight=0.
    """
    if trend_max_weight == 0.0 or len(history_vals) < 14:
        return predictions

    trend_slope  = _estimate_trend_slope(history_vals, window=28)
    recent_level = _estimate_recent_level(history_vals, window=14)

    if abs(trend_slope) < trend_min_slope:
        return predictions

    trend_proj = np.array([
        recent_level * (1 + trend_slope * (i + 1))
        for i in range(horizon)
    ])
    trend_proj = np.clip(trend_proj, 0.0, None)

    blend_weight = min(trend_max_weight, abs(trend_slope) * 20)

    model_mean = float(np.mean(predictions))
    trend_mean = float(np.mean(trend_proj))
    rel_div = abs(model_mean - trend_mean) / max(recent_level, 1.0)

    if rel_div < 0.05:
        return predictions

    adjusted = (1 - blend_weight) * predictions + blend_weight * trend_proj
    log.debug(f"Trend adj: slope={trend_slope:.4f} w={blend_weight:.2f} "
              f"model={model_mean:.1f} trend={trend_mean:.1f}")
    return np.clip(adjusted, 0.0, None)


def _apply_smoothing(
    predictions: np.ndarray,
    raw_frac: float,
    window: int,
) -> np.ndarray:
    """
    Blend raw predictions with a centered moving average.

    raw_frac=1.0 → no smoothing (volatile segment)
    raw_frac=0.25 → mostly smoothed (stable segment)
    window=1 → identity (no effect)
    window=3 → gentle 3-day average
    window=5 → stronger smoothing (intermittent)
    """
    if len(predictions) < 4 or raw_frac >= 1.0 or window <= 1:
        return np.clip(predictions, 0.0, None)

    smoothed = uniform_filter1d(predictions, size=window, mode='nearest')
    blended  = raw_frac * predictions + (1.0 - raw_frac) * smoothed
    return np.clip(blended, 0.0, None)


# ── Main inference function ───────────────────────────────────────────────────

def run_inference(
    df: pd.DataFrame,
    store,
    item,
    horizon: int = None,
    segment: str = None,
) -> Dict[str, Any]:
    """
    Generate a demand forecast for one store-item pair.

    Parameters:
        df:      Full clean DataFrame from data_loader.load_data()
        store:   Store ID (int or str)
        item:    Item ID (int or str)
        horizon: Forecast horizon in days
        segment: Demand segment from the session cache (REQUIRED for accuracy).
                 Passed by forecast.py from _seg_cache so the same label used
                 in the product list is used here — single source of truth.
                 Falls back to 'unknown' if not supplied.
    """
    cfg     = _cfg()
    horizon = horizon or cfg["forecast"]["default_horizon"]
    allowed = cfg["forecast"]["available_horizons"]

    if horizon not in allowed:
        raise ValueError(f"horizon={horizon} not valid. Choose from: {allowed}")

    # Use supplied segment (from session cache) or fallback
    segment = segment or "unknown"

    pid = f"{store}_{item}"
    log.info("Inference requested", extra={
        "product": pid, "horizon": horizon, "segment": segment
    })

    # Get segment-specific inference parameters
    params = _get_params(segment)
    log.debug(f"Segment '{segment}' params: {params}")

    with Timer(f"Inference {pid} h={horizon}", log):

        _store.load()

        history = get_product_series(df, store, item)

        if len(history) < 365:
            log.warning("Short history — lag_365 uses mean_sales fallback",
                        extra={"product": pid, "history_days": len(history)})

        store_code = _encode(store, _store.store_encoder, "store")
        item_code  = _encode(item,  _store.item_encoder,  "item")

        # Recursive forecast with segment-aware EMA alpha
        future_X, rf_preds, xgb_preds, lgb_preds, point_preds = _build_recursive_features(
            history      = history,
            horizon      = horizon,
            store_code   = store_code,
            item_code    = item_code,
            feature_list = _store.feature_list,
            rf_model     = _store.rf,
            xgb_model    = _store.xgb_model,
            lgb_model    = _store.lgb_model,
            meta_model   = _store.meta_model,
            ema_alpha    = params["ema_alpha"],
        )

        history_arr = history.values.astype(float)

        # Step 1: Trend continuation (only for trending segment)
        point_preds = _apply_trend_continuation(
            point_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )
        rf_preds = _apply_trend_continuation(
            rf_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )
        xgb_preds = _apply_trend_continuation(
            xgb_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )
        lgb_preds = _apply_trend_continuation(
            lgb_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )

        # Step 2: Segment-aware smoothing
        # volatile: raw_frac=1.0 → no smoothing, window=1 → identity
        # stable:   raw_frac=0.25 → mostly smoothed
        point_preds = _apply_smoothing(point_preds, params["smooth_raw_frac"], params["smooth_window"])
        rf_preds    = _apply_smoothing(rf_preds,    params["smooth_raw_frac"], params["smooth_window"])
        xgb_preds   = _apply_smoothing(xgb_preds,  params["smooth_raw_frac"], params["smooth_window"])
        lgb_preds   = _apply_smoothing(lgb_preds,  params["smooth_raw_frac"], params["smooth_window"])

        # Step 3: Quantile bounds (always using raw model output)
        lower_preds = np.clip(_store.q_lower.predict(future_X), 0.0, None)
        upper_preds = np.clip(_store.q_upper.predict(future_X), 0.0, None)

        # Apply same trend + smoothing to bounds for visual consistency
        lower_preds = _apply_trend_continuation(
            lower_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )
        upper_preds = _apply_trend_continuation(
            upper_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )
        lower_preds = _apply_smoothing(lower_preds, params["smooth_raw_frac"], params["smooth_window"])
        upper_preds = _apply_smoothing(upper_preds, params["smooth_raw_frac"], params["smooth_window"])

        # Guarantee lower ≤ ensemble ≤ upper
        lower_preds = np.minimum(lower_preds, point_preds)
        upper_preds = np.maximum(upper_preds, point_preds)

        forecast_dates = pd.date_range(
            start   = history.index[-1] + pd.Timedelta(days=1),
            periods = horizon,
            freq    = "D",
        ).strftime("%Y-%m-%d").tolist()

        tail = history.tail(90).sort_index()

    log.info("Inference complete", extra={
        "product":      pid,
        "segment":      segment,
        "horizon":      horizon,
        "avg_forecast": round(float(point_preds.mean()), 2),
        "store_code":   store_code,
        "item_code":    item_code,
    })

    def _fmt(arr): return [round(float(v), 2) for v in arr]

    return {
        "product_id":     pid,
        "store":          store,
        "item":           item,
        "segment":        segment,
        "horizon":        horizon,
        "forecast_dates": forecast_dates,
        "point_forecast": _fmt(point_preds),
        "lower_bound":    _fmt(lower_preds),
        "upper_bound":    _fmt(upper_preds),
        "history_dates":  tail.index.strftime("%Y-%m-%d").tolist(),
        "history_sales":  _fmt(tail.values),
        "model_predictions": {
            "ensemble":      _fmt(point_preds),
            "random_forest": _fmt(rf_preds),
            "xgboost":       _fmt(xgb_preds),
            "lightgbm":      _fmt(lgb_preds),
        },
    }

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



def _encode(value, encoder: dict, col_name: str) -> int:
    """Map raw store/item value → training-time code. -1 for unseen values."""
    key = str(value).strip()
    if key in encoder:
        return int(encoder[key])
    log.warning(f"Unseen {col_name} value '{key}' — using code -1")
    return -1



_SEGMENT_PARAMS: Dict[str, dict] = {
    "trending": {

        "ema_alpha":        0.50,
        "smooth_raw_frac":  0.15,   
        "smooth_window":    7,      
        "trend_max_weight": 0.65,   
        "trend_min_slope":  0.002,
    },
    "volatile": {
        "ema_alpha":        1.00,
        "smooth_raw_frac":  1.00,   
        "smooth_window":    1,
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
    },
    "seasonal_volatile": {
        # Keep window=3 to preserve genuine seasonality; don't over-smooth
        "ema_alpha":        0.60,
        "smooth_raw_frac":  0.45,
        "smooth_window":    3,
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
    },
    "seasonal_stable": {
        # window=3: gentle smoothing
        "ema_alpha":        0.40,
        "smooth_raw_frac":  0.50,
        "smooth_window":    3,
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
    },
    "stable": {
        "ema_alpha":        0.20,   
        "smooth_raw_frac":  0.05,   
        "smooth_window":    7,
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
        "anchor_to_mean":   True,   
    },
    "intermittent": {
        "ema_alpha":        0.25,
        "smooth_raw_frac":  0.05,
        "smooth_window":    7,
        "trend_max_weight": 0.00,
        "trend_min_slope":  999.0,
        "anchor_to_mean":   True,
    },
    "unknown": {
        "ema_alpha":        0.35,
        "smooth_raw_frac":  0.30,
        "smooth_window":    7,
        "trend_max_weight": 0.25,
        "trend_min_slope":  0.002,
    },
}

def _get_params(segment: str) -> dict:
    return _SEGMENT_PARAMS.get(segment, _SEGMENT_PARAMS["unknown"])



def _estimate_trend(values: np.ndarray, window: int = 60) -> tuple:

    tail = values[-window:] if len(values) >= window else values
    if len(tail) < 14:
        return 0.0, 0.0, float(np.mean(values)) if len(values) else 0.0

    X    = np.arange(len(tail)).reshape(-1, 1)
    reg  = LinearRegression().fit(X, tail.reshape(-1, 1))
    slope_abs = float(reg.coef_[0][0])          # units / day (absolute)

    mean = float(np.mean(np.abs(tail)))
    norm_slope = slope_abs / mean if mean > 0 else 0.0

    # EWM recent level — more weight on last 14 days
    tail14 = values[-14:] if len(values) >= 14 else values
    weights = np.exp(np.linspace(-1, 0, len(tail14)))
    recent_level = float(np.average(tail14, weights=weights))

    return norm_slope, slope_abs, recent_level



def _build_recursive_features(
    history:          pd.Series,
    horizon:          int,
    store_code:       int,
    item_code:        int,
    feature_list:     list,
    rf_model,
    xgb_model,
    lgb_model,
    meta_model,
    ema_alpha:        float,
    segment:          str   = "",
    history_arr:      "np.ndarray | None" = None,
) -> tuple:

    cfg       = _cfg()["features"]
    lag_wins  = cfg["lag_windows"]
    roll_wins = cfg["rolling_windows"]

    vals         = list(history.values.astype(float))
    smoothed_vals = list(history.values.astype(float))   # FIX 1: new buffer
    mean_sales   = float(np.mean(vals)) if vals else 0.0

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
            elif segment == "volatile" and lag >= 7:
                h = history_arr if history_arr is not None else history.values.astype(float)
                row[f"lag_{lag}"] = float(np.mean(h[-lag:])) if len(h) >= lag else mean_sales
            elif len(smoothed_vals) >= lag:
                row[f"lag_{lag}"] = float(smoothed_vals[-lag])
            else:
                row[f"lag_{lag}"] = mean_sales

        # Rolling means from smoothed_vals
        for w in roll_wins:
            window = smoothed_vals[-w:] if len(smoothed_vals) >= w else smoothed_vals
            row[f"rolling_mean_{w}"] = float(np.mean(window)) if window else mean_sales

        # Rolling std
        w7 = smoothed_vals[-7:] if len(smoothed_vals) >= 7 else smoothed_vals
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

        rf_p  = float(np.clip(rf_model.predict(X_step)[0],   0.0, None))
        xgb_p = float(np.clip(xgb_model.predict(X_step)[0], 0.0, None))
        lgb_p = float(np.clip(lgb_model.predict(X_step)[0], 0.0, None))
        base  = np.array([[rf_p, xgb_p, lgb_p]])
        ens_p = float(meta_model.predict(base)[0])

        rf_preds.append(rf_p)
        xgb_preds.append(xgb_p)
        lgb_preds.append(lgb_p)
        ens_preds.append(ens_p)

        # EMA update
        smoothed_val = ema_alpha * ens_p + (1.0 - ema_alpha) * smoothed_val

        # FIX 1: append to BOTH buffers
        vals.append(ens_p)
        smoothed_vals.append(smoothed_val)   # FIX 1

    future_X = pd.DataFrame(all_rows)[feature_list].astype(float)
    return (
        future_X,
        np.array(rf_preds),
        np.array(xgb_preds),
        np.array(lgb_preds),
        np.array(ens_preds),
    )



def _apply_trend_continuation(
    predictions:      np.ndarray,
    history_vals:     np.ndarray,
    horizon:          int,
    trend_max_weight: float,
    trend_min_slope:  float,
) -> np.ndarray:
    
    if trend_max_weight == 0.0 or len(history_vals) < 14:
        return predictions

    norm_slope, daily_increment, recent_level = _estimate_trend(history_vals, window=60)

    if abs(norm_slope) < trend_min_slope:
        return predictions

    # FIX 4: Additive trend projection (no compounding)
    trend_proj = np.array([
        recent_level + daily_increment * (i + 1)
        for i in range(horizon)
    ])
    trend_proj = np.clip(trend_proj, 0.0, None)

    # FIX 2: Weight ramps to max_weight as slope / threshold → 1
    blend_weight = trend_max_weight * min(1.0, abs(norm_slope) / trend_min_slope)

    adjusted = (1.0 - blend_weight) * predictions + blend_weight * trend_proj

    log.debug(
        f"Trend continuation: norm_slope={norm_slope:.4f} "
        f"daily_inc={daily_increment:.2f} weight={blend_weight:.2f} "
        f"model_mean={np.mean(predictions):.1f} trend_mean={np.mean(trend_proj):.1f}"
    )
    return np.clip(adjusted, 0.0, None)


def _apply_smoothing(
    predictions: np.ndarray,
    raw_frac:    float,
    window:      int,
) -> np.ndarray:
    
    if len(predictions) < 4 or raw_frac >= 1.0 or window <= 1:
        return np.clip(predictions, 0.0, None)

    smoothed = uniform_filter1d(predictions, size=window, mode='nearest')
    blended  = raw_frac * predictions + (1.0 - raw_frac) * smoothed
    return np.clip(blended, 0.0, None)


# ── Per-product metric computation ───────────────────────────────────────────

def _compute_per_product_metrics(
    history:    pd.Series,
    store_code: int,
    item_code:  int,
    params:     dict,
    segment:    str = "",
    test_days:  int = 30,
) -> dict:

    if len(history) < test_days + 14:
        return {}   # not enough history for a meaningful split

    actuals = history.values.astype(float)[-test_days:]
    seed    = history.iloc[:-test_days]

    try:
        _, rf_p, xgb_p, lgb_p, ens_p = _build_recursive_features(
            history      = seed,
            horizon      = test_days,
            store_code   = store_code,
            item_code    = item_code,
            feature_list = _store.feature_list,
            rf_model     = _store.rf,
            xgb_model    = _store.xgb_model,
            lgb_model    = _store.lgb_model,
            meta_model   = _store.meta_model,
            ema_alpha    = params["ema_alpha"],
            segment      = segment,
            history_arr  = seed.values.astype(float),
        )
    except Exception:
        return {}

    def _wmape(y_true, y_pred):
        denom = float(np.sum(np.abs(y_true)))
        return round(float(np.sum(np.abs(y_true - y_pred))) / denom, 4) if denom > 0 else 0.0

    def _mae(y_true, y_pred):
        return round(float(np.mean(np.abs(y_true - y_pred))), 2)

    return {
        "random_forest": {
            "wmape": _wmape(actuals, rf_p),
            "mae":   _mae(actuals, rf_p),
        },
        "xgboost": {
            "wmape": _wmape(actuals, xgb_p),
            "mae":   _mae(actuals, xgb_p),
        },
        "lightgbm": {
            "wmape": _wmape(actuals, lgb_p),
            "mae":   _mae(actuals, lgb_p),
        },
        "ensemble": {
            "wmape": _wmape(actuals, ens_p),
            "mae":   _mae(actuals, ens_p),
        },
        "prediction_interval": {
            "target_coverage": 0.80,
            # Approximate coverage: lower = ensemble - 1.28*std, upper = ensemble + 1.28*std
            "actual_coverage": round(float(np.mean(
                (actuals >= ens_p - 1.28 * float(np.std(actuals)))
                & (actuals <= ens_p + 1.28 * float(np.std(actuals)))
            )), 4),
        },
    }



def run_inference(
    df:       pd.DataFrame,
    store,
    item,
    horizon:  int = None,
    segment:  str = None,
) -> Dict[str, Any]:

    cfg     = _cfg()
    horizon = horizon or cfg["forecast"]["default_horizon"]
    allowed = cfg["forecast"]["available_horizons"]

    if horizon not in allowed:
        raise ValueError(f"horizon={horizon} not valid. Choose from: {allowed}")

    segment = segment or "unknown"
    pid     = f"{store}_{item}"

    log.info("Inference requested", extra={
        "product": pid, "horizon": horizon, "segment": segment
    })

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

        history_arr = history.values.astype(float)

        # Step 1: Recursive forecast
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
            segment      = segment,
            history_arr  = history_arr,
        )


        point_preds = _apply_smoothing(point_preds, params["smooth_raw_frac"], params["smooth_window"])
        rf_preds    = _apply_smoothing(rf_preds,    params["smooth_raw_frac"], params["smooth_window"])
        xgb_preds   = _apply_smoothing(xgb_preds,  params["smooth_raw_frac"], params["smooth_window"])
        lgb_preds   = _apply_smoothing(lgb_preds,  params["smooth_raw_frac"], params["smooth_window"])

        # Step 3: Trend continuation (FIX 2 + FIX 4 — stronger weight, additive)
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

        # Step 4: Quantile bounds
        lower_preds = np.clip(_store.q_lower.predict(future_X), 0.0, None)
        upper_preds = np.clip(_store.q_upper.predict(future_X), 0.0, None)

        lower_preds = _apply_smoothing(lower_preds, params["smooth_raw_frac"], params["smooth_window"])
        upper_preds = _apply_smoothing(upper_preds, params["smooth_raw_frac"], params["smooth_window"])
        lower_preds = _apply_trend_continuation(
            lower_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )
        upper_preds = _apply_trend_continuation(
            upper_preds, history_arr, horizon,
            params["trend_max_weight"], params["trend_min_slope"]
        )


        if segment == "volatile":
            recent_mean = float(np.mean(history_arr[-30:]))
            shift = recent_mean - float(np.mean(point_preds))
            point_preds += shift
            np.clip(point_preds, 0.0, None, out=point_preds)


        # model bias, not a real signal.
        if params.get("anchor_to_mean", False):
            recent_mean = float(np.mean(history_arr[-30:]))
            for arr in [point_preds, rf_preds, xgb_preds, lgb_preds]:
                shift = recent_mean - float(np.mean(arr))
                arr  += shift
                np.clip(arr, 0.0, None, out=arr)

        # Guarantee lower ≤ ensemble ≤ upper
        lower_preds = np.minimum(lower_preds, point_preds)
        upper_preds = np.maximum(upper_preds, point_preds)


        model_metrics = _compute_per_product_metrics(
            history      = history,
            store_code   = store_code,
            item_code    = item_code,
            params       = params,
            segment      = segment,
        )

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
        "model_metrics":  model_metrics,
        "model_predictions": {
            "ensemble":      _fmt(point_preds),
            "random_forest": _fmt(rf_preds),
            "xgboost":       _fmt(xgb_preds),
            "lightgbm":      _fmt(lgb_preds),
        },
    }

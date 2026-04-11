"""
backend/pipeline/inference_pipeline.py
========================================
Loads saved models and generates forecasts for a given store/item/horizon.
NO training happens here — models are loaded from disk once and cached.

Replaces: prediction section of src/main.py

Why training and inference are separate files:
    Training (with Optuna) takes 30-40 minutes on the full dataset.
    Inference per API request must be under 1 second.
    Mixing them means retraining on every user request — completely unusable.

Usage:
    from backend.pipeline.inference_pipeline import run_inference
    result = run_inference(df, store=3, item=12, horizon=30)
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional
import yaml
import joblib

from backend.services.logger import get_logger, Timer
from backend.services.data_loader import get_product_series
from backend.pipeline.segmentation import get_product_segment
from backend.pipeline.ensemble import NNLSEnsemble   # REQUIRED — lets joblib unpickle meta_model.pkl

log = get_logger(__name__)


# ── Config ────────────────────────────────────────────────────────────────────

def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


def _models_dir() -> Path:
    root = Path(__file__).resolve().parents[2]
    return root / _cfg()["paths"]["saved_models"]


# ── Model store (singleton — loads from disk once, stays in memory) ───────────

class _ModelStore:
    """
    Caches all trained models in memory after the first load.

    On the first call to run_inference(), this loads all .pkl files from
    backend/saved_models/. Every subsequent call reuses the in-memory objects
    — no disk I/O, no delay.

    This is what makes inference fast enough for an API endpoint.
    """
    _instance: Optional["_ModelStore"] = None
    _loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self) -> None:
        """Load all model files from disk. No-op if already loaded."""
        if self._loaded:
            return

        d = _models_dir()
        required = [
            "random_forest.pkl",
            "xgboost.pkl",
            "lightgbm.pkl",
            "meta_model.pkl",
            "quantile_lower.pkl",
            "quantile_upper.pkl",
            "segments.pkl",
            "feature_list.pkl",
        ]
        missing = [f for f in required if not (d / f).exists()]
        if missing:
            raise FileNotFoundError(
                f"Model files not found: {missing}\n"
                f"Run training first:\n"
                f"  python -m backend.pipeline.training_pipeline"
            )

        with Timer("Loading models from disk", log):
            self.rf           = joblib.load(d / "random_forest.pkl")
            self.xgb_model    = joblib.load(d / "xgboost.pkl")
            self.lgb_model    = joblib.load(d / "lightgbm.pkl")
            self.meta_model   = joblib.load(d / "meta_model.pkl")   # NNLSEnsemble
            self.q_lower      = joblib.load(d / "quantile_lower.pkl")
            self.q_upper      = joblib.load(d / "quantile_upper.pkl")
            self.segments_df  = joblib.load(d / "segments.pkl")
            self.feature_list = joblib.load(d / "feature_list.pkl")

        self._loaded = True
        log.info("All models loaded into memory")

    def reset(self) -> None:
        """Force reload on next call — used after retraining."""
        self._loaded = False


_store = _ModelStore()


# ── Future feature builder ────────────────────────────────────────────────────

def _build_future_features(
    history: pd.Series,
    horizon: int,
    store: int,
    item: int,
    feature_list: list,
) -> pd.DataFrame:
    """
    Build a feature row for each future date in the forecast horizon.

    For step t (t = 1 … horizon):
        Lag features  — look back into the known history.
                        For steps beyond lag distance, use 0 as placeholder.
        Rolling means — computed from the tail of known history.
        Calendar      — computed from the actual future date.
        Categorical   — raw store/item IDs (must match training encoding).

    Args:
        history:      Sales time series, date-indexed, sorted ascending.
                      This is the actual historical data for the product.
        horizon:      Number of days to forecast.
        store:        Integer store ID.
        item:         Integer item ID.
        feature_list: Exact feature column order expected by the models.

    Returns:
        pd.DataFrame of shape (horizon, len(feature_list))
    """
    cfg      = _cfg()["features"]
    lag_wins = cfg["lag_windows"]       # [1, 7, 14, 28, 365]
    roll_wins = cfg["rolling_windows"]  # [7, 14, 28]

    # Start with known history, extend with placeholders as we step forward
    ext   = list(history.values)
    start = history.index[-1] + pd.Timedelta(days=1)
    dates = pd.date_range(start=start, periods=horizon, freq="D")
    rows  = []

    for _, date in enumerate(dates):
        row = {}

        # Lag features — look back into extended history
        for lag in lag_wins:
            idx = -lag
            row[f"lag_{lag}"] = float(ext[idx]) if abs(idx) <= len(ext) else 0.0

        # Rolling mean features — tail of current extended history
        for w in roll_wins:
            window = ext[-w:] if len(ext) >= w else ext
            row[f"rolling_mean_{w}"] = float(np.mean(window)) if window else 0.0

        # Rolling std (7-day)
        w7  = ext[-7:] if len(ext) >= 7 else ext
        row["rolling_std_7"] = float(np.std(w7)) if len(w7) > 1 else 0.0

        # Calendar features
        row["day_of_week"]   = int(date.dayofweek)
        row["week_of_year"]  = int(date.isocalendar()[1])
        row["month_of_year"] = int(date.month)
        row["quarter"]       = int(date.quarter)
        row["year"]          = int(date.year)
        row["is_weekend"]    = int(date.dayofweek >= 5)

        # Categorical (raw int IDs — matching training label encoding)
        row["store"] = store
        row["item"]  = item

        rows.append(row)

        # Append 0 placeholder so next step's lags reference current position
        # In future: replace with model prediction for recursive forecasting
        ext.append(0.0)

    return pd.DataFrame(rows)[feature_list]


# ── Main inference function ───────────────────────────────────────────────────

def run_inference(
    df: pd.DataFrame,
    store: int,
    item: int,
    horizon: int = None,
) -> Dict[str, Any]:
    """
    Generate a demand forecast for one store-item pair.

    Args:
        df:      Full clean DataFrame from data_loader.load_data()
        store:   Store integer ID  (e.g. 3)
        item:    Item integer ID   (e.g. 12)
        horizon: Days to forecast  (e.g. 30).
                 Must be in config.yaml → forecast.available_horizons.
                 Defaults to config.yaml → forecast.default_horizon.

    Returns:
        dict with keys:
            product_id      str   e.g. "3_12"
            store           int
            item            int
            segment         str   e.g. "seasonal_stable"
            horizon         int   e.g. 30
            forecast_dates  list  ["2017-01-01", "2017-01-02", ...]
            point_forecast  list  ensemble prediction per day
            lower_bound     list  10th percentile per day
            upper_bound     list  90th percentile per day
            history_dates   list  last 90 days of actual sales dates
            history_sales   list  last 90 days of actual sales values

    Raises:
        FileNotFoundError  if models have not been trained yet
        ValueError         if product not found or horizon invalid
    """
    cfg     = _cfg()
    horizon = horizon or cfg["forecast"]["default_horizon"]
    allowed = cfg["forecast"]["available_horizons"]

    if horizon not in allowed:
        raise ValueError(
            f"horizon={horizon} is not valid. "
            f"Choose from: {allowed}"
        )

    pid = f"{store}_{item}"
    log.info("Inference requested", extra={"product": pid, "horizon": horizon})

    with Timer(f"Inference {pid} h={horizon}", log):

        # Load all models — instant if already cached from a previous call
        _store.load()

        # Extract product's historical sales series
        history = get_product_series(df, store, item)

        # Get demand segment for this product
        try:
            segment = get_product_segment(_store.segments_df, pid)
        except ValueError:
            segment = "unknown"
            log.warning(f"Segment not found for product '{pid}'")

        # Build future feature matrix — one row per forecast day
        future_X = _build_future_features(
            history      = history,
            horizon      = horizon,
            store        = store,
            item         = item,
            feature_list = _store.feature_list,
        )

        # Individual base model predictions
        rf_preds  = _store.rf.predict(future_X)
        xgb_preds = _store.xgb_model.predict(future_X)
        lgb_preds = _store.lgb_model.predict(future_X)

        # Stacked ensemble — column-stack then multiply by learned weights
        base_stack   = np.column_stack([rf_preds, xgb_preds, lgb_preds])
        point_preds  = _store.meta_model.predict(base_stack)  # clips to 0

        # 80% prediction interval from quantile models
        lower_preds = np.clip(_store.q_lower.predict(future_X), 0.0, None)
        upper_preds = np.clip(_store.q_upper.predict(future_X), 0.0, None)

        # Forecast date strings
        forecast_dates = pd.date_range(
            start   = history.index[-1] + pd.Timedelta(days=1),
            periods = horizon,
            freq    = "D",
        ).strftime("%Y-%m-%d").tolist()

        # Last 90 days of actual history for the dashboard chart
        tail = history.tail(90)

    log.info(
        "Inference complete",
        extra={
            "product":      pid,
            "segment":      segment,
            "horizon":      horizon,
            "avg_forecast": round(float(point_preds.mean()), 2),
        }
    )

    return {
        "product_id":     pid,
        "store":          store,
        "item":           item,
        "segment":        segment,
        "horizon":        horizon,
        "forecast_dates": forecast_dates,
        "point_forecast": [round(float(v), 2) for v in point_preds],
        "lower_bound":    [round(float(v), 2) for v in lower_preds],
        "upper_bound":    [round(float(v), 2) for v in upper_preds],
        "history_dates":  tail.index.strftime("%Y-%m-%d").tolist(),
        "history_sales":  [round(float(v), 2) for v in tail.values],
    }

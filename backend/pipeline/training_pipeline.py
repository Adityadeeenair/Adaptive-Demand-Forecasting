import copy
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any
import yaml
import joblib
warnings.filterwarnings("ignore")

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error
from scipy.optimize import nnls
import xgboost as xgb
import lightgbm as lgb
import optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)

from backend.services.logger import get_logger, Timer
from backend.services.data_loader import load_data
from backend.pipeline.feature_engineering import (
    build_features, split_train_test, get_feature_list
)
from backend.pipeline.segmentation import compute_segments
from backend.pipeline.ensemble import NNLSEnsemble   # stable pickle path

log = get_logger(__name__)



def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


def _models_dir() -> Path:
    root = Path(__file__).resolve().parents[2]
    d    = root / _cfg()["paths"]["saved_models"]
    d.mkdir(parents=True, exist_ok=True)
    return d



def wmape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Weighted Mean Absolute Percentage Error — primary optimisation metric."""
    denom = np.sum(np.abs(y_true))
    return float(np.sum(np.abs(y_true - y_pred)) / denom) if denom > 0 else 0.0


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(mean_absolute_error(y_true, y_pred))



def cv_score(model, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:

    cfg  = _cfg()["split"]
    tscv = TimeSeriesSplit(n_splits=cfg["cv_n_splits"], gap=cfg["cv_gap"])
    wmapes, maes = [], []

    for fold, (tr_idx, val_idx) in enumerate(tscv.split(X)):
        m = copy.deepcopy(model)
        m.fit(X.iloc[tr_idx], y.iloc[tr_idx])
        preds = m.predict(X.iloc[val_idx])
        wmapes.append(wmape(y.iloc[val_idx].values, preds))
        maes.append(mae(y.iloc[val_idx].values, preds))
        log.debug(f"CV fold {fold + 1}  wmape={wmapes[-1]:.4f}")

    result = {
        "wmape_mean": round(float(np.mean(wmapes)), 4),
        "wmape_std":  round(float(np.std(wmapes)),  4),
        "mae_mean":   round(float(np.mean(maes)),   4),
        "n_folds":    cfg["cv_n_splits"],
    }
    log.info("CV evaluation complete", extra=result)
    return result



def _tune_xgboost(X: pd.DataFrame, y: pd.Series) -> dict:
    
    cfg  = _cfg()
    sp   = cfg["optuna"]["xgboost_search_space"]
    tscv = TimeSeriesSplit(n_splits=cfg["split"]["cv_n_splits"])

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators":     trial.suggest_int(  "n_estimators",     *sp["n_estimators"]),
            "max_depth":        trial.suggest_int(  "max_depth",        *sp["max_depth"]),
            "learning_rate":    trial.suggest_float("learning_rate",    *sp["learning_rate"],    log=True),
            "subsample":        trial.suggest_float("subsample",        *sp["subsample"]),
            "colsample_bytree": trial.suggest_float("colsample_bytree", *sp["colsample_bytree"]),
            "min_child_weight": trial.suggest_int(  "min_child_weight", *sp["min_child_weight"]),
            "random_state": 42, "n_jobs": -1, "verbosity": 0,
        }
        scores = []
        for tr, val in tscv.split(X):
            m = xgb.XGBRegressor(**params)
            m.fit(X.iloc[tr], y.iloc[tr])
            scores.append(wmape(y.iloc[val].values, m.predict(X.iloc[val])))
        return float(np.mean(scores))

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=cfg["optuna"]["n_trials"], show_progress_bar=False)
    log.info("XGBoost tuning done",
             extra={"best_wmape": round(study.best_value, 4), "params": study.best_params})
    return study.best_params


def _tune_lightgbm(X: pd.DataFrame, y: pd.Series) -> dict:
    """Tune LightGBM hyperparameters using Optuna + TimeSeriesSplit."""
    cfg  = _cfg()
    sp   = cfg["optuna"]["lightgbm_search_space"]
    tscv = TimeSeriesSplit(n_splits=cfg["split"]["cv_n_splits"])

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators":      trial.suggest_int(  "n_estimators",      *sp["n_estimators"]),
            "max_depth":         trial.suggest_int(  "max_depth",         *sp["max_depth"]),
            "learning_rate":     trial.suggest_float("learning_rate",     *sp["learning_rate"],    log=True),
            "subsample":         trial.suggest_float("subsample",         *sp["subsample"]),
            "colsample_bytree":  trial.suggest_float("colsample_bytree",  *sp["colsample_bytree"]),
            "min_child_samples": trial.suggest_int(  "min_child_samples", *sp["min_child_samples"]),
            "random_state": 42, "verbose": -1,
        }
        scores = []
        for tr, val in tscv.split(X):
            m = lgb.LGBMRegressor(**params)
            m.fit(X.iloc[tr], y.iloc[tr])
            scores.append(wmape(y.iloc[val].values, m.predict(X.iloc[val])))
        return float(np.mean(scores))

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=cfg["optuna"]["n_trials"], show_progress_bar=False)
    log.info("LightGBM tuning done",
             extra={"best_wmape": round(study.best_value, 4), "params": study.best_params})
    return study.best_params



def train_base_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    tune: bool = True,
) -> Dict[str, Any]:

    cfg     = _cfg()
    mcfg    = cfg["models"]
    to_tune = cfg["optuna"].get("models_to_tune", [])
    models  = {}

    with Timer("Random Forest", log):
        rf = RandomForestRegressor(**mcfg["random_forest"])
        rf.fit(X_train, y_train)
        models["random_forest"] = rf

    with Timer("XGBoost", log):
        xgb_params = dict(mcfg["xgboost"])
        if tune and "xgboost" in to_tune:
            log.info("Tuning XGBoost with Optuna...")
            best = _tune_xgboost(X_train, y_train)
            xgb_params.update(best)
            xgb_params.update({"random_state": 42, "n_jobs": -1, "verbosity": 0})
        xgb_model = xgb.XGBRegressor(**xgb_params)
        xgb_model.fit(X_train, y_train)
        models["xgboost"] = xgb_model

    with Timer("LightGBM", log):
        lgb_params = dict(mcfg["lightgbm"])
        if tune and "lightgbm" in to_tune:
            log.info("Tuning LightGBM with Optuna...")
            best = _tune_lightgbm(X_train, y_train)
            lgb_params.update(best)
            lgb_params.update({"random_state": 42, "verbose": -1})
        lgb_model = lgb.LGBMRegressor(**lgb_params)
        lgb_model.fit(X_train, y_train)
        models["lightgbm"] = lgb_model

    return models



def train_stacked_ensemble(
    base_models: Dict[str, Any],
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> NNLSEnsemble:

    """
    This section learns optimal ensemble weights using out-of-fold (OOF) predictions
    and non-negative least squares (NNLS).

    Why are we using OOF ?? -
        If base models predict on the same data they trained on, their
        predictions are overfit and the meta-model learns nothing useful.
        OOF means each row's prediction comes from a model that never
        saw that row during training — honest signal for the meta-model.

    Why NNLS over Ridge regression??? - 
        Ridge can assign negative weights when base models are correlated
        (e.g. XGBoost weight = -2.5), making the ensemble worse than any
        individual model. NNLS constrains all weights >= 0, guaranteeing
        the ensemble is at least as good as the best base model.

    """

    cfg  = _cfg()
    n_sp = cfg["split"]["cv_n_splits"]
    tscv = TimeSeriesSplit(n_splits=n_sp)

    log.info("Training stacked ensemble via OOF predictions")

    oof = {name: np.zeros(len(X_train)) for name in base_models}

    with Timer("OOF generation", log):
        for fold, (tr_idx, val_idx) in enumerate(tscv.split(X_train)):
            X_tr  = X_train.iloc[tr_idx]
            X_val = X_train.iloc[val_idx]
            y_tr  = y_train.iloc[tr_idx]
            for name, model in base_models.items():
                m = copy.deepcopy(model)    
                m.fit(X_tr, y_tr)
                oof[name][val_idx] = m.predict(X_val)
            log.debug(f"OOF fold {fold + 1}/{n_sp} done")

    meta_X = np.column_stack([oof[name] for name in base_models])   # (n_train, 3)
    meta_y = y_train.values                                          # (n_train,)

    weights_raw, residual = nnls(meta_X, meta_y)

    total = weights_raw.sum()
    weights_norm = weights_raw / total if total > 0 else weights_raw

    ensemble    = NNLSEnsemble(weights_norm)
    weight_dict = {name: round(float(w), 4)
                   for name, w in zip(base_models.keys(), ensemble.coef_)}

    log.info("Stacked ensemble trained", extra={"learned_weights": weight_dict})
    return ensemble



def train_quantile_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> Dict[str, lgb.LGBMRegressor]:
    
    cfg     = _cfg()["models"]
    qmodels = {}

    for bound, key in [("lower", "lightgbm_lower"), ("upper", "lightgbm_upper")]:
        with Timer(f"Quantile {bound}", log):
            m = lgb.LGBMRegressor(**cfg[key])
            m.fit(X_train, y_train)
            qmodels[bound] = m
            log.info(f"Quantile {bound} trained", extra={"alpha": cfg[key]["alpha"]})

    return qmodels



def evaluate_all(
    base_models: Dict[str, Any],
    meta_model: NNLSEnsemble,
    quantile_models: Dict[str, Any],
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> Dict[str, dict]:
    
    results = {}

    for name, model in base_models.items():
        preds = model.predict(X_test)
        results[name] = {
            "wmape": round(wmape(y_test.values, preds), 4),
            "mae":   round(mae(y_test.values, preds), 2),
        }

    # Stacked ensemble
    base_mat  = np.column_stack([m.predict(X_test) for m in base_models.values()])
    ens_preds = meta_model.predict(base_mat)   # NNLSEnsemble.predict clips to 0
    results["ensemble"] = {
        "wmape": round(wmape(y_test.values, ens_preds), 4),
        "mae":   round(mae(y_test.values, ens_preds), 2),
    }

    lower    = quantile_models["lower"].predict(X_test)
    upper    = quantile_models["upper"].predict(X_test)
    coverage = float(np.mean((y_test.values >= lower) & (y_test.values <= upper)))
    results["prediction_interval"] = {
        "target_coverage": 0.80,
        "actual_coverage": round(coverage, 4),
    }

    log.info("Evaluation complete", extra={"results": results})
    return results



def save_models(
    base_models: Dict[str, Any],
    meta_model: NNLSEnsemble,
    quantile_models: Dict[str, Any],
    segments_df: pd.DataFrame,
    feature_list: list,
    store_encoder: dict = None,
    item_encoder: dict = None,
) -> None:

    d = _models_dir()

    with Timer("Saving models", log):
        for name, model in base_models.items():
            joblib.dump(model, d / f"{name}.pkl")
        joblib.dump(meta_model,               d / "meta_model.pkl")
        joblib.dump(quantile_models["lower"], d / "quantile_lower.pkl")
        joblib.dump(quantile_models["upper"], d / "quantile_upper.pkl")
        joblib.dump(segments_df,              d / "segments.pkl")
        joblib.dump(feature_list,             d / "feature_list.pkl")
        if store_encoder is not None:
            joblib.dump(store_encoder, d / "store_encoder.pkl")
        if item_encoder is not None:
            joblib.dump(item_encoder,  d / "item_encoder.pkl")

    saved = [f.name for f in sorted(d.iterdir())]
    log.info("All models saved", extra={"directory": str(d), "files": saved})



def run_training(data_path: str = None, tune: bool = True) -> dict:

    log.info("=" * 55)
    log.info("ForecastIQ — Training Pipeline Starting")
    log.info("=" * 55)

    with Timer("Full training pipeline", log):

        df          = load_data(data_path)
        segments_df = compute_segments(df)
        ml_df, store_encoder, item_encoder = build_features(df)

        X_train, X_test, y_train, y_test = split_train_test(ml_df)
        feature_list = get_feature_list()

        log.info("Data ready",
                 extra={"X_train": X_train.shape, "X_test": X_test.shape,
                        "n_features": len(feature_list)})

        base_models     = train_base_models(X_train, y_train, tune=tune)
        meta_model      = train_stacked_ensemble(base_models, X_train, y_train)
        quantile_models = train_quantile_models(X_train, y_train)
        results         = evaluate_all(base_models, meta_model, quantile_models, X_test, y_test)
        save_models(base_models, meta_model, quantile_models, segments_df, feature_list,
                    store_encoder=store_encoder, item_encoder=item_encoder)
        joblib.dump(results, _models_dir() / "training_results.pkl")

    log.info("Training complete", extra={"results": results})
    return results



if __name__ == "__main__":
    results = run_training(tune=True)
    print("\n=== Final Results ===")
    for model, metrics in results.items():
        print(f"  {model}: {metrics}")

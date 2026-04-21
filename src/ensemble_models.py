import numpy as np

def weighted_ensemble(pred_rf, pred_xgb, pred_lgb):

    ensemble_pred = (
        0.25 * pred_rf +
        0.35 * pred_xgb +
        0.40 * pred_lgb
    )

    return ensemble_pred
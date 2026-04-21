"""
backend/pipeline/ensemble.py
==============================
Non-negative least squares ensemble wrapper.

Why a dedicated file:
    When Python pickles an object, it records the full import path
    of its class, e.g. 'backend.pipeline.ensemble.NNLSEnsemble'.
    On load, joblib re-imports that exact path to reconstruct the object.

    If NNLSEnsemble were defined inside training_pipeline.py and run
    via `python -m backend.pipeline.training_pipeline`, Python records
    the class as '__main__.NNLSEnsemble'. When inference_pipeline.py
    later calls joblib.load(), '__main__' is a different module and
    unpickling crashes with AttributeError.

    Putting the class here gives it a stable, importable path that
    works identically from training, inference, and the API.

Imported by:
    backend/pipeline/training_pipeline.py  (creates and saves instances)
    backend/pipeline/inference_pipeline.py (needed so joblib can load them)
"""

import numpy as np


class NNLSEnsemble:
    """
    Non-negative least squares ensemble of base forecasting models.

    Weights are learned from out-of-fold predictions using scipy NNLS:
        minimize  ||X @ w - y||_2
        subject to  w >= 0

    After normalising w to sum to 1, the ensemble output is on the same
    scale as the targets and is mathematically guaranteed to be at least
    as accurate as the best individual model on training data.

    Behaves like a sklearn estimator — exposes .predict(X).

    Attributes:
        coef_       (np.ndarray): learned non-negative weights, shape (n_models,)
        intercept_  (float):      always 0.0, present for sklearn compatibility
    """

    def __init__(self, weights: np.ndarray):
        self.coef_      = np.asarray(weights, dtype=float)
        self.intercept_ = 0.0

    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Weighted combination of base model predictions.

        Args:
            X: shape (n_samples, n_base_models)
               Each column is the prediction vector from one base model.

        Returns:
            shape (n_samples,), clipped to >= 0 (no negative sales).
        """
        return np.clip(np.dot(X, self.coef_), 0.0, None)

    def __repr__(self) -> str:
        weights = {f"model_{i}": round(float(w), 4) for i, w in enumerate(self.coef_)}
        return f"NNLSEnsemble(weights={weights})"

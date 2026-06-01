import numpy as np


class NNLSEnsemble:

    def __init__(self, weights: np.ndarray):
        self.coef_      = np.asarray(weights, dtype=float)
        self.intercept_ = 0.0

    def predict(self, X: np.ndarray) -> np.ndarray:

        return np.clip(np.dot(X, self.coef_), 0.0, None)

    def __repr__(self) -> str:
        weights = {f"model_{i}": round(float(w), 4) for i, w in enumerate(self.coef_)}
        return f"NNLSEnsemble(weights={weights})"

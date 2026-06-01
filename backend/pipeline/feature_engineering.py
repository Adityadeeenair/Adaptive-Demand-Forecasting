import pandas as pd
import numpy as np
from pathlib import Path
from typing import List
import yaml

from backend.services.logger import get_logger, Timer

log = get_logger(__name__)


def _cfg() -> dict:
    p = Path(__file__).resolve().parents[1] / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


def build_features(df: pd.DataFrame) -> pd.DataFrame:

    full_cfg = _cfg()
    fcfg     = full_cfg["features"]
    dcfg     = full_cfg["data"]

    date_col    = dcfg["date_column"]
    target_col  = dcfg["target_column"]
    prod_col    = dcfg["product_id_col"]
    store_col   = dcfg["store_column"]
    item_col    = dcfg["item_column"]
    lag_wins    = fcfg["lag_windows"]        # [1, 7, 14, 28, 365]
    roll_wins   = fcfg["rolling_windows"]    # [7, 14, 28]
    cal_feats   = fcfg["calendar_features"]

    log.info(
        "Building features",
        extra={"input_rows": len(df), "lag_windows": lag_wins, "roll_windows": roll_wins}
    )

    with Timer("Total feature engineering", log):

        df = df.copy()
        df = df.sort_values([prod_col, date_col]).reset_index(drop=True)

        grp = df.groupby(prod_col)[target_col]

        #  Lag features 
        # groupby().shift() is vectorised — no Python for-loop per product
        with Timer("Lags", log):
            for lag in lag_wins:
                df[f"lag_{lag}"] = grp.shift(lag)

        #  Rolling mean + std 
        # shift(1) before rolling = never use today's actual value
        # This is the key to preventing data leakage in time-series features
        with Timer("Rolling stats", log):
            shifted = grp.shift(1)
            for w in roll_wins:
                df[f"rolling_mean_{w}"] = (
                    shifted
                    .transform(lambda x: x.rolling(w, min_periods=1).mean())
                )
            # Rolling std — 7-day only (enough signal, avoids bloat)
            df["rolling_std_7"] = (
                shifted
                .transform(lambda x: x.rolling(7, min_periods=2).std().fillna(0))
            )

        # Calendar features 
        with Timer("Calendar", log):
            dt = df[date_col]
            if "day_of_week"   in cal_feats: df["day_of_week"]   = dt.dt.dayofweek.astype("int8")
            if "week_of_year"  in cal_feats: df["week_of_year"]  = dt.dt.isocalendar().week.astype("int8")
            if "month_of_year" in cal_feats: df["month_of_year"] = dt.dt.month.astype("int8")
            if "quarter"       in cal_feats: df["quarter"]       = dt.dt.quarter.astype("int8")
            if "year"          in cal_feats: df["year"]          = dt.dt.year.astype("int16")
            if "is_weekend"    in cal_feats: df["is_weekend"]    = (dt.dt.dayofweek >= 5).astype("int8")

        #  Categorical encoding 
        # Tree models don't need one-hot — integer label codes are fine.
        # We also capture the encoding map so inference can use the SAME codes.
        store_cat  = df[store_col].astype("category")
        item_cat   = df[item_col].astype("category")
        store_encoder = {str(v): int(c) for v, c in zip(store_cat.cat.categories, range(len(store_cat.cat.categories)))}
        item_encoder  = {str(v): int(c) for v, c in zip(item_cat.cat.categories,  range(len(item_cat.cat.categories)))}
        df[store_col] = store_cat.cat.codes.astype("int16")
        df[item_col]  = item_cat.cat.codes.astype("int16")

        # Drop NaN rows (one pass at the end) 
        # NaNs exist only at the start of each product's history due to lags.
        # Dropping after all features are built = single scan of the DataFrame.
        n_before = len(df)
        feat_cols = get_feature_list()
        df = df.dropna(subset=feat_cols).reset_index(drop=True)
        n_dropped = n_before - len(df)

    log.info(
        "Features built",
        extra={
            "output_rows":    len(df),
            "rows_dropped":   n_dropped,
            "pct_dropped":    round(n_dropped / n_before * 100, 1),
            "n_features":     len(feat_cols),
            "feature_names":  feat_cols,
        }
    )

    return df, store_encoder, item_encoder


#  Helpers 

def get_feature_list() -> List[str]:
    """
    Returns the exact list of feature column names in training order.
    """
    return _cfg()["features"]["feature_list"]


def split_train_test(ml_df: pd.DataFrame):
    """
    Returns:
        X_train, X_test, y_train, y_test
    """
    cfg      = _cfg()
    cutoff   = cfg["split"]["test_cutoff_date"]
    date_col = cfg["data"]["date_column"]
    target   = cfg["data"]["target_column"]
    features = get_feature_list()

    train = ml_df[ml_df[date_col] <  cutoff]
    test  = ml_df[ml_df[date_col] >= cutoff]

    log.info(
        "Train/test split",
        extra={
            "cutoff":     cutoff,
            "train_rows": len(train),
            "test_rows":  len(test),
        }
    )

    return train[features], test[features], train[target], test[target]

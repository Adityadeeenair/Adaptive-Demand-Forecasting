import pandas as pd


def create_ml_features(df):

    df = df.sort_values(["product_id", "date"])

    # LAG FEATURES
    df["lag_1"] = df.groupby("product_id")["sales"].shift(1)
    df["lag_7"] = df.groupby("product_id")["sales"].shift(7)
    df["lag_14"] = df.groupby("product_id")["sales"].shift(14)

    # ROLLING MEAN 
    df["rolling_mean_7"] = (
        df.groupby("product_id")["sales"]
        .shift(1)
        .rolling(7)
        .mean()
    )

    # CALENDAR FEATURES 
    df["day_of_week"] = df["date"].dt.dayofweek

    # CATEGORICAL FEATURES
    df["store"] = df["store"].astype("category").cat.codes
    df["item"] = df["item"].astype("category").cat.codes

    df = df.dropna()

    return df
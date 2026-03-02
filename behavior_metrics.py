import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression


def compute_trend_strength(series):
    y = series.values.reshape(-1, 1)
    X = np.arange(len(series)).reshape(-1, 1)

    model = LinearRegression()
    model.fit(X, y)

    slope = model.coef_[0][0]
    return slope


def compute_volatility(series):
    mean = np.mean(series)
    std = np.std(series)

    if mean == 0:
        return 0

    return std / mean  # Coefficient of Variation


def compute_zero_ratio(series):
    zeros = np.sum(series == 0)
    return zeros / len(series)


def compute_seasonality_strength(series, lag=365):
    if len(series) <= lag:
        return 0

    series_lagged = series[:-lag]
    series_shifted = series[lag:]

    correlation = np.corrcoef(series_lagged, series_shifted)[0, 1]
    return correlation


def compute_behavior_metrics(df):
    results = []

    for product_id in df["product_id"].unique():
        subset = df[df["product_id"] == product_id]

        units = subset["units_sold"]

        trend = compute_trend_strength(units)
        volatility = compute_volatility(units)
        zero_ratio = compute_zero_ratio(units)
        seasonality = compute_seasonality_strength(units)

        results.append([
            product_id,
            subset["type"].iloc[0],
            trend,
            volatility,
            zero_ratio,
            seasonality
        ])

    metrics_df = pd.DataFrame(
        results,
        columns=[
            "product_id",
            "true_type",
            "trend",
            "volatility_cv",
            "zero_ratio",
            "seasonality_corr"
        ]
    )

    return metrics_df

def assign_behavior_tags(metrics_df):

    # --- Compute dataset aware volatility thresholds ---
    low_threshold = metrics_df["volatility_cv"].quantile(0.33)
    high_threshold = metrics_df["volatility_cv"].quantile(0.66)

    seasonal_cutoff = metrics_df["seasonality_corr"].quantile(0.75)

    tags = []

    for _, row in metrics_df.iterrows():

        # Rule-based structural tags
        is_intermittent = row["zero_ratio"] > 0.5
        is_seasonal = row["seasonality_corr"] > seasonal_cutoff 
        is_trending = abs(row["trend"]) > 0.025

        # Distribution
        if row["volatility_cv"] <= low_threshold:
            volatility_level = "low"
        elif row["volatility_cv"] <= high_threshold:
            volatility_level = "medium"
        else:
            volatility_level = "high"

        tags.append([
            is_intermittent,
            is_seasonal,
            is_trending,
            volatility_level
        ])

    tags_df = pd.DataFrame(
        tags,
        columns=["is_intermittent", "is_seasonal", "is_trending", "volatility_level"]
    )

    return pd.concat([metrics_df.reset_index(drop=True), tags_df], axis=1)

def cluster_continuous_products(tagged_df, n_clusters=3):

    # Filter non-intermittent
    continuous_df = tagged_df[tagged_df["is_intermittent"] == False].copy()

    features = continuous_df[["trend", "seasonality_corr", "volatility_cv"]]

    # Normalize features
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)

    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    clusters = kmeans.fit_predict(scaled_features)

    continuous_df["cluster_label"] = clusters

    return continuous_df



def assign_final_segment(tagged_df):

    segments = []

    for _, row in tagged_df.iterrows():

        if row["is_intermittent"]:
            segment = "intermittent"

        elif row["is_trending"]:
            segment = "trending"

        elif row["is_seasonal"] and row["volatility_level"] == "high":
            segment = "seasonal_volatile"

        elif row["is_seasonal"]:
            segment = "seasonal_stable"

        elif row["volatility_level"] == "high":
            segment = "volatile"

        else:
            segment = "stable"

        segments.append(segment)

    tagged_df["final_segment"] = segments

    return tagged_df
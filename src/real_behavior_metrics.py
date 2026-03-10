import pandas as pd
from behavior_metrics import (
    compute_trend_strength,
    compute_volatility,
    compute_zero_ratio,
    compute_seasonality_strength
)


def compute_real_behavior_metrics(df):

    results = []

    grouped = df.groupby("product_id")

    for product_id, group in grouped:

        group = group.sort_values("date")

        units = group["sales"]

        trend = compute_trend_strength(units)
        volatility = compute_volatility(units)
        zero_ratio = compute_zero_ratio(units)
        seasonality = compute_seasonality_strength(units)

        results.append([
            product_id,
            trend,
            volatility,
            zero_ratio,
            seasonality
        ])

    metrics_df = pd.DataFrame(
        results,
        columns=[
            "product_id",
            "trend",
            "volatility_cv",
            "zero_ratio",
            "seasonality_corr"
        ]
    )

    return metrics_df
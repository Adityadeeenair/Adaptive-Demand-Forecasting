import pandas as pd
from real_behavior_metrics import compute_real_behavior_metrics
from behavior_metrics import assign_behavior_tags
from behavior_metrics import assign_final_segment

def load_retail_data(path="data/retail_raw/train.csv"):

    df = pd.read_csv(path)

    # Basic preprocessing
    df["date"] = pd.to_datetime(df["date"])

    # Create product_id as store_item
    df["product_id"] = df["store"].astype(str) + "_" + df["item"].astype(str)

    return df


if __name__ == "__main__":
    df = load_retail_data()
    print(df.head())
    print("\nShape:", df.shape)
    print("\nDate Range:", df["date"].min(), "to", df["date"].max())
    print("\nUnique Products:", df["product_id"].nunique())


if __name__ == "__main__":

    df = load_retail_data()

    metrics_df = compute_real_behavior_metrics(df)

    print("\nSeasonality Summary:")
    print(metrics_df["seasonality_corr"].describe())

    tagged_df = assign_behavior_tags(metrics_df)

    segmented_df = assign_final_segment(tagged_df)
    print("\nSegment Distribution:")
    print(segmented_df["final_segment"].value_counts())
    
    print(tagged_df.head())

    print("\nTotal Products:", len(tagged_df))

    print("\nSeasonal Count:", tagged_df["is_seasonal"].sum())
    print("Trending Count:", tagged_df["is_trending"].sum())
    print("Intermittent Count:", tagged_df["is_intermittent"].sum())

    print("\nVolatility Distribution:")
    print(tagged_df["volatility_level"].value_counts())
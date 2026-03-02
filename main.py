from generate_data import create_dataset
from behavior_metrics import compute_behavior_metrics, assign_behavior_tags
from behavior_metrics import cluster_continuous_products


if __name__ == "__main__":

    df = create_dataset()
    metrics_df = compute_behavior_metrics(df)
    tagged_df = assign_behavior_tags(metrics_df)

    clustered_df = cluster_continuous_products(tagged_df)
    print(clustered_df)
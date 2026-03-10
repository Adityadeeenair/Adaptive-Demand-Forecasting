import pandas as pd


def load_retail_data(path="data/retail_raw/train.csv"):

    df = pd.read_csv(path)

    # Convert date column
    df["date"] = pd.to_datetime(df["date"])

    # Create product_id
    df["product_id"] = df["store"].astype(str) + "_" + df["item"].astype(str)

    return df
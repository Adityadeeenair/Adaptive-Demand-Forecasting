import numpy as np
import pandas as pd


def generate_stable_product(days=730):
    base = 50
    noise = np.random.normal(0, 2, days)
    demand = base + noise
    return np.maximum(demand, 0)


def generate_trending_product(days=730):
    base = 20
    trend = np.linspace(0, 30, days)
    noise = np.random.normal(0, 5, days)
    demand = base + trend + noise
    return np.maximum(demand, 0)


def generate_seasonal_product(days=730):
    base = 30
    seasonal = 10 * np.sin(2 * np.pi * np.arange(days) / 365)
    noise = np.random.normal(0, 3, days)
    demand = base + seasonal + noise
    return np.maximum(demand, 0)


def generate_intermittent_product(days=730):
    demand = np.random.poisson(2, days)
    zero_mask = np.random.rand(days) < 0.6
    demand[zero_mask] = 0
    return demand


def create_dataset():
    days = 730
    dates = pd.date_range(start="2022-01-01", periods=days)

    data = []

    generators = {
        "stable": generate_stable_product,
        "trending": generate_trending_product,
        "seasonal": generate_seasonal_product,
        "intermittent": generate_intermittent_product
    }

    for i, (label, generator) in enumerate(generators.items()):
        demand = generator(days)
        for day in range(days):
            data.append([dates[day], f"product_{i}", label, demand[day]])   

    df = pd.DataFrame(data, columns=["date", "product_id", "type", "units_sold"])
    return df


if __name__ == "__main__":
    df = create_dataset()
    print(df.head())

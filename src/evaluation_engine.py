import numpy as np


def wmape(total_abs_error, total_actual):
    if total_actual == 0:
        return 0
    return total_abs_error / total_actual


def evaluate_single_product(series, forecast_function, horizon=30):
    """
    series: pandas Series (sorted by date)
    forecast_function: function(train_series, horizon) -> np.array of predictions
    """

    series = series.values  # convert to numpy array
    n = len(series)

    total_abs_error = 0
    total_actual = 0
    total_mae_sum = 0
    evaluation_rounds = 0

    # Define expanding window cut points
    # We use 3 evaluation splits
    split_points = [
        int(n * 0.5),
        int(n * 0.7),
        int(n * 0.85)
    ]

    for split in split_points:

        if split + horizon >= n:
            continue

        train = series[:split]
        test = series[split:split + horizon]

        preds = forecast_function(train, horizon)

        abs_errors = np.abs(test - preds)

        total_abs_error += np.sum(abs_errors)
        total_actual += np.sum(test)
        total_mae_sum += np.mean(abs_errors)

        evaluation_rounds += 1

    if evaluation_rounds == 0:
        return None

    avg_mae = total_mae_sum / evaluation_rounds
    overall_wmape = wmape(total_abs_error, total_actual)

    return {
        "wmape": overall_wmape,
        "mae": avg_mae,
        "total_abs_error": total_abs_error,
        "total_actual": total_actual
    }
import numpy as np

from statsmodels.tsa.holtwinters import SimpleExpSmoothing
from statsmodels.tsa.holtwinters import ExponentialSmoothing


def naive_last_value_forecast(train_series, horizon):
    """
    Predicts last observed value for all future steps.
    """
    last_value = train_series[-1]
    return np.repeat(last_value, horizon)



def ses_forecast(train_series, horizon):
    """
    Simple Exponential Smoothing forecast
    """

    model = SimpleExpSmoothing(train_series).fit()

    forecast = model.forecast(horizon)

    return forecast


def holt_winters_forecast(train_series, horizon):
    """
    Holt-Winters Seasonal Forecast
    """

    model = ExponentialSmoothing(
        train_series,
        trend=None,
        seasonal="add",
        seasonal_periods=7
    ).fit()

    forecast = model.forecast(horizon)

    return forecast


def rolling_mean_forecast(train_series, horizon, window=7):
    """
    Rolling mean forecast for volatile demand
    """

    rolling_mean = train_series[-window:].mean()

    return np.repeat(rolling_mean, horizon)
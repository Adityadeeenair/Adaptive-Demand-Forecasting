"""
backend/models/schemas.py
==========================
All Pydantic request and response models for the ForecastIQ API.

Changes from original:
  - ForecastResponse: added model_predictions field (was silently missing,
    causing ModelToggle to show identical lines for all models)
  - ForecastRequest: store/item changed to Union[str, int] to support
    string-keyed datasets (original ge=1 int constraint rejected string IDs)
  - ForecastSummary, ProductInfo: store/item → Union[str, int]
"""

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union
from datetime import datetime


# ── Upload ─────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    session_id:      str
    status:          str
    message:         str
    rows:            int
    products:        int
    stores:          int
    items:           int
    date_min:        str
    date_max:        str
    date_span_days:  int
    avg_daily_sales: float
    thin_products:   int
    sample_products: List[str]


# ── Forecast request ───────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    """POST /forecast body."""
    session_id: str = Field(..., description="Session ID from /upload")
    store: Union[str, int] = Field(..., description="Store ID (int or str)")
    item:  Union[str, int] = Field(..., description="Item ID (int or str)")
    horizon: int = Field(default=30, description="Forecast horizon: 7, 14, 30, 60, 90")

    @field_validator("horizon")
    @classmethod
    def horizon_must_be_valid(cls, v: int) -> int:
        allowed = [7, 14, 30, 60, 90]
        if v not in allowed:
            raise ValueError(f"horizon must be one of {allowed}, got {v}")
        return v


# ── Forecast response ──────────────────────────────────────────────────────────

class ForecastResponse(BaseModel):
    """Returned by POST /forecast."""
    forecast_id:    str
    product_id:     str
    store:          Union[str, int]
    item:           Union[str, int]
    segment:        str
    horizon:        int
    generated_at:   str

    forecast_dates: List[str]
    history_dates:  List[str]

    point_forecast: List[float]
    lower_bound:    List[float]
    upper_bound:    List[float]
    history_sales:  List[float]

    # Per-model predictions powering the ModelToggle (ensemble/RF/XGB/LGB)
    # This was absent in the original schema — Pydantic silently stripped it
    # from every response, so the dashboard always fell back to point_forecast
    # for all models, making them appear identical.
    model_predictions: dict = Field(default_factory=dict)

    model_metrics:  dict = Field(
        default_factory=dict,
        description="WMAPE and MAE for each model from last training run"
    )


# ── Results list item ──────────────────────────────────────────────────────────

class ForecastSummary(BaseModel):
    """One item in GET /results list."""
    forecast_id:  str
    product_id:   str
    store:        Union[str, int]
    item:         Union[str, int]
    segment:      str
    horizon:      int
    generated_at: str
    avg_forecast: float


class ResultsResponse(BaseModel):
    total:     int
    forecasts: List[ForecastSummary]


# ── Products ───────────────────────────────────────────────────────────────────

class ProductInfo(BaseModel):
    """One item in GET /products response."""
    product_id: str
    store:      Union[str, int]
    item:       Union[str, int]
    segment:    str
    n_days:     int
    mean_sales: float


class ProductsResponse(BaseModel):
    session_id: str
    total:      int
    products:   List[ProductInfo]


# ── Health ─────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:        str
    models_loaded: bool
    version:       str = "1.0.0"
    timestamp:     str


# ── Error ─────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    status:  str = "error"
    message: str
    detail:  Optional[str] = None

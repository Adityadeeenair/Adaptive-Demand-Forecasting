"""
backend/models/schemas.py
==========================
All Pydantic request and response models for the ForecastIQ API.

Why Pydantic schemas:
    - Automatic request validation with clear error messages
    - Auto-generated OpenAPI docs (visible at /docs)
    - Type safety between API layer and pipeline layer
    - Response serialisation handled automatically by FastAPI

Every endpoint imports its models from here — no inline dicts.
"""

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime


# ── Upload responses ───────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    """
    Returned by POST /upload after a successful CSV upload.
    Gives the user a summary of what was detected in their data.
    """
    session_id:      str   = Field(..., description="Unique ID for this upload session")
    status:          str   = Field(..., description="'success' or 'error'")
    message:         str   = Field(..., description="Human-readable status message")
    rows:            int   = Field(..., description="Total rows in the dataset")
    products:        int   = Field(..., description="Unique store-item combinations")
    stores:          int   = Field(..., description="Number of distinct stores")
    items:           int   = Field(..., description="Number of distinct items")
    date_min:        str   = Field(..., description="Earliest date in dataset")
    date_max:        str   = Field(..., description="Latest date in dataset")
    date_span_days:  int   = Field(..., description="Total days covered")
    avg_daily_sales: float = Field(..., description="Mean sales across all products/days")
    thin_products:   int   = Field(..., description="Products with fewer than 60 days of history")
    sample_products: List[str] = Field(..., description="First 5 product IDs as examples")


# ── Forecast request ───────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    """
    Body for POST /forecast.
    User specifies which product to forecast and how far ahead.
    """
    session_id: str = Field(
        ...,
        description="Session ID from the /upload response"
    )
    store: int = Field(
        ...,
        ge=1,
        description="Store ID (must exist in the uploaded dataset)"
    )
    item: int = Field(
        ...,
        ge=1,
        description="Item ID (must exist in the uploaded dataset)"
    )
    horizon: int = Field(
        default=30,
        description="Forecast horizon in days. Must be one of: 7, 14, 30, 60, 90"
    )

    @field_validator("horizon")
    @classmethod
    def horizon_must_be_valid(cls, v: int) -> int:
        allowed = [7, 14, 30, 60, 90]
        if v not in allowed:
            raise ValueError(f"horizon must be one of {allowed}, got {v}")
        return v


# ── Forecast response ──────────────────────────────────────────────────────────

class ForecastResponse(BaseModel):
    """
    Returned by POST /forecast.
    Contains everything the dashboard needs to render the chart.
    """
    forecast_id:    str         = Field(..., description="Unique ID for this forecast")
    product_id:     str         = Field(..., description="e.g. '3_12'")
    store:          int
    item:           int
    segment:        str         = Field(..., description="Demand segment: stable, seasonal_stable, etc.")
    horizon:        int         = Field(..., description="Forecast horizon in days")
    generated_at:   str         = Field(..., description="ISO timestamp of when forecast was generated")

    # Time axis
    forecast_dates: List[str]   = Field(..., description="Future date strings YYYY-MM-DD")
    history_dates:  List[str]   = Field(..., description="Last 90 days of actual dates")

    # Values
    point_forecast: List[float] = Field(..., description="Ensemble point prediction per day")
    lower_bound:    List[float] = Field(..., description="10th percentile — lower confidence band")
    upper_bound:    List[float] = Field(..., description="90th percentile — upper confidence band")
    history_sales:  List[float] = Field(..., description="Last 90 days of actual sales")

    # Model performance summary
    model_metrics:  dict        = Field(
        default_factory=dict,
        description="WMAPE and MAE for each model from the last training run"
    )


# ── Results list item ──────────────────────────────────────────────────────────

class ForecastSummary(BaseModel):
    """
    One item in the GET /results list.
    Compact version of ForecastResponse — no chart data, just metadata.
    """
    forecast_id:  str
    product_id:   str
    store:        int
    item:         int
    segment:      str
    horizon:      int
    generated_at: str
    avg_forecast: float = Field(..., description="Mean of point_forecast values")


class ResultsResponse(BaseModel):
    """Returned by GET /results."""
    total:     int
    forecasts: List[ForecastSummary]


# ── Products list ──────────────────────────────────────────────────────────────

class ProductInfo(BaseModel):
    """One item in GET /products response."""
    product_id:   str
    store:        int
    item:         int
    segment:      str
    n_days:       int
    mean_sales:   float


class ProductsResponse(BaseModel):
    """Returned by GET /products/{session_id}."""
    session_id: str
    total:      int
    products:   List[ProductInfo]


# ── Health check ──────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Returned by GET /health."""
    status:        str
    models_loaded: bool
    version:       str = "1.0.0"
    timestamp:     str


# ── Error response ─────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Standard error shape returned by all endpoints on failure."""
    status:  str = "error"
    message: str
    detail:  Optional[str] = None

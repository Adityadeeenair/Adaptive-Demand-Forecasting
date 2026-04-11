"""
backend/routers/results.py
===========================
GET /results              — list all forecasts for a session
GET /results/{forecast_id} — retrieve one full forecast by ID
DELETE /results/{forecast_id} — remove a forecast

These endpoints power the "history" panel in the frontend where
users can see past forecasts they've generated in this session.
"""

from fastapi import APIRouter, HTTPException, status, Query

from backend.models.schemas import (
    ForecastResponse, ForecastSummary,
    ResultsResponse, ErrorResponse
)
from backend.services.session_store import (
    get_forecasts_for_session, get_forecast, get_session
)
from backend.services.logger import get_logger

log    = get_logger(__name__)
router = APIRouter(prefix="/results", tags=["Results"])


# ── GET /results?session_id=... ───────────────────────────────────────────────

@router.get(
    "",
    response_model=ResultsResponse,
    status_code=status.HTTP_200_OK,
    summary="List all forecasts for a session",
    responses={
        404: {"model": ErrorResponse, "description": "Session not found"},
    },
)
async def list_results(
    session_id: str = Query(..., description="Session ID from /upload"),
    limit:      int = Query(default=50, ge=1, le=200, description="Max results to return"),
) -> ResultsResponse:
    """
    Return a summary list of all forecasts generated in this session.
    Results are ordered newest-first.

    Use `GET /results/{forecast_id}` to fetch the full chart data
    for a specific forecast.
    """
    if get_session(session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found."
        )

    forecasts = get_forecasts_for_session(session_id)[:limit]

    summaries = []
    for f in forecasts:
        pf = f.get("point_forecast", [])
        avg = round(sum(pf) / len(pf), 2) if pf else 0.0
        summaries.append(ForecastSummary(
            forecast_id  = f["forecast_id"],
            product_id   = f["product_id"],
            store        = f["store"],
            item         = f["item"],
            segment      = f["segment"],
            horizon      = f["horizon"],
            generated_at = f["generated_at"],
            avg_forecast = avg,
        ))

    log.info("Results listed", extra={"session_id": session_id, "count": len(summaries)})

    return ResultsResponse(
        total     = len(summaries),
        forecasts = summaries,
    )


# ── GET /results/{forecast_id} ────────────────────────────────────────────────

@router.get(
    "/{forecast_id}",
    response_model=ForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full forecast data by ID",
    responses={
        404: {"model": ErrorResponse, "description": "Forecast not found"},
    },
)
async def get_result(forecast_id: str) -> ForecastResponse:
    """
    Retrieve the complete forecast data for a specific forecast_id.

    Returns the same structure as POST /forecast — including all
    chart data (point forecast, bounds, history).

    Useful when the user clicks a past forecast in the history panel.
    """
    f = get_forecast(forecast_id)
    if f is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forecast '{forecast_id}' not found."
        )

    log.info("Result fetched", extra={"forecast_id": forecast_id})

    return ForecastResponse(
        forecast_id    = f["forecast_id"],
        product_id     = f["product_id"],
        store          = f["store"],
        item           = f["item"],
        segment        = f["segment"],
        horizon        = f["horizon"],
        generated_at   = f["generated_at"],
        forecast_dates = f["forecast_dates"],
        history_dates  = f["history_dates"],
        point_forecast = f["point_forecast"],
        lower_bound    = f["lower_bound"],
        upper_bound    = f["upper_bound"],
        history_sales  = f["history_sales"],
        model_metrics  = f.get("model_metrics", {}),
    )


# ── DELETE /results/{forecast_id} ─────────────────────────────────────────────

@router.delete(
    "/{forecast_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a forecast",
    responses={
        404: {"model": ErrorResponse, "description": "Forecast not found"},
    },
)
async def delete_result(forecast_id: str) -> dict:
    """Remove a specific forecast from the session history."""
    f = get_forecast(forecast_id)
    if f is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forecast '{forecast_id}' not found."
        )

    # Remove from in-memory store
    from backend.services import session_store as ss
    with ss._lock:
        ss._forecasts.pop(forecast_id, None)
        for fid_list in ss._session_forecasts.values():
            if forecast_id in fid_list:
                fid_list.remove(forecast_id)

    log.info("Forecast deleted", extra={"forecast_id": forecast_id})
    return {"status": "deleted", "forecast_id": forecast_id}

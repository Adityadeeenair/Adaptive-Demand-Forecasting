"""
backend/routers/forecast.py
=============================
POST /forecast  — run inference for a store/item/horizon
GET  /products  — list all products available in a session

POST /forecast flow:
    1. Validate request body (Pydantic does this automatically)
    2. Look up session_id → get stored DataFrame
    3. Call run_inference() — loads cached models, builds features, predicts
    4. Save result in session_store
    5. Return ForecastResponse

GET /products flow:
    1. Look up session_id
    2. Return all products with their segments from the loaded segmentation
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, status, BackgroundTasks

from backend.models.schemas import (
    ForecastRequest, ForecastResponse, ProductsResponse,
    ProductInfo, ErrorResponse
)
from backend.services.session_store import (
    get_dataframe, get_session, save_forecast
)
from backend.pipeline.inference_pipeline import run_inference
from backend.pipeline.segmentation import compute_segments
from backend.services.logger import get_logger, Timer

log    = get_logger(__name__)
router = APIRouter(tags=["Forecast"])


# ── POST /forecast ─────────────────────────────────────────────────────────────

@router.post(
    "/forecast",
    response_model=ForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a demand forecast",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        404: {"model": ErrorResponse, "description": "Session or product not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def generate_forecast(body: ForecastRequest) -> ForecastResponse:
    """
    Generate a demand forecast for a specific store-item pair.

    Requires a valid `session_id` from **POST /upload**.

    Returns point forecast + 80% prediction interval + last 90 days
    of actual sales history — everything the dashboard chart needs.

    **Horizons available:** 7, 14, 30, 60, 90 days
    """

    # ── 1. Validate session ───────────────────────────────────────────────
    df = get_dataframe(body.session_id)
    if df is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{body.session_id}' not found. Please upload a dataset first."
        )

    log.info(
        "Forecast requested",
        extra={
            "session_id": body.session_id,
            "store":      body.store,
            "item":       body.item,
            "horizon":    body.horizon,
        }
    )

    # ── 2. Run inference ──────────────────────────────────────────────────
    with Timer(f"Forecast store={body.store} item={body.item} h={body.horizon}", log):
        try:
            result = run_inference(
                df      = df,
                store   = body.store,
                item    = body.item,
                horizon = body.horizon,
            )
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Models have not been trained yet. "
                    "Run: python -m backend.pipeline.training_pipeline"
                )
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            log.error("Inference failed", extra={"error": str(e)})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Forecast generation failed: {e}"
            )

    # ── 3. Build response ─────────────────────────────────────────────────
    generated_at = datetime.utcnow().isoformat()

    forecast_dict = {
        "product_id":        result["product_id"],
        "store":             result["store"],
        "item":              result["item"],
        "segment":           result["segment"],
        "horizon":           result["horizon"],
        "generated_at":      generated_at,
        "forecast_dates":    result["forecast_dates"],
        "history_dates":     result["history_dates"],
        "point_forecast":    result["point_forecast"],
        "lower_bound":       result["lower_bound"],
        "upper_bound":       result["upper_bound"],
        "history_sales":     result["history_sales"],
        "model_predictions": result.get("model_predictions", {}),
        "model_metrics":     {},
    }

    # ── 4. Attach model metrics from last training run (if saved) ─────────
    import joblib
    from pathlib import Path
    metrics_path = Path(__file__).resolve().parents[1] / "saved_models" / "training_results.pkl"
    if metrics_path.exists():
        try:
            forecast_dict["model_metrics"] = joblib.load(metrics_path)
        except Exception:
            pass   # non-fatal — metrics just won't show on dashboard

    # ── 5. Persist in session_store ───────────────────────────────────────
    forecast_id = save_forecast(body.session_id, forecast_dict)

    log.info(
        "Forecast complete",
        extra={
            "forecast_id": forecast_id,
            "product_id":  result["product_id"],
            "avg_forecast": round(sum(result["point_forecast"]) / len(result["point_forecast"]), 2),
        }
    )

    return ForecastResponse(
        forecast_id        = forecast_id,
        product_id         = result["product_id"],
        store              = result["store"],
        item               = result["item"],
        segment            = result["segment"],
        horizon            = result["horizon"],
        generated_at       = generated_at,
        forecast_dates     = result["forecast_dates"],
        history_dates      = result["history_dates"],
        point_forecast     = result["point_forecast"],
        lower_bound        = result["lower_bound"],
        upper_bound        = result["upper_bound"],
        history_sales      = result["history_sales"],
        model_predictions  = forecast_dict["model_predictions"],
        model_metrics      = forecast_dict["model_metrics"],
    )


# ── GET /products/{session_id} ────────────────────────────────────────────────

@router.get(
    "/products/{session_id}",
    response_model=ProductsResponse,
    status_code=status.HTTP_200_OK,
    summary="List all products in a session",
    responses={
        404: {"model": ErrorResponse, "description": "Session not found"},
    },
)
async def list_products(session_id: str) -> ProductsResponse:
    """
    Return all store-item products found in the uploaded dataset,
    with their demand segment and basic statistics.

    Use this to populate the product selector dropdown in the frontend.
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found."
        )

    df = session["df"]

    with Timer("Product listing", log):
        try:
            seg_df = compute_segments(df)
        except Exception as e:
            log.error("Segmentation failed", extra={"error": str(e)})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not compute product segments: {e}"
            )

    products = []
    for _, row in seg_df.iterrows():
        pid   = str(row["product_id"])
        parts = pid.split("_")
        store = int(parts[0]) if len(parts) >= 2 else 0
        item  = int(parts[1]) if len(parts) >= 2 else 0

        products.append(ProductInfo(
            product_id  = pid,
            store       = store,
            item        = item,
            segment     = str(row["final_segment"]),
            n_days      = int(row["n_days"]),
            mean_sales  = round(float(row["mean_sales"]), 2),
        ))

    # Sort by store then item for consistent ordering
    products.sort(key=lambda p: (p.store, p.item))

    log.info("Products listed", extra={"session_id": session_id, "count": len(products)})

    return ProductsResponse(
        session_id = session_id,
        total      = len(products),
        products   = products,
    )


# ── GET /insights/{session_id} ────────────────────────────────────────────────

@router.get(
    "/insights/{session_id}",
    status_code=200,
    summary="Dataset insights and segment distribution",
)
async def get_insights(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    df      = session["df"]
    summary = session["summary"]

    try:
        seg_df = compute_segments(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    seg_counts = seg_df["final_segment"].value_counts().to_dict()
    top10 = seg_df.nlargest(10, "mean_sales")[["product_id", "mean_sales", "final_segment"]].to_dict("records")

    return {
        **summary,
        "segment_counts": seg_counts,
        "top_products":   top10,
    }

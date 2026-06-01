from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
import joblib

from backend.models.schemas import (
    ForecastRequest, ForecastResponse, ProductsResponse,
    ProductInfo, ErrorResponse
)
from backend.services.session_store import get_dataframe, get_session, save_forecast
from backend.pipeline.inference_pipeline import run_inference
from backend.pipeline.segmentation import compute_segments
from backend.services.logger import get_logger, Timer

log    = get_logger(__name__)
router = APIRouter(tags=["Forecast"])



_seg_cache: dict = {}


def _get_seg_map(session_id: str, df) -> dict:

    if session_id not in _seg_cache:
        log.info("Computing segmentation (first call for session)",
                 extra={"session_id": session_id})
        try:
            seg_df = compute_segments(df)
            # Store as flat dict for O(1) per-product lookup
            _seg_cache[session_id] = {
                str(row["product_id"]): str(row["final_segment"])
                for _, row in seg_df.iterrows()
            }
            # Also store the full DataFrame for insights endpoint
            _seg_cache[f"{session_id}__df"] = seg_df
        except Exception as e:
            log.error("Segmentation failed", extra={"error": str(e)})
            raise HTTPException(500, detail=f"Segmentation failed: {e}")
    return _seg_cache[session_id]


def _get_seg_df(session_id: str, df):
    _get_seg_map(session_id, df)  # ensure computed
    return _seg_cache.get(f"{session_id}__df")


def _get_segment_for_product(session_id: str, df, pid: str) -> str:

    seg_map = _get_seg_map(session_id, df)
    return seg_map.get(pid, "unknown")


def _parse_pid(pid: str):
    """Split 'store_item' → (store, item). Handles string IDs correctly."""
    if "_" not in pid:
        return pid, ""
    idx = pid.index("_")
    return pid[:idx], pid[idx + 1:]


#  POST /forecast 

@router.post(
    "/forecast",
    response_model=ForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a demand forecast",
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def generate_forecast(body: ForecastRequest) -> ForecastResponse:

    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{body.session_id}' not found. Upload a dataset first."
        )

    df  = session["df"]
    pid = f"{body.store}_{body.item}"

    segment = _get_segment_for_product(body.session_id, df, pid)

    log.info("Forecast requested", extra={
        "session_id": body.session_id,
        "store": body.store, "item": body.item,
        "horizon": body.horizon, "segment": segment,
    })

    with Timer(f"Forecast store={body.store} item={body.item} h={body.horizon}", log):
        try:
            result = run_inference(
                df      = df,
                store   = body.store,
                item    = body.item,
                horizon = body.horizon,
                segment = segment,   
            )
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Models not trained. Run: python -m backend.pipeline.training_pipeline"
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            log.error("Inference failed", extra={"error": str(e)})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Forecast generation failed: {e}"
            )

    generated_at  = datetime.utcnow().isoformat()


    per_product_metrics = result.get("model_metrics", {})
    if not per_product_metrics:
        metrics_path = Path(__file__).resolve().parents[1] / "saved_models" / "training_results.pkl"
        if metrics_path.exists():
            try:
                per_product_metrics = joblib.load(metrics_path)
            except Exception:
                per_product_metrics = {}

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
        "model_metrics":     per_product_metrics,
    }

    forecast_id = save_forecast(body.session_id, forecast_dict)

    log.info("Forecast complete", extra={
        "forecast_id": forecast_id,
        "product_id":  result["product_id"],
        "segment":     result["segment"],
        "avg":         round(sum(result["point_forecast"]) / len(result["point_forecast"]), 2),
    })

    return ForecastResponse(
        forecast_id       = forecast_id,
        product_id        = result["product_id"],
        store             = result["store"],
        item              = result["item"],
        segment           = result["segment"],
        horizon           = result["horizon"],
        generated_at      = generated_at,
        forecast_dates    = result["forecast_dates"],
        history_dates     = result["history_dates"],
        point_forecast    = result["point_forecast"],
        lower_bound       = result["lower_bound"],
        upper_bound       = result["upper_bound"],
        history_sales     = result["history_sales"],
        model_predictions = forecast_dict["model_predictions"],
        model_metrics     = forecast_dict["model_metrics"],
    )


#  GET /products/{session_id} 

@router.get(
    "/products/{session_id}",
    response_model=ProductsResponse,
    status_code=status.HTTP_200_OK,
    summary="List all products in a session",
)
async def list_products(session_id: str) -> ProductsResponse:
   
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, detail=f"Session '{session_id}' not found.")

    df     = session["df"]
    seg_df = _get_seg_df(session_id, df)

    products = []
    for _, row in seg_df.iterrows():
        pid   = str(row["product_id"])
        store, item = _parse_pid(pid)

        products.append(ProductInfo(
            product_id = pid,
            store      = store,
            item       = item,
            segment    = str(row["final_segment"]),
            n_days     = int(row["n_days"]),
            mean_sales = round(float(row["mean_sales"]), 2),
        ))

    def _sort_key(p):
        try:    return (int(p.store), int(p.item))
        except: return (p.store, p.item)

    products.sort(key=_sort_key)

    log.info("Products listed", extra={"session_id": session_id, "count": len(products)})
    return ProductsResponse(session_id=session_id, total=len(products), products=products)


#  GET /insights/{session_id} 

@router.get("/insights/{session_id}", status_code=200, summary="Dataset insights")
async def get_insights(session_id: str):
    """Dataset statistics and segment distribution. Uses the same cache."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, detail=f"Session '{session_id}' not found.")

    df      = session["df"]
    summary = session["summary"]
    seg_df  = _get_seg_df(session_id, df)

    seg_counts = seg_df["final_segment"].value_counts().to_dict()
    top10 = (
        seg_df.nlargest(10, "mean_sales")[["product_id", "mean_sales", "final_segment"]]
        .to_dict("records")
    )

    return {**summary, "segment_counts": seg_counts, "top_products": top10}

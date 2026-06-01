from fastapi import APIRouter, HTTPException, status
from backend.routers.forecast import _get_seg_map, _get_seg_df
from backend.services.session_store import get_session, get_dataframe
from backend.services.logger import get_logger

log    = get_logger(__name__)
router = APIRouter(tags=["Insights"])


@router.get(
    "/insights/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Session-level dataset analytics for the Insights page",
)
async def get_insights(session_id: str):
   
    session = get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )

    df = get_dataframe(session_id)
    if df is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session data not found.",
        )

    # Segment cache: {product_id -> segment_string}
    try:
        seg_map = _get_seg_map(session_id, df)
    except Exception as e:
        log.warning(f"Insights: could not get segments: {e}")
        seg_map = {}

    # Segment distribution counts
    segment_counts: dict = {}
    for seg in seg_map.values():
        segment_counts[seg] = segment_counts.get(seg, 0) + 1

    # Top products by mean_sales
    top_products = []
    try:
        seg_df = _get_seg_df(session_id, df)
        if seg_df is not None and "mean_sales" in seg_df.columns:
            top = (
                seg_df[["product_id", "mean_sales", "final_segment"]]
                .sort_values("mean_sales", ascending=False)
                .head(8)
            )
            top_products = top.to_dict(orient="records")
    except Exception as e:
        log.warning(f"Insights: could not get top products: {e}")

    return {
        "session_id":     session_id,
        "segment_counts": segment_counts,
        "top_products":   top_products,
    }


from fastapi import APIRouter, HTTPException, status
import pandas as pd
from backend.routers.forecast import _get_seg_map, _get_seg_df, _parse_pid
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

    summary = session.get("summary", {})

    try:
        seg_map = _get_seg_map(session_id, df)
    except Exception as e:
        log.warning(f"Insights: could not get segments: {e}")
        seg_map = {}

    segment_counts: dict = {}
    for seg in seg_map.values():
        segment_counts[seg] = segment_counts.get(seg, 0) + 1

    top_products = []
    products_meta = []
    seg_df = None
    try:
        seg_df = _get_seg_df(session_id, df)
        if seg_df is not None and "mean_sales" in seg_df.columns:
            top = (
                seg_df[["product_id", "mean_sales", "final_segment"]]
                .sort_values("mean_sales", ascending=False)
                .head(10)
            )
            top_products = top.to_dict(orient="records")

            for _, row in seg_df.iterrows():
                pid = str(row["product_id"])
                store, item = _parse_pid(pid)
                products_meta.append({
                    "product_id": pid,
                    "store": store,
                    "item": item,
                    "mean_sales": round(float(row.get("mean_sales", 0.0)), 1),
                    "final_segment": str(row.get("final_segment", "stable")),
                    "volatility_cv": round(float(row.get("volatility_cv", 0.0)), 3),
                    "seasonality_corr": round(float(row.get("seasonality_corr", 0.0)), 3),
                    "trend": round(float(row.get("trend", 0.0)), 4),
                    "zero_ratio": round(float(row.get("zero_ratio", 0.0)), 3),
                })
    except Exception as e:
        log.warning(f"Insights: could not get top products: {e}")

    day_short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_full  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday_pattern = []
    try:
        dt_col = pd.to_datetime(df["date"])
        weekday_avg = df.groupby(dt_col.dt.dayofweek)["sales"].mean()
        weekday_pattern = [
            {
                "day": day_short[i],
                "day_full": day_full[i],
                "avg_sales": round(float(weekday_avg.get(i, 0.0)), 1),
            }
            for i in range(7)
        ]
    except Exception as e:
        log.warning(f"Insights: could not compute weekday pattern: {e}")

    product_timelines = {}
    try:
        for pid, group in df.groupby("product_id"):
            grp_sorted = group.sort_values("date")
            product_timelines[str(pid)] = {
                "dates": [str(d.date()) if hasattr(d, "date") else str(d)[:10] for d in grp_sorted["date"]],
                "sales": [round(float(s), 1) for s in grp_sorted["sales"]],
            }
    except Exception as e:
        log.warning(f"Insights: could not compute product timelines: {e}")

    return {
        **summary,
        "session_id": session_id,
        "segment_counts": segment_counts,
        "top_products": top_products,
        "weekday_pattern": weekday_pattern,
        "product_timelines": product_timelines,
        "products_meta": products_meta,
    }

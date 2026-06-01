from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.services.session_store import get_session, get_forecasts_for_session
from backend.services.email_service import (
    send_forecast_email, validate_email, build_forecast_csv,
)
from backend.services.logger import get_logger

log    = get_logger(__name__)
router = APIRouter(tags=["Export"])


class EmailRequest(BaseModel):
    session_id: str
    email:      str


@router.post(
    "/send-email",
    status_code=status.HTTP_200_OK,
    summary="Email forecast results",
)
async def send_email(body: EmailRequest):
 

    try:
        validate_email(body.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if get_session(body.session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session '{body.session_id}' not found. Upload a dataset first.",
        )

    forecasts = get_forecasts_for_session(body.session_id)
    if not forecasts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No forecasts found for this session. Run at least one forecast first.",
        )

    try:
        send_forecast_email(
            to_address = body.email,
            forecasts  = forecasts,
            session_id = body.session_id,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        log.error("Email delivery failed", extra={"error": str(e), "to": body.email})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {e}",
        )

    return {
        "status":    "sent",
        "to":        body.email,
        "forecasts": len(forecasts),
    }

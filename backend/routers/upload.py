"""
backend/routers/upload.py
==========================
POST /upload — accepts a CSV file, validates it, stores it in session.

Flow:
    1. User uploads CSV via multipart form
    2. File is read into a DataFrame
    3. data_loader validates schema, types, date format
    4. Cleaned df is stored in session_store with a new session_id
    5. Dataset summary is returned to the user

The session_id is then used in POST /forecast and GET /results.
"""

import io
from fastapi import APIRouter, UploadFile, File, HTTPException, status

from backend.models.schemas import UploadResponse, ErrorResponse
from backend.services.data_loader import load_data, get_dataset_summary, DataLoadError, SchemaValidationError, InsufficientDataError
from backend.services.session_store import create_session
from backend.services.logger import get_logger, Timer

log    = get_logger(__name__)
router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post(
    "",
    response_model=UploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload a sales CSV dataset",
    responses={
        400: {"model": ErrorResponse, "description": "Bad file format or schema"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def upload_csv(
    file: UploadFile = File(
        ...,
        description="CSV file with columns: date, store, item, sales"
    ),
) -> UploadResponse:
    """
    Upload a retail sales CSV and get back a session_id.

    **Expected CSV columns:** `date`, `store`, `item`, `sales`

    **Example row:** `2013-01-15, 3, 12, 42.0`

    The session_id returned here is required for all subsequent
    `/forecast` and `/results` calls.
    """

    # ── Validate file type ────────────────────────────────────────────────
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only CSV files are accepted. Got: {file.filename}"
        )

    log.info("Upload received", extra={"file_name": file.filename})

    # ── Read file bytes into a temp path ──────────────────────────────────
    with Timer("File read", log):
        try:
            contents = await file.read()
            if len(contents) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded file is empty."
                )
        except HTTPException:
            raise
        except Exception as e:
            log.error("File read failed", extra={"error": str(e)})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not read uploaded file: {e}"
            )

    # ── Save to temp file and run data_loader ─────────────────────────────
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        with Timer("Data validation", log):
            df = load_data(tmp_path)

    except DataLoadError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SchemaValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except InsufficientDataError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        log.error("Unexpected validation error", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during validation: {e}"
        )
    finally:
        os.unlink(tmp_path)   # always clean up temp file

    # ── Store in session and build summary ────────────────────────────────
    summary    = get_dataset_summary(df)
    session_id = create_session(df, summary)

    log.info(
        "Upload successful",
        extra={
            "session_id": session_id,
            "file_name":  file.filename,
            "rows":       summary["rows"],
            "products":   summary["products"],
        }
    )

    return UploadResponse(
        session_id      = session_id,
        status          = "success",
        message         = f"Dataset uploaded successfully. {summary['products']} products found.",
        rows            = summary["rows"],
        products        = summary["products"],
        stores          = summary["stores"],
        items           = summary["items"],
        date_min        = summary["date_min"],
        date_max        = summary["date_max"],
        date_span_days  = summary["date_span_days"],
        avg_daily_sales = summary["avg_daily_sales"],
        thin_products   = summary["thin_products"],
        sample_products = summary["sample_products"],
    )

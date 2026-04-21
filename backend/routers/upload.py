"""
backend/routers/upload.py
==========================
POST /upload — accepts a CSV file, adapts it, stores it in session.

Flow:
    1. User uploads CSV via multipart form
    2. File bytes are written to a temp path
    3. data_adapter.adapt() — detects columns, cleans, standardises
    4. Basic sanity check on adapter output (inline — no extra imports)
    5. Cleaned df stored in session_store with new session_id
    6. Dataset summary returned to the user

The adapter handles ALL real-world CSV variation:
  - Any column names (date/timestamp/day, sales/demand/quantity, etc.)
  - Missing store/item columns (defaults to "1")
  - Unknown grouping column names (structural inference)
  - Date gaps, missing values, outliers, weekly/monthly data

No column validation is done before adapt() is called.
"""

import tempfile
import os
from fastapi import APIRouter, UploadFile, File, HTTPException, status

from backend.models.schemas import UploadResponse, ErrorResponse
from backend.services.data_adapter import adapt, AdapterError
from backend.services.data_loader import get_dataset_summary
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
        400: {"model": ErrorResponse, "description": "Bad file or unrecognisable format"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def upload_csv(
    file: UploadFile = File(
        ...,
        description=(
            "CSV file with time-series sales data. "
            "Column names are detected automatically — any naming works. "
            "Examples: date+sales, timestamp+quantity, date+store+item+sales, "
            "week_start+location+sku+revenue, date+division+brand+orders."
        )
    ),
) -> UploadResponse:
    """
    Upload a sales CSV and receive a session_id for forecasting.

    **Flexible column detection** — column names are detected automatically:
    - Date: `date`, `timestamp`, `day`, `week`, `period`, ...
    - Sales: `sales`, `demand`, `quantity`, `revenue`, `units`, ...
    - Store (optional): `store`, `location`, `region`, `branch`, `division`, ...
    - Item (optional): `item`, `product`, `sku`, `brand`, `category`, ...

    If store or item columns are absent the dataset is treated as a single
    time series. If they use non-standard names, structural inference
    (column cardinality and type analysis) identifies them automatically.

    The returned `session_id` is required for all `/forecast` calls.
    """

    # ── Validate file extension ───────────────────────────────────────────
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only CSV files are accepted. Got: '{file.filename}'"
        )

    log.info("Upload received", extra={"file_name": file.filename})

    # ── Read file bytes ───────────────────────────────────────────────────
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

    # ── Write to temp file ────────────────────────────────────────────────
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # ── Data Adapter ──────────────────────────────────────────────────
        # This is the ONLY place CSV data is processed.
        # The adapter handles everything: column detection, date parsing,
        # missing values, outliers, gaps, weekly→daily resampling.
        # It raises AdapterError (shown to the user) for unrecoverable issues.
        # NO column validation is done before this call.
        with Timer("Data adaptation", log):
            try:
                df = adapt(tmp_path)
            except AdapterError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )
            except Exception as e:
                log.error("Adapter unexpected error", extra={"error": str(e)})
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Data processing error: {e}"
                )

        # ── Inline output validation ───────────────────────────────────────
        # The adapter guarantees its output contract, but we do a minimal
        # sanity check here so any internal adapter bug gives a clear error
        # rather than a confusing downstream crash.
        # This does NOT import any extra function — it's three lines inline.
        if len(df) < 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Only {len(df)} rows remain after processing. "
                    f"Please upload a dataset with more historical data "
                    f"(at least 30 rows per product)."
                )
            )

    finally:
        os.unlink(tmp_path)   # always clean up temp file

    # ── Store in session ──────────────────────────────────────────────────
    summary    = get_dataset_summary(df)
    session_id = create_session(df, summary)

    log.info("Upload successful", extra={
        "session_id": session_id,
        "file_name":  file.filename,
        "rows":       summary["rows"],
        "products":   summary["products"],
        "stores":     summary["stores"],
        "items":      summary["items"],
    })

    return UploadResponse(
        session_id      = session_id,
        status          = "success",
        message         = (
            f"Dataset uploaded successfully. "
            f"{summary['products']} products across "
            f"{summary['stores']} store(s) and {summary['items']} item(s)."
        ),
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

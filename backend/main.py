"""
backend/main.py
================
FastAPI application entry point.

Wires together all routers and configures:
    - CORS (so the React frontend can call the API)
    - OpenAPI docs at /docs  (Swagger UI)
    - ReDoc docs at  /redoc
    - /health endpoint
    - Startup event — pre-loads ML models into memory on boot

To run the API:
    cd <project_root>
    uvicorn backend.main:app --reload --port 8000

Then open:
    http://localhost:8000/docs   ← interactive API docs
    http://localhost:8000/health ← health check
"""

from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import upload, forecast, results
from backend.models.schemas import HealthResponse
from backend.services.logger import get_logger
from backend.services import session_store

log = get_logger(__name__)

# ── App definition ────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "ForecastIQ API",
    description = (
        "Intelligent demand forecasting platform.\n\n"
        "## Workflow\n"
        "1. **POST /upload** — upload your sales CSV\n"
        "2. **GET /products/{session_id}** — see all products and segments\n"
        "3. **POST /forecast** — generate a demand forecast\n"
        "4. **GET /results** — view forecast history\n\n"
        "## Expected CSV format\n"
        "Columns: `date`, `store`, `item`, `sales`\n"
        "Date format: `YYYY-MM-DD`"
    ),
    version     = "1.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the React frontend (running on port 3000 in dev) to call the API.
# In production, replace "*" with your actual frontend domain.

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(upload.router)
app.include_router(forecast.router)
app.include_router(results.router)

# ── Startup event — pre-load models ──────────────────────────────────────────

@app.on_event("startup")
async def startup_event() -> None:
    """
    Pre-load ML models into memory when the server starts.

    Without this, the FIRST forecast request would be slow because
    joblib loads 8 pkl files from disk (~12MB total).
    After startup loading, all subsequent requests are instant.
    """
    log.info("ForecastIQ API starting up...")
    try:
        from backend.pipeline.inference_pipeline import _store
        _store.load()
        log.info("ML models pre-loaded successfully on startup")
    except FileNotFoundError:
        log.warning(
            "Saved models not found — run training before making forecasts.\n"
            "  python -m backend.pipeline.training_pipeline"
        )
    except Exception as e:
        log.error(f"Model pre-load failed: {e}")


# ── Health check ──────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="API health check",
)
async def health_check() -> HealthResponse:
    """
    Returns API status, whether models are loaded, and current time.
    Use this to verify the server is running before making other calls.
    """
    from backend.pipeline.inference_pipeline import _store
    stats = session_store.store_stats()

    return HealthResponse(
        status        = "ok",
        models_loaded = _store._loaded,
        version       = "1.0.0",
        timestamp     = datetime.utcnow().isoformat(),
    )


# ── Root redirect ─────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    return {
        "name":    "ForecastIQ API",
        "version": "1.0.0",
        "docs":    "/docs",
        "health":  "/health",
    }

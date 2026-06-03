from dotenv import load_dotenv
load_dotenv()

import os
print("SMTP_USER:", os.getenv("SMTP_USER"))

from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import upload, forecast, results
from backend.routers import email_router
from backend.routers import insights_router
from backend.models.schemas import HealthResponse
from backend.services.logger import get_logger
from backend.services import session_store

log = get_logger(__name__)


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



app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://localhost:5173", "https://adaptive-demand-forecasting.vercel.app"],
    allow_credentials = False,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


app.include_router(upload.router)
app.include_router(forecast.router)
app.include_router(results.router)
app.include_router(email_router.router)
app.include_router(insights_router.router)


@app.on_event("startup")
async def startup_event() -> None:
    
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



@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="API health check",
)
async def health_check() -> HealthResponse:
   
    from backend.pipeline.inference_pipeline import _store
    stats = session_store.store_stats()

    return HealthResponse(
        status        = "ok",
        models_loaded = _store._loaded,
        version       = "1.0.0",
        timestamp     = datetime.utcnow().isoformat(),
    )



@app.get("/", include_in_schema=False)
async def root():
    return {
        "name":    "ForecastIQ API",
        "version": "1.0.0",
        "docs":    "/docs",
        "health":  "/health",
    }

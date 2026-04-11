"""
backend/services/session_store.py
===================================
In-memory store for uploaded datasets and forecast results.

Why in-memory (not a database yet):
    Phase 2 goal is a working API. A full database adds significant
    complexity (schema migrations, connection pooling, ORM setup).
    The in-memory store gives identical API behaviour and is trivially
    swappable for PostgreSQL in Phase 3 — just replace get/set calls.

What it stores:
    Sessions   — uploaded DataFrames keyed by session_id
    Forecasts  — ForecastResponse dicts keyed by forecast_id,
                 grouped by session_id for /results lookup

Thread safety:
    FastAPI runs async but CPU-bound tasks run in a thread pool.
    The dicts here are only written at upload/forecast time (not
    continuously), so a simple Lock is sufficient.

Limitations:
    - Data lives only for the lifetime of the server process
    - Not suitable for multi-process deployments (use Redis/PostgreSQL)
    - No automatic expiry (add TTL cleanup in production)
"""

import uuid
import threading
from datetime import datetime
from typing import Dict, Optional, List
import pandas as pd

from backend.services.logger import get_logger

log = get_logger(__name__)

_lock = threading.Lock()

# ── Storage dicts ─────────────────────────────────────────────────────────────

# session_id → {"df": pd.DataFrame, "summary": dict, "created_at": str}
_sessions: Dict[str, dict] = {}

# forecast_id → ForecastResponse dict
_forecasts: Dict[str, dict] = {}

# session_id → list of forecast_ids (for /results?session_id=...)
_session_forecasts: Dict[str, List[str]] = {}


# ── Session operations ────────────────────────────────────────────────────────

def create_session(df: pd.DataFrame, summary: dict) -> str:
    """
    Store a validated DataFrame and its summary.
    Returns a new unique session_id.
    """
    session_id = str(uuid.uuid4())
    with _lock:
        _sessions[session_id] = {
            "df":         df,
            "summary":    summary,
            "created_at": datetime.utcnow().isoformat(),
        }
        _session_forecasts[session_id] = []

    log.info(
        "Session created",
        extra={
            "session_id": session_id,
            "rows":       len(df),
            "products":   summary.get("products"),
        }
    )
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """
    Retrieve a stored session by ID.
    Returns None if not found (caller raises 404).
    """
    return _sessions.get(session_id)


def get_dataframe(session_id: str) -> Optional[pd.DataFrame]:
    """
    Convenience — returns just the DataFrame for a session.
    """
    session = _sessions.get(session_id)
    return session["df"] if session else None


def list_sessions() -> List[str]:
    """Return all active session IDs."""
    return list(_sessions.keys())


def delete_session(session_id: str) -> bool:
    """
    Remove a session and all its forecasts.
    Returns True if found and deleted, False if not found.
    """
    with _lock:
        if session_id not in _sessions:
            return False
        del _sessions[session_id]
        # Clean up associated forecasts
        fids = _session_forecasts.pop(session_id, [])
        for fid in fids:
            _forecasts.pop(fid, None)

    log.info("Session deleted", extra={"session_id": session_id})
    return True


# ── Forecast operations ───────────────────────────────────────────────────────

def save_forecast(session_id: str, forecast: dict) -> str:
    """
    Store a forecast result.
    Returns a new unique forecast_id (also injected into the dict).
    """
    forecast_id = str(uuid.uuid4())
    forecast["forecast_id"] = forecast_id

    with _lock:
        _forecasts[forecast_id] = forecast
        if session_id in _session_forecasts:
            _session_forecasts[session_id].append(forecast_id)
        else:
            _session_forecasts[session_id] = [forecast_id]

    log.info(
        "Forecast saved",
        extra={
            "forecast_id": forecast_id,
            "product_id":  forecast.get("product_id"),
            "horizon":     forecast.get("horizon"),
        }
    )
    return forecast_id


def get_forecast(forecast_id: str) -> Optional[dict]:
    """Retrieve a single forecast by ID."""
    return _forecasts.get(forecast_id)


def get_forecasts_for_session(session_id: str) -> List[dict]:
    """
    Return all forecasts belonging to a session, newest first.
    Used by GET /results.
    """
    fids = _session_forecasts.get(session_id, [])
    results = []
    for fid in reversed(fids):   # newest first
        f = _forecasts.get(fid)
        if f:
            results.append(f)
    return results


# ── Stats (for /health endpoint) ─────────────────────────────────────────────

def store_stats() -> dict:
    return {
        "active_sessions":  len(_sessions),
        "total_forecasts":  len(_forecasts),
    }

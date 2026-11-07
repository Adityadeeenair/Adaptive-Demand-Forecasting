"""
backend/services/session_store.py
===================================
Hybrid session store for uploaded datasets and forecast results.

Supports Redis when available (e.g. production / Railway / Upstash / Redis Cloud),
and automatically falls back to an in-memory thread-safe store when Redis is
unavailable (e.g. Render Free Tier, local development without Redis).

Data stored:
    Sessions   — uploaded DataFrames keyed by session_id, with dataset summary and timestamp
    Forecasts  — ForecastResponse dicts keyed by forecast_id, grouped by session_id
"""

import os
import uuid
import json
import io
import threading
from datetime import datetime
from typing import Dict, Optional, List
import pandas as pd

from backend.services.logger import get_logger

log = get_logger(__name__)

# ── Redis connection with graceful fallback ────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL")
SESSION_TTL = 60 * 60 * 24  # 24 hours

_redis_client = None
_redis_available = False
_redis_checked = False
_check_lock = threading.Lock()

# ── In-memory fallback structures ─────────────────────────────────────────────
_mem_lock = threading.Lock()
_mem_sessions: Dict[str, dict] = {}
_mem_forecasts: Dict[str, dict] = {}
_mem_session_forecasts: Dict[str, List[str]] = {}


def _get_redis():
    """Lazily test and return Redis client if available, else None."""
    global _redis_client, _redis_available, _redis_checked
    if _redis_checked:
        return _redis_client if _redis_available else None

    with _check_lock:
        if _redis_checked:
            return _redis_client if _redis_available else None

        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            log.info("REDIS_URL not set — using in-memory session store")
            _redis_available = False
            _redis_checked = True
            return None

        try:
            import redis
            client = redis.from_url(
                redis_url,
                decode_responses=False,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            client.ping()
            _redis_client = client
            _redis_available = True
            log.info("Connected to Redis successfully", extra={"url": redis_url.split("@")[-1]})
        except Exception as e:
            log.warning(
                f"Redis connection failed ({e}) — falling back to in-memory session store"
            )
            _redis_client = None
            _redis_available = False

        _redis_checked = True
        return _redis_client if _redis_available else None


# ── Key helpers ───────────────────────────────────────────────────────────────

def _session_key(session_id: str) -> str:
    return f"session:{session_id}"

def _forecast_key(forecast_id: str) -> str:
    return f"forecast:{forecast_id}"

def _session_forecasts_key(session_id: str) -> str:
    return f"session_forecasts:{session_id}"


# ── Session operations ────────────────────────────────────────────────────────

def create_session(df: pd.DataFrame, summary: dict) -> str:
    """Store a validated DataFrame and its summary. Returns unique session_id."""
    session_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    r = _get_redis()

    if r is not None:
        try:
            df_bytes = df.to_parquet()
            payload = {
                "df": df_bytes,
                "summary": json.dumps(summary),
                "created_at": created_at,
            }
            r.hset(_session_key(session_id), mapping=payload)
            r.expire(_session_key(session_id), SESSION_TTL)
            r.expire(_session_forecasts_key(session_id), SESSION_TTL)
            log.info("Session created (Redis)", extra={"session_id": session_id, "rows": len(df)})
            return session_id
        except Exception as e:
            log.warning(f"Redis hset failed ({e}) — falling back to in-memory store for session {session_id}")

    # In-memory storage
    with _mem_lock:
        _mem_sessions[session_id] = {
            "df": df,
            "summary": summary,
            "created_at": created_at,
        }
        _mem_session_forecasts[session_id] = []

    log.info("Session created (in-memory)", extra={"session_id": session_id, "rows": len(df)})
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """Retrieve a stored session by ID. Returns None if not found."""
    r = _get_redis()
    if r is not None:
        try:
            data = r.hgetall(_session_key(session_id))
            if data:
                df = pd.read_parquet(io.BytesIO(data[b"df"]))
                summary = json.loads(data[b"summary"])
                created_at = data[b"created_at"].decode()
                return {"df": df, "summary": summary, "created_at": created_at}
        except Exception as e:
            log.warning(f"Redis hgetall failed ({e}) — checking in-memory store")

    with _mem_lock:
        return _mem_sessions.get(session_id)


def get_dataframe(session_id: str) -> Optional[pd.DataFrame]:
    """Convenience helper — returns just the DataFrame for a session."""
    session = get_session(session_id)
    return session["df"] if session else None


def list_sessions() -> List[str]:
    """Return all active session IDs."""
    r = _get_redis()
    if r is not None:
        try:
            keys = r.keys("session:*")
            return [k.decode().replace("session:", "") for k in keys]
        except Exception as e:
            log.warning(f"Redis keys failed ({e}) — returning in-memory sessions")

    with _mem_lock:
        return list(_mem_sessions.keys())


def delete_session(session_id: str) -> bool:
    """Remove a session and all its associated forecasts."""
    deleted = False
    r = _get_redis()
    if r is not None:
        try:
            if r.exists(_session_key(session_id)):
                fids = r.lrange(_session_forecasts_key(session_id), 0, -1)
                for fid in fids:
                    r.delete(_forecast_key(fid.decode()))
                r.delete(_session_key(session_id))
                r.delete(_session_forecasts_key(session_id))
                deleted = True
        except Exception as e:
            log.warning(f"Redis delete failed ({e})")

    with _mem_lock:
        if session_id in _mem_sessions:
            del _mem_sessions[session_id]
            fids = _mem_session_forecasts.pop(session_id, [])
            for fid in fids:
                _mem_forecasts.pop(fid, None)
            deleted = True

    if deleted:
        log.info("Session deleted", extra={"session_id": session_id})
    return deleted


# ── Forecast operations ───────────────────────────────────────────────────────

def save_forecast(session_id: str, forecast: dict) -> str:
    """Store a forecast result dict and link it to session_id."""
    forecast_id = str(uuid.uuid4())
    forecast["forecast_id"] = forecast_id
    r = _get_redis()

    if r is not None:
        try:
            r.set(_forecast_key(forecast_id), json.dumps(forecast, default=str))
            r.expire(_forecast_key(forecast_id), SESSION_TTL)
            r.rpush(_session_forecasts_key(session_id), forecast_id)
            r.expire(_session_forecasts_key(session_id), SESSION_TTL)
            log.info("Forecast saved (Redis)", extra={"forecast_id": forecast_id})
            return forecast_id
        except Exception as e:
            log.warning(f"Redis forecast save failed ({e}) — saving in-memory")

    with _mem_lock:
        _mem_forecasts[forecast_id] = forecast
        if session_id in _mem_session_forecasts:
            _mem_session_forecasts[session_id].append(forecast_id)
        else:
            _mem_session_forecasts[session_id] = [forecast_id]

    log.info("Forecast saved (in-memory)", extra={"forecast_id": forecast_id})
    return forecast_id


def get_forecast(forecast_id: str) -> Optional[dict]:
    """Retrieve a single forecast by ID."""
    r = _get_redis()
    if r is not None:
        try:
            data = r.get(_forecast_key(forecast_id))
            if data:
                return json.loads(data)
        except Exception as e:
            log.warning(f"Redis get_forecast failed ({e})")

    with _mem_lock:
        return _mem_forecasts.get(forecast_id)


def get_forecasts_for_session(session_id: str) -> List[dict]:
    """Return all forecasts belonging to a session, newest first."""
    r = _get_redis()
    if r is not None:
        try:
            fids = r.lrange(_session_forecasts_key(session_id), 0, -1)
            results = []
            for fid in reversed(fids):
                f = get_forecast(fid.decode())
                if f:
                    results.append(f)
            if results:
                return results
        except Exception as e:
            log.warning(f"Redis get_forecasts_for_session failed ({e})")

    with _mem_lock:
        fids = _mem_session_forecasts.get(session_id, [])
        results = []
        for fid in reversed(fids):
            f = _mem_forecasts.get(fid)
            if f:
                results.append(f)
        return results


# ── Stats for /health endpoint ────────────────────────────────────────────────

def store_stats() -> dict:
    """Return session store stats without throwing on missing Redis."""
    r = _get_redis()
    if r is not None:
        try:
            sessions = len(r.keys("session:*"))
            forecasts = len(r.keys("forecast:*"))
            return {
                "active_sessions": sessions,
                "total_forecasts": forecasts,
                "backend": "redis",
            }
        except Exception as e:
            log.warning(f"Redis store_stats failed ({e})")

    with _mem_lock:
        return {
            "active_sessions": len(_mem_sessions),
            "total_forecasts": len(_mem_forecasts),
            "backend": "memory",
        }

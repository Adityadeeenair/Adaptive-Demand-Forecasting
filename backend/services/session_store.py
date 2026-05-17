"""
backend/services/session_store.py
===================================
Redis-backed store for uploaded datasets and forecast results.

DataFrames are serialized to parquet bytes for efficient storage.
Forecast dicts are serialized to JSON.

TTL: sessions expire after 24 hours of inactivity.
"""

import os
import uuid
import json
import pickle
from datetime import datetime
from typing import Dict, Optional, List
import pandas as pd
import redis

from backend.services.logger import get_logger

log = get_logger(__name__)

# ── Redis client ──────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
SESSION_TTL = 60 * 60 * 24  # 24 hours

_redis = redis.from_url(REDIS_URL, decode_responses=False)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _session_key(session_id: str) -> str:
    return f"session:{session_id}"

def _forecast_key(forecast_id: str) -> str:
    return f"forecast:{forecast_id}"

def _session_forecasts_key(session_id: str) -> str:
    return f"session_forecasts:{session_id}"


# ── Session operations ────────────────────────────────────────────────────────

def create_session(df: pd.DataFrame, summary: dict) -> str:
    session_id = str(uuid.uuid4())
    
    # Serialize DataFrame to parquet bytes
    df_bytes = df.to_parquet()
    
    payload = {
        "df": df_bytes,
        "summary": json.dumps(summary),
        "created_at": datetime.utcnow().isoformat(),
    }
    
    _redis.hset(_session_key(session_id), mapping={
        k: v for k, v in payload.items()
    })
    _redis.expire(_session_key(session_id), SESSION_TTL)
    _redis.expire(_session_forecasts_key(session_id), SESSION_TTL)

    log.info("Session created", extra={"session_id": session_id, "rows": len(df)})
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    data = _redis.hgetall(_session_key(session_id))
    if not data:
        return None
    
    import io
    df = pd.read_parquet(io.BytesIO(data[b"df"]))
    summary = json.loads(data[b"summary"])
    created_at = data[b"created_at"].decode()
    
    return {"df": df, "summary": summary, "created_at": created_at}


def get_dataframe(session_id: str) -> Optional[pd.DataFrame]:
    session = get_session(session_id)
    return session["df"] if session else None


def list_sessions() -> List[str]:
    keys = _redis.keys("session:*")
    return [k.decode().replace("session:", "") for k in keys]


def delete_session(session_id: str) -> bool:
    if not _redis.exists(_session_key(session_id)):
        return False
    
    # Delete associated forecasts
    fids = _redis.lrange(_session_forecasts_key(session_id), 0, -1)
    for fid in fids:
        _redis.delete(_forecast_key(fid.decode()))
    
    _redis.delete(_session_key(session_id))
    _redis.delete(_session_forecasts_key(session_id))
    log.info("Session deleted", extra={"session_id": session_id})
    return True


# ── Forecast operations ───────────────────────────────────────────────────────

def save_forecast(session_id: str, forecast: dict) -> str:
    forecast_id = str(uuid.uuid4())
    forecast["forecast_id"] = forecast_id
    
    _redis.set(_forecast_key(forecast_id), json.dumps(forecast, default=str))
    _redis.expire(_forecast_key(forecast_id), SESSION_TTL)
    
    _redis.rpush(_session_forecasts_key(session_id), forecast_id)
    _redis.expire(_session_forecasts_key(session_id), SESSION_TTL)
    
    log.info("Forecast saved", extra={"forecast_id": forecast_id})
    return forecast_id


def get_forecast(forecast_id: str) -> Optional[dict]:
    data = _redis.get(_forecast_key(forecast_id))
    return json.loads(data) if data else None


def get_forecasts_for_session(session_id: str) -> List[dict]:
    fids = _redis.lrange(_session_forecasts_key(session_id), 0, -1)
    results = []
    for fid in reversed(fids):
        f = get_forecast(fid.decode())
        if f:
            results.append(f)
    return results


# ── Stats ─────────────────────────────────────────────────────────────────────

def store_stats() -> dict:
    sessions = len(_redis.keys("session:*"))
    forecasts = len(_redis.keys("forecast:*"))
    return {"active_sessions": sessions, "total_forecasts": forecasts}
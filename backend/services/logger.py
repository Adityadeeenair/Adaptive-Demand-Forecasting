"""
backend/services/logger.py
===========================
Structured logger used by every module in the project.
- Text format in dev  (readable, colored)
- JSON format in prod (parseable by any log aggregator)

Usage (in any file):
    from backend.services.logger import get_logger, Timer
    log = get_logger(__name__)
    log.info("Step done", extra={"rows": 90000})

    with Timer("Model training", log):
        model.fit(X, y)
    # → logs "Model training completed  elapsed_seconds=12.34"
"""

import logging
import logging.handlers
import json
import os
import time
from pathlib import Path


# ── JSON formatter (production) ───────────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    """Each log line is a single JSON object — easy to grep and parse."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time":   self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":  record.levelname,
            "module": record.name,
            "msg":    record.getMessage(),
        }
        # Include any extra= fields the caller passed
        skip = {
            "name","msg","args","levelname","levelno","pathname","filename",
            "module","exc_info","exc_text","stack_info","lineno","funcName",
            "created","msecs","relativeCreated","thread","threadName",
            "processName","process","message","taskName",
        }
        for key, value in record.__dict__.items():
            if key not in skip:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


# ── Text formatter (development) ──────────────────────────────────────────────

class TextFormatter(logging.Formatter):
    """
    Colored, readable output for local development.
    Example:
        [2024-01-15 10:23:44] INFO     forecastiq.pipeline.trainer — Training started
    """
    _COLORS = {
        "DEBUG":    "\033[36m",
        "INFO":     "\033[32m",
        "WARNING":  "\033[33m",
        "ERROR":    "\033[31m",
        "CRITICAL": "\033[35m",
    }
    _RESET = "\033[0m"
    _DIM   = "\033[90m"

    def format(self, record: logging.LogRecord) -> str:
        color = self._COLORS.get(record.levelname, "")
        ts    = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        level = f"{color}{record.levelname:<8}{self._RESET}"
        mod   = f"{self._DIM}{record.name}{self._RESET}"
        line  = f"[{ts}] {level} {mod} — {record.getMessage()}"
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line


# ── Config reader (no circular imports) ──────────────────────────────────────

def _read_log_config() -> dict:
    """Reads only the logging section from config.yaml. Falls back to safe defaults."""
    try:
        import yaml
        cfg_path = Path(__file__).resolve().parents[1] / "config.yaml"
        with open(cfg_path) as f:
            return yaml.safe_load(f).get("logging", {})
    except Exception:
        return {"level": "INFO", "format": "text", "rotate_mb": 10, "backup_count": 3}


# ── Root logger initialisation (runs once per process) ───────────────────────

_ready = False

def _init() -> None:
    global _ready
    if _ready:
        return

    cfg       = _read_log_config()
    level     = getattr(logging, cfg.get("level", "INFO").upper(), logging.INFO)
    fmt       = JsonFormatter() if cfg.get("format") == "json" else TextFormatter()
    rotate_mb = cfg.get("rotate_mb", 10)
    backups   = cfg.get("backup_count", 3)

    root = logging.getLogger("forecastiq")
    root.setLevel(level)
    root.propagate = False

    # Console
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    ch.setLevel(level)
    root.addHandler(ch)

    # Rotating file
    try:
        log_dir = Path(__file__).resolve().parents[1] / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        fh = logging.handlers.RotatingFileHandler(
            filename    = log_dir / "forecastiq.log",
            maxBytes    = rotate_mb * 1024 * 1024,
            backupCount = backups,
            encoding    = "utf-8",
        )
        fh.setFormatter(fmt)
        fh.setLevel(level)
        root.addHandler(fh)
    except (OSError, PermissionError) as e:
        root.warning(f"Log file unavailable: {e}. Console only.")

    _ready = True


# ── Public API ────────────────────────────────────────────────────────────────

def get_logger(name: str) -> logging.Logger:
    """
    Returns a named child logger under the 'forecastiq' namespace.

    Args:
        name: Use __name__ of the calling module.

    Returns:
        logging.Logger ready to use.

    Example:
        log = get_logger(__name__)
        log.info("Data loaded", extra={"rows": 906000})
        log.error("File not found", extra={"path": "/data/train.csv"})
    """
    _init()
    clean = name.replace("backend.", "").replace("__main__", "main")
    return logging.getLogger(f"forecastiq.{clean}")


# ── Timer utility ─────────────────────────────────────────────────────────────

class Timer:
    """
    Context manager that logs how long a block took.

    Example:
        with Timer("Feature engineering", log):
            df = build_features(df)
        # logs: "Feature engineering completed  elapsed_seconds=4.21"
    """
    def __init__(self, label: str, logger: logging.Logger = None):
        self.label   = label
        self.logger  = logger or get_logger("timer")
        self.elapsed = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.elapsed = time.perf_counter() - self._start
        self.logger.info(
            f"{self.label} completed",
            extra={"elapsed_seconds": round(self.elapsed, 3)}
        )

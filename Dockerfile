# ── Backend Dockerfile ────────────────────────────────────────────────────────
# Runs the FastAPI server on port 8000 (or $PORT provided by Render/Cloud).
FROM python:3.11-slim

# System deps needed by LightGBM + other native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (layer cache)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, models, and data
COPY backend/ ./backend/
COPY data/    ./data/

# Ensure non-root user permissions
RUN useradd -m -u 1000 adf && chown -R adf:adf /app
USER adf

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Single worker to guarantee memory stays well within Render's 512MB free tier limit (~300MB RSS)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

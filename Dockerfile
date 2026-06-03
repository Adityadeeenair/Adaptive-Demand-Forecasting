# ── Backend Dockerfile ────────────────────────────────────────────────────────
# Runs the FastAPI server on port 8000.
# Model files are mounted as a volume at runtime (not baked into image)
# so you can retrain without rebuilding the container.

FROM python:3.11-slim

# System deps needed by LightGBM + other native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (layer cache)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy full project (backend package + config + data)
COPY backend/ ./backend/
COPY data/    ./data/

# Create saved_models dir — real models mounted via docker-compose volume
RUN mkdir -p backend/saved_models

# Non-root user for security
RUN useradd -m -u 1000 adf && chown -R adf:adf /app
USER adf

EXPOSE 8000

# Health check — docker-compose waits for this before starting frontend
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
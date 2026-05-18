# Adaptive Demand Forecasting System

A production-grade demand forecasting platform. Upload retail sales data, get automatic demand segmentation, multi-model ML forecasts, and confidence intervals — in under a minute.

---

## What it does

- **Demand Segmentation** — classifies each product as stable, trending, seasonal, or volatile
- **Ensemble ML Models** — Random Forest + XGBoost + LightGBM cxombined via NNLS weighting
- **80% Confidence Bands** — quantile regression, per product, per horizon
- **Product Comparison** — overlay two products on the same chart
- **Dataset Insights** — segment distribution, top products, sales history
- **Email Export** — send forecast CSV reports to any email address
- **Flexible Upload** — any reasonable CSV format, column names auto-detected

---

## Stack

| Layer | Technology |
|---|---|
| ML Pipeline | scikit-learn, XGBoost, LightGBM, Optuna, statsmodels |
| Backend | FastAPI, uvicorn, pandas, numpy |
| Frontend | React, Recharts, Vite |
| Serving | nginx (production), Vite dev server (development) |
| Container | Docker, docker-compose |

---

## Quick start — Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/your-username/adaptive-demand-forecasting.git
cd adaptive-demand-forecasting

# 2. Set up environment variables
cp .env.example .env
# Edit .env — only required if you want the email export feature

# 3. Build and run
docker-compose up --build

# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
# API docs → http://localhost:8000/docs
```

First startup takes ~2-3 minutes (installs Python + Node dependencies and builds the frontend). Subsequent starts are instant.

---

## Quick start — Local development

### Backend

```bash
cd adaptive-demand-forecasting

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Start the API server
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev
# → http://localhost:3000
```

---

## Training the models

The repository includes pre-trained model files in `backend/saved_models/`. To retrain on your own data:

```bash
# Activate your virtual environment first
python -m backend.pipeline.training_pipeline
```

This reads `data/retail_raw/train.csv`, runs Optuna hyperparameter tuning with TimeSeriesSplit CV, and saves new model files to `backend/saved_models/`.

---

## CSV format

Upload any CSV with time-series sales data. Column names are auto-detected:

| Column | Accepted names | Required |
|---|---|---|
| Date | `date`, `timestamp`, `day`, `week`, `period` | ✓ |
| Sales | `sales`, `demand`, `quantity`, `revenue`, `units` | ✓ |
| Store | `store`, `location`, `branch`, `region`, `shop` | Optional |
| Item | `item`, `product`, `sku`, `category`, `article` | Optional |

If store/item columns are absent, the dataset is treated as a single time series.

A sample dataset is available at `frontend/public/sample_dataset.csv` (10 products, 180 days, mixed demand patterns).

---

## Environment variables

Copy `.env.example` to `.env` and fill in your values. Only the SMTP variables are required, and only if you want the email export feature.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=you@gmail.com
```

For Gmail, generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

---

## Deployment

The app is Docker-ready. Deploy to any platform that supports containers:

**Railway**
```bash
# Push to GitHub, then connect repo in Railway dashboard
# Set environment variables in Railway UI
# Deploy automatically on git push
```

**Render**
```bash
# Create two services: Web Service (backend) + Static Site or Web Service (frontend)
# Or use a single Docker service with docker-compose
```

**Any VPS (DigitalOcean, AWS EC2, etc.)**
```bash
git clone your-repo
cd adaptive-demand-forecasting
cp .env.example .env && nano .env
docker-compose up -d --build
```

---

## Project structure

```
adaptive-demand-forecasting/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.yaml                # Model + pipeline configuration
│   ├── requirements.txt
│   ├── pipeline/
│   │   ├── training_pipeline.py   # Model training + Optuna tuning
│   │   ├── inference_pipeline.py  # Recursive forecasting
│   │   ├── segmentation.py        # Demand pattern classification
│   │   ├── feature_engineering.py # Lag features, rolling stats
│   │   └── ensemble.py            # NNLS ensemble weighting
│   ├── routers/
│   │   ├── upload.py              # POST /upload
│   │   ├── forecast.py            # POST /forecast
│   │   ├── results.py             # GET/DELETE /results
│   │   ├── email_router.py        # POST /send-email
│   │   └── insights_router.py     # GET /insights/{session_id}
│   ├── services/
│   │   ├── data_adapter.py        # Universal CSV normalisation
│   │   ├── data_loader.py         # Dataset loading + validation
│   │   ├── session_store.py       # In-memory session management
│   │   ├── email_service.py       # SMTP email sending
│   │   └── logger.py
│   └── saved_models/              # Trained model .pkl files
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx        # Home/landing page
│   │   │   ├── Home.jsx           # Upload page
│   │   │   ├── Dashboard.jsx      # Forecast dashboard
│   │   │   ├── Models.jsx         # Model architecture + live metrics
│   │   │   └── Insights.jsx       # Dataset analytics
│   │   ├── components/
│   │   │   ├── ForecastChart.jsx  # Main forecast chart
│   │   │   ├── CompareChart.jsx   # Two-product comparison chart
│   │   │   ├── MetricsPanel.jsx   # Per-model WMAPE/MAE cards
│   │   │   └── UploadZone.jsx     # Drag-and-drop upload
│   │   └── api/client.js          # Axios API client
│   └── public/
│       └── sample_dataset.csv     # Demo dataset
│
├── data/
│   └── retail_raw/train.csv       # Training data
│
├── Dockerfile                     # Backend container
├── frontend.Dockerfile            # Frontend container (nginx)
├── docker-compose.yml             # Orchestration
├── nginx.conf                     # nginx SPA + proxy config
├── .env.example                   # Environment variable template
└── .dockerignore
```

---

## License

MIT

## Project structure

```
adaptive-demand-forecasting/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.yaml                # Model + pipeline configuration
│   ├── requirements.txt
│   ├── pipeline/
│   │   ├── training_pipeline.py   # Model training + Optuna tuning
│   │   ├── inference_pipeline.py  # Recursive forecasting
│   │   ├── segmentation.py        # Demand pattern classification
│   │   ├── feature_engineering.py # Lag features, rolling stats
│   │   └── ensemble.py            # NNLS ensemble weighting
│   ├── routers/
│   │   ├── upload.py              # POST /upload
│   │   ├── forecast.py            # POST /forecast
│   │   ├── results.py             # GET/DELETE /results
│   │   ├── email_router.py        # POST /send-email
│   │   └── insights_router.py     # GET /insights/{session_id}
│   ├── services/
│   │   ├── data_adapter.py        # Universal CSV normalisation
│   │   ├── data_loader.py         # Dataset loading + validation
│   │   ├── session_store.py       # In-memory session management
│   │   ├── email_service.py       # SMTP email sending
│   │   └── logger.py
│   └── saved_models/              # Trained model .pkl files
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx        # Home/landing page
│   │   │   ├── Home.jsx           # Upload page
│   │   │   ├── Dashboard.jsx      # Forecast dashboard
│   │   │   ├── Models.jsx         # Model architecture + live metrics
│   │   │   └── Insights.jsx       # Dataset analytics
│   │   ├── components/
│   │   │   ├── ForecastChart.jsx  # Main forecast chart
│   │   │   ├── CompareChart.jsx   # Two-product comparison chart
│   │   │   ├── MetricsPanel.jsx   # Per-model WMAPE/MAE cards
│   │   │   └── UploadZone.jsx     # Drag-and-drop upload
│   │   └── api/client.js          # Axios API client
│   └── public/
│       └── sample_dataset.csv     # Demo dataset
│
├── data/
│   └── retail_raw/train.csv       # Training data
│
├── Dockerfile                     # Backend container
├── frontend.Dockerfile            # Frontend container (nginx)
├── docker-compose.yml             # Orchestration
├── nginx.conf                     # nginx SPA + proxy config
├── .env.example                   # Environment variable template
└── .dockerignore
```

---

## License

MIT

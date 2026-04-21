# Adaptive-Demand-Forecasting
Overview
This project implements a hybrid demand forecasting system designed to predict retail product sales using a combination of statistical time series models and machine learning models.

The system analyzes historical sales data, identifies demand behavior patterns, and applies appropriate forecasting techniques to improve prediction accuracy.

The project demonstrates how classical forecasting models and modern machine learning models can be combined into a unified forecasting pipeline. The system simulates real-world retail demand forecasting scenarios where different products exhibit different demand behaviors.

The dataset contains five years of daily retail sales data across multiple stores and items. The forecasting pipeline includes demand segmentation, classical forecasting models, machine learning feature engineering, model comparison, and ensemble forecasting.

Project Objectives
The main goals of this project were:

Build a demand segmentation system to classify products based on their sales behavior
Implement classical forecasting models suitable for different demand patterns
Engineer machine learning features from time series data
Train multiple machine learning models using a global forecasting approach
Compare model performance using forecasting metrics
Combine models using an ensemble forecasting strategy
Tech-Stack Used
Python
Pandas
NumPy
Scikit-learn
XGBoost
LightGBM
Statsmodels

Dataset
The dataset used in this project contains daily retail sales data with the following fields:

date
store
item
sales
The dataset spans five years of historical sales and contains more than 900,000 observations across 500 product–store combinations.

Each record represents the number of units sold for a specific item at a specific store on a particular day.

Forecasting Pipeline
The forecasting system follows a structured pipeline consisting of several stages.

Data preprocessing prepares the dataset by converting date fields and generating unique product identifiers.

Demand behavior analysis calculates statistical metrics such as trend, volatility, intermittency, and seasonality.

Product segmentation categorizes products based on their demand patterns.

Classical forecasting models are applied to segments where statistical approaches perform well.

Machine learning feature engineering converts the time series into supervised learning features.

Machine learning models are trained using a global forecasting approach.

Model predictions are combined through an ensemble method to produce the final forecast.

Demand Segmentation
Products are segmented according to their sales behavior.

Stable demand
Products with consistent sales and low volatility.

Seasonal demand
Products showing recurring weekly demand patterns.

Volatile demand
Products with irregular fluctuations but continuous demand.

Each segment is associated with forecasting models that best capture the underlying behavior.

Classical Forecasting Models
Several statistical forecasting models were implemented.

Simple Exponential Smoothing is used for stable demand products where sales fluctuate around a constant level.

Holt-Winters seasonal forecasting captures weekly seasonality present in certain products.

Rolling mean forecasting smooths irregular fluctuations for volatile demand.

These models provide strong baseline forecasts and capture time series structures effectively.

Machine Learning Forecasting
A global machine learning model was trained using engineered features derived from historical sales data.

The following features were used:

lag_1
lag_7
lag_14
rolling_mean_7
day_of_week
store encoding
item encoding
These features allow the model to learn temporal demand patterns as well as cross-product behavior.

Three machine learning models were trained and evaluated:

Random Forest Regressor
XGBoost Regressor
LightGBM Regressor
Model Evaluation
Model performance was evaluated using forecasting metrics commonly used in demand forecasting.

Mean Absolute Error (MAE) measures the average magnitude of prediction errors.

Weighted Mean Absolute Percentage Error (WMAPE) measures relative forecasting error across all products.

Results obtained:

Random Forest
WMAPE ≈ 0.113

XGBoost
WMAPE ≈ 0.112

LightGBM
WMAPE ≈ 0.1116

Ensemble Forecasting
To improve forecast stability, predictions from multiple machine learning models were combined using weighted averaging.

The ensemble uses the following weighting strategy based on model accuracy:

Random Forest weight: 0.25
XGBoost weight: 0.35
LightGBM weight: 0.40
This ensemble approach produces the final forecast and slightly improves overall prediction accuracy.

Final ensemble performance achieved a WMAPE of approximately 0.1117 on the test dataset.

Project Structure
adaptive-demand-forecasting
│
├── data
│   └── retail dataset
│
|── notebooks
│   └── forecasting_analysis
|
├── src
│   ├── data_loader
│   ├── segmentation
│   ├── classical_models
│   ├── ml_features
│   ├── ml_models
│   └── ensemble_models
│
└── README.md
Key Learnings
This project highlights several important principles in demand forecasting.

Feature engineering often contributes more to model performance than model complexity.

Different demand behaviors require different forecasting strategies.

Global machine learning models can learn shared patterns across products.

Combining multiple models through ensemble forecasting improves prediction stability.

Future Improvements
Possible extensions of this project include:

Adding promotion or holiday features to improve demand prediction
Incorporating deep learning models such as LSTM or Temporal Fusion Transformers
Developing an automated model selection system based on demand segmentation
Building a forecasting dashboard to visualize predictions and demand trends
How to Run
Step 1 : Clone the repository - git clone https://github.com/YOUR_USERNAME/adaptive-demand-forecasting.git

Step 2 : Navigate into the project directory - cd adaptive-demand-forecasting

Step 3 : Install required dependencies - pip install -r requirements.txt

Step 4 : Run the forecasting pipeline - python src/main.py
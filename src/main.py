from real_data_loader import load_retail_data
from real_behavior_metrics import compute_real_behavior_metrics
from behavior_metrics import assign_behavior_tags
from segment_evaluation import evaluate_segment
from baseline_models import naive_last_value_forecast
from behavior_metrics import assign_final_segment

from baseline_models import ses_forecast
from baseline_models import holt_winters_forecast
from baseline_models import rolling_mean_forecast

from ml_models import train_random_forest
import numpy as np
import pandas as pd
from ml_models import train_xgboost
from ml_models import train_lightgbm

from ensemble_models import weighted_ensemble


if __name__ == "__main__":

    df = load_retail_data()

    metrics_df = compute_real_behavior_metrics(df)

    segmented_df = assign_behavior_tags(metrics_df)
    segmented_df = assign_final_segment(segmented_df)

    stable_results = evaluate_segment(
        df,
        segmented_df,
        "stable",
        naive_last_value_forecast
    )

    print("\nStable Segment Results:")
    print(stable_results)

    seasonal_results = evaluate_segment(
        df,
        segmented_df,
        "seasonal_stable",
        naive_last_value_forecast
    )

    print("\nSeasonal Stable Segment Results:")
    print(seasonal_results)

    ses_results = evaluate_segment(
    df, segmented_df, "stable", ses_forecast )

    print("\nSES Stable Segment Results:")
    print(ses_results)

    hw_results = evaluate_segment(
    df,
    segmented_df,
    "seasonal_stable",
    holt_winters_forecast)

    print("\nHolt-Winters Seasonal Segment Results:")
    print(hw_results)


    volatile_results = evaluate_segment(
    df,
    segmented_df,
    "volatile",
    rolling_mean_forecast
    )
    print("\nVolatile Segment Results:")
    print(volatile_results)


from ml_features import create_ml_features    #ML dataset creation 

ml_df = create_ml_features(df)

print("\nML Dataset Shape:", ml_df.shape)
print(ml_df.head())



# Split by time (Train - Test Split)

train_data = ml_df[ml_df["date"] < "2017-01-01"]
test_data = ml_df[ml_df["date"] >= "2017-01-01"]

features = [ "store", "item", "lag_1", "lag_7", "lag_14", "rolling_mean_7", "day_of_week" ]   #FEATURE LIST

X_train = train_data[features]
y_train = train_data["sales"]

X_test = test_data[features]
y_test = test_data["sales"]

# Train model
rf_model = train_random_forest(X_train, y_train)

# PREDICT 
preds = rf_model.predict(X_test)

# EVALUATE....
mae = np.mean(np.abs(y_test - preds))
wmape = np.sum(np.abs(y_test - preds)) / np.sum(y_test)

print("\nRandom Forest Results:")
print("MAE:", mae)
print("WMAPE:", wmape)


#FEATURE IMPORTANCE CHECK : 

importance = rf_model.feature_importances_

feature_importance = pd.DataFrame({
    "feature": features,
    "importance": importance
}).sort_values("importance", ascending=False)

print("\nFeature Importance:")
print(feature_importance)



import pandas as pd

results_table = pd.DataFrame({
    "Model": ["Random Forest", "XGBoost", "LightGBM", "Ensemble"],
    "MAE": [6.663388880225481, 6.5753689604511, 6.566828461926892, 6.568642785453355],
    "WMAPE": [0.11329401221206685, 0.11179745692389845, 0.11165224742742584, 0.11168309539314697]
})

print("\nModel Performance Summary\n")

print(f"{'Model':<15}{'MAE':<12}{'WMAPE'}")
print("-" * 35)

print(f"{'Random Forest':<15}{6.663389:<12.6f}{0.113294:.6f}")
print(f"{'XGBoost':<15}{6.575369:<12.6f}{0.111797:.6f}")
print(f"{'LightGBM':<15}{6.566828:<12.6f}{0.111652:.6f}")
print(f"{'Ensemble':<15}{6.568643:<12.6f}{0.111683:.6f}")



# TRAINING XGBoost
xgb_model = train_xgboost(X_train, y_train)

xgb_preds = xgb_model.predict(X_test)

xgb_mae = np.mean(np.abs(y_test - xgb_preds))
xgb_wmape = np.sum(np.abs(y_test - xgb_preds)) / np.sum(y_test)

print("\nXGBoost Results:")
print("MAE:", xgb_mae)
print("WMAPE:", xgb_wmape)


# TRAINING LightGBM 
lgb_model = train_lightgbm(X_train, y_train)

lgb_preds = lgb_model.predict(X_test)

lgb_mae = np.mean(np.abs(y_test - lgb_preds))
lgb_wmape = np.sum(np.abs(y_test - lgb_preds)) / np.sum(y_test)

print("\nLightGBM Results:")
print("MAE:", lgb_mae)
print("WMAPE:", lgb_wmape)


#ENSEMBLE IMPLEMENTATION 
ensemble_preds = weighted_ensemble(preds, xgb_preds, lgb_preds)

ensemble_mae = np.mean(np.abs(y_test - ensemble_preds))
ensemble_wmape = np.sum(np.abs(y_test - ensemble_preds)) / np.sum(y_test)

print("\nEnsemble Results:")
print("MAE:", ensemble_mae)
print("WMAPE:", ensemble_wmape)



from evaluation_engine import evaluate_single_product


def evaluate_segment(df, segmented_df, segment_name, forecast_function):

    products = segmented_df[segmented_df["final_segment"] == segment_name]["product_id"]

    total_abs_error = 0
    total_actual = 0
    mae_list = []

    for product in products:

        product_series = df[df["product_id"] == product].sort_values("date")["sales"]

        result = evaluate_single_product(product_series, forecast_function)

        if result is None:
            continue

        total_abs_error += result["total_abs_error"]
        total_actual += result["total_actual"]
        mae_list.append(result["mae"])

    wmape = total_abs_error / total_actual if total_actual > 0 else 0
    mae = sum(mae_list) / len(mae_list) if mae_list else 0

    return {
        "segment": segment_name,
        "wmape": wmape,
        "mae": mae,
        "products_evaluated": len(mae_list)
    }
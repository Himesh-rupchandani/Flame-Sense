"""
Model Training & Evaluation Script for Flame-Sense Fire Risk Classification.

Features:
- Loads any CSV dataset (--dataset, defaulting to ml/data/flame_sense_training.csv)
- Validates required columns, data types, missing values, and physical bounds
- Clearly tracks and persists dataset provenance (DEMO/SYNTHETIC vs real dataset)
- Splits into stratified train/test sets (80/20)
- Trains and compares RandomForestClassifier vs LogisticRegression
  (plus GradientBoostingClassifier benchmark) using identical preprocessing pipelines
- Evaluates with Accuracy, Macro Precision, Macro Recall, Macro F1, and Confusion Matrix
- Saves the best Scikit-learn Pipeline (.joblib) and full metadata JSON for FastAPI & Express

Usage:
  python3 ml/train_model.py
  python3 ml/train_model.py --dataset path/to/real_nasa_experiments.csv --provenance NASA_EXPERIMENTAL
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATASET = BASE_DIR / "data" / "flame_sense_training.csv"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODEL_OUTPUT_PATH = ARTIFACTS_DIR / "flame_risk_model.joblib"
METADATA_OUTPUT_PATH = ARTIFACTS_DIR / "model_metadata.json"

REQUIRED_COLUMNS = ["oxygen_pct", "pressure_psi", "airflow_cm_s", "fuel_type", "risk_category"]
VALID_FUELS = ["solid-fabric", "plastic", "liquid", "gas"]
CLASS_LABELS = ["SAFE", "CAUTION", "DANGER"]


def validate_and_clean_dataset(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in raw_df.columns]
    if missing_cols:
        raise ValueError(f"Dataset is missing required columns: {missing_cols}")

    total_rows = int(len(raw_df))
    df = raw_df.copy()

    # Normalize string columns
    df["fuel_type"] = df["fuel_type"].astype(str).str.strip().str.lower()
    df["risk_category"] = df["risk_category"].astype(str).str.strip().str.upper()

    # Coerce numeric columns cleanly while tracking invalid/non-numeric entries
    numeric_cols = ["oxygen_pct", "pressure_psi", "airflow_cm_s"]
    type_error_counts: dict[str, int] = {}
    missing_counts: dict[str, int] = {}

    for col in numeric_cols:
        originally_present = df[col].notna() & (df[col].astype(str).str.strip() != "")
        coerced = pd.to_numeric(df[col], errors="coerce")
        invalid_type_mask = originally_present & coerced.isna()
        type_error_counts[col] = int(invalid_type_mask.sum())
        missing_counts[col] = int((~originally_present).sum())
        df[col] = coerced

    missing_target = int((~df["risk_category"].isin(CLASS_LABELS)).sum())
    invalid_fuel = int((~df["fuel_type"].isin(VALID_FUELS)).sum())

    # Physical domain validation
    out_of_bounds_mask = (
        df["oxygen_pct"].notna() & ((df["oxygen_pct"] < 14.0) | (df["oxygen_pct"] > 85.0))
    ) | (
        df["pressure_psi"].notna() & ((df["pressure_psi"] < 4.3) | (df["pressure_psi"] > 14.7))
    ) | (
        df["airflow_cm_s"].notna() & ((df["airflow_cm_s"] < 0.0) | (df["airflow_cm_s"] > 100.0))
    )
    out_of_bounds_count = int(out_of_bounds_mask.sum())

    # Drop rows with missing target, invalid fuel, invalid types, or out-of-range values
    # Allow up to 1 missing numeric feature to be handled by SimpleImputer if target & types are valid,
    # or drop rows missing all features / invalid rows.
    valid_mask = (
        df["risk_category"].isin(CLASS_LABELS)
        & df["fuel_type"].isin(VALID_FUELS)
        & (~out_of_bounds_mask)
        & (df[numeric_cols].notna().sum(axis=1) >= 2)
    )

    clean_df = df.loc[valid_mask].copy().reset_index(drop=True)
    dropped_rows = total_rows - int(len(clean_df))

    if len(clean_df) < 30:
        raise ValueError(
            f"Insufficient valid rows after cleaning ({len(clean_df)}). At least 30 valid rows are required."
        )

    validation_report = {
        "totalRawRows": total_rows,
        "validCleanedRows": int(len(clean_df)),
        "droppedInvalidOrIncompleteRows": dropped_rows,
        "missingValueCountsBeforeClean": missing_counts,
        "nonNumericTypeErrors": type_error_counts,
        "missingOrInvalidTargets": missing_target,
        "invalidFuelCategoryRows": invalid_fuel,
        "outOfRangeRows": out_of_bounds_count,
        "remainingMissingFeaturesImputedInPipeline": {
            col: int(clean_df[col].isna().sum()) for col in numeric_cols
        },
        "classDistribution": {
            lbl: int((clean_df["risk_category"] == lbl).sum()) for lbl in CLASS_LABELS
        },
    }
    return clean_df, validation_report


def build_preprocessor() -> ColumnTransformer:
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(categories=[VALID_FUELS], handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, ["oxygen_pct", "pressure_psi", "airflow_cm_s"]),
            ("cat", categorical_pipeline, ["fuel_type"]),
        ]
    )


def evaluate_classifier(
    name: str,
    display_name: str,
    pipeline: Pipeline,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> dict[str, Any]:
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1_macro")

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    prec_macro = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    rec_macro = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    f1_macro = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    cm = confusion_matrix(y_test, y_pred, labels=CLASS_LABELS).tolist()
    per_class = classification_report(
        y_test, y_pred, labels=CLASS_LABELS, output_dict=True, zero_division=0
    )

    return {
        "key": name,
        "displayName": display_name,
        "pipeline": pipeline,
        "cvF1MacroMean": round(float(np.mean(cv_scores)), 4),
        "cvF1MacroStd": round(float(np.std(cv_scores)), 4),
        "accuracy": round(acc, 4),
        "precisionMacro": round(prec_macro, 4),
        "recallMacro": round(rec_macro, 4),
        "f1Macro": round(f1_macro, 4),
        "confusionMatrix": cm,
        "perClassMetrics": {
            lbl: {
                "precision": round(float(per_class[lbl]["precision"]), 4),
                "recall": round(float(per_class[lbl]["recall"]), 4),
                "f1": round(float(per_class[lbl]["f1-score"]), 4),
                "support": int(per_class[lbl]["support"]),
            }
            for lbl in CLASS_LABELS
            if lbl in per_class
        },
    }


def extract_feature_importances(best_pipeline: Pipeline) -> list[dict[str, Any]]:
    clf = best_pipeline.named_steps["classifier"]
    pre = best_pipeline.named_steps["preprocessor"]
    feature_names = list(pre.get_feature_names_out())

    if hasattr(clf, "feature_importances_"):
        raw_imp = clf.feature_importances_
    elif hasattr(clf, "coef_"):
        raw_imp = np.mean(np.abs(clf.coef_), axis=0)
    else:
        return []

    # Aggregate one-hot fuel_type importances back to human features
    grouped: dict[str, float] = {
        "Oxygen (%)": 0.0,
        "Pressure (psi)": 0.0,
        "Airflow (cm/s)": 0.0,
        "Fuel Type": 0.0,
    }
    for fname, val in zip(feature_names, raw_imp):
        if "oxygen_pct" in fname:
            grouped["Oxygen (%)"] += float(val)
        elif "pressure_psi" in fname:
            grouped["Pressure (psi)"] += float(val)
        elif "airflow_cm_s" in fname:
            grouped["Airflow (cm/s)"] += float(val)
        elif "fuel_type" in fname:
            grouped["Fuel Type"] += float(val)

    total = sum(grouped.values()) or 1.0
    return sorted(
        [
            {"feature": k, "importancePct": round((v / total) * 100.0, 2)}
            for k, v in grouped.items()
        ],
        key=lambda x: x["importancePct"],
        reverse=True,
    )


def train_and_save(dataset_path: Path, provenance_label: str | None = None) -> dict[str, Any]:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Training dataset not found: {dataset_path}")

    raw_df = pd.read_csv(dataset_path)
    clean_df, validation_report = validate_and_clean_dataset(raw_df)

    inferred_synthetic = True
    if "is_synthetic_demo" in clean_df.columns:
        inferred_synthetic = bool(
            (clean_df["is_synthetic_demo"].astype(str).str.lower() == "true").any()
        )
    elif provenance_label and "REAL" in provenance_label.upper():
        inferred_synthetic = False

    effective_provenance = provenance_label or (
        "DEMO / SYNTHETIC DATA (Includes Project Demo CSVs + Synthetic Sweep — Not Verified NASA Flight Data)"
        if inferred_synthetic
        else "Experimental CSV Dataset"
    )

    X = clean_df[["oxygen_pct", "pressure_psi", "airflow_cm_s", "fuel_type"]]
    y = clean_df["risk_category"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    candidates = [
        (
            "random_forest",
            "RandomForestClassifier (scikit-learn)",
            Pipeline(
                steps=[
                    ("preprocessor", build_preprocessor()),
                    (
                        "classifier",
                        RandomForestClassifier(
                            n_estimators=300,
                            max_depth=14,
                            min_samples_leaf=2,
                            random_state=42,
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
        ),
        (
            "logistic_regression",
            "LogisticRegression (scikit-learn)",
            Pipeline(
                steps=[
                    ("preprocessor", build_preprocessor()),
                    (
                        "classifier",
                        LogisticRegression(
                            max_iter=2000,
                            random_state=42,
                        ),
                    ),
                ]
            ),
        ),
        (
            "gradient_boosting",
            "GradientBoostingClassifier (scikit-learn)",
            Pipeline(
                steps=[
                    ("preprocessor", build_preprocessor()),
                    (
                        "classifier",
                        GradientBoostingClassifier(
                            n_estimators=200,
                            learning_rate=0.08,
                            max_depth=4,
                            random_state=42,
                        ),
                    ),
                ]
            ),
        ),
    ]

    results = [
        evaluate_classifier(key, disp, pipe, X_train, y_train, X_test, y_test)
        for key, disp, pipe in candidates
    ]

    # Select best model by test Macro-F1 (tie-break by test accuracy)
    best = max(results, key=lambda r: (r["f1Macro"], r["accuracy"]))

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best["pipeline"], MODEL_OUTPUT_PATH)

    comparison_summary = [
        {
            "key": r["key"],
            "modelName": r["displayName"],
            "cvF1MacroMean": r["cvF1MacroMean"],
            "cvF1MacroStd": r["cvF1MacroStd"],
            "accuracy": r["accuracy"],
            "precisionMacro": r["precisionMacro"],
            "recallMacro": r["recallMacro"],
            "f1Macro": r["f1Macro"],
            "confusionMatrix": r["confusionMatrix"],
            "selected": r["key"] == best["key"],
        }
        for r in results
    ]

    metadata = {
        "modelName": best["displayName"],
        "selectedAlgorithmKey": best["key"],
        "sklearnModelVersion": f"{best['displayName']} · v1.0",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "datasetFile": str(dataset_path.relative_to(BASE_DIR.parent))
        if dataset_path.is_relative_to(BASE_DIR.parent)
        else str(dataset_path),
        "isSyntheticDemoData": inferred_synthetic,
        "datasetProvenance": effective_provenance,
        "nasaValidationClaim": False,
        "validationReport": validation_report,
        "split": {
            "trainSamples": int(len(X_train)),
            "testSamples": int(len(X_test)),
            "testRatio": 0.2,
            "stratified": True,
        },
        "labels": CLASS_LABELS,
        "evaluation": {
            "accuracy": best["accuracy"],
            "precisionMacro": best["precisionMacro"],
            "recallMacro": best["recallMacro"],
            "f1Macro": best["f1Macro"],
            "cvF1MacroMean": best["cvF1MacroMean"],
            "confusionMatrix": best["confusionMatrix"],
            "perClassMetrics": best["perClassMetrics"],
        },
        "globalFeatureImportances": extract_feature_importances(best["pipeline"]),
        "modelComparison": comparison_summary,
    }

    with open(METADATA_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("\n=== Flame-Sense ML Model Comparison (Held-Out Test Set) ===")
    for item in comparison_summary:
        tag = " [SELECTED]" if item["selected"] else ""
        print(
            f"- {item['modelName']}{tag}: "
            f"Acc={item['accuracy']:.4f}, Prec={item['precisionMacro']:.4f}, "
            f"Rec={item['recallMacro']:.4f}, F1={item['f1Macro']:.4f}, CV_F1={item['cvF1MacroMean']:.4f}"
        )
    print(f"Confusion Matrix (rows=true, cols=pred {CLASS_LABELS}): {best['confusionMatrix']}")
    print(f"Saved model -> {MODEL_OUTPUT_PATH}")
    print(f"Saved metadata -> {METADATA_OUTPUT_PATH}\n")
    return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Flame-Sense Scikit-learn fire-risk classifier.")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET,
        help="Path to CSV training dataset (default: ml/data/flame_sense_training.csv)",
    )
    parser.add_argument(
        "--provenance",
        type=str,
        default=None,
        help="Optional provenance label override for real experimental datasets.",
    )
    args = parser.parse_args()
    train_and_save(args.dataset, args.provenance)

"""
Flame-Sense Python ML Prediction Microservice (FastAPI + Scikit-learn).

Loads the trained Scikit-learn Pipeline from `ml/artifacts/flame_risk_model.joblib`
and its evaluation metadata from `ml/artifacts/model_metadata.json`.
Computes real multi-class predictions (SAFE / CAUTION / DANGER), calibrated class
probabilities/confidence, and exact 16-coalition Shapley attributions directly
from the ML model's predicted severity probability.

Start:
  uvicorn ml.service:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import json
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "artifacts" / "flame_risk_model.joblib"
METADATA_PATH = BASE_DIR / "artifacts" / "model_metadata.json"

VALID_FUELS = ("solid-fabric", "plastic", "liquid", "gas")
FUEL_DISPLAY = {
    "solid-fabric": {"label": "Solid Fabric", "material": "Cotton / Nomex Textiles", "baseLocPct": 17.8},
    "plastic": {"label": "Plastic", "material": "PMMA / HDPE Polymers", "baseLocPct": 17.2},
    "liquid": {"label": "Liquid", "material": "Heptane / Alkane Fuels", "baseLocPct": 14.5},
    "gas": {"label": "Gas", "material": "Methane / Ethylene Vapors", "baseLocPct": 12.6},
}

BASELINE_INPUT = {
    "oxygen_pct": 21.0,
    "pressure_psi": 14.7,
    "airflow_cm_s": 10.0,
    "fuel_type": "plastic",
}

app = FastAPI(
    title="Flame-Sense ML Prediction Service",
    description="Scikit-learn spacecraft microgravity fire-risk classification service.",
    version="1.0.0",
)

_model = None
_metadata: dict[str, Any] = {}


def load_artifacts() -> None:
    global _model, _metadata
    if MODEL_PATH.exists():
        _model = joblib.load(MODEL_PATH)
    else:
        _model = None

    if METADATA_PATH.exists():
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            _metadata = json.load(f)
    else:
        _metadata = {}


load_artifacts()


class PredictRequest(BaseModel):
    oxygenPct: float = Field(..., ge=21.0, le=85.0)
    pressurePsi: float = Field(..., ge=4.3, le=14.7)
    airflowCmS: float = Field(..., ge=0.0, le=100.0)
    fuelType: Literal["solid-fabric", "plastic", "liquid", "gas"]


def ensure_model_ready() -> None:
    if _model is None:
        load_artifacts()
    if _model is None:
        raise HTTPException(
            status_code=503,
            detail="Trained ML model artifact (ml/artifacts/flame_risk_model.joblib) is not loaded. Run `python3 ml/train_model.py` first.",
        )


def model_prob_vector(rows: list[dict[str, Any]]) -> tuple[list[str], list[dict[str, float]]]:
    df = pd.DataFrame(rows)
    classes = list(_model.classes_)
    probs_matrix = _model.predict_proba(df)
    preds = list(_model.predict(df))
    prob_dicts: list[dict[str, float]] = []
    for row_probs in probs_matrix:
        d = {cls: float(p) for cls, p in zip(classes, row_probs)}
        prob_dicts.append(
            {
                "SAFE": d.get("SAFE", 0.0),
                "CAUTION": d.get("CAUTION", 0.0),
                "DANGER": d.get("DANGER", 0.0),
            }
        )
    return preds, prob_dicts


def prob_to_severity_score(probs: dict[str, float]) -> float:
    # Expected continuous risk index (0-100) derived strictly from ML class probabilities
    return round((probs["CAUTION"] * 50.0 + probs["DANGER"] * 98.0), 1)


def compute_ml_shapley(req: PredictRequest) -> tuple[float, list[dict[str, Any]]]:
    """
    Compute exact 16-coalition Shapley attributions directly from the loaded
    Scikit-learn pipeline's probability-weighted risk score.
    """
    features = [
        ("oxygenPct", "Oxygen", f"{req.oxygenPct}% O₂", "oxygen_pct", req.oxygenPct),
        ("fuelType", "Fuel Type", FUEL_DISPLAY[req.fuelType]["label"], "fuel_type", req.fuelType),
        ("pressurePsi", "Pressure", f"{req.pressurePsi} psi", "pressure_psi", req.pressurePsi),
        ("airflowCmS", "Airflow", f"{req.airflowCmS} cm/s", "airflow_cm_s", req.airflowCmS),
    ]

    coalitions: list[dict[str, Any]] = []
    for mask in range(16):
        coalitions.append(
            {
                "oxygen_pct": req.oxygenPct if (mask & 1) else BASELINE_INPUT["oxygen_pct"],
                "fuel_type": req.fuelType if (mask & 2) else BASELINE_INPUT["fuel_type"],
                "pressure_psi": req.pressurePsi if (mask & 4) else BASELINE_INPUT["pressure_psi"],
                "airflow_cm_s": req.airflowCmS if (mask & 8) else BASELINE_INPUT["airflow_cm_s"],
            }
        )

    _, prob_list = model_prob_vector(coalitions)
    scores = [prob_to_severity_score(p) for p in prob_list]
    baseline_score = scores[0]
    full_score = scores[15]

    n = 4
    n_fact = math.factorial(n)
    raw_items: list[dict[str, Any]] = []
    for idx, (fkey, label, vlabel, _, _) in enumerate(features):
        bit = 1 << idx
        phi = 0.0
        for mask in range(16):
            if mask & bit:
                continue
            subset_size = bin(mask).count("1")
            weight = (math.factorial(subset_size) * math.factorial(n - subset_size - 1)) / n_fact
            phi += weight * (scores[mask | bit] - scores[mask])
        raw_items.append(
            {
                "feature": fkey,
                "label": label,
                "valueLabel": vlabel,
                "phi": round(phi, 2),
            }
        )

    abs_phis = [abs(item["phi"]) for item in raw_items]
    total_abs = sum(abs_phis)
    if total_abs < 0.5:
        # Perturb around input if near identical to baseline so relative sensitivity remains informative
        perturb_rows = [
            {
                "oxygen_pct": min(85.0, req.oxygenPct + 5.0),
                "pressure_psi": req.pressurePsi,
                "airflow_cm_s": req.airflowCmS,
                "fuel_type": req.fuelType,
            },
            {
                "oxygen_pct": req.oxygenPct,
                "pressure_psi": req.pressurePsi,
                "airflow_cm_s": req.airflowCmS,
                "fuel_type": "gas" if req.fuelType != "gas" else "solid-fabric",
            },
            {
                "oxygen_pct": req.oxygenPct,
                "pressure_psi": max(4.3, req.pressurePsi - 2.0) if req.pressurePsi > 8 else min(14.7, req.pressurePsi + 2.0),
                "airflow_cm_s": req.airflowCmS,
                "fuel_type": req.fuelType,
            },
            {
                "oxygen_pct": req.oxygenPct,
                "pressure_psi": req.pressurePsi,
                "airflow_cm_s": min(100.0, req.airflowCmS + 15.0) if req.airflowCmS < 50 else max(0.0, req.airflowCmS - 15.0),
                "fuel_type": req.fuelType,
            },
        ]
        _, pert_probs = model_prob_vector(perturb_rows)
        weights = [max(0.2, abs(prob_to_severity_score(p) - full_score)) for p in pert_probs]
    else:
        weights = [max(0.2, abs(item["phi"])) for item in raw_items]

    total_w = sum(weights) or 1.0
    shap_values = [
        {
            "feature": item["feature"],
            "label": item["label"],
            "valueLabel": item["valueLabel"],
            "phi": item["phi"],
            "importancePct": round((weights[i] / total_w) * 100.0, 1),
            "direction": "increases" if item["phi"] >= 0 else "decreases",
        }
        for i, item in enumerate(raw_items)
    ]
    shap_values.sort(key=lambda x: x["importancePct"], reverse=True)
    return baseline_score, shap_values


@app.get("/health")
def health() -> dict[str, Any]:
    if _model is None:
        load_artifacts()
    loaded = _model is not None
    return {
        "status": "ok" if loaded else "model_missing",
        "modelLoaded": loaded,
        "modelName": _metadata.get("modelName", "Unavailable"),
        "sklearnModelVersion": _metadata.get("sklearnModelVersion", "Unavailable"),
        "isSyntheticDemoData": _metadata.get("isSyntheticDemoData", True),
        "datasetProvenance": _metadata.get(
            "datasetProvenance", "DEMO / SYNTHETIC DATA (Not NASA Flight Certified)"
        ),
        "evaluation": _metadata.get("evaluation"),
        "split": _metadata.get("split"),
        "modelComparison": _metadata.get("modelComparison"),
        "validationReport": _metadata.get("validationReport"),
    }


@app.get("/model-info")
def model_info() -> dict[str, Any]:
    ensure_model_ready()
    return _metadata


@app.post("/predict")
def predict(req: PredictRequest) -> dict[str, Any]:
    ensure_model_ready()

    row = {
        "oxygen_pct": req.oxygenPct,
        "pressure_psi": req.pressurePsi,
        "airflow_cm_s": req.airflowCmS,
        "fuel_type": req.fuelType,
    }
    preds, prob_list = model_prob_vector([row])
    predicted_class = str(preds[0])
    probs = prob_list[0]

    prob_pcts = {
        "SAFE": round(probs["SAFE"] * 100.0, 1),
        "CAUTION": round(probs["CAUTION"] * 100.0, 1),
        "DANGER": round(probs["DANGER"] * 100.0, 1),
    }
    confidence_pct = round(probs.get(predicted_class, max(probs.values())) * 100.0, 1)
    risk_score = prob_to_severity_score(probs)

    # Reference LOC estimate for contextual margin display (not the classification driver)
    fuel_meta = FUEL_DISPLAY[req.fuelType]
    flow_shift = -(req.airflowCmS * 0.14) if req.airflowCmS <= 20 else -(2.8) + ((req.airflowCmS - 20) * 0.045)
    psi_shift = (14.7 - req.pressurePsi) * 0.18
    ref_loc = round(max(10.5, min(28.0, fuel_meta["baseLocPct"] + flow_shift + psi_shift)), 1)
    o2_margin = round(req.oxygenPct - ref_loc, 1)

    baseline_score, shap_values = compute_ml_shapley(req)

    model_name = _metadata.get("modelName", "RandomForestClassifier (scikit-learn)")
    provenance = _metadata.get(
        "datasetProvenance",
        "DEMO / SYNTHETIC DATA (Includes Project Demo CSVs + Synthetic Sweep — Not Verified NASA Flight Data)",
    )

    explanation = (
        f"Trained {model_name} predicts {predicted_class} with {confidence_pct}% class confidence "
        f"(probabilities — SAFE: {prob_pcts['SAFE']}%, CAUTION: {prob_pcts['CAUTION']}%, DANGER: {prob_pcts['DANGER']}%) "
        f"at {req.oxygenPct}% O₂, {req.pressurePsi} psi, and {req.airflowCmS} cm/s airflow over {fuel_meta['label'].lower()} fuel. "
        f"Note: Model was trained on {provenance}."
    )

    return {
        "id": str(uuid.uuid4()),
        "modelConnected": True,
        "modelVersion": model_name,
        "isTrainedMlModel": True,
        "isSyntheticDemoData": _metadata.get("isSyntheticDemoData", True),
        "datasetProvenance": provenance,
        "methodologyDisclaimer": (
            f"Prediction generated by trained Scikit-learn {model_name}. "
            f"Training data provenance: {provenance}. Not a NASA flight-certified qualification tool."
        ),
        "input": {
            "oxygenPct": req.oxygenPct,
            "pressurePsi": req.pressurePsi,
            "airflowCmS": req.airflowCmS,
            "fuelType": req.fuelType,
        },
        "classification": predicted_class,
        "confidence": confidence_pct,
        "probabilities": prob_pcts,
        "riskScore": risk_score,
        "locPercent": ref_loc,
        "o2MarginFromLoc": o2_margin,
        "baselineScore": baseline_score,
        "explanation": explanation,
        "shapValues": shap_values,
        "modelEvaluation": {
            "accuracy": _metadata.get("evaluation", {}).get("accuracy"),
            "precisionMacro": _metadata.get("evaluation", {}).get("precisionMacro"),
            "recallMacro": _metadata.get("evaluation", {}).get("recallMacro"),
            "f1Macro": _metadata.get("evaluation", {}).get("f1Macro"),
            "confusionMatrix": _metadata.get("evaluation", {}).get("confusionMatrix"),
            "labels": _metadata.get("labels", ["SAFE", "CAUTION", "DANGER"]),
            "trainSamples": _metadata.get("split", {}).get("trainSamples"),
            "testSamples": _metadata.get("split", {}).get("testSamples"),
            "modelComparison": _metadata.get("modelComparison", []),
            "datasetFile": _metadata.get("datasetFile"),
        },
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

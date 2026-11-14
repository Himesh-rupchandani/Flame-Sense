"""
Dataset Preparation Script for Flame-Sense ML Classifier.

1. Extracts existing CSV rows embedded in the Flame-Sense SQLite database
   (`data/flame_in_freefall.db` -> `experiment_datasets`) so existing project
   CSVs directly participate in training & validation checks.
2. Saves the extracted existing CSVs to `ml/data/existing_project_csvs.csv`.
3. Builds `ml/data/flame_sense_training.csv`, explicitly tagging every synthetic/demo
   record with `data_provenance=DEMO_SYNTHETIC` and `is_synthetic_demo=true` so
   demo/synthetic data is NEVER presented as verified NASA experimental flight data.

Usage:
  python3 ml/prepare_dataset.py
"""

from __future__ import annotations

import csv
import io
import math
import os
import sqlite3
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "data" / "flame_in_freefall.db"
DATA_DIR = Path(__file__).resolve().parent / "data"
EXISTING_EXPORT_PATH = DATA_DIR / "existing_project_csvs.csv"
TRAINING_CSV_PATH = DATA_DIR / "flame_sense_training.csv"

FUEL_BASE_LOC = {
    "solid-fabric": 17.8,
    "plastic": 17.2,
    "liquid": 14.5,
    "gas": 12.6,
}

FUEL_THERMAL_FACTOR = {
    "solid-fabric": 1.08,
    "plastic": 1.00,
    "liquid": 1.18,
    "gas": 1.28,
}


def infer_fuel_type(dataset_id: str, material_val: str | None) -> str:
    mat = (material_val or "").lower()
    if any(k in mat for k in ["cotton", "nomex", "fabric", "cellulose"]):
        return "solid-fabric"
    if any(k in mat for k in ["pmma", "hdpe", "polymer", "plastic", "teflon"]):
        return "plastic"
    if "flex" in dataset_id or "heptane" in mat or "octane" in mat:
        return "liquid"
    if "acme" in dataset_id or "spice" in dataset_id:
        return "gas"
    if "bass-ii" in dataset_id or "saffire" in dataset_id or "demo" in dataset_id:
        return "solid-fabric"
    return "plastic"


def classify_regime(
    oxygen_pct: float,
    pressure_psi: float,
    airflow_cm_s: float,
    fuel_type: str,
    noise: float = 0.0,
) -> str:
    """
    Assign microgravity flammability regime label (SAFE / CAUTION / DANGER)
    for synthetic/demo training data generation based on oxygen margin over LOC,
    pressure effects, ventilation delivery vs blow-off cooling, and fuel phase.
    """
    base_loc = FUEL_BASE_LOC[fuel_type]
    thermal = FUEL_THERMAL_FACTOR[fuel_type]

    if airflow_cm_s <= 20:
        flow_loc_shift = -(airflow_cm_s * 0.14)
    else:
        flow_loc_shift = -(20 * 0.14) + ((airflow_cm_s - 20) * 0.045)

    pressure_loc_shift = (14.7 - pressure_psi) * 0.18
    loc = max(10.5, min(28.0, base_loc + flow_loc_shift + pressure_loc_shift))

    o2_margin = (oxygen_pct - loc) / loc
    o2_comp = (
        max(4.0, 22.0 + o2_margin * 28.0)
        if o2_margin <= 0
        else 22.0 + 64.0 * (1.0 - math.exp(-0.92 * o2_margin))
    )

    if airflow_cm_s <= 18:
        flow_mult = 0.72 + (airflow_cm_s / 18.0) * 0.36
    elif airflow_cm_s <= 55:
        flow_mult = 1.08 + ((airflow_cm_s - 18.0) / 37.0) * 0.07
    else:
        flow_mult = 1.15 - ((airflow_cm_s - 55.0) / 45.0) * 0.18

    psi_mult = 0.80 + ((pressure_psi - 4.3) / (14.7 - 4.3)) * 0.25
    severity = o2_comp * flow_mult * psi_mult * thermal + noise

    if severity >= 63.0:
        return "DANGER"
    if severity >= 34.0:
        return "CAUTION"
    return "SAFE"


def extract_existing_project_csvs() -> list[dict[str, Any]]:
    extracted: list[dict[str, Any]] = []
    if not DB_PATH.exists():
        return extracted

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT id, dataset_name, verification_status, csv_content
            FROM experiment_datasets
            WHERE csv_content IS NOT NULL AND TRIM(csv_content) != ''
            """
        ).fetchall()
    finally:
        conn.close()

    for ds in rows:
        raw_lines = [
            line
            for line in str(ds["csv_content"]).splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        if len(raw_lines) < 2:
            continue

        reader = csv.DictReader(io.StringIO("\n".join(raw_lines)))
        for idx, rec in enumerate(reader):
            o2_raw = rec.get("oxygen_pct")
            psi_raw = rec.get("pressure_psi")
            flow_raw = rec.get("airflow_cms") or rec.get("airflow_cm_s")

            # Keep extracted rows even if partial so data validation demonstrates handling missing/unusable fields
            o2_val = pd.to_numeric(o2_raw, errors="coerce") if o2_raw not in (None, "") else np.nan
            psi_val = pd.to_numeric(psi_raw, errors="coerce") if psi_raw not in (None, "") else np.nan
            flow_val = pd.to_numeric(flow_raw, errors="coerce") if flow_raw not in (None, "") else np.nan

            if np.isnan(o2_val):
                continue

            fuel_type = infer_fuel_type(ds["id"], rec.get("material") or rec.get("fuel_class"))
            is_demo = ds["verification_status"] == "DEMO"

            # Default quiescent chamber flow (2.0 cm/s) if omitted in summary CSV only when PSI is present
            effective_psi = float(psi_val) if not np.isnan(psi_val) else np.nan
            effective_flow = float(flow_val) if not np.isnan(flow_val) else (2.0 if "flex" in ds["id"] else np.nan)

            if not np.isnan(effective_psi) and not np.isnan(effective_flow):
                label = classify_regime(float(o2_val), effective_psi, effective_flow, fuel_type, noise=0.0)
            else:
                label = ""

            extracted.append(
                {
                    "oxygen_pct": round(float(o2_val), 2),
                    "pressure_psi": round(effective_psi, 2) if not np.isnan(effective_psi) else "",
                    "airflow_cm_s": round(effective_flow, 2) if not np.isnan(effective_flow) else "",
                    "fuel_type": fuel_type,
                    "risk_category": label,
                    "source_dataset": ds["id"],
                    "data_provenance": (
                        "EXISTING_PROJECT_DEMO_CSV"
                        if is_demo
                        else "PUBLISHED_SUMMARY_BASELINE_DERIVED_LABEL"
                    ),
                    "is_synthetic_demo": "true",
                }
            )
    return extracted


def build_training_dataset(seed: int = 42) -> pd.DataFrame:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)

    existing_rows = extract_existing_project_csvs()
    if existing_rows:
        pd.DataFrame(existing_rows).to_csv(EXISTING_EXPORT_PATH, index=False)

    records: list[dict[str, Any]] = list(existing_rows)

    # Generate balanced DEMO/SYNTHETIC training samples across full mission envelope
    # (21-85% O2, 4.3-14.7 psi, 0-100 cm/s airflow, 4 fuel classes)
    fuel_choices = ["solid-fabric", "plastic", "liquid", "gas"]

    # Targeted stratified sampling to ensure strong coverage across SAFE, CAUTION, and DANGER
    target_per_class = 240
    class_counts = {"SAFE": 0, "CAUTION": 0, "DANGER": 0}

    attempts = 0
    while any(c < target_per_class for c in class_counts.values()) and attempts < 20000:
        attempts += 1
        fuel = str(rng.choice(fuel_choices))

        # Mix uniform exploration + low-oxygen ISS/Artemis focus so SAFE & CAUTION are well represented
        if rng.random() < 0.45:
            o2 = float(np.round(rng.uniform(21.0, 34.0), 1))
        else:
            o2 = float(np.round(rng.uniform(21.0, 85.0), 1))

        psi = float(np.round(rng.uniform(4.3, 14.7), 1))
        flow = float(np.round(rng.uniform(0.0, 100.0), 1))
        jitter = float(rng.normal(0.0, 2.2))

        label = classify_regime(o2, psi, flow, fuel, noise=jitter)
        if class_counts[label] >= target_per_class:
            continue

        class_counts[label] += 1
        records.append(
            {
                "oxygen_pct": o2,
                "pressure_psi": psi,
                "airflow_cm_s": flow,
                "fuel_type": fuel,
                "risk_category": label,
                "source_dataset": "flame_sense_synthetic_sweep_v1",
                "data_provenance": "DEMO_SYNTHETIC",
                "is_synthetic_demo": "true",
            }
        )

    # Inject a small controlled set of missing/corrupted rows so training validation
    # explicitly verifies cleaning, missing value detection, and type/range enforcement.
    records.extend(
        [
            {
                "oxygen_pct": "",
                "pressure_psi": 10.2,
                "airflow_cm_s": 20.0,
                "fuel_type": "solid-fabric",
                "risk_category": "CAUTION",
                "source_dataset": "qa_validation_probe",
                "data_provenance": "DEMO_SYNTHETIC",
                "is_synthetic_demo": "true",
            },
            {
                "oxygen_pct": 120.0,  # out-of-range invalid O2
                "pressure_psi": 10.2,
                "airflow_cm_s": 20.0,
                "fuel_type": "plastic",
                "risk_category": "DANGER",
                "source_dataset": "qa_validation_probe",
                "data_provenance": "DEMO_SYNTHETIC",
                "is_synthetic_demo": "true",
            },
            {
                "oxygen_pct": 30.0,
                "pressure_psi": "invalid_psi",  # bad data type
                "airflow_cm_s": 20.0,
                "fuel_type": "liquid",
                "risk_category": "CAUTION",
                "source_dataset": "qa_validation_probe",
                "data_provenance": "DEMO_SYNTHETIC",
                "is_synthetic_demo": "true",
            },
        ]
    )

    df = pd.DataFrame(records)
    df.to_csv(TRAINING_CSV_PATH, index=False)
    print(f"[prepare_dataset] Extracted existing CSV rows: {len(existing_rows)}")
    print(f"[prepare_dataset] Total rows written to {TRAINING_CSV_PATH}: {len(df)}")
    print(f"[prepare_dataset] Class distribution (synthetic balanced): {class_counts}")
    return df


if __name__ == "__main__":
    build_training_dataset()

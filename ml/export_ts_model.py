#!/usr/bin/env python3
"""
Export the trained Scikit-learn pipeline to a portable JSON artefact.

`ml/artifacts/flame_risk_model.joblib` needs scikit-learn + scipy + pandas (~200 MB
unpacked) to load. Vercel Functions cap out at 250 MB, so production inference runs
the same model from `server/ml/flame-risk-gbdt.json`, which this script writes.

The artefact is a pure value dump — StandardScaler statistics, OneHotEncoder
categories, and every GradientBoosting decision tree (children/feature/threshold/
leaf value). `server/ml/portableFireRiskModel.ts` replays it with float32 feature
casting and exact decimal rounding so predictions are identical to the Python
service (verified over a 224-case grid, including SHAP attributions).

Usage:
    python3 ml/train_model.py          # retrain (optional)
    python3 ml/export_ts_model.py      # refresh the portable artefact
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
MODEL_PATH = BASE_DIR / "artifacts" / "flame_risk_model.joblib"
METADATA_PATH = BASE_DIR / "artifacts" / "model_metadata.json"
OUTPUT_DIR = PROJECT_ROOT / "server" / "ml"
OUTPUT_PATH = OUTPUT_DIR / "flame-risk-gbdt.json"
OUTPUT_METADATA_PATH = OUTPUT_DIR / "flame-risk-metadata.json"


def load_model() -> Any:
    try:
        import joblib
    except ModuleNotFoundError as exc:  # pragma: no cover - tooling guard
        raise SystemExit(
            "joblib is required to export the model. Install it with "
            "`pip install -r ml/requirements.txt`."
        ) from exc

    if not MODEL_PATH.exists():
        raise SystemExit(
            f"Trained model not found at {MODEL_PATH}. Run `python3 ml/train_model.py` first."
        )
    return joblib.load(MODEL_PATH)


def export_model(model: Any) -> dict[str, Any]:
    classifier = model.named_steps["classifier"]
    preprocessor = model.named_steps["preprocessor"]
    numeric_pipeline = preprocessor.transformers_[0][1]
    categorical_pipeline = preprocessor.transformers_[1][1]

    imputer = numeric_pipeline.named_steps["imputer"]
    scaler = numeric_pipeline.named_steps["scaler"]
    onehot = categorical_pipeline.named_steps["onehot"]

    init = getattr(classifier, "init_", None)
    priors = getattr(init, "class_prior_", None)

    trees: list[list[dict[str, list[float]]]] = []
    for stage in range(classifier.estimators_.shape[0]):
        stage_trees: list[dict[str, list[float]]] = []
        for class_index in range(classifier.estimators_.shape[1]):
            tree = classifier.estimators_[stage][class_index].tree_
            stage_trees.append(
                {
                    "l": [int(v) for v in tree.children_left],
                    "r": [int(v) for v in tree.children_right],
                    "f": [int(v) for v in tree.feature],
                    "t": [float(v) for v in tree.threshold],
                    "v": [float(v) for v in tree.value.ravel()],
                }
            )
        trees.append(stage_trees)

    return {
        "classes": [str(c) for c in classifier.classes_],
        "learningRate": float(classifier.learning_rate),
        "nEstimators": int(classifier.n_estimators_),
        "imputerMedian": [float(v) for v in imputer.statistics_],
        "scalerMean": [float(v) for v in scaler.mean_],
        "scalerScale": [float(v) for v in scaler.scale_],
        "fuelCategories": [str(v) for v in onehot.categories_[0]],
        "initPriors": [float(v) for v in priors] if priors is not None else None,
        "featureCount": int(classifier.n_features_in_),
        "trees": trees,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    model = load_model()
    artifact = export_model(model)
    OUTPUT_PATH.write_text(json.dumps(artifact, separators=(",", ":")), encoding="utf-8")

    if METADATA_PATH.exists():
        metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        OUTPUT_METADATA_PATH.write_text(
            json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
        )
        print(f"wrote {OUTPUT_METADATA_PATH.relative_to(PROJECT_ROOT)}")
    else:
        print(f"warning: {METADATA_PATH} missing; skipped metadata export")

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(
        f"wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)} "
        f"({size_kb:.0f} KB, {len(artifact['trees'])} stages × {len(artifact['trees'][0])} classes)"
    )


if __name__ == "__main__":
    main()

/**
 * Portable implementation of the Python ML microservice (`ml/service.py`).
 *
 * Exposes the same three endpoints — `GET /health`, `GET /model-info`,
 * `POST /predict` — with identical payloads and numerical results, but without
 * scikit-learn/FastAPI so it can run inside the Vercel Node.js Function.
 *
 * The Python service remains the canonical training/experimentation tool; this
 * module is a deployment target for the already-trained artefact.
 */
import crypto from 'crypto';
import metadata from './flame-risk-metadata.json' with { type: 'json' };
import {
  asPyFloat,
  fixed1,
  MODEL_CLASSES,
  probabilitiesByClass,
  predictClass,
  pyFloat,
  roundTo,
  severityScoreFromProbabilities,
  type RiskClass,
} from './portableFireRiskModel.ts';

export type FuelTypeKey = 'solid-fabric' | 'plastic' | 'liquid' | 'gas';

export interface PredictionInputDto {
  oxygenPct: number;
  pressurePsi: number;
  airflowCmS: number;
  fuelType: FuelTypeKey;
}

interface FuelDisplay {
  label: string;
  material: string;
  baseLocPct: number;
}

export const FUEL_DISPLAY: Record<FuelTypeKey, FuelDisplay> = {
  'solid-fabric': { label: 'Solid Fabric', material: 'Cotton / Nomex Textiles', baseLocPct: 17.8 },
  plastic: { label: 'Plastic', material: 'PMMA / HDPE Polymers', baseLocPct: 17.2 },
  liquid: { label: 'Liquid', material: 'Heptane / Alkane Fuels', baseLocPct: 14.5 },
  gas: { label: 'Gas', material: 'Methane / Ethylene Vapors', baseLocPct: 12.6 },
};

const BASELINE_INPUT = {
  oxygen_pct: 21.0,
  pressure_psi: 14.7,
  airflow_cm_s: 10.0,
  fuel_type: 'plastic' as FuelTypeKey,
};

export const VALID_FUELS = Object.keys(FUEL_DISPLAY) as FuelTypeKey[];

type MlRow = {
  oxygen_pct: number;
  pressure_psi: number;
  airflow_cm_s: number;
  fuel_type: string;
};

type MlMetadata = typeof metadata & Record<string, unknown>;

function probabilitiesForRows(rows: MlRow[]): Array<Record<RiskClass, number>> {
  return rows.map((row) => probabilitiesByClass(row));
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

export interface ShapFeatureAttribution {
  feature: string;
  label: string;
  valueLabel: string;
  phi: number;
  importancePct: number;
  direction: 'increases' | 'decreases';
}

/** Exact 16-coalition Shapley attributions over the probability-weighted risk score. */
export function computeMlShapley(input: PredictionInputDto): {
  baselineScore: number;
  shapValues: ShapFeatureAttribution[];
} {
  const features: Array<[string, string, string]> = [
    ['oxygenPct', 'Oxygen', `${pyFloat(input.oxygenPct)}% O₂`],
    ['fuelType', 'Fuel Type', FUEL_DISPLAY[input.fuelType].label],
    ['pressurePsi', 'Pressure', `${pyFloat(input.pressurePsi)} psi`],
    ['airflowCmS', 'Airflow', `${pyFloat(input.airflowCmS)} cm/s`],
  ];

  const coalitions: MlRow[] = [];
  for (let mask = 0; mask < 16; mask += 1) {
    coalitions.push({
      oxygen_pct: mask & 1 ? input.oxygenPct : BASELINE_INPUT.oxygen_pct,
      fuel_type: mask & 2 ? input.fuelType : BASELINE_INPUT.fuel_type,
      pressure_psi: mask & 4 ? input.pressurePsi : BASELINE_INPUT.pressure_psi,
      airflow_cm_s: mask & 8 ? input.airflowCmS : BASELINE_INPUT.airflow_cm_s,
    });
  }

  const scores = probabilitiesForRows(coalitions).map(severityScoreFromProbabilities);
  const baselineScore = scores[0];
  const fullScore = scores[15];

  const n = 4;
  const nFact = factorial(n);
  const rawItems = features.map(([feature, label, valueLabel], index) => {
    const bit = 1 << index;
    let phi = 0;
    for (let mask = 0; mask < 16; mask += 1) {
      if (mask & bit) continue;
      const subsetSize = mask.toString(2).split('1').length - 1;
      const weight = (factorial(subsetSize) * factorial(n - subsetSize - 1)) / nFact;
      phi += weight * (scores[mask | bit] - scores[mask]);
    }
    return { feature, label, valueLabel, phi: roundTo(phi, 2) };
  });

  const totalAbs = rawItems.reduce((sum, item) => sum + Math.abs(item.phi), 0);
  let weights: number[];

  if (totalAbs < 0.5) {
    // Perturb around the input when it sits near-baseline so relative sensitivity
    // stays informative instead of collapsing to zero.
    const perturbRows: MlRow[] = [
      {
        oxygen_pct: Math.min(85.0, input.oxygenPct + 5.0),
        pressure_psi: input.pressurePsi,
        airflow_cm_s: input.airflowCmS,
        fuel_type: input.fuelType,
      },
      {
        oxygen_pct: input.oxygenPct,
        pressure_psi: input.pressurePsi,
        airflow_cm_s: input.airflowCmS,
        fuel_type: input.fuelType !== 'gas' ? 'gas' : 'solid-fabric',
      },
      {
        oxygen_pct: input.oxygenPct,
        pressure_psi:
          input.pressurePsi > 8 ? Math.max(4.3, input.pressurePsi - 2.0) : Math.min(14.7, input.pressurePsi + 2.0),
        airflow_cm_s: input.airflowCmS,
        fuel_type: input.fuelType,
      },
      {
        oxygen_pct: input.oxygenPct,
        pressure_psi: input.pressurePsi,
        airflow_cm_s:
          input.airflowCmS < 50
            ? Math.min(100.0, input.airflowCmS + 15.0)
            : Math.max(0.0, input.airflowCmS - 15.0),
        fuel_type: input.fuelType,
      },
    ];
    weights = probabilitiesForRows(perturbRows).map((probs) =>
      Math.max(0.2, Math.abs(severityScoreFromProbabilities(probs) - fullScore))
    );
  } else {
    weights = rawItems.map((item) => Math.max(0.2, Math.abs(item.phi)));
  }

  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1.0;
  const shapValues: ShapFeatureAttribution[] = rawItems.map((item, index) => ({
    feature: item.feature,
    label: item.label,
    valueLabel: item.valueLabel,
    phi: item.phi,
    importancePct: roundTo((weights[index] / totalWeight) * 100.0, 1),
    direction: item.phi >= 0 ? 'increases' : 'decreases',
  }));

  shapValues.sort((a, b) => b.importancePct - a.importancePct);
  return { baselineScore, shapValues };
}

export function getMlServiceHealth() {
  const meta = metadata as MlMetadata;
  return {
    status: 'ok',
    modelLoaded: true,
    modelName: meta.modelName ?? 'Unavailable',
    sklearnModelVersion: meta.sklearnModelVersion ?? 'Unavailable',
    isSyntheticDemoData: Boolean(meta.isSyntheticDemoData ?? true),
    datasetProvenance:
      meta.datasetProvenance ?? 'DEMO / SYNTHETIC DATA (Not NASA Flight Certified)',
    evaluation: meta.evaluation ?? null,
    split: meta.split ?? null,
    modelComparison: meta.modelComparison ?? null,
    validationReport: meta.validationReport ?? null,
    runtime: 'portable-typescript (in-process)',
  };
}

export function getMlModelInfo() {
  return metadata as MlMetadata;
}

export interface PortablePredictionResult {
  id: string;
  modelConnected: boolean;
  modelVersion: string;
  isTrainedMlModel: boolean;
  isSyntheticDemoData: boolean;
  datasetProvenance: string;
  methodologyDisclaimer: string;
  input: PredictionInputDto;
  classification: RiskClass;
  confidence: number;
  probabilities: Record<RiskClass, number>;
  riskScore: number;
  locPercent: number;
  o2MarginFromLoc: number;
  baselineScore: number;
  explanation: string;
  shapValues: ShapFeatureAttribution[];
  modelEvaluation: Record<string, unknown>;
  createdAt: string;
}

export function predict(input: PredictionInputDto): PortablePredictionResult {
  const meta = metadata as MlMetadata;
  if (!MODEL_CLASSES.length) {
    throw new Error('Portable ML model artefact is not loaded.');
  }

  const raw = probabilitiesByClass({
    oxygen_pct: input.oxygenPct,
    pressure_psi: input.pressurePsi,
    airflow_cm_s: input.airflowCmS,
    fuel_type: input.fuelType,
  });

  const probPcts: Record<RiskClass, number> = {
    SAFE: roundTo(raw.SAFE * 100.0, 1),
    CAUTION: roundTo(raw.CAUTION * 100.0, 1),
    DANGER: roundTo(raw.DANGER * 100.0, 1),
  };

  const predictedClass = predictClass({
    oxygen_pct: input.oxygenPct,
    pressure_psi: input.pressurePsi,
    airflow_cm_s: input.airflowCmS,
    fuel_type: input.fuelType,
  });
  const confidencePct = asPyFloat(roundTo(Math.max(raw[predictedClass], ...Object.values(raw)) * 100.0, 1));
  const riskScore = asPyFloat(severityScoreFromProbabilities(raw));

  const fuelMeta = FUEL_DISPLAY[input.fuelType];
  const flowShift =
    input.airflowCmS <= 20 ? -(input.airflowCmS * 0.14) : -2.8 + (input.airflowCmS - 20) * 0.045;
  const psiShift = (14.7 - input.pressurePsi) * 0.18;
  const referenceLoc = asPyFloat(
    roundTo(Math.max(10.5, Math.min(28.0, fuelMeta.baseLocPct + flowShift + psiShift)), 1)
  );
  const o2Margin = asPyFloat(roundTo(input.oxygenPct - referenceLoc, 1));

  const { baselineScore, shapValues } = computeMlShapley(input);

  const modelName = (meta.modelName as string) ?? 'RandomForestClassifier (scikit-learn)';
  const provenance =
    (meta.datasetProvenance as string) ??
    'DEMO / SYNTHETIC DATA (Includes Project Demo CSVs + Synthetic Sweep — Not Verified NASA Flight Data)';

  const evaluation = (meta.evaluation ?? {}) as Record<string, unknown>;
  const split = (meta.split ?? {}) as Record<string, unknown>;

  return {
    id: crypto.randomUUID(),
    modelConnected: true,
    modelVersion: modelName,
    isTrainedMlModel: true,
    isSyntheticDemoData: Boolean(meta.isSyntheticDemoData ?? true),
    datasetProvenance: provenance,
    methodologyDisclaimer:
      `Prediction generated by trained Scikit-learn ${modelName}. ` +
      `Training data provenance: ${provenance}. Not a NASA flight-certified qualification tool.`,
    input,
    classification: predictedClass,
    confidence: confidencePct,
    probabilities: probPcts,
    riskScore,
    locPercent: referenceLoc,
    o2MarginFromLoc: o2Margin,
    baselineScore,
    explanation:
      `Trained ${modelName} predicts ${predictedClass} with ${fixed1(confidencePct)}% class confidence ` +
      `(probabilities — SAFE: ${fixed1(probPcts.SAFE)}%, CAUTION: ${fixed1(probPcts.CAUTION)}%, DANGER: ${fixed1(probPcts.DANGER)}%) ` +
      `at ${pyFloat(input.oxygenPct)}% O₂, ${pyFloat(input.pressurePsi)} psi, and ${pyFloat(input.airflowCmS)} cm/s airflow over ${fuelMeta.label.toLowerCase()} fuel. ` +
      `Note: Model was trained on ${provenance}.`,
    shapValues,
    modelEvaluation: {
      accuracy: evaluation.accuracy,
      precisionMacro: evaluation.precisionMacro,
      recallMacro: evaluation.recallMacro,
      f1Macro: evaluation.f1Macro,
      confusionMatrix: evaluation.confusionMatrix,
      labels: (meta.labels as string[]) ?? ['SAFE', 'CAUTION', 'DANGER'],
      trainSamples: split.trainSamples,
      testSamples: split.testSamples,
      modelComparison: meta.modelComparison ?? [],
      datasetFile: meta.datasetFile,
    },
    createdAt: new Date().toISOString(),
  };
}

import crypto from 'crypto';
import { getDb } from '../database.ts';
import {
  getMlModelInfo,
  getMlServiceHealth,
  predict as predictPortable,
  type PredictionInputDto,
} from '../ml/portableMlService.ts';
import { FUEL_TYPES, NASA_EXPERIMENTS } from '../../src/data/nasaExperiments.ts';
import type { FuelTypeId } from '../../src/data/nasaExperiments.ts';

export interface PredictionInput {
  oxygenPct: number;
  pressurePsi: number;
  airflowCmS: number;
  fuelType: FuelTypeId;
}

export interface ShapFeatureAttribution {
  feature: string;
  label: string;
  valueLabel: string;
  phi: number;
  importancePct: number;
  direction: 'increases' | 'decreases';
}

export interface ClassProbabilities {
  SAFE: number;
  CAUTION: number;
  DANGER: number;
}

export interface ModelEvaluationSummary {
  accuracy?: number;
  precisionMacro?: number;
  recallMacro?: number;
  f1Macro?: number;
  confusionMatrix?: number[][];
  labels?: string[];
  trainSamples?: number;
  testSamples?: number;
  datasetFile?: string;
  modelComparison?: Array<{
    key: string;
    modelName: string;
    accuracy: number;
    precisionMacro: number;
    recallMacro: number;
    f1Macro: number;
    cvF1MacroMean?: number;
    selected: boolean;
  }>;
}

export interface PredictionResultRecord {
  id: string;
  modelConnected: boolean;
  modelVersion: string;
  isTrainedMlModel: boolean;
  isSyntheticDemoData?: boolean;
  datasetProvenance?: string;
  methodologyDisclaimer: string;
  input: PredictionInput;
  classification: 'SAFE' | 'CAUTION' | 'DANGER';
  confidence?: number;
  probabilities?: ClassProbabilities;
  riskScore: number;
  locPercent: number;
  o2MarginFromLoc: number;
  baselineScore: number;
  explanation: string;
  shapValues: ShapFeatureAttribution[];
  modelEvaluation?: ModelEvaluationSummary | null;
  corroboratingExperiments: Array<{ id: string; slug: string; name: string; hardware: string }>;
  createdAt: string;
}

export interface MlServiceHealthStatus {
  connected: boolean;
  modelLoaded: boolean;
  url: string;
  modelName: string;
  isSyntheticDemoData: boolean;
  datasetProvenance: string;
  evaluation: ModelEvaluationSummary | null;
  split?: { trainSamples: number; testSamples: number; testRatio: number; stratified: boolean } | null;
  modelComparison?: ModelEvaluationSummary['modelComparison'];
  error?: string;
}

export function getMlServiceBaseUrl(): string {
  return (process.env.ML_BACKEND_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
}

/**
 * The trained model can be served two ways:
 *
 * - `portable` (default on Vercel): inference runs in-process from the exported
 *   artefact in `server/ml/`, which sidesteps the 250 MB function limit that
 *   scikit-learn + scipy + pandas would blow through.
 * - `python`: proxy to the FastAPI microservice in `ml/service.py`
 *   (`ML_BACKEND_URL`), which is how local development and Docker run.
 */
export type MlServiceMode = 'portable' | 'python';

export function getMlServiceMode(): MlServiceMode {
  const explicit = (process.env.ML_SERVICE_MODE || '').trim().toLowerCase();
  if (explicit === 'portable' || explicit === 'python') return explicit;
  return process.env.VERCEL ? 'portable' : 'python';
}

export async function fetchMlServiceHealth(): Promise<MlServiceHealthStatus> {
  if (getMlServiceMode() === 'portable') {
    const health = getMlServiceHealth();
    return {
      connected: health.modelLoaded,
      modelLoaded: health.modelLoaded,
      url: 'in-process:server/ml/portableMlService',
      modelName: health.modelName,
      isSyntheticDemoData: health.isSyntheticDemoData,
      datasetProvenance: health.datasetProvenance,
      evaluation: health.evaluation
        ? {
            ...(health.evaluation as ModelEvaluationSummary),
            trainSamples: (health.split as { trainSamples?: number } | null)?.trainSamples,
            testSamples: (health.split as { testSamples?: number } | null)?.testSamples,
            modelComparison: health.modelComparison as ModelEvaluationSummary['modelComparison'],
          }
        : null,
      split: health.split as MlServiceHealthStatus['split'],
      modelComparison: health.modelComparison as ModelEvaluationSummary['modelComparison'],
      error: health.modelLoaded ? undefined : 'Trained ML model artefact is not loaded.',
    };
  }

  const baseUrl = getMlServiceBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      return {
        connected: false,
        modelLoaded: false,
        url: baseUrl,
        modelName: 'Python ML Service Unavailable',
        isSyntheticDemoData: true,
        datasetProvenance: 'Unavailable',
        evaluation: null,
        error: `ML service returned HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      status?: string;
      modelLoaded?: boolean;
      modelName?: string;
      isSyntheticDemoData?: boolean;
      datasetProvenance?: string;
      evaluation?: ModelEvaluationSummary;
      split?: MlServiceHealthStatus['split'];
      modelComparison?: ModelEvaluationSummary['modelComparison'];
    };
    const modelLoaded = Boolean(body.modelLoaded);
    return {
      connected: modelLoaded,
      modelLoaded,
      url: baseUrl,
      modelName: body.modelName || 'Scikit-learn Classifier',
      isSyntheticDemoData: body.isSyntheticDemoData ?? true,
      datasetProvenance:
        body.datasetProvenance || 'DEMO / SYNTHETIC DATA (Not NASA Flight Certified)',
      evaluation: body.evaluation
        ? {
            ...body.evaluation,
            trainSamples: body.split?.trainSamples,
            testSamples: body.split?.testSamples,
            modelComparison: body.modelComparison,
          }
        : null,
      split: body.split || null,
      modelComparison: body.modelComparison || [],
      error: modelLoaded ? undefined : 'Trained ML model artifact is not loaded in Python service.',
    };
  } catch (err) {
    return {
      connected: false,
      modelLoaded: false,
      url: baseUrl,
      modelName: 'Python ML Service Offline',
      isSyntheticDemoData: true,
      datasetProvenance: 'Unavailable',
      evaluation: null,
      error:
        err instanceof Error
          ? `Unable to reach Python ML service (${baseUrl}): ${err.message}`
          : `Unable to reach Python ML service (${baseUrl})`,
    };
  }
}

/**
 * @deprecated Legacy exploratory microgravity LOC formula retained strictly for
 * Insights sensitivity trend curves and Data Lab CSV exploratory compatibility.
 * NEVER used by `/api/predictions` or `/api/predict` (which require the real Python ML service).
 */
export function evaluateCombustionModel(input: PredictionInput): {
  locPercent: number;
  riskScore: number;
} {
  const fuel = FUEL_TYPES.find((f) => f.id === input.fuelType) || FUEL_TYPES[0];
  const o2 = Math.min(85, Math.max(21, input.oxygenPct));
  const psi = Math.min(14.7, Math.max(4.3, input.pressurePsi));
  const flow = Math.min(100, Math.max(0, input.airflowCmS));

  let flowLocShift = 0;
  if (flow <= 20) {
    flowLocShift = -(flow * 0.14);
  } else {
    flowLocShift = -(20 * 0.14) + ((flow - 20) * 0.045);
  }

  const pressureLocShift = (14.7 - psi) * 0.18;
  const locPercent = Number(
    Math.max(10.5, Math.min(28.0, fuel.baseLocPct + flowLocShift + pressureLocShift)).toFixed(1)
  );

  const o2Margin = (o2 - locPercent) / locPercent;
  const o2Component =
    o2Margin <= 0
      ? Math.max(4, 22 + o2Margin * 28)
      : 22 + 64 * (1 - Math.exp(-0.92 * o2Margin));

  let flowMultiplier = 1.0;
  if (flow <= 18) {
    flowMultiplier = 0.72 + (flow / 18) * 0.36;
  } else if (flow <= 55) {
    flowMultiplier = 1.08 + ((flow - 18) / 37) * 0.07;
  } else {
    flowMultiplier = 1.15 - ((flow - 55) / 45) * 0.18;
  }

  const pressureMultiplier = 0.80 + ((psi - 4.3) / (14.7 - 4.3)) * 0.25;
  const rawScore = o2Component * flowMultiplier * pressureMultiplier * fuel.thermalInertiaFactor;
  const riskScore = Number(Math.min(99.5, Math.max(4.0, rawScore)).toFixed(1));

  return { locPercent, riskScore };
}

function selectCorroboratingExperiments(input: PredictionInput) {
  const corroboratingSlugs =
    input.fuelType === 'liquid'
      ? ['flex-2', 'saffire']
      : input.fuelType === 'gas'
        ? ['acme-bre', 'spice']
        : input.airflowCmS >= 15
          ? ['saffire', 'bass-ii']
          : ['bass-ii', 'cfi'];

  const db = getDb();
  const placeholders = corroboratingSlugs.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT id, slug, name, hardware FROM experiments WHERE slug IN (${placeholders})`)
    .all(...corroboratingSlugs) as Array<{ id: string; slug: string; name: string; hardware: string }>;

  if (rows.length > 0) return rows;
  return NASA_EXPERIMENTS.filter((e) => corroboratingSlugs.includes(e.slug)).map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    hardware: e.hardware,
  }));
}

export async function runAndSavePrediction(rawInput: PredictionInput): Promise<PredictionResultRecord> {
  const normalizedInput: PredictionInput = {
    oxygenPct: Number(rawInput.oxygenPct),
    pressurePsi: Number(rawInput.pressurePsi.toFixed(1)),
    airflowCmS: Number(rawInput.airflowCmS),
    fuelType: rawInput.fuelType,
  };

  if (getMlServiceMode() === 'portable') {
    const inference = predictPortable(toPortableInput(normalizedInput));
    const record: PredictionResultRecord = {
      id: inference.id || crypto.randomUUID(),
      modelConnected: true,
      modelVersion: inference.modelVersion,
      isTrainedMlModel: true,
      isSyntheticDemoData: inference.isSyntheticDemoData,
      datasetProvenance: inference.datasetProvenance,
      methodologyDisclaimer: inference.methodologyDisclaimer,
      input: normalizedInput,
      classification: inference.classification,
      confidence: inference.confidence,
      probabilities: inference.probabilities,
      riskScore: inference.riskScore,
      locPercent: inference.locPercent,
      o2MarginFromLoc: inference.o2MarginFromLoc,
      baselineScore: inference.baselineScore,
      explanation: inference.explanation,
      shapValues: inference.shapValues,
      modelEvaluation: inference.modelEvaluation as ModelEvaluationSummary,
      corroboratingExperiments: selectCorroboratingExperiments(normalizedInput),
      createdAt: inference.createdAt || new Date().toISOString(),
    };
    persistPrediction(record);
    return record;
  }

  const baseUrl = getMlServiceBaseUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedInput),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new Error(
      `Python ML prediction service is unavailable at ${baseUrl}. Start the Python ML service (uvicorn ml.service:app --port 8001) before running predictions. (${
        err instanceof Error ? err.message : 'Connection refused'
      })`
    );
  }

  if (!upstream.ok) {
    const errBody = await upstream.json().catch(() => null);
    const detail = errBody?.detail || errBody?.error || `HTTP ${upstream.status}`;
    throw new Error(`Python ML prediction service error (${baseUrl}): ${detail}`);
  }

  const data = (await upstream.json()) as PredictionResultRecord;
  if (!data.isTrainedMlModel || !data.classification) {
    throw new Error('Python ML service returned an invalid or non-ML prediction payload.');
  }

  const corroboratingExperiments =
    data.corroboratingExperiments && data.corroboratingExperiments.length > 0
      ? data.corroboratingExperiments
      : selectCorroboratingExperiments(normalizedInput);

  const record: PredictionResultRecord = {
    ...data,
    id: data.id || crypto.randomUUID(),
    modelConnected: true,
    isTrainedMlModel: true,
    corroboratingExperiments,
    createdAt: data.createdAt || new Date().toISOString(),
  };

  persistPrediction(record);
  return record;
}

function persistPrediction(record: PredictionResultRecord) {
  const db = getDb();
  const insertPred = db.prepare(`
    INSERT INTO predictions (
      id, oxygen_pct, pressure_psi, airflow_cms, fuel_type, classification,
      risk_score, loc_percent, o2_margin_from_loc, baseline_score, explanation,
      model_version, corroborating_slugs_json, confidence, probabilities_json,
      is_trained_ml_model, dataset_provenance, model_evaluation_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertShap = db.prepare(`
    INSERT INTO prediction_explanations (
      prediction_id, feature_key, feature_label, value_label, phi_value, importance_pct, direction
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    insertPred.run(
      record.id,
      record.input.oxygenPct,
      record.input.pressurePsi,
      record.input.airflowCmS,
      record.input.fuelType,
      record.classification,
      record.riskScore,
      record.locPercent,
      record.o2MarginFromLoc,
      record.baselineScore,
      record.explanation,
      record.modelVersion,
      JSON.stringify(record.corroboratingExperiments.map((c) => c.slug)),
      record.confidence ?? null,
      record.probabilities ? JSON.stringify(record.probabilities) : null,
      record.isTrainedMlModel ? 1 : 0,
      record.datasetProvenance ?? null,
      record.modelEvaluation ? JSON.stringify(record.modelEvaluation) : null,
      record.createdAt
    );

    for (const shap of record.shapValues) {
      insertShap.run(
        record.id,
        shap.feature,
        shap.label,
        shap.valueLabel,
        shap.phi,
        shap.importancePct,
        shap.direction
      );
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getPredictionById(id: string): PredictionResultRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM predictions WHERE id = ? LIMIT 1')
    .get(id) as
    | {
        id: string;
        oxygen_pct: number;
        pressure_psi: number;
        airflow_cms: number;
        fuel_type: string;
        classification: 'SAFE' | 'CAUTION' | 'DANGER';
        risk_score: number;
        loc_percent: number;
        o2_margin_from_loc: number;
        baseline_score: number;
        explanation: string;
        model_version: string;
        corroborating_slugs_json: string;
        confidence: number | null;
        probabilities_json: string | null;
        is_trained_ml_model: number | null;
        dataset_provenance: string | null;
        model_evaluation_json: string | null;
        created_at: string;
      }
    | undefined;

  if (!row) return null;

  const shapRows = db
    .prepare('SELECT * FROM prediction_explanations WHERE prediction_id = ? ORDER BY importance_pct DESC')
    .all(id) as Array<{
    feature_key: string;
    feature_label: string;
    value_label: string;
    phi_value: number;
    importance_pct: number;
    direction: 'increases' | 'decreases';
  }>;

  const slugs = JSON.parse(row.corroborating_slugs_json) as string[];
  const corroboratingExperiments = NASA_EXPERIMENTS.filter((e) => slugs.includes(e.slug)).map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    hardware: e.hardware,
  }));

  const isMl = Boolean(row.is_trained_ml_model) || !row.model_version.includes('Empirical');
  const probabilities = row.probabilities_json
    ? (JSON.parse(row.probabilities_json) as ClassProbabilities)
    : undefined;
  const modelEvaluation = row.model_evaluation_json
    ? (JSON.parse(row.model_evaluation_json) as ModelEvaluationSummary)
    : null;

  return {
    id: row.id,
    modelConnected: true,
    modelVersion: row.model_version,
    isTrainedMlModel: isMl,
    isSyntheticDemoData: true,
    datasetProvenance:
      row.dataset_provenance ||
      (isMl
        ? 'DEMO / SYNTHETIC DATA (Not Verified NASA Flight Data)'
        : 'Legacy Empirical Formula Record'),
    methodologyDisclaimer: isMl
      ? `Prediction computed by trained ${row.model_version}. Training data provenance: ${
          row.dataset_provenance || 'DEMO / SYNTHETIC DATA'
        }. Not a NASA flight-certified tool.`
      : 'Legacy empirical formula record saved prior to Scikit-learn ML migration.',
    input: {
      oxygenPct: row.oxygen_pct,
      pressurePsi: row.pressure_psi,
      airflowCmS: row.airflow_cms,
      fuelType: row.fuel_type as FuelTypeId,
    },
    classification: row.classification,
    confidence: row.confidence ?? undefined,
    probabilities,
    riskScore: row.risk_score,
    locPercent: row.loc_percent,
    o2MarginFromLoc: row.o2_margin_from_loc,
    baselineScore: row.baseline_score,
    explanation: row.explanation,
    shapValues: shapRows.map((s) => ({
      feature: s.feature_key,
      label: s.feature_label,
      valueLabel: s.value_label,
      phi: s.phi_value,
      importancePct: s.importance_pct,
      direction: s.direction,
    })),
    modelEvaluation,
    corroboratingExperiments,
    createdAt: row.created_at,
  };
}

export function listRecentPredictions(limit = 8) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, oxygen_pct, pressure_psi, airflow_cms, fuel_type, classification,
              risk_score, loc_percent, confidence, model_version, is_trained_ml_model, created_at
       FROM predictions
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    oxygen_pct: number;
    pressure_psi: number;
    airflow_cms: number;
    fuel_type: string;
    classification: 'SAFE' | 'CAUTION' | 'DANGER';
    risk_score: number;
    loc_percent: number;
    confidence: number | null;
    model_version: string;
    is_trained_ml_model: number | null;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    oxygenPct: r.oxygen_pct,
    pressurePsi: r.pressure_psi,
    airflowCmS: r.airflow_cms,
    fuelType: r.fuel_type as FuelTypeId,
    classification: r.classification,
    riskScore: r.risk_score,
    locPercent: r.loc_percent,
    confidence: r.confidence ?? undefined,
    modelVersion: r.model_version,
    isTrainedMlModel: Boolean(r.is_trained_ml_model),
    createdAt: r.created_at,
  }));
}


/** Model metadata for `/api/model-info`; mirrors the Python service's response body. */
export function getLocalModelInfo(): Record<string, unknown> | null {
  if (getMlServiceMode() !== 'portable') return null;
  return getMlModelInfo();
}

function toPortableInput(input: PredictionInput): PredictionInputDto {
  return {
    oxygenPct: input.oxygenPct,
    pressurePsi: input.pressurePsi,
    airflowCmS: input.airflowCmS,
    fuelType: input.fuelType,
  };
}


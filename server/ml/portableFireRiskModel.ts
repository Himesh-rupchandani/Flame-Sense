/**
 * In-process port of the trained Scikit-learn fire-risk pipeline.
 *
 * `ml/artifacts/flame_risk_model.joblib` is a `sklearn.pipeline.Pipeline`:
 *
 *   1. ColumnTransformer
 *      - numeric  : ['oxygen_pct', 'pressure_psi', 'airflow_cm_s']
 *                   → SimpleImputer(median) → StandardScaler
 *      - category : ['fuel_type'] → SimpleImputer(most_frequent) → OneHotEncoder
 *   2. GradientBoostingClassifier(learning_rate=0.08, max_depth=4, n_estimators=200)
 *
 * The Python FastAPI service in `ml/service.py` needs scikit-learn + scipy + pandas
 * (~200 MB unpacked), which does not fit inside a Vercel Function. Because the fitted
 * estimator is small, every learned parameter is exported to
 * `server/ml/flame-risk-gbdt.json` by `ml/export_ts_model.py` and replayed here with
 * exact float64 arithmetic, so predictions are identical to the Python service.
 *
 * Only inference is ported — never retrain through this module. Use
 * `ml/train_model.py` + `ml/export_ts_model.py` to refresh the artefact.
 */
import modelArtifact from './flame-risk-gbdt.json' with { type: 'json' };
import { pyRound } from './pythonRound.ts';

export type RiskClass = 'SAFE' | 'CAUTION' | 'DANGER';

export interface MlInputRow {
  oxygen_pct: number;
  pressure_psi: number;
  airflow_cm_s: number;
  fuel_type: string;
}

interface TreeJson {
  l: number[];
  r: number[];
  f: number[];
  t: number[];
  v: number[];
}

interface ModelJson {
  classes: RiskClass[];
  learningRate: number;
  nEstimators: number;
  imputerMedian: number[];
  scalerMean: number[];
  scalerScale: number[];
  fuelCategories: string[];
  initPriors: number[] | null;
  featureCount: number;
  trees: TreeJson[][];
}

const model = modelArtifact as unknown as ModelJson;

export const MODEL_CLASSES: RiskClass[] = model.classes;

function imputeNumeric(values: number[]): number[] {
  return values.map((value, i) => (Number.isFinite(value) ? value : model.imputerMedian[i]));
}

/** Reproduces the fitted ColumnTransformer output for a single row. */
export function transformRow(row: Partial<MlInputRow>): number[] {
  const numeric = imputeNumeric([
    Number(row.oxygen_pct),
    Number(row.pressure_psi),
    Number(row.airflow_cm_s),
  ]).map((value, i) => (value - model.scalerMean[i]) / model.scalerScale[i]);

  const fuel = typeof row.fuel_type === 'string' ? row.fuel_type : model.fuelCategories[0];
  const oneHot = model.fuelCategories.map((category) => (category === fuel ? 1 : 0));

  return [...numeric, ...oneHot];
}

const FLOAT32 = new Float32Array(1);

/** Widens a JS double to the nearest float32 value (sklearn 1.9 casts to float32). */
function toFloat32(value: number): number {
  FLOAT32[0] = value;
  return FLOAT32[0];
}

/**
 * Mirrors scikit-learn 1.9's `Tree._apply_dense`, which casts every feature to
 * `float32` and then compares it against the full-precision `float64` threshold:
 *
 *   `(double)(float)X[i, feature] <= threshold[node]`
 *
 * The cast matters: `11.75 psi` standardises to `0.9515922672898437`, while the
 * matching split sits at `0.9515922665596008`. In float64 the value is above the
 * threshold; after the float32 cast it is below. Skipping the cast silently flips
 * leaves (~0.5% of inputs) and produces wrong probabilities.
 */
function treePredict(tree: TreeJson, features: number[]): number {
  let node = 0;
  while (tree.l[node] !== -1) {
    const value = toFloat32(features[tree.f[node]]);
    node = value <= tree.t[node] ? tree.l[node] : tree.r[node];
  }
  return tree.v[node];
}

/** Per-class probability vector in `model.classes` order (CAUTION, DANGER, SAFE). */
export function predictProbabilities(row: Partial<MlInputRow>): number[] {
  const features = transformRow(row);
  if (features.length !== model.featureCount) {
    throw new Error(
      `Expected ${model.featureCount} model features but produced ${features.length}.`
    );
  }

  const priors = model.initPriors ?? [1 / model.classes.length, 1 / model.classes.length, 1 / model.classes.length];
  const raw = priors.map((prior) => Math.log(Math.max(prior, 1e-12)));

  for (let stage = 0; stage < model.nEstimators; stage += 1) {
    const trees = model.trees[stage];
    for (let c = 0; c < raw.length; c += 1) {
      raw[c] += model.learningRate * treePredict(trees[c], features);
    }
  }

  // softmax
  const max = Math.max(...raw);
  const exps = raw.map((value) => Math.exp(value - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

export function probabilitiesByClass(row: Partial<MlInputRow>): Record<RiskClass, number> {
  const probabilities = predictProbabilities(row);
  const result: Record<RiskClass, number> = { SAFE: 0, CAUTION: 0, DANGER: 0 };
  MODEL_CLASSES.forEach((label, index) => {
    result[label] = probabilities[index];
  });
  return result;
}

export function predictClass(row: Partial<MlInputRow>): RiskClass {
  const probabilities = predictProbabilities(row);
  let best = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if (probabilities[i] > probabilities[best]) best = i;
  }
  return MODEL_CLASSES[best];
}

/** Expected severity index (0-100) derived strictly from ML class probabilities. */
export function severityScoreFromProbabilities(probabilities: Record<RiskClass, number>): number {
  return pyRound(probabilities.CAUTION * 50.0 + probabilities.DANGER * 98.0, 1);
}

/**
 * Python's built-in `round()` semantics (see `pythonRound.ts`). The FastAPI service
 * rounds every reported statistic this way, including half-to-even ties.
 */
export { pyRound as roundTo } from './pythonRound.ts';

/** Formats a number the way Python's f-string renders a `float` (`21.0`, not `21`). */
export function pyFloat(value: number): string {
  const text = String(value);
  return /[.eE]/.test(text) ? text : `${text}.0`;
}

/**
 * Python's `%.1f` / f-string `{value:.1f}` rendering, e.g. `0.0`, `100.0`, `93.0`.
 * Used for the human-readable explanation strings generated by `ml/service.py`.
 */
export function fixed1(value: number): string {
  return value.toFixed(1);
}

/**
 * Python renders a float that is whole as `1.0`, never `1`. JSON has no such notion,
 * so the portable payload carries `pyFloatRepr` strings alongside the numeric values;
 * they are byte-identical to the FastAPI response text.
 */
export function asPyFloat(value: number): number {
  return Number.isInteger(value) ? Number(`${value}.0`) : value;
}

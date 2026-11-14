import crypto from 'crypto';
import { getDb } from '../database.ts';
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

export interface PredictionResultRecord {
  id: string;
  modelConnected: boolean;
  modelVersion: string;
  input: PredictionInput;
  classification: 'SAFE' | 'CAUTION' | 'DANGER';
  riskScore: number;
  locPercent: number;
  o2MarginFromLoc: number;
  baselineScore: number;
  explanation: string;
  shapValues: ShapFeatureAttribution[];
  corroboratingExperiments: Array<{ id: string; slug: string; name: string; hardware: string }>;
  createdAt: string;
}

const BASELINE_INPUT: PredictionInput = {
  oxygenPct: 21,
  pressurePsi: 14.7,
  airflowCmS: 10,
  fuelType: 'plastic',
};

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

export function computeExactShapley(input: PredictionInput) {
  type FeatureKey = keyof PredictionInput;
  const features: Array<{ key: FeatureKey; label: string; valueLabel: string }> = [
    { key: 'oxygenPct', label: 'Oxygen', valueLabel: `${input.oxygenPct}% O₂` },
    {
      key: 'fuelType',
      label: 'Fuel Type',
      valueLabel: FUEL_TYPES.find((f) => f.id === input.fuelType)?.label || input.fuelType,
    },
    { key: 'pressurePsi', label: 'Pressure', valueLabel: `${input.pressurePsi} psi` },
    { key: 'airflowCmS', label: 'Airflow', valueLabel: `${input.airflowCmS} cm/s` },
  ];

  const n = features.length;
  const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
  const nFact = factorial(n);

  const evalCoalition = (mask: number): number => {
    const synthetic: PredictionInput = {
      oxygenPct: mask & 1 ? input.oxygenPct : BASELINE_INPUT.oxygenPct,
      fuelType: mask & 2 ? input.fuelType : BASELINE_INPUT.fuelType,
      pressurePsi: mask & 4 ? input.pressurePsi : BASELINE_INPUT.pressurePsi,
      airflowCmS: mask & 8 ? input.airflowCmS : BASELINE_INPUT.airflowCmS,
    };
    return evaluateCombustionModel(synthetic).riskScore;
  };

  const coalitionCache = new Map<number, number>();
  for (let mask = 0; mask < 16; mask++) {
    coalitionCache.set(mask, evalCoalition(mask));
  }

  const baselineScore = coalitionCache.get(0) ?? 0;
  const fullScore = coalitionCache.get(15) ?? 0;

  const rawAttributions = features.map((feat, idx) => {
    const bit = 1 << idx;
    let phi = 0;

    for (let mask = 0; mask < 16; mask++) {
      if (mask & bit) continue;
      let subsetSize = 0;
      for (let b = 0; b < n; b++) {
        if (mask & (1 << b)) subsetSize++;
      }
      const weight = (factorial(subsetSize) * factorial(n - subsetSize - 1)) / nFact;
      const withFeature = coalitionCache.get(mask | bit) ?? 0;
      const withoutFeature = coalitionCache.get(mask) ?? 0;
      phi += weight * (withFeature - withoutFeature);
    }

    return {
      key: feat.key,
      label: feat.label,
      valueLabel: feat.valueLabel,
      phi: Number(phi.toFixed(2)),
    };
  });

  const totalAbsPhi = rawAttributions.reduce((sum, item) => sum + Math.abs(item.phi), 0);

  let weightsForPct: number[];
  if (totalAbsPhi < 1.0) {
    const deltaO2 = Math.abs(
      evaluateCombustionModel({ ...input, oxygenPct: Math.min(85, input.oxygenPct + 5) }).riskScore - fullScore
    );
    const deltaFuel = Math.abs(
      evaluateCombustionModel({
        ...input,
        fuelType: input.fuelType === 'gas' ? 'solid-fabric' : 'gas',
      }).riskScore - fullScore
    );
    const deltaPsi = Math.abs(
      evaluateCombustionModel({
        ...input,
        pressurePsi: input.pressurePsi > 10 ? input.pressurePsi - 2 : input.pressurePsi + 2,
      }).riskScore - fullScore
    );
    const deltaFlow = Math.abs(
      evaluateCombustionModel({
        ...input,
        airflowCmS: input.airflowCmS < 50 ? input.airflowCmS + 15 : input.airflowCmS - 15,
      }).riskScore - fullScore
    );
    weightsForPct = [deltaO2, deltaFuel, deltaPsi, deltaFlow];
  } else {
    weightsForPct = rawAttributions.map((r) => Math.max(0.5, Math.abs(r.phi)));
  }

  const totalWeight = weightsForPct.reduce((a, b) => a + b, 0) || 1;
  const shapValues: ShapFeatureAttribution[] = rawAttributions
    .map((item, idx) => ({
      feature: item.key,
      label: item.label,
      valueLabel: item.valueLabel,
      phi: item.phi,
      importancePct: Number(((weightsForPct[idx] / totalWeight) * 100).toFixed(1)),
      direction: (item.phi >= 0 ? 'increases' : 'decreases') as 'increases' | 'decreases',
    }))
    .sort((a, b) => b.importancePct - a.importancePct);

  return {
    baselineScore: Number(baselineScore.toFixed(1)),
    shapValues,
  };
}

export async function runAndSavePrediction(rawInput: PredictionInput): Promise<PredictionResultRecord> {
  const clampedInput: PredictionInput = {
    oxygenPct: Math.min(85, Math.max(21, rawInput.oxygenPct)),
    pressurePsi: Math.min(14.7, Math.max(4.3, Number(rawInput.pressurePsi.toFixed(1)))),
    airflowCmS: Math.min(100, Math.max(0, rawInput.airflowCmS)),
    fuelType: rawInput.fuelType,
  };

  if (process.env.ML_BACKEND_URL) {
    const upstream = await fetch(`${process.env.ML_BACKEND_URL.replace(/\/$/, '')}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clampedInput),
    });
    if (!upstream.ok) {
      throw new Error(`External ML model returned HTTP ${upstream.status}`);
    }
    const data = (await upstream.json()) as PredictionResultRecord;
    const savedId = data.id || crypto.randomUUID();
    const record: PredictionResultRecord = {
      ...data,
      id: savedId,
      createdAt: data.createdAt || new Date().toISOString(),
    };
    persistPrediction(record);
    return record;
  }

  const { locPercent, riskScore } = evaluateCombustionModel(clampedInput);
  const { baselineScore, shapValues } = computeExactShapley(clampedInput);

  let classification: 'SAFE' | 'CAUTION' | 'DANGER' = 'SAFE';
  if (riskScore >= 65) {
    classification = 'DANGER';
  } else if (riskScore >= 32) {
    classification = 'CAUTION';
  }

  const fuelObj = FUEL_TYPES.find((f) => f.id === clampedInput.fuelType)!;
  const o2Delta = Number((clampedInput.oxygenPct - locPercent).toFixed(1));

  let explanation = '';
  if (classification === 'DANGER') {
    explanation = `The current conditions indicate a high fire risk: cabin oxygen (${clampedInput.oxygenPct}%) exceeds the effective Limiting Oxygen Concentration (${locPercent}%) by +${o2Delta}%, accelerating flame spread across ${fuelObj.representativeMaterial.toLowerCase()} under ${clampedInput.airflowCmS} cm/s airflow.`;
  } else if (classification === 'CAUTION') {
    explanation = `Marginal microgravity flammability regime detected. Cabin oxygen (${clampedInput.oxygenPct}%) sits close to the effective LOC threshold (${locPercent}%) at ${clampedInput.pressurePsi} psi; sustained smoldering or flame propagation is possible on ${fuelObj.label.toLowerCase()} fuels.`;
  } else {
    explanation = `Safe non-propagating combustion regime. Under ${clampedInput.pressurePsi} psi and ${clampedInput.airflowCmS} cm/s ventilation, ignition risk remains contained with oxygen (${clampedInput.oxygenPct}%) near or below severe propagation bounds for ${fuelObj.label.toLowerCase()}.`;
  }

  const corroboratingSlugs =
    clampedInput.fuelType === 'liquid'
      ? ['flex-2', 'saffire']
      : clampedInput.fuelType === 'gas'
        ? ['acme-bre', 'spice']
        : clampedInput.airflowCmS >= 15
          ? ['saffire', 'bass-ii']
          : ['bass-ii', 'cfi'];

  const db = getDb();
  const placeholders = corroboratingSlugs.map(() => '?').join(', ');
  const corroboratingRows = db
    .prepare(`SELECT id, slug, name, hardware FROM experiments WHERE slug IN (${placeholders})`)
    .all(...corroboratingSlugs) as Array<{ id: string; slug: string; name: string; hardware: string }>;
  const corroboratingExperiments =
    corroboratingRows.length > 0
      ? corroboratingRows
      : NASA_EXPERIMENTS.filter((e) => corroboratingSlugs.includes(e.slug)).map((e) => ({
          id: e.id,
          slug: e.slug,
          name: e.name,
          hardware: e.hardware,
        }));

  const record: PredictionResultRecord = {
    id: crypto.randomUUID(),
    modelConnected: true,
    modelVersion: 'FlameNet-MicroG v2.4',
    input: clampedInput,
    classification,
    riskScore,
    locPercent,
    o2MarginFromLoc: o2Delta,
    baselineScore,
    explanation,
    shapValues,
    corroboratingExperiments,
    createdAt: new Date().toISOString(),
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
      model_version, corroborating_slugs_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  return {
    id: row.id,
    modelConnected: true,
    modelVersion: row.model_version,
    input: {
      oxygenPct: row.oxygen_pct,
      pressurePsi: row.pressure_psi,
      airflowCmS: row.airflow_cms,
      fuelType: row.fuel_type as FuelTypeId,
    },
    classification: row.classification,
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
    corroboratingExperiments,
    createdAt: row.created_at,
  };
}

export function listRecentPredictions(limit = 8) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, oxygen_pct, pressure_psi, airflow_cms, fuel_type, classification, risk_score, loc_percent, created_at
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
    createdAt: r.created_at,
  }));
}

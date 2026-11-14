import { getDb } from '../database.ts';
import { FUEL_TYPES } from '../../src/data/nasaExperiments.ts';
import type { FuelTypeId } from '../../src/types/experiments.ts';
import { evaluateCombustionModel } from './predictionService.ts';

export interface InsightsFilterParams {
  fuelType?: FuelTypeId;
  pressurePsi?: number;
  airflowCmS?: number;
}

export function getResearchInsights(filters?: InsightsFilterParams) {
  const db = getDb();

  const fuelType: FuelTypeId = FUEL_TYPES.some((f) => f.id === filters?.fuelType)
    ? filters!.fuelType!
    : 'solid-fabric';
  const pressurePsi = Math.min(14.7, Math.max(4.3, Number(filters?.pressurePsi ?? 10.2)));
  const airflowCmS = Math.min(100, Math.max(0, Number(filters?.airflowCmS ?? 20)));

  const experimentCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM experiments')
    .get() as { cnt: number };

  const verifiedCountRow = db
    .prepare("SELECT COUNT(*) as cnt FROM experiments WHERE verification_status = 'VERIFIED'")
    .get() as { cnt: number };

  const sampleSumRow = db
    .prepare('SELECT COALESCE(SUM(sample_count), 0) as total_samples FROM experiment_datasets')
    .get() as { total_samples: number };

  const insightsRows = db
    .prepare('SELECT * FROM research_insights ORDER BY sort_order ASC')
    .all() as Array<{
    id: number;
    slug: string;
    title: string;
    category: string;
    summary: string;
    metric_label: string;
    metric_value: string;
    sort_order: number;
  }>;

  const oxygenSeries = [21, 30, 40, 50, 65, 80].map((o2) => ({
    o2,
    risk: evaluateCombustionModel({
      oxygenPct: o2,
      pressurePsi,
      airflowCmS,
      fuelType,
    }).riskScore,
  }));

  const pressureSeries = [4.3, 6.5, 8.5, 10.2, 12.5, 14.7].map((psi) => ({
    psi,
    loc: evaluateCombustionModel({
      oxygenPct: 30,
      pressurePsi: psi,
      airflowCmS,
      fuelType,
    }).locPercent,
    risk: evaluateCombustionModel({
      oxygenPct: 30,
      pressurePsi: psi,
      airflowCmS,
      fuelType,
    }).riskScore,
  }));

  const airflowSeries = [0, 10, 20, 35, 50, 75, 100].map((flow) => ({
    flow,
    risk: evaluateCombustionModel({
      oxygenPct: 30,
      pressurePsi,
      airflowCmS: flow,
      fuelType,
    }).riskScore,
  }));

  const fuelSeries = FUEL_TYPES.map((f) => ({
    id: f.id,
    label: f.label,
    representativeMaterial: f.representativeMaterial,
    baseLocPct: f.baseLocPct,
    riskAtIss: evaluateCombustionModel({
      oxygenPct: 21,
      pressurePsi: 14.7,
      airflowCmS,
      fuelType: f.id,
    }).riskScore,
    riskAtArtemis: evaluateCombustionModel({
      oxygenPct: 30,
      pressurePsi,
      airflowCmS,
      fuelType: f.id,
    }).riskScore,
  }));

  return {
    activeFilters: {
      fuelType,
      pressurePsi,
      airflowCmS,
    },
    experimentCount: experimentCountRow.cnt,
    verifiedExperimentCount: verifiedCountRow.cnt,
    totalSampleRuns: sampleSumRow.total_samples,
    totalDatasetRuns: 5120,
    highlights: insightsRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      summary: row.summary,
      metricLabel: row.metric_label,
      metricValue: row.metric_value,
    })),
    oxygenSeries,
    pressureSeries,
    airflowSeries,
    fuelSeries,
  };
}

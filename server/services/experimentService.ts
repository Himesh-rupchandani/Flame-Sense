import { getDb } from '../database.ts';
import { analyzeCsvDataset } from './csvUtils.ts';
import type {
  Citation,
  ContentSourceType,
  DatasetPreviewResponse,
  DatasetStatus,
  DatasetVariableMeta,
  DynamicFinding,
  DynamicParameter,
  ExperimentDatasetMeta,
  ExperimentDetailRecord,
  ExperimentListItem,
  ExperimentReference,
  ExperimentsPaginatedResponse,
  ExperimentStatisticsResponse,
  FuelTypeId,
  ParameterAvailability,
  ParameterDataType,
  RelatedExperimentMatch,
  ScatterPoint,
  VerificationStatus,
} from '../../src/types/experiments.ts';

interface RawExperimentRow {
  id: string;
  slug: string;
  name: string;
  acronym: string;
  full_name: string;
  category: string;
  pillar: string;
  combustion_type: string;
  fuel_type: string;
  fuel_class: string;
  research_platform: string;
  hardware: string;
  gravity: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
  image: string;
  short_description: string;
  overview: string;
  scientific_objectives_json: string;
  research_background: string;
  experimental_setup: string;
  combustion_characteristics: string;
  why_it_matters: string;
  related_slugs_json: string;
  verification_status: string;
  content_source_type: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
  oxygen_min: number | null;
  oxygen_max: number | null;
  pressure_min: number | null;
  pressure_max: number | null;
  airflow_min: number | null;
  airflow_max: number | null;
  parameter_notes: string | null;
  crew_safety_directness: number | null;
  habitat_applicability: number | null;
  telemetry_fidelity: number | null;
  material_breadth: number | null;
  hardware_heritage: number | null;
  recency: number | null;
  computed_relevance_score: number | null;
  rank_position: number | null;
}

interface RawDatasetRow {
  id: string;
  experiment_id: string;
  dataset_name: string;
  description: string;
  file_format: string;
  sample_count: number;
  variables_json: string;
  source_name: string;
  source_url: string;
  ntrs_id: string;
  dataset_status: string;
  verification_status: string;
  download_authorized: number;
  csv_content: string;
  scatter_json: string;
  citations_json: string;
  created_at: string;
  updated_at: string;
}

const BASE_EXPERIMENT_SELECT = `
  SELECT
    e.*,
    p.oxygen_min, p.oxygen_max, p.pressure_min, p.pressure_max, p.airflow_min, p.airflow_max, p.parameter_notes,
    r.crew_safety_directness, r.habitat_applicability, r.telemetry_fidelity,
    r.material_breadth, r.hardware_heritage, r.recency, r.computed_relevance_score, r.rank_position
  FROM experiments e
  LEFT JOIN experiment_parameters p ON p.experiment_id = e.id
  LEFT JOIN experiment_rankings r ON r.experiment_id = e.id
`;

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function resolveExperimentIdBySlugOrId(slugOrId: string): string | null {
  const db = getDb();
  const normalized = String(slugOrId || '').trim().toLowerCase();
  if (!normalized) return null;
  const row = db
    .prepare('SELECT id FROM experiments WHERE LOWER(slug) = ? OR LOWER(id) = ? LIMIT 1')
    .get(normalized, normalized) as { id: string } | undefined;
  return row?.id ?? null;
}

function computePrimaryDatasetStatus(datasets: ExperimentDatasetMeta[]): DatasetStatus {
  if (datasets.length === 0) return 'UNAVAILABLE';
  if (datasets.some((d) => d.datasetStatus === 'AVAILABLE' && d.hasCsvData)) return 'AVAILABLE';
  if (datasets.some((d) => d.datasetStatus === 'DEMO_ONLY')) return 'DEMO_ONLY';
  if (datasets.some((d) => d.datasetStatus === 'PENDING')) return 'PENDING';
  return 'UNAVAILABLE';
}

function getDatasetsRowsByExperimentId(experimentId: string): RawDatasetRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM experiment_datasets WHERE experiment_id = ? ORDER BY created_at ASC')
    .all(experimentId) as unknown as RawDatasetRow[];
}

function mapDatasetMeta(row: RawDatasetRow): ExperimentDatasetMeta {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    datasetName: row.dataset_name,
    description: row.description,
    fileFormat: row.file_format,
    sampleCount: row.sample_count,
    variables: safeParseJson<DatasetVariableMeta[]>(row.variables_json, []),
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    ntrsId: row.ntrs_id,
    datasetStatus: row.dataset_status as DatasetStatus,
    verificationStatus: row.verification_status as VerificationStatus,
    downloadAuthorized: Boolean(row.download_authorized),
    hasCsvData: Boolean(row.csv_content && row.csv_content.trim().length > 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRawToListItem(row: RawExperimentRow): ExperimentListItem {
  const db = getDb();
  const dsRows = getDatasetsRowsByExperimentId(row.id);
  const datasets = dsRows.map(mapDatasetMeta);

  const paramCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM experiment_dynamic_parameters WHERE experiment_id = ?')
    .get(row.id) as { cnt: number };
  const findingCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM experiment_findings WHERE experiment_id = ?')
    .get(row.id) as { cnt: number };
  const refCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM experiment_references WHERE experiment_id = ?')
    .get(row.id) as { cnt: number };

  const totalSamples = datasets.reduce((acc, d) => acc + (d.sampleCount || 0), 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    acronym: row.acronym,
    fullName: row.full_name,
    category: row.category,
    pillar: (row.pillar || 'prevention') as 'prevention' | 'detection' | 'suppression',
    combustionType: row.combustion_type,
    fuelType: (row.fuel_type || 'solid-fabric') as FuelTypeId,
    fuelClass: row.fuel_class,
    researchPlatform: row.research_platform,
    hardware: row.hardware,
    gravity: row.gravity,
    year: row.year,
    startDate: row.start_date,
    endDate: row.end_date,
    image: row.image,
    shortDescription: row.short_description,
    summary: row.overview,
    whyItMatters: row.why_it_matters,
    verificationStatus: row.verification_status as VerificationStatus,
    contentSourceType: row.content_source_type as ContentSourceType,
    isDemo: Boolean(row.is_demo) || row.verification_status === 'DEMO',
    datasetStatus: computePrimaryDatasetStatus(datasets),
    datasetCount: datasets.length,
    parameterCount: paramCountRow.cnt,
    findingCount: findingCountRow.cnt,
    referenceCount: refCountRow.cnt,
    sampleCount: totalSamples,
    oxygenRange: [row.oxygen_min ?? 21, row.oxygen_max ?? 30],
    pressureRange: [row.pressure_min ?? 10.2, row.pressure_max ?? 14.7],
    airflowRange: [row.airflow_min ?? 0, row.airflow_max ?? 20],
    criteria: {
      crewSafetyDirectness: row.crew_safety_directness ?? 50,
      habitatApplicability: row.habitat_applicability ?? 50,
      telemetryFidelity: row.telemetry_fidelity ?? 50,
      materialBreadth: row.material_breadth ?? 50,
      hardwareHeritage: row.hardware_heritage ?? 50,
      recency: row.recency ?? 50,
    },
    relevanceScore: row.computed_relevance_score ?? 50,
    rank: row.rank_position ?? 99,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listExperiments(filters?: {
  search?: string;
  category?: string;
  verificationStatus?: string;
  datasetAvailability?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}): ExperimentListItem[] {
  return listExperimentsPaginated(filters).experiments;
}

export function listExperimentsPaginated(filters?: {
  search?: string;
  category?: string;
  verificationStatus?: string;
  datasetAvailability?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}): ExperimentsPaginatedResponse {
  const db = getDb();
  const rows = db.prepare(BASE_EXPERIMENT_SELECT).all() as unknown as RawExperimentRow[];
  const allItems = rows.map(mapRawToListItem);

  // Category & Status breakdowns computed across full database before filter slice
  const categoryMap = new Map<string, number>();
  const statusCounts: Record<VerificationStatus, number> = {
    VERIFIED: 0,
    DEMO: 0,
    PENDING: 0,
  };
  const datasetCounts: Record<string, number> = {
    AVAILABLE: 0,
    DEMO_ONLY: 0,
    PENDING: 0,
    UNAVAILABLE: 0,
  };

  for (const item of allItems) {
    categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    statusCounts[item.verificationStatus] = (statusCounts[item.verificationStatus] || 0) + 1;
    datasetCounts[item.datasetStatus] = (datasetCounts[item.datasetStatus] || 0) + 1;
  }

  const search = String(filters?.search || '').trim().toLowerCase();
  const category = String(filters?.category || 'all').trim();
  const verificationStatus = String(filters?.verificationStatus || 'all').trim().toUpperCase();
  const datasetAvailability = String(filters?.datasetAvailability || 'all').trim().toUpperCase();
  const sortBy = String(filters?.sortBy || 'relevance').trim().toLowerCase();
  const sortOrder = String(filters?.sortOrder || (sortBy === 'name' ? 'asc' : 'desc')).trim().toLowerCase();

  let filtered = allItems;

  if (search) {
    filtered = filtered.filter(
      (exp) =>
        exp.name.toLowerCase().includes(search) ||
        exp.acronym.toLowerCase().includes(search) ||
        exp.fullName.toLowerCase().includes(search) ||
        exp.shortDescription.toLowerCase().includes(search) ||
        exp.summary.toLowerCase().includes(search) ||
        exp.category.toLowerCase().includes(search) ||
        exp.fuelClass.toLowerCase().includes(search) ||
        exp.combustionType.toLowerCase().includes(search) ||
        exp.researchPlatform.toLowerCase().includes(search)
    );
  }

  if (category && category.toLowerCase() !== 'all' && category !== 'All Types') {
    filtered = filtered.filter((exp) => exp.category.toLowerCase() === category.toLowerCase());
  }

  if (verificationStatus && verificationStatus !== 'ALL') {
    filtered = filtered.filter((exp) => exp.verificationStatus === verificationStatus);
  }

  if (datasetAvailability && datasetAvailability !== 'ALL') {
    if (datasetAvailability === 'UNAVAILABLE_OR_PENDING') {
      filtered = filtered.filter(
        (exp) => exp.datasetStatus === 'UNAVAILABLE' || exp.datasetStatus === 'PENDING'
      );
    } else {
      filtered = filtered.filter((exp) => exp.datasetStatus === datasetAvailability);
    }
  }

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === 'date') {
      const da = a.startDate || `${a.year}-01-01`;
      const dbStr = b.startDate || `${b.year}-01-01`;
      cmp = da.localeCompare(dbStr);
    } else if (sortBy === 'updated') {
      cmp = a.updatedAt.localeCompare(b.updatedAt);
    } else {
      cmp = a.relevanceScore - b.relevanceScore;
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const totalCount = filtered.length;
  const limit = Math.min(50, Math.max(1, Number(filters?.limit || 12)));
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.min(totalPages, Math.max(1, Number(filters?.page || 1)));
  const offset = (page - 1) * limit;
  const paged = filtered.slice(offset, offset + limit);

  return {
    experiments: paged,
    investigations: paged,
    totalCount,
    totalPages,
    page,
    limit,
    categoryCounts: Array.from(categoryMap.entries())
      .map(([cat, count]) => ({ category: cat, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    statusCounts,
    datasetCounts,
  };
}

export function getExperimentCategoriesSummary() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.category, COUNT(*) as count, ROUND(AVG(COALESCE(r.computed_relevance_score, 50)), 1) as avg_relevance
       FROM experiments e
       LEFT JOIN experiment_rankings r ON r.experiment_id = e.id
       GROUP BY e.category
       ORDER BY count DESC, e.category ASC`
    )
    .all() as Array<{ category: string; count: number; avg_relevance: number }>;

  const statusRows = db
    .prepare('SELECT verification_status, COUNT(*) as count FROM experiments GROUP BY verification_status')
    .all() as Array<{ verification_status: string; count: number }>;

  return {
    categories: rows.map((r) => ({
      category: r.category,
      count: r.count,
      avgRelevance: r.avg_relevance,
    })),
    verificationStatuses: statusRows.map((s) => ({
      status: s.verification_status,
      count: s.count,
    })),
  };
}

export function getExperimentStatistics(): ExperimentStatisticsResponse {
  const db = getDb();
  const all = listExperimentsPaginated({ page: 1, limit: 50 }).experiments;

  const verifiedCount = all.filter((e) => e.verificationStatus === 'VERIFIED').length;
  const demoCount = all.filter((e) => e.verificationStatus === 'DEMO').length;
  const pendingCount = all.filter((e) => e.verificationStatus === 'PENDING').length;

  const dsAgg = db
    .prepare(
      `SELECT
         COUNT(*) as total_datasets,
         SUM(CASE WHEN dataset_status IN ('AVAILABLE', 'DEMO_ONLY') AND LENGTH(TRIM(csv_content)) > 0 THEN 1 ELSE 0 END) as available_datasets,
         COALESCE(SUM(sample_count), 0) as total_samples
       FROM experiment_datasets`
    )
    .get() as { total_datasets: number; available_datasets: number; total_samples: number };

  const prmAgg = db
    .prepare('SELECT COUNT(*) as cnt FROM experiment_dynamic_parameters')
    .get() as { cnt: number };
  const fndAgg = db
    .prepare('SELECT COUNT(*) as cnt FROM experiment_findings')
    .get() as { cnt: number };
  const refAgg = db
    .prepare('SELECT COUNT(*) as cnt FROM experiment_references')
    .get() as { cnt: number };

  const categories = getExperimentCategoriesSummary().categories;
  const avgRel =
    all.length > 0
      ? Number((all.reduce((acc, e) => acc + e.relevanceScore, 0) / all.length).toFixed(1))
      : 0;

  return {
    totalExperiments: all.length,
    verifiedCount,
    demoCount,
    pendingCount,
    totalDatasets: dsAgg.total_datasets,
    availableDatasetsCount: dsAgg.available_datasets || 0,
    totalParameters: prmAgg.cnt,
    totalFindings: fndAgg.cnt,
    totalReferences: refAgg.cnt,
    totalSamples: dsAgg.total_samples,
    averageRelevanceScore: avgRel,
    categories,
    comparisonSeries: all.map((e) => ({
      slug: e.slug,
      name: e.name,
      acronym: e.acronym,
      category: e.category,
      verificationStatus: e.verificationStatus,
      relevanceScore: e.relevanceScore,
      oxygenMax: e.oxygenRange[1],
      pressureMax: e.pressureRange[1],
      sampleCount: e.sampleCount,
      parameterCount: e.parameterCount,
    })),
  };
}

export function getExperimentParametersBySlug(slug: string): DynamicParameter[] | null {
  const expId = resolveExperimentIdBySlugOrId(slug);
  if (!expId) return null;

  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM experiment_dynamic_parameters WHERE experiment_id = ? ORDER BY sort_order ASC, created_at ASC'
    )
    .all(expId) as Array<{
    id: string;
    experiment_id: string;
    param_name: string;
    param_description: string;
    param_value: string;
    unit: string;
    min_value: number | null;
    max_value: number | null;
    data_type: string;
    measurement_source: string;
    availability_status: string;
    verification_status: string;
    sort_order: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    experimentId: r.experiment_id,
    name: r.param_name,
    description: r.param_description,
    value: r.param_value,
    unit: r.unit,
    minValue: r.min_value,
    maxValue: r.max_value,
    dataType: r.data_type as ParameterDataType,
    measurementSource: r.measurement_source,
    availabilityStatus: r.availability_status as ParameterAvailability,
    verificationStatus: r.verification_status as VerificationStatus,
    sortOrder: r.sort_order,
  }));
}

export function getExperimentFindingsBySlug(slug: string): DynamicFinding[] | null {
  const expId = resolveExperimentIdBySlugOrId(slug);
  if (!expId) return null;

  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM experiment_findings WHERE experiment_id = ? ORDER BY finding_order ASC, id ASC')
    .all(expId) as Array<{
    id: number;
    experiment_id: string;
    finding_order: number;
    finding_title: string;
    finding_text: string;
    verification_status: string;
    source_label: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    experimentId: r.experiment_id,
    order: r.finding_order,
    title: r.finding_title,
    text: r.finding_text,
    verificationStatus: r.verification_status as VerificationStatus,
    sourceLabel: r.source_label,
    createdAt: r.created_at,
  }));
}

export function getExperimentDatasetsBySlug(slug: string): ExperimentDatasetMeta[] | null {
  const expId = resolveExperimentIdBySlugOrId(slug);
  if (!expId) return null;

  return getDatasetsRowsByExperimentId(expId).map(mapDatasetMeta);
}

export function getDatasetPreviewBySlugAndId(
  slug: string,
  datasetId: string
): DatasetPreviewResponse | { error: string; status: number } {
  const expId = resolveExperimentIdBySlugOrId(slug);
  if (!expId) return { error: `Experiment '${slug}' not found`, status: 404 };

  const db = getDb();
  const dsRow = db
    .prepare('SELECT * FROM experiment_datasets WHERE experiment_id = ? AND id = ? LIMIT 1')
    .get(expId, datasetId) as unknown as RawDatasetRow | undefined;

  if (!dsRow) {
    return { error: `Dataset '${datasetId}' not found for experiment '${slug}'`, status: 404 };
  }

  const meta = mapDatasetMeta(dsRow);
  const analysis = analyzeCsvDataset(dsRow.csv_content, meta.variables);

  const provenanceNotice =
    meta.verificationStatus === 'DEMO'
      ? 'Illustrative Demo Data — Not NASA Experimental Measurements.'
      : meta.verificationStatus === 'PENDING' || !meta.hasCsvData
        ? 'Tabular CSV dataset is currently pending ingestion or unavailable locally.'
        : `Source: ${meta.sourceName}`;

  return {
    dataset: meta,
    columns: analysis.columns,
    columnStats: analysis.columnStats,
    totalRows: analysis.totalRows,
    previewRows: analysis.previewRows,
    chartRows: analysis.chartRows,
    provenanceNotice,
  };
}

export function getAuthorizedDatasetDownload(
  slug: string,
  datasetId: string
): { filename: string; content: string } | { error: string; status: number } {
  const expId = resolveExperimentIdBySlugOrId(slug);
  if (!expId) return { error: `Experiment '${slug}' not found`, status: 404 };

  const db = getDb();
  const dsRow = db
    .prepare('SELECT * FROM experiment_datasets WHERE experiment_id = ? AND id = ? LIMIT 1')
    .get(expId, datasetId) as unknown as RawDatasetRow | undefined;

  if (!dsRow) return { error: `Dataset '${datasetId}' not found`, status: 404 };

  if (!dsRow.download_authorized) {
    return {
      error:
        'Direct download disabled: official NASA raw telemetry files must be retrieved from the linked NASA NTRS/PSI primary archive.',
      status: 403,
    };
  }

  if (!dsRow.csv_content || !dsRow.csv_content.trim()) {
    return { error: 'Dataset file has no tabular CSV payload available for download.', status: 404 };
  }

  const safeSlug = slug.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
  const safeId = datasetId.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
  const prefix = dsRow.verification_status === 'DEMO' ? 'ILLUSTRATIVE_DEMO_' : '';
  return {
    filename: `${prefix}${safeSlug}_${safeId}.csv`,
    content: dsRow.csv_content,
  };
}

export function getExperimentReferencesBySlug(slug: string): ExperimentReference[] | null {
  const expId = resolveExperimentIdBySlugOrId(slug);
  if (!expId) return null;

  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM experiment_references WHERE experiment_id = ? ORDER BY publication_year DESC')
    .all(expId) as Array<{
    id: string;
    experiment_id: string;
    title: string;
    authors: string;
    publication_year: number;
    document_id: string;
    page_ref: string;
    url: string;
    source_type: string;
    verification_status: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    experimentId: r.experiment_id,
    title: r.title,
    authors: r.authors,
    publicationYear: r.publication_year,
    documentId: r.document_id,
    pageRef: r.page_ref,
    url: r.url,
    sourceType: r.source_type as ExperimentReference['sourceType'],
    verificationStatus: r.verification_status as VerificationStatus,
  }));
}

function tokenizeWords(input: string): Set<string> {
  return new Set(
    String(input || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4)
  );
}

export function getRelatedExperimentsBySlug(slug: string, limit = 3): RelatedExperimentMatch[] | null {
  const db = getDb();
  const normalized = String(slug || '').trim().toLowerCase();
  const targetRow = db
    .prepare(`${BASE_EXPERIMENT_SELECT} WHERE LOWER(e.slug) = ? OR LOWER(e.id) = ? LIMIT 1`)
    .get(normalized, normalized) as unknown as RawExperimentRow | undefined;

  if (!targetRow) return null;

  const targetParams = getExperimentParametersBySlug(targetRow.slug) || [];
  const targetParamNames = new Set(targetParams.map((p) => p.name.toLowerCase()));
  const targetObjectives = safeParseJson<string[]>(targetRow.scientific_objectives_json, []).join(' ');
  const targetTokens = tokenizeWords(targetObjectives);

  const candidates = db
    .prepare(`${BASE_EXPERIMENT_SELECT} WHERE e.id != ?`)
    .all(targetRow.id) as unknown as RawExperimentRow[];

  const scored: RelatedExperimentMatch[] = candidates.map((cand) => {
    let similarity = 0;
    const reasons: string[] = [];

    // 1. Research category match (+30)
    if (cand.category.toLowerCase() === targetRow.category.toLowerCase()) {
      similarity += 30;
      reasons.push(`Category: ${cand.category}`);
    }

    // 2. Combustion type overlap (+25)
    const targetCombWords = tokenizeWords(targetRow.combustion_type);
    const candCombWords = tokenizeWords(cand.combustion_type);
    const combOverlap = [...candCombWords].filter((w) => targetCombWords.has(w));
    if (combOverlap.length > 0) {
      similarity += 25;
      reasons.push(`Combustion mode match`);
    }

    // 3. Fuel type & class (+20)
    if (cand.fuel_type === targetRow.fuel_type) {
      similarity += 20;
      reasons.push(`Fuel phase: ${cand.fuel_type}`);
    } else if (
      cand.fuel_class.toLowerCase().includes(targetRow.fuel_type) ||
      targetRow.fuel_class.toLowerCase().includes(cand.fuel_type)
    ) {
      similarity += 10;
    }

    // 4. Operating conditions overlap (+15)
    const o2Overlap =
      Math.min(targetRow.oxygen_max ?? 30, cand.oxygen_max ?? 30) -
      Math.max(targetRow.oxygen_min ?? 21, cand.oxygen_min ?? 21);
    const psiOverlap =
      Math.min(targetRow.pressure_max ?? 14.7, cand.pressure_max ?? 14.7) -
      Math.max(targetRow.pressure_min ?? 10.2, cand.pressure_min ?? 10.2);
    if (o2Overlap >= 5 && psiOverlap >= 1) {
      similarity += 15;
      reasons.push('Overlapping O₂ & pressure envelope');
    }

    // 5. Shared parameter names (+10)
    const candParams = getExperimentParametersBySlug(cand.slug) || [];
    const sharedParams = candParams.filter((p) => targetParamNames.has(p.name.toLowerCase()));
    if (sharedParams.length > 0) {
      similarity += Math.min(10, sharedParams.length * 4);
      reasons.push(`Shared parameters (${sharedParams.length})`);
    }

    // 6. Research objectives keyword overlap (+10)
    const candObjWords = tokenizeWords(
      safeParseJson<string[]>(cand.scientific_objectives_json, []).join(' ')
    );
    const objOverlap = [...candObjWords].filter((w) => targetTokens.has(w));
    if (objOverlap.length >= 2) {
      similarity += Math.min(10, objOverlap.length * 2);
      reasons.push('Aligned scientific objectives');
    }

    // Keep verified experiments prioritized when similarity ties cleanly
    if (targetRow.verification_status === 'VERIFIED' && cand.verification_status === 'VERIFIED') {
      similarity += 3;
    }

    return {
      id: cand.id,
      slug: cand.slug,
      name: cand.name,
      acronym: cand.acronym,
      fullName: cand.full_name,
      category: cand.category,
      fuelClass: cand.fuel_class,
      combustionType: cand.combustion_type,
      image: cand.image,
      shortDescription: cand.short_description,
      verificationStatus: cand.verification_status as VerificationStatus,
      relevanceScore: cand.computed_relevance_score ?? 50,
      similarityScore: Math.min(100, Math.round(similarity)),
      matchReasons: reasons.length > 0 ? reasons.slice(0, 3) : ['Cross-platform safety relevance'],
    };
  });

  return scored
    .sort((a, b) => b.similarityScore - a.similarityScore || b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

export function getExperimentBySlug(slug: string): ExperimentDetailRecord | null {
  const db = getDb();
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  const row = db
    .prepare(`${BASE_EXPERIMENT_SELECT} WHERE LOWER(e.slug) = ? OR LOWER(e.id) = ? LIMIT 1`)
    .get(normalized, normalized) as unknown as RawExperimentRow | undefined;

  if (!row) return null;

  const listItem = mapRawToListItem(row);
  const objectives = safeParseJson<string[]>(row.scientific_objectives_json, []);
  const parameters = getExperimentParametersBySlug(row.slug) || [];
  const findings = getExperimentFindingsBySlug(row.slug) || [];
  const dsRows = getDatasetsRowsByExperimentId(row.id);
  const datasets = dsRows.map(mapDatasetMeta);
  const references = getExperimentReferencesBySlug(row.slug) || [];
  const relatedExperiments = getRelatedExperimentsBySlug(row.slug, 3) || [];

  const firstDs = dsRows[0];
  const scatter = firstDs ? safeParseJson<ScatterPoint[]>(firstDs.scatter_json, []) : [];
  const citations = firstDs ? safeParseJson<Citation[]>(firstDs.citations_json, []) : [];

  return {
    ...listItem,
    scientificObjectives: objectives,
    researchBackground: row.research_background,
    experimentalSetup: row.experimental_setup,
    combustionCharacteristics: row.combustion_characteristics,
    parameterNotes: row.parameter_notes || '',
    datasetName: firstDs?.dataset_name || 'No dataset registered',
    ntrsId: firstDs?.ntrs_id || 'UNAVAILABLE',
    sourceUrl: firstDs?.source_url || '',
    scatter,
    citations,
    keyFindings: findings.map((f) => f.text),
    parameters,
    findings,
    datasets,
    references,
    relatedExperiments,
    availableSections: {
      overview: Boolean(row.overview && row.overview.trim().length > 0),
      objectives: objectives.length > 0 || Boolean(row.research_background?.trim()),
      setup: Boolean(row.experimental_setup && row.experimental_setup.trim().length > 0),
      combustionBehaviour: Boolean(
        row.combustion_characteristics && row.combustion_characteristics.trim().length > 0
      ),
      parameters: parameters.length > 0,
      findings: findings.length > 0,
      dataset: datasets.length > 0,
      charts: datasets.some((d) => d.hasCsvData) || scatter.length > 0,
      references: references.length > 0,
      related: relatedExperiments.length > 0,
    },
  };
}

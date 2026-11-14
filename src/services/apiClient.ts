import type { FuelTypeId } from '../data/nasaExperiments.ts';
import type {
  DatasetPreviewResponse,
  DynamicFinding,
  DynamicParameter,
  ExperimentCategory,
  ExperimentDatasetMeta,
  ExperimentDetailRecord,
  ExperimentListItem,
  ExperimentReference,
  ExperimentsPaginatedResponse,
  ExperimentStatisticsResponse,
  RelatedExperimentMatch,
  RelevanceCriteria,
  VerificationStatus,
} from '../types/experiments.ts';

export type ExperimentSummary = ExperimentListItem;
export type ExperimentDetail = ExperimentDetailRecord;

export interface RankedExperiment extends ExperimentListItem {
  rank: number;
  criteria: RelevanceCriteria;
}

export interface RankingsResponse {
  methodology: {
    version: string;
    description: string;
    weights: Record<string, number>;
  };
  rankings: RankedExperiment[];
}

export interface ShapFeatureAttribution {
  feature: string;
  label: string;
  valueLabel: string;
  phi: number;
  importancePct: number;
  direction: 'increases' | 'decreases';
}

export interface PredictionResponse {
  id: string;
  modelConnected: boolean;
  modelVersion: string;
  input: {
    oxygenPct: number;
    pressurePsi: number;
    airflowCmS: number;
    fuelType: FuelTypeId;
  };
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

export interface PredictionHistoryItem {
  id: string;
  oxygenPct: number;
  pressurePsi: number;
  airflowCmS: number;
  fuelType: FuelTypeId;
  classification: 'SAFE' | 'CAUTION' | 'DANGER';
  riskScore: number;
  locPercent: number;
  createdAt: string;
}

export interface ResearchInsightHighlight {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  metricLabel: string;
  metricValue: string;
}

export interface InsightsResponse {
  activeFilters?: {
    fuelType: FuelTypeId;
    pressurePsi: number;
    airflowCmS: number;
  };
  experimentCount: number;
  verifiedExperimentCount?: number;
  totalSampleRuns: number;
  totalDatasetRuns: number;
  highlights: ResearchInsightHighlight[];
  oxygenSeries: Array<{ o2: number; risk: number }>;
  pressureSeries: Array<{ psi: number; loc: number; risk: number }>;
  airflowSeries: Array<{ flow: number; risk: number }>;
  fuelSeries: Array<{
    id: FuelTypeId;
    label: string;
    representativeMaterial: string;
    baseLocPct: number;
    riskAtIss: number;
    riskAtArtemis: number;
  }>;
}

export interface HealthResponse {
  connected: boolean;
  databaseEngine: string;
  modelName: string;
  calibrationExperiments: number;
  totalExperiments?: number;
  datasetRuns: number;
  externalMlUrlConfigured: boolean;
}

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactSubmissionResponse {
  success: boolean;
  submission: {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    createdAt: string;
  };
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return String(body.error);
  } catch {
    // Ignore non-JSON body
  }
  return `${fallback} (HTTP ${res.status})`;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Backend unavailable'));
  }
  return res.json();
}

export async function fetchExperimentsPaginated(params?: {
  search?: string;
  category?: ExperimentCategory | 'all';
  verificationStatus?: VerificationStatus | 'all';
  datasetAvailability?: string;
  sortBy?: 'relevance' | 'name' | 'date' | 'updated';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<ExperimentsPaginatedResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.category && params.category !== 'all') qs.set('category', params.category);
  if (params?.verificationStatus && params.verificationStatus !== 'all') {
    qs.set('verificationStatus', params.verificationStatus);
  }
  if (params?.datasetAvailability && params.datasetAvailability !== 'all') {
    qs.set('datasetAvailability', params.datasetAvailability);
  }
  if (params?.sortBy) qs.set('sortBy', params.sortBy);
  if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));

  const res = await fetch(`/api/experiments?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to load experiments archive'));
  }
  return res.json();
}

export async function fetchExperiments(params?: {
  search?: string;
  category?: ExperimentCategory | 'all';
}): Promise<ExperimentSummary[]> {
  const data = await fetchExperimentsPaginated({ ...params, limit: 50 });
  return data.experiments || [];
}

export async function fetchExperimentCategories(): Promise<{
  categories: Array<{ category: string; count: number; avgRelevance: number }>;
  verificationStatuses: Array<{ status: string; count: number }>;
}> {
  const res = await fetch('/api/experiments/categories');
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to load experiment categories'));
  }
  return res.json();
}

export async function fetchExperimentStatistics(): Promise<ExperimentStatisticsResponse> {
  const res = await fetch('/api/experiments/statistics');
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to load experiment statistics'));
  }
  return res.json();
}

export async function fetchExperimentBySlug(slug: string): Promise<ExperimentDetail> {
  const res = await fetch(`/api/experiments/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Experiment '${slug}' was not found in the research archive.`);
    }
    throw new Error(await parseErrorMessage(res, 'Failed to load experiment details'));
  }
  return res.json();
}

export async function fetchExperimentParameters(slug: string): Promise<DynamicParameter[]> {
  const res = await fetch(`/api/experiments/${encodeURIComponent(slug)}/parameters`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to load parameters'));
  const body = await res.json();
  return body.parameters || [];
}

export async function fetchExperimentFindings(slug: string): Promise<DynamicFinding[]> {
  const res = await fetch(`/api/experiments/${encodeURIComponent(slug)}/findings`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to load findings'));
  const body = await res.json();
  return body.findings || [];
}

export async function fetchExperimentDatasets(slug: string): Promise<ExperimentDatasetMeta[]> {
  const res = await fetch(`/api/experiments/${encodeURIComponent(slug)}/datasets`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to load datasets'));
  const body = await res.json();
  return body.datasets || [];
}

export async function fetchDatasetPreview(
  slug: string,
  datasetId: string
): Promise<DatasetPreviewResponse> {
  const res = await fetch(
    `/api/experiments/${encodeURIComponent(slug)}/datasets/${encodeURIComponent(datasetId)}/preview`
  );
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to load dataset preview'));
  }
  return res.json();
}

export function getDatasetDownloadUrl(slug: string, datasetId: string): string {
  return `/api/experiments/${encodeURIComponent(slug)}/datasets/${encodeURIComponent(datasetId)}/download`;
}

export async function fetchExperimentReferences(slug: string): Promise<ExperimentReference[]> {
  const res = await fetch(`/api/experiments/${encodeURIComponent(slug)}/references`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to load references'));
  const body = await res.json();
  return body.references || [];
}

export async function fetchRelatedExperiments(
  slug: string,
  limit = 3
): Promise<RelatedExperimentMatch[]> {
  const res = await fetch(`/api/experiments/${encodeURIComponent(slug)}/related?limit=${limit}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to load related experiments'));
  const body = await res.json();
  return body.relatedExperiments || [];
}

export async function fetchRankings(): Promise<RankingsResponse> {
  const res = await fetch('/api/rankings');
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to calculate experiment rankings'));
  }
  return res.json();
}

export async function predictFireRisk(payload: {
  oxygenPct: number;
  pressurePsi: number;
  airflowCmS: number;
  fuelType: FuelTypeId;
}): Promise<PredictionResponse> {
  const res = await fetch('/api/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Prediction model backend unavailable'));
  }

  return res.json();
}

export async function fetchPredictionById(id: string): Promise<PredictionResponse> {
  const res = await fetch(`/api/predictions/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `Prediction record '${id}' not found`));
  }
  return res.json();
}

export async function fetchRecentPredictions(limit = 6): Promise<PredictionHistoryItem[]> {
  const res = await fetch(`/api/predictions?limit=${limit}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to load prediction history'));
  }
  const data = await res.json();
  return data.predictions || [];
}

export async function fetchInsights(filters?: {
  fuelType?: FuelTypeId;
  pressurePsi?: number;
  airflowCmS?: number;
}): Promise<InsightsResponse> {
  const qs = new URLSearchParams();
  if (filters?.fuelType) qs.set('fuelType', filters.fuelType);
  if (filters?.pressurePsi !== undefined) qs.set('pressurePsi', String(filters.pressurePsi));
  if (filters?.airflowCmS !== undefined) qs.set('airflowCmS', String(filters.airflowCmS));
  const queryStr = qs.toString();

  const res = await fetch(`/api/insights${queryStr ? `?${queryStr}` : ''}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Failed to load fire safety insights'));
  }
  return res.json();
}

export async function submitContactForm(
  payload: ContactPayload
): Promise<ContactSubmissionResponse> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Unable to submit contact inquiry (HTTP ${res.status})`);
  }
  return body;
}

// ---------- Protected Research Admin Client Functions ----------

export async function createAdminSession(
  passcode: string
): Promise<{ token: string; expiresAt: string }> {
  const res = await fetch('/api/admin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Admin authentication failed'));
  }
  return res.json();
}

function adminHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function adminCreateExperiment(
  token: string,
  payload: Record<string, unknown>
): Promise<ExperimentDetail> {
  const res = await fetch('/api/admin/experiments', {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to create experiment'));
  return res.json();
}

export async function adminUpdateExperiment(
  token: string,
  idOrSlug: string,
  payload: Record<string, unknown>
): Promise<ExperimentDetail> {
  const res = await fetch(`/api/admin/experiments/${encodeURIComponent(idOrSlug)}`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to update experiment'));
  return res.json();
}

export async function adminDeleteExperiment(
  token: string,
  idOrSlug: string
): Promise<{ deleted: boolean; id: string; slug: string; name: string }> {
  const res = await fetch(`/api/admin/experiments/${encodeURIComponent(idOrSlug)}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to delete experiment'));
  return res.json();
}

export async function adminAddParameter(
  token: string,
  idOrSlug: string,
  payload: Record<string, unknown>
): Promise<ExperimentDetail> {
  const res = await fetch(`/api/admin/experiments/${encodeURIComponent(idOrSlug)}/parameters`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to add parameter'));
  return res.json();
}

export async function adminAddOrUpdateFinding(
  token: string,
  idOrSlug: string,
  payload: Record<string, unknown>
): Promise<ExperimentDetail> {
  const res = await fetch(`/api/admin/experiments/${encodeURIComponent(idOrSlug)}/findings`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to save finding'));
  return res.json();
}

export async function adminRegisterDataset(
  token: string,
  idOrSlug: string,
  payload: Record<string, unknown>
): Promise<ExperimentDetail> {
  const res = await fetch(`/api/admin/experiments/${encodeURIComponent(idOrSlug)}/datasets`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to register dataset'));
  return res.json();
}

export async function adminAddReference(
  token: string,
  idOrSlug: string,
  payload: Record<string, unknown>
): Promise<ExperimentDetail> {
  const res = await fetch(`/api/admin/experiments/${encodeURIComponent(idOrSlug)}/references`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to add reference'));
  return res.json();
}

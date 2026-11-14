import type { FuelTypeId } from '../data/nasaExperiments.ts';
import type {
  DataLabAnalyzeResponse,
  DataLabDatasetDetail,
  DataLabDatasetSummary,
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

export interface PredictionResponse {
  id: string;
  modelConnected: boolean;
  modelVersion: string;
  isTrainedMlModel?: boolean;
  isSyntheticDemoData?: boolean;
  datasetProvenance?: string;
  methodologyDisclaimer?: string;
  input: {
    oxygenPct: number;
    pressurePsi: number;
    airflowCmS: number;
    fuelType: FuelTypeId;
  };
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

export interface PredictionHistoryItem {
  id: string;
  oxygenPct: number;
  pressurePsi: number;
  airflowCmS: number;
  fuelType: FuelTypeId;
  classification: 'SAFE' | 'CAUTION' | 'DANGER';
  riskScore: number;
  locPercent: number;
  confidence?: number;
  modelVersion?: string;
  isTrainedMlModel?: boolean;
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
  estimationMethodologyNote?: string;
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
  mlServiceConnected?: boolean;
  mlServiceUrl?: string;
  databaseEngine: string;
  modelMode?: 'python-sklearn-ml' | 'empirical-formula' | 'external-ml';
  isTrainedMlModel?: boolean;
  isSyntheticDemoData?: boolean;
  datasetProvenance?: string;
  modelEvaluation?: ModelEvaluationSummary | null;
  modelName: string;
  limitationsNote?: string;
  calibrationExperiments: number;
  verifiedExperiments?: number;
  totalExperiments?: number;
  availableDatasetsCount?: number;
  indexedDatasetSamples?: number;
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

async function readResponseSafely(res: Response): Promise<{
  rawText: string;
  json: Record<string, unknown> | null;
  isHtml: boolean;
}> {
  const rawText = await res.text();
  const trimmed = rawText.trimStart().toLowerCase();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html');

  if (!rawText.trim() || isHtml) {
    return { rawText, json: null, isHtml };
  }

  try {
    return { rawText, json: JSON.parse(rawText) as Record<string, unknown>, isHtml: false };
  } catch {
    return { rawText, json: null, isHtml: false };
  }
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const { rawText, json, isHtml } = await readResponseSafely(res);
  if (json && json.error) {
    return String(json.error);
  }
  if (isHtml) {
    return `${fallback} (HTTP ${res.status}): Server returned HTML instead of JSON. Check that the Express API server is running and routing /api/* endpoints.`;
  }
  if (rawText.trim()) {
    return `${fallback} (HTTP ${res.status}): ${rawText.trim().slice(0, 180)}`;
  }
  return `${fallback} (HTTP ${res.status})`;
}

async function parseJsonResponse<T>(res: Response, fallback: string): Promise<T> {
  const { rawText, json, isHtml } = await readResponseSafely(res);
  if (!res.ok) {
    if (json && json.error) {
      throw new Error(String(json.error));
    }
    if (isHtml) {
      throw new Error(
        `${fallback} (HTTP ${res.status}): Server returned HTML instead of JSON. Ensure /api/* routes are handled by Express.`
      );
    }
    throw new Error(
      rawText.trim()
        ? `${fallback} (HTTP ${res.status}): ${rawText.trim().slice(0, 180)}`
        : `${fallback} (HTTP ${res.status})`
    );
  }

  if (isHtml) {
    throw new Error(
      `${fallback}: Received an HTML page instead of a JSON API response (HTTP ${res.status}). Check that the backend API route is reachable.`
    );
  }
  if (json === null) {
    throw new Error(`${fallback}: Server returned an empty or invalid JSON response (HTTP ${res.status}).`);
  }
  return json as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  return parseJsonResponse<HealthResponse>(res, 'Backend unavailable');
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

// ---------- Data Lab Client Functions (Session-Isolated) ----------

const DATALAB_SESSION_KEY = 'fif_datalab_session_token';

export function getActiveDataLabSessionToken(fallbackToken = ''): string {
  try {
    const stored = sessionStorage.getItem(DATALAB_SESSION_KEY);
    if (stored && stored.length >= 16) return stored;
  } catch {
    // Ignore storage access errors
  }
  return fallbackToken;
}

export async function refreshDataLabSession(): Promise<string> {
  const res = await fetch('/api/data-lab/session', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const body = await parseJsonResponse<{ sessionToken: string }>(
    res,
    'Unable to initialize Data Lab session'
  );
  if (!body.sessionToken || typeof body.sessionToken !== 'string') {
    throw new Error('Unable to initialize Data Lab session: missing sessionToken in response.');
  }
  try {
    sessionStorage.setItem(DATALAB_SESSION_KEY, body.sessionToken);
  } catch {
    // Ignore storage quota errors
  }
  return body.sessionToken;
}

export async function ensureDataLabSession(): Promise<string> {
  const existing = getActiveDataLabSessionToken();
  if (existing) {
    return existing;
  }
  return refreshDataLabSession();
}

async function fetchDataLabWithSessionRetry(
  sessionToken: string,
  makeRequest: (token: string) => Promise<Response>
): Promise<Response> {
  const initialToken = sessionToken || (await ensureDataLabSession());
  let res = await makeRequest(initialToken);
  if (res.status === 401) {
    const freshToken = await refreshDataLabSession();
    res = await makeRequest(freshToken);
  }
  return res;
}

export async function fetchDataLabDatasets(sessionToken: string): Promise<DataLabDatasetSummary[]> {
  const res = await fetchDataLabWithSessionRetry(sessionToken, (token) =>
    fetch('/api/data-lab/datasets', {
      headers: {
        'x-datalab-session': token,
        Accept: 'application/json',
      },
    })
  );
  const data = await parseJsonResponse<{ datasets: DataLabDatasetSummary[] }>(
    res,
    'Failed to list uploaded datasets'
  );
  return data.datasets || [];
}

export async function uploadDataLabCsvFile(
  sessionToken: string,
  file: File
): Promise<DataLabDatasetDetail> {
  const res = await fetchDataLabWithSessionRetry(sessionToken, (token) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/api/data-lab/upload', {
      method: 'POST',
      headers: {
        'x-datalab-session': token,
        Accept: 'application/json',
      },
      body: formData,
    });
  });
  return parseJsonResponse<DataLabDatasetDetail>(res, 'CSV upload failed');
}

export async function uploadDataLabCsvText(
  sessionToken: string,
  filename: string,
  csvContent: string
): Promise<DataLabDatasetDetail> {
  const res = await fetchDataLabWithSessionRetry(sessionToken, (token) =>
    fetch('/api/data-lab/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-datalab-session': token,
        Accept: 'application/json',
      },
      body: JSON.stringify({ filename, csvContent }),
    })
  );
  return parseJsonResponse<DataLabDatasetDetail>(res, 'CSV upload failed');
}

export async function fetchDataLabDatasetDetail(
  sessionToken: string,
  datasetId: string
): Promise<DataLabDatasetDetail> {
  const res = await fetchDataLabWithSessionRetry(sessionToken, (token) =>
    fetch(`/api/data-lab/datasets/${encodeURIComponent(datasetId)}`, {
      headers: {
        'x-datalab-session': token,
        Accept: 'application/json',
      },
    })
  );
  return parseJsonResponse<DataLabDatasetDetail>(res, 'Failed to load uploaded dataset');
}

export async function analyzeDataLabDatasetClient(
  sessionToken: string,
  datasetId: string,
  payload: {
    selectedColumns?: string[];
    chartType?: 'line' | 'bar' | 'scatter' | 'distribution' | 'correlation';
    xColumn?: string | null;
    yColumn?: string | null;
    includeCompatibilityEstimates?: boolean;
  }
): Promise<DataLabAnalyzeResponse> {
  const res = await fetchDataLabWithSessionRetry(sessionToken, (token) =>
    fetch(`/api/data-lab/datasets/${encodeURIComponent(datasetId)}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-datalab-session': token,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
  );
  return parseJsonResponse<DataLabAnalyzeResponse>(res, 'Failed to analyze dataset');
}

export function getDataLabReportDownloadUrl(
  sessionToken: string,
  datasetId: string,
  format: 'pdf' | 'json' | 'csv',
  selectedColumns?: string[]
): string {
  const activeToken = getActiveDataLabSessionToken(sessionToken);
  const qs = new URLSearchParams({
    format,
    session: activeToken,
    download: '1',
  });
  if (selectedColumns && selectedColumns.length > 0) {
    qs.set('columns', selectedColumns.join(','));
  }
  return `/api/data-lab/datasets/${encodeURIComponent(datasetId)}/report?${qs.toString()}`;
}

export async function deleteDataLabDatasetClient(
  sessionToken: string,
  datasetId: string
): Promise<{ deleted: boolean; id: string }> {
  const res = await fetchDataLabWithSessionRetry(sessionToken, (token) =>
    fetch(`/api/data-lab/datasets/${encodeURIComponent(datasetId)}`, {
      method: 'DELETE',
      headers: {
        'x-datalab-session': token,
        Accept: 'application/json',
      },
    })
  );
  return parseJsonResponse<{ deleted: boolean; id: string }>(res, 'Failed to delete dataset');
}



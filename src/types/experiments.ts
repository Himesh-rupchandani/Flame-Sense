export type VerificationStatus = 'VERIFIED' | 'DEMO' | 'PENDING';

export type ContentSourceType =
  | 'NASA_NTRS_PUBLICATION'
  | 'PEER_REVIEWED_JOURNAL'
  | 'ILLUSTRATIVE_DEMO'
  | 'PENDING_ACQUISITION'
  | 'ADMIN_ENTRY';

export type ExperimentCategory = string;
export type FuelTypeId = 'solid-fabric' | 'plastic' | 'liquid' | 'gas';
export type DatasetStatus = 'AVAILABLE' | 'DEMO_ONLY' | 'PENDING' | 'UNAVAILABLE';
export type ParameterAvailability = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
export type ParameterDataType = 'range' | 'number' | 'string' | 'boolean';

export interface ScatterPoint {
  o2: number;
  burnRate: number;
}

export interface Citation {
  label: string;
  page: number;
  url: string;
}

export interface RelevanceCriteria {
  crewSafetyDirectness: number;
  habitatApplicability: number;
  telemetryFidelity: number;
  materialBreadth: number;
  hardwareHeritage: number;
  recency: number;
}

export interface DynamicParameter {
  id: string;
  experimentId: string;
  name: string;
  description: string;
  value: string;
  unit: string;
  minValue: number | null;
  maxValue: number | null;
  dataType: ParameterDataType;
  measurementSource: string;
  availabilityStatus: ParameterAvailability;
  verificationStatus: VerificationStatus;
  sortOrder: number;
}

export interface DynamicFinding {
  id: number;
  experimentId: string;
  order: number;
  title: string;
  text: string;
  verificationStatus: VerificationStatus;
  sourceLabel: string;
  createdAt: string;
}

export interface ExperimentReference {
  id: string;
  experimentId: string;
  title: string;
  authors: string;
  publicationYear: number;
  documentId: string;
  pageRef: string;
  url: string;
  sourceType: 'NASA_NTRS' | 'PEER_REVIEWED_JOURNAL' | 'ILLUSTRATIVE_DEMO' | 'TECHNICAL_REPORT';
  verificationStatus: VerificationStatus;
}

export interface DatasetVariableMeta {
  name: string;
  unit: string;
  description: string;
  dataType: 'number' | 'string';
}

export interface ExperimentDatasetMeta {
  id: string;
  experimentId: string;
  datasetName: string;
  description: string;
  fileFormat: string;
  sampleCount: number;
  variables: DatasetVariableMeta[];
  sourceName: string;
  sourceUrl: string;
  ntrsId: string;
  datasetStatus: DatasetStatus;
  verificationStatus: VerificationStatus;
  downloadAuthorized: boolean;
  hasCsvData: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetColumnStats {
  name: string;
  unit: string;
  description: string;
  dataType: 'number' | 'string';
  totalCount: number;
  nonNullCount: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
}

export interface DatasetPreviewResponse {
  dataset: ExperimentDatasetMeta;
  columns: string[];
  columnStats: DatasetColumnStats[];
  totalRows: number;
  previewRows: Array<Record<string, string | number | null>>;
  chartRows: Array<Record<string, string | number | null>>;
  provenanceNotice: string;
}

export interface RelatedExperimentMatch {
  id: string;
  slug: string;
  name: string;
  acronym: string;
  fullName: string;
  category: string;
  fuelClass: string;
  combustionType: string;
  image: string;
  shortDescription: string;
  verificationStatus: VerificationStatus;
  relevanceScore: number;
  similarityScore: number;
  matchReasons: string[];
}

export interface ExperimentListItem {
  id: string;
  slug: string;
  name: string;
  acronym: string;
  fullName: string;
  category: string;
  pillar: 'prevention' | 'detection' | 'suppression';
  combustionType: string;
  fuelType: FuelTypeId;
  fuelClass: string;
  researchPlatform: string;
  hardware: string;
  gravity: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  image: string;
  shortDescription: string;
  summary: string;
  whyItMatters: string;
  verificationStatus: VerificationStatus;
  contentSourceType: ContentSourceType;
  isDemo: boolean;
  datasetStatus: DatasetStatus;
  datasetCount: number;
  parameterCount: number;
  findingCount: number;
  referenceCount: number;
  sampleCount: number;
  oxygenRange: [number, number];
  pressureRange: [number, number];
  airflowRange: [number, number];
  criteria: RelevanceCriteria;
  relevanceScore: number;
  rank: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentDetailRecord extends ExperimentListItem {
  scientificObjectives: string[];
  researchBackground: string;
  experimentalSetup: string;
  combustionCharacteristics: string;
  parameterNotes: string;
  datasetName: string;
  ntrsId: string;
  sourceUrl: string;
  scatter: ScatterPoint[];
  citations: Citation[];
  keyFindings: string[];
  parameters: DynamicParameter[];
  findings: DynamicFinding[];
  datasets: ExperimentDatasetMeta[];
  references: ExperimentReference[];
  relatedExperiments: RelatedExperimentMatch[];
  availableSections: {
    overview: boolean;
    objectives: boolean;
    setup: boolean;
    combustionBehaviour: boolean;
    parameters: boolean;
    findings: boolean;
    dataset: boolean;
    charts: boolean;
    references: boolean;
    related: boolean;
  };
}

export interface ExperimentsPaginatedResponse {
  experiments: ExperimentListItem[];
  investigations: ExperimentListItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
  categoryCounts: Array<{ category: string; count: number }>;
  statusCounts: Record<VerificationStatus, number>;
  datasetCounts: Record<string, number>;
}

export interface ExperimentStatisticsResponse {
  totalExperiments: number;
  verifiedCount: number;
  demoCount: number;
  pendingCount: number;
  totalDatasets: number;
  availableDatasetsCount: number;
  totalParameters: number;
  totalFindings: number;
  totalReferences: number;
  totalSamples: number;
  averageRelevanceScore: number;
  categories: Array<{ category: string; count: number; avgRelevance: number }>;
  comparisonSeries: Array<{
    slug: string;
    name: string;
    acronym: string;
    category: string;
    verificationStatus: VerificationStatus;
    relevanceScore: number;
    oxygenMax: number;
    pressureMax: number;
    sampleCount: number;
    parameterCount: number;
  }>;
}

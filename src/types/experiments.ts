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

// ---------- Data Lab (User-Uploaded CSV Inspection & Analytics) ----------

export type DataLabColumnType = 'number' | 'boolean' | 'date' | 'string';

export interface DataLabHistogramBin {
  label: string;
  count: number;
}

export interface DataLabValueCount {
  value: string;
  count: number;
}

export interface DataLabColumnStat {
  name: string;
  dataType: DataLabColumnType;
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
  histogram: DataLabHistogramBin[];
  topValues: DataLabValueCount[];
}

export interface DataLabCorrelationPair {
  colA: string;
  colB: string;
  r: number;
  n: number;
}

export type CombustionValueOrigin =
  | 'measured'
  | 'unit_converted'
  | 'normalized_category'
  | 'missing'
  | 'unsupported';

export interface CombustionVariableMatch {
  role: 'oxygenPct' | 'pressurePsi' | 'airflowCmS' | 'fuelType' | 'temperature' | 'flameCharacteristic';
  label: string;
  columnName: string | null;
  detectedUnit: string;
  targetUnit?: string;
  valueOrigin?: CombustionValueOrigin;
  conversionFormula?: string | null;
  required?: boolean;
  compatible: boolean;
  note: string;
}

export interface CombustionCompatibilityReport {
  isPredictionCompatible: boolean;
  mode: 'PREDICTION_COMPATIBLE_ESTIMATE' | 'STATISTICAL_ANALYSIS_ONLY';
  detectedVariables: CombustionVariableMatch[];
  missingRequiredFeatures: string[];
  warnings: string[];
  summary: string;
  predictionEligibility?: {
    eligible: boolean;
    reason: string;
    modelRequirement: string;
  };
  matchedColumns?: Array<{
    role: string;
    label: string;
    columnName: string;
    originalUnit: string;
    targetUnit: string;
    valueOrigin: 'measured' | 'unit_converted' | 'normalized_category';
  }>;
  unitConversions?: Array<{
    columnName: string;
    fromUnit: string;
    toUnit: string;
    formula: string;
    measuredVsConvertedNote: string;
  }>;
  missingParameters?: Array<{
    role: string;
    label: string;
    required: boolean;
    reason: string;
  }>;
  unsupportedParameters?: Array<{
    columnName: string;
    reason: string;
    observedUnitOrType: string;
  }>;
}

export interface DataLabDatasetSummary {
  id: string;
  originalFilename: string;
  fileSizeBytes: number;
  rowCount: number;
  columnCount: number;
  duplicateRowCount: number;
  totalMissingCells: number;
  provenanceLabel: 'User-Uploaded Data';
  isPredictionCompatible: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataLabDatasetDetail extends DataLabDatasetSummary {
  columns: string[];
  columnStats: DataLabColumnStat[];
  correlations: DataLabCorrelationPair[];
  combustionCompatibility: CombustionCompatibilityReport;
  previewRows: Array<Record<string, string | number | null>>;
  chartRows: Array<Record<string, string | number | null>>;
}

export interface DataLabAnalyzeResponse {
  datasetId: string;
  analyzedAt: string;
  provenanceLabel: 'User-Uploaded Data';
  selectedColumns: string[];
  chartType: 'line' | 'bar' | 'scatter' | 'distribution' | 'correlation';
  xColumn: string | null;
  yColumn: string | null;
  selectedColumnStats: DataLabColumnStat[];
  filteredCorrelations: DataLabCorrelationPair[];
  chartRows: Array<Record<string, string | number | null>>;
  combustionEstimates: {
    performed: boolean;
    disclaimer: string;
    reasonIfSkipped?: string;
    rowsEvaluated: number;
    rowsSkippedOutOfRange: number;
    results: Array<{
      rowIndex: number;
      oxygenPct: number;
      pressurePsi: number;
      airflowCmS: number;
      fuelType: FuelTypeId;
      estimatedRiskScore: number;
      estimatedLocPct: number;
      estimatedBand: 'SAFE' | 'CAUTION' | 'DANGER';
    }>;
  };
}


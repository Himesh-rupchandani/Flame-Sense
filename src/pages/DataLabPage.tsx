import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Flame,
  Loader2,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  analyzeDataLabDatasetClient,
  deleteDataLabDatasetClient,
  ensureDataLabSession,
  fetchDataLabDatasetDetail,
  fetchDataLabDatasets,
  getActiveDataLabSessionToken,
  getDataLabReportDownloadUrl,
  uploadDataLabCsvFile,
  uploadDataLabCsvText,
} from '../services/apiClient.ts';
import type {
  DataLabAnalyzeResponse,
  DataLabColumnStat,
  DataLabDatasetDetail,
  DataLabDatasetSummary,
} from '../types/experiments.ts';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import { RevealOnScroll } from '../components/RevealOnScroll.tsx';

type ChartKind = 'line' | 'bar' | 'scatter' | 'distribution' | 'correlation';

const SAMPLE_COMBUSTION_CSV = [
  'test_id,oxygen_pct,pressure_psi,airflow_cm_s,fuel_type,burn_rate_mm_s,chamber_temp_c',
  'C-101,21.0,14.7,15,solid-fabric,1.9,24.5',
  'C-102,25.5,12.0,22,solid-fabric,3.4,26.1',
  'C-103,30.0,10.2,28,solid-fabric,5.8,28.4',
  'C-104,34.0,10.2,35,plastic,6.9,31.0',
  'C-105,23.0,14.7,10,liquid,2.2,23.8',
  'C-106,38.0,8.0,42,gas,9.4,34.2',
  'C-107,28.0,10.2,18,plastic,4.3,27.0',
  'C-108,42.0,9.5,50,solid-fabric,10.6,36.8',
].join('\n');

const SAMPLE_NON_COMBUSTION_CSV = [
  'sample_id,timestamp_utc,battery_voltage_v,solar_flux_w_m2,cabin_co2_ppm,module_zone',
  'T-01,2026-04-01T00:00:00Z,28.4,1361.2,1820,Destiny',
  'T-02,2026-04-01T01:00:00Z,28.1,1358.9,1910,Destiny',
  'T-03,2026-04-01T02:00:00Z,27.6,0.0,2040,Harmony',
  'T-04,2026-04-01T03:00:00Z,27.9,0.0,1980,Harmony',
  'T-05,2026-04-01T04:00:00Z,28.5,1364.5,1760,Columbus',
  'T-06,2026-04-01T05:00:00Z,28.6,1365.0,1710,Columbus',
  'T-07,2026-04-01T06:00:00Z,28.2,912.4,1850,Kibo',
  'T-08,2026-04-01T07:00:00Z,27.8,1360.8,1950,Kibo',
].join('\n');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtStat(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return '—';
  if (Math.abs(val) >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return Number.isInteger(val) ? String(val) : val.toFixed(3);
}

export const DataLabPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sessionToken, setSessionToken] = useState<string>('');
  const [datasets, setDatasets] = useState<DataLabDatasetSummary[]>([]);
  const [activeDataset, setActiveDataset] = useState<DataLabDatasetDetail | null>(null);
  const [analysis, setAnalysis] = useState<DataLabAnalyzeResponse | null>(null);

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ChartKind>('line');
  const [xColumn, setXColumn] = useState<string>('');
  const [yColumn, setYColumn] = useState<string>('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const [bootLoading, setBootLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [estimating, setEstimating] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const [selectedFileInfo, setSelectedFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const initializeDefaultsForDataset = useCallback((detail: DataLabDatasetDetail) => {
    const numericCols = detail.columnStats
      .filter((c) => c.dataType === 'number' && c.nonNullCount > 0)
      .map((c) => c.name);
    const defaultX = detail.columns[0] || '';
    const defaultY = numericCols[numericCols.length > 1 ? 1 : 0] || numericCols[0] || '';
    const defaultChart: ChartKind = numericCols.length > 0 ? 'line' : 'bar';

    setActiveDataset(detail);
    setSelectedColumns(detail.columns);
    setXColumn(defaultX);
    setYColumn(defaultY);
    setChartType(defaultChart);
    setHoveredIdx(null);
    setAnalysis(null);
  }, []);

  const runAnalysis = useCallback(
    async (
      token: string,
      datasetId: string,
      opts: {
        cols: string[];
        chart: ChartKind;
        xCol: string;
        yCol: string;
        includeEstimates?: boolean;
      }
    ) => {
      setAnalyzing(true);
      if (opts.includeEstimates) setEstimating(true);
      setErrorMsg(null);
      try {
        const res = await analyzeDataLabDatasetClient(token, datasetId, {
          selectedColumns: opts.cols,
          chartType: opts.chart,
          xColumn: opts.xCol || null,
          yColumn: opts.yCol || null,
          includeCompatibilityEstimates: Boolean(opts.includeEstimates),
        });
        setAnalysis(res);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to analyze dataset.');
      } finally {
        setAnalyzing(false);
        setEstimating(false);
      }
    },
    []
  );

  // Boot session & load persisted session datasets
  useEffect(() => {
    let mounted = true;
    (async () => {
      setBootLoading(true);
      try {
        const token = await ensureDataLabSession();
        if (!mounted) return;
        setSessionToken(token);

        const list = await fetchDataLabDatasets(token);
        if (!mounted) return;
        setDatasets(list);

        if (list.length > 0) {
          const detail = await fetchDataLabDatasetDetail(token, list[0].id);
          if (!mounted) return;
          initializeDefaultsForDataset(detail);
          const numericCols = detail.columnStats
            .filter((c) => c.dataType === 'number' && c.nonNullCount > 0)
            .map((c) => c.name);
          await runAnalysis(token, detail.id, {
            cols: detail.columns,
            chart: numericCols.length > 0 ? 'line' : 'bar',
            xCol: detail.columns[0] || '',
            yCol: numericCols[numericCols.length > 1 ? 1 : 0] || numericCols[0] || '',
            includeEstimates: false,
          });
        }
      } catch (err) {
        if (!mounted) return;
        setErrorMsg(err instanceof Error ? err.message : 'Unable to connect to Data Lab backend.');
      } finally {
        if (mounted) setBootLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [initializeDefaultsForDataset, runAnalysis]);

  const handleUploadFile = async (file: File) => {
    setErrorMsg(null);
    setUploadSuccessMsg(null);
    setSelectedFileInfo({ name: file.name, size: file.size });

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg(`Invalid file "${file.name}". Only .csv files are accepted in Data Lab.`);
      return;
    }
    if (file.size === 0) {
      setErrorMsg(`File "${file.name}" is empty.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(`File "${file.name}" (${formatBytes(file.size)}) exceeds the 5 MB limit.`);
      return;
    }

    setUploading(true);
    try {
      const token = sessionToken || (await ensureDataLabSession());
      const detail = await uploadDataLabCsvFile(token, file);
      const activeToken = getActiveDataLabSessionToken(token);
      if (activeToken && activeToken !== sessionToken) setSessionToken(activeToken);
      const list = await fetchDataLabDatasets(activeToken);
      setDatasets(list);
      initializeDefaultsForDataset(detail);
      setUploadSuccessMsg(
        `Uploaded "${detail.originalFilename}" (${detail.rowCount.toLocaleString()} rows × ${detail.columnCount} columns).`
      );

      const numericCols = detail.columnStats
        .filter((c) => c.dataType === 'number' && c.nonNullCount > 0)
        .map((c) => c.name);
      await runAnalysis(activeToken, detail.id, {
        cols: detail.columns,
        chart: numericCols.length > 0 ? 'line' : 'bar',
        xCol: detail.columns[0] || '',
        yCol: numericCols[numericCols.length > 1 ? 1 : 0] || numericCols[0] || '',
        includeEstimates: false,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload CSV.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSampleCsv = async (filename: string, csvContent: string) => {
    setErrorMsg(null);
    setUploadSuccessMsg(null);
    setSelectedFileInfo({ name: filename, size: new Blob([csvContent]).size });
    setUploading(true);
    try {
      const token = sessionToken || (await ensureDataLabSession());
      const detail = await uploadDataLabCsvText(token, filename, csvContent);
      const activeToken = getActiveDataLabSessionToken(token);
      if (activeToken && activeToken !== sessionToken) setSessionToken(activeToken);
      const list = await fetchDataLabDatasets(activeToken);
      setDatasets(list);
      initializeDefaultsForDataset(detail);
      setUploadSuccessMsg(
        `Loaded illustrative sample "${detail.originalFilename}" (${detail.rowCount} rows × ${detail.columnCount} columns).`
      );

      const numericCols = detail.columnStats
        .filter((c) => c.dataType === 'number' && c.nonNullCount > 0)
        .map((c) => c.name);
      await runAnalysis(activeToken, detail.id, {
        cols: detail.columns,
        chart: numericCols.length > 0 ? 'line' : 'bar',
        xCol: detail.columns[0] || '',
        yCol: numericCols[numericCols.length > 1 ? 1 : 0] || numericCols[0] || '',
        includeEstimates: false,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load sample CSV.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDataset = async (id: string) => {
    if (!sessionToken) return;
    setErrorMsg(null);
    setUploadSuccessMsg(null);
    setConfirmDeleteId(null);
    setAnalyzing(true);
    try {
      const detail = await fetchDataLabDatasetDetail(sessionToken, id);
      const activeToken = getActiveDataLabSessionToken(sessionToken);
      if (activeToken && activeToken !== sessionToken) setSessionToken(activeToken);
      initializeDefaultsForDataset(detail);
      const numericCols = detail.columnStats
        .filter((c) => c.dataType === 'number' && c.nonNullCount > 0)
        .map((c) => c.name);
      await runAnalysis(activeToken, detail.id, {
        cols: detail.columns,
        chart: numericCols.length > 0 ? 'line' : 'bar',
        xCol: detail.columns[0] || '',
        yCol: numericCols[numericCols.length > 1 ? 1 : 0] || numericCols[0] || '',
        includeEstimates: false,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to switch dataset.');
      setAnalyzing(false);
    }
  };

  const handleDeleteDataset = async (id: string) => {
    if (!sessionToken) return;
    setErrorMsg(null);
    try {
      await deleteDataLabDatasetClient(sessionToken, id);
      const updated = datasets.filter((d) => d.id !== id);
      setDatasets(updated);
      setConfirmDeleteId(null);
      if (activeDataset?.id === id) {
        if (updated.length > 0) {
          await handleSelectDataset(updated[0].id);
        } else {
          setActiveDataset(null);
          setAnalysis(null);
          setSelectedColumns([]);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete dataset.');
    }
  };

  const numericColumns = useMemo(() => {
    if (!activeDataset) return [];
    return activeDataset.columnStats
      .filter((c) => c.dataType === 'number' && c.nonNullCount > 0)
      .map((c) => c.name);
  }, [activeDataset]);

  const activeStats: DataLabColumnStat[] = useMemo(() => {
    if (analysis?.selectedColumnStats && analysis.selectedColumnStats.length > 0) {
      return analysis.selectedColumnStats;
    }
    if (!activeDataset) return [];
    return activeDataset.columnStats.filter((c) => selectedColumns.includes(c.name));
  }, [analysis, activeDataset, selectedColumns]);

  const activeCorrelations = useMemo(() => {
    if (analysis?.filteredCorrelations) return analysis.filteredCorrelations;
    if (!activeDataset) return [];
    return activeDataset.correlations.filter(
      (c) => selectedColumns.includes(c.colA) && selectedColumns.includes(c.colB)
    );
  }, [analysis, activeDataset, selectedColumns]);

  const chartRows = useMemo(() => {
    if (analysis?.chartRows && analysis.chartRows.length > 0) return analysis.chartRows;
    return activeDataset?.chartRows || [];
  }, [analysis, activeDataset]);

  const effectiveX = xColumn && activeDataset?.columns.includes(xColumn) ? xColumn : activeDataset?.columns[0] || '';
  const effectiveY =
    yColumn && numericColumns.includes(yColumn)
      ? yColumn
      : numericColumns[numericColumns.length > 1 ? 1 : 0] || numericColumns[0] || '';

  const chartPoints = useMemo(() => {
    if (!effectiveY || chartRows.length === 0) return [];
    return chartRows
      .map((row, idx) => {
        const yRaw = row[effectiveY];
        if (yRaw === null || yRaw === undefined || yRaw === '') return null;
        const yNum = typeof yRaw === 'number' ? yRaw : Number(yRaw);
        if (!Number.isFinite(yNum)) return null;
        const xRaw = effectiveX ? row[effectiveX] : idx + 1;
        const xParsed =
          xRaw !== null && xRaw !== undefined && xRaw !== '' ? Number(xRaw) : Number.NaN;
        return {
          idx,
          xLabel: xRaw !== null && xRaw !== undefined && xRaw !== '' ? String(xRaw) : `#${idx + 1}`,
          xNum: Number.isFinite(xParsed) ? xParsed : idx + 1,
          yNum,
        };
      })
      .filter((p): p is { idx: number; xLabel: string; xNum: number; yNum: number } => p !== null);
  }, [chartRows, effectiveX, effectiveY]);

  const selectedYStat = useMemo(
    () => activeDataset?.columnStats.find((s) => s.name === effectiveY) || null,
    [activeDataset, effectiveY]
  );

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(col)) {
        return prev.length > 1 ? prev.filter((c) => c !== col) : prev;
      }
      return [...prev, col];
    });
  };

  const handleApplyAnalysis = (nextChart?: ChartKind, nextX?: string, nextY?: string) => {
    if (!activeDataset || !sessionToken) return;
    const cType = nextChart ?? chartType;
    const xC = nextX ?? effectiveX;
    const yC = nextY ?? effectiveY;
    runAnalysis(sessionToken, activeDataset.id, {
      cols: selectedColumns,
      chart: cType,
      xCol: xC,
      yCol: yC,
      includeEstimates: Boolean(analysis?.combustionEstimates?.performed),
    });
  };

  const width = 620;
  const height = 250;
  const padL = 54;
  const padR = 24;
  const padT = 22;
  const padB = 44;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Data Lab' }]} />

        {/* Header */}
        <RevealOnScroll className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
                CSV Inspection &amp; Research Sandbox
              </span>
            </div>
            <h1 className="font-serif-display text-3xl font-normal tracking-tight text-[#F3EFE8] sm:text-4xl lg:text-[44px]">
              Interactive <span className="italic text-[#D97B29]">Data Lab</span>
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm sm:text-base text-[#C2BCB2]">
              Upload any structured CSV dataset for automated schema profiling, statistical summaries, correlation mapping, interactive charts, and downloadable PDF, JSON, or CSV reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border border-white/15 bg-[#0E0E11] px-3.5 py-2 text-[11px] font-mono-data text-[#C2BCB2]">
            <Database className="h-3.5 w-3.5 text-[#D97B29]" />
            <span>Provenance: User-Uploaded Data · 24h Session Isolation</span>
          </div>
        </RevealOnScroll>

        {/* Top Upload & Session Switcher Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mb-8">
          {/* Upload Dropzone */}
          <div className="lg:col-span-7 editorial-panel p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#D97B29]" />
                <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                  Upload CSV Dataset
                </h2>
              </div>
              <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#8A847B]">
                Max 5 MB · 25,000 Rows · UTF-8 .CSV
              </span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleUploadFile(dropped);
              }}
              className={`flex flex-col items-center justify-center border border-dashed p-7 text-center transition-colors ${
                dragActive
                  ? 'border-[#D97B29] bg-[#D97B29]/10'
                  : 'border-white/20 bg-[#060607] hover:border-[#D97B29]/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                id="datalab-csv-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadFile(f);
                }}
              />

              {uploading ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Loader2 className="h-7 w-7 animate-spin text-[#D97B29]" />
                  <p className="text-xs text-[#C2BCB2]">
                    Validating CSV structure &amp; computing column statistics...
                  </p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="mb-3 h-8 w-8 text-[#D97B29]" />
                  <p className="text-sm font-medium text-[#F3EFE8]">
                    Drag &amp; drop your <span className="font-mono-data text-[#D97B29]">.csv</span> file here
                  </p>
                  <p className="mt-1 text-xs text-[#8A847B]">
                    Or browse from disk. Data stays strictly scoped to your browser session.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <label
                      htmlFor="datalab-csv-input"
                      className="cursor-pointer border border-[#D97B29] bg-[#D97B29] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#060607] transition-colors hover:bg-[#E68A38]"
                    >
                      Browse .CSV File
                    </label>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleCsv('illustrative_combustion_sample.csv', SAMPLE_COMBUSTION_CSV)}
                      className="cursor-pointer border border-white/20 bg-[#0E0E11] px-3.5 py-2 text-[11px] font-medium text-[#C2BCB2] transition-colors hover:border-[#D97B29] hover:text-[#F3EFE8]"
                    >
                      Try Sample Combustion CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleCsv('iss_power_telemetry_demo.csv', SAMPLE_NON_COMBUSTION_CSV)}
                      className="cursor-pointer border border-white/20 bg-[#0E0E11] px-3.5 py-2 text-[11px] font-medium text-[#C2BCB2] transition-colors hover:border-[#D97B29] hover:text-[#F3EFE8]"
                    >
                      Try Non-Combustion CSV
                    </button>
                  </div>
                </>
              )}
            </div>

            {selectedFileInfo && (
              <div className="mt-3 flex items-center justify-between border border-white/10 bg-[#060607] px-3 py-2 text-xs">
                <span className="truncate font-mono-data text-[#C2BCB2]">
                  Last selected: <strong className="text-[#F3EFE8]">{selectedFileInfo.name}</strong>
                </span>
                <span className="font-mono-data text-[#8A847B] shrink-0 ml-2">
                  {formatBytes(selectedFileInfo.size)}
                </span>
              </div>
            )}

            {uploadSuccessMsg && (
              <div
                role="status"
                className="mt-3 flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 border border-red-500/45 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Session Uploaded Datasets List */}
          <div className="lg:col-span-5 editorial-panel p-6 flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                  Session Datasets
                </h2>
                <span className="font-mono-data text-xs text-[#D97B29] tabular-nums">
                  {datasets.length} Active
                </span>
              </div>

              {bootLoading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-xs text-[#8A847B]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#D97B29]" />
                  <span>Initializing isolated workspace...</span>
                </div>
              ) : datasets.length === 0 ? (
                <div className="border border-white/10 bg-[#060607] p-6 text-center text-xs text-[#8A847B]">
                  No datasets uploaded in this session yet. Upload a CSV file or load one of the illustrative demo CSVs to begin profiling.
                </div>
              ) : (
                <div className="max-h-[245px] space-y-2 overflow-y-auto pr-1">
                  {datasets.map((ds) => {
                    const isActive = activeDataset?.id === ds.id;
                    const isDeleting = confirmDeleteId === ds.id;
                    return (
                      <div
                        key={ds.id}
                        className={`border p-3 transition-colors ${
                          isActive
                            ? 'border-[#D97B29] bg-[#D97B29]/10'
                            : 'border-white/10 bg-[#060607] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectDataset(ds.id)}
                            className="flex-1 cursor-pointer text-left"
                          >
                            <div className="truncate font-mono-data text-xs font-semibold text-[#F3EFE8]">
                              {ds.originalFilename}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono-data text-[#8A847B]">
                              <span>{ds.rowCount.toLocaleString()} rows</span>
                              <span>·</span>
                              <span>{ds.columnCount} cols</span>
                              <span>·</span>
                              <span>{formatBytes(ds.fileSizeBytes)}</span>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`border px-1.5 py-0.5 text-[9px] font-mono-data uppercase ${
                                ds.isPredictionCompatible
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                  : 'border-white/15 bg-white/5 text-[#A9A39A]'
                              }`}
                            >
                              {ds.isPredictionCompatible ? 'Combustion' : 'Stats Only'}
                            </span>

                            {!isDeleting ? (
                              <button
                                type="button"
                                aria-label={`Delete ${ds.originalFilename}`}
                                onClick={() => setConfirmDeleteId(ds.id)}
                                className="cursor-pointer border border-white/10 p-1 text-[#8A847B] hover:border-red-500/45 hover:text-red-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDataset(ds.id)}
                                  className="cursor-pointer border border-red-500/60 bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-200 hover:bg-red-500 hover:text-[#060607]"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="cursor-pointer border border-white/15 px-1.5 py-0.5 text-[10px] text-[#C2BCB2]"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-[#8A847B]">
              Uploaded CSVs never enter the verified NASA archive and automatically expire after 24 hours.
            </div>
          </div>
        </div>

        {/* Active Dataset Workspace */}
        {activeDataset && (
          <div className="space-y-8">
            {/* Summary KPIs & Report Download Bar */}
            <section className="editorial-panel p-6">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="border border-[#D97B29]/55 bg-[#D97B29]/10 px-2 py-0.5 font-mono-data text-[10px] uppercase tracking-[0.14em] text-[#E68A38]">
                      {activeDataset.provenanceLabel}
                    </span>
                    <span className="font-mono-data text-xs text-[#8A847B]">
                      ID: {activeDataset.id.slice(0, 8)}…
                    </span>
                  </div>
                  <h2 className="mt-2 font-serif-display text-2xl font-normal text-[#F3EFE8]">
                    {activeDataset.originalFilename}
                  </h2>
                </div>

                {/* Downloadable Reports */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={getDataLabReportDownloadUrl(
                      sessionToken,
                      activeDataset.id,
                      'csv',
                      selectedColumns
                    )}
                    download
                    className="inline-flex items-center gap-2 border border-white/20 bg-[#060607] px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3EFE8] transition-colors hover:border-[#D97B29] hover:text-[#E68A38]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Analyzed CSV</span>
                  </a>
                  <a
                    href={getDataLabReportDownloadUrl(
                      sessionToken,
                      activeDataset.id,
                      'json',
                      selectedColumns
                    )}
                    download
                    className="inline-flex items-center gap-2 border border-white/20 bg-[#060607] px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3EFE8] transition-colors hover:border-[#D97B29] hover:text-[#E68A38]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>JSON Summary</span>
                  </a>
                  <a
                    href={getDataLabReportDownloadUrl(
                      sessionToken,
                      activeDataset.id,
                      'pdf',
                      selectedColumns
                    )}
                    download
                    className="inline-flex items-center gap-2 border border-[#D97B29] bg-[#D97B29] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#060607] transition-colors hover:bg-[#E68A38]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download PDF Report</span>
                  </a>
                </div>
              </div>

              {/* Metrics Strip */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="border border-white/10 bg-[#060607] p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">Rows</div>
                  <div className="mt-1 font-mono-data text-2xl font-semibold text-[#F3EFE8] tabular-nums">
                    {activeDataset.rowCount.toLocaleString()}
                  </div>
                </div>
                <div className="border border-white/10 bg-[#060607] p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">Columns</div>
                  <div className="mt-1 font-mono-data text-2xl font-semibold text-[#F3EFE8] tabular-nums">
                    {activeDataset.columnCount}
                  </div>
                </div>
                <div className="border border-white/10 bg-[#060607] p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">Duplicate Rows</div>
                  <div className="mt-1 font-mono-data text-2xl font-semibold text-[#F3EFE8] tabular-nums">
                    {activeDataset.duplicateRowCount.toLocaleString()}
                  </div>
                </div>
                <div className="border border-white/10 bg-[#060607] p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">Missing Cells</div>
                  <div className="mt-1 font-mono-data text-2xl font-semibold text-[#F3EFE8] tabular-nums">
                    {activeDataset.totalMissingCells.toLocaleString()}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 border border-white/10 bg-[#060607] p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">Research Bridge</div>
                  <div
                    className={`mt-1.5 font-mono-data text-xs font-semibold ${
                      activeDataset.isPredictionCompatible ? 'text-emerald-300' : 'text-[#E68A38]'
                    }`}
                  >
                    {activeDataset.isPredictionCompatible ? 'Combustion Compatible' : 'Stats Analysis Only'}
                  </div>
                </div>
              </div>

              {/* Column Selector Controls */}
              <div className="mt-5 border border-white/10 bg-[#060607] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#C2BCB2]">
                    Active Columns ({selectedColumns.length}/{activeDataset.columns.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedColumns(activeDataset.columns)}
                      className="cursor-pointer border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                    >
                      Select All
                    </button>
                    {numericColumns.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedColumns(numericColumns)}
                        className="cursor-pointer border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                      >
                        Numeric Only
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => handleApplyAnalysis()}
                      className="cursor-pointer border border-[#D97B29]/75 bg-[#D97B29]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607] disabled:opacity-50"
                    >
                      {analyzing ? 'Updating...' : 'Apply Column Selection'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeDataset.columnStats.map((col) => {
                    const checked = selectedColumns.includes(col.name);
                    return (
                      <label
                        key={col.name}
                        className={`inline-flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 text-xs font-mono-data transition-colors ${
                          checked
                            ? 'border-[#D97B29]/70 bg-[#D97B29]/12 text-[#F3EFE8]'
                            : 'border-white/10 bg-[#0E0E11] text-[#8A847B]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleColumn(col.name)}
                          className="accent-[#D97B29]"
                        />
                        <span>{col.name}</span>
                        <span className="text-[10px] text-[#8A847B]">({col.dataType})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Interactive Chart & Correlation Workspace */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Interactive Chart */}
              <div className="lg:col-span-8 editorial-panel p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#D97B29]" />
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                      Interactive Data Visualization
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'line', label: 'Line' },
                        { id: 'bar', label: 'Bar' },
                        { id: 'scatter', label: 'Scatter' },
                        { id: 'distribution', label: 'Distribution' },
                        { id: 'correlation', label: 'Correlations' },
                      ] as Array<{ id: ChartKind; label: string }>
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setChartType(m.id);
                          setHoveredIdx(null);
                          handleApplyAnalysis(m.id, effectiveX, effectiveY);
                        }}
                        className={`cursor-pointer border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors ${
                          chartType === m.id
                            ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#E68A38]'
                            : 'border-white/15 bg-[#060607] text-[#A9A39A] hover:border-white/30 hover:text-[#F3EFE8]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Axis Controls */}
                {chartType !== 'correlation' && (
                  <div className="mb-4 flex flex-wrap items-center gap-4 border border-white/10 bg-[#060607] px-3.5 py-2.5 text-xs">
                    {chartType !== 'distribution' && (
                      <label className="flex items-center gap-2 text-[#A9A39A]">
                        <span>X-Axis:</span>
                        <select
                          value={effectiveX}
                          onChange={(e) => {
                            setXColumn(e.target.value);
                            handleApplyAnalysis(chartType, e.target.value, effectiveY);
                          }}
                          className="cursor-pointer border border-white/15 bg-[#0E0E11] px-2.5 py-1 text-xs font-mono-data text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                        >
                          {activeDataset.columns.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="flex items-center gap-2 text-[#A9A39A]">
                      <span>{chartType === 'distribution' ? 'Histogram Variable:' : 'Y-Axis (Numeric):'}</span>
                      <select
                        value={effectiveY}
                        onChange={(e) => {
                          setYColumn(e.target.value);
                          handleApplyAnalysis(chartType, effectiveX, e.target.value);
                        }}
                        className="cursor-pointer border border-white/15 bg-[#0E0E11] px-2.5 py-1 text-xs font-mono-data text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      >
                        {numericColumns.length === 0 && <option value="">No numeric columns</option>}
                        {numericColumns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {/* Chart Renderers */}
                {chartType !== 'correlation' && chartPoints.length === 0 && (
                  <div className="border border-white/10 bg-[#060607] p-8 text-center text-xs text-[#8A847B]">
                    No numeric column values available to plot. Select a numeric column or inspect categorical top counts in the summary table below.
                  </div>
                )}

                {(chartType === 'line' || chartType === 'scatter') && chartPoints.length > 0 && (() => {
                  const ordered =
                    chartType === 'line' && Number.isFinite(chartPoints[0]?.xNum)
                      ? [...chartPoints].sort((a, b) => a.xNum - b.xNum)
                      : chartPoints;
                  const minX = Math.min(...ordered.map((p) => p.xNum));
                  const maxX = Math.max(...ordered.map((p) => p.xNum));
                  const minY = Math.min(0, ...ordered.map((p) => p.yNum));
                  const maxY = Math.max(...ordered.map((p) => p.yNum)) * 1.12 || 1;

                  const mapX = (xVal: number, idx: number) =>
                    maxX === minX
                      ? padL + (idx / Math.max(1, ordered.length - 1)) * plotW
                      : padL + ((xVal - minX) / (maxX - minX)) * plotW;
                  const mapY = (yVal: number) =>
                    height - padB - ((yVal - minY) / Math.max(0.0001, maxY - minY)) * plotH;

                  const pathD = ordered
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.xNum, i).toFixed(1)} ${mapY(p.yNum).toFixed(1)}`)
                    .join(' ');

                  return (
                    <svg
                      viewBox={`0 0 ${width} ${height}`}
                      className="h-auto w-full border border-white/10 bg-[#060607] p-2"
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="rgba(255,255,255,0.2)" />
                      <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="rgba(255,255,255,0.2)" />
                      <text x={padL - 8} y={padT + 8} textAnchor="end" fill="#8A847B" fontSize="10" fontFamily="monospace">
                        {maxY.toFixed(1)}
                      </text>
                      <text x={padL - 8} y={height - padB} textAnchor="end" fill="#8A847B" fontSize="10" fontFamily="monospace">
                        {minY.toFixed(1)}
                      </text>
                      {chartType === 'line' && ordered.length > 1 && (
                        <path d={pathD} fill="none" stroke="#D97B29" strokeWidth="2.4" strokeLinecap="round" />
                      )}
                      {ordered.map((p, i) => {
                        const cx = mapX(p.xNum, i);
                        const cy = mapY(p.yNum);
                        const isHov = hoveredIdx === i;
                        return (
                          <g key={`${p.idx}-${i}`} onMouseEnter={() => setHoveredIdx(i)} className="cursor-pointer">
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isHov ? 6 : 4}
                              fill={isHov ? '#E68A38' : '#F3EFE8'}
                              stroke="#D97B29"
                              strokeWidth="1.5"
                            />
                            {(ordered.length <= 12 || i % Math.ceil(ordered.length / 8) === 0 || isHov) && (
                              <text x={cx} y={height - 18} textAnchor="middle" fill="#8A847B" fontSize="9.5" fontFamily="monospace">
                                {p.xLabel.slice(0, 9)}
                              </text>
                            )}
                            {isHov && (
                              <g>
                                <rect
                                  x={Math.min(width - 148, Math.max(padL, cx - 70))}
                                  y={Math.max(4, cy - 32)}
                                  width="140"
                                  height="22"
                                  fill="#0E0E11"
                                  stroke="#D97B29"
                                />
                                <text
                                  x={Math.min(width - 78, Math.max(padL + 70, cx))}
                                  y={Math.max(19, cy - 17)}
                                  textAnchor="middle"
                                  fill="#F3EFE8"
                                  fontSize="10"
                                  fontFamily="monospace"
                                >
                                  {p.xLabel.slice(0, 10)}: {p.yNum}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                      <text x={width / 2} y={height - 3} textAnchor="middle" fill="#A9A39A" fontSize="10">
                        {effectiveX} vs. {effectiveY} ({ordered.length} plotted points)
                      </text>
                    </svg>
                  );
                })()}

                {chartType === 'bar' && chartPoints.length > 0 && (() => {
                  const sliced = chartPoints.slice(0, 18);
                  const maxY = Math.max(...sliced.map((p) => p.yNum)) * 1.15 || 1;
                  const step = plotW / sliced.length;
                  const barW = Math.max(10, Math.min(34, step * 0.64));

                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full border border-white/10 bg-[#060607] p-2">
                      <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="rgba(255,255,255,0.2)" />
                      <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="rgba(255,255,255,0.2)" />
                      {sliced.map((p, i) => {
                        const barH = Math.max(4, (Math.max(0, p.yNum) / maxY) * plotH);
                        const x = padL + i * step + (step - barW) / 2;
                        const y = height - padB - barH;
                        return (
                          <g key={`${p.idx}-${i}`}>
                            <rect x={x} y={y} width={barW} height={barH} fill="#D97B29" opacity={0.85} />
                            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="#F3EFE8" fontSize="9" fontFamily="monospace">
                              {p.yNum}
                            </text>
                            <text x={x + barW / 2} y={height - 18} textAnchor="middle" fill="#8A847B" fontSize="9" fontFamily="monospace">
                              {p.xLabel.slice(0, 7)}
                            </text>
                          </g>
                        );
                      })}
                      <text x={width / 2} y={height - 3} textAnchor="middle" fill="#A9A39A" fontSize="10">
                        {effectiveY} across {effectiveX} (showing {sliced.length} rows)
                      </text>
                    </svg>
                  );
                })()}

                {chartType === 'distribution' && selectedYStat && selectedYStat.histogram.length > 0 && (() => {
                  const bins = selectedYStat.histogram;
                  const maxCount = Math.max(...bins.map((b) => b.count), 1);
                  const step = plotW / bins.length;
                  const barW = Math.max(18, step * 0.65);

                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full border border-white/10 bg-[#060607] p-2">
                      <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="rgba(255,255,255,0.2)" />
                      <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="rgba(255,255,255,0.2)" />
                      {bins.map((b, i) => {
                        const barH = Math.max(4, (b.count / maxCount) * plotH);
                        const x = padL + i * step + (step - barW) / 2;
                        const y = height - padB - barH;
                        return (
                          <g key={b.label}>
                            <rect x={x} y={y} width={barW} height={barH} fill="#D97B29" opacity={0.84} />
                            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="#F3EFE8" fontSize="10" fontFamily="monospace">
                              n={b.count}
                            </text>
                            <text x={x + barW / 2} y={height - 18} textAnchor="middle" fill="#8A847B" fontSize="9" fontFamily="monospace">
                              {b.label}
                            </text>
                          </g>
                        );
                      })}
                      <text x={width / 2} y={height - 3} textAnchor="middle" fill="#A9A39A" fontSize="10">
                        Frequency Histogram — {effectiveY} (n={selectedYStat.nonNullCount})
                      </text>
                    </svg>
                  );
                })()}

                {chartType === 'correlation' && (
                  <div className="border border-white/10 bg-[#060607] p-4">
                    {activeCorrelations.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#8A847B]">
                        At least two numeric columns with ≥ 2 overlapping rows are needed to compute Pearson correlations.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[#8A847B]">
                          Pearson Correlation Coefficient (r)
                        </div>
                        {activeCorrelations.slice(0, 10).map((pair) => {
                          const absPct = Math.min(100, Math.abs(pair.r) * 100);
                          const positive = pair.r >= 0;
                          return (
                            <div key={`${pair.colA}-${pair.colB}`} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-mono-data">
                                <span className="text-[#F3EFE8]">
                                  {pair.colA} ↔ {pair.colB}
                                  <span className="ml-2 text-[10px] text-[#8A847B]">(n={pair.n})</span>
                                </span>
                                <span className={positive ? 'text-[#E68A38]' : 'text-[#91B3B9]'}>
                                  r = {pair.r >= 0 ? `+${pair.r.toFixed(3)}` : pair.r.toFixed(3)}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full ${positive ? 'bg-[#D97B29]' : 'bg-[#477C8B]'}`}
                                  style={{ width: `${Math.max(3, absPct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Combustion Research Compatibility & Empirical Bridge Panel */}
              <div className="lg:col-span-4 editorial-panel p-6 flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-[#D97B29]" />
                      <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                        Combustion Bridge
                      </h2>
                    </div>
                    <span
                      className={`border px-2 py-0.5 font-mono-data text-[10px] uppercase ${
                        activeDataset.combustionCompatibility.isPredictionCompatible
                          ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300'
                          : 'border-[#D97B29]/55 bg-[#D97B29]/10 text-[#E68A38]'
                      }`}
                    >
                      {activeDataset.combustionCompatibility.isPredictionCompatible
                        ? 'Compatible'
                        : 'Stats Only'}
                    </span>
                  </div>

                  {/* Prediction Eligibility & Reason */}
                  <div
                    className={`border p-3 text-xs ${
                      activeDataset.combustionCompatibility.isPredictionCompatible
                        ? 'border-emerald-500/35 bg-emerald-500/5'
                        : 'border-[#D97B29]/45 bg-[#D97B29]/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A847B]">
                        Prediction Eligibility
                      </span>
                      <span
                        className={`font-mono-data text-[10px] font-semibold uppercase ${
                          activeDataset.combustionCompatibility.isPredictionCompatible
                            ? 'text-emerald-300'
                            : 'text-[#E68A38]'
                        }`}
                      >
                        {activeDataset.combustionCompatibility.isPredictionCompatible
                          ? 'Eligible (4/4 Inputs)'
                          : 'Disabled'}
                      </span>
                    </div>
                    <p className="mt-1.5 leading-relaxed text-[#C2BCB2]">
                      {activeDataset.combustionCompatibility.predictionEligibility?.reason ||
                        activeDataset.combustionCompatibility.summary}
                    </p>
                    {activeDataset.combustionCompatibility.predictionEligibility?.modelRequirement && (
                      <div className="mt-2 border-t border-white/10 pt-1.5 font-mono-data text-[10px] text-[#8A847B]">
                        {activeDataset.combustionCompatibility.predictionEligibility.modelRequirement}
                      </div>
                    )}
                  </div>

                  {/* Matched Columns (Measured vs Unit-Converted vs Normalized) */}
                  {activeDataset.combustionCompatibility.matchedColumns &&
                    activeDataset.combustionCompatibility.matchedColumns.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                          <span>Matched Model Inputs</span>
                          <span className="font-mono-data text-[#C2BCB2]">
                            {activeDataset.combustionCompatibility.matchedColumns.length}/4 Verified
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {activeDataset.combustionCompatibility.matchedColumns.map((m) => {
                            const originBadge =
                              m.valueOrigin === 'unit_converted'
                                ? {
                                    text: 'Unit-Converted',
                                    cls: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
                                  }
                                : m.valueOrigin === 'normalized_category'
                                  ? {
                                      text: 'Normalized',
                                      cls: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
                                    }
                                  : {
                                      text: 'Measured',
                                      cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                                    };
                            return (
                              <div
                                key={`${m.role}-${m.columnName}`}
                                className="border border-white/10 bg-[#060607] px-3 py-2 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-[#F3EFE8]">{m.label}</span>
                                  <span
                                    className={`border px-1.5 py-0.5 font-mono-data text-[9px] uppercase ${originBadge.cls}`}
                                  >
                                    {originBadge.text}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2 font-mono-data text-[10px] text-[#8A847B]">
                                  <span className="text-[#C2BCB2]">{m.columnName}</span>
                                  <span>
                                    {m.originalUnit === m.targetUnit
                                      ? m.targetUnit
                                      : `${m.originalUnit} → ${m.targetUnit}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* Documented Unit Conversions */}
                  {activeDataset.combustionCompatibility.unitConversions &&
                    activeDataset.combustionCompatibility.unitConversions.length > 0 && (
                      <div className="mt-4 border border-sky-400/35 bg-sky-400/5 p-3 text-[11px]">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                          Documented Unit Conversions ({activeDataset.combustionCompatibility.unitConversions.length})
                        </div>
                        <div className="space-y-2">
                          {activeDataset.combustionCompatibility.unitConversions.map((uc) => (
                            <div key={uc.columnName} className="border-t border-white/10 pt-1.5 first:border-t-0 first:pt-0">
                              <div className="font-mono-data text-[10px] text-[#F3EFE8]">
                                {uc.columnName}: {uc.formula}
                              </div>
                              <div className="mt-0.5 text-[10px] text-[#8A847B]">
                                {uc.measuredVsConvertedNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Missing Required Parameters */}
                  {activeDataset.combustionCompatibility.missingParameters &&
                    activeDataset.combustionCompatibility.missingParameters.length > 0 && (
                      <div className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-[11px]">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>
                            Missing Parameters ({activeDataset.combustionCompatibility.missingParameters.length})
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {activeDataset.combustionCompatibility.missingParameters.map((mp) => (
                            <div key={mp.role} className="text-[#F3EFE8]">
                              <span className="font-semibold">{mp.label}:</span>{' '}
                              <span className="text-[#C2BCB2]">{mp.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Fallback Detected Variable Mapping (for legacy or detailed view) */}
                  {(!activeDataset.combustionCompatibility.matchedColumns ||
                    activeDataset.combustionCompatibility.matchedColumns.length === 0) &&
                    (!activeDataset.combustionCompatibility.missingParameters ||
                      activeDataset.combustionCompatibility.missingParameters.length === 0) && (
                      <div className="mt-4 space-y-2">
                        {activeDataset.combustionCompatibility.detectedVariables.map((v) => (
                          <div
                            key={v.role}
                            className="border border-white/10 bg-[#060607] px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[#F3EFE8]">{v.label}</span>
                              <span
                                className={`font-mono-data text-[10px] ${
                                  v.compatible ? 'text-emerald-300' : 'text-[#8A847B]'
                                }`}
                              >
                                {v.columnName ? `${v.columnName} (${v.detectedUnit})` : 'Not detected'}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#8A847B]">{v.note}</div>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Unsupported / Non-Model Parameters */}
                  {activeDataset.combustionCompatibility.unsupportedParameters &&
                    activeDataset.combustionCompatibility.unsupportedParameters.length > 0 && (
                      <details className="mt-4 border border-white/10 bg-[#060607] p-3 text-[11px]">
                        <summary className="cursor-pointer select-none font-mono-data text-[10px] uppercase tracking-[0.12em] text-[#8A847B] hover:text-[#F3EFE8]">
                          Unsupported / Outcome Columns ({activeDataset.combustionCompatibility.unsupportedParameters.length})
                        </summary>
                        <div className="mt-2.5 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {activeDataset.combustionCompatibility.unsupportedParameters.map((up) => (
                            <div key={up.columnName} className="border-t border-white/10 pt-1.5 first:border-t-0 first:pt-0">
                              <div className="flex items-center justify-between gap-2 font-mono-data text-[10px]">
                                <span className="text-[#F3EFE8]">{up.columnName}</span>
                                <span className="text-[#8A847B]">{up.observedUnitOrType}</span>
                              </div>
                              <div className="text-[10px] text-[#8A847B]">{up.reason}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                  {activeDataset.combustionCompatibility.warnings.length > 0 && (
                    <div className="mt-4 border border-[#D97B29]/40 bg-[#D97B29]/10 p-3 text-[11px] text-[#F3EFE8]">
                      <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#E68A38]">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Compatibility Checks</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-[#C2BCB2]">
                        {activeDataset.combustionCompatibility.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Button strictly gated on compatibility */}
                <div className="mt-5 border-t border-white/10 pt-4">
                  {activeDataset.combustionCompatibility.isPredictionCompatible ? (
                    <button
                      type="button"
                      disabled={estimating}
                      onClick={() =>
                        runAnalysis(sessionToken, activeDataset.id, {
                          cols: selectedColumns,
                          chart: chartType,
                          xCol: effectiveX,
                          yCol: effectiveY,
                          includeEstimates: true,
                        })
                      }
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-[#D97B29] bg-[#D97B29] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#060607] hover:bg-[#E68A38] disabled:opacity-60"
                    >
                      {estimating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Running Formula Estimates...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Compute Empirical Row Estimates</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="border border-white/10 bg-[#060607] p-3 text-[11px] leading-relaxed text-[#8A847B]">
                      Fire risk prediction is <strong className="text-[#F3EFE8]">disabled</strong> for this CSV because required combustion parameters/units were not verified. Statistical profiling and charts remain fully available.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Row-Level Empirical Formula Estimates (Only Shown When Verified Compatible & Run) */}
            {analysis?.combustionEstimates?.performed && (
              <section className="editorial-panel p-6">
                <div className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                        Row-Level Empirical Formula Estimates
                      </h2>
                      <span className="border border-[#D97B29]/45 bg-[#D97B29]/10 px-2 py-0.5 font-mono-data text-[10px] uppercase text-[#E68A38]">
                        Calculated Heuristic (Not Measured Data)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#E68A38]">
                      {analysis.combustionEstimates.disclaimer}
                    </p>
                  </div>
                  <div className="font-mono-data text-xs text-[#C2BCB2]">
                    {analysis.combustionEstimates.rowsEvaluated} Evaluated ·{' '}
                    {analysis.combustionEstimates.rowsSkippedOutOfRange} Missing / Out-of-Range Skipped
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/12 bg-[#09090B] text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                        <th className="py-2.5 px-3">Row #</th>
                        <th className="py-2.5 px-3">O₂ (%)</th>
                        <th className="py-2.5 px-3">Pressure (psi)</th>
                        <th className="py-2.5 px-3">Airflow (cm/s)</th>
                        <th className="py-2.5 px-3">Fuel</th>
                        <th className="py-2.5 px-3">Est. LOC (%)</th>
                        <th className="py-2.5 px-3">Est. Risk</th>
                        <th className="py-2.5 px-3">Band (Heuristic)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8 font-mono-data">
                      {analysis.combustionEstimates.results.slice(0, 25).map((r) => {
                        const bandCls =
                          r.estimatedBand === 'DANGER'
                            ? 'border-red-500/40 bg-red-500/12 text-red-300'
                            : r.estimatedBand === 'CAUTION'
                              ? 'border-amber-500/40 bg-amber-500/12 text-amber-200'
                              : 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300';
                        return (
                          <tr key={r.rowIndex} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 text-[#8A847B]">{r.rowIndex}</td>
                            <td className="py-2.5 px-3 text-[#F3EFE8]">{r.oxygenPct}</td>
                            <td className="py-2.5 px-3 text-[#F3EFE8]">{r.pressurePsi}</td>
                            <td className="py-2.5 px-3 text-[#F3EFE8]">{r.airflowCmS}</td>
                            <td className="py-2.5 px-3 text-[#C2BCB2]">{r.fuelType}</td>
                            <td className="py-2.5 px-3 text-[#F3EFE8]">{r.estimatedLocPct}%</td>
                            <td className="py-2.5 px-3 text-[#D97B29] font-semibold">{r.estimatedRiskScore}/100</td>
                            <td className="py-2.5 px-3">
                              <span className={`border px-2 py-0.5 text-[10px] font-bold ${bandCls}`}>
                                {r.estimatedBand}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Column Statistics Table */}
            <section className="editorial-panel overflow-hidden">
              <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
                <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                  Automatic Column Inspection
                </h2>
                <span className="font-mono-data text-xs text-[#8A847B]">
                  Showing {activeStats.length} selected columns
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/12 bg-[#09090B] text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                      <th className="py-3 pl-6 pr-3">Column</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Missing</th>
                      <th className="py-3 px-3">Unique</th>
                      <th className="py-3 px-3">Min</th>
                      <th className="py-3 px-3">Max</th>
                      <th className="py-3 px-3">Mean</th>
                      <th className="py-3 px-3">Median</th>
                      <th className="py-3 px-3">Std Dev</th>
                      <th className="py-3 pl-3 pr-6">Top Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8 font-mono-data">
                    {activeStats.map((col) => (
                      <tr key={col.name} className="hover:bg-white/[0.02]">
                        <td className="py-3 pl-6 pr-3 font-semibold text-[#F3EFE8]">{col.name}</td>
                        <td className="py-3 px-3">
                          <span className="border border-white/15 bg-[#060607] px-2 py-0.5 text-[10px] uppercase text-[#D97B29]">
                            {col.dataType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#C2BCB2]">
                          {col.missingCount} ({col.missingPct}%)
                        </td>
                        <td className="py-3 px-3 text-[#C2BCB2]">{col.uniqueCount}</td>
                        <td className="py-3 px-3 text-[#F3EFE8]">{fmtStat(col.min)}</td>
                        <td className="py-3 px-3 text-[#F3EFE8]">{fmtStat(col.max)}</td>
                        <td className="py-3 px-3 text-[#E68A38]">{fmtStat(col.mean)}</td>
                        <td className="py-3 px-3 text-[#C2BCB2]">{fmtStat(col.median)}</td>
                        <td className="py-3 px-3 text-[#8A847B]">{fmtStat(col.stdDev)}</td>
                        <td className="py-3 pl-3 pr-6 text-[11px] text-[#8A847B] max-w-xs truncate">
                          {col.topValues.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Tabular CSV Row Preview */}
            <section className="editorial-panel overflow-hidden">
              <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
                <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                  Parsed Dataset Preview
                </h2>
                <span className="font-mono-data text-xs text-[#8A847B]">
                  First {activeDataset.previewRows.length} of {activeDataset.rowCount.toLocaleString()} rows
                </span>
              </div>
              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs font-mono-data">
                  <thead className="sticky top-0 bg-[#09090B]">
                    <tr className="border-b border-white/12 text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                      <th className="py-2.5 pl-6 pr-3">#</th>
                      {selectedColumns.map((col) => (
                        <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {activeDataset.previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-2 pl-6 pr-3 text-[#8A847B]">{idx + 1}</td>
                        {selectedColumns.map((col) => (
                          <td key={col} className="py-2 px-3 text-[#F3EFE8] whitespace-nowrap">
                            {row[col] === null || row[col] === undefined ? (
                              <span className="text-[#8A847B]">null</span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
};

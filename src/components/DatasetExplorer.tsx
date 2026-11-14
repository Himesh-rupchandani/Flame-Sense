import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';
import { fetchDatasetPreview, getDatasetDownloadUrl } from '../services/apiClient.ts';
import type {
  DatasetPreviewResponse,
  DynamicParameter,
  ExperimentDatasetMeta,
  ExperimentStatisticsResponse,
  VerificationStatus,
} from '../types/experiments.ts';
import { DatasetStatusBadge, VerificationBadge } from './VerificationBadge.tsx';
import { DynamicChartRenderer } from './DynamicChartRenderer.tsx';

interface DatasetExplorerProps {
  slug: string;
  experimentVerificationStatus: VerificationStatus;
  datasets: ExperimentDatasetMeta[];
  parameters: DynamicParameter[];
  comparisonSeries?: ExperimentStatisticsResponse['comparisonSeries'];
}

export const DatasetExplorer: React.FC<DatasetExplorerProps> = ({
  slug,
  experimentVerificationStatus,
  datasets,
  parameters,
  comparisonSeries = [],
}) => {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(datasets[0]?.id || '');
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (datasets.length > 0 && !datasets.some((d) => d.id === selectedDatasetId)) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  useEffect(() => {
    if (!slug || !selectedDatasetId) {
      setPreview(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchDatasetPreview(slug, selectedDatasetId)
      .then((res) => {
        if (active) setPreview(res);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to parse dataset preview.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, selectedDatasetId]);

  if (datasets.length === 0) {
    return (
      <div className="editorial-panel p-6 space-y-6">
        <div className="flex items-start gap-3 border border-white/15 bg-[#060607] p-5">
          <Database className="mt-0.5 h-5 w-5 text-[#8A847B] shrink-0" />
          <div>
            <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
              No Local Dataset Registered Yet
            </h2>
            <p className="mt-1.5 text-sm text-[#C2BCB2]">
              No downloadable or previewable CSV telemetry file has been ingested for this experiment record. Use Research Admin to attach verified archive metadata or an illustrative CSV dataset.
            </p>
          </div>
        </div>

        <DynamicChartRenderer
          title="Cross-Experiment Telemetry Comparison"
          verificationStatus={experimentVerificationStatus}
          parameters={parameters}
          currentSlug={slug}
          comparisonSeries={comparisonSeries}
          defaultMode="experiment-comparison"
        />
      </div>
    );
  }

  const activeMeta = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  return (
    <div className="space-y-6">
      {/* Dataset Selector & Action Bar */}
      <div className="editorial-panel p-6 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-[#D97B29]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#A9A39A]">
                Dataset Archive Explorer ({datasets.length}{' '}
                {datasets.length === 1 ? 'File' : 'Files'})
              </span>
              <VerificationBadge status={activeMeta.verificationStatus} />
              <DatasetStatusBadge status={activeMeta.datasetStatus} />
            </div>

            {datasets.length > 1 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {datasets.map((ds) => (
                  <button
                    key={ds.id}
                    type="button"
                    onClick={() => setSelectedDatasetId(ds.id)}
                    className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                      ds.id === activeMeta.id
                        ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#F3EFE8]'
                        : 'border-white/15 bg-[#060607] text-[#A9A39A] hover:border-white/30 hover:text-[#F3EFE8]'
                    }`}
                  >
                    {ds.datasetName}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
                {activeMeta.datasetName}
              </h2>
            )}

            <p className="text-sm text-[#C2BCB2] max-w-3xl">{activeMeta.description}</p>
          </div>

          {/* Authorized Download vs Official External Source */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {activeMeta.downloadAuthorized && activeMeta.hasCsvData ? (
              <a
                href={getDatasetDownloadUrl(slug, activeMeta.id)}
                download
                className="inline-flex items-center gap-2 border border-[#D97B29]/80 bg-[#D97B29]/15 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  {activeMeta.verificationStatus === 'DEMO'
                    ? 'Download Demo CSV'
                    : 'Download CSV Dataset'}
                </span>
              </a>
            ) : (
              <span
                title="Official NASA telemetry archives must be retrieved directly from the authoritative NTRS / PSI portal"
                className="inline-flex items-center gap-2 border border-white/15 bg-[#060607] px-3.5 py-2 text-[11px] uppercase tracking-[0.14em] text-[#8A847B]"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Authoritative Archive Only</span>
              </span>
            )}

            {activeMeta.sourceUrl && (
              <a
                href={activeMeta.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-white/15 bg-[#060607] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3EFE8] transition-colors hover:border-[#D97B29]/70 hover:text-[#D97B29]"
              >
                <span>Open NASA Primary Source</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Metadata Strip */}
        <dl className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-[#8A847B] uppercase tracking-wider text-[10px]">Format</dt>
            <dd className="mt-1 font-mono-data text-[#F3EFE8]">{activeMeta.fileFormat}</dd>
          </div>
          <div>
            <dt className="text-[#8A847B] uppercase tracking-wider text-[10px]">Sample Count</dt>
            <dd className="mt-1 font-mono-data text-[#D97B29] tabular-nums">
              {activeMeta.sampleCount}
            </dd>
          </div>
          <div>
            <dt className="text-[#8A847B] uppercase tracking-wider text-[10px]">NTRS / Archive ID</dt>
            <dd className="mt-1 font-mono-data text-[#F3EFE8]">{activeMeta.ntrsId}</dd>
          </div>
          <div>
            <dt className="text-[#8A847B] uppercase tracking-wider text-[10px]">Source Attribution</dt>
            <dd className="mt-1 text-[#C2BCB2] line-clamp-1">{activeMeta.sourceName}</dd>
          </div>
        </dl>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="editorial-panel h-64 animate-pulse p-6" />
      )}

      {error && (
        <div className="editorial-panel flex items-center gap-3 border-red-500/40 p-5 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && preview && (
        <>
          {/* Unavailable CSV State (e.g. CFI Pending) */}
          {preview.totalRows === 0 ? (
            <div className="editorial-panel border-white/15 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-[#E68A38] shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-[#F3EFE8]">
                    Raw Tabular CSV Pending Local Ingestion
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#C2BCB2]">
                    {preview.provenanceNotice} Variable schema definitions below document expected columns without inventing placeholder telemetry rows.
                  </p>
                </div>
              </div>

              {activeMeta.variables.length > 0 && (
                <div className="overflow-x-auto border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-[#060607] text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                      <tr>
                        <th className="px-3.5 py-2.5">Expected Variable</th>
                        <th className="px-3.5 py-2.5">Unit</th>
                        <th className="px-3.5 py-2.5">Type</th>
                        <th className="px-3.5 py-2.5">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-[#C2BCB2]">
                      {activeMeta.variables.map((v) => (
                        <tr key={v.name}>
                          <td className="px-3.5 py-2.5 font-mono-data text-[#F3EFE8]">{v.name}</td>
                          <td className="px-3.5 py-2.5 font-mono-data text-[#D97B29]">{v.unit || '—'}</td>
                          <td className="px-3.5 py-2.5">{v.dataType}</td>
                          <td className="px-3.5 py-2.5">{v.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Dynamic Reusable Visualization Fed by Parsed CSV Rows */}
              <div className="editorial-panel p-6">
                <DynamicChartRenderer
                  title={`Interactive Dataset Visualization — ${preview.dataset.datasetName}`}
                  verificationStatus={preview.dataset.verificationStatus}
                  sourceLabel={preview.provenanceNotice}
                  columns={preview.columns}
                  columnStats={preview.columnStats}
                  rows={preview.chartRows}
                  parameters={parameters}
                  currentSlug={slug}
                  comparisonSeries={comparisonSeries}
                  defaultMode="line"
                />
              </div>

              {/* Column Descriptive Statistics & Missing Value Audit */}
              <div className="editorial-panel p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-[#F3EFE8]">
                    Computed Descriptive Statistics &amp; Missing-Value Analysis
                  </h3>
                  <span className="font-mono-data text-xs text-[#A9A39A]">
                    {preview.totalRows} Total Parsed Rows
                  </span>
                </div>

                <div className="overflow-x-auto border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-[#060607] text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                      <tr>
                        <th className="px-3 py-2.5">Column</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Valid</th>
                        <th className="px-3 py-2.5">Missing</th>
                        <th className="px-3 py-2.5">Min</th>
                        <th className="px-3 py-2.5">Max</th>
                        <th className="px-3 py-2.5">Mean</th>
                        <th className="px-3 py-2.5">Median</th>
                        <th className="px-3 py-2.5">Std Dev</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-[#C2BCB2]">
                      {preview.columnStats.map((col) => (
                        <tr key={col.name} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2.5">
                            <div className="font-mono-data text-[#F3EFE8]">{col.name}</div>
                            {col.unit && (
                              <div className="text-[10px] text-[#8A847B]">{col.unit}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 uppercase text-[10px] tracking-wider">
                            {col.dataType}
                          </td>
                          <td className="px-3 py-2.5 font-mono-data tabular-nums">
                            {col.nonNullCount}
                          </td>
                          <td className="px-3 py-2.5 font-mono-data tabular-nums">
                            {col.missingCount > 0 ? (
                              <span className="text-[#E68A38] font-semibold">
                                {col.missingCount} ({col.missingPct}%)
                              </span>
                            ) : (
                              <span className="text-emerald-300">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono-data tabular-nums">
                            {col.min ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono-data tabular-nums">
                            {col.max ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono-data tabular-nums text-[#F3EFE8]">
                            {col.mean ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono-data tabular-nums">
                            {col.median ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono-data tabular-nums">
                            {col.stdDev ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CSV Tabular Preview */}
              <div className="editorial-panel p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-[#F3EFE8]">
                    Dataset Tabular Preview (First {preview.previewRows.length} Rows)
                  </h3>
                  <span className="text-xs text-[#8A847B]">{preview.provenanceNotice}</span>
                </div>

                <div className="overflow-x-auto border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-[#060607] text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                      <tr>
                        <th className="px-3 py-2.5">#</th>
                        {preview.columns.map((col) => (
                          <th key={col} className="px-3 py-2.5 font-mono-data whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 font-mono-data text-[#C2BCB2]">
                      {preview.previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-[#8A847B]">{idx + 1}</td>
                          {preview.columns.map((col) => {
                            const val = row[col];
                            return (
                              <td key={col} className="px-3 py-2 whitespace-nowrap tabular-nums">
                                {val === null || val === undefined || val === '' ? (
                                  <span className="border border-[#D97B29]/45 bg-[#D97B29]/10 px-1.5 py-0.5 text-[10px] text-[#E68A38]">
                                    MISSING
                                  </span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

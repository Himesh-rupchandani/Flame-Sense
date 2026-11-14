import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type {
  DatasetColumnStats,
  DynamicParameter,
  ExperimentStatisticsResponse,
  VerificationStatus,
} from '../types/experiments.ts';
import { ProvenanceBanner } from './VerificationBadge.tsx';

export type DynamicChartMode =
  | 'line'
  | 'bar'
  | 'scatter'
  | 'distribution'
  | 'parameter-comparison'
  | 'experiment-comparison';

interface DynamicChartRendererProps {
  title: string;
  verificationStatus: VerificationStatus;
  sourceLabel?: string;
  columns?: string[];
  columnStats?: DatasetColumnStats[];
  rows?: Array<Record<string, string | number | null>>;
  parameters?: DynamicParameter[];
  currentSlug?: string;
  comparisonSeries?: ExperimentStatisticsResponse['comparisonSeries'];
  defaultMode?: DynamicChartMode;
}

const CHART_MODES: Array<{ id: DynamicChartMode; label: string }> = [
  { id: 'line', label: 'Line Trend' },
  { id: 'bar', label: 'Bar Series' },
  { id: 'scatter', label: 'Scatter Plot' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'parameter-comparison', label: 'Parameter Bounds' },
  { id: 'experiment-comparison', label: 'Peer Comparison' },
];

export const DynamicChartRenderer: React.FC<DynamicChartRendererProps> = ({
  title,
  verificationStatus,
  sourceLabel,
  columns = [],
  columnStats = [],
  rows = [],
  parameters = [],
  currentSlug,
  comparisonSeries = [],
  defaultMode,
}) => {
  const numericColumns = useMemo(
    () =>
      columnStats
        .filter((c) => c.dataType === 'number' && c.nonNullCount > 0)
        .map((c) => c.name),
    [columnStats]
  );

  const hasTabularRows = rows.length > 0 && numericColumns.length > 0;

  const initialMode: DynamicChartMode =
    defaultMode ||
    (hasTabularRows
      ? 'line'
      : parameters.some((p) => p.minValue !== null || p.maxValue !== null)
        ? 'parameter-comparison'
        : 'experiment-comparison');

  const [mode, setMode] = useState<DynamicChartMode>(initialMode);
  const [xCol, setXCol] = useState<string>(columns[0] || numericColumns[0] || '');
  const [yCol, setYCol] = useState<string>(
    numericColumns[numericColumns.length > 1 ? 1 : 0] || numericColumns[0] || ''
  );
  const [compMetric, setCompMetric] = useState<'relevanceScore' | 'oxygenMax' | 'pressureMax' | 'sampleCount'>(
    'relevanceScore'
  );
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const effectiveX = columns.includes(xCol) ? xCol : columns[0] || '';
  const effectiveY = numericColumns.includes(yCol)
    ? yCol
    : numericColumns[numericColumns.length > 1 ? 1 : 0] || numericColumns[0] || '';

  const validPairs = useMemo(() => {
    if (!hasTabularRows || !effectiveY) return [];
    return rows
      .map((r, idx) => {
        const yRaw = r[effectiveY];
        const yNum = typeof yRaw === 'number' ? yRaw : Number(yRaw);
        const xRaw = effectiveX ? r[effectiveX] : idx + 1;
        const xNum = typeof xRaw === 'number' ? xRaw : Number(xRaw);
        if (!Number.isFinite(yNum)) return null;
        return {
          idx,
          xLabel: xRaw !== null && xRaw !== undefined ? String(xRaw) : `#${idx + 1}`,
          xNum: Number.isFinite(xNum) ? xNum : idx + 1,
          yNum,
        };
      })
      .filter((p): p is { idx: number; xLabel: string; xNum: number; yNum: number } => p !== null);
  }, [rows, effectiveX, effectiveY, hasTabularRows]);

  const numericParamItems = useMemo(
    () =>
      parameters
        .filter((p) => p.minValue !== null || p.maxValue !== null || !Number.isNaN(Number(p.value)))
        .slice(0, 6)
        .map((p) => {
          const lo = p.minValue ?? (Number.isFinite(Number(p.value)) ? Number(p.value) : 0);
          const hi = p.maxValue ?? lo;
          return {
            name: p.name,
            unit: p.unit,
            lo,
            hi,
            span: Math.max(Math.abs(hi), Math.abs(lo), 1),
          };
        }),
    [parameters]
  );

  const histogramBins = useMemo(() => {
    if (validPairs.length === 0) return [];
    const vals = validPairs.map((p) => p.yNum);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const binCount = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(vals.length))));
    const range = maxV - minV || 1;
    const width = range / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      label: `${(minV + i * width).toFixed(1)}–${(minV + (i + 1) * width).toFixed(1)}`,
      count: 0,
    }));
    for (const v of vals) {
      const idx = Math.min(binCount - 1, Math.floor(((v - minV) / range) * binCount));
      bins[idx].count += 1;
    }
    return bins;
  }, [validPairs]);

  const width = 580;
  const height = 235;
  const padL = 52;
  const padR = 24;
  const padT = 22;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const isRowMode = mode === 'line' || mode === 'bar' || mode === 'scatter' || mode === 'distribution';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#D97B29] shrink-0" />
          <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-[#F3EFE8]">{title}</h3>
        </div>

        {/* Chart Mode Switcher */}
        <div className="flex flex-wrap gap-1.5">
          {CHART_MODES.map((m) => {
            const disabled =
              ((m.id === 'line' || m.id === 'bar' || m.id === 'scatter' || m.id === 'distribution') &&
                !hasTabularRows) ||
              (m.id === 'parameter-comparison' && numericParamItems.length === 0) ||
              (m.id === 'experiment-comparison' && comparisonSeries.length === 0);
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setHoveredIdx(null);
                  setMode(m.id);
                }}
                className={`cursor-pointer border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  mode === m.id
                    ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#E68A38]'
                    : 'border-white/15 bg-[#060607] text-[#A9A39A] hover:border-white/30 hover:text-[#F3EFE8]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mandatory Provenance Notice */}
      <ProvenanceBanner verificationStatus={verificationStatus} sourceLabel={sourceLabel} />

      {/* Dynamic Axis Selectors */}
      {isRowMode && hasTabularRows && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {mode !== 'distribution' && (
            <label className="flex items-center gap-2 text-[#A9A39A]">
              <span>X-Axis</span>
              <select
                value={effectiveX}
                onChange={(e) => setXCol(e.target.value)}
                className="cursor-pointer border border-white/15 bg-[#060607] px-2.5 py-1 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-[#A9A39A]">
            <span>{mode === 'distribution' ? 'Variable' : 'Y-Axis'}</span>
            <select
              value={effectiveY}
              onChange={(e) => setYCol(e.target.value)}
              className="cursor-pointer border border-white/15 bg-[#060607] px-2.5 py-1 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
            >
              {numericColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {mode === 'experiment-comparison' && comparisonSeries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#A9A39A]">Compare Metric:</span>
          {[
            { id: 'relevanceScore', label: 'Crew Safety Relevance (%)' },
            { id: 'oxygenMax', label: 'Max O₂ (%)' },
            { id: 'pressureMax', label: 'Max Pressure (psi)' },
            { id: 'sampleCount', label: 'Indexed Samples' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCompMetric(opt.id as typeof compMetric)}
              className={`cursor-pointer border px-2.5 py-1 text-[11px] transition-colors ${
                compMetric === opt.id
                  ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#E68A38]'
                  : 'border-white/15 bg-[#060607] text-[#C2BCB2] hover:border-white/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Chart Canvas */}
      {isRowMode && validPairs.length === 0 && (
        <div className="border border-white/10 bg-[#060607] p-8 text-center text-xs text-[#8A847B]">
          No numeric tabular rows are available to plot this chart type. Switch to Parameter Bounds or Peer Comparison, or ingest a CSV dataset.
        </div>
      )}

      {(mode === 'line' || mode === 'scatter') && validPairs.length > 0 && (() => {
        const ordered = mode === 'line' && Number.isFinite(validPairs[0]?.xNum)
          ? [...validPairs].sort((a, b) => a.xNum - b.xNum)
          : validPairs;
        const minX = Math.min(...ordered.map((p) => p.xNum));
        const maxX = Math.max(...ordered.map((p) => p.xNum));
        const minY = Math.min(0, ...ordered.map((p) => p.yNum));
        const maxY = Math.max(...ordered.map((p) => p.yNum)) * 1.12 || 1;

        const mapX = (xVal: number, idx: number) =>
          maxX === minX
            ? padL + (idx / Math.max(1, ordered.length - 1)) * plotW
            : padL + ((xVal - minX) / (maxX - minX)) * plotW;
        const mapY = (yVal: number) =>
          height - padB - ((yVal - minY) / Math.max(0.001, maxY - minY)) * plotH;

        const pathD = ordered
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.xNum, idx).toFixed(1)} ${mapY(p.yNum).toFixed(1)}`)
          .join(' ');

        return (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto border border-white/10 bg-[#060607] p-2"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <text x={padL - 8} y={padT + 8} textAnchor="end" fill="#8A847B" fontSize="10" fontFamily="monospace">
              {maxY.toFixed(1)}
            </text>
            <text x={padL - 8} y={height - padB} textAnchor="end" fill="#8A847B" fontSize="10" fontFamily="monospace">
              {minY.toFixed(1)}
            </text>
            {mode === 'line' && ordered.length > 1 && (
              <path d={pathD} fill="none" stroke="#D97B29" strokeWidth="2.4" strokeLinecap="round" />
            )}
            {ordered.map((p, i) => {
              const cx = mapX(p.xNum, i);
              const cy = mapY(p.yNum);
              const isHov = hoveredIdx === i;
              return (
                <g key={p.idx} onMouseEnter={() => setHoveredIdx(i)} className="cursor-pointer">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHov ? 6.5 : 4.5}
                    fill={isHov ? '#E68A38' : '#F3EFE8'}
                    stroke="#D97B29"
                    strokeWidth="1.5"
                  />
                  {(ordered.length <= 10 || i % Math.ceil(ordered.length / 7) === 0 || isHov) && (
                    <text x={cx} y={height - 16} textAnchor="middle" fill="#8A847B" fontSize="9.5" fontFamily="monospace">
                      {p.xLabel.slice(0, 8)}
                    </text>
                  )}
                  {isHov && (
                    <g>
                      <rect
                        x={Math.min(width - 135, Math.max(padL, cx - 60))}
                        y={Math.max(4, cy - 34)}
                        width="124"
                        height="24"
                        fill="#0E0E11"
                        stroke="#D97B29"
                        strokeWidth="1"
                      />
                      <text
                        x={Math.min(width - 73, Math.max(padL + 62, cx + 2))}
                        y={Math.max(19, cy - 19)}
                        textAnchor="middle"
                        fill="#F3EFE8"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {p.xLabel}: {p.yNum}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            <text x={width / 2} y={height - 3} textAnchor="middle" fill="#A9A39A" fontSize="10" fontFamily="sans-serif">
              {effectiveX} vs. {effectiveY}
            </text>
          </svg>
        );
      })()}

      {mode === 'bar' && validPairs.length > 0 && (() => {
        const sliced = validPairs.slice(0, 14);
        const maxY = Math.max(...sliced.map((p) => p.yNum)) * 1.15 || 1;
        const step = plotW / sliced.length;
        const barW = Math.max(10, Math.min(36, step * 0.62));

        return (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto border border-white/10 bg-[#060607] p-2">
            <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            {sliced.map((p, i) => {
              const barH = Math.max(4, (Math.max(0, p.yNum) / maxY) * plotH);
              const x = padL + i * step + (step - barW) / 2;
              const y = height - padB - barH;
              return (
                <g key={p.idx}>
                  <rect x={x} y={y} width={barW} height={barH} fill="#D97B29" opacity={0.85} />
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="#F3EFE8" fontSize="9.5" fontFamily="monospace">
                    {p.yNum}
                  </text>
                  <text x={x + barW / 2} y={height - 16} textAnchor="middle" fill="#8A847B" fontSize="9" fontFamily="monospace">
                    {p.xLabel.slice(0, 7)}
                  </text>
                </g>
              );
            })}
            <text x={width / 2} y={height - 3} textAnchor="middle" fill="#A9A39A" fontSize="10">
              {effectiveY} by {effectiveX}
            </text>
          </svg>
        );
      })()}

      {mode === 'distribution' && histogramBins.length > 0 && (() => {
        const maxCount = Math.max(...histogramBins.map((b) => b.count), 1);
        const step = plotW / histogramBins.length;
        const barW = Math.max(18, step * 0.65);

        return (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto border border-white/10 bg-[#060607] p-2">
            <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            {histogramBins.map((b, i) => {
              const barH = Math.max(4, (b.count / maxCount) * plotH);
              const x = padL + i * step + (step - barW) / 2;
              const y = height - padB - barH;
              return (
                <g key={b.label}>
                  <rect x={x} y={y} width={barW} height={barH} fill="#D97B29" opacity={0.82} />
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="#F3EFE8" fontSize="10" fontFamily="monospace">
                    n={b.count}
                  </text>
                  <text x={x + barW / 2} y={height - 16} textAnchor="middle" fill="#8A847B" fontSize="9" fontFamily="monospace">
                    {b.label}
                  </text>
                </g>
              );
            })}
            <text x={width / 2} y={height - 3} textAnchor="middle" fill="#A9A39A" fontSize="10">
              Sample Distribution — {effectiveY}
            </text>
          </svg>
        );
      })()}

      {mode === 'parameter-comparison' && numericParamItems.length > 0 && (
        <div className="space-y-3 border border-white/10 bg-[#060607] p-4">
          {numericParamItems.map((p) => {
            const pctMax = Math.min(100, Math.max(8, (p.hi / Math.max(p.span, 100)) * 100));
            return (
              <div key={p.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#F3EFE8]">{p.name}</span>
                  <span className="font-mono-data text-[#D97B29] tabular-nums">
                    {p.lo === p.hi ? `${p.hi}` : `${p.lo} – ${p.hi}`} {p.unit}
                  </span>
                </div>
                <div className="h-2 w-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-[#D97B29]" style={{ width: `${pctMax}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'experiment-comparison' && comparisonSeries.length > 0 && (() => {
        const items = comparisonSeries.slice(0, 10);
        const maxVal = Math.max(...items.map((e) => Number(e[compMetric] || 0)), 1);

        return (
          <div className="space-y-2.5 border border-white/10 bg-[#060607] p-4">
            {items.map((item) => {
              const val = Number(item[compMetric] || 0);
              const pct = Math.max(4, Math.min(100, (val / maxVal) * 100));
              const isCurrent = item.slug === currentSlug;
              return (
                <div key={item.slug} className="flex items-center gap-3 text-xs">
                  <span
                    className={`w-28 truncate font-medium ${
                      isCurrent ? 'text-[#E68A38]' : 'text-[#C2BCB2]'
                    }`}
                    title={item.name}
                  >
                    {item.acronym || item.name}
                    {item.verificationStatus === 'DEMO' ? ' [DEMO]' : ''}
                  </span>
                  <div className="h-2.5 flex-1 bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isCurrent ? 'bg-[#D97B29]' : 'bg-[#C2BCB2]/55'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono-data text-[#F3EFE8] tabular-nums">
                    {val}
                    {compMetric === 'relevanceScore' || compMetric === 'oxygenMax' ? '%' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};

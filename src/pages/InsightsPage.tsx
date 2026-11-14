import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Flame,
  Gauge,
  Lightbulb,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wind,
} from 'lucide-react';
import {
  fetchExperimentStatistics,
  fetchInsights,
} from '../services/apiClient.ts';
import type { InsightsResponse } from '../services/apiClient.ts';
import type { ExperimentStatisticsResponse, FuelTypeId } from '../types/experiments.ts';
import { FUEL_TYPES } from '../data/nasaExperiments.ts';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import { RevealOnScroll } from '../components/RevealOnScroll.tsx';

export const InsightsPage: React.FC = () => {
  const [fuelType, setFuelType] = useState<FuelTypeId>('solid-fabric');
  const [pressurePsi, setPressurePsi] = useState<number>(10.2);
  const [airflowCmS, setAirflowCmS] = useState<number>(20);

  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [stats, setStats] = useState<ExperimentStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, statsRes] = await Promise.all([
        fetchInsights({ fuelType, pressurePsi, airflowCmS }),
        fetchExperimentStatistics().catch(() => null),
      ]);
      setInsights(data);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load fire safety insights');
    } finally {
      setLoading(false);
    }
  }, [fuelType, pressurePsi, airflowCmS]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInsights();
    }, 120);
    return () => clearTimeout(timer);
  }, [loadInsights]);

  const o2Points = insights?.oxygenSeries || [];
  const o2Path = o2Points
    .map((pt, i) => {
      const x = 36 + (i / Math.max(1, o2Points.length - 1)) * 270;
      const y = 135 - (pt.risk / 100) * 110;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const psiPoints = insights?.pressureSeries || [];
  const psiPath = psiPoints
    .map((pt, i) => {
      const x = 36 + (i / Math.max(1, psiPoints.length - 1)) * 270;
      const y = 135 - (pt.risk / 100) * 110;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const airflowBars = insights?.airflowSeries || [];
  const fuelBars = insights?.fuelSeries || [];

  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Insights' }]} />

        <RevealOnScroll className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
                Empirical Synthesis
              </span>
            </div>
            <h1 className="font-serif-display text-3xl font-normal tracking-tight text-[#F3EFE8] sm:text-4xl lg:text-[44px]">
              Insights for a <span className="italic text-[#D97B29]">Safer Space</span>
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm sm:text-base text-[#C2BCB2]">
              Interactive analysis of oxygen enrichment, cabin pressure, ventilation velocity, and fuel volatility calibrated from database-verified NASA studies.
            </p>
          </div>
          {insights && (
            <div className="font-mono-data text-xs text-[#D97B29] tabular-nums">
              {insights.verifiedExperimentCount ?? insights.experimentCount} Verified Studies ·{' '}
              {insights.totalSampleRuns} Samples · {insights.totalDatasetRuns.toLocaleString()} Runs
            </div>
          )}
        </RevealOnScroll>

        {/* Interactive Parameter Sensitivity Controls */}
        <section className="editorial-panel mb-8 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#F3EFE8]">
              <SlidersHorizontal className="h-4 w-4 text-[#D97B29]" />
              <span>Interactive Environmental Envelope Filters</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFuelType('solid-fabric');
                setPressurePsi(10.2);
                setAirflowCmS(20);
              }}
              className="cursor-pointer border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#E68A38]"
            >
              Reset Artemis Baseline
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-[#8A847B]">
                Baseline Fuel Material
              </label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelTypeId)}
                className="w-full cursor-pointer border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
              >
                {FUEL_TYPES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.representativeMaterial})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-[11px] uppercase tracking-[0.14em] text-[#8A847B]">
                <span>Cabin Pressure</span>
                <span className="font-mono-data text-[#D97B29]">{pressurePsi} psi</span>
              </div>
              <input
                type="range"
                min={4.3}
                max={14.7}
                step={0.1}
                value={pressurePsi}
                onChange={(e) => setPressurePsi(Number(e.target.value))}
                className="w-full accent-[#D97B29] cursor-pointer"
              />
            </div>

            <div>
              <div className="mb-2 flex justify-between text-[11px] uppercase tracking-[0.14em] text-[#8A847B]">
                <span>Ventilation Airflow</span>
                <span className="font-mono-data text-[#D97B29]">{airflowCmS} cm/s</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={airflowCmS}
                onChange={(e) => setAirflowCmS(Number(e.target.value))}
                className="w-full accent-[#D97B29] cursor-pointer"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="editorial-panel mb-8 flex items-center justify-between border-red-500/40 p-5 text-sm text-red-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadInsights}
              className="cursor-pointer border border-red-400/40 px-4 py-1.5 text-xs font-medium hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !insights && !error && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="editorial-panel h-60 animate-pulse p-6" />
            ))}
          </div>
        )}

        {!error && insights && (
          <div className="space-y-8">
            {/* Key Research Insights Highlight Cards from SQLite */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {insights.highlights.map((item, idx) => {
                const Icon =
                  idx === 0 ? Lightbulb : idx === 1 ? Wind : idx === 2 ? Gauge : Flame;
                return (
                  <RevealOnScroll key={item.slug} delay={idx * 0.05}>
                    <article className="editorial-card flex h-full flex-col justify-between p-5">
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex h-9 w-9 items-center justify-center border border-[#D97B29]/45 bg-[#D97B29]/10 text-[#D97B29]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">
                            {item.category}
                          </span>
                        </div>
                        <h2 className="font-serif-display text-lg font-normal text-[#F3EFE8]">{item.title}</h2>
                        <p className="mt-2 text-xs leading-relaxed text-[#C2BCB2]">{item.summary}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                        <span className="text-[#8A847B]">{item.metricLabel}</span>
                        <span className="font-mono-data font-semibold text-[#D97B29] tabular-nums">
                          {item.metricValue}
                        </span>
                      </div>
                    </article>
                  </RevealOnScroll>
                );
              })}
            </div>

            {/* 4 Interactive Parameter Analysis Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 1. Oxygen Concentration Analysis */}
              <div className="editorial-panel p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="h-4 w-4 text-[#D97B29]" />
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                      Oxygen Concentration Analysis
                    </h2>
                  </div>
                  <span className="font-mono-data text-xs text-[#8A847B]">
                    {pressurePsi} psi · {airflowCmS} cm/s
                  </span>
                </div>
                <svg viewBox="0 0 330 165" className="h-auto w-full border border-white/10 bg-[#060607] p-2">
                  <line x1="36" y1="20" x2="36" y2="135" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="36" y1="135" x2="312" y2="135" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  {o2Path && (
                    <path d={o2Path} fill="none" stroke="#D97B29" strokeWidth="2.6" strokeLinecap="round" />
                  )}
                  {o2Points.map((pt, i) => {
                    const cx = 36 + (i / Math.max(1, o2Points.length - 1)) * 270;
                    const cy = 135 - (pt.risk / 100) * 110;
                    return (
                      <g key={pt.o2}>
                        <circle cx={cx} cy={cy} r="4.5" fill="#E68A38" stroke="#060607" strokeWidth="1.5" />
                        <text x={cx} y="152" textAnchor="middle" fill="#8A847B" fontSize="9.5" fontFamily="monospace">
                          {pt.o2}%
                        </text>
                        <text x={cx} y={cy - 9} textAnchor="middle" fill="#F3EFE8" fontSize="9" fontFamily="monospace">
                          {pt.risk}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <p className="mt-3 text-xs text-[#A9A39A]">
                  Evaluated dynamically at {pressurePsi} psi and {airflowCmS} cm/s airflow. Risk crosses into DANGER once oxygen enrichment outpaces material LOC.
                </p>
              </div>

              {/* 2. Pressure Impact Analysis */}
              <div className="editorial-panel p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Gauge className="h-4 w-4 text-[#D97B29]" />
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                      Pressure Impact on Risk &amp; LOC
                    </h2>
                  </div>
                  <span className="font-mono-data text-xs text-[#8A847B]">4.3 – 14.7 psi</span>
                </div>
                <svg viewBox="0 0 330 165" className="h-auto w-full border border-white/10 bg-[#060607] p-2">
                  <line x1="36" y1="20" x2="36" y2="135" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="36" y1="135" x2="312" y2="135" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  {psiPath && (
                    <path d={psiPath} fill="none" stroke="#C2BCB2" strokeWidth="2.6" strokeLinecap="round" />
                  )}
                  {psiPoints.map((pt, i) => {
                    const cx = 36 + (i / Math.max(1, psiPoints.length - 1)) * 270;
                    const cy = 135 - (pt.risk / 100) * 110;
                    return (
                      <g key={pt.psi}>
                        <circle cx={cx} cy={cy} r="4.5" fill="#D97B29" stroke="#060607" strokeWidth="1.5" />
                        <text x={cx} y="152" textAnchor="middle" fill="#8A847B" fontSize="9.5" fontFamily="monospace">
                          {pt.psi}
                        </text>
                        <text x={cx} y={cy - 9} textAnchor="middle" fill="#F3EFE8" fontSize="9" fontFamily="monospace">
                          {pt.loc}% LOC
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <p className="mt-3 text-xs text-[#A9A39A]">
                  Lower cabin pressure shifts effective LOC slightly upward while reducing total gas-phase thermal density at 30% O₂.
                </p>
              </div>

              {/* 3. Airflow Impact Analysis */}
              <div className="editorial-panel p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Wind className="h-4 w-4 text-[#D97B29]" />
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                      Airflow Velocity Impact
                    </h2>
                  </div>
                  <span className="font-mono-data text-xs text-[#8A847B]">0 – 100 cm/s</span>
                </div>
                <svg viewBox="0 0 330 165" className="h-auto w-full border border-white/10 bg-[#060607] p-2">
                  <line x1="28" y1="135" x2="312" y2="135" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  {airflowBars.map((pt, i) => {
                    const barH = Math.max(12, (pt.risk / 100) * 105);
                    const x = 36 + i * 40;
                    return (
                      <g key={pt.flow}>
                        <rect
                          x={x}
                          y={135 - barH}
                          width="24"
                          height={barH}
                          fill="#D97B29"
                          opacity={0.55 + i * 0.06}
                        />
                        <text x={x + 12} y="152" textAnchor="middle" fill="#8A847B" fontSize="9.5" fontFamily="monospace">
                          {pt.flow}
                        </text>
                        <text x={x + 12} y={135 - barH - 6} textAnchor="middle" fill="#F3EFE8" fontSize="9" fontFamily="monospace">
                          {pt.risk}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <p className="mt-3 text-xs text-[#A9A39A]">
                  Risk peaks between 20–50 cm/s due to forced oxidizer delivery before high-velocity convective blow-off cooling begins above 55 cm/s.
                </p>
              </div>

              {/* 4. Fuel-Type Comparisons */}
              <div className="editorial-panel p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame className="h-4 w-4 text-[#D97B29]" />
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                      Fuel-Type Fire Risk Comparison
                    </h2>
                  </div>
                  <span className="font-mono-data text-xs text-[#8A847B]">ISS vs. Artemis</span>
                </div>
                <div className="space-y-3.5">
                  {fuelBars.map((f) => (
                    <div
                      key={f.id}
                      className={`border p-3.5 ${
                        f.id === fuelType
                          ? 'border-[#D97B29]/60 bg-[#D97B29]/5'
                          : 'border-white/10 bg-[#060607]'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-[#F3EFE8]">{f.label}</span>
                          <span className="ml-2 text-[#8A847B]">{f.representativeMaterial}</span>
                        </div>
                        <span className="font-mono-data text-[#D97B29] tabular-nums">Base LOC {f.baseLocPct}%</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-20 text-[#8A847B]">ISS (21% O₂)</span>
                          <div className="h-2 flex-1 overflow-hidden bg-white/10">
                            <div className="h-full bg-[#C2BCB2]" style={{ width: `${f.riskAtIss}%` }} />
                          </div>
                          <span className="w-10 text-right font-mono-data text-[#F3EFE8] tabular-nums">
                            {f.riskAtIss}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-20 text-[#8A847B]">Artemis (30%)</span>
                          <div className="h-2 flex-1 overflow-hidden bg-white/10">
                            <div className="h-full bg-[#D97B29]" style={{ width: `${f.riskAtArtemis}%` }} />
                          </div>
                          <span className="w-10 text-right font-mono-data text-[#F3EFE8] tabular-nums">
                            {f.riskAtArtemis}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Archive Category Distribution from /api/experiments/statistics */}
            {stats && stats.categories.length > 0 && (
              <div className="editorial-panel p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                    Archive Research Coverage by Category
                  </h2>
                  <span className="font-mono-data text-xs text-[#8A847B]">
                    {stats.totalParameters} Parameters · {stats.totalFindings} Findings · {stats.totalReferences} References
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {stats.categories.map((c) => (
                    <div key={c.category} className="border border-white/10 bg-[#060607] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-[#8A847B]">
                        {c.category}
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="font-serif-display text-2xl text-[#F3EFE8]">
                          {c.count} {c.count === 1 ? 'Study' : 'Studies'}
                        </span>
                        <span className="font-mono-data text-xs text-[#D97B29]">
                          Avg {c.avgRelevance}% Relevance
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Closing CTA */}
            <div className="editorial-panel p-8 text-center">
              <ShieldCheck className="mx-auto mb-3 h-7 w-7 text-[#D97B29]" />
              <h2 className="font-serif-display text-2xl sm:text-3xl font-normal text-[#F3EFE8]">
                Together <span className="italic text-[#D97B29]">for a Safer Space Tomorrow</span>
              </h2>
              <p className="mx-auto mt-2.5 max-w-xl text-sm text-[#C2BCB2]">
                Test custom spacecraft atmospheres directly inside the live Fire Risk &amp; SHAP Explainability engine.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  to={`/prediction?fuel=${fuelType}&pressure=${pressurePsi}&airflow=${airflowCmS}`}
                  className="inline-flex items-center gap-3 border border-[#D97B29]/75 bg-[#D97B29]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607]"
                >
                  <span>Run Live Simulation with Current Parameters</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

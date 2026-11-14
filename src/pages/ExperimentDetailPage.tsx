import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Database,
  ExternalLink,
  Flame,
  Gauge,
  Layers,
  Microscope,
  SlidersHorizontal,
  Wind,
} from 'lucide-react';
import {
  fetchExperimentBySlug,
  fetchExperimentStatistics,
} from '../services/apiClient.ts';
import type {
  ExperimentDetailRecord,
  ExperimentStatisticsResponse,
  FuelTypeId,
} from '../types/experiments.ts';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import {
  DatasetStatusBadge,
  ProvenanceBanner,
  VerificationBadge,
} from '../components/VerificationBadge.tsx';
import { DynamicChartRenderer } from '../components/DynamicChartRenderer.tsx';
import { DatasetExplorer } from '../components/DatasetExplorer.tsx';

type DetailTab =
  | 'overview'
  | 'objectives'
  | 'setup'
  | 'parameters'
  | 'findings'
  | 'dataset'
  | 'references';

const VALID_TABS: DetailTab[] = [
  'overview',
  'objectives',
  'setup',
  'parameters',
  'findings',
  'dataset',
  'references',
];

export const ExperimentDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab') as DetailTab | null;
  const activeTab: DetailTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'overview';

  const [experiment, setExperiment] = useState<ExperimentDetailRecord | null>(null);
  const [stats, setStats] = useState<ExperimentStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchExperimentBySlug(slug || ''),
      fetchExperimentStatistics().catch(() => null),
    ])
      .then(([detail, statsRes]) => {
        if (active) {
          setExperiment(detail);
          setStats(statsRes);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load experiment dossier.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const setActiveTab = (tab: DetailTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleSimulateConditions = () => {
    if (!experiment) return;
    const midO2 = Math.min(
      85,
      Math.max(21, Math.round((experiment.oxygenRange[0] + experiment.oxygenRange[1]) / 2))
    );
    const midPsi = Number(
      Math.min(14.7, Math.max(4.3, (experiment.pressureRange[0] + experiment.pressureRange[1]) / 2)).toFixed(1)
    );
    const midFlow = Math.min(
      100,
      Math.max(0, Math.round((experiment.airflowRange[0] + experiment.airflowRange[1]) / 2))
    );

    const mappedFuel: FuelTypeId = experiment.fuelType || 'solid-fabric';

    const qs = new URLSearchParams({
      oxygen: String(midO2),
      pressure: String(midPsi),
      airflow: String(midFlow),
      fuel: mappedFuel,
      source: experiment.slug,
    });
    navigate(`/prediction?${qs.toString()}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#060607] pt-28 pb-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 space-y-6">
          <div className="h-5 w-48 animate-pulse bg-white/10" />
          <div className="editorial-panel h-64 animate-pulse p-6" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="editorial-panel h-80 animate-pulse p-6" />
            <div className="editorial-panel h-80 animate-pulse p-6" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !experiment) {
    return (
      <main className="min-h-screen bg-[#060607] pt-28 pb-20">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Experiments', to: '/experiments' },
              { label: slug || 'Not Found' },
            ]}
          />
          <div className="editorial-panel border-red-500/35 p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <h1 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
              Experiment Record Unavailable
            </h1>
            <p className="mt-2 text-sm text-[#C2BCB2]">
              {error || 'Requested experiment was not found in the database.'}
            </p>
            <Link
              to="/experiments"
              className="mt-6 inline-flex items-center gap-2 border border-[#D97B29]/75 bg-[#D97B29]/10 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Experiments Repository</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const criteriaItems = [
    { label: 'Crew Safety Directness (30%)', val: experiment.criteria.crewSafetyDirectness },
    { label: 'Habitat Applicability (25%)', val: experiment.criteria.habitatApplicability },
    { label: 'Telemetry Richness (15%)', val: experiment.criteria.telemetryFidelity },
    { label: 'Material Coverage (15%)', val: experiment.criteria.materialBreadth },
    { label: 'Hardware Heritage (8%)', val: experiment.criteria.hardwareHeritage },
    { label: 'Mission Recency (7%)', val: experiment.criteria.recency },
  ];

  const tabs: Array<{ id: DetailTab; label: string; count?: number; available?: boolean }> = [
    { id: 'overview', label: 'Overview', available: true },
    {
      id: 'objectives',
      label: 'Objectives & Background',
      available: experiment.availableSections.objectives,
    },
    { id: 'setup', label: 'Experimental Setup', available: experiment.availableSections.setup },
    {
      id: 'parameters',
      label: 'Parameters',
      count: experiment.parameters.length,
      available: experiment.availableSections.parameters,
    },
    {
      id: 'findings',
      label: 'Findings',
      count: experiment.findings.length,
      available: experiment.availableSections.findings,
    },
    {
      id: 'dataset',
      label: 'Dataset & Charts',
      count: experiment.datasets.length,
      available: experiment.availableSections.dataset,
    },
    {
      id: 'references',
      label: 'References',
      count: experiment.references.length,
      available: experiment.availableSections.references,
    },
  ];

  const comparisonSeries = stats?.comparisonSeries || [];

  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Experiments', to: '/experiments' },
            { label: experiment.name },
          ]}
        />

        {/* Hero Dossier Banner */}
        <section className="editorial-panel mb-6 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-[#8A847B]">
                <VerificationBadge status={experiment.verificationStatus} />
                <span className="border border-[#D97B29]/55 bg-[#D97B29]/10 px-2.5 py-0.5 font-medium text-[#E68A38]">
                  {experiment.category}
                </span>
                <DatasetStatusBadge status={experiment.datasetStatus} />
                <span className="font-mono-data text-[#D97B29] tabular-nums">
                  Rank #{experiment.rank} ({experiment.relevanceScore}%)
                </span>
              </div>

              <h1 className="font-serif-display mt-4 text-3xl font-normal tracking-tight text-[#F3EFE8] sm:text-4xl">
                {experiment.name}{' '}
                <span className="italic text-[#D97B29]">— {experiment.fullName}</span>
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#A9A39A]">
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#D97B29]" />
                  {experiment.researchPlatform}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono-data">
                  <Calendar className="h-3.5 w-3.5 text-[#D97B29]" />
                  {experiment.startDate || experiment.year}
                  {experiment.endDate ? ` → ${experiment.endDate}` : ''}
                </span>
              </div>

              <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#C2BCB2]">
                {experiment.shortDescription}
              </p>

              <div className="mt-4">
                <ProvenanceBanner
                  verificationStatus={experiment.verificationStatus}
                  sourceLabel={
                    experiment.verificationStatus === 'DEMO'
                      ? 'Synthesized scenario used purely to demonstrate multi-dataset comparison & chart mechanics.'
                      : experiment.verificationStatus === 'PENDING'
                        ? 'Metadata record registered; empirical telemetry ingestion and peer verification remain pending.'
                        : `${experiment.ntrsId} · ${experiment.hardware}`
                  }
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSimulateConditions}
                  className="inline-flex cursor-pointer items-center gap-2.5 border border-[#D97B29]/75 bg-[#D97B29]/10 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607]"
                >
                  <span>Simulate {experiment.acronym || experiment.name} Envelope in AI Predictor</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <Link
                  to="/ranking"
                  className="inline-flex items-center gap-1.5 border border-white/15 bg-[#060607] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#C2BCB2] hover:border-[#D97B29]/60 hover:text-[#F3EFE8]"
                >
                  <span>Ranking Methodology</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="overflow-hidden border border-white/12 bg-[#060607]">
                <img
                  src={experiment.image}
                  alt={experiment.fullName}
                  referrerPolicy="no-referrer"
                  className="aspect-[16/10] w-full object-cover"
                  style={{ filter: 'contrast(1.06) brightness(0.92)' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Operating Envelope KPI Strip */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="editorial-panel p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8A847B]">
              <Flame className="h-4 w-4 text-[#D97B29]" />
              <span>Oxygen Envelope</span>
            </div>
            <div className="mt-2 font-mono-data text-xl font-semibold text-[#F3EFE8] tabular-nums">
              {experiment.oxygenRange[0]}–{experiment.oxygenRange[1]}% O₂
            </div>
          </div>
          <div className="editorial-panel p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8A847B]">
              <Gauge className="h-4 w-4 text-[#D97B29]" />
              <span>Cabin Pressure</span>
            </div>
            <div className="mt-2 font-mono-data text-xl font-semibold text-[#F3EFE8] tabular-nums">
              {experiment.pressureRange[0]}–{experiment.pressureRange[1]} psi
            </div>
          </div>
          <div className="editorial-panel p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8A847B]">
              <Wind className="h-4 w-4 text-[#D97B29]" />
              <span>Ventilation Airflow</span>
            </div>
            <div className="mt-2 font-mono-data text-xl font-semibold text-[#F3EFE8] tabular-nums">
              {experiment.airflowRange[0]}–{experiment.airflowRange[1]} cm/s
            </div>
          </div>
          <div className="editorial-panel p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8A847B]">
              <Microscope className="h-4 w-4 text-[#D97B29]" />
              <span>Fuel Class &amp; Mode</span>
            </div>
            <div className="mt-2 text-sm font-semibold text-[#F3EFE8] line-clamp-1">
              {experiment.fuelClass}
            </div>
            <div className="mt-0.5 text-[11px] font-mono-data text-[#8A847B] line-clamp-1">
              {experiment.combustionType}
            </div>
          </div>
        </section>

        {/* URL-Synced Section Navigation Tabs */}
        <nav
          aria-label="Experiment dossier sections"
          className="mb-8 flex flex-wrap gap-1.5 border-b border-white/10 pb-3"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex cursor-pointer items-center gap-2 border px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors ${
                activeTab === t.id
                  ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#E68A38]'
                  : 'border-white/12 bg-[#0E0E11] text-[#C2BCB2] hover:border-white/30 hover:text-[#F3EFE8]'
              }`}
            >
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="font-mono-data text-[10px] text-[#8A847B]">({t.count})</span>
              )}
              {t.available === false && (
                <span className="text-[9px] text-[#8A847B]">—</span>
              )}
            </button>
          ))}
        </nav>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mb-10">
            <div className="lg:col-span-7 space-y-6">
              <div className="editorial-panel p-6 space-y-4">
                <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
                  Full Research Overview
                </h2>
                <p className="text-sm leading-relaxed text-[#C2BCB2]">{experiment.summary}</p>

                {experiment.combustionCharacteristics && (
                  <div className="border-t border-white/10 pt-4">
                    <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-[#D97B29] mb-2">
                      Combustion Behavior
                    </h3>
                    <p className="text-sm leading-relaxed text-[#C2BCB2]">
                      {experiment.combustionCharacteristics}
                    </p>
                  </div>
                )}

                {experiment.whyItMatters && (
                  <div className="border-t border-white/10 pt-4">
                    <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-[#F3EFE8] mb-2">
                      Crew Fire-Safety Significance
                    </h3>
                    <p className="text-sm leading-relaxed text-[#C2BCB2]">
                      {experiment.whyItMatters}
                    </p>
                  </div>
                )}
              </div>

              <div className="editorial-panel p-6">
                <DynamicChartRenderer
                  title="Multi-Experiment Operating & Safety Comparison"
                  verificationStatus={experiment.verificationStatus}
                  sourceLabel={experiment.ntrsId}
                  parameters={experiment.parameters}
                  currentSlug={experiment.slug}
                  comparisonSeries={comparisonSeries}
                  defaultMode="experiment-comparison"
                />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="editorial-panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-[#F3EFE8]">
                    Crew Safety Relevance Breakdown
                  </h2>
                  <span className="font-mono-data text-sm font-semibold text-[#D97B29] tabular-nums">
                    {experiment.relevanceScore}%
                  </span>
                </div>
                <div className="space-y-3">
                  {criteriaItems.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs text-[#C2BCB2] mb-1">
                        <span>{item.label}</span>
                        <span className="font-mono-data tabular-nums text-[#F3EFE8]">{item.val}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden bg-white/10">
                        <div className="h-full bg-[#D97B29]" style={{ width: `${item.val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="editorial-panel p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-[#F3EFE8]">
                    Quick Tab Jump
                  </h2>
                  <span className="font-mono-data text-[11px] text-[#8A847B]">
                    {experiment.datasets.length} datasets · {experiment.parameters.length} params
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('parameters')}
                    className="cursor-pointer border border-white/15 bg-[#060607] px-3 py-2.5 text-left text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                  >
                    Parameters ({experiment.parameters.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('dataset')}
                    className="cursor-pointer border border-white/15 bg-[#060607] px-3 py-2.5 text-left text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                  >
                    Dataset Explorer ({experiment.datasets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('findings')}
                    className="cursor-pointer border border-white/15 bg-[#060607] px-3 py-2.5 text-left text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                  >
                    Findings ({experiment.findings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('references')}
                    className="cursor-pointer border border-white/15 bg-[#060607] px-3 py-2.5 text-left text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
                  >
                    References ({experiment.references.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OBJECTIVES & BACKGROUND */}
        {activeTab === 'objectives' && (
          <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="editorial-panel p-6 lg:col-span-6">
              <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8] mb-4">
                Research Objectives
              </h2>
              {experiment.scientificObjectives.length > 0 ? (
                <ul className="space-y-3 text-sm text-[#C2BCB2]">
                  {experiment.scientificObjectives.map((obj) => (
                    <li key={obj} className="flex items-start gap-2.5">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#D97B29]" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#8A847B]">
                  No structured research objectives have been documented yet for this investigation.
                </p>
              )}
            </div>

            <div className="editorial-panel p-6 lg:col-span-6">
              <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8] mb-4">
                Scientific Background
              </h2>
              {experiment.researchBackground ? (
                <p className="text-sm leading-relaxed text-[#C2BCB2]">
                  {experiment.researchBackground}
                </p>
              ) : (
                <p className="text-sm text-[#8A847B]">
                  Scientific background narrative is currently unavailable for this record.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: EXPERIMENTAL SETUP */}
        {activeTab === 'setup' && (
          <div className="editorial-panel mb-10 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
                Experimental Hardware &amp; Setup
              </h2>
              <VerificationBadge status={experiment.verificationStatus} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 border-y border-white/10 py-4 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8A847B]">Platform</div>
                <div className="mt-1 font-medium text-[#F3EFE8]">{experiment.researchPlatform}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8A847B]">Hardware Facility</div>
                <div className="mt-1 font-medium text-[#F3EFE8]">{experiment.hardware}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8A847B]">Gravity Regime</div>
                <div className="mt-1 font-mono-data text-[#D97B29]">{experiment.gravity}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8A847B]">Operational Dates</div>
                <div className="mt-1 font-mono-data text-[#F3EFE8]">
                  {experiment.startDate || experiment.year}
                  {experiment.endDate ? ` – ${experiment.endDate}` : ''}
                </div>
              </div>
            </div>

            {experiment.experimentalSetup ? (
              <p className="text-sm leading-relaxed text-[#C2BCB2]">{experiment.experimentalSetup}</p>
            ) : (
              <div className="border border-white/15 bg-[#060607] p-5 text-sm text-[#8A847B]">
                Detailed experimental hardware configuration has not yet been verified or published for this study.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DYNAMIC PARAMETERS */}
        {activeTab === 'parameters' && (
          <div className="editorial-panel mb-10 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#D97B29]" />
                <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
                  Variable-Schema Experimental Parameters
                </h2>
              </div>
              <span className="font-mono-data text-xs text-[#8A847B]">
                {experiment.parameters.length} Measured Specifications
              </span>
            </div>

            {experiment.parameterNotes && (
              <p className="text-xs text-[#A9A39A]">{experiment.parameterNotes}</p>
            )}

            {experiment.parameters.length === 0 ? (
              <div className="border border-white/15 bg-[#060607] p-6 text-sm text-[#8A847B]">
                No measured physical parameters are available yet for this experiment.
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-[#060607] text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                    <tr>
                      <th className="px-4 py-3">Parameter</th>
                      <th className="px-4 py-3">Value / Range</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Measurement Source</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-[#C2BCB2]">
                    {experiment.parameters.map((prm) => (
                      <tr key={prm.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#F3EFE8]">{prm.name}</div>
                          <div className="text-[11px] text-[#8A847B]">{prm.description}</div>
                        </td>
                        <td className="px-4 py-3 font-mono-data text-[#F3EFE8] tabular-nums">
                          {prm.value}
                        </td>
                        <td className="px-4 py-3 font-mono-data text-[#D97B29]">
                          {prm.unit || '—'}
                        </td>
                        <td className="px-4 py-3">{prm.measurementSource}</td>
                        <td className="px-4 py-3 font-mono-data text-[10px]">
                          {prm.availabilityStatus}
                        </td>
                        <td className="px-4 py-3">
                          <VerificationBadge status={prm.verificationStatus} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: FINDINGS */}
        {activeTab === 'findings' && (
          <div className="editorial-panel mb-10 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
                Research Findings &amp; Provenance
              </h2>
              <VerificationBadge status={experiment.verificationStatus} />
            </div>

            {experiment.findings.length === 0 ? (
              <div className="border border-white/15 bg-[#060607] p-6 text-sm text-[#8A847B]">
                Findings are pending completion and post-flight peer review; no conclusions have been fabricated.
              </div>
            ) : (
              <div className="space-y-3.5">
                {experiment.findings.map((f, idx) => (
                  <article
                    key={f.id}
                    className="border border-white/10 bg-[#060607] p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[#D97B29] shrink-0" />
                        <h3 className="text-sm font-semibold text-[#F3EFE8]">
                          {idx + 1}. {f.title}
                        </h3>
                      </div>
                      <VerificationBadge status={f.verificationStatus} compact />
                    </div>
                    <p className="text-sm leading-relaxed text-[#C2BCB2]">{f.text}</p>
                    <div className="text-[11px] font-mono-data text-[#8A847B]">
                      Source: {f.sourceLabel}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: DATASET & CHARTS EXPLORER */}
        {activeTab === 'dataset' && (
          <div className="mb-10">
            <DatasetExplorer
              slug={experiment.slug}
              experimentVerificationStatus={experiment.verificationStatus}
              datasets={experiment.datasets}
              parameters={experiment.parameters}
              comparisonSeries={comparisonSeries}
            />
          </div>
        )}

        {/* TAB 7: REFERENCES */}
        {activeTab === 'references' && (
          <div className="editorial-panel mb-10 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#D97B29]" />
              <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
                Scientific References &amp; Documentation
              </h2>
            </div>

            {experiment.references.length === 0 ? (
              <div className="border border-white/15 bg-[#060607] p-6 text-sm text-[#8A847B]">
                No external references or NTRS publications are linked yet for this investigation.
              </div>
            ) : (
              <div className="space-y-3">
                {experiment.references.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex flex-col gap-3 border border-white/10 bg-[#060607] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <VerificationBadge status={ref.verificationStatus} compact />
                        <span className="font-mono-data text-[11px] text-[#D97B29]">
                          {ref.documentId}
                        </span>
                        <span className="text-xs text-[#8A847B]">
                          ({ref.publicationYear} · {ref.pageRef})
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-[#F3EFE8]">{ref.title}</h3>
                      <p className="text-xs text-[#8A847B]">{ref.authors}</p>
                    </div>

                    {ref.url && (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 border border-[#D97B29]/60 bg-[#D97B29]/10 px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                      >
                        <span>Open Reference</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Related Experiments (Deterministic Multi-Criteria Similarity) */}
        {experiment.relatedExperiments.length > 0 && (
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-serif-display text-2xl font-normal text-[#F3EFE8]">
                Related <span className="italic text-[#D97B29]">Experiments</span>
              </h2>
              <span className="text-xs text-[#8A847B]">
                Computed via category, combustion mode, fuel phase, envelope &amp; parameter similarity
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {experiment.relatedExperiments.map((rel) => (
                <Link
                  key={rel.id}
                  to={`/experiments/${rel.slug}`}
                  className="editorial-card group flex flex-col justify-between p-4"
                >
                  <div>
                    <div className="relative mb-3 aspect-[16/9] overflow-hidden border border-white/10 bg-[#060607]">
                      <img
                        src={rel.image}
                        alt={rel.fullName}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-2.5 top-2.5">
                        <VerificationBadge status={rel.verificationStatus} compact />
                      </div>
                      <div className="absolute right-2.5 bottom-2 border border-white/15 bg-[#060607]/85 px-2 py-0.5 font-mono-data text-[10px] text-[#E68A38]">
                        {rel.similarityScore}% Match
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-serif-display text-lg font-normal text-[#F3EFE8] group-hover:text-[#D97B29]">
                        {rel.name}
                      </h3>
                      <span className="font-mono-data text-xs text-[#8A847B] tabular-nums">
                        {rel.relevanceScore}% safety
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[#C2BCB2]">{rel.shortDescription}</p>

                    {rel.matchReasons.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {rel.matchReasons.map((reason) => (
                          <span
                            key={reason}
                            className="border border-white/15 bg-[#060607] px-2 py-0.5 text-[10px] text-[#A9A39A]"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] uppercase tracking-[0.14em]">
                    <span className="text-[#8A847B]">{rel.category}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#D97B29]">
                      <Database className="h-3 w-3" />
                      <span>Open Dossier</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, BarChart3, Info, Trophy } from 'lucide-react';
import { fetchRankings } from '../services/apiClient.ts';
import type { RankedExperiment } from '../services/apiClient.ts';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import { RevealOnScroll } from '../components/RevealOnScroll.tsx';
import { VerificationBadge } from '../components/VerificationBadge.tsx';

export const RankingPage: React.FC = () => {
  const [rankings, setRankings] = useState<RankedExperiment[]>([]);
  const [methodologyDesc, setMethodologyDesc] = useState('');
  const [methodologyVersion, setMethodologyVersion] = useState('');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRankings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRankings();
      setRankings(data.rankings);
      setMethodologyDesc(data.methodology.description);
      setMethodologyVersion(data.methodology.version);
      setWeights(data.methodology.weights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load experiment rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRankings();
  }, []);

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center border border-[#D97B29] bg-[#D97B29] font-mono-data text-xs font-bold text-[#060607]">
          01
        </span>
      );
    }
    if (rank <= 3) {
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center border border-[#D97B29]/55 bg-[#D97B29]/12 font-mono-data text-xs font-semibold text-[#E68A38]">
          0{rank}
        </span>
      );
    }
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center border border-white/15 bg-[#060607] font-mono-data text-xs font-medium text-[#8A847B]">
        {String(rank).padStart(2, '0')}
      </span>
    );
  };

  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Ranking' }]} />

        {/* Header */}
        <RevealOnScroll className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
                Crew Safety Relevance
              </span>
            </div>
            <h1 className="font-serif-display text-3xl font-normal tracking-tight text-[#F3EFE8] sm:text-4xl lg:text-[44px]">
              Most Relevant <span className="italic text-[#D97B29]">Experiments</span>
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-[#C2BCB2] max-w-2xl">
              Ranked assessment of historical NASA microgravity combustion campaigns scored by direct relevance to crew survival and habitat flammability limits.
            </p>
          </div>

          <div
            className="hidden sm:flex h-12 w-12 items-center justify-center border border-[#D97B29]/45 bg-[#D97B29]/10"
            aria-hidden="true"
          >
            <Trophy className="h-5 w-5 text-[#D97B29]" />
          </div>
        </RevealOnScroll>

        {error && (
          <div className="editorial-panel mb-8 flex items-center justify-between border-red-500/40 p-5 text-sm text-red-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadRankings}
              className="cursor-pointer border border-red-400/40 px-4 py-1.5 text-xs font-medium hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="space-y-6">
            <div className="editorial-panel h-72 animate-pulse p-6" />
            <div className="editorial-panel h-48 animate-pulse p-6" />
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {/* Full Leaderboard Table */}
            <RevealOnScroll>
              <div className="editorial-panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/12 bg-[#09090B] text-[11px] font-medium uppercase tracking-[0.16em] text-[#8A847B]">
                        <th className="py-4 pl-6 pr-3 w-16">#</th>
                        <th className="py-4 px-3">Experiment Name</th>
                        <th className="py-4 px-3">Category</th>
                        <th className="py-4 px-3 w-64">Crew Safety Relevance</th>
                        <th className="py-4 px-3">Why It Matters</th>
                        <th className="py-4 pl-3 pr-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8 text-sm">
                      {rankings.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-white/[0.025]">
                          <td className="py-4 pl-6 pr-3">{renderRankBadge(item.rank)}</td>
                          <td className="py-4 px-3">
                            <Link
                              to={`/experiments/${item.slug}`}
                              className="font-serif-display text-base text-[#F3EFE8] hover:text-[#D97B29] transition-colors"
                            >
                              {item.name}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-[#8A847B]">{item.hardware}</span>
                              <VerificationBadge status={item.verificationStatus} compact />
                            </div>
                          </td>
                          <td className="py-4 px-3 text-xs uppercase tracking-[0.12em] text-[#C2BCB2]">
                            {item.category}
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden bg-white/10">
                                <div
                                  className="h-full bg-[#D97B29] transition-all duration-700"
                                  style={{ width: `${item.relevanceScore}%` }}
                                />
                              </div>
                              <span className="w-12 text-right font-mono-data text-sm font-semibold text-[#F3EFE8] tabular-nums">
                                {item.relevanceScore}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-xs leading-relaxed text-[#C2BCB2] max-w-xs">
                            {item.whyItMatters}
                          </td>
                          <td className="py-4 pl-3 pr-6 text-right">
                            <Link
                              to={`/experiments/${item.slug}`}
                              className="inline-flex whitespace-nowrap items-center gap-1.5 border border-[#D97B29]/55 bg-[#060607] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607]"
                            >
                              <span>View Details</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </RevealOnScroll>

            {/* Bottom Split: Scoring Methodology + Comparison Visualization */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-6 editorial-panel p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-[#D97B29]" />
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                      Scoring Methodology
                    </h2>
                  </div>
                  <span className="font-mono-data text-[11px] text-[#D97B29]">{methodologyVersion}</span>
                </div>
                <p className="text-xs leading-relaxed text-[#C2BCB2] mb-3">{methodologyDesc}</p>
                <div className="mb-5 border border-[#D97B29]/35 bg-[#D97B29]/8 px-3 py-2 text-[11px] text-[#C2BCB2]">
                  <strong className="text-[#E68A38]">Catalog Note:</strong> Ranking percentages reflect weighted archival heuristics—not flight certification metrics. Items marked <span className="text-[#E68A38]">Demo Data</span> or <span className="text-[#F3EFE8]">Pending</span> require verified NASA telemetry ingestion.
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(weights).map(([key, weight]) => (
                    <div
                      key={key}
                      className="border border-white/10 bg-[#060607] p-3.5"
                    >
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8A847B]">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="mt-1.5 font-mono-data text-lg font-semibold text-[#D97B29] tabular-nums">
                        {Math.round(weight * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 editorial-panel p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-[#D97B29]" />
                  <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                    Safety Criteria Comparison
                  </h2>
                </div>
                <div className="space-y-3.5">
                  {rankings.map((exp) => (
                    <div key={exp.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-[#F3EFE8]">
                          #{exp.rank} {exp.name}
                          <span className="ml-2 font-normal text-[#8A847B]">
                            (Directness {exp.criteria.crewSafetyDirectness}% · Habitat {exp.criteria.habitatApplicability}%)
                          </span>
                        </span>
                        <span className="font-mono-data font-semibold text-[#D97B29] tabular-nums">
                          {exp.relevanceScore}%
                        </span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden bg-white/10">
                        <div
                          className="h-full bg-[#D97B29]"
                          style={{ width: `${exp.criteria.crewSafetyDirectness * 0.3}%` }}
                          title={`Crew Safety Directness: ${exp.criteria.crewSafetyDirectness}%`}
                        />
                        <div
                          className="h-full bg-[#E68A38]/80"
                          style={{ width: `${exp.criteria.habitatApplicability * 0.25}%` }}
                          title={`Habitat Applicability: ${exp.criteria.habitatApplicability}%`}
                        />
                        <div
                          className="h-full bg-[#C2BCB2]/75"
                          style={{ width: `${exp.criteria.telemetryFidelity * 0.15}%` }}
                          title={`Telemetry Richness: ${exp.criteria.telemetryFidelity}%`}
                        />
                        <div
                          className="h-full bg-[#8A847B]/65"
                          style={{
                            width: `${
                              exp.criteria.materialBreadth * 0.15 +
                              exp.criteria.hardwareHeritage * 0.08 +
                              exp.criteria.recency * 0.07
                            }%`,
                          }}
                          title="Material Breadth, Hardware Heritage & Recency"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

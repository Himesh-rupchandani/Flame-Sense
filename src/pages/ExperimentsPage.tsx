import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  fetchExperimentsPaginated,
  fetchExperimentStatistics,
} from '../services/apiClient.ts';
import type {
  ExperimentCategory,
  ExperimentListItem,
  ExperimentsPaginatedResponse,
  ExperimentStatisticsResponse,
  VerificationStatus,
} from '../types/experiments.ts';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import { RevealOnScroll } from '../components/RevealOnScroll.tsx';
import { DatasetStatusBadge, VerificationBadge } from '../components/VerificationBadge.tsx';
import { AdminExperimentDrawer } from '../components/AdminExperimentDrawer.tsx';

type SortField = 'relevance' | 'name' | 'date' | 'updated';

export const ExperimentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExperimentCategory | 'all'>('all');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | 'all'>('all');
  const [datasetAvailability, setDatasetAvailability] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortField>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ExperimentsPaginatedResponse | null>(null);
  const [stats, setStats] = useState<ExperimentStatisticsResponse | null>(null);
  const [allForAdmin, setAllForAdmin] = useState<ExperimentListItem[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pagedRes, statsRes, fullRes] = await Promise.all([
        fetchExperimentsPaginated({
          search,
          category,
          verificationStatus,
          datasetAvailability,
          sortBy,
          sortOrder,
          page,
          limit: 8,
        }),
        fetchExperimentStatistics(),
        fetchExperimentsPaginated({ page: 1, limit: 50 }),
      ]);
      setData(pagedRes);
      setStats(statsRes);
      setAllForAdmin(fullRes.experiments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach experiment database');
    } finally {
      setLoading(false);
    }
  }, [search, category, verificationStatus, datasetAvailability, sortBy, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 140);
    return () => clearTimeout(timer);
  }, [loadData]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    category !== 'all' ||
    verificationStatus !== 'all' ||
    datasetAvailability !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setCategory('all');
    setVerificationStatus('all');
    setDatasetAvailability('all');
    setSortBy('relevance');
    setSortOrder('desc');
    setPage(1);
  };

  const experiments = data?.experiments || [];
  const categoryCounts = data?.categoryCounts || [];

  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Experiments' }]} />

        {/* Header */}
        <RevealOnScroll className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
                Dynamic Research Repository
              </span>
            </div>
            <h1 className="font-serif-display text-3xl font-normal tracking-tight text-[#F3EFE8] sm:text-4xl lg:text-[44px]">
              Explore NASA&apos;s <span className="italic text-[#D97B29]">Space Fire Experiments</span>
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm sm:text-base text-[#C2BCB2]">
              Database-driven microgravity combustion catalog separating verified NASA NTRS records from clearly labelled illustrative demo data and pending datasets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 border border-[#D97B29]/75 bg-[#D97B29]/10 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Manage Research Records</span>
            </button>
          </div>
        </RevealOnScroll>

        {/* Live Database Summary Bar */}
        {stats && (
          <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="editorial-panel px-4 py-3.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">
                Total Experiments
              </div>
              <div className="mt-1 font-mono-data text-xl font-semibold text-[#F3EFE8] tabular-nums">
                {stats.totalExperiments}
              </div>
            </div>
            <div className="editorial-panel px-4 py-3.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
                NASA Verified
              </div>
              <div className="mt-1 font-mono-data text-xl font-semibold text-emerald-300 tabular-nums">
                {stats.verifiedCount}
              </div>
            </div>
            <div className="editorial-panel px-4 py-3.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#E68A38]/90">
                Demo / Pending
              </div>
              <div className="mt-1 font-mono-data text-xl font-semibold text-[#E68A38] tabular-nums">
                {stats.demoCount + stats.pendingCount}
              </div>
            </div>
            <div className="editorial-panel px-4 py-3.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#8A847B]">
                Datasets &amp; Samples
              </div>
              <div className="mt-1 font-mono-data text-xl font-semibold text-[#F3EFE8] tabular-nums">
                {stats.totalDatasets}{' '}
                <span className="text-xs font-normal text-[#8A847B]">
                  ({stats.totalSamples} runs)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Sorting Controls Panel */}
        <section className="editorial-panel mb-8 p-5 space-y-4">
          {/* Dynamic Category Chips with Counts */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setPage(1);
              }}
              className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                category === 'all'
                  ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#F3EFE8]'
                  : 'border-white/15 bg-[#060607] text-[#C2BCB2] hover:border-white/30'
              }`}
            >
              All Categories ({stats?.totalExperiments ?? '—'})
            </button>
            {categoryCounts.map((c) => (
              <button
                key={c.category}
                type="button"
                onClick={() => {
                  setCategory(c.category);
                  setPage(1);
                }}
                className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                  category.toLowerCase() === c.category.toLowerCase()
                    ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#F3EFE8]'
                    : 'border-white/15 bg-[#060607] text-[#C2BCB2] hover:border-white/30'
                }`}
              >
                {c.category} ({c.count})
              </button>
            ))}
          </div>

          {/* Search, Verification, Dataset Availability, Sort */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
            <div className="relative md:col-span-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A847B]" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search title, acronym, fuel, platform..."
                aria-label="Search experiments"
                className="w-full border border-white/15 bg-[#060607] py-2.5 pl-10 pr-4 text-xs text-[#F3EFE8] placeholder-[#8A847B] transition-colors focus:border-[#D97B29] focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={verificationStatus}
                onChange={(e) => {
                  setVerificationStatus(e.target.value as VerificationStatus | 'all');
                  setPage(1);
                }}
                aria-label="Filter by verification status"
                className="w-full cursor-pointer border border-white/15 bg-[#060607] px-3.5 py-2.5 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
              >
                <option value="all">All Verification Statuses</option>
                <option value="VERIFIED">NASA Verified Only</option>
                <option value="DEMO">Illustrative Demo Only</option>
                <option value="PENDING">Pending Verification</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                value={datasetAvailability}
                onChange={(e) => {
                  setDatasetAvailability(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by dataset availability"
                className="w-full cursor-pointer border border-white/15 bg-[#060607] px-3.5 py-2.5 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
              >
                <option value="all">All Datasets</option>
                <option value="AVAILABLE">CSV Available</option>
                <option value="DEMO_ONLY">Demo CSV Only</option>
                <option value="UNAVAILABLE_OR_PENDING">Pending / Unavailable</option>
              </select>
            </div>

            <div className="flex items-center gap-2 md:col-span-3">
              <select
                value={sortBy}
                onChange={(e) => {
                  const next = e.target.value as SortField;
                  setSortBy(next);
                  setSortOrder(next === 'name' ? 'asc' : 'desc');
                  setPage(1);
                }}
                aria-label="Sort experiments"
                className="flex-1 cursor-pointer border border-white/15 bg-[#060607] px-3 py-2.5 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
              >
                <option value="relevance">Sort: Crew Relevance</option>
                <option value="name">Sort: Title (A–Z)</option>
                <option value="date">Sort: Flight Date</option>
                <option value="updated">Sort: Recently Updated</option>
              </select>

              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={`Direction: ${sortOrder.toUpperCase()}`}
                aria-label="Toggle sort order"
                className="inline-flex cursor-pointer items-center gap-1 border border-white/15 bg-[#060607] px-3 py-2.5 text-xs text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#F3EFE8]"
              >
                <ArrowDownUp className="h-3.5 w-3.5 text-[#D97B29]" />
                <span className="font-mono-data uppercase">{sortOrder}</span>
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="Clear all filters"
                  className="inline-flex cursor-pointer items-center gap-1 border border-[#D97B29]/60 bg-[#D97B29]/10 px-3 py-2.5 text-xs text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only">Clear</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Error State */}
        {error && (
          <div className="editorial-panel flex flex-wrap items-center justify-between gap-4 border-red-500/40 p-5 text-sm text-red-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="cursor-pointer border border-red-400/40 bg-red-500/15 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && !error && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="editorial-panel h-80 animate-pulse p-4">
                <div className="mb-4 h-36 w-full bg-white/5" />
                <div className="mb-2 h-5 w-28 bg-white/10" />
                <div className="mb-1.5 h-3 w-full bg-white/5" />
                <div className="h-3 w-3/4 bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && experiments.length === 0 && (
          <div className="editorial-panel p-12 text-center">
            <p className="text-base font-medium text-[#F3EFE8]">
              No experiments matched your current filter combination.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-5 cursor-pointer border border-[#D97B29]/75 bg-[#D97B29]/10 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Experiment Cards Grid */}
        {!loading && !error && experiments.length > 0 && (
          <>
            <div className="mb-4 flex items-center justify-between text-xs text-[#8A847B]">
              <span>
                Showing <span className="font-mono-data text-[#F3EFE8]">{experiments.length}</span> of{' '}
                <span className="font-mono-data text-[#F3EFE8]">{data?.totalCount}</span> matching
                experiments
              </span>
              <span className="font-mono-data">
                Page {data?.page} / {data?.totalPages}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {experiments.map((exp) => (
                <Link
                  key={exp.id}
                  to={`/experiments/${exp.slug}`}
                  className="editorial-card group flex flex-col justify-between p-4 focus-visible:outline-1 focus-visible:outline-[#D97B29]"
                >
                  <div>
                    <div className="relative mb-3.5 aspect-[16/10] w-full overflow-hidden border border-white/10 bg-[#060607]">
                      <img
                        src={exp.image}
                        alt={`${exp.name} research experiment`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        style={{ filter: 'contrast(1.06) brightness(0.9)' }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060607]/75 via-transparent to-transparent" />
                      <div className="absolute left-2.5 top-2.5">
                        <VerificationBadge status={exp.verificationStatus} compact />
                      </div>
                      <div className="absolute right-2.5 bottom-2 font-mono-data text-[10px] text-[#F3EFE8] bg-[#060607]/80 px-2 py-0.5 border border-white/15">
                        {exp.relevanceScore}% Safety
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8] transition-colors group-hover:text-[#D97B29]">
                        {exp.name}
                      </h2>
                      <span className="font-mono-data text-xs text-[#8A847B] tabular-nums shrink-0 pt-1">
                        {exp.year}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-1 text-xs font-medium text-[#8A847B]">
                      {exp.fullName}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#C2BCB2]">
                      {exp.shortDescription}
                    </p>

                    <div className="mt-3.5 flex flex-wrap items-center gap-2 font-mono-data text-[11px] text-[#A9A39A] tabular-nums">
                      <Flame className="h-3.5 w-3.5 text-[#D97B29] shrink-0" />
                      <span>O₂ {exp.oxygenRange[0]}–{exp.oxygenRange[1]}%</span>
                      <span aria-hidden="true">·</span>
                      <DatasetStatusBadge status={exp.datasetStatus} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                    <span className="truncate text-[11px] uppercase tracking-[0.14em] text-[#8A847B]">
                      {exp.category}
                    </span>
                    <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#D97B29] group-hover:text-[#E68A38]">
                      <span>Open Dossier</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination Bar */}
            {data && data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex cursor-pointer items-center gap-1 border border-white/15 bg-[#0E0E11] px-3.5 py-2 text-xs text-[#F3EFE8] hover:border-[#D97B29] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                {Array.from({ length: data.totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={`cursor-pointer border px-3.5 py-2 font-mono-data text-xs transition-colors ${
                        page === pNum
                          ? 'border-[#D97B29] bg-[#D97B29]/20 text-[#E68A38]'
                          : 'border-white/15 bg-[#0E0E11] text-[#C2BCB2] hover:border-white/30'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  className="inline-flex cursor-pointer items-center gap-1 border border-white/15 bg-[#0E0E11] px-3.5 py-2 text-xs text-[#F3EFE8] hover:border-[#D97B29] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Protected Admin Drawer */}
      <AdminExperimentDrawer
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        experiments={allForAdmin}
        onMutated={loadData}
      />
    </main>
  );
};

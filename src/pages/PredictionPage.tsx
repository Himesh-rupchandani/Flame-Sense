import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Gauge,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  Wind,
} from 'lucide-react';
import { FUEL_TYPES } from '../data/nasaExperiments.ts';
import type { FuelTypeId } from '../data/nasaExperiments.ts';
import {
  fetchHealth,
  fetchPredictionById,
  fetchRecentPredictions,
  predictFireRisk,
} from '../services/apiClient.ts';
import type {
  HealthResponse,
  ModelEvaluationSummary,
  PredictionHistoryItem,
  PredictionResponse,
} from '../services/apiClient.ts';
import { Breadcrumbs } from '../components/Breadcrumbs.tsx';
import { RevealOnScroll } from '../components/RevealOnScroll.tsx';

export const PredictionPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialO2 = Number(searchParams.get('oxygen')) || 40;
  const initialPsi = Number(searchParams.get('pressure')) || 10.2;
  const initialFlow = searchParams.has('airflow') ? Number(searchParams.get('airflow')) : 50;
  const initialFuelParam = searchParams.get('fuel') as FuelTypeId | null;
  const initialFuel: FuelTypeId = FUEL_TYPES.some((f) => f.id === initialFuelParam)
    ? initialFuelParam!
    : 'solid-fabric';
  const presetSourceSlug = searchParams.get('source');
  const predictionIdParam = searchParams.get('id');

  const [oxygenPct, setOxygenPct] = useState<number>(Math.min(85, Math.max(21, initialO2)));
  const [pressurePsi, setPressurePsi] = useState<number>(Math.min(14.7, Math.max(4.3, initialPsi)));
  const [airflowCmS, setAirflowCmS] = useState<number>(Math.min(100, Math.max(0, initialFlow)));
  const [fuelType, setFuelType] = useState<FuelTypeId>(initialFuel);

  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [healthInfo, setHealthInfo] = useState<HealthResponse | null>(null);
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string>('Checking ML service...');
  const [limitationsNote, setLimitationsNote] = useState<string | null>(null);
  const [isTrainedMlModel, setIsTrainedMlModel] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const refreshHistory = async () => {
    try {
      const recent = await fetchRecentPredictions(6);
      setHistory(recent);
    } catch {
      // Non-blocking history load
    }
  };

  const runPrediction = async (params: {
    oxygenPct: number;
    pressurePsi: number;
    airflowCmS: number;
    fuelType: FuelTypeId;
  }) => {
    setLoading(true);
    setModelError(null);
    setValidationError(null);
    try {
      const result = await predictFireRisk(params);
      setPrediction(result);
      setIsConnected(true);
      setModelName(result.modelVersion || 'Scikit-learn Classifier');
      setIsTrainedMlModel(Boolean(result.isTrainedMlModel));
      if (result.methodologyDisclaimer) {
        setLimitationsNote(result.methodologyDisclaimer);
      }
      await refreshHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Python ML prediction service is unavailable.';
      if (
        message.toLowerCase().includes('must be between') ||
        message.toLowerCase().includes('invalid prediction input') ||
        message.toLowerCase().includes('unsupported fueltype')
      ) {
        setValidationError(message);
      } else {
        setIsConnected(false);
        setPrediction(null);
        setModelError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const health = await fetchHealth();
        if (!mounted) return;
        setHealthInfo(health);
        const mlReady =
          health.mlServiceConnected !== undefined ? health.mlServiceConnected : health.connected;
        setIsConnected(mlReady);
        setModelName(health.modelName);
        setIsTrainedMlModel(Boolean(health.isTrainedMlModel));
        if (health.limitationsNote) {
          setLimitationsNote(health.limitationsNote);
        }

        await refreshHistory();

        if (predictionIdParam) {
          const saved = await fetchPredictionById(predictionIdParam);
          if (!mounted) return;
          setOxygenPct(saved.input.oxygenPct);
          setPressurePsi(saved.input.pressurePsi);
          setAirflowCmS(saved.input.airflowCmS);
          setFuelType(saved.input.fuelType);
          setPrediction(saved);
          return;
        }

        if (mlReady) {
          await runPrediction({
            oxygenPct: Math.min(85, Math.max(21, initialO2)),
            pressurePsi: Math.min(14.7, Math.max(4.3, initialPsi)),
            airflowCmS: Math.min(100, Math.max(0, initialFlow)),
            fuelType: initialFuel,
          });
        } else {
          setModelError(
            health.limitationsNote ||
              'Python Scikit-learn ML prediction service is currently unavailable. Start the ML microservice on port 8001 to generate predictions.'
          );
        }
      } catch (err) {
        if (!mounted) return;
        setIsConnected(false);
        setModelName('ML Service Disconnected');
        setModelError(
          err instanceof Error ? err.message : 'Prediction backend is unreachable.'
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [predictionIdParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runPrediction({ oxygenPct, pressurePsi, airflowCmS, fuelType });
  };

  const handleRetryConnection = async () => {
    try {
      const health = await fetchHealth();
      setHealthInfo(health);
      const mlReady =
        health.mlServiceConnected !== undefined ? health.mlServiceConnected : health.connected;
      setIsConnected(mlReady);
      setModelName(health.modelName);
      setIsTrainedMlModel(Boolean(health.isTrainedMlModel));
      if (health.limitationsNote) {
        setLimitationsNote(health.limitationsNote);
      }
      if (mlReady) {
        await runPrediction({ oxygenPct, pressurePsi, airflowCmS, fuelType });
      } else {
        setModelError(
          health.limitationsNote ||
            'Python Scikit-learn ML prediction service is still offline.'
        );
      }
    } catch (err) {
      setIsConnected(false);
      setModelError(err instanceof Error ? err.message : 'Unable to reach prediction backend.');
    }
  };

  const handleLoadHistoryItem = async (id: string) => {
    setSearchParams({ id });
    try {
      const saved = await fetchPredictionById(id);
      setOxygenPct(saved.input.oxygenPct);
      setPressurePsi(saved.input.pressurePsi);
      setAirflowCmS(saved.input.airflowCmS);
      setFuelType(saved.input.fuelType);
      setPrediction(saved);
      setModelError(null);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : 'Unable to load saved prediction.');
    }
  };

  const score = prediction?.riskScore ?? 0;
  const clampedAngle = -90 + (Math.min(100, Math.max(0, score)) / 100) * 180;
  const bandColor =
    prediction?.classification === 'DANGER'
      ? '#EF4444'
      : prediction?.classification === 'CAUTION'
        ? '#E6A23C'
        : '#22C55E';

  const activeEvaluation: ModelEvaluationSummary | null =
    prediction?.modelEvaluation || healthInfo?.modelEvaluation || null;

  const provenanceLabel =
    prediction?.datasetProvenance ||
    healthInfo?.datasetProvenance ||
    'DEMO / SYNTHETIC DATA (Project CSVs + Synthetic Microgravity Sweep — Not Verified NASA Flight Data)';

  const probabilities = prediction?.probabilities || {
    SAFE: prediction?.classification === 'SAFE' ? prediction?.confidence ?? 100 : 0,
    CAUTION: prediction?.classification === 'CAUTION' ? prediction?.confidence ?? 100 : 0,
    DANGER: prediction?.classification === 'DANGER' ? prediction?.confidence ?? 100 : 0,
  };

  const probabilityEntries: Array<{
    label: 'SAFE' | 'CAUTION' | 'DANGER';
    pct: number;
    color: string;
    bgClass: string;
  }> = [
    { label: 'SAFE', pct: probabilities.SAFE, color: '#22C55E', bgClass: 'text-emerald-300' },
    { label: 'CAUTION', pct: probabilities.CAUTION, color: '#E6A23C', bgClass: 'text-amber-300' },
    { label: 'DANGER', pct: probabilities.DANGER, color: '#EF4444', bgClass: 'text-red-300' },
  ];

  const evalLabels = activeEvaluation?.labels || ['SAFE', 'CAUTION', 'DANGER'];

  return (
    <main className="relative min-h-screen bg-[#060607] pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Fire Risk Prediction' }]} />

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[1.5px] w-8 bg-[#D97B29] shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#A9A39A]">
                Scikit-learn Classification &amp; SHAP Explainability
              </span>
            </div>
            <h1 className="font-serif-display text-3xl font-normal tracking-tight text-[#F3EFE8] sm:text-4xl lg:text-[44px]">
              Predict <span className="italic text-[#D97B29]">Fire Risk</span>
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-[#C2BCB2] max-w-2xl">
              Classify spacecraft cabin fire risk (SAFE, CAUTION, DANGER) using a trained Python Scikit-learn model with calibrated class probabilities and exact Shapley attributions.
            </p>
          </div>

          {presetSourceSlug && (
            <Link
              to={`/experiments/${presetSourceSlug}`}
              className="inline-flex items-center gap-2 border border-[#D97B29]/55 bg-[#D97B29]/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
            >
              <span>Preset from {presetSourceSlug.toUpperCase()}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Explicit DEMO / SYNTHETIC DATA Provenance Disclosure Banner */}
        <div
          role="note"
          className="mb-8 flex flex-col gap-2 border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3.5 sm:flex-row sm:items-start sm:gap-3"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-xs leading-relaxed text-[#E5DFD5]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 font-mono-data text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                DEMO / SYNTHETIC DATA
              </span>
              <span className="font-semibold text-[#F3EFE8]">
                Dataset Provenance &amp; Research Scope Disclosure
              </span>
            </div>
            <p className="mt-1.5 text-[#C2BCB2]">
              {provenanceLabel}. Training records are constructed from the project&apos;s CSV datasets combined with clearly tagged synthetic microgravity parameter sweeps and are{' '}
              <strong className="text-[#F3EFE8]">NOT verified NASA flight-certified experimental test data</strong>. Real experimental CSVs can replace the training set at any time via{' '}
              <code className="border border-white/10 bg-[#060607] px-1.5 py-0.5 font-mono-data text-[11px] text-[#E68A38]">
                python3 ml/train_model.py --dataset &lt;csv_path&gt;
              </code>
              .
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Input Parameters Form */}
          <div className="lg:col-span-5">
            <RevealOnScroll>
              <form onSubmit={handleSubmit} className="editorial-panel p-6">
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
                  <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                    Input Parameters
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[10px] font-mono-data uppercase tracking-[0.14em] ${
                      isConnected
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                        : isConnected === false
                          ? 'border-red-500/35 bg-red-500/10 text-red-300'
                          : 'border-white/15 bg-white/5 text-[#8A847B]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isConnected ? 'bg-emerald-400' : isConnected === false ? 'bg-red-400' : 'bg-[#8A847B]'
                      }`}
                    />
                    {isConnected
                      ? 'ML Service Connected'
                      : isConnected === false
                        ? 'ML Service Unavailable'
                        : 'Checking ML Service'}
                  </span>
                </div>

                {/* 1. Oxygen Concentration */}
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="oxygen-slider" className="flex items-center gap-1.5 text-xs font-medium text-[#C2BCB2]">
                      <Flame className="h-3.5 w-3.5 text-[#D97B29]" />
                      <span>Oxygen Concentration</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={21}
                        max={85}
                        step={1}
                        value={oxygenPct}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) setOxygenPct(v);
                        }}
                        aria-label="Oxygen Concentration percentage"
                        className="w-16 border border-white/15 bg-[#060607] px-2 py-1 text-right font-mono-data text-xs font-semibold text-[#F3EFE8] tabular-nums focus:border-[#D97B29] focus:outline-none"
                      />
                      <span className="font-mono-data text-xs text-[#8A847B]">%</span>
                    </div>
                  </div>
                  <input
                    id="oxygen-slider"
                    type="range"
                    min={21}
                    max={85}
                    step={1}
                    value={Math.min(85, Math.max(21, oxygenPct))}
                    onChange={(e) => setOxygenPct(Number(e.target.value))}
                    className="space-range"
                  />
                  <div className="mt-1.5 flex justify-between font-mono-data text-[10px] text-[#8A847B]">
                    <span>21% (ISS)</span>
                    <span>30% (Artemis)</span>
                    <span>85%</span>
                  </div>
                </div>

                {/* 2. Pressure */}
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="pressure-slider" className="flex items-center gap-1.5 text-xs font-medium text-[#C2BCB2]">
                      <Gauge className="h-3.5 w-3.5 text-[#D97B29]" />
                      <span>Pressure</span>
                      <span className="font-mono-data text-[10px] text-[#8A847B]">(4.3 – 14.7 psi)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={4.3}
                        max={14.7}
                        step={0.1}
                        value={pressurePsi}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) setPressurePsi(v);
                        }}
                        aria-label="Cabin pressure in psi"
                        className="w-16 border border-white/15 bg-[#060607] px-2 py-1 text-right font-mono-data text-xs font-semibold text-[#F3EFE8] tabular-nums focus:border-[#D97B29] focus:outline-none"
                      />
                      <span className="font-mono-data text-xs text-[#8A847B]">psi</span>
                    </div>
                  </div>
                  <input
                    id="pressure-slider"
                    type="range"
                    min={4.3}
                    max={14.7}
                    step={0.1}
                    value={Math.min(14.7, Math.max(4.3, pressurePsi))}
                    onChange={(e) => setPressurePsi(Number(e.target.value))}
                    className="space-range"
                  />
                  <div className="mt-1.5 flex justify-between font-mono-data text-[10px] text-[#8A847B]">
                    <span>4.3 psi (EVA)</span>
                    <span>10.2 psi (Lunar)</span>
                    <span>14.7 psi</span>
                  </div>
                </div>

                {/* 3. Airflow */}
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="airflow-slider" className="flex items-center gap-1.5 text-xs font-medium text-[#C2BCB2]">
                      <Wind className="h-3.5 w-3.5 text-[#D97B29]" />
                      <span>Airflow</span>
                      <span className="font-mono-data text-[10px] text-[#8A847B]">(0 – 100 cm/s)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={airflowCmS}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) setAirflowCmS(v);
                        }}
                        aria-label="Ventilation airflow in cm/s"
                        className="w-16 border border-white/15 bg-[#060607] px-2 py-1 text-right font-mono-data text-xs font-semibold text-[#F3EFE8] tabular-nums focus:border-[#D97B29] focus:outline-none"
                      />
                      <span className="font-mono-data text-xs text-[#8A847B]">cm/s</span>
                    </div>
                  </div>
                  <input
                    id="airflow-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.min(100, Math.max(0, airflowCmS))}
                    onChange={(e) => setAirflowCmS(Number(e.target.value))}
                    className="space-range"
                  />
                  <div className="mt-1.5 flex justify-between font-mono-data text-[10px] text-[#8A847B]">
                    <span>0 (Quiescent)</span>
                    <span>20 cm/s</span>
                    <span>100 cm/s</span>
                  </div>
                </div>

                {/* 4. Fuel Type Selector */}
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="fuel-type-select" className="text-xs font-medium text-[#C2BCB2]">
                      Fuel Type
                    </label>
                    <select
                      id="fuel-type-select"
                      value={fuelType}
                      onChange={(e) => setFuelType(e.target.value as FuelTypeId)}
                      className="cursor-pointer border border-white/15 bg-[#060607] px-2.5 py-1 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                    >
                      {FUEL_TYPES.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#0E0E11]">
                          {f.label} — {f.representativeMaterial}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {FUEL_TYPES.map((f) => {
                      const active = fuelType === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFuelType(f.id)}
                          className={`cursor-pointer whitespace-nowrap border px-3 py-2 text-xs font-medium transition-colors ${
                            active
                              ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#F3EFE8]'
                              : 'border-white/12 bg-[#060607] text-[#8A847B] hover:border-white/30 hover:text-[#C2BCB2]'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Analyze Fire Risk Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2.5 border border-[#D97B29] bg-[#D97B29] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#060607] transition-colors hover:bg-[#E68A38] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Running Scikit-learn Inference...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Fire Risk</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {validationError && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 border border-red-500/45 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div>
                      <div className="font-semibold text-red-300">Parameter Out of Validated Bounds</div>
                      <p className="mt-0.5 text-red-200/90">{validationError}</p>
                    </div>
                  </div>
                )}

                {limitationsNote && (
                  <div className="mt-4 border border-[#D97B29]/35 bg-[#060607] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#C2BCB2]">
                    <span className="font-semibold text-[#E68A38]">
                      {isTrainedMlModel ? 'Python ML Service: ' : 'ML Status Notice: '}
                    </span>
                    {limitationsNote}
                  </div>
                )}
              </form>
            </RevealOnScroll>
          </div>

          {/* Right Column: Prediction Results, SHAP, Evaluation & History */}
          <div className="lg:col-span-7 space-y-6">
            <RevealOnScroll delay={0.08}>
              <div className="editorial-panel p-6 sm:p-7">
                {modelError && (
                  <div className="flex flex-col items-center justify-center border border-red-500/35 bg-[#060607] p-8 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-red-500/40 bg-red-500/10 text-red-400">
                      <WifiOff className="h-5 w-5" />
                    </div>
                    <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                      Python ML Prediction Service Unavailable
                    </h2>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-[#C2BCB2]">
                      {modelError}. No formula fallback or synthetic values are returned when the trained ML model service is offline.
                    </p>
                    <button
                      type="button"
                      onClick={handleRetryConnection}
                      className="mt-5 inline-flex cursor-pointer items-center gap-2 border border-[#D97B29]/75 bg-[#D97B29]/10 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry ML Connection</span>
                    </button>
                  </div>
                )}

                {!modelError && loading && !prediction && (
                  <div className="flex h-80 flex-col items-center justify-center gap-3 text-sm text-[#8A847B]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#D97B29]" />
                    <span>Running trained Scikit-learn classifier &amp; Shapley explainability...</span>
                  </div>
                )}

                {!modelError && prediction && (
                  <div className="grid grid-cols-1 gap-7 md:grid-cols-12">
                    {/* Left Sub-panel: Prediction Result Gauge + Confidence + Class Probabilities */}
                    <div className="md:col-span-7 flex flex-col justify-between">
                      <div>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                            Prediction Result
                          </h2>
                          <div className="flex items-center gap-2">
                            {prediction.isTrainedMlModel && (
                              <span className="inline-flex items-center gap-1 border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono-data text-[10px] uppercase tracking-wider text-emerald-300">
                                <Cpu className="h-3 w-3" />
                                Scikit-learn ML
                              </span>
                            )}
                            <span className="font-mono-data text-[11px] text-[#8A847B]">{modelName}</span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-5 border border-white/10 bg-[#060607] p-4">
                          <div className="relative flex flex-col items-center w-48 shrink-0">
                            <svg viewBox="0 0 220 130" className="w-full h-auto overflow-visible">
                              <path
                                d="M 22 110 A 88 88 0 0 1 63 36"
                                fill="none"
                                stroke="#22C55E"
                                strokeWidth="14"
                                strokeLinecap="round"
                              />
                              <path
                                d="M 70 32 A 88 88 0 0 1 150 32"
                                fill="none"
                                stroke="#E6A23C"
                                strokeWidth="14"
                                strokeLinecap="round"
                              />
                              <path
                                d="M 157 36 A 88 88 0 0 1 198 110"
                                fill="none"
                                stroke="#EF4444"
                                strokeWidth="14"
                                strokeLinecap="round"
                              />
                              <g
                                transform={`translate(110, 110) rotate(${clampedAngle})`}
                                className="transition-transform duration-500 ease-out"
                              >
                                <polygon points="-3.5,0 0,-74 3.5,0" fill="#F3EFE8" />
                                <circle cx="0" cy="0" r="6" fill="#D97B29" stroke="#060607" strokeWidth="2" />
                              </g>
                            </svg>

                            <div className="-mt-4 text-center">
                              <div className="text-2xl font-bold tracking-wider" style={{ color: bandColor }}>
                                {prediction.classification}
                              </div>
                              <div className="text-[11px] font-medium text-[#8A847B]">
                                Confidence{' '}
                                <span className="font-mono-data text-[#F3EFE8] tabular-nums">
                                  {prediction.confidence !== undefined
                                    ? `${prediction.confidence}%`
                                    : `${prediction.riskScore}/100`}
                                </span>
                                {' · '}
                                <span className="font-mono-data text-[#A9A39A] tabular-nums">
                                  Idx {prediction.riskScore}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 text-center sm:text-left">
                            <div className="text-xs leading-snug text-[#C2BCB2]">
                              Reference LOC Threshold:
                            </div>
                            <div className="mt-1 font-mono-data text-3xl font-bold text-[#F3EFE8] tabular-nums">
                              {prediction.locPercent}%
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#8A847B]">(Context Baseline)</div>
                            <div
                              className={`mt-2.5 inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-mono-data text-[11px] font-semibold tabular-nums ${
                                prediction.o2MarginFromLoc > 0
                                  ? 'border-red-500/35 bg-red-500/12 text-red-300'
                                  : 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300'
                              }`}
                            >
                              {prediction.o2MarginFromLoc > 0 ? '+' : ''}
                              {prediction.o2MarginFromLoc}% vs. LOC
                            </div>
                          </div>
                        </div>

                        {/* Class Probability Breakdown */}
                        <div className="mt-4 border border-white/10 bg-[#060607] p-4">
                          <div className="mb-2.5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#F3EFE8]">Predicted Class Probabilities</span>
                            <span className="font-mono-data text-[11px] text-[#8A847B]">
                              Top Confidence:{' '}
                              <span className="text-[#F3EFE8] font-semibold">
                                {prediction.confidence ?? Math.max(probabilities.SAFE, probabilities.CAUTION, probabilities.DANGER)}%
                              </span>
                            </span>
                          </div>
                          <div className="space-y-2">
                            {probabilityEntries.map((entry) => (
                              <div key={entry.label}>
                                <div className="mb-1 flex items-center justify-between font-mono-data text-[11px]">
                                  <span className={entry.bgClass}>{entry.label}</span>
                                  <span className="text-[#F3EFE8] tabular-nums">{entry.pct.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden border border-white/10 bg-white/[0.03]">
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, entry.pct))}%`,
                                      backgroundColor: entry.color,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Explanation Box */}
                      <div className="mt-4 border border-white/10 bg-[#060607] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#F3EFE8] mb-1.5">
                          <Info className="h-4 w-4 text-[#D97B29]" />
                          <span>Model Output Explanation</span>
                        </div>
                        <p className="text-xs leading-relaxed text-[#C2BCB2]">{prediction.explanation}</p>

                        {prediction.corroboratingExperiments.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5 text-[11px] text-[#8A847B]">
                            <span>Related historical studies:</span>
                            {prediction.corroboratingExperiments.map((exp) => (
                              <Link
                                key={exp.id}
                                to={`/experiments/${exp.slug}`}
                                className="font-semibold text-[#D97B29] hover:text-[#E68A38] hover:underline"
                              >
                                {exp.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Sub-panel: SHAP Explainability */}
                    <div className="md:col-span-5 flex flex-col justify-between border-t border-white/10 pt-6 md:border-t-0 md:border-l md:pl-6 md:pt-0">
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <h2 className="font-serif-display text-xl font-normal text-[#F3EFE8]">
                            SHAP Explainability
                          </h2>
                          <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#8A847B]">
                            Base: {prediction.baselineScore}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {prediction.shapValues.map((item) => (
                            <div key={item.feature}>
                              <div className="mb-1.5 flex items-center justify-between text-xs">
                                <span className="font-medium text-[#F3EFE8]">
                                  {item.label}
                                  <span className="ml-1.5 font-mono-data text-[10px] text-[#8A847B]">
                                    ({item.valueLabel})
                                  </span>
                                </span>
                                <span className="font-mono-data font-semibold text-[#F3EFE8] tabular-nums">
                                  {item.importancePct}%
                                </span>
                              </div>
                              <div className="relative h-3 w-full overflow-hidden border border-white/10 bg-[#060607]">
                                <div
                                  className="h-full bg-[#D97B29] transition-all duration-500"
                                  style={{ width: `${Math.min(100, item.importancePct * 1.35)}%` }}
                                />
                              </div>
                              <div className="mt-1 flex justify-between font-mono-data text-[10px] text-[#8A847B]">
                                <span>
                                  SHAP φ: {item.phi >= 0 ? '+' : ''}
                                  {item.phi} pts
                                </span>
                                <span
                                  className={
                                    item.direction === 'increases' ? 'text-[#E68A38]' : 'text-[#C2BCB2]'
                                  }
                                >
                                  {item.direction === 'increases' ? '▲ Raises Risk' : '▼ Mitigates Risk'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 border border-white/10 bg-[#060607] p-3.5">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-[#C2BCB2]">
                          <span>Normalized Input Contribution</span>
                          <AlertTriangle className="h-3.5 w-3.5 text-[#D97B29]" />
                        </div>
                        <div className="flex h-2 w-full overflow-hidden bg-white/10">
                          {prediction.shapValues.map((s, idx) => {
                            const colors = ['#D97B29', '#E68A38', '#C2BCB2', '#6E685F'];
                            return (
                              <div
                                key={s.feature}
                                title={`${s.label}: ${s.importancePct}%`}
                                style={{
                                  width: `${s.importancePct}%`,
                                  backgroundColor: colors[idx % colors.length],
                                }}
                                className="h-full transition-all duration-500"
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </RevealOnScroll>

            {/* Model Evaluation, Confusion Matrix & Algorithm Comparison */}
            {activeEvaluation && (
              <div className="editorial-panel p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#D97B29]" />
                    <h2 className="font-serif-display text-lg font-normal text-[#F3EFE8]">
                      Model Evaluation &amp; Algorithm Comparison
                    </h2>
                  </div>
                  <span className="font-mono-data text-[11px] text-[#8A847B]">
                    Active: <span className="text-[#F3EFE8]">{modelName}</span>
                    {activeEvaluation.trainSamples && activeEvaluation.testSamples
                      ? ` · Split ${activeEvaluation.trainSamples}/${activeEvaluation.testSamples}`
                      : ''}
                  </span>
                </div>

                {/* Summary Metric Tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="border border-white/10 bg-[#060607] p-3">
                    <div className="text-[10px] font-mono-data uppercase tracking-wider text-[#8A847B]">
                      Test Accuracy
                    </div>
                    <div className="mt-1 font-mono-data text-xl font-bold text-[#F3EFE8] tabular-nums">
                      {activeEvaluation.accuracy !== undefined
                        ? `${(activeEvaluation.accuracy * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="border border-white/10 bg-[#060607] p-3">
                    <div className="text-[10px] font-mono-data uppercase tracking-wider text-[#8A847B]">
                      Macro Precision
                    </div>
                    <div className="mt-1 font-mono-data text-xl font-bold text-[#F3EFE8] tabular-nums">
                      {activeEvaluation.precisionMacro !== undefined
                        ? `${(activeEvaluation.precisionMacro * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="border border-white/10 bg-[#060607] p-3">
                    <div className="text-[10px] font-mono-data uppercase tracking-wider text-[#8A847B]">
                      Macro Recall
                    </div>
                    <div className="mt-1 font-mono-data text-xl font-bold text-[#F3EFE8] tabular-nums">
                      {activeEvaluation.recallMacro !== undefined
                        ? `${(activeEvaluation.recallMacro * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="border border-white/10 bg-[#060607] p-3">
                    <div className="text-[10px] font-mono-data uppercase tracking-wider text-[#8A847B]">
                      Macro F1-Score
                    </div>
                    <div className="mt-1 font-mono-data text-xl font-bold text-[#D97B29] tabular-nums">
                      {activeEvaluation.f1Macro !== undefined
                        ? `${(activeEvaluation.f1Macro * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
                  {/* Confusion Matrix */}
                  {activeEvaluation.confusionMatrix && activeEvaluation.confusionMatrix.length > 0 && (
                    <div className="lg:col-span-5 border border-white/10 bg-[#060607] p-3.5">
                      <div className="mb-2.5 text-xs font-semibold text-[#F3EFE8]">
                        Test Confusion Matrix (Actual vs. Predicted)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-center font-mono-data text-[11px]">
                          <thead>
                            <tr className="border-b border-white/10 text-[#8A847B]">
                              <th className="py-1.5 text-left font-normal">Actual \ Pred</th>
                              {evalLabels.map((lbl) => (
                                <th key={lbl} className="py-1.5 font-medium">
                                  {lbl}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeEvaluation.confusionMatrix.map((row, rIdx) => (
                              <tr key={evalLabels[rIdx] || rIdx} className="border-b border-white/5 last:border-b-0">
                                <td className="py-2 text-left font-semibold text-[#C2BCB2]">
                                  {evalLabels[rIdx] || rIdx}
                                </td>
                                {row.map((val, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`py-2 tabular-nums ${
                                      rIdx === cIdx
                                        ? 'bg-emerald-500/12 font-bold text-emerald-300'
                                        : val > 0
                                          ? 'bg-red-500/10 text-red-300'
                                          : 'text-[#8A847B]'
                                    }`}
                                  >
                                    {val}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Algorithm Comparison */}
                  {activeEvaluation.modelComparison && activeEvaluation.modelComparison.length > 0 && (
                    <div className="lg:col-span-7 border border-white/10 bg-[#060607] p-3.5">
                      <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-[#F3EFE8]">
                        <span>Algorithm Benchmark (Same Held-out Split)</span>
                        {activeEvaluation.datasetFile && (
                          <span className="font-mono-data text-[10px] font-normal text-[#8A847B]">
                            {activeEvaluation.datasetFile}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono-data text-[11px]">
                          <thead>
                            <tr className="border-b border-white/10 text-[#8A847B]">
                              <th className="py-1.5 pr-2 font-normal">Algorithm</th>
                              <th className="py-1.5 px-2 text-right font-normal">Acc</th>
                              <th className="py-1.5 px-2 text-right font-normal">Prec</th>
                              <th className="py-1.5 px-2 text-right font-normal">Rec</th>
                              <th className="py-1.5 pl-2 text-right font-normal">F1</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeEvaluation.modelComparison.map((cmp) => (
                              <tr
                                key={cmp.key}
                                className={`border-b border-white/5 last:border-b-0 ${
                                  cmp.selected ? 'bg-[#D97B29]/10 text-[#F3EFE8]' : 'text-[#C2BCB2]'
                                }`}
                              >
                                <td className="py-2 pr-2 font-sans text-xs">
                                  <div className="flex items-center gap-1.5">
                                    {cmp.selected && (
                                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#D97B29]" />
                                    )}
                                    <span className={cmp.selected ? 'font-semibold text-[#F3EFE8]' : ''}>
                                      {cmp.modelName}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums">
                                  {(cmp.accuracy * 100).toFixed(1)}%
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums">
                                  {(cmp.precisionMacro * 100).toFixed(1)}%
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums">
                                  {(cmp.recallMacro * 100).toFixed(1)}%
                                </td>
                                <td className="py-2 pl-2 text-right font-semibold tabular-nums text-[#E68A38]">
                                  {(cmp.f1Macro * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Saved Prediction History from SQLite */}
            {history.length > 0 && (
              <div className="editorial-panel p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#F3EFE8]">
                    <Clock className="h-4 w-4 text-[#D97B29]" />
                    <span>Recent Persisted Predictions</span>
                  </div>
                  <span className="font-mono-data text-[11px] text-[#8A847B]">Saved in SQLite</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {history.map((item) => {
                    const badgeStyle =
                      item.classification === 'DANGER'
                        ? 'text-red-300 bg-red-500/12 border-red-500/35'
                        : item.classification === 'CAUTION'
                          ? 'text-amber-200 bg-amber-500/12 border-amber-500/35'
                          : 'text-emerald-300 bg-emerald-500/12 border-emerald-500/35';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleLoadHistoryItem(item.id)}
                        className="cursor-pointer border border-white/10 bg-[#060607] p-3 text-left transition-colors hover:border-[#D97B29]/60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`border px-2 py-0.5 text-[10px] font-bold ${badgeStyle}`}>
                            {item.classification}
                          </span>
                          <span className="font-mono-data text-xs font-semibold text-[#F3EFE8] tabular-nums">
                            {item.confidence !== undefined ? `${item.confidence}% conf` : `${item.riskScore}/100`}
                          </span>
                        </div>
                        <div className="mt-2 font-mono-data text-[11px] text-[#C2BCB2] tabular-nums">
                          {item.oxygenPct}% O₂ · {item.pressurePsi} psi · {item.airflowCmS} cm/s
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-[#8A847B]">
                          <span className="capitalize">{item.fuelType.replace('-', ' ')}</span>
                          {item.modelVersion && (
                            <span className="truncate font-mono-data max-w-[115px]">{item.modelVersion}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

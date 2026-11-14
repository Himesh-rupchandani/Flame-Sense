import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  KeyRound,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  adminAddOrUpdateFinding,
  adminAddParameter,
  adminAddReference,
  adminCreateExperiment,
  adminDeleteExperiment,
  adminRegisterDataset,
  adminUpdateExperiment,
  createAdminSession,
} from '../services/apiClient.ts';
import type { ExperimentListItem, FuelTypeId, VerificationStatus } from '../types/experiments.ts';

interface AdminExperimentDrawerProps {
  open: boolean;
  onClose: () => void;
  experiments: ExperimentListItem[];
  onMutated: () => void;
}

type AdminTab = 'create' | 'edit' | 'parameter' | 'finding' | 'dataset' | 'reference';

const STORAGE_KEY = 'fif_admin_session_token';

export const AdminExperimentDrawer: React.FC<AdminExperimentDrawerProps> = ({
  open,
  onClose,
  experiments,
  onMutated,
}) => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(STORAGE_KEY) || '');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<AdminTab>('create');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);

  // Create form state
  const [cName, setCName] = useState('');
  const [cAcronym, setCAcronym] = useState('');
  const [cFullName, setCFullName] = useState('');
  const [cCategory, setCCategory] = useState('Combustion');
  const [cFuelType, setCFuelType] = useState<FuelTypeId>('solid-fabric');
  const [cPlatform, setCPlatform] = useState('International Space Station (ISS)');
  const [cStatus, setCStatus] = useState<VerificationStatus>('DEMO');
  const [cImage, setCImage] = useState('/images/orbital_planet_backdrop_1794638817321.jpg');
  const [cShortDesc, setCShortDesc] = useState('');
  const [cSummary, setCSummary] = useState('');

  // Target selector for Edit & Sub-resources
  const [targetSlug, setTargetSlug] = useState<string>(experiments[0]?.slug || '');
  const activeTarget = experiments.find((e) => e.slug === targetSlug) || experiments[0];

  // Edit fields
  const [eShortDesc, setEShortDesc] = useState('');
  const [eStatus, setEStatus] = useState<VerificationStatus>('VERIFIED');
  const [eCategory, setECategory] = useState('');
  const [eImage, setEImage] = useState('');

  // Parameter fields
  const [pName, setPName] = useState('');
  const [pValue, setPValue] = useState('');
  const [pUnit, setPUnit] = useState('');
  const [pDesc, setPDesc] = useState('');

  // Finding fields
  const [fTitle, setFTitle] = useState('');
  const [fText, setFText] = useState('');
  const [fSource, setFSource] = useState('');
  const [fStatus, setFStatus] = useState<VerificationStatus>('DEMO');

  // Dataset fields
  const [dName, setDName] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dStatus, setDStatus] = useState<VerificationStatus>('DEMO');
  const [dCsv, setDCsv] = useState(
    'sample_id,oxygen_pct,burn_rate_mm_s\n1,21,0.45\n2,30,0.88\n3,36,1.24'
  );

  // Reference fields
  const [rTitle, setRTitle] = useState('');
  const [rAuthors, setRAuthors] = useState('');
  const [rUrl, setRUrl] = useState('https://ntrs.nasa.gov/');
  const [rDocId, setRDocId] = useState('');

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const session = await createAdminSession(passcode);
      sessionStorage.setItem(STORAGE_KEY, session.token);
      setToken(session.token);
      setPasscode('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken('');
    setStatusMsg(null);
  };

  const selectTargetForEdit = (slug: string) => {
    setTargetSlug(slug);
    setConfirmDeleteSlug(null);
    const found = experiments.find((x) => x.slug === slug);
    if (found) {
      setEShortDesc(found.shortDescription);
      setEStatus(found.verificationStatus);
      setECategory(found.category);
      setEImage(found.image);
    }
  };

  const runAction = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await fn();
      setStatusMsg({ type: 'ok', text: okText });
      onMutated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed.';
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('forbidden')) {
        handleSignOut();
      }
      setStatusMsg({ type: 'err', text: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Research Experiment Administration"
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs"
    >
      <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-white/15 bg-[#0A0A0D] text-[#F3EFE8]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-[#D97B29]" />
            <h2 className="font-serif-display text-xl font-normal">
              Research Archive <span className="italic text-[#D97B29]">Administration</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {token && (
              <button
                type="button"
                onClick={handleSignOut}
                className="cursor-pointer border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C2BCB2] hover:border-[#D97B29] hover:text-[#E68A38]"
              >
                Sign Out
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close administration panel"
              className="cursor-pointer border border-white/15 p-1.5 text-[#C2BCB2] hover:border-[#D97B29] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!token ? (
            <form onSubmit={handleLogin} className="editorial-panel p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-sm font-medium text-[#F3EFE8]">
                <Lock className="h-4 w-4 text-[#D97B29]" />
                <span>Protected Research Management Console</span>
              </div>
              <p className="text-xs leading-relaxed text-[#C2BCB2]">
                Creating, modifying, or deleting experiments, datasets, parameters, and verification statuses requires administrative authorization. Public read APIs remain open.
              </p>

              {authError && (
                <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{authError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-[#8A847B] mb-2">
                  Administrator Passcode
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A847B]" />
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                    placeholder="Enter administrative passcode..."
                    className="w-full border border-white/15 bg-[#060607] py-2.5 pl-10 pr-3 text-xs text-[#F3EFE8] placeholder-[#8A847B] focus:border-[#D97B29] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authBusy}
                className="cursor-pointer border border-[#D97B29]/80 bg-[#D97B29]/15 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607] disabled:opacity-50"
              >
                {authBusy ? 'Verifying...' : 'Authenticate Session'}
              </button>
            </form>
          ) : (
            <>
              {/* Action Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
                {[
                  { id: 'create', label: 'New Experiment' },
                  { id: 'edit', label: 'Edit / Delete' },
                  { id: 'parameter', label: '+ Parameter' },
                  { id: 'finding', label: '+ Finding' },
                  { id: 'dataset', label: '+ Dataset CSV' },
                  { id: 'reference', label: '+ Reference' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setStatusMsg(null);
                      if (t.id === 'edit' && activeTarget) {
                        selectTargetForEdit(activeTarget.slug);
                      }
                      setTab(t.id as AdminTab);
                    }}
                    className={`cursor-pointer border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                      tab === t.id
                        ? 'border-[#D97B29] bg-[#D97B29]/15 text-[#E68A38]'
                        : 'border-white/15 bg-[#060607] text-[#C2BCB2] hover:border-white/30'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {statusMsg && (
                <div
                  className={`flex items-center gap-2 border p-3 text-xs ${
                    statusMsg.type === 'ok'
                      ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/45 bg-red-500/10 text-red-200'
                  }`}
                >
                  {statusMsg.type === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              {/* Create New Experiment */}
              {tab === 'create' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAction(async () => {
                      await adminCreateExperiment(token, {
                        name: cName,
                        acronym: cAcronym || cName,
                        fullName: cFullName || cName,
                        category: cCategory,
                        fuelType: cFuelType,
                        researchPlatform: cPlatform,
                        verificationStatus: cStatus,
                        image: cImage,
                        shortDescription: cShortDesc,
                        summary: cSummary || cShortDesc,
                      });
                      setCName('');
                      setCAcronym('');
                      setCFullName('');
                      setCShortDesc('');
                      setCSummary('');
                    }, 'Experiment created in database and rankings recalculated.');
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Experiment Name *
                      </label>
                      <input
                        required
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        placeholder="e.g. SoFIE-MIST"
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Acronym
                      </label>
                      <input
                        value={cAcronym}
                        onChange={(e) => setCAcronym(e.target.value)}
                        placeholder="e.g. MIST"
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Full Scientific Title
                    </label>
                    <input
                      value={cFullName}
                      onChange={(e) => setCFullName(e.target.value)}
                      placeholder="Full NASA investigation or study name"
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Category
                      </label>
                      <input
                        value={cCategory}
                        onChange={(e) => setCCategory(e.target.value)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Fuel Phase
                      </label>
                      <select
                        value={cFuelType}
                        onChange={(e) => setCFuelType(e.target.value as FuelTypeId)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      >
                        <option value="solid-fabric">Solid Fabric</option>
                        <option value="plastic">Plastic</option>
                        <option value="liquid">Liquid</option>
                        <option value="gas">Gas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Verification Status
                      </label>
                      <select
                        value={cStatus}
                        onChange={(e) => setCStatus(e.target.value as VerificationStatus)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      >
                        <option value="DEMO">DEMO (Illustrative)</option>
                        <option value="PENDING">PENDING</option>
                        <option value="VERIFIED">VERIFIED</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Research Platform
                      </label>
                      <input
                        value={cPlatform}
                        onChange={(e) => setCPlatform(e.target.value)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Experiment Image Path / URL
                      </label>
                      <input
                        value={cImage}
                        onChange={(e) => setCImage(e.target.value)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Short Description *
                    </label>
                    <input
                      required
                      value={cShortDesc}
                      onChange={(e) => setCShortDesc(e.target.value)}
                      placeholder="Concise summary for library cards..."
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Full Overview
                    </label>
                    <textarea
                      rows={3}
                      value={cSummary}
                      onChange={(e) => setCSummary(e.target.value)}
                      placeholder="Scientific overview..."
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex cursor-pointer items-center gap-2 border border-[#D97B29]/80 bg-[#D97B29]/15 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{busy ? 'Creating...' : 'Create Experiment'}</span>
                  </button>
                </form>
              )}

              {/* Shared Experiment Selector for non-create tabs */}
              {tab !== 'create' && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                    Select Target Experiment
                  </label>
                  <select
                    value={activeTarget?.slug || ''}
                    onChange={(e) => selectTargetForEdit(e.target.value)}
                    className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                  >
                    {experiments.map((exp) => (
                      <option key={exp.slug} value={exp.slug}>
                        {exp.name} [{exp.verificationStatus}] — {exp.category}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Edit / Delete Experiment */}
              {tab === 'edit' && activeTarget && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Short Description
                    </label>
                    <input
                      value={eShortDesc}
                      onChange={(e) => setEShortDesc(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Category
                      </label>
                      <input
                        value={eCategory}
                        onChange={(e) => setECategory(e.target.value)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Verification Status
                      </label>
                      <select
                        value={eStatus}
                        onChange={(e) => setEStatus(e.target.value as VerificationStatus)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                      >
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="DEMO">DEMO</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Image URL
                    </label>
                    <input
                      value={eImage}
                      onChange={(e) => setEImage(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8] focus:border-[#D97B29] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            adminUpdateExperiment(token, activeTarget.id, {
                              shortDescription: eShortDesc,
                              category: eCategory,
                              verificationStatus: eStatus,
                              image: eImage,
                            }),
                          `Updated '${activeTarget.name}' record.`
                        )
                      }
                      className="cursor-pointer border border-[#D97B29]/80 bg-[#D97B29]/15 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                    >
                      Save Changes
                    </button>

                    {confirmDeleteSlug === activeTarget.slug ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(async () => {
                              await adminDeleteExperiment(token, activeTarget.id);
                              setConfirmDeleteSlug(null);
                            }, `Deleted '${activeTarget.name}'.`)
                          }
                          className="cursor-pointer border border-red-500 bg-red-500/25 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-red-100 hover:bg-red-500"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSlug(null)}
                          className="cursor-pointer border border-white/15 px-3 py-2 text-[11px] text-[#C2BCB2]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSlug(activeTarget.slug)}
                        className="inline-flex cursor-pointer items-center gap-1.5 border border-red-500/45 px-3 py-2 text-[11px] uppercase tracking-wider text-red-300 hover:bg-red-500/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Add Dynamic Parameter */}
              {tab === 'parameter' && activeTarget && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAction(async () => {
                      await adminAddParameter(token, activeTarget.id, {
                        name: pName,
                        value: pValue,
                        unit: pUnit,
                        description: pDesc || pName,
                        verificationStatus: activeTarget.verificationStatus,
                      });
                      setPName('');
                      setPValue('');
                      setPUnit('');
                      setPDesc('');
                    }, `Added parameter to '${activeTarget.name}'.`);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Parameter Name *
                      </label>
                      <input
                        required
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="e.g. Radiant Heat Flux"
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Value / Range *
                      </label>
                      <input
                        required
                        value={pValue}
                        onChange={(e) => setPValue(e.target.value)}
                        placeholder="e.g. 12–48"
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Unit
                      </label>
                      <input
                        value={pUnit}
                        onChange={(e) => setPUnit(e.target.value)}
                        placeholder="e.g. kW/m²"
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Description
                    </label>
                    <input
                      value={pDesc}
                      onChange={(e) => setPDesc(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="cursor-pointer border border-[#D97B29]/80 bg-[#D97B29]/15 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                  >
                    Attach Parameter
                  </button>
                </form>
              )}

              {/* Add Finding */}
              {tab === 'finding' && activeTarget && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAction(async () => {
                      await adminAddOrUpdateFinding(token, activeTarget.id, {
                        title: fTitle,
                        text: fText,
                        sourceLabel: fSource,
                        verificationStatus: fStatus,
                      });
                      setFTitle('');
                      setFText('');
                      setFSource('');
                    }, `Added finding to '${activeTarget.name}'.`);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Finding Title
                      </label>
                      <input
                        value={fTitle}
                        onChange={(e) => setFTitle(e.target.value)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Verification Status
                      </label>
                      <select
                        value={fStatus}
                        onChange={(e) => setFStatus(e.target.value as VerificationStatus)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      >
                        <option value="DEMO">DEMO</option>
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Finding Details *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={fText}
                      onChange={(e) => setFText(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Source Citation / Label
                    </label>
                    <input
                      value={fSource}
                      onChange={(e) => setFSource(e.target.value)}
                      placeholder="e.g. NASA NTRS Document 20220001234"
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="cursor-pointer border border-[#D97B29]/80 bg-[#D97B29]/15 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                  >
                    Save Finding
                  </button>
                </form>
              )}

              {/* Register Dataset CSV */}
              {tab === 'dataset' && activeTarget && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAction(async () => {
                      await adminRegisterDataset(token, activeTarget.id, {
                        datasetName: dName,
                        description: dDesc,
                        verificationStatus: dStatus,
                        csvContent: dCsv,
                      });
                      setDName('');
                      setDDesc('');
                    }, `Registered CSV dataset for '${activeTarget.name}'.`);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Dataset Name *
                      </label>
                      <input
                        required
                        value={dName}
                        onChange={(e) => setDName(e.target.value)}
                        placeholder="e.g. Oxygen Sweep CSV"
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Dataset Provenance
                      </label>
                      <select
                        value={dStatus}
                        onChange={(e) => setDStatus(e.target.value as VerificationStatus)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      >
                        <option value="DEMO">DEMO (Authorized Demo CSV)</option>
                        <option value="VERIFIED">VERIFIED (Research Table)</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Description
                    </label>
                    <input
                      value={dDesc}
                      onChange={(e) => setDDesc(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      CSV Payload (Header + Rows)
                    </label>
                    <textarea
                      rows={5}
                      value={dCsv}
                      onChange={(e) => setDCsv(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 font-mono-data text-xs text-[#F3EFE8]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="cursor-pointer border border-[#D97B29]/80 bg-[#D97B29]/15 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                  >
                    Register &amp; Analyze CSV
                  </button>
                </form>
              )}

              {/* Add Reference */}
              {tab === 'reference' && activeTarget && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAction(async () => {
                      await adminAddReference(token, activeTarget.id, {
                        title: rTitle,
                        authors: rAuthors,
                        url: rUrl,
                        documentId: rDocId || 'REF-NEW',
                        verificationStatus: activeTarget.verificationStatus,
                      });
                      setRTitle('');
                      setRAuthors('');
                      setRDocId('');
                    }, `Added reference to '${activeTarget.name}'.`);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Publication Title *
                    </label>
                    <input
                      required
                      value={rTitle}
                      onChange={(e) => setRTitle(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Authors
                      </label>
                      <input
                        value={rAuthors}
                        onChange={(e) => setRAuthors(e.target.value)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                        Document / NTRS ID
                      </label>
                      <input
                        value={rDocId}
                        onChange={(e) => setRDocId(e.target.value)}
                        className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A847B] mb-1">
                      Reference URL *
                    </label>
                    <input
                      required
                      type="url"
                      value={rUrl}
                      onChange={(e) => setRUrl(e.target.value)}
                      className="w-full border border-white/15 bg-[#060607] px-3 py-2 text-xs text-[#F3EFE8]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="cursor-pointer border border-[#D97B29]/80 bg-[#D97B29]/15 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E68A38] hover:bg-[#D97B29] hover:text-[#060607]"
                  >
                    Attach Reference
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

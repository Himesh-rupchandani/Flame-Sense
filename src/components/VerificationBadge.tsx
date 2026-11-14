import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Database } from 'lucide-react';
import type { DatasetStatus, VerificationStatus } from '../types/experiments.ts';

interface VerificationBadgeProps {
  status: VerificationStatus;
  compact?: boolean;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ status, compact = false }) => {
  if (status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-emerald-500/45 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span>{compact ? 'Verified' : 'NASA Verified'}</span>
      </span>
    );
  }

  if (status === 'DEMO') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-[#D97B29]/65 bg-[#D97B29]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#E68A38]">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>{compact ? 'Demo Data' : 'Illustrative Demo'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 border border-white/25 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#C2BCB2]">
      <Clock className="h-3 w-3 shrink-0" />
      <span>{compact ? 'Pending' : 'Pending Verification'}</span>
    </span>
  );
};

interface DatasetStatusBadgeProps {
  status: DatasetStatus;
}

export const DatasetStatusBadge: React.FC<DatasetStatusBadgeProps> = ({ status }) => {
  if (status === 'AVAILABLE') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono-data uppercase tracking-wider text-emerald-300">
        <Database className="h-3 w-3" />
        <span>CSV Ready</span>
      </span>
    );
  }
  if (status === 'DEMO_ONLY') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono-data uppercase tracking-wider text-[#E68A38]">
        <Database className="h-3 w-3" />
        <span>Demo CSV</span>
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono-data uppercase tracking-wider text-[#C2BCB2]">
        <Database className="h-3 w-3" />
        <span>Pending</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono-data uppercase tracking-wider text-[#8A847B]">
      <Database className="h-3 w-3" />
      <span>No Dataset</span>
    </span>
  );
};

interface ProvenanceBannerProps {
  verificationStatus: VerificationStatus;
  sourceLabel?: string;
}

export const ProvenanceBanner: React.FC<ProvenanceBannerProps> = ({
  verificationStatus,
  sourceLabel,
}) => {
  if (verificationStatus === 'DEMO') {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 border border-[#D97B29]/55 bg-[#D97B29]/10 px-3.5 py-2.5 text-xs text-[#F3EFE8]"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#E68A38]" />
        <div>
          <span className="font-semibold text-[#E68A38]">
            Illustrative Demo Data — Not NASA Experimental Measurements.
          </span>
          {sourceLabel && <span className="ml-1.5 text-[#C2BCB2]">{sourceLabel}</span>}
        </div>
      </div>
    );
  }

  if (verificationStatus === 'PENDING') {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 border border-white/15 bg-[#060607] px-3.5 py-2.5 text-xs text-[#C2BCB2]"
      >
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#A9A39A]" />
        <div>
          <span className="font-semibold text-[#F3EFE8]">Pending Verification / Acquisition:</span>{' '}
          {sourceLabel || 'Raw scientific measurements have not yet been ingested or verified for this record.'}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 border border-emerald-500/35 bg-emerald-500/5 px-3.5 py-2.5 text-xs text-[#C2BCB2]"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <div>
        <span className="font-semibold text-emerald-300">Verified Provenance:</span>{' '}
        {sourceLabel || 'Peer-reviewed NASA Technical Reports Server (NTRS) publication record.'}
      </div>
    </div>
  );
};

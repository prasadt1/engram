import React from 'react';
import { ApertureLoader } from './ApertureLoader';

interface Props {
  message: string;
  waitSec: number;
  hint?: string;
}

export const ScanProgressBanner: React.FC<Props> = ({ message, waitSec, hint }) => (
  <div
    className="rounded-xl border border-warm/60 bg-canvas-elevated/50 p-4 space-y-2"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="flex items-center gap-2 text-stone-300 text-sm">
      <ApertureLoader size={16} blades={6} className="shrink-0" />
      <span className="font-medium">{message}</span>
    </div>
    <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
      <div
        className="h-full bg-brand-500/80 transition-all duration-1000 ease-out-expo"
        style={{ width: `${Math.min(92, 10 + waitSec * 2)}%` }}
      />
    </div>
    <p className="text-xs text-muted">
      {hint ?? `Usually 20–60 seconds · ${waitSec}s — keep this tab open`}
    </p>
  </div>
);

import React from 'react';
import { Camera, Upload, X } from 'lucide-react';
import type { Assignment } from '../types/practice';

interface Props {
  assignment: Assignment;
  onShootNow: () => void;
  onStudioUpload: () => void;
  onDismiss: () => void;
}

/** Inline dismissible banner (Pass 2) — replaces modal after accepting practice. */
export const PracticeInlineShootBanner: React.FC<Props> = ({
  assignment,
  onShootNow,
  onStudioUpload,
  onDismiss,
}) => (
  <div
    className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
    role="region"
    aria-label="Ready to shoot"
  >
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase text-brand-400 tracking-wide mb-1">
        Ready to shoot?
      </p>
      <p className="text-sm text-stone-200 line-clamp-2">{assignment.brief}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onShootNow}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-on-brand text-sm font-semibold"
      >
        <Camera className="w-4 h-4" aria-hidden />
        Field
      </button>
      <button
        type="button"
        onClick={onStudioUpload}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-warm text-stone-200 text-sm font-semibold hover:bg-surface-2"
      >
        <Upload className="w-4 h-4" aria-hidden />
        Studio
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="p-2 rounded-lg text-muted hover:text-stone-200 hover:bg-surface-2"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

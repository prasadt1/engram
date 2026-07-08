import React from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { FEATURES } from '../config/features';
import type { Assignment } from '../types/practice';

interface Props {
  assignment: Assignment;
  onShootNow: () => void;
  onUploadHere: () => void;
  onDismiss: () => void;
}

/** Inline dismissible banner after accepting practice — stay on Practice to upload. */
export const PracticeInlineShootBanner: React.FC<Props> = ({
  assignment,
  onShootNow,
  onUploadHere,
  onDismiss,
}) => (
  <div
    className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
    role="region"
    aria-label="Ready to shoot"
  >
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase text-brand-400 tracking-wide mb-1">
        Ready to practice?
      </p>
      <p className="text-sm text-stone-200 line-clamp-2">{assignment.brief}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {FEATURES.field && (
        <button
          type="button"
          onClick={onShootNow}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-warm text-stone-200 text-sm font-semibold hover:bg-surface-2"
        >
          <Camera className="w-4 h-4" aria-hidden />
          Field
        </button>
      )}
      <button
        type="button"
        onClick={onUploadHere}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-on-brand text-sm font-semibold"
      >
        <Upload className="w-4 h-4" aria-hidden />
        Upload here
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

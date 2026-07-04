import React, { useEffect, useRef } from 'react';
import { Camera, Clock, X } from 'lucide-react';
import type { Assignment } from '../types/practice';

interface Props {
  assignment: Assignment;
  onShootNow: () => void;
  onLater: () => void;
  onStudioUpload: () => void;
}

export const ShootNowDialog: React.FC<Props> = ({
  assignment,
  onShootNow,
  onLater,
  onStudioUpload,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onLater();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const list = Array.from(focusable).filter((el) => !el.hasAttribute('disabled'));
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onLater]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 animate-overlayFadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shoot-now-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-surface-2 border border-warm shadow-2xl p-6 animate-springIn"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="shoot-now-title" className="text-lg font-bold text-white">
            Ready to practice?
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onLater}
            className="text-muted hover:text-white p-1"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-brand-400 mb-2 capitalize">
          Focus: {assignment.targetSkill.replace(/_/g, ' ')}
        </p>
        <p className="text-sm text-stone-300 leading-relaxed mb-6">{assignment.brief}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onShootNow}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500 text-on-brand font-semibold text-sm"
          >
            <Camera className="w-4 h-4" />
            Shoot now (Field)
          </button>
          <button
            type="button"
            onClick={onStudioUpload}
            className="w-full px-4 py-3 rounded-xl border border-warm text-stone-200 text-sm font-medium hover:bg-surface-3"
          >
            Upload later in Studio
          </button>
          <button
            type="button"
            onClick={onLater}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-muted text-sm hover:text-stone-300"
          >
            <Clock className="w-4 h-4" />
            Not now — stay on Practice
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';

interface Props {
  /** Optional icon, set in an amber-wash well (a lucide-react glyph ~24px). */
  icon?: React.ReactNode;
  /** Serif headline, e.g. "No frames in your Library yet". */
  title?: string;
  /** Supporting note in the mentor's voice. */
  description?: string;
  /** A single action, typically a primary button. */
  action?: React.ReactNode;
  /** "mat" draws the dashed empty-print frame; "bare" omits it. Default "mat". */
  variant?: 'mat' | 'bare';
  className?: string;
}

/**
 * EmptyState — the empty darkroom frame. Shown when a Library, queue, or search
 * comes up empty: an empty photo mat (dashed warm border) holding an icon well,
 * a serif line in Iris's voice, a muted note, and one call-to-action.
 */
export const EmptyState: React.FC<Props> = ({
  icon,
  title,
  description,
  action,
  variant = 'mat',
  className = '',
}) => {
  const isMat = variant === 'mat';
  return (
    <div
      className={`flex flex-col items-center text-center gap-3.5 ${
        isMat
          ? 'px-8 py-11 bg-surface-1 border border-dashed border-warm rounded-2xl'
          : 'px-4 py-6'
      } ${className}`}
    >
      {icon && (
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-500/10 text-brand-400">
          {icon}
        </div>
      )}
      {title && (
        <p className="font-serif text-xl leading-tight text-white text-balance">{title}</p>
      )}
      {description && (
        <p className="max-w-[34ch] text-sm leading-relaxed text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type ToastVariant = 'default' | 'brand' | 'success' | 'danger';

interface Props {
  /** Optional bold first line. */
  title?: string;
  /** Body copy. */
  message?: React.ReactNode;
  /** Accent + icon colour. Default "default". */
  variant?: ToastVariant;
  /** Optional leading icon (a lucide-react glyph, inherits the variant colour). */
  icon?: React.ReactNode;
  /** Auto-dismiss after this many ms (requires onDismiss). Omit to persist. */
  duration?: number | null;
  /** Called on the close button and on auto-dismiss. Omit to hide the ×. */
  onDismiss?: () => void;
  className?: string;
}

const ACCENT: Record<ToastVariant, { border: string; icon: string }> = {
  default: { border: 'border-warm', icon: 'text-muted' },
  brand: { border: 'border-brand-500/20', icon: 'text-brand-400' },
  success: { border: 'border-emerald-500/35', icon: 'text-emerald-400' },
  danger: { border: 'border-rose-500/35', icon: 'text-rose-400' },
};

/**
 * Toast — a transient darkroom notice. Reads like a quiet aside from the mentor.
 * The entrance is transform-only (opacity is pinned to 1), so a throttled or
 * captured frame can never strand it invisible — at worst it sits a few px low.
 * Render it via <ToastHost> / useToast() rather than mounting it directly.
 */
export const Toast: React.FC<Props> = ({
  title,
  message,
  variant = 'default',
  icon,
  duration = null,
  onDismiss,
  className = '',
}) => {
  const [shown, setShown] = useState(false);
  const accent = ACCENT[variant];

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(true);
      return;
    }
    const id = window.setTimeout(() => setShown(true), 10);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!duration || !onDismiss) return;
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 w-[min(380px,90vw)] rounded-xl border bg-canvas-elevated shadow-lg px-4 py-3.5 ${accent.border} ${className}`}
      style={{
        transform: shown ? 'translateY(0)' : 'translateY(12px)',
        transition: 'transform 0.4s var(--ease-spring)',
      }}
    >
      {icon && <span className={`shrink-0 mt-px ${accent.icon}`}>{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-white">{title}</p>}
        {message && <div className="text-[13px] leading-normal text-stone-300">{message}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -mt-0.5 p-1 rounded text-stone-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

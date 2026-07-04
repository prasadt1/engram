import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface Props {
  message: string;
  variant?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
  className?: string;
}

const VARIANT_STYLES = {
  error: {
    container: 'border-rose-500/40 bg-rose-950/40',
    icon: 'text-rose-400',
    text: 'text-rose-200/90',
  },
  warning: {
    container: 'border-amber-500/40 bg-amber-950/30',
    icon: 'text-amber-400',
    text: 'text-amber-200/90',
  },
  info: {
    container: 'border-brand-500/30 bg-brand-500/10',
    icon: 'text-brand-400',
    text: 'text-stone-300',
  },
} as const;

export const InlineAlertBanner: React.FC<Props> = ({
  message,
  variant = 'error',
  onDismiss,
  className = '',
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`rounded-lg border p-3 flex items-start gap-2 ${styles.container} ${className}`}
      role="alert"
    >
      <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`} aria-hidden />
      <p className={`text-sm flex-1 min-w-0 ${styles.text}`}>{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded text-muted hover:text-white"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

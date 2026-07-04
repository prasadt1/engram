import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ChatErrorBanner: React.FC<Props> = ({ message, onRetry, onDismiss }) => (
  <div
    className="mx-4 mb-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
    role="alert"
  >
    <div className="flex items-start gap-2 flex-1 min-w-0">
      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
      <p className="text-sm text-rose-200/90">{message}</p>
    </div>
    <div className="flex gap-2 shrink-0">
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-surface-2 text-sm text-white hover:bg-surface-3 border border-warm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1.5 text-sm text-muted hover:text-white"
        >
          Dismiss
        </button>
      )}
    </div>
  </div>
);

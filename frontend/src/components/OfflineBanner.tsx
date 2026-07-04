import React from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => (
  <div
    className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200/90"
    role="status"
  >
    <WifiOff className="w-4 h-4 shrink-0" />
    You appear to be offline. I&apos;ll work again when your connection returns.
  </div>
);

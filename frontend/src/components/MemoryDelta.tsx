/**
 * MemoryDelta — after a new critique, show how long-term memory changed.
 */

import React from 'react';
import { Card, Eyebrow } from './primitives';
import type { MemoryReceipt } from '../types';

interface Props {
  receipt: MemoryReceipt | null | undefined;
}

export const MemoryDelta: React.FC<Props> = ({ receipt }) => {
  if (!receipt) return null;

  const recalled = receipt.recalled ?? [];
  const retired = receipt.retired_excluded ?? [];
  const dropped = receipt.dropped_by_budget ?? [];

  if (recalled.length === 0 && retired.length === 0 && dropped.length === 0) return null;

  return (
    <Card padding="sm" className="border-brand-500/25 bg-brand-500/5">
      <Eyebrow tone="brand" className="mb-2">
        Memory delta
      </Eyebrow>
      <ul className="space-y-2 text-sm text-stone-300" role="list">
        {recalled.length > 0 && (
          <li>
            <span className="text-stone-200 font-medium">Recalled for this critique:</span>{' '}
            {recalled.slice(0, 3).map((r) => r.content).join(' · ')}
            {recalled.length > 3 ? ` (+${recalled.length - 3} more)` : ''}
          </li>
        )}
        {retired.length > 0 && (
          <li>
            <span className="text-stone-200 font-medium">Retired / skipped:</span>{' '}
            {retired.slice(0, 2).map((r) => r.content).join(' · ')}
            {retired.length > 2 ? ` (+${retired.length - 2} more)` : ''}
          </li>
        )}
        {dropped.length > 0 && (
          <li>
            <span className="text-stone-200 font-medium">Over budget:</span>{' '}
            {dropped.length} {dropped.length === 1 ? 'memory' : 'memories'} left out of the prompt
          </li>
        )}
        {receipt.token_budget != null && (
          <li className="text-xs text-muted">
            Context packed under {receipt.token_budget} tokens
          </li>
        )}
      </ul>
    </Card>
  );
};

export default MemoryDelta;

/**
 * MemoryReceipt — the visible face of recall, forgetting, and the
 * context-budget mechanics that back a memory-aware reply.
 *
 * Collapsed by default: one quiet line, not a shouting card. Expanding it
 * shows exactly what was recalled, what was retired (forgetting made
 * visible), and what was dropped for lack of room in the prompt budget —
 * so the "memory-aware" claim next to a critique is checkable, not asserted.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tag } from './primitives/Tag';
import type {
  MemoryReceipt as MemoryReceiptData,
  MemoryReceiptScores,
} from '../types';

interface Props {
  receipt: MemoryReceiptData | null | undefined;
}

function scoreRow(scores: MemoryReceiptScores): string {
  return `importance ${scores.importance.toFixed(2)} · recency ${scores.recency.toFixed(2)} · relevance ${scores.relevance.toFixed(2)} · salience ${scores.salience.toFixed(2)}`;
}

export const MemoryReceipt: React.FC<Props> = ({ receipt }) => {
  const [expanded, setExpanded] = useState(false);

  if (!receipt) return null;

  const recalled = receipt.recalled ?? [];
  const retired = receipt.retired_excluded ?? [];
  const dropped = receipt.dropped_by_budget ?? [];

  const isEmpty = recalled.length === 0 && retired.length === 0 && dropped.length === 0;
  if (isEmpty) return null;

  const segments: string[] = [];
  if (recalled.length > 0) segments.push(`${recalled.length} ${recalled.length === 1 ? 'memory' : 'memories'} recalled`);
  if (retired.length > 0) segments.push(`${retired.length} retired`);
  if (dropped.length > 0) segments.push(`${dropped.length} over budget`);

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1 text-muted hover:text-stone-300 transition-colors"
        aria-expanded={expanded}
      >
        <span>🧠 {segments.join(' · ')}</span>
        {expanded ? (
          <ChevronUp className="w-3 h-3 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="w-3 h-3 shrink-0" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-warm bg-surface-1 p-3 space-y-3 animate-fadeIn">
          {recalled.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-brand-400/90 tracking-wide mb-1.5">
                Recalled
              </p>
              <ul className="space-y-2" role="list">
                {recalled.map((item) => (
                  <li key={item.id} className="text-stone-300">
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <span>{item.content}</span>
                      {item.genre && <Tag variant="outline">{item.genre}</Tag>}
                    </div>
                    <details className="mt-0.5">
                      <summary className="text-muted cursor-pointer select-none hover:text-stone-300 text-[11px]">
                        Score breakdown
                      </summary>
                      <p className="text-muted text-[11px] mt-0.5 tabular-nums">{scoreRow(item.scores)}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {retired.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-muted tracking-wide mb-1.5">
                Retired
              </p>
              <ul className="space-y-1.5" role="list">
                {retired.map((item) => (
                  <li key={item.id} className="text-stone-400">
                    <span>{item.content}</span>{' '}
                    <span className="text-muted italic">— superseded</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dropped.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-muted tracking-wide mb-1.5">
                Ignored (budget)
              </p>
              <ul className="space-y-1.5" role="list">
                {dropped.map((item) => (
                  <li key={item.id} className="text-stone-400">
                    {item.content}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-muted italic pt-1 border-t border-warm/60">
            Memory Receipt covers long-term memory. This reply may also draw on the current
            conversation, shown in the chat above.
          </p>
        </div>
      )}
    </div>
  );
};

export default MemoryReceipt;

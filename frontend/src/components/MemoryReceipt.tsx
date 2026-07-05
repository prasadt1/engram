/**
 * MemoryReceipt — the visible face of recall, forgetting, and the
 * context-budget mechanics that back a memory-aware reply.
 */

import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { Tag } from './primitives/Tag';
import type {
  MemoryReceipt as MemoryReceiptData,
  MemoryReceiptScores,
} from '../types';

interface Props {
  receipt: MemoryReceiptData | null | undefined;
  /** Judge mode: larger treatment and expanded by default. */
  prominent?: boolean;
  defaultExpanded?: boolean;
}

function scoreRow(scores: MemoryReceiptScores): string {
  return `importance ${scores.importance.toFixed(2)} · recency ${scores.recency.toFixed(2)} · relevance ${scores.relevance.toFixed(2)} · salience ${scores.salience.toFixed(2)}`;
}

export const MemoryReceipt: React.FC<Props> = ({
  receipt,
  prominent = false,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded || prominent);

  if (!receipt) return null;

  const recalled = receipt.recalled ?? [];
  const retired = receipt.retired_excluded ?? [];
  const dropped = receipt.dropped_by_budget ?? [];

  const isEmpty = recalled.length === 0 && retired.length === 0 && dropped.length === 0;
  if (isEmpty) return null;

  const segments: string[] = [];
  if (recalled.length > 0) segments.push(`${recalled.length} recalled`);
  if (retired.length > 0) segments.push(`${retired.length} retired`);
  if (dropped.length > 0) segments.push(`${dropped.length} over budget`);
  if (receipt.token_budget) segments.push(`packed under ${receipt.token_budget} tokens`);

  const summary = segments.join(' · ');

  return (
    <div className={prominent ? 'text-sm' : 'text-xs'}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`inline-flex items-center gap-2 transition-colors w-full text-left ${
          prominent
            ? 'rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 text-stone-200 hover:border-brand-500/50'
            : 'text-muted hover:text-stone-300'
        }`}
        aria-expanded={expanded}
      >
        <Brain className={`shrink-0 text-brand-400 ${prominent ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} aria-hidden />
        <span className="flex-1 min-w-0">
          {prominent && (
            <span className="block text-[10px] font-bold uppercase tracking-wide text-brand-400 mb-0.5">
              Memory Receipt
            </span>
          )}
          <span className={prominent ? 'text-sm text-stone-200' : ''}>
            {prominent ? summary : summary}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" aria-hidden />
        )}
      </button>

      {expanded && (
        <div
          className={`mt-2 rounded-lg border border-warm bg-surface-1 p-3 space-y-3 animate-fadeIn ${
            prominent ? 'border-brand-500/20' : ''
          }`}
        >
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

          <p className="text-muted italic pt-1 border-t border-warm/60 text-[11px]">
            Memory Receipt covers long-term memory. This reply may also draw on the current
            conversation, shown in the chat above.
          </p>
        </div>
      )}
    </div>
  );
};

export default MemoryReceipt;

/**
 * MemoryDelta — after a new critique, show what Engram learned (mentor voice).
 * Copy is template-mapped from memoryUpdate; no LLM in this path.
 */

import React from 'react';
import { Card, Eyebrow } from './primitives';
import { buildUploadNarration, type MemoryUpdate } from '../lib/memoryNarration';

interface Props {
  memoryUpdate?: MemoryUpdate | null;
}

export const MemoryDelta: React.FC<Props> = ({ memoryUpdate }) => {
  const narration = buildUploadNarration(memoryUpdate);
  if (!narration) return null;

  return (
    <Card padding="sm" className="border-brand-500/25 bg-brand-500/5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
        <Eyebrow tone="brand">What I learned from this photo</Eyebrow>
        {narration.mutedLabel && (
          <span className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
            {narration.mutedLabel}
          </span>
        )}
      </div>
      <p className="text-sm text-stone-200 leading-relaxed font-serif">{narration.headline}</p>
      {narration.details.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs text-stone-400" role="list">
          {narration.details.map((line) => (
            <li key={line} className="leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default MemoryDelta;

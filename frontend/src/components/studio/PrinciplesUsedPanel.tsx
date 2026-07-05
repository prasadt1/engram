/**
 * Photography principles cited for this critique — always visible, not buried in tabs.
 */

import React from 'react';
import { Database } from 'lucide-react';
import { Card, Eyebrow } from '../primitives';

export interface PrincipleCitation {
  id: string;
  title: string;
  excerpt: string;
}

interface Props {
  citations: PrincipleCitation[];
  className?: string;
}

export const PrinciplesUsedPanel: React.FC<Props> = ({ citations, className = '' }) => {
  if (citations.length === 0) return null;

  return (
    <Card padding="sm" className={`border-brand-500/20 bg-brand-500/5 ${className}`}>
      <Eyebrow tone="brand" className="flex items-center gap-2 mb-3">
        <Database className="w-3.5 h-3.5" aria-hidden />
        Photography principles I used
      </Eyebrow>
      <ul className="space-y-2" role="list">
        {citations.map((c) => (
          <li
            key={c.id}
            className="text-xs rounded-lg bg-surface-1/80 border border-brand-500/15 px-3 py-2"
          >
            <span className="font-semibold text-brand-400">{c.title || c.id}</span>
            {c.excerpt ? (
              <p className="text-stone-400 mt-1 leading-relaxed line-clamp-3">{c.excerpt}</p>
            ) : (
              <p className="text-stone-500 mt-1 italic">Principle applied to this critique</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default PrinciplesUsedPanel;

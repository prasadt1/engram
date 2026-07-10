/**
 * "What you're watching" legend for the Canon→Sony play stage.
 */

import React from 'react';

const ROWS = [
  {
    label: 'LIVE MEMORY',
    detail: 'facts currently allowed into coaching context',
  },
  {
    label: 'SUPERSEDED · AUDIT ONLY',
    detail: 'retired facts: kept for transparency, never recalled into advice',
  },
  {
    label: 'THE QUESTION',
    detail:
      'the same question answered by Engram and by a never-forgets baseline — watch which one leaks the stale Canon fact',
  },
] as const;

export const WhatYouAreWatchingBox: React.FC = () => (
  <aside
    className="rounded-xl border border-warm/70 bg-surface-2/40 p-4 space-y-3 lg:sticky lg:top-4 self-start"
    aria-label="What you're watching"
  >
    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">What you&apos;re watching</p>
    <ul className="space-y-3 list-none p-0 m-0">
      {ROWS.map((row) => (
        <li key={row.label} className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-300">{row.label}</p>
          <p className="text-xs text-stone-500 leading-snug">{row.detail}</p>
        </li>
      ))}
    </ul>
  </aside>
);

export default WhatYouAreWatchingBox;

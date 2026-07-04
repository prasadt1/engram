import React from 'react';

export const MemoryGridSkeleton: React.FC = () => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse" aria-hidden>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-2xl bg-surface-1 border border-warm overflow-hidden">
        <div className="aspect-[4/3] bg-surface-3/80" />
        <div className="p-4 space-y-2">
          <div className="h-3 bg-surface-3 rounded w-full" />
          <div className="h-3 bg-surface-3 rounded w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

export const PrintListingCardsSkeleton: React.FC = () => (
  <ul className="space-y-5 animate-pulse" aria-hidden>
    {Array.from({ length: 2 }).map((_, i) => (
      <li key={i} className="rounded-xl border border-warm bg-surface-1 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4 p-4">
          <div className="shrink-0 w-full sm:w-28 aspect-[3/4] sm:aspect-square rounded-lg bg-surface-3" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-surface-3 rounded w-16" />
            <div className="h-4 bg-surface-3 rounded w-3/4" />
            <div className="h-3 bg-surface-3 rounded w-full" />
            <div className="h-8 bg-surface-3 rounded w-24" />
          </div>
        </div>
      </li>
    ))}
  </ul>
);

export const PracticeCardsSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-hidden>
    {Array.from({ length: 2 }).map((_, i) => (
      <div key={i} className="rounded-xl border border-warm bg-surface-1 p-5 space-y-3">
        <div className="h-4 bg-surface-3 rounded w-1/3" />
        <div className="h-3 bg-surface-3 rounded w-full" />
        <div className="h-3 bg-surface-3 rounded w-4/5" />
      </div>
    ))}
  </div>
);

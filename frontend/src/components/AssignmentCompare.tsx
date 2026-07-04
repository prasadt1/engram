/**
 * Before/after photo compare for completed assignments (A7).
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchPortfolioByShoots } from '../services/memoryClient';
import { LazyPortfolioImage } from './LazyPortfolioImage';
import type { PortfolioListItem } from '../types/memory';

interface Props {
  baselineShootIds: string[];
  completionShootIds: string[];
}

export const AssignmentCompare: React.FC<Props> = ({
  baselineShootIds,
  completionShootIds,
}) => {
  const [baseline, setBaseline] = useState<PortfolioListItem[]>([]);
  const [completion, setCompletion] = useState<PortfolioListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      baselineShootIds.length
        ? fetchPortfolioByShoots(baselineShootIds)
        : Promise.resolve({ entries: [] }),
      completionShootIds.length
        ? fetchPortfolioByShoots(completionShootIds)
        : Promise.resolve({ entries: [] }),
    ])
      .then(([before, after]) => {
        if (cancelled) return;
        setBaseline(before.entries);
        setCompletion(after.entries);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baselineShootIds, completionShootIds]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted py-4">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        Loading before &amp; after…
      </div>
    );
  }

  if (baseline.length === 0 && completion.length === 0) {
    return (
      <p className="text-sm text-muted py-2">
        No linked photos yet — uploads during this challenge appear here after completion.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <CompareColumn title="Before (baseline)" entries={baseline} />
      <CompareColumn title="After (practice)" entries={completion} accent />
    </div>
  );
};

function CompareColumn({
  title,
  entries,
  accent = false,
}: {
  title: string;
  entries: PortfolioListItem[];
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 space-y-3 ${
        accent ? 'border-brand-500/40 bg-brand-500/5' : 'border-warm bg-surface-1'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">No photos linked</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 items-start">
              <div className="w-20 h-16 rounded-md overflow-hidden shrink-0 ring-1 ring-warm/60">
                {entry.imageUrl ? (
                  <LazyPortfolioImage
                    src={entry.imageUrl}
                    alt={entry.sceneDescription?.slice(0, 80) || 'Photo'}
                    imgClassName="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-400 tabular-nums">
                  {entry.overallAverage}/10
                </p>
                {entry.sceneDescription && (
                  <p className="text-xs text-stone-300 line-clamp-2 mt-0.5">{entry.sceneDescription}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

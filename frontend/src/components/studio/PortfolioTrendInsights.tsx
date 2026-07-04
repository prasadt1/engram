import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { fetchPortfolioTrends } from '../../services/memoryClient';
import { ScoreTrendRow } from '../ScoreTrendRow';
import type { PortfolioTrendsResponse } from '../../types/memory';

const TREND_KEYS = ['composition', 'lighting', 'technique', 'overall'] as const;

/** Portfolio-wide learning insights from MongoDB trends API (Pass 6). */
export const PortfolioTrendInsights: React.FC = () => {
  const [trends, setTrends] = useState<PortfolioTrendsResponse | null>(null);

  useEffect(() => {
    void fetchPortfolioTrends(12)
      .then(setTrends)
      .catch(() => setTrends(null));
  }, []);

  if (!trends || trends.insufficientData || trends.photoCount < 3) {
    return null;
  }

  const dims = trends.dimensions.filter((d) =>
    (TREND_KEYS as readonly string[]).includes(d.key),
  );
  if (dims.length === 0) return null;

  return (
    <section className="rounded-xl border border-warm bg-surface-1/80 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-brand-400" aria-hidden />
        <h3 className="text-sm font-bold text-stone-100">Your library trends</h3>
      </div>
      <p className="text-xs text-muted">
        Based on {trends.photoCount} photos in your portfolio — compare with this shot above.
      </p>
      <ul className="space-y-1">
        {dims.map((d) => (
          <ScoreTrendRow key={d.key} dimension={d} />
        ))}
      </ul>
    </section>
  );
};

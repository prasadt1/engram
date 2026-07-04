import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ImageIcon, RefreshCw, Sparkles } from 'lucide-react';
import { TabEmptyState } from './TabEmptyState';
import { apiUnreachableMessage } from '../lib/apiHelp';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { MemoryGridSkeleton } from './SkeletonBlocks';
import { ScoreTrendRow } from './ScoreTrendRow';
import { fetchAestheticProfile, fetchPortfolio, fetchPortfolioTrends } from '../services/memoryClient';
import type {
  AestheticProfileSummary,
  PortfolioListItem,
  PortfolioTrendsResponse,
} from '../types/memory';

const TREND_DISPLAY_KEYS = ['composition', 'lighting', 'technique', 'overall'] as const;

const SCORE_LABELS: { key: keyof AestheticProfileSummary['averageScores']; label: string }[] = [
  { key: 'composition', label: 'Composition' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'technique', label: 'Technique' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'subject_impact', label: 'Subject' },
];

interface MemoryTabProps {
  onGoToStudio?: () => void;
}

export const MemoryTab: React.FC<MemoryTabProps> = ({ onGoToStudio }) => {
  const [entries, setEntries] = useState<PortfolioListItem[]>([]);
  const [profile, setProfile] = useState<AestheticProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trends, setTrends] = useState<PortfolioTrendsResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [portfolio, aesthetic, trendData] = await Promise.all([
        fetchPortfolio(),
        fetchAestheticProfile(),
        fetchPortfolioTrends(12).catch(() => null),
      ]);
      setEntries(portfolio.entries);
      setProfile(aesthetic);
      setTrends(trendData);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="animate-fadeIn space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-surface-2 rounded animate-pulse" aria-hidden />
        <MemoryGridSkeleton />
        <p className="text-sm text-muted text-center">One moment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-8 rounded-2xl bg-surface-1 border border-rose-500/40 text-center">
        <p className="text-rose-400 text-sm mb-4">{error}</p>
        <p className="text-muted text-xs mb-4">{apiUnreachableMessage()}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-on-brand text-sm font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">My Work</h2>
          <p className="text-muted text-sm">
            Every Studio critique lives here — tags, scores, and how your style is shifting.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-warm text-stone-300 text-sm hover:bg-surface-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {profile && profile.photoCount > 0 && (
        <section className="rounded-2xl bg-surface-1 border border-warm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
              Aesthetic snapshot
            </h3>
            <span className="text-xs text-muted">
              ({profile.photoCount} recent photo{profile.photoCount === 1 ? '' : 's'})
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] text-muted uppercase mb-2">Dominant tags</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.dominantTags.length > 0 ? (
                  profile.dominantTags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full bg-canvas-elevated text-stone-300 border border-warm"
                    >
                      {tag.replace(/_/g, ' ')}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] text-muted uppercase mb-3 tracking-wide">Average scores</p>
              <div className="rounded-xl border border-warm overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-warm bg-canvas-elevated/80">
                      <th className="text-left font-semibold text-muted uppercase tracking-wider px-3 py-2">
                        Dimension
                      </th>
                      <th className="text-right font-semibold text-muted uppercase tracking-wider px-3 py-2 w-16">
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCORE_LABELS.map(({ key, label }, index) => {
                      const val = profile.averageScores[key];
                      return (
                        <tr key={key} className="score-badge border-b border-warm/60 last:border-0" style={{ animationDelay: `${index * 50}ms` }}>
                          <td className="px-3 py-2.5 text-stone-300">{label}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex min-w-[2.5rem] justify-center tabular-nums font-semibold text-on-brand bg-amber-500/90 rounded px-1.5 py-0.5">
                              {val != null ? val.toFixed(1) : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase mb-2">Consistency</p>
              <p className="text-3xl font-bold text-brand-400">
                {profile.stylisticConsistencyScore != null
                  ? `${Math.round(profile.stylisticConsistencyScore * 100)}%`
                  : '—'}
              </p>
              <p className="text-xs text-muted mt-1">
                How steady your dimension scores are across recent work.
              </p>
            </div>
          </div>

          {trends && !trends.insufficientData && trends.dimensions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-warm">
              <p className="text-[10px] text-muted uppercase mb-3 tracking-wide">
                Recent progress (oldest → newest upload)
              </p>
              <ul className="space-y-1">
                {trends.dimensions
                  .filter((d) =>
                    (TREND_DISPLAY_KEYS as readonly string[]).includes(d.key),
                  )
                  .map((d) => (
                    <ScoreTrendRow key={d.key} dimension={d} />
                  ))}
              </ul>
            </div>
          )}
          {trends?.insufficientData && trends.photoCount > 0 && (
            <p className="mt-4 text-xs text-muted border-t border-warm pt-4">
              Upload a few more photos in Studio to see score trends over time.
            </p>
          )}
        </section>
      )}

      {entries.length === 0 ? (
        <TabEmptyState
          icon={ImageIcon}
          title="Your library is empty"
          description="Every Studio critique is saved here with scores, tags, and Glass Box reasoning."
          steps={[
            'Open My Studio and upload a photo',
            'Review the Glass Box critique',
            'Return here to see trends and your aesthetic profile',
          ]}
          action={
            onGoToStudio
              ? { label: 'Go to My Studio', onClick: onGoToStudio }
              : undefined
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {entries.map((entry) => {
            const expanded = expandedId === entry.id;
            let when = '';
            try {
              when = formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true });
            } catch {
              when = '';
            }
            return (
              <article
                key={entry.id}
                className="rounded-2xl bg-surface-1 border border-warm overflow-hidden flex flex-col transition-all duration-[250ms] hover:-translate-y-1 hover:shadow-[0_12px_32px_oklch(0_0_0/0.3)]"
                style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
              >
                <button
                  type="button"
                  className="text-left flex flex-col flex-1"
                  aria-label={`View photo details, score ${entry.overallAverage} out of 10${
                    entry.sceneDescription
                      ? `: ${entry.sceneDescription.slice(0, 60)}`
                      : ''
                  }`}
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                >
                  <div className="p-3 bg-photo-black border-b border-warm/40">
                    <div className="aspect-[4/3] bg-photo-black relative rounded-md overflow-hidden ring-1 ring-warm/60 shadow-inner">
                      {entry.imageUrl ? (
                        <img
                          src={entry.imageUrl}
                          alt={entry.sceneDescription?.slice(0, 120) || 'Portfolio photo'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-stone-600">
                          <ImageIcon className="w-10 h-10" aria-hidden />
                        </div>
                      )}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-on-brand text-xs font-bold shadow-md tabular-nums">
                        {entry.overallAverage}/10
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex-1">
                    {entry.sceneDescription && (
                      <p
                        className={`text-sm text-stone-300 leading-snug ${
                          expanded ? '' : 'line-clamp-2'
                        }`}
                      >
                        {entry.sceneDescription}
                      </p>
                    )}
                    <p className="text-[10px] text-muted mt-2 uppercase">{when}</p>
                    {entry.glassBoxSummary.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-warm/80">
                        <p className="text-[10px] font-bold uppercase text-brand-400/90 tracking-wide mb-1.5">
                          Glass Box
                        </p>
                        <ul className="space-y-1 text-xs text-muted leading-relaxed" role="list">
                          {(expanded ? entry.glassBoxSummary : entry.glassBoxSummary.slice(0, 1)).map(
                            (line, i) => (
                              <li key={i} className={expanded ? '' : 'line-clamp-2'}>
                                {line}
                              </li>
                            ),
                          )}
                        </ul>
                        {!expanded && entry.glassBoxSummary.length > 0 && (
                          <span className="text-[10px] text-brand-400 mt-1 inline-block">
                            Show critique reasoning
                          </span>
                        )}
                      </div>
                    )}
                    {entry.aestheticTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.aestheticTags.slice(0, expanded ? 12 : 4).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-canvas-elevated text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {expanded && entry.glassBoxSummary.length > 0 && (
                      <ul className="mt-3 text-xs text-muted space-y-1 list-disc list-inside border-t border-warm pt-3">
                        {entry.glassBoxSummary.map((line) => (
                          <li key={line.slice(0, 40)}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

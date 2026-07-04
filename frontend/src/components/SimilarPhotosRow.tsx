import React, { useEffect, useState } from 'react';
import { ImageIcon, Sparkles } from 'lucide-react';
import { fetchSimilarPhotos } from '../services/portfolioInsightsClient';
import type { PortfolioListItem } from '../types/memory';

interface Props {
  entryId: string;
  onSelectEntry?: (id: string) => void;
}

export const SimilarPhotosRow: React.FC<Props> = ({ entryId, onSelectEntry }) => {
  const [matches, setMatches] = useState<PortfolioListItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    void fetchSimilarPhotos(entryId, 4)
      .then((res) => {
        if (cancelled) return;
        setMatches(res.matches ?? []);
        setMessage(res.message ?? null);
        setMode(res.mode ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
          setMessage('Similar photos unavailable.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-warm/80">
        <p className="text-[10px] font-bold uppercase text-brand-400/90 tracking-wide mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" aria-hidden />
          Similar in your library
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-md bg-surface-2 animate-pulse" aria-hidden />
          ))}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-warm/80">
        <p className="text-[10px] font-bold uppercase text-brand-400/90 tracking-wide mb-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" aria-hidden />
          Similar in your library
        </p>
        <p className="text-xs text-muted">
          {message ?? 'No close matches yet — upload more photos with Coach to build embeddings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-warm/80">
      <p className="text-[10px] font-bold uppercase text-brand-400/90 tracking-wide mb-2 flex items-center gap-1">
        <Sparkles className="w-3 h-3" aria-hidden />
        Similar in your library
        {mode === 'atlas_vector_search'
          ? ' (Atlas Vector Search)'
          : mode === 'cosine_fallback'
            ? ' (embedding match)'
            : ''}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {matches.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelectEntry?.(m.id)}
            className="aspect-square rounded-md overflow-hidden ring-1 ring-warm/60 bg-photo-black hover:ring-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label={`Similar photo, score ${m.overallAverage} out of 10`}
          >
            {m.imageUrl ? (
              <img
                src={m.imageUrl}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="flex items-center justify-center h-full text-stone-600">
                <ImageIcon className="w-6 h-6" aria-hidden />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

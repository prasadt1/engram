/**
 * StudioHero — Photo-first hero demonstrating Glass Box value.
 * New users see example photo; returning users see their best work.
 * Implements PRODUCT.md principles: "Photos are the interface", "Show, then tell"
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Aperture, ArrowRight, ImageIcon, Sparkles } from 'lucide-react';
import { fetchPortfolio } from '../../services/memoryClient';
import type { PortfolioListItem } from '../../types/memory';

interface StudioHeroProps {
  onUploadClick: () => void;
  onViewMemory?: () => void;
}

// Sample critique for new users (no photos yet)
const EXAMPLE_PHOTO = {
  url: 'https://picsum.photos/seed/iris-hero-demo/1200/800',
  sceneDescription: 'A winding forest path disappears into golden autumn light, with fallen leaves creating natural leading lines toward a distant clearing.',
  scores: {
    composition: 7.8,
    lighting: 8.2,
    technique: 7.4,
    creativity: 7.0,
    subjectImpact: 6.8,
  },
  overallAverage: 7.4,
  glassBoxSummary: [
    'Strong leading lines draw the eye through the frame toward the light source.',
    'Golden hour lighting creates warm, inviting atmosphere with soft shadows.',
    'Consider a lower angle to emphasize the path and increase depth.',
  ],
  aestheticTags: ['golden hour', 'leading lines', 'landscape', 'autumn'],
};

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const colorClass =
    score >= 8
      ? 'text-brand-400 bg-brand-500/15 border-brand-500/30'
      : score >= 6
        ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
        : 'text-stone-400 bg-stone-500/15 border-stone-500/30';

  return (
    <div className={`score-badge flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass}`}>
      <span className="text-xs font-medium text-stone-300">{label}</span>
      <span className="text-sm font-bold tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

export const StudioHero: React.FC<StudioHeroProps> = ({
  onUploadClick,
  onViewMemory,
}) => {
  const [bestPhoto, setBestPhoto] = useState<PortfolioListItem | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  const loadBestPhoto = useCallback(async () => {
    try {
      const portfolio = await fetchPortfolio({ limit: 48 });
      setPhotoCount(portfolio.total);
      if (portfolio.entries.length > 0) {
        // Find the photo with highest overall score
        const sorted = [...portfolio.entries].sort(
          (a, b) => b.overallAverage - a.overallAverage
        );
        setBestPhoto(sorted[0]);
      }
    } catch {
      // Silently fail — will show example photo
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBestPhoto();
  }, [loadBestPhoto]);

  // Determine which photo/critique to show
  const isReturningUser = bestPhoto !== null;
  const displayPhoto = isReturningUser
    ? {
        url: bestPhoto.imageUrl,
        sceneDescription: bestPhoto.sceneDescription || 'Your photograph',
        scores: bestPhoto.scores,
        overallAverage: bestPhoto.overallAverage,
        glassBoxSummary: bestPhoto.glassBoxSummary || [],
        aestheticTags: bestPhoto.aestheticTags || [],
      }
    : EXAMPLE_PHOTO;

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-pulse">
        <div className="aspect-[16/10] rounded-2xl bg-surface-2 border border-warm" />
        <div className="mt-6 h-12 w-64 mx-auto bg-surface-2 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Photo container with Glass Box overlay */}
      <div className="relative rounded-2xl overflow-hidden border border-warm bg-photo-black shadow-2xl shadow-black/50">
        {/* The photo — hero of the interface */}
        <div className="relative aspect-[16/10] md:aspect-[2/1] lg:aspect-[21/9]">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-surface-2 animate-pulse flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-stone-600" />
            </div>
          )}
          <img
            src={displayPhoto.url}
            alt={displayPhoto.sceneDescription}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

          {/* Glass Box preview panel — floating on the photo */}
          <div className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-md">
            <div className="rounded-xl bg-photo-black/85 border border-warm/50 p-4 shadow-xl">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-brand-500/15 border border-brand-500/30">
                  <Aperture className="w-4 h-4 text-brand-400" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {isReturningUser ? 'Your strongest work' : 'Glass Box critique'}
                  </p>
                  <p className="text-[10px] text-muted">
                    {isReturningUser
                      ? `From ${photoCount} photo${photoCount === 1 ? '' : 's'} in your library`
                      : 'This is what Iris sees'}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-brand-500/20 border border-brand-500/30">
                  <Sparkles className="w-3 h-3 text-brand-400" aria-hidden />
                  <span className="text-xs font-bold text-brand-400">
                    {displayPhoto.overallAverage.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Score badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <ScoreBadge label="Composition" score={displayPhoto.scores.composition} />
                <ScoreBadge label="Lighting" score={displayPhoto.scores.lighting} />
              </div>

              {/* Glass Box observation (truncated) */}
              {displayPhoto.glassBoxSummary.length > 0 && (
                <p className="text-sm text-stone-300 leading-relaxed line-clamp-2">
                  {displayPhoto.glassBoxSummary[0]}
                </p>
              )}

              {/* Tags */}
              {displayPhoto.aestheticTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-warm/50">
                  {displayPhoto.aestheticTags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-warm/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Value statement + CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
        <p className="text-stone-400 text-sm">
          {isReturningUser
            ? 'Ready for another critique?'
            : 'This is what Iris sees in a photo.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-500 text-canvas font-semibold text-sm hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20"
          >
            {isReturningUser ? 'Upload another' : 'Upload yours'}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
          {isReturningUser && onViewMemory && (
            <button
              type="button"
              onClick={onViewMemory}
              className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-2"
            >
              See all your work
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudioHero;

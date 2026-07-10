/**
 * UNWIRED (2026-07-10): Then/now growth comparison removed from Home — Landscape
 * memory thread captions already tell the same story. Preserved for reversibility.
 */

import React from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { Eyebrow } from './primitives';
import { PhotoMat } from './PhotoMat';
import type { PortfolioListItem } from '../types/memory';

interface Props {
  portfolioTotal: number;
  earliestPhoto: PortfolioListItem;
  bestPhoto: PortfolioListItem;
  growthFrameOverallDelta: number | null;
  growthFrameCompositionDelta: number | null;
}

/** Not rendered from HomeTab — preserved stub only. */
export const HomeGrowthSection: React.FC<Props> = ({
  portfolioTotal,
  earliestPhoto,
  bestPhoto,
  growthFrameOverallDelta,
  growthFrameCompositionDelta,
}) => (
  <section className="w-full" aria-label="Your growth">
    <div className="mb-4">
      <h2 className="font-serif text-xl md:text-2xl text-white mb-1">Your growth</h2>
      <p className="text-stone-400 text-xs md:text-sm">
        Your oldest upload vs highest-scoring photo · {portfolioTotal} photos in library
      </p>
    </div>
    <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-8">
      <div className="flex-1">
        <Eyebrow tone="faint" className="mb-3">
          Then
        </Eyebrow>
        <PhotoMat variant="contact" aspect="aspect-[4/3]">
          <img src={earliestPhoto.imageUrl} alt="Earlier work" className="w-full h-full object-cover" />
        </PhotoMat>
        <p className="mt-2 text-sm text-stone-400 flex justify-between">
          <span>Earlier work</span>
          <span className="text-stone-300 tabular-nums">{earliestPhoto.overallAverage.toFixed(1)}</span>
        </p>
      </div>
      <div className="hidden md:flex items-center text-brand-400/60">
        <ArrowRight className="w-8 h-8" />
      </div>
      <div className="flex-1">
        <Eyebrow tone="brand" className="mb-3">
          Now
        </Eyebrow>
        <PhotoMat variant="contact" aspect="aspect-[4/3]">
          <img
            src={bestPhoto.imageUrl}
            alt="Strongest work"
            className="w-full h-full object-cover ring-1 ring-brand-500/40"
          />
        </PhotoMat>
        <p className="mt-2 text-sm text-stone-400 flex justify-between">
          <span>Strongest</span>
          <span className="text-brand-400 font-semibold tabular-nums">
            {bestPhoto.overallAverage.toFixed(1)}
          </span>
        </p>
      </div>
    </div>
    {growthFrameOverallDelta != null && growthFrameOverallDelta > 0 && (
      <p className="text-center mt-4 text-brand-400 font-medium text-sm">
        <TrendingUp className="w-4 h-4 inline mr-1.5" />
        This photo scores +{growthFrameOverallDelta.toFixed(1)} overall vs your first upload
        {growthFrameCompositionDelta != null && growthFrameCompositionDelta > 0 && (
          <span className="text-stone-400 font-normal">
            {' '}
            (composition +{growthFrameCompositionDelta.toFixed(1)})
          </span>
        )}
      </p>
    )}
  </section>
);

export default HomeGrowthSection;

/**
 * Spotlight overlay when hovering score dimensions (gemma4-style linked preview).
 */

import React from 'react';
import type { StudioAnalysis } from '../../types/studio';
import { getDimensionHighlight, type PercentRect } from '../../lib/dimensionRegions';

interface Props {
  dimension: string | null;
  analysis: StudioAnalysis;
}

const Spotlight: React.FC<{
  region: PercentRect;
  borderClass: string;
  glowClass: string;
  fillClass: string;
  dashed?: boolean;
}> = ({ region, borderClass, glowClass, fillClass, dashed }) => (
  <div
    className={`absolute rounded-sm border-2 pointer-events-none ${borderClass} ${fillClass} ${glowClass} ${
      dashed ? 'border-dashed' : ''
    }`}
    style={{
      left: `${region.x}%`,
      top: `${region.y}%`,
      width: `${region.width}%`,
      height: `${region.height}%`,
      zIndex: 25,
    }}
  />
);

const ThirdsGrid: React.FC = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    style={{ zIndex: 22 }}
  >
    {[33.33, 66.66].map((n) => (
      <React.Fragment key={n}>
        <line x1={n} y1={0} x2={n} y2={100} stroke="rgba(251,191,36,0.35)" strokeWidth="0.35" />
        <line x1={0} y1={n} x2={100} y2={n} stroke="rgba(251,191,36,0.35)" strokeWidth="0.35" />
      </React.Fragment>
    ))}
  </svg>
);

const DimensionOverlay: React.FC<Props> = ({ dimension, analysis }) => {
  if (!dimension) return null;

  const highlight = getDimensionHighlight(dimension, analysis);
  if (!highlight) return null;

  const fillFor = () => 'bg-brand-500/12';

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {highlight.showThirdsGrid && <ThirdsGrid />}

      {highlight.lightingDirection && (
        <div
          className="absolute inset-0"
          style={{
            zIndex: 21,
            background: `linear-gradient(135deg, rgba(251,191,36,0.22) 0%, transparent 55%, rgba(10,9,8,0.25) 100%)`,
          }}
        />
      )}

      <Spotlight
        region={highlight.region}
        borderClass={highlight.borderClass}
        glowClass={highlight.glowClass}
        fillClass={fillFor()}
      />

      {highlight.secondaryRegions?.map((r, i) => (
        <Spotlight
          key={i}
          region={r}
          borderClass="border-stone-400"
          glowClass=""
          fillClass="bg-stone-400/8"
          dashed
        />
      ))}

      <div
        className={`absolute left-3 top-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-photo-black/85 border border-warm ${highlight.accentClass}`}
      >
        <span className="w-2 h-2 rounded-full bg-current opacity-80" />
        <span className="text-white">{highlight.label}</span>
      </div>
    </div>
  );
};

export default DimensionOverlay;

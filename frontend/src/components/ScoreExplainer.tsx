/**
 * ScoreExplainer — Modal explaining how Iris scores photos.
 * Triggered by an info icon next to scores.
 */

import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DIMENSIONS = [
  {
    name: 'Composition',
    description: 'How elements are arranged in the frame. Includes rule of thirds, leading lines, balance, and visual flow.',
    good: 'Strong focal point, intentional framing, elements guide the eye',
    improve: 'Cluttered frame, no clear subject, awkward cropping',
  },
  {
    name: 'Lighting',
    description: 'Quality, direction, and use of light. Natural or artificial, and how it shapes the subject.',
    good: 'Flattering light, good exposure, intentional shadows',
    improve: 'Harsh shadows on faces, blown highlights, flat lighting',
  },
  {
    name: 'Technique',
    description: 'Technical execution including focus, sharpness, exposure, and camera settings.',
    good: 'Sharp focus on subject, correct exposure, intentional motion blur',
    improve: 'Missed focus, camera shake, over/underexposed',
  },
  {
    name: 'Creativity',
    description: 'Originality, artistic vision, and emotional impact. What makes this photo unique.',
    good: 'Fresh perspective, emotional resonance, memorable moment',
    improve: 'Generic viewpoint, lacks personality, forgettable',
  },
  {
    name: 'Subject Impact',
    description: 'How compelling the subject is and how well it connects with the viewer.',
    good: 'Engaging subject, clear story, viewer connection',
    improve: 'Weak subject presence, no clear narrative',
  },
];

export const ScoreExplainer: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-overlayFadeIn"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl bg-canvas border border-warm shadow-2xl animate-springIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-canvas border-b border-warm p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand-400" />
            <h2 className="font-serif text-lg text-white">How Iris Scores Photos</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-2 text-muted hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Intro */}
          <div className="rounded-xl bg-surface-1 border border-warm p-4">
            <p className="text-sm text-stone-300 leading-relaxed">
              Iris evaluates your photos across five dimensions, each scored from 1-10.
              The scores reflect photographic principles, not personal taste. A score of
              <span className="text-amber-400 font-semibold"> 7+ </span>
              indicates strong work in that dimension.
            </p>
          </div>

          {/* Score scale */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">
              Score Scale
            </h3>
            <div className="flex gap-2 text-xs">
              <div className="flex-1 rounded-lg bg-rose-500/15 border border-rose-500/30 p-2 text-center">
                <span className="font-bold text-rose-400">1-4</span>
                <p className="text-rose-300/80 mt-1">Needs work</p>
              </div>
              <div className="flex-1 rounded-lg bg-amber-500/15 border border-amber-500/30 p-2 text-center">
                <span className="font-bold text-amber-400">5-6</span>
                <p className="text-amber-300/80 mt-1">Developing</p>
              </div>
              <div className="flex-1 rounded-lg bg-brand-500/15 border border-brand-500/30 p-2 text-center">
                <span className="font-bold text-brand-400">7-8</span>
                <p className="text-brand-300/80 mt-1">Strong</p>
              </div>
              <div className="flex-1 rounded-lg bg-brand-500/25 border border-brand-400/40 p-2 text-center">
                <span className="font-bold text-brand-300">9-10</span>
                <p className="text-brand-200/80 mt-1">Exceptional</p>
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">
              The Five Dimensions
            </h3>
            <div className="space-y-3">
              {DIMENSIONS.map((dim) => (
                <details
                  key={dim.name}
                  className="group rounded-xl border border-warm bg-surface-1 overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-2 transition-colors">
                    <span className="font-semibold text-white">{dim.name}</span>
                    <span className="text-muted text-xs group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="p-3 pt-0 text-sm space-y-2 border-t border-warm/50">
                    <p className="text-stone-300">{dim.description}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-2">
                        <p className="text-[10px] text-brand-400 uppercase font-semibold mb-1">
                          High score
                        </p>
                        <p className="text-xs text-stone-300">{dim.good}</p>
                      </div>
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
                        <p className="text-[10px] text-rose-400 uppercase font-semibold mb-1">
                          Low score
                        </p>
                        <p className="text-xs text-stone-300">{dim.improve}</p>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Glass Box note */}
          <div className="rounded-xl bg-brand-500/10 border border-brand-500/30 p-4">
            <h3 className="text-sm font-semibold text-brand-400 mb-2">
              Why "Glass Box"?
            </h3>
            <p className="text-sm text-stone-300 leading-relaxed">
              Unlike black-box AI that just outputs numbers, Iris shows you exactly
              <em> why </em> it scored each dimension the way it did. The Glass Box panel
              reveals the reasoning step-by-step, so you can learn and improve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Trigger button to open the explainer */
export const ScoreExplainerTrigger: React.FC<{
  onClick: () => void;
  /** Footer-style link: no icon, matches other footer actions */
  variant?: 'default' | 'footer';
}> = ({ onClick, variant = 'default' }) => {
  if (variant === 'footer') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-brand-400 hover:text-brand-300 hover:underline transition-colors"
        aria-label="Learn how scores work"
      >
        How we score
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-400 transition-colors"
      aria-label="Learn how scores work"
    >
      <HelpCircle className="w-3.5 h-3.5" />
      <span>How we score</span>
    </button>
  );
};

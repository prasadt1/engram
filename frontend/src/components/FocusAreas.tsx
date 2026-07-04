/**
 * FocusAreas — Translates scores into actionable next steps.
 * Shows the user's biggest opportunity and specific tips to improve.
 */

import React from 'react';
import { ArrowRight, Lightbulb, Target, TrendingUp } from 'lucide-react';
import { getFocusArea, getScoreContext } from '../lib/scoreContext';

interface Props {
  scores: Record<string, number | null | undefined>;
  /** Called when user clicks "Start a [dimension] challenge". Passes the dimension key. */
  onStartPractice?: (dimension: string) => void;
  compact?: boolean;
}

export const FocusAreas: React.FC<Props> = ({ scores, onStartPractice, compact = false }) => {
  const focusArea = getFocusArea(scores);

  if (!focusArea) return null;

  const ctx = getScoreContext(focusArea.score);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-warm bg-surface-1">
        <div className={`p-2 rounded-lg ${ctx.bgColor}`}>
          <Target className={`w-4 h-4 ${ctx.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted">Focus on</p>
          <p className="text-sm font-medium text-white truncate">{focusArea.label}</p>
        </div>
        {onStartPractice && (
          <button
            type="button"
            onClick={() => onStartPractice(focusArea.dimension)}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium shrink-0"
          >
            Practice
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-warm bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-warm/60 bg-canvas-elevated/30">
        <div className="flex items-center gap-2 text-brand-400 mb-1">
          <Target className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Your Focus Area</span>
        </div>
        <p className="text-sm text-muted">
          Based on your scores, here&apos;s where focused practice will help most.
        </p>
      </div>

      {/* Focus dimension */}
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${ctx.bgColor} shrink-0`}>
            <Lightbulb className={`w-6 h-6 ${ctx.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-serif font-semibold text-white">{focusArea.label}</h3>
              <span className={`text-sm font-semibold ${ctx.color}`}>
                {focusArea.score.toFixed(1)}
              </span>
              <span className="text-xs text-muted">— {ctx.label}</span>
            </div>
            <p className="text-sm text-stone-300 leading-relaxed">
              {ctx.description} Here are specific things to try:
            </p>
          </div>
        </div>

        {/* Actionable tips */}
        <ul className="space-y-2 pl-1">
          {focusArea.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-stone-300 leading-relaxed">{tip}</p>
            </li>
          ))}
        </ul>

        {/* CTA to practice */}
        {onStartPractice && (
          <button
            type="button"
            onClick={() => onStartPractice(focusArea.dimension)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-400 text-sm font-semibold hover:bg-brand-500/20 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Start a {focusArea.label.toLowerCase()} challenge
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

/** Mini version for inline use */
export const FocusAreaPill: React.FC<{
  scores: Record<string, number | null | undefined>;
  onClick?: () => void;
}> = ({ scores, onClick }) => {
  const focusArea = getFocusArea(scores);
  if (!focusArea) return null;

  const ctx = getScoreContext(focusArea.score);

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-warm bg-surface-1 hover:bg-surface-2 transition-colors text-left"
    >
      <Target className={`w-3.5 h-3.5 ${ctx.color}`} />
      <span className="text-xs text-muted">Focus:</span>
      <span className="text-xs font-medium text-white">{focusArea.label}</span>
      <span className={`text-xs font-bold ${ctx.color}`}>{focusArea.score.toFixed(1)}</span>
    </button>
  );
};

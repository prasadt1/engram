/**
 * ScoreWithContext — Display a score with level label and hover tooltip.
 * Makes raw numbers meaningful with context like "7.5 — Strong".
 */

import React, { useState } from 'react';
import { getScoreContext, getTipsForDimension } from '../lib/scoreContext';

interface Props {
  score: number;
  dimension?: string;
  showLabel?: boolean;
  showTip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ScoreWithContext: React.FC<Props> = ({
  score,
  dimension,
  showLabel = true,
  showTip = false,
  size = 'md',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const ctx = getScoreContext(score);
  const tips = dimension ? getTipsForDimension(dimension, score) : [];

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const scoreSizeClasses = {
    sm: 'text-sm font-bold',
    md: 'text-base font-bold',
    lg: 'text-xl font-bold',
  };

  return (
    <div
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={`${scoreSizeClasses[size]} ${ctx.color} tabular-nums`}>
        {score.toFixed(1)}
      </span>
      {showLabel && (
        <span className={`${sizeClasses[size]} text-muted`}>
          — {ctx.label}
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 animate-fadeIn">
          <div className="rounded-lg border border-warm bg-canvas-elevated shadow-xl p-3 text-left">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${ctx.color}`}>
                {ctx.label}
              </span>
              <span className="text-xs text-muted">({score.toFixed(1)}/10)</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              {ctx.description}
            </p>
            {showTip && tips.length > 0 && (
              <div className="mt-2 pt-2 border-t border-warm/60">
                <p className="text-[10px] text-muted uppercase mb-1">Try this:</p>
                <p className="text-xs text-stone-300">{tips[0]}</p>
              </div>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-canvas-elevated" />
          </div>
        </div>
      )}
    </div>
  );
};

/** Compact score badge with color coding */
export const ScoreBadge: React.FC<{ score: number; className?: string }> = ({
  score,
  className = '',
}) => {
  const ctx = getScoreContext(score);
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold tabular-nums ${ctx.bgColor} ${ctx.color} ${className}`}
    >
      {score.toFixed(1)}
    </span>
  );
};

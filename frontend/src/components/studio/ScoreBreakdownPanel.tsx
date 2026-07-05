import React, { useState } from 'react';
import { ScoreExplainer, ScoreExplainerTrigger } from '../ScoreExplainer';

export interface ScoreBreakdownRow {
  subject: string;
  score: number;
  critique: string;
}

interface Props {
  rows: ScoreBreakdownRow[];
  /** Hover ?? selected — drives photo highlight */
  previewDimension: string | null;
  selectedDimension: string | null;
  onPreviewDimension: (subject: string | null) => void;
  onSelectDimension: (subject: string) => void;
  onWhyClick: (subject: string) => void;
  /** Beside photo in analysis layout */
  variant?: 'stacked' | 'sidebar';
}

/** Score bars + fixed critique slot — sits adjacent to the photo preview. */
export const ScoreBreakdownPanel: React.FC<Props> = ({
  rows,
  previewDimension,
  selectedDimension,
  onPreviewDimension,
  onSelectDimension,
  onWhyClick,
  variant = 'sidebar',
}) => {
  const [showExplainer, setShowExplainer] = useState(false);
  const activeRow = previewDimension
    ? rows.find((c) => c.subject === previewDimension)
    : null;

  const shellClass =
    variant === 'sidebar'
      ? 'rounded-2xl border border-warm bg-surface-1/80 h-full flex flex-col'
      : 'p-4 space-y-3 border-t border-warm/60';

  return (
    <div className={shellClass} onMouseLeave={() => onPreviewDimension(null)}>
      <div className={`${variant === 'sidebar' ? 'p-4 pb-3' : ''} flex items-start justify-between gap-3`}>
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
            Score breakdown
          </h3>
          <p className="text-xs text-muted mt-1">
            Hover to preview on the photo · click to lock a dimension
          </p>
        </div>
        <ScoreExplainerTrigger onClick={() => setShowExplainer(true)} />
      </div>

      <div
        className={`${variant === 'sidebar' ? 'px-4' : ''} space-y-1.5 flex-1`}
      >
        {rows.map((item) => {
          const isPreview = previewDimension === item.subject;
          const isSelected = selectedDimension === item.subject;
          const barColor =
            item.score >= 8
              ? 'bg-amber-500'
              : item.score >= 5
                ? 'bg-amber-500/70'
                : 'bg-rose-500';
          return (
            <button
              key={item.subject}
              type="button"
              onClick={() => onSelectDimension(item.subject)}
              onMouseEnter={() => onPreviewDimension(item.subject)}
              onFocus={() => onPreviewDimension(item.subject)}
              onBlur={() => onPreviewDimension(null)}
              className={`w-full flex items-center gap-2 sm:gap-3 text-left p-2 rounded-lg transition-colors duration-100 ${
                isSelected
                  ? 'bg-brand-500/15 ring-1 ring-brand-500/50'
                  : isPreview
                    ? 'bg-surface-3/60'
                    : 'hover:bg-surface-3/40'
              }`}
            >
              <span
                className={`w-[4.5rem] sm:w-20 text-xs truncate shrink-0 ${
                  isSelected || isPreview ? 'text-brand-400 font-semibold' : 'text-muted'
                }`}
              >
                {item.subject}
              </span>
              <div className="flex-1 h-2.5 bg-surface-3 rounded-full overflow-hidden min-w-0">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${item.score * 10}%` }}
                />
              </div>
              <span className="w-7 sm:w-8 text-sm font-bold text-stone-100 shrink-0 tabular-nums">
                {item.score.toFixed(1)}
              </span>
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onWhyClick(item.subject);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onWhyClick(item.subject);
                  }
                }}
                className="text-xs text-brand-400 hover:text-brand-300 shrink-0 cursor-pointer"
              >
                Why?
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={`${
          variant === 'sidebar' ? 'm-4 mt-3' : ''
        } rounded-xl border border-warm/80 bg-canvas-elevated/50 p-3 min-h-[7.5rem] max-h-[7.5rem] overflow-y-auto`}
        aria-live="polite"
      >
        {activeRow ? (
          <>
            <p className="text-[10px] font-bold uppercase text-brand-400 tracking-wide mb-1">
              {activeRow.subject} · {activeRow.score.toFixed(1)}/10
              {selectedDimension === activeRow.subject && (
                <span className="text-muted font-normal normal-case tracking-normal ml-1">
                  · locked
                </span>
              )}
            </p>
            <p className="text-sm text-stone-200 leading-relaxed">{activeRow.critique}</p>
          </>
        ) : (
          <p className="text-sm text-muted leading-relaxed">
            Hover or tap a dimension to see how Engram scored it and what to improve.
          </p>
        )}
      </div>

      {variant === 'sidebar' && <div className="h-4 shrink-0" aria-hidden />}

      <ScoreExplainer isOpen={showExplainer} onClose={() => setShowExplainer(false)} />
    </div>
  );
};

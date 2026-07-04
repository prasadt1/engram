import React from 'react';
import { TrendingUp } from 'lucide-react';

interface ScoreRow {
  subject: string;
  score: number;
  critique: string;
}

interface Props {
  rows: ScoreRow[];
  onViewGlassBox?: () => void;
}

/** Pass 6 — comparative learning nudge on Overview (not full trend backend). */
export const LearningInsights: React.FC<Props> = ({ rows, onViewGlassBox }) => {
  if (rows.length === 0) return null;

  const weakest = rows[0];
  const strongest = rows[rows.length - 1];
  const spread = strongest.score - weakest.score;

  return (
    <section
      className="rounded-xl border border-brand-500/25 bg-brand-500/5 p-5 space-y-3"
      aria-labelledby="learning-insights-heading"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-brand-400" aria-hidden />
        <h3 id="learning-insights-heading" className="text-sm font-bold text-brand-300">
          Learning insights
        </h3>
      </div>
      <p className="text-sm text-stone-200 leading-relaxed">
        Your lowest dimension here is <strong className="text-white">{weakest.subject}</strong> (
        {weakest.score.toFixed(1)}/10). That is what pulled the overall critique — open Glass Box
        to see which observations drove that score.
      </p>
      {spread >= 1.5 && (
        <p className="text-sm text-muted leading-relaxed">
          You are stronger on <strong className="text-stone-300">{strongest.subject}</strong> (
          {strongest.score.toFixed(1)}) — compare what you did differently when you practice that
          skill again.
        </p>
      )}
      {onViewGlassBox && (
        <button
          type="button"
          onClick={onViewGlassBox}
          className="text-xs font-semibold text-brand-400 hover:text-brand-300"
        >
          Read full Glass Box reasoning →
        </button>
      )}
    </section>
  );
};

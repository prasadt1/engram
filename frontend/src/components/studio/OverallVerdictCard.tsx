/**
 * Compact overall verdict — headline visible by default, full critique expandable.
 */

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';

interface Props {
  overallScore: number;
  skillLevel: string;
  badgeClass: string;
  headline: string;
  fullCritique: string;
}

export const OverallVerdictCard: React.FC<Props> = ({
  overallScore,
  skillLevel,
  badgeClass,
  headline,
  fullCritique,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = fullCritique.trim().length > headline.trim().length + 2;

  useEffect(() => {
    setExpanded(false);
  }, [fullCritique]);

  return (
    <section className="rounded-2xl border border-brand-500/25 bg-surface-1/90 p-4 md:p-5 shadow-lg shadow-black/20">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500 shadow-md shrink-0">
          <span className="text-xl md:text-2xl font-bold text-on-brand tabular-nums font-serif">
            {overallScore.toFixed(1)}
          </span>
          <span className="text-xs font-semibold text-on-brand/70">/ 10</span>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${badgeClass}`}>
          {skillLevel}
        </span>
        <h2 className="font-serif text-base md:text-lg text-stone-100 leading-snug flex items-start gap-2 flex-1 min-w-[12rem]">
          <Star className="w-5 h-5 text-brand-400 fill-brand-400 shrink-0 mt-0.5" aria-hidden />
          <span>{headline}</span>
        </h2>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-medium shrink-0 ml-auto"
          >
            {expanded ? (
              <>
                Hide full critique
                <ChevronUp className="w-3.5 h-3.5" aria-hidden />
              </>
            ) : (
              <>
                Read full critique
                <ChevronDown className="w-3.5 h-3.5" aria-hidden />
              </>
            )}
          </button>
        )}
      </div>
      {expanded && hasMore && (
        <p className="text-sm text-stone-300 leading-relaxed mt-3 pl-7 md:pl-8 max-w-3xl animate-fadeIn border-l-2 border-warm/60 ml-0.5">
          {fullCritique}
        </p>
      )}
    </section>
  );
};

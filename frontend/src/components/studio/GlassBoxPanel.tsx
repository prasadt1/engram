/**
 * Glass Box — transparent reasoning UI with dimension-linked highlights.
 */

import React, { useEffect, useRef } from 'react';
import { Aperture, ChevronDown, ChevronUp, Eye, Target, Database } from 'lucide-react';
import { dimensionForText, textMatchesDimension } from '../../lib/glassBoxHighlight';
import type { StudioAnalysis, EvidenceItem } from '../../types/studio';
import EvidencePanel from './EvidencePanel';

interface Props {
  rationale: StudioAnalysis['rationale'];
  groundingPrinciples: string[];
  groundingCitations: StudioAnalysis['groundingCitations'];
  evidence: EvidenceItem[];
  focusDimension?: string | null;
  onFocusDimension?: (dimension: string | null) => void;
  className?: string;
}

function highlightClass(active: boolean): string {
  return active
    ? 'ring-2 ring-brand-400/60 bg-brand-500/10 rounded-md -mx-1 px-1'
    : '';
}

const GlassBoxPanel: React.FC<Props> = ({
  rationale,
  groundingPrinciples,
  groundingCitations,
  evidence,
  focusDimension = null,
  onFocusDimension,
  className = '',
}) => {
  const [expanded, setExpanded] = React.useState(true);
  const firstMatchRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (focusDimension && firstMatchRef.current) {
      firstMatchRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusDimension]);

  let assignedFirstMatch = false;

  return (
    <div className={`space-y-4 animate-fadeIn ${className}`}>
      {focusDimension && (
        <p className="text-xs text-brand-400/90 bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-2">
          Highlighting reasoning related to <strong className="text-brand-300">{focusDimension}</strong>
          — click any line to explore another dimension.
        </p>
      )}

      <div className="rounded-2xl border border-brand-500/25 shadow-xl shadow-black/30 bg-photo-black/90 overflow-hidden backdrop-blur-md">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-surface-2/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-500/15 border border-brand-500/30 rounded-lg text-brand-400">
                <Aperture className="w-5 h-5" aria-hidden />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm md:text-base font-serif">Why I scored it this way</h3>
                <p className="text-xs text-muted mt-0.5">
                  Glass Box — my reasoning steps, so you can learn from the critique
                </p>
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted shrink-0" aria-hidden />
            )}
          </button>

          {expanded && (
            <div className="p-5 md:p-6 border-t border-warm bg-photo-black text-sm leading-relaxed space-y-6 animate-springIn">
              <div>
                <h4 className="flex items-center gap-2 text-brand-400 font-bold mb-3 uppercase text-xs tracking-wider">
                  <Eye className="w-4 h-4" aria-hidden /> Key observations
                </h4>
                <ul className="space-y-2.5 list-disc list-outside pl-5 marker:text-brand-500/50" role="list">
                  {rationale.observations.map((obs, i) => {
                    const match = textMatchesDimension(obs, focusDimension);
                    const dim = dimensionForText(obs);
                    const ref =
                      match && !assignedFirstMatch
                        ? (el: HTMLLIElement | null) => {
                            firstMatchRef.current = el;
                            assignedFirstMatch = true;
                          }
                        : undefined;
                    return (
                      <li
                        key={i}
                        ref={ref}
                        className={`text-stone-200 ${highlightClass(match)} ${
                          onFocusDimension && dim ? 'cursor-pointer hover:text-white' : ''
                        }`}
                        onClick={() => onFocusDimension?.(dim)}
                        onKeyDown={(e) => {
                          if (onFocusDimension && dim && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onFocusDimension(dim);
                          }
                        }}
                        role={onFocusDimension && dim ? 'button' : undefined}
                        tabIndex={onFocusDimension && dim ? 0 : undefined}
                      >
                        {obs}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-amber-400/90 font-bold mb-3 uppercase text-xs tracking-wider">
                  <Aperture className="w-4 h-4" aria-hidden /> Reasoning steps
                </h4>
                <ol className="space-y-3" role="list">
                  {rationale.reasoningSteps.map((step, i) => {
                    const match = textMatchesDimension(step, focusDimension);
                    const dim = dimensionForText(step);
                    return (
                      <li
                        key={i}
                        className={`flex gap-3 text-stone-300 ${highlightClass(match)} ${
                          onFocusDimension && dim ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => onFocusDimension?.(dim)}
                        onKeyDown={(e) => {
                          if (onFocusDimension && dim && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onFocusDimension(dim);
                          }
                        }}
                        role={onFocusDimension && dim ? 'button' : undefined}
                        tabIndex={onFocusDimension && dim ? 0 : undefined}
                      >
                        <span className="text-brand-500/70 font-bold">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {rationale.priorityFixes.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 text-amber-400 font-bold mb-3 uppercase text-xs tracking-wider">
                    <Target className="w-4 h-4" aria-hidden /> Priority fixes
                  </h4>
                  <div className="space-y-2" role="list">
                    {rationale.priorityFixes.map((fix, i) => (
                      <div
                        key={i}
                        role="listitem"
                        className={`flex items-center gap-3 p-2 rounded bg-canvas-elevated border border-warm ${highlightClass(
                          textMatchesDimension(fix, focusDimension),
                        )}`}
                      >
                        <div className="w-4 h-4 rounded border border-amber-500/50 flex items-center justify-center shrink-0">
                          <div className="w-2 h-2 bg-amber-500 rounded-sm" />
                        </div>
                        <span className="text-stone-300">{fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(groundingCitations.length > 0 || groundingPrinciples.length > 0) && (
                <div className="pt-2 border-t border-warm">
                  <h4 className="flex items-center gap-2 text-brand-400 font-bold mb-3 uppercase text-xs tracking-wider">
                    <Database className="w-4 h-4" aria-hidden /> Photography principles I used
                  </h4>
                  <div className="space-y-2">
                    {(groundingCitations.length > 0
                      ? groundingCitations
                      : groundingPrinciples.map((id) => ({ id, title: id, excerpt: '' }))
                    ).map((c) => (
                      <div
                        key={c.id}
                        className="text-xs rounded-lg bg-brand-500/5 border border-brand-500/20 px-3 py-2"
                      >
                        <span className="font-semibold text-brand-400">{c.title}</span>
                        {c.excerpt && (
                          <p className="text-muted mt-1 leading-relaxed">{c.excerpt}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      {evidence.length > 0 && <EvidencePanel evidence={evidence} />}
    </div>
  );
};

export default GlassBoxPanel;

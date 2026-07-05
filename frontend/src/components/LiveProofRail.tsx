/**
 * LiveProofRail — in-product "behind the scenes" steps during upload or Mentor.
 * Narrates the real architecture without DevTools; driven by elapsed waitSec.
 */

import React from 'react';
import { Eyebrow } from './primitives';
import {
  liveProofStepIndex,
  type LiveProofStep,
} from '../lib/liveProofCopy';

interface Props {
  title?: string;
  steps: LiveProofStep[];
  waitSec: number;
  /** Side column on upload overlay; compact strip in Mentor chat. */
  variant?: 'panel' | 'compact';
  className?: string;
}

export const LiveProofRail: React.FC<Props> = ({
  title = 'Behind the scenes',
  steps,
  waitSec,
  variant = 'panel',
  className = '',
}) => {
  const current = liveProofStepIndex(steps, waitSec);

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-lg border border-brand-500/25 bg-brand-500/5 px-3 py-2.5 ${className}`}
        aria-live="polite"
        aria-label={title}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 mb-2">
          {title}
        </p>
        <ol className="space-y-1.5" role="list">
          {steps.map((step, index) => {
            const isActive = index === current;
            const isPast = index < current;
            if (index > current + 1) return null;
            const Icon = step.icon;
            return (
              <li
                key={step.text}
                className={`flex items-center gap-2 text-xs transition-opacity ${
                  isPast ? 'text-stone-500 opacity-70' : isActive ? 'text-white' : 'text-muted'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-400' : ''}`} aria-hidden />
                <span className={isActive ? 'font-medium' : ''}>{step.text}</span>
                {isPast && <span className="ml-auto text-brand-400/80">✓</span>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <aside
      className={`rounded-xl border border-warm bg-surface-1/95 p-4 shadow-lg ${className}`}
      aria-live="polite"
      aria-label={title}
    >
      <Eyebrow tone="brand" className="mb-3">
        {title}
      </Eyebrow>
      <p className="text-xs text-stone-500 mb-4 leading-relaxed">
        Narrated pipeline — same sequence the backend runs; not a decorative spinner.
      </p>
      <ol className="space-y-3" role="list">
        {steps.map((step, index) => {
          const isActive = index === current;
          const isPast = index < current;
          if (index > current + 1) return null;
          const Icon = step.icon;
          return (
            <li
              key={step.text}
              className={`flex items-start gap-3 transition-opacity ${
                isPast ? 'opacity-50' : ''
              }`}
            >
              <div
                className={`p-1.5 rounded-md shrink-0 ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-400'
                    : isPast
                      ? 'bg-surface-3 text-stone-500'
                      : 'bg-surface-3 text-muted'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} aria-hidden />
              </div>
              <span
                className={`text-sm leading-snug pt-0.5 ${
                  isActive ? 'text-white font-medium' : isPast ? 'text-stone-500' : 'text-muted'
                }`}
              >
                {step.text}
              </span>
              {isPast && (
                <span className="ml-auto text-xs text-brand-400 shrink-0 pt-1">✓</span>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
};

export default LiveProofRail;

/**
 * SpotlightTour — step-by-step walkthrough that highlights live UI regions
 * (Outturn-style focus ring + tooltip), not a centered modal deck.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

export type SpotlightPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface SpotlightStep {
  id: string;
  title: string;
  description: string;
  /** data-tour attribute value; omit for a centered overview step. */
  target?: string;
  placement?: SpotlightPlacement;
  tabHint?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  steps: SpotlightStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  /** Called when the active step changes — use to navigate tabs / scroll Home. */
  onStepChange?: (step: SpotlightStep, index: number) => void;
  /** Eyebrow above title, e.g. "Judge walkthrough" */
  tourLabel?: string;
}

const PAD = 8;
const TOOLTIP_GAP = 14;
const TOOLTIP_MAX_W = 360;

function findVisibleTourTarget(targetId: string): Element | null {
  const els = document.querySelectorAll(`[data-tour="${targetId}"]`);
  for (const el of els) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

function measureTarget(targetId: string): Rect | null {
  const el = findVisibleTourTarget(targetId);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

/** True when enough of the spotlight rect is on-screen to read the tour. */
function isRectMostlyVisible(rect: Rect): boolean {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const visibleHeight = Math.min(rect.top + rect.height, vh - 16) - Math.max(rect.top, 16);
  const visibleWidth = Math.min(rect.left + rect.width, vw - 16) - Math.max(rect.left, 16);
  return visibleHeight > 48 && visibleWidth > 48;
}

function scrollTourTargetIntoView(el: Element): void {
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function tooltipPosition(
  rect: Rect | null,
  placement: SpotlightPlacement,
): { top: number; left: number; width: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(TOOLTIP_MAX_W, vw - 32);

  if (!rect || placement === 'center') {
    return { top: vh / 2 - 80, left: (vw - w) / 2, width: w };
  }

  let effectivePlacement = placement;
  if (placement === 'right' && rect.top > vh - 120) {
    effectivePlacement = 'top';
  }

  let top = rect.top + rect.height + TOOLTIP_GAP;
  let left = rect.left + rect.width / 2 - w / 2;

  if (effectivePlacement === 'top') {
    top = rect.top - TOOLTIP_GAP - 160;
  } else if (effectivePlacement === 'left') {
    left = rect.left - w - TOOLTIP_GAP;
    top = rect.top + rect.height / 2 - 80;
  } else if (effectivePlacement === 'right') {
    left = rect.left + rect.width + TOOLTIP_GAP;
    top = rect.top + rect.height / 2 - 80;
  }

  return {
    top: clamp(top, 16, vh - 180),
    left: clamp(left, 16, vw - w - 16),
    width: w,
  };
}

export const SpotlightTour: React.FC<Props> = ({
  steps,
  isOpen,
  onClose,
  onComplete,
  onStepChange,
  tourLabel = 'Guided tour',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const step = steps[currentStep];
  const isLast = currentStep >= steps.length - 1;
  const placement = step?.placement ?? (step?.target ? 'bottom' : 'center');
  const hasTarget = Boolean(
    step?.target && targetRect && isRectMostlyVisible(targetRect),
  );
  const effectivePlacement = hasTarget ? placement : 'center';

  const remeasure = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }
    setTargetRect(measureTarget(step.target));
  }, [step?.target]);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !step) return;
    onStepChange?.(step, currentStep);
  }, [isOpen, step, currentStep, onStepChange]);

  // Scroll + measure after onStepChange effects (tab switch) so nothing
  // resets scroll back to the hero before we align the spotlight.
  useEffect(() => {
    if (!isOpen || !step) return;

    if (!step.target) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    const targetId = step.target;

    const alignTarget = () => {
      if (cancelled) return;
      const el = findVisibleTourTarget(targetId);
      if (!el) {
        setTargetRect(null);
        return;
      }
      scrollTourTargetIntoView(el);
      setTargetRect(measureTarget(targetId));
    };

    const t0 = window.setTimeout(alignTarget, 0);
    const t1 = window.setTimeout(alignTarget, 50);
    const t2 = window.setTimeout(alignTarget, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isOpen, step, currentStep]);

  useEffect(() => {
    if (!isOpen) return;
    remeasure();
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [isOpen, remeasure]);

  const finish = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  }, [currentStep, steps.length, finish]);

  const handleSkip = useCallback(() => {
    finish();
  }, [finish]);

  if (!isOpen || !step) return null;

  const tooltip = tooltipPosition(hasTarget ? targetRect : null, effectivePlacement);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="spotlight-tour-title">
      {/* Click-catcher */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px] cursor-default"
        aria-label="Dismiss tour"
        onClick={handleSkip}
      />

      {hasTarget && targetRect && (
        <div
          className="absolute pointer-events-none rounded-xl border-2 border-brand-400/80 transition-all duration-300 ease-out"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          }}
          aria-hidden
        />
      )}

      <div
        className="absolute z-[71] animate-springIn"
        style={{ top: tooltip.top, left: tooltip.left, width: tooltip.width }}
      >
        <div className="rounded-2xl border border-warm bg-canvas shadow-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-1 flex items-center justify-between gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all duration-150 ${
                    i === currentStep ? 'w-6 bg-brand-400' : 'w-1.5 bg-warm-border'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleSkip}
              className="p-1.5 rounded-full text-muted hover:text-white hover:bg-surface-2 transition-colors"
              aria-label="Close tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pb-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
              {tourLabel} · {currentStep + 1}/{steps.length}
            </p>
            <h2 id="spotlight-tour-title" className="font-serif text-lg text-white leading-snug">
              {step.title}
            </h2>
            {step.tabHint && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                {step.tabHint}
              </p>
            )}
            <p className="text-sm text-stone-300 leading-relaxed">{step.description}</p>
          </div>

          <div className="px-5 py-3 border-t border-warm flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-muted hover:text-white transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500 text-on-brand text-sm font-semibold hover:bg-brand-400 transition-colors"
            >
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotlightTour;

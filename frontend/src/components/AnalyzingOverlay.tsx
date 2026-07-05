/**
 * AnalyzingOverlay — Full-screen overlay showing Glass Box thinking steps.
 * Used during photo analysis to show AI reasoning in progress.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  ANALYZE_THINKING_STEPS,
  analyzeLoadingStage,
  analyzeThinkingStepIndex,
  analyzeWaitHint,
} from '../lib/analyzeWaitCopy';
import { ApertureLoader } from './ApertureLoader';
import { ViewfinderFrame } from './ViewfinderFrame';
import { LiveProofRail } from './LiveProofRail';
import { UPLOAD_PROOF_STEPS } from '../lib/liveProofCopy';

interface Props {
  /** URL of the photo being analyzed (for preview) */
  imageUrl?: string;
  /** Elapsed seconds since analysis started */
  waitSec?: number;
  /** Cancel in-flight analysis */
  onCancel?: () => void;
}

export const AnalyzingOverlay: React.FC<Props> = ({
  imageUrl,
  waitSec = 0,
  onCancel,
}) => {
  const stageMessage = analyzeLoadingStage(waitSec);
  // Real elapsed time drives the checklist too, so it never "finishes" and
  // sits frozen while the actual critique is still being written.
  const currentStep = analyzeThinkingStepIndex(waitSec);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const overlay = (
    <div
      className="fixed inset-0 z-[100] bg-canvas/95 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analyzing-overlay-title"
    >
      <div className="max-w-4xl w-full animate-fadeIn grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] gap-6 items-start">
        <div>
        {imageUrl && (
          <ViewfinderFrame active={true} className="mb-6">
            <div className="rounded-2xl overflow-hidden border border-warm bg-photo-black p-2 shadow-2xl">
              <img
                src={imageUrl}
                alt="Photo being analyzed"
                className="w-full max-h-[min(40vh,320px)] object-contain rounded-xl mx-auto"
              />
            </div>
          </ViewfinderFrame>
        )}

        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-full animate-pulse" />
            <ApertureLoader size={48} blades={8} className="relative z-10" />
          </div>
          <div className="flex items-center gap-3">
            <h2 id="analyzing-overlay-title" className="text-xl font-bold text-white">
              Engram is analyzing…
            </h2>
            {onCancel && waitSec >= 8 && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted hover:text-white border border-warm hover:border-warm"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            )}
          </div>
          <p className="text-sm text-muted mt-1">{stageMessage}</p>
        </div>

        <div className="rounded-xl bg-surface-1 border border-warm p-4 shadow-lg">
          <div className="space-y-3">
            {ANALYZE_THINKING_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isPast = index < currentStep;
              const isFuture = index > currentStep + 1;

              if (isFuture) return null;

              const StepIcon = step.icon;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 transition-all duration-150 ${
                    isPast ? 'opacity-40' : ''
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-md transition-colors ${
                      isActive
                        ? 'bg-brand-500/20 text-brand-400'
                        : isPast
                          ? 'bg-surface-3 text-stone-500'
                          : 'bg-surface-3 text-muted'
                    }`}
                  >
                    <StepIcon
                      className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`}
                    />
                  </div>
                  <span
                    className={`text-sm ${
                      isActive
                        ? 'text-white font-semibold'
                        : isPast
                          ? 'text-stone-500'
                          : 'text-muted'
                    }`}
                  >
                    {step.text}
                  </span>
                  {isPast && (
                    <span className="ml-auto text-xs text-brand-400">✓</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 h-1 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-brand-500/80 transition-all duration-1000 ease-out-expo"
              style={{ width: `${Math.min(95, 12 + waitSec * 1.2)}%` }}
            />
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-4">{analyzeWaitHint(waitSec)}</p>
        </div>

        <LiveProofRail
          steps={UPLOAD_PROOF_STEPS}
          waitSec={waitSec}
          className="hidden lg:block sticky top-4"
        />
        <LiveProofRail
          steps={UPLOAD_PROOF_STEPS}
          waitSec={waitSec}
          variant="compact"
          className="lg:hidden mt-4"
        />
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

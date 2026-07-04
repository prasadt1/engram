/**
 * OnboardingTour v2 — feature walkthrough with tab highlights (B7).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Home,
  Images,
  MessageCircle,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

interface TourStep {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  tabHint?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'home',
    icon: Home,
    title: 'Your darkroom home',
    description:
      'Your best work up front — scores, Glass Box reasoning, and progress at a glance.',
    tabHint: 'Home tab',
  },
  {
    id: 'work',
    icon: Images,
    title: 'My Work',
    description:
      'Upload for critique. Search your library, delete or bulk-select photos, and expand any tile for Glass Box reasoning.',
    tabHint: 'My Work tab',
  },
  {
    id: 'practice',
    icon: Target,
    title: 'Practice challenges',
    description:
      'I propose focused assignments — you accept, shoot in Field or Studio, then compare before & after when complete.',
    tabHint: 'Practice tab',
  },
  {
    id: 'field',
    icon: Camera,
    title: 'Field capture',
    description:
      'Shoot with live horizon guidance and get a full critique on device — same Glass Box memory as web.',
    tabHint: 'Practice → Field',
  },
  {
    id: 'mentor',
    icon: MessageCircle,
    title: 'Mentor & Organize',
    description:
      'Ask about your library, run organize scans, and approve every tag or delete — nothing changes without you.',
    tabHint: 'Mentor tab',
  },
  {
    id: 'finish',
    icon: Sparkles,
    title: 'You are set',
    description:
      'Upload a photo to start. Restart this tour anytime from Settings.',
  },
];

const STORAGE_KEY = 'iris-tour-completed-v2';

interface Props {
  forceShow?: boolean;
  onComplete?: () => void;
}

export const OnboardingTour: React.FC<Props> = ({ forceShow, onComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      setCurrentStep(0);
      return;
    }
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsOpen(false);
      onComplete?.();
    }
  }, [currentStep, onComplete]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  }, [onComplete]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-canvas/90 backdrop-blur-sm animate-overlayFadeIn">
      <div className="relative max-w-md w-full animate-springIn">
        <div className="flex justify-center gap-1.5 mb-4">
          {TOUR_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                i === currentStep ? 'w-8 bg-brand-400' : 'w-1.5 bg-warm-border'
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-warm bg-canvas overflow-hidden shadow-2xl">
          <div className="bg-brand-500/20 border-b border-brand-500/30 p-6 flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/25 border border-brand-500/40 flex items-center justify-center">
              <StepIcon className="w-8 h-8 text-brand-400" />
            </div>
          </div>

          <div className="p-6 text-center space-y-3">
            <h2 className="font-serif text-xl text-white">{step.title}</h2>
            {step.tabHint && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                {step.tabHint}
              </p>
            )}
            <p className="text-sm text-stone-300 leading-relaxed">{step.description}</p>
          </div>

          <div className="p-4 border-t border-warm flex items-center justify-between">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-muted hover:text-white transition-colors"
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-500 text-on-brand text-sm font-semibold hover:bg-brand-400 transition-colors"
            >
              {isLast ? (
                <>
                  Get started
                  <Sparkles className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="absolute -top-2 -right-2 p-2 rounded-full bg-surface-2 border border-warm text-muted hover:text-white transition-colors"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const TourRestartButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
  >
    Take a tour
  </button>
);

export function isTourCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function resetTour(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('iris-tour-completed');
}

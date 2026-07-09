/**
 * JudgeTour — six-stop walkthrough for hackathon evaluators (?judge=1).
 * Separate from the generic OnboardingTour; focuses on memory proof.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  FlaskConical,
  Home,
  Images,
  MessageCircle,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'engram-judge-tour-completed';

interface TourStep {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  tabHint?: string;
}

const JUDGE_TOUR_STEPS: TourStep[] = [
  {
    id: 'journey',
    icon: BadgeCheck,
    title: 'Journey & graduation',
    description:
      'Home leads with what Engram remembers: identity, cleared skills, and the skill closest to clearing. Each dot is a strong upload (7+ out of 10) — three in a row and that advice retires.',
    tabHint: 'Home · Journey',
  },
  {
    id: 'upload',
    icon: Images,
    title: 'Upload + Memory Receipt',
    description:
      'Upload a photo in My Work. After critique, expand the Memory Receipt — it shows what was recalled, retired, and dropped for token budget.',
    tabHint: 'My Work · after upload',
  },
  {
    id: 'mentor',
    icon: MessageCircle,
    title: 'Photo-scoped Mentor recall',
    description:
      'Open any photo and ask the Mentor. Replies draw on scoped memory for that frame — with the same receipt proving recall vs forgetting.',
    tabHint: 'My Work · photo detail',
  },
  {
    id: 'proof',
    icon: FlaskConical,
    title: 'Memory Proof Room + live MCP',
    description:
      'The Proof section shows live memory counts from MongoDB and a frozen FAMA benchmark. Toggle MCP to confirm the stats round-trip through engram-mcp.',
    tabHint: 'Sidebar · Proof',
  },
  {
    id: 'example',
    icon: Sparkles,
    title: 'Canon → Sony worked example',
    description:
      'In Memory Proof Room, read the Canon/Sony scenario first — it shows stale-fact forgetting in one question. Then scan the full FAMA table.',
    tabHint: 'Memory Proof Room',
  },
  {
    id: 'coach',
    icon: Users,
    title: 'Coach Assist — and it scales',
    description:
      'Open Coach Assist from the Proof section: three learner cards with real MongoDB journeys (isolated memory, skills, assignments). The interactive walkthrough stays on Jordan; the roster proves parallel learners without mixing data.',
    tabHint: 'Sidebar · Coach Assist',
  },
];

interface Props {
  forceShow?: boolean;
  onComplete?: () => void;
}

export const JudgeTour: React.FC<Props> = ({ forceShow, onComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      setCurrentStep(0);
      return;
    }
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    const timer = window.setTimeout(() => setIsOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [forceShow]);

  const finish = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < JUDGE_TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  }, [currentStep, finish]);

  const handleSkip = useCallback(() => {
    finish();
  }, [finish]);

  if (!isOpen) return null;

  const step = JUDGE_TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === JUDGE_TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-canvas/90 backdrop-blur-sm animate-overlayFadeIn">
      <div className="relative max-w-md w-full animate-springIn">
        <div className="flex justify-center gap-1.5 mb-4">
          {JUDGE_TOUR_STEPS.map((s, i) => (
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
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
              Judge walkthrough · {currentStep + 1}/{JUDGE_TOUR_STEPS.length}
            </p>
            <h2 className="font-serif text-xl text-white">{step.title}</h2>
            {step.tabHint && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
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
              Skip
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-500 text-on-brand text-sm font-semibold hover:bg-brand-400 transition-colors"
            >
              {isLast ? (
                <>
                  Start exploring
                  <Home className="w-4 h-4" />
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
          aria-label="Close judge tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export function resetJudgeTour(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export default JudgeTour;

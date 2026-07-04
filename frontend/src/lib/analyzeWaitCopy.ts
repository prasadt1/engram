import { Aperture, BookOpen, Brain, CheckCircle2, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Staged copy while photo analysis runs — sequence mirrors the real
 * app.coach.analyze_photo pipeline (scene grounding -> memory recall ->
 * Qwen-VL critique -> shape validation), ~60-70s total observed latency.
 * The pipeline can't report real progress yet, so this is honest about
 * being a narrated *sequence*, not a live progress bar.
 *
 * Single source of truth for both the headline stage text below and the
 * step checklist in AnalyzingOverlay.tsx / PhotoUploader.tsx — those two
 * surfaces show the same pipeline for the same backend call, so they stay
 * driven by the same thresholds instead of two copies that could drift.
 */
export interface AnalyzeThinkingStep {
  text: string;
  icon: LucideIcon;
  atSec: number;
}

export const ANALYZE_THINKING_STEPS: AnalyzeThinkingStep[] = [
  { text: 'Reading your photo…', icon: BookOpen, atSec: 0 },
  { text: 'Qwen-VL is studying composition and lighting…', icon: Eye, atSec: 8 },
  { text: 'Recalling what I know about you…', icon: Brain, atSec: 23 },
  { text: 'Writing your critique…', icon: Aperture, atSec: 28 },
  { text: 'Checking the shape of the analysis…', icon: CheckCircle2, atSec: 58 },
];

/** Index of the current step for real elapsed waitSec (never "finishes" early). */
export function analyzeThinkingStepIndex(waitSec: number): number {
  return ANALYZE_THINKING_STEPS.reduce(
    (step, s, i) => (waitSec >= s.atSec ? i : step),
    0,
  );
}

export function analyzeLoadingStage(waitSec: number): string {
  return ANALYZE_THINKING_STEPS[analyzeThinkingStepIndex(waitSec)].text;
}

export function analyzeWaitHint(waitSec: number): string {
  if (waitSec < 15) return 'Usually 60–70 seconds · can take longer on cellular';
  return `Often 60–70 seconds · ${waitSec}s — keep this tab open`;
}

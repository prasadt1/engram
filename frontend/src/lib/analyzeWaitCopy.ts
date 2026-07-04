/** Staged copy while photo analysis runs (30–90s on cellular). */
export function analyzeLoadingStage(waitSec: number): string {
  if (waitSec < 8) return 'Sending your photo…';
  if (waitSec < 20) return 'Looking at your composition…';
  if (waitSec < 40) return 'Evaluating lighting and technique…';
  if (waitSec < 60) return 'Building Glass Box critique…';
  return 'Almost there — complex photos take longer…';
}

export function analyzeWaitHint(waitSec: number): string {
  if (waitSec < 15) return 'Usually 30–60 seconds · can take up to 90s on cellular';
  return `Often 30–90 seconds · ${waitSec}s — keep this tab open`;
}

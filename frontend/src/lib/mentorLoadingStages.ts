import type { UserMode } from '../types/practice';

/** Staged copy while Mentor orchestrator runs (30–90s). */
export function mentorLoadingStage(waitSec: number, mode: UserMode): string {
  if (mode === 'working_pro') {
    if (waitSec < 6) return 'Reading your question…';
    if (waitSec < 20) return 'Looking through your portfolio…';
    if (waitSec < 40) return 'Checking listing and style patterns…';
    if (waitSec < 60) return 'Comparing with your past print picks…';
    return 'Let me think about that…';
  }
  if (waitSec < 6) return 'Reading your question…';
  if (waitSec < 18) return 'Reviewing your recent critiques…';
  if (waitSec < 35) return 'Looking for themes in your portfolio…';
  if (waitSec < 55) return 'Connecting patterns across your shoots…';
  return 'Let me think about that…';
}

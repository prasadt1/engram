/**
 * Live demo stats for judge landing proof lines — no hardcoded library counts.
 */

import { fetchCoachingSnapshot } from '../services/journeyClient';
import type { JourneySkill } from '../services/journeyClient';
import { fetchPortfolioStats } from '../services/memoryClient';
import { currentFocusFromJourney, STREAK_TARGET } from './coachingBrief';
import { humanizeSkillName } from './scoreContext';

/** One proof sentence: bold emphasis + trailing copy. */
export interface JudgeProofLine {
  emphasis: string;
  rest: string;
}

export interface JudgeDemoStats {
  photoCount: number;
  library: JudgeProofLine;
  cleared: JudgeProofLine;
  focus: JudgeProofLine;
}

export function buildLibraryProofLine(count: number): JudgeProofLine {
  const critique = count === 1 ? 'real critique' : 'real critiques';
  return {
    emphasis: `${count} ${critique}`,
    rest: ' in the library',
  };
}

export function buildClearedProofLine(skills: JourneySkill[]): JudgeProofLine {
  const cleared = skills.filter((s) => s.status === 'cleared');
  if (cleared.length === 1) {
    const name = humanizeSkillName(cleared[0].name);
    return {
      emphasis: `${name} cleared`,
      rest: ' — coaching stopped repeating it',
    };
  }
  if (cleared.length > 1) {
    return {
      emphasis: `${cleared.length} skills cleared`,
      rest: '',
    };
  }
  return {
    emphasis: 'No skills cleared yet',
    rest: ' — strong sessions graduate coaching away',
  };
}

export function buildFocusProofLine(focus: JourneySkill | null): JudgeProofLine {
  if (!focus) {
    return {
      emphasis: 'First focus forming',
      rest: ' — upload a few frames to start',
    };
  }
  const name = humanizeSkillName(focus.name);
  if (focus.consecutive > 0) {
    return {
      emphasis: `${name}: ${focus.consecutive} of ${STREAK_TARGET}`,
      rest: ' strong sessions from clearing',
    };
  }
  return {
    emphasis: `${name}`,
    rest: ' — next skill on the clearing path',
  };
}

export async function fetchJudgeDemoStats(): Promise<JudgeDemoStats> {
  const [stats, coaching] = await Promise.all([
    fetchPortfolioStats(),
    fetchCoachingSnapshot().catch(() => null),
  ]);

  const skills = coaching?.skills ?? [];
  const focus = currentFocusFromJourney(skills);

  return {
    photoCount: stats.total,
    library: buildLibraryProofLine(stats.total),
    cleared: buildClearedProofLine(skills),
    focus: buildFocusProofLine(focus),
  };
}

/**
 * Live demo stats for judge landing chips — no hardcoded library counts.
 */

import { fetchCoachingSnapshot } from '../services/journeyClient';
import { fetchPortfolioStats } from '../services/memoryClient';
import { currentFocusFromJourney, STREAK_TARGET } from './coachingBrief';
import { humanizeSkillName } from './scoreContext';

export interface JudgeDemoStats {
  photoCount: number;
  skillsCleared: number;
  focusLabel: string;
}

export async function fetchJudgeDemoStats(): Promise<JudgeDemoStats> {
  const [stats, coaching] = await Promise.all([
    fetchPortfolioStats(),
    fetchCoachingSnapshot().catch(() => null),
  ]);

  const cleared =
    coaching?.stats.skills_cleared ??
    coaching?.skills.filter((s) => s.status === 'cleared').length ??
    0;

  const focus = currentFocusFromJourney(coaching?.skills);
  let focusLabel = 'Building first streak';
  if (focus) {
    const name = humanizeSkillName(focus.name);
    focusLabel =
      focus.consecutive > 0
        ? `${name} ${focus.consecutive} of ${STREAK_TARGET}`
        : `${name} — start streak`;
  }

  return {
    photoCount: stats.total,
    skillsCleared: cleared,
    focusLabel,
  };
}

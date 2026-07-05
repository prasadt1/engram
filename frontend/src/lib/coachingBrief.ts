/**
 * Deterministic coaching copy for Home hero and sidebar — no LLM.
 * Derived from journey skill state and latest upload memoryUpdate.
 */

import type { JourneySkill } from '../services/journeyClient';
import type { PortfolioListItem } from '../types/memory';
import { buildUploadNarration } from './memoryNarration';
import { humanizeSkillName } from './scoreContext';

export const STREAK_TARGET = 3;

export function orderWatchingByStreak(watching: JourneySkill[]): JourneySkill[] {
  return [...watching].sort(
    (a, b) => b.consecutive - a.consecutive || a.name.localeCompare(b.name),
  );
}

export function currentFocusFromJourney(skills: JourneySkill[] | undefined): JourneySkill | null {
  if (!skills?.length) return null;
  const watching = orderWatchingByStreak(skills.filter((s) => s.status === 'watching'));
  return watching[0] ?? null;
}

const NEXT_SHOT_BRIEFS: Record<string, string> = {
  composition:
    'Before you press the shutter, check the frame edges — what leads the eye to your subject?',
  lighting:
    'Notice where the light is coming from and whether shadows help or fight the story.',
  technique:
    'Lock focus and exposure on what matters — verify before the moment passes.',
  creativity:
    'Look for one angle or detail others would walk past — what makes this frame yours?',
  subject_impact:
    'Before you press the shutter, ask: what is the subject, and why should the viewer care?',
};

export function buildNextShotBrief(focusSkill: string | null): string {
  if (!focusSkill) {
    return "Upload your next frame — I'll compare it to what I already know about your work.";
  }
  return NEXT_SHOT_BRIEFS[focusSkill] ?? NEXT_SHOT_BRIEFS.composition;
}

export interface HeroMentorCaption {
  eyebrow: string;
  headline: string;
  focusLine: string | null;
  latestLine: string | null;
}

export function buildHeroMentorCaption(opts: {
  identity: string | null | undefined;
  skills: JourneySkill[] | undefined;
  latestUpload: PortfolioListItem | null | undefined;
  portfolioTotal: number;
}): HeroMentorCaption {
  const { identity, skills, latestUpload, portfolioTotal } = opts;
  const focus = currentFocusFromJourney(skills);

  const eyebrow = 'Your mentor read';

  let headline: string;
  if (identity?.trim()) {
    headline = identity.trim();
  } else if (portfolioTotal === 0) {
    headline = "Upload your first photo and I'll start learning how you see.";
  } else {
    headline = 'Building your coaching plan from every frame you share.';
  }

  let focusLine: string | null = null;
  if (focus) {
    const name = humanizeSkillName(focus.name);
    if (focus.consecutive > 0) {
      focusLine = `Current focus: ${name} — ${focus.consecutive} of ${STREAK_TARGET} strong sessions toward clearing.`;
    } else {
      focusLine = `Current focus: ${name}.`;
    }
  }

  let latestLine: string | null = null;
  const narration = buildUploadNarration(latestUpload?.memoryUpdate ?? null);
  if (narration?.headline) {
    latestLine = narration.headline;
  }

  return { eyebrow, headline, focusLine, latestLine };
}

export function buildSidebarMentorLine(opts: {
  identity: string | null | undefined;
  dominantTags: string[] | undefined;
  photoCount: number;
}): string {
  if (opts.identity?.trim()) {
    return opts.identity.trim();
  }
  if (opts.dominantTags && opts.dominantTags.length > 0) {
    const tags = opts.dominantTags.slice(0, 2).join(' and ').replace(/_/g, ' ');
    return `I notice you're drawn to ${tags} work.`;
  }
  if (opts.photoCount > 0) {
    return "Upload when you're ready — I'll remember every frame.";
  }
  return 'Upload your first photo to begin.';
}

export interface SidebarFocusDisplay {
  skillLabel: string;
  detail: string;
}

/** Always returns copy for the sidebar focus card when the user has photos. */
export function buildSidebarFocusDisplay(
  focus: JourneySkill | null,
  skills: JourneySkill[] | undefined,
): SidebarFocusDisplay {
  if (focus) {
    const skillLabel = humanizeSkillName(focus.name);
    const detail =
      focus.consecutive > 0
        ? `${focus.consecutive} of ${STREAK_TARGET} strong sessions toward clearing`
        : 'Working toward clearing this skill';
    return { skillLabel, detail };
  }

  const clearedCount = skills?.filter((s) => s.status === 'cleared').length ?? 0;
  if (clearedCount > 0) {
    return {
      skillLabel: 'On track',
      detail: 'Every tracked skill is cleared — upload to spot what to sharpen next.',
    };
  }

  return {
    skillLabel: 'Getting started',
    detail: "Upload a few photos and I'll name your first focus.",
  };
}

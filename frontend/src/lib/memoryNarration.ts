/**
 * Deterministic upload narration from engine-reported skill transitions.
 * No LLM — every sentence maps to memoryUpdate payload conditions.
 */

import { formatSkillLabel } from './formatSkillLabel';

export interface MemoryUpdateSkill {
  skill: string;
  score: number;
  bar: number;
  aboveBar: boolean;
  statusBefore: 'watching' | 'cleared';
  statusAfter: 'watching' | 'cleared';
  streakBefore: number;
  streakAfter: number;
}

export interface MemoryUpdate {
  skills: MemoryUpdateSkill[];
  genre: string;
  dominantGenreBefore: string | null;
}

export interface UploadNarration {
  headline: string;
  mutedLabel?: string;
  details: string[];
}

type OutcomeKind =
  | 'exception-cleared'
  | 'exception-watching'
  | 'reinforced'
  | 'reinforced-cleared'
  | 'new-signal'
  | 'quiet';

interface OutcomeCandidate {
  kind: OutcomeKind;
  skill?: string;
  priority: number;
  headline: string;
}

function humanizeGenre(genre: string): string {
  return genre.replace(/_/g, ' ');
}

/** Watching skill closest to clearing before this upload (matches journey focus tie-break). */
export function currentFocusSkillBefore(skills: MemoryUpdateSkill[]): string | null {
  const watching = skills.filter((s) => s.statusBefore === 'watching');
  if (watching.length === 0) return null;
  watching.sort((a, b) => b.streakBefore - a.streakBefore || a.skill.localeCompare(b.skill));
  return watching[0]!.skill;
}

function skillLabel(skill: string, lower = false): string {
  const label = formatSkillLabel(skill);
  return lower ? label.toLowerCase() : label;
}

function deriveCandidates(update: MemoryUpdate): OutcomeCandidate[] {
  const { skills, genre, dominantGenreBefore } = update;
  const focus = currentFocusSkillBefore(skills);
  const candidates: OutcomeCandidate[] = [];

  for (const s of skills) {
    const label = skillLabel(s.skill);
    const labelLower = skillLabel(s.skill, true);

    if (!s.aboveBar && s.statusBefore === 'cleared' && s.statusAfter === 'cleared') {
      candidates.push({
        kind: 'exception-cleared',
        skill: s.skill,
        priority: 100,
        headline: `This frame struggled with ${labelLower}, but your body of work is still strong there — one photo doesn't rewrite your plan. ${label} stays cleared.`,
      });
      continue;
    }

    if (
      !s.aboveBar &&
      s.statusBefore === s.statusAfter &&
      s.streakBefore > 0 &&
      s.streakAfter === 0
    ) {
      const highStreak = s.streakBefore >= 2;
      candidates.push({
        kind: 'exception-watching',
        skill: s.skill,
        priority: highStreak ? 95 : 85,
        headline: `This one dipped on ${labelLower}. Your plan doesn't change, but it does reset your streak — you were ${s.streakBefore} of 3.`,
      });
      continue;
    }

    if (s.aboveBar && s.statusBefore === 'watching' && s.streakAfter > s.streakBefore) {
      const onFocus = s.skill === focus;
      let headline = `Another strong frame for ${labelLower} — ${s.streakAfter} of 3 sessions above the bar.`;
      if (s.streakAfter === 2) {
        headline = `Another strong frame for ${labelLower} — 2 of 3 sessions above the bar. One more session like this and I stop coaching it.`;
      }
      candidates.push({
        kind: 'reinforced',
        skill: s.skill,
        priority: onFocus ? 72 : 50,
        headline,
      });
      continue;
    }

    if (s.aboveBar && s.statusBefore === 'cleared') {
      candidates.push({
        kind: 'reinforced-cleared',
        skill: s.skill,
        priority: 40,
        headline: `${label} stays reliably yours — this frame backs it up.`,
      });
    }
  }

  if (dominantGenreBefore && genre && genre !== dominantGenreBefore) {
    candidates.push({
      kind: 'new-signal',
      priority: 60,
      headline: `First ${humanizeGenre(genre)} work I've seen from you — I'll start tracking how your eye works there.`,
    });
  }

  return candidates;
}

const MUTED_LABELS: Record<OutcomeKind, string | undefined> = {
  'exception-cleared': 'Exception',
  'exception-watching': 'Exception',
  reinforced: 'Reinforced',
  'reinforced-cleared': 'Reinforced',
  'new-signal': 'New signal',
  quiet: 'Quiet frame',
};

/** Pick headline + optional secondary lines from memoryUpdate. */
export function buildUploadNarration(update: MemoryUpdate | null | undefined): UploadNarration | null {
  if (!update?.skills?.length) return null;

  const candidates = deriveCandidates(update);
  if (candidates.length === 0) {
    return {
      headline: 'Consistent with what I know about you — no change to your plan.',
      mutedLabel: MUTED_LABELS.quiet,
      details: [],
    };
  }

  candidates.sort((a, b) => b.priority - a.priority || (a.skill ?? '').localeCompare(b.skill ?? ''));
  const primary = candidates[0]!;
  const details = candidates
    .slice(1, 4)
    .map((c) => c.headline)
    .filter((line) => line !== primary.headline);

  return {
    headline: primary.headline,
    mutedLabel: MUTED_LABELS[primary.kind],
    details,
  };
}

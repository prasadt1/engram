/**
 * JourneySection — the "since last time" progress surface on Home: the
 * mentor's one-sentence summary, graduation evidence for cleared skills,
 * and a watching list with a single "closest to clearing" callout.
 */

import React from 'react';
import { BadgeCheck, Sparkles } from 'lucide-react';
import { Card, Eyebrow, Tag } from './primitives';
import { EmptyState } from './EmptyState';
import { humanizeSkillName } from '../lib/scoreContext';
import { orderWatchingByStreak, STREAK_TARGET } from '../lib/coachingBrief';
import type { JourneySkill, JourneyStats } from '../services/journeyClient';
import type { UserMode } from '../types/practice';

interface Props {
  summary: string;
  skills: JourneySkill[];
  stats: JourneyStats;
  identity: string | null;
  /** Optional user-set name — the section header becomes "{name}'s journey";
   * absent, it renders exactly the anonymous "Your journey" it always did. */
  displayName?: string | null;
  /** Hobbyist vs working pro — adjusts framing copy on Home. */
  mode?: UserMode;
}

/** Plain-language graduation rule — "above the bar" means the skill scored
 * at/above the passing threshold (7/10) on that upload. */
const GRADUATION_EXPLAINER =
  'Each filled dot is one upload where this skill scored 7+ out of 10. Three strong uploads in a row and the skill clears — I stop repeating that advice.';

export const JourneySection: React.FC<Props> = ({
  summary,
  skills,
  identity,
  displayName,
  mode = 'hobbyist',
}) => {
  const isPro = mode === 'working_pro';
  const heading = displayName
    ? isPro
      ? `${displayName}'s portfolio journey`
      : `${displayName}'s journey`
    : isPro
      ? 'Your portfolio journey'
      : 'Your journey';
  const personaNote = isPro
    ? 'Consistency across shoots — what I remember for client-ready work.'
    : 'Skill-building over time — what I remember from each critique.';

  if (skills.length === 0) {
    return (
      <section className="max-w-4xl mx-auto px-1">
        <Eyebrow className="mb-3">{heading}</Eyebrow>
        <EmptyState
          icon={<Sparkles className="w-6 h-6" />}
          description="Upload your first photos and I'll start learning your strengths."
        />
      </section>
    );
  }

  const cleared = skills.filter((s) => s.status === 'cleared');
  const watching = orderWatchingByStreak(skills.filter((s) => s.status === 'watching'));

  return (
    <section className="max-w-4xl mx-auto px-1 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>{heading}</Eyebrow>
        <Tag variant="outline">{isPro ? 'Working pro' : 'Hobbyist'}</Tag>
      </div>
      <p className="text-xs text-stone-500 -mt-2">{personaNote}</p>

      {identity && (
        <p className="font-serif text-xl md:text-2xl text-white leading-snug">{identity}</p>
      )}

      {summary && (
        <p className="font-serif text-lg md:text-xl text-white leading-snug border-l-2 border-brand-500/40 pl-4">
          {summary}
        </p>
      )}

      {cleared.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {cleared.map((skill) => (
            <Card key={skill.name} padding="sm" className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 p-2 rounded-md bg-brand-500/10 text-brand-400 inline-flex">
                <BadgeCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-white">{humanizeSkillName(skill.name)}</h3>
                  <Tag variant="brand">Cleared</Tag>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Three strong uploads in a row (7+ out of 10) — I&apos;ve stopped coaching this skill.
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {watching.length > 0 && (
        <Card padding="sm">
          <Eyebrow tone="faint" className="mb-1.5">Watching</Eyebrow>
          <p className="text-xs text-stone-400 leading-relaxed mb-3">
            {GRADUATION_EXPLAINER}
          </p>
          <ul className="space-y-2.5">
            {watching.map((skill, index) => {
              const isFocus = index === 0;
              const filled = Math.max(0, Math.min(STREAK_TARGET, skill.consecutive));
              return (
                <li
                  key={skill.name}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                    isFocus ? 'bg-brand-500/10 border border-brand-500/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-stone-200 truncate">{humanizeSkillName(skill.name)}</span>
                    {isFocus && (
                      <Tag variant="brand">
                        Current focus
                        <span className="sr-only sm:not-sr-only"> — closest to clearing</span>
                      </Tag>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    role="img"
                    aria-label={`${filled} of ${STREAK_TARGET} strong uploads toward clearing`}
                  >
                    {Array.from({ length: STREAK_TARGET }, (_, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className={`w-1.5 h-1.5 rounded-full ${
                          i < filled ? 'bg-brand-400' : 'bg-surface-2 border border-warm'
                        }`}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
};

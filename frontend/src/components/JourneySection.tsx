/**
 * JourneySection — skill progress on Home: graduation evidence for cleared
 * skills and a watching list with streak dots. Identity lives in the hero
 * mentor-read only; summary here is elaboration, not a second headline.
 */

import React from 'react';
import { BadgeCheck, Sparkles } from 'lucide-react';
import { Card, Eyebrow, Tag, InfoTooltip } from './primitives';
import { HomeSectionHeader } from './HomeSectionHeader';
import { EmptyState } from './EmptyState';
import { getDimensionMeaning, humanizeSkillName } from '../lib/scoreContext';
import { orderWatchingByStreak, STREAK_TARGET } from '../lib/coachingBrief';
import type { JourneySkill, JourneyStats } from '../services/journeyClient';
import type { UserMode } from '../types/practice';

interface Props {
  summary: string;
  skills: JourneySkill[];
  stats: JourneyStats;
  /** Optional user-set name — "{name}'s skill progress" when set. */
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
  displayName,
  mode = 'hobbyist',
}) => {
  const isPro = mode === 'working_pro';
  const heading = displayName ? `${displayName}'s skill progress` : 'Skill progress';
  const personaNote = isPro
    ? 'What I track across shoots for client-ready work.'
    : 'Clears and streaks from your critiques — same rules as the sidebar dots.';

  if (skills.length === 0) {
    return (
      <section className="w-full" aria-label="Skill progress">
        <HomeSectionHeader
          eyebrow="Skill progress"
          title={heading}
          subtitle={personaNote}
          tone="faint"
        />
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
    <section className="w-full space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <HomeSectionHeader
          eyebrow="Skill progress"
          title={heading}
          subtitle={personaNote}
          tone="faint"
          className="mb-0 flex-1 min-w-0"
        />
        <Tag variant="outline" className="shrink-0 mt-1">
          {isPro ? 'Working pro' : 'Hobbyist'}
        </Tag>
      </div>

      {summary && (
        <p className="text-sm text-stone-400 leading-relaxed border-l-2 border-brand-500/30 pl-3 max-w-2xl">
          {summary}
        </p>
      )}

      {cleared.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {cleared.map((skill) => (
            <Card key={skill.name} padding="sm" className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 p-2 rounded-md bg-brand-500/10 text-brand-400 inline-flex">
                <BadgeCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-white inline-flex items-center gap-1">
                    {humanizeSkillName(skill.name)}
                    {getDimensionMeaning(skill.name) && (
                      <InfoTooltip
                        text={getDimensionMeaning(skill.name)!}
                        label={`What ${humanizeSkillName(skill.name)} means`}
                      />
                    )}
                  </h3>
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
          <p className="text-xs text-stone-400 leading-relaxed mb-2">
            {GRADUATION_EXPLAINER}
          </p>
          <ul className="space-y-2">
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
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm text-stone-200 truncate">{humanizeSkillName(skill.name)}</span>
                    {getDimensionMeaning(skill.name) && (
                      <InfoTooltip
                        text={getDimensionMeaning(skill.name)!}
                        label={`What ${humanizeSkillName(skill.name)} means`}
                        className="shrink-0"
                      />
                    )}
                    {isFocus && (
                      <Tag variant="brand" className="tabular-nums">
                        {skill.consecutive}/{STREAK_TARGET}
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

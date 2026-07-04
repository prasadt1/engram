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
import type { JourneySkill, JourneyStats } from '../services/journeyClient';

interface Props {
  summary: string;
  skills: JourneySkill[];
  stats: JourneyStats;
  identity: string | null;
}

const STREAK_TARGET = 3;

/** The watching skill closest to graduating: highest consecutive-above-bar
 * streak. Ties (including all-zero) keep the first skill in API order —
 * this is presentation-only tie-breaking, not a backend ranking. */
function pickCurrentFocus(watching: JourneySkill[]): JourneySkill | null {
  if (watching.length === 0) return null;
  return watching.reduce((best, skill) => (skill.consecutive > best.consecutive ? skill : best));
}

export const JourneySection: React.FC<Props> = ({ summary, skills, identity }) => {
  if (skills.length === 0) {
    return (
      <section className="max-w-4xl mx-auto px-1">
        <Eyebrow className="mb-3">Your journey</Eyebrow>
        <EmptyState
          icon={<Sparkles className="w-6 h-6" />}
          description="Upload your first photos and I'll start learning your strengths."
        />
      </section>
    );
  }

  const cleared = skills.filter((s) => s.status === 'cleared');
  const watching = skills.filter((s) => s.status === 'watching');
  const currentFocus = pickCurrentFocus(watching);

  return (
    <section className="max-w-4xl mx-auto px-1 space-y-4">
      <Eyebrow>Your journey</Eyebrow>

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
                  3 sessions above the bar — I&apos;ve stopped coaching this.
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {watching.length > 0 && (
        <Card padding="sm">
          <Eyebrow tone="faint" className="mb-3">Watching</Eyebrow>
          <ul className="space-y-2.5">
            {watching.map((skill) => {
              const isFocus = currentFocus?.name === skill.name;
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
                    {isFocus && <Tag variant="brand">Current focus</Tag>}
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    role="img"
                    aria-label={`${skill.consecutive} of ${STREAK_TARGET} sessions above the bar`}
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

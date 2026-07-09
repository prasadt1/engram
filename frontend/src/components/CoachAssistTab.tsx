import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Users } from 'lucide-react';
import { fetchCoachAssistRoster } from '../services/coachAssistClient';
import type { CoachAssistLearner } from '../types/coachAssist';
import { formatSkillLabel } from '../lib/formatSkillLabel';
import { JUDGE_DEMO_USER_ID } from '../lib/judgeMode';

interface Props {
  /** Return judges to the single full walkthrough (Jordan / demo-user). */
  onGoToJordanDemo?: () => void;
}

function SkillPill({ label, variant }: { label: string; variant: 'cleared' | 'watching' | 'focus' }) {
  const styles =
    variant === 'cleared'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : variant === 'focus'
        ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
        : 'bg-surface-2 text-stone-400 border-warm';
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${styles}`}>
      {label}
    </span>
  );
}

function LearnerCard({ learner }: { learner: CoachAssistLearner }) {
  const nextAssignment = learner.activeAssignment ?? learner.proposedAssignment;
  const isDemoWalkthrough = learner.userId === JUDGE_DEMO_USER_ID;

  return (
    <article className="rounded-xl border border-warm bg-surface-1/60 p-4 md:p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-100">{learner.displayName}</h3>
          <p className="text-xs text-stone-500 mt-0.5">{learner.arcLabel}</p>
        </div>
        <span className="text-xs text-stone-500 tabular-nums shrink-0">
          {learner.photoCount} photo{learner.photoCount === 1 ? '' : 's'}
        </span>
      </div>

      {learner.identity && (
        <p className="text-sm text-stone-300 leading-relaxed">{learner.identity}</p>
      )}

      <p className="text-xs text-stone-400">{learner.memoryLine}</p>

      <div className="flex flex-wrap gap-1.5">
        {learner.clearedSkills.map((s) => (
          <SkillPill key={s} label={`${formatSkillLabel(s)} ✓`} variant="cleared" />
        ))}
        {learner.watchingSkills.map((s) => (
          <SkillPill
            key={s.name}
            label={`${formatSkillLabel(s.name)} · ${s.consecutive}/3`}
            variant={s.name === learner.currentFocus ? 'focus' : 'watching'}
          />
        ))}
      </div>

      {nextAssignment && (
        <div className="rounded-lg border border-warm bg-surface-2/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Next assignment · {formatSkillLabel(nextAssignment.targetSkill)}
          </p>
          <p className="text-xs text-stone-300 line-clamp-4">{nextAssignment.brief}</p>
        </div>
      )}

      {isDemoWalkthrough && (
        <p className="text-[11px] text-brand-300/90 border border-brand-500/25 rounded-md px-2 py-1.5">
          Full judge walkthrough — Home, Work, Mentor, Practice
        </p>
      )}
    </article>
  );
}

export const CoachAssistTab: React.FC<Props> = ({ onGoToJordanDemo }) => {
  const [learners, setLearners] = useState<CoachAssistLearner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCoachAssistRoster()
      .then((roster) => {
        if (!cancelled) setLearners(roster.learners);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load roster');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-tabEnter">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-brand-400">
          <Users className="w-5 h-5" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider">Coach Assist</p>
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-stone-100 tracking-tight">
          One mentor, many learners
        </h1>
        <p className="text-sm text-stone-400 leading-relaxed max-w-2xl">
          Read-only proof that the memory layer scales — three isolated MongoDB journeys
          (18 / 10 / 6 photos), each with its own skills, assignments, and receipts.
          The interactive judge demo follows <strong className="text-stone-200">Jordan</strong>{' '}
          end-to-end; Alex and Sam show how the same engine holds parallel arcs without mixing data.
        </p>
      </header>

      {error && (
        <p className="text-sm text-amber-400" role="alert">
          {error}
        </p>
      )}

      {!learners && !error && (
        <div className="flex items-center gap-2 text-stone-500 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Loading learners…
        </div>
      )}

      {learners && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {learners.map((learner) => (
            <LearnerCard key={learner.userId} learner={learner} />
          ))}
        </div>
      )}

      {onGoToJordanDemo && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-stone-300 flex-1">
            Walk the full product on Jordan&apos;s journey — upload, memory receipt, practice loop, Proof Room.
          </p>
          <button
            type="button"
            onClick={onGoToJordanDemo}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-500/25 text-brand-200 border border-brand-500/40 hover:bg-brand-500/35 transition-colors"
          >
            Follow Jordan&apos;s journey
            <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Assignment detail sub-route (A6 + A7).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Loader2, Target } from 'lucide-react';
import { AssignmentCompare } from './AssignmentCompare';
import { HitlReasoningCallout } from './HitlReasoningCallout';
import { SubViewBack } from './SubViewBack';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { formatSkillApplicationDelta } from '../lib/formatSkillDelta';
import { fetchAssignment } from '../services/practiceClient';
import { practiceSpeechText } from '../lib/plainTextForSpeech';
import { VoiceoverButton } from './VoiceoverButton';
import type { Assignment } from '../types/practice';

interface Props {
  assignmentId: string;
  onBack: () => void;
}

export const AssignmentDetailView: React.FC<Props> = ({ assignmentId, onBack }) => {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssignment(await fetchAssignment(assignmentId));
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted py-12 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        Loading challenge…
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="space-y-4">
        <SubViewBack label="Back to Practice" onClick={onBack} />
        <p className="text-sm text-rose-400" role="alert">
          {error ?? 'Assignment not found'}
        </p>
      </div>
    );
  }

  let when = '';
  try {
    when = formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true });
  } catch {
    when = '';
  }

  const statusLabel =
    assignment.status === 'completed'
      ? 'Completed'
      : assignment.status === 'active'
        ? 'Active'
        : assignment.status === 'proposed'
          ? 'Proposed'
          : assignment.status;

  return (
    <div className="space-y-6 animate-fadeIn">
      <SubViewBack label="Back to Practice" onClick={onBack} />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-400 uppercase tracking-wider">
            <Target className="w-3 h-3" aria-hidden />
            {statusLabel}
          </span>
          {when && <span className="text-[10px] text-muted">{when}</span>}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-serif text-2xl md:text-3xl text-white leading-snug flex-1 min-w-0">
            {assignment.brief}
          </h1>
          <VoiceoverButton
            speechId={`practice-detail-${assignment.id}`}
            text={practiceSpeechText(assignment)}
            label="assignment brief"
            size="sm"
          />
        </div>
        <p className="text-sm text-muted capitalize">
          Focus: {assignment.targetSkill.replace(/_/g, ' ')}
        </p>
      </header>

      {assignment.rationale && (
        <HitlReasoningCallout reasoning={assignment.rationale} speechId={`detail-${assignment.id}`} />
      )}

      {assignment.skillDelta && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide mb-1">
            Skill delta
          </p>
          <p className="text-sm text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" aria-hidden />
            {formatSkillApplicationDelta(assignment.skillDelta.delta)}
            <span className="text-muted">
              ({assignment.skillDelta.baseline_value.toFixed(1)} →{' '}
              {assignment.skillDelta.current_value.toFixed(1)} {assignment.skillDelta.metric})
            </span>
          </p>
          {assignment.appliedBrief != null && (
            <p className="text-xs text-muted mt-2">
              Brief applied in practice shots: {assignment.appliedBrief ? 'Yes' : 'Not yet evident'}
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Before &amp; after</h2>
        <p className="text-xs text-muted leading-relaxed">
          Baseline photos from when you accepted the challenge, compared with uploads you made while
          it was active.
        </p>
        <AssignmentCompare
          baselineShootIds={assignment.baselineShootIds}
          completionShootIds={assignment.completionShootIds}
        />
      </section>
    </div>
  );
};

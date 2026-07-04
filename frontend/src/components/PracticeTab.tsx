import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import {
  acceptAssignment,
  completeAssignment,
  declineAssignment,
  fetchAssignments,
  proposeAssignment,
} from '../services/practiceClient';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { formatSkillApplicationDelta } from '../lib/formatSkillDelta';
import { HitlReasoningCallout } from './HitlReasoningCallout';
import { AssignmentDetailView } from './AssignmentDetailView';
import { PracticeInlineShootBanner } from './PracticeInlineShootBanner';
import { PracticeCardsSkeleton } from './SkeletonBlocks';
import { EmptyState } from './EmptyState';
import { MentorMarkdown } from './MentorMarkdown';
import { VoiceoverButton } from './VoiceoverButton';
import { useToast } from './ToastHost';
import { practiceSpeechText } from '../lib/plainTextForSpeech';
import { Button, Card, Eyebrow } from './primitives';
import type { Assignment, ReflectionResult, UserMode } from '../types/practice';

interface Props {
  mode: UserMode;
  /** Optional skill to auto-trigger a challenge for (from Focus Areas CTA) */
  focusSkill?: string | null;
  /** Clear the focus skill after it's been processed */
  onClearFocusSkill?: () => void;
  onGoToStudio: () => void;
  onGoToField: () => void;
  onAssignmentsChange?: () => void;
  /** When set, show assignment detail sub-route (A6) */
  detailAssignmentId?: string | null;
  onOpenAssignmentDetail?: (id: string) => void;
  onCloseAssignmentDetail?: () => void;
}

export const PracticeTab: React.FC<Props> = ({
  mode,
  focusSkill,
  onClearFocusSkill,
  onGoToStudio,
  onGoToField,
  onAssignmentsChange,
  detailAssignmentId,
  onOpenAssignmentDetail,
  onCloseAssignmentDetail,
}) => {
  const toast = useToast();
  const [proposed, setProposed] = useState<Assignment[]>([]);
  const [active, setActive] = useState<Assignment[]>([]);
  const [completed, setCompleted] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastReflection, setLastReflection] = useState<ReflectionResult | null>(null);
  const [expandedCompletedId, setExpandedCompletedId] = useState<string | null>(null);
  const [shootBanner, setShootBanner] = useState<Assignment | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssignments();
      setProposed(data.proposed);
      setActive(data.active);
      setCompleted(data.completed);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePropose = useCallback(async (targetSkill?: string) => {
    setActing('propose');
    setError(null);
    try {
      await proposeAssignment(mode, targetSkill);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setActing(null);
    }
  }, [mode, load]);

  // Auto-trigger propose when navigating with a focus skill (from Focus Areas CTA)
  useEffect(() => {
    if (focusSkill && !loading && proposed.length === 0 && active.length === 0 && acting === null) {
      void handlePropose(focusSkill);
      onClearFocusSkill?.();
    }
  }, [focusSkill, loading, proposed.length, active.length, acting, handlePropose, onClearFocusSkill]);

  const handleAccept = async (id: string) => {
    setActing(id);
    try {
      const accepted = await acceptAssignment(id);
      await load();
      onAssignmentsChange?.();
      toast({
        variant: 'success',
        icon: <Target className="w-[18px] h-[18px]" />,
        title: 'Assignment added',
        message: "It's in your practice queue.",
      });
      setShootBanner(accepted);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActing(id);
    try {
      await declineAssignment(id);
      await load();
      onAssignmentsChange?.();
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  const handleComplete = async (id: string) => {
    setActing(`complete-${id}`);
    setError(null);
    try {
      const result = await completeAssignment(id);
      setLastReflection(result.reflection);
      await load();
      onAssignmentsChange?.();
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  if (detailAssignmentId && onCloseAssignmentDetail) {
    return (
      <AssignmentDetailView
        assignmentId={detailAssignmentId}
        onBack={onCloseAssignmentDetail}
      />
    );
  }

  if (loading) {
    return (
      <div className="animate-fadeIn space-y-6 max-w-3xl mx-auto">
        <PracticeCardsSkeleton />
        <p className="text-sm text-muted text-center">One moment…</p>
      </div>
    );
  }

  const focus: 'proposed' | 'active' | 'idle' =
    proposed.length > 0 ? 'proposed' : active.length > 0 ? 'active' : 'idle';

  return (
    <div className="animate-fadeIn space-y-8 max-w-3xl mx-auto">
      {shootBanner && (
        <PracticeInlineShootBanner
          assignment={shootBanner}
          onShootNow={() => {
            setShootBanner(null);
            onGoToField();
          }}
          onStudioUpload={() => {
            setShootBanner(null);
            onGoToStudio();
          }}
          onDismiss={() => setShootBanner(null)}
        />
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-white mb-1">My Practice</h2>
          <p className="text-muted text-sm">
            I&apos;ll suggest a focused assignment — you accept or pass — then shoot in the field
            or Studio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            disabled={acting !== null || proposed.length > 0}
            icon={
              acting === 'propose' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )
            }
            onClick={() => void handlePropose()}
          >
            Suggest practice
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {focus === 'proposed' &&
        proposed.map((a) => (
          <ProposedCard
            key={a.id}
            assignment={a}
            busy={acting === a.id}
            onAccept={() => void handleAccept(a.id)}
            onDecline={() => void handleDecline(a.id)}
          />
        ))}

      {focus !== 'proposed' && lastReflection && (
        <Card variant="active" className="bg-brand-500/10 text-sm text-stone-200">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Eyebrow tone="brand">Reflection complete</Eyebrow>
            <VoiceoverButton
              speechId="practice-reflection-latest"
              text={lastReflection.summary}
              label="reflection summary"
              size="sm"
            />
          </div>
          <div className="leading-relaxed mb-2">
            <MentorMarkdown content={lastReflection.summary} />
          </div>
          <p className="text-brand-400 text-xs">
            {formatSkillApplicationDelta(lastReflection.skillDelta.delta)} · applied brief:{' '}
            {lastReflection.appliedBrief ? 'yes' : 'not yet'}
          </p>
        </Card>
      )}

      {focus === 'active' &&
        active.map((a) => (
          <ActiveCard
            key={a.id}
            assignment={a}
            onGoToStudio={onGoToStudio}
            onGoToField={onGoToField}
            onComplete={() => void handleComplete(a.id)}
            completing={acting === `complete-${a.id}`}
            onViewDetails={
              onOpenAssignmentDetail ? () => onOpenAssignmentDetail(a.id) : undefined
            }
          />
        ))}

      {focus === 'idle' && (
        <EmptyState
          icon={<Target className="w-6 h-6" />}
          title="No active practice yet"
          description="Upload a few photos in Studio, then tap Suggest practice."
          action={
            <Button
              disabled={acting !== null}
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => void handlePropose()}
            >
              Suggest practice
            </Button>
          }
        />
      )}

      {completed.length > 0 && focus !== 'proposed' && (
        <section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <Eyebrow>Completed</Eyebrow>
            {focus === 'active' && (
              <Button variant="subtle" size="sm" onClick={() => setShowHistory((v) => !v)}>
                {showHistory ? 'Hide history' : 'Show history'}
              </Button>
            )}
          </div>
          {(focus === 'idle' || showHistory) && (
          <ul className="space-y-3">
            {completed.map((a) => (
              <CompletedCard
                key={a.id}
                assignment={a}
                expanded={expandedCompletedId === a.id}
                onToggle={() =>
                  setExpandedCompletedId((id) => (id === a.id ? null : a.id))
                }
                onViewDetails={
                  onOpenAssignmentDetail ? () => onOpenAssignmentDetail(a.id) : undefined
                }
              />
            ))}
          </ul>
          )}
        </section>
      )}
    </div>
  );
};

function CompletedCard({
  assignment,
  expanded,
  onToggle,
  onViewDetails,
}: {
  assignment: Assignment;
  expanded: boolean;
  onToggle: () => void;
  onViewDetails?: () => void;
}) {
  const long = assignment.brief.length > 160;
  return (
    <li className="rounded-xl bg-surface-1 border border-warm text-sm overflow-hidden">
      <button
        type="button"
        onClick={long ? onToggle : undefined}
        className={`w-full text-left px-4 py-3 ${long ? 'hover:bg-surface-1 cursor-pointer' : 'cursor-default'}`}
      >
        <p className="text-[10px] font-bold text-muted uppercase tracking-wide mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" aria-hidden />
            Completed
          </span>
          <VoiceoverButton
            speechId={`practice-completed-${assignment.id}`}
            text={practiceSpeechText(assignment)}
            label="completed assignment"
            size="sm"
          />
        </p>
        <div
          className={`font-medium text-stone-200 leading-relaxed ${
            expanded || !long ? '' : 'line-clamp-2'
          }`}
        >
          <MentorMarkdown content={assignment.brief} />
        </div>
        {long && !expanded && (
          <span className="text-[10px] text-brand-400 mt-1 inline-block">Show full brief</span>
        )}
        {assignment.skillDelta && (
          <p className="text-brand-400 text-xs mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {formatSkillApplicationDelta(assignment.skillDelta.delta)}
          </p>
        )}
        {onViewDetails && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            className="text-[10px] text-brand-400 mt-2 hover:text-brand-300 underline"
          >
            View details &amp; compare
          </button>
        )}
      </button>
      {expanded && assignment.rationale && (
        <div className="text-xs text-muted border-t border-warm px-4 py-3 leading-relaxed">
          <MentorMarkdown content={assignment.rationale} />
        </div>
      )}
    </li>
  );
}

function ProposedCard({
  assignment,
  busy,
  onAccept,
  onDecline,
}: {
  assignment: Assignment;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card variant="proposed" padding="lg">
      <Eyebrow tone="brand" className="mb-2 text-amber-400">Proposed — your approval required</Eyebrow>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <p className="text-xs text-brand-400 capitalize">
          Focus: {assignment.targetSkill.replace(/_/g, ' ')}
        </p>
        <VoiceoverButton
          speechId={`practice-proposed-${assignment.id}`}
          text={practiceSpeechText(assignment)}
          label="proposed assignment"
          size="sm"
        />
      </div>
      <div className="text-stone-100 leading-relaxed mb-4">
        <MentorMarkdown content={assignment.brief} />
      </div>
      {assignment.rationale ? (
        <div className="mb-6">
          <HitlReasoningCallout reasoning={assignment.rationale} speechId={`proposed-${assignment.id}`} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy}
          icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          onClick={onAccept}
        >
          Accept
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          icon={<XCircle className="w-4 h-4" />}
          onClick={onDecline}
        >
          Decline
        </Button>
      </div>
    </Card>
  );
}

function ActiveCard({
  assignment,
  onGoToStudio,
  onGoToField,
  onComplete,
  completing,
  onViewDetails,
}: {
  assignment: Assignment;
  onGoToStudio: () => void;
  onGoToField: () => void;
  onComplete: () => void;
  completing: boolean;
  onViewDetails?: () => void;
}) {
  let when = '';
  try {
    when = formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true });
  } catch {
    when = '';
  }

  return (
    <Card variant="active" padding="lg">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Eyebrow tone="brand" className="inline-flex items-center gap-1">
          <Target className="w-3 h-3" aria-hidden />
          Active practice
        </Eyebrow>
        <span className="text-[10px] text-muted">{when}</span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <p className="text-xs text-muted capitalize">
          Focus: {assignment.targetSkill.replace(/_/g, ' ')}
        </p>
        <VoiceoverButton
          speechId={`practice-active-${assignment.id}`}
          text={practiceSpeechText(assignment)}
          label="active assignment"
          size="sm"
        />
      </div>
      <div className="text-stone-100 leading-relaxed mb-3">
        <MentorMarkdown content={assignment.brief} />
      </div>
      {assignment.rationale ? (
        <HitlReasoningCallout reasoning={assignment.rationale} speechId={`active-${assignment.id}`} />
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          icon={<Camera className="w-4 h-4" />}
          onClick={onGoToField}
        >
          Field (camera)
        </Button>
        <Button variant="secondary" size="sm" onClick={onGoToStudio}>
          Studio upload
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={completing}
          icon={completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          onClick={onComplete}
        >
          Mark complete
        </Button>
        <p className="text-xs text-muted w-full">
          Shoot in Field or upload in Studio — then Mark complete for Reflection.
        </p>
        {onViewDetails && (
          <Button variant="subtle" size="sm" onClick={onViewDetails}>
            View challenge details
          </Button>
        )}
      </div>
    </Card>
  );
}

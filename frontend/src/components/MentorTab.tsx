import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ImageIcon,
  Layers,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ChatErrorBanner } from './ChatErrorBanner';
import { HitlReasoningCallout } from './HitlReasoningCallout';
import { ScanProgressBanner } from './ScanProgressBanner';
import { TabEmptyState } from './TabEmptyState';
import { MentorChatTurn } from './MentorChatTurn';
import { groupMessagesIntoTurns } from '../lib/mentorChatTurns';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { mentorLoadingStage } from '../lib/mentorLoadingStages';
import { triageScanStage } from '../lib/scanLoadingStages';
import { entryIdsForProposal } from '../lib/triageEntryIds';
import {
  fetchMentorSuggestedQuestions,
  loadSessionId,
  sendMentorMessage,
  type ChatMessage,
} from '../services/mentorClient';
import {
  decideApproval,
  fetchPendingApprovals,
  runTriageBacklog,
  runTriageScan,
} from '../services/triageClient';
import { HitlHistoryPanel } from './HitlHistoryPanel';
import { Button, Card, Eyebrow, IconButton, SegmentedControl } from './primitives';
import { fetchPortfolio, fetchPortfolioStats } from '../services/memoryClient';
import { FEATURES } from '../config/features';
import type { UserMode } from '../types/practice';
import type { PendingApproval } from '../types/triage';
import type { PortfolioListItem } from '../types/memory';

const STARTERS_BY_MODE: Record<UserMode, string[]> = {
  hobbyist: [
    'How am I doing so far?',
    'Show me themes from my recent critiques.',
    "What's distinctive about my work?",
  ],
  working_pro: [
    'Which of my recent photos are strongest for print sales?',
    'What patterns do you see across my portfolio?',
    'How can I improve consistency for my shop listings?',
  ],
};

type MentorView = 'chat' | 'label';

interface Props {
  mode: UserMode;
  onGoToWork?: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Label Photos helpers (from TriageTab)
   ───────────────────────────────────────────────────────────────────────────── */

const MAX_THUMBS = 6;

type EntryPreview = Pick<PortfolioListItem, 'id' | 'imageUrl' | 'sceneDescription' | 'overallAverage'>;

function ProposalThumbnails({
  entryIds,
  previews,
  highlightDeleteId,
}: {
  entryIds: string[];
  previews: Map<string, EntryPreview>;
  highlightDeleteId?: string;
}) {
  if (entryIds.length === 0) return null;

  const shown = entryIds.slice(0, MAX_THUMBS);
  const extra = entryIds.length - shown.length;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted uppercase tracking-wide">
        {entryIds.length === 1 ? 'This photo' : `${entryIds.length} photos in this suggestion`}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {shown.map((id) => {
          const entry = previews.get(id);
          const isDeleteTarget = highlightDeleteId === id;
          return (
            <div
              key={id}
              className={`shrink-0 w-20 rounded-lg overflow-hidden border bg-black relative ${
                isDeleteTarget ? 'border-red-500/80 ring-1 ring-red-500/50' : 'border-warm'
              }`}
              title={
                isDeleteTarget
                  ? 'Would be removed if you approve'
                  : entry?.sceneDescription?.slice(0, 120) || 'Portfolio photo'
              }
            >
              <div className="aspect-square relative">
                {entry?.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-stone-600 bg-canvas-elevated">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                {entry?.overallAverage != null && (
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-canvas-elevated/90 text-brand-400">
                    {entry.overallAverage}
                  </span>
                )}
                {isDeleteTarget && (
                  <span className="absolute inset-0 flex items-center justify-center bg-red-950/50 text-[9px] font-bold text-red-200 uppercase">
                    Remove
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {extra > 0 && (
          <div className="shrink-0 w-20 aspect-square rounded-lg border border-dashed border-warm flex items-center justify-center text-xs text-muted">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}

function describeProposal(item: PendingApproval): string {
  const payload = item.proposedAction.payload as { tags?: string[] };
  if (item.proposedAction.type === 'apply_tags') {
    const n = entryIdsForProposal(item).length;
    const tags = (payload.tags ?? []).map((t) => t.replace(/_/g, ' ')).join(', ');
    return `Add labels (${tags}) to ${n} photo${n === 1 ? '' : 's'} so they are easier to find.`;
  }
  if (item.proposedAction.type === 'delete_entry') {
    return 'Remove one near-duplicate photo from your library (only if you agree it is not worth keeping).';
  }
  return item.agentReasoning;
}

type OrganizeFeedback =
  | { kind: 'scan'; groups: number; proposals: number; superseded: number }
  | { kind: 'approved_tags'; photoCount: number; tags: string[] }
  | { kind: 'approved_delete' }
  | { kind: 'rejected' };

function OrganizeFeedbackBanner({
  feedback,
  onGoToWork,
  onDismiss,
}: {
  feedback: OrganizeFeedback;
  onGoToWork?: () => void;
  onDismiss: () => void;
}) {
  if (feedback.kind === 'scan') {
    const { groups, proposals, superseded } = feedback;
    return (
      <div className="rounded-xl border border-warm bg-surface-1 px-4 py-3 text-sm text-stone-300">
        {superseded > 0
          ? `Replaced ${superseded} old proposal(s). Found ${groups} groups; ${proposals} new card(s) to review below.`
          : `Found ${groups} groups in your library; ${proposals} proposal(s) waiting below.`}
      </div>
    );
  }

  if (feedback.kind === 'rejected') {
    return (
      <div className="rounded-xl border border-warm bg-surface-1 px-4 py-3 flex items-start justify-between gap-3">
        <p className="text-sm text-stone-300">Suggestion dismissed — nothing changed in your library.</p>
        <button type="button" onClick={onDismiss} className="text-stone-500 hover:text-white p-1" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isTags = feedback.kind === 'approved_tags';
  const tagList = isTags ? feedback.tags.map((t) => t.replace(/_/g, ' ')).join(', ') : '';

  return (
    <div
      className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-4 space-y-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-full bg-brand-500/20 shrink-0 mt-0.5">
          <Check className="w-4 h-4 text-brand-400" aria-hidden />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-white">
            {isTags
              ? `Labels applied to ${feedback.photoCount} photo${feedback.photoCount === 1 ? '' : 's'}`
              : 'Duplicate removed from your library'}
          </p>
          <p className="text-sm text-stone-300 leading-relaxed">
            {isTags ? (
              <>
                Those photos are still in <strong className="text-stone-200 font-medium">My Work</strong> — they
                now carry labels like <span className="text-brand-300">{tagList}</span>. The card above
                disappeared because you approved it; your photos did not.
              </>
            ) : (
              <>
                One near-duplicate was deleted. Your other similar frames are unchanged in{' '}
                <strong className="text-stone-200 font-medium">My Work</strong>.
              </>
            )}
          </p>
          {isTags && (
            <p className="text-xs text-stone-400">
              Next: open My Work and use the tag filter, or tap Refresh if labels don&apos;t show yet.
            </p>
          )}
        </div>
        <button type="button" onClick={onDismiss} className="text-stone-500 hover:text-white p-1 shrink-0" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      {onGoToWork && (
        <Button onClick={onGoToWork} fullWidth className="sm:w-auto">
          View in My Work
        </Button>
      )}
    </div>
  );
}

export const MentorTab: React.FC<Props> = ({ mode, onGoToWork }) => {
  const [view, setView] = useState<MentorView>('chat');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitSec, setWaitSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [starters, setStarters] = useState<string[]>(STARTERS_BY_MODE[mode]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Label Photos state
  const [labelItems, setLabelItems] = useState<PendingApproval[]>([]);
  const [labelLoading, setLabelLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanWaitSec, setScanWaitSec] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [organizeFeedback, setOrganizeFeedback] = useState<OrganizeFeedback | null>(null);
  const [previews, setPreviews] = useState<Map<string, EntryPreview>>(new Map());
  const [libraryCount, setLibraryCount] = useState(0);
  const [pendingOrganizeCount, setPendingOrganizeCount] = useState(0);
  const [backlogRunning, setBacklogRunning] = useState(false);
  const [expandedTurnIds, setExpandedTurnIds] = useState<Set<string>>(new Set());

  const chatTurns = useMemo(() => groupMessagesIntoTurns(messages), [messages]);

  // Auto-collapse older exchanges; keep only the latest turn expanded.
  useEffect(() => {
    if (chatTurns.length === 0) {
      setExpandedTurnIds(new Set());
      return;
    }
    setExpandedTurnIds(new Set([chatTurns[chatTurns.length - 1].id]));
  }, [chatTurns.length, chatTurns[chatTurns.length - 1]?.assistant?.id]);

  const toggleTurn = useCallback((turnId: string) => {
    setExpandedTurnIds((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  }, []);

  useEffect(() => {
    setStarters(STARTERS_BY_MODE[mode]);
    // No /api/v1/mentor/suggested-questions route exists on the backend
    // yet — skip the guaranteed-404 call; STARTERS_BY_MODE above is
    // already the fallback this .catch would have landed on anyway.
    if (!FEATURES.mentorSuggestedQuestions) return;
    void fetchMentorSuggestedQuestions(mode)
      .then((res) => {
        if (res.questions.length > 0) setStarters(res.questions);
      })
      .catch(() => {
        /* keep mode defaults */
      });
  }, [mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setWaitSec(0);
      return;
    }
    const tick = window.setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [loading]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    setLastFailedText(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await sendMentorMessage(trimmed, mode, { signal: controller.signal });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
        },
      ]);
    } catch (e) {
      const msg = friendlyErrorMessage(e);
      if (e instanceof Error && e.name === 'AbortError') {
        setError(msg);
      } else {
        setError(msg);
        setLastFailedText(trimmed);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(trimmed);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [loading, mode]);

  const hasSession = Boolean(loadSessionId());
  const stageMessage = mentorLoadingStage(waitSec, mode);

  /* ─────────────────────────────────────────────────────────────────────────
     Label Photos logic
     ───────────────────────────────────────────────────────────────────────── */

  const loadPreviews = useCallback(async () => {
    try {
      const data = await fetchPortfolio({ limit: 100 });
      const map = new Map<string, EntryPreview>();
      for (const e of data.entries) {
        map.set(e.id, {
          id: e.id,
          imageUrl: e.imageUrl,
          sceneDescription: e.sceneDescription,
          overallAverage: e.overallAverage,
        });
      }
      setPreviews(map);
    } catch {
      /* thumbnails are optional */
    }
  }, []);

  const refreshLabelItems = useCallback(async () => {
    // Fires on every MentorTab mount (see the useEffect below), i.e. every
    // time the user navigates back to Mentor — this is the repeated
    // /api/v1/pending-approvals?...agent_name=triage poll. FEATURES.triage
    // is off in this build (no matching backend route), so skip the call
    // rather than firing a guaranteed 404 on every tab visit.
    if (!FEATURES.triage) {
      setLabelItems([]);
      return;
    }
    setLabelLoading(true);
    setLabelError(null);
    try {
      const data = await fetchPendingApprovals();
      setLabelItems(data.items);
    } catch (e) {
      setLabelError(friendlyErrorMessage(e));
    } finally {
      setLabelLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLabelItems();
  }, [refreshLabelItems]);

  useEffect(() => {
    setPendingOrganizeCount(labelItems.length);
  }, [labelItems.length]);

  useEffect(() => {
    if (view === 'label') {
      void loadPreviews();
      void fetchPortfolioStats()
        .then((s) => setLibraryCount(s.total))
        .catch(() => setLibraryCount(0));
    }
  }, [view, loadPreviews]);

  useEffect(() => {
    if (!scanning) {
      setScanWaitSec(0);
      return;
    }
    const tick = window.setInterval(() => setScanWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [scanning]);

  const handleScan = async () => {
    if (mode !== 'hobbyist' && mode !== 'working_pro') return;
    setScanning(true);
    setLabelError(null);
    try {
      const result = await runTriageScan();
      const n = result.clusters?.length ?? 0;
      const created = result.proposalsCreated?.length ?? 0;
      const cleared = (result as { supersededPending?: number }).supersededPending ?? 0;
      setOrganizeFeedback({
        kind: 'scan',
        groups: n,
        proposals: created,
        superseded: cleared,
      });
      setLabelItems(result.pending?.items ?? []);
      void loadPreviews();
    } catch (e) {
      setLabelError(friendlyErrorMessage(e));
    } finally {
      setScanning(false);
    }
  };

  const handleBacklogTriage = async () => {
    setBacklogRunning(true);
    setLabelError(null);
    try {
      const result = await runTriageBacklog(mode);
      setView('chat');
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: 'Run backlog triage on my portfolio.',
        },
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.reply || 'Backlog triage finished — check Organize for pending approvals.',
        },
      ]);
    } catch (e) {
      setLabelError(friendlyErrorMessage(e));
    } finally {
      setBacklogRunning(false);
    }
  };

  const handleDecision = async (id: string, action: 'approve' | 'reject') => {
    const item = labelItems.find((p) => p.id === id);
    setActing(id);
    try {
      await decideApproval(id, action);
      setLabelItems((prev) => prev.filter((p) => p.id !== id));
      if (action === 'approve' && item) {
        if (item.proposedAction.type === 'apply_tags') {
          const payload = item.proposedAction.payload as { tags?: string[]; entryIds?: string[] };
          const ids = payload.entryIds ?? entryIdsForProposal(item);
          setOrganizeFeedback({
            kind: 'approved_tags',
            photoCount: ids.length,
            tags: payload.tags ?? [],
          });
        } else if (item.proposedAction.type === 'delete_entry') {
          setOrganizeFeedback({ kind: 'approved_delete' });
        }
        void loadPreviews();
      } else if (action === 'reject') {
        setOrganizeFeedback({ kind: 'rejected' });
      }
    } catch (e) {
      setLabelError(friendlyErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────────────────── */

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto space-y-6">
      {/* View Toggle */}
      <SegmentedControl
        value={view}
        onChange={(v) => setView(v as MentorView)}
        options={[
          { id: 'chat', label: 'Ask Mentor', icon: <MessageCircle className="w-4 h-4" /> },
          {
            id: 'label',
            label: 'Organize',
            icon: <Layers className="w-4 h-4" />,
            badge: pendingOrganizeCount > 0 ? pendingOrganizeCount : undefined,
          },
        ]}
      />

      {/* Chat View */}
      {view === 'chat' && (
        <div className="flex flex-col min-h-[60vh]">
          <div className="mb-6">
            <h1 className="font-serif text-2xl md:text-3xl text-white">
              Ask me about your progress
            </h1>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              I look across your past critiques and portfolio — tuned for{' '}
              <span className="text-stone-300">
                {mode === 'working_pro' ? 'working pro' : 'hobbyist'}
              </span>{' '}
              goals. Replies can take 30–90 seconds when I dig through your library.
            </p>
          </div>

          <div className="flex-1 flex flex-col rounded-xl border border-warm bg-surface-1 min-h-[400px] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="py-4">
                  <TabEmptyState
                    icon={Sparkles}
                    title="Start a conversation"
                    description="I search your past critiques and portfolio memory — replies can take 30–90 seconds when I dig through your library."
                    steps={[
                      'Upload a few photos in My Work so I have memory to draw on',
                      'Pick a suggested question below, or type your own',
                      'Open Glass Box on any critique to see what I remembered',
                    ]}
                  />
                </div>
              )}
              {chatTurns.length > 1 && (
                <p className="text-[10px] text-muted uppercase tracking-wide px-1">
                  {chatTurns.length - 1} earlier exchange{chatTurns.length - 1 === 1 ? '' : 's'} — tap to
                  expand
                </p>
              )}
              {chatTurns.map((turn, index) => {
                const isLatest = index === chatTurns.length - 1;
                const isPendingLatest = isLatest && loading && !turn.assistant;
                return (
                  <MentorChatTurn
                    key={turn.id}
                    turn={turn}
                    expanded={expandedTurnIds.has(turn.id) || isPendingLatest}
                    onToggle={() => toggleTurn(turn.id)}
                    loading={isPendingLatest}
                    loadingStage={isPendingLatest ? stageMessage : undefined}
                    waitSec={isPendingLatest ? waitSec : 0}
                    onCancel={isPendingLatest ? cancelRequest : undefined}
                    isLatest={isLatest}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>

            {error && (
              <ChatErrorBanner
                message={error}
                onRetry={
                  lastFailedText
                    ? () => {
                        setError(null);
                        void send(lastFailedText);
                      }
                    : undefined
                }
                onDismiss={() => setError(null)}
              />
            )}

            <div className="px-3 py-2 border-t border-warm/80 bg-canvas-elevated/30">
              <Eyebrow className="mb-2">Quick actions</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setView('label')}
                  className="text-xs px-3 py-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20 disabled:opacity-40"
                >
                  Organize library
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void send('What patterns do you see in my recent critiques?')}
                  className="text-xs px-3 py-1.5 rounded-full border border-warm text-stone-300 hover:border-brand-500 hover:text-brand-300 disabled:opacity-40"
                >
                  Review progress
                </button>
                {mode === 'working_pro' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      void send('Which of my recent photos are strongest candidates for print sales?')
                    }
                    className="text-xs px-3 py-1.5 rounded-full border border-warm text-stone-300 hover:border-brand-500 hover:text-brand-300 disabled:opacity-40"
                  >
                    Print candidates
                  </button>
                )}
              </div>
            </div>

            <div className="px-3 py-2 border-t border-warm/80 bg-canvas-elevated/40">
              <Eyebrow className="mb-2">Suggested questions</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => void send(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-warm text-stone-300 hover:border-brand-500 hover:text-brand-300 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <form
              className="p-3 border-t border-warm flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your progress…"
                disabled={loading}
                className="flex-1 rounded-lg bg-canvas-elevated border border-warm px-4 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <IconButton
                type="submit"
                disabled={loading || !input.trim()}
                icon={<Send className="w-5 h-5" />}
                label="Send message"
              />
            </form>
          </div>

          {hasSession && (
            <p className="text-xs text-muted mt-2 text-center">
              Session continues across messages (stored in this browser).
            </p>
          )}
        </div>
      )}

      {/* Organize View */}
      {view === 'label' && (
        <div className="space-y-6">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-extrabold text-white">
              Organize
            </h1>
            <p className="text-brand-400/90 text-sm mt-1">Tag &amp; tidy your library</p>
            <p className="text-muted text-sm mt-3 leading-relaxed">
              I group similar shots, flag near-duplicates, surface hidden gems, and suggest
              searchable tags — you approve every change before it sticks.
            </p>
          </div>

          {/* Visual before/after concept */}
          <div className="rounded-xl border border-warm bg-surface-1 p-4">
            <div className="flex items-center gap-6 text-center">
              <div className="flex-1 space-y-2">
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded bg-surface-3 border border-warm/50"
                      style={{ transform: `rotate(${(i - 2) * 5}deg)` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted">Scattered photos</p>
              </div>
              <div className="text-brand-400 text-lg">→</div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded bg-brand-500/20 border border-brand-500/40 flex items-center justify-center"
                    >
                      <span className="text-[8px] text-brand-400">#</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-brand-400">Tagged &amp; searchable</p>
              </div>
            </div>
          </div>

          <Button
            icon={scanning ? undefined : <Layers className="w-4 h-4" />}
            disabled={scanning || backlogRunning}
            onClick={() => void handleScan()}
            fullWidth
            className="sm:w-auto"
          >
            {scanning ? 'Scanning…' : 'Scan my library'}
          </Button>

          <Button
            variant="secondary"
            icon={backlogRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            disabled={scanning || backlogRunning}
            onClick={() => void handleBacklogTriage()}
            fullWidth
            className="sm:w-auto"
          >
            {backlogRunning ? 'Agent triage…' : 'Backlog triage (agent)'}
          </Button>

          <HitlHistoryPanel agentName="triage" className="mt-4" />

          {scanning && (
            <ScanProgressBanner
              message={triageScanStage(scanWaitSec)}
              waitSec={scanWaitSec}
            />
          )}

          {organizeFeedback && (
            <OrganizeFeedbackBanner
              feedback={organizeFeedback}
              onGoToWork={
                organizeFeedback.kind === 'approved_tags' || organizeFeedback.kind === 'approved_delete'
                  ? onGoToWork
                  : undefined
              }
              onDismiss={() => setOrganizeFeedback(null)}
            />
          )}
          {labelError && (
            <p className="text-sm text-red-400" role="alert">
              {labelError}
            </p>
          )}

          {labelLoading && (
            <p className="text-muted text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> One moment…
            </p>
          )}

          {!labelLoading && labelItems.length === 0 && !organizeFeedback && (
            <div className="rounded-xl border border-dashed border-warm/60 bg-surface-1/50 p-6 text-center space-y-3">
              <Layers className="w-10 h-10 text-muted mx-auto" />
              <div>
                <p className="text-white font-medium">
                  {libraryCount === 0 ? 'Add photos first' : 'Ready to scan'}
                </p>
                <p className="text-sm text-muted mt-1">
                  {libraryCount === 0 ? (
                    <>
                      Upload a few shots on Home or My Work — then come back and I&apos;ll group
                      them, suggest tags, and help you spot duplicates.
                    </>
                  ) : (
                    <>
                      Tap &quot;Scan my library&quot; above. I&apos;ll propose tags and tidy-ups
                      for {libraryCount} photo{libraryCount === 1 ? '' : 's'} — you approve each one.
                    </>
                  )}
                </p>
              </div>
              {libraryCount === 0 && onGoToWork && (
                <Button variant="subtle" size="sm" onClick={onGoToWork}>
                  Upload in My Work →
                </Button>
              )}
            </div>
          )}

          {labelItems.length > 0 && <Eyebrow>Waiting for your decision</Eyebrow>}

          <ul className="space-y-4">
            {labelItems.map((item) => {
              const affectedIds = entryIdsForProposal(item);
              const deleteTarget =
                item.proposedAction.type === 'delete_entry' ? affectedIds[0] : undefined;
              return (
                <li key={item.id}>
                  <Card padding="sm" className="space-y-3">
                    <ProposalThumbnails
                      entryIds={affectedIds}
                      previews={previews}
                      highlightDeleteId={deleteTarget}
                    />
                    <p className="text-sm text-white leading-relaxed">{describeProposal(item)}</p>
                    <HitlReasoningCallout reasoning={item.agentReasoning} />
                    {item.proposedAction.type === 'delete_entry' && (
                      <p className="text-xs text-red-300/80 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Permanent delete if you approve
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        icon={<Check className="w-4 h-4" />}
                        disabled={acting === item.id}
                        onClick={() => void handleDecision(item.id, 'approve')}
                        fullWidth
                      >
                        Yes, do this
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<X className="w-4 h-4" />}
                        disabled={acting === item.id}
                        onClick={() => void handleDecision(item.id, 'reject')}
                        fullWidth
                      >
                        No thanks
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

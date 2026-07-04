/**
 * MentorChat — the reusable message/turn/loading state machine behind
 * "Ask Mentor" (MentorTab) and the photo detail split view
 * (PhotoDetailView). Extracted from MentorTab's chat area verbatim: same
 * AbortController cancel pattern, same wait-timer/loading-stage ticking,
 * same accordion turn state — plus rendering the reply's MemoryReceipt
 * (Task 19) collapsed under the latest assistant turn.
 *
 * Global chat (MentorTab) passes no photoId — sendMentorMessage's photo_id
 * goes over the wire as null and the backend recalls from the whole
 * portfolio. Photo-scoped chat (PhotoDetailView) passes the photo's
 * storageKey, which the backend matches against the scope a critique's
 * memories were written under (see app/mentor.py: photo_id -> scope=).
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Send, Sparkles } from 'lucide-react';
import { ChatErrorBanner } from './ChatErrorBanner';
import { TabEmptyState } from './TabEmptyState';
import { MentorChatTurn } from './MentorChatTurn';
import { MemoryReceipt } from './MemoryReceipt';
import { groupMessagesIntoTurns } from '../lib/mentorChatTurns';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { mentorLoadingStage } from '../lib/mentorLoadingStages';
import { streamMentorMessage, type ChatMessage } from '../services/mentorClient';
import { IconButton } from './primitives';
import type { MemoryReceipt as MemoryReceiptData } from '../types';

export interface MentorChatHandle {
  /** Send a message as if the user typed it — used by suggested-question chips. */
  sendMessage: (text: string) => void;
  /**
   * Append an already-answered turn without a network round trip — MentorTab's
   * "Backlog triage (agent)" action gets its reply from a different endpoint
   * (runTriageBacklog) and just wants it to land in the transcript.
   */
  appendCompletedTurn: (userText: string, assistantText: string) => void;
}

interface Props {
  persona: 'hobbyist' | 'working_pro';
  /** Storage key scoping chat + memory recall to a single photo. Omit for global chat. */
  photoId?: string;
  placeholder?: string;
  /** Shown above the input when there are no messages yet. Omit to use the default copy. */
  emptyStateDescription?: string;
  /** Mirrors the internal loading flag so a parent (e.g. MentorTab's quick-action chips) can disable its own controls while a reply is in flight. */
  onLoadingChange?: (loading: boolean) => void;
  /** Rendered between the error banner and the input form — MentorTab's quick-actions/suggested-questions chip bars slot in here so it keeps its exact original layout. */
  footerSlot?: React.ReactNode;
}

export const MentorChat = forwardRef<MentorChatHandle, Props>(
  (
    {
      persona,
      photoId,
      placeholder = 'Ask about your progress…',
      emptyStateDescription,
      onLoadingChange,
      footerSlot,
    },
    ref,
  ) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [waitSec, setWaitSec] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [lastFailedText, setLastFailedText] = useState<string | null>(null);
    const [expandedTurnIds, setExpandedTurnIds] = useState<Set<string>>(new Set());
    const [latestReceipt, setLatestReceipt] = useState<MemoryReceiptData | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const chatTurns = useMemo(() => groupMessagesIntoTurns(messages), [messages]);

    // Auto-collapse older exchanges; keep only the latest turn expanded.
    useEffect(() => {
      if (chatTurns.length === 0) {
        setExpandedTurnIds(new Set());
        return;
      }
      setExpandedTurnIds(new Set([chatTurns[chatTurns.length - 1].id]));
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

    useEffect(() => {
      onLoadingChange?.(loading);
    }, [loading, onLoadingChange]);

    const cancelRequest = useCallback(() => {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
    }, []);

    const send = useCallback(
      async (text: string) => {
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

        const assistantId = `a-${Date.now()}`;
        let assistantStarted = false;
        let accumulated = '';

        try {
          const res = await streamMentorMessage(trimmed, persona, {
            signal: controller.signal,
            photoId,
            onDelta: (delta) => {
              accumulated += delta;
              if (!assistantStarted) {
                assistantStarted = true;
                setMessages((prev) => [
                  ...prev,
                  { id: assistantId, role: 'assistant', content: accumulated, streaming: true },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
                );
              }
            },
          });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
          );
          setLatestReceipt(res.memoryReceipt ?? null);
        } catch (e) {
          const msg = friendlyErrorMessage(e);
          if (e instanceof Error && e.name === 'AbortError') {
            setError(msg);
          } else {
            setError(msg);
            setLastFailedText(trimmed);
            setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantId));
            setInput(trimmed);
          }
        } finally {
          abortRef.current = null;
          setLoading(false);
        }
      },
      [loading, persona, photoId],
    );

    useImperativeHandle(ref, () => ({
      sendMessage: (text: string) => {
        void send(text);
      },
      appendCompletedTurn: (userText: string, assistantText: string) => {
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: 'user', content: userText },
          { id: `assistant-${Date.now()}`, role: 'assistant', content: assistantText },
        ]);
        // This turn came from a different endpoint (no memoryReceipt to show).
        setLatestReceipt(null);
      },
    }));

    const stageMessage = mentorLoadingStage(waitSec, persona);

    return (
      <div className="flex-1 flex flex-col rounded-xl border border-warm bg-surface-1 min-h-[400px] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-4">
              <TabEmptyState
                icon={Sparkles}
                title="Start a conversation"
                description={
                  emptyStateDescription ??
                  'I search your past critiques and portfolio memory — replies can take 30–90 seconds when I dig through your library.'
                }
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
              {chatTurns.length - 1} earlier exchange{chatTurns.length - 1 === 1 ? '' : 's'} — tap to expand
            </p>
          )}
          {chatTurns.map((turn, index) => {
            const isLatest = index === chatTurns.length - 1;
            const isPendingLatest = isLatest && loading && !turn.assistant;
            return (
              <React.Fragment key={turn.id}>
                <MentorChatTurn
                  turn={turn}
                  expanded={expandedTurnIds.has(turn.id) || isPendingLatest}
                  onToggle={() => toggleTurn(turn.id)}
                  loading={isPendingLatest}
                  loadingStage={isPendingLatest ? stageMessage : undefined}
                  waitSec={isPendingLatest ? waitSec : 0}
                  onCancel={isPendingLatest ? cancelRequest : undefined}
                  isLatest={isLatest}
                />
                {isLatest && turn.assistant && latestReceipt && (
                  <div className="px-1">
                    <MemoryReceipt receipt={latestReceipt} />
                  </div>
                )}
              </React.Fragment>
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

        {footerSlot}

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
            placeholder={placeholder}
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
    );
  },
);

MentorChat.displayName = 'MentorChat';

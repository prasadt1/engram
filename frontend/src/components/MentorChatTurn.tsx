import React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { IrisMark } from './IrisMark';
import { MentorMarkdown } from './MentorMarkdown';
import { VoiceoverButton } from './VoiceoverButton';
import { useThemeMode } from '../lib/ThemeContext';
import { turnPreview, type ChatTurn } from '../lib/mentorChatTurns';

interface Props {
  turn: ChatTurn;
  expanded: boolean;
  onToggle: () => void;
  /** Waiting for Iris reply on this turn */
  loading?: boolean;
  loadingStage?: string;
  waitSec?: number;
  onCancel?: () => void;
  isLatest?: boolean;
}

export const MentorChatTurn: React.FC<Props> = ({
  turn,
  expanded,
  onToggle,
  loading = false,
  loadingStage,
  waitSec = 0,
  onCancel,
  isLatest = false,
}) => {
  const hasReply = Boolean(turn.assistant);
  const canToggle = hasReply || loading;
  const isLight = useThemeMode() === 'light';
  const markColor = isLight ? '#b45309' : '#f5a623';
  const markRim = isLight ? '#b45309' : '#fbbf24';
  const markProps = { size: 22, color: markColor, pupilRim: markRim } as const;

  return (
    <article
      className={`max-w-3xl rounded-xl border overflow-hidden transition-colors ${
        isLatest && expanded
          ? 'border-brand-500/35 bg-surface-1'
          : 'border-warm bg-surface-1/90'
      }`}
    >
      <button
        type="button"
        onClick={canToggle ? onToggle : undefined}
        disabled={!canToggle}
        aria-expanded={expanded}
        className={`w-full text-left p-4 flex gap-3 items-start ${
          canToggle ? 'hover:bg-surface-2/40 cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">You asked</p>
          <p className="text-sm text-stone-200 leading-relaxed line-clamp-2">{turn.user.content}</p>
          {!expanded && hasReply && turn.assistant && (
            <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">
              <span className="text-brand-400/90 font-medium">Iris: </span>
              {turnPreview(turn.assistant.content)}
            </p>
          )}
          {!expanded && loading && (
            <p className="text-xs text-brand-400/90 mt-2 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden />
              Reading your library…
            </p>
          )}
        </div>
        {canToggle && (
          <ChevronDown
            className={`w-5 h-5 text-muted shrink-0 mt-1 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        )}
      </button>

      {expanded && hasReply && turn.assistant && (
        <div className="border-t border-warm/60 px-5 pb-5 pt-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <IrisMark {...markProps} />
              <p className="text-[10px] uppercase tracking-widest text-brand-400">From Iris</p>
            </div>
            <VoiceoverButton
              speechId={`mentor-${turn.id}`}
              text={turn.assistant.content}
              label="Iris reply"
              size="sm"
            />
          </div>
          <div
            className="font-serif text-stone-100 text-sm leading-relaxed"
            aria-label="Iris mentor reply"
          >
            <MentorMarkdown content={turn.assistant.content} />
          </div>
        </div>
      )}

      {expanded && loading && !hasReply && (
        <div
          className="border-t border-warm/60 px-5 pb-5 pt-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-2 mb-3">
            <IrisMark {...markProps} className="animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-brand-400">From Iris</span>
          </div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-serif text-brand-300 animate-pulse text-sm">Reading your library…</span>
            {waitSec >= 8 && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted hover:text-white border border-warm"
              >
                Cancel
              </button>
            )}
          </div>
          {loadingStage && <p className="text-xs text-muted font-sans">{loadingStage}</p>}
          <div className="mt-3 h-1 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-brand-500/80 transition-all duration-1000 ease-out-expo"
              style={{ width: `${Math.min(95, 12 + waitSec * 1.2)}%` }}
            />
          </div>
        </div>
      )}
    </article>
  );
};

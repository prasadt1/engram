import { Square, Volume2 } from 'lucide-react';
import { useSpeech } from '../lib/SpeechContext';

interface Props {
  speechId: string;
  text: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function VoiceoverButton({
  speechId,
  text,
  label = 'Listen',
  className = '',
  size = 'md',
}: Props) {
  const { supported, toggle, isSpeaking } = useSpeech();

  if (!supported || !text.trim()) return null;

  const active = isSpeaking(speechId);
  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnClass =
    size === 'sm'
      ? 'inline-flex items-center gap-1 px-2 py-1 text-[10px]'
      : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(speechId, text);
      }}
      aria-pressed={active}
      aria-label={active ? `Stop reading: ${label}` : `Read aloud: ${label}`}
      className={`rounded-md border border-warm text-muted hover:text-stone-100 hover:bg-surface-2/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 ${btnClass} ${className}`}
    >
      {active ? (
        <>
          <Square className={`${iconClass} shrink-0`} aria-hidden />
          Stop
        </>
      ) : (
        <>
          <Volume2 className={`${iconClass} shrink-0`} aria-hidden />
          Listen
        </>
      )}
    </button>
  );
}

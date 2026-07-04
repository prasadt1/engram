import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { plainTextForSpeech } from './plainTextForSpeech';

interface SpeechContextValue {
  supported: boolean;
  speakingId: string | null;
  speak: (id: string, text: string) => void;
  stop: () => void;
  toggle: (id: string, text: string) => void;
  isSpeaking: (id: string) => boolean;
}

const SpeechContext = createContext<SpeechContextValue | null>(null);

export function SpeechProvider({ children }: { children: React.ReactNode }) {
  const supported =
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported) return;
      const plain = plainTextForSpeech(text);
      if (!plain) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(plain);
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));

      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  const toggle = useCallback(
    (id: string, text: string) => {
      if (speakingId === id) stop();
      else speak(id, text);
    },
    [speakingId, speak, stop],
  );

  useEffect(() => () => stop(), [stop]);

  const value = useMemo(
    () => ({
      supported,
      speakingId,
      speak,
      stop,
      toggle,
      isSpeaking: (id: string) => speakingId === id,
    }),
    [supported, speakingId, speak, stop, toggle],
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech(): SpeechContextValue {
  const ctx = useContext(SpeechContext);
  if (!ctx) {
    throw new Error('useSpeech must be used within SpeechProvider');
  }
  return ctx;
}

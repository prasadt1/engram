/**
 * Mentor Copilot — orchestrator chat API (Phase 2).
 */

import { apiFetch } from '../lib/apiFetch';
import type { MemoryReceipt } from '../types';
const SESSION_KEY = 'engram_mentor_session';
const PERSONA_KEY = 'engram_mentor_persona';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  persona: string;
  sessionId: string;
  userId: string;
  /** Present when the backend built this reply with memory recalled (app/mentor.py's receipt). */
  memoryReceipt?: MemoryReceipt | null;
}

export function loadSessionId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function saveSessionId(sessionId: string): void {
  sessionStorage.setItem(SESSION_KEY, sessionId);
}

/** Drop chat history when persona changes so toolset matches a new session. */
export function clearMentorSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function rememberPersonaForSession(persona: string): void {
  const prev = sessionStorage.getItem(PERSONA_KEY);
  if (prev && prev !== persona) {
    clearMentorSession();
  }
  sessionStorage.setItem(PERSONA_KEY, persona);
}

export async function fetchMentorSuggestedQuestions(
  persona: 'hobbyist' | 'working_pro',
): Promise<{ questions: string[]; source: string }> {
  const res = await apiFetch(`/api/v1/mentor/suggested-questions?persona=${persona}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Suggestions failed (${res.status})`);
  }
  return res.json() as Promise<{ questions: string[]; source: string }>;
}

export async function sendMentorMessage(
  message: string,
  persona: 'hobbyist' | 'working_pro',
  options?: { signal?: AbortSignal; photoId?: string },
): Promise<ChatResponse> {
  rememberPersonaForSession(persona);
  const sessionId = loadSessionId();
  const res = await apiFetch('/api/v1/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId: sessionId ?? undefined,
      persona,
      photo_id: options?.photoId ?? null,
    }),
    signal: options?.signal,
    // Memory recall + a Qwen reasoning-model call; the 45s default (tuned for
    // plain CRUD routes) fires before a healthy reply lands.
    timeoutMs: 90_000,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Chat failed (${res.status})`);
  }
  const data = (await res.json()) as ChatResponse;
  saveSessionId(data.sessionId);
  return data;
}

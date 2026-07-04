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

/** The stream's "done" event carries everything ChatResponse has except
 * `reply` — the full text arrives as onDelta chunks, not as one field. */
export type ChatStreamDone = Omit<ChatResponse, 'reply'>;

function parseSseBlock(block: string): { event: string | null; data: string | null } {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
  }
  return { event, data: dataLines.length ? dataLines.join('\n') : null };
}

/**
 * Streams the reply token-by-token over SSE, calling onDelta as each chunk
 * arrives. Resolves with the same trailing metadata sendMentorMessage
 * returns synchronously (the receipt isn't computed token-by-token — the
 * backend sends it once, in a final "done" event, after the text).
 */
export async function streamMentorMessage(
  message: string,
  persona: 'hobbyist' | 'working_pro',
  options: { signal?: AbortSignal; photoId?: string; onDelta: (delta: string) => void },
): Promise<ChatStreamDone> {
  rememberPersonaForSession(persona);
  const sessionId = loadSessionId();
  const res = await apiFetch('/api/v1/agent/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId: sessionId ?? undefined,
      persona,
      photo_id: options.photoId ?? null,
    }),
    signal: options.signal,
    timeoutMs: 90_000,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Chat failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: ChatStreamDone | null = null;
  let errorDetail: string | null = null;

  try {
    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const { event, data } = parseSseBlock(block);
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === 'error') {
          errorDetail = parsed.detail || 'The mentor had trouble responding.';
        } else if (event === 'done') {
          done = parsed as ChatStreamDone;
        } else if (typeof parsed.delta === 'string') {
          options.onDelta(parsed.delta);
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — the API may be waking up. Try again in a moment.', { cause: err });
    }
    throw err;
  }

  if (errorDetail) throw new Error(errorDetail);
  if (!done) throw new Error('Stream ended unexpectedly.');
  saveSessionId(done.sessionId);
  return done;
}

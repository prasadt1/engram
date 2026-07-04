/**
 * Central API fetch — attaches X-User-Id when Firebase (or explicit) scope is set.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

let scopeUserId: string | null = null;

export function setApiUserScope(userId: string | null): void {
  scopeUserId = userId;
}

export function getApiUserScope(): string | null {
  return scopeUserId;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

const DEFAULT_API_TIMEOUT_MS = 45_000;

export type ApiFetchOptions = RequestInit & {
  /** Override default 45s timeout (e.g. photo analysis on Cloud Run). */
  timeoutMs?: number;
};

export async function apiFetch(path: string, init?: ApiFetchOptions): Promise<Response> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...requestInit } = init ?? {};
  const headers = new Headers(requestInit.headers);
  if (scopeUserId) {
    headers.set('X-User-Id', scopeUserId);
  }

  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeoutMs);

  const callerSignal = requestInit.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      timeoutController.abort();
    } else {
      callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  try {
    return await fetch(apiUrl(path), {
      ...requestInit,
      headers,
      signal: timeoutController.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — the API may be waking up. Try again in a moment.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

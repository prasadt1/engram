/** User-facing API connectivity hints (dev vs production). */

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function apiUnreachableMessage(): string {
  return isLocalDevHost()
    ? "Can't reach the API. In engram/, run: uvicorn app.server:app --reload --port 8000"
    : "Can't reach the server right now. Try again in a moment.";
}

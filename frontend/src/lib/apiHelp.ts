/** User-facing API connectivity hints (dev vs production). */

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function apiUnreachableMessage(): string {
  return isLocalDevHost()
    ? "Can't reach the server. Run make api-dev in a terminal (port 8081), then retry."
    : "Can't reach the server right now. Try again in a moment.";
}

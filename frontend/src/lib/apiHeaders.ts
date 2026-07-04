/** Attach multi-tenant user scope to API calls when Firebase Auth is active. */

export function apiHeaders(userId: string | null): HeadersInit {
  const headers: Record<string, string> = {};
  if (userId) {
    headers['X-User-Id'] = userId;
  }
  return headers;
}

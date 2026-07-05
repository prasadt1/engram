/**
 * User persona (MongoDB users.persona) — Phase 2 orchestrator routing.
 */

import type { UserMode } from '../types/practice';
import { apiFetch } from '../lib/apiFetch';

export interface UserProfile {
  userId: string | null;
  persona: UserMode | 'vision_impairment';
  preferences: Record<string, unknown>;
  /** Optional user-set name — Home greets by it when present. */
  displayName?: string | null;
}

export async function fetchUserProfile(userId?: string | null): Promise<UserProfile> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await apiFetch(`/api/v1/users/me${q}`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<UserProfile>;
}

export async function updatePersona(
  persona: UserMode,
  userId?: string | null,
): Promise<UserProfile> {
  const payload: { persona: UserMode; userId?: string } = { persona };
  if (userId) payload.userId = userId;

  const res = await apiFetch('/api/v1/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<UserProfile>;
}

/** PATCH just the display name — blank clears it. Same route/pattern as
 * updatePersona; the response echoes only the fields the PATCH set. */
export async function updateDisplayName(
  displayName: string,
  userId?: string | null,
): Promise<{ userId: string | null; displayName: string | null }> {
  const payload: { displayName: string; userId?: string } = { displayName };
  if (userId) payload.userId = userId;

  const res = await apiFetch('/api/v1/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<{ userId: string | null; displayName: string | null }>;
}

export function personaToUserMode(persona: string): UserMode {
  return persona === 'working_pro' ? 'working_pro' : 'hobbyist';
}

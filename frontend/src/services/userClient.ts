/**
 * User persona (MongoDB users.persona) — Phase 2 orchestrator routing.
 */

import type { UserMode } from '../types/practice';
import { apiFetch } from '../lib/apiFetch';

export interface UserProfile {
  userId: string | null;
  persona: UserMode | 'vision_impairment';
  preferences: Record<string, unknown>;
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

export function personaToUserMode(persona: string): UserMode {
  return persona === 'working_pro' ? 'working_pro' : 'hobbyist';
}

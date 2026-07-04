/**
 * Journey — the Home page's "since last time" progress surface: one summary
 * sentence, per-skill watching/cleared status, and portfolio-wide stats.
 */

import { apiFetch } from '../lib/apiFetch';

export interface JourneySkill {
  name: string;
  status: 'watching' | 'cleared';
  consecutive: number;
}

export interface JourneyStats {
  total_memories: number;
  live_memories: number;
  superseded_memories: number;
  skills_watching: number;
  skills_cleared: number;
}

export interface JourneyResponse {
  summary: string;
  skills: JourneySkill[];
  stats: JourneyStats;
}

// The summary sentence is one live LLM call server-side (~5-10s), well
// under apiFetch's 45s default but slow enough that it shouldn't hold up
// the rest of the Home dashboard's Promise.all if the model is ever slow
// to respond — callers already treat this fetch as best-effort
// (`.catch(() => null)`), so failing faster here just means the Journey
// section quietly doesn't render rather than delaying everything else on
// the page.
const JOURNEY_TIMEOUT_MS = 15_000;

export async function fetchJourney(): Promise<JourneyResponse> {
  const res = await apiFetch('/api/v1/journey', { timeoutMs: JOURNEY_TIMEOUT_MS });
  if (!res.ok) throw new Error(`Journey failed (${res.status})`);
  return res.json() as Promise<JourneyResponse>;
}

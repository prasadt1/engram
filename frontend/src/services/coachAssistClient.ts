import { apiFetch } from '../lib/apiFetch';
import type { CoachAssistRoster } from '../types/coachAssist';

export async function fetchCoachAssistRoster(): Promise<CoachAssistRoster> {
  const res = await apiFetch('/api/v1/coach-assist/roster');
  if (!res.ok) {
    throw new Error(`Coach Assist roster failed (${res.status})`);
  }
  return res.json() as Promise<CoachAssistRoster>;
}

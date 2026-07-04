import type { PendingApproval, TriageScanResult } from '../types/triage';

import { apiUnreachableMessage } from '../lib/apiHelp';
import { apiFetch } from '../lib/apiFetch';

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 502 || res.status === 503) {
      throw new Error(apiUnreachableMessage());
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPendingApprovals(agentName = 'triage'): Promise<{
  items: PendingApproval[];
  total: number;
}> {
  const q = new URLSearchParams({ status: 'pending', agent_name: agentName });
  return apiFetch(`/api/v1/pending-approvals?${q}`).then(
    parseJson<{ items: PendingApproval[]; total: number }>,
  );
}

export function runTriageScan(): Promise<TriageScanResult> {
  return apiFetch('/api/v1/triage/scan', { method: 'POST' }).then(parseJson<TriageScanResult>);
}

export function fetchHitlHistory(agentName?: string, limit = 50): Promise<{
  items: PendingApproval[];
  total: number;
}> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (agentName) q.set('agent_name', agentName);
  return apiFetch(`/api/v1/pending-approvals/history?${q}`).then(
    parseJson<{ items: PendingApproval[]; total: number }>,
  );
}

export function runTriageBacklog(persona: 'hobbyist' | 'working_pro' = 'hobbyist'): Promise<{
  reply: string;
  sessionId: string;
  intent: string;
}> {
  const q = new URLSearchParams({ persona });
  return apiFetch(`/api/v1/triage/backlog?${q}`, { method: 'POST' }).then(
    parseJson<{ reply: string; sessionId: string; intent: string }>,
  );
}

export function decideApproval(
  id: string,
  action: 'approve' | 'reject',
): Promise<PendingApproval> {
  return apiFetch(`/api/v1/pending-approvals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }).then(parseJson<PendingApproval>);
}

import type {
  Assignment,
  AssignmentsResponse,
  CompleteAssignmentResponse,
  UserMode,
} from '../types/practice';
import { apiFetch } from '../lib/apiFetch';

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchAssignments(): Promise<AssignmentsResponse> {
  return apiFetch('/api/v1/assignments').then(parseJson<AssignmentsResponse>);
}

export function fetchAssignment(id: string): Promise<Assignment> {
  return apiFetch(`/api/v1/assignments/${id}`).then(parseJson<Assignment>);
}

export function proposeAssignment(mode: UserMode, focusSkill?: string): Promise<Assignment> {
  const params = new URLSearchParams({ mode });
  if (focusSkill) {
    params.set('focus_skill', focusSkill);
  }
  return apiFetch(`/api/v1/assignments/propose?${params}`, {
    method: 'POST',
  }).then(parseJson<Assignment>);
}

export function acceptAssignment(id: string): Promise<Assignment> {
  return apiFetch(`/api/v1/assignments/${id}/accept`, { method: 'POST' }).then(
    parseJson<Assignment>,
  );
}

export function declineAssignment(id: string): Promise<Assignment> {
  return apiFetch(`/api/v1/assignments/${id}/decline`, { method: 'POST' }).then(
    parseJson<Assignment>,
  );
}

export async function fetchActiveAssignment(): Promise<Assignment | null> {
  const res = await apiFetch('/api/v1/assignments/active').then(parseJson<{
    active: Assignment | null;
  }>);
  return res.active;
}

export function completeAssignment(id: string): Promise<CompleteAssignmentResponse> {
  return apiFetch(`/api/v1/assignments/${id}/complete`, { method: 'POST' }).then(
    parseJson<CompleteAssignmentResponse>,
  );
}

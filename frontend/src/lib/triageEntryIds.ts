import type { PendingApproval } from '../types/triage';

/** Entry IDs affected by a pending triage card (tags batch or single delete). */
export function entryIdsForProposal(item: PendingApproval): string[] {
  const payload = item.proposedAction.payload;
  if (item.proposedAction.type === 'apply_tags') {
    const ids = payload.entryIds;
    return Array.isArray(ids) ? (ids as string[]) : [];
  }
  if (item.proposedAction.type === 'delete_entry') {
    const id =
      (typeof payload.entryId === 'string' ? payload.entryId : null) ||
      item.proposedAction.targetId;
    return id ? [id] : [];
  }
  return [];
}

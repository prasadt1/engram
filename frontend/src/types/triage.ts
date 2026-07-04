export type ApprovalStatus = 'pending' | 'approved' | 'modified' | 'rejected';

export interface ProposedAction {
  type: string;
  targetId: string;
  payload: Record<string, unknown>;
}

export interface PendingApproval {
  id: string;
  agentName: string;
  proposedAction: ProposedAction;
  agentReasoning: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string | null;
  userDecision?: {
    action: string;
    decided_at?: string;
  } | null;
}

export interface TriageScanResult {
  clusters: Array<{ label: string; entryIds: string[]; count: number }>;
  duplicateCandidates: Array<{ shootId: string; entryIds: string[] }>;
  untaggedGems: Array<{ id: string; averageScore: number }>;
  proposalsCreated: Array<{ pendingApprovalId: string; status: string }>;
  pending: { items: PendingApproval[]; total: number };
}

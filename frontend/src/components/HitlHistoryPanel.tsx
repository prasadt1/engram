/**
 * HITL activity history — decided approvals (B1).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { History, Loader2 } from 'lucide-react';
import { fetchHitlHistory } from '../services/triageClient';
import { friendlyErrorMessage } from '../lib/friendlyError';
import type { PendingApproval } from '../types/triage';

const STATUS_STYLE: Record<string, string> = {
  approved: 'text-brand-400 bg-brand-500/15 border-brand-500/30',
  rejected: 'text-stone-400 bg-surface-2 border-warm',
  modified: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

function actionLabel(item: PendingApproval): string {
  const t = item.proposedAction.type;
  if (t === 'delete_entry') return 'Delete photo';
  if (t === 'apply_tags') return 'Apply tags';
  if (t === 'list_on_marketplace') return 'List for sale';
  return t.replace(/_/g, ' ');
}

interface Props {
  agentName?: string;
  className?: string;
}

export const HitlHistoryPanel: React.FC<Props> = ({ agentName, className = '' }) => {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHitlHistory(agentName);
      setItems(data.items);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={`rounded-xl border border-warm bg-surface-1 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-brand-400" aria-hidden />
        <h2 className="text-sm font-semibold text-white">Approval history</h2>
      </div>
      <p className="text-xs text-muted leading-relaxed">
        Past organize and print suggestions you approved, rejected, or modified.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted py-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Loading…
        </div>
      )}
      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-muted">No decided approvals yet.</p>
      )}
      {!loading && items.length > 0 && (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {items.map((item) => {
            let when = '';
            try {
              when = item.decidedAt
                ? formatDistanceToNow(new Date(item.decidedAt), { addSuffix: true })
                : item.userDecision?.decided_at
                  ? formatDistanceToNow(new Date(item.userDecision.decided_at), { addSuffix: true })
                  : '';
            } catch {
              when = '';
            }
            const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.rejected;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-warm/60 bg-canvas-elevated/40 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-stone-200">{actionLabel(item)}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${style}`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.agentReasoning && (
                  <p className="text-muted mt-1 line-clamp-2 leading-relaxed">{item.agentReasoning}</p>
                )}
                {when && <p className="text-[10px] text-muted mt-1">{when}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

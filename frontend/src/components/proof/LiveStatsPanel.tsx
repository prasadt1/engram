/**
 * Live MongoDB stats — visual bar + optional MCP round trip.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Loader2, Sparkles, Zap } from 'lucide-react';
import { Card, Eyebrow, Tag } from '../primitives';
import { useCountUp } from '../../hooks/useCountUp';
import { apiFetch } from '../../lib/apiFetch';
import { JUDGE_GUIDE_URL } from './proofData';

interface MemoryStats {
  total_memories: number;
  live_memories: number;
  superseded_memories: number;
  skills_watching: number;
  skills_cleared: number;
  served_via?: string;
}

const MCP_TIMEOUT_MS = 20_000;

async function fetchMemoryStats(viaMcp: boolean): Promise<MemoryStats> {
  const path = viaMcp ? '/api/v1/memory-stats?via=mcp' : '/api/v1/memory-stats';
  const res = await apiFetch(path, { timeoutMs: viaMcp ? MCP_TIMEOUT_MS : undefined });
  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string' && body.detail.length > 0) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<MemoryStats>;
}

const MCP_TOOLS = [
  { name: 'recall', summary: 'Salience-ranked memories — superseded excluded.' },
  { name: 'forget', summary: 'Skill graduation check.' },
  { name: 'get_memory_stats', summary: 'These live counts.' },
] as const;

function MemoryBar({ live, superseded }: { live: number; superseded: number }) {
  const total = Math.max(live + superseded, 1);
  const livePct = (live / total) * 100;
  const supPct = (superseded / total) * 100;
  return (
    <div className="space-y-2">
      <div className="flex h-8 rounded-lg overflow-hidden border border-warm/60 bg-surface-2">
        <div
          className="bg-emerald-500/70 transition-all duration-700 ease-out flex items-center justify-center text-[10px] font-bold text-white/90"
          style={{ width: `${livePct}%` }}
          title={`${live} live`}
        >
          {livePct > 18 ? `${live} live` : ''}
        </div>
        <div
          className="bg-stone-600/80 transition-all duration-700 ease-out flex items-center justify-center text-[10px] font-bold text-stone-200"
          style={{ width: `${supPct}%` }}
          title={`${superseded} superseded`}
        >
          {supPct > 18 ? `${superseded} retired` : ''}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-stone-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500/70" aria-hidden /> Live facts in advice
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-stone-600" aria-hidden /> Superseded (audit trail)
        </span>
      </div>
    </div>
  );
}

function AnimatedStat({ label, value, enabled }: { label: string; value: number; enabled: boolean }) {
  const animated = useCountUp(value, 800, enabled);
  return (
    <div className="text-center p-3 rounded-lg bg-surface-2/60 border border-warm/50">
      <p className="text-2xl font-serif font-bold text-white tabular-nums">{Math.round(animated)}</p>
      <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">{label}</p>
    </div>
  );
}

export const LiveStatsPanel: React.FC = () => {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viaMcp, setViaMcp] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);

  const load = useCallback((useMcp: boolean) => {
    setRefreshing(true);
    setError(null);
    fetchMemoryStats(useMcp)
      .then((next) => {
        setStats(next);
        setRefreshing(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const ready = stats != null;

  return (
    <Card padding="md" className="scroll-mt-6 space-y-4" id="proof-live">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Step 2 · Live demo library</Eyebrow>
            <Tag variant="outline">MongoDB · demo-user</Tag>
          </div>
          <p className="mt-1 text-sm text-stone-400 max-w-lg">
            Production memory for the photographer you&apos;ve been browsing — fetched just now.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !viaMcp;
            setViaMcp(next);
            load(next);
          }}
          disabled={refreshing}
          aria-pressed={viaMcp}
          title="Round-trip the same counts through engram-mcp"
          className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-md border transition-colors disabled:opacity-50 shrink-0 ${
            viaMcp
              ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
              : 'bg-surface-2 border-warm text-stone-300 hover:text-white'
          }`}
        >
          {refreshing && viaMcp ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Zap className="w-3.5 h-3.5" aria-hidden />
          )}
          MCP path
        </button>
      </div>

      {!stats && refreshing && (
        <div className="h-24 rounded-lg bg-surface-2 animate-pulse" aria-busy="true" />
      )}

      {error && (
        <p className="text-xs text-rose-300/90 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
          {error}
        </p>
      )}

      {stats && (
        <>
          <MemoryBar live={stats.live_memories} superseded={stats.superseded_memories} />
          <div className={`grid grid-cols-3 sm:grid-cols-5 gap-2 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            <AnimatedStat label="Total" value={stats.total_memories} enabled={ready && !refreshing} />
            <AnimatedStat label="Live" value={stats.live_memories} enabled={ready && !refreshing} />
            <AnimatedStat label="Retired" value={stats.superseded_memories} enabled={ready && !refreshing} />
            <AnimatedStat label="Watching" value={stats.skills_watching} enabled={ready && !refreshing} />
            <AnimatedStat label="Cleared" value={stats.skills_cleared} enabled={ready && !refreshing} />
          </div>
        </>
      )}

      {stats?.served_via && (
        <Tag variant="brand" icon={<Sparkles className="w-3 h-3" aria-hidden />}>
          MCP round trip confirmed
        </Tag>
      )}

      <button
        type="button"
        onClick={() => setMcpOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left text-xs text-stone-500 hover:text-stone-300 py-1"
        aria-expanded={mcpOpen}
      >
        <span>What is engram-mcp?</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${mcpOpen ? 'rotate-180' : ''}`} />
      </button>
      {mcpOpen && (
        <ul className="text-[11px] text-stone-400 space-y-1 list-none">
          {MCP_TOOLS.map((t) => (
            <li key={t.name}>
              <code className="text-brand-400/90">{t.name}</code> — {t.summary}
            </li>
          ))}
          <li className="pt-1">
            <a href={JUDGE_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
              Full MCP + methodology write-up →
            </a>
          </li>
        </ul>
      )}
    </Card>
  );
};

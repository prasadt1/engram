/**
 * GlassBoxTab — the judge-facing surface for Engram's memory internals and
 * the benchmark that measures them. Reached from the sidebar's "Proof" nav
 * group and the footer link (both drive App.tsx's `#glassbox` route); not
 * an AppTab: this is a reference page for evaluators, not a feature a
 * photographer needs day to day.
 *
 * Three things happen here, in order:
 *  1. A live fetch of /api/v1/memory-stats — the same numbers Home's
 *     Journey section shows, scoped by whatever X-User-Id is active (judge
 *     mode → the seeded demo-user). A toggle re-fetches with ?via=mcp,
 *     which round-trips the same call through the real engram-mcp stdio
 *     subprocess (scripts/run_mcp_server.py) instead of the in-process
 *     store — a live demonstration that the app actually speaks MCP, not
 *     just a diagram claiming it does.
 *  2. The committed benchmark JSONs (eval/results-default.json,
 *     eval/results-no-forgetting.json), imported directly rather than
 *     fetched — see the note below on why they're copied into src/data.
 *  3. Honesty footnotes pulled from eval/README.md's disclosures, so a
 *     judge doesn't have to leave the app to find the caveats.
 *
 * JSON-import note: tsconfig.app.json's `include` is `["src"]` and neither
 * tsconfig sets `resolveJsonModule`, so importing eval/*.json directly from
 * outside src/ fails the `tsc -b` build gate (both "outside rootDir" and
 * "cannot find module" — no declaration for .json without the compiler
 * flag). Per this task's own instruction, the two JSONs are copied into
 * frontend/src/data/ instead of imported cross-root. They are duplicates of
 * the canonical eval/ copies, not a second source of truth — Task 32's docs
 * link the canonical eval/ files, and both are committed from the same
 * `python -m eval.run` output so they never drift silently (a future CI
 * step could diff them; not added here).
 */

import React, { useCallback, useState } from 'react';
import { ChevronDown, Loader2, Sparkles, Zap } from 'lucide-react';
import { Card, Eyebrow, StatCard, Tag } from './primitives';
import { apiFetch } from '../lib/apiFetch';
import resultsDefault from '../data/results-default.json';
import resultsNoForgetting from '../data/results-no-forgetting.json';

// ---------------------------------------------------------------------------
// Benchmark JSON shape (mirrors eval/fama.py's FAMAResult + eval/run.py's
// per-trace record — see eval/README.md for the authored disclosures below).
// ---------------------------------------------------------------------------

interface EvalFama {
  mpa: number;
  faa: number;
  lambda: number;
  fama: number;
}

interface EvalTraceResult {
  user_id: string;
  recall_current_hits: string;
  recall_absent_ok: string;
  fama: EvalFama;
  engine_tokens: number;
  baseline_tokens: number;
  token_savings_ratio: number;
  recalled_contents: string[];
}

interface EvalSummary {
  trace_count: number;
  ablation: string;
  mean_fama: number;
  mean_token_savings_ratio: number;
  note: string;
}

interface EvalResults {
  summary: EvalSummary;
  results: EvalTraceResult[];
}

const defaultResults = resultsDefault as EvalResults;
const noForgettingResults = resultsNoForgetting as EvalResults;

/** Index no-forgetting rows by trace id for the side-by-side table — the
 * two JSONs share the same 26 trace ids (frozen set, see eval/README.md's
 * "Trace-set freeze declaration") but this doesn't assume matching order. */
const noForgettingByTrace = new Map(noForgettingResults.results.map((r) => [r.user_id, r]));

const WORKED_TRACE_ID = 'trace_1';
const workedDefault = defaultResults.results.find((r) => r.user_id === WORKED_TRACE_ID) ?? null;
const workedNoForgetting = noForgettingByTrace.get(WORKED_TRACE_ID) ?? null;

/** How many answers the no-forgetting ablation contaminated with a stale
 * fact — every trace whose FAMA dropped below 1.0 did so because a
 * superseded fact leaked back into recall (MPA is 1.0 across the board in
 * both configs; only the forgetting term FAA can pull the score down).
 * Computed from the committed JSON rather than hardcoded so the summary
 * copy can never drift from the data it describes. */
const LEAKED_ANSWER_COUNT = noForgettingResults.results.filter((r) => r.fama.fama < 1).length;

function traceForgotMatter(defaultFama: number, ablated: EvalTraceResult | undefined): boolean {
  if (!ablated) return false;
  return ablated.fama.fama < defaultFama - 1e-6;
}

const DIVERGED_TRACE_COUNT = defaultResults.results.filter((row) =>
  traceForgotMatter(row.fama.fama, noForgettingByTrace.get(row.user_id)),
).length;

/**
 * Human labels for the frozen trace ids, authored from eval/traces.py (the
 * frozen answer key — see eval/README.md's freeze declaration). Each label
 * describes what that scripted photographer history actually contains: the
 * fact that got replaced and what replaced it, or "nothing outdated" for
 * the traces where no fact is ever superseded (λ=0, so both configs tie at
 * 1.00 by construction). If a trace is ever edited under the post-freeze
 * change policy, update its label here to match. The raw id stays visible
 * (muted) in the table for provenance back to the committed eval files.
 */
const TRACE_LABELS: Record<string, string> = {
  trace_1: 'Gear switch — Canon body, then Sony mirrorless',
  trace_2: 'Landscape horizons — tilted, then consistently level',
  trace_3: 'Portrait goals — two live preferences, nothing outdated (control)',
  trace_adversarial_1: 'Landscape timing — midday, then golden hour one session later',
  trace_adversarial_2: 'Portrait lighting — window light, then studio strobes one session later',
  trace_adversarial_3: 'Wildlife rig — handheld, then tripod + gimbal one session later',
  trace_adversarial_4: 'Street edits — color, then black-and-white one session later',
  trace_adversarial_5: 'Still-life lighting — window, then softbox one session later',
  trace_adversarial_6: 'Architecture lens — wide-angle, then tilt-shift one session later',
  trace_4: 'Bright skies — blown out, then graduated ND filters',
  trace_5: 'Portrait catchlights — missing, then fixed with a reflector',
  trace_6: 'Still-life backgrounds — cluttered, then negative space',
  trace_7: 'Still-life goal: learn focus stacking — nothing outdated (control)',
  trace_8: 'Street nerves — hesitant, then confident with zone focusing',
  trace_9: "Mentor's strongest-genre verdict — nothing outdated (control)",
  trace_10: 'Wildlife autofocus — hunting, then back-button AF-C',
  trace_11: 'Wildlife ethics rule — nothing outdated (control)',
  trace_12: 'Architecture verticals — crooked, then corrected in post',
  trace_13: 'Architecture signature: symmetry — nothing outdated (control)',
  trace_chain_1: 'Color grade replaced twice — orange-teal, moody, then natural',
  trace_chain_2: 'Editing software replaced twice — Lightroom, Capture One, then a hybrid',
  trace_chain_3: 'Shooting habit replaced twice — weekends, midweek added, then daily',
  trace_multihop_1: 'Multi-part question: which weaknesses cleared this month',
  trace_multihop_2: 'Multi-part question: strongest genre vs the rest — nothing outdated',
  trace_multihop_3: 'Multi-part question: progress across three genres — nothing outdated',
  trace_multihop_4: 'Multi-part question: recent gear changes — nothing outdated (control)',
};

// ---------------------------------------------------------------------------
// Live memory stats (same shape as services/journeyClient.ts's JourneyStats,
// plus the optional served_via provenance stamp the ?via=mcp path adds).
// ---------------------------------------------------------------------------

interface MemoryStats {
  total_memories: number;
  live_memories: number;
  superseded_memories: number;
  skills_watching: number;
  skills_cleared: number;
  served_via?: string;
}

type StatsState =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: MemoryStats }
  | { kind: 'error'; message: string };

const MCP_TIMEOUT_MS = 20_000; // server-side bound is 15s; leave headroom for the round trip itself.

async function fetchMemoryStats(viaMcp: boolean): Promise<MemoryStats> {
  const path = viaMcp ? '/api/v1/memory-stats?via=mcp' : '/api/v1/memory-stats';
  const res = await apiFetch(path, { timeoutMs: viaMcp ? MCP_TIMEOUT_MS : undefined });
  if (!res.ok) {
    // The 503 from the bounded-timeout MCP path carries a friendly `detail`
    // string in its JSON body (see app/server.py's memory_stats route) —
    // surface that verbatim rather than a generic "request failed", since
    // the whole point of this route is to be a truthful, non-alarming
    // failure when the subprocess path is briefly unavailable.
    let detail = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string' && body.detail.length > 0) detail = body.detail;
    } catch {
      /* body wasn't JSON — keep the generic status message */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<MemoryStats>;
}

const STAT_FIELDS: { key: keyof Omit<MemoryStats, 'served_via'>; label: string }[] = [
  { key: 'total_memories', label: 'Total memories' },
  { key: 'live_memories', label: 'Live' },
  { key: 'superseded_memories', label: 'Superseded' },
  { key: 'skills_watching', label: 'Skills watching' },
  { key: 'skills_cleared', label: 'Skills cleared' },
];

/** Plain-language gloss for judges — mirrors app/engram_mcp.py tool names. */
const MCP_TOOLS: ReadonlyArray<{ name: string; summary: string }> = [
  {
    name: 'recall',
    summary: 'Fetch salience-ranked memories for a question — superseded facts stay out of advice.',
  },
  {
    name: 'consolidate',
    summary: 'List episodic memories ready to merge into durable semantic memory.',
  },
  {
    name: 'forget',
    summary: 'Check whether a coached skill graduated (its coaching memories retired).',
  },
  {
    name: 'get_memory_stats',
    summary: 'Live counts for a user — the same numbers this card shows when the toggle is on.',
  },
];

const McpToolsExplainer: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-warm/80 bg-surface-1/60 p-3 space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 rounded-md"
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-semibold text-stone-200">What is engram-mcp?</p>
          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
            Model Context Protocol — a standard way for any Qwen agent to mount Engram&apos;s memory
            engine as tools, not a private REST API only this web app can call.
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-stone-500 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="text-[11px] text-stone-400 space-y-1.5 pl-0.5 list-none">
          {MCP_TOOLS.map((tool) => (
            <li key={tool.name} className="flex gap-2 leading-relaxed">
              <code className="shrink-0 font-mono text-[10px] text-brand-400/90 bg-brand-500/10 px-1.5 py-0.5 rounded">
                {tool.name}
              </code>
              <span>{tool.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LiveMemoryStats: React.FC = () => {
  const [state, setState] = useState<StatsState>({ kind: 'loading' });
  const [viaMcp, setViaMcp] = useState(false);

  const load = useCallback((useMcp: boolean) => {
    setState({ kind: 'loading' });
    fetchMemoryStats(useMcp)
      .then((stats) => setState({ kind: 'ready', stats }))
      .catch((err: unknown) => {
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
      });
  }, []);

  // Fetch once on mount, in-process (fast path) — the MCP round trip is
  // opt-in via the toggle below, not the default load, since it costs ~8s.
  React.useEffect(() => {
    load(false);
  }, [load]);

  const handleToggle = () => {
    const next = !viaMcp;
    setViaMcp(next);
    load(next);
  };

  const loading = state.kind === 'loading';

  return (
    <Card padding="md" className="space-y-4 scroll-mt-6" id="proof-live">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Live demo library</Eyebrow>
            <Tag variant="outline">Step 2</Tag>
          </div>
          <p className="mt-1 text-xs text-muted max-w-lg">
            Production data for the user you&apos;re viewing (seeded demo photographer in judge mode) —
            fetched live from MongoDB, not from the benchmark below. &ldquo;Superseded&rdquo; counts facts
            the engine retired when something newer replaced them; they stay in the audit trail but never
            re-surface in advice.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          aria-pressed={viaMcp}
          title="Re-fetch these counts through the live engram-mcp subprocess instead of the in-process API"
          className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
            viaMcp
              ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
              : 'bg-surface-2 border-warm text-stone-300 hover:text-white'
          }`}
        >
          {loading && viaMcp ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Zap className="w-3.5 h-3.5" aria-hidden />
          )}
          Serve via engram-mcp
        </button>
      </div>

      <McpToolsExplainer />

      {loading && viaMcp && (
        <p className="text-xs text-muted italic flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden />
          Spawning the MCP server subprocess and speaking the protocol for real — typically ~8s.
        </p>
      )}

      {state.kind === 'error' && (
        <div className="rounded-lg border border-warm bg-surface-2 p-3 text-xs text-stone-300" role="status">
          {state.message}
        </div>
      )}

      {state.kind !== 'error' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {STAT_FIELDS.map(({ key, label }) => (
              <StatCard
                key={key}
                label={label}
                value={state.kind === 'ready' ? state.stats[key] : loading ? '—' : 0}
              />
            ))}
          </div>
          <p className="text-xs text-muted">
            &ldquo;Skills watching / cleared&rdquo; are weaknesses the mentor is tracking in this
            photographer&apos;s work versus ones they&apos;ve since proven fixed (three above-bar
            sessions in a row).
          </p>
        </>
      )}

      {state.kind === 'ready' && state.stats.served_via && (
        <div className="space-y-1">
          <Tag variant="brand" icon={<Sparkles className="w-3 h-3" aria-hidden />}>
            Live MCP round trip confirmed
          </Tag>
          <p className="text-[10px] font-mono text-stone-500">
            served_via: {state.stats.served_via}
          </p>
        </div>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Benchmark section
// ---------------------------------------------------------------------------

function formatRatio(n: number): string {
  return `${n}×`;
}

const BenchmarkSummaryStrip: React.FC = () => {
  const { mean_fama: meanFama, trace_count: traceCount } = defaultResults.summary;
  const { mean_fama: meanFamaAblated, mean_token_savings_ratio: tokenSavings } = noForgettingResults.summary;
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-400 leading-relaxed">
        Same engine, two settings.{' '}
        <span className="text-stone-200 font-medium">With forgetting</span> is Engram as shipped;{' '}
        <span className="text-stone-200 font-medium">never forgets</span> is the same engine forced to
        keep every outdated fact in play. Recall of current facts was identical in both — but the
        never-forgets run let a stale fact back into {LEAKED_ANSWER_COUNT} of its {traceCount} answers.
      </p>
      <p className="text-sm text-stone-300 leading-relaxed">
        Mean FAMA <span className="font-serif text-white font-semibold">{meanFama.toFixed(2)}</span> (with
        forgetting) vs <span className="font-serif text-white font-semibold">{meanFamaAblated.toFixed(2)}</span>{' '}
        (never forgets) · {formatRatio(defaultResults.summary.mean_token_savings_ratio)} fewer context tokens ·
        recall accuracy identical in both configs
        <span className="sr-only"> (no-forgetting ablation token-savings ratio: {formatRatio(tokenSavings)})</span>
      </p>
    </div>
  );
};

const BenchmarkTable: React.FC = () => {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted leading-relaxed">
        Each row is one scripted photographer history.{' '}
        <span className="text-stone-300">
          {DIVERGED_TRACE_COUNT} highlighted rows
        </span>{' '}
        are where the two FAMA columns split — the never-forgets run surfaced a stale fact Engram
        correctly left out. Higher is better; 1.00 is perfect. Control rows with nothing outdated tie
        at 1.00 in both columns.
      </p>
      <div className="rounded-lg border border-warm overflow-hidden">
        <div className="max-h-80 overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2 text-muted uppercase tracking-wide text-[10px]">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Scenario</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                  FAMA · with forgetting
                </th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                  FAMA · never forgets
                </th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Token savings</th>
              </tr>
            </thead>
            <tbody>
              {defaultResults.results.map((row) => {
                const ablated = noForgettingByTrace.get(row.user_id);
                const label = TRACE_LABELS[row.user_id];
                const diverged = traceForgotMatter(row.fama.fama, ablated);
                return (
                  <tr
                    key={row.user_id}
                    className={`border-t border-warm/50 ${
                      diverged
                        ? 'bg-brand-500/10 border-l-2 border-l-brand-400/70'
                        : 'odd:bg-surface-1 even:bg-transparent'
                    }`}
                  >
                    <td className="px-3 py-1.5 min-w-[16rem]">
                      <span className="text-stone-300">{label ?? row.user_id}</span>
                      {label && (
                        <span className="ml-1.5 font-mono text-[10px] text-stone-500 whitespace-nowrap">
                          ({row.user_id})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-white tabular-nums">{row.fama.fama.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-stone-400 tabular-nums">
                      {ablated ? ablated.fama.fama.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-brand-400 tabular-nums">
                      {formatRatio(row.token_savings_ratio)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const WorkedExample: React.FC = () => {
  if (!workedDefault || !workedNoForgetting) return null;
  return (
    <div
      id="proof-start"
      className="rounded-xl border border-brand-500/40 bg-brand-500/5 p-4 md:p-5 space-y-4 scroll-mt-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow tone="brand">Start here</Eyebrow>
        <Tag variant="brand">Step 1 · Eval harness</Tag>
        <Tag variant="outline">Not demo-user uploads</Tag>
      </div>

      <div className="rounded-lg border border-warm/70 bg-surface-1/40 p-3 space-y-2 text-xs text-stone-400 leading-relaxed">
        <p>
          <span className="text-stone-200 font-medium">What this is:</span> frozen scenario{' '}
          <code className="font-mono text-[10px] text-brand-400/90">{WORKED_TRACE_ID}</code> from{' '}
          <a
            href="https://github.com/prasadt1/engram/blob/main/eval/traces.py"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 hover:underline"
          >
            eval/traces.py
          </a>
          . We script memory facts (no photos), run the same <code className="font-mono">recall()</code>{' '}
          engine the coach uses, and compare two engine settings. The recall lines below are{' '}
          <span className="text-stone-300">committed JSON output</span> from{' '}
          <code className="font-mono text-[10px]">python -m eval.run --compare</code> — not copy I
          typed for this page.
        </p>
        <p>
          <span className="text-stone-200 font-medium">Story in the harness:</span> sessions 1–2 store
          &ldquo;shoots primarily with a Canon body.&rdquo; In session 3 the photographer switches to Sony;
          the Canon fact is <span className="text-stone-300">superseded</span> (retired in the audit trail,
          excluded from default recall). Then we ask one question.
        </p>
        <p className="text-stone-500">
          Step 2 below is different — that&apos;s live MongoDB for the demo photographer you&apos;ve been
          clicking through in the app.
        </p>
      </div>

      <p className="font-serif text-base text-white">Q: What camera gear do I use?</p>
      <div className="space-y-2 text-sm">
        <p className="text-stone-300">
          <span className="font-semibold text-stone-200">Never forgets ablation — recalls:</span>{' '}
          {workedNoForgetting.recalled_contents.join('; ')} — the retired Canon fact rides along.
        </p>
        <p className="text-stone-300">
          <span className="font-semibold text-brand-400">With forgetting (as shipped) — recalls:</span>{' '}
          {workedDefault.recalled_contents.join('; ')} — current gear only.
        </p>
      </div>
      <p className="text-xs text-muted italic border-t border-warm/50 pt-2">
        Why the split: default <code className="font-mono not-italic">recall()</code> skips items with a
        live <code className="font-mono not-italic">superseded_by</code> link; the no-forgetting ablation
        calls <code className="font-mono not-italic">recall(..., include_archived=True)</code>. Same
        engine, one flag — see{' '}
        <a
          href="https://github.com/prasadt1/engram/blob/main/eval/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:text-brand-300 hover:underline"
        >
          eval/README.md
        </a>{' '}
        for the full 26-trace table.
      </p>
    </div>
  );
};

const PROOF_GUIDE_STEPS: ReadonlyArray<{ n: number; label: string; hint: string; targetId: string }> = [
  {
    n: 1,
    label: 'Canon → Sony example',
    hint: 'Eval harness · not demo uploads',
    targetId: 'proof-start',
  },
  {
    n: 2,
    label: 'Live demo library',
    hint: 'MongoDB counts · optional MCP',
    targetId: 'proof-live',
  },
  {
    n: 3,
    label: 'Full benchmark',
    hint: '26 scripted scenarios',
    targetId: 'proof-benchmark',
  },
];

function scrollToProofSection(targetId: string): void {
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const ProofGuideStrip: React.FC = () => (
  <nav aria-label="How to read this page" className="grid sm:grid-cols-3 gap-2">
    {PROOF_GUIDE_STEPS.map((step) => (
      <button
        key={step.n}
        type="button"
        onClick={() => scrollToProofSection(step.targetId)}
        className="rounded-lg border border-warm/80 bg-surface-1/50 px-3 py-2.5 text-left hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Step {step.n}</p>
        <p className="text-sm font-medium text-stone-100 mt-0.5">{step.label}</p>
        <p className="text-[11px] text-stone-500 mt-0.5">{step.hint}</p>
      </button>
    ))}
  </nav>
);

// ---------------------------------------------------------------------------
// Honesty footnotes
// ---------------------------------------------------------------------------

const HonestyFootnotes: React.FC = () => (
  <div className="text-xs text-muted space-y-1.5 leading-relaxed">
    <p>
      Token counts are a documented <code className="font-mono">chars / 4</code> estimate, not a real
      tokenizer — read savings ratios as directional, not exact production billing numbers.
    </p>
    <p>
      λ (lambda) in FAMA is derived per-trace from that trace&apos;s own fact list (
      <code className="font-mono">N_forget / (N_presence + N_forget)</code>), not fixed globally — a
      control trace with nothing superseded has λ=0, which makes FAMA vacuously equal recall accuracy for
      that trace.
    </p>
    <p>
      The 26-trace set was frozen 2026-07-04 before scoring; any post-freeze edit to a trace requires a
      logged authoring-error justification in eval/README.md — not a quiet fix-up to flip a failing case.
    </p>
    <p>
      One-command reproduction:{' '}
      <code className="font-mono text-stone-400">python -m eval.run --compare</code> — see{' '}
      <a
        href="https://github.com/prasadt1/engram/blob/main/eval/README.md"
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-400 hover:text-brand-300 hover:underline"
      >
        eval/README.md
      </a>{' '}
      for the full methodology, per-category breakdown, and disclosures this page summarizes.
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const GlassBoxTab: React.FC = () => {
  const [footnotesOpen, setFootnotesOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-1 space-y-8 pb-8">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl text-white">Memory Proof Room</h1>
        <p className="mt-1 text-sm text-stone-400">
          Live memory internals and the benchmark that measures forgetting.
        </p>
        <p className="mt-3 text-sm text-stone-300 leading-relaxed max-w-2xl">
          Two kinds of proof:{' '}
          <span className="text-stone-200">Step 1 &amp; 3</span> run a frozen eval harness on scripted
          memory facts (same engine, reproducible JSON).{' '}
          <span className="text-stone-200">Step 2</span> is live MongoDB for the demo photographer
          you&apos;ve been using in the app. Start with the Canon → Sony harness scenario.
        </p>
      </div>

      <ProofGuideStrip />

      <WorkedExample />

      <LiveMemoryStats />

      <section id="proof-benchmark" className="space-y-4 scroll-mt-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Controlled benchmark</Eyebrow>
            <Tag variant="outline">Step 3 · {defaultResults.summary.trace_count} scenarios</Tag>
          </div>
          <h2 className="font-serif text-lg md:text-xl text-white">
            What happens when a mentor never forgets
          </h2>
          <p className="text-sm text-stone-400 leading-relaxed max-w-2xl">
            Frozen scripted histories — not the live demo library above. In most scenarios a fact
            changes over time (gear switch, habit improved); a few are controls where nothing
            changes. Each row asks the memory a question and scores the answer with{' '}
            <span className="text-stone-200 font-medium">FAMA</span> (Forgetting-Aware Memory
            Accuracy): rewards still-true facts, penalizes outdated ones — higher is better, 1.00 is
            perfect.
          </p>
        </div>
        <BenchmarkSummaryStrip />
        <BenchmarkTable />
      </section>

      <div className="border-t border-warm pt-4 space-y-3">
        <button
          type="button"
          onClick={() => setFootnotesOpen((open) => !open)}
          className="w-full flex items-start justify-between gap-3 text-left rounded-lg px-1 py-1 -mx-1 hover:bg-surface-2/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2"
          aria-expanded={footnotesOpen}
        >
          <div>
            <Eyebrow>The fine print</Eyebrow>
            <p className="mt-1 text-sm text-stone-400">
              Methodology caveats and reproduction steps — expand if you want the full disclosures.
            </p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-stone-500 shrink-0 mt-1 transition-transform ${
              footnotesOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        {footnotesOpen && <HonestyFootnotes />}
      </div>
    </div>
  );
};

export default GlassBoxTab;

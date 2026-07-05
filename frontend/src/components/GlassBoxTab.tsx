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
    <Card padding="md" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Live memory stats</Eyebrow>
          <p className="mt-1 text-xs text-muted max-w-lg">
            Real counts from this app&apos;s memory store, fetched just now for the user you&apos;re
            viewing (the seeded demo photographer in judge mode). &ldquo;Superseded&rdquo; is the one
            to watch — facts the memory deliberately retired when something newer replaced them, kept
            for the audit trail but never re-surfaced in advice.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          aria-pressed={viaMcp}
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
        Each row is one scripted photographer history. Where the two FAMA columns split, the
        never-forgets run surfaced a stale fact that Engram correctly left out — higher is better,
        1.00 is perfect. &ldquo;Token savings&rdquo; is how much smaller Engram&apos;s recalled context
        was than stuffing the full history into the prompt. Rows with nothing outdated tie at 1.00 in
        both columns: there was nothing to forget.
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
                return (
                  <tr key={row.user_id} className="border-t border-warm/50 odd:bg-surface-1 even:bg-transparent">
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
    <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
      <Eyebrow tone="brand">Worked example</Eyebrow>
      <p className="text-sm text-stone-300 leading-relaxed">
        One scenario end to end: a photographer who started on a Canon body, then switched to a Sony
        mirrorless in session 3. Both versions get the same question — watch which facts each one
        brings back.{' '}
        <span className="font-mono text-[10px] text-stone-500">({WORKED_TRACE_ID})</span>
      </p>
      <p className="font-serif text-base text-white">Q: What camera gear do I use?</p>
      <div className="space-y-2 text-sm">
        <p className="text-stone-300">
          <span className="font-semibold text-stone-200">Never forgets — recalls:</span>{' '}
          {workedNoForgetting.recalled_contents.join('; ')} — the retired Canon fact rides along.
        </p>
        <p className="text-stone-300">
          <span className="font-semibold text-brand-400">With forgetting (as shipped) — recalls:</span>{' '}
          {workedDefault.recalled_contents.join('; ')} — current gear only.
        </p>
      </div>
      <p className="text-xs text-muted italic border-t border-warm/50 pt-2">
        Why: the Canon fact was superseded in session 3. The default engine excludes anything with a
        live <code className="font-mono not-italic">superseded_by</code> link; the no-forgetting ablation
        calls <code className="font-mono not-italic">recall(..., include_archived=True)</code>, so the
        retired fact leaks back into context even though it&apos;s three sessions stale.
      </p>
    </div>
  );
};

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
          Live memory internals and the benchmark that measures forgetting — formerly &ldquo;Glass box.&rdquo;
        </p>
        <p className="mt-3 text-sm text-stone-300 leading-relaxed max-w-2xl">
          This page is the proof behind Engram&apos;s memory — no mock-ups, no hand-picked numbers.
          The counts just below are fetched live from the memory database running behind this app,
          and the benchmark after them compares two versions of the same mentor: one that keeps every
          fact you&apos;ve ever shared forever, and one that notices when a fact has been replaced and
          quietly lets it go. If you read one thing, make it the worked example — it shows the whole
          difference in a single question.
        </p>
      </div>

      <LiveMemoryStats />

      <section className="space-y-4">
        <div className="space-y-2">
          <Eyebrow>Benchmark results</Eyebrow>
          <h2 className="font-serif text-lg md:text-xl text-white">
            What happens when a mentor never forgets
          </h2>
          <p className="text-sm text-stone-400 leading-relaxed max-w-2xl">
            We scripted {defaultResults.summary.trace_count} photographer histories — in most of
            them a fact changes over time (a gear switch, a habit that improved), while a few are
            controls where nothing changes — then asked the memory a question about each and scored
            the answer. The score is{' '}
            <span className="text-stone-200 font-medium">FAMA</span> (Forgetting-Aware Memory
            Accuracy): it rewards recalling every still-true fact and penalizes surfacing outdated
            ones — higher is better, 1.00 is perfect.
          </p>
        </div>
        <BenchmarkSummaryStrip />
        <WorkedExample />
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

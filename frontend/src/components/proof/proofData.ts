import resultsDefault from '../../data/results-default.json';
import resultsRecency from '../../data/results-recency.json';
import resultsNoForgetting from '../../data/results-no-forgetting.json';

export interface EvalFama {
  mpa: number;
  faa: number;
  lambda: number;
  fama: number;
}

export interface EvalTraceResult {
  user_id: string;
  recall_current_hits: string;
  recall_absent_ok: string;
  fama: EvalFama;
  engine_tokens: number;
  baseline_tokens: number;
  token_savings_ratio: number;
  recalled_contents: string[];
}

export interface EvalResults {
  summary: {
    trace_count: number;
    ablation: string;
    mean_fama: number;
    mean_token_savings_ratio: number;
    note: string;
  };
  results: EvalTraceResult[];
}

export const defaultResults = resultsDefault as EvalResults;
export const recencyResults = resultsRecency as EvalResults;
export const noForgettingResults = resultsNoForgetting as EvalResults;

export const noForgettingByTrace = new Map(
  noForgettingResults.results.map((r) => [r.user_id, r]),
);

export const recencyByTrace = new Map(
  recencyResults.results.map((r) => [r.user_id, r]),
);

export const WORKED_TRACE_ID = 'trace_1';
export const workedDefault =
  defaultResults.results.find((r) => r.user_id === WORKED_TRACE_ID) ?? null;
export const workedNoForgetting = noForgettingByTrace.get(WORKED_TRACE_ID) ?? null;
export const workedRecency = recencyByTrace.get(WORKED_TRACE_ID) ?? null;

export function traceForgotMatter(defaultFama: number, ablated: EvalTraceResult | undefined): boolean {
  if (!ablated) return false;
  return ablated.fama.fama < defaultFama - 1e-6;
}

export const LEAKED_ANSWER_COUNT = noForgettingResults.results.filter((r) => r.fama.fama < 1).length;

export const DIVERGED_TRACE_COUNT = defaultResults.results.filter((row) =>
  traceForgotMatter(row.fama.fama, noForgettingByTrace.get(row.user_id)),
).length;

export const CONTROL_TRACE_COUNT = defaultResults.summary.trace_count - DIVERGED_TRACE_COUNT;

export const TRACE_LABELS: Record<string, string> = {
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

export const JUDGE_GUIDE_URL =
  'https://github.com/prasadt1/engram/blob/main/docs/judge-memory-proof-room.md';

/** Part B — judge clarity copy (verbatim from claude-to-cursor-judge-clarity-spec.md). */
export const FAMA_HEADING = 'FAMA — Forgetting-Aware Memory Accuracy';
export const FAMA_TOOLTIP =
  'Forgetting-Aware Memory Accuracy — rewards recalling every still-true fact, penalizes surfacing outdated ones. 1.00 is perfect.';

export const CANON_SONY_PRECURSOR =
  'Why this story? Photographers change gear. A mentor who remembers everything forever keeps coaching you on a camera you sold last month. Press Play to watch Engram handle the moment a fact stops being true — it retires the old fact to an audit trail and never lets it contaminate advice again.';

export const LIVE_LIBRARY_EXPLAINER =
  "These counts are fetched from the demo photographer's MongoDB as you load this page — the same memory behind every critique in this demo. Upload a photo and Total goes up; nothing here is staged.";

export const MCP_TOGGLE_CAPTION =
  'Same numbers, different door: this re-runs the identical call through the engram-mcp server — proof that any Qwen agent could mount this memory, not just this app.';

export const BENCHMARK_TIE_NOTE =
  'Both baselines tie at 0.64 — recency keeps the newest facts but can’t tell that one went stale. Only supersession-aware forgetting tells the engine apart.';

export const BENCHMARK_PROVENANCE =
  '26 scripted photographer histories, frozen before any results were computed — committed in the repo (eval/traces.py). Three configs: Engram (salience + forgetting), recency-only (top-k by timestamp, no supersession awareness), and never-forgets (full history). A control is a history where nothing changes: all three must tie at 1.00 there, and they do. On this freeze every trace has ≤5 facts, so recency-only and never-forgets coincide. Rerun yourself: python -m eval.run --compare.';

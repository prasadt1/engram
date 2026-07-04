"""One-command benchmark: python -m eval.run --seed 0

Compares the memory-engine recall path against a full-history baseline
(no forgetting, no salience ranking — dump every fact every time)
on recall hits, FAMA, and token cost. Deterministic (no wall clock in
scoring; timestamps synthesized from session indices).

Side-by-side mode: python -m eval.run --compare reads the two committed
result JSONs (eval/results-default.json, eval/results-no-forgetting.json)
and prints one merged Markdown table — it never re-runs the engine.
"""

from __future__ import annotations
import argparse
import json
from datetime import datetime, timedelta, timezone

from app.memory_engine import MemoryItem, recall
from eval.fama import compute_fama
from eval.traces import TRACES

DEFAULT_RESULTS_PATH = "eval/results-default.json"
NO_FORGETTING_RESULTS_PATH = "eval/results-no-forgetting.json"

ANCHOR = datetime(2026, 7, 1, tzinfo=timezone.utc)  # fixed anchor => deterministic recency


def _memory_items_for_trace(trace) -> list[MemoryItem]:
    items = []
    for i, fact in enumerate(trace.facts):
        created = ANCHOR - timedelta(days=(10 - fact.valid_from_session))
        items.append(MemoryItem(
            id=f"{trace.user_id}_{i}", content=fact.content, importance=0.7,
            created_at=created, genre=fact.genre,
            superseded_by=(f"{trace.user_id}_{i}_sup" if fact.invalidated_by_session else None),
        ))
    return items


def _estimate_tokens(item: MemoryItem) -> int:
    return max(1, len(item.content) // 4)  # chars/4 heuristic — documented estimate, calibrated later


def run(seed: int = 0, ablation: str = "none") -> dict:
    results = []
    for trace in TRACES:
        items = _memory_items_for_trace(trace)
        include_archived = ablation == "no-forgetting"
        recalled = recall(items, now=ANCHOR, k=5, query=trace.query, include_archived=include_archived)
        recalled_text = " ".join(i.content for i in recalled)
        recalled_ids = {i.id for i in recalled}

        current_hits = sum(1 for phrase in trace.expects_current if phrase.lower() in recalled_text.lower())
        absent_ok = sum(1 for phrase in trace.expects_absent if phrase.lower() not in recalled_text.lower())

        valid_items = [i for i in items if i.is_live()]
        obsolete_items = [i for i in items if not i.is_live()]
        # NOTE: obsolete_total is passed as-is (can legitimately be 0 for a
        # trace with no supersession, e.g. trace_3). `or 1` here would fake a
        # phantom obsolete item and tank FAA/FAMA for a trace that had
        # nothing to forget — compute_fama already treats obsolete_total=0
        # as vacuously-perfect (faa=1.0, lambda=0.0), so no coalescing is
        # needed or correct on this side.
        fama = compute_fama(
            valid_surfaced=len([i for i in valid_items if i.id in recalled_ids]),
            valid_total=len(valid_items) or 1,
            obsolete_excluded=len([i for i in obsolete_items if i.id not in recalled_ids]),
            obsolete_total=len(obsolete_items),
        )

        engine_tokens = sum(_estimate_tokens(i) for i in recalled)
        baseline_tokens = sum(_estimate_tokens(i) for i in items)  # full-history stuffing

        results.append({
            "user_id": trace.user_id,
            "recall_current_hits": f"{current_hits}/{len(trace.expects_current)}",
            "recall_absent_ok": f"{absent_ok}/{len(trace.expects_absent)}" if trace.expects_absent else "n/a",
            "fama": fama,
            "engine_tokens": engine_tokens,
            "baseline_tokens": baseline_tokens,
            "token_savings_ratio": round(baseline_tokens / engine_tokens, 2) if engine_tokens else None,
            # Actual recalled content, in recall order — lets a judge (or the
            # --compare / worked-example renderer) see exactly what surfaced
            # in each mode without re-running anything.
            "recalled_contents": [i.content for i in recalled],
        })

    fama_vals = [r["fama"]["fama"] for r in results]
    ratios = [r["token_savings_ratio"] for r in results if r["token_savings_ratio"]]
    summary = {
        "trace_count": len(results),
        "ablation": ablation,
        "mean_fama": round(sum(fama_vals) / len(fama_vals), 4),
        "mean_token_savings_ratio": round(sum(ratios) / len(ratios), 2) if ratios else None,
        "note": f"seed={seed}; token counts are a chars/4 heuristic (documented estimate); timestamps synthesized from session indices for determinism",
    }
    return {"summary": summary, "results": results}


def render_compare(default_path: str = DEFAULT_RESULTS_PATH, no_forgetting_path: str = NO_FORGETTING_RESULTS_PATH) -> str:
    """Read the two committed result JSONs and format one merged Markdown
    table (FAMA default vs ablated, per trace, plus means + token savings).

    Pure read-and-format: never re-runs the engine, so it reflects exactly
    what's on disk (the committed, reproducible artifacts), and stays cheap
    to call from docs tooling or a judge's own machine without a live run.
    """
    with open(default_path) as f:
        default = json.load(f)
    with open(no_forgetting_path) as f:
        no_forgetting = json.load(f)

    default_by_id = {r["user_id"]: r for r in default["results"]}
    no_forgetting_by_id = {r["user_id"]: r for r in no_forgetting["results"]}
    # Preserve trace order from the default run; both files share the same
    # trace set by construction (both are produced from eval.traces.TRACES).
    trace_ids = [r["user_id"] for r in default["results"]]

    lines = []
    lines.append(f"## Engram /eval side-by-side (default vs no-forgetting)\n")
    lines.append("| trace | FAMA default | FAMA no-forgetting | Δ FAMA | tokens default | tokens no-forgetting | savings (default) |")
    lines.append("|---|---|---|---|---|---|---|")
    for uid in trace_ids:
        d = default_by_id[uid]
        n = no_forgetting_by_id.get(uid)
        if n is None:
            continue  # trace sets diverged — shouldn't happen for committed, same-freeze JSONs
        d_fama = d["fama"]["fama"]
        n_fama = n["fama"]["fama"]
        delta = round(d_fama - n_fama, 4)
        lines.append(
            f"| {uid} | {d_fama} | {n_fama} | {delta} | {d['engine_tokens']} | {n['engine_tokens']} | {d['token_savings_ratio']}x |"
        )

    d_summary, n_summary = default["summary"], no_forgetting["summary"]
    lines.append("")
    lines.append("| | mean FAMA | mean token-savings ratio |")
    lines.append("|---|---|---|")
    lines.append(f"| default (engine) | {d_summary['mean_fama']} | {d_summary['mean_token_savings_ratio']}x |")
    lines.append(f"| no-forgetting (ablation) | {n_summary['mean_fama']} | {n_summary['mean_token_savings_ratio']}x |")
    lines.append("")
    lines.append(
        f"**FAMA gap (default − no-forgetting): {round(d_summary['mean_fama'] - n_summary['mean_fama'], 4)}** "
        f"— the no-forgetting ablation lets superseded facts leak back into recall, which is exactly what FAMA's "
        f"FAA term penalizes."
    )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--ablation", choices=["none", "no-forgetting"], default="none")
    parser.add_argument("--out", default=None, help="write raw JSON here (default: eval/results-default.json, or eval/results-no-forgetting.json for that ablation)")
    parser.add_argument("--compare", action="store_true", help="read the two committed result JSONs and print a merged side-by-side table (no re-run)")
    args = parser.parse_args()

    if args.compare:
        print(render_compare())
        return

    output = run(seed=args.seed, ablation=args.ablation)
    print(f"\n## Engram /eval results (seed={args.seed}, ablation={args.ablation})\n")
    print("| trace | recall hits | absent-ok | FAMA | tokens engine/baseline | savings |")
    print("|---|---|---|---|---|---|")
    for r in output["results"]:
        print(f"| {r['user_id']} | {r['recall_current_hits']} | {r['recall_absent_ok']} | {r['fama']['fama']} | {r['engine_tokens']}/{r['baseline_tokens']} | {r['token_savings_ratio']}x |")
    s = output["summary"]
    print(f"\n**Mean FAMA:** {s['mean_fama']}  **Mean token savings:** {s['mean_token_savings_ratio']}x\n")

    out_path = args.out or (DEFAULT_RESULTS_PATH if args.ablation == "none" else NO_FORGETTING_RESULTS_PATH)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Raw results written to {out_path}")


if __name__ == "__main__":
    main()

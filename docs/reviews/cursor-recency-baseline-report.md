# Cursor recency-baseline report

**Contract:** `docs/reviews/claude-to-cursor-recency-baseline-spec.md`  
**Date:** 2026-07-14  
**Verdict:** Recency-only mean FAMA **0.6385** (< 1.00). Proceeded. Claude should re-run `python -m eval.run` to verify before trusting.

## Real number (do not trust until Claude re-runs)

| config | mean FAMA | mean token-savings ratio |
|---|---|---|
| default (engine) | 1.0 | 1.72x |
| **recency-only (naive baseline)** | **0.6385** | **1.0x** |
| no-forgetting (ablation) | 0.6385 | 1.0x |

**FAMA gap (default − recency-only): 0.3615** — below the 1.00 stop gate.

### Honesty note on this freeze

Every frozen trace has ≤5 facts (`max=5` on `trace_multihop_1`). With `k=5`, recency-only therefore dumps the full candidate set — identical per-trace FAMA and token counts to no-forgetting. That is a property of the freeze, not of the rule; disclosed in `eval/README.md` and Proof Room provenance. Traces and the two existing result JSONs were not touched.

## `--compare` output (verbatim)

```
## Engram /eval side-by-side (default · recency-only · no-forgetting)

| trace | FAMA default | FAMA recency-only | FAMA no-forgetting | tokens default | tokens recency | tokens no-forgetting | savings (default) |
|---|---|---|---|---|---|---|---|
| trace_1 | 1.0 | 0.5 | 0.5 | 8 | 16 | 16 | 2.0x |
| trace_2 | 1.0 | 0.5 | 0.5 | 15 | 27 | 27 | 1.8x |
| trace_3 | 1.0 | 1.0 | 1.0 | 21 | 21 | 21 | 1.0x |
| trace_adversarial_1 | 1.0 | 0.5 | 0.5 | 10 | 19 | 19 | 1.9x |
| trace_adversarial_2 | 1.0 | 0.5 | 0.5 | 11 | 23 | 23 | 2.09x |
| trace_adversarial_3 | 1.0 | 0.5 | 0.5 | 12 | 22 | 22 | 1.83x |
| trace_adversarial_4 | 1.0 | 0.5 | 0.5 | 13 | 22 | 22 | 1.69x |
| trace_adversarial_5 | 1.0 | 0.5 | 0.5 | 12 | 26 | 26 | 2.17x |
| trace_adversarial_6 | 1.0 | 0.5 | 0.5 | 17 | 29 | 29 | 1.71x |
| trace_4 | 1.0 | 0.5 | 0.5 | 13 | 24 | 24 | 1.85x |
| trace_5 | 1.0 | 0.5 | 0.5 | 11 | 26 | 26 | 2.36x |
| trace_6 | 1.0 | 0.5 | 0.5 | 15 | 27 | 27 | 1.8x |
| trace_7 | 1.0 | 1.0 | 1.0 | 15 | 15 | 15 | 1.0x |
| trace_8 | 1.0 | 0.5 | 0.5 | 16 | 30 | 30 | 1.88x |
| trace_9 | 1.0 | 1.0 | 1.0 | 17 | 17 | 17 | 1.0x |
| trace_10 | 1.0 | 0.5 | 0.5 | 15 | 30 | 30 | 2.0x |
| trace_11 | 1.0 | 1.0 | 1.0 | 18 | 18 | 18 | 1.0x |
| trace_12 | 1.0 | 0.5 | 0.5 | 16 | 31 | 31 | 1.94x |
| trace_13 | 1.0 | 1.0 | 1.0 | 15 | 15 | 15 | 1.0x |
| trace_chain_1 | 1.0 | 0.3333 | 0.3333 | 13 | 39 | 39 | 3.0x |
| trace_chain_2 | 1.0 | 0.3333 | 0.3333 | 14 | 34 | 34 | 2.43x |
| trace_chain_3 | 1.0 | 0.3333 | 0.3333 | 13 | 36 | 36 | 2.77x |
| trace_multihop_1 | 1.0 | 0.6 | 0.6 | 50 | 74 | 74 | 1.48x |
| trace_multihop_2 | 1.0 | 1.0 | 1.0 | 47 | 47 | 47 | 1.0x |
| trace_multihop_3 | 1.0 | 1.0 | 1.0 | 54 | 54 | 54 | 1.0x |
| trace_multihop_4 | 1.0 | 1.0 | 1.0 | 27 | 27 | 27 | 1.0x |

| | mean FAMA | mean token-savings ratio |
|---|---|---|
| default (engine) | 1.0 | 1.72x |
| recency-only (naive baseline) | 0.6385 | 1.0x |
| no-forgetting (ablation) | 0.6385 | 1.0x |

**FAMA gap (default − recency-only): 0.3615** · **FAMA gap (default − no-forgetting): 0.3615** — recency-only keeps a k=5 budget but ignores supersession; no-forgetting dumps full history.
```

## Deliverables

1. `eval/run.py` — `--ablation recency-only`; `_recall_recency_only` (no supersession filter, sort by `created_at` desc, `k=5`); `--compare` is 3-way.
2. `eval/results-recency.json` + `frontend/src/data/results-recency.json` — committed.
3. `eval/README.md` + root `README.md` — three-config framing + table.
4. `BenchmarkVisual.tsx` + `proofData.ts` — third ring (recency-only) + third table column; leaked-answer count still computed from JSON.

## Untouched (byte-check)

- `eval/traces.py` — not edited
- `eval/results-default.json` — MD5 `895b97772f57cb2ea8a0e58841f113c3` (unchanged; `git diff` empty)
- `eval/results-no-forgetting.json` — MD5 `ba6d7122eca8dc4a7238ac8c02566a6f` (unchanged; `git diff` empty)

## Verification

- `python -m eval.run --compare` → 3-way table above
- `frontend && npx tsc --noEmit` → clean
- Claude re-run expected: `python -m eval.run --seed 0 --ablation recency-only` then `--compare`

## Deploy

- Commit: `ea1d33c` on `main` (pushed)
- ECS: `git pull` → `docker compose up -d --build` (ok)
- Prod: `/health` → `{"status":"ok"}`; homepage JS bundle contains all three ring labels (`Mean · Engram shipped`, `Mean · recency-only`, `never forgets`)

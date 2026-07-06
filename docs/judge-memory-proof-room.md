# Memory Proof Room — judge guide (text)

This is the **full-text companion** to the in-app [Memory Proof Room](https://engram.prasadtilloo.com/?judge=1#glassbox). The UI is visual-first; this document holds methodology, provenance, and reproduction steps.

---

## Two kinds of proof on one page

| Step | What it shows | Data source |
|------|----------------|-------------|
| **1 · Canon → Sony** | Forgetting in one question | Frozen eval harness `trace_1` in [`eval/traces.py`](../eval/traces.py) |
| **2 · Live demo library** | Production memory counts | Live MongoDB for `demo-user` (judge mode) |
| **3 · Benchmark** | 26 scripted scenarios, FAMA scores | Committed JSON from `python -m eval.run --compare` |

**Important:** Step 1 and Step 3 are **not** from the demo photographer's photo uploads. They inject scripted memory facts into the same `recall()` engine the coach uses, then score outputs. Step 2 is the live library you've been clicking through in Home / My Work.

---

## Step 1 — `trace_1` (Canon → Sony)

Authored in [`eval/traces.py`](../eval/traces.py):

- Sessions 1–2: fact *"shoots primarily with a Canon body"*
- Session 3: fact *"switched to a Sony mirrorless body"* — Canon is **superseded** (retired, audit trail only)
- Question: *"What camera gear do I use?"*

**Shipped engine** (`results-default.json` → `recalled_contents`):

- `switched to a Sony mirrorless body` only

**No-forgetting ablation** (`results-no-forgetting.json`):

- `switched to a Sony mirrorless body` **and** `shoots primarily with a Canon body`

**Why:** default `recall()` skips items with a live `superseded_by` link. The ablation calls `recall(..., include_archived=True)`.

---

## Step 2 — Live MongoDB stats

`GET /api/v1/memory-stats` for the active `X-User-Id` (judge mode → `demo-user`).

- **Live** — facts still used in advice
- **Superseded** — facts deliberately retired when something newer replaced them; kept for audit, excluded from default recall
- **Skills watching / cleared** — coached weaknesses vs graduated skills (3 above-bar sessions in a row)

**Optional MCP toggle:** `GET /api/v1/memory-stats?via=mcp` spawns the real [`engram-mcp`](../app/engram_mcp.py) stdio subprocess and returns the same counts with `served_via: engram-mcp`.

### engram-mcp tools

| Tool | Purpose |
|------|---------|
| `recall` | Salience-scored, forgetting-aware memory retrieval |
| `consolidate` | Episodes eligible for semantic consolidation |
| `forget` | Check whether a coached skill has graduated |
| `get_memory_stats` | Live/superseded/skill counts |

Any Qwen agent can mount these tools — the memory layer is not locked inside this web UI.

---

## Step 3 — FAMA benchmark (26 traces)

Frozen set declared in [`eval/README.md`](../eval/README.md) (2026-07-04).

**FAMA** (Forgetting-Aware Memory Accuracy): rewards recalling still-true facts, penalizes surfacing outdated ones. Higher is better; 1.00 is perfect.

| Config | Mean FAMA | Notes |
|--------|-----------|-------|
| Engram shipped (default) | 1.00 | Forgetting enabled |
| Never forgets (ablation) | ~0.64 | Stale facts leak back in |

Recall accuracy (MPA) is **identical** in both configs — the engine does not trade recall for forgetting.

**Reproduce:**

```bash
python -m eval.run --compare
```

Committed outputs: [`eval/results-default.json`](../eval/results-default.json), [`eval/results-no-forgetting.json`](../eval/results-no-forgetting.json).

---

## Fine print (methodology caveats)

1. **Token counts** — `chars / 4` estimate, not a real tokenizer. Read savings ratios as directional.
2. **λ (lambda)** — derived per-trace from that trace's fact list, not fixed globally. Control traces with nothing superseded have λ=0.
3. **Trace freeze** — 26 traces frozen before scoring; post-freeze edits require logged justification in `eval/README.md`.
4. **Full methodology** — [`eval/README.md`](../eval/README.md)

---

## Where to look in the product

- **Memory Receipt** — expand after any upload or Mentor reply (what was recalled vs retired vs dropped for budget)
- **Home → Journey** — skill graduation and current focus
- **Memory Proof Room** — `#glassbox` in the sidebar under **Proof**

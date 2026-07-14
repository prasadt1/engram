# Cursor honesty-polish report

**Contract:** `docs/reviews/claude-to-cursor-honesty-polish-spec.md`  
**Date:** 2026-07-14  
**Depends on:** recency baseline (`ea1d33c`) — 3-way FAMA already on prod.

## Choices (stated)

| Item | Choice |
|------|--------|
| A1 consolidate stub | **(b) Relabel honestly** — dropped `consolidate` from `list_tools` / `call_tool` and all advertised surfaces. Stub function remains in-repo, unmounted. |
| B2 banner / tour string | **`90-second walkthrough`** — banner CTA + `JudgeTour` `tourLabel` both use this exact string. |
| C Coach Assist | **(a) Demote** — removed from sidebar **Proof** group (sits below it, still reachable); dropped "Proof · isolation" eyebrow; mobile label/`aria-label` → "Coach Assist". Tour never had a Coach Assist stop. |

## Part A — honesty

### A1 — consolidate
- `app/engram_mcp.py`: three mounted tools only (`recall` · `forget` · `get_memory_stats`)
- Copy updated: README, DEVPOST-DRAFT, judge-memory-proof-room, ADR-0003, WHATS_NEW, `scripts/run_mcp_server.py`, `docs/mcp-transcript.md` `list_tools` block

### A2 — EXIF
- DEVPOST "What's next" #4 reframed to **EXIF→memory supersession** (aspirational)
- Shipped EXIF extraction named in "What it does" Adapt paragraph (portfolio metadata, privacy-gated)

### A3 — test count
- README `70 tests` → **`219 tests`** (confirmed: `.venv/bin/python -m pytest --collect-only -q` → `219 tests collected`)

### A4 — CoachAssist hardcoded count
- `(18 / 10 / 6 photos)` → computed `learners.map(l => l.photoCount).join(' / ')` once roster loads

## Part B — deviations

### B1 — mobile a11y
- `BottomNav.tsx`: `aria-label="Coach Assist"`; visible span **Coach Assist** (was Isolation / cryptic label)

### B2 — banner
- App banner: **Take the 90-second walkthrough**
- JudgeTour `tourLabel`: **90-second walkthrough**

## Part C — Coach Assist demote
- Sidebar: Proof group = Memory Proof Room only; Coach Assist link outside the Proof eyebrow
- CoachAssistTab eyebrow: **Multi-learner preview** (not Proof · isolation)

## Part D — gallery (LAST)

Recorded after A–C deploy; see § Deploy / Gallery below.

## Verification (A–C)

| Check | Result |
|-------|--------|
| `.venv/bin/python -m pytest -q` | **219 passed** |
| `frontend && npx tsc --noEmit` | clean |
| `python -m eval.run --compare` | 3-way table intact; mean recency **0.6385** |
| `results-default.json` / `results-no-forgetting.json` | MD5 unchanged (`895b9777…` / `ba6d7122…`); `git diff` empty |

### Also shipped in this commit
- `tests/test_run.py` updated for three-way `render_compare` (required after recency; was red until fixed).

## Deploy

_(filled after push + ECS rebuild)_

## Gallery D

_(filled after recaptures)_

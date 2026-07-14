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

- Commit: `7609eee` on `main` (pushed)
- ECS rebuild ok; `/health` → `{"status":"ok"}`
- Prod JS contains `90-second walkthrough`, `Multi-learner preview`, `Coach Assist` (no advertised consolidate)

### Local-only (gitignored) honesty copy also updated
`docs/DEVPOST-DRAFT.md`, `docs/mcp-transcript.md`, `WHATS_NEW.md` — not force-added; judge-facing tracked surfaces are what shipped.

## Gallery D

Captures against post-`7609eee` prod. Composed into `docs/devpost-public/` (gitignored article assets).

| Frame | Result |
|-------|--------|
| **D1 · 04 proof-room** | H1 whole; three FAMA rings **1.00 / 0.64 / 0.64** in-frame; Canon→Sony story completed. Viewport **1680×1800** + `fit_elements` to keep heading + `#proof-benchmark` together. |
| **D2 · 06 photo-detail** | Scoped chat reply + **Memory Receipt** (`1 recalled · packed under 1200 tokens`) — no empty "Start a conversation". |

### D2 deviation (stated)

Demo-user portfolio entries all have `memoryUpdate: null` (verified via `/api/v1/portfolio`). `MemoryDelta` ("What I learned from this photo") therefore cannot render on any seeded frame. Captured the memory-showpiece that *is* live: scoped reply + Memory Receipt. Re-seed with `memoryUpdate` would be needed for the left-pane narration.

### Capture tooling shipped

- `tools/devpost-gallery/screens.json` — 04/06 interaction updates; 04 benchmark card says 3-way FAMA
- `tools/devpost-gallery/capture.mjs` — `fit_elements` helper
- `frontend/src/components/GlassBoxTab.tsx` — `id="proof-heading"` for future captures

Do **not** touch `annotated-05-architecture.png` (Claude-owned).

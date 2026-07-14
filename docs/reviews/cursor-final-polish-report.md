# Cursor final-polish report

**Contract:** `docs/reviews/claude-to-cursor-final-polish-spec.md`  
**Date:** 2026-07-14 (report refreshed after spec Item 2 → **dark**)  
**Branch:** `main` (pushed)

## Item 1 — Proof Room baseline tie line

**Commit:** `b6ad9b7ab1f7ca1deaf93bda7148d859685a6a8d`  
**Message:** Proof Room: promote baseline FAMA tie as the punchline under the rings.

### Changes
- `frontend/src/components/proof/proofData.ts` — added verbatim `BENCHMARK_TIE_NOTE`
- `frontend/src/components/proof/BenchmarkVisual.tsx` — render under the three-ring grid, before “Stale facts leaked…”, styled `text-sm text-stone-200 font-medium text-center max-w-xl mx-auto`

### Not changed
- Ring values / tones, leak counts, token ratio, `BENCHMARK_PROVENANCE`, eval JSON

### Verification
| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean |
| `?judge=1` → `#glassbox` @ 1440 | tie line under rings, above leak line; all 3 ring labels present |
| `?judge=1` → `#glassbox` @ 390 | same |
| Numbers / rings | untouched |
| Re-check (this run) | constant + render order still present; `tsc` clean |

**Rendered line (verbatim):**

> Both baselines tie at 0.64 — recency keeps the newest facts but can’t tell that one went stale. Only supersession-aware forgetting tells the engine apart.

**Console:** no new errors from this copy change. Pre-existing React warning remains: nested `<button>` inside the full-table toggle (`InfoTooltip` button inside outer button) — not introduced here.

**Deploy:** not ECS-rebuilt (per spec — ships on next normal deploy).

## Item 2 — dark inline architecture image

**Decision (revised):** dark poster for article inline (same as gallery), **not** cream.

**Commit:** `43771607eddb642e082bea5d6d12cbd995d99a82`  
**Message:** Use dark architecture poster for Devpost inline embed.

(Note: an earlier cream swap landed as `16b7930`; user/spec then reversed to dark — `4377160` is the Item 2 outcome that matches the current spec.)

### Changes
- Copied `docs/devpost-public/annotated-05-architecture.png` (dark, enlarged fonts) → `docs/media/devpost-inline-architecture.png`
- SHA-256 `c25f041ed33debd744b9185b28163808eb1ff339d3af1fc43036f5f5c92e11ce`, 3840×2160, 559443 bytes
- Cream render ignored; other inline images untouched
- Did **not** edit `DEVPOST-DRAFT.md`; did **not** reseed; no ECS rebuild

### Verification
| Check | Result |
|-------|--------|
| File matches dark source | SHA identical to `annotated-05-architecture.png` |
| raw URL HTTP | **200**, size **559443** |
| Dark (not cream) | content-region luma ~33 |

**Raw URL:** https://raw.githubusercontent.com/prasadt1/engram/main/docs/media/devpost-inline-architecture.png

Labels on this poster: photo-count wording non-numeric; `qwen3.6-flash` for chat/summaries (mentor chat tier).

## Out of scope (honored)
- No `DEVPOST-DRAFT.md` edits
- No demo-delta reseed
- No ECS docker rebuild

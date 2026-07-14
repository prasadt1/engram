# Cursor final-polish report

**Contract:** `docs/reviews/claude-to-cursor-final-polish-spec.md`  
**Date:** 2026-07-14  
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

**Rendered line (verbatim):**

> Both baselines tie at 0.64 — recency keeps the newest facts but can’t tell that one went stale. Only supersession-aware forgetting tells the engine apart.

**Console:** no new errors from this copy change. Pre-existing React warning remains: nested `<button>` inside the full-table toggle (`InfoTooltip` button inside outer button) — not introduced here.

**Deploy:** not ECS-rebuilt (per spec — ships on next normal deploy). Verified against local Vite with the committed frontend.

## Item 2 — cream inline architecture image

**Commit:** `16b7930ef2068cea6b97ea0082419d3a62e0a84e`  
**Message:** Swap Devpost inline architecture for cream poster render.

### Changes
- Copied `docs/devpost-public/annotated-05-architecture-light.png` → `docs/media/devpost-inline-architecture.png` (SHA-256 `487ae909ee6cb7a356fcfbbb26e197b93d2c446b4f55e01bf40bd020e085e9dd`, 3840×2160, 557216 bytes)
- Did **not** touch dark gallery `annotated-05-architecture.png` or the other two inline images
- Did **not** edit `DEVPOST-DRAFT.md`; did **not** reseed

### Verification
| Check | Result |
|-------|--------|
| Push to `main` | `3520195..16b7930` |
| raw URL HTTP | **200**, size **557216** |
| SHA matches committed cream | yes |
| Cream (not dark) | content-region avg RGB ~(236,229,219), luma ~230 |

**Raw URL:** https://raw.githubusercontent.com/prasadt1/engram/main/docs/media/devpost-inline-architecture.png

Label content on this poster (from the capture source): photo-count wording is non-numeric; `qwen3.6-flash` noted for chat/summaries (mentor chat tier).

## Out of scope (honored)
- No `DEVPOST-DRAFT.md` edits
- No demo-delta reseed
- No ECS docker rebuild

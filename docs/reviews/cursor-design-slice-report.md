# Design-polish slice — Cursor implementation report (2026-07-07)

Contract: `docs/reviews/claude-to-cursor-design-polish-slice-spec.md`

---

## Part A — convergent low-risk fixes

**Commit:** `395c2398d4f9a5b8bbd18c66268efce270756e1c`

**Files touched:**
- `frontend/src/lib/formatPhotoDate.ts` (new)
- `frontend/src/components/MyWorkTab.tsx`
- `frontend/src/components/HomeTab.tsx`
- `frontend/src/components/JourneySection.tsx`
- `frontend/src/components/GlassBoxTab.tsx`
- `frontend/src/components/proof/CanonSonyVisual.tsx`
- `frontend/src/components/proof/BenchmarkVisual.tsx`
- `frontend/src/components/AppSidebar.tsx`
- `frontend/src/components/PhotoDetailView.tsx`

**Copy strings shipped (verbatim):**
- Proof Room framing (under title): `This page proves Engram remembers what matters, forgets what no longer applies, and matches a full-memory baseline while using far less context.`
- Proof Room subline (unchanged): `Visual proof in three steps — play the story, check live counts, scan the benchmark.`
- Step 1 header provenance: `Gear switch — Canon body, then Sony mirrorless (trace_1) — same recall() engine as the coach, not demo-user uploads.`
- Play-story narration (per phase):
  - Phase 0: `Press Play — watch one fact get stored, then retired when it stops being true.`
  - Phase 1: `Session 2: you tell me you shoot Canon — I remember it.`
  - Phase 2: `Session 3: you switch to Sony. For a beat both facts are live — I haven’t retired Canon yet.`
  - Phase 3: `I link the switch and retire the Canon fact — kept for audit, it never coaches you again.`
  - Phase 4: `You ask what gear you use: I recall only Sony. “Never forget” leaks the stale Canon fact back in.`
- Mean FAMA gloss: `Mean FAMA recalls every still-true fact, penalizes surfacing outdated ones — 1.00 is perfect.`
- Photo detail: `Uploaded {date}` (e.g. `Uploaded Jun 18`)

**Verification evidence:**
- `npx tsc --noEmit` → exit 0; `npm run build` → exit 0
- **Prod (initial):** `git pull` to `395c239` on server; docker build hung; instance wedged ~30+ min (OOM during rebuild on small ECS). Site recovered after operator reboot.

**Deviations:**
- **A3 narration:** Wording adjusted to match actual animation phases (Sony at phase 2, recall at phase 4); added phase 0 intro.
- **A5 unknown pills:** N/A — no `unknown` pill values in UI.
- **A5 Memory Receipt tint:** Already `bg-brand-500/10` — no change.
- **A5 uploaded date:** Added.

---

## Part B — memory threads

**Commit:** `b43c527`

**Files touched:**
- `frontend/src/components/MemoryThreads.tsx` (new)
- `frontend/src/components/HomeTab.tsx` (swap `MemoryLane` → `MemoryThreads`)

**Copy strings shipped (verbatim):**
- Section header: `Your journey, as I remember it`
- Eyebrow: `Memory threads`
- Section helper: `One thread per genre I've seen enough of — step through each to watch your eye develop. Tap a frame to open it in My Work.`
- Thread-level (progress): `{n} {genre} photos since {firstDate} — overall {first} → {latest}.` (when latest − first ≥ 0.3)
- Thread-level (neutral): `{n} {genre} photos since {firstDate}.`
- Per-photo (strongest): `Your strongest {genre} yet — {score}/10.`
- Per-photo (other): `{score}/10 · {shortDate}`

**Verification evidence:**
- `tsc` + `build` clean; zero new Home network calls (threads from existing `memoryLaneSource` pool).

**Observed, not done:**
- **Growth comparison** left on Home (redundant next to threads) — deferred per spec.

---

## Part C — optional autoplay

**Commit:** `778c2cd`

**Files touched:** `frontend/src/components/MemoryThreads.tsx`

**Behavior:** Per-thread play/pause; 2.5s crossfade + slow zoom; `prefers-reduced-motion` respected; pauses on hover/focus.

**Verification evidence:** `tsc` + `build` clean; local autoplay confirmed on `localhost:5173/?judge=1`.

---

## Post-slice follow-ups (not in original contract)

### D1 — Home snapshot cache (Back navigation UX)

**Commit:** `d7bf98b`

**Problem:** `HomeTab` unmounts on every tab switch (`activeTab === 'home'` conditional + `<main key={activeTab}>`). Back from My Work / photo detail remounted Home, replayed all MongoDB reads, showed skeleton, lost scroll/flow.

**Fix:** Module-level `homeSnapshotCache` keyed by `getApiUserScope()` — stale-while-revalidate. Remount hydrates from last successful load (`loading` starts false); background `load()` revalidates silently. `portfolioRefreshKey` still forces refresh after upload/delete.

**Files:** `frontend/src/components/HomeTab.tsx`

**Verification:** User confirmed “works” on local `/?judge=1` — Home → My Work → Back paints instantly without skeleton.

---

### D2 — Dimension info tooltips

**Commit:** `f28d36b`

**Problem:** Judges/users see skill names (e.g. Technique) in Watching / Current focus without knowing what the dimension measures.

**Fix:** `InfoTooltip` primitive + `DIMENSION_MEANINGS` in `scoreContext.ts` (wording condensed from `ScoreExplainer`). Wired into:
- `DimensionBar` (photo detail + My Work trend bars)
- Sidebar **Current focus** skill label
- Journey **Cleared** and **Watching** skill names

**Example tooltip (Technique):** `Technical execution — focus, sharpness, exposure, and camera settings.`

**Bugfix (same commit):** Watching-list tooltip was inside `truncate` span (`overflow: hidden` clipped popover). Moved ⓘ to sibling of truncating name span.

**Files:**
- `frontend/src/components/primitives/InfoTooltip.tsx` (new)
- `frontend/src/lib/scoreContext.ts`
- `frontend/src/components/DimensionBar.tsx`
- `frontend/src/components/AppSidebar.tsx`
- `frontend/src/components/JourneySection.tsx`
- `frontend/src/components/primitives/index.ts`

**Verification:** `tsc` + `build` clean; Technique tooltip confirmed in Watching after truncate fix.

---

## Prod deploy (2026-07-07, instance recovered)

**Deploy command:**
```bash
ssh -i ~/Downloads/engram-key.pem root@8.222.253.211 \
  "cd /root/engram && git pull origin main && docker compose up -d --build"
```

**Expected HEAD after pull:** `f28d36b` (includes Parts A–C + D1 + D2 + report `228635b`).

**Post-deploy smoke:** `https://engram.prasadtilloo.com/?judge=1` → Home (memory threads + play) → My Work (contact-sheet dates) → photo detail (dimension ⓘ + Uploaded date) → Back to Home (instant, no skeleton) → Proof Room.

---

## Summary

| Slice | SHA | On main | Deployed prod |
|-------|-----|---------|---------------|
| A | `395c239` | yes | yes (after recovery deploy) |
| B | `b43c527` | yes | yes |
| C | `778c2cd` | yes | yes |
| Report | `228635b` | yes | n/a |
| D1 Home cache | `d7bf98b` | yes | see deploy below |
| D2 Tooltips | `f28d36b` | yes | see deploy below |

All changes frontend-only. No backend/eval/seed changes. Other `docs/reviews/*.md` files remain local-only (gitignored).

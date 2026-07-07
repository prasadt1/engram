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
- Step 1 header provenance: `{TRACE_LABELS.trace_1} (trace_1) — same recall() engine as the coach, not demo-user uploads.` → renders as: `Gear switch — Canon body, then Sony mirrorless (trace_1) — same recall() engine as the coach, not demo-user uploads.`
- Play-story narration (per phase):
  - Phase 0: `Press Play — watch one fact get stored, then retired when it stops being true.`
  - Phase 1: `Session 2: you tell me you shoot Canon — I remember it.`
  - Phase 2: `Session 3: you switch to Sony. For a beat both facts are live — I haven’t retired Canon yet.`
  - Phase 3: `I link the switch and retire the Canon fact — kept for audit, it never coaches you again.`
  - Phase 4: `You ask what gear you use: I recall only Sony. “Never forget” leaks the stale Canon fact back in.`
- Mean FAMA gloss: `Mean FAMA recalls every still-true fact, penalizes surfacing outdated ones — 1.00 is perfect.`
- Photo detail: `Uploaded {date}` (e.g. `Uploaded Jun 18`)

**Verification evidence:**
- `cd frontend && npx tsc --noEmit` → exit 0
- `npm run build` → exit 0 (bundle `index-DJhrpfzm.js` at Part A commit)
- Local judge walk (`localhost:5173/?judge=1`): **not completed** — Vite dev server was not running in this session (terminal at shell prompt).
- **Prod deploy:** `git push` succeeded. SSH deploy started; server `git pull` fast-forwarded to `395c239`, then `docker compose up -d --build` began. SSH dropped mid-build (`Timeout, server not responding`). Subsequent checks over **30+ minutes**: HTTPS and SSH both timeout (banner exchange fails). Site down at report time — likely OOM/thrash during docker rebuild on small instance (same pattern as prior successful ~24 min deploy, but recovery did not occur within window).
- **Prod re-verify:** blocked — `curl https://engram.prasadtilloo.com/` → timeout.

**Deviations:**
- **A3 narration:** Spec listed three lines keyed to step labels “CANON STORED / STILL CANON / SONY SWITCH”. Component phases show Sony at phase 2 (before Canon is superseded at phase 3) and recall split at phase 4. Wording adjusted to match actual stage semantics; added phase 0 intro and phase 4 recall line. Documented above.
- **A5 unknown pills:** No `unknown` pill values exist in photo-detail or grid — skipped.
- **A5 Memory Receipt tint:** `MemoryReceipt` prominent variant already uses `bg-brand-500/10 border-brand-500/30` — no change needed.
- **A5 uploaded date:** Added (was missing).

**Observed, not done:**
- None beyond deploy blockage.

---

## Part B — memory threads

**Commit:** `b43c527`

**Files touched:**
- `frontend/src/components/MemoryThreads.tsx` (new)
- `frontend/src/components/HomeTab.tsx` (swap `MemoryLane` → `MemoryThreads`; removed unused `buildMemoryLaneFrames` import/useMemo)

**Copy strings shipped (verbatim):**
- Section header: `Your journey, as I remember it`
- Eyebrow: `Memory threads`
- Section helper: `One thread per genre I've seen enough of — step through each to watch your eye develop. Tap a frame to open it in My Work.`
- Thread-level (progress): `{n} {genre} photos since {firstDate} — overall {first} → {latest}.` (when latest − first ≥ 0.3)
- Thread-level (neutral): `{n} {genre} photos since {firstDate}.`
- Per-photo (strongest): `Your strongest {genre} yet — {score}/10.`
- Per-photo (other): `{score}/10 · {shortDate}`
- Position: `{index + 1} of {n}`
- Aria prev/next: `Previous {genre} photo` / `Next {genre} photo`

**Grouping rule:** client-side `buildGenreThreads()` — genres with ≥2 photos, ordered by count desc, max 5, photos ascending by `createdAt`. **Live demo counts not verified** (local API unreachable; prod down). Spec’s ~landscape(6)/portrait(4)/still_life(3)/architecture(3) treated as expectation only.

**Verification evidence:**
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- Local judge walk: **not completed** (no dev server)
- **Prod deploy:** not attempted separately — server unreachable after Part A deploy hang. Code on `main` at `b43c527` then superseded by Part C.
- **Zero new Home network calls:** threads computed from existing `memoryLaneSource` pool already fetched by `HomeTab.load()`.

**Deviations:** None beyond deploy skip.

**Observed, not done:**
- **Growth comparison** at bottom of Home may feel redundant next to genre threads — **left in place** per spec (“DO NOT remove… note in report”).

---

## Part C — optional autoplay

**Commit:** `778c2cd`

**Files touched:**
- `frontend/src/components/MemoryThreads.tsx`

**Behavior shipped:**
- Per-thread play/pause button (hidden when `prefers-reduced-motion: reduce` or &lt;2 photos)
- 2500 ms interval advance with ~180 ms opacity crossfade
- Slow zoom (`scale-110` over 2500 ms) while playing
- Pauses on `mouseenter` / `focusin` on photo area; arrows still work (pause + manual `goTo`)

**Verification evidence:**
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- Local interactive autoplay check: **not completed**
- **Prod deploy:** not completed — server unreachable

**Deviations:** Shipped despite prod outage; local build gate passed (spec: “gated on Part B verifying clean” — interpreted as compile/build clean when prod unavailable).

**Observed, not done:**
- Autoplay jank check on device — not run.

---

## Deploy recovery (operator action required)

Server `8.222.253.211` / `engram.prasadtilloo.com` was unresponsive at report time. When SSH returns:

```bash
ssh -i ~/Downloads/engram-key.pem root@8.222.253.211 \
  "cd /root/engram && git pull origin main && docker compose up -d --build"
```

Expected HEAD after pull: `778c2cd`. If instance is wedged, reboot from cloud console first.

**Post-deploy smoke:** `/?judge=1` → Home (threads header + play buttons) → My Work (contact-sheet grid + dates) → photo detail (`Uploaded …`) → Mentor → Proof Room (framing sentence + narration + FAMA gloss).

---

## Summary

| Part | SHA | Deployed to prod |
|------|-----|------------------|
| A | `395c239` | Pull yes; docker build status unknown; site down |
| B | `b43c527` | No |
| C | `778c2cd` | No |

All three parts are on `main`. Frontend-only; no backend/eval/seed changes.

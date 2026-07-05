# Engram — Cursor E2E Product Review Findings

Review date: 2026-07-05  
Review basis: deployed endpoint probes (`/?judge=1`, `/health`, `/api/v1/journey`, `/api/v1/portfolio`, `/api/v1/portfolio/search`, `/api/v1/memory-stats?via=mcp`) plus current frontend/backend code inspection. I did not print or inspect `.env` contents.

## Verdict

Engram is no longer blocked: the deployed app is reachable, judge-mode APIs return seeded data, the MCP stats path round-trips successfully, and the README/video script now tell a coherent Track 1 story. The remaining risk is presentation: a first-time judge can still read the product as a polished photo portfolio/coach before they understand that the memory engine is the product. With four days left, optimize the first 60 seconds around "remembered, retired, next focus, proof."

## Status Update After Unified UX Pass (2026-07-05, later)

Review update: judge mode and normal users now share the same Home / Work / Mentor layout. Judge-specific content lives on a **precursor welcome screen** (`JudgeWelcome`) at `?judge=1`; `?judge=1` is preserved on all tab navigation.

### Fixed in Unified UX Pass

- **Coherent judge navigation:** `setTabHash()` keeps `?judge=1` in the URL; back/refresh stay in judge scope.
- **Memory strip deep-link:** clicking a memory-thread or contact-sheet photo opens that frame in My Work (`PhotoDetailView`), not just the gallery.
- **Unified Home layout:** removed judge-only Track 1 card and hidden contact sheet; everyone sees hero → journey → memory thread → at a glance → contact sheet.
- **JudgeWelcome precursor:** explains demo setup, memory thread, Proof Room; "How to evaluate" in judge banner re-opens it.
- **Memory lane readability:** milestone pills moved to a solid label bar above each photo (not overlaid on bright images).
- **Hero/contact sheet images:** `portfolioImageUrl()` normalizes `/media/...` paths for dev proxy.
- **Memory lane pool:** thread draws from oldest + recent + top-scored photos for better timeline spread.

### Fixed in Follow-Up Pass (same day)

- **[m5] Collapsible benchmark footnotes:** Proof Room "The fine print" section collapsed by default; expand for full disclosures.
- **Live proof rail (partial):** `LiveProofRail` during upload (`AnalyzingOverlay`, `PhotoUploader`) and Mentor chat loading — narrated OSS → Qwen → MongoDB → recall → retire → budget → write pipeline.
- **[M4] Persona differentiation (partial):** Journey section shows Hobbyist / Working pro badge and persona-specific framing; Home hero eyebrow and mentor insight copy differ by mode; Settings copy now matches what actually changes.

### Still Open

- **Brand / wordmark / premium darkroom redesign:** logo options in `assets/logo-options/`; no wordmark shipped.
- **Live proof rail (desktop polish):** upload rail is side panel on Home overlay only; My Work upload uses compact strip.
- **m2 Trend/delta copy:** still shows `+N pts` without strong before→now framing.
- **p3 Image dimensions:** optional layout-shift polish.
- **Deploy gap:** all fixes local on `dev`, uncommitted — production still prior build.

## Status Update After Cursor Implementation Pass

Review update: implemented judge-mode and proof-surface fixes on local `dev` (2026-07-05). Frontend build passes (`npm run build`). **Not yet deployed** — judges on production still see the prior build until this ships.

### Fixed in This Pass

- **[M1] Judge-mode Home leads with memory thesis:** `HomeTab` reorders returning judge-mode layout: Track 1 hero card → Journey → Memory thread → At a glance → supporting-evidence photo hero (not first).
- **[M2] Judge-specific walkthrough:** new `JudgeTour.tsx` (5 stops: Journey, Upload+Receipt, Photo-scoped Mentor, Proof Room+MCP, Canon/Sony example). Launches from judge banner + Home CTAs; separate storage key from generic tour.
- **[M3] Memory Receipt prominence:** `MemoryReceipt` uses Brain icon, branded label, expanded summary line, and `prominent`/`defaultExpanded` props — wired in judge mode for My Work upload results, Mentor chat, and photo detail.
- **[M5] Iris remnant — assignments card:** when practice is off or in judge mode, At a glance third card becomes **Memory proof** (skills cleared, live/retired counts) with link to Proof Room.
- **[m3] Worked example above table:** `GlassBoxTab` renders `WorkedExample` before `BenchmarkTable`.
- **[m4] MCP success label:** live stats show **Live MCP round trip confirmed** with `served_via` as muted provenance.
- **[m6] Photo-scoped Mentor copy:** `PhotoDetailView` softens copy when `storageKey` is absent.
- **[p2] Emoji in Memory Receipt:** replaced with Lucide `Brain` icon.
- **Visual memory-lane story (partial):** new `MemoryLane.tsx` — horizontal filmstrip with thread captions from portfolio + journey data (judge mode, returning users).
- **Memory Delta after upload (partial):** new `MemoryDelta.tsx` shown above Memory Receipt after critique in My Work.
- **Proof Room naming (partial):** page title, sidebar label, footer link, and judge banner now say **Memory Proof Room**; `#glassbox` hash unchanged.
- **Mobile Proof discoverability:** `BottomNav` adds **Proof** tab in judge mode; active state deselects other tabs while Proof Room is open.
- **Judge banner:** rewritten with Proof Room CTA and walkthrough launcher (replaces generic "Explore: Home · Work · Mentor").

### Still Open (Superseded — See Unified UX Pass Above)

- **Persona differentiation [M4]:** partially addressed — Journey/Home/Settings now reflect mode; no separate pro-only surfaces beyond Print Sales nav.
- **Live proof rail:** partially addressed — upload + Mentor loading rails shipped; not a persistent side panel everywhere.
- **Brand / wordmark / premium darkroom redesign:** still open.
- **Benchmark assumptions collapse [m5]:** addressed — footnotes collapsed by default.
- **Deploy gap:** fixes are local on `dev` — re-probe production after deploy.

### Previously Addressed (Claude Session — Still Accurate)

- Organize tab gating, Glass Box sidebar Proof group, trace labels, benchmark framing, skill dots, displayName, trend deltas, first-visit flag-off cards, growth-copy fixups, blank-save guard.

## Status Update After Claude's Halted Session

Review update: inspected current code after recent Claude commits through `3550d4d Review fixups: truthful growth copy, sidebar trend caption, blank-save guard`. This section supersedes any stale "fix in flight" assumptions below.

### Already Addressed

- **Organize tab breakage:** fixed for this build. `MentorTab` now gates the Organize segmented control, quick-action entry point, and Organize view behind `FEATURES.triage`; when triage is off, Mentor renders chat-only instead of exposing 404/405 routes.
- **Glass Box discoverability on desktop:** partially fixed. `AppSidebar` now has a dedicated `Proof` group and `Glass box` entry, so it is no longer footer-only on large screens.
- **Glass Box trace labels:** mostly fixed. `GlassBoxTab` now maps trace IDs to human scenario labels while keeping raw IDs muted for provenance.
- **Glass Box plain-language benchmark framing:** improved. The page now explains "with forgetting" vs. "never forgets," calls out stale-fact leakage, and explains control traces where nothing changes.
- **Skill dots / current focus confusion:** fixed. `JourneySection` now explains that each dot is a session above the bar, orders watching skills closest-to-clearing first, and labels the first row as current focus / closest to clearing.
- **Person dimension:** partially fixed. `displayName` is now persisted through `/api/v1/users/me`, editable in Settings, returned by `/api/v1/journey`, and shown as `{name}'s journey` when present.
- **At-a-glance delta grounding:** partially fixed. Home now explains recent trend as "avg of your last N uploads vs the N before," uses the most recent trend window, and rewrites the two-frame growth copy as a direct first-upload comparison.
- **Flag-off feature advertising on first visit:** partially fixed. The first-visit capability grid now hides `Practice Assignments` and `Organize & Tag` when their flags are off, and Home skips the dead assignments fetch while practice is off.

### Still Open (Superseded — See Cursor Pass Above)

The items below were accurate before the Cursor implementation pass. See **Status Update After Cursor Implementation Pass** for current state. Remaining gaps: persona differentiation [M4], live proof rail, brand/wordmark redesign, collapsible benchmark footnotes [m5], deploy to production.

### Previously Still Open (Pre-Cursor — Historical)

- **Judge-mode first impression:** addressed — Journey leads in judge mode.
- **Judge tour:** addressed — `JudgeTour` added.
- **Mobile Proof discoverability:** addressed — Bottom nav Proof tab in judge mode.
- **Memory Receipt prominence:** addressed in judge mode.
- **At-a-glance Iris remnant:** addressed — memory proof card when practice off / judge mode.
- **Visual memory-lane story:** partial — `MemoryLane` component shipped.
- **Proof Room naming:** partial — UI renamed; hash still `#glassbox`.
- **Brand / wordmark / premium darkroom redesign:** still open.

## Blocker

- None found from the reachable product/API pass. The live app returned 200 for `/?judge=1`, `/health`, `/api/v1/journey`, portfolio/search, and `/api/v1/memory-stats?via=mcp`.

## Major

- [M1] Home still leads with a photo-dashboard frame before the memory thesis — **fixed in judge mode** (`?judge=1`): Journey + memory thread lead; photo hero is labeled "Supporting evidence" and moved below At a glance. Normal (non-judge) Home order unchanged.

- [M2] Judge tour exists, but judge mode suppresses it and the tour copy is generic — **partially fixed:** generic tour still suppressed; new 5-stop `JudgeTour` added with banner/Home launchers. Desktop + mobile Proof navigation present.

- [M3] Memory Receipt is present but too quiet for the central differentiator — **fixed in judge mode:** branded, expanded-by-default receipt on upload, Mentor, and photo detail.

- [M4] Persona switch still overpromises relative to visible behavior — **partially fixed:** Journey badge + persona copy on Home; Settings describes what actually changes; Print Sales remains pro-only when enabled.

- [M5] Iris inheritance still shows through non-memory dashboard fragments — **partially fixed:** memory proof card replaces assignments when practice is off or in judge mode; My Work Iris chrome not fully hidden in judge mode.

## Minor

- [m1] Skill streak dots were accessible but not self-explanatory — **resolved in current code.** `JourneySection` now explains that each dot is a session above the bar, orders watching skills closest-to-clearing first, and labels the top row as current focus / closest to clearing.

- [m2] Score deltas are improved but still semi-abstract — where: Home "Recent trend" shows `Composition up +N pts`; My Work stats show `+N progress`. First-time judge experience: +0.6/+3.2 is less meaningful than "from 5.4 to 8.6 over 5 sessions." Fix: when possible, show before → now, or "up N points across recent uploads" next to a tiny label explaining the denominator. **Update:** Home now adds comparison context ("last N uploads vs the N before") and the growth comparison says first upload vs current strongest; still consider changing the card from "number trend" to "actionable coaching implication."

- [m3] Glass Box is much better, but a judge still has to parse a lot before the worked example — **fixed:** worked example now renders above the FAMA table.

- [m4] MCP success label is still code-shaped — **fixed:** primary label is "Live MCP round trip confirmed"; `served_via` kept as muted provenance.

- [m5] Honesty footnotes mostly land as credibility, but "fine print" can become noise — **fixed:** collapsed by default in Proof Room; expand for full text.

- [m6] Photo-scoped Mentor copy may overclaim strict scoping — **fixed:** copy adapts when `storageKey` is missing.

## Polish

- [p1] The skip link is present but remains visually hidden on focus — **already fixed in CSS:** `index.css` `.sr-only:focus` reveals the skip link on keyboard focus.

- [p2] `MemoryReceipt.tsx` uses an emoji in product UI — **fixed:** Lucide `Brain` icon + branded label in prominent mode.

- [p3] Several images lack explicit dimensions — where: gallery/contact sheet/hero images use CSS sizing only. Not a demo blocker, but it can cause layout shifts on slower judge machines. Fix only if quick: set width/height attributes where aspect ratio is known, or keep as-is if time is tight.

## Answers To The 8 Questions

1. **First-impression test:** In the first 10 seconds, I read it as a premium AI photo coach with a remembered user profile. The memory thesis is present but not dominant until Journey/Glass Box; the first visual weight still goes to "best photo in your library."

2. **Memory visibility:** Memory shows in the identity line, Journey cleared/watching state, Memory Receipt, Mentor receipt, and Glass Box benchmark. It is prominent enough after exploration, but not yet unavoidable enough for a memory-track winner. Make Journey/Receipt the first visible proof in judge mode.

3. **Comprehension audit:** Needs clearer plain language for: streak dots ("2/3 proof sessions toward clearing"), current focus ("closest to clearing"), `+N pts` ("from earlier uploads, out of 10"), "Live" memories ("eligible to be recalled"), "Superseded" ("retired but kept for audit"), FAMA ("forgetting-aware score"), lambda ("how much stale facts are penalized"), `served_via` ("Live MCP round trip confirmed").

4. **Journey coherence:** Home → My Work → Mentor → Glass Box mostly tells one story now, but Home/My Work still carry Iris-era broad-suite fragments: assignments, tags/listings, portfolio management chrome. With 4 days left, cut/hide anything that does not support memory evidence, critique, Mentor recall, or benchmark proof.

5. **Trust & honesty:** The disclosures land as credibility, especially the trace freeze and worked example. Placement suggestion: lead with the worked example, then table, then collapsible assumptions. Keep the transparency, reduce the reading burden.

6. **Visual consistency:** Warm dark language is consistent across major surfaces. The biggest hierarchy issue is not color/spacing but priority: core memory proof sometimes sits below photo/portfolio UI. Accessibility polish remains around focus-visible skip link, emoji replacement, and image dimensions.

7. **Judge tour:** Yes, add a judge-specific guided walkthrough. Launch from the `?judge=1` banner and sidebar Proof group. Five stops: (1) Journey identity + cleared skills, (2) Upload critique + Memory Receipt, (3) Photo-scoped Mentor recall, (4) Glass Box live MCP toggle, (5) Benchmark Canon/Sony worked example. Keep it optional, not a blocking overlay.

8. **Rubric scorecard:**
   - Memory mechanism central/convincing: **7/10**. Strong once discovered; first impression still too photo-dashboard.
   - Technical execution & honesty: **8.5/10**. Live APIs, MCP path, frozen eval, and disclosures are credible.
   - Demo clarity under 3 minutes: **7/10**. Video script is strong; live self-serve judge path needs stronger guidance.
   - Qwen/Alibaba/MCP proof: **8/10**. Qwen/Alibaba/MCP are documented and MCP route works; make the live proof label friendlier.
   - Polish/originality: **7/10**. Visual system is coherent, but inherited suite features still blur the product identity.

## Three Highest-Leverage Changes Before Deadline

1. **Make judge-mode Home lead with Journey + graduation.** Move/duplicate the identity line, cleared skills, current focus, and "retired advice" above the best-photo hero.
2. **Add the 5-stop judge tour and auto-expand one Memory Receipt.** This makes the memory story impossible to miss without adding new backend behavior.
3. **Replace Iris-era dashboard remnants in judge mode.** Hide assignment/listing/pro practice language and convert "At a glance" into memory proof: live memories, retired memories, skills cleared, current focus.

## Addendum: Visual Memory-Thread Redesign

This addendum captures the stronger redesign direction discussed after the first findings pass. The core issue is not only that the memory evidence is too low on the page. The deeper issue is that Engram currently explains memory mostly through text, stats, receipts, and tables. That asks judges to decipher the product. A winning MemoryAgent demo should let them see the memory thread before they understand any terminology.

### Recommended Product Reframe

The first judge-mode screen should not feel like "AI photo critic." It should feel like:

> "This coach remembers a photographer's journey, knows what advice is now outdated, and changes the next critique because of that."

For both judges and real users, the most promising pattern is a **visual memory lane**, inspired more by iPhone Memories / Google Photos than by a dashboard. The product should compile a short narrative from the user's photo history:

1. "Remember this early sunset photo?"
2. "I noticed your horizons and foreground framing needed work."
3. "A few sessions later, this changed."
4. "Now composition is cleared, so I stopped repeating that advice."
5. "Your next thread is creativity / subject impact / wildlife timing."

This tells the Track 1 story visually: persistent memory, improvement over time, timely forgetting, and next-step recall.

### Proposed Judge-Mode Hero

Replace or move the current large "Best in your library" hero in judge mode. Lead instead with a **Memory Journey Hero**:

- **Headline:** "Engram remembers this photographer."
- **Identity line:** "Natural-light landscape shooter, 16 critiques analyzed."
- **Visual thread:** 3 to 5 photo frames connected by a thin amber "memory thread."
- **Milestones on the thread:** "First critique," "Composition improving," "Lighting cleared," "Current focus: creativity."
- **Retired advice callout:** "Stopped coaching: basic composition and lighting."
- **Next-step callout:** "Now watching: creativity, 2/3 proof sessions."
- **CTA:** "Run judge walkthrough" and "See live proof."

The photo hero can still exist, but it should support the memory story rather than own the first impression.

### Memory Lane Component

Add a high-impact component, tentatively named `MemoryLane` or `JourneyFilmstrip`.

Suggested behavior:

- Horizontal filmstrip or vertical scroll sequence with 3 to 5 selected photos from the seeded journey.
- Each frame has one short caption in mentor voice, not dashboard language.
- A visible thread line connects the frames.
- Small state chips show what happened: "remembered," "improved," "cleared," "retired," "next."
- Clicking a frame can open the existing photo detail split view.
- In judge mode, it can be pre-expanded and scripted.
- For normal users, it can become a personal "Your memory this week" surface once enough photos exist.

Example copy:

- Frame 1: "Early on, I kept seeing strong light but unstable composition."
- Frame 2: "You started holding horizons and foregrounds more deliberately."
- Frame 3: "After 3 strong sessions, composition cleared."
- Frame 4: "I stopped repeating beginner composition advice."
- Frame 5: "Now I am watching subject impact."

This is more emotionally legible than "+0.6 composition" and more visually memorable than a benchmark table.

### Memory Delta After Upload

A new upload should not just show a critique. It should show how the memory changed.

After a photo is analyzed, add a **Memory Delta** panel:

- **Added to memory:** "You are experimenting with foreground framing."
- **Reinforced:** "Landscape remains your strongest genre."
- **Progress changed:** "Creativity moved from 2/3 to cleared" or "Technique remains 1/3."
- **Retired / skipped:** "Basic horizon advice stayed retired."
- **Next critique focus:** "Subject impact is now the next coaching target."

This is crucial because the current judge data is pre-seeded. The product must prove that a new interaction updates the memory thread live, not only that old data exists.

### Live Proof Rail

Do not rely on browser DevTools. Build an in-product proof rail or momentary overlay that appears during key interactions.

During upload, show a right-side "Behind the scenes" rail:

1. Photo saved to Alibaba OSS.
2. Qwen-VL analyzing composition and lighting.
3. MongoDB memory lookup started.
4. Engram recalled live memories.
5. Engram skipped retired memories.
6. Context packed under token budget.
7. New memory written after critique.

During Mentor chat, show a smaller version:

1. User question received.
2. Relevant memories recalled.
3. Retired memories excluded.
4. Reply streamed from Qwen.

This makes the architecture visible without asking judges to inspect network calls.

### Glass Box / Proof Reframe

"Glass Box" is elegant, but it may still be too abstract for a judge moving quickly. In judge-facing navigation, use plain language:

- Sidebar group: `Proof`
- Page title: `Memory Proof Room`
- MCP success label: `Live MCP round trip confirmed`
- Raw provenance: `served_via: engram-mcp`

Move the Canon/Sony worked example above the full FAMA table. A human example should come before metrics:

> "The old system recalls Canon and Sony. Engram recalls Sony only because it knows the Canon fact is stale."

Then show FAMA/token numbers as supporting evidence.

### Brand And Visual Direction

Current warm dark direction is appropriate, but the product still feels like a competent dark app with many cards. It does not yet feel like a distinct, premium, memory-first brand.

Recommended visual direction: **editorial darkroom luxury**.

- Use deep espresso / black-brown neutrals rather than generic dark gray.
- Use amber as a "light leak" or contact-sheet marker, not generic SaaS accent.
- Use fewer equal cards and more cinematic sequencing.
- Lean into serif storytelling moments for Journey/Memory Lane.
- Reduce dashboard density in judge mode.
- Treat photos as physical artifacts: contact sheets, filmstrips, proof marks, annotations.
- Keep proof surfaces technical, but make the main journey emotionally visual.

The desired feeling is a private mentor's darkroom notebook with live AI proof behind it, not an analytics dashboard.

### Logo / Wordmark Direction

The icon can remain as an app mark, but the judge/demo surface would benefit from a wordmark.

Recommended direction:

- Custom `Engram` wordmark, not just icon plus text.
- Subtle lens/aperture treatment inside one letter, likely `g` or `e`.
- Fine neural or memory-thread lines woven through one letter only.
- Avoid obvious brain icons.
- Avoid generic camera + text.
- Keep it gallery/editorial, refined, and legible at header sizes.

The brand should separate Engram from Iris. Iris can feel like the prior photography mentor. Engram should feel like a memory engine with a photography demo.

### What To Hide In Judge Mode

Hide or de-emphasize anything that makes the app feel like a broad Iris extension:

- Assignments done / "Coming soon"
- Print sales
- Listing language
- Generic tag management
- Practice surfaces unless they directly support graduation
- Dense sort/filter controls unless the judge intentionally opens Library

Judge mode should be brutally focused on four things: Journey, Upload, Mentor, Proof.

### Implementation Priority For Claude

If time is short, do this in order:

1. **Judge-mode Memory Journey Hero:** Move the memory story above the photo hero and include cleared/retired/current-focus proof.
2. **Static seeded Memory Lane:** Build a filmstrip from existing portfolio/journey data. It can be deterministic for the demo user first.
3. **Memory Delta after upload:** Show what changed after a new critique, even if the first version uses existing response fields plus memory receipt.
4. **Live proof rail:** Add a lightweight overlay/side rail for upload and Mentor interactions.
5. **Proof Room copy cleanup:** Rename judge-facing labels and move the worked example above the table.
6. **Brand polish:** Wordmark, spacing, fewer equal cards, more darkroom/editorial visual rhythm.

This direction serves both audiences: judges immediately understand the MemoryAgent story, and real photographers get a more useful product because their progress is shown as a visual journey rather than buried in statistics.


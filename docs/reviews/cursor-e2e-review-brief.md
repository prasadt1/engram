# Engram — End-to-End Product Review Brief (for Cursor)

> **You are being asked to review a product, not a codebase.** Read this brief,
> then walk the product the way a first-time hackathon judge would, and write
> your findings to `docs/reviews/cursor-e2e-review-findings.md`. Code quality
> matters only where it surfaces as user-visible behavior. This is a living
> document — it will be updated between review rounds. First pass: 2026-07-05.

---

## 1. What you are reviewing

**Engram** — a forgetting-aware memory engine for Qwen agents, demonstrated
through a flagship AI photography coach.

**The one-line pitch:** *An AI photography coach that remembers your journey,
forgets what you've mastered, and always knows your next step.*

**The core thesis:** agent memory that only ever accumulates gets worse — stale
facts leak into context, superseded preferences contradict current ones, and
token costs balloon. Engram's memory engine scores recall by salience,
graduates skills out of active coaching (WATCHING → CLEARED), and forgets via
supersession links instead of deletion. The demo proves this with a benchmark:
identical recall accuracy to a never-forget baseline at ~1.72× lower token
cost, with zero stale-fact leaks (FAMA 1.0 vs 0.6385 — see `README.md`).

- **Live app:** https://engram.prasadtilloo.com (judge mode: append `?judge=1`)
- **Repo layout:** FastAPI backend in `app/`, React/Vite/Tailwind frontend in
  `frontend/`, eval harness in `eval/`, MCP server in `engram-mcp/`,
  architecture decision records in `docs/architecture/` (8 ADRs — read them,
  they explain the why behind most engineering choices).
- **Run locally:** backend `uvicorn app.server:app` (needs `.env` with
  `DASHSCOPE_API_KEY` + `MONGODB_URI` — do NOT print `.env` contents),
  frontend `cd frontend && npm run dev`, then `http://localhost:5173/?judge=1`.
  Tests: `.venv/bin/python -m pytest` (184+ should pass).

## 2. The competition context (judge with this lens)

- **Event:** Global AI Hackathon Series with Qwen (Alibaba Cloud).
- **Track 1: MemoryAgent** — build an agent with a memory layer that
  demonstrably improves the agent experience. The memory story is the
  submission; the photo coach is the vehicle.
- **Deadline:** July 9, 2026, 2 PM PT. Devpost article draft:
  `docs/DEVPOST-DRAFT.md`. Demo video script: `docs/demo-video-script.md`.
- **Required tech:** Qwen Cloud models (we use `qwen-vl-max` for photo
  critique, `qwen3.6-flash` for chat/repair, `qwen3.7-max` for shape-repair),
  Alibaba Cloud hosting (ECS Singapore + OSS; proof in
  `docs/ALIBABA_CLOUD_PROOF.md`), MCP integration (`engram-mcp`).
- **Assume the judging rubric rewards:** (1) how central and convincing the
  memory mechanism is, (2) technical execution and honesty of claims,
  (3) demo quality — can a judge *see* the memory working in under 3 minutes,
  (4) real use of Qwen/Alibaba services, (5) polish and originality.

**Solo builder** (Prasad), ported and rebranded from a prior Gemini-based
project ("Iris"). A standing concern the review must probe: **does the product
still read as a general photo-coach UI with memory bolted on, or does the
memory story lead?** The builder himself suspects the Iris inheritance shows.

## 3. The intended customer journey (walk this exactly)

1. **Land on Home (`?judge=1` — pre-seeded returning user).** Should read as
   a *journey*, not a dashboard: an identity line ("You're a landscape shooter
   …"), a voiceover narrating progress, skill states (cleared / watching),
   recent work, and a clear next step. **Judge question: within 15 seconds, do
   you understand that this app *remembers* this person?**
2. **My Work.** Library of critiqued photos. Search it (try "person",
   "portrait", "mountain"). Expand a photo: per-dimension scores, critique,
   "similar in your library" row, and a **memory receipt** showing what the
   coach recalled to personalize this critique. Note: some seeded photos are
   known-broken placeholder stubs ("A photograph under review…") — a re-seed
   is pending; flag any you see but don't dwell.
3. **Upload a photo** (Home → Upload photo). Expect a full critique in
   ~30-40 s. This is the product's centerpiece interaction.
4. **Mentor.** Chat with the coach. Ask "why is my latest photo rated low?"
   and "what should I work on next?" — replies should be grounded in *this
   user's* history (structured reply: headline → labeled beats → full note).
5. **Glass Box** (sidebar/footer). The proof page: live memory-DB stats (with
   a real MCP round-trip toggle), the FAMA benchmark table
   (forgetting-enabled vs no-forgetting ablation), a worked example, honesty
   footnotes. **Judge question: does this page convince you the memory claims
   are real, within 60 seconds, without prior context?**
6. **Settings.** Switch persona (hobbyist → working pro). This should visibly
   change the coaching frame. (Known gap being fixed — verify whatever state
   you find.)

## 4. Design language (evaluate consistency against this)

- **Theme:** warm dark. Canvas `#1a1816`, elevated `#242120`, surfaces
  `#2a2724`→`#3d3834`, border `#44403c`. Brand accent: amber ramp
  (`#f59e0b` core). Text: warm off-whites/greys.
- **Type:** DM Sans (UI), Newsreader serif (display/wordmark moments).
- **Voice:** first-person mentor — warm, specific, honest, never corporate.
  Honesty is a design principle: disclosures are rendered, not hidden.
- **Motion:** expo/spring easings, fade-in on section mount.
- Review for: consistency of spacing/typography across tabs, dead ends,
  jargon leaking into user-facing copy, information density (the builder's
  own critique: "even I feel lost in this information").

## 5. Known issues & active work (do not re-report; verify fixes if present)

| Area | Status |
|---|---|
| Mentor "Organize" sub-tab dead (backend never built) | fix in flight: gated off behind `FEATURES.triage` |
| Glass Box hidden in footer; cryptic labels (`trace_1`, `fama_default_1`) | fix in flight: sidebar nav entry + plain-language explainers |
| Skill dots unexplained (why is 2-dot creativity the "current focus" over 1-dot technique?) | fix planned: legend + ordering |
| "At a glance" deltas (+0.6, +3.2) not relatable | fix planned: reframed copy |
| No person in the story — "you are a landscape shooter" but never *who* | fix planned: surface photographer identity |
| Persona switch does nothing visible | fix planned: persona-differentiated Home framing |
| 7/16 demo photos are inert placeholder stubs from failed seeding | re-seed pending (pipeline since hardened) |
| Practice & Print Sales tabs | deliberately deferred (feature-flagged off) |
| Judge onboarding tour | open design question — **we want your opinion, see §6 Q7** |

## 6. What we want from you (deliverable)

Write `docs/reviews/cursor-e2e-review-findings.md` with severity-ranked
findings (Blocker / Major / Minor / Polish), each with: where, what a
first-time judge experiences, why it matters against the rubric, and a
concrete suggested fix. Answer these directly:

1. **First-impression test:** open `?judge=1` cold. What do you think this
   product *is* in the first 10 seconds? Is the memory thesis legible before
   you read any docs?
2. **Memory visibility:** where does the memory actually *show itself* in the
   UI (identity line, receipts, graduation, forgetting)? Is it prominent
   enough to win a memory-track hackathon, or does it read as a generic
   coach app? Be blunt.
3. **Comprehension audit:** list every label, number, or section a first-time
   viewer cannot decode without help (the builder's examples: skill dots,
   +0.6/+3.2 deltas, FAMA tables, trace names). Propose plain-language
   replacements.
4. **Journey coherence:** does Home → My Work → Mentor → Glass Box tell one
   story, or four? Where does the Iris inheritance show (features that exist
   because the old product had them, not because the memory story needs
   them)? What would you cut entirely with 4 days left?
5. **Trust & honesty:** the product renders its own disclosures (token
   estimates, λ derivation, trace freeze dates). Does this land as
   credibility or as noise? Placement suggestions?
6. **Visual consistency:** spacing, hierarchy, empty states, error states,
   responsive behavior at laptop widths judges actually use.
7. **Judge tour:** should there be a guided tour/walkthrough overlay for
   judges (vs. the current self-serve layout)? If yes, sketch the 5 stops
   you'd put in it and where it should launch from. If no, say why.
8. **Rubric scorecard:** score the current state 1-10 on each rubric
   dimension in §2 with one sentence of justification each — then list the
   three changes that would move the total the most before July 9, 2 PM PT.

## 7. Ground rules

- Judge the deployed behavior, not intentions. If a claim in this brief
  doesn't match what you see, that mismatch is itself a finding.
- Don't propose new features that can't ship in <2 days by one person.
- The benchmark numbers are frozen and committed (`eval/`); challenge their
  *presentation*, not their computation, unless you find an actual error.
- Never print `.env` contents or secrets in your findings.

---

*Revision history: v1 2026-07-05 — first pass, written mid-bugfix-sprint;
expect §5 statuses to change. Update statuses before each review round.*

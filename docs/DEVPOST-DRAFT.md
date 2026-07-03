# Devpost submission draft — living document

> Working draft mapped 1:1 to the Devpost form pages. Legend: ✅ ready to paste · 🔄 living (update as we build) · ⬜ blocked (needs an artifact or a decision).
> Last updated: 2026-07-03

---

## Page 1–2 · Project name + elevator pitch

**Project name (≤60 chars)** ✅ decided:
> `Engram — the AI photo coach that remembers (and forgets)` (57)

**Elevator pitch (≤200 chars)** ✅ draft:
> An AI photography coach that remembers your journey, forgets what you've mastered, and always knows your next step — built on Engram, an open-source forgetting-aware memory engine for Qwen agents. *(~198)*

---

## Page 3 · Project story (public page, Markdown)

### Inspiration ✅ draft
Every AI photo tool today is an amnesiac critic. Lightroom edits, AfterShoot culls, and ChatGPT/Gemini/Qwen will happily critique a single photo — then forget you exist. You re-explain yourself every session, get the same beginner advice forever, and nothing knows whether you're actually improving. Memory is the difference between a critic and a **coach**: someone who knows where you started, notices what you've mastered, and moves the goalposts as you grow. I built Iris (a Gemini/Google-ADK photography mentor) for a previous hackathon and realized its most valuable organ wasn't the critique — it was the memory. Track 1's brief (efficient retrieval, **timely forgetting**, recall under context limits) named exactly the engine I wanted to build.

### What it does ✅ draft (tighten after build)
A longitudinal photography coach with a real memory:
- **Glass-box critique** — upload photos, get scored, reasoned feedback (Qwen-VL), each photo genre-tagged into your evolving profile.
- **Journey home page** — the memory made visible: what the coach knows about you, progress timeline with cleared/watching milestones, your emerging genre identity, and the one thing to work on next.
- **Coaching that forgets** — when trends prove you've mastered a weakness (3 consecutive sessions above bar), it *graduates*: retired from coaching, celebrated on your timeline, excluded from context. Forgetting rendered as promotion, not deletion.
- **Memory-aware Mentor chat** — ask "how am I doing at night photography?" and get an answer grounded in your actual history: recall specifics → what's been retired → current focus. Works globally or scoped inline to any single photo in your library.
- **engram-mcp** — the engine exposed as a custom MCP server (`recall / consolidate / forget / get_memory_stats`) any Qwen agent can mount.
- **/eval benchmark** — one command reproduces the recall accuracy, FAMA forgetting score, and token-cost savings vs. a full-history baseline, with ablations.

### How I built it 🔄 (skeleton now, war stories as they happen)
- Re-platformed Iris from Google ADK + Gemini + GCS + Cloud Run → **Qwen Cloud** (OpenAI-compatible DashScope endpoint) + **Alibaba SAS** + **Alibaba OSS**, keeping MongoDB Atlas as the memory store.
- Replaced the ADK orchestrator with a hand-rolled tool-calling loop; specialists (Coach/Mentor/Reflection) are prompts + tools, routed per endpoint or via Qwen function-calling for open-ended chat.
- Model routing: `qwen-vl-max` (vision critique + genre tagging), `qwen3.7-max` (reasoning/forgetting decisions), `qwen3.6-flash` (cheap extraction/judging) — IDs config-driven, tokens/latency/cost logged per call.
- Memory engine: salience-scored recall → progress-driven supersession (trends deltas drive forgetting) → episodic→semantic consolidation → token-budget context packing.
- [ ] add: what actually happened during the build

### Challenges I ran into 🔄 (capture as they occur — do not write retroactively)
- ✅ (Jul 3) **The undocumented key prefix.** Docs describe `sk-` (pay-as-you-go → dashscope-intl) and `sk-sp-` (token plan → maas endpoint); my Qwen Cloud key arrived as `sk-ws-`, matching neither. Rather than guess, I built a dual-endpoint smoke test that tries both and reports which works — verdict: `sk-ws-` keys route to the standard dashscope-intl pay-as-you-go endpoint. The script now ships in `scripts/smoke_test_qwen.py` so nobody else burns an hour on this.
- ✅ (Jul 3) **Alibaba Cloud intl identity verification queued at "3 business days"** right at project start. Mitigation: built the storage layer as a pluggable backend (local disk dev → OSS via one env flip) so the wait cost zero build hours.
- ✅ (Jul 3) **Cross-model review caught a silent frontend-contract break.** Before building, I ran the full plan through an independent GPT-5.5 review (after three Claude review rounds had already passed it). It found my planned upload endpoint used form field `file` while the reused frontend posts `image` — every upload would have 422'd — plus a missing required `portfolioEntryId` and the portfolio read routes the home page hard-depends on. It also pushed the memory engine from salience-only recall to query-relevant, *explainable* recall (importance × recency × relevance, per-item score breakdown). Lesson: reviewers from different model families catch different bugs.
- ✅ (Jul 4) **Gemini enforces your schema; Qwen trusts your prompt.** The first live Qwen-VL critique failed Pydantic validation with seven errors — `critique` arrived as one prose string instead of a four-key object, two score dimensions went missing (the model invented an `overall` score instead), `glassBox` dropped required arrays, and `secondary_subjects` came back as the string `"none"`. Root cause: Gemini's `response_schema` enforced our shape server-side; Qwen's JSON mode only guarantees *valid* JSON, so the shape has to live in the prompt. Fixes: an explicit JSON skeleton in the prompt (show, don't describe), plus a generic shape-repair retry — on validation failure, the raw JSON and the validation errors go back to the reasoning model once for correction. My favorite of the seven: the model returned `genre: "still_life"`, refusing my enum because the test photo genuinely *was* a still life and my taxonomy lacked it. The model was right; `still_life` is in the enum now. Second run: clean pass, ~26s end-to-end, grounded citations intact.
- [ ] candidates to watch for: whether Qwen-VL populates `spatialMetadata.annotations` on flawed photos (zero on a clean test shot — inconclusive) · MCP registration path (Responses API vs Qwen-Agent)

### Accomplishments that I'm proud of 🔄
- ✅ (Jul 4) **Engram's first live critique.** A terracotta pot on a wooden table: scored 7.5/8.0/8.5/6.5/7.0, called the shot "well-executed... though compositionally conservative," suggested a rule-of-thirds reposition with a leading line, cited three principle docs from the grounding corpus, and correctly classified the genre it had taught *us* the day before. 26 seconds end-to-end through prompt → Qwen-VL → validation → storage.
- [ ] the benchmark table (fill with real numbers)
- [ ] the graduation moment working end-to-end in the live demo
- [ ] shipping a reusable OSS memory layer, not just an app

### What I learned 🔄
- [ ] fill during build (candidates: forgetting is harder than remembering; measuring memory honestly; porting agents across model families)

### What's next (roadmap) ✅ draft — the idea vault
1. **Live field coaching returns.** Iris's original mobile arc: point your phone, get composition guidance *before* you click, capture — and the shot plus its critique sync straight into your memory timeline on the web. The field session becomes just another memory-writing surface.
2. **Memory-driven challenges (gamification).** Iris already had coach-assigned practice exercises (Planner agent — deferred in this build). They return supercharged: challenges generated *from your memory profile* — targeted at your watching-list weaknesses, in the genre you're closest to leveling up, with graduation as the win condition. Streaks, cleared-skill badges, monthly recap cards.
3. **A domain-agnostic memory engine.** The loop I built — learn → remember → recall → forget → evolve — has nothing photography-specific in it. `engram-mcp` + domain adapters: a *student* coach that tracks subjects mastered and retires remediation; a *patient-journey* companion that supersedes outdated symptoms/treatments; a *financial* coach that graduates budgeting habits. Photography is adapter #1; the engine is the product.
4. **Pro persona, fully lit.** Print-sales drafting and portfolio triage (built in Iris, gated in this submission) return on top of the pro memory profile: style signature, client context, gear eras.
5. **Ask-your-portfolio, deeper.** Multi-hop memory queries ("show me how my low-light work changed after I switched lenses") and monthly narrative recaps.

### Built with ✅
⚠️ This Devpost field is a **tag input**, not free text — add each line below as its own tag (Enter/comma after each). No punctuation inside a tag; that's why pasting the old `·`-separated line failed.
```
Python
FastAPI
React
TypeScript
Vite
Tailwind CSS
Qwen
DashScope
MCP
MongoDB
MongoDB Atlas
Alibaba Cloud
OSS
Docker
```
(Full detail with exact model IDs and version numbers lives in "How I built it" above — this field is just searchable tech tags.)

### "Try it out" links ⬜
- [ ] Live demo (SAS box URL) — after day-1 deploy
- [ ] GitHub repo — `https://github.com/prasadt1/engram` (Prasad runs the provided `gh repo create` command, then I push)

### Image gallery 🔄 (3:2 ratio, up to 15)
- [ ] Journey page with a graduation moment · glass-box critique with "why this advice" · inline photo chat · benchmark table · architecture diagram · before/after coaching pair

### Video demo link ⬜ — day-6 recording (three-act arc, <3:00, public)

---

## Page 4 · Additional info (judges/organizers)

- **Submitter type:** Individual ✅
- **Country of residence:** ⬜ [Prasad confirms]
- **Newly built or previously existing:** **New — with lineage fully disclosed** ✅ (decided Jul 3: new repo, new name, new UI, new engine, new cloud; built on my own Apache-2.0 Iris foundation, stated openly everywhere)
- **Project start date:** 07-03-26 (Engram); the Iris foundation predates May 26 and is disclosed below ✅
- **Lineage disclosure (⚠️ compliance-critical — paste into the explanation field even though we mark "new", and echo in the description):** ✅ draft:
  > Engram is a new product built during the submission period on my own open-source foundation: Iris (Apache-2.0, github.com/prasadt1/iris-photography-mentor), a Gemini/Google-ADK photography mentor I built earlier this year. Everything that defines Engram is new work from the submission period: (1) the forgetting-aware memory engine — salience-scored recall, progress-driven graduation/supersession, episodic→semantic consolidation, token-budget context packing; (2) the custom engram-mcp server exposing it to any Qwen agent; (3) the reproducible /eval benchmark (recall, FAMA, token savings + ablations — with Iris-style naive recall as the measured baseline); (4) the full Qwen Cloud port (`qwen3.7-max`, `qwen-vl-max`, `qwen3.6-flash` via the DashScope OpenAI-compatible API), replacing Gemini + Google ADK with a hand-rolled tool-calling loop; (5) the Alibaba Cloud deployment (SAS + OSS); (6) the rebuilt memory-first UI (Journey page, graduation timeline, inline photo-scoped chat). Reused from my Iris foundation and disclosed in the README: MongoDB schemas, portfolio/trend utilities, and base React components.
- **Track:** Track 1: MemoryAgent ✅
- **Repo URL:** `https://github.com/prasadt1/engram` — ⬜ Prasad runs `gh repo create` (command provided), then I push
- **Proof-of-deployment code file URL:** ⬜ → will be permalink to `app/storage/oss_client.py` (+ `docs/ALIBABA_CLOUD_PROOF.md`)
- **Architecture diagram (pdf/png/jpg):** ⬜ day-6 render of spec §6
- **Alibaba deployment screenshot (png/jpg):** ⬜ capture day 1, the moment the SAS box runs
- **Blog/social post URL (bonus prize):** ⬜ — separate deliverable. Working title: *"Teaching a Qwen Agent to Forget: building an open-source, benchmarked memory layer on Alibaba Cloud."* Draft lives in BLOG-DRAFT.md (to be created).
- **AI tools leveraged:** ✅ Claude Code (planning, pair-programming, code generation); Qwen models in-product; disclose honestly.
- **Level of learning:** Significant ✅
- **Eligibility checkboxes:** ✅ affirm at submission

---

## Idea vault (unplaced, don't lose)
- "Since last time" recap as email digest (retention hook / B2C).
- Coach personality continuity — tone adapts as user levels up (beginner encouragement → peer critique).
- Public "graduation card" share image (organic growth loop).
- Memory export — your profile is yours (JSON download; trust + portability story).

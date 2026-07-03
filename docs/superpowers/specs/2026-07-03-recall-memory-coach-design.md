# Engram — a forgetting-aware memory coach (built on Iris, powered by Qwen Cloud)

> Naming (decided Jul 3): product + engine = **Engram**; the MCP server ships as **engram-mcp**; new public repo `prasadt1/engram`; Devpost form answer = "New, lineage disclosed."

**Date:** 2026-07-03 · **Status:** Draft for review · **Author:** Prasad Tilloo (with Claude)
**Target:** Global AI Hackathon Series with Qwen Cloud — **Track 1: MemoryAgent** · Submission deadline **Jul 9, 2026, 2:00 PM PT**

---

## 1. Context and goal

[Iris Photography Mentor](https://github.com/prasadt1/iris-photography-mentor) is an AI photography mentor I built on Google ADK + Gemini + MongoDB for a prior hackathon. Engram (this repo) re-platforms it onto **Qwen Cloud + Alibaba Cloud** and elevates its implicit memory into an explicit, measurable, **forgetting-aware memory engine** — the submission's core contribution.

Judging weights: Innovation 30%, Technical Depth 30% (both explicitly reward sophisticated Qwen API use, MCP integrations, algorithmic innovation), Problem Value 25% (productization or OSS-adoption potential suffices), Presentation 15%. Track 1 names three focus areas verbatim: **efficient storage/retrieval, timely forgetting of outdated information, and recall within limited context windows.** Every design choice below maps to one of these.

## 2. Product thesis

Existing tools (Lightroom, AfterShoot, one-shot ChatGPT/Gemini/Qwen critiques) are **amnesiac critics**: they react to a single photo, repeat beginner advice forever, and know nothing about the photographer. Memory is what turns a critic into a **coach** — something that knows you, remembers where you started, and grows with you. The memory is not a feature of the product; it **is** the product.

Four user-value lenses, all views over **one shared memory profile** (not four features):

1. **Progress** — "show me how far I've come" (trajectory, cleared milestones, best vs. worst).
2. **Identity** — "who am I becoming as a photographer" (genre distribution, which genre is improving fastest).
3. **Next step** — "the one thing to work on now" (evolving focus; retired advice = felt benefit of forgetting).
4. **Patterns** — "what one photo can't tell me" (cross-portfolio synthesis).

Plus a **conversational lens**: the Mentor chat, whose answers make recall and forgetting legible ("your night shots improved — I've stopped coaching exposure; now I'm watching focus in low light").

## 3. Personas

- **Enthusiast (demo spine):** improving amateur. Memory = evolving skill profile, recurring weaknesses, goals, genre mix. Forgetting = retiring demonstrably mastered weaknesses and stale preferences.
- **Pro (documented extension, not built):** same engine, different memory profile — style signature, client/project context, gear eras. Pro-only surfaces from Iris (print sales, triage) are hidden behind the existing persona flag.

## 4. Customer journey — three acts (the demo arc is the user arc)

- **Act 1 — Meet.** First visit; inviting empty state ("upload your latest shots and I'll start learning you"). First batch → glass-box critique per photo, genre tag, scores; the memory card visibly starts filling.
- **Act 2 — Grow.** Subsequent sessions. Critiques cite the past ("your horizons tilted last outing — this one is level"). Journey page populates: trend lines, emerging genre identity, watching-list of active weaknesses.
- **Act 3 — Graduate (climax).** Return visit: "since last time" recap; a weakness **clears** — moves to the graduated shelf, the coach announces it has stopped watching it, the next-step focus updates, and Mentor chat proves it conversationally. Forgetting rendered as promotion, not deletion.

## 5. Surfaces and navigation

Navigation collapses to **Journey · Upload · Library · Mentor** (+ a footer "Glass box" link). Pro-only and deferred screens are hidden via the existing persona/feature flags (minutes of work; no orphaned UI for judges to stumble into).

1. **Journey (new home page).** Evolves the existing `MemoryTab.tsx`/`HomeTab.tsx` into the hero surface: memory card ("what Iris knows about you"), progress timeline with cleared/watching milestones, genre-identity panel (bar/spark per genre), single next-step focus card, "since last time" recap for returning users. Reuses `MiniSparkline`, `DimensionBar`, `FocusAreas`.
2. **Upload & Critique (existing, tweaked).** Same glass-box critique UI; adds (a) genre chip per result, (b) a "why this advice" strip listing the memories `recall()` pulled for this critique.
3. **Library (existing grid, memory overlay).** Genre filter chips, milestone badges on photos ("first cleared horizon," "best night shot"), "biggest improvement" sort. Photo URLs switch from GCS to **Alibaba OSS signed URLs** — invisible to the grid code. Clicking a photo opens the lightbox with an **inline photo-scoped MentorChat** beneath it.
4. **MentorChat (one reusable component, two modes).** Extracted from `MentorTab`/`MentorChatTurn`. Props: `scope: 'global' | { photoId }`. Global mode = Mentor page; scoped mode = under any photo. Backend: the existing chat route `POST /api/v1/agent/chat` (`app/api/server.py:199`) gains optional `photo_id`; `recall()` filters memory to that photo + related history. Standard response shape baked into the prompt: *recall specifics → celebrate retired items → current focus.* A collapsible glass-box panel under each reply shows the actual `recall()` call and memories used.
5. **Glass box / benchmark (new, small, judge-facing).** Memory stats (`get_memory_stats()`), benchmark results table, token-savings chart. Footer-linked; ignorable by normal users.

## 6. System architecture

```
Browser (React 19 + Vite, reused)
   │ JSON
FastAPI backend (reused routes) ── Docker ── Simple Application Server (SAS), ap-southeast-1 Singapore
   ├── Orchestration loop (NEW, replaces ADK):
   │     • endpoint-routed dispatch for fixed flows (upload → Coach, etc.)
   │     • Qwen function-calling for open-ended Mentor chat (tools = specialists + memory ops)
   ├── Specialists (prompt + tools, reused prompts, re-tuned):
   │     Coach (vision), Mentor (text), Reflection (text)   [Planner, Field Coach, Triage,
   │     Print Sales, Visual Describer: ported last or gated off]
   ├── Memory engine (NEW, plain Python):
   │     remember (write per photo/session) · recall (salience-scored, scope-filterable)
   │     forget (progress-driven supersession) · consolidate (episodic→semantic)
   │     pack (token-budget context packing)
   ├── engram-mcp server (NEW): typed tools recall / consolidate / forget / get_memory_stats
   │     (SSE; registered via Responses API or Qwen-Agent — decision timeboxed to day 1–2
   │      after a smoke test of both; PyMongo fallback stays wired either way)
   ├── qwen_client (NEW): OpenAI-compatible client → https://dashscope-intl.aliyuncs.com/compatible-mode/v1
   │     model IDs in config; retry/backoff; JSON-repair loop; per-call token/latency/cost logging
   └── oss_client (NEW): Alibaba OSS via oss2, private bucket + signed URLs  ← primary Alibaba proof file
MongoDB Atlas (KEPT as-is): portfolio, profile, assignments, approvals
```

**Model routing (config-driven; verify exact minor versions in console at build time):**
- Vision critique + genre tagging: `qwen-vl-max` / `qwen3.x-plus` (multimodal tier)
- Reasoning (forgetting decisions, consolidation, Mentor): `qwen3.7-max` (fallback `qwen3-max`)
- Cheap ops (extraction, dedup, relevance scoring, judge): `qwen3.6-flash` (fallback `qwen-flash`)

**What ADK did → what replaces it:** agent definitions (prompt + tools + model) already live in `app/prompts/*.txt` and port as-is with re-tuning; the router + plumbing become a ~200-line hand-rolled tool-calling loop. Coach's Google Agent Builder grounding (photography `principles/` corpus) is re-implemented as a local retrieval tool over the same corpus.

## 7. Memory data model

**Kept:** all Pydantic schemas (`schema.py` — CoachAnalysisOutput etc. double as Qwen JSON validators), `portfolio.py`, `trends.py` (per-dimension deltas — becomes the forgetting signal), `supersession.py` (bidirectional superseded_by/supersedes — becomes the forgetting mechanism), `aesthetic_profile.py`, `mcp_reads.py` (MCP-vs-PyMongo abstraction).

**New/extended:**
- `photo` docs gain `genre` (Qwen-VL classification at analysis time) — backbone of the identity lens *and* category-scoped chat queries.
- `memory_profile` doc (first-class, per user): skills[] with status `watching | cleared | archived`, `raised_on`, `cleared_on`, evidence photo ids; genre distribution + per-genre trend; goals/preferences with `valid_from` / `superseded_by`; consolidated semantic facts.
- Salience metadata per memory item: importance × recency × relevance inputs for `recall()` scoring and `pack()` budgeting.

## 8. Forgetting semantics (the Track-1 core)

Forgetting here is **not deletion** — it is supersession + retirement, always evidence-driven and user-visible:

1. **Mastery graduation:** `trends.py` detects a sustained positive delta on a watched skill (threshold: **N = 3 consecutive sessions above bar**, config-tunable; the seed data in §10 MUST be generated to cross exactly this threshold, since the Act-3 demo climax depends on it) → skill status `watching → cleared`; related stale critiques marked superseded; coach stops surfacing them. UI: graduation moment on Journey + Mentor phrasing.
2. **Preference supersession:** contradicted facts ("switched Canon → Sony") get `superseded_by` links; only current facts are recallable by default.
3. **Salience decay:** old low-importance episodic items lose recall priority and fall out of the packed context (never out of the DB).

`recall()` excludes superseded/cleared items by default (retrievable with `include_archived=true`). `pack()` fits surviving salient memories into an explicit token budget (greedy by salience, tail summarized) — the "limited context window" requirement made mechanical.

## 9. Benchmark / eval (the evidence spine)

`/eval` directory, one command: `python -m eval.run --seed 0` → deterministic, prints a Markdown table, commits raw results JSON. Dataset: 20–40 scripted multi-session traces (facts tagged `valid_from`/`invalidated_by`, some later contradicted), Qwen-drafted + hand-verified (disclosed). Metrics:
- **Recall accuracy** (single- and multi-hop QA over past sessions; exact-match where possible + Qwen-judge with disclosed spot-check agreement).
- **FAMA** (published forgetting-aware metric): MPA (valid memories surfaced), FAA (obsolete memories excluded), FAMA = max(0, MPA − λ(1−FAA)), with **λ = N_forget / (N_presence + N_forget)** derived from the trace set (per the published definition) and disclosed alongside results.
- **Token/cost savings** vs. full-history stuffing baseline (target the known ~3–4× reduction, measured on our data).
Ablations: forgetting OFF, consolidation OFF. Baselines: full-context stuffing; naive top-k without forgetting. Framed honestly as a "diagnostic suite," never cherry-picked.

## 10. Seed data

`scripts/seed_demo_user.py`: ~15–20 Unsplash photos (license permits; sources credited in repo) across 3–4 genres, mixed quality, arranged into 4–5 **dated sessions** showing one skill genuinely improving to the graduation threshold. Powers the demo video, judge click-around, and gives the Journey page a living state on login. Eval traces are related but separate (synthetic facts, not the demo user).

## 11. Deployment and proof (hard gates)

- Backend: Docker on **SAS (Simple Application Server), ap-southeast-1**, ~$19/mo plan; frontend served from the same box.
- Photos: **Alibaba OSS**, private bucket, signed URLs (`oss_client.py`).
- `docs/ALIBABA_CLOUD_PROOF.md`: SAS console "Running" screenshot (captured day 1) + line-linked permalinks to `oss_client.py` and `qwen_client.py`.
- Keys: plain `sk-` key ↔ `dashscope-intl` base URL only (the `sk-sp-`/token-plan endpoint mismatch 401 trap); `base_url` and all model IDs as env/config.

## 12. Error handling

Retry/backoff on all Qwen calls; JSON-repair re-prompt loop guarded by existing Pydantic validators; graceful degradation when `recall()` returns empty (coach falls back to session-only context, states it); MCP flakiness → PyMongo fallback already abstracted in `mcp_reads.py`; upload failures never lose the photo (OSS write precedes analysis).

## 13. Testing

Unit tests for memory ops (supersession transitions, graduation threshold, pack budgeting — pure Python, no LLM). The eval harness doubles as the integration test. Manual scripted dry-run of the full demo path on the live SAS box before recording (day 6).

## 14. Out of scope

iOS/SwiftUI app; Field Coach live capture; Planner/Triage/Print Sales/Visual Describer (ported only if time allows, else gated); ApsaraDB migration (Atlas stays); real auth (existing header-scoping suffices for judging); payment/monetization mechanics (documented as productization path only).

## 15. Top risks

1. **Port starves the memory engine** → hard scope gate: 3 specialists; engine + eval days protected; cut agent breadth, never the benchmark.
2. **Benchmark credibility** → fixed seeds, one command, raw results committed, honest framing.
3. **Qwen-VL critique parity** → port Coach first (day 2); Pydantic guardrails; acceptable critique + great memory beats the reverse.
4. **"Significantly updated" optics** → `WHATS_NEW.md` with dated post-May-26 commit links; narrative leads with the new memory engine.
5. **Account/deploy friction** → verification, SAS box, and proof screenshot on day 1.

## 16. Submission mapping

| Requirement | Satisfied by |
|---|---|
| Qwen models on Qwen Cloud (managed API only) | All calls via `qwen_client` → dashscope-intl compatible-mode |
| Alibaba backend + proof | SAS deploy; `ALIBABA_CLOUD_PROOF.md` (screenshot + code permalinks) |
| Public repo + visible OSS license | Apache-2.0, license set in About |
| Architecture diagram | §6 rendered as the submission diagram |
| ≤3-min public video | Three-act demo arc; memory engine as star; brief Iris origin nod only |
| Text description / track ID | Devpost write-up; **Track 1** stated singularly |
| Significant update to existing project | Full Gemini/ADK→Qwen port + net-new memory engine, MCP server, eval — `WHATS_NEW.md` |

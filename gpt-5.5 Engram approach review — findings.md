# Engram approach review — findings

## Verdict
Proceed-with-changes. The thesis is well aimed at Track 1, but the current plan has one serious port-contract gap and one delivery gate that can still sink the submission even if the memory engine is good.

## Blocking
- [B1] Copied Iris frontend will not integrate with the planned Engram backend as written — evidence: Iris upload client posts form key `image` and expects `AnalysisResult.portfolioEntryId` (`iris-photography-mentor/frontend/src/services/agentClient.ts` lines 127-146, `frontend/src/types/index.ts` lines 92-113); planned Engram server test uses form key `file` and fake payload lacks `portfolioEntryId` (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 1108-1129). Also Iris home/library calls `/api/v1/portfolio`, `/portfolio/stats`, `/portfolio/trends`, `/aesthetic-profile` (`HomeTab.tsx` lines 159-167), but the planned server snippet only implements analyze/chat/journey/memory-stats. Fix: before frontend Phase F, port a minimal portfolio persistence/read layer and routes, preserve the `image` upload field or update `agentClient.ts`, and ensure analyze returns/persists `portfolioEntryId`, `genre`, `imageUrl`.
- [B2] Alibaba deployment proof is still a hard external gate, not just a late infra task — evidence: rules require public working access and Alibaba deployment proof (`Global AI Hackathon Series with Qwen Clo.md` lines 378-410); plan blocks SAS deployment on verification in Phase I (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 2226-2241). Fix: treat this as day-0 critical path; prepare all deploy assets now, escalate verification, and set a go/no-go date for organizer-approved contingency.

## High
- [H1] `engram-mcp` may read as ornamental unless a live Qwen path actually uses it — evidence: spec positions MCP as a core technical-depth signal (`engram/docs/superpowers/specs/2026-07-03-recall-memory-coach-design.md` lines 67-69), but plan Task 15 mostly tests plain Python functions and wraps stdio (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 1300-1457). Fix: make Mentor or Glass Box execute recall/stats through the MCP server at least in one demo path, and include a short transcript/log.
- [H2] Recall is currently salience-only, not query-relevant, so a skeptical judge can call it sorted memory rather than intelligent retrieval — evidence: `_salience()` is only importance × recency and `recall()` ignores query text (`engram/app/memory_engine.py` lines 88-117); planned MCP `recall_tool(query=...)` does not use `query` (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 1363-1365). Fix: add a lightweight relevance term: keyword/skill/genre/scope match plus score breakdown in the glass box. This is the best one-day sophistication boost.
- [H3] The eval can look too self-graded unless hardened — evidence: planned runner checks substrings in recalled memory text and estimates tokens via chars/4 (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 2035-2055). Fix: freeze traces before tuning, score expected memory IDs separately from answer text, include adversarial recent obsolete memories, and report default vs no-forgetting side-by-side with raw JSON.
- [H4] The schedule discovers too many unknowns late — evidence: eval is Phase G, seed data Phase H, deployment Phase I, docs/video Phase J (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 1855-2298). Fix: pull eval skeleton, Docker, and minimal live deploy before frontend polish; cut Library genre filters, milestone badges, and split-view polish before cutting MCP/eval/Journey.

## Advisory
- [A1] Chat session storage should be scoped by user as well as `session_id` — evidence: planned `_recent_turns()` queries only `session_id` and persisted turns omit `user_id` (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 938-947). Fix: store/query `{user_id, session_id}`.
- [A2] `WHATS_NEW.md` is compliance-important but scheduled late — evidence: README already points to it (`engram/README.md` line 9), while plan writes it in Task 32 (`engram/docs/superpowers/plans/2026-07-03-engram-implementation.md` lines 2280-2283). Fix: create it early and update commit links later.
- [A3] Config comment is stale against verified `sk-ws` behavior — evidence: `app/config.py` says `sk-ws` is unconfirmed (`engram/app/config.py` lines 19-21), while the brief and smoke script establish dashscope-intl (`engram/scripts/smoke_test_qwen.py` lines 48-50). Fix: update the comment/docs so judges do not see uncertainty where you already have proof.

## Answers to the 8 questions
1. Winnability: yes, this is the right Track 1 shape. MCP + FAMA are aimed at the 30% criteria; the missing higher-leverage artifact is a visible, score-explained recall trace for each answer.
2. Timeline: likely blowups are backend/frontend contract, Alibaba deploy, and eval credibility. Cut first Library extras, second split-view polish, third Reflection copy; do not cut MCP/eval/Journey.
3. Architecture: pure engine + Mongo wrapper is sound. Biggest structural fixes are query relevance, user-scoped sessions, and real portfolio persistence.
4. Memory credibility: promising, but current retrieval is thin. Add relevance-scored, explainable recall with score components.
5. Benchmark: defensible only if framed as diagnostic and hardened with frozen traces, adversarial obsolete facts, raw outputs, and ablations.
6. Port fidelity: biggest missed coupling is upload field/response shape plus portfolio routes/types.
7. UI/UX: Journey homepage and graduation moment are right for video. Keep the demo focused: upload → recall → graduate → benchmark.
8. Compliance: license exists; lineage disclosure is strong. Remaining risks are Alibaba proof, visible `WHATS_NEW.md`, public working access through judging, and exact video/public-link requirements.


## Post-Fix Follow-Up Suggestions

After Claude Code incorporated the initial GPT-5.5 feedback, the highest-leverage remaining work is not adding more product breadth. It is making the memory engine visible, judge-friendly, and obviously mapped to Track 1.

### P0 — Memory Receipt In Main Flows
Add a compact “Memory Receipt” after each critique and Mentor reply:
- `Recalled`: memories used.
- `Retired`: cleared or superseded memories intentionally excluded.
- `Ignored due to budget`: memories dropped by context packing.
- `Why`: score breakdown, ideally importance / recency / relevance.

This should appear in the main product flow, not only the Glass Box page. Judges should see recall, forgetting, and context-budget mechanics without hunting for them.

### P0 — Judge / Demo Mode
Add a low-friction judge path such as `/demo` or `?judge=1`.

It should use the seeded demo user, show Journey with populated memory state, make the graduation moment visible, and link clearly to Glass Box / benchmark. Do not rely on judges uploading multiple photos before they understand the submission.

### P0 — Human-Readable Benchmark Example
Alongside FAMA and token-savings tables, include one concrete forgetting win:
- Question: “What camera do I use?”
- Full-history / no-forgetting baseline: “Canon + Sony”
- Engram: “Sony only”
- Why: Canon was superseded by the later Sony memory.

This makes forgetting accuracy obvious to non-research judges.

### P1 — Shared Memory Context Builder
If it fits without derailing execution, centralize context construction behind one narrow module used by Coach, Mentor, MCP, and eval.

It should return selected memory items, score breakdowns, packed context, excluded archived/superseded items, and token estimates. Keep it small around existing `recall_scored()` and `pack()`, not a broad refactor.

### P1 — Graduation Evidence Card
The Journey graduation moment should show evidence, not just a status label:
- first weak evidence
- three passing sessions
- old advice retired
- next focus promoted

This is the emotional center of the demo: forgetting as promotion.

### P1 — README: “Why This Is A MemoryAgent”
Add a concise README section mapping directly to the Track 1 brief:
- Efficient retrieval: query-relevant salience + typed storage.
- Timely forgetting: supersession + graduation state machine.
- Limited-context recall: token-budget packing + benchmarked savings.
- Qwen sophistication: model routing, MCP path, eval.

Link each claim to code.

### UI / UX Guidance
Keep the recorded path narrow: Journey → Upload / Critique → Photo-scoped Mentor chat → Journey graduation → Eval / Glass Box.

Avoid overbuilding Library genre filters, onboarding, real auth, or extra specialists. Use visible Qwen call states instead of generic spinners, for example “Qwen-VL is reading composition and lighting,” “Packing memory context,” and “Checking retired memories.”

### Execution Guardrails
Use subagent-driven execution with parent verification between tasks. Preserve the cut order: Library filter chips first, split-view polish second, Reflection summary third, consolidation pass fourth. Never cut Journey, the graduation demo, the MCP live path, eval/ablations, or Alibaba proof.
# What's new in Engram (vs. the Iris foundation)

Engram is a new product built during the Global AI Hackathon with Qwen Cloud submission period (May 26 – Jul 9, 2026) on my own open-source foundation: [Iris Photography Mentor](https://github.com/prasadt1/iris-photography-mentor) (Apache-2.0), a Gemini/Google-ADK photography mentor I built earlier this year.

Everything that defines Engram is new work from the submission period:

1. **The forgetting-aware memory engine** (`app/memory_engine.py`) — salience-scored recall (importance × recency × query-relevance, with an inspectable per-component score breakdown), progress-driven graduation/supersession (a watched weakness retires after 3 consecutive above-bar sessions), episodic→semantic consolidation, and token-budget context packing. Iris stored memory; Engram *manages* it.

   **Commit trail:**
   - `e8b2f85` (Jul 3) — Implement core memory engine: graduation, forgetting-in-effect recall, token-budget packing
   - `139aaa7` (Jul 3) — Apply external (GPT-5.5) review: query-relevant explainable recall, frontend contract fixes, MCP live path, eval hardening, resequenced pacing

2. **`engram-mcp`** — a custom MCP server exposing the engine as typed tools (`recall` / `consolidate` / `forget` / `get_memory_stats`) any Qwen agent can mount.

   **Commit trail:**
   - `600801f` (Jul 4) — Add engram-mcp: custom MCP server exposing recall/consolidate/forget/stats tools + live transcript
   - `74e6dc3` (Jul 4) — Serve memory-stats through engram-mcp via ?via=mcp (live MCP production path)

3. **A reproducible `/eval` benchmark** — recall accuracy, FAMA (forgetting-aware memory accuracy), and token-cost vs. a full-history baseline, with ablations. The "no-forgetting" baseline is effectively how Iris itself worked, so the difference between the two products is measured, not argued.

   **Commit trail:**
   - `0ce4542` (Jul 4) — Add eval skeleton: FAMA metric + seed traces + one-command runner with no-forgetting ablation
   - `46afe8f` (Jul 4) — Expand eval to the frozen full trace set (26 traces; adversarial, multi-genre, multi-hop, chains)
   - `4fccfec` (Jul 4) — Commit benchmark results: default vs no-forgetting, side-by-side compare, worked example

4. **The full Qwen Cloud port** — every model call now hits Qwen (`qwen3.7-max`, `qwen-vl-max`, `qwen3.6-flash`) via the DashScope OpenAI-compatible API; Google ADK's orchestration replaced with a hand-rolled tool-calling loop.

   **Commit trail:**
   - `173981d` (Jul 3) — Scaffold qwen_client, config, and endpoint smoke test
   - `64a749e` (Jul 3) — Port Coach pipeline to Qwen-VL (embeddings deliberately deferred)
   - `965d7eb` (Jul 4) — Harden Coach against live Qwen-VL shape drift: JSON skeleton, still_life genre, shape-repair retry

5. **The Alibaba Cloud deployment** — backend on Simple Application Server / ECS (Singapore), photos on Alibaba OSS with signed URLs (see `docs/ALIBABA_CLOUD_PROOF.md`).

   **Commit trail:**
   - `f661bd7` (Jul 3) — Add pluggable photo storage: local disk now, Alibaba OSS via env flip
   - `53c870a` (Jul 4) — Add Docker setup: containerized backend with in-container MCP path verified

6. **A rebuilt, memory-first UI** — Journey home page (progress timeline, graduation milestones, genre identity, next-step focus), photo-detail split view with inline photo-scoped Mentor chat, and a judge-facing glass-box/benchmark page.

   **Commit trail:**
   - `1df2ad6` (Jul 4) — Add Journey section to home: summary, graduation cards, watching streaks, current focus
   - `573475b` (Jul 4) — MemoryReceipt component in critique flow; genre chip; narrated analyze states
   - `25281ed` (Jul 4) — Photo detail split view: photo + scoped chat; storageKey in portfolio contract
   - `a44e0be` (Jul 4) — Add Glass box page: live memory stats with engram-mcp toggle, benchmark table, worked example

Reused from the Iris foundation (disclosed, my own Apache-2.0 code): MongoDB schemas and Pydantic models, portfolio/trend utilities, the photography-principles grounding corpus, and base React components.

> Every commit in this repository postdates July 3, 2026.

# What's new in Engram (vs. the Iris foundation)

Engram is a new product built during the Global AI Hackathon with Qwen Cloud submission period (May 26 – Jul 9, 2026) on my own open-source foundation: [Iris Photography Mentor](https://github.com/prasadt1/iris-photography-mentor) (Apache-2.0), a Gemini/Google-ADK photography mentor I built earlier this year.

Everything that defines Engram is new work from the submission period:

1. **The forgetting-aware memory engine** (`app/memory_engine.py`) — salience-scored recall (importance × recency × query-relevance, with an inspectable per-component score breakdown), progress-driven graduation/supersession (a watched weakness retires after 3 consecutive above-bar sessions), episodic→semantic consolidation, and token-budget context packing. Iris stored memory; Engram *manages* it.
2. **`engram-mcp`** — a custom MCP server exposing the engine as typed tools (`recall` / `consolidate` / `forget` / `get_memory_stats`) any Qwen agent can mount.
3. **A reproducible `/eval` benchmark** — recall accuracy, FAMA (forgetting-aware memory accuracy), and token-cost vs. a full-history baseline, with ablations. The "no-forgetting" baseline is effectively how Iris itself worked, so the difference between the two products is measured, not argued.
4. **The full Qwen Cloud port** — every model call now hits Qwen (`qwen3.7-max`, `qwen-vl-max`, `qwen3.6-flash`) via the DashScope OpenAI-compatible API; Google ADK's orchestration replaced with a hand-rolled tool-calling loop.
5. **The Alibaba Cloud deployment** — backend on Simple Application Server / ECS (Singapore), photos on Alibaba OSS with signed URLs (see `docs/ALIBABA_CLOUD_PROOF.md`).
6. **A rebuilt, memory-first UI** — Journey home page (progress timeline, graduation milestones, genre identity, next-step focus), photo-detail split view with inline photo-scoped Mentor chat, and a judge-facing glass-box/benchmark page.

Reused from the Iris foundation (disclosed, my own Apache-2.0 code): MongoDB schemas and Pydantic models, portfolio/trend utilities, the photography-principles grounding corpus, and base React components.

> Dated commit links for each item will be added here before submission (this file is created early by design; see the repo's commit history — everything in this repository postdates July 3, 2026).

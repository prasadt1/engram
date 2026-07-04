# ADR-0006: Mentor chat uses the fast model tier, not the reasoning tier

**Status:** Accepted (2026-07-04)

## Context

Mentor chat was calling `qwen_client.chat_text`, routed to `MODEL_REASONING`
(`qwen3.7-max`) — the same tier used for JSON-repair on malformed Coach
output, where extended reasoning genuinely helps. A live user report of
chat replies timing out ("That took too long...") led to timing the actual
call: **77.8 seconds** for a single conversational reply on the production
box. Bumping the client-side timeout (45s → 90s) and adding a server-side
ceiling made the symptom less frequent but didn't fix the cause — a 78s
round trip is broken UX for a live judge demo regardless of the timeout
budget around it.

## Decision

Switch mentor chat to `chat_fast` (`MODEL_FAST`, `qwen3.6-flash`) — the same
tier already used for Reflection's one-liner summaries. Chat is a
conversational reply grounded in retrieved memory, not a task that benefits
from the reasoning tier's extended chain-of-thought.

## Alternatives considered

- **Keep the reasoning tier, just raise timeouts further** — the
  first fix attempted, and insufficient on its own: verified live at
  77.8s per reply even with a 90s budget, leaving near-zero margin and
  guaranteeing an unacceptably slow demo experience even when it didn't
  technically time out.
- **Disable "thinking" mode on the reasoning model via a
  provider-specific flag** — would have preserved model identity while
  cutting latency, but DashScope's hybrid-thinking toggle support for the
  exact pinned model ID wasn't confirmed, and the fast tier was already a
  known-good path (proven by Reflection) with zero new risk.

## Consequences

- `chat_fast` gained an optional `system` parameter (it previously only
  supported a bare prompt) to carry the mentor persona/prompt — a small,
  compatible extension, not a rewrite.
- Verified: local DashScope call ~6s; live on the 2-vCPU Singapore box
  (memory recall + Mongo queries + the LLM call sharing constrained CPU)
  ~20-30s — both a large, demo-relevant improvement over 78s.
- If a future chat feature genuinely needs deep reasoning (e.g. multi-step
  portfolio analysis), route *that* feature to the reasoning tier
  explicitly — don't move mentor chat back wholesale.

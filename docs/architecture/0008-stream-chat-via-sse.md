# ADR-0008: Stream mentor chat replies token-by-token over SSE

**Status:** Accepted (2026-07-04)

## Context

After [ADR-0006](0006-fast-tier-model-for-chat.md) cut chat latency from
~78s to ~6-28s, the reply still arrived as one blocking JSON response —
the UI showed a loading skeleton for the full generation, then the whole
answer appeared at once. That's a real UX gap for a live judge demo:
perceived responsiveness (time-to-first-token) matters even when total
latency is acceptable, and a coach that "thinks out loud" reads as more
alive than a spinner.

## Decision

Add `/api/v1/agent/chat/stream`, a Server-Sent Events endpoint that yields
text deltas as DashScope produces them, with a final `done` event carrying
the Memory Receipt (computed once, up front — it doesn't depend on the
generated text, so it's available before the first token even streams).
The original JSON `/api/v1/agent/chat` endpoint stays in place for any
caller that doesn't need streaming. `MentorChat.tsx` renders the assistant
bubble on the first token and grows it live instead of waiting for
completion.

## Alternatives considered

- **WebSockets** — bidirectional, but chat here is strictly
  request-then-stream-response; SSE is the simpler primitive for that
  shape and needs no new connection-lifecycle handling on either side.
- **Replace the JSON endpoint outright instead of adding a new route** —
  rejected to avoid breaking any other caller (tests, potential future
  non-browser clients) that expects one JSON object back.
- **Client-side fake streaming** (chunk the completed string on a timer) —
  would improve perceived responsiveness without backend changes, but
  fakes real-time behavior instead of delivering it, and doesn't reduce
  actual time-to-first-visible-text.

## Consequences

- Found a real bug via live testing that no unit test caught: DashScope
  sends a trailing usage-only chunk with an empty `choices` list, which
  crashed the streaming generator with an unhandled `IndexError` and
  silently truncated every stream before the fix. A mocked SDK client
  never produces that chunk shape, so this only surfaced against the real
  API — a reminder that streaming integrations need at least one live
  smoke test, not just mocked unit coverage.
- Error handling moved from FastAPI's global exception handlers (which
  only apply *before* a response starts) to explicit `try`/`except` inside
  the SSE generator, including a catch-all so an unanticipated exception
  still emits a clean `error` event instead of hanging the connection.
- Retry-on-timeout, present in the non-streaming path, is deliberately
  absent here: once tokens have reached the client, silently restarting
  the whole call would duplicate visible output.

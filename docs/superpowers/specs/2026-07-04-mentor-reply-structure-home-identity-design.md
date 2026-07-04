# Design: Structured mentor replies, Home identity line, logo swap

**Date:** 2026-07-04
**Status:** Approved (pending spec review)
**Author:** Prasad (solo)

## Problem

Three UX gaps surfaced during live fine-tuning, plus a brand asset decision:

1. **Mentor chat replies feel "sudden" and shapeless.** The chat panel shows a
   progress state ("reading your library…") that cuts hard to a single wall of
   warm prose. Even with token-by-token SSE streaming (already shipped), the
   experience reads as "spinner, then a paste of a long paragraph." Users can't
   scan it, and there's no quick-answer-then-detail affordance.
2. **The home page states skill progress but never states identity.** The
   "Your journey" section shows the cleared → watching → next arc, but nowhere
   does the app say *who this photographer is* ("a golden-hour landscape
   shooter…"). The memory story feels less personal than it could on first load.
3. **No final logo.** Four candidates exist in `assets/logo-options/`; one needs
   to become the app's icon.

## Non-goals

- No change to the memory engine, recall scoring, or the Coach critique pipeline.
- No new LLM call on the Home page (the identity line is composed deterministically).
- No change to the streaming transport (SSE stays as-is).
- Not replacing the in-app header SVG mark (`IrisMark`) — see Component 3.

## Component 1: Structured mentor reply

### Decision reversed, deliberately

`app/prompts/mentor.txt` currently says *"Do not use headers or bullet lists
unless the user asked for a list… this is a chat reply, not a report."* That
line was added to kill an earlier third-person "case-notes" voice bug
(ADR-context: the vestigial Glass Box prompt section). We are reversing it — but
the guardrails that fixed the voice bug (second person, input boundary) stay.
The reply must remain warm and human; structure is added *around* the voice, not
in place of it.

### Response contract (prompt)

The mentor emits, in this exact structure:

1. **Headline** — line 1, one sentence, ≤ ~20 words, second person, directly
   answering the question. Streams in first.
2. **A blank line**, then **2–3 labeled beats** — each its own line. To keep
   icon mapping reliable (see Frontend), the label before the colon comes from a
   **fixed closed triad**; the warm, contextual phrasing goes *after* the colon:
   - `**Working:**` — what's strong / already handled.
   - `**Watch:**` — what's holding the shot (or the photographer) back right now.
   - `**Next:**` — the one concrete next move.
   The model uses the beats that fit (a "why is this rated low" reply naturally
   uses all three; a pure "how am I doing" reply might use Working + Next). It
   MUST NOT invent other labels. All warmth/specificity lives after the colon.
   This triad maps cleanly onto the mentor's existing ordered response shape
   (recall specifics → current focus gap → next step).
3. **A blank line, then a `---` on its own line, then a blank line**, then the
   **full narrative** — the warm long-form prose, unchanged in spirit.

Formatting rules the prompt must state explicitly (they make the split
deterministic and dodge markdown edge cases):
- The `---` divider appears **exactly once**, only as the quick-view/full-note
  separator. The narrative must not contain `---` (use commas or em-dashes for
  asides).
- The `---` must be preceded and followed by a blank line (prevents markdown
  from parsing "headline\n---" as a setext `<h2>` instead of a rule).

Guardrails retained verbatim: second-person enforcement; the "Input boundary"
anti-injection line; the memory-discipline and safety sections.

### Frontend rendering (`MentorChat.tsx`, `MentorChatTurn.tsx`, `MentorMarkdown.tsx`)

**Streaming vs done — an explicit per-turn flag, to avoid reflow flicker.**
Today `content` is the only turn state and `MentorChatTurn` renders it through
`MentorMarkdown` unconditionally. Add a per-turn `streaming: boolean` (true while
deltas arrive, set false on the SSE `done` event):
- **While `streaming === true`:** render the raw accumulated markdown live, exactly
  as today. The headline lands in ~1–2s and text fills in visibly — this is what
  removes the "sudden" feeling. No structuring, no collapse, during streaming
  (partial `**Working:` with no closing `**` is expected and fine mid-stream).
- **When `streaming === false`:** render the structured layout — a single swap at
  completion, not a per-delta reflow. This bounds the visible transition to one
  clean swap rather than continuous re-layout. (No entrance animation for v1;
  keep it a plain swap.)

**Structured layout (done state):**
- Split the raw reply text with a pure helper `splitMentorReply(raw)` →
  `{ headline, beats: {label, text}[], fullNote }`. The helper operates on **raw
  text before markdown parsing** and splits on **the first line equal to `---`**
  (trimmed). Everything before → headline (line 1) + beats (subsequent
  `**Label:**` lines); everything after → `fullNote`.
- Render: headline prominently (larger serif); each beat with its label and a
  fixed icon from the closed triad map — `Working → check` (success),
  `Watch → arrow-down-right` (warning), `Next → arrow-right` (accent); any
  unrecognized label → a neutral dot icon (defensive default). The `fullNote`
  goes behind a "Read the full note" expander.
- **Fallbacks (never hide content):** no `---` → whole reply is the quick view,
  no expander. `---` present but no recognizable beats → headline + full note,
  no beats row. A stray `---` in the body is prevented by the prompt, but the
  "first `---` only" rule means a leaked one just moves a sentence into the
  full note — degraded, not broken.

**Collapsed-turn preview.** `turnPreview` (`mentorChatTurns.ts`) currently shows
the first 140 chars, which for a structured reply would be a bold label. Change
the preview for the collapsed accordion rows to show the **headline** (the text
before the first beat / `---`), falling back to the old behavior when there's no
structure.

**Voiceover.** `VoiceoverButton` reads `turn.assistant.content` verbatim, which
would now include literal `---` and `**` markers. Strip markdown markers
(`**`, the `---` line) from the spoken text — reuse/extend the existing
`plainTextForSpeech` helper if present.

### Testing

- Backend: a mentor test asserting the system prompt states the
  headline/triad-beats/`---` contract (string presence) — cheap regression guard.
- Frontend: unit tests for `splitMentorReply(raw)` covering: normal 3-beat reply;
  reply with no `---` (all quick view, no beats); `---` present but no beats;
  a reply whose full-note body contains a stray `---` (assert we split on the
  FIRST only); the label→icon map including the neutral default for an unknown
  label; `turnPreview` returning the headline for a structured reply.

## Component 2: Home identity line

### Composition (deterministic, no LLM)

Correction from spec review: the three inputs are NOT all available in the
journey path today. Concrete sources, each verified against the code:
- **cleared skill(s) + watching skill** — already in the journey route via
  `skills[].status` (`app/server.py` journey route). Available, no change.
- **top aesthetic tag** — the aggregation exists but lives *inline* in the
  `/api/v1/aesthetic-profile` route (`app/server.py`, ~lines 340-370), where it
  reads only the **20 most-recent** portfolio docs (`.sort(created_at,-1).limit(20)`)
  and returns the top 8 as `dominantTags`. Extract this into a reusable store
  helper **parameterized by a doc window** (`limit: int | None`). The
  aesthetic-profile route keeps its current behavior by passing `limit=20`
  (no behavior change there).
- **dominant genre** — does NOT exist anywhere; `genre` is a per-document field
  on `portfolio_entries` (written by `coach.py`) with no aggregation. Add a store
  method that counts `portfolio_entries.genre` for the user and returns the mode,
  **also parameterized by the same `limit` window**.

**Window consistency (the fix the review flagged):** the identity line must
compute top-tag and dominant-genre over the **same** doc window, or the two
descriptors describe different time slices. For an *identity* statement ("who you
are"), use the **full history** — the journey route calls both helpers with
`limit=None`. (The aesthetic-profile route independently keeps `limit=20`; only
its *reuse of the extracted helper* is shared, not the window value.)

**Genre-mode tie-break:** on a count tie, pick the **most-recently-shot** genre
(reflects current identity), not alphabetical — alphabetical would bias toward
`architecture`/`landscape` given the fixed genre enum. State this in the method.

`identity` is composed in a **pure helper** `build_identity_line(genre, tag,
cleared: list[str], watching: str | None) -> str | None` that takes these
already-resolved inputs (so it's trivially unit-testable), called from the
journey route after it resolves the four inputs.

Template, with graceful degradation:
> "You're a {tag} {genre} shooter — {cleared} cleared, now sharpening {watching}."

Degradation matrix (helper must handle each; unit-tested):
- no genre AND no tag → omit the descriptor: "You're building your eye — …"
- tag present, no genre → "You're a {tag} photographer — …"
- genre present, no tag → "You're a {genre} shooter — …"
- no cleared skill yet → "…, working toward your first cleared skill" (drop the
  "{cleared} cleared" clause)
- no watching skill → drop the "now sharpening {watching}" clause
- no portfolio at all (no genre, no tag, no skills) → return `None`; the frontend
  renders nothing (never fabricate an identity).

### Wiring

- Add an `identity: string | null` field to the `/api/v1/journey` response.
- Render it (when non-null) as a prominent one-liner at the top of the journey
  area (`JourneySection` / `HomeTab`), above the since-last-time summary sentence.

### Testing

- Unit-test `build_identity_line` across the full degradation matrix above.
- Unit-test the new genre-mode store method, including the tie-break case
  (most-recently-shot genre wins on a count tie, per above).

## Component 3: Logo

- Chosen: `assets/logo-options/engram-app-icon-gpt55.png` — aperture + gold
  neural-tree + dust-trail dissolve (photography + memory + forgetting in one mark).
- Swap it in as the **favicon, app icon (PWA/manifest), and social/OG image**,
  generating appropriately sized/optimized derivatives (favicon ≤ a few KB, not
  the 1.5 MB source).
- **Keep** the in-app header `IrisMark` SVG aperture — it's crisp at any size and
  already on-brand; replacing a vector with a large raster in the header is a
  regression. (Reversible if desired later.)

## Rollout / verification

- The in-flight demo re-seed (background) must finish first; its completion is
  folded into verification so the two don't collide.
- Verify live in preview: ask "why is this rated so low?" on a low-scored photo →
  confirm headline + beats + collapsed full note, streaming feel, receipt intact.
- Verify Home shows the identity line.
- Verify favicon/app icon updated.
- Ship via the established dev → main merge → deploy-to-ECS flow.

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

The mentor emits, in order:

1. **Headline** — line 1, one sentence, ≤ ~20 words, second person, directly
   answering the question. This is what streams in first.
2. **2–3 labeled beats** — each a short standalone line beginning with a bold
   label the model chooses to fit the question. For "why is this rated low":
   `**Working:** …`, `**Pulled it down:** …`, `**Next move:** …`. For "how am I
   doing overall" the labels differ (e.g. `**Strength:**`, `**Watching:**`,
   `**Next move:**`). Labels are contextual, not a fixed template.
3. **A `---` divider**, then the **full narrative** — the warm long-form prose,
   unchanged in spirit from today's replies.

The `---` (a markdown horizontal rule) is the machine-readable split point:
everything before it is the always-visible quick view; everything after is the
"full note." Plain markdown — streams cleanly, no JSON, no schema fragility.

Guardrails retained verbatim: second-person enforcement; the "Input boundary"
anti-injection line; the memory-discipline and safety sections.

### Frontend rendering (`MentorChat.tsx`, `MentorChatTurn.tsx`, `MentorMarkdown.tsx`)

- **During streaming:** render the incoming markdown live as it arrives, so the
  headline lands in ~1–2s and beats fill in visibly. This is what removes the
  "sudden" feeling — the answer appears and elaborates, rather than a spinner
  cutting to a finished blob.
- **On completion** (the SSE `done` event, or when `---` has been seen): reflow
  into the final layout —
  - headline rendered prominently (larger serif),
  - beats rendered with their bold labels and a small leading Tabler-style icon
    keyed off the label sentiment (check / down-right / arrow-right), and
  - the post-`---` narrative auto-collapsed behind a "Read the full note"
    expander.
- **Fallback:** if the model emits no `---` (older behavior, or a short reply),
  render the whole thing as the quick view with no expander — never hide content.
- **Voiceover:** the existing `VoiceoverButton` stays; it reads the complete
  text (headline + beats + full note).

### Testing

- Backend: a mentor test asserting the prompt instructs the headline/beats/`---`
  contract (string presence in the system prompt) — cheap regression guard.
- Frontend: a unit test for the split helper (`splitMentorReply(text)` →
  `{ headline, beats[], fullNote }`) covering: normal 3-beat reply, reply with no
  `---` (all quick view), reply with `---` but no beats.

## Component 2: Home identity line

### Composition (deterministic, no LLM)

Compose from data already available server-side in the journey/aesthetic path:
- **dominant genre** (most frequent across portfolio entries),
- **top aesthetic tag** (most frequent tag),
- **cleared skill(s)** and the current **watching** skill.

Template, with graceful degradation when data is thin:
> "You're a {tag} {genre} shooter — {cleared} cleared, now sharpening {watching}."

Fallbacks: if no cleared skill yet → "…building toward your first cleared skill";
if no tag → drop it; if no portfolio yet → omit the line entirely (don't fabricate).

### Wiring

- Add an `identity` string to the `/api/v1/journey` response (composed in a small
  pure helper, unit-tested against representative skill/tag/genre inputs).
- Render it as a prominent one-liner at the top of the journey area
  (`JourneySection` / `HomeTab`), above the since-last-time summary sentence.

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

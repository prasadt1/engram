# Structured mentor replies, Home identity line, logo swap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mentor chat replies feel structured and immediate (headline → labeled beats → collapsible full note) instead of a single streamed wall of text; state the photographer's identity on Home; ship the final app icon.

**Architecture:** Backend prompt change makes the mentor emit a deterministic `headline / beats / --- / full-note` shape in plain markdown (no schema, no new endpoint). Frontend adds a pure split-and-render layer on top of the existing SSE stream — render raw while streaming, swap to the structured layout once done. Home's identity line is composed server-side from data that already exists (skills) plus two small new/extracted store aggregations (dominant genre, top tag), with zero new LLM calls. Logo is a static-asset swap.

**Tech Stack:** FastAPI + pytest (backend, has a real test runner — use it). React + TypeScript + Vite (frontend). **The frontend has no test runner configured** (`package.json` scripts are only `dev`/`build`/`lint`/`preview` — no vitest/jest, and **no `tsx` either** — confirmed `npx tsx` prompts to install and fails non-interactively). Per this repo's established convention this session, frontend correctness is verified via `npx tsc --noEmit`, `npx eslint`, and live browser verification (Claude Preview tools: `preview_start`/`preview_eval`/`preview_snapshot`/`preview_screenshot`), not unit test files. Do not add a new test framework as part of this plan — that's scope creep this close to the deadline. Where the design spec says "unit test," treat that as "verify via a one-off manual smoke check during implementation, then confirm live in preview" for frontend pure functions, and as real `pytest` tests for backend code. **For the one-off smoke checks (Tasks 7-8), install `tsx` as a devDependency first** (`npm install -D tsx` — a small TS execution runner, not a test framework, so this doesn't violate the "no new test framework" rule) so `npx tsx -e "..."` actually runs instead of hanging on an install prompt.

---

## File map (what's created/touched and why)

| File | Change |
|---|---|
| `app/prompts/mentor.txt` | Response contract rewritten: headline → closed-triad beats → `---` → full narrative |
| `tests/test_mentor.py` | New test: prompt file contains the contract markers |
| `app/memory_store.py` | Add `top_aesthetic_tags()`, `dominant_genre()` |
| `app/server.py` | `aesthetic_profile()` route calls the extracted helper (no behavior change); `journey()` route composes and returns `identity` |
| `app/identity.py` | New file: pure `build_identity_line()` helper |
| `tests/test_identity.py` | New file: full degradation-matrix tests |
| `tests/test_memory_store.py` | New tests for `top_aesthetic_tags`, `dominant_genre` (tie-break) |
| `tests/test_server.py` | Update `test_journey_endpoint_shape`; add identity-specific journey test; add aesthetic-profile regression test |
| `frontend/src/lib/plainTextForSpeech.ts` | Strip a standalone `---` divider line before speech |
| `frontend/src/lib/mentorReplyStructure.ts` | New file: `splitMentorReply()`, beat→icon map |
| `frontend/src/lib/mentorChatTurns.ts` | `turnPreview()` prefers the headline for structured replies |
| `frontend/src/components/MentorStructuredReply.tsx` | New file: renders headline + beats + collapsible full note |
| `frontend/src/services/mentorClient.ts` | `ChatMessage` gains `streaming?: boolean` |
| `frontend/src/components/MentorChat.tsx` | Assistant message starts `streaming: true`, flips to `false` when the stream resolves |
| `frontend/src/components/MentorChatTurn.tsx` | Renders raw `MentorMarkdown` while streaming, `MentorStructuredReply` when done |
| `app/server.py` | (same file as above) journey route change |
| `frontend/src/services/journeyClient.ts` | `JourneyResponse.identity: string | null` |
| `frontend/src/components/JourneySection.tsx` | Renders the identity line above the summary sentence |
| `frontend/public/engram-icon-{32,192,512}.png` | New: generated from the chosen logo |
| `frontend/index.html` | Favicon/apple-touch-icon links point at the new PNGs |
| `frontend/public/manifest.json` | Icon entries point at the new PNGs |
| `frontend/public/favicon.png`, `favicon.svg`, `iris-icon-192.png`, `iris-icon-512.png` | Deleted (superseded, confirmed unreferenced elsewhere) |

---

## Task 1: Mentor prompt — headline / triad beats / divider contract

**Files:**
- Modify: `app/prompts/mentor.txt`
- Test: `tests/test_mentor.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_mentor.py`:

```python
def test_mentor_prompt_states_the_structured_reply_contract():
    from app.mentor import PROMPT_PATH

    text = PROMPT_PATH.read_text(encoding="utf-8")
    assert "Working:" in text
    assert "Watch:" in text
    assert "Next:" in text
    assert "---" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python -m pytest tests/test_mentor.py::test_mentor_prompt_states_the_structured_reply_contract -v`
Expected: FAIL (current prompt has none of these strings).

- [ ] **Step 3: Rewrite the response-shape section of the prompt**

In `app/prompts/mentor.txt`, replace the existing `## Response shape` section (the one starting `## Response shape (always follow this order)` through the line ending `...You are talking WITH them, not writing notes about them.`) with:

```
## Response shape (always follow this exact structure)
Your reply has three parts, in this order:

1. **Headline** — one sentence, ≤20 words, second person, that directly
   answers the question. This is the first thing the photographer sees.
2. A blank line, then 2-3 short beats, each its own line, each starting with
   one of these three labels (in this exact bold form) and nothing else as a
   label — do not invent other labels:
   - **Working:** what's strong, or already handled (e.g. a cleared skill).
   - **Watch:** what's holding this shot — or the photographer generally —
     back right now.
   - **Next:** the one concrete next move.
   Use only the beats that fit the question — a pure "how am I doing"
   question might just use Working and Next. All warmth and specificity goes
   AFTER the colon; the label itself stays exactly as written above.
3. A blank line, then a line containing only `---`, then a blank line, then
   the full narrative: the same warm, conversational voice as before —
   longer, personal, story-like. This is what a reader sees if they want the
   full note. The `---` must appear EXACTLY ONCE, only here — never use `---`
   inside the narrative itself (use a comma or em-dash instead).

Still cite what you actually found in memory — not generic advice. If a
related skill has status "cleared", say so explicitly and warmly. Speak
directly to the photographer — always "you", never "the photographer" or
"the hobbyist". You are talking WITH them, not writing notes about them.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python -m pytest tests/test_mentor.py::test_mentor_prompt_states_the_structured_reply_contract -v`
Expected: PASS

- [ ] **Step 5: Run the full backend suite (nothing else should move)**

Run: `python -m pytest -q`
Expected: all passing (75+ tests, same count as before plus this new one)

- [ ] **Step 6: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add app/prompts/mentor.txt tests/test_mentor.py
git commit -m "Mentor prompt: headline + closed-triad beats + --- divider contract"
```

---

## Task 2: `MemoryStore.top_aesthetic_tags()` — extract existing logic, keep behavior identical

**Files:**
- Modify: `app/memory_store.py`
- Modify: `app/server.py` (`aesthetic_profile()` route, ~lines 332-373)
- Test: `tests/test_memory_store.py` (new file)
- Test: `tests/test_server.py` (existing `test_aesthetic_profile_endpoint_minimal_shape` must still pass unmodified — this is a refactor, not a behavior change)

- [ ] **Step 1: Write the failing test**

Create `tests/test_memory_store.py`:

```python
from datetime import datetime, timedelta, timezone

import mongomock

from app.memory_store import MemoryStore


def _store():
    return MemoryStore(db=mongomock.MongoClient().db)


def test_top_aesthetic_tags_ranks_by_frequency_within_window():
    store = _store()
    now = datetime.now(timezone.utc)
    # 3 docs tagged "moody", 1 tagged "bright" -- moody must rank first
    for i, tags in enumerate([["moody"], ["moody", "bright"], ["moody"]]):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "aesthetic_tags": tags,
            "created_at": now - timedelta(days=i),
        })
    result = store.top_aesthetic_tags(user_id="u1", limit=20, top_n=8)
    assert result[0] == "moody"
    assert "bright" in result


def test_top_aesthetic_tags_respects_limit_window():
    store = _store()
    now = datetime.now(timezone.utc)
    # 1 recent doc tagged "bright", 5 OLDER docs tagged "moody" -- with
    # limit=1 (most recent doc only), only "bright" should show up.
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["bright"], "created_at": now,
    })
    for i in range(1, 6):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "aesthetic_tags": ["moody"],
            "created_at": now - timedelta(days=i),
        })
    result = store.top_aesthetic_tags(user_id="u1", limit=1, top_n=8)
    assert result == ["bright"]


def test_top_aesthetic_tags_empty_when_no_portfolio():
    store = _store()
    assert store.top_aesthetic_tags(user_id="u1", limit=20, top_n=8) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python -m pytest tests/test_memory_store.py -v`
Expected: FAIL with `AttributeError: 'MemoryStore' object has no attribute 'top_aesthetic_tags'`

- [ ] **Step 3: Add the method**

In `app/memory_store.py`, add a new section after `get_memory_stats` (end of class):

```python
    # --- portfolio aggregations (aesthetic identity, not memory recall) --

    def top_aesthetic_tags(self, *, user_id: str, limit: int | None = 20, top_n: int = 8) -> list[str]:
        """Most frequent aesthetic_tags across the user's portfolio_entries,
        most-recent-first before counting (limit=None means the whole history).
        Extracted from the aesthetic-profile route so the journey route can
        reuse the same logic with a different window."""
        cursor = self.db.portfolio_entries.find({"user_id": user_id}).sort("created_at", -1)
        if limit is not None:
            cursor = cursor.limit(limit)
        tag_counts: dict[str, int] = {}
        for doc in cursor:
            for tag in doc.get("aesthetic_tags") or []:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        ranked = sorted(tag_counts.items(), key=lambda pair: -pair[1])
        return [tag for tag, _ in ranked[:top_n]]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_memory_store.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire the aesthetic-profile route to use it (no behavior change)**

In `app/server.py`, in `aesthetic_profile()` (~line 332), replace the tag-counting block. Before:

```python
    tag_counts: dict[str, int] = {}
    sums = {k: 0.0 for k in _SCORE_DIMS}
    for doc in docs:
        for tag in doc.get("aesthetic_tags") or []:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        scores = doc.get("scores") or {}
        for k in _SCORE_DIMS:
            sums[k] += float(scores.get(k, 0))

    n = len(docs)
    avg_scores = {k: round(sums[k] / n, 1) for k in _SCORE_DIMS}
    mean = sum(avg_scores.values()) / len(avg_scores)
    variance = sum((x - mean) ** 2 for x in avg_scores.values()) / len(avg_scores)
    consistency = max(0.0, min(1.0, 1.0 - (variance / 25.0)))

    dominant = sorted(tag_counts.items(), key=lambda x: -x[1])[:8]

    return {
        "photoCount": coll.count_documents(query),
        "dominantTags": [t for t, _ in dominant],
        "averageScores": avg_scores,
        "stylisticConsistencyScore": round(consistency, 2),
    }
```

After:

```python
    sums = {k: 0.0 for k in _SCORE_DIMS}
    for doc in docs:
        scores = doc.get("scores") or {}
        for k in _SCORE_DIMS:
            sums[k] += float(scores.get(k, 0))

    n = len(docs)
    avg_scores = {k: round(sums[k] / n, 1) for k in _SCORE_DIMS}
    mean = sum(avg_scores.values()) / len(avg_scores)
    variance = sum((x - mean) ** 2 for x in avg_scores.values()) / len(avg_scores)
    consistency = max(0.0, min(1.0, 1.0 - (variance / 25.0)))

    return {
        "photoCount": coll.count_documents(query),
        "dominantTags": _store().top_aesthetic_tags(user_id=x_user_id, limit=20, top_n=8),
        "averageScores": avg_scores,
        "stylisticConsistencyScore": round(consistency, 2),
    }
```

(`docs` is still fetched the same way above this block, still used for `avg_scores`/`n`/the empty-check — only the tag-counting loop moves out.)

- [ ] **Step 6: Run the existing aesthetic-profile test to confirm zero behavior change**

Run: `python -m pytest tests/test_server.py::test_aesthetic_profile_endpoint_minimal_shape -v`
Expected: PASS, unmodified

- [ ] **Step 7: Run the full backend suite**

Run: `python -m pytest -q`
Expected: all passing

- [ ] **Step 8: Commit**

```bash
git add app/memory_store.py app/server.py tests/test_memory_store.py
git commit -m "Extract top_aesthetic_tags into MemoryStore, reused (unchanged) by aesthetic-profile route"
```

---

## Task 3: `MemoryStore.dominant_genre()` — new aggregation, most-recent tie-break

**Files:**
- Modify: `app/memory_store.py`
- Test: `tests/test_memory_store.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_memory_store.py`:

```python
def test_dominant_genre_picks_most_frequent():
    store = _store()
    now = datetime.now(timezone.utc)
    for i, genre in enumerate(["landscape", "landscape", "portrait"]):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "genre": genre, "created_at": now - timedelta(days=i),
        })
    assert store.dominant_genre(user_id="u1") == "landscape"


def test_dominant_genre_tie_break_prefers_most_recently_shot():
    store = _store()
    now = datetime.now(timezone.utc)
    # one "portrait" doc, most recent; one "landscape" doc, older -- 1-1 tie,
    # portrait must win because it was shot more recently.
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "portrait", "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "landscape", "created_at": now - timedelta(days=5),
    })
    assert store.dominant_genre(user_id="u1") == "portrait"


def test_dominant_genre_none_when_no_portfolio():
    store = _store()
    assert store.dominant_genre(user_id="u1") is None


def test_dominant_genre_respects_limit_window():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "portrait", "created_at": now,
    })
    for i in range(1, 4):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "genre": "landscape", "created_at": now - timedelta(days=i),
        })
    # full history -> landscape wins 3-1; limit=1 (most recent doc only) -> portrait
    assert store.dominant_genre(user_id="u1", limit=None) == "landscape"
    assert store.dominant_genre(user_id="u1", limit=1) == "portrait"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_memory_store.py -k dominant_genre -v`
Expected: FAIL with `AttributeError`

- [ ] **Step 3: Add the method**

In `app/memory_store.py`, immediately after `top_aesthetic_tags`:

```python
    def dominant_genre(self, *, user_id: str, limit: int | None = None) -> str | None:
        """Most frequent genre across portfolio_entries; ties broken by
        whichever genre was shot most recently (docs are read most-recent
        first, so the first occurrence of a genre IS its most recent)."""
        cursor = self.db.portfolio_entries.find({"user_id": user_id}).sort("created_at", -1)
        if limit is not None:
            cursor = cursor.limit(limit)
        counts: dict[str, int] = {}
        most_recent_rank: dict[str, int] = {}
        for idx, doc in enumerate(cursor):
            genre = doc.get("genre")
            if not genre:
                continue
            counts[genre] = counts.get(genre, 0) + 1
            most_recent_rank.setdefault(genre, idx)
        if not counts:
            return None
        return max(counts.items(), key=lambda pair: (pair[1], -most_recent_rank[pair[0]]))[0]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_memory_store.py -v`
Expected: PASS (all, including the 4 new dominant_genre tests)

- [ ] **Step 5: Commit**

```bash
git add app/memory_store.py tests/test_memory_store.py
git commit -m "Add MemoryStore.dominant_genre with most-recent tie-break"
```

---

## Task 4: `build_identity_line()` — pure helper, full degradation matrix

**Files:**
- Create: `app/identity.py`
- Test: `tests/test_identity.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_identity.py`:

```python
from app.identity import build_identity_line


def test_full_identity_with_genre_tag_cleared_and_watching():
    result = build_identity_line("landscape", "golden hour", ["composition"], "lighting")
    assert result == "You're a golden hour landscape shooter — composition cleared, now sharpening lighting."


def test_no_genre_and_no_tag_uses_building_your_eye():
    result = build_identity_line(None, None, ["composition"], "lighting")
    assert result == "You're building your eye — composition cleared, now sharpening lighting."


def test_tag_present_no_genre():
    result = build_identity_line(None, "moody", ["composition"], "lighting")
    assert result == "You're a moody photographer — composition cleared, now sharpening lighting."


def test_genre_present_no_tag():
    result = build_identity_line("portrait", None, ["composition"], "lighting")
    assert result == "You're a portrait shooter — composition cleared, now sharpening lighting."


def test_no_cleared_skill_yet():
    result = build_identity_line("portrait", "moody", [], "composition")
    assert result == "You're a moody portrait shooter — working toward your first cleared skill, now sharpening composition."


def test_no_watching_skill_drops_that_clause():
    result = build_identity_line("portrait", "moody", ["composition"], None)
    assert result == "You're a moody portrait shooter — composition cleared."


def test_multiple_cleared_skills_joined():
    result = build_identity_line("portrait", "moody", ["composition", "lighting"], "technique")
    assert result == "You're a moody portrait shooter — composition, lighting cleared, now sharpening technique."


def test_no_portfolio_at_all_returns_none():
    assert build_identity_line(None, None, [], None) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python -m pytest tests/test_identity.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.identity'`

- [ ] **Step 3: Implement the helper**

Create `app/identity.py`:

```python
"""A one-line, deterministic identity statement for the Home page --
composed from the same data the journey/aesthetic-profile routes already
expose, with no LLM call. See docs/superpowers/specs/2026-07-04-mentor-reply-
structure-home-identity-design.md, Component 2."""

from __future__ import annotations


def build_identity_line(
    genre: str | None, tag: str | None, cleared: list[str], watching: str | None,
) -> str | None:
    if not genre and not tag and not cleared and not watching:
        return None

    if tag and genre:
        descriptor = f"a {tag} {genre} shooter"
    elif tag:
        descriptor = f"a {tag} photographer"
    elif genre:
        descriptor = f"a {genre} shooter"
    else:
        descriptor = "building your eye"

    clauses: list[str] = []
    if cleared:
        clauses.append(f"{', '.join(cleared)} cleared")
    else:
        clauses.append("working toward your first cleared skill")
    if watching:
        clauses.append(f"now sharpening {watching}")

    return f"You're {descriptor} — {', '.join(clauses)}."
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_identity.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add app/identity.py tests/test_identity.py
git commit -m "Add build_identity_line: deterministic Home identity statement"
```

---

## Task 5: Wire `identity` into `/api/v1/journey`

**Files:**
- Modify: `app/server.py` (journey route, ~lines 466-477)
- Modify: `tests/test_server.py` (`test_journey_endpoint_shape`)

- [ ] **Step 1: Update the existing journey test's mocks and add an identity assertion**

In `tests/test_server.py`, replace `test_journey_endpoint_shape` (~line 302):

```python
def test_journey_endpoint_shape():
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Nice progress."):
        mock_store.return_value.list_skills.return_value = [
            Skill(name="exposure", bar=7, status=SkillStatus.WATCHING, consecutive_above_bar=1),
        ]
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 3}
        mock_store.return_value.dominant_genre.return_value = "landscape"
        mock_store.return_value.top_aesthetic_tags.return_value = ["moody"]
        resp = _client().get("/api/v1/journey", headers={"X-User-Id": "u1"})
    body = resp.json()
    assert body["summary"] == "Nice progress."
    assert body["skills"][0] == {"name": "exposure", "status": "watching", "consecutive": 1}
    assert body["stats"]["total_memories"] == 3
    assert body["identity"] == "You're a moody landscape shooter — working toward your first cleared skill, now sharpening exposure."


def test_journey_endpoint_identity_none_when_no_portfolio_data():
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Welcome!"):
        mock_store.return_value.list_skills.return_value = []
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 0}
        mock_store.return_value.dominant_genre.return_value = None
        mock_store.return_value.top_aesthetic_tags.return_value = []
        resp = _client().get("/api/v1/journey", headers={"X-User-Id": "u1"})
    assert resp.json()["identity"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_server.py -k journey -v`
Expected: FAIL — `identity` key missing from the response.

- [ ] **Step 3: Update the journey route**

In `app/server.py`, add the import near the other `app.` imports (~line 36):

```python
from app.identity import build_identity_line  # noqa: E402
from app.memory_engine import SkillStatus  # noqa: E402
```

(Check `compute_delta` is already imported from `app.memory_engine` on that line — if so, extend that import instead of adding a second one: `from app.memory_engine import SkillStatus, compute_delta`.)

Replace the journey route (~line 466):

```python
@app.get("/api/v1/journey")
def journey(x_user_id: str = Header(default="demo-user")) -> dict:
    store = _store()
    skills = store.list_skills(user_id=x_user_id)
    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]
    watching_skills = [s for s in skills if s.status == SkillStatus.WATCHING]
    # Same "closest to clearing" tie-break JourneySection.tsx uses on the
    # frontend for its own "current focus" highlight, kept in sync here so
    # the identity line names the same skill the Watching card highlights.
    current_focus = (
        max(watching_skills, key=lambda s: s.consecutive_above_bar).name
        if watching_skills else None
    )
    genre = store.dominant_genre(user_id=x_user_id, limit=None)
    top_tags = store.top_aesthetic_tags(user_id=x_user_id, limit=None, top_n=1)
    tag = top_tags[0] if top_tags else None

    return {
        "summary": summarize_progress(user_id=x_user_id, memory_store=store),
        "skills": [
            {"name": s.name, "status": s.status.value, "consecutive": s.consecutive_above_bar}
            for s in skills
        ],
        "stats": store.get_memory_stats(user_id=x_user_id),
        "identity": build_identity_line(genre, tag, cleared, current_focus),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_server.py -k journey -v`
Expected: PASS (both tests)

- [ ] **Step 5: Run the full backend suite**

Run: `python -m pytest -q`
Expected: all passing

- [ ] **Step 6: Commit**

```bash
git add app/server.py tests/test_server.py
git commit -m "Wire identity line into /api/v1/journey"
```

---

## Task 6: Voiceover strips the `---` divider

**Files:**
- Modify: `frontend/src/lib/plainTextForSpeech.ts`

- [ ] **Step 1: Add the strip rule**

In `frontend/src/lib/plainTextForSpeech.ts`, add a line to the `.replace()` chain in `plainTextForSpeech`, right after the existing bold-marker strip:

```ts
export function plainTextForSpeech(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^---$/gm, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

(The new line is `.replace(/^---$/gm, ' ')` — must run BEFORE `^[-*+]\s+` would ever misfire on it, but since `---` has no trailing space it doesn't match that bullet-strip pattern anyway; ordering here is for readability, not correctness.)

- [ ] **Step 2: Verify manually (no test runner for this file)**

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/lib/plainTextForSpeech.ts', 'utf8');
// quick manual check of the regex behavior in isolation
const strip = (s) => s.replace(/^---\$/gm, ' ').replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();
console.log(strip('Headline here.\n\n**Working:** good.\n\n---\n\nFull note.'));
"`

Expected output: `Headline here.. **Working:** good.. .. Full note.` (roughly — the point is no literal `---` survives; exact spacing doesn't matter since the real function runs the full chain including the `**` stripper first).

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/src/lib/plainTextForSpeech.ts
git commit -m "Voiceover: strip the --- quick-view/full-note divider before speech"
```

---

## Task 7: `splitMentorReply()` — the core parsing logic

**Files:**
- Create: `frontend/src/lib/mentorReplyStructure.ts`

- [ ] **Step 1: Implement the module**

Create `frontend/src/lib/mentorReplyStructure.ts`:

```ts
/**
 * Parses a mentor reply that follows the headline/beats/--- contract
 * (app/prompts/mentor.txt) into renderable pieces. Operates on RAW text,
 * before any markdown parsing -- react-markdown would otherwise turn a
 * "headline\n---" pair into a setext <h2> instead of a divider, and we need
 * the split point before rendering, not after.
 *
 * Split rule: the FIRST line that is exactly "---" (after trimming) marks
 * the end of the quick view. Everything before it is headline + beats;
 * everything after is the full note. If no such line exists, the whole
 * reply is the quick view with no beats and no expander.
 */

export type BeatLabel = 'Working' | 'Watch' | 'Next';

export interface MentorBeat {
  label: BeatLabel;
  text: string;
}

export interface StructuredMentorReply {
  headline: string;
  beats: MentorBeat[];
  fullNote: string | null;
  /** True only when at least the --- divider was found -- drives whether
   * the UI shows a "Read the full note" expander at all. */
  hasStructure: boolean;
}

const BEAT_LABELS: BeatLabel[] = ['Working', 'Watch', 'Next'];
const BEAT_LINE_RE = /^\*\*(Working|Watch|Next):\*\*\s*(.*)$/;

export function splitMentorReply(raw: string): StructuredMentorReply {
  const lines = raw.split('\n');
  const dividerIndex = lines.findIndex((line) => line.trim() === '---');

  const quickViewLines = dividerIndex === -1 ? lines : lines.slice(0, dividerIndex);
  const fullNote = dividerIndex === -1 ? null : lines.slice(dividerIndex + 1).join('\n').trim();

  const beats: MentorBeat[] = [];
  const headlineLines: string[] = [];
  for (const line of quickViewLines) {
    const match = line.match(BEAT_LINE_RE);
    if (match) {
      beats.push({ label: match[1] as BeatLabel, text: match[2].trim() });
    } else if (beats.length === 0 && line.trim() !== '') {
      // Headline is everything before the first recognized beat line.
      headlineLines.push(line.trim());
    }
  }

  return {
    headline: headlineLines.join(' ').trim(),
    beats,
    fullNote: fullNote && fullNote.length > 0 ? fullNote : null,
    hasStructure: dividerIndex !== -1,
  };
}

const BEAT_ICON: Record<BeatLabel, 'check' | 'arrow-down-right' | 'arrow-right'> = {
  Working: 'check',
  Watch: 'arrow-down-right',
  Next: 'arrow-right',
};

/** Never throws on an unrecognized label -- BEAT_LINE_RE already only
 * matches the closed triad, but this stays defensive for direct callers. */
export function beatIcon(label: string): 'check' | 'arrow-down-right' | 'arrow-right' | 'circle' {
  return (BEAT_ICON as Record<string, 'check' | 'arrow-down-right' | 'arrow-right'>)[label] ?? 'circle';
}
```

- [ ] **Step 2: Install `tsx` for the manual smoke checks (one-time)**

`tsx` isn't in this project's devDependencies and `npx tsx` prompts to install
interactively — confirmed it fails non-interactively without this step. This
is a small TS execution runner for one-off scripts, not a test framework, so
it doesn't conflict with the "no new test framework" rule above.

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npm install -D tsx`
Expected: added to `devDependencies` in `package.json`, installs cleanly.

- [ ] **Step 3: Verify manually**

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npx tsx -e "
import { splitMentorReply } from './src/lib/mentorReplyStructure';

const normal = 'It is your lighting, not your framing.\n\n**Working:** composition is cleared.\n**Watch:** lighting scored low.\n**Next:** reshoot at three exposures.\n\n---\n\nHere is the long warm note about your journey.';
console.log(JSON.stringify(splitMentorReply(normal), null, 2));

const noDivider = 'Just a short reply with no structure at all.';
console.log(JSON.stringify(splitMentorReply(noDivider), null, 2));

const dividerNoBeats = 'A headline with no beats at all.\n\n---\n\nJust the full note.';
console.log(JSON.stringify(splitMentorReply(dividerNoBeats), null, 2));

const strayDivider = 'Headline.\n\n**Working:** fine.\n\n---\n\nFull note with a stray divider below.\n\n---\n\nThis text after the second --- should stay INSIDE fullNote.';
const result = splitMentorReply(strayDivider);
console.log('fullNote contains second ---:', result.fullNote?.includes('---'));
"
```

Expected: first call shows `headline`, 3 `beats` (Working/Watch/Next with correct `text`), non-null `fullNote`, `hasStructure: true`. Second call: `headline` = the whole string, `beats: []`, `fullNote: null`, `hasStructure: false`. Third call: `headline` set, `beats: []`, non-null `fullNote`, `hasStructure: true`. Fourth: `fullNote contains second ---: true` (confirms we split on the FIRST `---` only).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/src/lib/mentorReplyStructure.ts frontend/package.json frontend/package-lock.json
git commit -m "Add splitMentorReply: parse headline/beats/full-note from raw mentor text"
```

(The `tsx` devDependency added in Step 2 rides along in this commit — it's a
real project dependency now, used again in Task 8.)

---

## Task 8: `turnPreview` shows the headline for structured replies

**Files:**
- Modify: `frontend/src/lib/mentorChatTurns.ts`

- [ ] **Step 1: Update `turnPreview`**

In `frontend/src/lib/mentorChatTurns.ts`, the file already starts with
`import type { ChatMessage } from '../services/mentorClient';` — leave that
line alone. Add ONE new import below it:

```ts
import { splitMentorReply } from './mentorReplyStructure';
```

Then replace the existing `turnPreview` function (the `ChatTurn` interface
and `groupMessagesIntoTurns` above it are unchanged) with:

```ts
export function turnPreview(text: string, maxLen = 140): string {
  const { headline, hasStructure } = splitMentorReply(text);
  const source = hasStructure && headline ? headline : text;
  const flat = source.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen).trim()}…`;
}
```

- [ ] **Step 2: Verify manually**

(`tsx` is already installed from Task 7 — no install step needed here.)

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npx tsx -e "
import { turnPreview } from './src/lib/mentorChatTurns';
console.log(turnPreview('It is your lighting, not your framing.\n\n**Working:** fine.\n\n---\n\nLong note.'));
console.log(turnPreview('Just a plain unstructured reply with no divider at all in it whatsoever, long enough to truncate past the default one hundred forty character limit for sure.'));
"
```

Expected: first prints the headline only ("It is your lighting, not your framing."); second prints the truncated plain text (unchanged old behavior).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/src/lib/mentorChatTurns.ts
git commit -m "turnPreview: show the headline, not a raw prefix, for structured replies"
```

---

## Task 9: `MentorStructuredReply` component

**Files:**
- Create: `frontend/src/components/MentorStructuredReply.tsx`

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/MentorStructuredReply.tsx`:

```tsx
/**
 * Renders a completed (non-streaming) mentor reply in the structured shape:
 * a prominent headline, 2-3 labeled beats with an icon each, and the full
 * warm narrative tucked behind an expander. See mentorReplyStructure.ts for
 * the parsing and app/prompts/mentor.txt for the contract this depends on.
 */

import React, { useState } from 'react';
import { Check, ArrowDownRight, ArrowRight, Circle, ChevronDown } from 'lucide-react';
import { MentorMarkdown } from './MentorMarkdown';
import { splitMentorReply, beatIcon } from '../lib/mentorReplyStructure';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  check: Check,
  'arrow-down-right': ArrowDownRight,
  'arrow-right': ArrowRight,
  circle: Circle,
};

const ICON_COLOR: Record<string, string> = {
  check: 'text-green-400',
  'arrow-down-right': 'text-amber-400',
  'arrow-right': 'text-brand-400',
  circle: 'text-muted',
};

interface Props {
  content: string;
}

export const MentorStructuredReply: React.FC<Props> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const { headline, beats, fullNote, hasStructure } = splitMentorReply(content);

  if (!hasStructure) {
    // No --- divider found -- render the whole thing as-is, no expander.
    return <MentorMarkdown content={content} />;
  }

  return (
    <div>
      {headline && (
        <p className="font-serif text-lg text-white leading-snug mb-3">{headline}</p>
      )}

      {beats.length > 0 && (
        <div className="space-y-2 mb-3">
          {beats.map((beat, i) => {
            const iconKey = beatIcon(beat.label);
            const Icon = ICONS[iconKey];
            return (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_COLOR[iconKey]}`} aria-hidden />
                <p className="text-stone-200 leading-relaxed">
                  <span className="font-medium text-white">{beat.label}:</span> {beat.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {fullNote && (
        <div className="border-t border-warm/50 pt-2.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
            {expanded ? 'Hide the full note' : 'Read the full note'}
          </button>
          {expanded && (
            <div className="mt-2.5">
              <MentorMarkdown content={fullNote} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npx tsc --noEmit`
Expected: no errors (this component isn't wired up to anything yet, but must compile standalone)

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/MentorStructuredReply.tsx`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/src/components/MentorStructuredReply.tsx
git commit -m "Add MentorStructuredReply: headline + beats + collapsible full note"
```

---

## Task 10: Wire streaming-vs-done into the chat turn (the actual UX fix)

**Files:**
- Modify: `frontend/src/services/mentorClient.ts` (`ChatMessage` interface)
- Modify: `frontend/src/components/MentorChat.tsx` (`send`)
- Modify: `frontend/src/components/MentorChatTurn.tsx` (render branch)

- [ ] **Step 1: Add `streaming` to `ChatMessage`**

In `frontend/src/services/mentorClient.ts`, find the `ChatMessage` interface and add the field:

```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** True while an assistant message's text is still arriving via SSE.
   * Absent/false means it's final -- MentorChatTurn uses this to decide
   * between raw live rendering and the structured headline/beats layout. */
  streaming?: boolean;
}
```

- [ ] **Step 2: Set `streaming: true` on creation, `false` on completion**

In `frontend/src/components/MentorChat.tsx`, in `send` (~line 128), update the `onDelta` callback and the post-await line:

```ts
        try {
          const res = await streamMentorMessage(trimmed, persona, {
            signal: controller.signal,
            photoId,
            onDelta: (delta) => {
              accumulated += delta;
              if (!assistantStarted) {
                assistantStarted = true;
                setMessages((prev) => [
                  ...prev,
                  { id: assistantId, role: 'assistant', content: accumulated, streaming: true },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
                );
              }
            },
          });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
          );
          setLatestReceipt(res.memoryReceipt ?? null);
        } catch (e) {
```

(Only two lines change: the object literal in the "first delta" branch gains `streaming: true`, and a new `setMessages` call right after `await streamMentorMessage` resolves flips it to `false`. Everything else in `send` is unchanged.)

- [ ] **Step 3: Render the structured layout only when done**

In `frontend/src/components/MentorChatTurn.tsx`:

```tsx
import { MentorMarkdown } from './MentorMarkdown';
import { MentorStructuredReply } from './MentorStructuredReply';
```

Replace the reply-rendering block (~line 95-100):

```tsx
          <div
            className="font-serif text-stone-100 text-sm leading-relaxed"
            aria-label="Engram mentor reply"
          >
            {turn.assistant.streaming
              ? <MentorMarkdown content={turn.assistant.content} />
              : <MentorStructuredReply content={turn.assistant.content} />}
          </div>
```

- [ ] **Step 4: Typecheck**

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Lint**

Run: `npx eslint src/components/MentorChat.tsx src/components/MentorChatTurn.tsx src/services/mentorClient.ts`
Expected: no errors

- [ ] **Step 6: Live verification in preview (this is the real test for this task)**

Start both dev servers and drive the chat exactly like the earlier live-verification passes this session:

```
mcp__Claude_Preview__preview_start (name: engram-backend)
mcp__Claude_Preview__preview_start (name: engram-frontend)
```

Navigate to `http://localhost:5173/?judge=1`, open a low-scored photo's detail view, ask "why is this rated so low?" in the photo chat panel, and observe:
- While streaming: raw text appears token-by-token exactly as before (no premature structuring).
- On completion: the view swaps ONCE to headline + labeled beats with icons + a "Read the full note" toggle. Clicking it reveals the full narrative.
- The Memory Receipt still appears below, unaffected.
- Collapse the turn (click the accordion header) and confirm the collapsed preview shows the headline, not a bold label fragment.
- Click "Listen" and confirm no `---` or `**` is audibly read (informal check — listen for the reader NOT saying "asterisk" or "dash dash dash").

Fix anything that doesn't match before proceeding.

- [ ] **Step 7: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/src/services/mentorClient.ts frontend/src/components/MentorChat.tsx frontend/src/components/MentorChatTurn.tsx
git commit -m "Render structured mentor replies once streaming completes"
```

---

## Task 11: Home identity line

**Files:**
- Modify: `frontend/src/services/journeyClient.ts` (`JourneyResponse` type)
- Modify: `frontend/src/components/JourneySection.tsx`

- [ ] **Step 1: Add `identity` to the type**

In `frontend/src/services/journeyClient.ts`:

```ts
export interface JourneyResponse {
  summary: string;
  skills: JourneySkill[];
  stats: JourneyStats;
  identity: string | null;
}
```

- [ ] **Step 2: Render it above the summary sentence**

In `frontend/src/components/JourneySection.tsx`, update the `Props` interface and the render:

```tsx
interface Props {
  summary: string;
  skills: JourneySkill[];
  stats: JourneyStats;
  identity: string | null;
}

// ...

export const JourneySection: React.FC<Props> = ({ summary, skills, identity }) => {
  if (skills.length === 0) {
    return (
      <section className="max-w-4xl mx-auto px-1">
        <Eyebrow className="mb-3">Your journey</Eyebrow>
        <EmptyState
          icon={<Sparkles className="w-6 h-6" />}
          description="Upload your first photos and I'll start learning your strengths."
        />
      </section>
    );
  }

  const cleared = skills.filter((s) => s.status === 'cleared');
  const watching = skills.filter((s) => s.status === 'watching');
  const currentFocus = pickCurrentFocus(watching);

  return (
    <section className="max-w-4xl mx-auto px-1 space-y-4">
      <Eyebrow>Your journey</Eyebrow>

      {identity && (
        <p className="font-serif text-xl md:text-2xl text-white leading-snug">{identity}</p>
      )}

      {summary && (
        <p className="font-serif text-lg md:text-xl text-white leading-snug border-l-2 border-brand-500/40 pl-4">
          {summary}
        </p>
      )}
      {/* ...rest unchanged... */}
```

- [ ] **Step 3: Update the call site in `HomeTab.tsx`**

Find where `<JourneySection` is rendered (grep confirmed it's around line 557 passing `summary`/`skills`/`stats`) and add `identity={journey.identity}`:

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && grep -n "JourneySection summary" src/components/HomeTab.tsx`

Then edit that line to add the prop, e.g.:
```tsx
<JourneySection summary={journey.summary} skills={journey.skills} stats={journey.stats} identity={journey.identity} />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (TypeScript will catch a missing `identity` prop if Step 3 is skipped — that's the point of adding it to the interface first)

- [ ] **Step 5: Live verification**

With the preview servers still running (or restarted), reload `http://localhost:5173/?judge=1`, go to Home, and confirm the identity line renders above the summary sentence for the seeded demo user.

- [ ] **Step 6: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/src/services/journeyClient.ts frontend/src/components/JourneySection.tsx frontend/src/components/HomeTab.tsx
git commit -m "Render the Home identity line above the journey summary"
```

---

## Task 12: Logo swap

**Files:**
- Create: `frontend/public/engram-icon-32.png`, `engram-icon-192.png`, `engram-icon-512.png`
- Modify: `frontend/index.html`
- Modify: `frontend/public/manifest.json`
- Delete: `frontend/public/favicon.png`, `favicon.svg`, `iris-icon-192.png`, `iris-icon-512.png`

- [ ] **Step 1: Generate the derivative PNGs from the chosen source**

Run:
```bash
cd "/Users/prasadt1/qwen hackathon/engram"
sips -z 32 32 assets/logo-options/engram-app-icon-gpt55.png --out frontend/public/engram-icon-32.png
sips -z 192 192 assets/logo-options/engram-app-icon-gpt55.png --out frontend/public/engram-icon-192.png
sips -z 512 512 assets/logo-options/engram-app-icon-gpt55.png --out frontend/public/engram-icon-512.png
ls -la frontend/public/engram-icon-*.png
```

Expected: three new PNG files, each well under 200KB (sips downsamples; verify none are still multi-MB — if they are, re-run through `magick <file> -strip -quality 85 <file>` to compress).

- [ ] **Step 2: Update `index.html`**

In `frontend/index.html`, replace the icon `<link>` tags (lines 5-7):

Before:
```html
    <link rel="icon" type="image/png" href="/favicon.png" sizes="32x32" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/iris-icon-512.png" />
```

After:
```html
    <link rel="icon" type="image/png" href="/engram-icon-32.png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/engram-icon-512.png" />
```

(No SVG favicon anymore — the old `favicon.svg` was the leftover `aria-label="Iris"` aperture mark; the new logo only exists as a raster, and a 32px PNG favicon is standard and sufficient.)

- [ ] **Step 3: Update `manifest.json`**

Replace `frontend/public/manifest.json`'s `icons` array:

```json
  "icons": [
    {
      "src": "/engram-icon-32.png",
      "sizes": "32x32",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/engram-icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/engram-icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
```

- [ ] **Step 4: Confirm no other references to the files being deleted**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && grep -rln "favicon.png\|favicon.svg\|iris-icon-192\|iris-icon-512" --include="*.tsx" --include="*.ts" --include="*.html" --include="*.json" --include="*.md" . | grep -v node_modules | grep -v /dist/`

Expected: no output. (Steps 2-3 just rewrote `index.html` and `manifest.json`
to drop these filenames — this grep confirms nothing ELSE in the repo still
references them before deleting the files in Step 5.)

- [ ] **Step 5: Delete the superseded files**

```bash
git rm frontend/public/favicon.png frontend/public/favicon.svg frontend/public/iris-icon-192.png frontend/public/iris-icon-512.png
```

- [ ] **Step 6: Verify the build still produces a working app**

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npm run build`
Expected: builds successfully with no missing-asset warnings.

- [ ] **Step 7: Live verification**

Restart the frontend preview server, load `http://localhost:5173/?judge=1`, and check the browser tab's favicon visually (or via `preview_screenshot` on the tab area if the harness captures it — otherwise inspect `document.querySelector('link[rel="icon"]').href` via `preview_eval` and confirm it resolves to `/engram-icon-32.png` with a 200).

- [ ] **Step 8: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/public/engram-icon-32.png frontend/public/engram-icon-192.png frontend/public/engram-icon-512.png frontend/index.html frontend/public/manifest.json
git commit -m "Swap in the final Engram app icon (aperture + memory tree + dissolve)"
```

---

## Task 13: Full verification pass, merge, deploy

**Files:** none (verification + deployment only)

- [ ] **Step 1: Run the full backend suite**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python -m pytest -q`
Expected: all passing.

- [ ] **Step 2: Typecheck and lint the whole frontend**

Run: `cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npx tsc --noEmit && npx eslint .`
Expected: no errors.

- [ ] **Step 3: Confirm the demo re-seed (background, started earlier this session) has finished**

Check its output/exit status before doing live verification against the `demo-user` account — if it's still running, wait for it; if it finished with the hard-asserts failing, that's a separate pre-existing issue to flag, not something this plan's tasks caused.

- [ ] **Step 4: End-to-end live verification against `?judge=1`**

With both preview servers running, walk the full path once more, fresh:
1. Home page shows the identity line.
2. Open a low-scored photo, ask "why is this rated so low?" — confirm headline/beats/full-note behavior end to end, plus the Memory Receipt.
3. Ask a different kind of question ("how am I doing overall?") in the global Mentor tab and confirm the beats used differ sensibly (e.g. maybe just Working + Next) rather than forcing all three.
4. Confirm the browser tab favicon is the new logo.

- [ ] **Step 5: Merge to main and push**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git checkout main
git merge --no-ff dev -m "Merge structured mentor replies, Home identity line, logo swap"
git push
git checkout dev
```

(Adjust branch names if this work happened directly on `dev` vs. a dedicated feature branch — follow whatever this repo's established checkpoint pattern is at execution time.)

- [ ] **Step 6: Deploy to the live ECS box**

```bash
ssh -i ~/Downloads/engram-key.pem root@8.222.253.211 "cd /root/engram && git pull && docker compose up -d --build"
```

- [ ] **Step 7: Verify live**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://engram.prasadtilloo.com/health
curl -s -o /dev/null -w "%{http_code}\n" https://engram.prasadtilloo.com/
```

Expected: both `200`. Then manually re-run the Step 4 checklist against `https://engram.prasadtilloo.com/?judge=1`.

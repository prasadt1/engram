# Engram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Engram — a forgetting-aware photography memory coach on Qwen Cloud + Alibaba Cloud, satisfying every Track 1 (MemoryAgent) hackathon requirement by the Jul 9 2:00 PM PT deadline.

**Architecture:** FastAPI backend on Alibaba SAS calls Qwen models (vision critique, reasoning, fast tier) through a shared `qwen_client`; MongoDB Atlas holds the memory (schema and several modules ported near-verbatim from the Iris foundation); a pure-Python `memory_engine` (already built) does salience-scored recall, progress-driven forgetting/graduation, and token-budget packing, wrapped by a Mongo-backed `memory_store` and exposed both to the specialists directly and via a custom `engram-mcp` server. React 19 frontend (bulk-copied from Iris, then adapted) gets a new Journey home page, a photo-detail split view with inline Mentor chat, and a judge-facing glass-box/benchmark page.

**Tech Stack:** Python 3.11, FastAPI, PyMongo, MongoDB Atlas, Qwen Cloud (DashScope OpenAI-compatible API), Alibaba OSS (`oss2`), Docker on Alibaba SAS, React 19 + Vite + TypeScript + Tailwind, pytest, mongomock (for isolated memory_store tests).

**Reference spec:** `docs/superpowers/specs/2026-07-03-recall-memory-coach-design.md` (reviewer-approved, user-approved 2026-07-03).

---

## Already done (do not redo — verify then move on)

These exist in the `engram` repo, are tested, and are pushed to `main`. Task 1 below just confirms they still pass before building on top.

- `app/config.py` — model IDs, both candidate base URLs, env-overridable.
- `app/qwen_client.py` — `chat_text`, `chat_fast`, `chat_vision`, retry/fallback, `parse_json_with_repair`.
- `scripts/smoke_test_qwen.py` — confirmed live: key is `sk-ws-` prefix, routes through `dashscope-intl` pay-as-you-go. Confirmed live model IDs: `qwen3.6-flash`, `qwen3.7-max`, `qwen-vl-max` (all responded successfully on 2026-07-03).
- `app/memory_engine.py` + `tests/test_memory_engine.py` (10 tests) — `Skill` graduation (N=3 consecutive above-bar sessions, streak resets on a dip), `MemoryItem`/`recall`/`supersede`/`pack`.
- `app/storage.py` + `tests/test_storage.py` (3 tests) — `LocalDiskStorage` now, `OSSStorage` behind `STORAGE_BACKEND=oss`.
- `.env` has a working `DASHSCOPE_API_KEY`. `MONGODB_URI` is still blank — **Task 1 below requires it.**

## Testing approach (read before starting)

- **Backend logic (schema, memory_store, coach parsing, mentor response shaping, engram-mcp, eval/FAMA):** strict TDD, bite-sized, as the skill template prescribes. `memory_store` tests use `mongomock` so they run with no live Atlas connection.
- **FastAPI routes:** one `TestClient`-based integration test per route group (not one test per route) — this codebase (inherited from Iris) has ~35 routes; exhaustive per-route TDD would burn days on scaffolding that matches Iris's own already-proven route shapes.
- **Frontend:** Iris ships no JS test harness (no vitest/jest in `package.json`, only eslint) and this session's own conventions call for verifying UI changes by running the dev server and checking in a real browser. Frontend tasks below are "adapt file → run dev server → verify specific thing in Preview," not unit tests. This is a deliberate scope decision, not an oversight.
- **Infra (Docker, SAS, OSS, deploy proof):** sequential operational steps with a concrete verification command each (curl, `docker ps`, a console screenshot), not pytest.

---

## Phase A — Backend foundations (schema, storage, grounding)

### Task 1: Confirm the venv is Python 3.11, get a MongoDB Atlas connection string, confirm the engine still passes

**Files:** none (environment check + credential-gathering + a smoke check)

- [ ] **Step 0: Confirm the interpreter is 3.11, not the macOS-bundled 3.9.** This machine's `.venv` was originally built against the system Python (3.9.6, symlinked from Xcode's bundled interpreter), which silently breaks Pydantic v2 models using `X | None` syntax (`schema.py`, ported in Task 2, uses this throughout) — Pydantic must evaluate those annotations at class-definition time, and Python 3.9 doesn't support the `|` union operator on bare types, so it raises `TypeError: Unable to evaluate type annotation 'str | None'`. `memory_engine.py`/`storage.py`'s tests passed fine on 3.9 only because their dataclasses never trigger that runtime evaluation — this is exactly the kind of gap that looks fine until Task 2 and then fails confusingly. Run:

```bash
cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python --version
```

Expected: `Python 3.11.x`. If it says 3.9.x, rebuild the venv:

```bash
deactivate 2>/dev/null; rm -rf .venv
/opt/homebrew/bin/python3.11 -m venv .venv   # adjust path if python3.11 lives elsewhere on your machine
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
pip install -q pytest mongomock
```

(As of 2026-07-03 this has already been done once for this repo — this step just guards against a fresh clone or a future session recreating the venv against the wrong interpreter.)

- [ ] **Step 1: Get a MongoDB Atlas URI.** Either reuse your existing Iris Atlas cluster (create a **new database** on it named `engram` — do not point at Iris's live `practice_companion` database, to avoid mixing real Iris data with Engram demo data) or spin up a new free-tier cluster at mongodb.com/atlas. Either way you need a connection string of the form `mongodb+srv://user:pass@cluster.mongodb.net/`.
- [ ] **Step 2: Add it to `.env`**

```
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=engram
```

- [ ] **Step 3: Verify existing tests still pass (this now also confirms the interpreter fix took)**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python -m pytest -q`
Expected: `13 passed` (memory_engine + storage tests — these don't touch Mongo, this just confirms nothing regressed).

- [ ] **Step 4: Commit** (only if `.env.example` needed a new placeholder key)

```bash
git add .env.example
git commit -m "Document MONGODB_DB_NAME in .env.example"
```

---

### Task 2: Port `schema.py` and `db.py` from Iris

**Files:**
- Create: `app/schema.py` (ported from `iris-photography-mentor/app/memory/schema.py`)
- Create: `app/db.py` (ported from `iris-photography-mentor/app/memory/db.py`)
- Test: `tests/test_db.py`

- [ ] **Step 1: Copy schema.py verbatim**

```bash
cp "/Users/prasadt1/qwen hackathon/iris-photography-mentor/app/memory/schema.py" \
   "/Users/prasadt1/qwen hackathon/engram/app/schema.py"
```

This is the file the spec's reviewer already verified contains `CoachAnalysisOutput` at line 90 and is fully model-agnostic (it's just Pydantic — no Google imports). No edits needed yet; later tasks add new models (`Skill`, `MemoryProfile`, genre field) to this same file rather than creating a second schema file (DRY).

- [ ] **Step 2: Copy db.py, adjust default database name**

```bash
cp "/Users/prasadt1/qwen hackathon/iris-photography-mentor/app/memory/db.py" \
   "/Users/prasadt1/qwen hackathon/engram/app/db.py"
```

Edit the one line with the hardcoded default:
```python
# was: name = os.environ.get("MONGODB_DB_NAME", "practice_companion")
name = os.environ.get("MONGODB_DB_NAME", "engram")
```

- [ ] **Step 3: Write the connectivity test**

```python
# tests/test_db.py
import os
import pytest
from dotenv import load_dotenv

load_dotenv()

@pytest.mark.skipif(not os.environ.get("MONGODB_URI"), reason="no live Mongo configured")
def test_get_db_connects_and_returns_configured_database():
    from app.db import get_db
    db = get_db()
    assert db.name == os.environ.get("MONGODB_DB_NAME", "engram")
    db.client.admin.command("ping")  # raises if the URI/credentials are bad
```

- [ ] **Step 4: Run it**

Run: `python -m pytest tests/test_db.py -v`
Expected: `PASSED` if `MONGODB_URI` is set and reachable, `SKIPPED` otherwise (never fails the suite for someone without Mongo configured yet).

- [ ] **Step 5: Commit**

```bash
git add app/schema.py app/db.py tests/test_db.py
git commit -m "Port schema.py and db.py from Iris; point default DB at 'engram'

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Port grounding (already local-fallback — no Google Agent Builder work needed)

**Files:**
- Create: `app/grounding.py` (ported + trimmed from `iris-photography-mentor/app/tools/grounding.py`)
- Create: `principles/` (copied from Iris)
- Test: `tests/test_grounding.py`

This is a scope reduction versus the design spec's assumption: `ground_principles()` in Iris already tries a Discovery Engine call *only if* `DATA_STORE_ID` is set, and otherwise returns local markdown-file citations. We simply never set `DATA_STORE_ID`, so we can delete the Discovery Engine branch entirely rather than "re-implement Google Agent Builder grounding."

- [ ] **Step 1: Copy the principles corpus**

```bash
cp -r "/Users/prasadt1/qwen hackathon/iris-photography-mentor/principles" \
      "/Users/prasadt1/qwen hackathon/engram/principles"
```

- [ ] **Step 2: Write the failing test first**

```python
# tests/test_grounding.py
def test_ground_principles_returns_local_citations_for_known_scene():
    from app.grounding import ground_principles
    citations = ground_principles("portrait")
    ids = [c.id for c in citations]
    assert "composition.md" in ids
    assert "lighting.md" in ids
    assert all(c.excerpt for c in citations)

def test_ground_principles_falls_back_to_general_for_unknown_scene():
    from app.grounding import ground_principles
    citations = ground_principles("underwater_macro")
    assert len(citations) > 0  # falls back to the "general" doc set, never empty

def test_detect_scene_type_hint_matches_filename_keywords():
    from app.grounding import detect_scene_type_hint
    assert detect_scene_type_hint("sunset_mountain.jpg", "image/jpeg") == "landscape"
    assert detect_scene_type_hint("random123.jpg", "image/jpeg") == "general"
```

- [ ] **Step 3: Run to verify it fails** (module doesn't exist yet)

Run: `python -m pytest tests/test_grounding.py -v`
Expected: `ModuleNotFoundError: No module named 'app.grounding'`

- [ ] **Step 4: Create `app/grounding.py`** — copy Iris's `tools/grounding.py`, then delete the Discovery Engine branch:

```bash
cp "/Users/prasadt1/qwen hackathon/iris-photography-mentor/app/tools/grounding.py" \
   "/Users/prasadt1/qwen hackathon/engram/app/grounding.py"
```

Edit `app/grounding.py`:
- Change `PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent` to `Path(__file__).resolve().parent.parent` (one less level — Iris's file was two dirs deeper).
- Change the import `from memory.schema import GroundingCitation` to `from app.schema import GroundingCitation`.
- Delete `_search_discovery_engine()` entirely and the `try: from google.cloud import discoveryengine_v1 ...` import inside it.
- Simplify `ground_principles()` to just:

```python
def ground_principles(scene_type: str) -> list[GroundingCitation]:
    """Return curated photography-principle citations for a scene type."""
    scene_key = scene_type.lower().strip()
    if scene_key not in SCENE_TO_DOCS:
        scene_key = "general"
    return [c for doc in SCENE_TO_DOCS[scene_key] if (c := _load_local(doc))]
```

- [ ] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_grounding.py -v`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add app/grounding.py principles/ tests/test_grounding.py
git commit -m "Port grounding as local-only (no Google Agent Builder dependency)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase B — The Coach: first real Qwen-VL critique

### Task 4: Port the Coach prompt (retuned for Qwen-VL, no Gemini-specific language)

**Files:**
- Create: `app/prompts/coach.txt` (ported + edited from Iris)

- [ ] **Step 1: Copy the prompt**

```bash
mkdir -p "/Users/prasadt1/qwen hackathon/engram/app/prompts"
cp "/Users/prasadt1/qwen hackathon/iris-photography-mentor/app/prompts/coach.txt" \
   "/Users/prasadt1/qwen hackathon/engram/app/prompts/coach.txt"
```

- [ ] **Step 2: Edit the opening line and the JSON-schema instruction**

Change:
```
You are the Iris Coach — an expert photography mentor using Gemini 3.1 Pro.
```
to:
```
You are the Engram Coach — an expert photography mentor.
```

Change:
```
Return JSON only, matching the response schema exactly.
```
to:
```
Return JSON only, with exactly these top-level keys: sceneDescription, colourNotes, scores, critique, strengths, improvements, learningPath, settingsEstimate, aestheticTags, glassBox, spatialMetadata, boundingBoxes, genre. No prose outside the JSON object.
```
(Qwen's `response_format={"type": "json_object"}` guarantees valid JSON but not a specific shape — unlike Gemini's `response_schema`, we must spell out the shape in the prompt itself. `CoachAnalysisOutput.model_validate_json()` is still the enforcement layer.)

- [ ] **Step 3: Add the genre-tagging instruction** (new — this is the field the identity lens and scoped chat both depend on, per spec §7)

Append to the prompt:
```

## Genre classification
- genre: classify the photo's primary subject into exactly one of: "landscape", "portrait", "street", "wildlife", "macro", "architecture", "other".
```

- [ ] **Step 4: Commit**

```bash
git add app/prompts/coach.txt
git commit -m "Port Coach prompt for Qwen-VL: strip Gemini references, add genre field"
```

---

### Task 5: Extend `CoachAnalysisOutput` with `genre`

**Files:**
- Modify: `app/schema.py`
- Test: `tests/test_schema.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_schema.py
def test_coach_analysis_output_accepts_genre_field():
    from app.schema import CoachAnalysisOutput
    import json

    payload = {
        "sceneDescription": "A lone tree on a hill at sunset.",
        "scores": {"composition": 7, "lighting": 8, "technique": 6, "creativity": 7, "subject_impact": 7},
        "critique": {"composition": "x", "lighting": "x", "technique": "x", "overall": "x"},
        "strengths": ["good light"],
        "improvements": ["tighten crop"],
        "glassBox": {"observations": ["a"], "reasoning_steps": ["b"], "priority_fixes": []},
        "spatialMetadata": {},
        "genre": "landscape",
    }
    parsed = CoachAnalysisOutput.model_validate(payload)
    assert parsed.genre == "landscape"
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_schema.py -v`
Expected: `FAIL` — Pydantic v2 silently ignores the unrecognized `genre` key by default (it does not reject extra fields), so the failure is specifically `AttributeError: 'CoachAnalysisOutput' object has no attribute 'genre'` on the assertion line, not a validation error.

- [ ] **Step 3: Add the field** in `app/schema.py`, inside `CoachAnalysisOutput`:

```python
    genre: Literal["landscape", "portrait", "street", "wildlife", "macro", "architecture", "other"] = "other"
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_schema.py -v`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add app/schema.py tests/test_schema.py
git commit -m "Add genre field to CoachAnalysisOutput"
```

---

### Task 6: Write `app/coach.py` — the ported vision-critique pipeline

**Files:**
- Create: `app/coach.py`
- Test: `tests/test_coach.py`

This ports `iris-photography-mentor/app/sub_agents/coach_pipeline.py`. Original flow: ground → call Gemini vision with `response_schema` → upload to GCS → embed (Vertex) → write Mongo → build API payload. New flow: ground (Task 3) → call Qwen-VL via `qwen_client.chat_vision` with `parse_json_with_repair` → upload via `storage.get_storage()` → **skip embeddings for MVP** (memory_engine's salience recall doesn't need vectors; note this as a documented, deliberate scope cut, not an oversight) → write Mongo → build API payload.

- [ ] **Step 1: Write the failing test** (mocks `qwen_client.chat_vision` and storage; no real network/DB calls)

```python
# tests/test_coach.py
import base64
from unittest.mock import MagicMock, patch

VALID_COACH_JSON = """{
  "sceneDescription": "A lone tree on a hill at sunset.",
  "colourNotes": "Warm oranges against a cool blue sky.",
  "scores": {"composition": 7, "lighting": 8, "technique": 6, "creativity": 7, "subject_impact": 7},
  "critique": {"composition": "x", "lighting": "x", "technique": "x", "overall": "x"},
  "strengths": ["good light"],
  "improvements": ["tighten crop"],
  "learningPath": [],
  "settingsEstimate": {},
  "aestheticTags": ["golden-hour"],
  "glassBox": {"observations": ["a"], "reasoning_steps": ["b"], "priority_fixes": []},
  "spatialMetadata": {},
  "boundingBoxes": [],
  "genre": "landscape"
}"""


def test_analyze_photo_returns_payload_with_genre_and_writes_to_storage():
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)

    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result) as mock_vision, \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_storage = MagicMock()
        mock_storage.save.return_value = "photos/fake.jpg"
        mock_storage.signed_url.return_value = "https://example.com/fake.jpg"
        mock_get_storage.return_value = mock_storage

        result = analyze_photo(
            image_bytes=b"fake-jpeg-bytes",
            content_type="image/jpeg",
            filename="sunset.jpg",
        )

    assert result["genre"] == "landscape"
    assert result["scores"]["composition"] == 7
    assert result["imageUrl"] == "https://example.com/fake.jpg"
    assert "spatialMetadata" in result  # required by frontend AnalysisResult type
    mock_vision.assert_called_once()
    mock_storage.save.assert_called_once()
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_coach.py -v`
Expected: `ModuleNotFoundError: No module named 'app.coach'`

- [ ] **Step 3: Implement `app/coach.py`**

```python
"""Coach: ground -> Qwen-VL analyze -> storage -> API payload.

Ported from iris-photography-mentor/app/sub_agents/coach_pipeline.py.
Embeddings (image/text vector search) are intentionally not ported for
the hackathon MVP — memory_engine's salience recall works on structured
metadata (importance, recency, scope, genre), not vector similarity.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from app import qwen_client
from app.grounding import detect_scene_type_hint, ground_principles
from app.schema import CoachAnalysisOutput
from app.storage import get_storage

PROMPT_PATH = Path(__file__).parent / "prompts" / "coach.txt"


def _principles_block(citations) -> str:
    return "\n\n".join(f"### {c.title} ({c.id})\n{c.excerpt}" for c in citations)


def _run_coach_model(image_bytes: bytes, mime_type: str, citations) -> CoachAnalysisOutput:
    system = PROMPT_PATH.read_text(encoding="utf-8")
    principles = _principles_block(citations)
    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_uri = f"data:{mime_type};base64,{b64}"

    prompt = f"{system}\n\n## Photography principles\n{principles}\n\nAnalyze this photograph."
    result = qwen_client.chat_vision(data_uri, prompt, json_mode=True)

    def _repair(raw: str) -> str:
        fix_prompt = f"This is not valid JSON. Return ONLY corrected valid JSON, no prose:\n\n{raw}"
        return qwen_client.chat_fast(fix_prompt, json_mode=True).content

    parsed = qwen_client.parse_json_with_repair(result.content, _repair)
    return CoachAnalysisOutput.model_validate(parsed)


def analyze_photo(
    image_bytes: bytes,
    content_type: str,
    filename: str = "photo.jpg",
) -> dict[str, Any]:
    scene = detect_scene_type_hint(filename, content_type)
    citations = ground_principles(scene)
    output = _run_coach_model(image_bytes, content_type, citations)

    storage = get_storage()
    key = storage.save(image_bytes, filename=filename, content_type=content_type)
    image_url = storage.signed_url(key)

    payload: dict[str, Any] = {
        "sceneDescription": output.scene_description,
        "colourNotes": output.colour_notes,
        "scores": output.scores.model_dump(),
        "critique": output.critique.model_dump(),
        "strengths": output.strengths,
        "improvements": output.improvements,
        "learningPath": output.learning_path,
        "aestheticTags": output.aesthetic_tags,
        "genre": output.genre,
        "glassBox": {
            "observations": output.glass_box.observations,
            "reasoning_steps": output.glass_box.reasoning_steps,
            "priority_fixes": [p.model_dump() for p in output.glass_box.priority_fixes],
            "grounding_citations": [c.id for c in citations],
        },
        "spatialMetadata": output.spatial_metadata.model_dump(),
        "settingsEstimate": {
            "focalLength": output.settings_estimate.focal_length,
            "aperture": output.settings_estimate.aperture,
            "shutterSpeed": output.settings_estimate.shutter_speed,
            "iso": output.settings_estimate.iso,
        },
        "imageUrl": image_url,
        "storageKey": key,
    }
    # NOTE: frontend/src/types/index.ts declares AnalysisResult.portfolioEntryId
    # and spatialMetadata as REQUIRED — spatialMetadata is set above;
    # portfolioEntryId is added by the persistence wiring in Task 9.
    return payload
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_coach.py -v`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add app/coach.py tests/test_coach.py
git commit -m "Port Coach pipeline to Qwen-VL (embeddings deliberately deferred)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: First real end-to-end critique (manual smoke test, not automated)

**Files:** none — this is a one-off verification against the live Qwen account before building more on top of Coach.

- [ ] **Step 1: Find or download one real test photo** (any landscape/portrait JPEG on your machine works).
- [ ] **Step 2: Run a manual script**

```bash
cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate
python - <<'EOF'
from dotenv import load_dotenv
load_dotenv()
from app.coach import analyze_photo

with open("/path/to/your/test-photo.jpg", "rb") as f:
    data = f.read()

result = analyze_photo(data, "image/jpeg", "test-photo.jpg")
import json
print(json.dumps(result, indent=2)[:2000])
EOF
```

- [ ] **Step 3: Eyeball the output.** Confirm: `genre` is populated and plausible, `scores` are 0-10 floats, `glassBox.observations` reads like real photo commentary (not hallucinated boilerplate), `imageUrl` points to a real local file under `data/media/`. If the critique quality feels weak, this is the moment to try `qwen3.7-max` or `qwen3-vl-plus` as `ENGRAM_MODEL_VISION` overrides in `.env` and re-run — don't block on perfect parity with Gemini, per the spec's risk mitigation (§15.3): acceptable critique + a great memory engine beats the reverse.
- [ ] **Step 4: Note the result** in `docs/DEVPOST-DRAFT.md`'s "Accomplishments" or "Challenges" section if anything surprised you (good or bad) — capture it now while fresh, per the running war-story pattern from the smoke test.

---

## Phase C — The memory store (Mongo-backed wrapper around memory_engine)

### Task 8: `Skill` and `MemoryItem` Mongo persistence

**Files:**
- Create: `app/memory_store.py`
- Test: `tests/test_memory_store.py` (uses `mongomock`, no live Atlas needed)

- [ ] **Step 1: Add mongomock to dev deps**

```bash
source .venv/bin/activate && pip install mongomock && pip freeze | grep -i mongomock >> requirements-dev.txt
```

Create `requirements-dev.txt` if it doesn't exist yet, with `pytest`, `mongomock`.

- [ ] **Step 2: Write the failing test**

```python
# tests/test_memory_store.py
import mongomock
from datetime import datetime, timezone

def _store():
    from app.memory_store import MemoryStore
    client = mongomock.MongoClient()
    return MemoryStore(db=client["engram_test"])


def test_record_skill_session_persists_and_reloads_streak_state():
    store = _store()
    store.record_skill_session(user_id="u1", skill="horizon_tilt", bar=7.0, score=8.0, evidence_id="p1")
    store.record_skill_session(user_id="u1", skill="horizon_tilt", bar=7.0, score=8.0, evidence_id="p2")
    skill = store.get_skill(user_id="u1", skill="horizon_tilt")
    assert skill.consecutive_above_bar == 2
    assert skill.status.value == "watching"


def test_third_consecutive_good_session_graduates_and_persists():
    store = _store()
    for i in range(3):
        store.record_skill_session(user_id="u1", skill="horizon_tilt", bar=7.0, score=8.0, evidence_id=f"p{i}")
    skill = store.get_skill(user_id="u1", skill="horizon_tilt")
    assert skill.status.value == "cleared"


def test_write_memory_and_recall_scoped_to_user():
    store = _store()
    store.write_memory(user_id="u1", content="likes golden hour", importance=0.8, scope=None, genre="landscape")
    store.write_memory(user_id="u2", content="other user's memory", importance=0.9, scope=None, genre="landscape")

    results = store.recall(user_id="u1", k=5)
    assert len(results) == 1
    assert results[0].content == "likes golden hour"
```

- [ ] **Step 3: Run to verify it fails**

Run: `python -m pytest tests/test_memory_store.py -v`
Expected: `ModuleNotFoundError: No module named 'app.memory_store'`

- [ ] **Step 4: Implement `app/memory_store.py`**

```python
"""Mongo-backed persistence for the pure-Python memory_engine primitives.

Collections:
  skills        — one doc per (user_id, skill name); mirrors Skill dataclass
  memory_items  — one doc per MemoryItem; mirrors MemoryItem dataclass
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.memory_engine import (
    GRADUATION_THRESHOLD, MemoryItem, Skill, SkillStatus, recall_scored as _recall_scored,
)


class MemoryStore:
    def __init__(self, db) -> None:
        self.db = db

    # --- skills / graduation --------------------------------------------

    def get_skill(self, *, user_id: str, skill: str) -> Skill | None:
        doc = self.db.skills.find_one({"user_id": user_id, "name": skill})
        if not doc:
            return None
        return Skill(
            name=doc["name"],
            bar=doc["bar"],
            status=SkillStatus(doc["status"]),
            consecutive_above_bar=doc["consecutive_above_bar"],
            raised_on=doc.get("raised_on"),
            cleared_on=doc.get("cleared_on"),
            evidence_ids=doc.get("evidence_ids", []),
        )

    def record_skill_session(
        self, *, user_id: str, skill: str, bar: float, score: float, evidence_id: str,
        at: datetime | None = None,
    ) -> Skill:
        at = at or datetime.now(timezone.utc)
        current = self.get_skill(user_id=user_id, skill=skill) or Skill(name=skill, bar=bar)
        current.record_session(score, at=at, evidence_id=evidence_id)

        self.db.skills.update_one(
            {"user_id": user_id, "name": skill},
            {"$set": {
                "user_id": user_id,
                "name": current.name,
                "bar": current.bar,
                "status": current.status.value,
                "consecutive_above_bar": current.consecutive_above_bar,
                "raised_on": current.raised_on,
                "cleared_on": current.cleared_on,
                "evidence_ids": current.evidence_ids,
            }},
            upsert=True,
        )
        return current

    def list_skills(self, *, user_id: str) -> list[Skill]:
        docs = self.db.skills.find({"user_id": user_id})
        return [
            Skill(
                name=d["name"], bar=d["bar"], status=SkillStatus(d["status"]),
                consecutive_above_bar=d["consecutive_above_bar"],
                raised_on=d.get("raised_on"), cleared_on=d.get("cleared_on"),
                evidence_ids=d.get("evidence_ids", []),
            )
            for d in docs
        ]

    # --- memory items / recall / forgetting ------------------------------

    def write_memory(
        self, *, user_id: str, content: str, importance: float,
        scope: str | None = None, genre: str | None = None,
    ) -> str:
        doc = {
            "user_id": user_id, "content": content, "importance": importance,
            "created_at": datetime.now(timezone.utc), "scope": scope, "genre": genre,
            "superseded_by": None, "archived": False,
        }
        result = self.db.memory_items.insert_one(doc)
        return str(result.inserted_id)

    def supersede_memory(self, *, old_id: str, new_content: str, importance: float, genre: str | None = None) -> str:
        from bson import ObjectId
        old = self.db.memory_items.find_one({"_id": ObjectId(old_id)})
        new_id = self.write_memory(
            user_id=old["user_id"], content=new_content, importance=importance,
            scope=old.get("scope"), genre=genre or old.get("genre"),
        )
        self.db.memory_items.update_one({"_id": ObjectId(old_id)}, {"$set": {"superseded_by": new_id}})
        return new_id

    def recall(
        self, *, user_id: str, query: str | None = None, scope: str | None = None, genre: str | None = None,
        k: int = 5, include_archived: bool = False,
    ) -> list[MemoryItem]:
        return [item for item, _ in self.recall_scored(
            user_id=user_id, query=query, scope=scope, genre=genre, k=k, include_archived=include_archived,
        )]

    def recall_scored(
        self, *, user_id: str, query: str | None = None, scope: str | None = None, genre: str | None = None,
        k: int = 5, include_archived: bool = False,
    ) -> list[tuple[MemoryItem, dict]]:
        """recall() plus per-item {importance, recency, relevance, salience} —
        feeds the glass-box UI and the engram-mcp recall tool (explainable retrieval)."""
        docs = self.db.memory_items.find({"user_id": user_id})
        items = [
            MemoryItem(
                id=str(d["_id"]), content=d["content"], importance=d["importance"],
                created_at=d["created_at"], scope=d.get("scope"), genre=d.get("genre"),
                superseded_by=d.get("superseded_by"), archived=d.get("archived", False),
            )
            for d in docs
        ]
        return _recall_scored(items, query=query, scope=scope, genre=genre, k=k, include_archived=include_archived)

    def get_memory_stats(self, *, user_id: str) -> dict:
        total = self.db.memory_items.count_documents({"user_id": user_id})
        live = self.db.memory_items.count_documents({"user_id": user_id, "superseded_by": None, "archived": False})
        skills = self.list_skills(user_id=user_id)
        return {
            "total_memories": total,
            "live_memories": live,
            "superseded_memories": total - live,
            "skills_watching": sum(1 for s in skills if s.status == SkillStatus.WATCHING),
            "skills_cleared": sum(1 for s in skills if s.status == SkillStatus.CLEARED),
        }
```

- [ ] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_memory_store.py -v`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add app/memory_store.py tests/test_memory_store.py requirements-dev.txt
git commit -m "Add Mongo-backed memory_store wrapping the pure memory_engine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Wire Coach uploads into the memory store (graduation-driving writes)

**Files:**
- Modify: `app/coach.py`
- Test: `tests/test_coach.py` (extend)

Every Coach critique should record a skill-session for each scored dimension below its target bar (so the mentor tracks "weaknesses"), and write a memory item summarizing the critique for recall.

- [ ] **Step 1: Write the failing test** (extend `tests/test_coach.py`)

```python
def test_analyze_photo_records_skill_sessions_for_weak_dimensions():
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    mock_store = MagicMock()

    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result), \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://x/fake.jpg"

        analyze_photo(
            image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg",
            user_id="u1", memory_store=mock_store, weakness_bar=7.5,
        )

    # technique scored 6 in VALID_COACH_JSON, below the 7.5 bar -> should be tracked
    mock_store.record_skill_session.assert_any_call(
        user_id="u1", skill="technique", bar=7.5, score=6, evidence_id=mock_store.record_skill_session.call_args_list[0].kwargs.get("evidence_id"),
    )
    mock_store.write_memory.assert_called_once()
    mock_store.db.portfolio_entries.insert_one.assert_called_once()
    # portfolioEntryId is required by the frontend AnalysisResult type
    # (str() of the mock's inserted_id is fine for this unit test)
    # -> capture the returned payload in this test and assert the key exists:
    #    result = analyze_photo(...); assert "portfolioEntryId" in result
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_coach.py -v`
Expected: `TypeError: analyze_photo() got an unexpected keyword argument 'user_id'`

- [ ] **Step 3: Extend `analyze_photo` signature and wiring** in `app/coach.py`:

```python
def analyze_photo(
    image_bytes: bytes,
    content_type: str,
    filename: str = "photo.jpg",
    *,
    user_id: str | None = None,
    memory_store=None,
    weakness_bar: float = 7.0,
) -> dict[str, Any]:
    # ... existing body up through building `payload` unchanged ...

    if memory_store is not None and user_id is not None:
        evidence_id = key  # the storage key doubles as the evidence reference
        for dim, score in payload["scores"].items():
            memory_store.record_skill_session(
                user_id=user_id, skill=dim, bar=weakness_bar, score=score, evidence_id=evidence_id,
            )
        summary = f"{output.genre} photo: {output.scene_description[:120]}"
        memory_store.write_memory(
            user_id=user_id, content=summary, importance=0.6,
            scope=evidence_id, genre=output.genre,
        )
        # Persist the portfolio entry the frontend contract requires:
        # AnalysisResult.portfolioEntryId is REQUIRED in frontend types, and
        # the Library/Home read routes (Task 13b) list these documents.
        from datetime import datetime, timezone
        entry = memory_store.db.portfolio_entries.insert_one({
            "user_id": user_id,
            "storage_key": key,
            "image_url": image_url,
            "scores": payload["scores"],
            "genre": output.genre,
            "aesthetic_tags": output.aesthetic_tags,
            "scene_description": output.scene_description,
            "colour_notes": output.colour_notes,
            "glass_box": payload["glassBox"],
            "spatial_metadata": payload["spatialMetadata"],
            "created_at": datetime.now(timezone.utc),
        })
        payload["portfolioEntryId"] = str(entry.inserted_id)

    return payload
```

(Note: only dimensions *below* the bar are usually interesting to track as "watching," but recording every session for every dimension is simpler and correct — `Skill.record_session` already resets the streak on a below-bar score and only graduates on 3 consecutive *above*-bar sessions, so tracking all five dimensions per photo is harmless and gives the Journey page full trend data for the identity/patterns lenses too.)

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_coach.py -v`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add app/coach.py tests/test_coach.py
git commit -m "Wire Coach critiques into memory_store (skill sessions + recall memory)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase D — Mentor, Reflection, and the FastAPI app

### Task 10: Port and retune the Mentor prompt for the standard response shape

**Files:**
- Create: `app/prompts/mentor.txt` (ported + edited)

- [ ] **Step 1: Copy and read the original**

```bash
cp "/Users/prasadt1/qwen hackathon/iris-photography-mentor/app/prompts/mentor.txt" \
   "/Users/prasadt1/qwen hackathon/engram/app/prompts/mentor.txt"
```

- [ ] **Step 2: Add the standard response shape** (per spec §5.5) as an explicit instruction block appended to the prompt:

```

## Response shape (always follow this order)
1. Recall specifics from the user's memory relevant to their question — cite what you actually found, not generic advice.
2. If any related skill has status "cleared", say so explicitly and warmly (e.g. "you've cleared X — I've stopped coaching on it").
3. State the current focus (the highest-priority "watching" skill, or the user's stated goal if no skill is watching).
Keep it conversational — this is a chat reply, not a report. Do not use headers or bullet lists unless the user asked for a list.
```

- [ ] **Step 3: Strip any remaining Gemini/ADK-specific references** (skim the file for "Gemini", "ADK", "sub-agent" and remove/rephrase).
- [ ] **Step 4: Commit**

```bash
git add app/prompts/mentor.txt
git commit -m "Port Mentor prompt with the standard recall->retire->focus response shape"
```

---

### Task 10b: `app/context_builder.py` — one shared memory-context path + the Memory Receipt (added after post-fix review)

**Files:**
- Create: `app/context_builder.py`
- Test: `tests/test_context_builder.py`

**Why:** the Memory Receipt (shown after every critique/chat reply: what was *recalled*, what was *retired/excluded*, what was *dropped by token budget*, and *why* — per-item scores) is only honest if it reports what the prompt **actually contained**. So context construction gets one narrow module used by Mentor (Task 11), the receipt, and later eval — built around the existing `recall_scored()` and `pack()`, NOT a broad refactor.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_context_builder.py
from datetime import datetime, timedelta, timezone
from app.memory_engine import MemoryItem

NOW = datetime(2026, 7, 3, tzinfo=timezone.utc)


def _items():
    live_big = MemoryItem(id="live_big", content="working on night exposure " + "x " * 200,
                          importance=0.9, created_at=NOW - timedelta(days=1))
    live_small = MemoryItem(id="live_small", content="prefers golden hour light",
                            importance=0.8, created_at=NOW - timedelta(days=2))
    retired = MemoryItem(id="retired", content="used to shoot Canon",
                         importance=0.8, created_at=NOW - timedelta(days=3), superseded_by="new")
    return [live_big, live_small, retired]


def test_build_context_returns_packed_items_and_full_receipt():
    from app.context_builder import build_memory_context

    ctx = build_memory_context(_items(), query="what light do I like?", token_budget=30, now=NOW)

    packed_ids = [i.id for i in ctx.packed]
    assert "live_small" in packed_ids            # fits budget
    assert "live_big" not in packed_ids          # too big for budget
    receipt = ctx.receipt()
    assert receipt["recalled"][0]["scores"]["salience"] > 0
    assert "retired" in [r["id"] for r in receipt["retired_excluded"]]
    assert "live_big" in [d["id"] for d in receipt["dropped_by_budget"]]
    assert receipt["token_budget"] == 30
```

- [ ] **Step 2: Run to verify it fails** (`ModuleNotFoundError`)
- [ ] **Step 3: Implement `app/context_builder.py`**

```python
"""One shared path from memory items -> packed prompt context + Memory Receipt.

The receipt is the product-facing face of the engine: recall, forgetting,
and context-budget mechanics visible in the main flow, not just a judge page.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.memory_engine import MemoryItem, recall_scored, salience_breakdown


def _estimate_tokens(item: MemoryItem) -> int:
    return max(1, len(item.content) // 4)


@dataclass
class MemoryContext:
    packed: list[MemoryItem]
    packed_scores: list[dict]
    dropped_by_budget: list[MemoryItem]
    retired_excluded: list[MemoryItem]
    token_budget: int
    query: str | None

    def context_block(self) -> str:
        return "\n".join(f"- {m.content}" for m in self.packed) or "(no relevant memories yet)"

    def receipt(self) -> dict:
        return {
            "recalled": [
                {"id": m.id, "content": m.content, "genre": m.genre, "scores": s}
                for m, s in zip(self.packed, self.packed_scores)
            ],
            "retired_excluded": [
                {"id": m.id, "content": m.content} for m in self.retired_excluded
            ],
            "dropped_by_budget": [
                {"id": m.id, "content": m.content} for m in self.dropped_by_budget
            ],
            "token_budget": self.token_budget,
            "query": self.query,
        }


def build_memory_context(
    items: list[MemoryItem], *, query: str | None = None,
    scope: str | None = None, genre: str | None = None,
    k: int = 8, token_budget: int = 1200, now: datetime | None = None,
) -> MemoryContext:
    now = now or datetime.now(timezone.utc)
    retired = [i for i in items if not i.is_live()]
    scored = recall_scored(items, now=now, query=query, scope=scope, genre=genre, k=k)

    packed: list[MemoryItem] = []
    packed_scores: list[dict] = []
    dropped: list[MemoryItem] = []
    used = 0
    for item, scores in scored:
        cost = _estimate_tokens(item)
        if used + cost <= token_budget:
            packed.append(item)
            packed_scores.append(scores)
            used += cost
        else:
            dropped.append(item)

    return MemoryContext(
        packed=packed, packed_scores=packed_scores, dropped_by_budget=dropped,
        retired_excluded=retired, token_budget=token_budget, query=query,
    )
```

- [ ] **Step 4: Run to verify green, then the whole suite.**
- [ ] **Step 5: Commit** (`git add app/context_builder.py tests/test_context_builder.py && git commit -m "Add shared memory-context builder + Memory Receipt"`)

---

### Task 11: `app/mentor.py` — chat with scoped recall, session continuity, and persona

**Files:**
- Create: `app/mentor.py`
- Test: `tests/test_mentor.py`

**Wire-compatibility note (added after plan review):** Iris's real `mentorClient.ts`/`MentorTab.tsx` send `{message, sessionId, persona}` and expect back `{reply, persona, sessionId, userId}` — `session_id` and `persona` are functionally used today (Iris's ADK orchestrator uses them for conversation continuity and tone). Our new backend has no ADK session concept, but we still honor the wire format so the existing frontend needs zero breaking changes: `session_id` becomes a lightweight rolling-turn-history key (last 6 turns, stored directly via `memory_store.db.chat_turns` — a small addition scoped to this task, not touching `MemoryStore`'s already-tested interface from Task 8) so follow-up questions in the same chat session read naturally; `persona` is passed through to the prompt for tone only. This is a deliberate, documented scope choice: we are not reimplementing ADK-style session state, just enough to make multi-turn chat feel coherent and keep the frontend contract intact.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_mentor.py
from unittest.mock import MagicMock, patch


def test_chat_scopes_recall_to_photo_id_when_provided():
    from app.mentor import chat

    mock_store = MagicMock()
    mock_store.recall.return_value = []
    mock_store.list_skills.return_value = []
    mock_store.db.chat_turns.find.return_value.sort.return_value.limit.return_value = []
    fake_result = MagicMock(content="Great question about your night shots!")

    with patch("app.mentor.qwen_client.chat_text", return_value=fake_result):
        reply = chat(
            message="How's my night photography?", user_id="u1", memory_store=mock_store,
            photo_id="p123", session_id="s1", persona="hobbyist",
        )

    assert reply == "Great question about your night shots!"
    mock_store.recall.assert_called_once()
    _, kwargs = mock_store.recall.call_args
    assert kwargs["scope"] == "p123"


def test_chat_uses_global_scope_when_no_photo_id():
    from app.mentor import chat

    mock_store = MagicMock()
    mock_store.recall.return_value = []
    mock_store.list_skills.return_value = []
    mock_store.db.chat_turns.find.return_value.sort.return_value.limit.return_value = []
    fake_result = MagicMock(content="Here's your overall progress.")

    with patch("app.mentor.qwen_client.chat_text", return_value=fake_result):
        chat(message="How am I doing overall?", user_id="u1", memory_store=mock_store, photo_id=None, session_id="s1", persona="hobbyist")

    _, kwargs = mock_store.recall.call_args
    assert kwargs["scope"] is None


def test_chat_persists_the_turn_for_session_continuity():
    from app.mentor import chat

    mock_store = MagicMock()
    mock_store.recall.return_value = []
    mock_store.list_skills.return_value = []
    mock_store.db.chat_turns.find.return_value.sort.return_value.limit.return_value = []
    fake_result = MagicMock(content="Sure thing!")

    with patch("app.mentor.qwen_client.chat_text", return_value=fake_result):
        chat(message="Follow-up question", user_id="u1", memory_store=mock_store, photo_id=None, session_id="s1", persona="hobbyist")

    assert mock_store.db.chat_turns.insert_one.call_count == 2  # user turn + assistant turn
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_mentor.py -v`
Expected: `ModuleNotFoundError: No module named 'app.mentor'`

- [ ] **Step 3: Implement `app/mentor.py`**

```python
"""Mentor: memory-aware chat, global or scoped to a single photo.

session_id drives a small rolling window of recent turns (see module
docstring in the plan task) so multi-turn chat feels coherent without
reimplementing ADK-style session state.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from app import qwen_client
from app.memory_engine import SkillStatus

PROMPT_PATH = Path(__file__).parent / "prompts" / "mentor.txt"
RECENT_TURNS_LIMIT = 6


def _recent_turns(memory_store, user_id: str, session_id: str) -> list[dict]:
    # scoped by user_id AND session_id — a guessed/stale sessionId must never
    # leak another user's conversation (external-review finding A1)
    docs = memory_store.db.chat_turns.find({"user_id": user_id, "session_id": session_id}).sort("created_at", -1).limit(RECENT_TURNS_LIMIT)
    return list(reversed(list(docs)))


def _persist_turn(memory_store, user_id: str, session_id: str, role: str, content: str) -> None:
    memory_store.db.chat_turns.insert_one({
        "user_id": user_id, "session_id": session_id, "role": role, "content": content,
        "created_at": datetime.now(timezone.utc),
    })


def chat(
    *, message: str, user_id: str, memory_store,
    photo_id: str | None = None, session_id: str, persona: str = "hobbyist",
) -> str:
    system = PROMPT_PATH.read_text(encoding="utf-8")
    memories = memory_store.recall(user_id=user_id, scope=photo_id, k=8, query=message)
    skills = memory_store.list_skills(user_id=user_id)
    recent = _recent_turns(memory_store, user_id, session_id)

    memory_block = "\n".join(f"- {m.content}" for m in memories) or "(no relevant memories yet)"
    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]
    watching = [s.name for s in skills if s.status == SkillStatus.WATCHING]
    turns_block = "\n".join(f"{t['role']}: {t['content']}" for t in recent) or "(start of conversation)"

    context = (
        f"## Persona\n{persona}\n\n"
        f"## Recent turns in this conversation\n{turns_block}\n\n"
        f"## Relevant memories\n{memory_block}\n\n"
        f"## Cleared skills (mention if relevant)\n{', '.join(cleared) or 'none yet'}\n\n"
        f"## Currently watching\n{', '.join(watching) or 'none yet'}\n\n"
        f"## User's message\n{message}"
    )

    result = qwen_client.chat_text(context, system=system)

    _persist_turn(memory_store, user_id, session_id, "user", message)
    _persist_turn(memory_store, user_id, session_id, "assistant", result.content)

    return result.content
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_mentor.py -v`
Expected: `3 passed`

**Memory Receipt addendum (post-fix review, P0 — apply while implementing, exact contract):** `chat()` returns `dict`, not `str`: `{"reply": <text>, "receipt": <MemoryContext.receipt()>}`. Implementation delta: replace the direct `memory_store.recall(...)` + `memory_block` lines with:

```python
    items = memory_store.recall(user_id=user_id, scope=photo_id, k=50, query=None, include_archived=True)
    # k=50/include_archived: hand the builder the candidate pool; IT does the
    # live-filtering, scoring, and packing so the receipt reflects reality.
    from app.context_builder import build_memory_context
    ctx = build_memory_context(items, query=message, scope=photo_id, k=8)
    memory_block = ctx.context_block()
```

and return `{"reply": result.content, "receipt": ctx.receipt()}`. Update the three tests accordingly (`reply = chat(...)["reply"]`). Task 13's route then returns `{"reply": ..., "memoryReceipt": receipt, "persona": ..., "sessionId": ..., "userId": ...}` — additive key, no frontend break; update Task 13's wire-format test to assert `"memoryReceipt" in body`.

- [ ] **Step 5: Commit**

```bash
git add app/mentor.py tests/test_mentor.py
git commit -m "Add Mentor chat: photo-scoped recall, persona, session continuity, Memory Receipt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: `app/reflection.py` — lightweight progress summary

**Files:**
- Create: `app/prompts/reflection.txt` (ported)
- Create: `app/reflection.py`
- Test: `tests/test_reflection.py`

- [ ] **Step 1: Copy and lightly edit the prompt** (same treatment as Task 10: strip Gemini references)

```bash
cp "/Users/prasadt1/qwen hackathon/iris-photography-mentor/app/prompts/reflection.txt" \
   "/Users/prasadt1/qwen hackathon/engram/app/prompts/reflection.txt"
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_reflection.py
from unittest.mock import MagicMock, patch


def test_summarize_progress_includes_skill_counts():
    from app.reflection import summarize_progress
    from app.memory_engine import Skill, SkillStatus

    mock_store = MagicMock()
    mock_store.list_skills.return_value = [
        Skill(name="horizon_tilt", bar=7, status=SkillStatus.CLEARED),
        Skill(name="exposure", bar=7, status=SkillStatus.WATCHING),
    ]
    fake_result = MagicMock(content="You've cleared 1 skill and are working on 1 more.")

    with patch("app.reflection.qwen_client.chat_fast", return_value=fake_result):
        summary = summarize_progress(user_id="u1", memory_store=mock_store)

    assert "cleared" in summary.lower()
```

- [ ] **Step 3: Run to verify it fails**

Run: `python -m pytest tests/test_reflection.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement `app/reflection.py`**

```python
"""Reflection: a short, cheap progress summary (used by the Journey page)."""

from __future__ import annotations

from app import qwen_client
from app.memory_engine import SkillStatus


def summarize_progress(*, user_id: str, memory_store) -> str:
    skills = memory_store.list_skills(user_id=user_id)
    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]
    watching = [s.name for s in skills if s.status == SkillStatus.WATCHING]

    prompt = (
        f"Cleared skills: {', '.join(cleared) or 'none yet'}\n"
        f"Currently watching: {', '.join(watching) or 'none yet'}\n\n"
        "Write one warm, specific sentence summarizing this photographer's progress."
    )
    result = qwen_client.chat_fast(prompt)
    return result.content
```

- [ ] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_reflection.py -v`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add app/prompts/reflection.txt app/reflection.py tests/test_reflection.py
git commit -m "Add Reflection progress summary specialist"
```

---

### Task 13: `app/server.py` — the FastAPI app

**Files:**
- Create: `app/server.py`
- Test: `tests/test_server.py`

Routes needed for the five/six surfaces in spec §5: upload+critique, chat (global + scoped), portfolio list (for the Library), journey summary, memory stats (glass box), health. This intentionally does not port Iris's Planner/Triage/PrintSales/VisualDescriber routes (deferred per spec §14).

**Wire-compatibility note (added after plan review):** the chat route's request/response shape must match Iris's real `mentorClient.ts` exactly — `{message, sessionId, persona}` in, `{reply, persona, sessionId, userId}` out (camelCase on the wire; FastAPI's Pydantic `alias` handles the snake_case↔camelCase translation) — so the existing frontend needs zero breaking changes when Task 22 wires it up. `photo_id` is the one genuinely new field, purely additive.

- [ ] **Step 1: Write the failing integration test**

```python
# tests/test_server.py
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


def _client():
    from app.server import app
    return TestClient(app)


def test_health_endpoint():
    resp = _client().get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_analyze_photo_endpoint_returns_critique(tmp_path):
    fake_payload = {"scores": {"composition": 7}, "genre": "landscape", "imageUrl": "http://x/y.jpg"}
    with patch("app.server.analyze_photo", return_value=fake_payload):
        resp = _client().post(
            "/api/v1/analyze-photo",
            files={"image": ("test.jpg", b"fake-bytes", "image/jpeg")},  # field name must match Iris's agentClient.ts
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    assert resp.json()["genre"] == "landscape"


def test_chat_endpoint_matches_iris_wire_format():
    with patch("app.server.mentor_chat", return_value="Here's how you're doing.") as mock_chat:
        resp = _client().post(
            "/api/v1/agent/chat",
            json={"message": "How am I doing?", "sessionId": "s1", "persona": "hobbyist", "photo_id": "p1"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"reply": "Here's how you're doing.", "persona": "hobbyist", "sessionId": "s1", "userId": "u1"}
    mock_chat.assert_called_once_with(
        message="How am I doing?", user_id="u1", memory_store=mock_chat.call_args.kwargs["memory_store"],
        photo_id="p1", session_id="s1", persona="hobbyist",
    )


def test_chat_endpoint_generates_a_session_id_when_none_provided():
    with patch("app.server.mentor_chat", return_value="Hi there."):
        resp = _client().post(
            "/api/v1/agent/chat",
            json={"message": "Hello"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    assert resp.json()["sessionId"]  # non-empty, generated
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_server.py -v`
Expected: `ModuleNotFoundError: No module named 'app.server'`

- [ ] **Step 3: Implement `app/server.py`**

```python
"""Engram FastAPI app."""

from __future__ import annotations

import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

load_dotenv()

from app.coach import analyze_photo  # noqa: E402
from app.db import get_db  # noqa: E402
from app.mentor import chat as mentor_chat  # noqa: E402
from app.memory_store import MemoryStore  # noqa: E402
from app.reflection import summarize_progress  # noqa: E402

app = FastAPI(title="Engram API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if os.environ.get("STORAGE_BACKEND", "local") != "oss":
    os.makedirs("data/media", exist_ok=True)
    app.mount("/media", StaticFiles(directory="data/media"), name="media")


def _store() -> MemoryStore:
    return MemoryStore(db=get_db())


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/v1/analyze-photo")
async def analyze_photo_endpoint(
    image: UploadFile = File(...),
    user_id: str | None = Form(None),
    shoot_id: str | None = Form(None),
    assignment_id: str | None = Form(None),
    x_user_id: str = Header(default="demo-user"),
):
    # The form field MUST be named `image` — Iris's agentClient.ts posts
    # form.append('image', ...); any other name 422s every upload from the
    # copied frontend. shoot_id/assignment_id are accepted for wire
    # compatibility and currently unused (Planner deferred per spec §14).
    data = await image.read()
    payload = analyze_photo(
        data, image.content_type or "image/jpeg", image.filename or "photo.jpg",
        user_id=user_id or x_user_id, memory_store=_store(),
    )
    return payload


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    message: str
    session_id: str | None = Field(default=None, alias="sessionId")
    persona: str = "hobbyist"
    photo_id: str | None = None


@app.post("/api/v1/agent/chat")
def agent_chat(body: ChatRequest, x_user_id: str = Header(default="demo-user")) -> dict:
    session_id = body.session_id or str(uuid.uuid4())
    reply = mentor_chat(
        message=body.message, user_id=x_user_id, memory_store=_store(),
        photo_id=body.photo_id, session_id=session_id, persona=body.persona,
    )
    return {"reply": reply, "persona": body.persona, "sessionId": session_id, "userId": x_user_id}


@app.get("/api/v1/journey")
def journey(x_user_id: str = Header(default="demo-user")) -> dict:
    store = _store()
    skills = store.list_skills(user_id=x_user_id)
    return {
        "summary": summarize_progress(user_id=x_user_id, memory_store=store),
        "skills": [
            {"name": s.name, "status": s.status.value, "consecutive": s.consecutive_above_bar}
            for s in skills
        ],
        "stats": store.get_memory_stats(user_id=x_user_id),
    }


@app.get("/api/v1/memory-stats")
def memory_stats(x_user_id: str = Header(default="demo-user")) -> dict:
    return _store().get_memory_stats(user_id=x_user_id)
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_server.py -v`
Expected: `4 passed`

- [ ] **Step 5: Run the whole suite to confirm nothing regressed**

Run: `python -m pytest -q`
Expected: all tests pass (memory_engine 10 + storage 3 + db 1(skipped or passed) + grounding 3 + schema 1 + coach 2 + memory_store 3 + mentor 3 + reflection 1 + server 4 = ~31)

- [ ] **Step 6: Commit**

```bash
git add app/server.py tests/test_server.py
git commit -m "Add FastAPI app: analyze-photo, chat, journey, memory-stats routes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 13b: Portfolio read routes — the frontend contract (added after external review)

**Files:**
- Modify: `app/server.py`
- Test: extend `tests/test_server.py`

**Why this task exists:** the copied Iris frontend **hard-requires** `GET /api/v1/portfolio` (query params `limit`, `sortBy` ∈ {date, score}, `sortOrder` ∈ {asc, desc}) and `GET /api/v1/portfolio/stats` — `HomeTab.tsx` calls them in a `Promise.all` with **no `.catch` fallback**, so the home page hard-errors without them. `fetchPortfolioTrends`, `fetchAestheticProfile`, and `fetchAssignments` all have graceful `.catch` fallbacks, but trends is a cheap, high-value port (it feeds the Journey progress/identity lenses) so implement it too; aesthetic-profile may return a minimal stub; assignments stays unimplemented (frontend degrades gracefully, Planner is deferred).

- [ ] **Step 1: Read the real client contracts before writing anything.** Open `frontend/src/services/memoryClient.ts` and `frontend/src/services/portfolioInsightsClient.ts` in the copied frontend (post-Task 16) or in `iris-photography-mentor/frontend/src/services/` (pre-Task 16), plus the `PortfolioEntry`/stats/trends types they reference in `frontend/src/types/`. Mirror the exact paths, query params, and response keys — do not invent a nicer shape; the frontend is the contract.
- [ ] **Step 2: Write failing tests** (extend `tests/test_server.py`; patch `app.server._store` / `get_db` with a `mongomock` database pre-seeded with 3 `portfolio_entries` docs shaped like Task 9's insert):
  - `GET /api/v1/portfolio?limit=2&sortBy=date&sortOrder=desc` → 200, 2 entries, newest first, each entry containing the keys the frontend type requires (at minimum: id, imageUrl, scores, genre, sceneDescription, createdAt — confirm exact casing from the client/types read in Step 1).
  - `GET /api/v1/portfolio?sortBy=score&sortOrder=desc` → highest overall score first.
  - `GET /api/v1/portfolio/stats` → 200 with the stats keys the frontend reads (photo count etc. — confirm from client).
  - `GET /api/v1/portfolio/trends?limit=6` → 200 with the points/dimensions shape from Iris's `trends.py` (port `_delta_recent_vs_older` semantics over the seeded scores; the formula already exists in `app/memory_engine.py::compute_delta`).
- [ ] **Step 3: Run to verify they fail** (404s).
- [ ] **Step 4: Implement the routes in `app/server.py`** — read from `db.portfolio_entries` (written by Task 9), computing signed URLs via `get_storage().signed_url(entry["storage_key"])` at read time (do not trust stored URLs to still be valid — OSS signed URLs expire). Trends: reuse `compute_delta` from `app/memory_engine.py` per dimension over chronologically-sorted scores.
- [ ] **Step 5: Run to verify green, then run the whole suite.**
- [ ] **Step 6: Commit**

```bash
git add app/server.py tests/test_server.py
git commit -m "Add portfolio read routes matching the Iris frontend contract

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 14: Run the server locally and do one real manual end-to-end pass

**Files:** none

- [ ] **Step 1: Start it**

```bash
cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate
uvicorn app.server:app --reload --port 8000
```

- [ ] **Step 2: Upload a real photo**

```bash
curl -s -X POST http://localhost:8000/api/v1/analyze-photo \
  -H "X-User-Id: demo-user" \
  -F "file=@/path/to/your/test-photo.jpg" | python -m json.tool
```

- [ ] **Step 3: Chat about it**

```bash
curl -s -X POST http://localhost:8000/api/v1/agent/chat \
  -H "X-User-Id: demo-user" -H "Content-Type: application/json" \
  -d '{"message": "How did I do?"}' | python -m json.tool
```

- [ ] **Step 4: Check the journey endpoint**

```bash
curl -s http://localhost:8000/api/v1/journey -H "X-User-Id: demo-user" | python -m json.tool
```

Expected: a real Qwen-generated critique, a coherent chat reply referencing it, and journey stats showing `total_memories: 1` and skills recorded. If anything errors, this is the checkpoint to fix before building the frontend against it.

---

## Phase E — `engram-mcp`: the custom MCP server (highest technical-depth signal)

### Task 15: MCP server exposing recall/consolidate/forget/get_memory_stats

**Files:**
- Create: `app/engram_mcp.py`
- Test: `tests/test_engram_mcp.py`

- [ ] **Step 1: Add the MCP SDK dependency**

```bash
pip install mcp
echo "mcp>=1.0.0" >> requirements.txt
```

- [ ] **Step 2: Write the failing test** (test the tool functions directly, not the transport — transport is thin plumbing around these)

```python
# tests/test_engram_mcp.py
from unittest.mock import MagicMock


def test_recall_tool_returns_serializable_memories():
    from app.engram_mcp import recall_tool
    from app.memory_engine import MemoryItem
    from datetime import datetime, timezone

    mock_store = MagicMock()
    mock_store.recall_scored.return_value = [(
        MemoryItem(id="1", content="likes golden hour", importance=0.8, created_at=datetime.now(timezone.utc)),
        {"importance": 0.8, "recency": 0.9, "relevance": 1.0, "salience": 0.72},
    )]
    result = recall_tool(mock_store, user_id="u1", query="lighting preferences", k=3)
    assert result[0]["content"] == "likes golden hour"
    assert result[0]["scores"]["salience"] == 0.72
    assert mock_store.recall_scored.call_args.kwargs["query"] == "lighting preferences"


def test_get_memory_stats_tool_delegates_to_store():
    from app.engram_mcp import get_memory_stats_tool

    mock_store = MagicMock()
    mock_store.get_memory_stats.return_value = {"total_memories": 5}
    result = get_memory_stats_tool(mock_store, user_id="u1")
    assert result["total_memories"] == 5
```

- [ ] **Step 3: Run to verify it fails**

Run: `python -m pytest tests/test_engram_mcp.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement the tool functions and the server wiring** in `app/engram_mcp.py`

```python
"""engram-mcp: exposes the memory engine as MCP tools any Qwen agent can mount.

Tool functions are plain, testable Python; `build_server()` wraps them in
the MCP SDK's stdio server for actual protocol serving.
"""

from __future__ import annotations

from typing import Any

from app.memory_store import MemoryStore


def recall_tool(store: MemoryStore, *, user_id: str, query: str, k: int = 5, scope: str | None = None) -> list[dict[str, Any]]:
    # query is genuinely used (relevance term in salience) and every item carries
    # its score breakdown — retrieval is inspectable, not a black box.
    scored = store.recall_scored(user_id=user_id, query=query, scope=scope, k=k)
    return [
        {"id": i.id, "content": i.content, "genre": i.genre, "scores": s}
        for i, s in scored
    ]


def consolidate_tool(store: MemoryStore, *, user_id: str) -> dict[str, Any]:
    # MVP: report what WOULD be consolidated (episodic count -> single semantic summary candidate).
    # Full consolidation (LLM-written semantic summary) is a Phase F follow-on once the eval harness exists.
    stats = store.get_memory_stats(user_id=user_id)
    return {"eligible_for_consolidation": stats["live_memories"], "note": "consolidation pass not yet applied"}


def forget_tool(store: MemoryStore, *, user_id: str, skill: str) -> dict[str, Any]:
    skill_obj = store.get_skill(user_id=user_id, skill=skill)
    if skill_obj is None:
        return {"forgotten": False, "reason": "no such skill tracked"}
    return {"forgotten": skill_obj.status.value == "cleared", "status": skill_obj.status.value}


def get_memory_stats_tool(store: MemoryStore, *, user_id: str) -> dict[str, Any]:
    return store.get_memory_stats(user_id=user_id)


def build_server(store: MemoryStore):
    """Wrap the tool functions in an MCP stdio server. Called by scripts/run_mcp_server.py."""
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    import mcp.types as types

    server = Server("engram-mcp")

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(name="recall", description="Recall relevant memories for a user", inputSchema={
                "type": "object", "properties": {"user_id": {"type": "string"}, "query": {"type": "string"}, "k": {"type": "integer"}},
                "required": ["user_id", "query"],
            }),
            types.Tool(name="get_memory_stats", description="Get memory statistics for a user", inputSchema={
                "type": "object", "properties": {"user_id": {"type": "string"}}, "required": ["user_id"],
            }),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
        import json
        if name == "recall":
            result = recall_tool(store, user_id=arguments["user_id"], query=arguments.get("query", ""), k=arguments.get("k", 5))
        elif name == "get_memory_stats":
            result = get_memory_stats_tool(store, user_id=arguments["user_id"])
        else:
            raise ValueError(f"Unknown tool: {name}")
        return [types.TextContent(type="text", text=json.dumps(result))]

    return server
```

- [ ] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_engram_mcp.py -v`
Expected: `2 passed`

- [ ] **Step 6: Add a thin launcher script**

```python
# scripts/run_mcp_server.py
import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.db import get_db
from app.memory_store import MemoryStore
from app.engram_mcp import build_server


async def main():
    from mcp.server.stdio import stdio_server
    store = MemoryStore(db=get_db())
    server = build_server(store)
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 6b: Prove a LIVE path through MCP — not just wrapped functions (external-review finding H1).** Two artifacts:

  1. `scripts/mcp_demo_transcript.py` — spawns the stdio server as a subprocess via the MCP client SDK (`mcp.client.stdio.stdio_client` + `ClientSession`), calls `recall` (with a real query, against the real DB) and `get_memory_stats`, and writes the full request/response exchange to `docs/mcp-transcript.md`. Commit the transcript — it's judge-readable proof the protocol path works end to end.
  2. Wire ONE production read through MCP: `GET /api/v1/memory-stats?via=mcp` opens an MCP client session to engram-mcp and returns the tool's result (the default, no-param path remains the direct in-process call — the reliability fallback stays, per spec §6). The glass-box page (Task 23) gets a small "served via engram-mcp" toggle that hits this. This is the difference between "we ship an MCP server" and "our app demonstrably runs through it."

- [ ] **Step 7: Commit**

```bash
git add app/engram_mcp.py tests/test_engram_mcp.py scripts/run_mcp_server.py scripts/mcp_demo_transcript.py docs/mcp-transcript.md requirements.txt
git commit -m "Add engram-mcp: custom MCP server exposing recall/forget/stats tools

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase F — Frontend: bulk-copy Iris, then adapt

### Task 16: Bulk-copy the reusable frontend

**Files:** the entire `frontend/` tree

Per the spec (reviewer-verified): the React frontend is ~100% reusable as a starting point — it only speaks JSON to FastAPI. Copy wholesale, then adapt in place, rather than rewriting from scratch.

- [ ] **Step 1: Copy**

```bash
cp -r "/Users/prasadt1/qwen hackathon/iris-photography-mentor/frontend" \
      "/Users/prasadt1/qwen hackathon/engram/frontend"
rm -rf "/Users/prasadt1/qwen hackathon/engram/frontend/node_modules"
```

- [ ] **Step 2: Install and confirm it boots against nothing changed yet**

```bash
cd "/Users/prasadt1/qwen hackathon/engram/frontend" && npm install
```

Create `frontend/.env.local`:
```
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK=false
```

- [ ] **Step 3: Run it**

```bash
npm run dev
```

- [ ] **Step 4: Verify in Preview** — start the backend (Task 14) and the frontend together, open the app, confirm the existing Iris UI loads (it will still say "Iris" and have old tabs — that's expected, Task 17+ rebrand and restructure it).
- [ ] **Step 5: Commit**

```bash
cd "/Users/prasadt1/qwen hackathon/engram"
git add frontend/
git commit -m "Bulk-copy Iris frontend as the Engram UI starting point

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 17: Rebrand — Iris to Engram

**Files:**
- Modify: `frontend/src/components/BrandLogo.tsx`, `IrisMark.tsx` (rename usages), `frontend/index.html` (title), any hardcoded "Iris" strings in nav/header components

- [ ] **Step 1: Find every hardcoded "Iris" string**

```bash
cd "/Users/prasadt1/qwen hackathon/engram/frontend" && grep -rln "Iris" src/ index.html
```

- [ ] **Step 2: Replace with "Engram"** in each file found — page title, header/logo text, any "Powered by Iris" footer text. Leave component **filenames** like `IrisMark.tsx` alone for now (a pure rename is cosmetic and not worth the time; only user-visible strings matter for the demo).
- [ ] **Step 3: Verify in Preview** — reload the app, confirm the header/title now says Engram.
- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Rebrand visible strings from Iris to Engram"
```

---

### Task 18: Journey page (new home tab)

**Files:**
- Modify: `frontend/src/components/HomeTab.tsx` (evolve into the Journey hero surface)
- Create: `frontend/src/services/journeyClient.ts`

- [ ] **Step 1: Add the API client**

```typescript
// frontend/src/services/journeyClient.ts
import { apiFetch } from '../lib/apiFetch';

export interface JourneyResponse {
  summary: string;
  skills: { name: string; status: 'watching' | 'cleared'; consecutive: number }[];
  stats: { total_memories: number; live_memories: number; skills_watching: number; skills_cleared: number };
}

export async function fetchJourney(): Promise<JourneyResponse> {
  const resp = await apiFetch('/api/v1/journey');
  if (!resp.ok) throw new Error('Failed to load journey');
  return resp.json();
}
```

- [ ] **Step 2: In `HomeTab.tsx`, add a data fetch and three new sections** above/alongside the existing content:
  - A "since last time" summary line (from `journey.summary`).
  - A "cleared" list — each cleared skill rendered as a **Graduation evidence card** (post-fix review, P1), not a bare status badge: *raised on <date>* → *three passing sessions* (link the `evidence_ids` photos) → *old advice retired* → *new focus promoted*. All fields already exist on the `Skill` docs (`raised_on`, `cleared_on`, `consecutive_above_bar`, `evidence_ids`). This card is the emotional center of the demo — forgetting as promotion, with receipts.
  - A "watching" list — skills with `status === 'watching'`, the "next step" focus.
  Use existing `DimensionBar`/`FocusAreas` components where they fit rather than inventing new visual primitives.
- [ ] **Step 3: Verify in Preview** — upload a few test photos via the Upload tab first (so there's real data), then check the Journey/Home tab shows real skill state.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HomeTab.tsx frontend/src/services/journeyClient.ts
git commit -m "Add Journey summary (progress, cleared skills, current focus) to home tab"
```

---

### Task 19: Genre chip and "why this advice" strip on critique results

**Files:**
- Modify: whichever component renders the analyze-photo result (find via `grep -rl "sceneDescription" frontend/src/components`)

- [ ] **Step 1: Locate the critique-result component**

```bash
cd "/Users/prasadt1/qwen hackathon/engram/frontend" && grep -rl "sceneDescription\|glassBox" src/components
```

- [ ] **Step 2: Add a genre chip** near the score display, reading `result.genre` (already returned by the backend from Task 6/13).
- [ ] **Step 3: Build the `MemoryReceipt` component (upgraded from a static strip after post-fix review — P0).** One compact, collapsible React component rendered after BOTH critique results and Mentor replies, showing four rows from the backend's `memoryReceipt` payload: **Recalled** (items used, each expandable to its importance/recency/relevance/salience scores), **Retired** (superseded/cleared items intentionally excluded — the visible face of forgetting), **Ignored (budget)** (items dropped by context packing), and the token budget line. Keep it visually quiet (small text, collapsed by default, one-line summary like "4 memories recalled · 2 retired · 1 over budget") — present in the main flow without shouting. Backend side: the analyze-photo response gains a `memoryReceipt` too — in Task 9's wiring, build it from the profile memories used for the critique context (or, if the Coach context is profile-only at that point, a receipt with recalled=[profile summary items], retired/dropped from the same builder — use `build_memory_context` either way so the receipt is truthful).
- [ ] **Step 3b: Narrated Qwen call states (post-fix review, UI guidance).** Replace generic spinners in the upload/critique and chat flows with staged, honest status lines fed to the existing loading UI (`AnalyzingOverlay`, `MentorChatTurn`'s `loadingStage`): "Qwen-VL is reading composition and lighting…" → "Packing memory context…" → "Checking retired memories…". These strings map to real pipeline stages — don't display a stage the code isn't actually in.
- [ ] **Step 4: Verify in Preview** — upload a photo, confirm the genre chip renders.
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Show genre chip on critique results"
```

---

### Task 20: Library — genre filter and milestone badges

**Files:**
- Modify: the library grid component (likely `frontend/src/components/HomeTab.tsx` region or a dedicated library component — locate via `grep -rl "portfolio" frontend/src/components | grep -i librar\|work`)

- [ ] **Step 1: Locate it**

```bash
grep -rln "portfolio" frontend/src/components
```

- [ ] **Step 2: Add genre filter chips** above the grid, filtering the already-fetched portfolio list client-side by `entry.genre` (no new backend call needed — genre is already stored in Mongo per Task 9, just needs to be included in whatever endpoint currently lists portfolio entries; check `frontend/src/services` for the portfolio client and confirm the type includes `genre`, adding it if missing).
- [ ] **Step 3: Verify in Preview** — filter by a genre, confirm the grid updates.
- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add genre filter chips to the library grid"
```

---

### Task 21: Photo detail split view (replaces lightbox for this flow)

**Files:**
- Create: `frontend/src/components/PhotoDetailView.tsx`
- Modify: the library component (wire click handler to open this instead of `ImageLightbox`)

Per the spec addendum (§5.3-5.4, updated 2026-07-03): a two-pane layout, not a modal. Left pane: photo + critique. Right pane: `MentorChat` scoped to this photo (built in Task 22 — stub the chat panel here first, wire it in Task 22).

- [ ] **Step 1: Create the component skeleton**

```tsx
// frontend/src/components/PhotoDetailView.tsx
import React from 'react';

interface Props {
  photo: {
    id: string;
    imageUrl: string;
    genre?: string;
    scores?: Record<string, number>;
  };
  onClose: () => void;
}

export const PhotoDetailView: React.FC<Props> = ({ photo, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col md:flex-row overflow-y-auto">
      <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-stone-200">
        Close
      </button>
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-4">
        <img src={photo.imageUrl} alt="" className="max-w-full max-h-[60vh] md:max-h-[85vh] object-contain rounded-md" />
        {photo.genre && <span className="mt-2 px-2 py-0.5 rounded-full bg-amber-500 text-xs">{photo.genre}</span>}
      </div>
      <div className="w-full md:w-1/2 bg-stone-900 p-4 overflow-y-auto">
        {/* MentorChat scope={{photoId: photo.id}} plugged in during Task 22 */}
        <p className="text-stone-400 text-sm">Chat coming in Task 22.</p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Wire it in from the library** — replace the existing `<ImageLightbox ... />` render for the library-click flow with `<PhotoDetailView ... />`, keeping `ImageLightbox` itself untouched (it may still be used elsewhere, e.g. a "view fullscreen" button inside `PhotoDetailView` later — out of scope for now).
- [ ] **Step 3: Verify in Preview** — click a library photo, confirm the two-pane view opens (mobile: stacks vertically per the `flex-col md:flex-row` classes — verify by resizing the preview viewport).
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PhotoDetailView.tsx
git commit -m "Add photo detail split view (replaces lightbox for library click-through)"
```

---

### Task 22: Extract `MentorChat` as one reusable component (global + scoped)

**Files:**
- Create: `frontend/src/components/MentorChat.tsx` (extracted from `MentorTab.tsx`, reusing `MentorChatTurn.tsx` + `lib/mentorChatTurns.ts` as-is)
- Modify: `frontend/src/components/MentorTab.tsx` (use the new component in global mode)
- Modify: `frontend/src/components/PhotoDetailView.tsx` (use it in scoped mode)
- Modify: `frontend/src/services/mentorClient.ts` (add optional `photoId` — additive only, no breaking change)

**Important — this task was corrected after plan review found the original draft would have broken the real chat.** The real `mentorClient.ts::sendMentorMessage(message, persona, options?)` sends `{message, sessionId, persona}` and returns `ChatResponse {reply, persona, sessionId, userId}`; it manages persona/session via `sessionStorage` helpers (`loadSessionId`, `saveSessionId`, `rememberPersonaForSession`). `MentorChatTurn` renders a `turn: ChatTurn` object (from `lib/mentorChatTurns.ts` — `{id, user: ChatMessage, assistant?: ChatMessage}`), not raw `role`/`content` props, and supports accordion expand/collapse, a loading state with a cancel-after-8-seconds affordance, and markdown rendering. `MentorTab.tsx` (865 lines) already implements all of this correctly — **the extraction must preserve that behavior exactly**, not replace it with a simplified rebuild. Task 13's backend now matches this wire format precisely, so the only backend-side change needed here is threading an optional `photoId`.

- [ ] **Step 1: Read `MentorTab.tsx`'s full send/session logic** (the `send()` function, its `AbortController` usage via `abortRef`, `hasSession`/`loadSessionId` checks, and how it turns its raw message list into `ChatTurn[]` via `groupMessagesIntoTurns`) and `mentorClient.ts` in full (already read during plan review — see the exact source above). Confirm nothing else in `MentorTab.tsx` depends on the chat state that would be lost by extracting it (e.g. suggested-questions handling via `fetchMentorSuggestedQuestions` stays in `MentorTab.tsx`, it is not part of the reusable chat widget).

- [ ] **Step 2: Add `photoId` to `sendMentorMessage`** in `mentorClient.ts` — additive parameter, existing call sites in `MentorTab.tsx` keep working unmodified:

```typescript
export async function sendMentorMessage(
  message: string,
  persona: 'hobbyist' | 'working_pro',
  options?: { signal?: AbortSignal; photoId?: string },
): Promise<ChatResponse> {
  rememberPersonaForSession(persona);
  const sessionId = loadSessionId();
  const res = await apiFetch('/api/v1/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId: sessionId ?? undefined,
      persona,
      photo_id: options?.photoId ?? null,
    }),
    signal: options?.signal,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Chat failed (${res.status})`);
  }
  const data = (await res.json()) as ChatResponse;
  saveSessionId(data.sessionId);
  return data;
}
```

- [ ] **Step 3: Create `MentorChat.tsx`** as a real extraction of `MentorTab.tsx`'s message/turn/loading state machine — reusing `ChatMessage`, `groupMessagesIntoTurns`, and `MentorChatTurn` rather than inventing a simplified renderer:

```tsx
// frontend/src/components/MentorChat.tsx
import React, { useRef, useState } from 'react';
import { sendMentorMessage, type ChatMessage } from '../services/mentorClient';
import { MentorChatTurn } from './MentorChatTurn';
import { groupMessagesIntoTurns } from '../lib/mentorChatTurns';

interface Props {
  persona: 'hobbyist' | 'working_pro';
  photoId?: string; // present -> scoped chat under a single photo; absent -> global Mentor
  placeholder?: string;
}

export const MentorChat: React.FC<Props> = ({ persona, photoId, placeholder }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const turns = groupMessagesIntoTurns(messages);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    setExpandedId(userMsg.id);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await sendMentorMessage(trimmed, persona, { signal: controller.signal, photoId });
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: res.reply }]);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: 'Something went wrong — try again.' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex-1 overflow-y-auto space-y-3">
        {turns.map((turn, i) => (
          <MentorChatTurn
            key={turn.id}
            turn={turn}
            expanded={expandedId === turn.id}
            onToggle={() => setExpandedId(expandedId === turn.id ? null : turn.id)}
            loading={loading && i === turns.length - 1}
            onCancel={() => abortRef.current?.abort()}
            isLatest={i === turns.length - 1}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={placeholder ?? (photoId ? 'Ask about this photo…' : 'Ask your mentor…')}
          className="flex-1 rounded-md px-3 py-2 bg-stone-800 text-stone-100"
        />
        <button onClick={send} disabled={loading} className="px-4 py-2 rounded-md bg-amber-500">
          Send
        </button>
      </div>
    </div>
  );
};
```

Note this deliberately drops `MentorTab.tsx`'s `waitSec`/`loadingStage` display polish for the first pass (they're cosmetic, not structural) — if time allows, port those two pieces of state in as a follow-up; they are not required for the component to work correctly.

- [ ] **Step 4: Wire into `MentorTab.tsx`** — replace its inline chat rendering (message list, turn grouping, send handler) with `<MentorChat persona={mode} />`, keeping the suggested-questions UI and persona-switcher chrome that lives around it in `MentorTab.tsx` untouched.
- [ ] **Step 4b: Render the Memory Receipt under assistant replies (post-fix review, P0).** Extend `ChatResponse` in `mentorClient.ts` with an additive optional `memoryReceipt` field (backend already returns it per Task 13's addendum); `MentorChat` keeps the last receipt in state and renders the shared `MemoryReceipt` component (Task 19) beneath the latest assistant turn, collapsed by default. This replaces the spec's earlier "collapsible glass-box panel" phrasing — same intent, one shared component everywhere.
- [ ] **Step 5: Wire into `PhotoDetailView.tsx`** — replace the Task 21 placeholder with `<MentorChat persona="hobbyist" photoId={photo.id} placeholder="Ask about this photo…" />` (persona can be threaded from app-level user state once that's plumbed through; hardcoding "hobbyist" for now is a fine placeholder — note it as a follow-up, don't block on it).
- [ ] **Step 6: Verify in Preview** — (a) global Mentor tab still works exactly as before: send a message, expand/collapse the turn, confirm persona switching still clears the session as it did pre-extraction; (b) open a photo's split view, ask "tell me about this photo," confirm the reply differs from a generic global answer (backend Task 11 already scopes recall — this step just confirms the wiring reaches it); (c) ask a follow-up in the same chat session and confirm the reply shows awareness of the prior turn (proves Task 11's session-continuity addition is actually wired through, not just unit-tested).
- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/MentorChat.tsx frontend/src/components/MentorTab.tsx \
        frontend/src/components/PhotoDetailView.tsx frontend/src/services/mentorClient.ts
git commit -m "Extract MentorChat as one reusable component (global + photo-scoped)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 23: Glass box / benchmark page

**Files:**
- Create: `frontend/src/components/GlassBoxTab.tsx`
- Modify: nav config to add a footer-linked (not primary-nav) route to it

- [ ] **Step 1: Create a simple stats + placeholder benchmark table page**

```tsx
// frontend/src/components/GlassBoxTab.tsx
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';

export const GlassBoxTab: React.FC = () => {
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/memory-stats').then((r) => r.json()).then(setStats);
  }, []);

  return (
    <div className="p-6 text-stone-200">
      <h2 className="text-lg font-semibold mb-4">Memory engine internals</h2>
      {stats && (
        <dl className="grid grid-cols-2 gap-4 mb-8">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k}>
              <dt className="text-stone-400 text-sm">{k}</dt>
              <dd className="text-2xl">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-stone-400 text-sm">Benchmark results table renders here once /eval has run (Phase G).</p>
    </div>
  );
};
```

- [ ] **Step 2: Add a footer link** to it (find the footer in `App.tsx` or a `Footer` component; add a low-key text link, not a primary nav tab, per spec §5's "footer-linked; ignorable by normal users").
- [ ] **Step 3: Verify in Preview** — click the footer link, confirm stats render with real numbers after uploading a few test photos.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/GlassBoxTab.tsx
git commit -m "Add judge-facing glass-box/memory-stats page"
```

---

## Phase G — Eval harness (the evidence spine)

### Task 24: FAMA metric implementation

**Files:**
- Create: `eval/__init__.py`
- Create: `eval/fama.py`
- Test: `tests/test_fama.py`

- [ ] **Step 1: Write the failing test** (using the formula fixed in the spec: `FAMA = max(0, MPA - λ*(1-FAA))`, `λ = N_forget/(N_presence+N_forget)`)

```python
# tests/test_fama.py
def test_fama_perfect_recall_and_forgetting_scores_one():
    from eval.fama import compute_fama
    # 10 valid memories, all surfaced (MPA=1); 5 obsolete memories, all correctly excluded (FAA=1)
    result = compute_fama(valid_surfaced=10, valid_total=10, obsolete_excluded=5, obsolete_total=5)
    assert result["mpa"] == 1.0
    assert result["faa"] == 1.0
    assert result["fama"] == 1.0


def test_fama_penalizes_surfacing_obsolete_memories():
    from eval.fama import compute_fama
    # perfect recall, but half the obsolete memories leak through (FAA=0.5)
    result = compute_fama(valid_surfaced=10, valid_total=10, obsolete_excluded=2, obsolete_total=4)
    assert result["faa"] == 0.5
    assert result["fama"] < 1.0


def test_fama_never_goes_negative():
    from eval.fama import compute_fama
    result = compute_fama(valid_surfaced=0, valid_total=10, obsolete_excluded=0, obsolete_total=10)
    assert result["fama"] >= 0.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_fama.py -v`
Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implement `eval/fama.py`**

```python
"""FAMA: Forgetting-Aware Memory Accuracy.

FAMA = max(0, MPA - lambda * (1 - FAA))
  MPA (Memory Presence Accuracy)  = fraction of currently-valid memories correctly surfaced
  FAA (Forgetting Accuracy)       = fraction of obsolete/superseded memories correctly excluded
  lambda = N_forget / (N_presence + N_forget), derived from the trace set (per design spec §9)
"""

from __future__ import annotations


def compute_fama(*, valid_surfaced: int, valid_total: int, obsolete_excluded: int, obsolete_total: int) -> dict:
    mpa = valid_surfaced / valid_total if valid_total else 1.0
    faa = obsolete_excluded / obsolete_total if obsolete_total else 1.0
    lam = obsolete_total / (valid_total + obsolete_total) if (valid_total + obsolete_total) else 0.0
    fama = max(0.0, mpa - lam * (1 - faa))
    return {"mpa": round(mpa, 4), "faa": round(faa, 4), "lambda": round(lam, 4), "fama": round(fama, 4)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_fama.py -v`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add eval/ tests/test_fama.py
git commit -m "Implement FAMA (forgetting-aware memory accuracy) metric

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 25: Scripted trace dataset + the `/eval` runner

**Files:**
- Create: `eval/traces.py` (the 20-40 scripted multi-session scenarios)
- Create: `eval/run.py`

This task is inherently more exploratory/manual than TDD (you're authoring test *data*, not testable logic) — write a handful of traces, run the harness, sanity-check the numbers look plausible, then expand to the full 20-40.

- [ ] **Step 1: Define the trace schema and 3-5 seed traces** in `eval/traces.py`:

```python
"""Scripted multi-session memory traces for the /eval harness.

Each trace is a mini life story with facts that get superseded, so
recall/forgetting can be measured against a known-correct answer key.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Fact:
    content: str
    genre: str | None
    valid_from_session: int
    invalidated_by_session: int | None = None  # None = still valid


@dataclass
class Trace:
    user_id: str
    facts: list[Fact]
    query: str
    expects_current: list[str]   # substrings that SHOULD appear in a good answer
    expects_absent: list[str]    # substrings that should NOT appear (superseded facts)


TRACES: list[Trace] = [
    Trace(
        user_id="trace_1",
        facts=[
            Fact("shoots primarily with a Canon body", "gear", valid_from_session=1, invalidated_by_session=3),
            Fact("switched to a Sony mirrorless body", "gear", valid_from_session=3),
        ],
        query="What camera gear do I use?",
        expects_current=["Sony"],
        expects_absent=["Canon"],
    ),
    Trace(
        user_id="trace_2",
        facts=[
            Fact("struggles with tilted horizons in landscape shots", "landscape", valid_from_session=1, invalidated_by_session=4),
            Fact("consistently level horizons across the last three sessions", "landscape", valid_from_session=4),
        ],
        query="Do I still need to work on horizon tilt?",
        expects_current=["no longer", "cleared", "improved"],  # loose match, checked with an OR
        expects_absent=["still tilted", "keep working on horizon"],
    ),
    Trace(
        user_id="trace_adversarial_1",
        facts=[
            Fact("prefers shooting landscapes at midday", "landscape", valid_from_session=6, invalidated_by_session=7),
            Fact("switched to golden-hour landscape sessions", "landscape", valid_from_session=7),
        ],
        query="When do I like to shoot landscapes?",
        expects_current=["golden"],
        expects_absent=["midday"],
    ),
    # ^ adversarial (external-review finding H3): the obsolete "midday" fact is
    # nearly as RECENT as its correction — naive recency ranking surfaces it;
    # only supersession-aware recall reliably excludes it. Include at least 5
    # traces of this recent-but-obsolete class in the full set: they are what
    # separates the engine from the no-forgetting ablation.
    # TODO: expand to 20-40 traces before the final benchmark run — this seed
    # set is enough to validate the harness mechanics first.
]
```

- [ ] **Step 2: Implement `eval/run.py`**

```python
"""One-command benchmark: python -m eval.run --seed 0

Compares the memory-engine recall path against a full-history baseline
(no forgetting, no salience ranking — just dump every fact every time)
on recall accuracy, FAMA, and token cost.
"""

from __future__ import annotations
import argparse
import json
from datetime import datetime, timezone, timedelta

from app.memory_engine import MemoryItem, recall
from eval.fama import compute_fama
from eval.traces import TRACES


def _memory_items_for_trace(trace) -> list[MemoryItem]:
    items = []
    now = datetime.now(timezone.utc)
    for i, fact in enumerate(trace.facts):
        created = now - timedelta(days=(10 - fact.valid_from_session))
        items.append(MemoryItem(
            id=f"{trace.user_id}_{i}", content=fact.content, importance=0.7,
            created_at=created, genre=fact.genre,
            superseded_by=(f"{trace.user_id}_{i}_new" if fact.invalidated_by_session else None),
        ))
    return items


def _estimate_tokens(item: MemoryItem) -> int:
    return max(1, len(item.content) // 4)  # rough chars/4 heuristic, documented as an estimate


def run(seed: int = 0) -> dict:
    results = []
    for trace in TRACES:
        items = _memory_items_for_trace(trace)
        recalled = recall(items, k=5, query=trace.query)
        recalled_text = " ".join(i.content for i in recalled)

        current_hit = sum(1 for phrase in trace.expects_current if phrase.lower() in recalled_text.lower())
        absent_ok = sum(1 for phrase in trace.expects_absent if phrase.lower() not in recalled_text.lower())

        valid_items = [i for i in items if i.is_live()]
        obsolete_items = [i for i in items if not i.is_live()]
        fama = compute_fama(
            valid_surfaced=len([i for i in valid_items if i in recalled]),
            valid_total=len(valid_items) or 1,
            obsolete_excluded=len(obsolete_items) - len([i for i in obsolete_items if i in recalled]),
            obsolete_total=len(obsolete_items) or 1,
        )

        engine_tokens = sum(_estimate_tokens(i) for i in recalled)
        baseline_tokens = sum(_estimate_tokens(i) for i in items)  # full-history stuffing

        results.append({
            "user_id": trace.user_id,
            "recall_current_hits": f"{current_hit}/{len(trace.expects_current)}",
            "recall_absent_ok": f"{absent_ok}/{len(trace.expects_absent)}",
            "fama": fama,
            "engine_tokens": engine_tokens,
            "baseline_tokens": baseline_tokens,
            "token_savings_ratio": round(baseline_tokens / engine_tokens, 2) if engine_tokens else None,
        })

    summary = {
        "trace_count": len(results),
        "mean_fama": round(sum(r["fama"]["fama"] for r in results) / len(results), 4),
        "mean_token_savings_ratio": round(
            sum(r["token_savings_ratio"] for r in results if r["token_savings_ratio"]) / len(results), 2
        ),
        "note": f"seed={seed}; token counts are a chars/4 heuristic, not a real tokenizer — documented estimate, not a precise count",
    }
    return {"summary": summary, "results": results}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    output = run(seed=args.seed)
    print(f"\n## Engram /eval results (seed={args.seed})\n")
    print(f"| trace | recall hits | absent-ok | FAMA | tokens (engine/baseline) | savings |")
    print(f"|---|---|---|---|---|---|")
    for r in output["results"]:
        print(f"| {r['user_id']} | {r['recall_current_hits']} | {r['recall_absent_ok']} | {r['fama']['fama']} | {r['engine_tokens']}/{r['baseline_tokens']} | {r['token_savings_ratio']}x |")
    print(f"\n**Mean FAMA:** {output['summary']['mean_fama']}  **Mean token savings:** {output['summary']['mean_token_savings_ratio']}x\n")

    with open("eval/results.json", "w") as f:
        json.dump(output, f, indent=2)
    print("Raw results written to eval/results.json")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it**

Run: `cd "/Users/prasadt1/qwen hackathon/engram" && source .venv/bin/activate && python -m eval.run --seed 0`
Expected: a Markdown table prints, `eval/results.json` is written. Sanity-check: trace_1's recall should mention Sony and not Canon; trace_2's FAMA should be high (the superseded horizon-tilt fact is correctly excluded).

- [ ] **Step 4: If a trace fails the sanity check, fix the trace or the recall call — not the assertion.** This is real behavior validation, not a test to make green by adjusting expectations.
- [ ] **Step 5: Expand to the full 20-40 traces** (design spec §9) — add more `Fact`/`Trace` entries covering: genre-mix identity shifts, multi-hop questions ("what did I improve most this month?"), at least 3 traces per genre, and ≥5 adversarial recent-but-obsolete traces (see the annotated example above). Re-run after each batch.
- [ ] **Step 5b: FREEZE the trace set (external-review finding H3).** Once the full set is authored, commit it with the message "Freeze eval traces" and do not edit any trace after seeing engine results — tuning traces to the engine is self-grading and a judge who diffs the history will see it. Post-freeze changes require an entry in `eval/README.md` explaining why. Also, if time allows: calibrate the chars/4 token heuristic against real `qwen_client` `CallResult` token counts on a ~10-call sample and report the calibration factor alongside results (the heuristic stays for determinism; the calibration makes it honest).
- [ ] **Step 6: Commit**

```bash
git add eval/
git commit -m "Add /eval harness: recall, FAMA, and token-savings vs full-history baseline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 26: Ablations (forgetting OFF, consolidation OFF)

**Files:**
- Modify: `eval/run.py`

- [ ] **Step 1: Add an `--ablation` flag** to `eval/run.py`:

```python
parser.add_argument("--ablation", choices=["none", "no-forgetting"], default="none")
```

- [ ] **Step 2: Wire `no-forgetting`** — when set, call `recall(items, k=5, include_archived=True)` instead of the default, so superseded facts can leak back in (this simulates "no forgetting").
- [ ] **Step 3: Run both and compare**

```bash
python -m eval.run --seed 0 > eval/results-default.md
python -m eval.run --seed 0 --ablation no-forgetting > eval/results-no-forgetting.md
diff eval/results-default.md eval/results-no-forgetting.md
```

Expected: the `no-forgetting` run shows lower FAMA (obsolete facts leak through) — this diff *is* the headline result for the submission ("beat the no-forgetting baseline on FAMA while matching it on recall, at N× lower token cost," per spec §9).

Also commit BOTH raw JSON outputs (`eval/results-default.json`, `eval/results-no-forgetting.json` — add an `--out` flag or rename after each run), and render the README results table with default and no-forgetting as side-by-side columns rather than two separate blocks — judges should see the comparison in one glance without running anything.

- [ ] **Step 5: One human-readable worked example (post-fix review, P0).** Alongside the metric tables, render one concrete forgetting win — trace_1 already is it: *Q: "What camera gear do I use?" · Full-history baseline: mentions Canon AND Sony · Engram: Sony only · Why: the Canon fact was superseded in session 3.* Put this box in the eval output, the README results section, and the demo video script. This is what makes FAMA legible to a non-research judge in five seconds.

- [ ] **Step 4: Commit**

```bash
git add eval/run.py eval/results-default.md eval/results-no-forgetting.md
git commit -m "Add no-forgetting ablation; commit comparison results"
```

---

## Phase H — Seed demo data

### Task 27: Seed script for the demo user

**Files:**
- Create: `scripts/seed_demo_user.py`

- [ ] **Step 1: Source 15-20 photos across 3-4 genres from Unsplash**, license-compliant, credited. Save URLs/attributions in a small manifest at the top of the script.
- [ ] **Step 2: Write the seed script** — downloads each photo, calls `analyze_photo(..., user_id="demo-user", memory_store=...)` for each, but **backdated**: since `Skill.record_session` takes an explicit `at` parameter (already supported per `app/memory_engine.py`), simulate 4-5 sessions across the past ~3 weeks, deliberately arranging one skill (e.g. "composition") to cross the graduation threshold (3 consecutive sessions above the 7.0 bar) by session 4 — this is the exact mechanic Task 8's tests already verify, so the seed data is guaranteed to trigger the same graduation UI moment.
- [ ] **Step 3: Run it against the live Qwen account and local Mongo**

```bash
python scripts/seed_demo_user.py
```

- [ ] **Step 3b: Judge/demo mode (post-fix review, P0).** Add a zero-friction judge entry: visiting `/?judge=1` (or `/demo`) calls `setApiUserScope('demo-user')` (the scoping hook already exists in `frontend/src/lib/apiFetch.ts`), lands on the **Journey** page with the seeded memory state, shows a slim dismissible banner ("Demo mode — viewing a seeded photographer's journey") with links to the graduation card and the Glass Box/benchmark page. Judges must never need to upload multiple photos before understanding the submission. Put this URL in the Devpost "Try it out" link and testing instructions.
- [ ] **Step 4: Verify in the browser** — open `/?judge=1`, check the Journey page shows a cleared skill (the graduation evidence card) and the Library has photos across genres with varied scores.
- [ ] **Step 5: Commit**

```bash
git add scripts/seed_demo_user.py
git commit -m "Add seed script: demo user with a scripted graduation arc"
```

---

## Phase I — Alibaba deployment (unblocks once account verification clears)

### Task 28: Dockerize the backend

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY principles/ ./principles/
EXPOSE 8080
CMD ["uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8080"]
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
version: '3.8'
services:
  engram:
    build: .
    ports:
      - "8080:8080"
    env_file: .env
    restart: unless-stopped
```

- [ ] **Step 3: Build and run it locally first** (cheapest place to catch Docker-specific bugs)

```bash
docker compose up --build
curl http://localhost:8080/health
```

Expected: `{"status": "ok"}`

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "Add Docker setup for SAS deployment"
```

---

### Task 29: Deploy to Alibaba SAS (manual console steps — blocked until account verification clears)

**Files:** none (operational)

- [ ] **Step 1: Confirm account verification cleared** (check console or the escalation email reply).
- [ ] **Step 2: Provision the SAS instance** — Console → Simple Application Server → Create → Singapore region → Docker application image (or a clean Ubuntu image + manual Docker install, per the earlier Alibaba deploy research) → smallest plan that fits (2 vCPU / 4 GB).
- [ ] **Step 3: Capture the "Running" console screenshot immediately** — this is the hard-gated proof artifact; get it the moment the instance is live, don't wait until everything else is deployed.
- [ ] **Step 4: SSH/Workbench in, clone the repo, set up `.env` on the box** (same variables as local, plus `STORAGE_BACKEND=oss` and the OSS credentials from Task 30).
- [ ] **Step 5: `docker compose up -d --build`**
- [ ] **Step 6: Verify externally**

```bash
curl http://<sas-public-ip>:8080/health
```

- [ ] **Step 7: Save the screenshot and the public IP/URL** into `docs/ALIBABA_CLOUD_PROOF.md` (create this file — it's the hard-gated proof doc referenced throughout the spec).

---

### Task 30: Alibaba OSS bucket + flip storage backend

**Files:**
- Modify: `.env` (on the SAS box)

- [ ] **Step 1: Create an OSS bucket** in the same Singapore region, private access.
- [ ] **Step 2: Create a RAM user with OSS read/write scoped to that bucket only** (not the root account key).
- [ ] **Step 3: Set the env vars on the SAS box** — in a server-only `.env` (never in git; `chmod 600 .env`; loaded via docker compose `env_file`). This mirrors the Iris pattern (local `.env` for dev, secret injection in prod — Iris used GCP Secret Manager on Cloud Run):

```
STORAGE_BACKEND=oss
OSS_ACCESS_KEY_ID=...        # RAM user scoped to this bucket only, never the root key
OSS_ACCESS_KEY_SECRET=...
OSS_BUCKET=engram-photos
OSS_ENDPOINT=https://oss-ap-southeast-1.aliyuncs.com
```

- [ ] **Step 4: Restart the container and do one real upload+critique against the deployed instance** to confirm `OSSStorage` (already built and tested locally via its interface, Task/already-done Phase) works against the real bucket.
- [ ] **Step 5: Update `docs/ALIBABA_CLOUD_PROOF.md`** with a GitHub permalink to `app/storage.py`'s `OSSStorage` class (the primary "proof of Alibaba Cloud services" code file, per spec §11) and a permalink to `app/qwen_client.py`.
- [ ] **Step 6: Commit the proof doc**

```bash
git add docs/ALIBABA_CLOUD_PROOF.md
git commit -m "Add Alibaba Cloud deployment proof (screenshot + code permalinks)"
```

---

### Task 30b (STRETCH, cuttable): Alibaba KMS Secrets Manager

**Files:**
- Create: `app/secrets.py`
- Modify: `app/config.py`, `app/db.py` (read via the helper)

Only if the deploy lands early and the memory engine + eval are done. Value: (a) production-grade secrets story for the architecture doc ("KMS-first with env fallback", the Alibaba equivalent of Iris's GCP Secret Manager), (b) a **second Alibaba Cloud service used in code** for the deployment-proof breadth (OSS is primary).

- [ ] Small helper (~40 lines): `get_secret(name)` tries Alibaba KMS Secrets Manager (`alibabacloud_kms20160120` SDK, RAM role/AccessKey auth) and falls back to `os.environ` — env vars keep working everywhere, KMS is an upgrade not a rewire. Wire `DASHSCOPE_API_KEY`, `MONGODB_URI`, OSS keys through it.
- [ ] Store the secrets in KMS via console, grant the instance's RAM role `kms:GetSecretValue` on those secrets only.
- [ ] Add the KMS usage permalink to `docs/ALIBABA_CLOUD_PROOF.md` as a secondary proof file.
- [ ] Add "Secrets: KMS-first, env fallback" one-liner to the architecture doc/README.

**Cut rule:** this is below everything in the never-cut list and below all P0/P1 receipt work — cut it without hesitation if July 7-8 is tight.

---

## Phase J — Documentation, video, submission

### Task 31: Architecture diagram (public-facing)

- [ ] Render the architecture from spec §6 as a clean diagram (reuse the mental model already validated in conversation: brain/memory/house). Export as PNG/PDF for the Devpost upload field.
- [ ] Commit it to `docs/diagram-architecture.png` (or .pdf) and link it from the README.

### Task 32: `WHATS_NEW.md` and README

- [ ] Write `WHATS_NEW.md` using the lineage-disclosure paragraph already drafted in `docs/DEVPOST-DRAFT.md`'s Additional Info section, with real dated commit links (`git log --oneline --all` to pull actual hashes once Phases A-I are committed).
- [ ] Update the root `README.md` with: what Engram is, the results table from `eval/results.json` (side-by-side default vs no-forgetting + the Canon/Sony worked example), quickstart (`docker compose up`), the judge-mode URL, and links to the architecture diagram and the design spec.
- [ ] Add a **"Why this is a MemoryAgent"** section (post-fix review, P1) mapping each Track 1 brief phrase to code, one line each with file links: *efficient retrieval* → query-relevant salience (`app/memory_engine.py::recall_scored`); *timely forgetting* → supersession + graduation state machine (`app/memory_engine.py::Skill`, `supersede`); *recall within limited context* → token-budget packing + measured savings (`app/context_builder.py`, `eval/`); *Qwen API sophistication* → model routing (`app/config.py`), the live MCP path (`app/engram_mcp.py`, `docs/mcp-transcript.md`), and the eval harness. Judges scoring against the rubric should be able to check boxes without hunting.

### Task 33: Fill in the remaining Devpost draft sections

- [ ] Revisit `docs/DEVPOST-DRAFT.md`'s 🔄 sections ("How I built it", "Challenges I ran into", "Accomplishments", "What I learned") now that the build is real — replace placeholders with actual specifics, keeping the war-stories already logged (the `sk-ws-` key prefix, the Alibaba verification delay).
- [ ] Paste the real `eval/results.json` numbers into the pitch/story.

### Task 34: Record the 3-minute demo video

- [ ] Script per spec §4's three acts: meet (upload, first critique) → grow (a few sessions, journey page populating) → graduate (a skill clears, Mentor chat acknowledges it) → close on the benchmark table and the Alibaba console screenshot.
- [ ] Keep it under 3:00. Upload to YouTube/Vimeo as public, paste the link into the draft.

### Task 35: Final submission checklist pass

- [ ] Walk `docs/DEVPOST-DRAFT.md`'s Page 4 field-by-field: repo URL, proof-of-deployment code link, architecture diagram file, deployment screenshot, track selection (Track 1 only), country of residence, project start date. Confirm the GitHub About sidebar shows the Apache-2.0 license (already verified working — Task: none, just re-check it wasn't reset).
- [ ] Submit on Devpost with a minimum 2-3 hour buffer before the Jul 9 2:00 PM PT deadline.

---

## Suggested pacing + cut order (resequenced after external review)

Hard resequencing rules (the phases above are dependency order, not calendar order):
- **Docker (Task 28) needs no Alibaba account — do it early (day 1–2, right after Phase D exists)** so the deploy is one `docker compose up` away the moment identity verification clears. Draft `docs/ALIBABA_CLOUD_PROOF.md`'s structure early too.
- **Alibaba go/no-go: July 7, 9:00 AM PT.** If verification hasn't cleared by then, email the organizers (global.hackathon@alibaba-inc.com — escalation thread already prepared) describing the blocker with the account UID and asking how to satisfy the proof requirement in the interim. Don't wait silently on the review queue.
- **Eval skeleton early:** Task 24 (FAMA) + the first 3–5 seed traces (Task 25 Step 1) run immediately after Phase C, before frontend polish — the benchmark is the submission's spine and must not be a Phase-G surprise. Expanding to the full 20–40 traces can land later.

**Cut order if behind** (first listed = first cut): (1) Library genre-filter chips + milestone-badge UI — keep the genre *data*, it feeds the identity lens and scoped chat; (2) split-view visual polish (a plain two-pane layout is acceptable); (3) the Reflection LLM summary line (Journey renders skill state without it); (4) the consolidation pass (already MVP-stubbed). **Never cut:** the engram-mcp live path, /eval + ablations, the Journey page, the graduation demo moment, or the Alibaba proof artifacts.

Calendar sketch: Jul 3–4 Phases A–D + Docker + eval skeleton; Jul 5 Phase E + Phase G hardening + frontend copy (Tasks 16–17); Jul 6 Phase F core (Journey, split view, MentorChat); Jul 7 go/no-go + deploy (Phase I) + Phase H seed data; Jul 8 Phase J docs/video + full dry-run; Jul 9 buffer only, submit by ~11 AM PT.

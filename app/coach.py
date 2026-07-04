"""Coach: ground -> Qwen-VL analyze -> storage -> API payload.

Ported from iris-photography-mentor/app/sub_agents/coach_pipeline.py.
Embeddings (image/text vector search) are intentionally not ported for
the hackathon MVP — memory_engine's salience recall works on structured
metadata (importance, recency, scope, genre), not vector similarity.
"""

from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app import qwen_client
from app.grounding import SCENE_TO_DOCS, detect_scene_type_hint, ground_principles
from app.schema import CoachAnalysisOutput
from app.storage import get_storage

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent / "prompts" / "coach.txt"


def _principles_block(citations) -> str:
    return "\n\n".join(f"### {c.title} ({c.id})\n{c.excerpt}" for c in citations)


def _run_coach_model(
    image_bytes: bytes, mime_type: str, citations, photographer_context: str | None = None,
) -> CoachAnalysisOutput:
    system = PROMPT_PATH.read_text(encoding="utf-8")
    principles = _principles_block(citations)
    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_uri = f"data:{mime_type};base64,{b64}"

    prompt = f"{system}\n\n## Photography principles\n{principles}\n\nAnalyze this photograph."
    if photographer_context:
        prompt += (
            "\n\n## What I remember about this photographer\n"
            f"{photographer_context}\n"
            "Adapt the critique: acknowledge improvement on skills they've been working on; "
            "don't repeat advice for strengths they've already demonstrated."
        )
    result = qwen_client.chat_vision(data_uri, prompt, json_mode=True)

    def _repair(raw: str) -> str:
        fix_prompt = f"This is not valid JSON. Return ONLY corrected valid JSON, no prose:\n\n{raw}"
        return qwen_client.chat_fast(fix_prompt, json_mode=True).content

    parsed = qwen_client.parse_json_with_repair(result.content, _repair)
    try:
        return CoachAnalysisOutput.model_validate(parsed)
    except ValidationError as first_err:
        logger.warning("coach output failed shape validation (%d errors); attempting one shape-repair", len(first_err.errors()))
        skeleton_prompt = (
            "The following JSON does not match the required shape. Errors:\n"
            + "\n".join(f"- {'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in first_err.errors())
            + "\n\nRewrite the JSON to fix ONLY these shape problems, preserving all content/meaning. "
            + "Rules: scores has exactly composition/lighting/technique/creativity/subject_impact (move any 'overall' score value out or drop it); "
            + "critique must be an object with keys composition/lighting/technique/overall (if it was a string, put that text in 'overall' and write brief per-dimension lines for the others from the content available); "
            + "glassBox must include observations, reasoning_steps, priority_fixes (empty list if none); "
            + "secondary_subjects must be a list ([] if none); genre must be one of landscape/portrait/still_life/street/wildlife/macro/architecture/other (lowercase). "
            + "Return ONLY the corrected JSON.\n\n" + json.dumps(parsed)
        )
        repaired = qwen_client.chat_text(skeleton_prompt, json_mode=True).content
        reparsed = qwen_client.parse_json_with_repair(repaired, _repair)
        return CoachAnalysisOutput.model_validate(reparsed)  # raises with full context if still wrong


def analyze_photo(
    image_bytes: bytes,
    content_type: str,
    filename: str = "photo.jpg",
    *,
    user_id: str | None = None,
    memory_store=None,
    weakness_bar: float = 7.0,
    stored_key: str | None = None,
) -> dict[str, Any]:
    """Full Coach pipeline → API payload dict.

    stored_key: when the caller (the Task 13 route) has already saved the
    upload via get_storage() before calling in, pass the resulting key here
    to skip the redundant internal save — so a model failure never loses the
    upload (spec §12).

    Raises: openai.APIStatusError (Qwen unreachable after retries),
    ValueError (JSON unparseable after one repair), pydantic.ValidationError
    (model output fails CoachAnalysisOutput shape). The Task 13 route maps
    these to HTTP status codes.
    """
    scene = detect_scene_type_hint(filename, content_type)
    citations = ground_principles(scene)
    expected = len(SCENE_TO_DOCS.get(scene, SCENE_TO_DOCS["general"]))
    if len(citations) < expected:
        logger.warning(
            "principles block thinned: scene=%s expected=%d got=%d", scene, expected, len(citations)
        )

    # Recall the photographer's own memory BEFORE the model call so the
    # critique is genuinely memory-aware, not just principles-grounded — and
    # so the receipt we hand back is truthful (it reports what was actually
    # in the prompt, not a decorative afterthought).
    ctx = None
    if memory_store is not None and user_id is not None:
        from app.context_builder import build_memory_context
        candidates = memory_store.recall(user_id=user_id, k=200, query=None, include_archived=True)
        ctx = build_memory_context(candidates, query=f"{scene} photography", k=5, token_budget=400)

    output = _run_coach_model(
        image_bytes, content_type, citations,
        photographer_context=ctx.context_block() if ctx and ctx.packed else None,
    )

    storage = get_storage()
    key = stored_key if stored_key is not None else storage.save(image_bytes, filename=filename, content_type=content_type)
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
        "memoryReceipt": ctx.receipt() if ctx else None,
    }
    # NOTE: the frontend AnalysisResult type (copied in a later task) will
    # require portfolioEntryId and spatialMetadata — spatialMetadata is set
    # above; portfolioEntryId is added by the persistence wiring below.
    if memory_store is not None and user_id is not None:
        evidence_id = key  # the storage key doubles as the evidence reference
        for dim, score in payload["scores"].items():
            memory_store.record_skill_session(
                user_id=user_id, skill=dim, bar=weakness_bar, score=score, evidence_id=evidence_id,
            )
        weak = [d for d, s in payload["scores"].items() if s < weakness_bar]
        focus = f" — working on {', '.join(weak)}" if weak else ""
        summary = f"{output.genre} photo: {output.scene_description[:120]}{focus}"
        memory_store.write_memory(
            user_id=user_id, content=summary,
            importance=0.75 if weak else 0.55,  # weak-dimension photos are more consequential to recall
            scope=evidence_id, genre=output.genre,
        )
        # Persist the portfolio entry the frontend contract requires:
        # AnalysisResult.portfolioEntryId is REQUIRED in the frontend types, and
        # the Library/Home read routes (Task 13b) list these documents.
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

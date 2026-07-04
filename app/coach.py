"""Coach: ground -> Qwen-VL analyze -> storage -> API payload.

Ported from iris-photography-mentor/app/sub_agents/coach_pipeline.py.
Embeddings (image/text vector search) are intentionally not ported for
the hackathon MVP — memory_engine's salience recall works on structured
metadata (importance, recency, scope, genre), not vector similarity.
"""

from __future__ import annotations

import base64
import io
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps
from pydantic import ValidationError

from app import qwen_client
from app.grounding import SCENE_TO_DOCS, detect_scene_type_hint, ground_principles
from app.output_salvage import validate_with_local_salvage
from app.schema import CoachAnalysisOutput
from app.storage import get_storage

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent / "prompts" / "coach.txt"

# Longest edge (px) an image is downscaled to before being sent to the vision
# model. Chosen to stay comfortably under typical vision-model input limits
# while preserving enough detail for composition/technique critique.
MAX_VISION_DIMENSION = 1568
VISION_JPEG_QUALITY = 85


def _principles_block(citations) -> str:
    return "\n\n".join(f"### {c.title} ({c.id})\n{c.excerpt}" for c in citations)


def _prepare_vision_image(image_bytes: bytes, mime_type: str) -> tuple[bytes, str]:
    """Return (bytes, mime_type) to send to chat_vision(), downscaled if needed.

    This is a separate in-memory copy — it never touches the bytes that get
    persisted via get_storage().save() elsewhere in the pipeline. The full
    original upload must remain unchanged for storage/serving.

    Falls back to the original bytes/mime_type unresized if the bytes aren't
    decodable by Pillow (e.g. an unusual format), so a decode hiccup here
    never fails the whole analysis.
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            # Respect EXIF orientation BEFORE measuring/resizing, so portrait
            # phone photos with sideways-stored pixel data don't get resized
            # (or sent to the model) rotated incorrectly.
            img = ImageOps.exif_transpose(img)
            if img is None:
                return image_bytes, mime_type

            width, height = img.size
            longest = max(width, height)
            if longest > MAX_VISION_DIMENSION:
                scale = MAX_VISION_DIMENSION / longest
                new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
                img = img.resize(new_size, Image.LANCZOS)
            # else: already small enough — never upscale.

            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=VISION_JPEG_QUALITY)
            return buf.getvalue(), "image/jpeg"
    except Exception:
        logger.warning("could not decode image for resizing; sending original bytes unresized", exc_info=True)
        return image_bytes, mime_type


def _normalize_coach_output(parsed: dict) -> dict:
    """Defensively repair known model-output shape deviations before validation.

    DashScope/Qwen only supports loose `{"type": "json_object"}` mode with no
    schema enforcement, so the model sometimes drifts from the shape rules
    spelled out in prompts/coach.txt even though they're explicit. Each fix
    below targets one specific, previously-observed failure pattern so the
    common cases are silently repaired instead of falling into the slow
    (and sometimes still-failing) shape-repair chain. Every step is
    defensive: unexpected/missing shapes are left alone rather than raising,
    so worst case is unchanged pre-existing behavior (validation fails and
    the repair chain kicks in as before).
    """
    if not isinstance(parsed, dict):
        return parsed

    # 1. "critique" as a plain string instead of the required object shape.
    # Shape rule: "critique is an OBJECT with exactly those 4 keys, never a
    # plain string." Duplicate the same text into all four fields: this
    # guarantees no info loss regardless of which field a caller reads,
    # without fabricating per-dimension content we don't have.
    critique = parsed.get("critique")
    if isinstance(critique, str):
        parsed["critique"] = {
            "composition": critique,
            "lighting": critique,
            "technique": critique,
            "overall": critique,
        }

    # 2. "scores" with a stray extra key (most commonly "overall").
    # Shape rule: "scores contains EXACTLY the 5 keys shown — no 'overall'
    # inside scores." Drop anything outside the exact 5-key set.
    scores = parsed.get("scores")
    if isinstance(scores, dict):
        allowed_score_keys = {"composition", "lighting", "technique", "creativity", "subject_impact"}
        parsed["scores"] = {k: v for k, v in scores.items() if k in allowed_score_keys}

    # 3. Enum-like values not lowercase.
    # Shape rule: "All enum-like values are lowercase."
    genre = parsed.get("genre")
    if isinstance(genre, str):
        parsed["genre"] = genre.lower()

    glass_box = parsed.get("glassBox")
    if isinstance(glass_box, dict):
        priority_fixes = glass_box.get("priority_fixes")
        if isinstance(priority_fixes, list):
            for fix in priority_fixes:
                if isinstance(fix, dict) and isinstance(fix.get("severity"), str):
                    fix["severity"] = fix["severity"].lower()

    spatial_metadata = parsed.get("spatialMetadata")
    if isinstance(spatial_metadata, dict):
        annotations = spatial_metadata.get("annotations")
        if isinstance(annotations, list):
            for ann in annotations:
                if isinstance(ann, dict) and isinstance(ann.get("severity"), str):
                    ann["severity"] = ann["severity"].lower()

        lighting_map = spatial_metadata.get("lighting_map")
        if isinstance(lighting_map, dict):
            for key in ("fill_light_strength", "color_temperature", "shadow_character"):
                value = lighting_map.get(key)
                if isinstance(value, str):
                    lighting_map[key] = value.lower()

        # 4. "secondary_subjects" items not shaped as dicts (plain strings).
        # Shape rule: "secondary_subjects is always a JSON list — use [] when
        # none." The schema further requires each item to be a dict, so wrap
        # bare strings; default to [] if the field isn't even a list.
        subject_relationships = spatial_metadata.get("subject_relationships")
        if isinstance(subject_relationships, dict):
            secondary_subjects = subject_relationships.get("secondary_subjects")
            if isinstance(secondary_subjects, list):
                subject_relationships["secondary_subjects"] = [
                    {"name": item} if isinstance(item, str) else item
                    for item in secondary_subjects
                ]
            elif secondary_subjects is not None:
                subject_relationships["secondary_subjects"] = []

    return parsed


def _run_coach_model(
    image_bytes: bytes, mime_type: str, citations, photographer_context: str | None = None,
) -> CoachAnalysisOutput:
    system = PROMPT_PATH.read_text(encoding="utf-8")
    principles = _principles_block(citations)
    vision_bytes, vision_mime_type = _prepare_vision_image(image_bytes, mime_type)
    b64 = base64.b64encode(vision_bytes).decode("ascii")
    data_uri = f"data:{vision_mime_type};base64,{b64}"

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
    parsed = _normalize_coach_output(parsed)
    try:
        # Local salvage repairs near-miss output (off-enum values, out-of-range
        # scores, missing non-core fields) with pure dict surgery — zero model
        # calls. It raises only for genuinely broken CORE fields
        # (sceneDescription/scores/critique), which is the only class of
        # damage the model-based shape-repair chain below is still for.
        return validate_with_local_salvage(parsed)
    except ValidationError as first_err:
        error_detail = "; ".join(
            f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in first_err.errors()
        )[:2000]
        logger.warning(
            "coach output failed shape validation (%d errors); attempting one shape-repair: %s",
            len(first_err.errors()), error_detail,
        )
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
        # Last-resort repair after the primary attempt already failed —
        # failing fast matters more here than one more attempt at a generous
        # budget, so this uses a shorter timeout than chat_text()'s default
        # (worst case 30s with the one automatic timeout-retry, vs 80s).
        repaired = qwen_client.chat_text(skeleton_prompt, json_mode=True, timeout=15.0).content
        reparsed = qwen_client.parse_json_with_repair(repaired, _repair)
        reparsed = _normalize_coach_output(reparsed)
        # The repair model routinely reintroduces near-miss enums (the skeleton
        # prompt doesn't spell out every allowed value), so the re-validated
        # output gets the same local salvage; raises with full context only if
        # core damage survives even the model repair.
        return validate_with_local_salvage(reparsed)


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
        weak = sorted(
            ((d, s) for d, s in payload["scores"].items() if s < weakness_bar),
            key=lambda pair: pair[1],
        )
        focus = f" — working on {', '.join(f'{d} {s:.1f}' for d, s in weak)}" if weak else ""

        # Ground the "why" a mentor can later answer with: the model's own
        # top priority fix if it named one, else the critique prose for the
        # weakest-scoring dimension (falling back to the overall critique for
        # dimensions CritiqueBreakdown doesn't cover individually).
        critique_dims = {"composition", "lighting", "technique"}
        if output.glass_box.priority_fixes:
            why = f" Key issue: {output.glass_box.priority_fixes[0].issue}"
        elif weak:
            lowest_dim = weak[0][0]
            critique_text = (
                getattr(output.critique, lowest_dim) if lowest_dim in critique_dims
                else output.critique.overall
            )
            why = f" Why: {critique_text}" if critique_text else ""
        else:
            why = ""

        overall_score = sum(payload["scores"].values()) / len(payload["scores"])
        summary = f"{output.genre} photo (overall {overall_score:.1f}/10): {output.scene_description[:120]}{focus}.{why}"
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

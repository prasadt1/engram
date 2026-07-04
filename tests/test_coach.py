import io
import logging
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from PIL import Image

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

MALFORMED_COACH_JSON = """{
  "sceneDescription": "A lone tree on a hill at sunset.",
  "colourNotes": "Warm oranges against a cool blue sky.",
  "scores": {"composition": 7, "lighting": 8, "technique": 6, "overall": 7},
  "critique": "just a string",
  "strengths": ["good light"],
  "improvements": ["tighten crop"],
  "learningPath": [],
  "settingsEstimate": {},
  "aestheticTags": ["golden-hour"],
  "glassBox": {"observations": ["a"]},
  "spatialMetadata": {"subject_relationships": {"primary_subject_position": "center", "secondary_subjects": "none"}},
  "boundingBoxes": [],
  "genre": "still_life"
}"""

CORRECTED_COACH_JSON = VALID_COACH_JSON.replace('"genre": "landscape"', '"genre": "still_life"')


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
    sent_uri = mock_vision.call_args.args[0]
    assert sent_uri.startswith("data:image/jpeg;base64,")
    mock_storage.save.assert_called_once_with(
        b"fake-jpeg-bytes", filename="sunset.jpg", content_type="image/jpeg"
    )


def test_analyze_photo_repairs_shape_drift_on_validation_error():
    from app.coach import analyze_photo

    malformed_call_result = MagicMock(
        content=MALFORMED_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200
    )
    repaired_call_result = MagicMock(
        content=CORRECTED_COACH_JSON, model="qwen-max", latency_ms=300, input_tokens=150, output_tokens=180
    )

    with patch("app.coach.qwen_client.chat_vision", return_value=malformed_call_result), \
         patch("app.coach.qwen_client.chat_text", return_value=repaired_call_result) as mock_chat_text, \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_storage = MagicMock()
        mock_storage.save.return_value = "photos/fake.jpg"
        mock_storage.signed_url.return_value = "https://example.com/fake.jpg"
        mock_get_storage.return_value = mock_storage

        result = analyze_photo(
            image_bytes=b"fake-jpeg-bytes",
            content_type="image/jpeg",
            filename="fruit-bowl.jpg",
        )

    assert result["genre"] == "still_life"
    mock_chat_text.assert_called_once()
    assert set(result["scores"].keys()) == {
        "composition", "lighting", "technique", "creativity", "subject_impact"
    }


def test_analyze_photo_records_skill_sessions_and_persists_portfolio_entry():
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    mock_store = MagicMock()
    mock_store.recall.return_value = []  # empty memory -> ctx.packed empty -> no prompt block, existing prompt assertions hold

    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result), \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://x/fake.jpg"

        result = analyze_photo(
            image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg",
            user_id="u1", memory_store=mock_store, weakness_bar=7.5,
        )

    # technique scored 6 in VALID_COACH_JSON -> tracked below the 7.5 bar;
    # ALL five dimensions get a session recorded (streak logic lives in the engine)
    assert mock_store.record_skill_session.call_count == 5
    recorded_skills = {c.kwargs["skill"] for c in mock_store.record_skill_session.call_args_list}
    assert recorded_skills == {"composition", "lighting", "technique", "creativity", "subject_impact"}
    for c in mock_store.record_skill_session.call_args_list:
        assert c.kwargs["user_id"] == "u1"
        assert c.kwargs["bar"] == 7.5
        assert c.kwargs["evidence_id"] == "photos/fake.jpg"

    mock_store.write_memory.assert_called_once()
    wm = mock_store.write_memory.call_args.kwargs
    assert wm["user_id"] == "u1"
    assert wm["genre"] == "landscape"
    assert wm["scope"] == "photos/fake.jpg"
    assert "working on" in wm["content"]
    assert "technique" in wm["content"]
    assert wm["importance"] == 0.75
    # Grounding for "why is this rated low" -- not just dimension names.
    assert "overall" in wm["content"]  # e.g. "(overall 7.0/10)"
    assert "technique 6.0" in wm["content"]  # weakest dimension's actual score
    assert "Why:" in wm["content"] or "Key issue:" in wm["content"]

    mock_store.db.portfolio_entries.insert_one.assert_called_once()
    entry_doc = mock_store.db.portfolio_entries.insert_one.call_args.args[0]
    assert entry_doc["user_id"] == "u1"
    assert entry_doc["genre"] == "landscape"
    assert entry_doc["storage_key"] == "photos/fake.jpg"
    assert "portfolioEntryId" in result


def test_memory_content_prefers_top_priority_fix_over_critique_prose():
    from app.coach import analyze_photo

    photo_json = VALID_COACH_JSON.replace(
        '"priority_fixes": []',
        '"priority_fixes": [{"severity": "critical", "issue": "highlights blown on the subject\'s face"}]',
    )
    fake_call_result = MagicMock(content=photo_json, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    mock_store = MagicMock()
    mock_store.recall.return_value = []

    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result), \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://x/fake.jpg"

        analyze_photo(
            image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg",
            user_id="u1", memory_store=mock_store, weakness_bar=7.5,
        )

    wm = mock_store.write_memory.call_args.kwargs
    assert "Key issue: highlights blown on the subject's face" in wm["content"]


def test_analyze_photo_without_store_still_returns_payload():
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result), \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://x/fake.jpg"
        result = analyze_photo(image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg")
    assert "portfolioEntryId" not in result  # no store -> no persistence, payload otherwise intact
    assert result["genre"] == "landscape"


def test_analyze_photo_with_stored_key_skips_internal_save():
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result), \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_storage = MagicMock()
        mock_storage.signed_url.return_value = "https://x/given.jpg"
        mock_get_storage.return_value = mock_storage

        result = analyze_photo(
            image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg",
            stored_key="photos/given.jpg",
        )

    # route (Task 13) already saved the bytes before calling analyze_photo —
    # a model failure must never lose the upload, so no redundant save here
    mock_storage.save.assert_not_called()
    assert result["storageKey"] == "photos/given.jpg"
    mock_storage.signed_url.assert_called_once_with("photos/given.jpg")


def _memory_items_one_live_one_superseded():
    from app.memory_engine import MemoryItem

    now = datetime.now(timezone.utc)
    live = MemoryItem(
        id="mem_live", content="prefers wide apertures for subject separation",
        importance=0.8, created_at=now - timedelta(days=1), genre="landscape",
    )
    superseded = MemoryItem(
        id="mem_old", content="used to shoot everything at f/8",
        importance=0.7, created_at=now - timedelta(days=30), genre="landscape",
        superseded_by="mem_live",
    )
    return [live, superseded]


def test_analyze_photo_recalls_memory_into_prompt_and_returns_truthful_receipt():
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    mock_store = MagicMock()
    mock_store.recall.return_value = _memory_items_one_live_one_superseded()

    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result) as mock_vision, \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://x/fake.jpg"

        result = analyze_photo(
            image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg",
            user_id="u1", memory_store=mock_store,
        )

    sent_prompt = mock_vision.call_args.args[1]
    assert "What I remember about this photographer" in sent_prompt
    assert "prefers wide apertures for subject separation" in sent_prompt

    assert result["memoryReceipt"] is not None
    assert len(result["memoryReceipt"]["recalled"]) > 0
    recalled_ids = [m["id"] for m in result["memoryReceipt"]["recalled"]]
    assert "mem_live" in recalled_ids
    retired_ids = [m["id"] for m in result["memoryReceipt"]["retired_excluded"]]
    assert "mem_old" in retired_ids  # the visible face of forgetting


def test_analyze_photo_without_store_has_no_memory_prompt_block_or_receipt():
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result) as mock_vision, \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://x/fake.jpg"

        result = analyze_photo(image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg")

    sent_prompt = mock_vision.call_args.args[1]
    assert "What I remember about this photographer" not in sent_prompt
    assert "memoryReceipt" not in result or result["memoryReceipt"] is None


# ---------------------------------------------------------------------------
# Part 1: defensive normalization of known model-output shape deviations
# ---------------------------------------------------------------------------

CRITIQUE_STRING_JSON = """{
  "sceneDescription": "A lone tree on a hill at sunset.",
  "colourNotes": "Warm oranges against a cool blue sky.",
  "scores": {"composition": 7, "lighting": 8, "technique": 6, "creativity": 7, "subject_impact": 7},
  "critique": "solid warm light, could tighten the crop",
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

SCORES_STRAY_OVERALL_JSON = """{
  "sceneDescription": "A lone tree on a hill at sunset.",
  "colourNotes": "Warm oranges against a cool blue sky.",
  "scores": {"composition": 7, "lighting": 8, "technique": 6, "creativity": 7, "subject_impact": 7, "overall": 7.2},
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

UPPERCASE_ENUMS_JSON = """{
  "sceneDescription": "A lone tree on a hill at sunset.",
  "colourNotes": "Warm oranges against a cool blue sky.",
  "scores": {"composition": 7, "lighting": 8, "technique": 6, "creativity": 7, "subject_impact": 7},
  "critique": {"composition": "x", "lighting": "x", "technique": "x", "overall": "x"},
  "strengths": ["good light"],
  "improvements": ["tighten crop"],
  "learningPath": [],
  "settingsEstimate": {},
  "aestheticTags": ["golden-hour"],
  "glassBox": {"observations": ["a"], "reasoning_steps": ["b"], "priority_fixes": [{"severity": "CRITICAL", "issue": "blown highlights"}]},
  "spatialMetadata": {
    "annotations": [{"bbox": {"x": 1, "y": 1, "w": 2, "h": 2}, "severity": "MODERATE", "note": "distraction"}],
    "lighting_map": {"fill_light_strength": "LOW", "color_temperature": "WARM", "shadow_character": "SOFT"}
  },
  "boundingBoxes": [],
  "genre": "LANDSCAPE"
}"""

SECONDARY_SUBJECTS_STRINGS_JSON = """{
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
  "spatialMetadata": {
    "subject_relationships": {"primary_subject_position": "center", "secondary_subjects": ["dog", "fence"]}
  },
  "boundingBoxes": [],
  "genre": "landscape"
}"""


def _analyze_with_vision_json(vision_json: str):
    from app.coach import analyze_photo

    fake_call_result = MagicMock(content=vision_json, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)
    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result), \
         patch("app.coach.qwen_client.chat_text") as mock_chat_text, \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://x/fake.jpg"
        result = analyze_photo(image_bytes=b"fake", content_type="image/jpeg", filename="x.jpg")
    return result, mock_chat_text


def test_critique_as_plain_string_is_normalized_and_validates_without_repair():
    result, mock_chat_text = _analyze_with_vision_json(CRITIQUE_STRING_JSON)

    mock_chat_text.assert_not_called()  # normalized before validation -> no shape-repair triggered
    assert result["critique"]["composition"] == "solid warm light, could tighten the crop"
    assert result["critique"]["lighting"] == "solid warm light, could tighten the crop"
    assert result["critique"]["technique"] == "solid warm light, could tighten the crop"
    assert result["critique"]["overall"] == "solid warm light, could tighten the crop"


def test_scores_stray_overall_key_is_dropped_and_validates_without_repair():
    result, mock_chat_text = _analyze_with_vision_json(SCORES_STRAY_OVERALL_JSON)

    mock_chat_text.assert_not_called()
    assert set(result["scores"].keys()) == {
        "composition", "lighting", "technique", "creativity", "subject_impact"
    }


def test_normalize_coach_output_drops_stray_scores_key_directly():
    # Exercises _normalize_coach_output itself, not just the end-to-end
    # payload -- pydantic's default extra="ignore" would silently drop an
    # unrecognised scores key on its own, so the end-to-end test above can't
    # prove this specific normalization step does anything.
    import json

    from app.coach import _normalize_coach_output

    parsed = json.loads(SCORES_STRAY_OVERALL_JSON)
    assert "overall" in parsed["scores"]

    normalized = _normalize_coach_output(parsed)

    assert "overall" not in normalized["scores"]
    assert set(normalized["scores"].keys()) == {
        "composition", "lighting", "technique", "creativity", "subject_impact"
    }


def test_uppercase_enum_values_are_lowercased_and_validate_without_repair():
    result, mock_chat_text = _analyze_with_vision_json(UPPERCASE_ENUMS_JSON)

    mock_chat_text.assert_not_called()
    assert result["genre"] == "landscape"
    assert result["glassBox"]["priority_fixes"][0]["severity"] == "critical"
    assert result["spatialMetadata"]["annotations"][0]["severity"] == "moderate"
    assert result["spatialMetadata"]["lighting_map"]["fill_light_strength"] == "low"
    assert result["spatialMetadata"]["lighting_map"]["color_temperature"] == "warm"
    assert result["spatialMetadata"]["lighting_map"]["shadow_character"] == "soft"


def test_string_secondary_subjects_are_wrapped_into_dicts_and_validate_without_repair():
    result, mock_chat_text = _analyze_with_vision_json(SECONDARY_SUBJECTS_STRINGS_JSON)

    mock_chat_text.assert_not_called()
    secondary = result["spatialMetadata"]["subject_relationships"]["secondary_subjects"]
    assert secondary == [{"name": "dog"}, {"name": "fence"}]


def test_validation_error_log_includes_field_level_detail(caplog):
    from app.coach import analyze_photo

    fake_call_result = MagicMock(
        content=MALFORMED_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200
    )
    repaired_call_result = MagicMock(
        content=CORRECTED_COACH_JSON, model="qwen-max", latency_ms=300, input_tokens=150, output_tokens=180
    )

    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result), \
         patch("app.coach.qwen_client.chat_text", return_value=repaired_call_result), \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_get_storage.return_value.save.return_value = "photos/fake.jpg"
        mock_get_storage.return_value.signed_url.return_value = "https://example.com/fake.jpg"

        with caplog.at_level(logging.WARNING, logger="app.coach"):
            analyze_photo(image_bytes=b"fake-jpeg-bytes", content_type="image/jpeg", filename="fruit-bowl.jpg")

    warning_messages = [r.message for r in caplog.records if r.levelno == logging.WARNING]
    assert any("shape validation" in m for m in warning_messages)
    shape_msg = next(m for m in warning_messages if "shape validation" in m)
    # Must include actual field path/message detail, not just a bare count.
    assert "glassBox" in shape_msg or "glass_box" in shape_msg
    assert ":" in shape_msg  # "field.path: message" formatting


# ---------------------------------------------------------------------------
# Part 2: image resizing before the vision call
# ---------------------------------------------------------------------------

def _solid_image_bytes(width: int, height: int, fmt: str = "JPEG") -> bytes:
    img = Image.new("RGB", (width, height), color=(120, 60, 30))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_prepare_vision_image_downscales_large_image_preserving_aspect_ratio():
    from app.coach import MAX_VISION_DIMENSION, _prepare_vision_image

    original = _solid_image_bytes(3000, 2000)
    resized_bytes, mime_type = _prepare_vision_image(original, "image/jpeg")

    assert mime_type == "image/jpeg"
    with Image.open(io.BytesIO(resized_bytes)) as img:
        assert max(img.size) == MAX_VISION_DIMENSION
        # aspect ratio preserved (3:2)
        assert img.size[0] == MAX_VISION_DIMENSION
        assert abs(img.size[1] - round(MAX_VISION_DIMENSION * 2000 / 3000)) <= 1


def test_prepare_vision_image_does_not_upscale_small_image():
    from app.coach import _prepare_vision_image

    original = _solid_image_bytes(400, 300)
    resized_bytes, mime_type = _prepare_vision_image(original, "image/jpeg")

    assert mime_type == "image/jpeg"
    with Image.open(io.BytesIO(resized_bytes)) as img:
        assert img.size == (400, 300)


def test_prepare_vision_image_falls_back_to_original_on_undecodable_bytes():
    from app.coach import _prepare_vision_image

    garbage = b"this is not an image"
    resized_bytes, mime_type = _prepare_vision_image(garbage, "image/jpeg")

    assert resized_bytes == garbage
    assert mime_type == "image/jpeg"


def test_prepare_vision_image_respects_exif_orientation():
    from app.coach import _prepare_vision_image

    # Build a wide (landscape-stored) image tagged with EXIF orientation 6
    # ("rotate 270", i.e. physically portrait when displayed correctly), and
    # confirm exif_transpose applied it BEFORE resizing so the physically
    # correct (rotated) size is what determines the longer edge.
    img = Image.new("RGB", (3000, 2000), color=(10, 20, 30))
    exif = img.getexif()
    exif[0x0112] = 6  # Orientation tag: rotate 270 CW to display correctly
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    original = buf.getvalue()

    resized_bytes, _ = _prepare_vision_image(original, "image/jpeg")

    with Image.open(io.BytesIO(resized_bytes)) as out:
        # After exif_transpose, physical size is (2000, 3000) — portrait —
        # then downscaled so the longer edge (height) is MAX_VISION_DIMENSION.
        from app.coach import MAX_VISION_DIMENSION
        assert out.size[1] == MAX_VISION_DIMENSION
        assert out.size[0] < out.size[1]  # still portrait, not sideways
        # No leftover EXIF orientation tag demanding further rotation.
        out_exif = out.getexif()
        assert out_exif.get(0x0112, 1) == 1


def test_analyze_photo_sends_resized_image_to_chat_vision_but_stores_original():
    from app.coach import analyze_photo

    large_original = _solid_image_bytes(3000, 2000)
    fake_call_result = MagicMock(content=VALID_COACH_JSON, model="qwen-vl-max", latency_ms=500, input_tokens=100, output_tokens=200)

    with patch("app.coach.qwen_client.chat_vision", return_value=fake_call_result) as mock_vision, \
         patch("app.coach.get_storage") as mock_get_storage:
        mock_storage = MagicMock()
        mock_storage.save.return_value = "photos/fake.jpg"
        mock_storage.signed_url.return_value = "https://example.com/fake.jpg"
        mock_get_storage.return_value = mock_storage

        analyze_photo(image_bytes=large_original, content_type="image/jpeg", filename="big.jpg")

    # storage still gets the full-resolution original, unresized.
    mock_storage.save.assert_called_once_with(large_original, filename="big.jpg", content_type="image/jpeg")

    # the vision call gets a downscaled copy — its data URI is smaller than
    # a base64 encoding of the original would be, and decodes to <=1568px.
    sent_uri = mock_vision.call_args.args[0]
    assert sent_uri.startswith("data:image/jpeg;base64,")
    import base64 as b64mod
    sent_bytes = b64mod.b64decode(sent_uri.split(",", 1)[1])
    with Image.open(io.BytesIO(sent_bytes)) as img:
        assert max(img.size) <= 1568

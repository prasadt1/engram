"""Unit tests for app.output_salvage — local, zero-model-call validation salvage.

These mirror the verified design cases: the production incident (one cosmetic
enum near-miss must cost ~0ms, not a 93s model-repair chain), loc navigation
for both camelCase and snake_case input keys, list-index locs, deferred
descending prunes, multi-pass salvage, and the core-damage cases that must
still raise so the caller's model-repair chain runs.
"""

import json
import logging

import pytest
from pydantic import ValidationError

from app.output_salvage import validate_with_local_salvage


def _valid_payload() -> dict:
    """A fresh, fully valid CoachAnalysisOutput input dict (camelCase keys)."""
    return json.loads("""{
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
    }""")


# ---------------------------------------------------------------------------
# 1. The exact production incident: one cosmetic enum near-miss
# ---------------------------------------------------------------------------

def test_production_incident_fill_light_strength_medium_salvages_to_moderate():
    payload = _valid_payload()
    payload["spatialMetadata"] = {"lighting_map": {"fill_light_strength": "medium"}}

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.lighting_map.fill_light_strength == "moderate"
    # rest of the payload untouched
    assert output.scene_description == "A lone tree on a hill at sunset."
    assert output.scores.composition == 7


def test_valid_payload_passes_through_unchanged():
    output = validate_with_local_salvage(_valid_payload())
    assert output.genre == "landscape"
    assert output.strengths == ["good light"]


# ---------------------------------------------------------------------------
# 2. Other enum near-misses: synonym maps, list-index locs, containment, defaults
# ---------------------------------------------------------------------------

def test_color_temperature_golden_maps_to_warm():
    payload = _valid_payload()
    payload["spatialMetadata"] = {"lighting_map": {"color_temperature": "golden"}}

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.lighting_map.color_temperature == "warm"


def test_priority_fix_severity_synonym_at_list_index():
    payload = _valid_payload()
    payload["glassBox"]["priority_fixes"] = [
        {"severity": "critical", "issue": "blown highlights"},
        {"severity": "significant", "issue": "tilted horizon"},
    ]

    output = validate_with_local_salvage(payload)

    assert output.glass_box.priority_fixes[0].severity == "critical"
    assert output.glass_box.priority_fixes[1].severity == "moderate"
    assert output.glass_box.priority_fixes[1].issue == "tilted horizon"


def test_unknown_severity_falls_back_to_moderate_for_priority_fixes():
    payload = _valid_payload()
    payload["glassBox"]["priority_fixes"] = [{"severity": "purple", "issue": "keep the issue text"}]

    output = validate_with_local_salvage(payload)

    assert output.glass_box.priority_fixes[0].severity == "moderate"
    assert output.glass_box.priority_fixes[0].issue == "keep the issue text"


def test_annotation_severity_falls_back_to_minor():
    payload = _valid_payload()
    payload["spatialMetadata"] = {
        "annotations": [
            {"bbox": {"x": 1, "y": 1, "w": 2, "h": 2}, "severity": "purple", "note": "distraction"}
        ]
    }

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.annotations[0].severity == "minor"


def test_unique_containment_snap():
    payload = _valid_payload()
    payload["spatialMetadata"] = {"lighting_map": {"fill_light_strength": "moderately_strong"}}

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.lighting_map.fill_light_strength == "moderate"


def test_enum_fallback_to_schema_default():
    payload = _valid_payload()
    payload["spatialMetadata"] = {"lighting_map": {"fill_light_strength": "sparkly"}}

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.lighting_map.fill_light_strength == "low"  # schema default


def test_genre_synonym_and_normalization():
    payload = _valid_payload()
    payload["genre"] = "Street Photography"

    output = validate_with_local_salvage(payload)

    assert output.genre == "street"


def test_unknown_genre_falls_back_to_other():
    payload = _valid_payload()
    payload["genre"] = "astrophotography of nebulae"

    output = validate_with_local_salvage(payload)

    assert output.genre == "other"


# ---------------------------------------------------------------------------
# 3. Snake_case input keys — loc navigation follows the input dict
# ---------------------------------------------------------------------------

def test_snake_case_input_keys_still_navigable():
    payload = _valid_payload()
    payload["spatial_metadata"] = payload.pop("spatialMetadata")
    payload["spatial_metadata"] = {"lighting_map": {"fill_light_strength": "medium"}}
    payload["glass_box"] = payload.pop("glassBox")
    payload["glass_box"]["priority_fixes"] = [{"severity": "severe", "issue": "x"}]

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.lighting_map.fill_light_strength == "moderate"
    assert output.glass_box.priority_fixes[0].severity == "critical"


# ---------------------------------------------------------------------------
# 4. Score near-misses: range clamps and "8/10"-style strings
# ---------------------------------------------------------------------------

def test_score_above_range_clamped_to_ten():
    payload = _valid_payload()
    payload["scores"]["composition"] = 11.0

    output = validate_with_local_salvage(payload)

    assert output.scores.composition == 10.0


def test_score_below_range_clamped_to_zero():
    payload = _valid_payload()
    payload["scores"]["technique"] = -0.5

    output = validate_with_local_salvage(payload)

    assert output.scores.technique == 0.0


def test_score_slash_ten_string_parses():
    payload = _valid_payload()
    payload["scores"]["lighting"] = "8/10"

    output = validate_with_local_salvage(payload)

    assert output.scores.lighting == 8.0


def test_score_out_of_ten_string_parses():
    payload = _valid_payload()
    payload["scores"]["creativity"] = "7 out of 10"

    output = validate_with_local_salvage(payload)

    assert output.scores.creativity == 7.0


def test_unparseable_score_string_raises_for_model_chain():
    payload = _valid_payload()
    payload["scores"]["composition"] = "excellent"

    with pytest.raises(ValidationError):
        validate_with_local_salvage(payload)


# ---------------------------------------------------------------------------
# 5/6. Missing fields: non-core gets honest-empty fills, core raises
# ---------------------------------------------------------------------------

def test_missing_spatial_metadata_filled_and_validates_via_defaults():
    payload = _valid_payload()
    del payload["spatialMetadata"]

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.lighting_map.fill_light_strength == "low"
    assert output.spatial_metadata.annotations == []


def test_missing_glass_box_filled_honest_empty():
    payload = _valid_payload()
    del payload["glassBox"]

    output = validate_with_local_salvage(payload)

    assert output.glass_box.observations == []
    assert output.glass_box.reasoning_steps == []
    assert output.glass_box.priority_fixes == []


def test_missing_glass_box_subkeys_filled_empty():
    payload = _valid_payload()
    payload["glassBox"] = {"observations": ["a"]}

    output = validate_with_local_salvage(payload)

    assert output.glass_box.observations == ["a"]
    assert output.glass_box.reasoning_steps == []
    assert output.glass_box.priority_fixes == []


def test_missing_scene_description_raises_for_model_chain():
    payload = _valid_payload()
    del payload["sceneDescription"]

    with pytest.raises(ValidationError):
        validate_with_local_salvage(payload)


def test_missing_score_key_raises_for_model_chain():
    payload = _valid_payload()
    del payload["scores"]["creativity"]

    with pytest.raises(ValidationError):
        validate_with_local_salvage(payload)


def test_missing_critique_subkey_raises_for_model_chain():
    payload = _valid_payload()
    del payload["critique"]["overall"]

    with pytest.raises(ValidationError):
        validate_with_local_salvage(payload)


def test_missing_required_leaf_in_list_item_prunes_item():
    payload = _valid_payload()
    payload["glassBox"]["priority_fixes"] = [
        {"severity": "critical"},  # missing "issue" -> prune the item
        {"severity": "minor", "issue": "keep me"},
    ]

    output = validate_with_local_salvage(payload)

    assert len(output.glass_box.priority_fixes) == 1
    assert output.glass_box.priority_fixes[0].issue == "keep me"


# ---------------------------------------------------------------------------
# 7. Deferred descending prunes: no index-shift corruption within one batch
# ---------------------------------------------------------------------------

def test_two_bad_items_in_one_list_pruned_without_index_shift():
    payload = _valid_payload()
    good = {"bbox": {"x": 1, "y": 1, "w": 2, "h": 2}, "severity": "minor", "note": "the keeper"}
    payload["spatialMetadata"] = {"annotations": ["bad item 0", good, "bad item 2"]}

    output = validate_with_local_salvage(payload)

    assert len(output.spatial_metadata.annotations) == 1
    assert output.spatial_metadata.annotations[0].note == "the keeper"


# ---------------------------------------------------------------------------
# 8. Multi-pass: an error only visible after a first-pass fix gets handled
# ---------------------------------------------------------------------------

def test_multi_pass_wrap_then_item_fix():
    # pass 1: priority_fixes="fix the horizon" (list_type) -> ["fix the horizon"];
    # pass 2: item 0 is a str (model_type) -> {"severity": "moderate", "issue": ...};
    # pass 3: validates.
    payload = _valid_payload()
    payload["glassBox"]["priority_fixes"] = "fix the horizon"

    output = validate_with_local_salvage(payload)

    assert len(output.glass_box.priority_fixes) == 1
    assert output.glass_box.priority_fixes[0].severity == "moderate"
    assert output.glass_box.priority_fixes[0].issue == "fix the horizon"


# ---------------------------------------------------------------------------
# Container / type coercions and default-rule prunes
# ---------------------------------------------------------------------------

def test_strengths_bare_string_wrapped_into_list():
    payload = _valid_payload()
    payload["strengths"] = "great colors"

    output = validate_with_local_salvage(payload)

    assert output.strengths == ["great colors"]


def test_glass_box_as_string_wraps_content_preserving():
    payload = _valid_payload()
    payload["glassBox"] = "the light falls nicely on the subject"

    output = validate_with_local_salvage(payload)

    assert output.glass_box.observations == ["the light falls nicely on the subject"]
    assert output.glass_box.priority_fixes == []


def test_defaulted_subtree_as_string_deleted_so_defaults_fill():
    payload = _valid_payload()
    payload["settingsEstimate"] = "f/2.8 at 1/500"

    output = validate_with_local_salvage(payload)

    assert output.settings_estimate.aperture == "unknown"
    assert output.settings_estimate.iso == "unknown"


def test_lighting_map_as_string_deleted_so_defaults_fill():
    payload = _valid_payload()
    payload["spatialMetadata"] = {"lighting_map": "soft ambient light"}

    output = validate_with_local_salvage(payload)

    assert output.spatial_metadata.lighting_map.fill_light_strength == "low"


def test_numeric_string_leaf_coerced_to_str():
    payload = _valid_payload()
    payload["settingsEstimate"] = {"iso": 400}

    output = validate_with_local_salvage(payload)

    assert output.settings_estimate.iso == "400"


def test_bad_item_in_defaulted_str_list_pruned():
    payload = _valid_payload()
    payload["aestheticTags"] = ["golden-hour", {"tag": "moody"}, "warm"]

    output = validate_with_local_salvage(payload)

    assert output.aesthetic_tags == ["golden-hour", "warm"]


# ---------------------------------------------------------------------------
# Observability: every salvage action logged at WARNING
# ---------------------------------------------------------------------------

def test_salvage_actions_logged_at_warning(caplog):
    payload = _valid_payload()
    payload["spatialMetadata"] = {"lighting_map": {"fill_light_strength": "medium"}}

    with caplog.at_level(logging.WARNING, logger="app.output_salvage"):
        validate_with_local_salvage(payload)

    warnings = [r.message for r in caplog.records if r.levelno == logging.WARNING]
    assert any(
        "fill_light_strength" in m and "medium" in m and "moderate" in m for m in warnings
    ), warnings

"""Tests for grounding module (local-only photography principles)."""

from app.grounding import detect_scene_type_hint, ground_principles


def test_ground_principles_returns_local_citations_for_known_scene():
    citations = ground_principles("portrait")
    ids = [c.id for c in citations]
    assert "composition.md" in ids
    assert "lighting.md" in ids
    assert all(c.excerpt for c in citations)


def test_ground_principles_falls_back_to_general_for_unknown_scene():
    citations = ground_principles("underwater_macro")
    assert len(citations) > 0  # falls back to the "general" doc set, never empty


def test_detect_scene_type_hint_matches_filename_keywords():
    assert detect_scene_type_hint("sunset_mountain.jpg", "image/jpeg") == "landscape"
    assert detect_scene_type_hint("random123.jpg", "image/jpeg") == "general"

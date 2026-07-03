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

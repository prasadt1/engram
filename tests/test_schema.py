def test_coach_analysis_output_accepts_genre_field():
    from app.schema import CoachAnalysisOutput

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

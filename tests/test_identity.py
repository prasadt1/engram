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


def test_underscored_tag_and_genre_are_humanized():
    result = build_identity_line("still_life", "natural_light", ["composition"], "lighting")
    assert result == "You're a natural light still life shooter — composition cleared, now sharpening lighting."

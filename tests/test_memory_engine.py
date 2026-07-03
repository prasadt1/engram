from datetime import datetime, timedelta, timezone

from app.memory_engine import (
    GRADUATION_THRESHOLD,
    MemoryItem,
    Skill,
    SkillStatus,
    compute_delta,
    pack,
    recall,
    supersede,
)

NOW = datetime(2026, 7, 3, tzinfo=timezone.utc)


def _at(days_ago: int) -> datetime:
    return NOW - timedelta(days=days_ago)


# --- Skill graduation -------------------------------------------------------


def test_skill_graduates_after_exactly_three_consecutive_sessions_above_bar():
    skill = Skill(name="horizon_tilt", bar=7.0)
    skill.record_session(8.0, at=_at(20), evidence_id="p1")
    assert skill.status == SkillStatus.WATCHING
    skill.record_session(7.5, at=_at(13), evidence_id="p2")
    assert skill.status == SkillStatus.WATCHING
    skill.record_session(9.0, at=_at(6), evidence_id="p3")
    assert skill.status == SkillStatus.CLEARED
    assert skill.cleared_on == _at(6)
    assert skill.consecutive_above_bar == GRADUATION_THRESHOLD


def test_two_consecutive_sessions_do_not_graduate_a_skill():
    skill = Skill(name="exposure", bar=7.0)
    skill.record_session(8.0, at=_at(10), evidence_id="p1")
    skill.record_session(8.0, at=_at(5), evidence_id="p2")
    assert skill.status == SkillStatus.WATCHING


def test_a_dip_resets_the_streak_so_graduation_requires_a_fresh_run():
    skill = Skill(name="focus", bar=7.0)
    skill.record_session(8.0, at=_at(30), evidence_id="p1")
    skill.record_session(8.0, at=_at(25), evidence_id="p2")
    skill.record_session(5.0, at=_at(20), evidence_id="p3")  # dip resets streak
    assert skill.consecutive_above_bar == 0
    skill.record_session(8.0, at=_at(15), evidence_id="p4")
    skill.record_session(8.0, at=_at(10), evidence_id="p5")
    assert skill.status == SkillStatus.WATCHING  # only 2 in the new streak
    skill.record_session(8.0, at=_at(5), evidence_id="p6")
    assert skill.status == SkillStatus.CLEARED


def test_compute_delta_matches_iris_newer_vs_older_half_formula():
    assert compute_delta([5, 5, 8, 8]) == 3.0
    assert compute_delta([5, 5, 5]) is None  # fewer than 4 points -> insufficient data


# --- Recall / forgetting-in-effect ------------------------------------------


def _item(id_, importance, days_ago, **kw) -> MemoryItem:
    return MemoryItem(id=id_, content=id_, importance=importance, created_at=_at(days_ago), **kw)


def test_recall_excludes_superseded_items_by_default():
    old = _item("weakness_horizon_v1", importance=0.8, days_ago=40)
    new = _item("weakness_horizon_v2_cleared", importance=0.8, days_ago=2)
    items = supersede([old], "weakness_horizon_v1", new)

    result = recall(items, now=NOW, k=5)
    ids = [i.id for i in result]
    assert "weakness_horizon_v2_cleared" in ids
    assert "weakness_horizon_v1" not in ids  # forgotten: no longer surfaced


def test_recall_can_still_reach_superseded_items_when_asked():
    old = _item("pref_camera_canon", importance=0.5, days_ago=60)
    new = _item("pref_camera_sony", importance=0.5, days_ago=1)
    items = supersede([old], "pref_camera_canon", new)

    result = recall(items, now=NOW, k=5, include_archived=True)
    ids = {i.id for i in result}
    assert {"pref_camera_canon", "pref_camera_sony"}.issubset(ids)


def test_recall_respects_scope_filter_for_inline_photo_chat():
    a = _item("note_photo_1", importance=0.9, days_ago=1, scope="photo_1")
    b = _item("note_photo_2", importance=0.9, days_ago=1, scope="photo_2")
    result = recall([a, b], now=NOW, scope="photo_1")
    assert [i.id for i in result] == ["note_photo_1"]


def test_recall_prefers_high_salience_over_mere_recency():
    stale_but_important = _item("core_goal", importance=1.0, days_ago=25)
    fresh_but_trivial = _item("small_note", importance=0.05, days_ago=1)
    result = recall([stale_but_important, fresh_but_trivial], now=NOW, k=1)
    assert result[0].id == "core_goal"


# --- Query relevance ----------------------------------------------------------


def test_query_matching_memory_outranks_equal_salience_nonmatch():
    a = MemoryItem(id="night_note", content="struggles with exposure in night photography",
                   importance=0.5, created_at=_at(3))
    b = MemoryItem(id="portrait_note", content="strong eye contact in portrait framing",
                   importance=0.5, created_at=_at(3))
    result = recall([a, b], now=NOW, query="how is my night photography exposure?", k=2)
    assert result[0].id == "night_note"


def test_no_query_keeps_pure_salience_ordering():
    a = _item("high", importance=0.9, days_ago=1)
    b = _item("low", importance=0.2, days_ago=1)
    assert [i.id for i in recall([a, b], now=NOW)] == ["high", "low"]


def test_unrelated_but_important_memory_still_surfaces_via_relevance_floor():
    cleared = MemoryItem(id="cleared_horizon", content="graduated the horizon tilt weakness",
                         importance=1.0, created_at=_at(2))
    result = recall([cleared], now=NOW, query="what about my lighting?", k=1)
    assert result == [cleared]  # floor keeps it retrievable despite zero overlap


def test_recall_scored_breakdown_components_multiply_to_salience():
    from app.memory_engine import recall_scored

    item = MemoryItem(id="x", content="night exposure work", importance=0.8, created_at=_at(30))
    [(returned, scores)] = recall_scored([item], now=NOW, query="night", k=1)
    assert returned.id == "x"
    assert set(scores) == {"importance", "recency", "relevance", "salience"}
    expected = scores["importance"] * scores["recency"] * scores["relevance"]
    assert abs(scores["salience"] - expected) < 1e-3


# --- Token-budget packing ----------------------------------------------------


def test_pack_fits_under_budget_and_prioritizes_salience():
    items = [
        _item("big_important", importance=0.9, days_ago=1),
        _item("small_unimportant", importance=0.1, days_ago=1),
        _item("medium", importance=0.5, days_ago=1),
    ]
    costs = {"big_important": 80, "small_unimportant": 80, "medium": 30}

    result = pack(items, token_budget=100, estimate_tokens=lambda i: costs[i.id], now=NOW)

    total = sum(costs[i.id] for i in result)
    assert total <= 100
    assert "big_important" in [i.id for i in result]
    assert "small_unimportant" not in [i.id for i in result]


def test_pack_never_exceeds_budget_even_with_many_small_items():
    items = [_item(f"n{i}", importance=0.5, days_ago=1) for i in range(10)]
    result = pack(items, token_budget=25, estimate_tokens=lambda _: 10, now=NOW)
    assert len(result) == 2  # 2*10=20 <= 25, a 3rd would push to 30

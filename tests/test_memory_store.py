import mongomock
import pytest


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


def test_recall_scored_scope_filter_and_recency_survive_mongo_round_trip():
    # Regression guard for the BSON tz-naive round-trip: computing `recency`
    # requires `now - created_at`, which raised TypeError before _as_utc().
    store = _store()
    store.write_memory(user_id="u1", content="wide shot from the pier", importance=0.7, scope="photo_1", genre=None)
    store.write_memory(user_id="u1", content="crop tighter next time", importance=0.7, scope="photo_2", genre=None)

    results = store.recall_scored(user_id="u1", scope="photo_1", k=5)
    assert len(results) == 1
    item, scores = results[0]
    assert item.content == "wide shot from the pier"
    assert isinstance(scores["recency"], float)
    assert 0.0 < scores["recency"] <= 1.0


def test_supersede_memory_retires_old_content_and_is_user_scoped():
    store = _store()
    old_id = store.write_memory(user_id="u1", content="prefers Canon bodies", importance=0.6, scope=None, genre=None)
    store.supersede_memory(old_id=old_id, user_id="u1", new_content="prefers Sony bodies", importance=0.6)

    contents = [item.content for item in store.recall(user_id="u1", k=5)]
    assert "prefers Sony bodies" in contents
    assert "prefers Canon bodies" not in contents  # superseded -> no longer recalled

    with pytest.raises(ValueError):
        store.supersede_memory(old_id=old_id, user_id="u2", new_content="hijacked", importance=0.5)

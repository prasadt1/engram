import mongomock


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

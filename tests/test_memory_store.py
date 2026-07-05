from datetime import datetime, timedelta, timezone

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


def test_top_aesthetic_tags_ranks_by_frequency_within_window():
    store = _store()
    now = datetime.now(timezone.utc)
    # 3 docs tagged "moody", 1 tagged "bright" -- moody must rank first
    for i, tags in enumerate([["moody"], ["moody", "bright"], ["moody"]]):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "aesthetic_tags": tags,
            "created_at": now - timedelta(days=i),
        })
    result = store.top_aesthetic_tags(user_id="u1", limit=20, top_n=8)
    assert result[0] == "moody"
    assert "bright" in result


def test_top_aesthetic_tags_respects_limit_window():
    store = _store()
    now = datetime.now(timezone.utc)
    # 1 recent doc tagged "bright", 5 OLDER docs tagged "moody" -- with
    # limit=1 (most recent doc only), only "bright" should show up.
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["bright"], "created_at": now,
    })
    for i in range(1, 6):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "aesthetic_tags": ["moody"],
            "created_at": now - timedelta(days=i),
        })
    result = store.top_aesthetic_tags(user_id="u1", limit=1, top_n=8)
    assert result == ["bright"]


def test_top_aesthetic_tags_empty_when_no_portfolio():
    store = _store()
    assert store.top_aesthetic_tags(user_id="u1", limit=20, top_n=8) == []


def test_dominant_genre_picks_most_frequent():
    store = _store()
    now = datetime.now(timezone.utc)
    for i, genre in enumerate(["landscape", "landscape", "portrait"]):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "genre": genre, "created_at": now - timedelta(days=i),
        })
    assert store.dominant_genre(user_id="u1") == "landscape"


def test_dominant_genre_tie_break_prefers_most_recently_shot():
    store = _store()
    now = datetime.now(timezone.utc)
    # one "portrait" doc, most recent; one "landscape" doc, older -- 1-1 tie,
    # portrait must win because it was shot more recently.
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "portrait", "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "landscape", "created_at": now - timedelta(days=5),
    })
    assert store.dominant_genre(user_id="u1") == "portrait"


def test_dominant_genre_none_when_no_portfolio():
    store = _store()
    assert store.dominant_genre(user_id="u1") is None


def test_dominant_genre_respects_limit_window():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "portrait", "created_at": now,
    })
    for i in range(1, 4):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "genre": "landscape", "created_at": now - timedelta(days=i),
        })
    # full history -> landscape wins 3-1; limit=1 (most recent doc only) -> portrait
    assert store.dominant_genre(user_id="u1", limit=None) == "landscape"
    assert store.dominant_genre(user_id="u1", limit=1) == "portrait"


# --- search_portfolio / similar_portfolio_entries (structured-metadata,
# no embeddings by design -- see app/coach.py's header comment) -----------


def test_search_portfolio_matches_a_tag():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["tiger"], "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["lake"], "created_at": now,
    })
    docs, terms = store.search_portfolio(user_id="u1", query="tiger", limit=8)
    assert terms == ["tiger"]
    assert len(docs) == 1
    assert docs[0]["aesthetic_tags"] == ["tiger"]


def test_search_portfolio_matches_scene_description_text():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "scene_description": "Backlit portrait, golden hour.",
        "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "scene_description": "Busy crosswalk, midday.",
        "created_at": now,
    })
    docs, terms = store.search_portfolio(user_id="u1", query="backlit portrait", limit=8)
    assert terms == ["backlit", "portrait"]
    assert len(docs) == 1
    assert docs[0]["scene_description"] == "Backlit portrait, golden hour."


def test_search_portfolio_no_match_returns_empty():
    store = _store()
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["lake"], "created_at": datetime.now(timezone.utc),
    })
    docs, terms = store.search_portfolio(user_id="u1", query="dinosaur", limit=8)
    assert docs == []
    assert terms == ["dinosaur"]


def test_search_portfolio_empty_query_returns_empty_without_crash():
    store = _store()
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["lake"], "created_at": datetime.now(timezone.utc),
    })
    docs, terms = store.search_portfolio(user_id="u1", query="   ", limit=8)
    assert docs == []
    assert terms == []


def test_search_portfolio_ranks_more_matching_terms_higher():
    store = _store()
    now = datetime.now(timezone.utc)
    # doc A matches only "tiger"; doc B matches both "tiger" and "backlit" -- B must rank first.
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["tiger"], "scene_description": "",
        "created_at": now - timedelta(days=1),
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["tiger"], "scene_description": "Backlit shot.",
        "created_at": now - timedelta(days=2),
    })
    docs, terms = store.search_portfolio(user_id="u1", query="tiger backlit", limit=8)
    assert terms == ["tiger", "backlit"]
    assert len(docs) == 2
    assert docs[0]["scene_description"] == "Backlit shot."  # matched 2 terms, ranks first despite being older


def test_search_portfolio_ties_broken_by_recency():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "_id": "old", "user_id": "u1", "aesthetic_tags": ["tiger"], "created_at": now - timedelta(days=5),
    })
    store.db.portfolio_entries.insert_one({
        "_id": "new", "user_id": "u1", "aesthetic_tags": ["tiger"], "created_at": now,
    })
    docs, _ = store.search_portfolio(user_id="u1", query="tiger", limit=8)
    assert len(docs) == 2
    assert docs[0]["_id"] == "new"  # more recent doc ranks first on a tie


def test_search_portfolio_respects_limit():
    store = _store()
    now = datetime.now(timezone.utc)
    for i in range(5):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "aesthetic_tags": ["tiger"], "created_at": now - timedelta(days=i),
        })
    docs, _ = store.search_portfolio(user_id="u1", query="tiger", limit=2)
    assert len(docs) == 2


def test_search_portfolio_matches_portrait_genre_via_person_synonym():
    # "person" never literally appears anywhere in this doc's text/tags --
    # only genre="portrait" ties it to the generic search term.
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "portrait", "aesthetic_tags": ["vibrant"],
        "scene_description": "Backlit woman, golden hour.", "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "landscape", "aesthetic_tags": ["moody"],
        "scene_description": "A quiet valley at dusk.", "created_at": now,
    })
    docs, terms = store.search_portfolio(user_id="u1", query="person", limit=8)
    assert terms == ["person"]
    assert len(docs) == 1
    assert docs[0]["genre"] == "portrait"


def test_search_portfolio_literal_matching_still_works_alongside_synonyms():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["tiger"], "genre": "wildlife", "created_at": now,
    })
    docs, terms = store.search_portfolio(user_id="u1", query="tiger", limit=8)
    assert terms == ["tiger"]
    assert len(docs) == 1
    assert docs[0]["aesthetic_tags"] == ["tiger"]


def test_search_portfolio_genre_without_synonym_entry_not_spuriously_matched():
    # "macro" has no entry in GENRE_SEARCH_SYNONYMS, so a generic term like
    # "person" must not match a macro-genre doc just because it exists.
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "genre": "macro", "aesthetic_tags": ["dew"],
        "scene_description": "Close-up of a dew drop on a leaf.", "created_at": now,
    })
    docs, terms = store.search_portfolio(user_id="u1", query="person", limit=8)
    assert terms == ["person"]
    assert docs == []


def test_search_portfolio_scoped_to_user():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["tiger"], "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u2", "aesthetic_tags": ["tiger"], "created_at": now,
    })
    docs, _ = store.search_portfolio(user_id="u1", query="tiger", limit=8)
    assert len(docs) == 1


def test_search_portfolio_mountain_matches_peaks_in_scene():
    store = _store()
    now = datetime.now(timezone.utc)
    store.db.portfolio_entries.insert_one({
        "user_id": "u1",
        "scene_description": "Snow-capped peaks at dawn, wide valley below.",
        "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1",
        "scene_description": "Busy city crosswalk at midday.",
        "created_at": now,
    })
    docs, terms = store.search_portfolio(user_id="u1", query="mountain", limit=8)
    assert terms == ["mountain"]
    assert len(docs) == 1
    assert "peaks" in docs[0]["scene_description"].lower()


def test_similar_portfolio_entries_finds_shared_tag_match():
    store = _store()
    now = datetime.now(timezone.utc)
    source = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody", "backlit"], "genre": "portrait", "created_at": now,
    })
    other = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "landscape", "created_at": now,
    })
    source_doc = store.db.portfolio_entries.find_one({"_id": source.inserted_id})
    scored = store.similar_portfolio_entries(user_id="u1", source_doc=source_doc, limit=4)
    assert len(scored) == 1
    doc, score = scored[0]
    assert doc["_id"] == other.inserted_id
    assert score == 2.0  # one shared tag * weight 2, genre differs


def test_similar_portfolio_entries_excludes_source_doc_itself():
    store = _store()
    now = datetime.now(timezone.utc)
    source = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "portrait", "created_at": now,
    })
    source_doc = store.db.portfolio_entries.find_one({"_id": source.inserted_id})
    scored = store.similar_portfolio_entries(user_id="u1", source_doc=source_doc, limit=4)
    assert scored == []


def test_similar_portfolio_entries_empty_when_nothing_shares_tags_or_genre():
    store = _store()
    now = datetime.now(timezone.utc)
    source = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "portrait", "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["bright"], "genre": "landscape", "created_at": now,
    })
    source_doc = store.db.portfolio_entries.find_one({"_id": source.inserted_id})
    scored = store.similar_portfolio_entries(user_id="u1", source_doc=source_doc, limit=4)
    assert scored == []


def test_similar_portfolio_entries_genre_match_adds_weight_without_shared_tags():
    store = _store()
    now = datetime.now(timezone.utc)
    source = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "portrait", "created_at": now,
    })
    other = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["bright"], "genre": "portrait", "created_at": now,
    })
    source_doc = store.db.portfolio_entries.find_one({"_id": source.inserted_id})
    scored = store.similar_portfolio_entries(user_id="u1", source_doc=source_doc, limit=4)
    assert len(scored) == 1
    doc, score = scored[0]
    assert doc["_id"] == other.inserted_id
    assert score == 1.0  # genre match only


def test_similar_portfolio_entries_sorted_by_score_desc_then_recency():
    store = _store()
    now = datetime.now(timezone.utc)
    source = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody", "backlit"], "genre": "portrait", "created_at": now,
    })
    weak = store.db.portfolio_entries.insert_one({
        "_id": "weak", "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "landscape",
        "created_at": now - timedelta(days=1),
    })
    strong = store.db.portfolio_entries.insert_one({
        "_id": "strong", "user_id": "u1", "aesthetic_tags": ["moody", "backlit"], "genre": "portrait",
        "created_at": now - timedelta(days=2),
    })
    source_doc = store.db.portfolio_entries.find_one({"_id": source.inserted_id})
    scored = store.similar_portfolio_entries(user_id="u1", source_doc=source_doc, limit=4)
    assert [doc["_id"] for doc, _ in scored] == ["strong", "weak"]


def test_similar_portfolio_entries_scoped_to_user():
    store = _store()
    now = datetime.now(timezone.utc)
    source = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "portrait", "created_at": now,
    })
    store.db.portfolio_entries.insert_one({
        "user_id": "u2", "aesthetic_tags": ["moody"], "genre": "portrait", "created_at": now,
    })
    source_doc = store.db.portfolio_entries.find_one({"_id": source.inserted_id})
    scored = store.similar_portfolio_entries(user_id="u1", source_doc=source_doc, limit=4)
    assert scored == []


def test_similar_portfolio_entries_respects_limit():
    store = _store()
    now = datetime.now(timezone.utc)
    source = store.db.portfolio_entries.insert_one({
        "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "portrait", "created_at": now,
    })
    for i in range(5):
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "aesthetic_tags": ["moody"], "genre": "landscape",
            "created_at": now - timedelta(days=i),
        })
    source_doc = store.db.portfolio_entries.find_one({"_id": source.inserted_id})
    scored = store.similar_portfolio_entries(user_id="u1", source_doc=source_doc, limit=2)
    assert len(scored) == 2

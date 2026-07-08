"""Coach Assist roster API."""

from __future__ import annotations

from unittest.mock import patch

import mongomock
import pytest
from fastapi.testclient import TestClient

from app.memory_engine import SkillStatus
from app.memory_store import MemoryStore


def _seed_learner(store: MemoryStore, user_id: str, *, focus: str, streak: int) -> None:
    for i in range(streak):
        store.record_skill_session(
            user_id=user_id,
            skill=focus,
            bar=7.0,
            score=8.0,
            evidence_id=f"{user_id}-{focus}-{i}",
        )
    store.db.portfolio_entries.insert_one({"user_id": user_id, "storage_key": f"k-{user_id}"})


def test_coach_assist_roster_returns_three_learners():
    from app.server import app

    client = mongomock.MongoClient()
    store = MemoryStore(db=client["t"])

    _seed_learner(store, "demo-user", focus="lighting", streak=2)
    _seed_learner(store, "coach-assist-stuck", focus="lighting", streak=0)
    _seed_learner(store, "coach-assist-cleared", focus="composition", streak=3)

    with patch("app.server._store", return_value=store):
        tc = TestClient(app, raise_server_exceptions=False)
        resp = tc.get("/api/v1/coach-assist/roster")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert len(body["learners"]) == 3
        ids = {l["userId"] for l in body["learners"]}
        assert ids == {"demo-user", "coach-assist-stuck", "coach-assist-cleared"}
        stuck = next(l for l in body["learners"] if l["userId"] == "coach-assist-stuck")
        assert stuck["displayName"] == "Alex"
        assert stuck["photoCount"] >= 1


def test_build_learner_card_cleared_skills():
    from app.coach_assist import build_learner_card

    client = mongomock.MongoClient()
    store = MemoryStore(db=client["t"])
    for i in range(3):
        store.record_skill_session(
            user_id="u1", skill="composition", bar=7.0, score=8.0, evidence_id=f"c{i}",
        )

    card = build_learner_card(
        store, user_id="u1", display_name="Test", arc_label="Arc",
    )
    assert "composition" in card["clearedSkills"]
    assert card["currentFocus"] is None or isinstance(card["currentFocus"], str)

"""Practice Loop — assignment CRUD + skill-status recommender transitions."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

import mongomock
import pytest
from fastapi.testclient import TestClient


def _store_for(user_id: str = "u1"):
    from app.memory_store import MemoryStore

    client = mongomock.MongoClient()
    return MemoryStore(db=client["engram_test"]), user_id


def test_pick_focus_skill_matches_journey_closest_to_clear():
    from app.assignments import pick_focus_skill

    store, uid = _store_for()
    # lighting at streak 2 should beat composition at 1 (journey current_focus).
    store.record_skill_session(
        user_id=uid, skill="composition", bar=7.0, score=8.0, evidence_id="e1",
    )
    store.record_skill_session(
        user_id=uid, skill="lighting", bar=7.0, score=8.0, evidence_id="e2",
    )
    store.record_skill_session(
        user_id=uid, skill="lighting", bar=7.0, score=8.5, evidence_id="e3",
    )

    target, receipt = pick_focus_skill(store, user_id=uid)
    assert target == "lighting"
    assert receipt["source"] == "watching_closest_to_clear"
    assert receipt["consecutiveAboveBar"] == 2
    assert "composition" in [w["name"] for w in receipt["watching"]]


def test_rationale_hides_internal_receipt_source():
    from app.assignments import _deterministic_brief, pick_focus_skill, propose_assignment

    store, uid = _store_for()
    for skill in ("composition", "lighting", "technique", "creativity", "subject_impact"):
        for i in range(3):
            store.record_skill_session(
                user_id=uid, skill=skill, bar=7.0, score=8.0, evidence_id=f"{skill}-{i}",
            )

    _, receipt = pick_focus_skill(store, user_id=uid)
    assert receipt["source"] == "default_foundation"
    brief = _deterministic_brief("composition", receipt, mode="hobbyist")
    assert "default_foundation" not in brief.rationale
    assert "watching_closest_to_clear" not in brief.rationale
    assert "cleared" in brief.rationale.lower()

    proposed = propose_assignment(store, user_id=uid, use_llm=False)
    assert "default_foundation" not in proposed["rationale"]
    assert (
        "foundational practice" in proposed["rationale"].lower()
        or "revisiting" in proposed["rationale"].lower()
    )


def test_propose_does_not_target_cleared_skill_after_graduation():
    from app.assignments import propose_assignment

    store, uid = _store_for()
    # Graduate composition (3 consecutive above bar).
    for i in range(3):
        store.record_skill_session(
            user_id=uid, skill="composition", bar=7.0, score=8.0, evidence_id=f"c{i}",
        )
    # Lighting watching @1 — should become the next target.
    store.record_skill_session(
        user_id=uid, skill="lighting", bar=7.0, score=7.5, evidence_id="l0",
    )

    proposed = propose_assignment(store, user_id=uid, use_llm=False)
    assert proposed["status"] == "proposed"
    assert proposed["targetSkill"] == "lighting"
    assert "composition" not in proposed["targetSkill"]
    assert "streak" in proposed["rationale"].lower() or "Memory" in proposed["rationale"]


def test_propose_returns_existing_proposed_idempotent():
    from app.assignments import propose_assignment

    store, uid = _store_for()
    first = propose_assignment(store, user_id=uid, use_llm=False)
    second = propose_assignment(store, user_id=uid, use_llm=False)
    assert first["id"] == second["id"]


def test_accept_abandon_previous_active_and_complete_with_delta():
    from app.assignments import (
        accept_assignment,
        complete_assignment,
        link_upload_to_assignment,
        propose_assignment,
    )
    from bson import ObjectId

    store, uid = _store_for()
    store.record_skill_session(
        user_id=uid, skill="lighting", bar=7.0, score=6.0, evidence_id="b0",
    )
    proposed = propose_assignment(
        store, user_id=uid, focus_skill="lighting", use_llm=False,
    )
    active = accept_assignment(store, assignment_id=proposed["id"], user_id=uid)
    assert active["status"] == "active"

    # Second propose+accept should abandon the first active.
    # Clear proposed slot first by declining isn't needed — propose blocks on
    # existing proposed; complete isn't done. Insert a second proposed manually
    # is awkward; accept abandons other actives when a *new* proposed is accepted.
    second = propose_assignment(
        # no existing proposed after accept
        store, user_id=uid, focus_skill="composition", use_llm=False,
    )
    assert second["id"] != proposed["id"]
    accept_assignment(store, assignment_id=second["id"], user_id=uid)
    abandoned = store.db.assignments.find_one({"_id": ObjectId(proposed["id"])})
    assert abandoned["status"] == "abandoned"

    # Complete the new active with linked portfolio entries.
    baseline_id = store.db.portfolio_entries.insert_one({
        "user_id": uid,
        "scores": {"composition": 5.0, "lighting": 5.0, "technique": 5.0,
                   "creativity": 5.0, "subject_impact": 5.0},
        "created_at": datetime.now(timezone.utc),
    }).inserted_id
    store.db.assignments.update_one(
        {"_id": ObjectId(second["id"])},
        {"$set": {"baseline_shoot_ids": [baseline_id]}},
    )
    practice_id = store.db.portfolio_entries.insert_one({
        "user_id": uid,
        "scores": {"composition": 8.0, "lighting": 7.0, "technique": 7.0,
                   "creativity": 7.0, "subject_impact": 7.0},
        "created_at": datetime.now(timezone.utc),
    }).inserted_id
    link_upload_to_assignment(
        store, assignment_id=second["id"], portfolio_entry_id=practice_id, user_id=uid,
    )
    result = complete_assignment(store, assignment_id=second["id"], user_id=uid)
    assert result["assignment"]["status"] == "completed"
    assert result["reflection"]["skillDelta"]["delta"] == 3.0
    assert result["reflection"]["appliedBrief"] is True


def test_assignments_api_wire_camel_case():
    from app.memory_store import MemoryStore
    from app.server import app

    client = mongomock.MongoClient()
    store = MemoryStore(db=client["t"])
    store.record_skill_session(
        user_id="u1", skill="technique", bar=7.0, score=8.0, evidence_id="t1",
    )
    store.record_skill_session(
        user_id="u1", skill="technique", bar=7.0, score=8.0, evidence_id="t2",
    )

    with patch("app.server._store", return_value=store), \
         patch("app.assignments._planner_llm", side_effect=RuntimeError("no llm in test")):
        tc = TestClient(app, raise_server_exceptions=False)
        proposed = tc.post(
            "/api/v1/assignments/propose?mode=hobbyist",
            headers={"X-User-Id": "u1"},
        )
        assert proposed.status_code == 200, proposed.text
        body = proposed.json()
        assert "targetSkill" in body and "userId" in body and "createdAt" in body
        assert body["targetSkill"] == "technique"
        assert body["userId"] == "u1"

        # Force deterministic path: re-use existing proposed (no second LLM).
        listed = tc.get("/api/v1/assignments", headers={"X-User-Id": "u1"})
        assert listed.status_code == 200
        assert len(listed.json()["proposed"]) == 1

        accepted = tc.post(
            f"/api/v1/assignments/{body['id']}/accept",
            headers={"X-User-Id": "u1"},
        )
        assert accepted.status_code == 200
        assert accepted.json()["status"] == "active"

        active = tc.get("/api/v1/assignments/active", headers={"X-User-Id": "u1"})
        assert active.status_code == 200
        assert active.json()["active"]["id"] == body["id"]


def test_analyze_photo_endpoint_forwards_assignment_id():
    from app.server import app

    fake_payload = {
        "scores": {"composition": 7},
        "genre": "landscape",
        "imageUrl": "http://x/y.jpg",
        "portfolioEntryId": "abc",
    }
    with patch("app.server.analyze_photo", return_value=fake_payload) as mock_analyze, \
         patch("app.server.get_storage") as mock_gs, \
         patch("app.server._store"):
        mock_gs.return_value.save.return_value = "photos/pre-saved.jpg"
        resp = TestClient(app, raise_server_exceptions=False).post(
            "/api/v1/analyze-photo",
            files={"image": ("test.jpg", b"fake-bytes", "image/jpeg")},
            data={"assignment_id": "507f1f77bcf86cd799439011"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    assert mock_analyze.call_args.kwargs["assignment_id"] == "507f1f77bcf86cd799439011"

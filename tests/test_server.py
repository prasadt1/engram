import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import mongomock
import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

load_dotenv()  # so the MONGODB_URI skipif below sees .env, matching tests/test_db.py's convention


def _client():
    from app.server import app
    return TestClient(app, raise_server_exceptions=False)


def _score_set(value: float) -> dict:
    return {
        "composition": value,
        "lighting": value,
        "technique": value,
        "creativity": value,
        "subject_impact": value,
    }


def _seed_portfolio_store():
    """3 portfolio_entries docs shaped like app.coach.analyze_photo's insert,
    varied created_at (oldest -> newest: A, B, C) and scores (A=5, B=9, C=7)
    so date-sort and score-sort produce distinguishable orderings."""
    from app.memory_store import MemoryStore

    client = mongomock.MongoClient()
    db = client["t"]
    now = datetime.now(timezone.utc)
    docs = [
        {
            "_id_hint": "A",
            "user_id": "u1",
            "storage_key": "photos/a.jpg",
            "image_url": "http://stale/a.jpg",  # must NOT be trusted; signed_url() is the source of truth
            "scores": _score_set(5.0),
            "genre": "landscape",
            "aesthetic_tags": ["moody"],
            "scene_description": "A quiet valley at dusk.",
            "colour_notes": "Cool blues.",
            "glass_box": {"observations": ["Leading lines pull the eye."], "reasoning_steps": [], "priority_fixes": []},
            "spatial_metadata": {},
            "created_at": now - timedelta(days=3),
        },
        {
            "_id_hint": "B",
            "user_id": "u1",
            "storage_key": "photos/b.jpg",
            "image_url": "http://stale/b.jpg",
            "scores": _score_set(9.0),
            "genre": "portrait",
            "aesthetic_tags": ["vibrant"],
            "scene_description": "Backlit portrait, golden hour.",
            "colour_notes": "Warm oranges.",
            "glass_box": {"observations": ["Excellent use of rim light."], "reasoning_steps": [], "priority_fixes": []},
            "spatial_metadata": {},
            "created_at": now - timedelta(days=2),
        },
        {
            "_id_hint": "C",
            "user_id": "u1",
            "storage_key": "photos/c.jpg",
            "image_url": "http://stale/c.jpg",
            "scores": _score_set(7.0),
            "genre": "street",
            "aesthetic_tags": ["candid"],
            "scene_description": "Busy crosswalk, midday.",
            "colour_notes": None,
            "glass_box": {"observations": ["Strong subject isolation."], "reasoning_steps": [], "priority_fixes": []},
            "spatial_metadata": {},
            "created_at": now - timedelta(days=1),
        },
    ]
    for d in docs:
        d.pop("_id_hint")
        db.portfolio_entries.insert_one(d)

    return MemoryStore(db=db)


def _patch_signed_urls(mock_gs):
    storage = mock_gs.return_value
    storage.signed_url.side_effect = lambda key, **kw: f"https://signed.example/{key}"
    storage.exists.return_value = True


def test_health_endpoint():
    resp = _client().get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# --- Users/me routes (persona persistence) -------------------------------
# Mirrors Iris's app/memory/users.py::get_user_profile / set_persona
# contract exactly (see frontend/src/services/userClient.ts::UserProfile):
# { userId, persona, preferences }. The frontend calls GET on every boot
# (App.tsx) and PATCH on persona selection (OnboardingScreen/SettingsTab).


def test_users_me_get_returns_default_persona_when_user_doc_absent():
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    with patch("app.server._store", return_value=store):
        resp = _client().get("/api/v1/users/me", headers={"X-User-Id": "new-user"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["userId"] == "new-user"
    assert body["persona"] == "hobbyist"  # default persona, matches Iris's fallback
    assert body["preferences"] == {}


def test_users_me_get_prefers_camelcase_userid_query_param_over_header():
    # userClient.ts::fetchUserProfile sends `?userId=` (camelCase) for
    # signed-in users, not `?user_id=` — a plain FastAPI param name would
    # silently fail to bind this (Iris's own route has this exact bug:
    # app/api/server.py declares a bare `user_id` param with no alias).
    # This locks in the Query(alias="userId") fix.
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    with patch("app.server._store", return_value=store):
        resp = _client().get(
            "/api/v1/users/me?userId=signed-in-user",
            headers={"X-User-Id": "demo-user"},  # header present but must lose to the query param
        )
    assert resp.status_code == 200
    assert resp.json()["userId"] == "signed-in-user"


def test_users_me_patch_then_get_round_trips_persona():
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    with patch("app.server._store", return_value=store):
        patch_resp = _client().patch(
            "/api/v1/users/me",
            json={"persona": "working_pro"},
            headers={"X-User-Id": "u1"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json() == {"userId": "u1", "persona": "working_pro"}

        get_resp = _client().get("/api/v1/users/me", headers={"X-User-Id": "u1"})
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["userId"] == "u1"
    assert body["persona"] == "working_pro"
    assert body["preferences"]["onboardingComplete"] is True


def test_users_me_patch_then_get_round_trips_display_name():
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    with patch("app.server._store", return_value=store):
        patch_resp = _client().patch(
            "/api/v1/users/me",
            json={"displayName": "Asha"},
            headers={"X-User-Id": "u1"},
        )
        assert patch_resp.status_code == 200
        # name-only PATCH echoes only what it set — no persona key invented
        assert patch_resp.json() == {"userId": "u1", "displayName": "Asha"}

        get_resp = _client().get("/api/v1/users/me", headers={"X-User-Id": "u1"})
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["displayName"] == "Asha"
    assert body["persona"] == "hobbyist"  # untouched default


def test_users_me_display_name_patch_does_not_clobber_persona():
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    with patch("app.server._store", return_value=store):
        _client().patch("/api/v1/users/me", json={"persona": "working_pro"}, headers={"X-User-Id": "u1"})
        _client().patch("/api/v1/users/me", json={"displayName": "Asha"}, headers={"X-User-Id": "u1"})
        get_resp = _client().get("/api/v1/users/me", headers={"X-User-Id": "u1"})
    body = get_resp.json()
    assert body["persona"] == "working_pro"
    assert body["displayName"] == "Asha"
    assert body["preferences"]["onboardingComplete"] is True


def test_users_me_get_display_name_null_for_pre_existing_user_doc():
    # Docs written before displayName existed must read back null, not 500.
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    store.db.users.insert_one({"_id": "u1", "persona": "working_pro", "preferences": {}})
    with patch("app.server._store", return_value=store):
        resp = _client().get("/api/v1/users/me", headers={"X-User-Id": "u1"})
    assert resp.status_code == 200
    assert resp.json()["displayName"] is None


def test_users_me_patch_blank_display_name_clears_it():
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    with patch("app.server._store", return_value=store):
        _client().patch("/api/v1/users/me", json={"displayName": "Asha"}, headers={"X-User-Id": "u1"})
        clear_resp = _client().patch("/api/v1/users/me", json={"displayName": "   "}, headers={"X-User-Id": "u1"})
        get_resp = _client().get("/api/v1/users/me", headers={"X-User-Id": "u1"})
    assert clear_resp.status_code == 200
    assert clear_resp.json() == {"userId": "u1", "displayName": None}
    assert get_resp.json()["displayName"] is None


def test_users_me_patch_rejects_empty_body_and_overlong_display_name():
    client = mongomock.MongoClient()
    store = MagicMock()
    store.db = client["t"]
    with patch("app.server._store", return_value=store):
        empty = _client().patch("/api/v1/users/me", json={}, headers={"X-User-Id": "u1"})
        too_long = _client().patch(
            "/api/v1/users/me", json={"displayName": "x" * 81}, headers={"X-User-Id": "u1"},
        )
    assert empty.status_code == 400
    assert too_long.status_code == 400


def test_analyze_photo_endpoint_saves_before_analyze_and_uses_image_field():
    fake_payload = {"scores": {"composition": 7}, "genre": "landscape", "imageUrl": "http://x/y.jpg", "portfolioEntryId": "abc"}
    with patch("app.server.analyze_photo", return_value=fake_payload) as mock_analyze, \
         patch("app.server.get_storage") as mock_gs, \
         patch("app.server._store") as mock_store:
        mock_gs.return_value.save.return_value = "photos/pre-saved.jpg"
        resp = _client().post(
            "/api/v1/analyze-photo",
            files={"image": ("test.jpg", b"fake-bytes", "image/jpeg")},  # field name must match Iris agentClient.ts
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    assert resp.json()["genre"] == "landscape"
    mock_gs.return_value.save.assert_called_once()  # route saved FIRST
    assert mock_analyze.call_args.kwargs["stored_key"] == "photos/pre-saved.jpg"
    assert mock_analyze.call_args.kwargs["user_id"] == "u1"


def test_chat_endpoint_matches_iris_wire_format_with_receipt():
    with patch("app.server.mentor_chat", return_value={"reply": "Doing great.", "receipt": {"recalled": []}}) as mock_chat, \
         patch("app.server._store"):
        resp = _client().post(
            "/api/v1/agent/chat",
            json={"message": "How am I doing?", "sessionId": "s1", "persona": "hobbyist", "photo_id": "p1"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["reply"] == "Doing great."
    assert body["persona"] == "hobbyist"
    assert body["sessionId"] == "s1"
    assert body["userId"] == "u1"
    assert body["memoryReceipt"] == {"recalled": []}
    kw = mock_chat.call_args.kwargs
    assert kw["photo_id"] == "p1" and kw["session_id"] == "s1" and kw["persona"] == "hobbyist"


def test_chat_endpoint_generates_session_id_when_absent():
    with patch("app.server.mentor_chat", return_value={"reply": "Hi.", "receipt": {}}), \
         patch("app.server._store"):
        resp = _client().post("/api/v1/agent/chat", json={"message": "Hello"}, headers={"X-User-Id": "u1"})
    assert resp.status_code == 200
    assert resp.json()["sessionId"]  # non-empty, generated


def _sse_events(raw_text: str) -> list[tuple[str | None, dict]]:
    events = []
    for block in raw_text.strip("\n").split("\n\n"):
        event = None
        data = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data = json.loads(line[len("data:"):].strip())
        if data is not None:
            events.append((event, data))
    return events


def test_chat_stream_endpoint_emits_deltas_then_done_with_receipt():
    def fake_tokens():
        yield "Hello"
        yield " there"

    with patch("app.server.mentor_chat_stream", return_value=({"recalled": []}, fake_tokens())) as mock_chat, \
         patch("app.server._store"):
        resp = _client().post(
            "/api/v1/agent/chat/stream",
            json={"message": "How am I doing?", "sessionId": "s1", "persona": "hobbyist", "photo_id": "p1"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    events = _sse_events(resp.text)
    assert events[0] == (None, {"delta": "Hello"})
    assert events[1] == (None, {"delta": " there"})
    done_event, done_data = events[-1]
    assert done_event == "done"
    assert done_data == {"sessionId": "s1", "userId": "u1", "persona": "hobbyist", "memoryReceipt": {"recalled": []}}
    kw = mock_chat.call_args.kwargs
    assert kw["photo_id"] == "p1" and kw["session_id"] == "s1" and kw["persona"] == "hobbyist"


def test_chat_stream_endpoint_emits_error_event_on_upstream_timeout():
    from openai import APITimeoutError

    def fake_tokens():
        yield "partial"
        raise APITimeoutError(request=MagicMock())

    with patch("app.server.mentor_chat_stream", return_value=({}, fake_tokens())), \
         patch("app.server._store"):
        resp = _client().post(
            "/api/v1/agent/chat/stream",
            json={"message": "Hi"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    events = _sse_events(resp.text)
    assert events[0] == (None, {"delta": "partial"})
    error_event, error_data = events[-1]
    assert error_event == "error"
    assert "detail" in error_data


def test_analyze_photo_endpoint_rejects_oversized_upload_with_413():
    with patch("app.server.analyze_photo") as mock_analyze, \
         patch("app.server.get_storage") as mock_gs, \
         patch("app.server._store"):
        resp = _client().post(
            "/api/v1/analyze-photo",
            files={"image": ("big.jpg", b"x" * (20 * 1024 * 1024 + 1), "image/jpeg")},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 413
    mock_gs.return_value.save.assert_not_called()  # rejected before touching storage
    mock_analyze.assert_not_called()


def test_analyze_photo_endpoint_maps_model_failure_to_friendly_502():
    import httpx
    from openai import APIStatusError

    err = APIStatusError(
        "boom",
        response=httpx.Response(500, request=httpx.Request("POST", "http://x")),
        body=None,
    )
    with patch("app.server.analyze_photo", side_effect=err), \
         patch("app.server.get_storage") as mock_gs, \
         patch("app.server._store"):
        mock_gs.return_value.save.return_value = "photos/pre-saved.jpg"
        resp = _client().post(
            "/api/v1/analyze-photo",
            files={"image": ("test.jpg", b"fake-bytes", "image/jpeg")},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 502
    assert "temporarily unavailable" in resp.json()["detail"]
    mock_gs.return_value.save.assert_called_once()  # photo persisted BEFORE the model blew up


def test_journey_endpoint_shape():
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Nice progress."):
        mock_store.return_value.list_skills.return_value = [
            Skill(name="exposure", bar=7, status=SkillStatus.WATCHING, consecutive_above_bar=1),
        ]
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 3}
        mock_store.return_value.dominant_genre.return_value = "landscape"
        mock_store.return_value.top_aesthetic_tags.return_value = ["moody"]
        # user doc predates displayName (or doesn't exist) — the journey
        # response must stay null-safe for every pre-existing user.
        mock_store.return_value.db.users.find_one.return_value = None
        resp = _client().get("/api/v1/journey", headers={"X-User-Id": "u1"})
    body = resp.json()
    assert body["summary"] == "Nice progress."
    assert body["skills"][0] == {"name": "exposure", "status": "watching", "consecutive": 1}
    assert body["stats"]["total_memories"] == 3
    assert body["identity"] == "You're a moody landscape shooter — working toward your first cleared skill, now sharpening exposure."
    assert body["displayName"] is None


def test_journey_skips_llm_summary_when_include_summary_false():
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Should not run.") as mock_summary:
        mock_store.return_value.list_skills.return_value = [
            Skill(name="technique", bar=7, status=SkillStatus.WATCHING, consecutive_above_bar=1),
        ]
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 3}
        mock_store.return_value.dominant_genre.return_value = "landscape"
        mock_store.return_value.top_aesthetic_tags.return_value = ["golden_hour"]
        mock_store.return_value.db.users.find_one.return_value = None
        resp = _client().get(
            "/api/v1/journey",
            params={"include_summary": "false"},
            headers={"X-User-Id": "u1"},
        )
    body = resp.json()
    assert resp.status_code == 200
    assert body["summary"] == ""
    assert body["skills"][0]["name"] == "technique"
    mock_summary.assert_not_called()


def test_journey_endpoint_includes_display_name_from_user_doc():
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Nice progress."):
        mock_store.return_value.list_skills.return_value = [
            Skill(name="exposure", bar=7, status=SkillStatus.WATCHING, consecutive_above_bar=1),
        ]
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 3}
        mock_store.return_value.dominant_genre.return_value = "landscape"
        mock_store.return_value.top_aesthetic_tags.return_value = []
        mock_store.return_value.db.users.find_one.return_value = {
            "_id": "u1", "persona": "hobbyist", "displayName": "Asha",
        }
        resp = _client().get("/api/v1/journey", headers={"X-User-Id": "u1"})
    assert resp.json()["displayName"] == "Asha"


def test_journey_identity_focus_tie_breaks_alphabetically_on_equal_streaks():
    # "Current focus" = watching skill closest to clearing (highest streak);
    # equal streaks tie-break alphabetically. Must match JourneySection.tsx's
    # orderWatchingByStreak so the identity line names the same skill the
    # Watching card puts on top ("technique" first in API order must NOT win).
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Nice progress."):
        mock_store.return_value.list_skills.return_value = [
            Skill(name="technique", bar=7, status=SkillStatus.WATCHING, consecutive_above_bar=1),
            Skill(name="creativity", bar=7, status=SkillStatus.WATCHING, consecutive_above_bar=1),
        ]
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 3}
        mock_store.return_value.dominant_genre.return_value = "landscape"
        mock_store.return_value.top_aesthetic_tags.return_value = []
        mock_store.return_value.db.users.find_one.return_value = None
        resp = _client().get("/api/v1/journey", headers={"X-User-Id": "u1"})
    identity = resp.json()["identity"]
    assert identity.endswith("now sharpening creativity.")


def test_journey_endpoint_identity_none_when_no_portfolio_data():
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Welcome!"):
        mock_store.return_value.list_skills.return_value = []
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 0}
        mock_store.return_value.dominant_genre.return_value = None
        mock_store.return_value.top_aesthetic_tags.return_value = []
        mock_store.return_value.db.users.find_one.return_value = None
        resp = _client().get("/api/v1/journey", headers={"X-User-Id": "u1"})
    assert resp.json()["identity"] is None


@pytest.mark.skipif(not os.environ.get("MONGODB_URI"), reason="requires a real MongoDB (MONGODB_URI) for the live MCP subprocess round trip")
def test_memory_stats_via_mcp_round_trips_through_real_stdio_server():
    # Real subprocess round trip (scripts/run_mcp_server.py), not a mocked
    # MCP client — this is the strongest available evidence that ?via=mcp
    # actually reaches the protocol layer rather than just calling
    # MemoryStore in-process with an extra key slapped on.
    resp = _client().get("/api/v1/memory-stats", params={"via": "mcp"}, headers={"X-User-Id": "e2e-prasad"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["served_via"] == "engram-mcp"
    assert "total_memories" in body  # real get_memory_stats shape, unmocked


def test_memory_stats_via_mcp_failure_maps_to_friendly_503():
    # A wedged/failed MCP subprocess must NOT hang the route or leak a raw
    # 500 — and must not silently fall back to the in-process call while
    # claiming served_via mcp. The timeout lives in
    # app.server._get_memory_stats_via_mcp (asyncio.wait_for, 15s).
    with patch("app.server._get_memory_stats_via_mcp", side_effect=asyncio.TimeoutError):
        resp = _client().get("/api/v1/memory-stats", params={"via": "mcp"}, headers={"X-User-Id": "u1"})
    assert resp.status_code == 503
    assert "engram-mcp" in resp.json()["detail"]


def test_memory_stats_default_path_is_unchanged_direct_call():
    with patch("app.server._store") as mock_store:
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 7}
        resp = _client().get("/api/v1/memory-stats", headers={"X-User-Id": "u1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"total_memories": 7}  # unchanged: no served_via key, no MCP round trip
    mock_store.return_value.get_memory_stats.assert_called_once_with(user_id="u1")


# --- Portfolio read routes (Task 13b) -----------------------------------
# HomeTab.tsx calls fetchPortfolioStats() and fetchPortfolio(...) in a
# Promise.all with NO .catch — these routes must match the frontend's
# memoryClient.ts / types/memory.ts contract exactly (see PortfolioListItem,
# PortfolioStats in iris-photography-mentor/frontend/src/types/memory.ts).


def test_portfolio_list_sorted_by_date_desc_matches_frontend_contract():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            "/api/v1/portfolio",
            # sort_by/sort_order are the ACTUAL wire params memoryClient.ts sends
            # (URLSearchParams({ sort_by: sortBy, sort_order: sortOrder }) — the
            # TS-side option keys are sortBy/sortOrder but the query string is snake_case).
            params={"limit": 2, "sort_by": "date", "sort_order": "desc"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert len(body["entries"]) == 2

    # newest (C) first, then B — matches PortfolioListResponse { entries, total }
    first, second = body["entries"]
    assert first["scores"]["composition"] == 7.0  # entry C
    assert second["scores"]["composition"] == 9.0  # entry B

    # exact key names from PortfolioListItem (frontend/src/types/memory.ts)
    for key in (
        "id", "userId", "shootId", "imageUrl", "storageKey", "createdAt", "scores",
        "overallAverage", "aestheticTags", "userTags", "sceneDescription",
        "colourNotes", "glassBoxSummary",
    ):
        assert key in first, f"missing frontend-contract key: {key}"

    assert isinstance(first["id"], str) and first["id"]  # id casing: lowercase "id", not "_id"
    assert first["imageUrl"] == "https://signed.example/photos/c.jpg"  # computed via signed_url, not the stale stored image_url
    # storageKey is the RAW stored key (not signed/proxied) — PhotoDetailView's
    # chat sends this back as photo_id so mentor.chat's scope= recall matches
    # the same scope the critique was written under (app.coach.analyze_photo).
    assert first["storageKey"] == "photos/c.jpg"
    assert first["userId"] == "u1"
    assert first["overallAverage"] == 7.0
    assert first["aestheticTags"] == ["candid"]
    assert first["colourNotes"] is None


def test_portfolio_list_sorted_by_score_desc_highest_average_first():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            "/api/v1/portfolio",
            params={"sort_by": "score", "sort_order": "desc"},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert [e["overallAverage"] for e in entries] == [9.0, 7.0, 5.0]  # B, C, A


def test_portfolio_stats_endpoint_shape():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get("/api/v1/portfolio/stats", headers={"X-User-Id": "u1"})
    assert resp.status_code == 200
    body = resp.json()

    # PortfolioStats { total, firstUpload, strongest } (frontend/src/types/memory.ts)
    assert body["total"] == 3
    assert body["firstUpload"] is not None  # month string, e.g. "Jul 2026"
    assert body["strongest"] is not None
    assert body["strongest"]["overallAverage"] == 9.0  # entry B has the highest average score
    assert body["strongest"]["imageUrl"] == "https://signed.example/photos/b.jpg"


def test_portfolio_omits_missing_storage_and_strongest_skips_orphan():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        storage = mock_gs.return_value
        storage.signed_url.side_effect = lambda key, **kw: f"https://signed.example/{key}"
        storage.exists.side_effect = lambda key: key != "photos/b.jpg"

        list_resp = _client().get("/api/v1/portfolio", headers={"X-User-Id": "u1"})
        assert list_resp.status_code == 200
        by_key = {e["storageKey"]: e["imageUrl"] for e in list_resp.json()["entries"]}
        assert by_key["photos/b.jpg"] == ""
        assert by_key["photos/c.jpg"] == "https://signed.example/photos/c.jpg"

        stats_resp = _client().get("/api/v1/portfolio/stats", headers={"X-User-Id": "u1"})
        assert stats_resp.status_code == 200
        strongest = stats_resp.json()["strongest"]
        assert strongest["storageKey"] == "photos/c.jpg"
        assert strongest["overallAverage"] == 7.0


def test_portfolio_delete_single_and_batch():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store):
        list_resp = _client().get("/api/v1/portfolio", headers={"X-User-Id": "u1"})
        assert list_resp.status_code == 200
        ids = [e["id"] for e in list_resp.json()["entries"]]
        assert len(ids) == 3

        del_resp = _client().delete(f"/api/v1/portfolio/{ids[0]}", headers={"X-User-Id": "u1"})
        assert del_resp.status_code == 200
        assert del_resp.json() == {"deleted": True, "id": ids[0]}

        batch_resp = _client().post(
            "/api/v1/portfolio/delete-batch",
            headers={"X-User-Id": "u1"},
            json={"entryIds": ids[1:], "removeListing": False},
        )
        assert batch_resp.status_code == 200
        body = batch_resp.json()
        assert body["deletedCount"] == 2
        assert set(body["deleted"]) == set(ids[1:])
        assert body["skipped"] == []

        remaining = _client().get("/api/v1/portfolio", headers={"X-User-Id": "u1"}).json()
        assert remaining["total"] == 0


def test_portfolio_trends_endpoint_shape():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            "/api/v1/portfolio/trends",
            params={"limit": 6},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()

    # PortfolioTrendsResponse { photoCount, points, dimensions, insufficientData }
    assert body["photoCount"] == 3
    assert len(body["points"]) == 3
    # chronological (oldest -> newest): A(5) -> B(9) -> C(7)
    assert [p["overall"] for p in body["points"]] == [5.0, 9.0, 7.0]
    assert body["insufficientData"] is True  # n=3 < 4, same threshold as Iris's compute_delta/_delta_recent_vs_older

    dims = {d["key"]: d for d in body["dimensions"]}
    assert "composition" in dims and "overall" in dims
    overall_dim = dims["overall"]
    assert overall_dim["values"] == [5.0, 9.0, 7.0]
    assert overall_dim["latest"] == 7.0
    assert overall_dim["delta"] is None  # compute_delta returns None for n < 4
    assert overall_dim["trend"] == "flat"


def test_portfolio_trends_window_is_most_recent_photos_in_chronological_order():
    # Home's "Recent trend" card and sparkline caption both describe this
    # series as recent uploads — when the library exceeds `limit`, the window
    # must be the NEWEST `limit` photos (still oldest->newest for charting),
    # not frozen on the user's first uploads forever.
    store = _seed_portfolio_store()  # A(5.0, oldest) -> B(9.0) -> C(7.0, newest)
    now = datetime.now(timezone.utc)
    for hours_ago, score in ((12, 6.0), (1, 8.0)):  # D and E, newer than C
        store.db.portfolio_entries.insert_one({
            "user_id": "u1", "storage_key": f"photos/x{hours_ago}.jpg", "image_url": "http://stale/x.jpg",
            "scores": _score_set(score), "genre": "landscape", "aesthetic_tags": [],
            "scene_description": "Later work.", "colour_notes": None,
            "glass_box": {"observations": [], "reasoning_steps": [], "priority_fixes": []},
            "spatial_metadata": {}, "created_at": now - timedelta(hours=hours_ago),
        })
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            "/api/v1/portfolio/trends",
            params={"limit": 4},  # library has 5 photos -> window drops only the OLDEST (A)
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    # Newest 4 of A(5) B(9) C(7) D(6) E(8), chronological: B, C, D, E.
    assert [p["overall"] for p in body["points"]] == [9.0, 7.0, 6.0, 8.0]
    assert body["photoCount"] == 4
    assert body["insufficientData"] is False


def test_aesthetic_profile_endpoint_minimal_shape():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get("/api/v1/aesthetic-profile", headers={"X-User-Id": "u1"})
    assert resp.status_code == 200
    body = resp.json()

    # AestheticProfileSummary { photoCount, dominantTags, averageScores,
    # stylisticConsistencyScore, computedAt? } — frontend tolerates
    # fetchAestheticProfile().catch(() => null), so this only needs to be
    # a well-formed instance of that shape, not exhaustively faithful to
    # Iris's embedding-derived fields.
    assert body["photoCount"] == 3
    assert isinstance(body["dominantTags"], list)
    assert isinstance(body["averageScores"], dict)
    assert "stylisticConsistencyScore" in body


# --- Portfolio search / similar routes ------------------------------------
# frontend/src/services/portfolioInsightsClient.ts's searchPortfolioLibrary()
# and fetchSimilarPhotos() -- structured-metadata matching, no embeddings
# (see app/coach.py's header comment).


def test_portfolio_search_returns_matches_shaped_for_frontend_contract():
    store = _seed_portfolio_store()
    tiger_doc = store.db.portfolio_entries.find_one({"aesthetic_tags": "vibrant"})
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            "/api/v1/portfolio/search",
            params={"q": "vibrant", "limit": 8},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["query"] == "vibrant"
    assert body["mode"] == "regex_fallback"
    assert body["searchTerms"] == ["vibrant"]
    assert body["message"] is None
    assert len(body["matches"]) == 1
    match = body["matches"][0]
    assert match["id"] == str(tiger_doc["_id"])
    assert match["matchedObservations"] == ["vibrant"]
    # still a full PortfolioListItem shape
    for key in ("id", "userId", "shootId", "imageUrl", "createdAt", "scores", "overallAverage"):
        assert key in match


def test_portfolio_search_generic_term_matches_portrait_genre_via_synonym():
    # doc B is genre="portrait" with scene_description "Backlit portrait,
    # golden hour." -- no literal "person"/"people"/"human" anywhere in its
    # text/tags, so this only matches through the genre-synonym path.
    store = _seed_portfolio_store()
    portrait_doc = store.db.portfolio_entries.find_one({"genre": "portrait"})
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            "/api/v1/portfolio/search",
            params={"q": "person", "limit": 8},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["matches"]) == 1
    match = body["matches"][0]
    assert match["id"] == str(portrait_doc["_id"])
    assert match["matchedObservations"] == ["Genre: portrait"]


def test_portfolio_search_empty_query_returns_message_no_error():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage"):
        resp = _client().get("/api/v1/portfolio/search", params={"q": ""}, headers={"X-User-Id": "u1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["matches"] == []
    assert body["searchTerms"] == []
    assert body["message"]


def test_portfolio_search_no_match_returns_200_with_message():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage"):
        resp = _client().get(
            "/api/v1/portfolio/search", params={"q": "dinosaur"}, headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["matches"] == []
    assert 'dinosaur' in body["message"]


def test_portfolio_similar_returns_matches_with_similarity_score():
    store = _seed_portfolio_store()
    source_doc = store.db.portfolio_entries.find_one({"aesthetic_tags": "moody"})
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            f"/api/v1/portfolio/{source_doc['_id']}/similar",
            params={"limit": 4},
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sourceId"] == str(source_doc["_id"])
    assert body["mode"] == "tag_overlap"
    # seeded docs share no tags/genre with each other -- expect no matches, with a message
    assert body["matches"] == []
    assert body["message"]


def test_portfolio_similar_404_when_entry_not_found_or_not_owned():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store):
        resp = _client().get(
            "/api/v1/portfolio/000000000000000000000000/similar",
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 404


def test_portfolio_similar_404_when_entry_id_is_malformed():
    store = _seed_portfolio_store()
    with patch("app.server._store", return_value=store):
        resp = _client().get(
            "/api/v1/portfolio/not-a-valid-object-id/similar",
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 404


def test_portfolio_similar_404_when_owned_by_different_user():
    store = _seed_portfolio_store()
    source_doc = store.db.portfolio_entries.find_one({"aesthetic_tags": "moody"})
    with patch("app.server._store", return_value=store):
        resp = _client().get(
            f"/api/v1/portfolio/{source_doc['_id']}/similar",
            headers={"X-User-Id": "someone-else"},
        )
    assert resp.status_code == 404


def test_portfolio_similar_finds_real_shared_tag_match():
    store = _seed_portfolio_store()
    # add a 4th doc sharing the "moody" tag with entry A, so a real match exists
    store.db.portfolio_entries.insert_one({
        "user_id": "u1", "storage_key": "photos/d.jpg", "image_url": "http://stale/d.jpg",
        "scores": _score_set(6.0), "genre": "landscape", "aesthetic_tags": ["moody"],
        "scene_description": "Foggy forest.", "colour_notes": None,
        "glass_box": {"observations": [], "reasoning_steps": [], "priority_fixes": []},
        "spatial_metadata": {}, "created_at": datetime.now(timezone.utc),
    })
    source_doc = store.db.portfolio_entries.find_one({"aesthetic_tags": "moody", "scene_description": {"$ne": "Foggy forest."}})
    with patch("app.server._store", return_value=store), \
         patch("app.server.get_storage") as mock_gs:
        _patch_signed_urls(mock_gs)
        resp = _client().get(
            f"/api/v1/portfolio/{source_doc['_id']}/similar",
            headers={"X-User-Id": "u1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] is None
    assert len(body["matches"]) == 1
    match = body["matches"][0]
    assert match["sceneDescription"] == "Foggy forest."
    assert match["similarityScore"] == 3.0  # shared "moody" tag (+2) and shared "landscape" genre (+1)

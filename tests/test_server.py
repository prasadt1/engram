from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


def _client():
    from app.server import app
    return TestClient(app, raise_server_exceptions=False)


def test_health_endpoint():
    resp = _client().get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


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


def test_journey_endpoint_shape():
    from app.memory_engine import Skill, SkillStatus
    with patch("app.server._store") as mock_store, \
         patch("app.server.summarize_progress", return_value="Nice progress."):
        mock_store.return_value.list_skills.return_value = [
            Skill(name="exposure", bar=7, status=SkillStatus.WATCHING, consecutive_above_bar=1),
        ]
        mock_store.return_value.get_memory_stats.return_value = {"total_memories": 3}
        resp = _client().get("/api/v1/journey", headers={"X-User-Id": "u1"})
    body = resp.json()
    assert body["summary"] == "Nice progress."
    assert body["skills"][0] == {"name": "exposure", "status": "watching", "consecutive": 1}
    assert body["stats"]["total_memories"] == 3

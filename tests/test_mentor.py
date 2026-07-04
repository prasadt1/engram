from unittest.mock import MagicMock, patch


def _mock_store():
    store = MagicMock()
    store.recall.return_value = []
    store.list_skills.return_value = []
    store.db.chat_turns.find.return_value.sort.return_value.limit.return_value = []
    return store


def test_chat_scopes_recall_to_photo_id_and_returns_reply_with_receipt():
    from app.mentor import chat

    store = _mock_store()
    fake = MagicMock(content="Great question about your night shots!")

    with patch("app.mentor.qwen_client.chat_fast", return_value=fake):
        result = chat(
            message="How's my night photography?", user_id="u1", memory_store=store,
            photo_id="p123", session_id="s1", persona="hobbyist",
        )

    assert result["reply"] == "Great question about your night shots!"
    assert "receipt" in result and "recalled" in result["receipt"]
    store.recall.assert_called_once()
    kw = store.recall.call_args.kwargs
    assert kw["scope"] == "p123"
    assert kw["include_archived"] is True
    assert kw["k"] == 200


def test_chat_uses_global_scope_when_no_photo_id():
    from app.mentor import chat

    store = _mock_store()
    fake = MagicMock(content="Here's your overall progress.")

    with patch("app.mentor.qwen_client.chat_fast", return_value=fake):
        chat(message="How am I doing overall?", user_id="u1", memory_store=store,
             photo_id=None, session_id="s1", persona="hobbyist")

    assert store.recall.call_args.kwargs["scope"] is None


def test_chat_persists_turns_scoped_to_user_and_session():
    from app.mentor import chat

    store = _mock_store()
    fake = MagicMock(content="Sure thing!")

    with patch("app.mentor.qwen_client.chat_fast", return_value=fake):
        chat(message="Follow-up question", user_id="u1", memory_store=store,
             photo_id=None, session_id="s1", persona="hobbyist")

    assert store.db.chat_turns.insert_one.call_count == 2  # user turn + assistant turn
    for call in store.db.chat_turns.insert_one.call_args_list:
        doc = call.args[0]
        assert doc["user_id"] == "u1"
        assert doc["session_id"] == "s1"
    find_filter = store.db.chat_turns.find.call_args.args[0]
    assert find_filter == {"user_id": "u1", "session_id": "s1"}


def test_chat_stream_yields_deltas_and_persists_full_reply_once_exhausted():
    from app.mentor import chat_stream

    store = _mock_store()

    with patch("app.mentor.qwen_client.chat_fast_stream", return_value=iter(["Great ", "shot!"])):
        receipt, tokens = chat_stream(
            message="How's this photo?", user_id="u1", memory_store=store,
            photo_id="p123", session_id="s1", persona="hobbyist",
        )
        # Receipt is available immediately, before the generator is touched.
        assert "recalled" in receipt
        store.db.chat_turns.insert_one.assert_not_called()

        collected = list(tokens)

    assert collected == ["Great ", "shot!"]
    assert store.db.chat_turns.insert_one.call_count == 2
    assistant_doc = store.db.chat_turns.insert_one.call_args_list[1].args[0]
    assert assistant_doc["content"] == "Great shot!"
    assert assistant_doc["role"] == "assistant"


def test_chat_reply_context_includes_cleared_and_watching_skills():
    from app.mentor import chat
    from app.memory_engine import Skill, SkillStatus

    store = _mock_store()
    store.list_skills.return_value = [
        Skill(name="horizon_tilt", bar=7, status=SkillStatus.CLEARED),
        Skill(name="exposure", bar=7, status=SkillStatus.WATCHING),
    ]
    fake = MagicMock(content="You're doing great!")

    with patch("app.mentor.qwen_client.chat_fast", return_value=fake) as mock_chat:
        chat(message="Status?", user_id="u1", memory_store=store,
             photo_id=None, session_id="s1", persona="hobbyist")

    sent_context = mock_chat.call_args.args[0]
    assert "horizon_tilt" in sent_context  # cleared list
    assert "exposure" in sent_context      # watching list
    assert "hobbyist" in sent_context      # persona block

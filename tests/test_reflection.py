from unittest.mock import MagicMock, patch


def test_summarize_progress_includes_skill_counts():
    from app.reflection import summarize_progress
    from app.memory_engine import Skill, SkillStatus

    mock_store = MagicMock()
    mock_store.list_skills.return_value = [
        Skill(name="horizon_tilt", bar=7, status=SkillStatus.CLEARED),
        Skill(name="exposure", bar=7, status=SkillStatus.WATCHING),
    ]
    fake_result = MagicMock(content="You've cleared 1 skill and are working on 1 more.")

    with patch("app.reflection.qwen_client.chat_fast", return_value=fake_result) as mock_fast:
        summary = summarize_progress(user_id="u1", memory_store=mock_store)

    assert "cleared" in summary.lower()
    sent_prompt = mock_fast.call_args.args[0]
    assert "horizon_tilt" in sent_prompt
    assert "exposure" in sent_prompt

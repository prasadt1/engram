from datetime import datetime, timezone
from unittest.mock import MagicMock


def test_recall_tool_returns_scored_serializable_memories():
    from app.engram_mcp import recall_tool
    from app.memory_engine import MemoryItem

    mock_store = MagicMock()
    mock_store.recall_scored.return_value = [(
        MemoryItem(id="1", content="likes golden hour", importance=0.8, created_at=datetime.now(timezone.utc)),
        {"importance": 0.8, "recency": 0.9, "relevance": 1.0, "salience": 0.72},
    )]
    result = recall_tool(mock_store, user_id="u1", query="lighting preferences", k=3)
    assert result[0]["content"] == "likes golden hour"
    assert result[0]["scores"]["salience"] == 0.72
    assert mock_store.recall_scored.call_args.kwargs["query"] == "lighting preferences"


def test_forget_tool_reports_graduation_state():
    from app.engram_mcp import forget_tool
    from app.memory_engine import Skill, SkillStatus

    mock_store = MagicMock()
    mock_store.get_skill.return_value = Skill(name="horizon_tilt", bar=7, status=SkillStatus.CLEARED)
    result = forget_tool(mock_store, user_id="u1", skill="horizon_tilt")
    assert result == {"forgotten": True, "status": "cleared"}

    mock_store.get_skill.return_value = None
    assert forget_tool(mock_store, user_id="u1", skill="nope")["forgotten"] is False


def test_get_memory_stats_tool_delegates_to_store():
    from app.engram_mcp import get_memory_stats_tool

    mock_store = MagicMock()
    mock_store.get_memory_stats.return_value = {"total_memories": 5}
    assert get_memory_stats_tool(mock_store, user_id="u1")["total_memories"] == 5

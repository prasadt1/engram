"""Tests for multi-learner MCP transcript isolation verifier."""

from app.engram_mcp import verify_recall_isolation


def _recall_entry(user_id: str, memory_id: str, content: str) -> dict:
    return {
        "step": "call_tool",
        "tool": "recall",
        "request": {"user_id": user_id, "query": "test"},
        "response": {
            "content": [{"id": memory_id, "content": content, "scores": {"salience": 0.5}}],
        },
    }


def _stats_entry(user_id: str, live: int) -> dict:
    return {
        "step": "call_tool",
        "tool": "get_memory_stats",
        "request": {"user_id": user_id},
        "response": {"content": [{"live_memories": live, "skills_watching": 1}]},
    }


def test_verify_recall_isolation_passes_when_ids_disjoint():
    log = [
        _recall_entry("demo-user", "m1", "landscape composition"),
        _recall_entry("e2e-prasad", "m2", "sony mirrorless"),
        _stats_entry("demo-user", 12),
        _stats_entry("e2e-prasad", 4),
    ]
    result = verify_recall_isolation(log)
    assert result["isolated"] is True
    assert result["learner_count"] == 2
    assert result["recall_counts_by_user"]["demo-user"] == 1
    assert result["stats_by_user"]["demo-user"]["live_memories"] == 12


def test_verify_recall_isolation_fails_on_shared_memory_id():
    log = [
        _recall_entry("demo-user", "shared-id", "a"),
        _recall_entry("e2e-prasad", "shared-id", "b"),
    ]
    result = verify_recall_isolation(log)
    assert result["isolated"] is False
    assert len(result["shared_memory_ids"]) == 1
    assert result["shared_memory_ids"][0]["shared_memory_ids"] == ["shared-id"]


def test_render_markdown_includes_isolation_summary():
    import importlib.util
    import sys
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "scripts" / "mcp_demo_transcript.py"
    spec = importlib.util.spec_from_file_location("mcp_demo_transcript", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["mcp_demo_transcript"] = mod
    spec.loader.exec_module(mod)

    learners = [mod.LearnerSpec(user_id="u1", recall_query="q", forget_skill="composition", label="U1")]
    log = [
        {"timestamp": "2026-01-01T00:00:00+00:00", "step": "initialize", "response": {}},
        {
            "timestamp": "2026-01-01T00:00:01+00:00",
            "step": "isolation_summary",
            "response": {"isolated": True, "learner_count": 1},
        },
    ]
    md = mod.render_markdown(log, learners)
    assert "multi-learner isolation" in md
    assert "Isolation summary" in md
    assert "**PASS**" in md

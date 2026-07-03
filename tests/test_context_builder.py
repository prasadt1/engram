from datetime import datetime, timedelta, timezone

from app.memory_engine import MemoryItem

NOW = datetime(2026, 7, 3, tzinfo=timezone.utc)


def _items():
    live_big = MemoryItem(id="live_big", content="working on night exposure " + "x " * 200,
                          importance=0.9, created_at=NOW - timedelta(days=1))
    live_small = MemoryItem(id="live_small", content="prefers golden hour light",
                            importance=0.8, created_at=NOW - timedelta(days=2))
    retired = MemoryItem(id="retired", content="used to shoot Canon",
                         importance=0.8, created_at=NOW - timedelta(days=3), superseded_by="new")
    return [live_big, live_small, retired]


def test_build_context_returns_packed_items_and_full_receipt():
    from app.context_builder import build_memory_context

    ctx = build_memory_context(_items(), query="what light do I like?", token_budget=30, now=NOW)

    packed_ids = [i.id for i in ctx.packed]
    assert "live_small" in packed_ids            # fits budget
    assert "live_big" not in packed_ids          # too big for budget
    receipt = ctx.receipt()
    assert receipt["recalled"][0]["scores"]["salience"] > 0
    assert "retired" in [r["id"] for r in receipt["retired_excluded"]]
    assert "live_big" in [d["id"] for d in receipt["dropped_by_budget"]]
    assert receipt["token_budget"] == 30


def test_build_context_on_empty_items_yields_empty_receipt_and_placeholder_block():
    # Cold-start case: a brand-new user with no memories yet. This must not
    # error, and the prompt-facing block must say so rather than being blank.
    from app.context_builder import build_memory_context

    ctx = build_memory_context([], query="anything", token_budget=100, now=NOW)

    assert ctx.packed == []
    assert ctx.context_block() == "(no relevant memories yet)"
    receipt = ctx.receipt()
    assert receipt == {
        "recalled": [],
        "retired_excluded": [],
        "dropped_by_budget": [],
        "token_budget": 100,
        "query": "anything",
    }

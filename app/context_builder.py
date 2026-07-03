"""One shared path from memory items -> packed prompt context + Memory Receipt.

The receipt is the product-facing face of the engine: recall, forgetting,
and context-budget mechanics visible in the main flow, not just a judge page.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.memory_engine import MemoryItem, recall_scored


def _estimate_tokens(item: MemoryItem) -> int:
    # chars/4 heuristic — same documented estimate the /eval harness uses (calibrated there); keep them consistent
    return max(1, len(item.content) // 4)


@dataclass
class MemoryContext:
    packed_pairs: list[tuple[MemoryItem, dict]]
    dropped_by_budget: list[MemoryItem]
    retired_excluded: list[MemoryItem]
    token_budget: int
    query: str | None

    @property
    def packed(self) -> list[MemoryItem]:
        return [m for m, _ in self.packed_pairs]

    @property
    def packed_scores(self) -> list[dict]:
        return [s for _, s in self.packed_pairs]

    def context_block(self) -> str:
        return "\n".join(f"- {m.content}" for m in self.packed) or "(no relevant memories yet)"

    def receipt(self) -> dict:
        # re-reads state live — a second call reflects any mutation of packed_pairs in between
        return {
            "recalled": [
                {"id": m.id, "content": m.content, "genre": m.genre, "scores": s}
                for m, s in self.packed_pairs
            ],
            "retired_excluded": [
                {"id": m.id, "content": m.content} for m in self.retired_excluded
            ],
            "dropped_by_budget": [
                {"id": m.id, "content": m.content} for m in self.dropped_by_budget
            ],
            "token_budget": self.token_budget,
            "query": self.query,
        }


def build_memory_context(
    items: list[MemoryItem], *, query: str | None = None,
    scope: str | None = None, genre: str | None = None,
    k: int = 8, token_budget: int = 1200, now: datetime | None = None,
) -> MemoryContext:
    now = now or datetime.now(timezone.utc)
    retired_candidates = recall_scored(items, now=now, query=query, scope=scope, genre=genre, k=k, include_archived=True)
    retired = [i for i, _ in retired_candidates if not i.is_live()]
    scored = recall_scored(items, now=now, query=query, scope=scope, genre=genre, k=k)

    packed_pairs: list[tuple[MemoryItem, dict]] = []
    dropped: list[MemoryItem] = []
    used = 0
    for item, scores in scored:
        cost = _estimate_tokens(item)
        if used + cost <= token_budget:
            packed_pairs.append((item, scores))
            used += cost
        else:
            dropped.append(item)

    return MemoryContext(
        packed_pairs=packed_pairs, dropped_by_budget=dropped,
        retired_excluded=retired, token_budget=token_budget, query=query,
    )

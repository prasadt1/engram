"""The core memory engine: recall, forget (via graduation/supersession), and
token-budget packing. Pure Python, no database or LLM calls — this is the
logic the /eval harness and the MongoDB-backed store both sit on top of.

Design mirrors two proven patterns already in the Iris foundation:
  - the newer-half vs older-half delta used by trends.py, reused here to
    decide whether a skill is trending well enough to graduate;
  - the superseded_by/supersedes linking used by supersession.py, here
    generalized from HITL approvals to any memory item.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

GRADUATION_THRESHOLD = 3  # consecutive above-bar sessions -> skill graduates (see design spec §8.1)


class SkillStatus(str, Enum):
    WATCHING = "watching"
    CLEARED = "cleared"


@dataclass
class Skill:
    name: str
    bar: float
    status: SkillStatus = SkillStatus.WATCHING
    consecutive_above_bar: int = 0
    raised_on: datetime | None = None
    cleared_on: datetime | None = None
    evidence_ids: list[str] = field(default_factory=list)

    def record_session(self, score: float, *, at: datetime, evidence_id: str) -> "Skill":
        """Update streak state for one new session's score on this skill.

        A break in the streak resets the counter to zero — graduation
        requires a *consecutive* run of good sessions, not a good average.
        """
        if self.raised_on is None:
            self.raised_on = at
        self.evidence_ids.append(evidence_id)

        if score >= self.bar:
            self.consecutive_above_bar += 1
        else:
            self.consecutive_above_bar = 0

        if self.status == SkillStatus.WATCHING and self.consecutive_above_bar >= GRADUATION_THRESHOLD:
            self.status = SkillStatus.CLEARED
            self.cleared_on = at

        return self


def compute_delta(values: list[float]) -> float | None:
    """Newer-half average minus older-half average of a chronological series.

    Same formula as Iris's trends.py::_delta_recent_vs_older, kept
    identical so historical trend data and the new engine agree.
    """
    n = len(values)
    if n < 4:
        return None
    mid = n // 2
    older = sum(values[:mid]) / mid
    newer = sum(values[mid:]) / (n - mid)
    return round(newer - older, 1)


@dataclass
class MemoryItem:
    id: str
    content: str
    importance: float  # 0..1, how consequential this memory is
    created_at: datetime
    scope: str | None = None  # e.g. a photo_id, for scoped recall
    genre: str | None = None
    superseded_by: str | None = None
    archived: bool = False

    def is_live(self) -> bool:
        return not self.archived and self.superseded_by is None


def _recency_weight(item: MemoryItem, *, now: datetime, half_life_days: float = 30.0) -> float:
    age_days = max((now - item.created_at).total_seconds() / 86400.0, 0.0)
    return 0.5 ** (age_days / half_life_days)


def _salience(item: MemoryItem, *, now: datetime) -> float:
    return item.importance * _recency_weight(item, now=now)


def recall(
    items: list[MemoryItem],
    *,
    now: datetime | None = None,
    scope: str | None = None,
    genre: str | None = None,
    k: int = 5,
    include_archived: bool = False,
) -> list[MemoryItem]:
    """Salience-scored retrieval. Excludes superseded/archived items unless
    include_archived is set — this is what makes forgetting *effective*
    rather than merely recorded: a forgotten item stops being recalled.
    """
    now = now or datetime.now(timezone.utc)
    candidates = items if include_archived else [i for i in items if i.is_live()]
    if scope is not None:
        candidates = [i for i in candidates if i.scope == scope]
    if genre is not None:
        candidates = [i for i in candidates if i.genre == genre]
    ranked = sorted(candidates, key=lambda i: _salience(i, now=now), reverse=True)
    return ranked[:k]


def supersede(items: list[MemoryItem], old_id: str, new_item: MemoryItem) -> list[MemoryItem]:
    """Mark `old_id` superseded by `new_item` and append the new item.
    The old item stays in the list (nothing is deleted) but recall() will
    skip it by default — forgetting as retirement, not erasure.
    """
    updated = []
    for item in items:
        if item.id == old_id:
            item = MemoryItem(**{**item.__dict__, "superseded_by": new_item.id})
        updated.append(item)
    updated.append(new_item)
    return updated


def pack(
    items: list[MemoryItem],
    *,
    token_budget: int,
    estimate_tokens: "callable[[MemoryItem], int]",
    now: datetime | None = None,
) -> list[MemoryItem]:
    """Greedy knapsack by salience: fit as many high-salience live items as
    possible under token_budget. Ties broken by recency (already folded
    into salience). Items that don't fit are simply excluded, not
    truncated mid-content — a caller wanting a "tail summary" should
    consolidate first and pack the summary as its own MemoryItem.
    """
    now = now or datetime.now(timezone.utc)
    live = [i for i in items if i.is_live()]
    ranked = sorted(live, key=lambda i: _salience(i, now=now), reverse=True)

    packed: list[MemoryItem] = []
    used = 0
    for item in ranked:
        cost = estimate_tokens(item)
        if used + cost <= token_budget:
            packed.append(item)
            used += cost
    return packed

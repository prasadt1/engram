"""Mongo-backed persistence for the pure-Python memory_engine primitives.

Collections:
  skills        — one doc per (user_id, skill name); mirrors Skill dataclass
  memory_items  — one doc per MemoryItem; mirrors MemoryItem dataclass
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.memory_engine import (
    GRADUATION_THRESHOLD, MemoryItem, Skill, SkillStatus, recall_scored as _recall_scored,
)


def _as_utc(dt: datetime) -> datetime:
    """Mongo/BSON has no timezone-offset type: datetimes always round-trip
    naive (UTC-implied), even though we always write them tz-aware. Without
    this, memory_engine's `now - item.created_at` raises TypeError on any
    item loaded from the store. Re-attach UTC here at the read boundary
    rather than loosening memory_engine's tz-aware assumption."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class MemoryStore:
    def __init__(self, db) -> None:
        self.db = db

    # --- skills / graduation --------------------------------------------

    def get_skill(self, *, user_id: str, skill: str) -> Skill | None:
        doc = self.db.skills.find_one({"user_id": user_id, "name": skill})
        if not doc:
            return None
        return Skill(
            name=doc["name"],
            bar=doc["bar"],
            status=SkillStatus(doc["status"]),
            consecutive_above_bar=doc["consecutive_above_bar"],
            raised_on=doc.get("raised_on"),
            cleared_on=doc.get("cleared_on"),
            evidence_ids=doc.get("evidence_ids", []),
        )

    def record_skill_session(
        self, *, user_id: str, skill: str, bar: float, score: float, evidence_id: str,
        at: datetime | None = None,
    ) -> Skill:
        at = at or datetime.now(timezone.utc)
        current = self.get_skill(user_id=user_id, skill=skill) or Skill(name=skill, bar=bar)
        current.record_session(score, at=at, evidence_id=evidence_id)

        self.db.skills.update_one(
            {"user_id": user_id, "name": skill},
            {"$set": {
                "user_id": user_id,
                "name": current.name,
                "bar": current.bar,
                "status": current.status.value,
                "consecutive_above_bar": current.consecutive_above_bar,
                "raised_on": current.raised_on,
                "cleared_on": current.cleared_on,
                "evidence_ids": current.evidence_ids,
            }},
            upsert=True,
        )
        return current

    def list_skills(self, *, user_id: str) -> list[Skill]:
        docs = self.db.skills.find({"user_id": user_id})
        return [
            Skill(
                name=d["name"], bar=d["bar"], status=SkillStatus(d["status"]),
                consecutive_above_bar=d["consecutive_above_bar"],
                raised_on=d.get("raised_on"), cleared_on=d.get("cleared_on"),
                evidence_ids=d.get("evidence_ids", []),
            )
            for d in docs
        ]

    # --- memory items / recall / forgetting ------------------------------

    def write_memory(
        self, *, user_id: str, content: str, importance: float,
        scope: str | None = None, genre: str | None = None,
    ) -> str:
        doc = {
            "user_id": user_id, "content": content, "importance": importance,
            "created_at": datetime.now(timezone.utc), "scope": scope, "genre": genre,
            "superseded_by": None, "archived": False,
        }
        result = self.db.memory_items.insert_one(doc)
        return str(result.inserted_id)

    def supersede_memory(self, *, old_id: str, new_content: str, importance: float, genre: str | None = None) -> str:
        from bson import ObjectId
        old = self.db.memory_items.find_one({"_id": ObjectId(old_id)})
        new_id = self.write_memory(
            user_id=old["user_id"], content=new_content, importance=importance,
            scope=old.get("scope"), genre=genre or old.get("genre"),
        )
        self.db.memory_items.update_one({"_id": ObjectId(old_id)}, {"$set": {"superseded_by": new_id}})
        return new_id

    def recall(
        self, *, user_id: str, query: str | None = None, scope: str | None = None, genre: str | None = None,
        k: int = 5, include_archived: bool = False,
    ) -> list[MemoryItem]:
        return [item for item, _ in self.recall_scored(
            user_id=user_id, query=query, scope=scope, genre=genre, k=k, include_archived=include_archived,
        )]

    def recall_scored(
        self, *, user_id: str, query: str | None = None, scope: str | None = None, genre: str | None = None,
        k: int = 5, include_archived: bool = False,
    ) -> list[tuple[MemoryItem, dict]]:
        """recall() plus per-item {importance, recency, relevance, salience} —
        feeds the glass-box UI and the engram-mcp recall tool (explainable retrieval)."""
        docs = self.db.memory_items.find({"user_id": user_id})
        items = [
            MemoryItem(
                id=str(d["_id"]), content=d["content"], importance=d["importance"],
                created_at=_as_utc(d["created_at"]), scope=d.get("scope"), genre=d.get("genre"),
                superseded_by=d.get("superseded_by"), archived=d.get("archived", False),
            )
            for d in docs
        ]
        return _recall_scored(items, query=query, scope=scope, genre=genre, k=k, include_archived=include_archived)

    def get_memory_stats(self, *, user_id: str) -> dict:
        total = self.db.memory_items.count_documents({"user_id": user_id})
        live = self.db.memory_items.count_documents({"user_id": user_id, "superseded_by": None, "archived": False})
        skills = self.list_skills(user_id=user_id)
        return {
            "total_memories": total,
            "live_memories": live,
            "superseded_memories": total - live,
            "skills_watching": sum(1 for s in skills if s.status == SkillStatus.WATCHING),
            "skills_cleared": sum(1 for s in skills if s.status == SkillStatus.CLEARED),
        }

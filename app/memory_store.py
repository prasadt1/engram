"""Mongo-backed persistence for the pure-Python memory_engine primitives.

Collections:
  skills        — one doc per (user_id, skill name); mirrors Skill dataclass
  memory_items  — one doc per MemoryItem; mirrors MemoryItem dataclass
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.memory_engine import (
    MemoryItem, Skill, SkillStatus, recall_scored as _recall_scored,
)


def _as_utc(dt: datetime | None) -> datetime | None:
    """Mongo/BSON has no timezone-offset type: datetimes always round-trip
    naive (UTC-implied), even though we always write them tz-aware. Without
    this, memory_engine's `now - item.created_at` raises TypeError on any
    item loaded from the store. Re-attach UTC here at the read boundary —
    for MemoryItem.created_at and Skill.raised_on/cleared_on — rather than
    loosening memory_engine's tz-aware assumption. None passes through
    (Skill datetimes are optional)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# Small, curated synonym map from generic category words to this codebase's
# controlled `genre` taxonomy (see CoachAnalysisOutput.genre in app/schema.py).
# Used by MemoryStore.search_portfolio() below so a generic term like "person"
# also matches a doc whose genre is "portrait", even when the AI-generated
# scene_description/tags never use that literal word (they say "woman"/"man").
# Deliberately NOT exhaustive -- just the clear generic-word-vs-specific-word
# gaps for genres that already exist in the taxonomy.
GENRE_SEARCH_SYNONYMS: dict[str, set[str]] = {
    "portrait": {"person", "people", "human"},
    "wildlife": {"animal", "animals"},
    "architecture": {"building", "buildings"},
    "landscape": {"nature", "scenery"},
}


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
            raised_on=_as_utc(doc.get("raised_on")),
            cleared_on=_as_utc(doc.get("cleared_on")),
            evidence_ids=doc.get("evidence_ids", []),
        )

    def record_skill_session(
        self, *, user_id: str, skill: str, bar: float, score: float, evidence_id: str,
        at: datetime | None = None,
    ) -> Skill:
        # NOTE: read-modify-write, not atomic. Two concurrent sessions for the
        # same user+skill can race and lose one evidence_id / streak increment.
        # Acceptable for current single-user sequential-upload usage; revisit
        # with findOneAndUpdate + $inc if concurrent writers are ever introduced.
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
                raised_on=_as_utc(d.get("raised_on")), cleared_on=_as_utc(d.get("cleared_on")),
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

    def supersede_memory(self, *, old_id: str, user_id: str, new_content: str, importance: float, genre: str | None = None) -> str:
        from bson import ObjectId
        old = self.db.memory_items.find_one({"_id": ObjectId(old_id), "user_id": user_id})
        if old is None:
            raise ValueError(f"memory {old_id} not found for user {user_id}")
        new_id = self.write_memory(
            user_id=old["user_id"], content=new_content, importance=importance,
            scope=old.get("scope"), genre=genre or old.get("genre"),
        )
        self.db.memory_items.update_one({"_id": ObjectId(old_id), "user_id": user_id}, {"$set": {"superseded_by": new_id}})
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

    # --- portfolio aggregations (aesthetic identity, not memory recall) --

    def top_aesthetic_tags(self, *, user_id: str, limit: int | None = 20, top_n: int = 8) -> list[str]:
        """Most frequent aesthetic_tags across the user's portfolio_entries,
        most-recent-first before counting (limit=None means the whole history).
        Extracted from the aesthetic-profile route so the journey route can
        reuse the same logic with a different window."""
        cursor = self.db.portfolio_entries.find({"user_id": user_id}).sort("created_at", -1)
        if limit is not None:
            cursor = cursor.limit(limit)
        tag_counts: dict[str, int] = {}
        for doc in cursor:
            for tag in doc.get("aesthetic_tags") or []:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        ranked = sorted(tag_counts.items(), key=lambda pair: -pair[1])
        return [tag for tag, _ in ranked[:top_n]]

    def dominant_genre(self, *, user_id: str, limit: int | None = None) -> str | None:
        """Most frequent genre across portfolio_entries; ties broken by
        whichever genre was shot most recently (docs are read most-recent
        first, so the first occurrence of a genre IS its most recent)."""
        cursor = self.db.portfolio_entries.find({"user_id": user_id}).sort("created_at", -1)
        if limit is not None:
            cursor = cursor.limit(limit)
        counts: dict[str, int] = {}
        most_recent_rank: dict[str, int] = {}
        for idx, doc in enumerate(cursor):
            genre = doc.get("genre")
            if not genre:
                continue
            counts[genre] = counts.get(genre, 0) + 1
            most_recent_rank.setdefault(genre, idx)
        if not counts:
            return None
        return max(counts.items(), key=lambda pair: (pair[1], -most_recent_rank[pair[0]]))[0]

    # --- portfolio search / similarity (structured metadata, no embeddings --
    # see app/coach.py's header comment on why vector search isn't ported) --

    def search_portfolio(self, *, user_id: str, query: str, limit: int = 8) -> tuple[list[dict], list[str]]:
        """Structured-metadata search (no embeddings, by design -- see
        coach.py's header comment). Returns (matching docs sorted by
        term-match count desc then recency desc, the lowercased search terms
        actually used)."""
        terms = [t for t in query.lower().split() if len(t) >= 2]
        if not terms:
            return [], []

        docs = list(self.db.portfolio_entries.find({"user_id": user_id}))
        scored = []
        for doc in docs:
            haystack_fields = [
                (doc.get("scene_description") or ""),
                (doc.get("colour_notes") or ""),
                (doc.get("genre") or ""),
                *([t for t in doc.get("aesthetic_tags") or []]),
                *([t for t in doc.get("user_tags") or []]),
            ]
            haystack = " ".join(str(f) for f in haystack_fields).lower()
            doc_genre_synonyms = GENRE_SEARCH_SYNONYMS.get((doc.get("genre") or "").lower(), set())
            matched_terms = {t for t in terms if t in haystack or t in doc_genre_synonyms}
            if matched_terms:
                scored.append((len(matched_terms), doc))

        scored.sort(
            key=lambda pair: (pair[0], _as_utc(pair[1].get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)),
            reverse=True,
        )
        return [doc for _, doc in scored[:limit]], terms

    def similar_portfolio_entries(self, *, user_id: str, source_doc: dict, limit: int = 4) -> list[tuple[dict, float]]:
        """Tag/genre overlap similarity (no embeddings, by design). Returns
        (doc, score) pairs for the same user, excluding the source doc, sorted
        by score desc then recency desc, zero-score entries excluded."""
        source_tags = {t.lower() for t in (source_doc.get("aesthetic_tags") or [])}
        source_genre = source_doc.get("genre")

        docs = self.db.portfolio_entries.find({"user_id": user_id, "_id": {"$ne": source_doc["_id"]}})
        scored = []
        for doc in docs:
            doc_tags = {t.lower() for t in (doc.get("aesthetic_tags") or [])}
            shared_tags = source_tags & doc_tags
            score = 2.0 * len(shared_tags)
            if source_genre and doc.get("genre") == source_genre:
                score += 1.0
            if score > 0:
                scored.append((score, doc))

        scored.sort(
            key=lambda pair: (pair[0], _as_utc(pair[1].get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)),
            reverse=True,
        )
        return [(doc, score) for score, doc in scored[:limit]]

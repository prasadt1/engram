"""Read-only Coach Assist roster — multi-learner summaries for judge demo."""

from __future__ import annotations

from typing import Any

from app.assignments import get_active_assignment, pick_focus_skill
from app.identity import build_identity_line
from app.memory_engine import SkillStatus
from app.memory_store import MemoryStore

# Fixed roster for P1 — demo-user plus two synthetic arcs (see seed_coach_assist_learners.py).
ROSTER: list[dict[str, str]] = [
    {"user_id": "demo-user", "display_name": "Jordan", "arc_label": "Improving — composition cleared"},
    {"user_id": "coach-assist-stuck", "display_name": "Alex", "arc_label": "Stuck on lighting"},
    {"user_id": "coach-assist-cleared", "display_name": "Sam", "arc_label": "Composition graduated"},
]


def _assignment_summary(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    return {
        "id": doc.get("id"),
        "targetSkill": doc.get("targetSkill"),
        "brief": doc.get("brief", "")[:200],
        "status": doc.get("status"),
    }


def build_learner_card(store: MemoryStore, *, user_id: str, display_name: str, arc_label: str) -> dict[str, Any]:
    skills = store.list_skills(user_id=user_id)
    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]
    watching = [s for s in skills if s.status == SkillStatus.WATCHING]
    current_focus = (
        min(watching, key=lambda s: (-s.consecutive_above_bar, s.name)).name if watching else None
    )
    genre = store.dominant_genre(user_id=user_id, limit=None)
    top_tags = store.top_aesthetic_tags(user_id=user_id, limit=None, top_n=1)
    tag = top_tags[0] if top_tags else None
    identity = build_identity_line(genre, tag, cleared, current_focus)
    photo_count = store.db.portfolio_entries.count_documents({"user_id": user_id})

    active_raw = get_active_assignment(store, user_id=user_id)
    proposed_raw = store.db.assignments.find_one({"user_id": user_id, "status": "proposed"})
    from app.assignments import _serialize as serialize_assignment

    proposed = serialize_assignment(proposed_raw) if proposed_raw else None

    _, receipt = pick_focus_skill(store, user_id=user_id)
    memory_line = (
        f"Watching {receipt.get('targetSkill')} "
        f"(streak {receipt.get('consecutiveAboveBar')}/{receipt.get('graduationThreshold')})"
        if receipt.get("source") != "default_foundation"
        else "Building foundational practice"
    )

    return {
        "userId": user_id,
        "displayName": display_name,
        "arcLabel": arc_label,
        "photoCount": photo_count,
        "identity": identity,
        "currentFocus": current_focus,
        "clearedSkills": cleared,
        "watchingSkills": [
            {"name": s.name, "consecutive": s.consecutive_above_bar} for s in watching
        ],
        "memoryLine": memory_line,
        "activeAssignment": _assignment_summary(active_raw),
        "proposedAssignment": _assignment_summary(proposed),
    }


def build_roster(store: MemoryStore) -> dict[str, Any]:
    learners = [
        build_learner_card(
            store,
            user_id=entry["user_id"],
            display_name=entry["display_name"],
            arc_label=entry["arc_label"],
        )
        for entry in ROSTER
    ]
    return {"learners": learners}

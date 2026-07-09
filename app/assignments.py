"""Practice Loop assignments — CRUD + skill-status recommender.

Ported from iris-photography-mentor/app/memory/assignments.py, adapted for
Engram's string user_ids and watching/streak/graduation memory engine.
Wire shape is camelCase to match frontend/src/types/practice.ts.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId

from app.assignment_schema import (
    DIMENSION_LABELS,
    SCORE_DIMS,
    PlannerAssignmentOutput,
    SkillDelta,
)
from app.memory_engine import GRADUATION_THRESHOLD, SkillStatus
from app.memory_store import MemoryStore

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent / "prompts" / "planner.txt"


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    skill = doc.get("skill_delta")
    created = doc.get("created_at")
    completed = doc.get("completed_at")
    return {
        "id": str(doc["_id"]),
        "userId": str(doc.get("user_id", "")),
        "status": doc.get("status"),
        "brief": doc.get("brief", ""),
        "targetSkill": doc.get("target_skill", ""),
        "rationale": doc.get("rationale", ""),
        "baselineShootIds": [str(x) for x in doc.get("baseline_shoot_ids") or []],
        "completionShootIds": [str(x) for x in doc.get("completion_shoot_ids") or []],
        "skillDelta": skill,
        "appliedBrief": doc.get("applied_brief"),
        "createdAt": created.isoformat() if isinstance(created, datetime) else str(created or ""),
        "completedAt": (
            completed.isoformat() if isinstance(completed, datetime) else None
        ),
    }


def pick_focus_skill(
    store: MemoryStore,
    *,
    user_id: str,
    focus_skill: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """Choose the assignment target from watching skill state (journey current_focus).

    Returns (skill_name, inspectable_receipt) for rationale grounding.
    """
    skills = store.list_skills(user_id=user_id)
    watching = [s for s in skills if s.status == SkillStatus.WATCHING]
    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]

    if focus_skill:
        normalized = focus_skill.lower().strip().replace("-", "_")
        if normalized not in SCORE_DIMS:
            raise ValueError(
                f"Unknown focus_skill {focus_skill!r}; expected one of {SCORE_DIMS}"
            )
        skill = store.get_skill(user_id=user_id, skill=normalized)
        streak = skill.consecutive_above_bar if skill else 0
        status = skill.status.value if skill else SkillStatus.WATCHING.value
        receipt = {
            "source": "user_override",
            "targetSkill": normalized,
            "status": status,
            "consecutiveAboveBar": streak,
            "graduationThreshold": GRADUATION_THRESHOLD,
            "watching": [s.name for s in watching],
            "cleared": cleared,
        }
        return normalized, receipt

    if not watching:
        receipt = {
            "source": "default_foundation",
            "targetSkill": "composition",
            "status": SkillStatus.WATCHING.value,
            "consecutiveAboveBar": 0,
            "graduationThreshold": GRADUATION_THRESHOLD,
            "watching": [],
            "cleared": cleared,
        }
        return "composition", receipt

    # Same ordering as /api/v1/journey current_focus.
    chosen = min(watching, key=lambda s: (-s.consecutive_above_bar, s.name))
    receipt = {
        "source": "watching_closest_to_clear",
        "targetSkill": chosen.name,
        "status": chosen.status.value,
        "consecutiveAboveBar": chosen.consecutive_above_bar,
        "graduationThreshold": GRADUATION_THRESHOLD,
        "watching": [
            {"name": s.name, "consecutive": s.consecutive_above_bar} for s in watching
        ],
        "cleared": cleared,
    }
    return chosen.name, receipt


def _baseline_entry_ids(store: MemoryStore, user_id: str, limit: int = 3) -> list[ObjectId]:
    docs = list(
        store.db.portfolio_entries.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return [d["_id"] for d in docs]


def _receipt_pattern_line(receipt: dict[str, Any]) -> str:
    """Judge-facing Pattern line — never leak internal receipt.source tokens."""
    source = receipt.get("source", "")
    target = receipt.get("targetSkill", "composition")
    label = DIMENSION_LABELS.get(target, target.replace("_", " ").title())
    streak = int(receipt.get("consecutiveAboveBar", 0))
    threshold = int(receipt.get("graduationThreshold", GRADUATION_THRESHOLD))
    cleared = receipt.get("cleared") or []
    watching = receipt.get("watching") or []

    if source == "default_foundation":
        if cleared and not watching:
            cleared_labels = ", ".join(
                DIMENSION_LABELS.get(s, s.replace("_", " ").title()) for s in cleared
            )
            return (
                f"{cleared_labels} cleared — revisiting {label.lower()} "
                "to keep fundamentals sharp"
            )
        return f"foundational practice on {label.lower()} — building your first streak"

    if source == "user_override":
        return f"focused practice on {label.lower()} (streak {streak}/{threshold})"

    # watching_closest_to_clear — same rule as journey current_focus.
    return (
        f"{label} is closest to clearing among active skills "
        f"(streak {streak}/{threshold})"
    )


def _deterministic_brief(target: str, receipt: dict[str, Any], *, mode: str) -> PlannerAssignmentOutput:
    """Offline / test fallback when the planner model is unavailable."""
    streak = receipt.get("consecutiveAboveBar", 0)
    threshold = receipt.get("graduationThreshold", GRADUATION_THRESHOLD)
    label = DIMENSION_LABELS.get(target, target.replace("_", " ").title())
    remaining = max(0, threshold - int(streak))
    tone = (
        f"Stay consistent on {label.lower()} — {remaining} above-bar shoot(s) to clear."
        if mode == "working_pro"
        else f"Keep building {label.lower()} — {remaining} solid shoot(s) until it clears."
    )
    brief = (
        f"- Shoot one frame that deliberately practices {label.lower()}.\n"
        f"- Review edges, subject placement, and light before you press the shutter.\n"
        f"- Success: the upload's {target} score sits at or above your bar."
    )
    rationale = (
        f"- **Pattern:** {_receipt_pattern_line(receipt)}.\n"
        f"- **Why now:** {tone}"
    )
    return PlannerAssignmentOutput(
        brief=brief, target_skill=target, rationale=rationale
    )


def _planner_llm(
    *,
    mode: str,
    target: str,
    receipt: dict[str, Any],
    portfolio_hint: str,
) -> PlannerAssignmentOutput:
    from app import qwen_client

    system = PROMPT_PATH.read_text(encoding="utf-8")
    user = (
        f"Mode: {mode}\n"
        f"Mandatory target_skill: {target}\n"
        f"Skill-memory receipt (JSON): {json.dumps(receipt)}\n"
        f"Recent portfolio context: {portfolio_hint}\n"
        "Generate the next practice assignment. target_skill must equal the "
        "mandatory target_skill above."
    )
    # Fast tier + short ceiling: propose must feel instant for Practice UX.
    # Reasoning-tier timeouts (~40s×2) left Suggest practice hanging >80s.
    result = qwen_client.chat_fast(user, system=system, json_mode=True)

    def _repair(raw: str) -> str:
        fix = f"This is not valid JSON. Return ONLY corrected valid JSON, no prose:\n\n{raw}"
        return qwen_client.chat_fast(fix, json_mode=True).content

    planned = PlannerAssignmentOutput.model_validate(
        qwen_client.parse_json_with_repair(result.content, _repair)
    )
    # Hard-enforce skill-status target even if the model drifts.
    if planned.target_skill != target:
        planned = PlannerAssignmentOutput(
            brief=planned.brief,
            target_skill=target,
            rationale=planned.rationale,
        )
    return planned


def generate_assignment(
    store: MemoryStore,
    *,
    user_id: str,
    mode: str = "hobbyist",
    focus_skill: str | None = None,
    use_llm: bool = True,
) -> dict[str, Any]:
    target, receipt = pick_focus_skill(store, user_id=user_id, focus_skill=focus_skill)

    recent = list(
        store.db.portfolio_entries.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(5)
    )
    if recent:
        portfolio_hint = "; ".join(
            f"{d.get('genre', '?')} scores={d.get('scores')}" for d in recent
        )
    else:
        portfolio_hint = "No portfolio yet — foundational exercise."

    if use_llm:
        # Bound wait so Practice "Suggest" never hangs on a wedged model call.
        # Do not use `with ThreadPoolExecutor` — its __exit__ waits for the
        # worker, which would erase the timeout benefit.
        from concurrent.futures import ThreadPoolExecutor
        from concurrent.futures import TimeoutError as FuturesTimeout

        pool = ThreadPoolExecutor(max_workers=1)
        try:
            fut = pool.submit(
                _planner_llm,
                mode=mode,
                target=target,
                receipt=receipt,
                portfolio_hint=portfolio_hint,
            )
            planned = fut.result(timeout=12.0)
        except FuturesTimeout:
            logger.warning("planner LLM exceeded 12s budget; using deterministic brief")
            planned = _deterministic_brief(target, receipt, mode=mode)
        except Exception:
            logger.exception("planner LLM failed; using deterministic brief")
            planned = _deterministic_brief(target, receipt, mode=mode)
        finally:
            pool.shutdown(wait=False, cancel_futures=True)
    else:
        planned = _deterministic_brief(target, receipt, mode=mode)

    # Append inspectable Pattern line if model omitted streak facts.
    streak = receipt.get("consecutiveAboveBar")
    threshold = receipt.get("graduationThreshold")
    if str(streak) not in planned.rationale:
        planned = PlannerAssignmentOutput(
            brief=planned.brief,
            target_skill=target,
            rationale=(
                planned.rationale.rstrip()
                + f"\n- **Memory:** {_receipt_pattern_line(receipt)}."
            ),
        )

    now = datetime.now(timezone.utc)
    doc: dict[str, Any] = {
        "user_id": user_id,
        "status": "proposed",
        "brief": planned.brief,
        "target_skill": target,
        "rationale": planned.rationale,
        "baseline_shoot_ids": _baseline_entry_ids(store, user_id),
        "completion_shoot_ids": [],
        "linked_portfolio_ids": [],
        "memory_receipt": receipt,
        "created_at": now,
        "completed_at": None,
        "skill_delta": None,
        "applied_brief": None,
    }
    result = store.db.assignments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def list_assignments(store: MemoryStore, *, user_id: str) -> dict[str, Any]:
    coll = store.db.assignments
    query = {"user_id": user_id}
    proposed = [
        _serialize(d)
        for d in coll.find({**query, "status": "proposed"}).sort("created_at", -1)
    ]
    active = [
        _serialize(d)
        for d in coll.find({**query, "status": "active"}).sort("created_at", -1)
    ]
    completed = [
        _serialize(d)
        for d in coll.find({**query, "status": "completed"}).sort("created_at", -1).limit(12)
    ]
    return {"proposed": proposed, "active": active, "completed": completed}


def get_assignment(
    store: MemoryStore, *, assignment_id: str, user_id: str | None = None
) -> dict[str, Any]:
    try:
        oid = ObjectId(assignment_id)
    except Exception as exc:
        raise ValueError("Invalid assignment id") from exc
    query: dict[str, Any] = {"_id": oid}
    if user_id:
        query["user_id"] = user_id
    doc = store.db.assignments.find_one(query)
    if not doc:
        raise ValueError("Assignment not found")
    return _serialize(doc)


def get_active_assignment(store: MemoryStore, *, user_id: str) -> dict[str, Any] | None:
    doc = store.db.assignments.find_one({"user_id": user_id, "status": "active"})
    return _serialize(doc) if doc else None


def accept_assignment(
    store: MemoryStore, *, assignment_id: str, user_id: str | None = None
) -> dict[str, Any]:
    try:
        oid = ObjectId(assignment_id)
    except Exception as exc:
        raise ValueError("Invalid assignment id") from exc
    coll = store.db.assignments
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise ValueError("Assignment not found")
    if user_id and doc.get("user_id") != user_id:
        raise ValueError("Assignment not found")
    if doc.get("status") != "proposed":
        raise ValueError("Only proposed assignments can be accepted")

    uid = doc.get("user_id")
    now = datetime.now(timezone.utc)
    if uid:
        coll.update_many(
            {"user_id": uid, "status": "active"},
            {"$set": {"status": "abandoned", "completed_at": now}},
        )
    coll.update_one(
        {"_id": oid},
        {"$set": {"status": "active", "practice_shoot_id": ObjectId()}},
    )
    updated = coll.find_one({"_id": oid})
    assert updated
    return _serialize(updated)


def decline_assignment(
    store: MemoryStore, *, assignment_id: str, user_id: str | None = None
) -> dict[str, Any]:
    try:
        oid = ObjectId(assignment_id)
    except Exception as exc:
        raise ValueError("Invalid assignment id") from exc
    coll = store.db.assignments
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise ValueError("Assignment not found")
    if user_id and doc.get("user_id") != user_id:
        raise ValueError("Assignment not found")
    if doc.get("status") != "proposed":
        raise ValueError("Only proposed assignments can be declined")

    now = datetime.now(timezone.utc)
    coll.update_one(
        {"_id": oid},
        {"$set": {"status": "abandoned", "completed_at": now}},
    )
    updated = coll.find_one({"_id": oid})
    assert updated
    return _serialize(updated)


def propose_assignment(
    store: MemoryStore,
    *,
    user_id: str,
    mode: str = "hobbyist",
    focus_skill: str | None = None,
    use_llm: bool = True,
) -> dict[str, Any]:
    existing = store.db.assignments.find_one({"user_id": user_id, "status": "proposed"})
    if existing:
        return _serialize(existing)
    doc = generate_assignment(
        store, user_id=user_id, mode=mode, focus_skill=focus_skill, use_llm=use_llm
    )
    return _serialize(doc)


def link_upload_to_assignment(
    store: MemoryStore,
    *,
    assignment_id: str,
    portfolio_entry_id: ObjectId,
    user_id: str | None = None,
) -> None:
    try:
        oid = ObjectId(assignment_id)
    except Exception as exc:
        raise ValueError("Invalid assignment id") from exc
    query: dict[str, Any] = {"_id": oid, "status": "active"}
    if user_id:
        query["user_id"] = user_id
    doc = store.db.assignments.find_one(query)
    if not doc:
        raise ValueError("Active assignment not found")

    updates: dict[str, Any] = {
        "$addToSet": {
            "completion_shoot_ids": portfolio_entry_id,
            "linked_portfolio_ids": portfolio_entry_id,
        }
    }
    store.db.assignments.update_one({"_id": oid}, updates)


def _avg_dimension(entries: list[dict[str, Any]], dimension: str) -> float | None:
    if not entries:
        return None
    total = 0.0
    for doc in entries:
        scores = doc.get("scores") or {}
        total += float(scores.get(dimension, 0))
    return total / len(entries)


def _entries_by_ids(store: MemoryStore, ids: list) -> list[dict[str, Any]]:
    oids: list[ObjectId] = []
    for x in ids:
        if isinstance(x, ObjectId):
            oids.append(x)
        else:
            try:
                oids.append(ObjectId(str(x)))
            except Exception:
                continue
    if not oids:
        return []
    docs = list(store.db.portfolio_entries.find({"_id": {"$in": oids}}).sort("created_at", 1))
    by_id = {d["_id"]: d for d in docs}
    return [by_id[i] for i in oids if i in by_id]


def reflect_assignment(store: MemoryStore, *, assignment_id: str) -> dict[str, Any]:
    """Score-delta reflection when completing an assignment (no external LLM required)."""
    try:
        oid = ObjectId(assignment_id)
    except Exception as exc:
        raise ValueError("Invalid assignment id") from exc
    assignment = store.db.assignments.find_one({"_id": oid})
    if not assignment:
        raise ValueError("Assignment not found")
    if assignment.get("status") != "active":
        raise ValueError("Only active assignments can be completed")

    target = (assignment.get("target_skill") or "composition").lower().replace("-", "_")
    if target not in SCORE_DIMS:
        target = "composition"

    baseline = _entries_by_ids(store, list(assignment.get("baseline_shoot_ids") or []))
    linked = list(assignment.get("linked_portfolio_ids") or [])
    if linked:
        completion = _entries_by_ids(store, [linked[-1]])
    else:
        completion = _entries_by_ids(store, list(assignment.get("completion_shoot_ids") or []))
        if completion:
            completion = [completion[-1]]

    baseline_avg = _avg_dimension(baseline, target)
    completion_avg = _avg_dimension(completion, target)

    if baseline_avg is None and completion_avg is None:
        baseline_value, current_value, delta = 0.0, 0.0, 0.0
    elif baseline_avg is None:
        baseline_value = max(0.0, (completion_avg or 0) - 1.5)
        current_value = completion_avg or 0.0
        delta = current_value - baseline_value
    else:
        baseline_value = baseline_avg
        current_value = completion_avg if completion_avg is not None else baseline_avg
        delta = current_value - baseline_value

    skill_delta = SkillDelta(
        metric=DIMENSION_LABELS.get(target, target.replace("_", " ").title()),
        baseline_value=round(baseline_value, 1),
        current_value=round(current_value, 1),
        delta=round(delta, 1),
    )
    applied = delta > 0.2 and len(completion) > 0
    summary = (
        f"Compared {len(baseline)} baseline and {len(completion)} practice photo(s) "
        f"on {target}: {baseline_avg if baseline_avg is not None else 'n/a'} → "
        f"{completion_avg if completion_avg is not None else 'n/a'}."
    )
    return {
        "summary": summary,
        "appliedBrief": applied,
        "skillDelta": skill_delta.model_dump(),
        "baselinePhotoCount": len(baseline),
        "practicePhotoCount": len(completion),
    }


def complete_assignment(
    store: MemoryStore, *, assignment_id: str, user_id: str | None = None
) -> dict[str, Any]:
    reflection = reflect_assignment(store, assignment_id=assignment_id)
    try:
        oid = ObjectId(assignment_id)
    except Exception as exc:
        raise ValueError("Invalid assignment id") from exc
    if user_id:
        doc = store.db.assignments.find_one({"_id": oid, "user_id": user_id})
        if not doc:
            raise ValueError("Assignment not found")
    now = datetime.now(timezone.utc)
    store.db.assignments.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "completed",
                "completed_at": now,
                "skill_delta": reflection["skillDelta"],
                "applied_brief": reflection.get("appliedBrief"),
            }
        },
    )
    updated = store.db.assignments.find_one({"_id": oid})
    assert updated
    return {"assignment": _serialize(updated), "reflection": reflection}

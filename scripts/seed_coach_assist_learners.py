"""Seed Coach Assist demo learners by cloning demo-user data (no VL calls).

Creates coach-assist-stuck and coach-assist-cleared with patched skill arcs.
Never touches e2e-prasad or demo-user portfolio data (only reads demo-user).

Run: python scripts/seed_coach_assist_learners.py
"""

from __future__ import annotations

import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

from app.db import get_db  # noqa: E402
from app.memory_engine import SkillStatus  # noqa: E402
from app.memory_store import MemoryStore  # noqa: E402

SOURCE_USER = "demo-user"
LEARNERS = [
    {
        "user_id": "coach-assist-stuck",
        "display_name": "Alex",
        "skill_patch": {
            "composition": {"status": "cleared", "consecutive_above_bar": 3},
            "lighting": {"status": "watching", "consecutive_above_bar": 0},
            "creativity": {"status": "watching", "consecutive_above_bar": 1},
            "technique": {"status": "watching", "consecutive_above_bar": 0},
            "subject_impact": {"status": "watching", "consecutive_above_bar": 0},
        },
    },
    {
        "user_id": "coach-assist-cleared",
        "display_name": "Sam",
        "skill_patch": {
            "composition": {"status": "cleared", "consecutive_above_bar": 3},
            "creativity": {"status": "cleared", "consecutive_above_bar": 3},
            "technique": {"status": "watching", "consecutive_above_bar": 2},
            "lighting": {"status": "watching", "consecutive_above_bar": 1},
            "subject_impact": {"status": "watching", "consecutive_above_bar": 0},
        },
    },
]

WIPE_COLLECTIONS = ("memory_items", "skills", "portfolio_entries", "assignments", "chat_turns")


def wipe_user(db, user_id: str) -> None:
    print(f"Wiping {user_id!r}...")
    for coll in WIPE_COLLECTIONS:
        n = db[coll].delete_many({"user_id": user_id}).deleted_count
        print(f"  {coll}: {n}")
    db.users.delete_one({"_id": user_id})


def clone_collection(db, coll: str, source: str, target: str) -> int:
    count = 0
    for doc in db[coll].find({"user_id": source}):
        new_doc = deepcopy(doc)
        new_doc.pop("_id", None)
        new_doc["user_id"] = target
        db[coll].insert_one(new_doc)
        count += 1
    return count


def patch_skills(db, user_id: str, patch: dict) -> None:
    now = datetime.now(timezone.utc)
    for name, fields in patch.items():
        db.skills.update_one(
            {"user_id": user_id, "name": name},
            {
                "$set": {
                    **fields,
                    "status": fields["status"],
                    "cleared_on": now if fields["status"] == SkillStatus.CLEARED.value else None,
                }
            },
            upsert=True,
        )


def seed_learner(store: MemoryStore, spec: dict) -> None:
    db = store.db
    uid = spec["user_id"]
    wipe_user(db, uid)
    for coll in WIPE_COLLECTIONS:
        if coll == "assignments":
            continue
        n = clone_collection(db, coll, SOURCE_USER, uid)
        print(f"  cloned {n} {coll} docs")
    patch_skills(db, uid, spec["skill_patch"])
    db.users.update_one(
        {"_id": uid},
        {"$set": {"displayName": spec["display_name"], "persona": "hobbyist"}},
        upsert=True,
    )
    # Propose a practice assignment grounded on patched skill state (deterministic, no LLM).
    from app.assignments import propose_assignment

    propose_assignment(store, user_id=uid, use_llm=False)
    print(f"  proposed assignment for {uid}")


def main() -> None:
    db = get_db()
    store = MemoryStore(db=db)
    if db.portfolio_entries.count_documents({"user_id": SOURCE_USER}) == 0:
        print(f"ERROR: {SOURCE_USER!r} has no portfolio — run seed_demo_user.py first.")
        sys.exit(1)
    for spec in LEARNERS:
        print(f"\n=== {spec['user_id']} ({spec['display_name']}) ===")
        seed_learner(store, spec)
    print("\nCoach Assist learners seeded.")


if __name__ == "__main__":
    main()

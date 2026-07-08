"""Seed Coach Assist learners with distinct photo libraries (real Qwen-VL critiques).

Replaces the earlier clone-from-demo-user shortcut. Each learner gets their
own Unsplash manifest, staged skill arcs, and proposed assignment.

Run: python scripts/seed_coach_assist_learners.py
     python scripts/seed_coach_assist_learners.py --only coach-assist-stuck

Never touches demo-user or e2e-prasad.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

from app.db import get_db  # noqa: E402
from app.memory_store import MemoryStore  # noqa: E402
from scripts.seed_journey_core import seed_journey  # noqa: E402
from scripts.seed_manifests import COACH_ASSIST_CONFIGS  # noqa: E402

PROTECTED_USERS = frozenset({"e2e-prasad", "demo-user"})


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Coach Assist demo learners")
    parser.add_argument(
        "--only",
        choices=[c.user_id for c in COACH_ASSIST_CONFIGS],
        help="Seed a single learner",
    )
    args = parser.parse_args()

    configs = COACH_ASSIST_CONFIGS
    if args.only:
        configs = [c for c in configs if c.user_id == args.only]

    store = MemoryStore(db=get_db())
    for config in configs:
        if config.user_id in PROTECTED_USERS:
            print(f"Refusing to wipe protected user {config.user_id!r}")
            sys.exit(1)
        print("\n" + "#" * 70)
        print(f"# {config.display_name} ({config.user_id})")
        print("#" * 70)
        seed_journey(store, config)

    print("\nCoach Assist learners seeded with distinct libraries.")


if __name__ == "__main__":
    main()

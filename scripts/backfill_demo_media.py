"""Backfill missing local media files for demo-user portfolio entries.

Mongo may reference storage_key paths whose bytes were never copied to the
ECS volume (or a fresh checkout). Downloads Unsplash JPEGs from the seed
manifest and writes them to data/media/{storage_key} so /media URLs work.

Run from repo root: python scripts/backfill_demo_media.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

from app.db import get_db  # noqa: E402
from scripts.seed_demo_user import PHOTOS, _download_photo  # noqa: E402

DEMO_USER = "demo-user"
MEDIA_ROOT = Path("data/media")


def main() -> None:
    db = get_db()
    entries = list(
        db.portfolio_entries.find({"user_id": DEMO_USER}, {"storage_key": 1}).sort("created_at", 1)
    )
    if not entries:
        print("No portfolio entries for demo-user.")
        return

    photos = list(PHOTOS)
    wrote = 0
    skipped = 0

    for idx, doc in enumerate(entries):
        key = doc.get("storage_key")
        if not key:
            continue
        dest = MEDIA_ROOT / key
        if dest.is_file() and dest.stat().st_size > 30_000:
            skipped += 1
            continue
        photo = photos[idx % len(photos)]
        data = _download_photo(photo)
        if not data:
            print(f"  download failed for entry {idx + 1}, key={key}")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        wrote += 1
        print(f"  wrote {dest} ({len(data)} bytes) from {photo.photo_id}")

    print(f"Done: {wrote} written, {skipped} already present, {len(entries)} total entries.")


if __name__ == "__main__":
    main()

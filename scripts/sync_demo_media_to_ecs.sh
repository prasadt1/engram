#!/usr/bin/env bash
# Backfill demo-user media locally (from Atlas storage_key list) and rsync to ECS.
#
# Usage (from repo root):
#   ./scripts/sync_demo_media_to_ecs.sh
#   ENGRAM_ECS_HOST=root@8.222.253.211 ENGRAM_ECS_DIR=/root/engram ./scripts/sync_demo_media_to_ecs.sh
#
# Requires: .venv, MONGODB_URI in .env, SSH access to the ECS host.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${ENGRAM_ECS_HOST:-root@8.222.253.211}"
REMOTE_DIR="${ENGRAM_ECS_DIR:-/root/engram}"

if [[ ! -d .venv ]]; then
  echo "Missing .venv — create and pip install -r requirements.txt first" >&2
  exit 1
fi

echo "→ Backfill local data/media from Atlas portfolio storage_key list"
.venv/bin/python scripts/backfill_demo_media.py

echo "→ Build file list for demo-user portfolio"
FILES="$(.venv/bin/python - <<'PY'
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
from app.db import get_db

db = get_db()
entries = db.portfolio_entries.find({"user_id": "demo-user"}, {"storage_key": 1})
root = Path("data/media")
paths = []
for doc in entries:
    key = doc.get("storage_key")
    if not key:
        continue
    local = root / key
    if not local.is_file():
        print(f"MISSING locally: {key}", flush=True)
        continue
    paths.append(str(local.relative_to(root)))
print("\n".join(paths))
PY
)"

if [[ -z "$FILES" ]]; then
  echo "No demo-user media files to sync." >&2
  exit 1
fi

COUNT="$(echo "$FILES" | wc -l | tr -d ' ')"
echo "→ Rsync $COUNT files to $HOST:$REMOTE_DIR/data/media/"
echo "$FILES" | rsync -avz --files-from=- -e ssh data/media/ "${HOST}:${REMOTE_DIR}/data/media/"

echo "→ Verify prod API imageUrl"
curl -sf "https://engram.prasadtilloo.com/api/v1/portfolio?limit=1&userId=demo-user" \
  | .venv/bin/python -c "import json,sys; e=json.load(sys.stdin)['entries'][0]; u=e.get('imageUrl',''); print('imageUrl:', u or '(empty)'); sys.exit(0 if u else 1)"

echo "Done."

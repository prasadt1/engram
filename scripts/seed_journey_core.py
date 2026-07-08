"""Shared journey seeding — real Qwen-VL critiques with staged dimension scores."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable

import requests

from app.coach import analyze_photo
from app.memory_engine import SkillStatus
from app.memory_store import MemoryStore
from app.storage import get_storage

BAR = 7.0
DIMS = ("composition", "lighting", "technique", "creativity", "subject_impact")


@dataclass
class Photo:
    photo_id: str
    genre: str
    attribution: str
    session: int
    composition_jitter: float = 0.0
    fallback_stub: bool = False


@dataclass
class SupersessionPair:
    old_content: str
    old_days_ago: int
    new_content: str
    new_days_ago: int
    genre: str


@dataclass
class JourneySeedConfig:
    user_id: str
    display_name: str
    photos: list[Photo]
    session_arc: dict[str, list[float]]
    session_days_ago: list[int]
    supersession_pairs: list[SupersessionPair] = field(default_factory=list)
    supersession_importance: float = 0.75
    assert_skills: Callable[[dict[str, object]], None] | None = None


def unsplash_url(photo_id: str) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?w=1200&q=80"


def now() -> datetime:
    return datetime.now(timezone.utc)


def session_datetime(config: JourneySeedConfig, session: int) -> datetime:
    days_ago = config.session_days_ago[session - 1]
    return now() - timedelta(days=days_ago)


def wipe_user(db, user_id: str) -> None:
    print(f"Wiping {user_id!r}...")
    for coll_name, query in [
        ("memory_items", {"user_id": user_id}),
        ("skills", {"user_id": user_id}),
        ("portfolio_entries", {"user_id": user_id}),
        ("assignments", {"user_id": user_id}),
        ("chat_turns", {"user_id": user_id}),
        ("users", {"_id": user_id}),
    ]:
        result = db[coll_name].delete_many(query)
        print(f"  {coll_name}: deleted {result.deleted_count}")


def download_photo(photo: Photo) -> bytes | None:
    url = unsplash_url(photo.photo_id)
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        data = resp.content
        if len(data) < 30_000:
            print(f"  WARNING: {photo.photo_id} only {len(data)} bytes — skipping")
            return None
        ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
        if ctype not in ("image/jpeg", "image/jpg", "image/webp", "image/png"):
            print(f"  WARNING: {photo.photo_id} bad content-type {ctype!r} — skipping")
            return None
        return data
    except requests.RequestException as exc:
        print(f"  WARNING: download failed {photo.photo_id}: {exc}")
        return None


_FALLBACK_CRITIQUE_SUMMARY = (
    "A photograph under review — automated critique unavailable; placeholder summary."
)


class _StubOutput:
    def __init__(self, genre: str):
        self.scene_description = _FALLBACK_CRITIQUE_SUMMARY
        self.colour_notes = None
        self.aesthetic_tags: list[str] = []
        self.genre = genre


def run_real_critique(
    image_bytes: bytes, content_type: str, filename: str, genre_hint: str, stored_key: str,
):
    for attempt in range(2):
        try:
            payload = analyze_photo(image_bytes, content_type, filename, stored_key=stored_key)
            return payload, False
        except Exception as exc:  # noqa: BLE001
            print(f"  critique attempt {attempt + 1} failed: {exc}")
            if attempt == 0:
                time.sleep(2)
    print("  falling back to stub critique")
    stub = _StubOutput(genre_hint)
    return {
        "sceneDescription": stub.scene_description,
        "colourNotes": stub.colour_notes,
        "aestheticTags": stub.aesthetic_tags,
        "genre": stub.genre,
        "glassBox": {"observations": [], "reasoning_steps": [], "priority_fixes": [], "grounding_citations": []},
        "spatialMetadata": {},
    }, True


def clamp_score(value: float) -> float:
    return max(0.0, min(10.0, round(value, 1)))


def seed_sessions(store: MemoryStore, config: JourneySeedConfig) -> dict:
    storage = get_storage()
    session_photo_counts: dict[int, int] = {}
    record_log: list[dict] = []
    user_id = config.user_id

    for idx, photo in enumerate(config.photos, start=1):
        print(f"[{idx}/{len(config.photos)}] session {photo.session} — {photo.genre} ({photo.photo_id}) ...")
        image_bytes = download_photo(photo)
        if image_bytes is None:
            continue

        if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            filename = f"{config.user_id}-{photo.genre}-{photo.photo_id}.png"
            content_type = "image/png"
        elif image_bytes[8:12] == b"WEBP":
            filename = f"{config.user_id}-{photo.genre}-{photo.photo_id}.webp"
            content_type = "image/webp"
        else:
            filename = f"{config.user_id}-{photo.genre}-{photo.photo_id}.jpg"
            content_type = "image/jpeg"
        key = storage.save(image_bytes, filename=filename, content_type=content_type)
        image_url = storage.signed_url(key)

        start = time.monotonic()
        payload, used_fallback = run_real_critique(image_bytes, content_type, filename, photo.genre, key)
        photo.fallback_stub = used_fallback
        print(f"  critique done in {time.monotonic() - start:.1f}s{' (stub)' if used_fallback else ''}")

        session_dt = session_datetime(config, photo.session)
        session_photo_counts[photo.session] = session_photo_counts.get(photo.session, 0)
        stagger = timedelta(minutes=7 * session_photo_counts[photo.session])
        session_photo_counts[photo.session] += 1
        photo_dt = session_dt + stagger

        staged_scores: dict[str, float] = {}
        for dim in DIMS:
            base = config.session_arc[dim][photo.session - 1]
            jitter = photo.composition_jitter if dim == "composition" else photo.composition_jitter * 0.5
            candidate = base + jitter
            if base >= BAR:
                candidate = max(candidate, BAR + 0.05)
            else:
                candidate = min(candidate, BAR - 0.05)
            staged_scores[dim] = clamp_score(candidate)

        genre = payload.get("genre") or photo.genre
        scene_description = payload.get("sceneDescription") or _FALLBACK_CRITIQUE_SUMMARY
        colour_notes = payload.get("colourNotes")
        aesthetic_tags = payload.get("aestheticTags") or []
        glass_box = payload.get("glassBox") or {"observations": [], "reasoning_steps": [], "priority_fixes": []}
        spatial_metadata = payload.get("spatialMetadata") or {}

        is_session_anchor = session_photo_counts[photo.session] == 1
        if is_session_anchor:
            for dim in DIMS:
                session_score = config.session_arc[dim][photo.session - 1]
                skill = store.record_skill_session(
                    user_id=user_id, skill=dim, bar=BAR, score=session_score,
                    evidence_id=key, at=photo_dt,
                )
                record_log.append({
                    "session": photo.session, "dim": dim, "score": session_score,
                    "streak_after": skill.consecutive_above_bar, "status_after": skill.status.value,
                })

        critique = payload.get("critique") or {}
        weak = sorted(((d, s) for d, s in staged_scores.items() if s < BAR), key=lambda pair: pair[1])
        focus = f" — working on {', '.join(f'{d} {s:.1f}' for d, s in weak)}" if weak else ""
        priority_fixes = glass_box.get("priority_fixes") or []
        top_issue = priority_fixes[0].get("issue") if priority_fixes and isinstance(priority_fixes[0], dict) else None
        if top_issue:
            why = f" Key issue: {top_issue}"
        elif weak:
            lowest_dim = weak[0][0]
            critique_text = critique.get(lowest_dim) if lowest_dim in {"composition", "lighting", "technique"} else critique.get("overall")
            why = f" Why: {critique_text}" if critique_text else ""
        else:
            why = ""

        overall_score = sum(staged_scores.values()) / len(staged_scores)
        summary = f"{genre} photo (overall {overall_score:.1f}/10): {scene_description[:120]}{focus}.{why}"
        store.db.memory_items.insert_one({
            "user_id": user_id, "content": summary,
            "importance": 0.75 if weak else 0.55,
            "created_at": photo_dt, "scope": key, "genre": genre,
            "superseded_by": None, "archived": False,
        })

        store.db.portfolio_entries.insert_one({
            "user_id": user_id,
            "storage_key": key,
            "image_url": image_url,
            "scores": staged_scores,
            "genre": genre,
            "aesthetic_tags": aesthetic_tags,
            "scene_description": scene_description,
            "colour_notes": colour_notes,
            "glass_box": glass_box,
            "spatial_metadata": spatial_metadata,
            "created_at": photo_dt,
        })
        print(f"  staged scores: {staged_scores}")

    return {"record_log": record_log}


def seed_supersessions(store: MemoryStore, config: JourneySeedConfig) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    if not config.supersession_pairs:
        return pairs
    print("Seeding supersession pairs...")
    for pair in config.supersession_pairs:
        old_dt = now() - timedelta(days=pair.old_days_ago)
        new_dt = now() - timedelta(days=pair.new_days_ago)
        old_id = store.db.memory_items.insert_one({
            "user_id": config.user_id, "content": pair.old_content,
            "importance": config.supersession_importance,
            "created_at": old_dt, "scope": None, "genre": pair.genre,
            "superseded_by": None, "archived": False,
        }).inserted_id
        new_id = store.db.memory_items.insert_one({
            "user_id": config.user_id, "content": pair.new_content,
            "importance": config.supersession_importance,
            "created_at": new_dt, "scope": None, "genre": pair.genre,
            "superseded_by": None, "archived": False,
        }).inserted_id
        store.db.memory_items.update_one({"_id": old_id}, {"$set": {"superseded_by": str(new_id)}})
        pairs.append((pair.old_content, pair.new_content))
        print(f"  retired: {pair.old_content!r} -> {pair.new_content!r}")
    return pairs


def print_summary(store: MemoryStore, config: JourneySeedConfig, record_log: list[dict], supersession_pairs: list[tuple[str, str]]) -> None:
    user_id = config.user_id
    print("\n" + "=" * 70)
    print(f"SEED SUMMARY — {user_id!r} ({config.display_name})")
    print("=" * 70)
    n_sessions = len({p.session for p in config.photos})
    n_fallback = sum(1 for p in config.photos if p.fallback_stub)
    print(f"Sessions: {n_sessions}")
    print(f"Photos attempted: {len(config.photos)} (stubs: {n_fallback})")
    print(f"Memory items: {store.db.memory_items.count_documents({'user_id': user_id})}")
    print(f"Portfolio entries: {store.db.portfolio_entries.count_documents({'user_id': user_id})}")
    print(f"Supersession pairs: {len(supersession_pairs)}")

    skills = store.list_skills(user_id=user_id)
    by_name = {s.name: s for s in skills}
    print("\nSkills state:")
    for dim in DIMS:
        s = by_name.get(dim)
        if s is None:
            print(f"  {dim}: MISSING")
            continue
        print(f"  {dim}: status={s.status.value} streak={s.consecutive_above_bar}")

    if config.assert_skills:
        config.assert_skills(by_name)
        print("\nHARD ASSERTS PASSED.")


def seed_journey(store: MemoryStore, config: JourneySeedConfig) -> None:
    wipe_user(store.db, config.user_id)
    n_sessions = len({p.session for p in config.photos})
    print(f"\nSeeding {len(config.photos)} photos / {n_sessions} sessions for {config.user_id!r} ...")
    print("(real Qwen-VL per photo — expect several minutes)\n")
    result = seed_sessions(store, config)
    supersession_pairs = seed_supersessions(store, config)
    print_summary(store, config, result["record_log"], supersession_pairs)

    store.db.users.update_one(
        {"_id": config.user_id},
        {"$set": {"displayName": config.display_name, "persona": "hobbyist"}},
        upsert=True,
    )

    from app.assignments import propose_assignment

    proposed = propose_assignment(store, user_id=config.user_id, use_llm=False)
    print(f"Proposed assignment: {proposed.get('targetSkill')} — {proposed.get('brief', '')[:80]}...")

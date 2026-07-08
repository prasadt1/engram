"""Seed `demo-user` with a scripted, multi-week photography journey.

This is the demo/judge fixture: five shoot-sessions across ~3 weeks, real
Qwen-VL critiques (authentic scene descriptions / critique prose / genre /
tags) with STAGED per-dimension scores overridden before persistence, so
that composition graduates ("cleared") on the last session while lighting
sits one streak short ("watching", 2) — the Act-3 moment the demo video and
judge click-through are built around.

Run:  python scripts/seed_demo_user.py
      (from repo root, with .venv activated; needs DASHSCOPE_API_KEY +
      MONGODB_URI in .env — this seeds the real dev Atlas `engram` db,
      which IS the demo db)

Idempotent: wipes demo-user's existing docs across memory_items, skills,
portfolio_entries, assignments, chat_turns, and users FIRST (scoped to
user_id == "demo-user" only — never touches other users, e.g. e2e-prasad),
then rebuilds from scratch. Safe to re-run.

--- Manifest -----------------------------------------------------------
(url, attribution, intended genre, session#, staged composition score)

Attribution note: Unsplash's license does not require attribution, but it
is good practice. Photographer usernames could not be reliably resolved
without the Unsplash API (no application ID configured for this hackathon;
scraping unslug'd photo-ID URLs 404s since Unsplash's canonical URLs
require a title slug). Attribution strings below therefore credit
"Unsplash contributor" with the verifiable photo ID + a direct source URL,
rather than fabricate a photographer name — see docs/SEED_ATTRIBUTIONS.md.

Every photo ID below was verified by direct download (HTTP 200, JPEG,
>30KB) before being locked into this manifest; see the comment above PHOTOS
for the (small) set of IDs that were tried and swapped out for 404s (or
turned out not to match their intended genre) during manifest construction.
"""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from app.coach import analyze_photo  # noqa: E402
from app.db import get_db  # noqa: E402
from app.memory_engine import SkillStatus  # noqa: E402
from app.memory_store import MemoryStore  # noqa: E402
from app.storage import get_storage  # noqa: E402

DEMO_USER = "demo-user"
BAR = 7.0
DIMS = ("composition", "lighting", "technique", "creativity", "subject_impact")


def _unsplash_url(photo_id: str) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?w=1200&q=80"


@dataclass
class Photo:
    photo_id: str
    genre: str
    attribution: str
    session: int  # 1-5
    # per-photo score jitter around the session's staged arc value, applied
    # only to composition (the dimension under hard-assert / the one with a
    # bar-crossing script) — keeps portfolio/trends visually natural without
    # ever letting an individual photo cross 7.0 in the wrong direction for
    # its session. 0.0 = no jitter (used for the session's "anchor" photo).
    composition_jitter: float = 0.0
    fallback_stub: bool = False  # marked True if the real critique failed and a stub was substituted


# --- Manifest ------------------------------------------------------------
# Sessions run days -21, -16, -11, -6, -2 from "now" (script run time).
# Staged composition arc (session-level, drives the graduation streak):
#   S1=5.5 S2=6.0 S3=7.5 S4=8.0 S5=8.5  -> below,below,above,above,above
#   -> 3 consecutive above-bar sessions (S3,S4,S5) -> CLEARS on session 5.
# Staged lighting arc: S1=5.5 S2=6.5 S3=6.8 S4=7.2 S5=7.6
#   -> below,below,below,above,above -> streak 2, still WATCHING (one
#   session away from clearing -> "Current focus" on the Journey UI).
# Staged creativity arc: S1=6.0 S2=7.5 S3=5.5 S4=6.8 S5=7.3
#   -> above,below,below,above -> streak resets keep it at streak 0-1,
#   WATCHING throughout (never strings 3 in a row).
# Staged technique / subject_impact: middling, stable, always below bar —
# no drama, no streak, WATCHING at streak 0 the whole time.
SESSION_ARC: dict[str, list[float]] = {
    "composition": [5.5, 6.0, 7.5, 8.0, 8.5],
    "lighting": [5.5, 6.5, 6.8, 7.2, 7.6],
    "creativity": [6.0, 7.5, 5.5, 6.8, 7.3],
    "technique": [6.5, 6.8, 6.2, 6.9, 6.6],
    "subject_impact": [6.6, 6.4, 6.9, 6.3, 6.7],
}
SESSION_DAYS_AGO = [21, 16, 11, 6, 2]

# Every ID below was fetched and verified (HTTP 200, JPEG, > 30KB) while
# building this manifest. Two IDs that 404'd during manifest construction
# ("1524634126442-357e0eda3fdb" for still_life, and an Apple Watch product
# shot "1544117519-31a4b719223d" that turned out NOT to be a portrait once
# inspected) were dropped and substituted below — see the self-review notes
# in docs/SEED_ATTRIBUTIONS.md.
PHOTOS: list[Photo] = [
    # --- Session 1 (day -21): establishing shots, weakest session ---------
    Photo("1470252649378-9c29740c9fa8", "landscape", "Unsplash contributor — misty field at sunrise, horizon line", 1, -0.2),
    Photo("1441974231531-c6227db76b6e", "landscape", "Unsplash contributor — forest path with sunbeams", 1, 0.1),
    Photo("1500648767791-00dcc994a43e", "portrait", "Unsplash contributor — outdoor portrait, natural light", 1, 0.0),

    # --- Session 2 (day -16): still below bar on composition --------------
    Photo("1518837695005-2083093ee35b", "landscape", "Unsplash contributor — close-up ocean wave, clean horizon", 2, -0.1),
    Photo("1490474418585-ba9bad8fd0ea", "still_life", "Unsplash contributor — breakfast bowl flatlay with flowers", 2, 0.2),
    Photo("1531123897727-8f129e1688ce", "portrait", "Unsplash contributor — close-up studio portrait", 2, 0.0),
    Photo("1486406146926-c627a92ad1ab", "architecture", "Unsplash contributor — skyscrapers from street level", 2, -0.2),

    # --- Session 3 (day -11): composition crosses the bar (streak 1) ------
    Photo("1506905925346-21bda4d32df4", "landscape", "Unsplash contributor — mountains above cloud sea, sunrise, horizon", 3, 0.2),
    Photo("1449824913935-59a10b8d2000", "architecture", "Unsplash contributor — city avenue, converging perspective", 3, -0.1),
    Photo("1490645935967-10de6ba17061", "still_life", "Unsplash contributor — sliced fruit platter", 3, 0.1),

    # --- Session 4 (day -6): composition streak 2 --------------------------
    Photo("1447752875215-b2761acb3c5d", "landscape", "Unsplash contributor — footbridge through dense forest", 4, 0.1),
    Photo("1607746882042-944635dfe10e", "portrait", "Unsplash contributor — natural light portrait, dark background", 4, -0.1),
    Photo("1449034446853-66c86144b0ad", "architecture", "Unsplash contributor — angular museum facade against sky", 4, 0.0),

    # --- Session 5 (day -2): composition streak 3 -> CLEARS ----------------
    Photo("1470071459604-3b5ec3a7fe05", "landscape", "Unsplash contributor — highland valley with road, horizon skyline", 5, 0.2),
    Photo("1512621776951-a57141f2eefd", "still_life", "Unsplash contributor — colourful vegetable bowl on wood table", 5, -0.1),
    Photo("1517841905240-472988babdf9", "portrait", "Unsplash contributor — candid street-style portrait", 5, 0.1),
]

assert len(PHOTOS) == 16, f"expected 16 photos, got {len(PHOTOS)}"
_genre_counts: dict[str, int] = {}
for p in PHOTOS:
    _genre_counts[p.genre] = _genre_counts.get(p.genre, 0) + 1
assert _genre_counts == {"landscape": 6, "portrait": 4, "still_life": 3, "architecture": 3}, _genre_counts

# Supersession pairs (the forgetting demo): (old_content, old_day_ago, new_content, new_day_ago, genre)
#
# Dates and importance were tuned (not the task's original day -18/-8/-14/-5
# suggestion) after discovering that recall_scored's top-k-then-filter
# retrieval (context_builder.build_memory_context, k=8) means a superseded
# item only shows up in a receipt's retired_excluded row if it makes the
# combined top-8-by-salience cut BEFORE the liveness filter runs — salience
# = importance * recency_decay * relevance. At the original day -18/-14
# ages and importance=0.6, these two memories were consistently crowded out
# by the 16 fresher (2-21 day old, importance 0.75) photo memories for
# every query tried, so the "Retired" row never actually appeared even
# though the docs and linkage were correct in the db. Moving the dates
# closer to "now" (still narratively mid-timeline, between shoot sessions)
# and raising importance to 0.75 (matching the "consequential to recall"
# tier coach.py already uses for weak-dimension photos — a stated
# preference change is at least as consequential) gets both pairs
# competitive enough to actually surface for on-topic questions. Verified
# empirically (see the session notes) before locking these values in.
SUPERSESSION_PAIRS = [
    (
        "prefers shooting landscapes at midday for even light",
        9,
        "switched to golden-hour sessions for warmer, more directional light",
        4,
        "landscape",
    ),
    (
        "relies on the kit zoom for most portrait work",
        7,
        "invested in a fast 85mm prime for portrait separation",
        3,
        "portrait",
    ),
]
SUPERSESSION_IMPORTANCE = 0.75


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _session_datetime(session: int) -> datetime:
    days_ago = SESSION_DAYS_AGO[session - 1]
    # spread photos within a session across a plausible shoot window (a few
    # minutes apart) rather than identical timestamps, purely for realistic
    # created_at ordering within a session.
    return _now() - timedelta(days=days_ago)


def wipe_demo_user() -> None:
    db = get_db()
    print(f"Wiping existing demo-user ({DEMO_USER!r}) docs...")
    for coll_name, query in [
        ("memory_items", {"user_id": DEMO_USER}),
        ("skills", {"user_id": DEMO_USER}),
        ("portfolio_entries", {"user_id": DEMO_USER}),
        ("assignments", {"user_id": DEMO_USER}),
        ("chat_turns", {"user_id": DEMO_USER}),
        ("users", {"_id": DEMO_USER}),
    ]:
        result = db[coll_name].delete_many(query)
        print(f"  {coll_name}: deleted {result.deleted_count}")


def _download_photo(photo: Photo) -> bytes | None:
    url = _unsplash_url(photo.photo_id)
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        data = resp.content
        if len(data) < 30_000:
            print(f"  WARNING: {photo.photo_id} downloaded but is only {len(data)} bytes (<30KB) — skipping")
            return None
        if resp.headers.get("content-type", "").split(";")[0].strip() not in ("image/jpeg", "image/jpg"):
            print(f"  WARNING: {photo.photo_id} content-type={resp.headers.get('content-type')!r} — skipping")
            return None
        return data
    except requests.RequestException as exc:
        print(f"  WARNING: failed to download {photo.photo_id}: {exc}")
        return None


_FALLBACK_CRITIQUE_SUMMARY = "A photograph under review — the automated critique could not be generated for this frame after retries, so this is a placeholder summary."


class _StubOutput:
    """Minimal stand-in matching the bits of CoachAnalysisOutput consumed
    below, used only if the real Qwen critique fails after one retry."""

    def __init__(self, genre: str):
        self.scene_description = _FALLBACK_CRITIQUE_SUMMARY
        self.colour_notes = None
        self.aesthetic_tags: list[str] = []
        self.genre = genre


def _run_real_critique(image_bytes: bytes, content_type: str, filename: str, genre_hint: str, stored_key: str):
    """Call the REAL Coach pipeline for authentic text (no memory_store ->
    pure critique, no persistence, no receipt) — retry once on failure,
    then fall back to a stub so one bad photo can't kill the whole seed.

    stored_key: the seed script already saved the bytes via get_storage()
    before calling in (mirroring the real /api/v1/analyze-photo route's own
    pattern — see coach.py's stored_key docstring), so analyze_photo skips
    its own internal save and we don't end up with two copies of every
    photo on disk (one from analyze_photo, one from the seed script)."""
    for attempt in range(2):
        try:
            payload = analyze_photo(image_bytes, content_type, filename, stored_key=stored_key)
            return payload, False
        except Exception as exc:  # noqa: BLE001 - deliberately broad: seed script must not die on one photo
            print(f"  critique attempt {attempt + 1} failed: {exc}")
            if attempt == 0:
                time.sleep(2)
                continue
    print("  falling back to stub critique text for this photo")
    stub = _StubOutput(genre_hint)
    payload = {
        "sceneDescription": stub.scene_description,
        "colourNotes": stub.colour_notes,
        "aestheticTags": stub.aesthetic_tags,
        "genre": stub.genre,
        "glassBox": {"observations": [], "reasoning_steps": [], "priority_fixes": [], "grounding_citations": []},
        "spatialMetadata": {},
    }
    return payload, True


def _clamp_score(value: float) -> float:
    return max(0.0, min(10.0, round(value, 1)))


def seed_sessions(store: MemoryStore) -> dict:
    """Real critique per photo, staged scores per the arc. Returns a
    per-session record of the exact scores passed to record_skill_session,
    for the closing summary printout."""
    storage = get_storage()
    session_photo_counts: dict[int, int] = {}
    record_log: list[dict] = []

    for idx, photo in enumerate(PHOTOS, start=1):
        print(f"[{idx}/{len(PHOTOS)}] session {photo.session} — {photo.genre} ({photo.photo_id}) ...")
        image_bytes = _download_photo(photo)
        if image_bytes is None:
            print("  SKIPPED (download failed) — no substitute available at seed time, continuing")
            continue

        filename = f"{photo.genre}-{photo.photo_id}.jpg"
        content_type = "image/jpeg"

        # Save BEFORE critique (mirrors the real /api/v1/analyze-photo
        # route) so analyze_photo's stored_key= skips its own internal
        # save — one file per photo, not two.
        key = storage.save(image_bytes, filename=filename, content_type=content_type)
        image_url = storage.signed_url(key)

        start = time.monotonic()
        payload, used_fallback = _run_real_critique(image_bytes, content_type, filename, photo.genre, key)
        photo.fallback_stub = used_fallback
        elapsed = time.monotonic() - start
        print(f"  critique done in {elapsed:.1f}s{' (STUB fallback)' if used_fallback else ''}")

        session_dt = _session_datetime(photo.session)
        # stagger photos within the same session by a few minutes so
        # created_at ordering within a session is realistic, not identical
        session_photo_counts[photo.session] = session_photo_counts.get(photo.session, 0)
        stagger = timedelta(minutes=7 * session_photo_counts[photo.session])
        session_photo_counts[photo.session] += 1
        photo_dt = session_dt + stagger

        # Staged per-photo scores: the session's arc value for every
        # dimension, with the composition jitter applied ONLY to
        # composition (the dimension under the hard-assert / bar-crossing
        # script) — clamped so it can never cross 7.0 the wrong way for
        # that session's stage. Other dimensions get a small fixed jitter
        # too, purely for portfolio/trends visual realism, using the same
        # clamp-to-session-side rule.
        staged_scores: dict[str, float] = {}
        for dim in DIMS:
            base = SESSION_ARC[dim][photo.session - 1]
            jitter = photo.composition_jitter if dim == "composition" else photo.composition_jitter * 0.5
            candidate = base + jitter
            # never let jitter cross the bar in the wrong direction relative
            # to the session's staged side
            if base >= BAR:
                candidate = max(candidate, BAR + 0.05)
            else:
                candidate = min(candidate, BAR - 0.05)
            staged_scores[dim] = _clamp_score(candidate)

        genre = payload.get("genre") or photo.genre
        scene_description = payload.get("sceneDescription") or _FALLBACK_CRITIQUE_SUMMARY
        colour_notes = payload.get("colourNotes")
        aesthetic_tags = payload.get("aestheticTags") or []
        glass_box = payload.get("glassBox") or {"observations": [], "reasoning_steps": [], "priority_fixes": []}
        spatial_metadata = payload.get("spatialMetadata") or {}

        # --- persist skill sessions -----------------------------------
        # ONE record_skill_session call per dimension PER SHOOT-SESSION
        # (not per photo): analyze_photo's real per-photo call would
        # increment the streak once per photo, which would clear
        # composition mid-way through session 3 (which has multiple
        # photos) instead of on session 5 as scripted. So the streak-
        # driving call happens once per session, using the session's
        # anchor photo (the first photo processed in that session); every
        # other photo in the session still gets its own critique, memory
        # item, and portfolio entry (with jittered scores) for portfolio/
        # trends realism, it just doesn't re-drive the graduation streak.
        is_session_anchor = session_photo_counts[photo.session] == 1
        if is_session_anchor:
            for dim in DIMS:
                session_score = SESSION_ARC[dim][photo.session - 1]
                skill = store.record_skill_session(
                    user_id=DEMO_USER, skill=dim, bar=BAR, score=session_score,
                    evidence_id=key, at=photo_dt,
                )
                record_log.append({
                    "session": photo.session, "dim": dim, "score": session_score,
                    "streak_after": skill.consecutive_above_bar, "status_after": skill.status.value,
                })

        # --- memory item (mirrors write_memory's shape, backdated) -----
        # Same grounding logic as coach.py's own write_memory call: dimension
        # scores plus a concrete "why" (top priority fix, or critique prose
        # for the weakest dimension), not just dimension names — otherwise a
        # photo-scoped "why is this rated low?" has nothing real to answer
        # from, seeded demo photos included.
        critique = payload.get("critique") or {}
        critique_dims = {"composition", "lighting", "technique"}
        weak = sorted(
            ((d, s) for d, s in staged_scores.items() if s < BAR),
            key=lambda pair: pair[1],
        )
        focus = f" — working on {', '.join(f'{d} {s:.1f}' for d, s in weak)}" if weak else ""

        priority_fixes = glass_box.get("priority_fixes") or []
        top_issue = priority_fixes[0].get("issue") if priority_fixes and isinstance(priority_fixes[0], dict) else None
        if top_issue:
            why = f" Key issue: {top_issue}"
        elif weak:
            lowest_dim = weak[0][0]
            critique_text = critique.get(lowest_dim) if lowest_dim in critique_dims else critique.get("overall")
            why = f" Why: {critique_text}" if critique_text else ""
        else:
            why = ""

        overall_score = sum(staged_scores.values()) / len(staged_scores)
        summary = f"{genre} photo (overall {overall_score:.1f}/10): {scene_description[:120]}{focus}.{why}"
        store.db.memory_items.insert_one({
            "user_id": DEMO_USER, "content": summary,
            "importance": 0.75 if weak else 0.55,
            "created_at": photo_dt, "scope": key, "genre": genre,
            "superseded_by": None, "archived": False,
        })

        # --- portfolio entry (mirrors coach.py's insert shape exactly) --
        store.db.portfolio_entries.insert_one({
            "user_id": DEMO_USER,
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


def seed_supersessions(store: MemoryStore) -> list[tuple[str, str]]:
    """Direct db inserts with superseded_by linkage, backdated — mirrors
    supersede_memory()'s semantics, but that method doesn't accept a
    backdated `at`, so we build both docs by hand here instead of calling it."""
    print("Seeding supersession pairs...")
    pairs: list[tuple[str, str]] = []
    for old_content, old_days_ago, new_content, new_days_ago, genre in SUPERSESSION_PAIRS:
        old_dt = _now() - timedelta(days=old_days_ago)
        new_dt = _now() - timedelta(days=new_days_ago)

        old_doc = {
            "user_id": DEMO_USER, "content": old_content, "importance": SUPERSESSION_IMPORTANCE,
            "created_at": old_dt, "scope": None, "genre": genre,
            "superseded_by": None, "archived": False,
        }
        old_id = store.db.memory_items.insert_one(old_doc).inserted_id

        new_doc = {
            "user_id": DEMO_USER, "content": new_content, "importance": SUPERSESSION_IMPORTANCE,
            "created_at": new_dt, "scope": None, "genre": genre,
            "superseded_by": None, "archived": False,
        }
        new_id = store.db.memory_items.insert_one(new_doc).inserted_id

        store.db.memory_items.update_one({"_id": old_id}, {"$set": {"superseded_by": str(new_id)}})
        pairs.append((old_content, new_content))
        print(f"  retired: {old_content!r} -> {new_content!r}")

    return pairs


def print_summary(store: MemoryStore, record_log: list[dict], supersession_pairs: list[tuple[str, str]]) -> None:
    print("\n" + "=" * 70)
    print("SEED SUMMARY")
    print("=" * 70)

    n_sessions = len({p.session for p in PHOTOS})
    n_fallback = sum(1 for p in PHOTOS if p.fallback_stub)
    print(f"Sessions: {n_sessions}")
    print(f"Photos attempted: {len(PHOTOS)} (fallback-stub critiques: {n_fallback})")

    mem_count = store.db.memory_items.count_documents({"user_id": DEMO_USER})
    portfolio_count = store.db.portfolio_entries.count_documents({"user_id": DEMO_USER})
    print(f"Memory items: {mem_count}")
    print(f"Portfolio entries: {portfolio_count}")
    print(f"Supersession pairs: {len(supersession_pairs)}")
    for old_c, new_c in supersession_pairs:
        print(f"  - {old_c!r} -> {new_c!r}")

    print("\nSkills state:")
    skills = store.list_skills(user_id=DEMO_USER)
    by_name = {s.name: s for s in skills}
    for dim in DIMS:
        s = by_name.get(dim)
        if s is None:
            print(f"  {dim}: MISSING")
            continue
        print(f"  {dim}: status={s.status.value} streak={s.consecutive_above_bar} evidence_count={len(s.evidence_ids)}")

    print("\nRecord log (session-level record_skill_session calls):")
    for entry in record_log:
        print(f"  S{entry['session']} {entry['dim']}: score={entry['score']} -> streak={entry['streak_after']} status={entry['status_after']}")

    # --- HARD ASSERTS: a broken arc must fail loudly, not silently -------
    composition = by_name.get("composition")
    lighting = by_name.get("lighting")
    assert composition is not None, "composition skill missing entirely"
    assert composition.status == SkillStatus.CLEARED, (
        f"composition did not graduate: status={composition.status.value} streak={composition.consecutive_above_bar}"
    )
    assert lighting is not None, "lighting skill missing entirely"
    assert lighting.status == SkillStatus.WATCHING, (
        f"lighting should still be watching: status={lighting.status.value}"
    )
    assert lighting.consecutive_above_bar == 2, (
        f"lighting streak should be exactly 2 (one session from clearing): got {lighting.consecutive_above_bar}"
    )
    print("\nHARD ASSERTS PASSED: composition CLEARED, lighting WATCHING streak=2.")


def main() -> None:
    db = get_db()
    store = MemoryStore(db=db)

    wipe_demo_user()

    print(f"\nSeeding {len(PHOTOS)} photos across {len({p.session for p in PHOTOS})} sessions for {DEMO_USER!r}...")
    print("(this calls the real Qwen-VL pipeline per photo — expect ~15-25 min total)\n")

    result = seed_sessions(store)
    supersession_pairs = seed_supersessions(store)

    print_summary(store, result["record_log"], supersession_pairs)


if __name__ == "__main__":
    main()

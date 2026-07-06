"""Engram FastAPI app.

Exposes coach / mentor / reflection / memory_store over the EXACT wire
format the reused Iris frontend already speaks (see mentorClient.ts /
agentClient.ts): camelCase JSON keys, `image` as the upload field name,
and a response shape that's additive-only over what Iris already expects
(memoryReceipt is the new key).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from openai import APIStatusError, APITimeoutError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

load_dotenv()

from app.coach import analyze_photo  # noqa: E402
from app.db import get_db  # noqa: E402
from app.identity import build_identity_line  # noqa: E402
from app.mentor import chat as mentor_chat  # noqa: E402
from app.mentor import chat_stream as mentor_chat_stream  # noqa: E402
from app.memory_engine import SkillStatus, compute_delta  # noqa: E402
from app.memory_store import GENRE_SEARCH_SYNONYMS, MemoryStore  # noqa: E402
from app.reflection import summarize_progress  # noqa: E402
from app.storage import get_storage  # noqa: E402

logger = logging.getLogger(__name__)
# Startup messages go through uvicorn's configured logger so they actually
# show up in uvicorn/container logs — the app's own logger has no handler
# configured at INFO, so lifespan messages were invisible on deploy day.
boot_logger = logging.getLogger("uvicorn.error")

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Do the connectivity check HERE (at startup) rather than lazily on
    # first request, so requests never carry db.py's 15s server-selection
    # timeout tail latency if Mongo is unreachable — fail fast at boot instead.
    if os.environ.get("MONGODB_URI"):
        db = get_db()
        db.client.admin.command("ping")
        db.memory_items.create_index([("user_id", 1)])
        db.skills.create_index([("user_id", 1)])
        boot_logger.info("Mongo reachable; indexes ensured")
    else:
        boot_logger.warning("MONGODB_URI not set — skipping startup DB check (dev/test mode)")
    yield


app = FastAPI(title="Engram API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(APIStatusError)
async def _model_unavailable(request, exc):
    logger.warning("upstream model error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "The photography model is temporarily unavailable. Your photo was saved — please try again."})


@app.exception_handler(APITimeoutError)
async def _model_timeout(request, exc):
    logger.warning("upstream model timeout: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "The photography model took too long to respond. Please try again."})


@app.exception_handler(ValidationError)
@app.exception_handler(ValueError)
async def _bad_model_output(request, exc):
    # current sources of these are model-OUTPUT failures (unrepairable JSON /
    # shape mismatch) — if a future task adds input validation, revisit this mapping
    logger.warning("model output unusable: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "We couldn't read the analysis this time. Your photo was saved — please try again."})

# Local dev/test storage serves photo bytes back out at /media (see
# storage.LocalDiskStorage.signed_url). OSS is a private bucket with
# presigned URLs, so nothing to mount in that case.
if os.environ.get("STORAGE_BACKEND", "local") != "oss":
    os.makedirs("data/media", exist_ok=True)
    app.mount("/media", StaticFiles(directory="data/media"), name="media")


def _store() -> MemoryStore:
    return MemoryStore(db=get_db())


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# --- Users/me routes (persona + display name persistence) -----------------
# Mirrors Iris's app/memory/users.py::get_user_profile / set_persona wire
# contract — { userId, persona, preferences } — see
# frontend/src/services/userClient.ts::UserProfile, extended additively with
# an optional displayName (Home greets by name when set). The frontend calls
# GET on every boot (App.tsx, up to 3x: userMode sync, onboarding-complete
# check, and again after auth.userId stabilises) and PATCH on persona
# selection (OnboardingScreen / SettingsTab) or name save (SettingsTab).

VALID_PERSONAS = ("hobbyist", "working_pro", "vision_impairment")

MAX_DISPLAY_NAME_LEN = 80


class UserUpdate(BaseModel):
    """PATCH body: each field is optional and only applied when present, so
    a persona switch never touches the name and vice versa."""

    model_config = ConfigDict(populate_by_name=True)
    persona: str | None = None
    display_name: str | None = Field(default=None, alias="displayName")
    user_id: str | None = Field(default=None, alias="userId")


@app.get("/api/v1/users/me")
def users_me(
    user_id: str | None = Query(default=None, alias="userId"),
    x_user_id: str = Header(default="demo-user"),
) -> dict:
    """?userId= query param (this is what userClient.ts::fetchUserProfile
    actually sends for signed-in users — note Iris's own route declares a
    bare `user_id` param with no alias, so this same mismatch exists
    upstream too; fixed here via the alias rather than faithfully
    reproducing it) wins over the X-User-Id header when both are present,
    matching every other route's X-User-Id-as-fallback convention here."""
    uid = user_id or x_user_id
    doc = _store().db.users.find_one({"_id": uid})
    if not doc:
        # No user doc yet: return the default shape rather than 404 — the
        # frontend's first-boot GET (before onboarding/persona selection)
        # must never error, same tolerance as the portfolio read routes.
        return {"userId": uid, "persona": "hobbyist", "preferences": {}, "displayName": None}
    return {
        "userId": uid,
        "persona": doc.get("persona") or "hobbyist",
        "preferences": doc.get("preferences") or {},
        # .get() is deliberate: user docs written before displayName existed
        # simply return null here, no migration needed.
        "displayName": doc.get("displayName"),
    }


@app.patch("/api/v1/users/me")
def users_me_patch(body: UserUpdate, x_user_id: str = Header(default="demo-user")) -> dict:
    uid = body.user_id or x_user_id
    updates: dict[str, Any] = {}
    # Response echoes only the fields this PATCH actually set — the persona
    # switcher's existing contract ({userId, persona}) stays byte-identical.
    response: dict[str, Any] = {"userId": uid}

    if "persona" in body.model_fields_set:
        if body.persona not in VALID_PERSONAS:
            raise HTTPException(status_code=400, detail=f"persona must be one of {VALID_PERSONAS}")
        updates["persona"] = body.persona
        updates["preferences.onboardingComplete"] = True
        response["persona"] = body.persona

    if "display_name" in body.model_fields_set:
        name = (body.display_name or "").strip() or None
        if name and len(name) > MAX_DISPLAY_NAME_LEN:
            raise HTTPException(
                status_code=400,
                detail=f"displayName must be {MAX_DISPLAY_NAME_LEN} characters or fewer",
            )
        updates["displayName"] = name  # blank/whitespace clears the name
        response["displayName"] = name

    if not updates:
        raise HTTPException(status_code=400, detail="provide persona and/or displayName to update")

    _store().db.users.update_one({"_id": uid}, {"$set": updates}, upsert=True)
    return response


# --- Portfolio read routes (Task 13b) ------------------------------------
# Mirrors the wire contract of Iris's app/memory/portfolio.py + trends.py
# (see frontend/src/services/memoryClient.ts and types/memory.ts).
# HomeTab.tsx calls fetchPortfolioStats() and fetchPortfolio(...) in a
# Promise.all with NO .catch, so these two must never 404/500 for a valid user.

_SCORE_DIMS = ("composition", "lighting", "technique", "creativity", "subject_impact")

# Frontend SortField values (memoryClient.ts) -> the doc field(s) they sort on.
_SORT_FIELDS = {
    "date": "created_at",
    "composition": "scores.composition",
    "lighting": "scores.lighting",
    "technique": "scores.technique",
    "creativity": "scores.creativity",
    "subject_impact": "scores.subject_impact",
    # "score" is handled specially below (computed average, not a stored field)
}


def _avg_score(scores: dict[str, Any]) -> float:
    vals = [float(scores[k]) for k in _SCORE_DIMS if scores.get(k) is not None]
    return sum(vals) / len(vals) if vals else 0.0


def _portfolio_image_url(doc: dict[str, Any]) -> str:
    """Signed/read URL when bytes exist; empty when storage_key points at a missing object."""
    storage_key = doc.get("storage_key")
    if storage_key:
        storage = get_storage()
        if not storage.exists(storage_key):
            return ""
        return storage.signed_url(storage_key)
    return doc.get("image_url") or ""


def _portfolio_entry_has_media(doc: dict[str, Any]) -> bool:
    storage_key = doc.get("storage_key")
    if storage_key:
        return get_storage().exists(storage_key)
    return bool((doc.get("image_url") or "").strip())


def _serialize_portfolio_entry(doc: dict[str, Any]) -> dict[str, Any]:
    """doc (as written by app.coach.analyze_photo) -> PortfolioListItem
    (frontend/src/types/memory.ts). imageUrl is computed HERE via
    get_storage().signed_url() rather than trusted from the stored
    image_url field, since OSS-signed URLs expire."""
    scores = doc.get("scores") or {}
    created = doc.get("created_at")
    created_iso = created.isoformat() if isinstance(created, datetime) else (str(created) if created else "")

    storage_key = doc.get("storage_key")
    image_url = _portfolio_image_url(doc)

    return {
        "id": str(doc["_id"]),
        "userId": str(doc.get("user_id", "")),
        "shootId": str(doc.get("shoot_id", "")),
        "imageUrl": image_url,
        # The chat route scopes photo-specific memory by this exact key
        # (agent/chat's photo_id -> mentor.chat's scope= -> memory_store.recall
        # scope filter, matching what app.coach.analyze_photo wrote as the
        # memory's scope). PhotoDetailView.tsx sends it back as photoId so the
        # split-view chat only recalls memories tied to the photo on screen.
        "storageKey": storage_key,
        "createdAt": created_iso,
        "scores": scores,
        "overallAverage": round(_avg_score(scores), 1),
        "aestheticTags": doc.get("aesthetic_tags") or [],
        "userTags": doc.get("user_tags") or [],
        "sceneDescription": doc.get("scene_description"),
        "colourNotes": doc.get("colour_notes"),
        "genre": doc.get("genre"),
        "glassBoxSummary": (doc.get("glass_box") or {}).get("observations", [])[:2],
        "groundingCitations": (doc.get("glass_box") or {}).get("grounding_citations") or [],
        "groundingPrinciples": (doc.get("glass_box") or {}).get("grounding_principles") or [],
        "memoryUpdate": doc.get("memory_update"),
    }


@app.get("/api/v1/portfolio")
def portfolio_list(
    limit: int = 48,
    sort_by: str = "date",
    sort_order: str = "desc",
    user_tag: str | None = None,
    x_user_id: str = Header(default="demo-user"),
) -> dict:
    """PortfolioListResponse { entries, total } — matches memoryClient.ts's
    fetchPortfolio(), which sends query params sort_by/sort_order (snake_case
    on the wire, even though the TS-side option keys are sortBy/sortOrder)
    plus limit and user_tag. See FetchPortfolioOptions in memoryClient.ts."""
    query: dict[str, Any] = {"user_id": x_user_id}
    if user_tag:
        query["user_tags"] = user_tag

    coll = _store().db.portfolio_entries
    capped_limit = max(1, min(limit, 100))
    direction = 1 if sort_order.lower() == "asc" else -1

    if sort_by == "score":
        # overallAverage is computed, not a stored field — sort in Python
        # (demo scale; an aggregation $avg pipeline is the Mongo-native
        # equivalent Iris uses, but this collection is small per user).
        docs = list(coll.find(query))
        docs.sort(key=lambda d: _avg_score(d.get("scores") or {}), reverse=(direction == -1))
        docs = docs[:capped_limit]
    else:
        sort_field = _SORT_FIELDS.get(sort_by, "created_at")
        docs = list(coll.find(query).sort(sort_field, direction).limit(capped_limit))

    entries = [_serialize_portfolio_entry(d) for d in docs]
    total = coll.count_documents(query)
    return {"entries": entries, "total": total}


@app.get("/api/v1/portfolio/stats")
def portfolio_stats(x_user_id: str = Header(default="demo-user")) -> dict:
    """PortfolioStats { total, firstUpload, strongest } (types/memory.ts)."""
    query = {"user_id": x_user_id}
    coll = _store().db.portfolio_entries

    total = coll.count_documents(query)

    first_upload = None
    first_doc = coll.find_one(query, sort=[("created_at", 1)])
    if first_doc and isinstance(first_doc.get("created_at"), datetime):
        first_upload = first_doc["created_at"].strftime("%b %Y")

    strongest = None
    docs = list(coll.find(query))
    media_docs = [d for d in docs if _portfolio_entry_has_media(d)]
    if media_docs:
        best = max(media_docs, key=lambda d: _avg_score(d.get("scores") or {}))
        strongest = _serialize_portfolio_entry(best)

    return {"total": total, "firstUpload": first_upload, "strongest": strongest}


@app.get("/api/v1/portfolio/trends")
def portfolio_trends(limit: int = 12, x_user_id: str = Header(default="demo-user")) -> dict:
    """PortfolioTrendsResponse { photoCount, points, dimensions, insufficientData }
    (types/memory.ts) — chronological score series + compute_delta per
    dimension, shaped like Iris's app/memory/trends.py::compute_portfolio_trends.
    compute_delta (app/memory_engine.py) is the same newer-half-vs-older-half
    formula as Iris's _delta_recent_vs_older, so historical trend data agrees.

    The window is the most RECENT `limit` photos (returned in chronological
    order for charting) — every consumer captions this series as recent
    ("Recent trend" on Home, sparkline "recent uploads"), so an ascending
    sort+limit that froze the window on the user's oldest uploads would
    silently stop reflecting new work once the library outgrew `limit`."""
    capped_limit = max(4, min(limit, 24))
    query = {"user_id": x_user_id}
    coll = _store().db.portfolio_entries
    docs = list(coll.find(query).sort("created_at", -1).limit(capped_limit))
    docs.reverse()  # back to oldest -> newest for the chart / compute_delta

    if not docs:
        return {"photoCount": 0, "points": [], "dimensions": [], "insufficientData": True}

    points: list[dict[str, Any]] = []
    for doc in docs:
        scores = doc.get("scores") or {}
        created = doc.get("created_at")
        created_iso = created.isoformat() if isinstance(created, datetime) else (str(created) if created else "")
        row: dict[str, Any] = {"createdAt": created_iso}
        for k in _SCORE_DIMS:
            row[k] = round(float(scores.get(k, 0)), 1)
        row["overall"] = round(_avg_score(scores), 1)
        points.append(row)

    dimension_labels = {
        "composition": "Composition", "lighting": "Lighting", "technique": "Technique",
        "creativity": "Creativity", "subject_impact": "Subject", "overall": "Overall",
    }
    dimensions: list[dict[str, Any]] = []
    for key in (*_SCORE_DIMS, "overall"):
        values = [float(p[key]) for p in points]
        delta = compute_delta(values)
        dimensions.append({
            "key": key,
            "label": dimension_labels[key],
            "values": values,
            "latest": values[-1] if values else None,
            "delta": delta,
            "trend": "up" if delta is not None and delta > 0.15
                else "down" if delta is not None and delta < -0.15
                else "flat",
        })

    return {
        "photoCount": len(points),
        "points": points,
        "dimensions": dimensions,
        "insufficientData": len(points) < 4,
    }


@app.get("/api/v1/portfolio/search")
def portfolio_search(q: str = "", limit: int = 8, x_user_id: str = Header(default="demo-user")) -> dict:
    """PortfolioSearchResponse (frontend/src/services/portfolioInsightsClient.ts).
    Structured-metadata search -- no embeddings, see coach.py's header comment."""
    capped_limit = max(1, min(limit, 24))
    docs, terms = _store().search_portfolio(user_id=x_user_id, query=q, limit=capped_limit)
    matches = []
    for doc in docs:
        entry = _serialize_portfolio_entry(doc)
        matched_observations = []
        haystack_pairs = [
            ("tag", t) for t in (doc.get("aesthetic_tags") or []) + (doc.get("user_tags") or [])
        ] + [("scene", doc.get("scene_description") or ""), ("colour", doc.get("colour_notes") or "")]
        for kind, value in haystack_pairs:
            if len(matched_observations) >= 2:
                break
            value_lower = str(value).lower()
            if any(term in value_lower for term in terms):
                snippet = value if kind == "tag" else (value[:100] + ("…" if len(value) > 100 else ""))
                if snippet:
                    matched_observations.append(snippet)
        if not matched_observations:
            doc_genre = (doc.get("genre") or "").lower()
            if any(term in GENRE_SEARCH_SYNONYMS.get(doc_genre, set()) for term in terms):
                matched_observations.append(f"Genre: {doc.get('genre')}")
        entry["matchedObservations"] = matched_observations
        matches.append(entry)

    message = None
    if not q.strip():
        message = "Type a word or phrase to search your library."
    elif not matches:
        message = f'No photos matched "{q}" — try a different word or phrase.'

    return {"query": q, "mode": "regex_fallback", "matches": matches, "searchTerms": terms, "message": message}


@app.get("/api/v1/portfolio/{entry_id}/similar")
def portfolio_similar(entry_id: str, limit: int = 4, x_user_id: str = Header(default="demo-user")) -> dict:
    """SimilarPhotosResponse (frontend/src/services/portfolioInsightsClient.ts).
    Tag/genre overlap -- no embeddings, see coach.py's header comment."""
    coll = _store().db.portfolio_entries
    try:
        source_doc = coll.find_one({"_id": ObjectId(entry_id), "user_id": x_user_id})
    except Exception:
        source_doc = None
    if source_doc is None:
        raise HTTPException(status_code=404, detail="Photo not found.")

    capped_limit = max(1, min(limit, 12))
    scored = _store().similar_portfolio_entries(user_id=x_user_id, source_doc=source_doc, limit=capped_limit)
    matches = []
    for doc, score in scored:
        entry = _serialize_portfolio_entry(doc)
        entry["similarityScore"] = score
        matches.append(entry)

    message = None if matches else "Not enough shared tags or genre yet to suggest similar photos."
    return {"sourceId": entry_id, "matches": matches, "mode": "tag_overlap", "message": message}


class PortfolioDeleteBatchBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    entry_ids: list[str] = Field(alias="entryIds")
    remove_listing: bool = Field(default=False, alias="removeListing")


def _delete_portfolio_doc(coll: Any, *, entry_id: str, user_id: str) -> dict[str, Any] | None:
    try:
        oid = ObjectId(entry_id)
    except Exception:
        return None
    doc = coll.find_one({"_id": oid, "user_id": user_id})
    if doc is None:
        return None
    coll.delete_one({"_id": oid, "user_id": user_id})
    return doc


@app.delete("/api/v1/portfolio/{entry_id}")
def portfolio_delete(
    entry_id: str,
    removeListing: bool = Query(default=False),
    x_user_id: str = Header(default="demo-user"),
) -> dict:
    """Single-photo delete — wire-compatible with memoryClient.deletePortfolioEntry."""
    del removeListing  # print-sales unlisting not in this build; param kept for Iris compat
    coll = _store().db.portfolio_entries
    if _delete_portfolio_doc(coll, entry_id=entry_id, user_id=x_user_id) is None:
        raise HTTPException(status_code=404, detail="Photo not found.")
    return {"deleted": True, "id": entry_id}


@app.post("/api/v1/portfolio/delete-batch")
def portfolio_delete_batch(
    body: PortfolioDeleteBatchBody,
    x_user_id: str = Header(default="demo-user"),
) -> dict:
    """Bulk delete — wire-compatible with memoryClient.deletePortfolioEntries."""
    coll = _store().db.portfolio_entries
    deleted: list[str] = []
    skipped: list[dict[str, str]] = []
    for entry_id in body.entry_ids:
        if _delete_portfolio_doc(coll, entry_id=entry_id, user_id=x_user_id) is None:
            skipped.append({"id": entry_id, "reason": "Photo not found."})
        else:
            deleted.append(entry_id)
    return {"deleted": deleted, "skipped": skipped, "deletedCount": len(deleted)}


@app.get("/api/v1/aesthetic-profile")
def aesthetic_profile(x_user_id: str = Header(default="demo-user")) -> dict:
    """AestheticProfileSummary { photoCount, dominantTags, averageScores,
    stylisticConsistencyScore, computedAt? } (types/memory.ts). The frontend
    calls this via fetchAestheticProfile().catch(() => null), so this is the
    documented-fallback-tolerant minimal shape rather than Iris's full
    embedding-derived profile (Engram doesn't track embeddings)."""
    query = {"user_id": x_user_id}
    coll = _store().db.portfolio_entries
    docs = list(coll.find(query).sort("created_at", -1).limit(20))

    if not docs:
        return {
            "photoCount": 0,
            "dominantTags": [],
            "averageScores": {},
            "stylisticConsistencyScore": None,
        }

    sums = {k: 0.0 for k in _SCORE_DIMS}
    for doc in docs:
        scores = doc.get("scores") or {}
        for k in _SCORE_DIMS:
            sums[k] += float(scores.get(k, 0))

    n = len(docs)
    avg_scores = {k: round(sums[k] / n, 1) for k in _SCORE_DIMS}
    mean = sum(avg_scores.values()) / len(avg_scores)
    variance = sum((x - mean) ** 2 for x in avg_scores.values()) / len(avg_scores)
    consistency = max(0.0, min(1.0, 1.0 - (variance / 25.0)))

    return {
        "photoCount": coll.count_documents(query),
        "dominantTags": _store().top_aesthetic_tags(user_id=x_user_id, limit=20, top_n=8),
        "averageScores": avg_scores,
        "stylisticConsistencyScore": round(consistency, 2),
    }


@app.post("/api/v1/analyze-photo")
def analyze_photo_endpoint(
    image: UploadFile = File(...),
    user_id: str | None = Form(None),
    shoot_id: str | None = Form(None),
    assignment_id: str | None = Form(None),
    x_user_id: str = Header(default="demo-user"),
):
    # Field name `image` matches Iris agentClient.ts's form.append('image', ...).
    # shoot_id/assignment_id are accepted for wire compatibility but currently
    # unused. Plain `def` (not async): the model call inside analyze_photo is
    # slow and blocking, so let Starlette run this route in its threadpool
    # alongside the sibling sync routes.
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    data = image.file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 20MB)")
    filename = image.filename or "photo.jpg"
    content_type = image.content_type or "image/jpeg"
    # Save BEFORE analyze so a model failure never loses the upload (spec §12)
    # — analyze_photo's stored_key skips its own internal save.
    storage = get_storage()
    key = storage.save(data, filename=filename, content_type=content_type)
    payload = analyze_photo(
        data, content_type, filename,
        user_id=user_id or x_user_id, memory_store=_store(), stored_key=key,
    )
    return payload


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    message: str
    session_id: str | None = Field(default=None, alias="sessionId")
    persona: str = "hobbyist"
    photo_id: str | None = None


@app.post("/api/v1/agent/chat")
def agent_chat(body: ChatRequest, x_user_id: str = Header(default="demo-user")) -> dict:
    session_id = body.session_id or str(uuid.uuid4())
    result = mentor_chat(
        message=body.message, user_id=x_user_id, memory_store=_store(),
        photo_id=body.photo_id, session_id=session_id, persona=body.persona,
    )
    return {
        "reply": result["reply"], "persona": body.persona, "sessionId": session_id,
        "userId": x_user_id, "memoryReceipt": result["receipt"],
    }


@app.post("/api/v1/agent/chat/stream")
def agent_chat_stream(body: ChatRequest, x_user_id: str = Header(default="demo-user")) -> StreamingResponse:
    session_id = body.session_id or str(uuid.uuid4())
    receipt, tokens = mentor_chat_stream(
        message=body.message, user_id=x_user_id, memory_store=_store(),
        photo_id=body.photo_id, session_id=session_id, persona=body.persona,
    )

    def sse(event: str | None, data: dict) -> str:
        prefix = f"event: {event}\n" if event else ""
        return f"{prefix}data: {json.dumps(data)}\n\n"

    def event_stream():
        try:
            for delta in tokens:
                yield sse(None, {"delta": delta})
        except APIStatusError:
            logger.warning("upstream model error mid-stream")
            yield sse("error", {"detail": "The photography model is temporarily unavailable. Please try again."})
            return
        except APITimeoutError:
            logger.warning("upstream model timeout mid-stream")
            yield sse("error", {"detail": "The photography model took too long to respond. Please try again."})
            return
        except Exception:
            # Never leave the client hanging on a dropped connection — an
            # unhandled exception here otherwise crashes the ASGI response
            # mid-stream with no event ever reaching the browser.
            logger.exception("unexpected error mid-stream")
            yield sse("error", {"detail": "Something went wrong generating the reply. Please try again."})
            return
        yield sse("done", {
            "sessionId": session_id, "userId": x_user_id, "persona": body.persona, "memoryReceipt": receipt,
        })

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/v1/journey")
def journey(
    x_user_id: str = Header(default="demo-user"),
    include_summary: bool = True,
) -> dict:
    store = _store()
    skills = store.list_skills(user_id=x_user_id)
    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]
    watching_skills = [s for s in skills if s.status == SkillStatus.WATCHING]
    # Same "closest to clearing" ordering JourneySection.tsx uses on the
    # frontend (streak descending, alphabetical on ties), kept in sync here
    # so the identity line names the same skill the Watching card puts on top.
    current_focus = (
        min(watching_skills, key=lambda s: (-s.consecutive_above_bar, s.name)).name
        if watching_skills else None
    )
    genre = store.dominant_genre(user_id=x_user_id, limit=None)
    top_tags = store.top_aesthetic_tags(user_id=x_user_id, limit=None, top_n=1)
    tag = top_tags[0] if top_tags else None
    # Same null-safe read as /users/me: users without a doc (or with a doc
    # predating displayName) get null, and Home renders exactly as before.
    user_doc = store.db.users.find_one({"_id": x_user_id}) or {}

    summary = (
        summarize_progress(user_id=x_user_id, memory_store=store)
        if include_summary
        else ""
    )

    return {
        "summary": summary,
        "skills": [
            {"name": s.name, "status": s.status.value, "consecutive": s.consecutive_above_bar}
            for s in skills
        ],
        "stats": store.get_memory_stats(user_id=x_user_id),
        "identity": build_identity_line(genre, tag, cleared, current_focus),
        "displayName": user_doc.get("displayName"),
    }


_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


async def _get_memory_stats_via_mcp(user_id: str) -> dict:
    """Round-trip get_memory_stats through the real engram-mcp stdio server
    (scripts/run_mcp_server.py) rather than calling MemoryStore in-process —
    this is the production path any Qwen agent actually takes when it mounts
    engram over MCP, so this route can serve as a live protocol health check.

    env is passed explicitly because stdio_client's default child env is a
    sanitized allowlist (HOME/PATH/etc.) that strips MONGODB_URI, and the
    container has no .env file for the child's own load_dotenv() to find
    (config arrives there as parent env vars via compose env_file). cwd is
    kept for path resolution of the launcher script and local .env."""
    from mcp import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client

    params = StdioServerParameters(
        command=sys.executable,
        args=[os.path.join("scripts", "run_mcp_server.py")],
        env=dict(os.environ),
        cwd=_REPO_ROOT,
    )

    async def _round_trip() -> dict:
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("get_memory_stats", {"user_id": user_id})
                if result.isError:
                    raise RuntimeError(f"engram-mcp get_memory_stats failed: {result.content}")
                return json.loads(result.content[0].text)

    # Healthy round trip is ~7s (subprocess spawn dominates); 15s is generous
    # headroom. Without this bound, a wedged subprocess would hang the route
    # (and its threadpool worker) indefinitely.
    return await asyncio.wait_for(_round_trip(), timeout=15.0)


@app.get("/api/v1/memory-stats")
def memory_stats(x_user_id: str = Header(default="demo-user"), via: str | None = None) -> dict:
    if via == "mcp":
        # Sync route + asyncio.run(...): acceptable for this demo path per
        # spec — the default (non-mcp) path below stays the plain in-process
        # call, which is the reliability fallback if the MCP subprocess path
        # ever has trouble.
        try:
            stats = asyncio.run(_get_memory_stats_via_mcp(x_user_id))
        except (asyncio.TimeoutError, Exception) as exc:
            # Broad catch is deliberate: subprocess failures surface as
            # ExceptionGroup (anyio task group), which none of the app-level
            # exception handlers map. No silent fallback to the direct call
            # here — a served_via label the response didn't earn would defeat
            # the point of the route.
            logger.warning("engram-mcp path failed: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="The engram-mcp subprocess path is unavailable right now — the default /api/v1/memory-stats path serves the same data in-process.",
            )
        return {**stats, "served_via": "engram-mcp"}
    return _store().get_memory_stats(user_id=x_user_id)


# --- SPA (built frontend), mounted LAST so every API route above wins ---
# The Docker image builds the Vite bundle into frontend/dist (same-origin:
# no CORS, no mixed-content, one judge URL). Absent in dev, where Vite's
# own server on :5173 proxies /media and calls the API by absolute URL.
_SPA_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(_SPA_DIST):
    app.mount("/", StaticFiles(directory=_SPA_DIST, html=True), name="spa")

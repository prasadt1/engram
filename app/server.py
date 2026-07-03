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

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import APIStatusError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

load_dotenv()

from app.coach import analyze_photo  # noqa: E402
from app.db import get_db  # noqa: E402
from app.mentor import chat as mentor_chat  # noqa: E402
from app.memory_engine import compute_delta  # noqa: E402
from app.memory_store import MemoryStore  # noqa: E402
from app.reflection import summarize_progress  # noqa: E402
from app.storage import get_storage  # noqa: E402

logger = logging.getLogger(__name__)

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
        logger.info("Mongo reachable; indexes ensured")
    else:
        logger.warning("MONGODB_URI not set — skipping startup DB check (dev/test mode)")
    yield


app = FastAPI(title="Engram API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(APIStatusError)
async def _model_unavailable(request, exc):
    logger.warning("upstream model error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "The photography model is temporarily unavailable. Your photo was saved — please try again."})


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


def _serialize_portfolio_entry(doc: dict[str, Any]) -> dict[str, Any]:
    """doc (as written by app.coach.analyze_photo) -> PortfolioListItem
    (frontend/src/types/memory.ts). imageUrl is computed HERE via
    get_storage().signed_url() rather than trusted from the stored
    image_url field, since OSS-signed URLs expire."""
    scores = doc.get("scores") or {}
    created = doc.get("created_at")
    created_iso = created.isoformat() if isinstance(created, datetime) else (str(created) if created else "")

    storage_key = doc.get("storage_key")
    image_url = get_storage().signed_url(storage_key) if storage_key else (doc.get("image_url") or "")

    return {
        "id": str(doc["_id"]),
        "userId": str(doc.get("user_id", "")),
        "shootId": str(doc.get("shoot_id", "")),
        "imageUrl": image_url,
        "createdAt": created_iso,
        "scores": scores,
        "overallAverage": round(_avg_score(scores), 1),
        "aestheticTags": doc.get("aesthetic_tags") or [],
        "userTags": doc.get("user_tags") or [],
        "sceneDescription": doc.get("scene_description"),
        "colourNotes": doc.get("colour_notes"),
        "glassBoxSummary": (doc.get("glass_box") or {}).get("observations", [])[:2],
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
    if docs:
        best = max(docs, key=lambda d: _avg_score(d.get("scores") or {}))
        strongest = _serialize_portfolio_entry(best)

    return {"total": total, "firstUpload": first_upload, "strongest": strongest}


@app.get("/api/v1/portfolio/trends")
def portfolio_trends(limit: int = 12, x_user_id: str = Header(default="demo-user")) -> dict:
    """PortfolioTrendsResponse { photoCount, points, dimensions, insufficientData }
    (types/memory.ts) — chronological score series + compute_delta per
    dimension, shaped like Iris's app/memory/trends.py::compute_portfolio_trends.
    compute_delta (app/memory_engine.py) is the same newer-half-vs-older-half
    formula as Iris's _delta_recent_vs_older, so historical trend data agrees."""
    capped_limit = max(4, min(limit, 24))
    query = {"user_id": x_user_id}
    coll = _store().db.portfolio_entries
    docs = list(coll.find(query).sort("created_at", 1).limit(capped_limit))

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

    tag_counts: dict[str, int] = {}
    sums = {k: 0.0 for k in _SCORE_DIMS}
    for doc in docs:
        for tag in doc.get("aesthetic_tags") or []:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        scores = doc.get("scores") or {}
        for k in _SCORE_DIMS:
            sums[k] += float(scores.get(k, 0))

    n = len(docs)
    avg_scores = {k: round(sums[k] / n, 1) for k in _SCORE_DIMS}
    mean = sum(avg_scores.values()) / len(avg_scores)
    variance = sum((x - mean) ** 2 for x in avg_scores.values()) / len(avg_scores)
    consistency = max(0.0, min(1.0, 1.0 - (variance / 25.0)))

    dominant = sorted(tag_counts.items(), key=lambda x: -x[1])[:8]

    return {
        "photoCount": coll.count_documents(query),
        "dominantTags": [t for t, _ in dominant],
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


@app.get("/api/v1/journey")
def journey(x_user_id: str = Header(default="demo-user")) -> dict:
    store = _store()
    skills = store.list_skills(user_id=x_user_id)
    return {
        "summary": summarize_progress(user_id=x_user_id, memory_store=store),
        "skills": [
            {"name": s.name, "status": s.status.value, "consecutive": s.consecutive_above_bar}
            for s in skills
        ],
        "stats": store.get_memory_stats(user_id=x_user_id),
    }


_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


async def _get_memory_stats_via_mcp(user_id: str) -> dict:
    """Round-trip get_memory_stats through the real engram-mcp stdio server
    (scripts/run_mcp_server.py) rather than calling MemoryStore in-process —
    this is the production path any Qwen agent actually takes when it mounts
    engram over MCP, so this route can serve as a live protocol health check.

    cwd=_REPO_ROOT (not env=) so the spawned process's own load_dotenv() finds
    the same .env this server loaded — stdio_client's default child
    environment is a hardcoded safe allowlist (HOME/PATH/etc.), not a copy of
    this process's os.environ, so MONGODB_URI would otherwise be invisible to
    the child."""
    from mcp import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client

    params = StdioServerParameters(
        command=sys.executable,
        args=[os.path.join("scripts", "run_mcp_server.py")],
        cwd=_REPO_ROOT,
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("get_memory_stats", {"user_id": user_id})
            if result.isError:
                raise RuntimeError(f"engram-mcp get_memory_stats failed: {result.content}")
            return json.loads(result.content[0].text)


@app.get("/api/v1/memory-stats")
def memory_stats(x_user_id: str = Header(default="demo-user"), via: str | None = None) -> dict:
    if via == "mcp":
        # Sync route + asyncio.run(...): acceptable for this demo path per
        # spec — the default (non-mcp) path below stays the plain in-process
        # call, which is the reliability fallback if the MCP subprocess path
        # ever has trouble.
        stats = asyncio.run(_get_memory_stats_via_mcp(x_user_id))
        return {**stats, "served_via": "engram-mcp"}
    return _store().get_memory_stats(user_id=x_user_id)

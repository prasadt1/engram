"""Engram FastAPI app.

Exposes coach / mentor / reflection / memory_store over the EXACT wire
format the reused Iris frontend already speaks (see mentorClient.ts /
agentClient.ts): camelCase JSON keys, `image` as the upload field name,
and a response shape that's additive-only over what Iris already expects
(memoryReceipt is the new key).
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

load_dotenv()

from app.coach import analyze_photo  # noqa: E402
from app.db import get_db  # noqa: E402
from app.mentor import chat as mentor_chat  # noqa: E402
from app.memory_store import MemoryStore  # noqa: E402
from app.reflection import summarize_progress  # noqa: E402
from app.storage import get_storage  # noqa: E402

logger = logging.getLogger(__name__)


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


@app.post("/api/v1/analyze-photo")
async def analyze_photo_endpoint(
    image: UploadFile = File(...),
    user_id: str | None = Form(None),
    shoot_id: str | None = Form(None),
    assignment_id: str | None = Form(None),
    x_user_id: str = Header(default="demo-user"),
):
    # Field name `image` matches Iris agentClient.ts's form.append('image', ...).
    # shoot_id/assignment_id are accepted for wire compatibility but currently
    # unused. Save BEFORE analyze so a model failure never loses the upload
    # (spec §12) — analyze_photo's stored_key skips its own internal save.
    data = await image.read()
    storage = get_storage()
    key = storage.save(data, filename=image.filename or "photo.jpg", content_type=image.content_type or "image/jpeg")
    payload = analyze_photo(
        data, image.content_type or "image/jpeg", image.filename or "photo.jpg",
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


@app.get("/api/v1/memory-stats")
def memory_stats(x_user_id: str = Header(default="demo-user")) -> dict:
    return _store().get_memory_stats(user_id=x_user_id)

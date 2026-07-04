"""Mentor: memory-aware chat, global or scoped to a single photo.

session_id drives a small rolling window of recent turns so multi-turn
chat feels coherent without reimplementing framework-style session state.
Returns {"reply", "receipt"} — the receipt reports exactly what memory
the prompt actually contained (built via context_builder, the shared path).
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from app import qwen_client
from app.context_builder import build_memory_context
from app.memory_engine import SkillStatus

PROMPT_PATH = Path(__file__).parent / "prompts" / "mentor.txt"
RECENT_TURNS_LIMIT = 6


def _recent_turns(memory_store, user_id: str, session_id: str) -> list[dict]:
    # scoped by user_id AND session_id — a guessed/stale sessionId must never
    # leak another user's conversation
    docs = memory_store.db.chat_turns.find({"user_id": user_id, "session_id": session_id}).sort("created_at", -1).limit(RECENT_TURNS_LIMIT)
    return list(reversed(list(docs)))


def _persist_turn(memory_store, user_id: str, session_id: str, role: str, content: str) -> None:
    memory_store.db.chat_turns.insert_one({
        "user_id": user_id, "session_id": session_id, "role": role, "content": content,
        "created_at": datetime.now(timezone.utc),
    })


def _prepare(
    *, message: str, user_id: str, memory_store,
    photo_id: str | None, session_id: str, persona: str,
) -> tuple[str, str, dict]:
    system = PROMPT_PATH.read_text(encoding="utf-8")

    # Hand the builder the full candidate pool (incl. archived); IT does the
    # live-filtering, scoring, and packing so the receipt reflects reality.
    items = memory_store.recall(user_id=user_id, scope=photo_id, k=200, query=None, include_archived=True)
    ctx = build_memory_context(items, query=message, scope=photo_id, k=8)

    skills = memory_store.list_skills(user_id=user_id)
    recent = _recent_turns(memory_store, user_id, session_id)

    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]
    watching = [s.name for s in skills if s.status == SkillStatus.WATCHING]
    turns_block = "\n".join(f"{t['role']}: {t['content']}" for t in recent) or "(start of conversation)"

    context = (
        f"## Persona\n{persona}\n\n"
        f"## Recent turns in this conversation\n{turns_block}\n\n"
        f"## Relevant memories\n{ctx.context_block()}\n\n"
        f"## Cleared skills (mention if relevant)\n{', '.join(cleared) or 'none yet'}\n\n"
        f"## Currently watching\n{', '.join(watching) or 'none yet'}\n\n"
        f"## User's message\n{message}"
    )
    return system, context, ctx.receipt()


def chat(
    *, message: str, user_id: str, memory_store,
    photo_id: str | None = None, session_id: str, persona: str = "hobbyist",
) -> dict:
    system, context, receipt = _prepare(
        message=message, user_id=user_id, memory_store=memory_store,
        photo_id=photo_id, session_id=session_id, persona=persona,
    )

    # Fast tier: this is a conversational reply, not a task needing the
    # reasoning model's extended thinking (which ran 70-80s in testing —
    # unacceptable chat latency).
    result = qwen_client.chat_fast(context, system=system)

    _persist_turn(memory_store, user_id, session_id, "user", message)
    _persist_turn(memory_store, user_id, session_id, "assistant", result.content)

    return {"reply": result.content, "receipt": receipt}


def chat_stream(
    *, message: str, user_id: str, memory_store,
    photo_id: str | None = None, session_id: str, persona: str = "hobbyist",
) -> tuple[dict, "Iterator[str]"]:
    """Same recall/prompt as chat(), but returns the receipt immediately
    (it doesn't depend on the model call) alongside a generator of text
    deltas. Turns are persisted once the generator is fully consumed.
    """
    system, context, receipt = _prepare(
        message=message, user_id=user_id, memory_store=memory_store,
        photo_id=photo_id, session_id=session_id, persona=persona,
    )

    def token_gen():
        chunks: list[str] = []
        for delta in qwen_client.chat_fast_stream(context, system=system):
            chunks.append(delta)
            yield delta
        full_reply = "".join(chunks)
        _persist_turn(memory_store, user_id, session_id, "user", message)
        _persist_turn(memory_store, user_id, session_id, "assistant", full_reply)

    return receipt, token_gen()

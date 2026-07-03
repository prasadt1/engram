"""Reflection: a short, cheap progress summary (used by the Journey page)."""

from __future__ import annotations

from app import qwen_client
from app.memory_engine import SkillStatus


def summarize_progress(*, user_id: str, memory_store) -> str:
    """Generate a warm, specific one-sentence progress summary for the photographer.

    Args:
        user_id: The photographer's user ID.
        memory_store: A MemoryStore with a list_skills(user_id) method.

    Returns:
        A single sentence summarizing their progress across skills.
    """
    skills = memory_store.list_skills(user_id=user_id)
    cleared = [s.name for s in skills if s.status == SkillStatus.CLEARED]
    watching = [s.name for s in skills if s.status == SkillStatus.WATCHING]

    prompt = (
        f"Cleared skills: {', '.join(cleared) or 'none yet'}\n"
        f"Currently watching: {', '.join(watching) or 'none yet'}\n\n"
        "Write one warm, specific sentence summarizing this photographer's progress."
    )
    result = qwen_client.chat_fast(prompt)
    return result.content

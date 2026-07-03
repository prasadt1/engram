"""Local-only photography principles grounding (no Google Agent Builder)."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from app.schema import GroundingCitation

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PRINCIPLES_DIR = PROJECT_ROOT / "principles"

SCENE_TO_DOCS: dict[str, list[str]] = {
    "portrait": ["composition.md", "lighting.md", "subject_impact.md"],
    "landscape": ["composition.md", "lighting.md", "creativity.md"],
    "street": ["composition.md", "creativity.md", "technique.md"],
    "general": ["composition.md", "lighting.md", "technique.md"],
}

TITLE_FROM_ID = {
    "composition.md": "Composition",
    "lighting.md": "Lighting",
    "technique.md": "Technique",
    "creativity.md": "Creativity",
    "subject_impact.md": "Subject impact",
}


def _excerpt_from_markdown(text: str, max_len: int = 220) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line[:max_len]
    return text[:max_len].replace("\n", " ")


def _load_local(doc_id: str) -> GroundingCitation | None:
    path = PRINCIPLES_DIR / doc_id
    if not path.is_file():
        return None
    body = path.read_text(encoding="utf-8")
    return GroundingCitation(
        id=doc_id,
        title=TITLE_FROM_ID.get(doc_id, doc_id.replace(".md", "").replace("_", " ").title()),
        excerpt=_excerpt_from_markdown(body),
    )


def ground_principles(scene_type: str) -> list[GroundingCitation]:
    """Return curated photography-principle citations for a scene type."""
    scene_key = scene_type.lower().strip()
    if scene_key not in SCENE_TO_DOCS:
        scene_key = "general"
    return [c for doc in SCENE_TO_DOCS[scene_key] if (c := _load_local(doc))]


def detect_scene_type_hint(filename: str, mime_type: str) -> str:
    """Lightweight scene hint from filename until vision classify runs."""
    name = filename.lower()
    if re.search(r"portrait|headshot|face|person", name):
        return "portrait"
    if re.search(r"landscape|mountain|sunset|valley", name):
        return "landscape"
    if re.search(r"street|urban|city", name):
        return "street"
    return "general"

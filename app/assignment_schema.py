"""Assignment models for the Practice Loop (wire = camelCase for practice.ts)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SCORE_DIMS = (
    "composition",
    "lighting",
    "technique",
    "creativity",
    "subject_impact",
)

DIMENSION_LABELS: dict[str, str] = {
    "composition": "Composition",
    "lighting": "Lighting",
    "technique": "Technique",
    "creativity": "Creativity",
    "subject_impact": "Subject impact",
}


class SkillDelta(BaseModel):
    metric: str = "Intentional Skill Application Rate"
    baseline_value: float
    current_value: float
    delta: float


class PlannerAssignmentOutput(BaseModel):
    brief: str = Field(
        description=(
            "Markdown bullets (2–3 lines, ≤18 words each) — assignment steps "
            "+ Success: criterion."
        )
    )
    target_skill: str
    rationale: str = Field(
        description=(
            "Markdown bullets (2 lines max) — Pattern: from skill memory; "
            "Why now: tie to brief."
        )
    )


class AssignmentCreate(BaseModel):
    user_id: str
    brief: str
    target_skill: str
    rationale: str
    baseline_shoot_ids: list[str] = Field(default_factory=list)
    status: Literal["proposed", "active"] = "proposed"

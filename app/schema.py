"""Pydantic models aligned with spec §7.2."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AnalysisScores(BaseModel):
    composition: float = Field(ge=0, le=10)
    lighting: float = Field(ge=0, le=10)
    technique: float = Field(ge=0, le=10)
    creativity: float = Field(ge=0, le=10)
    subject_impact: float = Field(ge=0, le=10)


class PriorityFix(BaseModel):
    severity: Literal["critical", "moderate", "minor"]
    issue: str


class GroundingCitation(BaseModel):
    id: str
    title: str
    excerpt: str


class GlassBox(BaseModel):
    observations: list[str]
    reasoning_steps: list[str]
    priority_fixes: list[PriorityFix]
    grounding_principles: list[str] = Field(default_factory=list)
    grounding_citations: list[GroundingCitation] = Field(default_factory=list)


class BoundingBoxPct(BaseModel):
    x: float
    y: float
    w: float
    h: float


class SpatialAnnotation(BaseModel):
    bbox: BoundingBoxPct
    severity: Literal["critical", "moderate", "minor"]
    note: str


class SubjectRelationships(BaseModel):
    primary_subject_position: str
    secondary_subjects: list[dict[str, str]] = Field(default_factory=list)
    depth_axis: str = "foreground_midground"
    leading_lines_present: bool = False


class LightingMap(BaseModel):
    key_light_direction: str = "upper_right"
    fill_light_strength: Literal["absent", "low", "moderate", "high"] = "low"
    rim_light_present: bool = False
    color_temperature: Literal["warm", "neutral", "cool", "mixed"] = "neutral"
    shadow_character: Literal["hard", "soft", "mixed"] = "soft"


class SpatialMetadata(BaseModel):
    annotations: list[SpatialAnnotation] = Field(default_factory=list)
    subject_relationships: SubjectRelationships = Field(
        default_factory=lambda: SubjectRelationships(primary_subject_position="center")
    )
    lighting_map: LightingMap = Field(default_factory=LightingMap)


class CritiqueBreakdown(BaseModel):
    composition: str
    lighting: str
    technique: str
    overall: str


class SettingsEstimate(BaseModel):
    focal_length: str = Field(alias="focalLength", default="unknown")
    aperture: str = "unknown"
    shutter_speed: str = Field(alias="shutterSpeed", default="unknown")
    iso: str = "unknown"

    model_config = {"populate_by_name": True}


class CoachAnalysisOutput(BaseModel):
    """Structured Coach response (Gemini JSON)."""

    model_config = ConfigDict(populate_by_name=True)

    scene_description: str = Field(
        alias="sceneDescription",
        description=(
            "2–4 observational sentences: subject(s), framing, background, visible lighting. "
            "No scores or critique."
        ),
    )
    colour_notes: str | None = Field(
        default=None,
        alias="colourNotes",
        description="1–2 sentences on dominant colours / palette; concrete references welcome.",
    )
    scores: AnalysisScores
    critique: CritiqueBreakdown
    strengths: list[str]
    improvements: list[str]
    learning_path: list[str] = Field(default_factory=list, alias="learningPath")
    settings_estimate: SettingsEstimate = Field(
        default_factory=SettingsEstimate, alias="settingsEstimate"
    )
    aesthetic_tags: list[str] = Field(default_factory=list, alias="aestheticTags")
    glass_box: GlassBox = Field(alias="glassBox")
    spatial_metadata: SpatialMetadata = Field(alias="spatialMetadata")
    bounding_boxes: list[dict] = Field(default_factory=list, alias="boundingBoxes")

    model_config = {"populate_by_name": True}


Persona = Literal["hobbyist", "working_pro", "vision_impairment"]
ApprovalStatus = Literal["pending", "approved", "modified", "rejected"]


class UserPreferences(BaseModel):
    """Optional user settings (v5 §6.2)."""

    voice_first: bool = Field(default=False, alias="voiceFirst")
    haptic_feedback: bool = Field(default=True, alias="hapticFeedback")

    model_config = {"populate_by_name": True}


class ProposedAction(BaseModel):
    type: str
    target_id: str = Field(alias="targetId")
    payload: dict = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class UserDecision(BaseModel):
    action: Literal["approve", "modify", "reject"] | None = None
    override_payload: dict | None = Field(default=None, alias="overridePayload")
    decided_at: datetime | None = Field(default=None, alias="decidedAt")

    model_config = {"populate_by_name": True}


class PendingApproval(BaseModel):
    """HITL document (§5.7)."""

    user_id: str = Field(alias="userId")
    agent_name: str = Field(alias="agentName")
    proposed_action: ProposedAction = Field(alias="proposedAction")
    agent_reasoning: str = Field(alias="agentReasoning")
    status: ApprovalStatus = "pending"
    user_decision: UserDecision | None = Field(default=None, alias="userDecision")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), alias="createdAt"
    )

    model_config = {"populate_by_name": True}

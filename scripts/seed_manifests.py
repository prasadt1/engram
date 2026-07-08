"""Coach Assist + demo journey manifests — verified Unsplash photo IDs."""

from __future__ import annotations

from app.memory_engine import SkillStatus
from scripts.seed_journey_core import JourneySeedConfig, Photo, SupersessionPair

# Alex — street / available light, composition cleared, lighting stuck at streak 0.
STUCK_PHOTOS: list[Photo] = [
    Photo("1558618666-fcd25c85cd64", "architecture", "Unsplash — night street with neon signs", 1, 0.1),
    Photo("1542744173-8e7e53415bb0", "architecture", "Unsplash — team meeting in modern office", 1, -0.1),
    Photo("1512453979798-5ea266f8880c", "architecture", "Unsplash — city skyline at dusk", 2, 0.0),
    Photo("1507003211169-0a1dd7228f2d", "portrait", "Unsplash — candid portrait, natural light", 2, 0.1),
    Photo("1556761175-5973dc0f32e7", "architecture", "Unsplash — open-plan office workspace", 3, -0.1),
    Photo("1522071820081-009f0129c71c", "portrait", "Unsplash — group collaboration portrait", 3, 0.0),
    Photo("1497366754035-f200968a6e72", "architecture", "Unsplash — minimalist office interior", 4, 0.1),
    Photo("1555396273-367ea4eb4db5", "architecture", "Unsplash — cafe interior, window light", 4, -0.1),
    Photo("1497366216548-37526070297c", "architecture", "Unsplash — glass office building facade", 5, 0.0),
    Photo("1564013799919-ab600027ffc6", "architecture", "Unsplash — suburban house exterior", 5, 0.1),
]

STUCK_SESSION_ARC: dict[str, list[float]] = {
    # composition clears sessions 1–3; lighting never strings 3 above bar.
    "composition": [8.0, 8.0, 8.5, 8.0, 7.5],
    "lighting": [5.5, 6.0, 7.5, 6.0, 7.5],
    "creativity": [6.0, 6.5, 6.0, 6.5, 6.0],
    "technique": [6.0, 6.2, 6.1, 6.3, 6.0],
    "subject_impact": [5.5, 5.8, 6.0, 5.5, 5.8],
}
STUCK_SESSION_DAYS = [18, 14, 10, 6, 3]


def _assert_stuck(by_name: dict[str, object]) -> None:
    composition = by_name.get("composition")
    lighting = by_name.get("lighting")
    assert composition is not None and composition.status == SkillStatus.CLEARED  # type: ignore[union-attr]
    assert lighting is not None and lighting.status == SkillStatus.WATCHING  # type: ignore[union-attr]
    assert lighting.consecutive_above_bar in (0, 1)  # type: ignore[union-attr]


STUCK_CONFIG = JourneySeedConfig(
    user_id="coach-assist-stuck",
    display_name="Alex",
    photos=STUCK_PHOTOS,
    session_arc=STUCK_SESSION_ARC,
    session_days_ago=STUCK_SESSION_DAYS,
    supersession_pairs=[
        SupersessionPair(
            "shoots street scenes at high noon for flat even light",
            12,
            "switched to blue-hour street sessions for richer ambient glow",
            5,
            "architecture",
        ),
    ],
    assert_skills=_assert_stuck,
)

# Sam — landscape-heavy, composition + creativity cleared, technique at 2/3.
CLEARED_PHOTOS: list[Photo] = [
    Photo("1519681393784-d120267933ba", "landscape", "Unsplash — misty mountain lake at dawn", 1, 0.1),
    Photo("1469474968028-56623f02e42e", "landscape", "Unsplash — sunlit forest trail", 1, -0.1),
    Photo("1571019613454-1cb2f99b2d8b", "landscape", "Unsplash — fitness runner on coastal path", 2, 0.0),
    Photo("1560448204-e02f11c3d0e2", "landscape", "Unsplash — modern living room interior", 2, 0.1),
    Photo("1432888498266-38ffec3eaf0a", "landscape", "Unsplash — aerial green hills panorama", 3, -0.1),
    Photo("1501854140801-50d01698950b", "landscape", "Unsplash — lake reflection at golden hour", 4, 0.0),
]

CLEARED_SESSION_ARC: dict[str, list[float]] = {
    "composition": [7.5, 8.0, 8.5, 8.0],
    "creativity": [6.0, 7.5, 8.0, 8.5],
    "technique": [6.0, 6.5, 7.5, 7.8],
    "lighting": [6.0, 6.2, 6.5, 6.8],
    "subject_impact": [6.5, 6.4, 6.6, 6.3],
}
CLEARED_SESSION_DAYS = [20, 14, 8, 3]


def _assert_cleared(by_name: dict[str, object]) -> None:
    composition = by_name.get("composition")
    creativity = by_name.get("creativity")
    technique = by_name.get("technique")
    assert composition is not None and composition.status == SkillStatus.CLEARED  # type: ignore[union-attr]
    assert creativity is not None and creativity.status == SkillStatus.CLEARED  # type: ignore[union-attr]
    assert technique is not None and technique.status == SkillStatus.WATCHING  # type: ignore[union-attr]
    assert technique.consecutive_above_bar == 2  # type: ignore[union-attr]


CLEARED_CONFIG = JourneySeedConfig(
    user_id="coach-assist-cleared",
    display_name="Sam",
    photos=CLEARED_PHOTOS,
    session_arc=CLEARED_SESSION_ARC,
    session_days_ago=CLEARED_SESSION_DAYS,
    supersession_pairs=[
        SupersessionPair(
            "prefers wide-angle landscapes with everything in focus",
            16,
            "started using foreground anchors for stronger depth in landscapes",
            6,
            "landscape",
        ),
    ],
    assert_skills=_assert_cleared,
)

COACH_ASSIST_CONFIGS = [STUCK_CONFIG, CLEARED_CONFIG]

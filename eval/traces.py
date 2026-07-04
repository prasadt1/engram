"""Scripted multi-session memory traces for the /eval harness.

Each trace is a mini life story with facts that get superseded, so
recall/forgetting can be measured against a known-correct answer key.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Fact:
    content: str
    genre: str | None
    valid_from_session: int
    invalidated_by_session: int | None = None  # None = still valid


@dataclass
class Trace:
    user_id: str
    facts: list[Fact]
    query: str
    expects_current: list[str]   # substrings that SHOULD appear among recalled content
    expects_absent: list[str]    # substrings that should NOT appear (superseded facts)


TRACES: list[Trace] = [
    Trace(
        user_id="trace_1",
        facts=[
            Fact("shoots primarily with a Canon body", "gear", valid_from_session=1, invalidated_by_session=3),
            Fact("switched to a Sony mirrorless body", "gear", valid_from_session=3),
        ],
        query="What camera gear do I use?",
        expects_current=["Sony"],
        expects_absent=["Canon"],
    ),
    Trace(
        user_id="trace_2",
        facts=[
            Fact("struggles with tilted horizons in landscape shots", "landscape", valid_from_session=1, invalidated_by_session=4),
            Fact("consistently level horizons across recent landscape sessions", "landscape", valid_from_session=4),
        ],
        query="Do I still need to work on horizon tilt in my landscapes?",
        expects_current=["level horizons"],
        expects_absent=["struggles with tilted"],
    ),
    Trace(
        user_id="trace_3",
        facts=[
            Fact("prefers moody low-key portrait lighting", "portrait", valid_from_session=2),
            Fact("wants to improve environmental portrait composition", "portrait", valid_from_session=5),
        ],
        query="What am I working on in my portraits?",
        expects_current=["environmental portrait composition"],
        expects_absent=[],
    ),
    Trace(
        user_id="trace_adversarial_1",
        facts=[
            Fact("prefers shooting landscapes at midday", "landscape", valid_from_session=6, invalidated_by_session=7),
            Fact("switched to golden-hour landscape sessions", "landscape", valid_from_session=7),
        ],
        query="When do I like to shoot landscapes?",
        expects_current=["golden"],
        expects_absent=["midday"],
    ),
    # ^ adversarial: the obsolete "midday" fact is nearly as RECENT as its
    # correction — naive recency ranking surfaces it; only supersession-aware
    # recall reliably excludes it. The full set (later task) needs >=5 of this class.
]

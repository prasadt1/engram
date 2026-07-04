"""A one-line, deterministic identity statement for the Home page --
composed from the same data the journey/aesthetic-profile routes already
expose, with no LLM call. See docs/superpowers/specs/2026-07-04-mentor-reply-
structure-home-identity-design.md, Component 2."""

from __future__ import annotations


def build_identity_line(
    genre: str | None, tag: str | None, cleared: list[str], watching: str | None,
) -> str | None:
    if not genre and not tag and not cleared and not watching:
        return None

    if tag and genre:
        descriptor = f"a {tag} {genre} shooter"
    elif tag:
        descriptor = f"a {tag} photographer"
    elif genre:
        descriptor = f"a {genre} shooter"
    else:
        descriptor = "building your eye"

    clauses: list[str] = []
    if cleared:
        clauses.append(f"{', '.join(cleared)} cleared")
    else:
        clauses.append("working toward your first cleared skill")
    if watching:
        clauses.append(f"now sharpening {watching}")

    return f"You're {descriptor} — {', '.join(clauses)}."

"""A one-line, deterministic identity statement for the Home page --
composed from the same data the journey/aesthetic-profile routes already
expose, with no LLM call. See docs/superpowers/specs/2026-07-04-mentor-reply-
structure-home-identity-design.md, Component 2."""

from __future__ import annotations


def _humanize(value: str) -> str:
    """LLM-generated genre/tag values are snake_case tokens
    (e.g. "natural_light", "still_life") -- this is user-facing copy, so
    turn underscores into spaces before it reaches a sentence."""
    return value.replace("_", " ")


def build_identity_line(
    genre: str | None, tag: str | None, cleared: list[str], watching: str | None,
) -> str | None:
    if not genre and not tag and not cleared and not watching:
        return None

    genre = _humanize(genre) if genre else genre
    tag = _humanize(tag) if tag else tag

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

"""Local, zero-model-call salvage of near-miss CoachAnalysisOutput payloads.

Production data showed qwen-vl-max returning a good critique in ~28s, with
2/3 of calls failing validation on ONE cosmetic enum near-miss (e.g.
``fill_light_strength: "medium"`` instead of ``"moderate"``). The previous
code path answered that with a model-based shape-repair chain that burned
~93s and usually ended in a 502. This module fixes the mismatch in cost: a
near-miss is repaired by pure-local dict surgery in sub-millisecond time,
and the model-repair chain is reserved for genuinely broken CORE fields
(sceneDescription / scores / critique) that local rules must never invent.

Verified pydantic (2.13.4) loc-format facts this module relies on — do not
"simplify" them away:

- ``e.errors()`` loc tuples use THE KEY ACTUALLY PRESENT IN THE INPUT DICT
  (camelCase or snake_case, whichever the model emitted — both are accepted
  because ``populate_by_name=True``). So mutation navigates the raw dict
  directly with the original loc components; no alias translation needed.
- EXCEPTION: for ``type="missing"`` the loc's FINAL component is the alias
  form (parent components are still input keys, because pydantic had to
  recurse through them). Fills are inserted under the loc-reported key —
  model_validate accepts either spelling.
- List indices appear as int components in the loc tuple.
- ``err["input"]`` carries the offending value.

Path CLASSIFICATION uses a normalized snake_case form of the loc (int
components become "[]"); MUTATION always uses the original loc components.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError

from app.schema import CoachAnalysisOutput

logger = logging.getLogger(__name__)

# 3 validate attempts = max 2 salvage passes. The loop exists because pruning
# a subtree or coercing a container can surface NEW errors only visible on
# re-validation (e.g. list_type wrap on pass 1 reveals a bad item on pass 2).
_MAX_VALIDATE_ATTEMPTS = 3

_NAV_FAIL = object()  # sentinel: navigation hit a shape mismatch
_NO_FILL = object()  # sentinel: no known fill for a missing key


def validate_with_local_salvage(parsed: dict) -> CoachAnalysisOutput:
    """Validate ``parsed``, locally salvaging near-miss errors in place.

    Raises the last ValidationError if core damage (sceneDescription /
    scores / critique) is unsalvageable, so the caller's existing
    model-repair chain still runs for genuinely broken core fields.
    """
    last_err: ValidationError | None = None
    for _ in range(_MAX_VALIDATE_ATTEMPTS):
        try:
            return CoachAnalysisOutput.model_validate(parsed)
        except ValidationError as e:
            last_err = e
            core_unsalvageable = _salvage_pass(parsed, e.errors())
            if core_unsalvageable:
                raise  # -> caller's model-repair chain (core damage only)
    assert last_err is not None
    raise last_err  # still broken after 2 salvage passes -> model chain


# ---------------------------------------------------------------------------
# Loc normalization and classification
# ---------------------------------------------------------------------------

# Alias -> canonical snake_case, for classification only (mutation always
# uses the original loc components against the raw dict).
_KEY_CANON = {
    "spatialMetadata": "spatial_metadata",
    "glassBox": "glass_box",
    "sceneDescription": "scene_description",
    "settingsEstimate": "settings_estimate",
    "learningPath": "learning_path",
    "aestheticTags": "aesthetic_tags",
    "colourNotes": "colour_notes",
    "boundingBoxes": "bounding_boxes",
    "focalLength": "focal_length",
    "shutterSpeed": "shutter_speed",
}

# CORE paths: never invent content locally. Anything unsalvageable here goes
# back to the caller's model-repair chain.
_CORE_HEADS = {"scene_description", "scores", "critique"}


def _canon_loc(loc: tuple) -> tuple:
    return tuple("[]" if isinstance(p, int) else _KEY_CANON.get(p, p) for p in loc)


def _is_core(canon_loc: tuple) -> bool:
    if not canon_loc:
        return True  # root-level damage (e.g. payload isn't a dict)
    return canon_loc[0] in _CORE_HEADS


# Prefixes (canonical form) whose field has a default/default_factory, so
# deleting the key lets the schema default fill in. Children of
# settings_estimate and lighting_map are all defaulted too (handled in
# _has_default). NOTE: subject_relationships children EXCLUDE
# primary_subject_position (required within the sub-model — but deleting the
# parent is fine, its default_factory supplies "center").
_DEFAULTED_PREFIXES = {
    ("colour_notes",),
    ("learning_path",),
    ("settings_estimate",),
    ("aesthetic_tags",),
    ("genre",),
    ("bounding_boxes",),
    ("glass_box", "grounding_principles"),
    # extra-safe: analyze_photo overwrites grounding_citations in the payload
    # with locally-built citations anyway (app/coach.py), so nothing model-
    # emitted here is ever worth a repair call.
    ("glass_box", "grounding_citations"),
    ("spatial_metadata", "annotations"),
    ("spatial_metadata", "subject_relationships"),
    ("spatial_metadata", "lighting_map"),
    ("spatial_metadata", "subject_relationships", "secondary_subjects"),
    ("spatial_metadata", "subject_relationships", "depth_axis"),
    ("spatial_metadata", "subject_relationships", "leading_lines_present"),
}


def _has_default(canon_prefix: tuple) -> bool:
    if canon_prefix in _DEFAULTED_PREFIXES:
        return True
    # All SettingsEstimate leaves default to "unknown".
    if len(canon_prefix) == 2 and canon_prefix[0] == "settings_estimate":
        return True
    # All LightingMap leaves have defaults.
    if len(canon_prefix) == 3 and canon_prefix[:2] == ("spatial_metadata", "lighting_map"):
        return True
    return False


# ---------------------------------------------------------------------------
# Enum salvage tables — synonym maps are PER FIELD on purpose: "medium" means
# "moderate" for fill_light_strength but "high" means "critical" for severity.
# ---------------------------------------------------------------------------

_FILL_LIGHT_ALLOWED = {"absent", "low", "moderate", "high"}
_FILL_LIGHT_SYNONYMS = {
    "medium": "moderate", "mid": "moderate", "average": "moderate",
    "strong": "high", "intense": "high", "bright": "high",
    "weak": "low", "subtle": "low", "faint": "low", "soft": "low", "dim": "low",
    "none": "absent", "no": "absent", "n_a": "absent", "minimal": "absent",
}

_SEVERITY_ALLOWED = {"critical", "moderate", "minor"}
_SEVERITY_SYNONYMS = {
    "severe": "critical", "major": "critical", "high": "critical", "serious": "critical",
    "medium": "moderate", "mid": "moderate", "significant": "moderate",
    "low": "minor", "slight": "minor", "small": "minor", "trivial": "minor", "mild": "minor",
}

_COLOR_TEMP_ALLOWED = {"warm", "neutral", "cool", "mixed"}
_COLOR_TEMP_SYNONYMS = {
    "warmish": "warm", "warm_ish": "warm", "golden": "warm", "orange": "warm",
    "cold": "cool", "coolish": "cool", "cool_ish": "cool", "blue": "cool", "bluish": "cool",
    "daylight": "neutral", "balanced": "neutral", "white": "neutral",
    "varied": "mixed", "both": "mixed",
}

_SHADOW_ALLOWED = {"hard", "soft", "mixed"}
_SHADOW_SYNONYMS = {
    "harsh": "hard", "strong": "hard", "crisp": "hard", "sharp": "hard", "deep": "hard",
    "gentle": "soft", "diffuse": "soft", "diffused": "soft", "subtle": "soft", "light": "soft",
    "medium": "mixed", "moderate": "mixed", "varied": "mixed",
}

_GENRE_ALLOWED = {
    "landscape", "portrait", "still_life", "street", "wildlife", "macro", "architecture", "other",
}
_GENRE_SYNONYMS = {
    "landscapes": "landscape",
    "portraits": "portrait", "portraiture": "portrait", "headshot": "portrait",
    "product": "still_life",
    "street_photography": "street", "urban": "street", "candid": "street", "documentary": "street",
    "animal": "wildlife", "animals": "wildlife", "bird": "wildlife", "birds": "wildlife",
    "nature": "wildlife",
    "macro_photography": "macro", "close_up": "macro", "closeup": "macro",
    "building": "architecture", "buildings": "architecture", "architectural": "architecture",
    "cityscape": "architecture",
}


def _enum_spec(canon_loc: tuple) -> tuple[set[str], dict[str, str], str] | None:
    """(allowed values, synonym map, fallback default) for a Literal field."""
    last = canon_loc[-1] if canon_loc else None
    if last == "fill_light_strength":
        return _FILL_LIGHT_ALLOWED, _FILL_LIGHT_SYNONYMS, "low"
    if last == "color_temperature":
        return _COLOR_TEMP_ALLOWED, _COLOR_TEMP_SYNONYMS, "neutral"
    if last == "shadow_character":
        return _SHADOW_ALLOWED, _SHADOW_SYNONYMS, "soft"
    if last == "severity":
        # priority_fixes items get "moderate" (mid-severity makes no false
        # priority claim, preserves the issue text); annotations get "minor"
        # (cosmetic overlay).
        fallback = "minor" if "annotations" in canon_loc else "moderate"
        return _SEVERITY_ALLOWED, _SEVERITY_SYNONYMS, fallback
    if last == "genre":
        # genre's own schema default IS the catch-all: unknowns -> "other"
        # is semantically honest.
        return _GENRE_ALLOWED, _GENRE_SYNONYMS, "other"
    return None


def _salvage_enum(value: Any, allowed: set[str], synonyms: dict[str, str], fallback: str) -> str:
    norm = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    if norm in allowed:
        return norm  # catches "Moderate", "still-life", "still life"
    if norm in synonyms:
        return synonyms[norm]
    # Unique-containment snap: exactly ONE allowed value contained in norm
    # ("moderately_strong" -> moderate, "soft_shadows" -> soft). Ambiguous
    # containment skips to the fallback.
    contained = [v for v in allowed if v in norm]
    if len(contained) == 1:
        return contained[0]
    return fallback


# ---------------------------------------------------------------------------
# Safe navigation / mutation. Guard EVERY step: an earlier mutation in the
# same pass may have changed shape; on failure skip the error — the
# re-validate loop re-reports anything real.
# ---------------------------------------------------------------------------

def _navigate(raw: Any, loc: tuple) -> Any:
    node = raw
    for part in loc:
        if isinstance(node, dict) and isinstance(part, str) and part in node:
            node = node[part]
        elif isinstance(node, list) and isinstance(part, int) and 0 <= part < len(node):
            node = node[part]
        else:
            return _NAV_FAIL
    return node


def _trunc(value: Any, limit: int = 120) -> str:
    r = repr(value)
    return r if len(r) <= limit else r[:limit] + "..."


def _log(loc: tuple, err_type: str, old: Any, action: str, new: Any) -> None:
    logger.warning(
        "local salvage: loc=%s type=%s old=%s action=%s new=%s",
        ".".join(str(p) for p in loc), err_type, _trunc(old), action, _trunc(new),
    )


def _set_leaf(raw: dict, loc: tuple, err_type: str, old: Any, action: str, new: Any) -> bool:
    """Set (or insert) the value at loc; True if the mutation landed."""
    if not loc:
        return False
    parent = _navigate(raw, loc[:-1])
    last = loc[-1]
    if isinstance(parent, dict) and isinstance(last, str):
        parent[last] = new
    elif isinstance(parent, list) and isinstance(last, int) and 0 <= last < len(parent):
        parent[last] = new
    else:
        return False
    _log(loc, err_type, old, action, new)
    return True


def _delete_key(raw: dict, loc: tuple, err_type: str, old: Any) -> bool:
    """Delete the dict key at loc so the schema default fills it."""
    if not loc:
        return False
    parent = _navigate(raw, loc[:-1])
    last = loc[-1]
    if isinstance(parent, dict) and isinstance(last, str) and last in parent:
        del parent[last]
        _log(loc, err_type, old, "delete-key (schema default fills)", "<default>")
        return True
    return False


def _register_item_prune(loc: tuple, err_type: str, old: Any, prunes: dict[tuple, set[int]]) -> bool:
    """Defer pruning of the innermost list item containing loc.

    Prunes MUST be deferred and applied in descending index order after all
    errors in a batch are processed — deleting index 0 immediately would
    shift index 2 of a later error in the same errors() batch.
    """
    for j in range(len(loc) - 1, -1, -1):
        if isinstance(loc[j], int):
            prunes.setdefault(tuple(loc[:j]), set()).add(loc[j])
            _log(loc, err_type, old, f"prune list item {loc[j]} (deferred)", "<removed>")
            return True
    return False


def _apply_prunes(raw: dict, prunes: dict[tuple, set[int]]) -> None:
    for parent_loc, indices in prunes.items():
        parent = _navigate(raw, parent_loc)
        if not isinstance(parent, list):
            continue
        for idx in sorted(indices, reverse=True):
            if 0 <= idx < len(parent):
                del parent[idx]


# ---------------------------------------------------------------------------
# Fills for missing non-core required fields: honestly empty, never invented.
# ---------------------------------------------------------------------------

def _missing_fill(canon_loc: tuple) -> Any:
    if canon_loc == ("spatial_metadata",):
        return {}  # verified: {} validates fully via defaults
    if canon_loc == ("glass_box",):
        # policy: the glass box page renders empty rather than 502ing
        return {"observations": [], "reasoning_steps": [], "priority_fixes": []}
    if canon_loc in (
        ("glass_box", "observations"),
        ("glass_box", "reasoning_steps"),
        ("glass_box", "priority_fixes"),
    ):
        return []
    if canon_loc in (("strengths",), ("improvements",)):
        return []  # required but list-typed; empty is honest
    if canon_loc == ("spatial_metadata", "subject_relationships", "primary_subject_position"):
        return "center"  # matches schema.py's own default_factory choice
    return _NO_FILL


# ---------------------------------------------------------------------------
# Per-error dispatch
# ---------------------------------------------------------------------------

_RANGE_ERRORS = {"less_than_equal", "greater_than_equal", "less_than", "greater_than"}
_NUMERIC_PARSE_ERRORS = {"float_parsing", "float_type", "int_parsing"}


def _salvage_pass(raw: dict, errors: list[dict]) -> bool:
    """One pure-local salvage pass over a batch of validation errors.

    Mutates ``raw`` in place. Returns True if any error is core-unsalvageable
    (caller must fall back to the model-repair chain). Value mutations are
    applied immediately; list-item prunes are deferred and applied in
    descending index order at the end of the pass.
    """
    core_unsalvageable = False
    prunes: dict[tuple, set[int]] = {}
    for err in errors:
        if _handle_error(raw, err, prunes):
            core_unsalvageable = True
    _apply_prunes(raw, prunes)
    return core_unsalvageable


def _handle_error(raw: dict, err: dict, prunes: dict[tuple, set[int]]) -> bool:
    """Handle one validation error. Returns True if core-unsalvageable."""
    loc = tuple(err["loc"])
    canon = _canon_loc(loc)
    etype = err["type"]
    value = err.get("input")

    # A) Enum near-miss: normalize -> synonyms -> containment -> schema
    # default. Always succeeds — no reachable Literal is core.
    if etype == "literal_error":
        spec = _enum_spec(canon)
        if spec is not None:
            allowed, synonyms, fallback = spec
            new = _salvage_enum(value, allowed, synonyms, fallback)
            _set_leaf(raw, loc, etype, value, "enum salvage", new)
            return False
        return _default_rule(raw, loc, canon, etype, value, prunes)

    # B) Numeric range violation — only reachable on scores.*. Clamping is
    # content-true (10.5 means "ten"), so clamping a CORE score is allowed;
    # only fabrication is forbidden.
    if etype in _RANGE_ERRORS:
        try:
            new = min(10.0, max(0.0, float(value)))
        except (TypeError, ValueError):
            return _default_rule(raw, loc, canon, etype, value, prunes)
        _set_leaf(raw, loc, etype, value, "clamp to [0,10]", new)
        return False

    # C) Numeric parse failure on scores.*: strip "/10"-style suffixes and
    # retry; anything still unparseable is core-unsalvageable.
    if etype in _NUMERIC_PARSE_ERRORS:
        if canon[:1] == ("scores",):
            s = str(value).strip().lower()
            for suffix in ("/10", "out of 10"):
                if s.endswith(suffix):
                    s = s[: -len(suffix)].strip()
            try:
                new = min(10.0, max(0.0, float(s)))
            except ValueError:
                return True  # CORE unsalvageable -> model chain
            _set_leaf(raw, loc, etype, value, "parse score string + clamp", new)
            return False
        return _default_rule(raw, loc, canon, etype, value, prunes)

    # D) Missing required key.
    if etype == "missing":
        if _is_core(canon):
            # Includes any critique.* sub-key: filling from critique.overall
            # would be inventing per-dimension critique.
            return True
        if any(isinstance(p, int) for p in loc):
            # required leaf missing inside a LIST ITEM -> prune the item
            _register_item_prune(loc, etype, value, prunes)
            return False
        fill = _missing_fill(canon)
        if fill is not _NO_FILL:
            # finding #2: insert under the loc-reported (alias) key — the
            # parent components are input keys, so navigation still works.
            parent = _navigate(raw, loc[:-1])
            if isinstance(parent, dict) and isinstance(loc[-1], str):
                parent[loc[-1]] = fill
                _log(loc, etype, "<missing>", "insert honest-empty fill", fill)
            return False
        return False  # unknown missing key: skip; loop exhaustion handles it

    # E) string_type: scalar inputs are content-preservingly coerced;
    # non-scalar inputs fall through to the default rule (prune/delete).
    if etype == "string_type":
        if isinstance(value, (bool, int, float)):
            new = str(value)
            _set_leaf(raw, loc, etype, value, "coerce scalar to str", new)
            return False
        return _default_rule(raw, loc, canon, etype, value, prunes)

    # F) Container shape errors.
    if etype == "list_type":
        if _is_core(canon):
            return True  # no core lists exist; defensive only
        if isinstance(value, str):
            new: Any = [value]  # content-preserving (strengths="great colors")
            action = "wrap str into list"
        else:
            new = []
            action = "replace non-list with []"
        if not _set_leaf(raw, loc, etype, value, action, new):
            return _default_rule(raw, loc, canon, etype, value, prunes)
        return False

    if etype in ("model_type", "dict_type"):
        if _is_core(canon):
            # critique-as-str is already handled by _normalize_coach_output
            # before validation; any other core wrong-type is unsalvageable.
            return True
        if loc and isinstance(loc[-1], int):
            # A LIST ITEM of the wrong type.
            if isinstance(value, str) and canon[:-1] == ("glass_box", "priority_fixes"):
                new = {"severity": "moderate", "issue": value}
                _set_leaf(raw, loc, etype, value, "wrap str into PriorityFix", new)
                return False
            _register_item_prune(loc, etype, value, prunes)
            return False
        if canon == ("glass_box",) and isinstance(value, str):
            new = {"observations": [value], "reasoning_steps": [], "priority_fixes": []}
            _set_leaf(raw, loc, etype, value, "wrap str into GlassBox observations", new)
            return False
        if _has_default(canon):
            # e.g. lighting_map / subject_relationships / settingsEstimate
            # given a string -> delete the key, defaults fill.
            _delete_key(raw, loc, etype, value)
            return False
        fill = _missing_fill(canon)
        if fill is not _NO_FILL:
            # required-but-empty-validating subtree (spatialMetadata/glassBox)
            # of the wrong type -> honest-empty replacement, same policy as D.
            _set_leaf(raw, loc, etype, value, "replace wrong-typed subtree with honest-empty fill", fill)
            return False
        return _default_rule(raw, loc, canon, etype, value, prunes)

    # G) Anything else (bool_parsing, extra_forbidden, ...).
    return _default_rule(raw, loc, canon, etype, value, prunes)


def _default_rule(
    raw: dict, loc: tuple, canon: tuple, etype: str, value: Any, prunes: dict[tuple, set[int]]
) -> bool:
    """Walk loc from leaf toward root: delete the first defaulted prefix, or
    prune the first list-item prefix; core or no prunable point -> True
    (unsalvageable -> model chain)."""
    if _is_core(canon):
        return True
    for end in range(len(loc), 0, -1):
        prefix = loc[:end]
        canon_prefix = _canon_loc(prefix)
        if _has_default(canon_prefix):
            _delete_key(raw, prefix, etype, value)
            return False
        if isinstance(prefix[-1], int):
            _register_item_prune(prefix, etype, value, prunes)
            return False
    return True

"""Thin OpenAI-compatible client for Qwen Cloud / DashScope.

Every model call in Engram goes through this module so that: (1) model
IDs are never hardcoded at call sites, (2) a bad response gets one
JSON-repair retry before failing, and (3) token/latency are logged
per call for the benchmark and the cost story in the submission.

Alibaba Cloud proof-of-deployment: all calls target Alibaba's managed
DashScope endpoint (https://dashscope-intl.aliyuncs.com/compatible-mode/v1,
configured in app/config.py) — qwen-vl-max, qwen3.7-max, qwen3.6-flash.
Full deployment evidence (ECS instance, console captures, usage stats):
docs/ALIBABA_CLOUD_PROOF.md
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any

from openai import APIStatusError, APITimeoutError, OpenAI

from app import config

logger = logging.getLogger(__name__)


@dataclass
class CallResult:
    content: str
    model: str
    latency_ms: float
    input_tokens: int
    output_tokens: int


def _client(base_url: str, timeout: float) -> OpenAI:
    return OpenAI(api_key=config.DASHSCOPE_API_KEY, base_url=base_url, timeout=timeout)


def _call(
    messages: list[dict],
    model: str,
    fallback_model: str,
    base_url: str = config.QWEN_BASE_URL,
    json_mode: bool = False,
    max_retries: int = 2,
    timeout: float = 60.0,
) -> CallResult:
    client = _client(base_url, timeout)
    kwargs: dict[str, Any] = {"model": model, "messages": messages}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    last_err: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            start = time.monotonic()
            resp = client.chat.completions.create(**kwargs)
            latency_ms = (time.monotonic() - start) * 1000
            return CallResult(
                content=resp.choices[0].message.content or "",
                model=kwargs["model"],
                latency_ms=latency_ms,
                input_tokens=resp.usage.prompt_tokens if resp.usage else 0,
                output_tokens=resp.usage.completion_tokens if resp.usage else 0,
            )
        except APIStatusError as e:
            last_err = e
            # Model-not-found on the primary ID -> try the documented fallback once.
            if e.status_code == 404 and kwargs["model"] != fallback_model:
                kwargs["model"] = fallback_model
                continue
            if attempt < max_retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            raise
        except APITimeoutError as e:
            # A wedged upstream call; retrying costs another full `timeout`
            # window, so only retry once regardless of max_retries.
            last_err = e
            if attempt == 0:
                continue
            raise
    raise last_err  # pragma: no cover


def chat_text(prompt: str, system: str | None = None, json_mode: bool = False, timeout: float = 40.0) -> CallResult:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    # Default timeout=40.0: callers (mentor chat) budget 90s client-side; a
    # 40s per-attempt ceiling leaves room for one timeout retry (80s worst
    # case) plus recall/DB time. Do NOT change this default — other callers
    # (e.g. Coach's shape-repair path) pass an explicitly shorter timeout
    # instead when a tighter budget is appropriate.
    return _call(messages, config.MODEL_REASONING, config.MODEL_REASONING_FALLBACK, json_mode=json_mode, timeout=timeout)


def chat_fast_stream(prompt: str, system: str | None = None):
    """Yield text deltas for a fast-tier chat completion (mentor chat's SSE path).

    No retry-on-timeout here: once tokens have started reaching the client,
    silently restarting the whole call would duplicate output. A stalled
    stream just surfaces as a client-side abort, same as any dropped feed.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    client = _client(config.QWEN_BASE_URL, timeout=60.0)
    model = config.MODEL_FAST
    try:
        stream = client.chat.completions.create(model=model, messages=messages, stream=True)
    except APIStatusError as e:
        if e.status_code == 404:
            stream = client.chat.completions.create(
                model=config.MODEL_FAST_FALLBACK, messages=messages, stream=True,
            )
        else:
            raise

    for chunk in stream:
        # DashScope sends a trailing usage-only chunk (empty choices) after
        # the final content delta when usage accounting is enabled.
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def chat_fast(prompt: str, system: str | None = None, json_mode: bool = False) -> CallResult:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    # This is the first JSON-repair attempt in Coach's chain, fired after a
    # 60s (x2 on timeout) vision call already ran; keep it tight at 30s + one
    # timeout-retry (60s worst case) so the combined chain stays bounded.
    return _call(
        messages,
        config.MODEL_FAST,
        config.MODEL_FAST_FALLBACK,
        json_mode=json_mode,
        timeout=30.0,
    )


def chat_vision(image_data_uri: str, prompt: str, json_mode: bool = False) -> CallResult:
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_data_uri}},
            ],
        }
    ]
    # Vision calls run slower than text; 60s + one automatic timeout-retry
    # caps this at 120s worst case, still within the frontend's budget once
    # combined with repair-path timeouts below.
    return _call(messages, config.MODEL_VISION, config.MODEL_VISION_FALLBACK, json_mode=json_mode, timeout=60.0)


def _close_truncated_json(raw: str) -> str:
    """Locally repair truncated JSON: close an unterminated string, then close
    unbalanced braces/brackets.

    This targets qwen-vl-plus's measured failure mode (5/6 calls): output that
    degenerates into trailing whitespace with unterminated strings/braces
    (finish_reason=stop, not a token cap). A simple stack scan — tracking
    whether we're inside a string, respecting backslash escapes — recovers
    these at zero latency. Pure function; returns the (possibly) repaired
    string, never raises.
    """
    s = raw.rstrip()
    stack: list[str] = []
    in_string = False
    escaped = False
    for ch in s:
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch in "{[":
            stack.append(ch)
        elif ch == "}":
            if stack and stack[-1] == "{":
                stack.pop()
        elif ch == "]":
            if stack and stack[-1] == "[":
                stack.pop()

    if in_string:
        if escaped:
            # A truncation right after a backslash: complete the escape so the
            # closing quote we append isn't itself escaped.
            s += "\\"
        s += '"'
    elif s.endswith(","):
        # A structural trailing comma (we know we're outside any string) would
        # make the closed-up JSON invalid; drop it.
        s = s[:-1]

    closers = {"{": "}", "[": "]"}
    while stack:
        s += closers[stack.pop()]
    return s


def parse_json_with_repair(raw: str, retry_prompt_fn) -> dict:
    """Parse JSON; try a zero-latency local truncation repair; only then ask
    the model once to repair its own output."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    locally_repaired = _close_truncated_json(raw)
    try:
        result = json.loads(locally_repaired)
        logger.warning(
            "parse_json_with_repair: local JSON-syntax repair succeeded "
            "(raw %d chars -> repaired %d chars); no model repair call needed",
            len(raw), len(locally_repaired),
        )
        return result
    except json.JSONDecodeError:
        pass

    repaired = retry_prompt_fn(raw)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"JSON repair failed. Original (first 500 chars): {raw[:500]!r} | "
            f"Repaired (first 500 chars): {repaired[:500]!r}"
        ) from e

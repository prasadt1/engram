"""Central config for all Qwen model IDs and endpoints.

Model IDs and base URLs are read from the environment so they can be
corrected without a code change once we confirm exact live values in
the Alibaba/Qwen Cloud console (minor versions have been observed to
drift — see docs/superpowers/specs design note on this).
"""

from __future__ import annotations

import os

# --- Qwen Cloud / DashScope connection -------------------------------------

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")

# Pay-as-you-go keys (prefix "sk-") use dashscope-intl.
# Token-plan keys (prefix "sk-sp-") use the maas token-plan host instead.
# Workspace-scoped keys (prefix "sk-ws-", issued by the newer Qwen Cloud
# front-end) are CONFIRMED (live test, 2026-07-03) to route via the standard
# dashscope-intl pay-as-you-go endpoint. scripts/smoke_test_qwen.py verifies
# any key/endpoint pairing empirically if yours differs.
QWEN_BASE_URL = os.environ.get(
    "QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)
QWEN_BASE_URL_TOKEN_PLAN = "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"

# --- Model routing (override via env if the console shows different IDs) ---

MODEL_VISION = os.environ.get("ENGRAM_MODEL_VISION", "qwen-vl-max")
MODEL_REASONING = os.environ.get("ENGRAM_MODEL_REASONING", "qwen3.7-max")
MODEL_FAST = os.environ.get("ENGRAM_MODEL_FAST", "qwen3.6-flash")

# 2025-catalog fallbacks, used automatically by qwen_client on a 404/model-not-found
MODEL_VISION_FALLBACK = "qwen-vl-plus"
MODEL_REASONING_FALLBACK = "qwen3-max"
MODEL_FAST_FALLBACK = "qwen-flash"

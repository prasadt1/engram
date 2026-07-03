"""Confirm the API key + base URL pairing before any real feature work.

Tries the pay-as-you-go endpoint first, then the token-plan endpoint,
against the fast/cheap model, and reports plainly which one to use.
Run: python scripts/smoke_test_qwen.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from app import config  # noqa: E402
from app.qwen_client import _call  # noqa: E402


def try_endpoint(label: str, base_url: str) -> bool:
    print(f"--- trying {label}: {base_url}")
    try:
        result = _call(
            [{"role": "user", "content": "Reply with exactly: ok"}],
            config.MODEL_FAST,
            config.MODEL_FAST_FALLBACK,
            base_url=base_url,
            max_retries=0,
        )
        print(f"    SUCCESS — model={result.model} latency={result.latency_ms:.0f}ms reply={result.content!r}")
        return True
    except Exception as e:  # noqa: BLE001
        print(f"    FAILED — {e}")
        return False


def main() -> None:
    if not config.DASHSCOPE_API_KEY:
        print("No DASHSCOPE_API_KEY found. Copy .env.example to .env and fill it in first.")
        return

    prefix = config.DASHSCOPE_API_KEY.split("-")[0:2]
    print(f"Key prefix detected: {'-'.join(prefix)}-...")

    ok_dashscope = try_endpoint("pay-as-you-go (dashscope-intl)", config.QWEN_BASE_URL)
    if ok_dashscope:
        print("\n=> Use QWEN_BASE_URL as-is (dashscope-intl). No .env change needed.")
        return

    ok_token_plan = try_endpoint("token-plan", config.QWEN_BASE_URL_TOKEN_PLAN)
    if ok_token_plan:
        print("\n=> Set QWEN_BASE_URL to the token-plan URL in your .env:")
        print(f"   QWEN_BASE_URL={config.QWEN_BASE_URL_TOKEN_PLAN}")
        return

    print(
        "\nNeither endpoint accepted this key. Common causes:\n"
        "  - Account/API-key not yet activated (check the Qwen Cloud console)\n"
        "  - Key copied with extra whitespace\n"
        "  - This key belongs to a China-mainland account, not International\n"
        "Paste the exact error text above and we'll diagnose from there."
    )


if __name__ == "__main__":
    main()

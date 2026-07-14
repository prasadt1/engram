"""Stdio launcher for engram-mcp: run this as the `command` of any MCP-aware
Qwen agent's server config to mount recall/forget/get_memory_stats.

Run directly: python scripts/run_mcp_server.py
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from app.db import get_db  # noqa: E402
from app.memory_store import MemoryStore  # noqa: E402
from app.engram_mcp import build_server  # noqa: E402


async def main():
    from mcp.server.stdio import stdio_server

    store = MemoryStore(db=get_db())
    server = build_server(store)
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())

"""engram-mcp: exposes the memory engine as MCP tools any Qwen agent can mount.

Tool functions are plain, testable Python; `build_server()` wraps them in
the MCP SDK's server for actual protocol serving (stdio transport).

Verified against the installed mcp SDK (1.28.1, mcp.server.lowlevel.Server):
the old-style `@server.list_tools()` returning `list[types.Tool]` and
`@server.call_tool()` returning `list[types.TextContent]` are both still
supported call shapes, so the decorator usage below matches the SDK as
installed, not just as documented.
"""

from __future__ import annotations

from typing import Any

from app.memory_store import MemoryStore


def recall_tool(store: MemoryStore, *, user_id: str, query: str, k: int = 5, scope: str | None = None) -> list[dict[str, Any]]:
    # query is genuinely used (relevance term in salience) and every item carries
    # its score breakdown — retrieval is inspectable, not a black box.
    scored = store.recall_scored(user_id=user_id, query=query, scope=scope, k=k)
    return [
        {"id": i.id, "content": i.content, "genre": i.genre, "scores": s}
        for i, s in scored
    ]


def consolidate_tool(store: MemoryStore, *, user_id: str) -> dict[str, Any]:
    # Not mounted on engram-mcp: stub only. Advertising a consolidation pass that
    # does not write memory would be dishonest — use recall / forget /
    # get_memory_stats until a real episodic→semantic pass lands with tests.
    stats = store.get_memory_stats(user_id=user_id)
    return {"eligible_for_consolidation": stats["live_memories"], "note": "consolidation pass not yet applied"}


def forget_tool(store: MemoryStore, *, user_id: str, skill: str) -> dict[str, Any]:
    skill_obj = store.get_skill(user_id=user_id, skill=skill)
    if skill_obj is None:
        return {"forgotten": False, "reason": "no such skill tracked"}
    return {"forgotten": skill_obj.status.value == "cleared", "status": skill_obj.status.value}


def get_memory_stats_tool(store: MemoryStore, *, user_id: str) -> dict[str, Any]:
    return store.get_memory_stats(user_id=user_id)


def _extract_recall_rows(content: list[Any]) -> list[dict[str, Any]]:
    """Flatten MCP recall JSON blocks into {id, content, ...} rows."""
    rows: list[dict[str, Any]] = []
    for block in content:
        if isinstance(block, list):
            rows.extend(_extract_recall_rows(block))
        elif isinstance(block, dict) and "id" in block and "content" in block:
            rows.append(block)
    return rows


def verify_recall_isolation(transcript_log: list[dict[str, Any]]) -> dict[str, Any]:
    """Verify recall tool results use distinct memory IDs per user_id (no leakage)."""
    by_user: dict[str, list[dict[str, Any]]] = {}
    for entry in transcript_log:
        if entry.get("step") != "call_tool" or entry.get("tool") != "recall":
            continue
        uid = entry.get("request", {}).get("user_id")
        if not uid:
            continue
        content = entry.get("response", {}).get("content") or []
        by_user.setdefault(uid, []).extend(_extract_recall_rows(content))

    ids_by_user = {uid: {r["id"] for r in rows} for uid, rows in by_user.items()}
    user_ids = list(ids_by_user.keys())
    overlaps: list[dict[str, Any]] = []
    for i, a in enumerate(user_ids):
        for b in user_ids[i + 1 :]:
            shared = ids_by_user[a] & ids_by_user[b]
            if shared:
                overlaps.append({"users": [a, b], "shared_memory_ids": sorted(shared)})

    stats_by_user: dict[str, Any] = {}
    for entry in transcript_log:
        if entry.get("step") == "call_tool" and entry.get("tool") == "get_memory_stats":
            uid = entry.get("request", {}).get("user_id")
            if uid:
                content = entry.get("response", {}).get("content") or []
                if content and isinstance(content[0], dict):
                    stats_by_user[uid] = content[0]

    return {
        "learner_count": len(user_ids),
        "recall_ids_by_user": {uid: sorted(ids) for uid, ids in ids_by_user.items()},
        "recall_counts_by_user": {uid: len(ids) for uid, ids in ids_by_user.items()},
        "stats_by_user": stats_by_user,
        "shared_memory_ids": overlaps,
        "isolated": len(overlaps) == 0,
    }


def build_server(store: MemoryStore):
    """Wrap the tool functions in an MCP server (stdio). Called by scripts/run_mcp_server.py."""
    from mcp.server import Server
    import mcp.types as types

    server = Server("engram-mcp")

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(name="recall", description="Recall relevant memories for a user, salience-scored (importance x recency x query-relevance), forgetting-aware (superseded items excluded)", inputSchema={
                "type": "object", "properties": {"user_id": {"type": "string"}, "query": {"type": "string"}, "k": {"type": "integer"}, "scope": {"type": "string"}},
                "required": ["user_id", "query"],
            }),
            types.Tool(name="forget", description="Check whether a tracked skill has graduated (its coaching memories retired)", inputSchema={
                "type": "object", "properties": {"user_id": {"type": "string"}, "skill": {"type": "string"}}, "required": ["user_id", "skill"],
            }),
            types.Tool(name="get_memory_stats", description="Memory statistics for a user (live/superseded counts, skills watching/cleared)", inputSchema={
                "type": "object", "properties": {"user_id": {"type": "string"}}, "required": ["user_id"],
            }),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
        import json
        if name == "recall":
            result = recall_tool(store, user_id=arguments["user_id"], query=arguments.get("query", ""), k=arguments.get("k", 5), scope=arguments.get("scope"))
        elif name == "forget":
            result = forget_tool(store, user_id=arguments["user_id"], skill=arguments["skill"])
        elif name == "get_memory_stats":
            result = get_memory_stats_tool(store, user_id=arguments["user_id"])
        else:
            raise ValueError(f"Unknown tool: {name}")
        return [types.TextContent(type="text", text=json.dumps(result, default=str))]

    return server

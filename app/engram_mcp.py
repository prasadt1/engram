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
    # MVP: report what WOULD be consolidated (episodic count -> semantic summary candidate).
    # The full LLM-written consolidation pass is deferred until after the eval harness exists.
    stats = store.get_memory_stats(user_id=user_id)
    return {"eligible_for_consolidation": stats["live_memories"], "note": "consolidation pass not yet applied"}


def forget_tool(store: MemoryStore, *, user_id: str, skill: str) -> dict[str, Any]:
    skill_obj = store.get_skill(user_id=user_id, skill=skill)
    if skill_obj is None:
        return {"forgotten": False, "reason": "no such skill tracked"}
    return {"forgotten": skill_obj.status.value == "cleared", "status": skill_obj.status.value}


def get_memory_stats_tool(store: MemoryStore, *, user_id: str) -> dict[str, Any]:
    return store.get_memory_stats(user_id=user_id)


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
            types.Tool(name="consolidate", description="Report episodic memories eligible for semantic consolidation", inputSchema={
                "type": "object", "properties": {"user_id": {"type": "string"}}, "required": ["user_id"],
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
        elif name == "consolidate":
            result = consolidate_tool(store, user_id=arguments["user_id"])
        elif name == "forget":
            result = forget_tool(store, user_id=arguments["user_id"], skill=arguments["skill"])
        elif name == "get_memory_stats":
            result = get_memory_stats_tool(store, user_id=arguments["user_id"])
        else:
            raise ValueError(f"Unknown tool: {name}")
        return [types.TextContent(type="text", text=json.dumps(result, default=str))]

    return server

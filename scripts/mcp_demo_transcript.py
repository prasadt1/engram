"""Live transcript generator for engram-mcp — multi-learner isolation proof.

Spawns scripts/run_mcp_server.py as a real subprocess (stdio transport) and
drives it with the MCP client SDK against the LIVE database configured in
.env: initialize -> list_tools -> per-learner recall + get_memory_stats +
forget, then an isolation summary showing zero cross-user memory leakage.

Default learners: demo-user (judge seed) + e2e-prasad (manual test fixture).
Override with ENGRAM_MCP_TRANSCRIPT_USERS=demo-user,other-user.

Run: python scripts/mcp_demo_transcript.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from app.engram_mcp import verify_recall_isolation  # noqa: E402

OUTPUT_PATH = os.path.join(REPO_ROOT, "docs", "mcp-transcript.md")

# Per-learner recall queries tuned to likely memory content — not shared.
DEFAULT_LEARNERS: list[dict[str, str]] = [
    {
        "user_id": "demo-user",
        "recall_query": "composition landscape natural light",
        "forget_skill": "composition",
        "label": "Judge demo (composition cleared, lighting watching)",
    },
    {
        "user_id": "e2e-prasad",
        "recall_query": "camera gear photography",
        "forget_skill": "lighting",
        "label": "Secondary fixture (manual test data)",
    },
]


@dataclass(frozen=True)
class LearnerSpec:
    user_id: str
    recall_query: str
    forget_skill: str
    label: str


def _parse_learners() -> list[LearnerSpec]:
    raw = os.environ.get("ENGRAM_MCP_TRANSCRIPT_USERS", "").strip()
    if not raw:
        specs = [LearnerSpec(**d) for d in DEFAULT_LEARNERS]  # type: ignore[arg-type]
        return specs
    ids = [x.strip() for x in raw.split(",") if x.strip()]
    return [
        LearnerSpec(
            user_id=uid,
            recall_query="photography journey",
            forget_skill="composition",
            label=uid,
        )
        for uid in ids
    ]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pretty(obj: Any) -> str:
    return json.dumps(obj, indent=2, default=str)


def verify_isolation(log: list[dict]) -> dict[str, Any]:
    return verify_recall_isolation(log)


async def run_transcript(learners: list[LearnerSpec]) -> list[dict]:
    """Drive the real engram-mcp stdio server; one log entry per exchange."""
    from mcp import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client

    params = StdioServerParameters(
        command=sys.executable,
        args=[os.path.join("scripts", "run_mcp_server.py")],
        env=dict(os.environ),
        cwd=REPO_ROOT,
    )

    log: list[dict] = []

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            t0 = _now_iso()
            init_result = await session.initialize()
            log.append({
                "timestamp": t0,
                "step": "initialize",
                "request": {},
                "response": {
                    "serverInfo": {
                        "name": init_result.serverInfo.name,
                        "version": init_result.serverInfo.version,
                    },
                    "protocolVersion": init_result.protocolVersion,
                },
            })

            t1 = _now_iso()
            tools_result = await session.list_tools()
            log.append({
                "timestamp": t1,
                "step": "list_tools",
                "request": {},
                "response": {
                    "tools": [
                        {"name": t.name, "description": t.description, "inputSchema": t.inputSchema}
                        for t in tools_result.tools
                    ]
                },
            })

            for learner in learners:
                t_recall = _now_iso()
                recall_args = {
                    "user_id": learner.user_id,
                    "query": learner.recall_query,
                    "k": 5,
                }
                recall_result = await session.call_tool("recall", recall_args)
                log.append({
                    "timestamp": t_recall,
                    "step": "call_tool",
                    "tool": "recall",
                    "learner": learner.user_id,
                    "learner_label": learner.label,
                    "request": recall_args,
                    "response": {
                        "isError": recall_result.isError,
                        "content": [json.loads(c.text) for c in recall_result.content],
                    },
                })

                t_stats = _now_iso()
                stats_args = {"user_id": learner.user_id}
                stats_result = await session.call_tool("get_memory_stats", stats_args)
                log.append({
                    "timestamp": t_stats,
                    "step": "call_tool",
                    "tool": "get_memory_stats",
                    "learner": learner.user_id,
                    "learner_label": learner.label,
                    "request": stats_args,
                    "response": {
                        "isError": stats_result.isError,
                        "content": [json.loads(c.text) for c in stats_result.content],
                    },
                })

                t_forget = _now_iso()
                forget_args = {"user_id": learner.user_id, "skill": learner.forget_skill}
                forget_result = await session.call_tool("forget", forget_args)
                log.append({
                    "timestamp": t_forget,
                    "step": "call_tool",
                    "tool": "forget",
                    "learner": learner.user_id,
                    "learner_label": learner.label,
                    "request": forget_args,
                    "response": {
                        "isError": forget_result.isError,
                        "content": [json.loads(c.text) for c in forget_result.content],
                    },
                })

    isolation = verify_isolation(log)
    log.append({
        "timestamp": _now_iso(),
        "step": "isolation_summary",
        "request": {"learners": [l.user_id for l in learners]},
        "response": isolation,
    })
    return log


def render_markdown(log: list[dict], learners: list[LearnerSpec]) -> str:
    lines: list[str] = []
    learner_ids = ", ".join(f"`{l.user_id}`" for l in learners)
    lines.append("# engram-mcp live transcript — multi-learner isolation")
    lines.append("")
    lines.append(
        "Generated by `scripts/mcp_demo_transcript.py` against the LIVE MongoDB "
        "configured in `.env` — a real subprocess speaking the MCP stdio protocol, "
        f"not a mocked call. Learners: {learner_ids}."
    )
    lines.append("")
    lines.append(
        "Track 1 claim: the same `engram-mcp` tools serve any agent for any learner; "
        "memories are scoped by `user_id` with no cross-user leakage."
    )
    lines.append("")
    lines.append(f"Run at: {log[0]['timestamp']}")
    lines.append("")
    lines.append("---")
    lines.append("")

    for entry in log:
        step = entry["step"]
        ts = entry["timestamp"]
        if step == "initialize":
            lines.append(f"## `initialize` — {ts}")
            lines.append("")
            lines.append("Handshake with the engram-mcp stdio server.")
            lines.append("")
            lines.append("**Response:**")
            lines.append("```json")
            lines.append(_pretty(entry["response"]))
            lines.append("```")
        elif step == "list_tools":
            lines.append(f"## `list_tools` — {ts}")
            lines.append("")
            lines.append("Enumerates the tools this server mounts.")
            lines.append("")
            lines.append("**Response:**")
            lines.append("```json")
            lines.append(_pretty(entry["response"]))
            lines.append("```")
        elif step == "call_tool":
            tool = entry["tool"]
            learner = entry.get("learner", "")
            label = entry.get("learner_label", learner)
            lines.append(f"## `call_tool: {tool}` — `{learner}` — {ts}")
            if label and label != learner:
                lines.append("")
                lines.append(f"_{label}_")
            lines.append("")
            lines.append("**Request arguments:**")
            lines.append("```json")
            lines.append(_pretty(entry["request"]))
            lines.append("```")
            lines.append("")
            lines.append("**Response:**")
            lines.append("```json")
            lines.append(_pretty(entry["response"]))
            lines.append("```")
        elif step == "isolation_summary":
            lines.append(f"## Isolation summary — {ts}")
            lines.append("")
            resp = entry["response"]
            if resp.get("isolated"):
                lines.append(
                    "**PASS** — recall returned distinct memory IDs per learner; "
                    "no shared `id` values across users."
                )
            else:
                lines.append(
                    "**FAIL** — shared memory IDs detected between learners "
                    "(see `shared_memory_ids` below)."
                )
            lines.append("")
            lines.append("**Verification:**")
            lines.append("```json")
            lines.append(_pretty(resp))
            lines.append("```")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    if not os.environ.get("MONGODB_URI"):
        print("MONGODB_URI is not set — cannot run live transcript.", file=sys.stderr)
        sys.exit(1)

    learners = _parse_learners()
    log = asyncio.run(run_transcript(learners))
    isolation = log[-1]["response"]
    markdown = render_markdown(log, learners)
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        f.write(markdown)

    status = "PASS" if isolation.get("isolated") else "FAIL"
    print(f"Wrote transcript to {OUTPUT_PATH} ({len(log)} exchanges)")
    print(f"Isolation: {status} — learners={isolation.get('learner_count')}")
    for uid, count in (isolation.get("recall_counts_by_user") or {}).items():
        print(f"  {uid}: {count} recalled memory ids")
    if not isolation.get("isolated"):
        sys.exit(2)


if __name__ == "__main__":
    main()

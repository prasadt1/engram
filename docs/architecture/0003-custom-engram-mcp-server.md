# ADR-0003: Ship a custom MCP server, not just a REST API

**Status:** Accepted (2026-07-03)

## Context

The memory engine (salience-scored recall, progress-driven supersession,
skill graduation) is Engram's actual differentiation for Track 1
(MemoryAgent). The rubric weights Innovation and Technical Depth at 30%
each — both reward demonstrable API/protocol sophistication, not just a
working feature behind a REST endpoint. A REST API alone proves the
feature works; it doesn't prove the memory layer is *reusable by other
agents*, which is the stronger MemoryAgent story.

## Decision

Build `engram-mcp`: a real MCP server (stdio transport, MCP SDK v1.28+)
exposing typed `recall` / `forget` / `get_memory_stats`
tools — not a REST wrapper relabeled as MCP. Ship a `?via=mcp` production
route that round-trips a real request through the actual MCP subprocess
(not a mocked stand-in), and commit a live protocol transcript
(`docs/mcp-transcript.md`) as judge-facing proof it isn't ornamental.

## Alternatives considered

- **Just the REST API** — simpler, faster to build, but leaves "MemoryAgent"
  as a label on a CRUD service rather than a demonstrated capability any
  Qwen agent could mount.
- **An MCP server that only re-exports the REST handlers with no new
  behavior** — an early review round flagged exactly this risk ("ornamental
  MCP" — `recall()` ignored the `query` parameter entirely). Fixed by adding
  real relevance scoring (`_relevance()`, token-overlap with a floor)
  before calling the MCP surface done.

## Consequences

- Extra surface to keep correct under load: the `via=mcp` path needed its
  own timeout handling (`asyncio.wait_for(15.0)`) after a reviewer
  reproduced an actual indefinite hang, and its own container-env fix
  (`stdio_client`'s child process gets a sanitized env by default, not a
  copy of the parent's — breaks Mongo URI propagation in Docker without an
  explicit `env=dict(os.environ)`).
- The payoff: the demo can show a literal "Serve via engram-mcp" button
  round-tripping a real subprocess speaking the real protocol, live, not a
  slide claiming MCP support.

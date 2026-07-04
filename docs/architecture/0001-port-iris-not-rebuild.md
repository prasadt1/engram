# ADR-0001: Port Iris into a new product, not build from a blank repo

**Status:** Accepted (2026-07-03)

## Context

Iris Photography Mentor already existed — a Google ADK + Gemini + MongoDB
photography coach built for a prior Google Cloud hackathon. This hackathon
targets Track 1 (MemoryAgent) on Qwen Cloud + Alibaba Cloud. The question
was whether to port Iris or design a fresh product idea from scratch, given
~6 days solo.

An independent multi-agent scoring panel evaluated four candidate ideas —
the Iris port, an Agent-Society concept, a Showrunner concept, and an
Autopilot concept — against feasibility, differentiation, and how well each
maxed the judging rubric (Innovation 30% / Technical Depth 30% /
Problem-Impact 25% / Presentation 15%).

## Decision

Port Iris, reframed as **Engram**: a forgetting-aware memory engine for Qwen
agents, with the photography coach as the flagship demo rather than the
whole product. New repo, new name, new UI polish, new memory engine — but
~55-65% of Iris's schema, routes, and frontend scaffolding is reused
deliberately, freeing build time for the part that actually drives the
score: the memory engine and its benchmark.

## Alternatives considered

- **Agent-Society, Showrunner, Autopilot** (fresh concepts) — scored 68.4,
  67.1, 65.1 respectively vs. the port's 81.8 weighted score. All three
  carried materially higher feasibility risk within the timeframe.
- **Build fresh but unrelated to Iris** — rejected on the same feasibility
  grounds; re-deriving Mongo schema, auth, upload pipeline, and frontend
  scaffolding from zero would have consumed days that the memory engine
  needed.

## Consequences

- Full lineage disclosure is mandatory and was built into the submission
  from day one (Devpost "New, lineage disclosed" + a disclosure paragraph),
  not treated as a risk to hide.
- The port freed Day 4-5 entirely for the memory engine, `engram-mcp`, and
  the frozen eval harness — the actual scoring surface — instead of basic
  plumbing.
- Risk accepted: a judge skimming the repo could mistake this for "just
  reskinned Iris." Mitigated by making the memory engine, MCP server, and
  benchmark the loudest things in the README, demo video, and Devpost page
  — see [ADR-0003](0003-custom-engram-mcp-server.md).

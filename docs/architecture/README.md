# Architecture Decision Records

This folder records the decisions behind Engram that weren't obvious calls —
the ones with a real alternative on the table, evidence that drove the
choice, and consequences worth knowing before changing them. Each ADR is a
snapshot of reasoning at a point in time, not a claim that it's still the
only right answer; if a decision gets reversed, add a new ADR rather than
editing history.

Format: lightweight — Context, Decision, Alternatives considered,
Consequences. No ceremony beyond that.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-port-iris-not-rebuild.md) | Port Iris into a new product, not build from a blank repo | Accepted |
| [0002](0002-keep-mongodb-atlas.md) | Keep MongoDB Atlas as the memory store | Accepted |
| [0003](0003-custom-engram-mcp-server.md) | Ship a custom MCP server, not just a REST API | Accepted |
| [0004](0004-deploy-payg-without-verification.md) | Deploy on Alibaba ECS pay-as-you-go without waiting on identity verification | Accepted |
| [0005](0005-serve-frontend-same-origin.md) | Serve the SPA same-origin from the API container, not a separate frontend host | Accepted |
| [0006](0006-fast-tier-model-for-chat.md) | Mentor chat uses the fast model tier, not the reasoning tier | Accepted |
| [0007](0007-https-via-caddy.md) | HTTPS via Caddy + a real subdomain, not bare-IP HTTP | Accepted |
| [0008](0008-stream-chat-via-sse.md) | Stream mentor chat replies token-by-token over SSE | Accepted |

See also [`../architecture.svg`](../architecture.svg) for the system diagram these decisions produced.

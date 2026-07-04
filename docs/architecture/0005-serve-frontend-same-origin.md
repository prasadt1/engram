# ADR-0005: Serve the SPA same-origin from the API container, not a separate frontend host

**Status:** Accepted (2026-07-04)

## Context

Iris's frontend was hosted separately on Vercel, calling a Cloud Run
backend over HTTPS. The natural instinct was to reuse that pattern for
Engram: Vercel for the React app, Alibaba ECS for the API. But the ECS
instance was initially reachable only over plain HTTP on a bare IP (see
[ADR-0007](0007-https-via-caddy.md) for the later HTTPS fix) — and a
Vercel-hosted page is always served over HTTPS. A browser blocks an HTTPS
page from calling an HTTP API as mixed content; that combination would
never have worked regardless of CORS configuration.

## Decision

Build the frontend into the same Docker image as the API (multi-stage
Dockerfile: a Node stage runs `vite build`, the Python stage copies
`dist/` in) and serve it from FastAPI via `StaticFiles`, mounted last so
every API route takes precedence. One container, one origin, one URL.

## Alternatives considered

- **Keep Vercel, wait for HTTPS on the backend** — technically viable once
  ADR-0007 landed, but adds a second deploy target, a second place for
  drift between what judges see and what's running, and a CORS surface
  that same-origin serving eliminates outright.
- **A separate nginx/static host on the same box** — more moving parts for
  no real benefit over letting the same FastAPI process serve both; the
  app is small enough that StaticFiles has no measurable cost.

## Consequences

- `docker-compose.yml` needed a `./data` volume so uploaded/seeded photos
  survive container rebuilds (previously irrelevant when the frontend and
  its assets lived on Vercel).
- Local dev is unaffected: `frontend/dist` only exists in the built image,
  so local development keeps using Vite's own dev server on :5173 against
  the API on :8000, with the SPA mount silently skipped when the directory
  is absent.
- Judges get exactly one URL to remember, with the API and app
  inseparable by construction — no risk of "the frontend is down but the
  API is fine" during judging.

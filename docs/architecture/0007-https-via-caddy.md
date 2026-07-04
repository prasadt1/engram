# ADR-0007: HTTPS via Caddy + a real subdomain, not bare-IP HTTP

**Status:** Accepted (2026-07-04)

## Context

The judge URL initially served plain HTTP on the ECS instance's bare IP
(`http://8.222.253.211:8080`). Certificate authorities — Let's Encrypt
included — issue TLS certificates for hostnames, not bare IP addresses;
this is fundamental to the CA/TLS trust model, not a configuration gap. No
domain name meant no cert meant no HTTPS, full stop. (It's also the reason
[ADR-0005](0005-serve-frontend-same-origin.md) rejected an HTTPS Vercel
frontend calling this HTTP backend: browsers block that as mixed content.)

## Decision

Point a subdomain of an already-owned Namecheap domain
(`engram.prasadtilloo.com`) at the ECS IP via an A record, then run Caddy
as a second container in front of the app, reverse-proxying to it. Caddy
auto-provisions and renews a Let's Encrypt certificate from the Caddyfile's
domain name alone — no manual cert handling, no ACME client to babysit.

## Alternatives considered

- **`sslip.io`/`nip.io` wildcard DNS** (`8-222-253-211.sslip.io`) — zero
  setup, no domain purchase needed. Not used only because a real,
  already-owned domain was available and reads better in front of judges
  than a raw-IP-encoding hostname.
- **Manual nginx + certbot** — equivalent end state, more moving parts and
  manual renewal cron-job risk versus Caddy's built-in automatic renewal.
- **Leave it on HTTP** — genuinely fine for judging (Devpost demos are
  routinely bare-IP HTTP; this was a polish decision, not a functional
  gap) but low-risk, ~20-minute effort for a real padlock in the demo
  video.

## Consequences

- Two containers now, not one: `docker-compose.yml` gained a `caddy`
  service with `caddy_data`/`caddy_config` volumes so the issued
  certificate survives container recreation (only rebuilding the volumes
  from scratch would trigger re-issuance).
- Security-group rules for 80 and 443 had to be opened explicitly (only
  8080 was open post-ADR-0004); Caddy uses port 80 for the ACME HTTP-01
  challenge, so the redirect path had to be verified, not assumed.
- The original bare-IP `:8080` URL was deliberately kept live as a
  DNS/TLS-independent fallback — if the domain or cert ever breaks, the
  judge URL isn't a single point of failure.

# ADR-0004: Deploy on Alibaba ECS pay-as-you-go without waiting on identity verification

**Status:** Accepted (2026-07-04)

## Context

Alibaba Cloud's intl identity verification queue rejected the account
holder's Indian passport against his German residence address, with no
listed document category for a residence permit — and support timelines
quoted multiple business days. With a July 9 deadline, waiting on
verification before deploying risked losing 2-3 of the remaining ~5 build
days to a support queue outside the team's control.

## Decision

Test whether plain pay-as-you-go ECS resource creation was actually gated
by the same verification that blocks free-credit claims, rather than
assuming it was. It wasn't — an Economy-e instance in `ap-southeast-1`
(Singapore) was created successfully despite the verification rejection
remaining open. Deployed the full stack there immediately, and continued
pursuing verification (driving-license resubmission) in parallel, decoupled
from the deployment critical path.

## Alternatives considered

- **Wait for verification before provisioning anything** — the "safe"
  default, and the one that would have cost the most build time for a
  constraint that turned out not to apply.
- **Deploy on a different cloud (e.g. a generic VPS) and only prove Alibaba
  usage via OSS/DashScope code paths** — would have satisfied the letter of
  "uses Alibaba Cloud" but not the spirit, and Track submissions are
  evaluated in part on Alibaba Cloud usage as infrastructure, not just API
  calls.

## Consequences

- Deployment happened on Day 1 of the remaining build window instead of
  blocking on a queue with no committed SLA.
- The verification gate itself remains open as an account-standing issue,
  unrelated to and no longer blocking the submission — tracked separately,
  not re-litigated here.
- This is now a documented, repeatable finding (not a one-off guess): free
  credits and PAYG resource creation are gated independently on Alibaba
  Cloud intl accounts. Worth checking early on any future time-boxed
  Alibaba Cloud project rather than assuming the gates are the same.

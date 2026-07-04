# ADR-0002: Keep MongoDB Atlas as the memory store

**Status:** Accepted (2026-07-03)

## Context

Iris used MongoDB Atlas for its document store. Moving to Alibaba Cloud
raised the question of whether to migrate to an Alibaba-native database
(e.g. Tair/Redis-compatible, ApsaraDB for MongoDB, or a document store on
OSS) to lean harder into the "built on Alibaba Cloud" story.

## Decision

Keep the same Atlas cluster, with a fresh `engram` database. Swap only the
object storage layer (GCS → Alibaba OSS) and the model API (Gemini →
Qwen/DashScope) for Alibaba-proof surface area.

## Alternatives considered

- **Migrate to ApsaraDB for MongoDB** — same wire protocol, would satisfy
  "more Alibaba services used," but a live data migration mid-hackathon
  risks corrupting the exact skill-graduation and supersession state the
  demo depends on, for a benefit that's cosmetic (the judging rubric
  rewards Qwen-API sophistication and memory-engine design, not vendor
  lock-in breadth).
- **Move memory into a purpose-built vector/graph store** — rejected as
  scope creep; the memory engine's differentiation is the salience +
  supersession logic, not the storage substrate, and MongoDB's document
  model already fits `MemoryItem`/`Skill` cleanly.

## Consequences

- One less migration to get wrong under deadline pressure; the memory
  engine's correctness (recall scoring, graduation state machine) was
  provable against production-like data from day one instead of a fresh,
  untested store.
- The submission is explicit about this rather than hiding it: OSS and
  DashScope are the two Alibaba-service code paths documented in
  `docs/ALIBABA_CLOUD_PROOF.md`; MongoDB is disclosed as reused
  infrastructure, not claimed as new Alibaba usage.
- Revisit if a future track specifically scores database-vendor breadth —
  not the case here.

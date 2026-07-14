# Gallery stack-rail rewrite

**Date:** 2026-07-15  
**Direction:** Right rail = fixed tech stack; footer = narrative + receipt + HOW.

## Layout

| Zone | Content |
|------|---------|
| Left | Screenshot (unchanged) |
| Right | **UNDER THIS SCREEN** — FRONTEND · API · MEMORY · DATA · INFRA (5 rows; 1–2 amber accents per frame) |
| Footer | Takeaway title + body + amber receipt number + mono HOW chip |
| 05 | Dark architecture poster — **not regenerated** |

## Rails (as rendered)

### 00 · judge-entry
- FRONTEND React 19 · Home + judge banner *(accent)*
- API `GET /api/v1/journey` *(accent)*
- MEMORY Seeded recall on entry
- DATA portfolio_entries · skills
- INFRA Alibaba ECS · Caddy TLS  
Footer receipt: **16** photos · 7.5/10 mentor read · `GET /api/v1/journey`

### 01 · home
- FRONTEND React 19 · threads + mentor-read
- API `GET /api/v1/journey` *(accent)*
- MEMORY Salience across past shoots *(accent)*
- DATA portfolio_entries
- INFRA Alibaba ECS · Caddy TLS  
Footer: **7** photos: 5.9 → 7.5 · `GET /api/v1/journey`

### 02 · my-work
- FRONTEND React 19 · contact-sheet grid
- API `GET /api/v1/portfolio/search` *(accent)*
- MEMORY Photo-scoped indexes
- DATA portfolio_entries *(accent)*
- INFRA Alibaba ECS · /media  
Footer: **16** photos · Avg 6.7 · 100% · `GET /api/v1/portfolio/search`

### 03 · mentor
- FRONTEND React 19 · SSE mentor chat
- API `POST /api/v1/chat (SSE)` *(accent)*
- MEMORY Token-budget packing + receipt *(accent)*
- DATA memory_items
- INFRA Alibaba ECS · qwen3.6-flash  
Footer: **8** recalled · packed under 1200 tokens · `build_memory_context(k=8, token_budget=1200)`

### 04 · proof-room
- FRONTEND React 19 · Memory Proof Room
- API Live stats · MCP toggle
- MEMORY Supersession · FAMA *(accent)*
- DATA memory_items · eval JSON *(accent)*
- INFRA Alibaba ECS · frozen /eval  
Footer: **1.00** vs 0.64 (never-forgets) · `eval/run.py · compute_fama()`

### 06 · photo-detail
- FRONTEND React 19 · photo + scoped chat
- API Chat scoped to this photo
- MEMORY `recall(scope=storageKey)` *(accent)*
- DATA portfolio · memory_items
- INFRA Alibaba ECS · /media  
Footer: **1** recalled · packed under 1200 tokens · `recall(scope=storageKey)`

## Files
- `tools/devpost-gallery/screens.json` — stack cards + `receipt`/`how`
- `tools/devpost-gallery/compositor.py` — stack rail + caption strip
- Local only: `docs/devpost-public/annotated-{00,01,02,03,04,06}-*.png`

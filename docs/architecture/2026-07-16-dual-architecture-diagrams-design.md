# Dual architecture diagrams — design

**Date:** 2026-07-16  
**Status:** Approved for planning  
**Repo:** engram (Qwen / Alibaba hackathon)

## Goal

Judges reading the Devpost article need a **readable context diagram** at article width. Engineers / depth-scorers need a **zoomable data-flow diagram** on GitHub. One generator, two modes — no third competing poster.

## Decisions (locked)

| # | Decision |
|---|---|
| Split | Article = simple context; GitHub = upgrade of today’s dense poster into real data-flow |
| Article shape | Vertical directional flow + **Memory Engine** as hero band mid-stack |
| Logos | Full set: React, Python/FastAPI, Alibaba Cloud, Qwen, MongoDB, MCP, Caddy, Docker |
| Themes | Cream for article inline; dark for gallery |
| GitHub deliverable | SVG source of truth + HTML zoom viewer under `docs/architecture/` |
| Implementation approach | Extend existing `tools/devpost-gallery/architecture.html` (two export modes) |
| Doc updates | Update assets, `docs/architecture/README.md`, `docs/BLOG-POST.md`, **and** `docs/DEVPOST-DRAFT.md` (image + “full-scale →” link) |

## Asset map

| Mode | Artifacts | Consumers |
|------|-----------|-----------|
| `context` | Cream PNG → `docs/media/devpost-inline-architecture.png`; dark PNG → `docs/devpost-public/annotated-05-architecture.png` (+ standalone crop) | Devpost / blog inline; media gallery |
| `flow` | `docs/architecture/system-flow.svg` (source of truth) + `system-flow.html` (embeds SVG, CSS zoom/pan) | GitHub “Full-scale data-flow” link |

No optional third context SVG. No separate flow PNG unless gallery later needs it (not in this plan).

## Article context diagram (mode `context`)

Readable at ~700px wide. Big labels only; no fine-print model/collection dump.

```
React SPA  (Home · Mentor · Proof Room)          [React]
        ↓
FastAPI + agents on Alibaba Cloud ECS            [Python, Alibaba, Caddy, Docker]
  Coach · Mentor · Reflection · engram-mcp       [MCP]
        ↓
★ MEMORY ENGINE — the product
  salience · graduation · supersession · packing
        ↓
Qwen Cloud                    |  MongoDB Atlas   [Qwen] [MongoDB]
```

Caption under image (article + DEVPOST-DRAFT + BLOG-POST):

> Full-scale data-flow diagram → [`docs/architecture/`](https://github.com/prasadt1/engram/tree/main/docs/architecture)

## Deep data-flow diagram (mode `flow`)

Same system boxes as today’s dense poster, but **arrows are request paths**, not decoration.

**Primary — Coach upload**  
SPA upload → FastAPI → Memory Engine (recall + pack) → `qwen-vl-max` → scores + “what I learned” → writes `portfolio_entries` / `memory_items` / `skills` → Home / My Work refresh.

**Secondary — Mentor chat**  
SPA chat → FastAPI → Memory Engine (scoped recall) → `qwen2.5-flash` → SSE stream → Memory Receipt.

**Side paths**  
Reflection → Home journey line · MCP stdio (recall / forget / stats) · Proof Room `/eval` (FAMA) as dashed evidence rail · originals → ECS `/media`.

Zoomed view must show: model names, collection names, graduation / supersession callouts (the detail Devpost cannot render).

## Generator + capture (canonical pipeline)

**Two render surfaces, one brand system** (dark charcoal, gold Memory Engine accent, cream alternate — no new design language):

| Surface | Format | Why |
|---------|--------|-----|
| Context (article / gallery) | HTML/CSS in `tools/devpost-gallery/architecture.html` | Matches existing Playwright capture; easy logos + cream/dark |
| Flow (GitHub depth) | **SVG file** `docs/architecture/system-flow.svg` + thin HTML wrapper | Real SVG zoom on GitHub; not a fake “export” from CSS cards |

**Mode / theme contract (single mechanism):**  
`architecture.html?mode=context&theme=cream|dark`  
Capture scripts must use this query string only (no parallel build-flag dialect).

**Capture scripts (canonical — replace dual pipelines):**

1. **Cream inline:** extend `tools/devpost-gallery/capture-architecture-light.mjs` → also copy/write `docs/media/devpost-inline-architecture.png` (today it only writes `annotated-05-architecture-light.png`).
2. **Dark gallery:** `tools/devpost-gallery/capture-architecture.mjs` loads `architecture.html?mode=context&theme=dark` → `annotated-05-architecture.png` + `standalone-05-architecture.png`.
3. **Retire for gallery:** `scripts/build-architecture-diagram.py` → `docs/architecture-visual.png` and `screens.json` `architecturePng: "docs/architecture-visual.png"`. Point gallery architecture slot at the Playwright dark capture (`annotated-05` / `standalone-05`) instead. Leave the Python script in tree only if still useful for experiments; README marks it superseded for Devpost gallery.

**Flow SVG authoring:** hand-maintain (or generate once from a dedicated SVG template sibling — not a screenshot-to-SVG hack) `system-flow.svg` with the Coach / Mentor / side paths above. `system-flow.html` is a viewer that embeds that SVG (zoom/pan CSS or native browser zoom). Updating flow content means editing the SVG; HTML is not a second diagram.

**Legacy disposition:** mark `docs/architecture.svg` and `docs/architecture-dark.svg` **superseded** in `docs/architecture/README.md` (link to `system-flow.svg` / context PNG). Do not regenerate them in this work unless trivial; avoid two “full” diagrams on GitHub.

## Docs updates

1. **`docs/architecture/README.md`** — top section before ADR index: Context diagram · Full data-flow (SVG + HTML) · then ADRs. Point `See also` at the new SVG/HTML instead of (or in addition to) legacy `../architecture.svg`.
2. **`docs/BLOG-POST.md`** — ensure cover/inline uses new cream PNG; add full-scale link line.
3. **`docs/DEVPOST-DRAFT.md`** — same image URL + link line under “How I built it” architecture embed. (File is gitignored; still edit so the paste into Devpost matches.)
4. Legacy `docs/architecture.svg` / `architecture-dark.svg` — mark superseded in README; point to `system-flow.svg` + context PNG.

## Out of scope

- Demo video / iPhone shoot (separate track).
- Changing runtime architecture or ADRs’ decisions.
- Interactive zoom beyond a simple HTML viewer (no new app dependency).
- A third “JJ / eval-only” poster for the article body.

## Success criteria

1. At Devpost article width, a judge can read every label on the context diagram without zoom.
2. Clicking the article link opens `docs/architecture/` and finds SVG + HTML data-flow with Coach + Mentor paths.
3. Gallery architecture slot remains dark and on-brand.
4. Logos listed above appear on the context diagram without cluttering the Memory Engine hero band.

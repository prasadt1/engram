# Engram DevPost gallery — upload plan

Generated **2026-07-13** from prod (`engram.prasadtilloo.com/?judge=1`).

## Regenerate everything

```bash
cd engram
node tools/devpost-gallery/capture-architecture.mjs
node tools/devpost-gallery/capture-architecture-light.mjs
cd tools/devpost-gallery && node capture.mjs
cd ../.. && .venv/bin/python tools/devpost-gallery/render.py batch --variant split
```

**Layout:** 80/20 split — full viewport screenshot left (`contain`, no crop), compact tech rail right. Captures at **1680×1050** @2× DPR. Architecture uses Playwright context captures (`docs/media/devpost-gallery-architecture.png`); the Python builder is superseded for Devpost gallery.

Raw screenshots: `docs/devpost-screenshots/` (gitignored).  
Composited gallery assets: `docs/devpost-public/` (gitignored).  
Inline story embeds (committed): `docs/media/devpost-inline-*.png`.

## What to upload (recommended order)

DevPost gallery accepts up to **15** images.

| # | File (from `docs/devpost-public/`) | Gallery title | Caption |
|---|------|---------------|---------|
| 1 | `standalone-01-home.png` or `annotated-01-home.png` | Home — remembered library | Hero mentor-read, genre memory threads, skill graduation — portfolio memory across sessions. |
| 2 | `standalone-02-my-work.png` or `annotated-02-my-work.png` | My Work — contact sheet | Library grid + style stats; open any frame for Glass Box critique. |
| 3 | `annotated-04-proof-room.png` | Memory Proof Room | Canon→Sony forgetting story, live counts, FAMA benchmark — same recall() as the coach. |
| 4 | `annotated-03-mentor.png` | Mentor — memory-aware chat | Hand-rolled tool loop + engram-mcp; recalls what matters, retires stale facts. |
| 5 | `standalone-06-photo-detail.png` | Photo detail — narration | Per-frame mentor read + Memory Receipt on a real critique. |
| 6 | `annotated-05-architecture.png` | Architecture | Qwen Cloud · ECS · MongoDB · engram-mcp · frozen /eval. |
| 7 | `standalone-00-judge-entry.png` | Judge mode entry | `?judge=1` lands on Home with Track 1 banner + 90-second walkthrough CTA. |

**Lead image:** `annotated-01-home.png` or `standalone-01-home.png`.

## File tiers

| Tier | Prefix | Use |
|------|--------|-----|
| A | `standalone-*` | DevPost gallery upload — lossless UI |
| B | `annotated-*` | Article inline embeds — UI + UNDER THE HOOD cards |
| C | `docs/media/devpost-inline-*` | Page 3 GitHub raw embeds (committed) |

## Also commit

- `docs/alibaba-console-running.png` — ECS deployment proof panel for `ALIBABA_CLOUD_PROOF.md`

## Honesty notes

- Captures use **judge demo** (`demo-user`). Tour overlays dismissed; screen 00 keeps the judge banner visible.
- Seeded Unsplash photos may show AI-estimate exposure labels — fresh phone uploads show real EXIF.

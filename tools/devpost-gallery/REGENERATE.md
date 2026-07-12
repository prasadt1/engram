# Regenerating Devpost gallery images

## Deploy gate (read before final batch)

Production must be on current `main` (Home unify + spotlight tour). Confirm
`git log -1` on ECS matches origin before a final capture batch — otherwise
gallery PNGs immortalize old UI.

## Prerequisites

```bash
# From repo root
cd tools/devpost-gallery
npm install
npm run install-browser

# Compositor uses repo venv Pillow + frontend fonts
cd ../..
python3 -m venv .venv   # if needed
.venv/bin/pip install Pillow
```

`rsvg-convert` (librsvg) is required for architecture screen 05 SVG → PNG.

## Workflow

If prod returns empty `imageUrl` for demo-user (missing ECS volume files), run
`./scripts/sync_demo_media_to_ecs.sh` from repo root first.

The built SPA may bake `VITE_API_BASE_URL=http://localhost:8000`; for local
captures with full API data, run `uvicorn app.server:app --port 8000` and:

```bash
node capture.mjs --base "http://127.0.0.1:8000/?judge=1"
```

```bash
# 1. Capture raw screenshots (read-only against production)
cd tools/devpost-gallery
node capture.mjs                    # all screens
node capture.mjs --screen 01        # single screen

# 2. Preview screen 01 in BOTH layout variants (pick one)
cd ../..
.venv/bin/python tools/devpost-gallery/render.py preview --screen 01

# 3. After layout pick — batch compose (example: split)
.venv/bin/python tools/devpost-gallery/render.py batch --variant split
```

Outputs land in `docs/devpost-public/` (composed) and
`docs/devpost-screenshots/` (raw + standalone). Both dirs are gitignored.

`DEVPOST-GALLERY.md` is written beside the PNGs when batching.

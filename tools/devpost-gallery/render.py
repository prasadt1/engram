#!/usr/bin/env python3
"""CLI for Engram Devpost gallery compositor."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compositor import (  # noqa: E402
    OUT_DIR,
    export,
    load_config,
    load_screens,
    write_devpost_gallery_md,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose Devpost gallery PNGs")
    sub = parser.add_subparsers(dest="command")

    preview_p = sub.add_parser("preview", help="Render one screen in BOTH layout variants")
    preview_p.add_argument("--screen", required=True, help="Screen id or slug (e.g. 01)")

    batch_p = sub.add_parser("batch", help="Render all screens in one variant")
    batch_p.add_argument("--variant", choices=["split", "band"], default="split")
    batch_p.add_argument("--screen", help="Optional single screen")

    args = parser.parse_args()
    cfg = load_config()
    screens = load_screens(cfg)

    if args.command == "preview":
        targets = [s for s in screens if s.id == args.screen or s.slug == args.screen]
        if not targets:
            parser.error(f"Unknown screen {args.screen}")
        screen = targets[0]
        path, _ = export(screen, "split", preview=True)
        print(f"Wrote {path}")
        print("\nSplit layout preview — band variant dropped per feedback.")
        return

    if args.command == "batch":
        targets = screens
        if args.screen:
            targets = [s for s in screens if s.id == args.screen or s.slug == args.screen]
        for screen in targets:
            if screen.id == "06":
                shot = (
                    Path(__file__).resolve().parents[2]
                    / "docs/devpost-screenshots"
                    / f"standalone-{screen.id}-{screen.slug}.png"
                )
                if not shot.is_file():
                    print(f"Skipping optional {screen.id} (no capture)")
                    continue
            try:
                ann, stand = export(screen, args.variant)
                print(f"Wrote {ann} + {stand.name}")
            except FileNotFoundError as e:
                print(f"SKIP {screen.id}: {e}")
        write_devpost_gallery_md(screens, args.variant)
        print(f"\nWrote {OUT_DIR / 'DEVPOST-GALLERY.md'}")
        return

    parser.print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the themed DashScope usage proof panel from a console capture."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "docs" / "proof-raw" / "qwen-model-usage.png"
OUT = ROOT / "docs" / "qwen-dashscope-usage.png"

BG = "#111827"
PANEL = "#1f2b3f"
PILL = "#0d1524"
BORDER = "#40506a"
TEXT = "#f4f1ec"
MUTED = "#a8b1c1"
VIOLET = "#a78bfa"
AMBER = "#f59e0b"

SERIF = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
MONO = "/System/Library/Fonts/Menlo.ttc"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def pill(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    *,
    accent: str | None = None,
) -> int:
    f = font(SANS_BOLD, 13)
    left = 12
    dot = 9 if accent else 0
    width = int(draw.textlength(text, font=f)) + left * 2 + dot
    draw.rounded_rectangle((x, y, x + width, y + 29), 6, fill=PILL, outline=BORDER, width=1)
    if accent:
        draw.ellipse((x + 11, y + 11, x + 18, y + 18), fill=accent)
        draw.text((x + 24, y + 7), text, font=f, fill=TEXT)
    else:
        draw.text((x + left, y + 7), text, font=f, fill=TEXT)
    return x + width + 9


def build(source: Path) -> None:
    RAW.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != RAW.resolve():
        shutil.copy2(source, RAW)

    capture = Image.open(RAW).convert("RGB")
    # Remove the global console header while retaining Model Usage filters,
    # aggregate graph, and the official Top Models table.
    crop = capture.crop((0, 64, capture.width, min(capture.height, 620)))

    canvas = Image.new("RGB", (1024, 768), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((25, 14), "Qwen Cloud · DashScope usage proof", font=font(SERIF, 27), fill=TEXT)
    draw.text(
        (25, 51),
        "MODEL STUDIO  ·  ONLINE INFERENCE  ·  LAST 20 DAYS",
        font=font(MONO, 11),
        fill=AMBER,
    )

    screen_box = (25, 70, 999, 609)
    draw.rounded_rectangle(screen_box, 11, fill="#0b1220", outline=BORDER, width=1)
    fitted = ImageOps.contain(crop, (958, 523), Image.Resampling.LANCZOS)
    sx = 33 + (958 - fitted.width) // 2
    sy = 78 + (523 - fitted.height) // 2
    canvas.paste(fitted, (sx, sy))

    draw.rounded_rectangle((25, 619, 999, 744), 9, fill=PANEL, outline=BORDER, width=1)
    draw.rectangle((25, 619, 30, 744), fill=VIOLET)
    draw.text((43, 633), "CALL STATISTICS (LAST 20 DAYS)", font=font(MONO, 10), fill=VIOLET)

    x = 43
    for label in ("Models 4", "Calls 1,188", "Tokens 2.395M", "Avg/req 2,016"):
        x = pill(draw, x, 650, label)

    x = 43
    for label, color in (
        ("qwen3.6-flash 863", VIOLET),
        ("qwen3.7-max 174", "#46c2b3"),
        ("qwen-vl-max 145", "#d05bb5"),
        ("qwen-vl-plus 6 · benchmark", "#5b8def"),
    ):
        x = pill(draw, x, 686, label, accent=color)

    draw.text(
        (25, 754),
        "API-KEY filter = All  ·  no secret key shown  ·  official model table visible",
        font=font(MONO, 8),
        fill=MUTED,
    )
    canvas.save(OUT, quality=95)
    print(f"copied raw capture → {RAW.relative_to(ROOT)}")
    print(f"wrote themed panel → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="DashScope Model Usage screenshot")
    build(parser.parse_args().source)

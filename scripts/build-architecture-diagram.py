#!/usr/bin/env python3
"""Build a visual, icon-forward architecture diagram for DevPost gallery.

Replaces the text-heavy docs/architecture.svg with a dark-theme composited
PNG: brand logos, short labels, flow arrows — no bullet paragraphs.

  python3 scripts/build-architecture-diagram.py
  # → docs/architecture-visual.png (3840×2160)
  # → docs/devpost-screenshots/engram-architecture.png (capture input)
"""
from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "assets" / "devpost-icons"
FONT_ROOT = ROOT / "frontend" / "node_modules" / "@fontsource"
OUT_VISUAL = ROOT / "docs" / "architecture-visual.png"
OUT_CAPTURE = ROOT / "docs" / "devpost-screenshots" / "engram-architecture.png"
OUT_SVG_LEGACY = ROOT / "docs" / "architecture.png"  # smaller companion

W, H = 3840, 2160
BG = "#1a1816"
PANEL = "#211f1c"
BORDER = "#3f3a36"
AMBER = "#f59e0b"
CREAM = "#e8e0d6"
CREAM_MID = "#a8a29e"
CREAM_DIM = "#78716c"
MONGO = "#47A248"
QWEN = "#6C5CE7"
ALIBABA = "#FF6A00"
FASTAPI = "#009688"


def _font(size: int, *, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    if mono:
        for p in ("/System/Library/Fonts/Menlo.ttc", "/Library/Fonts/Arial.ttf"):
            try:
                return ImageFont.truetype(p, size=size)
            except OSError:
                pass
    for family, weight in (("newsreader", "700" if bold else "400"), ("dm-sans", "700" if bold else "500")):
        p = FONT_ROOT / family / "files" / f"{family}-latin-{weight}-normal.woff2"
        if p.is_file():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.truetype("/Library/Fonts/Arial.ttf", size=size)


def _icon_png(name: str, size: int = 88) -> Image.Image | None:
    svg = ICON_DIR / f"{name}.svg"
    if not svg.is_file():
        return None
    cache = ICON_DIR / f".cache-{name}-{size}.png"
    if not cache.exists() or cache.stat().st_mtime < svg.stat().st_mtime:
        subprocess.run(
            ["rsvg-convert", "-w", str(size), "-h", str(size), str(svg), "-o", str(cache)],
            check=True,
            capture_output=True,
        )
    return Image.open(cache).convert("RGBA")


def _rounded_rect(draw: ImageDraw.ImageDraw, xy: tuple, r: int, fill: str, outline: str | None = None, width: int = 2) -> None:
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def _center_text(draw: ImageDraw.ImageDraw, box: tuple, text: str, font, fill: str, y_offset: int = 0) -> None:
    x0, y0, x1, y1 = box
    tw = draw.textlength(text, font=font)
    th = font.size
    draw.text((x0 + (x1 - x0 - tw) / 2, y0 + (y1 - y0 - th) / 2 + y_offset), text, font=font, fill=fill)


def _draw_node(
    base: Image.Image,
    box: tuple[int, int, int, int],
    *,
    icons: list[str],
    title: str,
    subtitle: str = "",
    accent: str = BORDER,
    glow: bool = False,
) -> None:
    x0, y0, x1, y1 = box
    draw = ImageDraw.Draw(base)
    fill = "#1f1d18" if glow else PANEL
    _rounded_rect(draw, box, 20, fill, accent, 3 if glow else 2)
    if glow:
        draw.rectangle((x0 + 2, y0 + 16, x0 + 8, y1 - 16), fill=accent)

    cx = (x0 + x1) // 2
    icon_y = y0 + 36
    icon_size = 72 if len(icons) == 1 else 56
    total_w = len(icons) * icon_size + (len(icons) - 1) * 12
    ix = cx - total_w // 2
    for name in icons:
        ic = _icon_png(name, icon_size)
        if ic:
            base.paste(ic, (ix, icon_y), ic)
            ix += icon_size + 12

    title_font = _font(34, bold=True)
    sub_font = _font(22, mono=True)
    title_y = icon_y + icon_size + 28
    tw = draw.textlength(title, font=title_font)
    draw.text((cx - tw / 2, title_y), title, font=title_font, fill=CREAM)
    if subtitle:
        sw = draw.textlength(subtitle, font=sub_font)
        draw.text((cx - sw / 2, title_y + 42), subtitle, font=sub_font, fill=CREAM_MID)


def _draw_arrow(draw: ImageDraw.ImageDraw, p0: tuple, p1: tuple, color: str = CREAM_DIM, width: int = 3) -> None:
    draw.line([p0, p1], fill=color, width=width)
    # simple arrowhead
    import math

    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ang = math.atan2(dy, dx)
    L = 18
    for a in (2.6, -2.6):
        ax = p1[0] - L * math.cos(ang + a)
        ay = p1[1] - L * math.sin(ang + a)
        draw.line([p1, (ax, ay)], fill=color, width=width)


def _draw_layer_label(draw: ImageDraw.ImageDraw, x: int, y: int, label: str) -> None:
    f = _font(20, mono=True)
    draw.text((x, y), label.upper(), font=f, fill=CREAM_DIM)


def _draw_metric_pill(draw: ImageDraw.ImageDraw, x: int, y: int, text: str) -> int:
    f = _font(24, bold=True)
    pad_x = 28
    tw = draw.textlength(text, font=f)
    w = int(tw) + pad_x * 2
    _rounded_rect(draw, (x, y, x + w, y + 52), 26, "#2a2318", AMBER, 2)
    draw.text((x + pad_x, y + 12), text, font=f, fill=AMBER)
    return w


def build() -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Header
    logo = _icon_png("react", 56)  # placeholder until we add engram mark
    mark_path = ROOT / "frontend" / "public" / "engram-mark.png"
    if mark_path.is_file():
        mark = Image.open(mark_path).convert("RGBA").resize((56, 56), Image.Resampling.LANCZOS)
        img.paste(mark, (80, 56), mark)
    draw.text((150, 58), "engram", font=_font(48, bold=True), fill=CREAM)
    draw.text((150, 108), "Architecture", font=_font(28, mono=True), fill=CREAM_MID)
    draw.text((80, 160), "Forgetting-aware memory coach · Qwen Cloud · MongoDB Atlas · Alibaba Cloud", font=_font(24), fill=CREAM_DIM)

    # Metric pills (visual proof, not paragraphs)
    px = W - 80
    for pill in ("FAMA 1.00", "1.72× fewer tokens", "Track 1: MemoryAgent"):
        tw = draw.textlength(pill, font=_font(24, bold=True)) + 56
        px -= tw + 16
        _draw_metric_pill(draw, px, 72, pill)

    # Alibaba boundary
    cloud_box = (320, 280, 2920, 1780)
    _rounded_rect(draw, cloud_box, 28, "#1a1816", ALIBABA, 3)
    draw.rectangle((cloud_box[0] + 3, cloud_box[1] + 3, cloud_box[2] - 3, cloud_box[1] + 56), fill="#241a12")
    ic_alibaba = _icon_png("alibabacloud", 40)
    if ic_alibaba:
        img.paste(ic_alibaba, (cloud_box[0] + 24, cloud_box[1] + 10), ic_alibaba)
    draw.text((cloud_box[0] + 76, cloud_box[1] + 16), "Alibaba Cloud · ECS Singapore · Docker", font=_font(26, bold=True), fill=ALIBABA)

    _draw_layer_label(draw, 80, 300, "Client")
    _draw_node(img, (80, 340, 520, 580), icons=["react", "vite"], title="React SPA", subtitle="Vite · Tailwind", accent=CREAM_DIM)

    _draw_layer_label(draw, 620, 300, "API")
    _draw_node(img, (600, 340, 1040, 580), icons=["fastapi", "python"], title="FastAPI", subtitle="REST · SSE chat", accent=FASTAPI)

    # Agents row
    _draw_layer_label(draw, 80, 640, "Agents · Qwen")
    agent_w = 520
    agents = [
        ((80, 680, 80 + agent_w, 920), ["python"], "Coach", "qwen-vl-max · vision", QWEN),
        ((640, 680, 640 + agent_w, 920), ["python"], "Mentor", "qwen3.6-flash · chat", QWEN),
        ((1200, 680, 1200 + agent_w, 920), ["python"], "Reflection", "qwen3.6-flash", QWEN),
    ]
    for box, icons, title, sub, accent in agents:
        _draw_node(img, box, icons=icons, title=title, subtitle=sub, accent=accent)

    # Memory hero
    _draw_layer_label(draw, 80, 980, "Memory")
    _draw_node(
        img,
        (80, 1020, 1640, 1320),
        icons=["mongodb"],
        title="Memory engine",
        subtitle="recall · graduate · supersede · pack",
        accent=AMBER,
        glow=True,
    )

    _draw_node(img, (1680, 1020, 2140, 1320), icons=["python"], title="engram-mcp", subtitle="stdio · recall tools", accent=AMBER, glow=True)

    _draw_node(img, (2180, 1020, 2640, 1320), icons=["docker"], title="Caddy + Docker", subtitle="TLS · compose", accent=CREAM_DIM)

    # External services column
    _draw_layer_label(draw, 2760, 300, "Data & models")
    _draw_node(img, (2740, 340, 3180, 620), icons=["mongodb"], title="MongoDB Atlas", subtitle="memories · portfolio", accent=MONGO)
    _draw_node(img, (3220, 340, 3660, 620), icons=["alibabacloud"], title="Alibaba OSS", subtitle="signed URLs", accent=ALIBABA)

    # Qwen cloud - custom badge (no simple-icon)
    qbox = (2740, 680, 3660, 980)
    draw = ImageDraw.Draw(img)
    _rounded_rect(draw, qbox, 20, "#1a1628", QWEN, 3)
    draw.rectangle((qbox[0] + 2, qbox[1] + 16, qbox[0] + 8, qbox[3] - 16), fill=QWEN)
    _center_text(draw, (qbox[0], qbox[1] + 40, qbox[2], qbox[1] + 120), "Qwen Cloud", _font(40, bold=True), CREAM)
    models = ["qwen-vl-max", "qwen3.7-max", "qwen3.6-flash"]
    my = qbox[1] + 150
    mf = _font(26, mono=True)
    for m in models:
        pill_w = int(draw.textlength(m, font=mf)) + 48
        px = qbox[0] + (qbox[2] - qbox[0] - pill_w) // 2
        _rounded_rect(draw, (px, my, px + pill_w, my + 48), 24, "#241e38", QWEN, 1)
        draw.text((px + 24, my + 10), m, font=mf, fill=CREAM_MID)
        my += 62

    # Eval badge
    _draw_node(img, (2740, 1040, 3660, 1320), icons=["python"], title="/eval benchmark", subtitle="26 traces · FAMA", accent=AMBER)

    # Arrows
    draw = ImageDraw.Draw(img)
    _draw_arrow(draw, (520, 460), (600, 460), AMBER)
    _draw_arrow(draw, (820, 580), (340, 680), CREAM_DIM)
    _draw_arrow(draw, (820, 580), (900, 680), CREAM_DIM)
    _draw_arrow(draw, (820, 580), (1460, 680), CREAM_DIM)
    for ax in (340, 900, 1460):
        _draw_arrow(draw, (ax, 920), (860, 1020), CREAM_DIM)
    _draw_arrow(draw, (1640, 1170), (1680, 1170), AMBER)
    _draw_arrow(draw, (1040, 460), (2740, 480), MONGO)
    _draw_arrow(draw, (860, 1320), (860, 1500), CREAM_DIM)  # down to strip

    # Bottom logo strip
    strip_y = 1860
    _rounded_rect(draw, (80, strip_y, W - 80, H - 100), 24, PANEL, BORDER, 2)
    draw.text((120, strip_y + 36), "Stack", font=_font(22, mono=True), fill=CREAM_DIM)
    logos = ["react", "vite", "fastapi", "python", "docker", "mongodb", "alibabacloud"]
    lx = 220
    for name in logos:
        ic = _icon_png(name, 64)
        if ic:
            img.paste(ic, (lx, strip_y + 28), ic)
            lx += 88
    # Qwen pill in strip
    draw.rounded_rectangle((lx + 20, strip_y + 36, lx + 200, strip_y + 92), radius=28, fill="#241e38", outline=QWEN, width=2)
    draw.text((lx + 48, strip_y + 52), "Qwen", font=_font(28, bold=True), fill=QWEN)
    lx += 240

    draw.text((120, strip_y + 130), "github.com/prasadt1/engram  ·  Apache-2.0  ·  built on Iris foundation", font=_font(22, mono=True), fill=CREAM_DIM)

    # Flow legend
    draw.text((W - 520, strip_y + 50), "→  request flow", font=_font(22, mono=True), fill=CREAM_DIM)
    draw.line([(W - 640, strip_y + 62), (W - 540, strip_y + 62)], fill=AMBER, width=4)

    return img


def main() -> None:
    img = build()
    OUT_VISUAL.parent.mkdir(parents=True, exist_ok=True)
    OUT_CAPTURE.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_VISUAL, format="PNG", compress_level=1)
    img.save(OUT_CAPTURE, format="PNG", compress_level=1)
    # Smaller PNG for README / inline
    thumb = img.resize((1600, 900), Image.Resampling.LANCZOS)
    thumb.save(OUT_SVG_LEGACY, format="PNG", optimize=True)
    print(f"Wrote {OUT_VISUAL} ({img.width}×{img.height})")
    print(f"Wrote {OUT_CAPTURE}")
    print(f"Wrote {OUT_SVG_LEGACY} (1600×900 companion)")


if __name__ == "__main__":
    main()

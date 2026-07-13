#!/usr/bin/env python3
"""Fill-by-construction Devpost gallery compositor (3840×2160).

Variant A (split): mockup left ~80%, tech panel right ~20%.
Variant B (band): full-width screenshot top, tech cards in bottom strip.
"""

from __future__ import annotations

import json
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
TOOL = Path(__file__).resolve().parent
CONFIG_PATH = TOOL / "screens.json"
SHOT_DIR = ROOT / "docs" / "devpost-screenshots"
OUT_DIR = ROOT / "docs" / "devpost-public"
FONT_ROOT = ROOT / "frontend" / "node_modules" / "@fontsource"
LOGO_MARK = ROOT / "frontend" / "public" / "engram-mark.png"

# Theme tokens
BG = "#141210"
BG_PANEL = "#1a1816"
BG_CARD = "#211f1c"
AMBER = "#f59e0b"
CREAM = "#e7e5e4"
CREAM_MID = "#a8a29e"
CREAM_DIM = "#78716c"
BORDER = "#44403c"
MONGO = "#47A248"
QWEN = "#6C5CE7"
ALIBABA = "#FF6A00"

CANVAS_W = 3840
CANVAS_H = 2160
PAD = 56
GUTTER = 48
HEADER_H = 156
CAPTION_H = 180
BROWSER_CHROME_H = 54
MIN_GAP = 120  # acceptance: no void taller than this
# Screenshot dominates the frame; the tech panel is a narrow right rail.
LEFT_RATIO = 0.80

Variant = Literal["split", "band"]


@dataclass
class TechCard:
    label: str
    title: str
    detail: str
    accent: str = "default"


@dataclass
class Screen:
    id: str
    slug: str
    tag: str
    title: str
    url_bar: str
    takeaway_title: str
    takeaway_body: str
    chips: list[str]
    cards: list[TechCard]
    gallery_title: str
    gallery_caption: str
    fit_mode: str = "contain"
    layout: str = "split"


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text())


def load_screens(cfg: dict[str, Any]) -> list[Screen]:
    out: list[Screen] = []
    for s in cfg["screens"]:
        out.append(
            Screen(
                id=s["id"],
                slug=s["slug"],
                tag=s["tag"],
                title=s["title"],
                url_bar=s["urlBar"],
                takeaway_title=s["takeawayTitle"],
                takeaway_body=s["takeawayBody"],
                chips=s["chips"],
                cards=[TechCard(**c) for c in s["cards"]],
                gallery_title=s["galleryTitle"],
                gallery_caption=s["galleryCaption"],
                fit_mode=s.get("fitMode", "contain"),
                layout=s.get("layout", "split"),
            )
        )
    return out


def _font_path(family: str, weight: str) -> Path:
    return FONT_ROOT / family / "files" / f"{family}-latin-{weight}-normal.woff2"


def load_font(size: int, *, mono: bool = False, serif: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont:
    if mono:
        for path in ("/System/Library/Fonts/Menlo.ttc", "/Library/Fonts/Arial.ttf"):
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    if serif:
        path = _font_path("newsreader", "700" if bold else "400")
    else:
        path = _font_path("dm-sans", "700" if bold else "500")
    if path.is_file():
        return ImageFont.truetype(str(path), size=size)
    fallback = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf" if serif else "/Library/Fonts/Arial.ttf"
    return ImageFont.truetype(fallback, size=size)


def load_logo(height: int) -> Image.Image:
    logo = Image.open(LOGO_MARK).convert("RGBA")
    scale = height / logo.height
    nw = max(1, int(logo.width * scale))
    return logo.resize((nw, height), Image.Resampling.LANCZOS)


def accent_colors(accent: str) -> tuple[str, str | None]:
    if accent == "amber":
        return AMBER, AMBER
    if accent == "mongo":
        return MONGO, MONGO
    if accent == "qwen":
        return QWEN, QWEN
    if accent == "alibaba":
        return ALIBABA, ALIBABA
    return BORDER, None


def round_rect(draw: ImageDraw.ImageDraw, xy: tuple, radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def fit_contain(img: Image.Image, w: int, h: int, *, bg: str = BG_PANEL, align: str = "center") -> Image.Image:
    """Scale entire screenshot to fit — no cropping (sidebar + journey stay visible)."""
    img = img.convert("RGB")
    scale = min(w / img.width, h / img.height)
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (w, h), bg)
    ox = (w - nw) // 2 if align == "center" else 0
    oy = (h - nh) // 2
    canvas.paste(resized, (ox, oy))
    return canvas


def wrap_px(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def fill_cover(img: Image.Image, w: int, h: int) -> Image.Image:
    """Scale-to-fill: crop overflow at edges (never letterbox)."""
    img = img.convert("RGB")
    scale = max(w / img.width, h / img.height)
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return resized.crop((left, top, left + w, top + h))


def _card_detail_lines(draw: ImageDraw.ImageDraw, card: TechCard, w: int, fonts: dict) -> list[str]:
    return wrap_px(draw, card.detail, fonts["card_detail"], w - 48 - 20)


def measure_card(draw: ImageDraw.ImageDraw, card: TechCard, w: int, fonts: dict) -> int:
    pad = 18
    detail_lines = _card_detail_lines(draw, card, w, fonts)
    lh_label, lh_title, lh_detail = 26, 40, 28
    return pad * 2 + lh_label + 8 + lh_title + 8 + max(lh_detail, len(detail_lines) * lh_detail)


def draw_card(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, card: TechCard, fonts: dict) -> int:
    pad = 18
    detail_lines = _card_detail_lines(draw, card, w, fonts)
    lh_label, lh_title, lh_detail = 26, 40, 28
    h = pad * 2 + lh_label + 8 + lh_title + 8 + max(lh_detail, len(detail_lines) * lh_detail)
    border, glow = accent_colors(card.accent)
    fill = BG_CARD if card.accent == "default" else "#1f1d18"
    round_rect(draw, (x, y, x + w, y + h), 12, fill, border if glow else BORDER, 2 if glow else 1)
    inset = pad + (8 if glow else 0)
    ty = y + pad
    draw.text((x + inset, ty), card.label, font=fonts["card_label"], fill=CREAM_DIM if not glow else glow)
    ty += lh_label + 8
    draw.text((x + inset, ty), card.title, font=fonts["card_title"], fill=CREAM)
    ty += lh_title + 8
    for line in detail_lines:
        draw.text((x + inset, ty), line, font=fonts["card_detail"], fill=CREAM_MID)
        ty += lh_detail
    return h


def draw_header(canvas: Image.Image, screen: Screen, fonts: dict) -> None:
    draw = ImageDraw.Draw(canvas)
    logo_h = 52
    logo = load_logo(logo_h)
    logo_y = PAD - 2
    canvas.paste(logo, (PAD, logo_y), logo)
    text_x = PAD + logo.width + 20
    draw.text((text_x, logo_y - 2), "engram", font=fonts["wordmark"], fill=CREAM)
    # Extra vertical gap so the eyebrow line doesn't jam under the wordmark.
    draw.text((text_x, logo_y + 54), "MEMORY-FIRST PHOTO MENTOR · QWEN", font=fonts["badge"], fill=AMBER)
    title_w = draw.textlength(screen.title, font=fonts["title"])
    draw.text((CANVAS_W - PAD - title_w, PAD - 8), screen.title, font=fonts["title"], fill=CREAM)
    tag = f"SCREEN {screen.id} · {screen.tag}"
    tag_w = draw.textlength(tag, font=fonts["screen_tag"])
    draw.text((CANVAS_W - PAD - tag_w, PAD + 66), tag, font=fonts["screen_tag"], fill=CREAM_DIM)


def draw_browser_shot(
    base: Image.Image,
    box: tuple[int, int, int, int],
    screenshot: Image.Image,
    url: str,
    fonts: dict,
    *,
    fit_mode: str = "contain",
) -> None:
    x0, y0, x1, y1 = box
    draw = ImageDraw.Draw(base)
    round_rect(draw, (x0, y0, x1, y1), 14, BG_PANEL, BORDER, 2)
    bar_h = BROWSER_CHROME_H
    round_rect(draw, (x0 + 1, y0 + 1, x1 - 1, y0 + bar_h), 12, "#242120")
    dot_cy = y0 + bar_h // 2
    dot_r = 8
    for i, c in enumerate(["#ef4444", "#f59e0b", "#22c55e"]):
        cx = x0 + 22 + i * 26
        draw.ellipse((cx - dot_r, dot_cy - dot_r, cx + dot_r, dot_cy + dot_r), fill=c)
    url_x = x0 + 22 + 3 * 26 + 18
    url_w = x1 - url_x - 18
    url_bar_top = y0 + 10
    url_bar_bot = y0 + bar_h - 10
    round_rect(draw, (url_x, url_bar_top, url_x + url_w, url_bar_bot), 10, BG, BORDER, 1)
    url_font = fonts["url"]
    ub = draw.textbbox((0, 0), url, font=url_font)
    url_text_y = url_bar_top + (url_bar_bot - url_bar_top - (ub[3] - ub[1])) // 2 - ub[1]
    draw.text((url_x + 16, url_text_y), url, font=url_font, fill=CREAM)
    inner_x, inner_y = x0 + 3, y0 + bar_h + 2
    inner_w, inner_h = x1 - x0 - 6, y1 - y0 - bar_h - 4
    if fit_mode == "cover":
        fitted = fill_cover(screenshot, inner_w, inner_h)
    else:
        fitted = fit_contain(screenshot, inner_w, inner_h, align="top")
    base.paste(fitted, (inner_x, inner_y))


def draw_caption_bar(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], screen: Screen, fonts: dict) -> None:
    x0, y0, x1, y1 = box
    round_rect(draw, (x0, y0, x1, y1), 14, "#1f1d18", BORDER, 1)
    draw.rectangle((x0, y0, x0 + 7, y1), fill=AMBER)
    tx = x0 + 40
    text_w = x1 - tx - 40
    ty = y0 + 30
    draw.text((tx, ty), screen.takeaway_title, font=fonts["caption_title"], fill=CREAM)
    ty += 66
    for line in wrap_px(draw, screen.takeaway_body, fonts["caption_body"], text_w):
        draw.text((tx, ty), line, font=fonts["caption_body"], fill=CREAM_MID)
        ty += 42


def draw_chip_row(draw: ImageDraw.ImageDraw, x: int, y: int, max_w: int, chips: list[str], fonts: dict) -> int:
    tx = x
    row_h = 44
    for chip in chips:
        tw = draw.textlength(chip, font=fonts["tag"]) + 28
        if tx + tw > x + max_w and tx > x:
            tx = x
            y += row_h + 10
        accent = AMBER if any(k.lower() in chip.lower() for k in ("memory", "mcp", "judge", "fama", "receipt")) else BORDER
        round_rect(draw, (tx, y, tx + tw, y + row_h), 10, BG_CARD, accent, 1)
        draw.text((tx + 14, y + 10), chip, font=fonts["tag"], fill=CREAM if accent == AMBER else CREAM_MID)
        tx += tw + 12
    return y + row_h


def distribute_cards_vertical(
    draw: ImageDraw.ImageDraw,
    x: int,
    y0: int,
    w: int,
    y1: int,
    cards: list[TechCard],
    fonts: dict,
) -> None:
    """Modest capped gaps; stack centered vertically so cards keep their
    natural height instead of stretching into tall boxes."""
    max_gap = 34
    heights = [measure_card(draw, c, w, fonts) for c in cards]
    total_cards = sum(heights)
    n_gaps = max(1, len(cards) - 1)
    available = y1 - y0 - total_cards
    gap = min(max_gap, max(16, available // n_gaps))
    stack_h = total_cards + gap * (len(cards) - 1)
    cy = y0 + max(0, (y1 - y0 - stack_h) // 2)
    for card, h in zip(cards, heights):
        draw_card(draw, x, cy, w, card, fonts)
        cy += h + gap


def distribute_cards_horizontal(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y: int,
    x1: int,
    h: int,
    cards: list[TechCard],
    fonts: dict,
) -> None:
    n = len(cards)
    gutter = 20
    total_w = x1 - x0
    card_w = (total_w - gutter * (n - 1)) // n
    cx = x0
    for card in cards:
        # compact cards for band strip
        pad = 16
        border, glow = accent_colors(card.accent)
        round_rect(draw, (cx, y, cx + card_w, y + h), 10, BG_CARD, border if glow else BORDER, 1)
        inset = pad + (6 if glow else 0)
        ty = y + pad
        draw.text((cx + inset, ty), card.label, font=fonts["card_label_sm"], fill=CREAM_DIM if not glow else glow)
        ty += 24
        for line in textwrap.wrap(card.title, width=22):
            draw.text((cx + inset, ty), line, font=fonts["card_title_sm"], fill=CREAM)
            ty += 28
        ty += 4
        for line in textwrap.wrap(card.detail, width=28):
            draw.text((cx + inset, ty), line, font=fonts["card_detail_sm"], fill=CREAM_MID)
            ty += 22
        cx += card_w + gutter


def build_split(screen: Screen, screenshot: Image.Image, fonts: dict) -> Image.Image:
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG)
    draw_header(canvas, screen, fonts)
    draw = ImageDraw.Draw(canvas)

    content_top = HEADER_H + 8
    content_bottom = CANVAS_H - PAD
    content_w = CANVAS_W - PAD * 2
    left_x0 = PAD

    # 80/20 split — screenshot dominant, tech panel a narrow rail.
    usable = content_w - GUTTER
    left_w = int(usable * LEFT_RATIO)
    left_x1 = left_x0 + left_w
    right_x0 = left_x1 + GUTTER
    right_x1 = CANVAS_W - PAD
    right_w = right_x1 - right_x0

    caption_top = content_bottom - CAPTION_H
    browser_bottom = caption_top - 12
    browser_box = (left_x0, content_top, left_x1, browser_bottom)
    draw_browser_shot(canvas, browser_box, screenshot, screen.url_bar, fonts, fit_mode=screen.fit_mode)
    draw_caption_bar(draw, (left_x0, caption_top, left_x1, content_bottom), screen, fonts)

    # Right rail — title, flex cards, chips pinned bottom
    draw.text((right_x0, content_top + 4), "UNDER THE HOOD", font=fonts["section"], fill=AMBER)
    draw.text((right_x0, content_top + 40), "FRONT → BACK", font=fonts["section_sub"], fill=CREAM_DIM)
    chips_h = 80
    cards_top = content_top + 72
    cards_bottom = content_bottom - chips_h - 20
    distribute_cards_vertical(draw, right_x0, cards_top, right_w, cards_bottom, screen.cards, fonts)
    draw_chip_row(draw, right_x0, content_bottom - chips_h, right_w, screen.chips, fonts)

    return canvas


def build_architecture(screen: Screen, diagram: Image.Image, fonts: dict) -> Image.Image:
    """Full-canvas architecture screen — the diagram IS the content, so no
    browser frame and no separate tech column. Header + big diagram + caption."""
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG)
    draw_header(canvas, screen, fonts)
    draw = ImageDraw.Draw(canvas)

    content_top = HEADER_H + 8
    content_bottom = CANVAS_H - PAD
    caption_top = content_bottom - 120
    diagram_bottom = caption_top - 8

    panel = (PAD, content_top, CANVAS_W - PAD, diagram_bottom)
    px0, py0, px1, py1 = panel
    round_rect(draw, panel, 16, BG_PANEL, BORDER, 2)
    inner_w, inner_h = px1 - px0 - 8, py1 - py0 - 8
    fitted = fit_contain(diagram, inner_w, inner_h, bg=BG_PANEL, align="center")
    canvas.paste(fitted, (px0 + 4, py0 + 4))

    # Caption + chips share the bottom bar.
    round_rect(draw, (PAD, caption_top, CANVAS_W - PAD, content_bottom), 14, "#1f1d18", BORDER, 1)
    draw.rectangle((PAD, caption_top, PAD + 7, content_bottom), fill=AMBER)
    tx = PAD + 40
    ty = caption_top + 30
    draw.text((tx, ty), screen.takeaway_title, font=fonts["caption_title"], fill=CREAM)
    ty += 66
    draw.text((tx, ty), screen.takeaway_body, font=fonts["caption_body"], fill=CREAM_MID)
    draw_chip_row(draw, CANVAS_W - PAD - 900, content_bottom - 66, 860, screen.chips, fonts)

    return canvas


def build_band(screen: Screen, screenshot: Image.Image, fonts: dict) -> Image.Image:
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG)
    draw_header(canvas, screen, fonts)
    draw = ImageDraw.Draw(canvas)

    content_top = HEADER_H + 8
    content_bottom = CANVAS_H - PAD
    content_w = CANVAS_W - PAD * 2

    strip_h = 320
    caption_in_strip = 96
    cards_h = strip_h - caption_in_strip - 24
    shot_bottom = content_bottom - strip_h - 16
    shot_box = (PAD, content_top, CANVAS_W - PAD, shot_bottom)
    draw_browser_shot(canvas, shot_box, screenshot, screen.url_bar, fonts, fit_mode=screen.fit_mode)

    strip_y0 = shot_bottom + 16
    strip_y1 = content_bottom
    round_rect(draw, (PAD, strip_y0, CANVAS_W - PAD, strip_y1), 14, BG_PANEL, BORDER, 2)

    takeaway_y = strip_y0 + 16
    draw.text((PAD + 20, takeaway_y), screen.takeaway_title, font=fonts["caption_title_sm"], fill=CREAM)
    ty = takeaway_y + 44
    line = screen.takeaway_body
    if len(line) > 140:
        line = line[:137] + "…"
    draw.text((PAD + 20, ty), line, font=fonts["caption_body_sm"], fill=CREAM_MID)

    cards_y = strip_y0 + caption_in_strip
    distribute_cards_horizontal(draw, PAD + 16, cards_y, CANVAS_W - PAD - 16, cards_y + cards_h, screen.cards, fonts)

    chip_y = strip_y1 - 52
    draw_chip_row(draw, PAD + 16, chip_y, content_w - 32, screen.chips, fonts)

    return canvas


def make_fonts() -> dict:
    return {
        "badge": load_font(20, mono=True),
        "screen_tag": load_font(22, mono=True),
        "title": load_font(68, serif=True, bold=True),
        "section": load_font(24, mono=True, bold=True),
        "section_sub": load_font(18, mono=True),
        "wordmark": load_font(34, bold=True),
        "url": load_font(18, mono=True),
        "card_label": load_font(22, mono=True, bold=True),
        "card_title": load_font(34, serif=True, bold=True),
        "card_detail": load_font(22, mono=True),
        "caption_title": load_font(44, serif=True, bold=True),
        "caption_body": load_font(28),
        "caption_title_sm": load_font(32, serif=True, bold=True),
        "caption_body_sm": load_font(24),
        "card_label_sm": load_font(18, mono=True),
        "card_title_sm": load_font(24, serif=True, bold=True),
        "card_detail_sm": load_font(20, mono=True),
        "tag": load_font(22, mono=True, bold=True),
    }


def screenshot_path(screen: Screen) -> Path:
    p = SHOT_DIR / f"standalone-{screen.id}-{screen.slug}.png"
    if not p.is_file():
        raise FileNotFoundError(f"Missing capture: {p}\nRun: cd tools/devpost-gallery && node capture.mjs --screen {screen.id}")
    return p


def compose(screen: Screen, variant: Variant) -> Image.Image:
    fonts = make_fonts()
    shot = Image.open(screenshot_path(screen))
    if screen.layout == "architecture":
        return build_architecture(screen, shot, fonts)
    if variant == "split":
        return build_split(screen, shot, fonts)
    return build_band(screen, shot, fonts)


def write_devpost_gallery_md(screens: list[Screen], variant: Variant) -> None:
  lines = [
    "# Devpost gallery — Engram",
    "",
    "Regenerate: see `tools/devpost-gallery/REGENERATE.md`.",
    "",
    "| File | Gallery title | Caption | Tags |",
    "|------|---------------|---------|------|",
  ]
  for s in screens:
    fname = f"annotated-{s.id}-{s.slug}.png"
    tags = " · ".join(s.chips)
    cap = s.gallery_caption.replace("|", "\\|")
    lines.append(f"| `{fname}` | {s.gallery_title} | {cap} | {tags} |")
  lines.append("")
  lines.append(f"Layout variant: **{variant}**")
  (OUT_DIR / "DEVPOST-GALLERY.md").write_text("\n".join(lines))


def export(screen: Screen, variant: Variant, *, preview: bool = False) -> tuple[Path, Path]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img = compose(screen, variant)
    if preview:
        annotated = OUT_DIR / f"preview-{screen.id}-{screen.slug}-variant-{variant}.png"
    else:
        annotated = OUT_DIR / f"annotated-{screen.id}-{screen.slug}.png"
    standalone_src = screenshot_path(screen)
    standalone = OUT_DIR / f"standalone-{screen.id}-{screen.slug}.png"
    img.save(annotated, format="PNG", optimize=True)
    if standalone.resolve() != standalone_src.resolve():
        standalone.write_bytes(standalone_src.read_bytes())
    return annotated, standalone

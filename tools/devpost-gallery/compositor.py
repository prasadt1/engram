#!/usr/bin/env python3
"""Fill-by-construction Devpost gallery compositor (3840×2160).

Variant A (split): mockup left ~80%, tech panel right ~20%.
Variant B (band): full-width screenshot top, tech cards in bottom strip.
"""

from __future__ import annotations

import json
import re
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
BG_CODE = "#161412"
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
# Larger header/caption so chrome stays readable when Devpost shows
# gallery thumbs (~¼–⅓ screen width).
HEADER_H = 180
CAPTION_H = 300
BROWSER_CHROME_H = 58
MIN_GAP = 120  # acceptance: no void taller than this
# Screenshot dominates the frame; the tech panel is a narrow right rail.
LEFT_RATIO = 0.80

Variant = Literal["split", "band"]

# Fixed 5-layer stack on the right rail (order matters).
LAYER_LABELS = {
    "frontend": "FRONTEND",
    "api": "API",
    "memory": "MEMORY",
    "data": "DATA",
    "infra": "INFRA",
}

_FIRST_NUM = re.compile(r"(\d+(?:\.\d+)?)")


@dataclass
class TechCard:
    """One stack row: branded tech + detail + optional icons."""

    role: str
    brand: str
    detail: str
    icons: list[str]
    accent: bool = False


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
    receipt: str = ""
    how: str = ""
    caption_h: int | None = None


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text())


def load_screens(cfg: dict[str, Any]) -> list[Screen]:
    out: list[Screen] = []
    for s in cfg["screens"]:
        cards: list[TechCard] = []
        for c in s["cards"]:
            # Support legacy {role,text} during migration, prefer brand/detail
            brand = c.get("brand") or c.get("text", "")
            detail = c.get("detail", "")
            cards.append(
                TechCard(
                    role=c["role"],
                    brand=brand,
                    detail=detail,
                    icons=list(c.get("icons") or []),
                    accent=bool(c.get("accent", False)),
                )
            )
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
                cards=cards,
                gallery_title=s["galleryTitle"],
                gallery_caption=s["galleryCaption"],
                fit_mode=s.get("fitMode", "contain"),
                layout=s.get("layout", "split"),
                receipt=s.get("receipt", ""),
                how=s.get("how", ""),
                caption_h=s.get("captionHeight"),
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


def fill_cover_top(img: Image.Image, w: int, h: int, *, bias: float = 0.18) -> Image.Image:
    """Scale-to-fill; bias slightly down from the top so Proof Room keeps
    Canon→Sony plus enough of the FAMA rings without letterboxing."""
    img = img.convert("RGB")
    scale = max(w / img.width, h / img.height)
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    overflow = max(0, nh - h)
    top = int(overflow * bias)
    return resized.crop((left, top, left + w, top + h))


ICON_DIR = TOOL / "icons"
_ICON_CACHE: dict[tuple[str, int], Image.Image] = {}


def load_icon(name: str, size: int = 40) -> Image.Image | None:
    key = (name, size)
    if key in _ICON_CACHE:
        return _ICON_CACHE[key]
    path = ICON_DIR / f"{name}.png"
    if not path.is_file():
        return None
    im = Image.open(path).convert("RGBA")
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    _ICON_CACHE[key] = im
    return im


def _layer_label(role: str) -> str:
    return LAYER_LABELS.get(role, role.upper())


def measure_card(draw: ImageDraw.ImageDraw, card: TechCard, w: int, fonts: dict) -> int:
    pad_y = 16
    lh_label = 26
    icon_row = 44 if card.icons else 0
    brand_lines = wrap_px(draw, card.brand, fonts["stack_brand"], w - 44)[:2]
    detail_lines = wrap_px(draw, card.detail, fonts["stack_detail"], w - 44)[:2] if card.detail else []
    return (
        pad_y * 2
        + lh_label
        + 6
        + icon_row
        + len(brand_lines) * 38
        + (6 if detail_lines else 0)
        + len(detail_lines) * 32
    )


def _draw_amber_first_number(
    draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font: ImageFont.FreeTypeFont
) -> None:
    """Paint the first numeric token in amber; remainder in cream."""
    m = _FIRST_NUM.search(text)
    if not m:
        draw.text((x, y), text, font=font, fill=CREAM)
        return
    start, end = m.span()
    prefix, num, suffix = text[:start], text[start:end], text[end:]
    cx = x
    if prefix:
        draw.text((cx, y), prefix, font=font, fill=CREAM)
        cx += int(draw.textlength(prefix, font=font))
    draw.text((cx, y), num, font=font, fill=AMBER)
    cx += int(draw.textlength(num, font=font))
    if suffix:
        draw.text((cx, y), suffix, font=font, fill=CREAM)


def draw_card(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    card: TechCard,
    fonts: dict,
    canvas: Image.Image | None = None,
) -> int:
    pad_x, pad_y = 16, 16
    lh_label = 26
    h = measure_card(draw, card, w, fonts)
    accent = card.accent
    fill = "#1f1d18" if accent else BG_CARD
    border = AMBER if accent else BORDER
    round_rect(draw, (x, y, x + w, y + h), 10, fill, border, 2 if accent else 1)
    ty = y + pad_y
    draw.text(
        (x + pad_x, ty),
        _layer_label(card.role),
        font=fonts["stack_label"],
        fill=AMBER if accent else CREAM_DIM,
    )
    ty += lh_label + 6
    # Brand icons (architecture-diagram style)
    if card.icons and canvas is not None:
        ix = x + pad_x
        for name in card.icons[:3]:
            icon = load_icon(name, 36)
            if icon is None:
                continue
            canvas.paste(icon, (ix, ty), icon)
            ix += 42
        ty += 44
    for line in wrap_px(draw, card.brand, fonts["stack_brand"], w - pad_x * 2)[:2]:
        draw.text((x + pad_x, ty), line, font=fonts["stack_brand"], fill=CREAM)
        ty += 38
    if card.detail:
        ty += 2
        detail_font = fonts["stack_mono"] if card.role == "api" or card.detail.startswith(
            ("GET ", "POST ", "recall(", "build_", "eval/")
        ) else fonts["stack_detail"]
        for line in wrap_px(draw, card.detail, detail_font, w - pad_x * 2)[:2]:
            draw.text((x + pad_x, ty), line, font=detail_font, fill=CREAM_MID)
            ty += 32
    return h


def draw_header(canvas: Image.Image, screen: Screen, fonts: dict) -> None:
    draw = ImageDraw.Draw(canvas)
    logo_h = 60
    logo = load_logo(logo_h)
    logo_y = PAD - 2
    canvas.paste(logo, (PAD, logo_y), logo)
    text_x = PAD + logo.width + 20
    draw.text((text_x, logo_y - 2), "engram", font=fonts["wordmark"], fill=CREAM)
    # Extra vertical gap so the eyebrow line doesn't jam under the wordmark.
    draw.text((text_x, logo_y + 62), "MEMORY-FIRST PHOTO MENTOR · QWEN", font=fonts["badge"], fill=AMBER)
    title_w = draw.textlength(screen.title, font=fonts["title"])
    draw.text((CANVAS_W - PAD - title_w, PAD - 8), screen.title, font=fonts["title"], fill=CREAM)
    tag = f"SCREEN {screen.id} · {screen.tag}"
    tag_w = draw.textlength(tag, font=fonts["screen_tag"])
    draw.text((CANVAS_W - PAD - tag_w, PAD + 78), tag, font=fonts["screen_tag"], fill=CREAM_DIM)


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
    elif fit_mode == "cover-top":
        fitted = fill_cover_top(screenshot, inner_w, inner_h)
    else:
        fitted = fit_contain(screenshot, inner_w, inner_h, align="top")
    base.paste(fitted, (inner_x, inner_y))


def draw_caption_bar(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], screen: Screen, fonts: dict) -> None:
    x0, y0, x1, y1 = box
    round_rect(draw, (x0, y0, x1, y1), 14, "#1f1d18", BORDER, 1)
    draw.rectangle((x0, y0, x0 + 7, y1), fill=AMBER)
    tx = x0 + 40
    text_w = x1 - tx - 40
    ty = y0 + 28
    draw.text((tx, ty), screen.takeaway_title, font=fonts["caption_title"], fill=CREAM)
    ty += 68
    body_lines = wrap_px(draw, screen.takeaway_body, fonts["caption_body"], text_w)
    # Keep room for receipt + HOW chip when present
    body_lines = body_lines[:1] if (screen.receipt or screen.how) else body_lines[:2]
    for line in body_lines:
        draw.text((tx, ty), line, font=fonts["caption_body"], fill=CREAM_MID)
        ty += 42
    # Receipt strip — memory thesis number + HOW endpoint (moved off the rail)
    if screen.receipt or screen.how:
        ty += 8
        if screen.receipt:
            _draw_amber_first_number(draw, tx, ty, screen.receipt, fonts["receipt"])
            ty += 44
        if screen.how:
            how_lines = wrap_px(draw, screen.how, fonts["how_chip"], text_w - 28)[:1]
            how = how_lines[0] if how_lines else screen.how
            chip_w = int(draw.textlength(how, font=fonts["how_chip"])) + 36
            chip_w = min(chip_w, text_w)
            chip_h = 48
            round_rect(draw, (tx, ty, tx + chip_w, ty + chip_h), 8, BG_CODE, BORDER, 1)
            draw.text((tx + 16, ty + 10), how, font=fonts["how_chip"], fill=CREAM)


def draw_chip_row(draw: ImageDraw.ImageDraw, x: int, y: int, max_w: int, chips: list[str], fonts: dict) -> int:
    tx = x
    row_h = 52
    for chip in chips:
        tw = draw.textlength(chip, font=fonts["tag"]) + 36
        if tx + tw > x + max_w and tx > x:
            tx = x
            y += row_h + 12
        accent = AMBER if any(k.lower() in chip.lower() for k in ("memory", "mcp", "judge", "fama", "receipt")) else BORDER
        round_rect(draw, (tx, y, tx + tw, y + row_h), 10, BG_CARD, accent, 1)
        draw.text((tx + 16, y + 12), chip, font=fonts["tag"], fill=CREAM if accent == AMBER else CREAM)
        tx += tw + 14
    return y + row_h


def distribute_cards_vertical(
    draw: ImageDraw.ImageDraw,
    x: int,
    y0: int,
    w: int,
    y1: int,
    cards: list[TechCard],
    fonts: dict,
    canvas: Image.Image | None = None,
) -> None:
    """Even stack of 5 layers; accented rows use border, not stretch."""
    max_gap = 18
    heights = [measure_card(draw, c, w, fonts) for c in cards]
    total_cards = sum(heights)
    n_gaps = max(1, len(cards) - 1)
    available = y1 - y0 - total_cards
    gap = min(max_gap, max(8, available // n_gaps))
    stack_h = total_cards + gap * (len(cards) - 1)
    # If stack overflows, compress gap to zero rather than clip brands
    if stack_h > (y1 - y0):
        gap = max(4, (y1 - y0 - total_cards) // n_gaps) if n_gaps else 0
        stack_h = total_cards + gap * (len(cards) - 1)
    cy = y0 + max(0, (y1 - y0 - stack_h) // 2)
    for card, h in zip(cards, heights):
        draw_card(draw, x, cy, w, card, fonts, canvas=canvas)
        cy += h + gap


def distribute_cards_horizontal(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y: int,
    x1: int,
    h: int,
    cards: list[TechCard],
    fonts: dict,
    canvas: Image.Image | None = None,
) -> None:
    # TODO: band layout unused — FRONTEND→INFRA left-to-right if revived.
    n = max(1, len(cards))
    gutter = 20
    total_w = x1 - x0
    card_w = (total_w - gutter * (n - 1)) // n
    cx = x0
    for card in cards:
        draw_card(draw, cx, y, card_w, card, fonts, canvas=canvas)
        cx += card_w + gutter


def build_split(screen: Screen, screenshot: Image.Image, fonts: dict) -> Image.Image:
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG)
    draw_header(canvas, screen, fonts)
    draw = ImageDraw.Draw(canvas)

    content_top = HEADER_H + 8
    content_bottom = CANVAS_H - PAD
    content_w = CANVAS_W - PAD * 2
    left_x0 = PAD

    # 75/25 split — screenshot dominant, tech stack rail on the right.
    usable = content_w - GUTTER
    left_w = int(usable * LEFT_RATIO)
    left_x1 = left_x0 + left_w
    right_x0 = left_x1 + GUTTER
    right_x1 = CANVAS_W - PAD
    right_w = right_x1 - right_x0

    caption_h = screen.caption_h if screen.caption_h is not None else CAPTION_H
    caption_top = content_bottom - caption_h
    browser_bottom = caption_top - 12
    browser_box = (left_x0, content_top, left_x1, browser_bottom)
    draw_browser_shot(canvas, browser_box, screenshot, screen.url_bar, fonts, fit_mode=screen.fit_mode)
    draw_caption_bar(draw, (left_x0, caption_top, left_x1, content_bottom), screen, fonts)

    # Right rail — fixed FRONTEND→INFRA stack for this screen
    draw.text((right_x0, content_top + 4), "UNDER THIS SCREEN", font=fonts["section"], fill=AMBER)
    cards_top = content_top + 56
    cards_bottom = content_bottom - 12
    rail_cards = screen.cards[:5]
    distribute_cards_vertical(draw, right_x0, cards_top, right_w, cards_bottom, rail_cards, fonts, canvas=canvas)

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
    ty = caption_top + 36
    draw.text((tx, ty), screen.takeaway_title, font=fonts["caption_title"], fill=CREAM)
    ty += 76
    draw.text((tx, ty), screen.takeaway_body, font=fonts["caption_body"], fill=CREAM)
    draw_chip_row(draw, CANVAS_W - PAD - 980, content_bottom - 74, 940, screen.chips, fonts)

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
    distribute_cards_horizontal(
        draw, PAD + 16, cards_y, CANVAS_W - PAD - 16, cards_y + cards_h, screen.cards, fonts, canvas=canvas
    )

    chip_y = strip_y1 - 52
    draw_chip_row(draw, PAD + 16, chip_y, content_w - 32, screen.chips, fonts)

    return canvas


def make_fonts() -> dict:
    """Chrome sized for Devpost gallery thumbs — ~1.4× earlier sizes + bold body."""
    return {
        "badge": load_font(28, mono=True, bold=True),
        "screen_tag": load_font(30, mono=True, bold=True),
        "title": load_font(84, serif=True, bold=True),
        "section": load_font(26, mono=True, bold=True),
        "section_sub": load_font(24, mono=True, bold=True),
        "wordmark": load_font(44, bold=True),
        "url": load_font(24, mono=True, bold=True),
        "stack_label": load_font(22, mono=True, bold=True),
        "stack_brand": load_font(32, bold=True),
        "stack_detail": load_font(26, bold=True),
        "stack_mono": load_font(24, mono=True, bold=True),
        "stack_body": load_font(34, bold=True),
        "receipt": load_font(36, bold=True),
        "how_chip": load_font(28, mono=True, bold=True),
        "card_label": load_font(28, mono=True, bold=True),
        "card_title": load_font(42, serif=True, bold=True),
        "card_detail": load_font(28, bold=True),
        "caption_title": load_font(52, serif=True, bold=True),
        "caption_body": load_font(32, bold=True),
        "caption_title_sm": load_font(40, serif=True, bold=True),
        "caption_body_sm": load_font(30, bold=True),
        "card_label_sm": load_font(24, mono=True, bold=True),
        "card_title_sm": load_font(30, serif=True, bold=True),
        "card_detail_sm": load_font(24, bold=True),
        "tag": load_font(28, mono=True, bold=True),
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

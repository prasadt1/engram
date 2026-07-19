#!/usr/bin/env python3
"""Render the memory-lifecycle diagram for the Devpost submission.

The architecture diagram shows the system's *topology*. This one shows the
axis nothing else covers: how a fact or a skill CHANGES STATE over time, which
is the actual Track 1 claim. Every number here is read from the engine:

  GRADUATION_THRESHOLD = 3            app/memory_engine.py:18
  streak resets to 0 on a miss        app/memory_engine.py:46-49
  WATCHING -> CLEARED at threshold    app/memory_engine.py:51-53
  is_live = not archived and superseded_by is None   app/memory_engine.py:84
  supersede() keeps the old row       app/memory_engine.py:184
  recency = 0.5 ** (age_days / 30)    app/memory_engine.py:88

    python3 tools/diagrams/memory_lifecycle.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / "docs" / "media"
W, H = 3200, 2100

BG = (20, 18, 16)
PANEL = (28, 25, 23)
PANEL_EDGE = (48, 43, 39)
AMBER = (245, 158, 11)
AMBER_HI = (251, 191, 36)
CREAM = (231, 229, 228)
DIM = (168, 162, 158)
DIMMER = (87, 83, 78)

SERIF_B = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
MONO = "/System/Library/Fonts/Menlo.ttc"


def f_serif_b(s):
    return ImageFont.truetype(SERIF_B, s)


def f_serif(s):
    return ImageFont.truetype(SERIF, s)


def f_mono(s, bold=False):
    return ImageFont.truetype(MONO, s, index=1 if bold else 0)


def panel(d, box, radius=22, fill=PANEL, edge=PANEL_EDGE, width=2):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=edge, width=width)


def tracked(d, xy, text, font, fill, track=0.0):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + track
    return x - xy[0]


def label(d, xy, text, size=30, fill=AMBER, track=5.0):
    tracked(d, xy, text.upper(), f_mono(size, True), fill, track)


# --- lane A: a skill graduates ------------------------------------------------
# Six sessions with a deliberate miss at #3 so the reset is visible; this is the
# whole point of the mechanism and a bar chart of averages would hide it.
SESSIONS = [
    (6.2, False), (7.4, True), (6.8, False),
    (7.6, True), (8.1, True), (8.5, True),
]
BAR = 7.0


def draw_skill_lane(d, x0, y0, w, h):
    panel(d, (x0, y0, x0 + w, y0 + h))
    label(d, (x0 + 46, y0 + 40), "lifecycle 1")
    d.text((x0 + 46, y0 + 92), "A skill graduates", font=f_serif_b(62), fill=CREAM)
    d.text((x0 + 46, y0 + 178),
           "Three consecutive above-bar sessions retire it from coaching.",
           font=f_serif(34), fill=DIM)

    plot_x, plot_y = x0 + 90, y0 + 270
    plot_w, plot_h = w - 180, 330
    lo, hi = 5.5, 9.0

    def y_of(score):
        return plot_y + plot_h - (score - lo) / (hi - lo) * plot_h

    # the bar
    by = y_of(BAR)
    for seg in range(0, plot_w, 26):
        d.line((plot_x + seg, by, plot_x + seg + 14, by), fill=(120, 92, 40), width=3)
    d.text((plot_x + plot_w + 12, by - 22), "bar", font=f_mono(26), fill=(150, 116, 52))

    step = plot_w / (len(SESSIONS) - 1)
    pts = [(plot_x + i * step, y_of(s)) for i, (s, _) in enumerate(SESSIONS)]
    for a, b in zip(pts, pts[1:]):
        d.line((a[0], a[1], b[0], b[1]), fill=(70, 64, 58), width=4)

    streak = 0
    streaks = []
    for score, ok in SESSIONS:
        streak = streak + 1 if ok else 0
        streaks.append(streak)

    for i, ((score, ok), (px, py)) in enumerate(zip(SESSIONS, pts)):
        col = AMBER_HI if ok else DIMMER
        r = 20
        d.ellipse((px - r, py - r, px + r, py + r), fill=col)
        txt = "%.1f" % score
        tw = d.textlength(txt, font=f_mono(30, True))
        d.text((px - tw / 2, py - 60), txt, font=f_mono(30, True),
               fill=CREAM if ok else DIM)

        # streak counter under each session
        sy = plot_y + plot_h + 66
        bw, bh = 64, 56
        filled = streaks[i] > 0
        d.rounded_rectangle((px - bw / 2, sy, px + bw / 2, sy + bh), radius=10,
                            fill=(46, 36, 18) if filled else (26, 24, 22),
                            outline=AMBER if streaks[i] == 3 else PANEL_EDGE,
                            width=3 if streaks[i] == 3 else 2)
        st = str(streaks[i])
        tw = d.textlength(st, font=f_mono(32, True))
        d.text((px - tw / 2, sy + 10), st, font=f_mono(32, True),
               fill=AMBER_HI if filled else DIMMER)

    d.text((plot_x, plot_y + plot_h + 150), "streak", font=f_mono(26), fill=DIM)

    # the reset callout — the detail that makes graduation *earned*
    rx = pts[2][0]
    d.line((rx, plot_y + plot_h + 132, rx, plot_y + plot_h + 196), fill=DIMMER, width=3)
    d.text((rx + 18, plot_y + plot_h + 176),
           "one miss resets the streak to zero —", font=f_serif(30), fill=DIM)
    d.text((rx + 18, plot_y + plot_h + 216),
           "consecutive, not an average", font=f_serif(30), fill=DIM)

    # state transition
    ty = y0 + h - 150
    d.rounded_rectangle((x0 + 90, ty, x0 + 400, ty + 78), radius=14,
                        fill=(26, 24, 22), outline=PANEL_EDGE, width=2)
    tracked(d, (x0 + 124, ty + 24), "WATCHING", f_mono(32, True), DIM, 3)
    d.line((x0 + 420, ty + 39, x0 + 520, ty + 39), fill=AMBER, width=4)
    d.polygon([(x0 + 520, ty + 30), (x0 + 545, ty + 39), (x0 + 520, ty + 48)], fill=AMBER)
    d.rounded_rectangle((x0 + 565, ty, x0 + 855, ty + 78), radius=14,
                        fill=(46, 36, 18), outline=AMBER, width=3)
    tracked(d, (x0 + 604, ty + 24), "CLEARED", f_mono(32, True), AMBER_HI, 3)
    d.text((x0 + 895, ty + 20),
           "retired from coaching\nand assignment targeting",
           font=f_serif(30), fill=DIM, spacing=8)


# --- lane B: a fact goes stale -------------------------------------------------
def draw_fact_lane(d, x0, y0, w, h):
    panel(d, (x0, y0, x0 + w, y0 + h))
    label(d, (x0 + 46, y0 + 40), "lifecycle 2")
    d.text((x0 + 46, y0 + 92), "A fact stops being true", font=f_serif_b(62), fill=CREAM)
    d.text((x0 + 46, y0 + 178),
           "Superseded, not deleted — the old row stays and stays inspectable.",
           font=f_serif(34), fill=DIM)

    cx, cw = x0 + 90, w - 180
    # old fact
    oy = y0 + 280
    d.rounded_rectangle((cx, oy, cx + cw, oy + 150), radius=16,
                        fill=(24, 22, 20), outline=(60, 54, 48), width=2)
    label(d, (cx + 32, oy + 26), "was live", 24, DIMMER, 4)
    old = "photographer shoots a Canon 5D"
    d.text((cx + 32, oy + 66), old, font=f_serif(40), fill=DIMMER)
    tw = d.textlength(old, font=f_serif(40))
    d.line((cx + 32, oy + 90, cx + 32 + tw, oy + 90), fill=DIMMER, width=3)
    tracked(d, (cx + cw - 330, oy + 70), "superseded_by ->", f_mono(26), DIMMER, 1)

    # arrow
    ay = oy + 178
    d.line((cx + 90, ay, cx + 90, ay + 74), fill=AMBER, width=4)
    d.polygon([(cx + 81, ay + 74), (cx + 99, ay + 74), (cx + 90, ay + 98)], fill=AMBER)
    d.text((cx + 126, ay + 24), "EXIF on a new upload says Sony",
           font=f_serif(32), fill=DIM)

    # new fact
    ny = ay + 120
    d.rounded_rectangle((cx, ny, cx + cw, ny + 150), radius=16,
                        fill=(46, 36, 18), outline=AMBER, width=3)
    label(d, (cx + 32, ny + 26), "live", 24, AMBER_HI, 4)
    d.text((cx + 32, ny + 62), "photographer shoots a Sony A7",
           font=f_serif(40), fill=CREAM)

    # the audit point
    ky = ny + 200
    d.rounded_rectangle((cx, ky, cx + cw, ky + 168), radius=16,
                        fill=(24, 22, 20), outline=PANEL_EDGE, width=2)
    d.text((cx + 32, ky + 24), "The Canon row is never deleted.",
           font=f_serif_b(34), fill=CREAM)
    d.text((cx + 32, ky + 70),
           "It is excluded from recall but stays visible in the audit trail.",
           font=f_serif(30), fill=DIM)
    d.text((cx + 32, ky + 108),
           "Forgetting you cannot inspect is just data loss.",
           font=f_serif(30), fill=DIM)

    ty = y0 + h - 150
    d.rounded_rectangle((x0 + 90, ty, x0 + 330, ty + 78), radius=14,
                        fill=(46, 36, 18), outline=AMBER, width=3)
    tracked(d, (x0 + 132, ty + 24), "LIVE", f_mono(32, True), AMBER_HI, 3)
    d.line((x0 + 350, ty + 39, x0 + 450, ty + 39), fill=AMBER, width=4)
    d.polygon([(x0 + 450, ty + 30), (x0 + 475, ty + 39), (x0 + 450, ty + 48)], fill=AMBER)
    d.rounded_rectangle((x0 + 495, ty, x0 + 900, ty + 78), radius=14,
                        fill=(26, 24, 22), outline=PANEL_EDGE, width=2)
    tracked(d, (x0 + 530, ty + 24), "SUPERSEDED", f_mono(32, True), DIM, 3)
    d.text((x0 + 940, ty + 20), "audit-kept,\nnever coaches you again",
           font=f_serif(30), fill=DIM, spacing=8)


# --- bottom: what recall actually sees ----------------------------------------
def draw_recall_band(d, x0, y0, w, h):
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=22,
                        fill=(30, 24, 16), outline=AMBER, width=3)
    label(d, (x0 + 52, y0 + 36), "what recall sees at time T")
    d.text((x0 + 52, y0 + 86), "Only what is still true.", font=f_serif_b(56), fill=CREAM)

    fx = x0 + 52
    fy = y0 + 178
    d.text((fx, fy), "salience  =  importance  x  recency  x  relevance",
           font=f_mono(34, True), fill=AMBER_HI)
    d.text((fx, fy + 56), "recency  =  0.5 ^ (age_days / 30)",
           font=f_mono(30), fill=DIM)

    ex = x0 + w // 2 + 40
    d.text((ex, y0 + 172), "excluded before ranking", font=f_serif(32), fill=DIM)
    chips = ["superseded", "archived", "cleared skills"]
    cx = ex
    for c in chips:
        cw = d.textlength(c, font=f_mono(28)) + 44
        d.rounded_rectangle((cx, y0 + 222, cx + cw, y0 + 282), radius=30,
                            fill=(26, 24, 22), outline=(70, 64, 58), width=2)
        d.text((cx + 22, y0 + 238), c, font=f_mono(28), fill=DIM)
        cx += cw + 18

    d.text((fx, y0 + 300),
           "then packed to the token budget — every reply ships a Memory Receipt: "
           "recalled  /  retired  /  dropped",
           font=f_serif(34), fill=CREAM)


def main():
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    label(d, (100, 74), "engram  ·  track 1 memoryagent")
    d.text((100, 122), "The memory lifecycle", font=f_serif_b(88), fill=CREAM)
    d.text((100, 236),
           "Most memory systems only accumulate. These are the two ways a memory "
           "stops being used — and neither one deletes anything.",
           font=f_serif(38), fill=DIM)

    lane_y, lane_h = 340, 1160
    gap = 60
    lane_w = (W - 200 - gap) // 2
    draw_skill_lane(d, 100, lane_y, lane_w, lane_h)
    draw_fact_lane(d, 100 + lane_w + gap, lane_y, lane_w, lane_h)
    draw_recall_band(d, 100, lane_y + lane_h + 60, W - 200, 400)

    d.text((100, H - 62),
           "github.com/prasadt1/engram  ·  app/memory_engine.py  ·  verified against "
           "26 frozen traces (FAMA 1.00 vs 0.64)",
           font=f_mono(26), fill=DIMMER)

    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / "devpost-memory-lifecycle.png"
    im.save(p, optimize=True)
    print("wrote %s  %dx%d  %.2f MB" % (p, W, H, p.stat().st_size / 1e6))


if __name__ == "__main__":
    main()

"""Illustrated story cards for the three featured stops: Main Quad, Huang Engineering Center and Hoover Tower.

Called by render_story_decks.py for these ids only (every other building keeps the schematic deck style). Each card
is painted procedurally with Pillow + numpy at 2x and downsampled: perspective architecture, metal and light, so the
hero picture reads as a lit scene instead of a line icon. Every hero shows only what its card copy says
(tools/story-cards.json); no inscriptions, flags or brand marks are added.

Fixed geometry (Core/CardLayout.ts storyCardHits; RetrospecsInfoPanel.ts draws a hover rim ~16 px outside them):
  close X     786,60 - 854,132
  Next Card   88,1100 - 545,1210   (last card: "Replay Cards")
  Next Stop   920,1000 - 1182,1142
Card 0 of Huang and Hoover carries an opaque hologram video over px 120,251 - 820,644 (StoryHolograms.ts), so those
heroes frame that window and keep their key shapes (tower crown, scale, circuit field) outside it.

Spectacles is additive: dark pixels read as see-through, so form comes from bright highlights, rim light and glow,
and text is near-white rather than relying on the panel behind it.
"""

import math
import random
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 1280
SS = 2                      # supersampling factor
FONTS = Path("C:/Windows/Fonts")
FEATURED = ("mainquad", "huang", "hoover")

PANEL_BOX = (28, 28, 888, 1252)
HERO_BOTTOM = 694
CLOSE_BOX = (786, 60, 854, 132)
NEXT_BOX = (88, 1100, 545, 1210)
STOP_BOX = (920, 1000, 1182, 1142)
# storyAskButton().drawn in Core/CardLayout.ts (local y -18.4..-8.4 cm on the 72 cm / 1280 px card), in pixels.
ASK_BOX = (920, 789, 1182, 967)
VIDEO_BOX = (120, 251, 820, 644)

THEMES = {
    "mainquad": dict(name="Main Quad", top=(44, 30, 26), bottom=(20, 14, 14), accent=(246, 190, 112),
                     button=((206, 104, 60), (150, 62, 36)), rim=(255, 206, 140), head=("georgiab.ttf", None, 68),
                     kick=("segoeuib.ttf", None, 27), frame="round"),
    "huang": dict(name="Huang Engineering Center", top=(14, 26, 40), bottom=(6, 12, 22), accent=(92, 228, 244),
                  button=((20, 150, 176), (8, 84, 112)), rim=(150, 244, 255), head=("bahnschrift.ttf", (700, 100), 72),
                  kick=("bahnschrift.ttf", (600, 100), 28), frame="chamfer"),
    "hoover": dict(name="Hoover Tower", top=(18, 26, 52), bottom=(8, 10, 26), accent=(244, 196, 108),
                   button=((178, 120, 48), (110, 66, 24)), rim=(255, 220, 150), head=("FRADM.TTF", None, 74),
                   kick=("FRADM.TTF", None, 28), frame="step"),
}

# ---------------------------------------------------------------------------------------------------------------
# Canvas helpers (all coordinates are in 1x card pixels; drawing happens at SS)

_YY, _XX = np.mgrid[0:H * SS, 0:W * SS].astype(np.float32) / SS


def new():
    return Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))


def mask():
    return Image.new("L", (W * SS, H * SS), 0)


def _s(pts):
    return [(x * SS, y * SS) for x, y in pts]


class Pen:
    """ImageDraw that takes 1x coordinates."""

    def __init__(self, im):
        self.d = ImageDraw.Draw(im)

    def poly(self, pts, fill=None, outline=None, width=1):
        self.d.polygon(_s(pts), fill=fill, outline=outline, width=max(1, round(width * SS)) if outline else 0)

    def line(self, pts, fill, width=1):
        self.d.line(_s(pts), fill=fill, width=max(1, round(width * SS)), joint="curve")

    def rect(self, box, fill=None, outline=None, width=1):
        x0, y0, x1, y1 = box
        self.d.rectangle((x0 * SS, y0 * SS, x1 * SS, y1 * SS), fill=fill, outline=outline,
                         width=max(1, round(width * SS)) if outline else 0)

    def rrect(self, box, r, fill=None, outline=None, width=1):
        x0, y0, x1, y1 = box
        self.d.rounded_rectangle((x0 * SS, y0 * SS, x1 * SS, y1 * SS), radius=r * SS, fill=fill, outline=outline,
                                 width=max(1, round(width * SS)) if outline else 0)

    def ellipse(self, box, fill=None, outline=None, width=1):
        x0, y0, x1, y1 = box
        self.d.ellipse((x0 * SS, y0 * SS, x1 * SS, y1 * SS), fill=fill, outline=outline,
                       width=max(1, round(width * SS)) if outline else 0)

    def circle(self, c, r, **kw):
        self.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), **kw)

    def arc(self, box, a0, a1, fill, width=1):
        x0, y0, x1, y1 = box
        self.d.arc((x0 * SS, y0 * SS, x1 * SS, y1 * SS), a0, a1, fill=fill, width=max(1, round(width * SS)))


def blur(im, r):
    return im.filter(ImageFilter.GaussianBlur(r * SS))


def over(base, layer):
    base.alpha_composite(layer)


def add(base, layer, k=1.0):
    """Additive light: layer colour x alpha x k is added to base."""
    b = np.asarray(base, dtype=np.float32)
    l = np.asarray(layer, dtype=np.float32)
    a = l[..., 3:4] / 255.0 * k
    rgb = b[..., :3] + l[..., :3] * a
    alpha = np.maximum(b[..., 3:4], np.clip(l[..., 3:4] * k, 0, 255))
    out = np.concatenate([np.clip(rgb, 0, 255), alpha], axis=-1)
    base.paste(Image.fromarray(out.astype(np.uint8), "RGBA"))


def glow(base, layer, r, k=1.0):
    add(base, blur(layer, r), k)


def ramp(t, stops):
    """Map t (array, 0..1) through colour stops [(pos, (r,g,b[,a])), ...] -> float RGBA array."""
    pos = [p for p, _ in stops]
    cols = [tuple(c) + ((255,) if len(c) == 3 else ()) for _, c in stops]
    out = np.empty(t.shape + (4,), np.float32)
    for ch in range(4):
        out[..., ch] = np.interp(t, pos, [c[ch] for c in cols])
    return out


def from_np(rgba, m=None):
    """RGBA float array -> layer, optionally masked by an L image."""
    arr = np.clip(rgba, 0, 255)
    if m is not None:
        arr = arr.copy()
        arr[..., 3] *= np.asarray(m, np.float32) / 255.0
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def vgrad(y0, y1, stops, m=None):
    t = np.clip((_YY - y0) / max(1e-6, y1 - y0), 0, 1)
    return from_np(ramp(t, stops), m)


def lgrad(p0, p1, stops, m=None):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    t = np.clip(((_XX - p0[0]) * dx + (_YY - p0[1]) * dy) / (dx * dx + dy * dy), 0, 1)
    return from_np(ramp(t, stops), m)


def rgrad(c, r, stops, m=None, sy=1.0):
    t = np.clip(np.sqrt((_XX - c[0]) ** 2 + ((_YY - c[1]) / sy) ** 2) / r, 0, 1)
    return from_np(ramp(t, stops), m)


def noise(seed, cell, octaves=3):
    """Smooth fractal value noise in 0..1, full canvas size."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((H * SS, W * SS), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        c = max(2, cell / (2 ** o))
        gw, gh = int(W / c) + 2, int(H / c) + 2
        small = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8), "L")
        big = small.resize((int(gw * c * SS), int(gh * c * SS)), Image.Resampling.BICUBIC)
        acc += np.asarray(big, np.float32)[:H * SS, :W * SS] / 255.0 * amp
        total += amp
        amp *= 0.5
    return acc / total


def shade(layer, factor):
    """Multiply a layer's RGB by a per-pixel factor array (keeps alpha)."""
    a = np.asarray(layer, np.float32).copy()
    a[..., :3] *= factor[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def clip_to(layer, m):
    a = np.asarray(layer, np.float32).copy()
    a[..., 3] *= np.asarray(m, np.float32) / 255.0
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def poly_mask(pts):
    m = mask()
    Pen(m).poly(pts, fill=255)
    return m


def fill(m, color):
    """Solid colour layer through mask m."""
    lay = Image.new("RGBA", (W * SS, H * SS), tuple(color[:3]) + (0,))
    a = np.asarray(m, np.float32) * ((color[3] if len(color) > 3 else 255) / 255.0)
    lay.putalpha(Image.fromarray(a.astype(np.uint8), "L"))
    return lay


def mix(c0, c1, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c0, c1))


def hull(points):
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def font(spec, size):
    name, axes, _ = spec if len(spec) == 3 else (spec[0], spec[1], 0)
    f = ImageFont.truetype(str(FONTS / name), int(size * SS))
    if axes:
        f.set_variation_by_axes(list(axes))
    return f


def text(im, xy, s, f, fill, tracking=0.0, anchor="la"):
    """Draw text at 1x position; tracking in 1x px between glyphs."""
    d = ImageDraw.Draw(im)
    x, y = xy[0] * SS, xy[1] * SS
    if not tracking:
        d.text((x, y), s, font=f, fill=fill, anchor=anchor)
        return d.textlength(s, font=f) / SS
    total = sum(d.textlength(ch, font=f) for ch in s) + tracking * SS * (len(s) - 1)
    if anchor[0] == "m":
        x -= total / 2
    elif anchor[0] == "r":
        x -= total
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill, anchor="l" + anchor[1])
        x += d.textlength(ch, font=f) + tracking * SS
    return total / SS


def text_width(s, f, tracking=0.0):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    return (sum(d.textlength(ch, font=f) for ch in s) + tracking * SS * (len(s) - 1)) / SS if tracking else d.textlength(s, font=f) / SS


def wrap(s, f, width):
    lines = []
    for word in s.split():
        trial = lines[-1] + " " + word if lines else word
        if lines and text_width(trial, f) > width:
            lines.append(word)
        elif lines:
            lines[-1] = trial
        else:
            lines.append(word)
    return lines


def balanced(s, f, width):
    """Wrap to the fewest lines, then even out a two-line break so no word is left alone."""
    lines = wrap(s, f, width)
    if len(lines) != 2:
        return lines
    words = s.split()
    best = None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        wa, wb = text_width(a, f), text_width(b, f)
        if max(wa, wb) <= width and (best is None or max(wa, wb) < best[0]):
            best = (max(wa, wb), [a, b])
    return best[1] if best else lines


def stars(pen, rng, box, n, color=(255, 255, 255), max_a=200):
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        a = int(rng.uniform(40, max_a) * (1 - (y - y0) / (y1 - y0)) ** 0.7)
        r = rng.choice((0.6, 0.8, 1.0, 1.4))
        pen.circle((x, y), r, fill=color + (a,))


# ---------------------------------------------------------------------------------------------------------------
# Card chrome: panel, hero window, header, kicker, headline, body, buttons

def panel_outline(style, box=PANEL_BOX):
    x0, y0, x1, y1 = box
    if style == "chamfer":
        c = 44
        return [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]
    if style == "step":
        s = 18
        return [(x0 + 2 * s, y0), (x1 - 2 * s, y0), (x1 - 2 * s, y0 + s), (x1 - s, y0 + s), (x1 - s, y0 + 2 * s), (x1, y0 + 2 * s),
                (x1, y1), (x0, y1), (x0, y0 + 2 * s), (x0 + s, y0 + 2 * s), (x0 + s, y0 + s), (x0 + 2 * s, y0 + s)]
    return None


def panel_mask(style, box=PANEL_BOX):
    m = mask()
    p = Pen(m)
    if style == "round":
        p.rrect(box, 46, fill=255)
    else:
        p.poly(panel_outline(style, box), fill=255)
    return m


def draw_panel(card, th):
    m = panel_mask(th["frame"])
    bg = vgrad(PANEL_BOX[1], PANEL_BOX[3], [(0, th["top"] + (246,)), (0.55, mix(th["top"], th["bottom"], 0.6) + (246,)),
                                            (1, th["bottom"] + (246,))], m)
    grain = 0.94 + 0.12 * noise(7, 90, 3)
    over(card, shade(bg, grain))
    return m


def draw_frame(card, th, m):
    """Edge light and per-stop frame details, drawn after the hero so they sit on top."""
    style, acc = th["frame"], th["accent"]
    edge = mask()
    pe = Pen(edge)
    if style == "round":
        pe.rrect(PANEL_BOX, 46, outline=255, width=3)
        inner = mask()
        Pen(inner).rrect((42, 42, 874, 1238), 34, outline=255, width=1.3)
        over(card, fill(inner, acc + (120,)))
    else:
        pts = panel_outline(style)
        pe.line(pts + [pts[0]], fill=255, width=3)
    over(card, fill(edge, th["rim"] + (230,)))
    glow(card, fill(edge, acc + (255,)), 6, 0.35)
    p = Pen(card)
    if style == "chamfer":
        for (x, y, sx, sy) in ((28, 140, 1, 1), (888, 140, -1, 1), (28, 1140, 1, -1), (888, 1140, -1, -1)):
            p.line([(x + 6 * sx, y), (x + 20 * sx, y)], fill=acc + (230,), width=3)
        for yy in range(300, 1000, 40):
            p.line([(884, yy), (888, yy)], fill=acc + (110,), width=1.5)
    if style == "step":
        p.line([(64, 40), (852, 40)], fill=acc + (90,), width=1)


def draw_header(card, th, index, count):
    f = font(th["kick"][:2] + (0,), 22)
    text(card, (74, 84), th["name"].upper(), f, (255, 255, 255, 236), tracking=3.4, anchor="lm")
    # close button
    x0, y0, x1, y1 = CLOSE_BOX
    bx = (x0 + 4, y0 + 6, x1 - 4, y1 - 6)
    p = Pen(card)
    p.rrect(bx, 14, fill=(10, 12, 18, 200))
    lay = new()
    Pen(lay).rrect(bx, 14, outline=th["rim"] + (255,), width=2.5)
    over(card, lay)
    cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, 13
    p.line([(cx - r, cy - r), (cx + r, cy + r)], fill=(255, 255, 255, 255), width=4.5)
    p.line([(cx - r, cy + r), (cx + r, cy - r)], fill=(255, 255, 255, 255), width=4.5)


def draw_text(card, th, slide, index):
    acc = th["accent"]
    hspec, kspec = th["head"], th["kick"]
    y = HERO_BOTTOM + 14
    kf = font(kspec, kspec[2])
    kicker = re.sub(r"(\d)S", r"s", slide["year"].upper())  # small caps feel, but "1940s" keeps its lowercase s
    kw = text(card, (90, y + 16), kicker, kf, acc + (255,), tracking=3.0, anchor="lm")
    Pen(card).line([(90 + kw + 18, y + 16), (90 + kw + 70, y + 16)], fill=acc + (200,), width=2.5)
    y += 46
    hsize, bsize = hspec[2], 33
    for _ in range(12):
        hf, bf = font(hspec, hsize), font(("seguisb.ttf", None), bsize)
        hl, bl = balanced(slide["headline"], hf, 750), wrap(slide["body"], bf, 742)
        hlh, blh = hsize * 1.06, bsize * 1.36
        end = y + len(hl) * hlh + 16 + len(bl) * blh
        if len(hl) <= 2 and end <= 1084:
            break
        hsize -= 3
        bsize = max(29, bsize - 1)
    else:
        raise ValueError(f"Text overflows: {slide['headline']}")
    for line in hl:
        text(card, (88, y), line, hf, (255, 255, 255, 255))
        y += hlh
    y += 16
    for line in bl:
        text(card, (90, y), line, bf, (238, 241, 246, 255))
        y += blh
    return y


def draw_buttons(card, th, index, count):
    acc, rim = th["accent"], th["rim"]
    c0, c1 = th["button"]
    x0, y0, x1, y1 = NEXT_BOX
    bx = (x0 + 4, y0 + 8, x1 - 4, y1 - 8)
    m = mask()
    style = th["frame"]
    if style == "round":
        Pen(m).rrect(bx, 46, fill=255)
    elif style == "chamfer":
        Pen(m).poly([(bx[0] + 22, bx[1]), (bx[2], bx[1]), (bx[2], bx[3] - 22), (bx[2] - 22, bx[3]), (bx[0], bx[3]), (bx[0], bx[1] + 22)], fill=255)
    else:
        Pen(m).rect(bx, fill=255)
    over(card, vgrad(bx[1], bx[3], [(0, c0), (1, c1)], m))
    hi = mask()
    Pen(hi).rect((bx[0], bx[1], bx[2], bx[1] + 40), fill=255)
    over(card, clip_to(vgrad(bx[1], bx[1] + 40, [(0, (255, 255, 255, 60)), (1, (255, 255, 255, 0))]), m))
    edge = np.asarray(m, np.float32)
    er = np.asarray(m.filter(ImageFilter.MinFilter(5)), np.float32)
    ring = Image.fromarray(np.clip(edge - er, 0, 255).astype(np.uint8), "L")
    over(card, fill(ring, rim + (255,)))
    label = "Next Card" if index + 1 < count else "Replay Cards"
    f = font(th["head"][:2] + (0,), 38) if th["frame"] != "round" else font(("georgiab.ttf", None), 37)
    cy = (bx[1] + bx[3]) / 2
    text(card, (bx[0] + 42, cy), label, f, (255, 255, 255, 255), anchor="lm")
    ax = bx[2] - 56
    p = Pen(card)
    if index + 1 < count:
        p.line([(ax - 10, cy - 15), (ax + 6, cy), (ax - 10, cy + 15)], fill=(255, 255, 255, 255), width=5)
        p.line([(ax - 30, cy - 15), (ax - 14, cy), (ax - 30, cy + 15)], fill=(255, 255, 255, 140), width=5)
    else:
        p.arc((ax - 22, cy - 20, ax + 18, cy + 20), 200, 520 - 40, fill=(255, 255, 255, 255), width=5)
        p.poly([(ax + 22, cy - 22), (ax + 22, cy - 2), (ax + 4, cy - 10)], fill=(255, 255, 255, 255))
    # progress pips
    px = 600
    for i in range(count):
        on = i == index
        w = 54 if on else 30
        col = acc + (255,) if on else (255, 255, 255, 120 if i < index else 70)
        p.rrect((px, 1150, px + w, 1160), 5, fill=col)
        px += w + 12
    tf = font(("segoeuib.ttf", None), 20)
    text(card, (600, 1186), f"{index + 1} OF {count}", tf, (255, 255, 255, 190), tracking=2.5, anchor="lm")
    # Next Stop tab
    x0, y0, x1, y1 = STOP_BOX
    sb = (x0 + 4, y0 + 8, x1 - 4, y1 - 8)
    sm = mask()
    if style == "round":
        Pen(sm).rrect(sb, 30, fill=255)
    elif style == "chamfer":
        Pen(sm).poly([(sb[0] + 22, sb[1]), (sb[2], sb[1]), (sb[2], sb[3] - 22), (sb[2] - 22, sb[3]), (sb[0], sb[3]), (sb[0], sb[1] + 22)], fill=255)
    else:
        Pen(sm).rect(sb, fill=255)
    over(card, vgrad(sb[1], sb[3], [(0, th["top"] + (240,)), (1, th["bottom"] + (240,))], sm))
    er = np.asarray(sm.filter(ImageFilter.MinFilter(5)), np.float32)
    ring = Image.fromarray(np.clip(np.asarray(sm, np.float32) - er, 0, 255).astype(np.uint8), "L")
    over(card, fill(ring, rim + (255,)))
    glow(card, fill(ring, acc + (255,)), 5, 0.4)
    kf = font(("segoeuib.ttf", None), 17)
    text(card, (sb[0] + 26, sb[1] + 34), "CONTINUE TOUR", kf, acc + (255,), tracking=2.2, anchor="lm")
    f = font(th["head"][:2] + (0,), 33) if style != "round" else font(("georgiab.ttf", None), 32)
    text(card, (sb[0] + 26, sb[1] + 80), "Next Stop", f, (255, 255, 255, 255), anchor="lm")
    ax, ay = sb[2] - 36, sb[1] + 80
    p.line([(ax - 9, ay - 13), (ax + 4, ay), (ax - 9, ay + 13)], fill=(255, 255, 255, 255), width=4.5)


def _tab_mask(style, b, chamfer=22):
    m = mask()
    if style == "round":
        Pen(m).rrect(b, 30, fill=255)
    elif style == "chamfer":
        Pen(m).poly([(b[0] + chamfer, b[1]), (b[2], b[1]), (b[2], b[3] - chamfer), (b[2] - chamfer, b[3]), (b[0], b[3]), (b[0], b[1] + chamfer)], fill=255)
    else:
        Pen(m).rect(b, fill=255)
    return m


def _fit_font(spec, size, s, width, tracking=0.0, floor=12):
    f = font(spec, size)
    while size > floor and text_width(s, f, tracking) > width:
        size -= 1
        f = font(spec, size)
    return f


def _mic(p, cx, cy, s, col):
    """Microphone glyph centred on (cx, cy), about s px tall: capsule, U cradle, stem, base."""
    w = s * 0.34
    p.rrect((cx - w / 2, cy - s * 0.5, cx + w / 2, cy + s * 0.06), w / 2, fill=col)
    p.arc((cx - s * 0.32, cy - s * 0.34, cx + s * 0.32, cy + s * 0.2), 0, 180, fill=col, width=max(3, s * 0.08))
    p.line([(cx, cy + s * 0.2), (cx, cy + s * 0.4)], fill=col, width=max(3, s * 0.08))
    p.line([(cx - s * 0.2, cy + s * 0.42), (cx + s * 0.2, cy + s * 0.42)], fill=col, width=max(3, s * 0.08))


def draw_ask_tab(card, th):
    """The "Ask Me More" tab above Next Stop, in the same dress (dark gradient, rim, glow). ASK_BOX is the drawn rect of
    storyAskButton() in Core/CardLayout.ts, so the app's hit box and hover outline line up with it."""
    acc, rim = th["accent"], th["rim"]
    style = th["frame"]
    x0, y0, x1, y1 = ASK_BOX
    sb = (x0 + 4, y0 + 8, x1 - 4, y1 - 8)
    sm = _tab_mask(style, sb)
    over(card, vgrad(sb[1], sb[3], [(0, th["top"] + (240,)), (1, th["bottom"] + (240,))], sm))
    er = np.asarray(sm.filter(ImageFilter.MinFilter(5)), np.float32)
    ring = Image.fromarray(np.clip(np.asarray(sm, np.float32) - er, 0, 255).astype(np.uint8), "L")
    over(card, fill(ring, rim + (255,)))
    glow(card, fill(ring, acc + (255,)), 5, 0.4)
    p = Pen(card)
    inner = sb[2] - sb[0] - 52
    # Kicker row with the mic badge on the right (where Next Stop has its chevron).
    mr, mx, my = 21, sb[2] - 40, sb[1] + 38
    kf = _fit_font(("segoeuib.ttf", None), 17, "HAVE A QUESTION?", inner - 2 * mr - 10, 2.2)
    text(card, (sb[0] + 26, my), "HAVE A QUESTION?", kf, acc + (255,), tracking=2.2, anchor="lm")
    badge = mask()
    Pen(badge).circle((mx, my), mr, fill=255)
    over(card, fill(badge, acc + (255,)))
    glow(card, fill(badge, acc + (255,)), 6, 0.35)
    _mic(p, mx, my, 26, th["bottom"] + (255,))
    spec = th["head"][:2] if style != "round" else ("georgiab.ttf", None)
    f = _fit_font(spec, 32, "Ask Me More", inner)
    text(card, (sb[0] + 26, sb[1] + 88), "Ask Me More", f, (255, 255, 255, 255), anchor="lm")
    hf = _fit_font(("segoeui.ttf", None), 17, "Tap, then just speak", inner)
    text(card, (sb[0] + 26, sb[1] + 126), "Tap, then just speak", hf, (255, 255, 255, 170), anchor="lm")


def hero_mask(style):
    m = panel_mask(style)
    a = np.asarray(m, np.float32)
    a[_YY >= HERO_BOTTOM] = 0
    return Image.fromarray(a.astype(np.uint8), "L")


def seat_hero(card, th, hero, style):
    """Clip the hero to the panel's top, fade its lower edge into the panel, and add a header scrim."""
    m = hero_mask(style)
    hero = clip_to(hero, m)
    a = np.asarray(hero, np.float32).copy()
    fade = np.clip((HERO_BOTTOM - _YY) / 120.0, 0, 1) ** 1.4
    a[..., 3] *= fade
    over(card, Image.fromarray(a.astype(np.uint8), "RGBA"))
    top = th["top"]
    over(card, vgrad(28, 190, [(0, top + (225,)), (0.45, top + (120,)), (1, top + (0,))], m))


# ---------------------------------------------------------------------------------------------------------------
# Shared rendering pieces

def metal_vertical(m, x_center, half_width_fn, ramp_stops, key=-0.45, rim=0.82, bands=()):
    """Shade a mask as a vertical surface of revolution (bell, tube, knob) with studio reflections.
    half_width_fn(y array) -> half width in px at that row."""
    hw = np.maximum(half_width_fn(_YY), 1e-3)
    u = np.clip((_XX - x_center) / hw, -1, 1)
    b = 0.34 + 0.28 * (1 - np.abs(u)) ** 0.5
    b += 0.75 * np.exp(-((u - key) / 0.13) ** 2)
    b += 0.30 * np.exp(-((u - rim) / 0.06) ** 2)
    b -= 0.22 * np.exp(-((u - 0.25) / 0.18) ** 2)
    for (yb, w, k) in bands:
        b += k * np.exp(-((_YY - yb) / w) ** 2)
    t = np.clip(b / 1.35, 0, 1)
    return from_np(ramp(t, ramp_stops), m)


def metal_horizontal(m, y_center, half_height, ramp_stops, key=-0.5):
    v = np.clip((_YY - y_center) / half_height, -1, 1)
    b = 0.3 + 0.3 * (1 - np.abs(v)) ** 0.5 + 0.8 * np.exp(-((v - key) / 0.14) ** 2) + 0.25 * np.exp(-((v - 0.8) / 0.07) ** 2)
    b -= 0.2 * np.exp(-((v - 0.2) / 0.2) ** 2)
    return from_np(ramp(np.clip(b / 1.35, 0, 1), ramp_stops), m)


BRONZE = [(0, (34, 18, 10)), (0.25, (92, 52, 24)), (0.5, (168, 104, 48)), (0.75, (230, 168, 92)), (1, (255, 238, 196))]
STEEL = [(0, (24, 28, 34)), (0.3, (74, 84, 96)), (0.6, (150, 162, 176)), (0.85, (214, 224, 234)), (1, (255, 255, 255))]
BRASS = [(0, (40, 28, 10)), (0.3, (110, 80, 30)), (0.6, (196, 150, 70)), (0.85, (246, 214, 140)), (1, (255, 248, 220))]


def sandstone(m, base, seed, cell=40, amt=0.18):
    """Sandstone through mask: base colour, soft mottling and fine grain."""
    n = noise(seed, cell, 2)
    fine = noise(seed + 1, 2.5, 1)
    f = 1 + amt * 0.45 * (n - 0.5) * 2 + 0.07 * (fine - 0.5) * 2
    lay = fill(m, base)
    return shade(lay, f)


# ---------------------------------------------------------------------------------------------------------------
# MAIN QUAD: sandstone, warm light, archival plans

def mq_project(X, Y, Z, vx=566, vy=372, f=520):
    return (vx + f * X / Z, vy - f * Y / Z)


def _arch(cx, spring, r, z, n=32, P=mq_project):
    """Points of a round arch in the plane Z=z, from the right springing to the left."""
    return [P(cx + r * math.cos(math.pi * i / n), spring + r * math.sin(math.pi * i / n), z) for i in range(n + 1)]


def mainquad_0(th):
    """1891, the campus began here: inside the sunlit Quad arcade, arches receding into warm haze."""
    hero = new()
    P = mq_project
    XL, XR, FY, CY = -1.6, 1.0, -1.0, 1.36
    sun = (0.62, -0.74, -0.3)
    # courtyard beyond the openings: sky, the far side of the Quad, sunlit paving
    over(hero, vgrad(28, 372, [(0, (92, 124, 184)), (0.6, (206, 186, 182)), (1, (255, 218, 164))]))
    far = new()
    pf = Pen(far)
    pf.rect((0, 312, 1200, 384), fill=(232, 184, 122, 255))
    pf.rect((0, 300, 1200, 314), fill=(184, 90, 58, 255))
    for x in range(-20, 1200, 30):
        pf.ellipse((x, 334, x + 20, 356), fill=(170, 118, 76, 255))
        pf.rect((x, 345, x + 20, 384), fill=(170, 118, 76, 255))
    over(hero, far)
    over(hero, vgrad(384, 700, [(0, (240, 204, 146)), (1, (196, 150, 98))], poly_mask([(0, 384), (1200, 384), (1200, 700), (0, 700)])))

    bays = [0.9 + k * 1.5 for k in range(14)]
    fog = (252, 218, 170)
    corr = new()
    pc = Pen(corr)
    openings = []
    for k in reversed(range(len(bays) - 1)):
        za, zb = bays[k], bays[k + 1]
        fz = min(0.8, (za - 0.9) / 16)
        wall_c = mix((150, 106, 72), fog, fz)
        floor_c = mix((132, 96, 66), fog, fz)
        ceil_c = mix((86, 60, 44), fog, fz * 0.85)
        lw_c = mix((118, 82, 58), fog, fz)
        pc.poly([P(XR, FY, za), P(XR, CY, za), P(XR, CY, zb), P(XR, FY, zb)], fill=wall_c + (255,))
        for yy in (-0.55, -0.1, 0.35, 0.8):
            pc.line([P(XR, yy, za), P(XR, yy, zb)], fill=mix(wall_c, (70, 46, 32), 0.3) + (255,), width=1.0)
        pc.poly([P(XL, FY, za), P(XR, FY, za), P(XR, FY, zb), P(XL, FY, zb)], fill=floor_c + (255,))
        for zz in (za + 0.5, za + 1.0):
            pc.line([P(XL, FY, zz), P(XR, FY, zz)], fill=mix(floor_c, (60, 40, 28), 0.3) + (255,), width=1.0)
        pc.poly([P(XL, CY, za), P(XR, CY, za), P(XR, CY, zb), P(XL, CY, zb)], fill=ceil_c + (255,))
        pc.poly([P(XL, FY, za), P(XL, CY, za), P(XL, CY, zb), P(XL, FY, zb)], fill=lw_c + (255,))
        # the open side: a round-arched opening between piers
        a, b = za + 0.46, zb - 0.1
        r, spring = (b - a) / 2, 0.3
        outline = [(XL, FY, a), (XL, spring, a)]
        outline += [(XL, spring + r * math.sin(math.pi * i / 24), a + r - r * math.cos(math.pi * i / 24)) for i in range(1, 24)]
        outline += [(XL, spring, b), (XL, FY, b)]
        pc.poly([P(*q) for q in outline], fill=(0, 0, 0, 0))
        openings.append((outline, fz))
        # transverse arch across the walk: soffit (back) then lit face
        for depth, col in ((0.34, mix((156, 110, 74), fog, fz)), (0.0, mix((222, 174, 116), fog, fz))):
            z = za + depth
            band = [P(XL, FY, z), P(XL, CY, z), P(XR, CY, z), P(XR, FY, z), P(0.72, FY, z)]
            band += _arch(-0.3, 0.04, 1.02, z)
            band += [P(-1.32, FY, z)]
            pc.poly(band, fill=col + (255,))
            if depth == 0.0:
                pc.line(_arch(-0.3, 0.04, 1.02, z), fill=mix((255, 226, 176), fog, fz) + (200,), width=max(1.0, 3.2 / z))
    # sandstone grain over the built surfaces
    corr = shade(corr, 0.95 + 0.06 * noise(21, 30, 2) + 0.06 * noise(22, 2.5, 1))
    over(hero, corr)
    # sun through the openings: floor patches and soft shafts
    patches, shafts = new(), new()
    pp, ps = Pen(patches), Pen(shafts)
    for outline, fz in openings:
        floor_pts = []
        for (X, Y, Z) in outline:
            t = (Y - FY) / -sun[1]
            floor_pts.append((X + sun[0] * t, FY, Z + sun[2] * t))
        scr = [P(*q) for q in floor_pts if q[2] > 0.35]
        if len(scr) > 2:
            pp.poly(scr, fill=(255, 214, 150, int(200 * (1 - fz * 0.6))))
            ps.poly(hull(scr + [P(*q) for q in outline]), fill=(255, 220, 160, int(70 * (1 - fz * 0.5))))
    floor_m = mask()
    pfm = Pen(floor_m)
    for k in range(len(bays) - 1):
        pfm.poly([P(XL, FY, bays[k]), P(XR, FY, bays[k]), P(XR, FY, bays[k + 1]), P(XL, FY, bays[k + 1])], fill=255)
    add(hero, clip_to(blur(patches, 1.2), floor_m), 0.85)
    glow(hero, shafts, 14, 0.55)
    # dust in the light
    rng = random.Random(4)
    motes = new()
    pm = Pen(motes)
    for _ in range(110):
        x, y = rng.uniform(80, 560), rng.uniform(120, 640)
        pm.circle((x, y), rng.choice((0.8, 1.1, 1.5)), fill=(255, 236, 200, rng.randint(60, 180)))
    add(hero, clip_to(motes, blur(shafts, 6).getchannel("A").point(lambda v: min(255, v * 4))), 1.0)
    glow(hero, rgrad((566, 372), 170, [(0, (255, 236, 200, 255)), (1, (255, 220, 160, 0))]), 10, 0.55)
    return hero


def _sheet_transform(ox, oy, w, h, deg):
    ang = math.radians(deg)

    def T(x, y):
        dx, dy = x - w / 2, y - h / 2
        return (ox + dx * math.cos(ang) - dy * math.sin(ang), oy + dx * math.sin(ang) + dy * math.cos(ang))
    return T


def mainquad_1(th):
    """THE PLAN: a cyanotype site plan with the centred axis; Olmsted's off-centre church on a vellum overlay."""
    hero = new()
    over(hero, rgrad((470, 360), 620, [(0, (70, 50, 38)), (1, (22, 15, 13))]))
    w, h = 700, 520
    T = _sheet_transform(474, 410, w, h, 3.5)
    corners = [T(0, 0), T(w, 0), T(w, h), T(0, h)]
    shadow = new()
    Pen(shadow).poly([(x + 18, y + 24) for x, y in corners], fill=(0, 0, 0, 190))
    over(hero, blur(shadow, 14))
    sm = poly_mask(corners)
    base = fill(sm, (22, 50, 104))
    mott = 0.84 + 0.3 * noise(5, 60, 3)
    over(hero, shade(base, mott))
    edge_dark = mask()
    Pen(edge_dark).poly(corners, outline=255, width=40)
    over(hero, clip_to(fill(edge_dark.filter(ImageFilter.GaussianBlur(18 * SS)), (8, 20, 50, 150)), sm))
    lay = new()
    lp = Pen(lay)
    for gx in range(20, w, 40):
        lp.line([T(gx, 10), T(gx, h - 10)], fill=(170, 200, 240, 40), width=1)
    for gy in range(20, h, 40):
        lp.line([T(10, gy), T(w - 10, gy)], fill=(170, 200, 240, 40), width=1)
    ink = (230, 240, 250, 240)
    cx = w / 2
    ox0, oy0, ox1, oy1 = 150, 150, 570, 500
    ix0, iy0, ix1, iy1 = 196, 196, 524, 454
    # hatched ring of Quad buildings
    ring = poly_mask([T(ox0, oy0), T(ox1, oy0), T(ox1, oy1), T(ox0, oy1)])
    Pen(ring).poly([T(ix0, iy0), T(ix1, iy0), T(ix1, iy1), T(ix0, iy1)], fill=0)
    hl = new()
    hp = Pen(hl)
    for i in range(-500, 900, 12):
        hp.line([T(i, oy1 + 10), T(i + 380, oy0 - 10)], fill=(210, 226, 248, 120), width=1)
    over(lay, clip_to(hl, ring))
    for box, wd in (((ox0, oy0, ox1, oy1), 3), ((ix0, iy0, ix1, iy1), 2.4)):
        x0, y0, x1, y1 = box
        pts = [T(x0, y0), T(x1, y0), T(x1, y1), T(x0, y1)]
        lp.line(pts + [pts[0]], fill=ink, width=wd)
    x0, y0, x1, y1 = ix0 + 16, iy0 + 16, ix1 - 16, iy1 - 16
    pts = [T(x0, y0), T(x1, y0), T(x1, y1), T(x0, y1)]
    lp.line(pts + [pts[0]], fill=(220, 234, 250, 150), width=1.2)
    for (px, py) in ((cx - 90, 280), (cx + 90, 280), (cx - 90, 380), (cx + 90, 380)):
        c = T(px, py)
        lp.circle(c, 22, outline=(210, 226, 248, 150), width=1.6)
    # church on the axis at the head of the inner quad
    church = [(cx - 30, iy0), (cx + 30, iy0), (cx + 30, iy0 - 30), (cx + 52, iy0 - 30), (cx + 52, iy0 - 52), (cx + 30, iy0 - 52),
              (cx + 30, iy0 - 78), (cx - 30, iy0 - 78), (cx - 30, iy0 - 52), (cx - 52, iy0 - 52), (cx - 52, iy0 - 30), (cx - 30, iy0 - 30)]
    lp.poly([T(*p) for p in church], fill=(240, 246, 252, 250))
    apse = [T(cx + 30 * math.cos(a), iy0 - 78 - 30 * math.sin(a)) for a in np.linspace(0, math.pi, 16)]
    lp.poly(apse, fill=(240, 246, 252, 250))
    over(hero, lay)
    glow(hero, lay, 3, 0.25)
    # vellum overlay: Olmsted's foothill idea, church off the axis
    V = _sheet_transform(300, 452, 360, 380, -6)
    vc = [V(0, 0), V(360, 0), V(360, 380), V(0, 380)]
    vs = new()
    Pen(vs).poly([(x + 10, y + 14) for x, y in vc], fill=(0, 0, 0, 90))
    over(hero, blur(vs, 10))
    over(hero, fill(poly_mask(vc), (240, 232, 216, 64)))
    vl = new()
    vp = Pen(vl)
    vp.line(vc + [vc[0]], fill=(255, 240, 220, 120), width=1.2)
    for i in range(6):
        pts = [V(10 + j * 14, 140 + i * 40 + 16 * math.sin(j * 0.42 + i * 0.8)) for j in range(25)]
        vp.line(pts, fill=(255, 160, 132, 150), width=2)
    gx, gy = 130, 70
    ghost = [(gx - 30, gy + 78), (gx + 30, gy + 78), (gx + 30, gy), (gx - 30, gy)]
    gp = [V(*p) for p in ghost]
    for i in range(4):
        a, b = gp[i], gp[(i + 1) % 4]
        for s in range(0, 10, 2):
            vp.line([(a[0] + (b[0] - a[0]) * s / 10, a[1] + (b[1] - a[1]) * s / 10),
                     (a[0] + (b[0] - a[0]) * (s + 1) / 10, a[1] + (b[1] - a[1]) * (s + 1) / 10)], fill=(255, 176, 150, 255), width=3)
    over(hero, vl)
    # the centred axis, drawn in gold across everything (the choice)
    axis = new()
    Pen(axis).line([T(cx, -120), T(cx, h + 160)], fill=(255, 202, 116, 255), width=5)
    glow(hero, axis, 10, 1.3)
    over(hero, axis)
    # arrow: the church moves onto the axis
    arr = new()
    ap = Pen(arr)
    a0, a1 = V(gx + 40, gy + 30), T(cx - 66, iy0 - 40)
    mx, my = (a0[0] + a1[0]) / 2 + 10, min(a0[1], a1[1]) - 40
    pts = [((1 - t) ** 2 * a0[0] + 2 * (1 - t) * t * mx + t * t * a1[0], (1 - t) ** 2 * a0[1] + 2 * (1 - t) * t * my + t * t * a1[1])
           for t in np.linspace(0, 1, 24)]
    ap.line(pts, fill=(255, 214, 140, 255), width=4)
    ex, ey = pts[-1]
    dx, dy = ex - pts[-3][0], ey - pts[-3][1]
    L = math.hypot(dx, dy)
    dx, dy = dx / L, dy / L
    ap.poly([(ex + dx * 8, ey + dy * 8), (ex - dx * 16 - dy * 11, ey - dy * 16 + dx * 11), (ex - dx * 16 + dy * 11, ey - dy * 16 - dx * 11)],
            fill=(255, 214, 140, 255))
    glow(hero, arr, 6, 0.9)
    over(hero, arr)
    lf = font(("segoeuib.ttf", None), 21)
    tag = new()
    text(tag, V(40, 196), "OLMSTED", lf, (255, 190, 166, 255), tracking=3)
    text(tag, T(cx + 66, iy0 - 60), "STANFORD", lf, (255, 216, 146, 255), tracking=3)
    over(hero, tag)
    return hero


def mainquad_2(th):
    """1906: the Memorial Arch as a ghost above its two surviving bases."""
    hero = new()
    rng = random.Random(3)
    hz = 520
    over(hero, vgrad(28, hz, [(0, (14, 16, 44)), (0.45, (52, 40, 86)), (0.8, (150, 86, 104)), (1, (246, 152, 96))]))
    stars(Pen(hero), rng, (40, 40, 880, 330), 120)
    q = new()
    pq = Pen(q)
    pq.rect((0, hz - 40, 1200, hz), fill=(58, 36, 44, 255))
    pq.poly([(0, hz - 40), (1200, hz - 40), (1200, hz - 50), (0, hz - 50)], fill=(80, 42, 44, 255))
    for x in range(-6, 1200, 22):
        pq.ellipse((x, hz - 30, x + 14, hz - 16), fill=(36, 22, 30, 255))
        pq.rect((x, hz - 23, x + 14, hz), fill=(36, 22, 30, 255))
    over(hero, q)
    rimq = new()
    Pen(rimq).line([(0, hz - 50), (1200, hz - 50)], fill=(255, 176, 120, 160), width=1.5)
    over(hero, rimq)
    gm = poly_mask([(0, hz), (1200, hz), (1200, 720), (0, 720)])
    over(hero, vgrad(hz, 700, [(0, (96, 66, 60)), (1, (44, 30, 30))], gm))
    gl = new()
    pg = Pen(gl)
    vx = 458
    for i in range(-14, 15):
        pg.line([(vx + i * 12, hz), (vx + i * 120, 760)], fill=(255, 196, 150, 34), width=1.2)
    for j in range(1, 9):
        y = hz + (180 * (j / 8) ** 1.9)
        pg.line([(0, y), (1200, y)], fill=(255, 196, 150, 30), width=1.0)
    over(hero, gl)
    glow(hero, rgrad((458, hz), 360, [(0, (255, 170, 110, 160)), (1, (255, 150, 90, 0))], sy=0.35), 6, 0.8)

    # the ghost arch (drawn first so the solid bases sit in front of its feet)
    L, R, top = 230, 686, 142
    pier_w = 118
    arch_r = (R - L - 2 * pier_w) / 2
    ghost_m = mask()
    gpn = Pen(ghost_m)
    gpn.rect((L, top + 70, R, 600), fill=255)
    gpn.rect((L - 16, top + 40, R + 16, top + 72), fill=255)
    gpn.rect((L - 4, top, R + 4, top + 42), fill=255)
    gpn.rect((L + pier_w, 330, R - pier_w, 600), fill=0)
    gpn.ellipse((L + pier_w, 330 - arch_r, R - pier_w, 330 + arch_r), fill=0)
    nd = noise(8, 18, 2)
    diss = np.clip(((_XX - 470) / 260 + (300 - _YY) / 220) - nd * 0.9, 0, 1)
    keep = 1 - np.clip(diss * 1.6, 0, 1)
    ghost_body = vgrad(top, 600, [(0, (190, 240, 255, 120)), (1, (120, 210, 255, 34))], ghost_m)
    gb = np.asarray(ghost_body, np.float32).copy()
    gb[..., 3] *= (0.72 + 0.28 * (np.sin(_YY * math.pi / 3.0) > 0)) * keep
    over(hero, Image.fromarray(gb.astype(np.uint8), "RGBA"))
    edges = new()
    pe = Pen(edges)
    cyan = (170, 236, 255, 255)
    pe.line([(L, 600), (L, top + 72), (L - 16, top + 72), (L - 16, top + 40), (L - 4, top + 40), (L - 4, top)], fill=cyan, width=2.5)
    pe.line([(R, 600), (R, top + 72), (R + 16, top + 72), (R + 16, top + 40), (R + 4, top + 40), (R + 4, top)], fill=cyan, width=2.5)
    pe.line([(L - 4, top), (R + 4, top)], fill=cyan, width=2.5)
    pe.line([(L + pier_w, 600), (L + pier_w, 330)], fill=cyan, width=2.5)
    pe.line([(R - pier_w, 600), (R - pier_w, 330)], fill=cyan, width=2.5)
    pe.arc((L + pier_w, 330 - arch_r, R - pier_w, 330 + arch_r), 180, 360, fill=cyan, width=2.5)
    pe.arc((L + pier_w - 22, 330 - arch_r - 22, R - pier_w + 22, 330 + arch_r + 22), 180, 360, fill=(170, 236, 255, 150), width=1.6)
    for yy in (top + 92, top + 106):
        pe.line([(L, yy), (R, yy)], fill=(170, 236, 255, 120), width=1.4)
    for xx in (L + 28, L + 90, R - 90, R - 28):
        pe.line([(xx, 360), (xx, 560)], fill=(170, 236, 255, 90), width=1.4)
    e = np.asarray(edges, np.float32).copy()
    e[..., 3] *= keep
    edges = Image.fromarray(e.astype(np.uint8), "RGBA")
    glow(hero, edges, 8, 1.1)
    over(hero, edges)
    frag = new()
    pfr = Pen(frag)
    for _ in range(60):
        fx, fy = rng.uniform(470, 720), rng.uniform(100, 330)
        if (fx - 470) / 260 + (300 - fy) / 220 < 0.45:
            continue
        sz = rng.uniform(5, 16)
        a = rng.randint(70, 200)
        fx, fy = fx + rng.uniform(10, 60), fy - rng.uniform(10, 50)
        ang = rng.uniform(0, math.pi)
        pts = [(fx + sz * math.cos(ang + k * math.pi / 2), fy + sz * 0.7 * math.sin(ang + k * math.pi / 2)) for k in range(4)]
        pfr.poly(pts, fill=(160, 228, 255, a // 3), outline=(190, 240, 255, a), width=1.3)
    glow(hero, frag, 5, 0.9)
    over(hero, frag)

    # the two surviving bases: solid, warm sandstone, lit from the front
    for (x0, x1) in ((L, L + pier_w), (R - pier_w, R)):
        top_y, bot = 548, 650
        side = 18 if x0 < 458 else -18
        sh = new()
        Pen(sh).ellipse((x0 - 30, bot - 8, x1 + 40, bot + 16), fill=(0, 0, 0, 160))
        over(hero, blur(sh, 6))
        front = poly_mask([(x0, top_y), (x1, top_y), (x1, bot), (x0, bot)])
        over(hero, sandstone(front, (230, 180, 124), 31 + x0, 20, 0.16))
        over(hero, vgrad(top_y, bot, [(0, (255, 230, 190, 50)), (1, (40, 20, 10, 110))], front))
        sx = x1 if side > 0 else x0
        sidem = poly_mask([(sx, top_y), (sx + side, top_y - 10), (sx + side, bot - 8), (sx, bot)])
        over(hero, sandstone(sidem, (128, 88, 62), 40 + x0, 20, 0.16))
        topm = poly_mask([(x0, top_y), (x1, top_y), (x1 + side, top_y - 10), (x0 + side, top_y - 10)])
        over(hero, fill(topm, (255, 222, 172, 255)))
        pb = Pen(hero)
        pb.line([(x0, top_y + 14), (x1, top_y + 14)], fill=(120, 80, 56, 200), width=1.6)
        pb.line([(x0, bot - 18), (x1, bot - 18)], fill=(120, 80, 56, 200), width=1.6)
        rim = new()
        Pen(rim).line([(x0, bot), (x0, top_y), (x1, top_y)], fill=(255, 226, 180, 255), width=2)
        glow(hero, rim, 4, 0.8)
        over(hero, rim)
    return hero


def mainquad_3(th):
    """CLASS DAY: a cutaway of the arcade floor, a plaque in the paving and a time capsule in the ground below."""
    hero = new()
    over(hero, vgrad(28, 330, [(0, (34, 26, 40)), (1, (120, 76, 66))]))
    back = new()
    pb = Pen(back)
    y_floor = 318
    xs = [118, 330, 542, 754]
    pb.rect((60, 60, 860, y_floor), fill=(214, 166, 112, 255))
    for yy in range(84, y_floor, 26):
        pb.line([(60, yy), (860, yy)], fill=(176, 128, 84, 255), width=1.2)
    holes = mask()
    for i in range(3):
        a0, a1 = xs[i] + 30, xs[i + 1] - 30
        r = (a1 - a0) / 2
        Pen(holes).rect((a0, 140 + r, a1, y_floor), fill=255)
        Pen(holes).ellipse((a0, 140, a1, 140 + 2 * r), fill=255)
    back = shade(back, 0.95 + 0.06 * noise(51, 30, 2) + 0.06 * noise(52, 2.5, 1))
    back = clip_to(back, Image.fromarray(255 - np.asarray(holes), "L"))
    # through the arches: the shaded walk and a warm courtyard glow beyond
    over(hero, vgrad(140, y_floor, [(0, (54, 36, 38)), (0.6, (96, 62, 50)), (1, (196, 132, 84))], holes))
    beyond = new()
    pbn = Pen(beyond)
    for i in range(3):
        a0, a1 = xs[i] + 30, xs[i + 1] - 30
        pbn.rect((a0 + 18, 236, a1 - 18, y_floor - 14), fill=(255, 210, 150, 110))
        for c in (a0 + 60, a1 - 60):
            pbn.rect((c - 9, 236, c + 9, y_floor - 14), fill=(110, 72, 54, 200))
    over(hero, clip_to(blur(beyond, 0.8), holes))
    over(hero, back)
    inner = new()
    pi_ = Pen(inner)
    for i in range(3):
        a0, a1 = xs[i] + 30, xs[i + 1] - 30
        r = (a1 - a0) / 2
        pi_.arc((a0, 140, a1, 140 + 2 * r), 180, 360, fill=(255, 224, 170, 255), width=3)
        pi_.line([(a0, 140 + r), (a0, y_floor)], fill=(255, 224, 170, 200), width=2)
    glow(hero, inner, 4, 0.7)
    over(hero, inner)
    # paving: top surface in perspective
    top_pts = [(150, y_floor), (766, y_floor), (860, 404), (56, 404)]
    tm = poly_mask(top_pts)
    over(hero, sandstone(tm, (222, 182, 130), 61, 18, 0.14))
    lines = new()
    pl = Pen(lines)
    for i in range(1, 9):
        t = i / 9
        pl.line([(150 + (766 - 150) * t, y_floor), (56 + (860 - 56) * t, 404)], fill=(120, 84, 58, 200), width=1.4)
    for yy in (346, 374):
        f = (yy - y_floor) / (404 - y_floor)
        pl.line([(150 - 94 * f, yy), (766 + 94 * f, yy)], fill=(120, 84, 58, 200), width=1.4)
    over(hero, lines)
    # bronze plaque set in the paving
    plq = [(380, 340), (540, 340), (556, 384), (364, 384)]
    pm = poly_mask(plq)
    over(hero, lgrad((364, 340), (556, 384), [(0, (120, 72, 30)), (0.45, (250, 206, 128)), (0.55, (255, 236, 186)), (1, (140, 86, 36))], pm))
    pp = Pen(hero)
    pp.poly(plq, outline=(255, 232, 170, 255), width=2)
    for k, yy in enumerate((352, 362, 372)):
        f = (yy - 340) / 44
        pp.line([(398 - 16 * f + k * 6, yy), (522 + 16 * f - k * 6, yy)], fill=(96, 56, 22, 220), width=2)
    glint = new()
    Pen(glint).circle((515, 348), 3, fill=(255, 255, 240, 255))
    glow(hero, glint, 7, 2.0)
    glow(hero, fill(pm, (255, 200, 120, 255)), 10, 0.35)
    # cut face: stone slab, bedding, soil strata
    face_bot = 700
    over(hero, sandstone(poly_mask([(56, 404), (860, 404), (860, 436), (56, 436)]), (190, 144, 96), 71, 14, 0.12))
    Pen(hero).line([(56, 404), (860, 404)], fill=(255, 226, 176, 255), width=2)
    for x in range(56, 860, 100):
        Pen(hero).line([(x, 404), (x, 436)], fill=(110, 76, 52, 220), width=1.4)
    soil_m = poly_mask([(56, 436), (860, 436), (860, face_bot), (56, face_bot)])
    soil = vgrad(436, face_bot, [(0, (112, 76, 52)), (0.3, (88, 60, 44)), (0.7, (64, 44, 34)), (1, (40, 28, 24))], soil_m)
    n = noise(81, 30, 4)
    strata = 0.85 + 0.25 * (0.5 + 0.5 * np.sin(_YY / 7.0 + n * 6))
    over(hero, shade(soil, strata * (0.9 + 0.2 * noise(82, 4, 2))))
    rng = random.Random(9)
    peb = new()
    pq = Pen(peb)
    for _ in range(46):
        x, y = rng.uniform(60, 856), rng.uniform(450, 690)
        if abs(y - 566) < 80 and 270 < x < 660:
            continue
        r = rng.uniform(4, 11)
        c = rng.choice(((132, 100, 74), (110, 84, 64), (150, 118, 88)))
        pq.ellipse((x - r, y - r * 0.6, x + r, y + r * 0.6), fill=c + (170,))
        pq.arc((x - r, y - r * 0.6, x + r, y + r * 0.6), 190, 300, fill=(214, 176, 130, 150), width=1.2)
    over(hero, peb)
    # light from the plaque down to the capsule
    beam = new()
    Pen(beam).poly([(440, 384), (480, 384), (520, 530), (400, 530)], fill=(255, 210, 140, 120))
    glow(hero, beam, 12, 0.6)
    for yy in range(446, 516, 14):
        Pen(hero).circle((460, yy), 2.2, fill=(255, 226, 170, 220))
    # the time capsule: a sealed steel cylinder, glowing at the seam
    cy0, cy1, x0, x1 = 530, 610, 320, 600
    add(hero, rgrad((460, 570), 230, [(0, (255, 196, 120, 200)), (1, (255, 170, 100, 0))], sy=0.55), 0.8)
    sh = new()
    Pen(sh).ellipse((x0 - 30, cy1 - 10, x1 + 40, cy1 + 16), fill=(0, 0, 0, 150))
    over(hero, blur(sh, 6))
    body_m = mask()
    Pen(body_m).rect((x0, cy0, x1, cy1), fill=255)
    Pen(body_m).ellipse((x0 - 22, cy0, x0 + 22, cy1), fill=255)
    over(hero, metal_horizontal(body_m, (cy0 + cy1) / 2, (cy1 - cy0) / 2, STEEL))
    cap_m = mask()
    Pen(cap_m).ellipse((x1 - 22, cy0, x1 + 22, cy1), fill=255)
    over(hero, rgrad((x1 - 6, cy0 + 26), 50, [(0, (236, 242, 248)), (0.6, (150, 160, 172)), (1, (84, 92, 104))], cap_m, sy=1.8))
    Pen(hero).ellipse((x1 - 22, cy0, x1 + 22, cy1), outline=(255, 255, 255, 170), width=1.5)
    Pen(hero).ellipse((x1 - 12, cy0 + 16, x1 + 12, cy1 - 16), outline=(90, 98, 110, 200), width=1.5)
    seam = new()
    Pen(seam).line([(530, cy0), (530, cy1)], fill=(255, 200, 120, 255), width=3)
    Pen(seam).line([(390, cy0), (390, cy1)], fill=(255, 200, 120, 160), width=2)
    glow(hero, seam, 6, 1.4)
    over(hero, seam)
    return hero


# ---------------------------------------------------------------------------------------------------------------
# HUANG: graphite, glass and electric light; precise isometric engineering drawings with real lighting

def iso_fn(ox, oy, s):
    def I(x, y, z=0.0):
        return (ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s)
    return I


def tone(c, k):
    return tuple(int(max(0, min(255, v * k))) for v in c[:3])


def iso_box(lay, I, x, y, z, dx, dy, dz, color, alpha=255, edge=None, top_k=1.18, left_k=0.9, right_k=0.62):
    p = Pen(lay)
    top = [I(x, y, z + dz), I(x + dx, y, z + dz), I(x + dx, y + dy, z + dz), I(x, y + dy, z + dz)]
    left = [I(x, y + dy, z), I(x + dx, y + dy, z), I(x + dx, y + dy, z + dz), I(x, y + dy, z + dz)]
    right = [I(x + dx, y, z), I(x + dx, y + dy, z), I(x + dx, y + dy, z + dz), I(x + dx, y, z + dz)]
    p.poly(right, fill=tone(color, right_k) + (alpha,))
    p.poly(left, fill=tone(color, left_k) + (alpha,))
    p.poly(top, fill=tone(color, top_k) + (alpha,))
    if edge:
        p.line([I(x, y + dy, z + dz), I(x + dx, y + dy, z + dz), I(x + dx, y, z + dz)], fill=edge, width=1.6)
        p.line([I(x + dx, y + dy, z), I(x + dx, y + dy, z + dz)], fill=edge, width=1.2)
    return top, left, right


def link_graph(lay, rng, box, n, color, max_a=150):
    x0, y0, x1, y1 = box
    nodes = [(rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(2, 7)) for _ in range(n)]
    p = Pen(lay)
    for i, (x, y, r) in enumerate(nodes):
        near = sorted(nodes, key=lambda q: (q[0] - x) ** 2 + (q[1] - y) ** 2)[1:4]
        for (qx, qy, _) in near:
            p.line([(x, y), (qx, qy)], fill=color + (int(max_a * 0.35),), width=1.1)
    for (x, y, r) in nodes:
        p.circle((x, y), r, fill=color + (max_a,))
        p.circle((x, y), r * 0.45, fill=(255, 255, 255, max_a))
    return nodes


def huang_backdrop(hero, seed=1, floor_y=560):
    over(hero, vgrad(28, HERO_BOTTOM, [(0, (10, 20, 34)), (0.62, (14, 30, 48)), (1, (6, 12, 20))]))
    glow(hero, rgrad((458, floor_y - 160), 420, [(0, (40, 120, 170, 150)), (1, (20, 60, 90, 0))], sy=0.7), 4, 0.8)
    grid = new()
    pg = Pen(grid)
    vx, vy = 458, floor_y - 240
    for i in range(-20, 21):
        pg.line([(vx + i * 14, floor_y), (vx + i * 150, floor_y + 400)], fill=(90, 210, 240, 40), width=1)
    for j in range(1, 10):
        y = floor_y + 180 * (j / 9) ** 1.8
        pg.line([(0, y), (1200, y)], fill=(90, 210, 240, 34), width=1)
    over(hero, clip_to(grid, poly_mask([(0, floor_y), (1200, floor_y), (1200, 720), (0, 720)])))


def huang_0(th):
    """JENSEN + LORI: the gift behind the gateway. A lit portal at the meeting point of circuit traces.
    On device the hologram covers the centre window, so the traces and pads carry the frame outside it."""
    hero = new()
    huang_backdrop(hero, floor_y=600)
    rng = random.Random(14)
    tr = new()
    pt = Pen(tr)
    cx, cy = 458, 470
    pads = []
    for k in range(26):
        side = k % 4
        if side == 0:
            sx, sy = rng.uniform(60, 860), rng.uniform(150, 240)
        elif side == 1:
            sx, sy = rng.uniform(40, 112), rng.uniform(170, 680)
        elif side == 2:
            sx, sy = rng.uniform(828, 880), rng.uniform(170, 680)
        else:
            sx, sy = rng.uniform(60, 860), rng.uniform(650, 690)
        # route: orthogonal leg then 45-degree leg into the portal
        mx = sx if abs(sx - cx) < 160 else cx + math.copysign(rng.uniform(40, 150), sx - cx)
        my = sy
        pts = [(sx, sy), (mx + (sy - cy) * 0.0, my)]
        d = abs(my - cy)
        ex = cx + math.copysign(min(abs(mx - cx), d) * 0.3, mx - cx)
        pts += [(ex, cy + math.copysign(30, my - cy))]
        a = rng.randint(90, 200)
        pt.line(pts, fill=(90, 228, 250, a), width=rng.choice((2, 2.5, 3)))
        pads.append((sx, sy, a))
    for (x, y, a) in pads:
        pt.circle((x, y), 5, fill=(10, 30, 44, 255), outline=(140, 240, 255, a), width=2)
    glow(hero, tr, 6, 0.9)
    over(hero, tr)
    # the portal: a glass-and-stone gateway pouring light
    fr = (340, 300, 576, 600)
    op = (380, 340, 536, 600)
    m_fr = poly_mask([(fr[0], fr[1]), (fr[2], fr[1]), (fr[2], fr[3]), (fr[0], fr[3])])
    Pen(m_fr).rect(op, fill=0)
    over(hero, vgrad(fr[1], fr[3], [(0, (70, 92, 112)), (1, (30, 42, 56))], m_fr))
    m_op = poly_mask([(op[0], op[1]), (op[2], op[1]), (op[2], op[3]), (op[0], op[3])])
    over(hero, rgrad((458, 560), 260, [(0, (255, 248, 230)), (0.4, (255, 214, 160)), (1, (120, 170, 210))], m_op, sy=1.4))
    inside = new()
    pin = Pen(inside)
    for i in range(-6, 7):
        pin.line([(458 + i * 6, 470), (458 + i * 40, 600)], fill=(200, 150, 100, 110), width=1.5)
    for k in range(1, 6):
        y = 470 + 130 * (k / 5) ** 1.6
        pin.line([(op[0], y), (op[2], y)], fill=(200, 150, 100, 90), width=1.2)
    for x in (410, 506):
        pin.rect((x - 4, 380, x + 4, 470), fill=(200, 150, 100, 90))
    over(hero, clip_to(inside, m_op))
    glow(hero, fill(m_op, (255, 220, 170, 255)), 30, 0.6)
    spill = new()
    Pen(spill).poly([(op[0], 600), (op[2], 600), (op[2] + 160, 700), (op[0] - 160, 700)], fill=(255, 220, 170, 140))
    glow(hero, spill, 8, 0.8)
    rim = new()
    Pen(rim).rect(fr, outline=(160, 240, 255, 255), width=2)
    Pen(rim).rect(op, outline=(255, 236, 200, 255), width=2)
    glow(hero, rim, 5, 0.8)
    over(hero, rim)
    return hero


def huang_1(th):
    """INSIDE: an isometric cutaway; the dean's office, Terman Library and the 300-seat auditorium meet at a hub."""
    hero = new()
    huang_backdrop(hero, floor_y=640)
    I = iso_fn(458, 250, 33)
    # floor plate
    plate = new()
    pp = Pen(plate)
    pp.poly([I(0, 0, -0.5), I(10, 0, -0.5), I(10, 10, -0.5), I(0, 10, -0.5)], fill=(20, 40, 58, 255))
    pp.poly([I(0, 10, -0.5), I(10, 10, -0.5), I(10, 10, 0), I(0, 10, 0)], fill=(16, 32, 46, 255))
    pp.poly([I(10, 0, -0.5), I(10, 10, -0.5), I(10, 10, 0), I(10, 0, 0)], fill=(10, 22, 34, 255))
    pp.poly([I(0, 0), I(10, 0), I(10, 10), I(0, 10)], fill=(28, 58, 80, 255))
    for i in range(11):
        pp.line([I(i, 0), I(i, 10)], fill=(90, 210, 240, 40), width=1)
        pp.line([I(0, i), I(10, i)], fill=(90, 210, 240, 40), width=1)
    over(hero, plate)
    edge = new()
    Pen(edge).line([I(0, 10), I(10, 10), I(10, 0)], fill=(140, 236, 255, 255), width=2)
    glow(hero, edge, 4, 0.8)
    over(hero, edge)
    rooms = {"lib": (0.4, 0.4, 4.0, 5.0), "aud": (4.8, 0.4, 5.0, 5.6), "dean": (0.4, 6.0, 4.0, 3.6)}
    lay = new()
    lp = Pen(lay)
    for key, (x, y, dx, dy) in rooms.items():
        lp.poly([I(x, y), I(x + dx, y), I(x + dx, y + dy), I(x, y + dy)], fill=(36, 74, 100, 255))
        # back walls (low, glass)
        lp.poly([I(x, y), I(x + dx, y), I(x + dx, y, 1.4), I(x, y, 1.4)], fill=(80, 170, 210, 70))
        lp.poly([I(x, y), I(x, y + dy), I(x, y + dy, 1.4), I(x, y, 1.4)], fill=(80, 170, 210, 90))
        lp.line([I(x, y + dy, 1.4), I(x, y, 1.4), I(x + dx, y, 1.4)], fill=(150, 236, 255, 230), width=1.6)
    over(hero, lay)
    # library: shelves of books
    books = new()
    x, y, dx, dy = rooms["lib"]
    cols = [(220, 96, 70), (240, 190, 90), (90, 170, 220), (120, 200, 150), (230, 230, 240)]
    rng = random.Random(6)
    for r in range(4):
        sy = y + 0.8 + r * 1.1
        iso_box(books, I, x + 0.5, sy, 0, 3.0, 0.35, 1.1, (70, 110, 140), edge=(170, 236, 255, 160))
        p = Pen(books)
        t = 0.0
        while t < 2.9:
            w = rng.uniform(0.09, 0.2)
            c = rng.choice(cols)
            p.poly([I(x + 0.5 + t, sy + 0.35, 0.1), I(x + 0.5 + t + w, sy + 0.35, 0.1),
                    I(x + 0.5 + t + w, sy + 0.35, rng.uniform(0.75, 1.0)), I(x + 0.5 + t, sy + 0.35, 0.9)], fill=c + (230,))
            t += w + 0.03
    over(hero, books)
    # auditorium: tiered arcs of seats facing a lit stage
    aud = new()
    pa = Pen(aud)
    x, y, dx, dy = rooms["aud"]
    stage = (x + dx - 0.3, y + dy / 2)
    pa.poly([I(x + dx - 0.6, y + 0.6, 0.3), I(x + dx - 0.15, y + 0.6, 0.3), I(x + dx - 0.15, y + dy - 0.6, 0.3), I(x + dx - 0.6, y + dy - 0.6, 0.3)],
            fill=(255, 226, 180, 255))
    seats = 0
    for k in range(8):
        r = 1.0 + k * 0.52
        z = 0.12 * k
        n = int(14 + k * 5.2)
        for i in range(n):
            a = math.radians(105 + 150 * i / (n - 1))
            sx, sy = stage[0] + r * math.cos(a), stage[1] + r * math.sin(a)
            if x + 0.15 < sx < x + dx - 0.2 and y + 0.15 < sy < y + dy - 0.15:
                pa.circle(I(sx, sy, z), 2.1, fill=(150, 236, 255, 230))
                seats += 1
    glow(hero, aud, 4, 0.8)
    over(hero, aud)
    # dean's office: desk, chair, window light
    off = new()
    x, y, dx, dy = rooms["dean"]
    iso_box(off, I, x + 1.2, y + 1.2, 0, 1.8, 0.8, 0.75, (180, 140, 100), edge=(255, 230, 190, 200))
    iso_box(off, I, x + 1.8, y + 2.3, 0, 0.6, 0.6, 0.5, (90, 130, 160))
    Pen(off).poly([I(x, y + 0.8, 0.5), I(x, y + 2.8, 0.5), I(x, y + 2.8, 1.3), I(x, y + 0.8, 1.3)], fill=(255, 230, 180, 160))
    over(hero, off)
    # hub: a column of light in the lobby, with paths along the floor to each room
    hx, hy = 7.2, 7.8
    paths = new()
    pp = Pen(paths)
    for route in (((hx, hy), (4.7, 5.7), (2.4, 5.7), (2.4, 5.4)), ((hx, hy), (7.0, 6.0)), ((hx, hy), (4.4, 7.8))):
        pp.line([I(*q) for q in route], fill=(255, 214, 140, 255), width=3)
        for (q0, q1) in zip(route, route[1:]):
            pp.circle(I((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2), 4, fill=(255, 250, 230, 255))
    glow(hero, paths, 6, 1.0)
    over(hero, paths)
    col = new()
    bx, by = I(hx, hy)
    Pen(col).poly([(bx - 12, by), (bx + 12, by), (bx + 6, by - 150), (bx - 6, by - 150)], fill=(255, 226, 170, 200))
    glow(hero, col, 14, 1.0)
    over(hero, blur(col, 2))
    ring = new()
    for k, r in enumerate((24, 44, 66)):
        Pen(ring).ellipse((bx - r, by - r * 0.5, bx + r, by + r * 0.5), outline=(255, 220, 160, 220 - k * 60), width=2)
    glow(hero, ring, 4, 0.8)
    over(hero, ring)
    # labels (copy words only), each with a leader to its room
    lf = font(("bahnschrift.ttf", (700, 100)), 22)
    for label, (lx, ly), target in (("TERMAN LIBRARY", (96, 214), I(1.6, 2.0, 1.4)),
                                    ("300-SEAT NVIDIA AUDITORIUM", (478, 226), I(7.4, 1.6, 0.6)),
                                    ("DEAN'S OFFICE", (84, 520), I(1.8, 8.4, 0.6))):
        tw = text_width(label, lf, 2)
        tag = new()
        tp = Pen(tag)
        near_x = lx + tw + 12 if target[0] > lx + tw else (lx + tw / 2)
        near_y = ly if target[0] > lx + tw else (ly - 18 if target[1] < ly else ly + 18)
        tp.line([(near_x, near_y), target], fill=(140, 236, 255, 220), width=1.6)
        tp.circle(target, 4, fill=(220, 250, 255, 255))
        tp.rrect((lx - 12, ly - 19, lx + tw + 12, ly + 19), 6, fill=(8, 18, 28, 230), outline=(120, 230, 250, 230), width=1.5)
        text(tag, (lx, ly), label, lf, (230, 250, 255, 255), tracking=2, anchor="lm")
        over(hero, tag)
    return hero


BRICK = [(222, 52, 44), (250, 196, 36), (32, 112, 214), (44, 164, 86), (250, 196, 36), (222, 52, 44), (32, 112, 214), (44, 164, 86)]


def toy_brick(lay, I, x, y, z, dx, dy, dz, color, studs=True):
    iso_box(lay, I, x, y, z, dx, dy, dz, color, edge=tone(color, 1.5) + (220,), top_k=1.12, left_k=0.92, right_k=0.62)
    if not studs:
        return
    p = Pen(lay)
    s = (I(1, 0)[0] - I(0, 0)[0]) / 0.866
    for i in range(int(dx)):
        for j in range(int(dy)):
            cx, cy = I(x + i + 0.5, y + j + 0.5, z + dz)
            rx, ry = 0.3 * s * 1.0, 0.3 * s * 0.55
            hgt = 0.22 * s
            p.rect((cx - rx, cy - hgt, cx + rx, cy), fill=tone(color, 0.78) + (255,))
            p.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=tone(color, 0.78) + (255,))
            p.ellipse((cx - rx, cy - hgt - ry, cx + rx, cy - hgt + ry), fill=tone(color, 1.22) + (255,))
            p.arc((cx - rx, cy - hgt - ry, cx + rx, cy - hgt + ry), 160, 250, fill=(255, 255, 255, 170), width=1.4)


def huang_2(th):
    """1996: the original PageRank test servers, wrapped in colourful toy building blocks, over a web of links."""
    hero = new()
    huang_backdrop(hero, floor_y=610)
    rng = random.Random(21)
    web = new()
    link_graph(web, rng, (50, 120, 870, 560), 34, (100, 220, 250), 120)
    glow(hero, web, 3, 0.6)
    over(hero, web)
    I = iso_fn(372, 436, 32)
    lay = new()
    D = 2
    # back panel of the bay
    iso_box(lay, I, 2, 0, 1.2, 4, 0.3, 7.2, (24, 30, 38))
    for x0, color in ((0, BRICK[0]), (2, BRICK[2]), (6, BRICK[3])):
        toy_brick(lay, I, x0, 0, 0, 2 if x0 != 2 else 4, D, 1.2, color, studs=False)
    for k in range(6):
        toy_brick(lay, I, 0, 0, 1.2 + k * 1.2, 2, D, 1.2, BRICK[(k + 1) % 8], studs=False)
    # the drives in the bay
    for k in range(5):
        z = 1.45 + k * 1.38
        top, left, right = iso_box(lay, I, 2.15, 0.35, z, 3.7, 1.5, 1.0, (52, 60, 72), edge=(150, 170, 190, 200))
        p = Pen(lay)
        p.poly([I(2.4, 1.85, z + 0.25), I(4.4, 1.85, z + 0.25), I(4.4, 1.85, z + 0.75), I(2.4, 1.85, z + 0.75)], fill=(34, 40, 50, 255))
        for v in range(6):
            p.line([I(2.55 + v * 0.3, 1.85, z + 0.33), I(2.55 + v * 0.3, 1.85, z + 0.67)], fill=(110, 124, 140, 200), width=1.2)
        for lx, c in ((5.0, (90, 255, 140)), (5.4, (255, 190, 80) if k % 2 else (90, 255, 140))):
            p.circle(I(lx, 1.85, z + 0.5), 3.4, fill=c + (255,))
    for k in range(6):
        toy_brick(lay, I, 6, 0, 1.2 + k * 1.2, 2, D, 1.2, BRICK[(k + 4) % 8], studs=False)
    toy_brick(lay, I, 0, 0, 8.4, 4, D, 1.2, BRICK[1])
    toy_brick(lay, I, 4, 0, 8.4, 4, D, 1.2, BRICK[0])
    # contact shadow and glossy floor reflection
    sh = new()
    Pen(sh).poly([I(-0.4, -0.4), I(8.6, -0.4), I(8.6, 2.6), I(-0.4, 2.6)], fill=(0, 0, 0, 200))
    over(hero, blur(sh, 10))
    refl = lay.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    base_y = I(8, 2)[1]
    off = int((2 * base_y - H) * SS)
    rl = new()
    rl.alpha_composite(refl, (0, off) if off >= 0 else (0, 0), (0, 0 if off >= 0 else -off))
    ra = np.asarray(rl, np.float32).copy()
    ra[..., 3] *= np.clip(1 - (_YY - base_y + 30) / 90, 0, 1) * 0.28
    over(hero, Image.fromarray(ra.astype(np.uint8), "RGBA"))
    over(hero, lay)
    # LEDs glow and key light
    leds = new()
    for k in range(5):
        z = 1.45 + k * 1.38
        for lx, c in ((5.0, (90, 255, 140)), (5.4, (255, 190, 80) if k % 2 else (90, 255, 140))):
            Pen(leds).circle(I(lx, 1.85, z + 0.5), 4, fill=c + (255,))
    glow(hero, leds, 6, 1.6)
    key = rgrad(I(0, 2, 9), 320, [(0, (255, 255, 255, 70)), (1, (255, 255, 255, 0))])
    add(hero, clip_to(key, lay.getchannel("A")), 0.8)
    rim = new()
    Pen(rim).line([I(8, 0, 9.6), I(8, 0, 0)], fill=(140, 236, 255, 255), width=2.5)
    Pen(rim).line([I(8, 0, 9.6), I(8, 2, 9.6)], fill=(140, 236, 255, 200), width=2)
    glow(hero, rim, 5, 0.9)
    over(hero, rim)
    return hero


def huang_3(th):
    """50%: half the energy of a comparable building, on the east-west engineering axis."""
    hero = new()
    huang_backdrop(hero, floor_y=600)
    cx, cy, R, wdt = 458, 362, 206, 36
    # east-west axis
    ax = new()
    pa = Pen(ax)
    pa.line([(104, 586), (812, 586)], fill=(140, 236, 255, 200), width=2)
    for x in range(120, 812, 30):
        pa.line([(x, 580), (x, 592)], fill=(140, 236, 255, 90), width=1.2)
    glow(hero, ax, 4, 0.6)
    over(hero, ax)
    lf = font(("bahnschrift.ttf", (700, 100)), 26)
    tag = new()
    text(tag, (70, 586), "W", lf, (220, 250, 255, 255), anchor="lm")
    text(tag, (846, 586), "E", lf, (220, 250, 255, 255), anchor="rm")
    over(hero, tag)
    # the comparable building's full ring, ghosted
    ghost = new()
    pg = Pen(ghost)
    pg.arc((cx - R, cy - R, cx + R, cy + R), 90, 270, fill=(120, 190, 220, 34), width=wdt)
    for i in range(36):
        a0 = 90 + i * 5
        pg.arc((cx - R, cy - R, cx + R, cy + R), a0 + 1, a0 + 3.4, fill=(150, 214, 240, 120), width=wdt * 0.25)
    over(hero, ghost)
    # the lit half: glass tube with a bright core
    arc_m = mask()
    Pen(arc_m).arc((cx - R, cy - R, cx + R, cy + R), -90, 90, fill=255, width=wdt)
    for a in (-90, 90):
        ex, ey = cx + (R - wdt / 2) * math.cos(math.radians(a)), cy + (R - wdt / 2) * math.sin(math.radians(a))
        Pen(arc_m).circle((ex, ey), wdt / 2, fill=255)
    rr = np.sqrt((_XX - cx) ** 2 + (_YY - cy) ** 2)
    v = np.clip((rr - (R - wdt / 2)) / (wdt / 2), -1, 1)
    ang = np.degrees(np.arctan2(_YY - cy, _XX - cx))
    t = np.clip((ang + 90) / 180, 0, 1)
    body = ramp(t, [(0, (40, 200, 240)), (1, (120, 255, 200))])
    b = 0.62 + 0.5 * np.exp(-((v + 0.35) / 0.25) ** 2) - 0.25 * np.clip(v, 0, 1)
    body[..., :3] = np.clip(body[..., :3] * b[..., None] + 90 * np.exp(-((v + 0.4) / 0.12) ** 2)[..., None], 0, 255)
    lit = from_np(body, arc_m)
    glow(hero, lit, 18, 0.9)
    over(hero, lit)
    ticks = new()
    pt = Pen(ticks)
    for i in range(21):
        a = math.radians(-90 + i * 9)
        r0, r1 = R + 26, R + (40 if i % 5 == 0 else 33)
        pt.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], fill=(170, 246, 255, 230), width=2)
    for i in range(1, 20):
        a = math.radians(90 + i * 9)
        r0, r1 = R + 26, R + 33
        pt.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], fill=(170, 246, 255, 70), width=1.5)
    over(hero, ticks)
    # the building at the centre: a calm glass block
    I = iso_fn(cx, cy + 22, 18)
    blk = new()
    iso_box(blk, I, -3, -3, 0, 6, 6, 3.4, (60, 120, 150), alpha=255, edge=(170, 246, 255, 255))
    iso_box(blk, I, -2.2, -2.2, 3.4, 4.4, 4.4, 0.8, (80, 150, 170), alpha=255, edge=(170, 246, 255, 255))
    p = Pen(blk)
    for k in range(1, 6):
        p.line([I(-3 + k, 3, 0.3), I(-3 + k, 3, 3.1)], fill=(170, 246, 255, 120), width=1.2)
        p.line([I(3, -3 + k, 0.3), I(3, -3 + k, 3.1)], fill=(170, 246, 255, 90), width=1.2)
    for z in (1.1, 2.2):
        p.line([I(-3, 3, z), I(3, 3, z), I(3, -3, z)], fill=(170, 246, 255, 110), width=1.2)
    win = new()
    pw = Pen(win)
    for k in range(5):
        for z in (0.4, 1.5, 2.6):
            if (k + int(z)) % 3 != 1:
                pw.poly([I(-2.85 + k, 3, z), I(-2.15 + k, 3, z), I(-2.15 + k, 3, z + 0.65), I(-2.85 + k, 3, z + 0.65)], fill=(255, 226, 170, 200))
    over(hero, blk)
    glow(hero, win, 3, 0.8)
    over(hero, win)
    sh = new()
    Pen(sh).ellipse((cx - 150, cy + 100, cx + 150, cy + 140), fill=(80, 230, 255, 60))
    glow(hero, sh, 10, 0.6)
    return hero


# ---------------------------------------------------------------------------------------------------------------
# HOOVER: midnight blue, floodlit stucco, bronze and brass; tall vertical compositions

def hoover_sky(hero, hz=600, seed=2, warm=(240, 150, 96)):
    over(hero, vgrad(28, hz, [(0, (8, 12, 34)), (0.5, (22, 34, 76)), (0.82, (70, 64, 110)), (1, warm)]))
    stars(Pen(hero), random.Random(seed), (40, 40, 880, hz - 200), 150)


def tower(lay, cx, base_y, top_y, w_base, w_top, lit=(250, 214, 164), shadow=(150, 112, 86)):
    """Hoover Tower in a low-angle view: tapered shaft, belfry with arched openings, tiled dome and lantern."""
    p = Pen(lay)
    h = base_y - top_y
    shaft_top = top_y + h * 0.26
    belfry_top = shaft_top - h * 0.085

    def half(y):
        t = (base_y - y) / h
        return (w_base + (w_top - w_base) * t) / 2
    # shaft: lit front with a narrow shaded side
    hb, ht = half(base_y), half(shaft_top)
    side = 0.22
    p.poly([(cx - hb, base_y), (cx + hb * (1 - side * 2), base_y), (cx + ht * (1 - side * 2), shaft_top), (cx - ht, shaft_top)], fill=lit + (255,))
    p.poly([(cx + hb * (1 - side * 2), base_y), (cx + hb, base_y), (cx + ht, shaft_top), (cx + ht * (1 - side * 2), shaft_top)], fill=shadow + (255,))
    # recessed vertical window bays
    for k in (-0.62, -0.36, -0.1, 0.16, 0.42):
        x0b, x0t = cx + hb * k, cx + ht * k
        bw_b, bw_t = hb * 0.1, ht * 0.1
        p.poly([(x0b, base_y - 20), (x0b + bw_b, base_y - 20), (x0t + bw_t, shaft_top + 22), (x0t, shaft_top + 22)], fill=(170, 124, 92, 255))
        p.line([(x0b, base_y - 20), (x0t, shaft_top + 22)], fill=(120, 84, 62, 255), width=1.6)
        p.line([(x0b + bw_b, base_y - 20), (x0t + bw_t, shaft_top + 22)], fill=(255, 240, 210, 220), width=1.2)
    # belfry with arched openings and a cornice
    hbt = half(belfry_top)
    p.poly([(cx - ht - 6, shaft_top + 4), (cx + ht + 6, shaft_top + 4), (cx + ht + 6, shaft_top - 6), (cx - ht - 6, shaft_top - 6)], fill=lit + (255,))
    p.poly([(cx - ht, shaft_top - 6), (cx + ht * (1 - side * 2), shaft_top - 6), (cx + hbt * (1 - side * 2), belfry_top), (cx - hbt, belfry_top)], fill=lit + (255,))
    p.poly([(cx + ht * (1 - side * 2), shaft_top - 6), (cx + ht, shaft_top - 6), (cx + hbt, belfry_top), (cx + hbt * (1 - side * 2), belfry_top)], fill=shadow + (255,))
    bh = shaft_top - 6 - belfry_top
    n = 3
    span = (ht + hbt) * (1 - side) * 0.94
    x_left = cx - (ht + hbt) / 2 * 0.92
    ow = span / n * 0.6
    for i in range(n):
        ox = x_left + i * span / n + span / n * 0.2
        p.rect((ox, belfry_top + bh * 0.45, ox + ow, shaft_top - 14), fill=(255, 210, 140, 255))
        p.ellipse((ox, belfry_top + bh * 0.45 - ow / 2, ox + ow, belfry_top + bh * 0.45 + ow / 2), fill=(255, 210, 140, 255))
    p.poly([(cx - hbt - 8, belfry_top + 2), (cx + hbt + 8, belfry_top + 2), (cx + hbt + 4, belfry_top - 8), (cx - hbt - 4, belfry_top - 8)], fill=lit + (255,))
    # dome: red tile, with a lantern and finial
    dw = hbt * 0.92
    dome_h = h * 0.11
    dome_top = belfry_top - 8 - dome_h
    pts = [(cx - dw, belfry_top - 8)]
    for i in range(1, 30):
        t = i / 30
        a = math.pi * t
        pts.append((cx - dw * math.cos(a), belfry_top - 8 - dome_h * math.sin(a) ** 0.8))
    pts.append((cx + dw, belfry_top - 8))
    p.poly(pts, fill=(196, 92, 60, 255))
    for k in range(1, 6):
        p.arc((cx - dw * (1 - k * 0.16), dome_top + 4, cx + dw * (1 - k * 0.16), belfry_top - 8 + dome_h * 0.9), 180, 360, fill=(150, 62, 40, 200), width=1.2)
    lw = dw * 0.32
    lt = dome_top - h * 0.05
    p.rect((cx - lw, lt, cx + lw, dome_top + 6), fill=lit + (255,))
    p.ellipse((cx - lw, lt - lw * 0.7, cx + lw, lt + lw * 0.7), fill=(196, 92, 60, 255))
    p.line([(cx, lt - lw * 0.7), (cx, top_y)], fill=lit + (255,), width=2.5)
    return dome_top, belfry_top, shaft_top


def hoover_0(th):
    """1941: the 285-foot tower, floodlit at dusk. The hologram covers the centre window on device, so the crown
    rises above it and the height scale runs beside it."""
    hero = new()
    hoover_sky(hero, hz=640)
    glow(hero, rgrad((458, 640), 380, [(0, (255, 170, 110, 120)), (1, (255, 150, 90, 0))], sy=0.5), 6, 0.7)
    lay = new()
    top_y, base_y = 70, 700
    tower(lay, 458, base_y, top_y, 196, 170)
    lay = shade(lay, 0.95 + 0.08 * noise(91, 3, 1))
    beams = new()
    pb = Pen(beams)
    pb.poly([(380, 700), (420, 700), (330, 40), (240, 40)], fill=(255, 230, 190, 40))
    pb.poly([(500, 700), (540, 700), (690, 40), (600, 40)], fill=(255, 230, 190, 34))
    glow(hero, beams, 16, 0.8)
    over(hero, lay)
    flood = vgrad(260, 700, [(0, (255, 220, 170, 0)), (1, (255, 220, 170, 90))])
    add(hero, clip_to(flood, lay.getchannel("A")), 0.8)
    rim = new()
    Pen(rim).line([(458 - 98, 700), (458 - 88, 250)], fill=(255, 240, 210, 255), width=2)
    glow(hero, rim, 4, 0.7)
    over(hero, rim)
    # belfry glow
    # 285 ft scale, outside the hologram window
    sc = new()
    ps = Pen(sc)
    x = 866
    ps.line([(x, top_y), (x, 690)], fill=th["accent"] + (230,), width=2.5)
    for k in range(0, 11):
        y = 690 - (690 - top_y) * k / 10
        ps.line([(x - (12 if k % 5 == 0 else 7), y), (x, y)], fill=th["accent"] + (230,), width=2)
    ps.line([(x - 14, top_y), (x + 4, top_y)], fill=(255, 255, 255, 255), width=3)
    glow(hero, sc, 4, 0.6)
    over(hero, sc)
    f = font(("FRADM.TTF", None), 30)
    t = new()
    text(t, (x - 18, 166), "285 FT", f, (255, 240, 214, 255), anchor="rm", tracking=1.5)
    Pen(t).line([(x - 16, 190), (x - 4, 190)], fill=(255, 240, 214, 200), width=2)
    over(hero, t)
    return hero


def bell_profile(top, height, width):
    s_pts = [0, 0.012, 0.035, 0.07, 0.12, 0.25, 0.5, 0.72, 0.86, 0.95, 1.0]
    w_pts = [0.0, 0.13, 0.22, 0.28, 0.315, 0.34, 0.37, 0.45, 0.6, 0.72, 0.74]

    def hw(y):
        s = np.clip((y - top) / height, 0, 1)
        return np.interp(s, s_pts, w_pts) * width
    pts_r = [(width * w, top + height * s) for s, w in zip(s_pts, w_pts)]
    return hw, pts_r


def bronze_bell(hero, cx, top, height, width, ramp_stops=BRONZE, alpha=255, glow_k=0.0):
    hw, pts_r = bell_profile(top, height, width)
    outline = [(cx + x, y) for x, y in pts_r] + [(cx - x, y) for x, y in reversed(pts_r)]
    m = poly_mask(outline)
    lip_y = top + height
    Pen(m).ellipse((cx - width * 0.74, lip_y - height * 0.07, cx + width * 0.74, lip_y + height * 0.07), fill=255)
    body = metal_vertical(m, cx, hw, ramp_stops, bands=((top + height * 0.86, height * 0.012, 0.35), (top + height * 0.9, height * 0.01, -0.25),
                                                       (top + height * 0.18, height * 0.01, 0.25)))
    if alpha < 255:
        a = np.asarray(body, np.float32).copy()
        a[..., 3] *= alpha / 255
        body = Image.fromarray(a.astype(np.uint8), "RGBA")
    # mouth: dark interior and the clapper
    mouth = new()
    pm = Pen(mouth)
    pm.ellipse((cx - width * 0.66, lip_y - height * 0.045, cx + width * 0.66, lip_y + height * 0.05), fill=(20, 10, 6, alpha))
    pm.circle((cx, lip_y + height * 0.02), width * 0.09, fill=tuple(ramp_stops[2][1]) + (alpha,))
    over(hero, body)
    over(hero, mouth)
    yoke = new()
    Pen(yoke).arc((cx - width * 0.12, top - height * 0.1, cx + width * 0.12, top + height * 0.06), 180, 360, fill=tuple(ramp_stops[3][1]) + (alpha,),
                  width=max(2, width * 0.05))
    over(hero, yoke)
    return m


def hoover_1(th):
    """1939 -> 2000: the bells crossed an ocean. 35 bells at first, 48 now; the largest bell in front."""
    hero = new()
    over(hero, vgrad(28, HERO_BOTTOM, [(0, (10, 14, 36)), (0.6, (22, 30, 66)), (1, (12, 18, 40))]))
    # ocean swell under everything
    sea = new()
    ps = Pen(sea)
    for k in range(8):
        y = 560 + k * 17
        pts = [(x, y + 5 * math.sin(x / 34 + k * 1.3)) for x in range(20, 900, 8)]
        ps.line(pts, fill=(120, 180, 236, 46 + k * 10), width=1.5)
    over(hero, sea)
    # the carillon count: 48 bells; the original 35 in bronze, the 13 later bells in pale metal
    rows = new()
    for i in range(48):
        row, col = divmod(i, 6)
        x, y = 104 + col * 50, 196 + row * 43
        orig = i < 35
        hw, pts_r = bell_profile(y, 30, 21)
        outline = [(x + px, py) for px, py in pts_r] + [(x - px, py) for px, py in reversed(pts_r)]
        Pen(rows).poly(outline, fill=((232, 166, 86) if orig else (200, 218, 236)) + (255,))
        Pen(rows).line([(x - 5, y + 8), (x - 8, y + 24)], fill=(255, 250, 236, 210), width=2)
    glow(hero, rows, 4, 0.5)
    over(hero, rows)
    tags = new()
    lf = font(("FRADM.TTF", None), 23)
    pt = Pen(tags)
    pt.circle((96, 556), 8, fill=(232, 166, 86, 255))
    text(tags, (114, 556), "35 ORIGINAL", lf, (255, 214, 150, 255), anchor="lm", tracking=1.5)
    pt.circle((96, 592), 8, fill=(200, 218, 236, 255))
    text(tags, (114, 592), "13 LATER  ·  48 NOW", lf, (226, 236, 248, 255), anchor="lm", tracking=1.5)
    over(hero, tags)
    # the largest bell, in front: polished bronze with sound spreading to the right
    rings = new()
    pr = Pen(rings)
    for k, r in enumerate((200, 236, 272)):
        pr.arc((640 - r, 430 - r, 640 + r, 430 + r), -38, 38, fill=(255, 214, 150, 170 - k * 45), width=3)
    glow(hero, rings, 5, 0.7)
    over(hero, rings)
    glow(hero, rgrad((640, 440), 250, [(0, (255, 190, 110, 130)), (1, (255, 170, 90, 0))]), 4, 0.6)
    shadow = new()
    Pen(shadow).ellipse((480, 600, 800, 640), fill=(0, 0, 0, 170))
    over(hero, blur(shadow, 12))
    bronze_bell(hero, 640, 250, 330, 210)
    return hero


def hoover_2(th):
    """14th floor: the carillon shares the observation deck; look out through the arches where the sound travels."""
    hero = new()
    hz = 470
    over(hero, vgrad(28, hz, [(0, (20, 30, 72)), (0.55, (98, 86, 138)), (0.85, (232, 148, 112)), (1, (255, 196, 128))]))
    stars(Pen(hero), random.Random(8), (40, 40, 880, 220), 60)
    land = new()
    pl = Pen(land)
    for k, (yb, amp, c) in enumerate(((hz - 18, 22, (92, 76, 120)), (hz - 6, 14, (70, 60, 96)), (hz + 6, 8, (50, 44, 72)))):
        pts = [(x, yb - amp * (0.5 + 0.5 * math.sin(x / (90 + 30 * k) + k * 2))) for x in range(0, 1201, 10)]
        pl.poly(pts + [(1200, 720), (0, 720)], fill=c + (255,))
    over(hero, land)
    # campus below: rows of red roofs and trees in atmospheric perspective
    camp = new()
    pc = Pen(camp)
    rng = random.Random(12)
    for row in range(9):
        y = hz + 22 + row * 26 * (1 + row * 0.12)
        sc = 0.5 + row * 0.22
        x = rng.uniform(-40, 0)
        while x < 920:
            w = rng.uniform(40, 90) * sc
            hh = 10 * sc
            fade = 0.35 + row * 0.08
            roof = mix((90, 66, 96), (210, 104, 70), min(1, fade))
            wall = mix((90, 76, 104), (232, 196, 150), min(1, fade))
            if rng.random() < 0.7:
                pc.rect((x, y - hh, x + w, y + hh * 0.6), fill=wall + (255,))
                pc.poly([(x - 3, y - hh), (x + w + 3, y - hh), (x + w - 6, y - hh - 6 * sc), (x + 6, y - hh - 6 * sc)], fill=roof + (255,))
                if row > 3:
                    for wx in np.arange(x + 6, x + w - 6, 12 * sc):
                        pc.rect((wx, y - hh * 0.4, wx + 4 * sc, y + hh * 0.2), fill=(255, 214, 150, 180))
            else:
                tr = mix((70, 70, 96), (50, 90, 70), min(1, fade))
                pc.ellipse((x, y - 14 * sc, x + 22 * sc, y + 6 * sc), fill=tr + (255,))
            x += w + rng.uniform(8, 30) * sc
    over(hero, camp)
    # sound rings spreading out from the tower over the campus
    rings = new()
    pr = Pen(rings)
    for k in range(6):
        rx = 120 + k * 120
        pr.ellipse((458 - rx, 690 - rx * 0.32, 458 + rx, 690 + rx * 0.32), outline=(255, 226, 170, 210 - k * 30), width=2.5)
    glow(hero, rings, 5, 0.9)
    over(hero, rings)
    # the deck's arched openings frame the view (warm lit stone, bell in the centre bay)
    frame = mask()
    pf = Pen(frame)
    pf.rect((0, 0, 1200, 720), fill=255)
    bays = [(92, 316), (346, 570), (600, 824)]
    for (x0, x1) in bays:
        r = (x1 - x0) / 2
        pf.rect((x0, 150 + r, x1, 720), fill=0)
        pf.ellipse((x0, 150, x1, 150 + 2 * r), fill=0)
    stone = sandstone(frame, (150, 112, 86), 101, 30, 0.12)
    over(hero, stone)
    over(hero, vgrad(28, 700, [(0, (20, 14, 30, 150)), (0.5, (0, 0, 0, 0)), (1, (20, 14, 30, 120))], frame))
    lit = new()
    plit = Pen(lit)
    for (x0, x1) in bays:
        r = (x1 - x0) / 2
        plit.arc((x0, 150, x1, 150 + 2 * r), 180, 360, fill=(255, 220, 170, 255), width=3)
        plit.line([(x0, 150 + r), (x0, 700)], fill=(255, 220, 170, 220), width=3)
        plit.line([(x1, 150 + r), (x1, 700)], fill=(255, 200, 150, 120), width=2)
    glow(hero, lit, 5, 0.8)
    over(hero, lit)
    # a carillon bell hanging in the centre bay, in silhouette against the sky
    cx = 458
    Pen(hero).line([(cx, 150), (cx, 198)], fill=(40, 26, 20, 255), width=5)
    bronze_bell(hero, cx, 200, 120, 84, ramp_stops=[(0, (30, 16, 10)), (0.5, (90, 52, 26)), (0.85, (200, 140, 76)), (1, (255, 220, 160))])
    # parapet
    par = new()
    Pen(par).rect((0, 640, 1200, 720), fill=(118, 86, 66, 255))
    par = shade(par, 0.95 + 0.08 * noise(102, 20, 2))
    over(hero, par)
    Pen(hero).line([(0, 640), (1200, 640)], fill=(255, 220, 170, 255), width=2.5)
    return hero


def hoover_3(th):
    """1940s: the wartime radio room on the ground floor, listening to foreign broadcasts."""
    hero = new()
    over(hero, vgrad(28, HERO_BOTTOM, [(0, (14, 16, 26)), (1, (30, 24, 22))]))
    # stone wall blocks of the tower's base
    wall = new()
    pw = Pen(wall)
    for r in range(12):
        y = 40 + r * 52
        off = 60 if r % 2 else 0
        for x in range(-120 + off, 1000, 120):
            pw.rect((x + 3, y + 3, x + 117, y + 49), fill=(44, 38, 40, 255))
    over(hero, shade(wall, 0.9 + 0.2 * noise(111, 30, 2)))
    # lamp light from above
    add(hero, rgrad((458, 120), 520, [(0, (255, 196, 120, 120)), (1, (255, 180, 100, 0))], sy=1.1), 0.9)
    # radio waves arriving at an aerial
    waves = new()
    pv = Pen(waves)
    ax_, ay_ = 186, 200
    for k in range(5):
        r = 44 + k * 34
        pv.arc((ax_ - r, ay_ - r, ax_ + r, ay_ + r), 165, 215, fill=(150, 226, 255, 220 - k * 36), width=3)
        pv.arc((ax_ - r, ay_ - r, ax_ + r, ay_ + r), 325, 375, fill=(150, 226, 255, 220 - k * 36), width=3)
    glow(hero, waves, 5, 0.9)
    over(hero, waves)
    Pen(hero).line([(ax_, ay_), (214, 300)], fill=(190, 196, 210, 255), width=3)
    Pen(hero).circle((ax_, ay_), 4, fill=(230, 236, 246, 255))
    # desk
    desk = poly_mask([(40, 590), (876, 590), (876, 720), (40, 720)])
    over(hero, vgrad(590, 720, [(0, (120, 76, 44)), (1, (54, 34, 22))], desk))
    Pen(hero).line([(40, 590), (876, 590)], fill=(255, 210, 150, 220), width=2)
    # receiver cabinet
    box = (170, 300, 760, 584)
    cab = mask()
    Pen(cab).rrect(box, 18, fill=255)
    sh = new()
    Pen(sh).rrect((box[0] + 10, box[3] - 10, box[2] + 26, box[3] + 16), 10, fill=(0, 0, 0, 180))
    over(hero, blur(sh, 10))
    face = vgrad(box[1], box[3], [(0, (78, 82, 88)), (1, (40, 42, 46))], cab)
    brushed = 0.92 + 0.12 * noise(121, 1.5, 1) * (0.6 + 0.4 * noise(122, 40, 1))
    over(hero, shade(face, brushed))
    Pen(hero).rrect(box, 18, outline=(200, 206, 214, 220), width=2)
    # tubes glowing behind the top edge
    tubes = new()
    pt = Pen(tubes)
    for tx in (300, 360, 420):
        pt.rrect((tx - 16, 214, tx + 16, 300), 14, fill=(180, 200, 220, 70), outline=(220, 230, 240, 150), width=1.5)
        pt.rect((tx - 5, 240, tx + 5, 292), fill=(255, 150, 60, 230))
    glow(hero, tubes, 10, 1.1)
    over(hero, tubes)
    # tuning dial: a glowing amber window with a scale and needle
    dial = (210, 340, 520, 470)
    dm = mask()
    Pen(dm).rrect(dial, 14, fill=255)
    over(hero, rgrad(((dial[0] + dial[2]) / 2, dial[3]), 260, [(0, (255, 214, 140)), (0.7, (230, 150, 60)), (1, (150, 80, 30))], dm, sy=0.7))
    sc = new()
    psc = Pen(sc)
    for i in range(31):
        x = dial[0] + 20 + i * (dial[2] - dial[0] - 40) / 30
        psc.line([(x, dial[1] + 26), (x, dial[1] + (52 if i % 5 == 0 else 40))], fill=(70, 34, 10, 230), width=2)
    psc.arc((dial[0] + 10, dial[1] + 60, dial[2] - 10, dial[3] + 120), 200, 340, fill=(70, 34, 10, 200), width=2)
    psc.line([(392, dial[3] - 6), (420, dial[1] + 14)], fill=(200, 30, 20, 255), width=3.5)
    over(hero, sc)
    glow(hero, fill(dm, (255, 180, 90, 255)), 18, 0.55)
    Pen(hero).rrect(dial, 14, outline=(240, 230, 210, 255), width=2.5)
    # speaker grille
    gm = mask()
    Pen(gm).rrect((560, 340, 720, 470), 12, fill=255)
    over(hero, fill(gm, (24, 22, 22, 255)))
    gl = new()
    for yy in range(352, 462, 10):
        Pen(gl).line([(572, yy), (708, yy)], fill=(150, 140, 126, 200), width=3)
    over(hero, gl)
    Pen(hero).rrect((560, 340, 720, 470), 12, outline=(200, 206, 214, 220), width=2)
    # notepad: news relayed by hand
    pad = poly_mask([(60, 612), (190, 604), (200, 690), (68, 698)])
    over(hero, fill(pad, (226, 218, 196, 235)))
    for k in range(5):
        Pen(hero).line([(76, 626 + k * 13), (182, 619 + k * 13)], fill=(90, 96, 120, 200), width=1.5)
    # knobs
    for kx in (260, 360, 460, 600, 680):
        km = mask()
        Pen(km).circle((kx, 524), 26, fill=255)
        over(hero, metal_vertical(km, kx, lambda y: np.full_like(y, 26.0), BRASS if kx < 500 else STEEL))
        Pen(hero).circle((kx, 524), 26, outline=(255, 240, 210, 200), width=1.5)
        Pen(hero).line([(kx, 524), (kx + 12, 506)], fill=(40, 30, 20, 255), width=3)
    # headphones resting on the desk
    hp = new()
    ph = Pen(hp)
    ph.arc((762, 478, 858, 600), 180, 360, fill=(30, 30, 34, 255), width=10)
    ph.arc((762, 478, 858, 600), 200, 340, fill=(200, 200, 210, 160), width=2)
    for ex in (766, 854):
        ph.ellipse((ex - 20, 520, ex + 20, 586), fill=(40, 40, 46, 255), outline=(170, 170, 180, 200), width=1.5)
    over(hero, hp)
    return hero


SCENES = {"mainquad": (mainquad_0, mainquad_1, mainquad_2, mainquad_3), "huang": (huang_0, huang_1, huang_2, huang_3),
          "hoover": (hoover_0, hoover_1, hoover_2, hoover_3)}


# ---------------------------------------------------------------------------------------------------------------
# Assembly

def _video_bezel(card, th):
    """Card 0 of Huang / Hoover: a hologram screen sits over VIDEO_BOX on device, so frame it as a window."""
    x0, y0, x1, y1 = VIDEO_BOX
    acc = th["accent"]
    p = Pen(card)
    p.rect((x0 - 3, y0 - 3, x1 + 3, y1 + 3), outline=(0, 0, 0, 150), width=3)
    lay = new()
    lp = Pen(lay)
    lp.rect((x0 - 1, y0 - 1, x1 + 1, y1 + 1), outline=acc + (120,), width=1.5)
    for (x, y, sx, sy) in ((x0 - 8, y0 - 8, 1, 1), (x1 + 8, y0 - 8, -1, 1), (x0 - 8, y1 + 8, 1, -1), (x1 + 8, y1 + 8, -1, -1)):
        lp.line([(x + 44 * sx, y), (x, y), (x, y + 44 * sy)], fill=acc + (255,), width=4)
    glow(card, lay, 5, 0.6)
    over(card, lay)


def render_card(card_id, index, slide, count):
    th = THEMES[card_id]
    card = new()
    m = draw_panel(card, th)
    hero = SCENES[card_id][index](th)
    seat_hero(card, th, hero, th["frame"])
    if index == 0 and card_id in ("huang", "hoover"):
        _video_bezel(card, th)
    draw_frame(card, th, m)
    draw_header(card, th, index, count)
    draw_text(card, th, slide, index)
    draw_buttons(card, th, index, count)
    draw_ask_tab(card, th)
    return card.resize((W, H), Image.Resampling.LANCZOS)


if __name__ == "__main__":
    import json
    import sys
    data = json.loads((Path(__file__).parent / "story-cards.json").read_text(encoding="utf-8"))
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else None
    only = [a for a in sys.argv[1:] if a.split(":")[0] in FEATURED]
    for cid in FEATURED:
        for i, slide in enumerate(data[cid]):
            if only and f"{cid}:{i}" not in only:
                continue
            im = render_card(cid, i, slide, len(data[cid]))
            if out_dir:
                out_dir.mkdir(parents=True, exist_ok=True)
                im.save(out_dir / f"{cid}_story_card_{i}.png", optimize=True)
                print("preview", cid, i)

"""Midnight-copper story card template (the deck look) with a big hero picture.

render_story_decks.draw_slide() calls render_deck_card() for the ids in its DECK_HERO_IDS. The look follows the original
deck (docs/card-style-options/story-decks.png): a translucent midnight panel with a copper chamfered frame and corner
brackets, Georgia serif, white text, copper kicker, an orange chamfered Next Card button and separate Next Stop and
Ask Me More tabs to the right of the panel. Drawn at 2x and downsampled.

Pictures come from a pluggable registry (see heroes/__init__.py): heroes.<card_id>.SCENES, else
story_cards_featured.SCENES[card_id], else the caller's line drawing (the `visual` callback).

Fixed geometry, 1x card pixels on the 1200 x 1280 texture. Button art stays inside the hit regions from
Core/CardLayout.ts (storyCardHits / storyAskButton); the app draws a hover rim ~16 px outside them:
  close        786,60 - 854,132
  Next Card    88,1100 - 545,1210   ("Replay Cards" on the last card)
  Next Stop    920,1000 - 1182,1142
  Ask Me More  920,789 - 1182,967

Spectacles is additive: dark pixels read as see-through, so the panel stays translucent and text stays near-white.

  python tools/story_cards_deck.py --preview <dir>   renders Main Quad, Huang and Hoover into <dir> + contact_sheet.png
"""

import importlib
import math
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import story_cards_featured as F  # noqa: E402  (shared 2x canvas helpers and the current painted scenes)
from story_cards_featured import SS, W, H, Pen, font, mask, new, over, text, text_width, wrap  # noqa: E402

# ---------------------------------------------------------------------------------------------------------------
# Palette and geometry

PANEL = (16, 26, 37, 158)          # translucent midnight (same as the deck)
TAB = (20, 31, 44, 214)            # Next Stop / Ask tabs: a touch denser so their labels hold
COPPER = (245, 169, 103)
ORANGE = (231, 125, 69)
WHITE = (255, 255, 255)
SOFT = (238, 240, 244)

PANEL_BOX = (28, 28, 888, 1252)
PANEL_CUT = 34
HERO_BOX = (28, 28, 888, 694)      # where hero scenes draw (contract)
PICTURE = (60, 150, 856, 750)      # picture window on the card
PICTURE_CUT = 20
TEXT_X, TEXT_W = 88, 740           # text column: 28 px in from the picture window on both sides
TEXT_TOP, TEXT_BOTTOM = 774, 1086

CLOSE_HIT = (786, 60, 854, 132)
NEXT_HIT = (88, 1100, 545, 1210)
STOP_HIT = (920, 1000, 1182, 1142)
ASK_HIT = (920, 789, 1182, 967)

SERIF, SERIF_B, SERIF_I = ("georgia.ttf", None), ("georgiab.ttf", None), ("georgiai.ttf", None)


def _lining(name):
    """Georgia ships old-style figures by default; build (once, in the temp dir) a copy whose digits map to its
    lining-figure glyphs, so kickers like 1891 and STORY 1 OF 4 sit on the cap line. Falls back to the stock font."""
    import tempfile
    out = Path(tempfile.gettempdir()) / "retrospecs_fonts" / name.replace(".ttf", "_lnum.ttf")
    if not out.exists():
        try:
            from fontTools.ttLib import TTFont
            f = TTFont(str(F.FONTS / name))
            sub = {}
            for rec in f["GSUB"].table.FeatureList.FeatureRecord:
                if rec.FeatureTag == "lnum":
                    for li in rec.Feature.LookupListIndex:
                        for st in f["GSUB"].table.LookupList.Lookup[li].SubTable:
                            sub.update(getattr(st, "mapping", {}) or {})
            for t in f["cmap"].tables:
                if t.format not in (4, 12):
                    continue            # format 0 stores byte glyph ids; the lining glyphs do not fit
                for d in "0123456789":
                    g = t.cmap.get(ord(d))
                    if g in sub:
                        t.cmap[ord(d)] = sub[g]
            out.parent.mkdir(parents=True, exist_ok=True)
            f.save(str(out))
        except Exception:
            return name
    return str(out)


LINING_B = (_lining("georgiab.ttf"), None)

DEFAULT_THEME = dict(name="", top=(16, 26, 37), bottom=(10, 16, 24), accent=COPPER, rim=(255, 206, 150),
                     button=(ORANGE, (180, 90, 48)), head=("georgiab.ttf", None, 56), kick=("georgiab.ttf", None, 26),
                     frame="chamfer")

DEBUG = False
DECK_NAMES = {"mainquad": "Main Quad", "huang": "Huang Engineering Center", "hoover": "Hoover Tower"}


# ---------------------------------------------------------------------------------------------------------------
# Hero registry

def hero_source(card_id, index):
    """(label, scene callable) for this card, or (None, None)."""
    name = f"heroes.{card_id}"
    try:
        mod = importlib.import_module(name)
    except ModuleNotFoundError as e:
        if e.name not in (name, "heroes"):
            raise                       # a hero module that exists but is broken should fail loudly
        mod = None
    scenes = getattr(mod, "SCENES", None) if mod else None
    if scenes is not None and index < len(scenes):
        return name, scenes[index]
    scenes = F.SCENES.get(card_id)
    if scenes is not None and index < len(scenes):
        return "story_cards_featured", scenes[index]
    return None, None


def theme_for(card_id):
    return F.THEMES.get(card_id, DEFAULT_THEME)


def hero_for(card_id, index):
    """The hero canvas (W*SS x H*SS RGBA) for this card, or None when no picture is registered."""
    _, scene = hero_source(card_id, index)
    return scene(theme_for(card_id)) if scene else None


# ---------------------------------------------------------------------------------------------------------------
# Drawing helpers (1x coordinates, 2x canvas)

def chamfer(box, c):
    x0, y0, x1, y1 = box
    return [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]


def ink(card, color, draw):
    """Draw shapes/text into a mask with `draw(pen, im)` and composite them in `color` (no dark AA fringes)."""
    m = mask()
    draw(Pen(m), m)
    over(card, F.fill(m, color))


def shape(card, pts, fill=None, outline=None, width=0):
    if fill:
        ink(card, fill, lambda p, m: p.poly(pts, fill=255))
    if outline:
        ink(card, outline, lambda p, m: p.line(pts + [pts[0], pts[1]], fill=255, width=width))


def label(card, xy, s, f, color, tracking=0.0, anchor="la"):
    """Text with Georgia; draws the arrow glyph Georgia lacks (U+2192) as a line arrow."""
    out = {}

    def draw(p, m):
        x, y = xy
        parts = s.split("→")
        total = sum(text_width(t, f, tracking) for t in parts) + (len(parts) - 1) * f.size / SS * 1.15
        if anchor[0] == "m":
            x -= total / 2
        elif anchor[0] == "r":
            x -= total
        for k, t in enumerate(parts):
            if t:
                x += text(m, (x, y), t, f, 255, tracking=tracking, anchor="l" + anchor[1])
            if k < len(parts) - 1:
                fs = f.size / SS
                cy = y if anchor[1] == "m" else y + fs * 0.62
                a0, a1 = x + fs * 0.22, x + fs * 0.93
                p.line([(a0, cy), (a1, cy)], fill=255, width=fs * 0.09)
                p.line([(a1 - fs * 0.24, cy - fs * 0.22), (a1, cy), (a1 - fs * 0.24, cy + fs * 0.22)], fill=255, width=fs * 0.09)
                x += fs * 1.15
        out["w"] = total
    ink(card, color, draw)
    return out["w"]


def chevron(p, cx, cy, s, width):
    p.line([(cx - s * 0.45, cy - s), (cx + s * 0.45, cy), (cx - s * 0.45, cy + s)], fill=255, width=width)


def fit(spec, size, s, width, floor=12, tracking=0.0):
    while size > floor and text_width(s, font(spec, size), tracking) > width:
        size -= 1
    return font(spec, size)


def mic(p, cx, cy, s):
    w = s * 0.34
    p.rrect((cx - w / 2, cy - s * 0.5, cx + w / 2, cy + s * 0.06), w / 2, fill=255)
    lw = max(2.2, s * 0.085)
    p.arc((cx - s * 0.32, cy - s * 0.36, cx + s * 0.32, cy + s * 0.22), 0, 180, fill=255, width=lw)
    p.line([(cx, cy + s * 0.22), (cx, cy + s * 0.42)], fill=255, width=lw)
    p.line([(cx - s * 0.2, cy + s * 0.43), (cx + s * 0.2, cy + s * 0.43)], fill=255, width=lw)


def inset(box, dx, dy=None):
    dy = dx if dy is None else dy
    return (box[0] + dx, box[1] + dy, box[2] - dx, box[3] - dy)


# ---------------------------------------------------------------------------------------------------------------
# Card parts

def draw_panel(card):
    shape(card, chamfer(PANEL_BOX, PANEL_CUT), fill=PANEL + ())
    pts = chamfer(inset(PANEL_BOX, 3), PANEL_CUT - 1)
    shape(card, pts, outline=COPPER + (255,), width=6)
    # corner brackets, as on the deck
    ink(card, COPPER + (255,), lambda p, m: (p.line([(52, 120), (52, 52), (120, 52)], fill=255, width=5),
                                             p.line([(796, 1228), (864, 1228), (864, 1160)], fill=255, width=5)))


def draw_header(card, name):
    f = fit(SERIF_B, 32, name, 660, floor=22)
    label(card, (TEXT_X, 96), name, f, WHITE + (255,), anchor="lm")
    b = inset(CLOSE_HIT, 4)
    shape(card, chamfer(b, 12), fill=TAB)
    shape(card, chamfer(inset(b, 1.5), 11.5), outline=COPPER + (255,), width=3)
    cx, cy, r = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 12
    ink(card, WHITE + (255,), lambda p, m: (p.line([(cx - r, cy - r), (cx + r, cy + r)], fill=255, width=4.5),
                                            p.line([(cx - r, cy + r), (cx + r, cy - r)], fill=255, width=4.5)))


def seat_picture(card, hero):
    """Cover-fit the hero box into the picture window, clip to its chamfer, soften the rim, frame it in copper."""
    assert hero.size == (W * SS, H * SS), f"hero canvas must be {(W * SS, H * SS)}, got {hero.size}"
    x0, y0, x1, y1 = PICTURE
    pw, ph = (x1 - x0) * SS, (y1 - y0) * SS
    hx0, hy0, hx1, hy1 = (v * SS for v in HERO_BOX)
    hw, hh = hx1 - hx0, hy1 - hy0
    k = max(pw / hw, ph / hh)
    cw, ch = pw / k, ph / k                       # source rect that fills the window
    cx0, cy0 = hx0 + (hw - cw) / 2, hy0 + (hh - ch) / 2
    pic = hero.resize((pw, ph), Image.Resampling.LANCZOS, box=(cx0, cy0, cx0 + cw, cy0 + ch))
    a = np.asarray(pic, np.float32).copy()
    # soft vignette toward the window edge (dark = see-through on Spectacles, so this melts the rim into the panel)
    yy, xx = np.mgrid[0:ph, 0:pw].astype(np.float32) / SS
    d = np.minimum(np.minimum(xx, (pw / SS) - xx), np.minimum(yy, (ph / SS) - yy))
    v = 0.72 + 0.28 * np.clip(d / 34.0, 0, 1) ** 0.8
    a[..., :3] *= v[..., None]
    lay = new()
    lay.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"), (x0 * SS, y0 * SS))
    over(card, F.clip_to(lay, F.poly_mask(chamfer(PICTURE, PICTURE_CUT))))
    frame_picture(card)


def frame_picture(card):
    pts = chamfer(PICTURE, PICTURE_CUT)
    shape(card, pts, outline=COPPER + (235,), width=3)
    # a faint inner hairline
    shape(card, chamfer(inset(PICTURE, 7), PICTURE_CUT - 3), outline=COPPER + (70,), width=1.2)


def kicker_text(year):
    return year


def body_lines(s, f):
    """Wrap to the column, then narrow it (same line count) so the last line never holds a lone word."""
    lines = wrap(s, f, TEXT_W)
    for w in range(TEXT_W, TEXT_W - 220, -10):
        trial = wrap(s, f, w)
        if len(trial) != len(lines):
            break
        if len(trial) < 2 or len(trial[-1].split()) >= 2:
            return trial
    return lines


def draw_text(card, slide):
    acc = COPPER + (255,)
    y = TEXT_TOP
    kf = font(LINING_B, 27)
    kw = label(card, (TEXT_X + 1, y + 14), kicker_text(slide["year"]), kf, acc, tracking=2.6, anchor="lm")
    ink(card, acc, lambda p, m: p.line([(TEXT_X + kw + 20, y + 15), (TEXT_X + kw + 76, y + 15)], fill=255, width=2.5))
    y += 44
    for hsize, bsize in ((56, 29), (54, 28), (52, 28), (50, 27), (48, 27), (46, 26), (44, 26), (42, 25)):
        hf, bf = font(LINING_B, hsize), font(SERIF, bsize)
        hl = F.balanced(slide["headline"], hf, TEXT_W)
        bl = body_lines(slide["body"], bf)
        hlh, blh = round(hsize * 1.14), round(bsize * 1.45)
        end = y + len(hl) * hlh + 14 + len(bl) * blh
        if (len(hl) <= 2 or (len(hl) == 3 and hsize <= 46)) and end <= TEXT_BOTTOM:
            break
    else:
        raise ValueError(f"Story text overflows the card: {slide['headline']!r}")
    if DEBUG:
        print(f"  text: headline {hsize}px x{len(hl)}, body {bsize}px x{len(bl)}, ends y={end}")
    for line in hl:
        label(card, (TEXT_X - 1, y), line, hf, WHITE + (255,))
        y += hlh
    y += 14
    for line in bl:
        label(card, (TEXT_X, y), line, bf, SOFT + (255,))
        y += blh


def draw_next(card, index, count):
    b = (NEXT_HIT[0] + 2, NEXT_HIT[1] + 8, NEXT_HIT[2] - 4, NEXT_HIT[3] - 8)
    pts = chamfer(b, 20)
    m = F.poly_mask(pts)
    over(card, F.vgrad(b[1], b[3], [(0, (240, 140, 84, 255)), (1, (214, 108, 56, 255))], m))
    shape(card, chamfer(inset(b, 1.5), 19.5), outline=(255, 196, 150, 255), width=2.5)
    last = index + 1 >= count
    s = ("Replay Card" if count == 1 else "Replay Cards") if last else "Next Card"
    cy = (b[1] + b[3]) / 2
    label(card, (b[0] + 40, cy), s, font(SERIF_B, 36), WHITE + (255,), anchor="lm")
    ax = b[2] - 50

    def glyph(p, _m):
        if last:
            r = 15
            a0, a1 = 330, 330 + 280                         # PIL arcs run clockwise on screen
            p.arc((ax - r, cy - r, ax + r, cy + r), a0, a1, fill=255, width=4.5)
            t = math.radians(a1)
            ex, ey = ax + r * math.cos(t), cy + r * math.sin(t)
            tx, ty = -math.sin(t), math.cos(t)              # direction of travel at the arc's end
            nx, ny = -ty, tx
            p.poly([(ex + tx * 11, ey + ty * 11), (ex + nx * 8 - tx * 3, ey + ny * 8 - ty * 3),
                    (ex - nx * 8 - tx * 3, ey - ny * 8 - ty * 3)], fill=255)
        else:
            chevron(p, ax - 14, cy, 13, 5)
            chevron(p, ax + 4, cy, 13, 5)
    ink(card, WHITE + (255,), glyph)
    # progress: STORY n OF N above copper pips
    px = 588
    label(card, (px, 1134), f"STORY {index + 1} OF {count}", font(LINING_B, 17), COPPER + (255,), tracking=2.4, anchor="lm")

    def pips(p, _m):
        x = px
        for i in range(count):
            w = 46 if i == index else 24
            p.rrect((x, 1166, x + w, 1175), 4.5, fill=255 if i == index else (150 if i < index else 90))
            x += w + 10
    ink(card, COPPER + (255,), pips)


def tab(card, hit):
    b = (hit[0] + 4, hit[1] + 6, hit[2] - 4, hit[3] - 6)
    shape(card, chamfer(b, 18), fill=TAB)
    shape(card, chamfer(inset(b, 2), 17), outline=COPPER + (255,), width=4)
    return b


TAB_KICK, TAB_TITLE = 15, 31          # both tabs share one type scale


def draw_stop(card):
    b = tab(card, STOP_HIT)
    x = b[0] + 26
    label(card, (x, b[1] + 38), "CONTINUE TOUR", font(SERIF_B, TAB_KICK), COPPER + (255,), tracking=2.0, anchor="lm")
    label(card, (x, b[1] + 86), "Next Stop", font(SERIF_B, TAB_TITLE), WHITE + (255,), anchor="lm")
    ink(card, WHITE + (255,), lambda p, m: chevron(p, b[2] - 34, b[1] + 86, 12, 4.5))


def draw_ask(card):
    b = tab(card, ASK_HIT)
    x = b[0] + 26
    label(card, (x, b[1] + 38), "HAVE A QUESTION?", font(SERIF_B, TAB_KICK), COPPER + (255,), tracking=2.0, anchor="lm")
    label(card, (x, b[1] + 86), "Ask Me More", font(SERIF_B, TAB_TITLE), WHITE + (255,), anchor="lm")
    mx, my, mr = b[2] - 34, b[1] + 127, 18           # mic badge closes the hint row
    label(card, (x, my), "Tap, then just speak", fit(SERIF_I, 18, "Tap, then just speak", mx - mr - 10 - x),
          WHITE + (200,), anchor="lm")
    ink(card, COPPER + (255,), lambda p, m: p.circle((mx, my), mr, fill=255))
    ink(card, (24, 32, 44, 255), lambda p, m: mic(p, mx, my + 1, 23))


def draw_fallback(card, card_id, index, visual):
    """The caller's 1x line drawing (render_story_decks.draw_visual), lifted onto the 2x canvas."""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    visual(ImageDraw.Draw(lay), card_id, index)
    over(card, lay.resize((W * SS, H * SS), Image.Resampling.BICUBIC))


# ---------------------------------------------------------------------------------------------------------------

def render_deck_card(card_id, index, slide, count, name, hero=None, visual=None):
    """One 1200 x 1280 RGBA story card. `hero` may be a pre-rendered hero canvas (else the registry is used);
    `visual(draw, card_id, index)` draws the 1x line-art fallback when no hero exists."""
    card = new()
    draw_panel(card)
    draw_header(card, name)
    if hero is None:
        hero = hero_for(card_id, index)
    if hero is not None:
        seat_picture(card, hero)
    elif visual is not None:
        draw_fallback(card, card_id, index, visual)
    draw_text(card, slide)
    draw_next(card, index, count)
    draw_ask(card)
    draw_stop(card)
    return card.resize((W, H), Image.Resampling.LANCZOS)


def check_buttons(im):
    """Assert every button's drawn pixels sit inside its hit region (outside-panel tabs are checked by alpha)."""
    a = np.asarray(im)[..., 3]
    for name, hit in (("stop", STOP_HIT), ("ask", ASK_HIT)):
        x0, y0, x1, y1 = hit
        region = a[y0 - 30:y1 + 30, PANEL_BOX[2] + 8:]
        ys, xs = np.nonzero(region > 8)
        ys, xs = ys + y0 - 30, xs + PANEL_BOX[2] + 8
        sel = (ys >= y0 - 30) & (ys <= y1 + 30)
        bx = (xs[sel].min(), ys[sel].min(), xs[sel].max(), ys[sel].max())
        assert x0 <= bx[0] and y0 <= bx[1] and bx[2] <= x1 and bx[3] <= y1, (name, bx, hit)


def contact_sheet(paths, out, cols=4, scale=0.3):
    tiles = []
    for p in paths:
        im = Image.open(p).convert("RGBA")
        t = im.resize((int(W * scale), int(H * scale)), Image.Resampling.LANCZOS)
        row = Image.new("RGB", (t.width * 2 + 12, t.height), (0, 0, 0))
        dark = Image.new("RGBA", t.size, (0, 0, 0, 255))
        dark.alpha_composite(t)
        gray = Image.new("RGBA", t.size, (112, 116, 122, 255))
        gray.alpha_composite(t)
        row.paste(dark.convert("RGB"), (0, 0))
        row.paste(gray.convert("RGB"), (t.width + 12, 0))
        tiles.append(row)
    tw, th = tiles[0].size
    sheet = Image.new("RGB", (cols * (tw + 24) + 24, ((len(tiles) + cols - 1) // cols) * (th + 24) + 24), (40, 42, 46))
    for k, t in enumerate(tiles):
        sheet.paste(t, (24 + (k % cols) * (tw + 24), 24 + (k // cols) * (th + 24)))
    sheet.save(out, optimize=True)
    return out


def preview(out_dir, ids=("mainquad", "huang", "hoover")):
    data = json.loads((Path(__file__).parent / "story-cards.json").read_text(encoding="utf-8"))
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for cid in ids:
        for i, slide in enumerate(data[cid]):
            src, _ = hero_source(cid, i)
            im = render_deck_card(cid, i, slide, len(data[cid]), DECK_NAMES.get(cid, theme_for(cid)["name"] or cid))
            check_buttons(im)
            p = out_dir / f"{cid}_story_card_{i}.png"
            im.save(p, optimize=True)
            paths.append(p)
            print(f"{cid} {i}: hero from {src or 'none (line drawing)'} -> {p}")
    sheet = contact_sheet(paths, out_dir / "contact_sheet.png")
    print("contact sheet:", sheet)


if __name__ == "__main__":
    if "--preview" in sys.argv:
        preview(sys.argv[sys.argv.index("--preview") + 1])
    else:
        print(__doc__)

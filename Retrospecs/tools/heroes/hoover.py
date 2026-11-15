"""Hoover Tower story-card pictures, drawn as archival engravings rather than glowing renders.

Each scene(th) returns a supersampled RGBA canvas (story_cards_featured.new()) with the picture inside the hero
box x 28-888, y 28-694 and transparent elsewhere. Tone comes from engraved line width over a darker wash, so the
pictures are built from light on Spectacles' additive display and keep a restrained buff / terracotta / bronze /
navy palette. Every picture shows only what its card says (tools/story-cards.json, "hoover"):

  0  1941: Arthur Brown Jr.'s 285 ft tower, stucco pigmented to the grey-buff of the Quad's sandstone.
  1  1939 -> 2000: the carillon, 48 graduated bronze bells fixed in a steel frame, the largest in front.
  2  14th floor: out through the observation deck's arches over red-tile roofs toward the foothills.
  3  1940s: the ground-floor wartime radio room: receiver, headphones, notepad.

Card 0 carries an opaque hologram over 120,251 - 820,644 on device, so its crown (belfry, octagon, dome) sits above y 251.
Sources: architectplanning.stanford.edu/hoover-tower (stucco "pigmented to the color of grey-stone sandstone",
"stepped-back octagonal portion that caps the tower"), hoover.org carillon history (35 bells, now 48, bourdon),
stanfordmag.org (radio room on the first floor monitored foreign military broadcasts).
"""

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
from PIL import Image, ImageDraw

import story_cards_featured as F
from story_cards_featured import W, H, SS, new, mask, Pen, over, blur, noise, poly_mask, mix

XX, YY = F._XX, F._YY
BOX = (28, 28, 888, 694)

# palette
STUCCO = (226, 212, 184)      # grey-buff "sandstone" stucco in sun
STUCCO_SH = (170, 170, 178)   # the same stucco in shade, cooled by sky light
TILE = (196, 98, 66)          # terracotta roof tile
BRONZE_C = (196, 140, 84)
PATINA = (128, 150, 128)
INK_SKY = (150, 170, 204)
WARM_SKY = (238, 206, 166)
NAVY = (16, 26, 37)


# ---------------------------------------------------------------------------------------------------------------
# Engraving plate: draw flat shapes with a colour, a tone (0 dark .. 1 lit) and a hatch kind, then render once.

H_VERT, H_HORZ, H_DIAG, H_RDIAG, H_FLAT, H_SKY = 1, 2, 3, 4, 5, 6


class Plate:
    def __init__(self):
        size = (W * SS, H * SS)
        self.col = Image.new("RGB", size, (0, 0, 0))
        self.tone = Image.new("L", size, 0)
        self.kind = Image.new("L", size, 0)
        self.a = Image.new("L", size, 0)
        self._d = [ImageDraw.Draw(im) for im in (self.col, self.tone, self.kind, self.a)]

    def _vals(self, color, tone, kind, alpha):
        return (tuple(int(c) for c in color[:3]), int(np.clip(tone, 0, 1) * 255), kind, int(alpha))

    def poly(self, pts, color, tone, kind=H_VERT, alpha=255):
        pts = [(x * SS, y * SS) for x, y in pts]
        for d, v in zip(self._d, self._vals(color, tone, kind, alpha)):
            d.polygon(pts, fill=v)

    def rect(self, box, color, tone, kind=H_VERT, alpha=255):
        x0, y0, x1, y1 = box
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], color, tone, kind, alpha)

    def ellipse(self, box, color, tone, kind=H_VERT, alpha=255):
        b = [v * SS for v in box]
        for d, v in zip(self._d, self._vals(color, tone, kind, alpha)):
            d.ellipse(b, fill=v)

    def line(self, pts, color, tone, width=1.0, kind=H_FLAT, alpha=255):
        pts = [(x * SS, y * SS) for x, y in pts]
        for d, v in zip(self._d, self._vals(color, tone, kind, alpha)):
            d.line(pts, fill=v, width=max(1, round(width * SS)), joint="curve")

    def paint(self, region_mask, tone_arr=None, color=None, kind=None):
        """Overwrite tone (and optionally colour / kind) inside an L mask with per-pixel arrays (shaded forms)."""
        m = np.asarray(region_mask, np.float32) / 255.0
        if tone_arr is not None:
            t = np.asarray(self.tone, np.float32)
            t = t * (1 - m) + np.clip(tone_arr, 0, 1) * 255 * m
            self.tone = Image.fromarray(t.astype(np.uint8), "L")
        if color is not None:
            c = np.asarray(self.col, np.float32)
            col = np.asarray(color, np.float32)
            if col.ndim == 1:
                col = col[None, None, :]
            c = c * (1 - m[..., None]) + col * m[..., None]
            self.col = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8), "RGB")
        if kind is not None:
            k = np.asarray(self.kind).copy()
            k[m > 0.5] = kind
            self.kind = Image.fromarray(k, "L")
        a = np.maximum(np.asarray(self.a, np.float32), m * 255)
        self.a = Image.fromarray(a.astype(np.uint8), "L")
        self._d = [ImageDraw.Draw(im) for im in (self.col, self.tone, self.kind, self.a)]

    def render(self, period=4.6, grain_seed=7, contrast=0.3):
        tone = np.asarray(self.tone, np.float32) / 255.0
        kind = np.asarray(self.kind)
        col = np.asarray(self.col, np.float32)
        a = np.asarray(self.a, np.float32)
        p = period * SS
        wob = (noise(grain_seed, 60, 2) - 0.5) * 0.5 * SS   # a hand-cut line is never perfectly straight
        cov = np.ones_like(tone)
        w = np.clip(tone * 1.08, 0, 1)
        for k, q in ((H_VERT, XX * SS + wob), (H_HORZ, YY * SS + wob), (H_SKY, YY * SS * 0.8 + wob * 0.3), (H_DIAG, (XX + YY) * SS * 0.7071 + wob),
                     (H_RDIAG, (XX - YY) * SS * 0.7071 + wob)):
            sel = kind == k
            if not sel.any():
                continue
            s = 0.5 + 0.5 * np.cos(2 * np.pi * q[sel] / p)
            cov[sel] = np.clip((s - (1 - w[sel])) / 0.22 + 0.5, 0, 1)
        # tone sets the value; the engraved lines only modulate it, so they read as texture, not stripes
        base = 0.1 + 0.9 * tone ** 1.1
        depth = np.full_like(tone, contrast)
        depth[kind == H_SKY] = contrast * 0.6
        depth[kind == H_FLAT] = 0.0
        b = base * (1 - depth + depth * cov)
        grain = 0.95 + 0.08 * noise(grain_seed + 1, 2.0, 1)
        rgb = col * (b * grain)[..., None]
        out = np.concatenate([np.clip(rgb, 0, 255), a[..., None]], axis=-1)
        return Image.fromarray(out.astype(np.uint8), "RGBA")


def boxed(layer):
    """Keep only the hero box; everything outside is transparent."""
    m = mask()
    Pen(m).rect(BOX, fill=255)
    return F.clip_to(layer, m)


def engraved_sky(plate, y0, y1, top=INK_SKY, bottom=WARM_SKY, t0=0.16, t1=0.62, seed=3):
    """A ruled engraver's sky: horizontal lines that thicken toward the horizon, with a few soft cloud banks."""
    m = mask()
    Pen(m).rect((BOX[0], y0, BOX[2], y1), fill=255)
    t = np.clip((YY - y0) / max(1, y1 - y0), 0, 1)
    tone = t0 + (t1 - t0) * t ** 1.3
    n = noise(seed, 90, 3)
    cloud = np.clip((n - 0.58) * 3.0, 0, 1) * np.clip(1 - np.abs(t - 0.62) * 2.2, 0, 1)
    tone = tone + 0.08 * cloud
    colr = F.ramp(t, [(0, top), (0.7, mix(top, bottom, 0.55)), (1, bottom)])[..., :3]
    plate.paint(m, tone, colr, H_SKY)


# ---------------------------------------------------------------------------------------------------------------
# A simple two-point perspective camera (feet in, card px out). Verticals stay vertical, as in an
# architect's rendering.

class Cam:
    def __init__(self, D, yaw_deg, eye, f, cx, hy, pitch=0.0):
        self.D, self.eye, self.f, self.cx, self.hy = D, eye, f, cx, hy
        a = math.radians(yaw_deg)
        self.c, self.s = math.cos(a), math.sin(a)
        self.pc, self.ps = math.cos(pitch), math.sin(pitch)

    def rot(self, x, y, z):
        xr = x * self.c - z * self.s
        zr = x * self.s + z * self.c + self.D
        yr = y - self.eye
        # pitch (look down for positive pitch)
        y2 = yr * self.pc + zr * self.ps
        z2 = -yr * self.ps + zr * self.pc
        return xr, y2, z2

    def P(self, x, y, z):
        xr, yr, zr = self.rot(x, y, z)
        zr = max(zr, 1e-3)
        return (self.cx + self.f * xr / zr, self.hy - self.f * yr / zr)

    def facing(self, center, normal):
        cx, cy, cz = self.rot(*center)
        nx = normal[0] * self.c - normal[2] * self.s
        nz = normal[0] * self.s + normal[2] * self.c
        ny = normal[1]
        ny2 = ny * self.pc + nz * self.ps
        nz2 = -ny * self.ps + nz * self.pc
        return cx * nx + cy * ny2 + cz * nz2 < 0

    def depth(self, p):
        return self.rot(*p)[2]


def lambert(normal, sun):
    n = np.array(normal, float)
    n /= np.linalg.norm(n)
    return float(max(0.0, n @ sun))


def _unit(v):
    v = np.array(v, float)
    return v / np.linalg.norm(v)


# ---------------------------------------------------------------------------------------------------------------
# 0 - 1941: the tower

def _prism_faces(n_sides, r, y0, y1, rot0):
    """Side faces of a regular prism about the Y axis: list of (quad pts 3D, normal, (pa, pb) bottom corners)."""
    faces = []
    for i in range(n_sides):
        a0 = rot0 + 2 * math.pi * i / n_sides
        a1 = rot0 + 2 * math.pi * (i + 1) / n_sides
        pa = (r * math.cos(a0), r * math.sin(a0))
        pb = (r * math.cos(a1), r * math.sin(a1))
        am = (a0 + a1) / 2
        nrm = (math.cos(am), 0.0, math.sin(am))
        quad = [(pa[0], y0, pa[1]), (pb[0], y0, pb[1]), (pb[0], y1, pb[1]), (pa[0], y1, pa[1])]
        faces.append((quad, nrm, pa, pb))
    return faces


def _face_point(pa, pb, u, y, out=0.0, nrm=None):
    """Point on a vertical face at fraction u from pa to pb and height y, pushed out along the normal."""
    x = pa[0] + (pb[0] - pa[0]) * u
    z = pa[1] + (pb[1] - pa[1]) * u
    if nrm is not None:
        x += nrm[0] * out
        z += nrm[2] * out
    return (x, y, z)


def _tone_for(nrm, sun, amb=0.4, gain=0.56):
    return amb + gain * lambert(nrm, sun)


def draw_tower(pl, cam, sun):
    """Hoover Tower as built: an unornamented square shaft with recessed window strips, a belfry stage with round
    arches, a cornice, the stepped-back octagonal cap and a red-tile dome with lantern and ball finial."""
    a = 22.0                      # half width of the shaft, ft
    sq = math.pi / 4              # square faces aligned with the axes

    def quad(q):
        return [cam.P(*p) for p in q]

    def stucco_tone(nrm):
        return _tone_for(nrm, sun)

    def stucco_col(nrm):
        t = lambert(nrm, sun)
        return mix(STUCCO_SH, STUCCO, min(1.0, t * 1.25))

    # --- shaft, 0 -> 236 ft, with the belfry stage and cornices stacked above
    stages = [  # (half width, y0, y1, kind)
        (a + 1.6, -40, 6, "plinth"),
        (a, 6, 226, "shaft"),
        (a + 1.2, 226, 229, "band"),
        (a, 229, 252, "belfry"),
        (a + 1.8, 252, 255.5, "cornice"),
        (a + 0.6, 255.5, 258, "parapet"),
    ]
    for (hw, y0, y1, kind) in stages:
        r = hw * math.sqrt(2)
        faces = _prism_faces(4, r, y0, y1, sq)
        for (q, nrm, pa, pb) in faces:
            c = ((pa[0] + pb[0]) / 2, (y0 + y1) / 2, (pa[1] + pb[1]) / 2)
            if not cam.facing(c, nrm):
                continue
            tone = stucco_tone(nrm)
            if kind in ("band", "cornice"):
                tone = min(1.0, tone + 0.08)
            pl.poly(quad(q), stucco_col(nrm), tone, H_VERT)
            if kind == "shaft":
                # three recessed window strips per face, a lighter reveal on the sunward jamb, small windows per floor
                for u0 in (0.22, 0.47, 0.72):
                    u1 = u0 + 0.06
                    top_y, bot_y = 219, 22
                    rec = [_face_point(pa, pb, u0, bot_y), _face_point(pa, pb, u1, bot_y), _face_point(pa, pb, u1, top_y),
                           _face_point(pa, pb, u0, top_y)]
                    pl.poly(quad(rec), mix(STUCCO_SH, (110, 116, 134), 0.5), tone * 0.55, H_VERT)
                    for fy in np.arange(bot_y + 3, top_y - 4, 11.5):
                        win = [_face_point(pa, pb, u0 + 0.008, fy), _face_point(pa, pb, u1 - 0.008, fy),
                               _face_point(pa, pb, u1 - 0.008, fy + 7), _face_point(pa, pb, u0 + 0.008, fy + 7)]
                        pl.poly(quad(win), (70, 84, 108), 0.18 + 0.2 * tone, H_FLAT)
                    jamb = [cam.P(*_face_point(pa, pb, u0, bot_y)), cam.P(*_face_point(pa, pb, u0, top_y))]
                    pl.line(jamb, mix(STUCCO, (255, 244, 222), 0.5), min(1, tone + 0.2), 0.9)
            if kind == "belfry":
                # three round-arched openings per face; bells hang in the dark interior
                n = 3
                for i in range(n):
                    u0 = 0.12 + i * 0.27
                    u1 = u0 + 0.22
                    spring = 245.0
                    pts = [_face_point(pa, pb, u0, 231.5), _face_point(pa, pb, u1, 231.5), _face_point(pa, pb, u1, spring)]
                    rr = (u1 - u0) / 2
                    width_ft = math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * (u1 - u0)
                    for k in range(1, 16):
                        ang = math.pi * k / 16
                        uu = (u0 + u1) / 2 + rr * math.cos(ang)
                        pts.append(_face_point(pa, pb, uu, spring + width_ft / 2 * math.sin(ang) * 0.9))
                    pts.append(_face_point(pa, pb, u0, spring))
                    pl.poly(quad(pts), (60, 70, 92), 0.12, H_FLAT)
                    # a bell's bronze lip catching light in each opening
                    cxu = (u0 + u1) / 2
                    bl = cam.P(*_face_point(pa, pb, cxu - 0.06, 238.5))
                    br = cam.P(*_face_point(pa, pb, cxu + 0.06, 238.5))
                    bt = cam.P(*_face_point(pa, pb, cxu, 244.5))
                    pl.poly([bl, br, (br[0] - (br[0] - bl[0]) * 0.18, bt[1] + 1.5), (bl[0] + (br[0] - bl[0]) * 0.18, bt[1] + 1.5)],
                            mix(BRONZE_C, (70, 80, 100), 0.45), 0.14 + 0.16 * tone, H_FLAT)
                    # railing across the opening at the deck
                    rl = [cam.P(*_face_point(pa, pb, u0, 234.5)), cam.P(*_face_point(pa, pb, u1, 234.5))]
                    pl.line(rl, STUCCO, tone, 0.9)
    # --- stepped-back octagonal cap
    for (r, y0, y1, arches) in ((17.0, 258, 264, False), (13.8, 264, 272, True)):
        rr = r / math.cos(math.pi / 8)
        for (q, nrm, pa, pb) in _prism_faces(8, rr, y0, y1, math.pi / 8):
            c = ((pa[0] + pb[0]) / 2, (y0 + y1) / 2, (pa[1] + pb[1]) / 2)
            if not cam.facing(c, nrm):
                continue
            tone = stucco_tone(nrm)
            pl.poly(quad(q), stucco_col(nrm), tone, H_VERT)
            if arches:
                win = [_face_point(pa, pb, 0.36, y0 + 1.2), _face_point(pa, pb, 0.64, y0 + 1.2), _face_point(pa, pb, 0.64, y1 - 2.3)]
                for k in range(1, 8):
                    ang = math.pi * k / 8
                    win.append(_face_point(pa, pb, 0.5 + 0.14 * math.cos(ang), y1 - 2.3 + 1.4 * math.sin(ang)))
                win.append(_face_point(pa, pb, 0.36, y1 - 2.3))
                pl.poly(quad(win), (70, 80, 100), 0.16, H_FLAT)

    # --- dome: terracotta tile, shaded as a surface of revolution, with tile courses and ribs
    base = cam.P(0, 272, 0)
    top = cam.P(0, 281, 0)
    rpx = abs(cam.f * 12.6 / cam.depth((0, 272, 0)))
    hpx = base[1] - top[1]
    cx = base[0]
    prof = []
    for k in range(0, 41):
        s = k / 40                                  # 0 base .. 1 crown
        w = math.cos(s * math.pi / 2) ** 0.75       # slightly full, like a tiled cupola
        prof.append((w * rpx, base[1] - hpx * s))
    outline = [(cx + x, y) for x, y in prof] + [(cx - x, y) for x, y in reversed(prof)]
    dm = poly_mask(outline)
    hw_y = np.interp(YY, [y for _, y in reversed(prof)], [x for x, _ in reversed(prof)])
    u = np.clip((XX - cx) / np.maximum(hw_y, 0.5), -1, 1)
    sunx = -sun[0]
    t_dome = 0.22 + 0.62 * np.clip(0.55 - 0.75 * u * np.sign(sunx if sunx else 1) * -1, 0, 1) ** 1.1
    t_dome = 0.24 + 0.66 * np.clip(0.5 - 0.6 * u, 0, 1)   # lit from the left
    pl.paint(dm, t_dome, TILE, H_HORZ)
    # tile ribs (meridians) and courses
    for k in (-0.75, -0.45, -0.15, 0.15, 0.45, 0.75):
        pts = [(cx + x * k, y) for x, y in prof[:-2]]
        pl.line(pts, (120, 56, 38), 0.18, 0.8)
    # lantern and ball finial
    lw = rpx * 0.27
    lt = top[1] - hpx * 0.62
    pl.rect((cx - lw, lt, cx + lw, top[1] + 1.5), STUCCO, 0.8, H_VERT)
    pl.rect((cx + lw * 0.2, lt, cx + lw, top[1] + 1.5), STUCCO_SH, 0.42, H_VERT)
    pl.rect((cx - lw * 0.45, lt + (top[1] - lt) * 0.25, cx - lw * 0.05, top[1] - 1), (70, 80, 100), 0.15, H_FLAT)
    pl.ellipse((cx - lw * 1.25, lt - lw * 0.5, cx + lw * 1.25, lt + lw * 0.45), TILE, 0.55, H_FLAT)
    pl.line([(cx, lt - lw * 0.4), (cx, lt - lw * 1.6)], STUCCO, 0.8, 1.2)
    br = max(2.2, lw * 0.42)
    pl.ellipse((cx - br, lt - lw * 1.6 - br * 2, cx + br, lt - lw * 1.6), STUCCO, 0.85, H_FLAT)


def _oak(pl, rng, cx, base_y, w, h, tone=0.5, col=(120, 140, 98)):
    """A rounded live-oak canopy built from overlapping lobes, lit from the left."""
    for _ in range(int(9 + w / 6)):
        dx = rng.uniform(-0.5, 0.5) * w
        dy = rng.uniform(0.1, 0.85) * h
        r = rng.uniform(0.18, 0.32) * w
        t = tone + 0.25 * (-dx / w) - 0.15 * (dy / h - 0.5) * -1
        pl.ellipse((cx + dx - r, base_y - dy - r * 0.8, cx + dx + r, base_y - dy + r * 0.8), col, t, H_DIAG)


def scene0(th):
    """1941: Arthur Brown Jr.'s tower in late-afternoon sun, crown above the hologram window."""
    pl = Plate()
    engraved_sky(pl, BOX[1], BOX[3], top=(120, 150, 196), bottom=(240, 212, 170), t0=0.34, t1=0.78)
    sun = _unit((-0.85, 0.25, -0.45))
    cam = Cam(D=820, yaw_deg=33, eye=5, f=2460, cx=452, hy=928)
    # rotate the sun into world coords so it falls from the left of the picture
    s = sun
    sun_w = _unit((s[0] * cam.c + s[2] * cam.s, s[1], -s[0] * cam.s + s[2] * cam.c))
    draw_tower(pl, cam, sun_w)
    # foreground live oaks frame the foot of the picture
    rng = random.Random(14)
    for (x, w, h) in ((60, 150, 110), (190, 120, 80), (730, 140, 96), (860, 150, 120)):
        _oak(pl, rng, x, 712, w, h, 0.4)
    return boxed(pl.render())


# ---------------------------------------------------------------------------------------------------------------
# 1 - the carillon: graduated bronze bells fixed in a steel frame

_S_PTS = [0, 0.012, 0.035, 0.07, 0.12, 0.25, 0.5, 0.72, 0.86, 0.95, 1.0]
_W_PTS = [0.0, 0.13, 0.22, 0.28, 0.315, 0.34, 0.37, 0.45, 0.6, 0.72, 0.74]


def bell_sprite(width, height, seed=0, patina=0.3, dim=1.0, period=4.6, ramp_stops=F.BRONZE, band=False):
    """A fixed carillon bell (crown up, mouth down) as a small RGBA sprite at SS. Returns (sprite, ox, oy) where
    (ox, oy) is the crown top in 1x sprite coordinates."""
    pad = 2
    wp = int((1.6 * width + 2 * pad) * SS)
    hp = int((height * 1.16 + 2 * pad) * SS)
    yy, xx = np.mgrid[0:hp, 0:wp].astype(np.float32) / SS
    cx, top = wp / SS / 2, pad + height * 0.06
    s = (yy - top) / height
    hw = np.interp(np.clip(s, 0, 1), _S_PTS, _W_PTS) * width
    inside = (np.abs(xx - cx) <= hw) & (s >= 0) & (s <= 1)
    lip = ((xx - cx) / (width * 0.74)) ** 2 + ((yy - (top + height)) / (height * 0.06)) ** 2 <= 1
    body = inside | lip
    u = np.clip((xx - cx) / np.maximum(hw, 1e-3), -1, 1)
    b = 0.30 + 0.26 * (1 - np.abs(u)) ** 0.5
    b += 0.72 * np.exp(-((u + 0.48) / 0.16) ** 2)
    b += 0.26 * np.exp(-((u - 0.82) / 0.07) ** 2)
    b -= 0.20 * np.exp(-((u - 0.22) / 0.2) ** 2)
    mould = [(0.16, 0.32), (0.19, -0.22), (0.83, 0.3), (0.865, -0.24), (0.91, 0.34)]
    if band:   # the broad raised band of the bourdon's waist, plain
        mould += [(0.44, 0.3), (0.46, -0.18), (0.56, 0.3), (0.58, -0.18)]
    for sb, k in mould:
        b += k * np.exp(-((s - sb) / 0.009) ** 2)
    # engraver's contour lines around the waist
    b *= 0.9 + 0.1 * np.cos(2 * np.pi * yy / (period * 0.9))
    t = np.clip(b / 1.3, 0, 1) * dim
    col = F.ramp(t, ramp_stops)[..., :3]
    rng = np.random.default_rng(seed)
    # weathering runs downward in streaks
    pn = np.asarray(Image.fromarray((rng.random((5, 22)) * 255).astype(np.uint8), "L").resize((wp, hp), Image.Resampling.BICUBIC),
                    np.float32) / 255
    pk = np.clip((pn - 0.45) * 2.4, 0, 1) * patina * (0.6 + 0.4 * (1 - t))
    pat = np.array(PATINA, np.float32)[None, None, :] * (0.35 + 0.8 * t[..., None])
    col = col * (1 - pk[..., None]) + pat * pk[..., None]
    # the mouth: dark interior seen from slightly below, clapper ball inside
    mouth = ((xx - cx) / (width * 0.66)) ** 2 + ((yy - (top + height + height * 0.005)) / (height * 0.045)) ** 2 <= 1
    col[mouth] = col[mouth] * 0.22
    clap = (xx - cx) ** 2 + (yy - (top + height * 1.0)) ** 2 <= (width * 0.085) ** 2
    col[clap] = np.array(ramp_stops[2][1], np.float32) * 0.9 * dim
    a = (body | clap).astype(np.float32) * 255
    out = np.concatenate([np.clip(col, 0, 255), a[..., None]], axis=-1).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    # the crown, bolted up to the beam
    d = ImageDraw.Draw(im)
    cw = width * 0.12
    y0c, y1c = (top - height * 0.06) * SS, (top + height * 0.02) * SS
    d.rectangle(((cx - cw) * SS, y0c, (cx + cw) * SS, y1c), fill=tuple(int(c * dim * 0.7) for c in ramp_stops[2][1]) + (255,))
    d.rectangle(((cx - cw * 0.7) * SS, y0c, (cx - cw * 0.35) * SS, y1c), fill=tuple(int(c * dim) for c in ramp_stops[3][1]) + (255,))
    d.rectangle(((cx - cw * 1.25) * SS, y0c, (cx + cw * 1.25) * SS, y0c + max(2, height * 0.018 * SS)), fill=(150, 154, 160, 255))
    return im, cx, top - height * 0.06


def _place(sprite, x, y):
    lay = new()
    lay.alpha_composite(sprite, (int(round(x * SS)), int(round(y * SS))))
    return lay


def paste_bell(hero, cx, top, width, height, seed, **kw):
    im, ox, oy = bell_sprite(width, height, seed, **kw)
    over(hero, _place(im, cx - ox, top - oy))
    return top + height  # lip y


def steel_beam(p, x0, x1, y, h, lit=(206, 210, 214), dim=1.0):
    """A riveted steel I-beam in elevation, lit from above."""
    c = tuple(int(v * dim) for v in lit)
    p.rect((x0, y, x1, y + h), fill=tuple(int(v * 0.6 * dim) for v in lit) + (255,))
    p.rect((x0, y, x1, y + h * 0.22), fill=c + (255,))
    p.rect((x0, y + h * 0.78, x1, y + h), fill=tuple(int(v * 0.8 * dim) for v in lit) + (255,))
    for rx in np.arange(x0 + 10, x1 - 6, 22):
        p.circle((rx, y + h * 0.5), max(1.0, h * 0.09), fill=c + (255,))


OLD_BRONZE = [(0, (26, 17, 12)), (0.28, (74, 50, 30)), (0.55, (138, 96, 58)), (0.8, (196, 152, 102)), (1, (246, 226, 188))]


def scene1(th):
    """The carillon: 48 graduated bronze bells hung fixed in a steel frame inside the belfry, the bourdon (the
    largest) in front, clapper wires running down toward the clavier below."""
    pl = Plate()
    # belfry interior: the arcade behind the frame, pale sky in the openings, stucco piers in shade
    engraved_sky(pl, BOX[1], BOX[3], top=(168, 188, 216), bottom=(236, 216, 186), t0=0.46, t1=0.8, seed=5)
    bays = [(70, 300), (372, 602), (674, 904)]
    m = mask()
    pm = Pen(m)
    pm.rect(BOX, fill=255)
    for (x0, x1) in bays:
        r = (x1 - x0) / 2
        pm.rect((x0, 96 + r, x1, 620), fill=0)
        pm.ellipse((x0, 96, x1, 96 + 2 * r), fill=0)
    pl.paint(m, 0.22 + 0.08 * np.clip((YY - 28) / 600, 0, 1), (172, 164, 158), H_VERT)
    for (x0, x1) in bays:
        r = (x1 - x0) / 2
        pl.poly([(x0, 96 + r), (x0 + 12, 102 + r), (x0 + 12, 620), (x0, 620)], STUCCO, 0.62, H_VERT)
    pl.rect((28, 620, 888, 694), (150, 140, 128), 0.2, H_HORZ)
    pl.line([(28, 620), (888, 620)], STUCCO, 0.5, 1.2)
    hero = pl.render(grain_seed=11)

    # layout: 24 small bells on the top beam, 14 and 9 graduated below, the bourdon in front: 48 in all
    rows = [  # (beam y, beam h, count, w left, w right, x0, x1, dim)
        (112, 12, 24, 8.5, 14.5, 52, 864, 0.78),
        (246, 14, 14, 16, 27, 56, 586, 0.86),
        (390, 16, 9, 29, 43, 56, 590, 0.95),
    ]
    rng = random.Random(4)
    bells = []
    for (by, bh_, n, wl, wr, x0, x1, dim) in rows:
        ws = [wl + (wr - wl) * i / (n - 1) for i in range(n)]
        total = sum(1.48 * w for w in ws)
        gap = (x1 - x0 - total) / n
        x = x0 + gap / 2
        for w in ws:
            cx = x + 0.74 * w
            bells.append((cx, by + bh_, w, w * 1.22, dim))
            x += 1.48 * w + gap
    bourdon = (728, 300, 166, 206, 1.0)

    # clapper wires first, so every bell sits in front of the wires behind it
    wires = new()
    pw = Pen(wires)
    for (cx, top, w, h, dim) in bells + [bourdon]:
        pw.line([(cx, top + h + 2), (cx, 694)], fill=(214, 206, 192, int(60 + 120 * (dim - 0.7))), width=0.7 if w < 100 else 1.4)
    # the frame: posts, then beams
    fr = new()
    pf = Pen(fr)
    for x in (40, 300, 596, 872):
        pf.rect((x - 6, 100, x + 6, 640), fill=(84, 88, 96, 255))
        pf.rect((x - 6, 100, x - 2, 640), fill=(176, 182, 190, 255))
    over(hero, fr)
    over(hero, wires)
    for (cx, top, w, h, dim) in bells:
        paste_bell(hero, cx, top, w, h, seed=rng.randrange(1 << 30), patina=0.45, dim=dim, ramp_stops=OLD_BRONZE)
    beams = new()
    pb = Pen(beams)
    for (by, bh_, n, wl, wr, x0, x1, dim) in rows:
        steel_beam(pb, 34, 878 if n > 20 else 602, by, bh_, dim=dim)
    over(hero, beams)
    # the bourdon hangs from a heavier beam of its own, nearer to us
    b2 = new()
    steel_beam(Pen(b2), 600, 884, bourdon[1] - 24, 24)
    Pen(b2).rect((586, bourdon[1] - 24, 600, 640), fill=(112, 116, 124, 255))
    Pen(b2).rect((586, bourdon[1] - 24, 591, 640), fill=(206, 210, 216, 255))
    over(hero, b2)
    cx, top, w, h, _ = bourdon
    paste_bell(hero, cx, top, w, h, seed=99, patina=0.75, ramp_stops=OLD_BRONZE, band=True)
    return boxed(hero)


# ---------------------------------------------------------------------------------------------------------------
# 2 - 14th floor: out through the arches over the campus

def _building(pl, cam, sun, x0, z0, x1, z1, hgt, rise, haze, hz_col, arcade=False, tile=TILE):
    """A stucco block with a hipped red-tile roof (feet, world coords; the camera looks along +z). Window rows
    and, for some, a ground-floor arcade of round arches, drawn when large enough to read."""
    P = cam.P

    def col(c, t):
        return mix(c, hz_col, haze), t * (1 - haze) + 0.55 * haze
    faces = [((x0, z0), (x1, z0), (0, 0, -1))]
    if x0 > 0:
        faces.append(((x0, z1), (x0, z0), (-1, 0, 0)))
    elif x1 < 0:
        faces.append(((x1, z0), (x1, z1), (1, 0, 0)))
    for fi, (a, b, nrm) in enumerate(faces):
        t = 0.42 + 0.5 * lambert(nrm, sun)
        c, tt = col(mix((206, 194, 172), STUCCO, min(1, lambert(nrm, sun) * 1.2)), t)
        pl.poly([P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], hgt, b[1]), P(a[0], hgt, a[1])], c, tt, H_FLAT)
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        px_per_ft = cam.f / max(1.0, cam.depth(((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)))
        if px_per_ft * 8 < 2.2:
            continue
        dark, dt = col((96, 96, 104), 0.2)
        n = int(length / 16)
        floors = [hgt * 0.62] if arcade else [hgt * 0.3, hgt * 0.68]
        for fy in floors:
            for i in range(n):
                u0 = (i + 0.32) / n
                u1 = (i + 0.68) / n
                q0 = (a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0)
                q1 = (a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1)
                pl.poly([P(q0[0], fy, q0[1]), P(q1[0], fy, q1[1]), P(q1[0], fy + 6, q1[1]), P(q0[0], fy + 6, q0[1])], dark, dt, H_FLAT)
        if arcade and fi == 0:
            n = int(length / 18)
            for i in range(n):
                u0, u1 = (i + 0.14) / n, (i + 0.86) / n
                q0 = (a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0)
                q1 = (a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1)
                pts = [P(q0[0], 0, q0[1]), P(q1[0], 0, q1[1]), P(q1[0], hgt * 0.32, q1[1])]
                for k in range(1, 8):
                    ang = math.pi * k / 8
                    uu = 0.5 + 0.5 * math.cos(ang)
                    pts.append(P(q0[0] + (q1[0] - q0[0]) * uu, hgt * 0.32 + (u1 - u0) * length * 0.5 * math.sin(ang),
                                 q0[1] + (q1[1] - q0[1]) * uu))
                pts.append(P(q0[0], hgt * 0.32, q0[1]))
                pl.poly(pts, dark, dt + 0.04, H_FLAT)
    dx, dz = x1 - x0, z1 - z0
    e = 2.5
    if dx >= dz:
        r0, r1 = (x0 + dz / 2, z0 + dz / 2), (x1 - dz / 2, z0 + dz / 2)
    else:
        r0, r1 = (x0 + dx / 2, z0 + dx / 2), (x0 + dx / 2, z1 - dx / 2)
    yr = hgt + rise
    A, B, C, D = (x0 - e, z0 - e), (x1 + e, z0 - e), (x1 + e, z1 + e), (x0 - e, z1 + e)
    if dx >= dz:
        planes = [([D, C, r1, r0], (0, 1, 1)), ([A, D, r0], (-1, 1, 0)), ([B, C, r1], (1, 1, 0)), ([A, B, r1, r0], (0, 1, -1))]
    else:
        planes = [([D, C, r1], (0, 1, 1)), ([A, D, r1, r0], (-1, 1, 0)), ([B, C, r1, r0], (1, 1, 0)), ([A, B, r0], (0, 1, -1))]
    for pts, nrm in planes:
        q = [P(pt[0], yr if pt in (r0, r1) else hgt, pt[1]) for pt in pts]
        c, tt = col(tile, 0.3 + 0.62 * lambert(nrm, sun))
        pl.poly(q, c, tt, H_FLAT)
    # the eave line catches the light
    c, tt = col(mix(tile, (255, 236, 210), 0.35), 0.8)
    pl.line([P(A[0], hgt, A[1]), P(B[0], hgt, B[1])], c, tt, 0.8)


def _tree(pl, cam, rng, x, z, size, haze, hz_col):
    """A live-oak crown seen from above: clustered lobes, darker below, a lit lobe on the sun side."""
    cxy = cam.P(x, size * 0.5, z)
    r = cam.f * size * 0.5 / max(1, cam.depth((x, 0, z)))
    c = mix((104, 124, 84), hz_col, haze)
    pl.ellipse((cxy[0] - r, cxy[1] - r * 0.6, cxy[0] + r, cxy[1] + r * 0.75), c, 0.22 * (1 - haze) + 0.5 * haze, H_FLAT)
    for _ in range(7):
        dx, dy = rng.uniform(-0.55, 0.55) * r, rng.uniform(-0.5, 0.35) * r
        rr = r * rng.uniform(0.3, 0.46)
        t = 0.34 + 0.2 * (-dx / max(r, 1e-3)) + 0.14 * (-dy / max(r, 1e-3))
        pl.ellipse((cxy[0] + dx - rr, cxy[1] + dy - rr * 0.75, cxy[0] + dx + rr, cxy[1] + dy + rr * 0.75), c,
                   t * (1 - haze) + 0.5 * haze, H_FLAT)
    hr = r * 0.14
    hc = mix((168, 176, 116), hz_col, haze)
    pl.ellipse((cxy[0] - r * 0.4 - hr, cxy[1] - r * 0.35 - hr * 0.7, cxy[0] - r * 0.4 + hr, cxy[1] - r * 0.35 + hr * 0.7), hc,
               0.62 * (1 - haze) + 0.5 * haze, H_FLAT)


def scene2(th):
    """The observation deck: the belfry's arches frame red-tile roofs among the trees and the foothills beyond."""
    pl = Plate()
    hz_y = 262
    hz_col = (218, 208, 190)
    engraved_sky(pl, BOX[1], hz_y + 4, top=(160, 186, 222), bottom=(238, 224, 198), t0=0.4, t1=0.84, seed=21)
    # foothills: layered ridges, golden summer grass with dark oak woodland in the folds
    rng = random.Random(3)
    ridges = [(hz_y - 40, 26, 0.7, (190, 180, 166)), (hz_y - 22, 20, 0.45, (206, 174, 116)), (hz_y - 4, 10, 0.25, (204, 166, 104))]
    for k, (yb, amp, hk, c) in enumerate(ridges):
        ph = rng.uniform(0, 6)
        pts = [(x, yb - amp * (0.55 + 0.3 * math.sin(x / (130 + 40 * k) + ph) + 0.15 * math.sin(x / 41 + ph * 2)))
               for x in range(20, 900, 6)]
        m = poly_mask(pts + [(900, hz_y + 80), (20, hz_y + 80)])
        n = noise(40 + k, 34 - k * 6, 3)
        oak = np.clip((n - 0.6) * 3, 0, 1) * 0.7
        tone = (0.7 - 0.1 * k) * (1 - 0.3 * oak) + 0.1 * (n - 0.5)
        colr = np.zeros((H * SS, W * SS, 3), np.float32) + np.array(mix(c, hz_col, hk), np.float32)
        colr = colr * (1 - oak[..., None]) + np.array(mix((92, 110, 80), hz_col, hk), np.float32) * oak[..., None]
        pl.paint(m, tone, colr, H_FLAT)
    # the campus floor seen from 250 ft: mostly tree canopy, hazing toward the hills
    gm = mask()
    Pen(gm).rect((20, hz_y - 1, 900, 700), fill=255)
    tcan = noise(51, 5, 3)
    tcan2 = noise(52, 1.6, 1)
    dist = np.clip((YY - hz_y) / (694 - hz_y), 0, 1)
    haze = np.clip(1 - dist * 2.2, 0, 1) ** 1.5
    canopy = 0.26 + 0.26 * tcan + 0.16 * tcan2 * dist
    haze = haze * 0.55
    tone = canopy * (1 - haze) + 0.62 * haze
    gcol = np.zeros((H * SS, W * SS, 3), np.float32) + np.array((108, 126, 86), np.float32)
    gcol = gcol * (1 - haze[..., None]) + np.array(hz_col, np.float32) * haze[..., None]
    pl.paint(gm, tone, gcol, H_FLAT)

    pitch = 0.32
    f = 760
    cam = Cam(D=0, yaw_deg=0, eye=250, f=f, cx=458, hy=hz_y + f * math.tan(pitch), pitch=pitch)
    sun = _unit((-0.62, 0.55, -0.56))
    rng = random.Random(9)
    items = []
    # a quadrangle: a ring of long blocks around a courtyard
    def ring(qx, qz, qw, qd, depth, hgt=34):
        x0, z0, x1, z1 = qx - qw / 2, qz, qx + qw / 2, qz + qd
        return [("b", x0, z1 - depth, x1, z1, hgt, 14, True), ("b", x0, z0 + depth, x0 + depth, z1 - depth, hgt, 14, True),
                ("b", x1 - depth, z0 + depth, x1, z1 - depth, hgt, 14, True), ("b", x0, z0, x1, z0 + depth, hgt, 14, True)]
    items += ring(-120, 1350, 900, 620, 64)
    items += ring(-120, 1450, 520, 400, 54)
    # blocks laid out on the campus grid, two to four storeys
    for gz in np.arange(700, 6200, 240):
        half = gz * 0.66
        for gx in np.arange(-half - 200, half + 200, 300):
            if -620 < gx < 380 and 1300 < gz < 2050:
                continue
            if rng.random() < 0.42:
                continue
            w, d = rng.uniform(120, 260), rng.uniform(60, 120)
            x = gx + rng.uniform(-60, 60)
            z = gz + rng.uniform(-40, 40)
            items.append(("b", x, z, x + w, z + d, rng.uniform(30, 52), rng.uniform(10, 16), rng.random() < 0.25))
    # individual crowns in the foreground, standing out of the canopy
    for _ in range(900):
        z = 480 + 2600 * rng.random() ** 1.6
        x = rng.uniform(-0.75, 0.75) * z
        if -640 < x < 400 and 1330 < z < 2000:
            continue
        items.append(("t", x, z, rng.uniform(26, 44)))

    def far(it):
        return it[2] if it[0] == "t" else it[4]
    items.sort(key=lambda it: -far(it))
    for it in items:
        hz = min(0.6, (1 - math.exp(-far(it) / 4000)) * 0.8)
        if it[0] == "b":
            _, x0, z0, x1, z1, hgt, rise, arc = it
            tile = mix(TILE, (rng.choice(((176, 84, 58), (210, 120, 80), (190, 100, 70)))), rng.uniform(0, 0.6))
            _building(pl, cam, sun, x0, z0, x1, z1, hgt, rise, hz, hz_col, arcade=arc, tile=tile)
        else:
            _, x, z, sz = it
            _tree(pl, cam, rng, x, z, sz, hz, hz_col)
    # the deck arcade: one full arch between two piers, partial arches either side; stucco in shade
    m = mask()
    pm = Pen(m)
    pm.rect(BOX, fill=255)
    spring, crown = 300, 70
    bays = [(-160, 168), (258, 658), (748, 1076)]
    for (x0, x1) in bays:
        r = (x1 - x0) / 2
        ry = spring - crown
        pm.rect((x0, spring, x1, 604), fill=0)
        pm.ellipse((x0, crown, x1, crown + 2 * ry), fill=0)
    pl.paint(m, 0.44 + 0.1 * np.clip((YY - 60) / 600, 0, 1), (190, 180, 170), H_VERT)
    for (x0, x1) in bays:
        r = (x1 - x0) / 2
        ry = spring - crown
        cxa = (x0 + x1) / 2
        # the sunlit reveal of the right jamb and intrados, as the low sun comes in from the west
        pts = [(x1, 604), (x1, spring)]
        for k in range(0, 13):
            a = math.pi / 2 * k / 12
            pts.append((cxa + r * math.cos(a), spring - ry * math.sin(a)))
        for k in range(12, -1, -1):
            a = math.pi / 2 * k / 12
            pts.append((cxa + (r - 14 * math.cos(a) ** 0.6) * math.cos(a), spring - (ry - 9 * math.cos(a) ** 0.6) * math.sin(a)))
        pts += [(x1 - 14, spring), (x1 - 14, 604)]
        pl.poly(pts, STUCCO, 0.74, H_VERT)
    # parapet and sill
    pl.rect((28, 604, 888, 694), (190, 180, 170), 0.4, H_VERT)
    pl.rect((28, 596, 888, 608), STUCCO, 0.82, H_HORZ)
    return boxed(pl.render(grain_seed=23))


# ---------------------------------------------------------------------------------------------------------------
# 3 - 1940s: the ground-floor radio room

def _knob(hero, x, y, r):
    """A black bakelite knob with a fluted skirt and a pointer line, lit from the upper left (local sprite)."""
    n = int(2 * (r + 2) * SS)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / SS - (r + 2)
    d = np.sqrt(xx ** 2 + yy ** 2)
    ang = np.arctan2(yy, xx)
    skirt = d <= r
    cap = d <= r * 0.64
    light = np.clip(-(xx + yy) / (1.414 * r), -1, 1)
    flute = 0.5 + 0.5 * np.cos(ang * 24)
    v = np.where(cap, 0.16 + 0.22 * light + 0.5 * np.exp(-((d / r - 0.5) / 0.08) ** 2) * np.clip(light, 0, 1),
                 0.12 + 0.12 * flute + 0.4 * np.clip(light, 0, 1) * (0.6 + 0.4 * flute))
    rim = np.exp(-((d - r) / 0.8) ** 2) * 0.5 * np.clip(light + 0.4, 0, 1)
    v = np.clip(v + rim, 0, 1)
    rgb = F.ramp(v, [(0, (8, 8, 10)), (0.4, (60, 60, 66)), (0.75, (170, 170, 176)), (1, (246, 246, 248))])[..., :3]
    a = np.clip((r + 0.5 - d) * SS, 0, 1) * 255
    im = Image.fromarray(np.concatenate([rgb, a[..., None]], -1).astype(np.uint8), "RGBA")
    pd = ImageDraw.Draw(im)
    c = (r + 2) * SS
    pd.line([(c, c - r * 0.12 * SS), (c, c - r * 0.6 * SS)], fill=(238, 238, 236, 255), width=max(2, int(r * 0.09 * SS)))
    over(hero, _place(im, x - r - 2, y - r - 2))


def _headphones(hero, cx, cy):
    """A 1940s headset lying on the desk: two round bakelite receivers with metal rims on a double steel band."""
    lay = new()
    p = Pen(lay)
    # double spring-steel headband lying in a loop behind the receivers
    for k, (wd, col) in enumerate(((5, (70, 72, 78, 255)), (1.6, (226, 228, 232, 255)))):
        p.arc((cx - 78, cy - 70, cx + 70, cy + 22), 188, 352, fill=col, width=wd)
        p.arc((cx - 72, cy - 62, cx + 64, cy + 18), 192, 348, fill=col, width=wd * 0.8)
    for (ex, ey, r) in ((cx - 70, cy + 2, 30), (cx + 62, cy - 4, 28)):
        # thickness of the receiver, then its face (seen obliquely), rim and centre cap
        p.ellipse((ex - r, ey - r * 0.5 + 6, ex + r, ey + r * 0.5 + 6), fill=(24, 24, 28, 255))
        p.rect((ex - r, ey, ex + r, ey + 6), fill=(24, 24, 28, 255))
        p.ellipse((ex - r, ey - r * 0.5, ex + r, ey + r * 0.5), fill=(54, 54, 60, 255))
        p.arc((ex - r, ey - r * 0.5, ex + r, ey + r * 0.5), 170, 300, fill=(236, 236, 238, 255), width=1.8)
        p.arc((ex - r, ey - r * 0.5 + 6, ex + r, ey + r * 0.5 + 6), 20, 160, fill=(120, 120, 126, 255), width=1.2)
        p.ellipse((ex - r * 0.72, ey - r * 0.36, ex + r * 0.72, ey + r * 0.36), outline=(180, 182, 186, 255), width=1.2)
        p.ellipse((ex - r * 0.2, ey - r * 0.1, ex + r * 0.2, ey + r * 0.1), fill=(150, 150, 156, 255))
        # yoke clip up to the band
        p.line([(ex, ey - r * 0.5), (ex + (6 if ex < cx else -6), ey - r * 0.5 - 14)], fill=(210, 212, 216, 255), width=2.4)
    over(hero, lay)


def scene3(th):
    """A grey-panel communications receiver on a desk under lamp light: tuning dial and meters (ticks only),
    knobs, headphones on their cord, a notepad of hurried notes and a pencil."""
    pl = Plate()
    m = mask()
    Pen(m).rect((28, 28, 888, 560), fill=255)
    d = np.sqrt((XX - 260) ** 2 + ((YY - 120) * 1.3) ** 2)
    pl.paint(m, 0.16 + 0.42 * np.clip(1 - d / 760, 0, 1) ** 1.4, (200, 186, 160), H_VERT)
    dm = poly_mask([(28, 560), (888, 560), (888, 694), (28, 694)])
    dd = np.sqrt((XX - 300) ** 2 + ((YY - 520) * 1.6) ** 2)
    pl.paint(dm, 0.2 + 0.5 * np.clip(1 - dd / 700, 0, 1), (196, 150, 104), H_HORZ)
    pl.line([(28, 560), (888, 560)], (236, 210, 170), 0.85, 1.4)
    hero = pl.render(grain_seed=31, contrast=0.16)
    sh = new()
    Pen(sh).poly([(160, 560), (780, 560), (860, 600), (240, 600)], fill=(0, 0, 0, 150))
    over(hero, blur(sh, 8))

    # receiver: cabinet top (seen slightly from above) and the rack panel
    rx0, ry0, rx1, ry1 = 168, 236, 752, 560
    rec = Plate()
    rec.poly([(rx0 + 18, ry0 - 26), (rx1 - 18, ry0 - 26), (rx1, ry0), (rx0, ry0)], (178, 182, 184), 0.74, H_FLAT)
    pm = mask()
    Pen(pm).rect((rx0, ry0, rx1, ry1), fill=255)
    lamp = np.sqrt((XX - 300) ** 2 + ((YY - 180) * 1.2) ** 2)
    rec.paint(pm, 0.42 + 0.42 * np.clip(1 - lamp / 680, 0, 1), (180, 184, 186), H_FLAT)
    over(hero, rec.render(grain_seed=41))
    p = Pen(hero)
    p.line([(rx0, ry0), (rx1, ry0)], fill=(236, 238, 238, 255), width=1.6)
    p.line([(rx0, ry0), (rx0, ry1)], fill=(226, 228, 228, 220), width=1.2)
    p.line([(rx1, ry0), (rx1, ry1)], fill=(70, 72, 76, 255), width=1.4)
    for (sx, sy) in ((rx0 + 14, ry0 + 14), (rx1 - 14, ry0 + 14), (rx0 + 14, ry1 - 14), (rx1 - 14, ry1 - 14)):
        p.circle((sx, sy), 4.2, fill=(120, 122, 124, 255))
        p.circle((sx - 0.8, sy - 0.8), 2.2, fill=(236, 236, 232, 255))
    for hx, sgn in ((rx0 + 34, 1), (rx1 - 34, -1)):
        for (y0, y1) in ((ry0 + 50, ry0 + 140), (ry1 - 140, ry1 - 50)):
            p.line([(hx, y0), (hx - 16 * sgn, y0 + 8), (hx - 16 * sgn, y1 - 8), (hx, y1)], fill=(84, 86, 90, 255), width=7)
            p.line([(hx - 2 * sgn, y0 + 2), (hx - 18 * sgn, y0 + 10), (hx - 18 * sgn, y1 - 10)], fill=(240, 240, 236, 255), width=2.2)
    # main tuning dial: backlit window, three frequency bands of ticks and a pointer (no numerals)
    dx0, dy0, dx1, dy1 = 322, 270, 598, 392
    pd = Pen(hero)
    pd.rect((dx0 - 8, dy0 - 8, dx1 + 8, dy1 + 8), fill=(90, 92, 96, 255))
    pd.rect((dx0 - 8, dy0 - 8, dx1 + 8, dy0 - 5), fill=(226, 228, 228, 255))
    pd.rect((dx0, dy0, dx1, dy1), fill=(234, 216, 170, 255))
    over(hero, F.vgrad(dy0, dy1, [(0, (120, 90, 50, 0)), (1, (120, 90, 50, 60))], poly_mask([(dx0, dy0), (dx1, dy0), (dx1, dy1), (dx0, dy1)])))
    pt = Pen(hero)
    for band, (yb, n) in enumerate(((dy0 + 26, 41), (dy0 + 58, 33), (dy0 + 90, 27))):
        pt.line([(dx0 + 16, yb), (dx1 - 16, yb)], fill=(92, 62, 36, 255), width=1.2)
        for i in range(n):
            x = dx0 + 16 + (dx1 - dx0 - 32) * (i / (n - 1)) ** (1.0 + 0.12 * band)
            ln = 9 if i % 5 == 0 else 5
            pt.line([(x, yb - ln), (x, yb)], fill=(92, 62, 36, 255), width=1.2)
    pt.line([(468, dy0 + 4), (468, dy1 - 4)], fill=(150, 46, 30, 255), width=2.4)
    # two round windows: signal-strength meter (left) and band-spread dial (right), ticks only
    for (mx, my, kind) in ((254, 330, "meter"), (666, 330, "spread")):
        mr = 40
        pt.circle((mx, my), mr + 7, fill=(90, 92, 96, 255))
        pt.circle((mx, my), mr, fill=(236, 226, 196, 255))
        if kind == "meter":
            for i in range(11):
                ang = math.radians(210 + i * 12)
                r0, r1 = mr - (12 if i % 5 == 0 else 8), mr - 4
                pt.line([(mx + r0 * math.cos(ang), my + r0 * math.sin(ang) + 10), (mx + r1 * math.cos(ang), my + r1 * math.sin(ang) + 10)],
                        fill=(70, 50, 34, 255), width=1.2)
            pt.line([(mx, my + 14), (mx + 22 * math.cos(math.radians(282)), my + 14 + 30 * math.sin(math.radians(282)))],
                    fill=(40, 30, 24, 255), width=1.6)
        else:
            for i in range(24):
                ang = math.radians(i * 15)
                pt.line([(mx + (mr - 8) * math.cos(ang), my + (mr - 8) * math.sin(ang)), (mx + (mr - 3) * math.cos(ang), my + (mr - 3) * math.sin(ang))],
                        fill=(70, 50, 34, 255), width=1.1)
            pt.line([(mx, my), (mx + 26 * math.cos(math.radians(-60)), my + 26 * math.sin(math.radians(-60)))], fill=(150, 46, 30, 255), width=1.8)
        pt.arc((mx - mr - 7, my - mr - 7, mx + mr + 7, my + mr + 7), 200, 300, fill=(230, 232, 232, 255), width=1.6)
    _knob(hero, 460, 452, 40)
    for kx in (254, 330, 590, 666):
        _knob(hero, kx, 448, 24)
    for kx in (254, 330, 406, 514, 590, 666):
        _knob(hero, kx, 516, 16)
    for tx in (392, 528):
        pt.circle((tx, 448), 9, fill=(200, 200, 200, 255))
        pt.line([(tx, 448), (tx + 4, 430)], fill=(246, 246, 242, 255), width=3.2)
    jx, jy = 720, 520
    pt.circle((jx, jy), 9, fill=(60, 60, 64, 255), outline=(220, 222, 224, 255), width=1.5)
    # headphones on the desk, cord to the jack
    cord = [(jx, jy)] + [(jx - 10 * t + 30 * t * t, jy + 90 * t + 10 * math.sin(t * 5)) for t in np.linspace(0.05, 1, 24)]
    pt.line(cord, fill=(150, 120, 90, 255), width=3)
    pt.line(cord, fill=(40, 30, 22, 255), width=1.2)
    _headphones(hero, 772, 628)
    # notepad with hurried, illegible notes and a pencil
    pdm = poly_mask([(56, 606), (230, 590), (246, 690), (66, 700)])
    over(hero, F.fill(pdm, (232, 224, 204, 255)))
    over(hero, F.lgrad((56, 590), (246, 700), [(0, (255, 248, 230, 0)), (1, (120, 100, 70, 70))], pdm))
    rng = random.Random(6)
    note = new()
    pn = Pen(note)
    for k in range(6):
        y = 612 + k * 13
        x = 74 + k * 1.2
        xe = 226 - rng.uniform(0, 50) + k * 1.4
        pts = []
        while x < xe:
            pts.append((x, y - (x - 60) * 0.088 + rng.uniform(-2.4, 2.4)))
            x += rng.uniform(3, 5)
        if len(pts) > 1:
            pn.line(pts, fill=(60, 60, 84, 220), width=1.1)
    over(hero, F.clip_to(note, pdm))
    pc = Pen(hero)
    pc.line([(120, 676), (268, 640)], fill=(190, 150, 70, 255), width=6)
    pc.line([(120, 674), (268, 638)], fill=(246, 214, 140, 255), width=1.6)
    pc.line([(268, 640), (282, 637)], fill=(220, 190, 160, 255), width=5)
    pc.line([(112, 678), (120, 676)], fill=(60, 50, 44, 255), width=3)
    return boxed(hero)


SCENES = (scene0, scene1, scene2, scene3)

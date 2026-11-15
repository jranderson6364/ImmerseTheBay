"""Story-card pictures for the Huang Engineering Center (card id "huang").

Four museum-exhibit style illustrations, each showing exactly what its card copy says (tools/story-cards.json):
  0  the building itself: sandstone walls, a flat-arched arcade standing proud of the wall, red tile hip roof
  1  a section cut: dean's office + Terman Engineering Library on the second floor, the raked 300-seat NVIDIA
     Auditorium on the terrace level (floors per the Huang Center self-guided tour)
  2  the 1996 Page + Brin storage server: drives in a cabinet of oversized toy blocks, translucent plastic and tape,
     in a glass vitrine on a stone plinth
  3  an aerial of the roofs: solar panels on the south-facing slopes, pale courtyard tiles, atria pulling daylight
     in, on the east-west engineering quad axis

Palette is architectural: warm sandstone, terracotta, copper hairlines on midnight navy. Spectacles is additive, so
shadows are warm mid-tones rather than black voids, and the sky stays dark (reads as see-through).

SCENES = (scene0, scene1, scene2, scene3); each takes a theme dict and returns a 2x RGBA canvas (story_cards_featured
.new()) with content drawn in card-pixel coordinates inside BOX and transparent elsewhere.
"""

import math
import random

import numpy as np
from PIL import Image

from story_cards_featured import (SS, H, W, Pen, _XX, _YY, add, blur, clip_to, fill, iso_box, iso_fn,
                                  lgrad, hull, mask, new, noise, over, poly_mask, rgrad, shade, text, text_width,
                                  font, tone, vgrad)

BOX = (28, 28, 888, 694)
NAVY = (16, 26, 37)
COPPER = (214, 140, 86)
COPPER_HI = (246, 190, 132)
STONE = (226, 194, 146)       # sunlit sandstone
STONE_SH = (150, 118, 92)     # sandstone in shade (warm, not black)
TILE = (186, 82, 54)          # clay roof tile
TILE_SH = (126, 58, 44)


def box_mask():
    m = mask()
    Pen(m).rect(BOX, fill=255)
    return m


def finish(hero):
    return clip_to(hero, box_mask())


def sky(hero, horizon, warm=(64, 52, 54)):
    """Night-navy sky with a faint warm band at the horizon (dark, so it stays see-through on device)."""
    m = mask()
    Pen(m).rect((BOX[0], BOX[1], BOX[2], horizon), fill=255)
    over(hero, vgrad(BOX[1], horizon, [(0, (14, 22, 34, 255)), (0.62, (22, 30, 44, 255)), (1, warm + (255,))], m))
    m2 = mask()
    Pen(m2).rect((BOX[0], horizon, BOX[2], BOX[3]), fill=255)
    over(hero, vgrad(horizon, horizon + 140, [(0, warm + (255,)), (1, warm + (0,))], m2))


# ---------------------------------------------------------------------------------------------------------------
# Perspective camera with vertical verticals (architectural two-point), auto-fitted into a screen rectangle.

class Camera:
    def __init__(self, eye, target, fit_pts, rect):
        self.ex, self.ey, self.ez = eye
        dx, dz = target[0] - eye[0], target[2] - eye[2]
        self.yaw = math.atan2(dx, dz)
        self.k, self.ox, self.oy = 1.0, 0.0, 0.0
        raw = [self._raw(*p) for p in fit_pts]
        x0, x1 = min(p[0] for p in raw), max(p[0] for p in raw)
        y0, y1 = min(p[1] for p in raw), max(p[1] for p in raw)
        rx0, ry0, rx1, ry1 = rect
        self.k = min((rx1 - rx0) / (x1 - x0), (ry1 - ry0) / (y1 - y0))
        self.ox = (rx0 + rx1) / 2 - self.k * (x0 + x1) / 2
        self.oy = (ry0 + ry1) / 2 - self.k * (y0 + y1) / 2

    def _raw(self, X, Y, Z):
        dx, dy, dz = X - self.ex, Y - self.ey, Z - self.ez
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        x = c * dx - s * dz
        z = s * dx + c * dz
        z = max(z, 0.5)
        return (x / z, -dy / z)

    def __call__(self, X, Y, Z):
        x, y = self._raw(X, Y, Z)
        return (self.ox + self.k * x, self.oy + self.k * y)

    def poly(self, pts):
        return [self(*p) for p in pts]


def seg_arch(cx, w, spring, rise, n=18):
    """(x, y) points of a flat segmental arch of half-width w, left springing to right."""
    R = (w * w + rise * rise) / (2 * rise)
    yc = spring + rise - R
    t0 = math.asin(w / R)
    return [(cx + R * math.sin(-t0 + 2 * t0 * i / n), yc + R * math.cos(-t0 + 2 * t0 * i / n)) for i in range(n + 1)]


# ---------------------------------------------------------------------------------------------------------------
# 0 - The gift behind the gateway: the building

def scene0(th):
    hero = new()
    L, D = 64.0, 20.0                  # facade length (X) and depth (Z)
    EAVE, RIDGE = 17.0, 21.6
    AZ = -3.6                          # arcade front plane
    AH, AR = 7.0, 7.9                  # arcade parapet top, arcade roof meets wall
    fit = [(-1.2, 0, AZ - 0.2), (L + 1.2, 0, AZ - 0.2), (L + 1.2, 0, D), (-1.2, RIDGE, 9), (L + 1.2, EAVE, D + 1), (-1.2, EAVE, -1.2)]
    C = Camera((84, 9.5, -40), (28, 9, 10), fit, (50, 124, 868, 640))
    horizon = C(30, 9.5, 400)[1]
    sky(hero, horizon, warm=(58, 50, 52))

    # paving: pale stone in perspective, joints along both axes, fading toward the viewer
    ground = new()
    pg = Pen(ground)
    gpoly = C.poly([(-30, 0, D + 30), (L + 30, 0, D + 30), (L + 30, 0, -22), (-30, 0, -22)])
    pg.poly(gpoly, fill=(168, 148, 122, 255))
    gm = poly_mask(gpoly)
    for x in range(-30, int(L) + 31, 8):
        pg.line([C(x, 0, D + 30), C(x, 0, -22)], fill=(140, 122, 102, 60), width=1)
    for z in range(-22, int(D) + 30, 8):
        pg.line([C(-30, 0, z), C(L + 30, 0, z)], fill=(140, 122, 102, 50), width=1)
    ground = clip_to(ground, gm)
    ga = np.asarray(ground, np.float32).copy()
    gcx, gcy = C(L * 0.55, 0, AZ)
    ga[..., 3] *= np.clip(1.0 - np.sqrt(((_XX - gcx) / 520) ** 2 + ((_YY - gcy) / 110) ** 2), 0.0, 1.0) ** 1.2
    over(hero, Image.fromarray(ga.astype(np.uint8), "RGBA"))

    # --- walls
    front = poly_mask(C.poly([(0, AR, 0), (L, AR, 0), (L, EAVE, 0), (0, EAVE, 0)]))
    side = poly_mask(C.poly([(L, 0, 0), (L, 0, D), (L, EAVE, D), (L, EAVE, 0)]))
    arc_front = mask()
    Pen(arc_front).poly(C.poly([(0, 0, AZ), (L, 0, AZ), (L, AH, AZ), (0, AH, AZ)]), fill=255)
    arc_side = poly_mask(C.poly([(L, 0, AZ), (L, 0, 0), (L, AH, 0), (L, AH, AZ)]))
    # deliberately asymmetric bays: a wider bay near the left third marks the entry
    widths = [5.2] * 3 + [7.4] + [5.2] * 7
    pier = (L - sum(widths)) / (len(widths) + 1)
    bays, x = [], pier
    for w in widths:
        bays.append((x, x + w))
        x += w + pier
    spring, rise = 5.0, 0.75
    openings = []
    pa = Pen(arc_front)
    for (a, b) in bays:
        cx, hw = (a + b) / 2, (b - a) / 2
        r = rise * (1.25 if hw > 3 else 1.0)
        pts = [(a, 0)] + seg_arch(cx, hw, spring, r) + [(b, 0)]
        openings.append(pts)
        pa.poly([C(px, py, AZ) for px, py in pts], fill=0)
    # side opening of the arcade end
    so = [(L, 0, AZ + 0.7), (L, 4.7, AZ + 0.7), (L, 4.7, -0.7), (L, 0, -0.7)]
    Pen(arc_side).poly(C.poly(so), fill=0)

    # recessed wall inside the arcade (in shade, warm), floor of the walk, ceiling
    inner = new()
    pi = Pen(inner)
    pi.poly(C.poly([(0, 0, 0), (L, 0, 0), (L, AH, 0), (0, AH, 0)]), fill=(118, 92, 72, 255))
    pi.poly(C.poly([(0, 0, AZ), (L, 0, AZ), (L, 0, 0), (0, 0, 0)]), fill=(136, 110, 86, 255))
    pi.poly(C.poly([(0, AH - 0.5, AZ), (L, AH - 0.5, AZ), (L, AH - 0.5, 0), (0, AH - 0.5, 0)]), fill=(98, 76, 62, 255))
    # doors and windows on the inner wall: tall glazed openings, the wide entry bay fully glazed
    for i, (a, b) in enumerate(bays):
        cx = (a + b) / 2
        if i == 3:
            g = [(a + 0.6, 0.0), (b - 0.6, 0.0), (b - 0.6, 5.4), (a + 0.6, 5.4)]
            mull = [a + 0.6 + k * (b - a - 1.2) / 4 for k in range(1, 4)]
        else:
            g = [(cx - 1.4, 0.9), (cx + 1.4, 0.9), (cx + 1.4, 5.0), (cx - 1.4, 5.0)]
            mull = [cx]
        quad = C.poly([(px, py, 0) for px, py in g])
        pi.poly(quad, fill=(150, 150, 146, 255))
        top = g[2][1]
        for mx in mull:
            pi.line([C(mx, g[0][1], 0), C(mx, top, 0)], fill=(96, 82, 70, 255), width=1.6)
        pi.line([C(g[0][0], 2.6 if i == 3 else 3.4, 0), C(g[1][0], 2.6 if i == 3 else 3.4, 0)], fill=(96, 82, 70, 255), width=1.2)
    over(hero, inner)
    # sun through the arches: lit arch-shaped patches on the floor of the walk and the inner wall
    patch = new()
    pp = Pen(patch)
    sx, sy, sz = 0.55, -0.75, 0.38          # sun direction (from upper left, behind-left of camera)
    for pts in openings:
        wall_pts = []
        for (px, py) in pts:
            t = -AZ / sz
            yy = py + sy * t
            wall_pts.append(C(px + sx * t, max(0, yy), 0))
        pp.poly(wall_pts, fill=(236, 190, 140, 120))
    inner_m = poly_mask(C.poly([(0, 0, 0), (L, 0, 0), (L, AH - 0.5, 0), (0, AH - 0.5, 0)]))
    add(hero, clip_to(blur(patch, 0.8), inner_m), 0.9)

    # --- the sandstone surfaces, one grain pass
    stone_m = Image.fromarray(np.maximum.reduce([np.asarray(m) for m in (front, side, arc_front, arc_side)]), "L")
    stone = fill(stone_m, STONE + (255,))
    f = (1 + 0.05 * (noise(31, 1.6, 1) - 0.5) + 0.05 * (noise(32, 120, 2) - 0.5)) * np.clip(1.08 - 0.22 * (_XX - 60) / 800, 0.84, 1.08)
    # soft light falloff across the long facade, warmer toward the sun
    over(hero, shade(stone, f))
    side_all = Image.fromarray(np.maximum(np.asarray(side), np.asarray(arc_side)), "L")
    over(hero, fill(side_all, (122, 104, 110, 150)))

    # pier returns (the depth of the applied arcade) seen through each opening: shaded right-facing sides
    ret = new()
    pr = Pen(ret)
    for (a, b) in bays:
        pr.poly(C.poly([(a, 0, AZ), (a, 0, AZ + 0.9), (a, spring, AZ + 0.9), (a, spring, AZ)]), fill=STONE_SH + (255,))
    over(hero, ret)

    # arcade roof: a low clay-tile shed from the parapet to the wall
    roof_a = C.poly([(-0.4, AH, AZ - 0.5), (L + 0.4, AH, AZ - 0.5), (L + 0.4, AR, 0), (-0.4, AR, 0)])
    roof_side = C.poly([(L + 0.4, AH, AZ - 0.5), (L + 0.4, AR, 0), (L + 0.4, AH, 0)])
    rl = new()
    Pen(rl).poly(roof_a, fill=TILE + (255,))
    Pen(rl).poly(roof_side, fill=TILE_SH + (255,))
    for x in np.arange(-0.4, L + 0.4, 0.55):
        Pen(rl).line([C(x, AH, AZ - 0.5), C(x, AR, 0)], fill=tone(TILE, 0.78) + (200,), width=1)
    Pen(rl).line([C(-0.4, AH, AZ - 0.5), C(L + 0.4, AH, AZ - 0.5)], fill=tone(TILE, 1.25) + (255,), width=2)
    over(hero, rl)

    # --- upper floors: punched windows with deep reveals; shadow on the sun-side jamb and head
    win = new()
    pw = Pen(win)
    n = 17
    pitch = L / n
    rows = ((9.0, 12.0), (13.0, 15.6))
    for j, (y0, y1) in enumerate(rows):
        for i in range(n):
            if j == 0 and i in (5, 6):
                continue                     # the entry bay above the wide arch is one tall glazed panel below
            x0, x1 = i * pitch + pitch * 0.28, (i + 1) * pitch - pitch * 0.28
            glass = C.poly([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)])
            lit = (i * 7 + j * 3) % 11 in (2, 9)
            pw.poly(glass, fill=((236, 186, 124, 255) if lit else (88, 100, 118, 255)))
            # sky reflection: warmer toward the sill
            pw.poly(C.poly([(x0, y0, 0), (x1, y0, 0), (x1, y0 + 1.1, 0), (x0, y0 + 1.1, 0)]),
                    fill=((250, 210, 150, 255) if lit else (132, 120, 116, 255)))
            pw.line([C((x0 + x1) / 2, y0, 0), C((x0 + x1) / 2, y1, 0)], fill=(70, 60, 54, 200), width=1.0)
            # reveal shadow (sun from left/up): left jamb and head
            pw.poly(C.poly([(x0, y0, 0), (x0 + 0.35, y0, 0), (x0 + 0.35, y1 - 0.4, 0), (x0, y1, 0)]), fill=(88, 72, 62, 230))
            pw.poly(C.poly([(x0, y1 - 0.4, 0), (x1, y1 - 0.4, 0), (x1, y1, 0), (x0, y1, 0)]), fill=(96, 78, 66, 230))
            # sill
            pw.line([C(x0 - 0.15, y0, 0), C(x1 + 0.15, y0, 0)], fill=(250, 232, 200, 230), width=1.4)
    # tall glazing over the entry bay (two windows merged)
    ex0, ex1 = 5 * pitch + pitch * 0.28, 7 * pitch - pitch * 0.28
    pw.poly(C.poly([(ex0, 8.6, 0), (ex1, 8.6, 0), (ex1, 15.6, 0), (ex0, 15.6, 0)]), fill=(120, 130, 138, 255))
    for k in range(1, 4):
        xx = ex0 + k * (ex1 - ex0) / 4
        pw.line([C(xx, 8.6, 0), C(xx, 15.6, 0)], fill=(196, 180, 156, 255), width=1.4)
    for yy in (11.0, 13.4):
        pw.line([C(ex0, yy, 0), C(ex1, yy, 0)], fill=(196, 180, 156, 255), width=1.2)
    pw.poly(C.poly([(ex0, 8.6, 0), (ex0 + 0.4, 8.6, 0), (ex0 + 0.4, 15.2, 0), (ex0, 15.6, 0)]), fill=(88, 72, 62, 230))
    # side windows (shade side, small)
    for i in range(5):
        z0, z1 = 2 + i * 3.6, 2 + i * 3.6 + 1.6
        for (y0, y1) in rows:
            pw.poly(C.poly([(L, y0, z0), (L, y0, z1), (L, y1, z1), (L, y1, z0)]), fill=(84, 88, 96, 255))
    over(hero, win)

    # string course over the arcade roof and cornice band under the eave
    bands = new()
    pb = Pen(bands)
    pb.poly(C.poly([(0, 16.2, 0), (L, 16.2, 0), (L, 16.7, 0), (0, 16.7, 0)]), fill=(244, 222, 184, 255))
    pb.poly(C.poly([(L, 16.2, 0), (L, 16.2, D), (L, 16.7, D), (L, 16.7, 0)]), fill=(170, 140, 110, 255))
    over(hero, bands)

    # eave shadow on the wall
    es = new()
    Pen(es).poly(C.poly([(0, 15.9, 0), (L, 15.9, 0), (L, EAVE, 0), (0, EAVE, 0)]), fill=(60, 40, 30, 120))
    over(hero, blur(es, 1.5))

    # --- hip roof: front slope (lit), right hip (shade), fascia, tile courses
    O = 1.3
    e0, e1, e2 = (-O, EAVE, -O), (L + O, EAVE, -O), (L + O, EAVE, D + O)
    r0, r1 = (D / 2 + 1.0, RIDGE, D / 2), (L - D / 2 - 1.0, RIDGE, D / 2)
    roof = new()
    pr = Pen(roof)
    front_slope = C.poly([e0, e1, r1, r0])
    hip = C.poly([e1, e2, r1])
    pr.poly(front_slope, fill=TILE + (255,))
    pr.poly(hip, fill=TILE_SH + (255,))
    roof_m = poly_mask(front_slope)
    # tile rows (barrel tiles run down the slope) and courses
    lines = new()
    pl = Pen(lines)
    for t in np.linspace(0, 1, 120):
        a = (e0[0] + (e1[0] - e0[0]) * t, EAVE, -O)
        bx = r0[0] + (r1[0] - r0[0]) * t
        # interpolate along the ridge, sliding toward the hip ends
        top = (bx, RIDGE, D / 2) if r0[0] <= a[0] <= r1[0] else None
        if top is None:
            # on the hip-adjacent triangles the barrel lines still run straight up the slope until they meet the hip
            frac = (a[0] - e0[0]) / (r0[0] - e0[0]) if a[0] < r0[0] else (e1[0] - a[0]) / (e1[0] - r1[0])
            top = (a[0], EAVE + (RIDGE - EAVE) * frac, -O + (D / 2 + O) * frac)
        pl.line([C(*a), C(*top)], fill=tone(TILE, 0.74) + (210,), width=1.1)
        pl.line([C(a[0] + 0.12, EAVE, -O), C(top[0] + 0.12, top[1], top[2])], fill=tone(TILE, 1.22) + (150,), width=0.8)
    for k in range(1, 9):
        u = k / 9
        pa_ = (e0[0] + (r0[0] - e0[0]) * u, EAVE + (RIDGE - EAVE) * u, -O + (D / 2 + O) * u)
        pb_ = (e1[0] + (r1[0] - e1[0]) * u, EAVE + (RIDGE - EAVE) * u, -O + (D / 2 + O) * u)
        pl.line([C(*pa_), C(*pb_)], fill=tone(TILE, 0.66) + (120,), width=0.9)
    rough = 0.92 + 0.16 * noise(41, 6, 2)
    roof = shade(roof, rough * np.clip(1.08 - 0.1 * (_XX - 100) / 700, 0.9, 1.1))
    over(hero, roof)
    over(hero, clip_to(lines, roof_m))
    hip_lines = new()
    for k in range(1, 14):
        u = k / 14
        a = (e1[0], EAVE, -O + (D + 2 * O) * u)
        Pen(hip_lines).line([C(*a), C(*r1)], fill=tone(TILE_SH, 0.75) + (150,), width=0.9)
    over(hero, clip_to(hip_lines, poly_mask(hip)))
    # ridge and hip caps, fascia line lit by the sun
    caps = new()
    pc = Pen(caps)
    pc.line([C(*r0), C(*r1)], fill=tone(TILE, 1.3) + (255,), width=2.4)
    pc.line([C(*e0), C(*r0)], fill=tone(TILE, 1.3) + (255,), width=2.0)
    pc.line([C(*e1), C(*r1)], fill=tone(TILE, 1.15) + (255,), width=2.0)
    pc.line([C(*e2), C(*r1)], fill=tone(TILE, 1.0) + (200,), width=1.6)
    pc.line([C(*e0), C(*e1)], fill=(250, 226, 196, 255), width=2.2)
    pc.line([C(*e1), C(*e2)], fill=(190, 150, 120, 255), width=1.8)
    over(hero, caps)
    # soffit shadow just under the fascia
    sof = new()
    Pen(sof).poly(C.poly([(-O, EAVE, -O), (L + O, EAVE, -O), (L, EAVE - 0.35, 0), (0, EAVE - 0.35, 0)]), fill=(112, 84, 66, 255))
    Pen(sof).poly(C.poly([(L + O, EAVE, -O), (L + O, EAVE, D + O), (L, EAVE - 0.35, D), (L, EAVE - 0.35, 0)]), fill=(92, 72, 64, 255))
    for k in range(1, 16):
        zz = -O + (D + 2 * O) * k / 16
        Pen(sof).line([C(L + O, EAVE, zz), C(L, EAVE - 0.35, zz)], fill=(70, 54, 48, 255), width=1)
    over(hero, sof)

    # contact shade where the building meets the paving, then a warm wash of late sun from the left
    cs = new()
    Pen(cs).poly(C.poly([(-1, 0, AZ - 0.1), (L + 1, 0, AZ - 0.1), (L + 6, 0, AZ - 2.5), (-1, 0, AZ - 2.5)]), fill=(40, 28, 22, 110))
    over(hero, blur(cs, 3))
    stone_all = Image.fromarray(np.maximum(np.asarray(stone_m), np.asarray(roof_m)), "L")
    warm = rgrad((40, 240), 820, [(0, (255, 186, 110, 110)), (1, (255, 186, 110, 0))])
    add(hero, clip_to(warm, stone_all), 0.7)
    # a lit edge where the sunlit front turns the corner into shade
    edge = new()
    Pen(edge).line([C(L, AR, 0), C(L, EAVE, 0)], fill=(255, 236, 206, 210), width=1.4)
    Pen(edge).line([C(L, 0, AZ), C(L, AH, AZ)], fill=(255, 236, 206, 210), width=1.4)
    over(hero, edge)
    return finish(hero)


# ---------------------------------------------------------------------------------------------------------------
# 2 - The web in toy blocks: the 1996 storage server in its lobby vitrine

TOY = [(214, 48, 40), (246, 192, 30), (30, 104, 200), (40, 150, 76)]


def dim_fn(ox, oy, s, ax=14.0, ay=48.0, ky=0.62):
    """Dimetric projection: x runs gently down-right (the broad front face), y recedes steeply down-left, z is up.
    Same call shape as iso_fn, so iso_box works with it."""
    cxa, sxa = math.cos(math.radians(ax)), math.sin(math.radians(ax))
    cya, sya = math.cos(math.radians(ay)) * ky, math.sin(math.radians(ay)) * ky

    def I(x, y, z=0.0):
        return (ox + (x * cxa - y * cya) * s, oy + (x * sxa + y * sya) * s - z * s)
    return I


def fit_iso(pts, rect, proj=iso_fn):
    """A projection scaled and placed so the projected 3D points fill rect (x0, y0, x1, y1)."""
    I1 = proj(0, 0, 1)
    q = [I1(*p) for p in pts]
    x0, x1 = min(a for a, _ in q), max(a for a, _ in q)
    y0, y1 = min(b for _, b in q), max(b for _, b in q)
    k = min((rect[2] - rect[0]) / (x1 - x0), (rect[3] - rect[1]) / (y1 - y0))
    ox = (rect[0] + rect[2]) / 2 - k * (x0 + x1) / 2
    oy = (rect[1] + rect[3]) / 2 - k * (y0 + y1) / 2
    return proj(ox, oy, k), k


def brick(lay, I, x, y, z, dx, dy, dz, color, studs=True, alpha=255, lit=1.0):
    """An oversized toy block (Duplo-scale: tall, chunky studs) as an iso box with soft edge highlights.
    A translucent block (alpha < 255) is drawn on its own layer and composited, so it tints what is behind it."""
    if alpha < 255:
        tmp = new()
        brick(tmp, I, x, y, z, dx, dy, dz, color, studs, 255, lit)
        a = np.asarray(tmp, np.float32).copy()
        a[..., 3] *= alpha / 255.0
        lay.alpha_composite(Image.fromarray(a.astype(np.uint8), "RGBA"))
        return
    c = tone(color, lit)
    iso_box(lay, I, x, y, z, dx, dy, dz, c, alpha=alpha, edge=tone(c, 1.35) + (int(alpha * 0.8),),
            top_k=1.12, left_k=0.95, right_k=0.66)
    p = Pen(lay)
    p.line([I(x, y + dy, z), I(x + dx, y + dy, z), I(x + dx, y, z)], fill=tone(c, 0.55) + (alpha,), width=1.0)
    if not studs:
        return
    R, HG = 0.34, 0.3
    ring = [(R * math.cos(2 * math.pi * k / 20), R * math.sin(2 * math.pi * k / 20)) for k in range(20)]
    for i in range(int(round(dx))):
        for j in range(int(round(dy))):
            ux, uy, zt = x + i + 0.5, y + j + 0.5, z + dz
            bot = [I(ux + a, uy + b, zt) for a, b in ring]
            topr = [I(ux + a, uy + b, zt + HG) for a, b in ring]
            p.poly(hull(bot + topr), fill=tone(c, 0.78) + (alpha,))
            p.poly(topr, fill=tone(c, 1.18) + (alpha,))
            p.line(topr[11:16], fill=(255, 255, 255, int(alpha * 0.5)), width=1.1)


def scene2(th):
    hero = new()
    rng = random.Random(1996)
    over(hero, vgrad(BOX[1], BOX[3], [(0, (18, 28, 40)), (1, (24, 34, 48))]))
    # museum spot from above: a soft warm cone
    cone = new()

    BW, BD = 11, 10             # cabinet footprint in studs (x wide, y deep)
    C1 = 1.2                    # one block course
    NDRV = 10                   # ten 4 GB drives, stacked
    TOPZ = 17 * C1              # top of the drive bay
    PITCH = (TOPZ - C1) / NDRV
    gx0, gy0, gx1, gy1, gz1 = -2.0, -2.0, BW + 2.0, BD + 2.0, TOPZ + 2 * C1 + 2.6
    px0, py0, px1, py1 = gx0 - 1.0, gy0 - 1.0, gx1 + 1.0, gy1 + 1.0
    I, s = fit_iso([(gx0, gy0, gz1), (gx1, gy0, gz1), (gx0, gy1, gz1), (px0, py1, -3.5), (px1, py1, -3.5), (px1, py0, -3.5)],
                   (110, 92, 806, 660), proj=dim_fn)

    # plinth: pale stone, lit top, running off the bottom of the picture
    cone = new()
    ctop, cbot = I(BW / 2, BD / 2, gz1 + 40), I(BW / 2, BD / 2, 0)
    Pen(cone).poly([(ctop[0] - 40, BOX[1]), (ctop[0] + 40, BOX[1]), (cbot[0] + 260, cbot[1]), (cbot[0] - 260, cbot[1])], fill=(255, 226, 180, 30))
    over(hero, blur(cone, 30))
    pl = new()
    iso_box(pl, I, px0, py0, -16, px1 - px0, py1 - py0, 16, (214, 204, 190), top_k=1.08, left_k=0.86, right_k=0.62)
    pl = shade(pl, 0.96 + 0.06 * noise(77, 3, 1))
    over(hero, pl)
    pool = rgrad(I(BW / 2, BD / 2, 0), 230, [(0, (255, 236, 200, 90)), (1, (255, 236, 200, 0))], sy=0.55)
    top_m = poly_mask([I(px0, py0), I(px1, py0), I(px1, py1), I(px0, py1)])
    add(hero, clip_to(pool, top_m), 0.8)
    # blank copper placard on the plinth face
    plq = new()
    pq = Pen(plq)
    a, b = 1.2, 6.8
    pq.poly([I(a, py1, -1.0), I(b, py1, -1.0), I(b, py1, -3.6), I(a, py1, -3.6)], fill=COPPER + (255,))
    pq.line([I(a, py1, -1.0), I(b, py1, -1.0)], fill=COPPER_HI + (255,), width=1.4)
    pq.line([I(a, py1, -3.6), I(b, py1, -3.6)], fill=tone(COPPER, 0.6) + (255,), width=1.2)
    over(hero, plq)

    # vitrine back panes (behind the cabinet)
    glass = new()
    pgl = Pen(glass)
    pgl.poly([I(gx0, gy0, 0), I(gx1, gy0, 0), I(gx1, gy0, gz1), I(gx0, gy0, gz1)], fill=(200, 220, 236, 16))
    pgl.poly([I(gx0, gy0, 0), I(gx0, gy1, 0), I(gx0, gy1, gz1), I(gx0, gy0, gz1)], fill=(200, 220, 236, 22))
    pgl.line([I(gx0, gy1, 0), I(gx0, gy0, 0), I(gx1, gy0, 0)], fill=(220, 232, 244, 70), width=1.0)
    pgl.line([I(gx0, gy0, 0), I(gx0, gy0, gz1)], fill=(220, 232, 244, 80), width=1.0)
    over(hero, glass)

    cs = new()
    Pen(cs).poly([I(-0.6, -0.6), I(BW + 0.8, -0.6), I(BW + 0.8, BD + 0.8), I(-0.6, BD + 0.8)], fill=(60, 50, 44, 150))
    over(hero, blur(cs, 5))

    cab = new()

    def col():
        return TOY[rng.randrange(4)]

    def course(z, x0, x1, y0, y1, studs=False, seed_off=0, along="y", clear=0.0):
        """One course of 2-wide blocks over a rectangle, joints staggered by course parity."""
        k = int(round(z / C1)) + seed_off
        lo, hi = (y0, y1) if along == "y" else (x0, x1)
        spans, t = [], lo - (2 if k % 2 else 0)
        while t < hi:
            spans.append((max(t, lo), min(t + 4, hi)))
            t += 4
        for (a_, b_) in spans:
            if along == "y":
                xx = x0
                while xx < x1:
                    w = min(2, x1 - xx)
                    tr = rng.random() < clear
                    brick(cab, I, xx, a_, z, w, b_ - a_, C1, (226, 236, 246) if tr else col(), studs=studs, alpha=150 if tr else 255)
                    xx += w
            else:
                yy = y0
                while yy < y1:
                    h = min(2, y1 - yy)
                    tr = rng.random() < clear
                    brick(cab, I, a_, yy, z, b_ - a_, h, C1, (226, 236, 246) if tr else col(), studs=studs, alpha=150 if tr else 255)
                    yy += h

    course(0, 0, BW, 0, BD, along="x")
    for k in range(1, int(round(TOPZ / C1))):
        z = k * C1
        course(z, 2, BW - 2, 0, 1, along="x", clear=0.12)
        course(z, 0, 2, 0, BD)
    # the drives: bare 3.5-inch drives on block ledges, end-on to the viewer
    for d in range(NDRV):
        z = C1 + d * PITCH + 0.3
        x0, x1 = 2.25, BW - 2.25
        y0, y1 = 1.0, BD - 0.4
        iso_box(cab, I, x0, y0, z, x1 - x0, y1 - y0, 1.3, (176, 182, 190), edge=(240, 244, 250, 230),
                top_k=0.74, left_k=1.12, right_k=0.6)
        # shadow the drive above throws on this lid
        p = Pen(cab)
        p.poly([I(x0, y0, z + 1.3), I(x1, y0, z + 1.3), I(x1, y1 - 1.6, z + 1.3), I(x0, y1 - 1.6, z + 1.3)], fill=(92, 98, 108, 255))
        p = Pen(cab)
        p.poly([I(x0, y1, z), I(x1, y1, z), I(x1, y1, z + 0.24), I(x0, y1, z + 0.24)], fill=(46, 120, 70, 255))
        p.line([I(x0, y1, z + 1.05), I(x1, y1, z + 1.05)], fill=(120, 126, 134, 255), width=1.0)
        for (sx, sy) in ((x0 + 0.5, y0 + 0.6), (x1 - 0.5, y0 + 0.6), (x0 + 0.5, y1 - 0.6), (x1 - 0.5, y1 - 0.6)):
            p.circle(I(sx, sy, z + 1.3), 1.6, fill=(132, 138, 146, 255))
        rx = x0 + 1.2 + (d % 3) * 0.9
        p.poly([I(rx, y0 - 0.02, z + 1.3), I(rx + 1.6, y0 - 0.02, z + 1.3), I(rx + 1.6, y0 + 1.2, z + 1.31), I(rx, y0 + 1.2, z + 1.31)],
               fill=(196, 198, 202, 255))
        for q in range(1, 6):
            xq = rx + q * 1.6 / 6
            p.line([I(xq, y0 - 0.02, z + 1.3), I(xq, y0 + 1.2, z + 1.31)], fill=(160, 162, 168, 255), width=0.8)
    for k in range(1, int(round(TOPZ / C1))):
        course(k * C1, BW - 2, BW, 0, BD, seed_off=1)
    course(TOPZ, 0, BW, 0, BD, studs=False, along="x")
    course(TOPZ + C1, 0, BW, 0, BD, studs=True, seed_off=1, along="x", clear=0.08)
    # packing tape over the top course and down the right pillar; a sheet of translucent plastic on that side
    over(hero, cab)
    cab_a = cab.getchannel("A")
    film = new()
    tp = Pen(film)
    tz0, tz1 = TOPZ - 1.6, TOPZ + 2 * C1 + 0.02
    tp.poly([I(BW + 0.02, 6.6, tz0), I(BW + 0.02, 7.6, tz0), I(BW + 0.02, 7.6, tz1), I(BW + 0.02, 6.6, tz1)], fill=(226, 200, 146, 130))
    tp.poly([I(6.6 - 4, BD + 0.02, tz0), I(7.6 - 4, BD + 0.02, tz0), I(7.6 - 4, BD + 0.02, tz1), I(6.6 - 4, BD + 0.02, tz1)], fill=(226, 200, 146, 110))
    tp.poly([I(BW + 0.04, 1.4, 3.0), I(BW + 0.04, 4.8, 3.0), I(BW + 0.04, 4.8, 9.6), I(BW + 0.04, 1.4, 9.6)], fill=(236, 242, 250, 46))
    tp.line([I(BW + 0.04, 1.4, 9.6), I(BW + 0.04, 4.8, 9.6), I(BW + 0.04, 4.8, 3.0)], fill=(245, 250, 255, 110), width=1.0)
    over(hero, film)
    key = vgrad(I(0, 0, TOPZ + 3)[1], I(BW, BD, 0)[1], [(0, (255, 244, 224, 90)), (1, (255, 244, 224, 0))])
    add(hero, clip_to(key, cab_a), 0.6)

    # vitrine front panes: faint glass, a diagonal reflection, crisp edges
    fg = new()
    pf = Pen(fg)
    front = [I(gx0, gy1, 0), I(gx1, gy1, 0), I(gx1, gy1, gz1), I(gx0, gy1, gz1)]
    rside = [I(gx1, gy0, 0), I(gx1, gy1, 0), I(gx1, gy1, gz1), I(gx1, gy0, gz1)]
    top = [I(gx0, gy0, gz1), I(gx1, gy0, gz1), I(gx1, gy1, gz1), I(gx0, gy1, gz1)]
    pf.poly(front, fill=(210, 226, 240, 18))
    pf.poly(rside, fill=(210, 226, 240, 26))
    pf.poly(top, fill=(220, 232, 244, 30))
    over(hero, fg)
    refl = new()
    pr = Pen(refl)
    for (u0, w) in ((0.12, 0.10), (0.27, 0.04)):
        a0, a1 = gx0 + (gx1 - gx0) * u0, gx0 + (gx1 - gx0) * (u0 + w)
        pr.poly([I(a0, gy1, gz1), I(a1, gy1, gz1), I(a1 + 6, gy1, 0), I(a0 + 6, gy1, 0)], fill=(255, 255, 255, 26))
    over(hero, clip_to(refl, poly_mask(front)))
    ed = new()
    pe = Pen(ed)
    pe.line([I(gx0, gy1, 0), I(gx1, gy1, 0), I(gx1, gy0, 0)], fill=(236, 244, 252, 150), width=1.2)
    pe.line([I(gx0, gy1, 0), I(gx0, gy1, gz1)], fill=(236, 244, 252, 150), width=1.2)
    pe.line([I(gx1, gy1, 0), I(gx1, gy1, gz1)], fill=(250, 252, 255, 200), width=1.4)
    pe.line([I(gx1, gy0, 0), I(gx1, gy0, gz1)], fill=(236, 244, 252, 120), width=1.0)
    pe.line(top + [top[0]], fill=(240, 246, 252, 150), width=1.2)
    over(hero, ed)
    return finish(hero)


def figures(p, P, KD, spots, col=(118, 96, 84)):
    """Simple standing people for scale: (x, floor y, depth t) in section-perspective coordinates."""
    for i, (x, y, t) in enumerate(spots):
        fx, fy = P(x, y, t)
        k = 1 - KD * t
        h = 40 * k
        c = tone(col, 0.9 + 0.1 * (i % 2))
        p.rrect((fx - h * 0.13, fy - h * 0.82, fx + h * 0.13, fy - h * 0.38), h * 0.1, fill=c + (255,))
        p.rect((fx - h * 0.1, fy - h * 0.45, fx - h * 0.01, fy), fill=c + (255,))
        p.rect((fx + h * 0.01, fy - h * 0.45, fx + h * 0.1, fy), fill=c + (255,))
        p.circle((fx, fy - h * 0.92), h * 0.1, fill=c + (255,))


# ---------------------------------------------------------------------------------------------------------------
# 1 - A hub for what comes next: section perspective through the building

def scene1(th):
    hero = new()
    VX, VY = 470.0, 300.0
    KD = 0.36                        # how far the back wall shrinks toward the vanishing point

    def P(x, y, t):
        k = 1 - KD * t
        return (VX + (x - VX) * k, VY + (y - VY) * k)

    def plane(pts):
        return [P(*q) for q in pts]

    X0, X1 = 76, 840                 # outer faces of the section (X1 = outer edge of the arcade)
    XW = X1 - 70                     # exterior wall; the applied arcade stands in front of it
    RX = (X0 + XW) / 2               # roof ridge over the wall line
    WALL, SLAB = 12, 12
    RIDGE, EAVE = 70, 112
    F3 = (EAVE + 4, 206)             # third floor (offices, unlabelled)
    F2 = (F3[1] + SLAB, 346)         # second floor: library + dean's office
    F1 = (F2[1] + SLAB, 452)         # ground floor
    GRADE = F1[1]
    FT = (F1[1] + SLAB, 640)         # terrace level: the NVIDIA Auditorium

    sky(hero, GRADE, warm=(40, 40, 50))
    # earth below grade, cut: warm ground with a faint section hatch
    earth = new()
    pe_ = Pen(earth)
    pe_.rect((BOX[0], GRADE, BOX[2], BOX[3]), fill=(92, 72, 58, 255))
    for k in range(-40, 80):
        x = BOX[0] + k * 16
        pe_.line([(x, GRADE), (x + 260, GRADE + 260)], fill=(118, 94, 76, 120), width=1)
    ea = np.asarray(earth, np.float32).copy()
    ea[..., 3] *= np.clip(1 - (_YY - GRADE) / 260, 0.25, 1)
    over(hero, Image.fromarray(ea.astype(np.uint8), "RGBA"))
    grade = new()
    Pen(grade).line([(BOX[0], GRADE), (BOX[2], GRADE)], fill=(200, 176, 140, 200), width=2)
    over(hero, grade)

    def room(box, wall=(196, 172, 140), floor=(170, 136, 100), ceil=(150, 130, 112), back=(214, 192, 158)):
        x0, y0, x1, y1 = box
        lay = new()
        p = Pen(lay)
        p.poly(plane([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)]), fill=tone(wall, 0.9) + (255,))
        p.poly(plane([(x0, y1, 0), (x1, y1, 0), (x1, y1, 1), (x0, y1, 1)]), fill=floor + (255,))
        p.poly(plane([(x0, y0, 0), (x1, y0, 0), (x1, y0, 1), (x0, y0, 1)]), fill=ceil + (255,))
        p.poly(plane([(x0, y0, 0), (x0, y1, 0), (x0, y1, 1), (x0, y0, 1)]), fill=wall + (255,))
        p.poly(plane([(x1, y0, 0), (x1, y1, 0), (x1, y1, 1), (x1, y0, 1)]), fill=tone(wall, 0.86) + (255,))
        p.poly(plane([(x0, y0, 1), (x1, y0, 1), (x1, y1, 1), (x0, y1, 1)]), fill=back + (255,))
        return lay

    def clip_box(lay, box):
        m = mask()
        Pen(m).rect(box, fill=255)
        return clip_to(lay, m)

    def window_back(p, x0, x1, y0, y1, n, glass=(150, 170, 186)):
        """Windows in the back wall (t=1), mullioned."""
        w = (x1 - x0) / n
        for i in range(n):
            a, b = x0 + i * w + w * 0.18, x0 + (i + 1) * w - w * 0.18
            p.poly(plane([(a, y0, 1), (b, y0, 1), (b, y1, 1), (a, y1, 1)]), fill=glass + (255,))
            p.line([P((a + b) / 2, y0, 1), P((a + b) / 2, y1, 1)], fill=(120, 110, 100, 255), width=1)

    # --- third floor: offices (context only)
    r3 = (X0 + WALL, F3[0], XW - WALL, F3[1])
    lay = room(r3, wall=(170, 152, 132), floor=(150, 124, 98), ceil=(132, 116, 102), back=(184, 166, 140))
    p = Pen(lay)
    window_back(p, r3[0] + 20, r3[2] - 20, F3[0] + 22, F3[1] - 26, 9, glass=(118, 134, 150))
    for i in range(5):
        a = r3[0] + 60 + i * 150
        p.poly(plane([(a, F3[1] - 30, 0.5), (a + 70, F3[1] - 30, 0.5), (a + 70, F3[1] - 30, 0.75), (a, F3[1] - 30, 0.75)]), fill=(160, 124, 92, 255))
        p.poly(plane([(a, F3[1] - 30, 0.5), (a + 70, F3[1] - 30, 0.5), (a + 70, F3[1], 0.5), (a, F3[1], 0.5)]), fill=(124, 96, 76, 255))
    lay = shade(lay, np.full((H * SS, W * SS), 0.82, np.float32))
    over(hero, clip_box(lay, r3))

    # --- second floor: Terman Engineering Library (left) and the dean's office (right)
    split = 560
    rl = (X0 + WALL, F2[0], split - WALL / 2, F2[1])
    rd = (split + WALL / 2, F2[0], XW - WALL, F2[1])
    lay = room(rl, wall=(214, 190, 156), floor=(178, 140, 100), ceil=(196, 180, 160), back=(226, 206, 172))
    p = Pen(lay)
    window_back(p, rl[0] + 30, rl[2] - 30, F2[0] + 22, F2[0] + 62, 5, glass=(176, 192, 204))
    # stacks: shelf ranges perpendicular to the cut, ends toward us, receding
    rng = random.Random(11)
    spines = [(176, 70, 54), (64, 92, 132), (196, 152, 80), (78, 120, 90), (220, 206, 180), (120, 70, 60), (150, 150, 160)]
    ranges = [rl[0] + 28 + i * 58 for i in range(7)]
    for xr in sorted(ranges, key=lambda v: -abs(v - VX)):
        top = F2[1] - 92
        t0, t1 = 0.12, 0.92
        # side of the range facing the vanishing point: the books
        side_x = xr + 22 if xr < VX else xr
        face = plane([(side_x, top, t0), (side_x, F2[1], t0), (side_x, F2[1], t1), (side_x, top, t1)])
        p.poly(face, fill=(140, 104, 74, 255))
        for sh in range(5):
            ya, yb = top + sh * 18 + 3, top + sh * 18 + 16
            t = t0
            while t < t1 - 0.02:
                dt = rng.uniform(0.012, 0.026)
                c = rng.choice(spines)
                p.poly(plane([(side_x, yb - rng.uniform(9, 13), t), (side_x, yb, t), (side_x, yb, t + dt), (side_x, yb - 11, t + dt)]), fill=c + (255,))
                t += dt + 0.003
            p.line([P(side_x, yb + 1, t0), P(side_x, yb + 1, t1)], fill=(110, 80, 58, 255), width=1.2)
        # the end panel of the range, at the front
        p.poly(plane([(xr, top, t0), (xr + 22, top, t0), (xr + 22, F2[1], t0), (xr, F2[1], t0)]), fill=(196, 160, 116, 255))
        p.line([P(xr, top, t0), P(xr + 22, top, t0)], fill=(236, 210, 170, 255), width=1.4)
    figures(p, P, KD, [(rl[0] + 440, F2[1], 0.3)])
    over(hero, clip_box(lay, rl))

    lay = room(rd, wall=(220, 196, 162), floor=(160, 116, 80), ceil=(198, 182, 162), back=(230, 210, 178))
    p = Pen(lay)
    # tall window in the back wall with daylight falling onto the floor
    wa, wb = rd[0] + 70, rd[2] - 70
    p.poly(plane([(wa, F2[0] + 20, 1), (wb, F2[0] + 20, 1), (wb, F2[1] - 24, 1), (wa, F2[1] - 24, 1)]), fill=(196, 208, 214, 255))
    for k in (1, 2):
        xx = wa + (wb - wa) * k / 3
        p.line([P(xx, F2[0] + 20, 1), P(xx, F2[1] - 24, 1)], fill=(140, 126, 110, 255), width=1.2)
    p.poly(plane([(wa, F2[1], 0.95), (wb, F2[1], 0.95), (wb + 30, F2[1], 0.45), (wa + 30, F2[1], 0.45)]), fill=(214, 172, 120, 255))
    # desk (wood top, modesty panel), chair, low bookcase on the side wall
    dx0, dx1, dyt = rd[0] + 70, rd[2] - 90, F2[1] - 40
    p.poly(plane([(dx0, dyt, 0.35), (dx1, dyt, 0.35), (dx1, dyt, 0.6), (dx0, dyt, 0.6)]), fill=(176, 118, 74, 255))
    p.poly(plane([(dx0, dyt, 0.35), (dx1, dyt, 0.35), (dx1, F2[1], 0.35), (dx0, F2[1], 0.35)]), fill=(132, 86, 56, 255))
    p.line([P(dx0, dyt, 0.35), P(dx1, dyt, 0.35)], fill=(226, 172, 120, 255), width=1.6)
    cxm = (dx0 + dx1) / 2
    p.poly(plane([(cxm - 18, dyt - 30, 0.7), (cxm + 18, dyt - 30, 0.7), (cxm + 18, dyt + 6, 0.7), (cxm - 18, dyt + 6, 0.7)]), fill=(96, 78, 70, 255))
    bx = rd[2]
    p.poly(plane([(bx, F2[1] - 56, 0.1), (bx, F2[1], 0.1), (bx, F2[1], 0.55), (bx, F2[1] - 56, 0.55)]), fill=(150, 104, 70, 255))
    for k in range(3):
        y = F2[1] - 50 + k * 17
        t = 0.12
        while t < 0.53:
            dt = rng.uniform(0.012, 0.022)
            p.poly(plane([(bx, y + 4, t), (bx, y + 15, t), (bx, y + 15, t + dt), (bx, y + 5, t + dt)]), fill=rng.choice(spines) + (255,))
            t += dt + 0.004
    over(hero, clip_box(lay, rd))

    # --- ground floor: lobby open to the arcade on the right
    r1 = (X0 + WALL, F1[0], XW - WALL, F1[1])
    lay = room(r1, wall=(206, 184, 152), floor=(196, 178, 150), ceil=(170, 150, 128), back=(220, 200, 168))
    p = Pen(lay)
    for i in range(6):
        a = r1[0] + 40 + i * 110
        p.poly(plane([(a, F1[0] + 18, 1), (a + 60, F1[0] + 18, 1), (a + 60, F1[1], 1), (a, F1[1], 1)]), fill=(168, 184, 196, 255))
    figures(p, P, KD, [(r1[0] + 120, F1[1], 0.5), (r1[0] + 150, F1[1], 0.62), (r1[0] + 380, F1[1], 0.3), (r1[0] + 560, F1[1], 0.75)])
    over(hero, clip_box(lay, r1))

    # --- terrace level: the raked 300-seat NVIDIA Auditorium, stage at left, rows climbing to the right
    ra = (X0 + WALL, FT[0], 690, FT[1])
    lay = room(ra, wall=(150, 122, 106), floor=(120, 92, 76), ceil=(170, 150, 134), back=(160, 132, 114))
    p = Pen(lay)
    # projection screen on the stage-end wall, the room's brightest surface
    p.poly(plane([(ra[0], FT[0] + 30, 0.18), (ra[0], FT[1] - 70, 0.18), (ra[0], FT[1] - 70, 0.85), (ra[0], FT[0] + 30, 0.85)]), fill=(222, 206, 178, 255))
    # stage
    st_x = ra[0] + 96
    st_y = FT[1] - 18
    p.poly(plane([(ra[0], st_y, 0), (st_x, st_y, 0), (st_x, st_y, 1), (ra[0], st_y, 1)]), fill=(184, 140, 96, 255))
    p.poly(plane([(ra[0], st_y, 0), (st_x, st_y, 0), (st_x, FT[1], 0), (ra[0], FT[1], 0)]), fill=(120, 84, 60, 255))
    # tiers: each tread recedes, each riser faces the stage; seat backs in rows
    n_t = 11
    tw = (ra[2] - st_x - 20) / n_t
    rise = 9.5
    rows = []
    for i in range(n_t):
        xa = st_x + 20 + i * tw
        y = FT[1] - i * rise
        rows.append((xa, y))
    for i, (xa, y) in reversed(list(enumerate(rows))):
        xb = xa + tw
        p.poly(plane([(xa, y - rise, 0), (xb, y - rise, 0), (xb, y - rise, 1), (xa, y - rise, 1)]), fill=(150, 112, 86, 255))
        p.poly(plane([(xa, y - rise, 0), (xb, y - rise, 0), (xb, FT[1], 0), (xa, FT[1], 0)]), fill=(128, 96, 76, 255))
    for i, (xa, y) in enumerate(rows):
        # a row of seats along the tread, receding; backs face the stage (lit edge on top)
        t = 0.04
        while t < 0.97:
            sx = xa + tw * 0.55
            sy = y - rise
            p.poly(plane([(sx - 8, sy - 17, t), (sx + 4, sy - 17, t), (sx + 4, sy, t), (sx - 8, sy, t)]), fill=(170, 86, 62, 255))
            p.poly(plane([(sx - 8, sy - 17, t), (sx + 4, sy - 17, t), (sx + 4, sy - 13, t), (sx - 8, sy - 13, t)]), fill=(222, 140, 102, 255))
            t += 0.05
    over(hero, clip_box(lay, ra))
    # light from the screen washing the hall
    sl = rgrad(P(ra[0], (FT[0] + FT[1]) / 2 - 20, 0.5), 300, [(0, (255, 240, 214, 80)), (1, (255, 240, 214, 0))], sy=0.6)
    am = mask()
    Pen(am).rect(ra, fill=255)
    add(hero, clip_to(sl, am), 0.5)
    # lobby / stair beside the hall
    rs = (700, FT[0], XW - WALL, FT[1])
    lay = room(rs, wall=(176, 154, 128), floor=(166, 144, 116), ceil=(150, 132, 114), back=(188, 168, 140))
    p = Pen(lay)
    for k in range(10):
        x = rs[0] + 4 + k * 5.6
        y = FT[1] - k * 15
        p.poly(plane([(x, y - 15, 0.2), (x + 5.6, y - 15, 0.2), (x + 5.6, y - 15, 0.8), (x, y - 15, 0.8)]), fill=(204, 184, 152, 255))
        p.poly(plane([(x, y - 15, 0.2), (x, y, 0.2), (x, y, 0.8), (x, y - 15, 0.8)]), fill=(150, 128, 104, 255))
    over(hero, clip_box(lay, rs))

    # --- the cut: walls and slabs as pale sandstone poche, the arcade on the right, the tile roof
    cut = mask()
    pc = Pen(cut)
    for (ya, yb) in ((EAVE - 4, F3[0]), (F3[1], F2[0]), (F2[1], F1[0]), (F1[1], FT[0]), (FT[1], FT[1] + SLAB)):
        pc.rect((X0, ya, XW, yb), fill=255)
    pc.rect((X0, EAVE - 4, X0 + WALL, FT[1] + SLAB), fill=255)
    pc.rect((XW - WALL, EAVE - 4, XW, FT[1] + SLAB), fill=255)
    pc.rect((split - WALL / 2, F2[0], split + WALL / 2, F2[1]), fill=255)
    pc.rect((690, FT[0], 700, FT[1]), fill=255)
    AH = F1[0] + 20                                               # top of the arcade, a little under the second floor
    pc.rect((XW, AH, X1, AH + 16), fill=255)                      # arcade head, cut
    pc.rect((XW, F1[1], X1, F1[1] + 6), fill=255)                 # arcade walk on grade
    over(hero, fill(cut, (236, 214, 178, 255)))
    # the applied arcade beyond the cut: the walk, the next pier and its flat arch
    ra_ = (XW, AH + 16, X1, F1[1])
    lay = room(ra_, wall=(214, 190, 156), floor=(190, 170, 142), ceil=(170, 146, 120), back=(226, 204, 168))
    p = Pen(lay)
    arch = seg_arch((XW + X1) / 2, (X1 - XW) / 2, AH + 44, 10)
    p.poly([P(x, y, 1) for x, y in [(XW, AH + 16), (X1, AH + 16)] + list(reversed(arch))], fill=(236, 214, 178, 255))
    over(hero, clip_box(lay, ra_))
    # roof: clay tile over the attic, in section, and the arcade's own tile shed against the wall
    roof = new()
    pr = Pen(roof)
    pr.poly([(XW, AH - 14), (X1 + 12, AH - 2), (X1 + 12, AH + 4), (XW, AH - 8)], fill=TILE + (255,))
    pr.line([(XW, AH - 14), (X1 + 12, AH - 2)], fill=tone(TILE, 1.3) + (255,), width=1.6)
    pr.poly([(XW, AH - 8), (X1 + 12, AH + 4), (X1, AH + 4), (X1, AH), (XW, AH)], fill=(206, 182, 150, 255))
    pr.poly([(X0 - 30, EAVE), (RX, RIDGE), (XW + 30, EAVE), (XW + 30, EAVE + 6), (RX, RIDGE + 8), (X0 - 30, EAVE + 6)], fill=TILE + (255,))
    pr.poly([(X0, EAVE - 4), (RX, RIDGE + 8), (XW, EAVE - 4)], fill=(112, 92, 82, 255))
    pr.line([(X0 - 30, EAVE), (RX, RIDGE), (XW + 30, EAVE)], fill=tone(TILE, 1.3) + (255,), width=2)
    over(hero, roof)
    edge = new()
    Pen(edge).line([(X0, FT[1] + SLAB), (X0, EAVE)], fill=(250, 232, 200, 160), width=1.2)
    over(hero, edge)

    # labels: the copy's own names, small Georgia caps in copper, set on the slab above each room
    lf = font(("georgia.ttf", None), 17)
    lab = new()
    pl = Pen(lab)
    for s_, (x, y) in (("TERMAN LIBRARY", (rl[0] + 18, F2[0] + 18)), ("DEAN'S OFFICE", (rd[0] + 18, F2[0] + 18)),
                       ("NVIDIA AUDITORIUM", (ra[0] + 250, FT[0] + 18))):
        w_ = text_width(s_, lf, 1.6)
        pl.rect((x - 10, y - 15, x + w_ + 10, y + 15), fill=NAVY + (232,))
        pl.line([(x - 10, y + 15), (x + w_ + 10, y + 15)], fill=COPPER + (255,), width=1.4)
        text(lab, (x, y), s_, lf, COPPER_HI + (255,), tracking=1.6, anchor="lm")
    over(hero, lab)
    return finish(hero)


# ---------------------------------------------------------------------------------------------------------------
# 3 - A quieter kind of power: aerial of the roofs on the east-west axis

def scene3(th):
    hero = new()
    over(hero, vgrad(BOX[1], BOX[3], [(0, (16, 26, 38)), (1, (22, 32, 46))]))
    L, D, EAVE, RIDGE = 60.0, 24.0, 13.0, 18.5
    O = 1.2
    I, s = fit_iso([(-16, -4, 0), (L + 16, -4, 0), (-16, D + 14, 0), (L + 16, D + 14, 0), (L / 2, D / 2, RIDGE + 2)],
                   (40, 92, 876, 660), proj=lambda ox, oy, k: dim_fn(ox, oy, k, ax=16, ay=44, ky=0.78))

    def Q(pts):
        return [I(*p) for p in pts]

    # pale courtyard tiles around the building, fading out at the edges of the picture
    gr = new()
    pg = Pen(gr)
    G = (-60, -40, int(L) + 60, int(D) + 50)
    pg.poly(Q([(G[0], G[1], 0), (G[2], G[1], 0), (G[2], G[3], 0), (G[0], G[3], 0)]), fill=(214, 204, 186, 255))
    for x in range(G[0], G[2] + 1, 2):
        pg.line([I(x, G[1]), I(x, G[3])], fill=(190, 180, 164, 255), width=0.7)
    for y in range(G[1], G[3] + 1, 2):
        pg.line([I(G[0], y), I(G[2], y)], fill=(190, 180, 164, 255), width=0.7)
    disc = mask()
    Pen(disc).poly([I(L / 2 + 52 * math.cos(a), D / 2 + 3 + 34 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 64)], fill=255)
    fade = np.asarray(blur(disc, 46), np.float32) / 255.0
    ga = np.asarray(gr, np.float32).copy()
    ga[..., 3] *= fade * 0.85
    over(hero, Image.fromarray(ga.astype(np.uint8), "RGBA"))

    # the east-west axis of the engineering quad: a copper hairline on the paving, through the building
    ax = new()
    pa = Pen(ax)
    ya = D / 2
    for x0 in np.arange(-20, L + 20, 2.4):
        if -1 < x0 < L + 1:
            continue
        pa.line([I(x0, ya), I(x0 + 1.5, ya)], fill=COPPER_HI + (230,), width=1.6)
    lf = font(("georgia.ttf", None), 18)
    wx, wy = I(-21, ya)
    ex, ey = I(L + 21, ya)
    text(ax, (wx - 10, wy), "W", lf, COPPER_HI + (255,), anchor="rm")
    text(ax, (ex + 10, ey), "E", lf, COPPER_HI + (255,), anchor="lm")
    over(hero, ax)

    # building shadow: the sun stands high in the south-west, so it falls short to the north-east
    sh = new()
    sx, sy = 5.0, -4.0
    Pen(sh).poly(Q([(L, D, 0), (L + sx, D + sy, 0), (L + sx, sy, 0), (sx, sy, 0), (0, 0, 0), (L, 0, 0)]), fill=(70, 62, 58, 150))
    over(hero, blur(sh, 2))

    # walls: south face lit, east face in shade; arcade along the south at ground level
    wl = new()
    pw = Pen(wl)
    pw.poly(Q([(0, D, 0), (L, D, 0), (L, D, EAVE), (0, D, EAVE)]), fill=STONE + (255,))
    pw.poly(Q([(L, 0, 0), (L, D, 0), (L, D, EAVE), (L, 0, EAVE)]), fill=(170, 146, 124, 255))
    wl = shade(wl, 0.97 + 0.05 * noise(91, 2, 1))
    over(hero, wl)
    det = new()
    pd = Pen(det)
    n = 17
    pitch = L / n
    for j, (z0, z1) in enumerate(((7.0, 8.8), (9.8, 11.6))):
        for i in range(n):
            if j == 0 and i in (5, 6):
                continue
            a, b = i * pitch + pitch * 0.3, (i + 1) * pitch - pitch * 0.3
            pd.poly(Q([(a, D, z0), (b, D, z0), (b, D, z1), (a, D, z1)]), fill=(112, 124, 136, 255))
            pd.line([I(a, D, z0), I(b, D, z0)], fill=(250, 234, 206, 220), width=1.0)
    # the tall glazed bay over the wide entry arch (as on card 0)
    ga0, ga1 = 5 * pitch + pitch * 0.3, 7 * pitch - pitch * 0.3
    pd.poly(Q([(ga0, D, 6.4), (ga1, D, 6.4), (ga1, D, 11.6), (ga0, D, 11.6)]), fill=(126, 138, 150, 255))
    for k in range(1, 4):
        xx = ga0 + (ga1 - ga0) * k / 4
        pd.line([I(xx, D, 6.4), I(xx, D, 11.6)], fill=(200, 184, 160, 255), width=0.9)
    for i in range(6):
        a = 1.6 + i * 3.8
        for (z0, z1) in ((7.0, 8.8), (9.8, 11.6)):
            pd.poly(Q([(L, a, z0), (L, a + 1.6, z0), (L, a + 1.6, z1), (L, a, z1)]), fill=(96, 100, 108, 255))
    over(hero, det)

    # the applied arcade standing in front of the south wall: same bays as card 0, flat arches, its own tile shed
    AD, AH, AR = 2.6, 5.0, 6.0
    YA = D + AD
    arc = new()
    pa_ = Pen(arc)
    pa_.poly(Q([(0, D, 0), (L, D, 0), (L, D, AH), (0, D, AH)]), fill=(132, 104, 86, 255))     # shaded wall inside
    pa_.poly(Q([(0, D, 0), (L, D, 0), (L, YA, 0), (0, YA, 0)]), fill=(176, 154, 128, 255))     # walk
    pa_.poly(Q([(L, D, 0), (L, YA, 0), (L, YA, AH), (L, D, AH)]), fill=(166, 142, 120, 255))   # end face, shade
    pa_.poly(Q([(L, D + 0.5, 0), (L, YA - 0.5, 0), (L, YA - 0.5, 3.4), (L, D + 0.5, 3.4)]), fill=(120, 96, 80, 255))
    over(hero, arc)
    face = mask()
    pf_ = Pen(face)
    pf_.poly(Q([(0, YA, 0), (L, YA, 0), (L, YA, AH), (0, YA, AH)]), fill=255)
    widths = [5.2 * L / 64] * 3 + [7.4 * L / 64] + [5.2 * L / 64] * 7
    pier = (L - sum(widths)) / (len(widths) + 1)
    x = pier
    heads = []
    for w in widths:
        pts = [(x, 0.0)] + seg_arch(x + w / 2, w / 2, 3.5, 0.5 if w < 6 else 0.7) + [(x + w, 0.0)]
        pf_.poly([I(px, YA, pz) for px, pz in pts], fill=0)
        heads.append(pts[1:-1])
        x += w + pier
    over(hero, shade(fill(face, STONE + (255,)), 0.97 + 0.05 * noise(92, 2, 1)))
    hl = new()
    for h_ in heads:
        Pen(hl).line([I(px, YA, pz) for px, pz in h_], fill=(250, 232, 200, 200), width=0.9)
    over(hero, hl)
    shed = new()
    ps_ = Pen(shed)
    ps_.poly(Q([(-0.3, YA + 0.4, AH), (L + 0.3, YA + 0.4, AH), (L + 0.3, D, AR), (-0.3, D, AR)]), fill=TILE + (255,))
    ps_.poly(Q([(L + 0.3, YA + 0.4, AH), (L + 0.3, D, AR), (L + 0.3, D, AH)]), fill=TILE_SH + (255,))
    for xx in np.arange(0, L, 0.6):
        ps_.line([I(xx, YA + 0.4, AH), I(xx, D, AR)], fill=tone(TILE, 0.78) + (180,), width=0.7)
    ps_.line([I(-0.3, YA + 0.4, AH), I(L + 0.3, YA + 0.4, AH)], fill=(250, 226, 196, 255), width=1.2)
    over(hero, shed)

    # hip roof
    e0, e1, e2 = (-O, D + O, EAVE), (L + O, D + O, EAVE), (L + O, -O, EAVE)
    r0, r1 = (D / 2 + 0.5, D / 2, RIDGE), (L - D / 2 - 0.5, D / 2, RIDGE)
    rf = new()
    pr = Pen(rf)
    south = Q([e0, e1, r1, r0])
    pr.poly(south, fill=TILE + (255,))
    pr.poly(Q([e1, e2, r1]), fill=TILE_SH + (255,))
    for k in range(1, 12):
        u = k / 12
        pr.line([I(e1[0], e1[1] - (D + 2 * O) * u, EAVE), I(*r1)], fill=tone(TILE_SH, 0.8) + (160,), width=0.8)
    for t in np.linspace(0.01, 0.99, 90):
        a = (e0[0] + (e1[0] - e0[0]) * t, D + O, EAVE)
        top_x = a[0]
        if top_x < r0[0]:
            f = (top_x - e0[0]) / (r0[0] - e0[0])
        elif top_x > r1[0]:
            f = (e1[0] - top_x) / (e1[0] - r1[0])
        else:
            f = 1.0
        pr.line([I(*a), I(top_x, D + O - (D / 2 + O) * f, EAVE + (RIDGE - EAVE) * f)], fill=tone(TILE, 0.78) + (170,), width=0.8)
    pr.line([I(*r0), I(*r1)], fill=tone(TILE, 1.3) + (255,), width=2)
    pr.line([I(*e0), I(*r0)], fill=tone(TILE, 1.25) + (255,), width=1.6)
    pr.line([I(*e1), I(*r1)], fill=tone(TILE, 1.25) + (255,), width=1.6)
    pr.line([I(*e0), I(*e1)], fill=(250, 226, 196, 255), width=1.8)
    over(hero, rf)

    # solar panels on the south-facing slope: three rows of modules, cell grid, sky glint
    def slope(u, v):
        """Point on the south slope: u = 0..1 along the eave, v = 0..1 eave to ridge (trapezoid)."""
        xa = e0[0] + (r0[0] - e0[0]) * v
        xb = e1[0] + (r1[0] - e1[0]) * v
        return (xa + (xb - xa) * u, D + O - (D / 2 + O) * v, EAVE + (RIDGE - EAVE) * v)

    pv = new()
    pp = Pen(pv)
    cells = new()
    pcl = Pen(cells)
    for (v0, v1) in ((0.12, 0.34), (0.38, 0.6), (0.64, 0.86)):
        # usable span at this height, inset from the hips
        uu0 = 0.05 + 0.24 * v1
        uu1 = 0.95 - 0.24 * v1
        nmod = int((uu1 - uu0) * 40)
        for m in range(nmod):
            ua = uu0 + (uu1 - uu0) * m / nmod + 0.002
            ub = uu0 + (uu1 - uu0) * (m + 1) / nmod - 0.002
            quad = [I(*slope(ua, v0)), I(*slope(ub, v0)), I(*slope(ub, v1)), I(*slope(ua, v1))]
            pp.poly(quad, fill=(64, 88, 124, 255))
            for c in (1, 2):
                vv = v0 + (v1 - v0) * c / 3
                pcl.line([I(*slope(ua, vv)), I(*slope(ub, vv))], fill=(120, 150, 186, 200), width=0.7)
            pcl.line([I(*slope((ua + ub) / 2, v0)), I(*slope((ua + ub) / 2, v1))], fill=(120, 150, 186, 160), width=0.7)
            pcl.line([quad[3], quad[2]], fill=(196, 212, 230, 230), width=0.9)
    pv_m = pv.getchannel("A")
    over(hero, pv)
    over(hero, clip_to(cells, pv_m))
    glint = lgrad(I(*slope(0.25, 0.9)), I(*slope(0.55, 0.1)), [(0, (210, 226, 246, 0)), (0.5, (220, 234, 250, 120)), (1, (210, 226, 246, 0))])
    add(hero, clip_to(glint, pv_m), 0.7)

    # warm late light over the lit faces
    warm = rgrad(I(-10, D + 10, 20), 900, [(0, (255, 196, 130, 60)), (1, (255, 196, 130, 0))])
    add(hero, clip_to(warm, Image.fromarray(np.maximum(np.asarray(rf.getchannel("A")), np.asarray(wl.getchannel("A"))), "L")), 0.6)
    return finish(hero)


SCENES = (scene0, scene1, scene2, scene3)

"""Footprint hero: the building's real OpenStreetMap footprint, extruded and seen from above at dusk.

The default picture for every story card without its own hero module (story_cards_deck.hero_source falls back here).
Geometry comes from Assets/Retrospecs/Data/CampusData.ts (tools/bake-campus.ts): the landmark's footprint ring(s),
height and roof triangles, plus the neighbouring buildings, so the picture is the same building the map highlights.

  - the building: grey-buff walls with a floor line every 3.6 m and warm lit window bays, a terracotta roof with a
    copper rim, and a copper glow on the ground round its base
  - neighbours: dim slate blocks, so the building reads as the one you picked; those in front of it are ghosted
  - camera: orthographic, 30 deg down, heights stretched x2.4, turned off the footprint's main wall direction by an angle picked from the id,
    so the cards don't all look stamped from one view

Spectacles is additive, so the ground is a mid-dark navy (not black) and form comes from light.
Map data (c) OpenStreetMap contributors, ODbL 1.0.
"""

import math
import re
import sys
import zlib
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
from PIL import Image, ImageDraw

import story_cards_featured as F
from story_cards_featured import W, H, SS

ROOT = Path(__file__).resolve().parents[2]
CAMPUS = ROOT / "Assets/Retrospecs/Data/CampusData.ts"
BOX = (28, 28, 888, 694)                # hero box (contract, heroes/__init__.py)
CENTER = (458, 372)                     # where the building's middle lands
FIT = (500, 330)                        # its projected size is fitted inside this
ELEV = math.radians(30)
VZ = 2.4                               # vertical exaggeration: 9 m blocks read as buildings, not slabs
LEVEL_M = 3.6

GROUND_TOP, GROUND_BOTTOM = (22, 31, 46), (34, 44, 60)
STUCCO_LIT, STUCCO_SHADE = (236, 220, 188), (128, 128, 140)
ROOF_LIT, ROOF_SHADE = (214, 112, 74), (150, 74, 52)
WINDOW = (255, 206, 140)
COPPER = (245, 169, 103)
SLATE_LIT, SLATE_SHADE = (72, 86, 108), (42, 52, 68)
SLATE_ROOF = (84, 98, 120)
FRONT_ALPHA = 0.32                     # opacity of neighbours standing between the camera and the building


@lru_cache(maxsize=1)
def campus():
    """(landmarks by id, buildings) parsed from the baked TypeScript module."""
    src = CAMPUS.read_text(encoding="utf-8")
    marks = {}
    for m in re.finditer(r'\{id: "([a-z0-9]+)",[^}]*?building: (-?\d+), east: (-?[\d.]+), north: (-?[\d.]+),[^}]*?'
                         r'heightM: ([\d.]+),[^}]*?wallBearing: ([\d.]+)\}', src):
        cid, b, e, n, h, wb = m.groups()
        marks[cid] = dict(building=int(b), east=float(e), north=float(n), height=float(h), bearing=float(wb))
    body = src[src.index("export const BUILDINGS"):]
    rows = []
    for m in re.finditer(r'^\[([\d.]+),(\d+),"((?:[^"\\]|\\.)*)",\[([^\]]*)\],\[([^\]]*)\],\[([^\]]*)\]\],?$', body, re.M):
        h, _year, name, ring, holes, tris = m.groups()
        xy = [int(v) / 10 for v in ring.split(",")] if ring else []
        pts = list(zip(xy[0::2], xy[1::2]))
        starts = [int(v) for v in holes.split(",")] if holes else []
        loops, bounds = [], [0] + starts + [len(pts)]
        for a, b in zip(bounds, bounds[1:]):
            if b - a >= 3:
                loops.append(pts[a:b])
        tri = [int(v) for v in tris.split(",")] if tris else []
        rows.append(dict(height=float(h), name=name, loops=loops, pts=pts, tris=tri))
    return marks, rows


def _inside(pt, loop):
    x, y = pt
    c = False
    for (x0, y0), (x1, y1) in zip(loop, loop[1:] + loop[:1]):
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            c = not c
    return c


def target_index(card_id):
    """Index of the landmark's footprint, or -1 when the bake has none (Memorial Church is not an OSM building in
    the cache): those cards mark the landmark's centroid with a copper pin instead of inventing a footprint."""
    return campus()[0][card_id]["building"]


class Camera:
    def __init__(self, az_deg):
        a = math.radians(az_deg)
        self.f = (math.sin(a), math.cos(a))          # horizontal view direction (east, north)
        self.r = (self.f[1], -self.f[0])             # screen right
        self.k, self.ox, self.oy = 1.0, 0.0, 0.0

    def raw(self, e, n, z):
        x = e * self.r[0] + n * self.r[1]
        d = e * self.f[0] + n * self.f[1]
        up = z * VZ * math.cos(ELEV) + d * math.sin(ELEV)
        return x, -up

    def px(self, e, n, z):
        x, y = self.raw(e, n, z)
        return (self.ox + x * self.k) * SS, (self.oy + y * self.k) * SS

    def depth(self, e, n):
        return e * self.f[0] + n * self.f[1]


def _mix(c0, c1, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c0, c1))


def _wall_light(cam, p0, p1):
    """0..1 light on the camera-facing side of the wall from p0 to p1."""
    ex, ny = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(ex, ny) or 1.0
    nx, nn = ny / L, -ex / L
    if nx * cam.f[0] + nn * cam.f[1] > 0:         # orient the normal toward the camera (painter's order hides the back)
        nx, nn = -nx, -nn
    # key light from the camera's upper left, turned 50 deg off the view direction
    a = math.atan2(cam.f[0], cam.f[1]) + math.radians(130)
    lx, ly = math.sin(a), math.cos(a)
    return 0.25 + 0.75 * max(0.0, nx * lx + nn * ly)


def _clockwise(loop):
    s = sum((x1 - x0) * (y1 + y0) for (x0, y0), (x1, y1) in zip(loop, loop[1:] + loop[:1]))
    return loop if s > 0 else loop[::-1]


def _draw_building(d, cam, b, height, hero):
    loops = b["loops"]
    if not loops:
        return
    faces = []
    for k, loop in enumerate(loops):
        loop = _clockwise(loop) if k == 0 else _clockwise(loop)[::-1]   # holes face inward
        for p0, p1 in zip(loop, loop[1:] + loop[:1]):
            light = _wall_light(cam, p0, p1)
            mid = cam.depth((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
            faces.append((mid, p0, p1, light))
    faces.sort(key=lambda f: -f[0])
    for _, p0, p1, light in faces:
        quad = [cam.px(*p0, 0), cam.px(*p1, 0), cam.px(*p1, height), cam.px(*p0, height)]
        if hero:
            d.polygon(quad, fill=_mix(STUCCO_SHADE, STUCCO_LIT, light) + (255,))
            _windows(d, cam, p0, p1, height, light)
        else:
            d.polygon(quad, fill=_mix(SLATE_SHADE, SLATE_LIT, light) + (255,))
    # roof: the baked earcut triangles (holes respected), then the rim
    pts, tris = b["pts"], b["tris"]
    roof = ROOF_LIT if hero else SLATE_ROOF
    for i in range(0, len(tris) - 2, 3):
        tri = [cam.px(*pts[j], height) for j in tris[i:i + 3]]
        d.polygon(tri, fill=roof + (255,), outline=roof + (255,))
    rim = COPPER + (255,) if hero else (118, 132, 154, 255)
    for loop in loops:
        ring = [cam.px(*p, height) for p in loop]
        d.line(ring + ring[:1], fill=rim, width=max(1, round((2.2 if hero else 1.2) * SS)), joint="curve")


def _windows(d, cam, p0, p1, height, light):
    """Floor lines and lit window bays on one wall of the picked building."""
    length = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    if length < 2.5:
        return
    floors = max(1, int(height / LEVEL_M + 0.25))
    fh = height / floors
    bays = max(1, int(length / 3.4))
    line = _mix(STUCCO_SHADE, STUCCO_LIT, light * 0.7)
    lw = max(1, round(1.1 * SS))
    lerp = lambda t: (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)
    glow = _mix((150, 112, 80), WINDOW, 0.55 + 0.45 * light)
    for f in range(floors):
        z0, z1 = f * fh + fh * 0.32, f * fh + fh * 0.78
        for k in range(bays):
            t0, t1 = (k + 0.24) / bays, (k + 0.76) / bays
            a, b = lerp(t0), lerp(t1)
            d.polygon([cam.px(*a, z0), cam.px(*b, z0), cam.px(*b, z1), cam.px(*a, z1)], fill=glow + (255,))
        if f:
            d.line([cam.px(*p0, f * fh), cam.px(*p1, f * fh)], fill=line + (255,), width=lw)


def _pin(canvas, cam, e, n, height, m):
    """A copper beacon standing on the landmark's centroid, for landmarks without a baked footprint."""
    x0, y0 = (v / SS for v in cam.px(e, n, 0))
    x1, y1 = (v / SS for v in cam.px(e, n, height))
    lay = F.new()
    p = F.Pen(lay)
    p.ellipse((x0 - 46, y0 - 15, x0 + 46, y0 + 15), fill=COPPER + (90,))
    p.line([(x0, y0), (x1, y1)], fill=COPPER + (255,), width=4)
    p.circle((x1, y1), 15, fill=COPPER + (255,))
    p.circle((x1, y1), 6, fill=(255, 236, 214, 255))
    F.over(canvas, F.clip_to(F.blur(lay, 10), m))
    F.over(canvas, F.clip_to(lay, m))


def _view_angle(card_id, bearing):
    turns = (32, 58, 122, 148, 212, 238, 302, 328)
    return bearing + turns[zlib.crc32(card_id.encode()) % len(turns)]


def scene(card_id, th=None):
    marks, rows = campus()
    ti = target_index(card_id)
    mk = marks[card_id]
    if ti >= 0:
        target = rows[ti]
    else:                               # no footprint: frame a 90 m square round the centroid, pin it
        e, n, r = mk["east"], mk["north"], 45.0
        target = dict(height=0.0, loops=[], tris=[], pts=[(e - r, n - r), (e + r, n - r), (e + r, n + r), (e - r, n + r)])
    height = max(target["height"], mk["height"]) if ti >= 0 else mk["height"]
    cam = Camera(_view_angle(card_id, mk["bearing"]))

    # fit the building (with its height) into FIT, centred on CENTER
    xs, ys = [], []
    for e, n in target["pts"]:
        for z in (0, height):
            x, y = cam.raw(e, n, z)
            xs.append(x)
            ys.append(y)
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cam.k = min(FIT[0] / max(w, 1), FIT[1] / max(h, 1), 9.0)
    cam.ox = CENTER[0] - (min(xs) + max(xs)) / 2 * cam.k
    cam.oy = CENTER[1] - (min(ys) + max(ys)) / 2 * cam.k

    cx = sum(e for e, _ in target["pts"]) / len(target["pts"])
    cn = sum(n for _, n in target["pts"]) / len(target["pts"])
    reach = 1.6 * max(BOX[2] - BOX[0], BOX[3] - BOX[1]) / cam.k     # metres that can appear in the box

    canvas = F.new()
    m = F.poly_mask([(BOX[0], BOX[1]), (BOX[2], BOX[1]), (BOX[2], BOX[3]), (BOX[0], BOX[3])])
    F.over(canvas, F.vgrad(BOX[1], BOX[3], [(0, GROUND_TOP + (255,)), (1, GROUND_BOTTOM + (255,))], m))

    # faint survey grid on the ground, aligned to the campus walls
    grid = F.mask()
    g = ImageDraw.Draw(grid)
    step = 20.0
    a = math.radians(marks[card_id]["bearing"])
    u, v = (math.sin(a), math.cos(a)), (math.cos(a), -math.sin(a))
    for k in range(-int(reach / step) - 1, int(reach / step) + 2):
        for dirn, perp in ((u, v), (v, u)):
            o = (cx + perp[0] * k * step, cn + perp[1] * k * step)
            p0 = cam.px(o[0] - dirn[0] * reach, o[1] - dirn[1] * reach, 0)
            p1 = cam.px(o[0] + dirn[0] * reach, o[1] + dirn[1] * reach, 0)
            g.line([p0, p1], fill=255, width=max(1, round(0.8 * SS)))
    F.over(canvas, F.clip_to(F.fill(grid, COPPER + (34,)), m))

    # copper glow pooled round the base
    base = F.mask()
    bd = ImageDraw.Draw(base)
    for loop in target["loops"][:1]:
        bd.polygon([cam.px(*p, 0) for p in loop], fill=255)
    F.over(canvas, F.clip_to(F.fill(F.blur(base, 26), COPPER + (120,)), m))

    # buildings far to near; the picked one gets the stucco, windows and copper
    near = []
    for i, r in enumerate(rows):
        if not r["pts"]:
            continue
        bx = sum(e for e, _ in r["pts"]) / len(r["pts"])
        bn = sum(n for _, n in r["pts"]) / len(r["pts"])
        if math.hypot(bx - cx, bn - cn) < reach:
            near.append((cam.depth(bx, bn), i))
    near.sort(key=lambda t: -t[0])
    # neighbours nearer the camera than the picked building are ghosted on top, so they never hide it
    td = cam.depth(cx, cn)
    lay, front = F.new(), F.new()
    d, fd = ImageDraw.Draw(lay), ImageDraw.Draw(front)
    for depth, i in near:
        if i == ti:
            _draw_building(d, cam, rows[i], height, True)
        elif depth < td and ti >= 0:
            _draw_building(fd, cam, rows[i], rows[i]["height"], False)
        else:
            _draw_building(d, cam, rows[i], rows[i]["height"], False)
    F.over(canvas, F.clip_to(lay, m))
    a = np.asarray(front, np.float32).copy()
    a[..., 3] *= FRONT_ALPHA
    F.over(canvas, F.clip_to(Image.fromarray(a.astype(np.uint8), "RGBA"), m))
    if ti < 0:
        _pin(canvas, cam, mk["east"], mk["north"], mk["height"], m)

    # distance haze toward the top (the far side of the scene) and a little paper grain
    haze = F.vgrad(BOX[1], BOX[1] + 300, [(0, GROUND_TOP + (170,)), (1, GROUND_TOP + (0,))], m)
    F.over(canvas, haze)
    grain = 0.94 + 0.12 * F.noise(zlib.crc32(card_id.encode()) & 0xFFFF, 3, octaves=2)
    canvas = F.shade(canvas, grain)
    return canvas


def scenes_for(card_id):
    """SCENES-style tuple for a card id, or None if the id has no baked footprint."""
    marks, _ = campus()
    if card_id not in marks:
        return None
    return (lambda th, _id=card_id: scene(_id, th),)

"""Main Quad story-card pictures, drawn as white-line engravings.

Each scene builds a tonal plate (flat-shaded planes in true perspective) and renders it through an engraver's line
screen: bright surfaces become thick light lines, shadow becomes thin lines or bare ground, and masonry joints are cut
as gaps. Light ink on a transparent ground suits the additive Spectacles display (dark reads as see-through) and sits
with the midnight-navy + copper card and its Georgia type.

Only what each card in tools/story-cards.json says is drawn:
  0  1891, the Quad that opened with Stanford: an inside corner of the Inner Quad (rock-faced sandstone arcades on
     short columns, red tile roofs). Memorial Church (1903), the Outer Quad and the Memorial Arch came later, so they
     are left out.
  1  The plan: two schematic site plans side by side, Olmsted's foothill campus with an off-centre church and
     Stanford's flat, centred axis.
  2  1906: the lost Memorial Arch as a dashed architect's elevation above its two surviving bases.
  3  Class Day: plain bronze class plaques set along the Inner Quad arcade paving, with a cut-away showing a buried
     time capsule (shape unknown, so drawn as a simple dashed outline).

SCENES = (scene0, scene1, scene2, scene3); each scene(th) returns a supersampled RGBA canvas like
story_cards_featured.new(), with content inside card px x 28-888, y 28-694.
"""

import math
import random

import numpy as np
from PIL import Image, ImageDraw

from story_cards_featured import (SS, W, H, _XX, _YY, _s, new, mask, Pen, over, blur, vgrad, noise, poly_mask, fill, shade,
                                  clip_to, mix, font, text, text_width)

BOX = (28, 28, 888, 694)

IVORY = (252, 236, 206)
STONE = (250, 208, 150)
STONE_SHADE = (196, 150, 118)
TILE = (226, 116, 76)
TILE_SHADE = (196, 120, 96)
SKY = (176, 196, 222)
COPPER = (232, 162, 98)
BRONZE = (240, 184, 112)
SEPIA = (84, 58, 40)


def dusk_sky(hz):
    """Pale evening sky: soft blue overhead warming to peach at the horizon line hz (card px)."""
    return vgrad(28, hz, [(0, (92, 116, 158)), (0.55, (170, 168, 180)), (1, (242, 208, 168))], box_mask())


def box_mask(box=BOX):
    m = mask()
    Pen(m).rect(box, fill=255)
    return m


# ---------------------------------------------------------------------------------------------------------------
# The engraving plate

class Plate:
    """Painter's-order tonal plate rendered through an angled line screen.

    Each hatch family (angle, period) keeps its own tone map; painting a polygon writes its tone into its family and
    clears it from the others, so later shapes cover earlier ones. `gaps` holds cut lines (joints) that read dark."""

    def __init__(self, period=7.0):
        self.period = period
        self.maps = {}
        self.ink = Image.new("RGB", (W * SS, H * SS), IVORY)
        self.wash = new()
        self.gaps = mask()
        self.lines = new()
        self.cover = mask()
        self._dc = ImageDraw.Draw(self.cover)
        self._di = ImageDraw.Draw(self.ink)
        self._dw = ImageDraw.Draw(self.wash)
        self._dg = ImageDraw.Draw(self.gaps)

    def _key(self, ang, period):
        k = (round(ang, 2), max(7.0, period or self.period))   # finer screens alias once shown at ~0.8x
        if k not in self.maps:
            self.maps[k] = mask()
        return k

    def poly(self, pts, tone, ang=0.0, ink=IVORY, wash=None, period=None):
        key = self._key(ang, period)
        sp = _s(pts)
        v = int(round(max(0.0, min(1.0, tone)) * 255))
        for k, m in self.maps.items():
            ImageDraw.Draw(m).polygon(sp, fill=v if k == key else 0)
        self._di.polygon(sp, fill=ink)
        self._dw.polygon(sp, fill=wash if wash else (0, 0, 0, 0))
        self._dg.polygon(sp, fill=0)
        self._dc.polygon(sp, fill=255)

    def region(self, m, tone_img, ang=0.0, ink=IVORY, wash=None, period=None):
        """Paint through an L mask with a per-pixel tone image (for gradients: sky, ground)."""
        key = self._key(ang, period)
        zero = Image.new("L", m.size, 0)
        for k, mm in self.maps.items():
            mm.paste(tone_img if k == key else zero, mask=m)
        self.ink.paste(Image.new("RGB", m.size, ink), mask=m)
        self.wash.paste(Image.new("RGBA", m.size, wash if wash else (0, 0, 0, 0)), mask=m)
        self.gaps.paste(zero, mask=m)
        self.cover.paste(Image.new("L", m.size, 255), mask=m)

    def joint(self, pts, width=1.2):
        self._dg.line(_s(pts), fill=255, width=max(1, round(width * SS)))

    def stroke(self, pts, color, width=1.5):
        Pen(self.lines).line(pts, fill=color, width=width)

    def render(self, texture=None, tex_skip=(), backdrop=None, lit=True, floor=0.34, line_k=0.2):
        """lit=True: every painted surface gets an opaque fill in its ink colour, brightness from its tone (floor..1),
        joints cut darker into it, and the engraver's screen laid over the fill as lighter linework. A backdrop RGBA
        (sky) shows wherever nothing was painted. lit=False: bare white-line engraving on transparency."""
        total = np.zeros((H * SS, W * SS), np.float32)
        tsum = np.zeros((H * SS, W * SS), np.float32)
        for (ang, per), m in self.maps.items():
            t = np.asarray(m, np.float32) / 255.0
            if texture is not None and (ang, per) not in tex_skip:
                t = t * (texture if not lit else 1 + 0.5 * (texture - 1))
            tsum += t
            on = np.clip((t - 0.035) / 0.1, 0, 1)
            t = np.where(on, 0.12 + 0.72 * np.clip(t, 0, 1), 0.0)
            a = math.radians(ang)
            s = (-_XX * math.sin(a) + _YY * math.cos(a)) / per
            d = np.abs(s - np.floor(s) - 0.5)
            aa = 1.0 / (per * SS)
            cov = np.clip((0.5 * t - d) / aa + 0.5, 0, 1) * on
            total = np.maximum(total, cov)
        gap = np.asarray(self.gaps, np.float32) / 255.0
        if lit:
            ink = np.asarray(self.ink, np.float32)
            b = floor + (1 - floor) * np.clip(tsum, 0, 1) ** 0.72
            rgb = ink * b[..., None]
            rgb *= (0.86 + 0.14 * total)[..., None]
            rgb += (255 - rgb) * (line_k * total * (1 - gap))[..., None]
            rgb *= (1 - 0.5 * gap)[..., None]
            cov = np.asarray(self.cover, np.float32)
            arr = np.concatenate([np.clip(rgb, 0, 255), cov[..., None]], axis=-1)
            hero = backdrop.copy() if backdrop is not None else new()
            over(hero, Image.fromarray(arr.astype(np.uint8), "RGBA"))
            over(hero, self.lines)
            return clip_to(hero, box_mask())
        total *= 1.0 - gap
        lay = self.ink.convert("RGBA")
        lay.putalpha(Image.fromarray((total * 255).astype(np.uint8), "L"))
        hero = self.wash.copy()
        over(hero, lay)
        over(hero, self.lines)
        return clip_to(hero, box_mask())


# ---------------------------------------------------------------------------------------------------------------
# Perspective helpers (world metres, eye at origin, Y up, looking +Z)

class Cam:
    def __init__(self, vx, vy, f, eye=1.6):
        self.vx, self.vy, self.f, self.eye = vx, vy, f, eye

    def __call__(self, X, h, Z):
        """Project a point at height h above the ground."""
        Z = max(Z, 0.05)
        return (self.vx + self.f * X / Z, self.vy - self.f * (h - self.eye) / Z)


def angle_of(p0, p1):
    return math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0]))


def lambert(n, L):
    nl = math.sqrt(sum(c * c for c in n)) * math.sqrt(sum(c * c for c in L))
    return max(0.0, sum(a * b for a, b in zip(n, L)) / nl)


class Wing:
    """An arcade range: facade plane from corner C along unit d (horizontal), b = unit direction into the building."""

    def __init__(self, cam, C, d, b):
        self.cam, self.C, self.d, self.b = cam, C, d, b

    def pt(self, u, h, depth=0.0):
        X = self.C[0] + u * self.d[0] + depth * self.b[0]
        Z = self.C[1] + u * self.d[1] + depth * self.b[1]
        return self.cam(X, h, Z)

    def arch(self, cx, spring, r, depth=0.0, n=28, up=True):
        return [self.pt(cx + r * math.cos(math.pi * i / n), spring + r * math.sin(math.pi * i / n), depth)
                for i in range(n + 1)]

    def opening(self, a, b, spring, depth=0.0):
        r = (b - a) / 2
        return [self.pt(b, 0, depth)] + self.arch(a + r, spring, r, depth) + [self.pt(a, 0, depth)]


def arcade_wing(pl, w, u0, u1, bays, L, *, spring=2.7, col=0.72, eave=6.1, wall_t=0.75, walk=3.6, ridge_back=6.5,
                ridge_h=9.6, overhang=0.55, course=0.46, seed=1, tone_k=1.0, roof=True, shadow_open=0.0, ext=8.0):
    """Paint one Inner Quad arcade range: walk interior, arch reveals, rock-faced wall with joints, columns, soffit,
    red tile roof. Returns screen points of interest."""
    rng = random.Random(seed)
    P = w.pt
    nface = (-w.b[0], 0.0, -w.b[1])
    lit = lambert(nface, L) * tone_k
    wall_tone = 0.1 + 0.76 * lit
    ang_course = angle_of(P(u0, 3.0), P(u1, 3.0))
    ang_vert = 90.0
    bay_w = (u1 - u0) / bays
    centres = [u0 + bay_w * (k + 0.5) for k in range(bays)]
    halfo = (bay_w - col) / 2
    # 1. through the openings: walk floor, back wall with arched doorways, ceiling, sun patches on the floor
    back = wall_t + walk
    ua, ub = u0 - ext, u1 + ext
    pl.poly([P(ua, 0, wall_t), P(ub, 0, wall_t), P(ub, 0, back), P(ua, 0, back)], 0.16 * tone_k + 0.04, ang_course,
            STONE_SHADE)
    pl.poly([P(ua, 0, back), P(ub, 0, back), P(ub, eave - 0.6, back), P(ua, eave - 0.6, back)], 0.06, ang_vert,
            STONE_SHADE)
    pl.poly([P(ua, eave - 0.6, wall_t), P(ub, eave - 0.6, wall_t), P(ub, eave - 0.6, back), P(ua, eave - 0.6, back)],
            0.05, ang_course, STONE_SHADE)
    for c in centres:
        dw = 0.7
        pl.poly([P(c + dw, 0, back)] + w.arch(c, 2.3, dw, back, 14) + [P(c - dw, 0, back)], 0.0, ang_vert,
                STONE_SHADE)
        pl.stroke(w.arch(c, 2.3, dw + 0.12, back, 14), STONE_SHADE + (70,), 1.2)
    if shadow_open:
        Ly = L[1]
        ld = L[0] * w.d[0] + L[2] * w.d[1]
        lb = L[0] * w.b[0] + L[2] * w.b[1]
        if lb < 0:
            for c in centres:
                pts = []
                for i in range(25):
                    t = math.pi * i / 24
                    pts.append((c + halfo * math.cos(t), spring + halfo * math.sin(t)))
                pts = [(c + halfo, 0.0)] + pts + [(c - halfo, 0.0)]
                fl = []
                for (u, h) in pts:
                    db = min(back - 0.05, wall_t + (-lb / Ly) * h)
                    du = (-ld / Ly) * (db - wall_t) / max(1e-3, -lb / Ly)
                    fl.append(P(u + du, 0, db))
                pl.poly(fl, 0.5 * tone_k, ang_course, STONE)
    # 2. reveals: the inner faces of each arch, between the front outline and the back outline
    rev_tone = 0.2 + 0.35 * lit
    hole, rev, sof = mask(), mask(), mask()
    for c in centres:
        a, b = c - halfo, c + halfo
        Pen(rev).poly(w.opening(a, b, spring, 0.0), fill=255)
        Pen(sof).poly(w.arch(c, spring, halfo, 0.0) + list(reversed(w.arch(c, spring, halfo, wall_t))), fill=255)
        Pen(hole).poly(w.opening(a, b, spring, wall_t), fill=255)
    hn = np.asarray(hole, np.float32)
    rev = Image.fromarray(np.clip(np.asarray(rev, np.float32) - hn, 0, 255).astype(np.uint8), "L")
    sof = Image.fromarray(np.clip(np.asarray(sof, np.float32) - hn, 0, 255).astype(np.uint8), "L")
    pl.region(rev, Image.new("L", rev.size, int(rev_tone * 255)), ang_vert, STONE)
    pl.region(sof, Image.new("L", rev.size, int(rev_tone * 0.5 * 255)), ang_course, STONE_SHADE)
    # 3. the wall, with the openings cut out (via the back-outline mask painted after the wall would be wrong, so the
    #    wall is painted as a mask with the front outlines removed)
    wall = poly_mask([P(u0, 0), P(u1, 0), P(u1, eave), P(u0, eave)])
    wp = Pen(wall)
    for c in centres:
        wp.poly(w.opening(c - halfo, c + halfo, spring, 0.0), fill=0)
    return dict(wall=wall, hole=hole, centres=centres, halfo=halfo, wall_tone=wall_tone, ang_course=ang_course,
                lit=lit, rev_tone=rev_tone)


def paint_wall(pl, w, info, u0, u1, *, spring=2.7, eave=6.1, course=0.46, seed=1, ink=STONE, wash=None):
    """Rock-faced wall through its mask (openings cut): every ashlar block and voussoir gets its own tone, then the
    joints are cut between them."""
    P = w.pt
    wt = info["wall_tone"]
    rng = random.Random(seed)
    centres, halfo = info["centres"], info["halfo"]
    tone = Image.new("L", (W * SS, H * SS), 0)
    tp = Pen(tone)

    def k_of(h):
        shade_band = 1 - 0.5 * min(1.0, max(0.0, (h - (eave - 1.15)) / 0.3))
        return shade_band * (0.8 + 0.2 * min(1.0, h / 1.6))

    def block(ua, ub, ha, hb):
        v = wt * k_of((ha + hb) / 2) * rng.uniform(0.84, 1.1)
        tp.poly([P(ua, ha), P(ub, ha), P(ub, hb), P(ua, hb)], fill=int(max(0, min(1, v)) * 255))

    vd = 0.62
    h, row = 0.0, 0
    joints = []
    while h < eave - 0.01:
        h1 = min(eave, h + course)
        joints.append(h1)
        x = u0
        nxt = u0 + (0.35 if row % 2 else 0.9) + rng.uniform(0, 0.3)
        while x < u1:
            xe = min(u1, nxt)
            block(x, xe, h, h1)
            near_arch = any(abs((x + xe) / 2 - c) < halfo + vd + 0.4 and spring - 0.3 < h < spring + halfo + vd
                            for c in centres)
            in_open = any(c - halfo < xe < c + halfo and h < spring + halfo for c in centres)
            if xe < u1 and not near_arch and not in_open:
                pl.joint([P(xe, h + 0.03), P(xe, h1 - 0.03)], 1.0)
            x = xe
            nxt = x + rng.uniform(0.9, 1.5)
        h = h1
        row += 1
    # voussoirs: wedges round each arch
    n = 15
    for c in centres:
        for i in range(n):
            t0, t1 = math.pi * i / n, math.pi * (i + 1) / n
            pts = [P(c + halfo * math.cos(t), spring + halfo * math.sin(t)) for t in (t0, t1)]
            pts += [P(c + (halfo + vd) * math.cos(t), spring + (halfo + vd) * math.sin(t)) for t in (t1, t0)]
            hv = spring + (halfo + vd / 2) * math.sin((t0 + t1) / 2)
            v = wt * k_of(hv) * rng.uniform(0.92, 1.14)
            tp.poly(pts, fill=int(max(0, min(1, v)) * 255))
    pl.region(info["wall"], tone, info["ang_course"], ink, wash)
    # horizontal bed joints, split around the openings and the voussoir rings
    for hj in joints[:-1]:
        cuts = []
        for c in centres:
            if hj < spring:
                cuts.append((c - halfo, c + halfo))
            elif hj < spring + halfo + vd:
                rr = halfo + vd
                dx = math.sqrt(max(0.0, rr ** 2 - (hj - spring) ** 2))
                cuts.append((c - dx, c + dx))
        segs, start = [], u0
        for a_, b_ in sorted(cuts):
            segs.append((start, a_))
            start = b_
        segs.append((start, u1))
        for a_, b_ in segs:
            if b_ - a_ > 0.05:
                pl.joint([P(a_, hj), P(b_, hj)], 1.1)
    for c in centres:
        for i in range(1, n):
            t = math.pi * i / n
            pl.joint([P(c + halfo * math.cos(t), spring + halfo * math.sin(t)),
                      P(c + (halfo + vd) * math.cos(t), spring + (halfo + vd) * math.sin(t))], 1.1)
        pl.joint(w.arch(c, spring, halfo + vd), 1.2)
    pl.joint([P(u0, eave - 0.35), P(u1, eave - 0.35)], 1.4)


def paint_columns(pl, w, info, L, *, spring=2.7, col=0.8, depth=0.38):
    """Stout round columns between the arches: base, shaft in three tone strips, carved capital block."""
    P = w.pt
    centres, halfo = info["centres"], info["halfo"]
    nface = (-w.b[0], 0.0, -w.b[1])
    side = (w.d[0], 0.0, w.d[1])
    piers = [c + halfo + col / 2 for c in centres[:-1]]
    r = col * 0.4
    for x in piers:
        tones = []
        for k in range(5):
            th = math.pi * (k + 0.5) / 5 - math.pi / 2
            n = tuple(math.cos(th) * a + math.sin(th) * b for a, b in zip(nface, side))
            tones.append(0.18 + 0.78 * lambert(n, L))
        # back the column with the shaded pier so the gaps read as depth
        for k in range(5):
            xa = x - r + 2 * r * k / 5
            xb = x - r + 2 * r * (k + 1) / 5
            pl.poly([P(xa, 0.45, -0.05), P(xb, 0.45, -0.05), P(xb, spring - 0.55, -0.05), P(xa, spring - 0.55, -0.05)],
                    tones[k], 90.0, STONE)
        # base (square plinth + torus) and capital (flared block under a square abacus)
        pl.poly([P(x - col / 2, 0, -0.08), P(x + col / 2, 0, -0.08), P(x + col / 2, 0.32, -0.08), P(x - col / 2, 0.32, -0.08)],
                info["wall_tone"] * 0.95, info["ang_course"], STONE)
        pl.poly([P(x - r * 1.25, 0.32, -0.08), P(x + r * 1.25, 0.32, -0.08), P(x + r * 1.05, 0.47, -0.08),
                 P(x - r * 1.05, 0.47, -0.08)], info["wall_tone"], info["ang_course"], STONE)
        pl.poly([P(x - r, spring - 0.55, -0.08), P(x + r, spring - 0.55, -0.08), P(x + col / 2 + 0.06, spring - 0.12, -0.08),
                 P(x - col / 2 - 0.06, spring - 0.12, -0.08)], min(1.0, info["wall_tone"] * 1.1), 90.0, STONE)
        pl.joint([P(x - r, spring - 0.42, -0.08), P(x + r, spring - 0.42, -0.08)], 1.0)
        pl.poly([P(x - col / 2 - 0.1, spring - 0.12, -0.08), P(x + col / 2 + 0.1, spring - 0.12, -0.08),
                 P(x + col / 2 + 0.1, spring + 0.04, -0.08), P(x - col / 2 - 0.1, spring + 0.04, -0.08)],
                min(1.0, info["wall_tone"] * 1.15), info["ang_course"], STONE)


def paint_roof(pl, w, L, u0, u1, *, eave=6.1, overhang=0.55, ridge_back=6.5, ridge_h=9.6, ridge_pts=None,
               eave_pts=None, tiles=0.42):
    """Soffit under the eave and the red tile roof plane up to the ridge; tile courses cut parallel to the eave."""
    P = w.pt
    e0, e1 = (eave_pts or (P(u0, eave, -overhang), P(u1, eave, -overhang)))
    r0, r1 = (ridge_pts or (P(u0, ridge_h, ridge_back), P(u1, ridge_h, ridge_back)))
    # soffit
    pl.poly([P(u0, eave), P(u1, eave), e1, e0], 0.1, angle_of(e0, e1), STONE_SHADE)
    # roof plane
    run = ridge_back + overhang
    rise = ridge_h - eave
    nface = (-w.b[0] * rise / run, 1.0, -w.b[1] * rise / run)
    lit = lambert(nface, L)
    ang = angle_of(P((u0 + u1) / 2, eave, -overhang), P((u0 + u1) / 2, ridge_h, ridge_back))
    pl.poly([e0, e1, r1, r0], 0.25 + 0.5 * lit, ang, TILE, (150, 66, 44, 70))
    # tile courses
    k = 1
    while True:
        t = k * tiles / math.hypot(run, rise)
        if t >= 1:
            break
        a = (e0[0] + (r0[0] - e0[0]) * t, e0[1] + (r0[1] - e0[1]) * t)
        b = (e1[0] + (r1[0] - e1[0]) * t, e1[1] + (r1[1] - e1[1]) * t)
        pl.joint([a, b], 1.2 if k % 4 else 1.6)
        k += 1
    pl.stroke([e0, e1], TILE + (230,), 1.6)
    return lit


# ---------------------------------------------------------------------------------------------------------------
# 0  1891: the Inner Quad

def scene0(th):
    pl = Plate(7.0)
    cam = Cam(430, 452, 760)
    L = (-0.45, 0.62, -0.64)          # sun from front-left, fairly high
    # sky: sparse horizontal rules, lighter toward the horizon (engraver's sky)
    # courtyard paving
    gr_t = vgrad(452, 694, [(0, (150, 150, 150, 255)), (1, (104, 104, 104, 255))]).getchannel("R")
    pl.region(poly_mask([(28, 452), (888, 452), (888, 694), (28, 694)]), gr_t, 0.0, (240, 210, 164),
              (120, 96, 70, 26))

    phi = math.radians(30)
    C = (-3.2, 21.0)
    dA = (math.cos(phi), -math.sin(phi))         # right wing, coming toward the viewer
    dB = (-math.sin(phi), -math.cos(phi))        # left wing, coming toward the viewer
    # paving joints: a grid laid square to the two ranges
    for i in range(-2, 12):
        for (da, db) in ((dA, dB), (dB, dA)):
            o = (C[0] + da[0] * 3.0 * i, C[1] + da[1] * 3.0 * i)
            seg = [(o[0] + db[0] * s_, o[1] + db[1] * s_) for s_ in (0.5, 24.0)]
            seg = [p for p in seg if p[1] > 1.0]
            if len(seg) == 2:
                pl.joint([cam(seg[0][0], 0, seg[0][1]), cam(seg[1][0], 0, seg[1][1])], 1.0)
    A = Wing(cam, C, dA, (-dB[0], -dB[1]))
    B = Wing(cam, C, dB, (-dA[0], -dA[1]))
    uA0, uA1, nA = 1.4, 1.4 + 4.1 * 6, 6
    uB0, uB1, nB = 1.4, 1.4 + 4.1 * 4, 4

    # wing B lies in shade; its shadow falls on the courtyard in front of it
    sh = []
    for u in (0.0, uB1 + 6):
        p = (C[0] + u * dB[0], C[1] + u * dB[1])
        sh.append(cam(p[0], 0, p[1]))
    # shadow tip: eave line projected along the sun onto the ground
    k = 6.1 / L[1]
    tip = [(C[0] + u * dB[0] - L[0] * k * 0.0 + dA[0] * 3.2, C[1] + u * dB[1] + dA[1] * 3.2) for u in (0.0, uB1 + 6)]
    pl.poly([sh[0], sh[1], cam(tip[1][0], 0, tip[1][1]), cam(tip[0][0], 0, tip[0][1])], 0.12, 0.0, (214, 196, 170))
    for i, (wing, u0, u1, n, seed, tk) in enumerate(((B, uB0, uB1, nB, 3, 0.62), (A, uA0, uA1, nA, 5, 1.0))):
        info = arcade_wing(pl, wing, u0, u1, n, L, seed=seed, tone_k=tk,
                           shadow_open=wing is A)
        paint_wall(pl, wing, info, u0, u1, seed=seed, wash=(176, 130, 84, 44))
        paint_columns(pl, wing, info, L)
        # the corner pier between the two wings
        if wing is A:
            pass
        info_ = info
    # corner pier (solid sandstone where the ranges meet), then the roofs: B then A, meeting in the valley
    for wing, u1 in ((B, uB0), (A, uA0)):
        nface = (-wing.b[0], 0.0, -wing.b[1])
        t = 0.1 + 0.76 * lambert(nface, L) * (0.62 if wing is B else 1.0)
        P = wing.pt
        pl.poly([P(0, 0), P(u1, 0), P(u1, 6.1), P(0, 6.1)], t, angle_of(P(0, 3), P(3, 3)), STONE, (176, 130, 84, 44))
        h = 0.46
        while h < 5.6:
            pl.joint([P(0, h), P(u1, h)], 1.1)
            h += 0.46
    valley_e = cam(C[0] + 0.55 * (dA[0] + dB[0]), 6.1, C[1] + 0.55 * (dA[1] + dB[1]))
    R = (C[0] - 6.5 * (dA[0] + dB[0]), C[1] - 6.5 * (dA[1] + dB[1]))
    valley_r = cam(R[0], 9.6, R[1])
    for wing, u1 in ((B, uB1), (A, uA1 + 4)):
        P = wing.pt
        paint_roof(pl, wing, L, 0, u1, eave_pts=(valley_e, P(u1, 6.1, -0.55)),
                   ridge_pts=(valley_r, P(u1, 9.6, 6.5)))
    pl.stroke([valley_e, valley_r], (255, 200, 160, 160), 1.4)
    tex = 0.84 + 0.32 * noise(11, 26, 3)
    return pl.render(tex, backdrop=dusk_sky(452))


# ---------------------------------------------------------------------------------------------------------------
# 1  The plan: Olmsted's foothill scheme beside Stanford's flat, centred axis

def dash_line(pen, p0, p1, color, width=1.4, pattern=(14, 5, 3, 5)):
    """Draftsman's line along p0-p1 with a repeating on/off pattern (default: centreline, long-short)."""
    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    ux, uy = (p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L
    s_, i = 0.0, 0
    while s_ < L:
        seg = pattern[i % len(pattern)]
        if i % 2 == 0:
            e = min(L, s_ + seg)
            pen.line([(p0[0] + ux * s_, p0[1] + uy * s_), (p0[0] + ux * e, p0[1] + uy * e)], fill=color, width=width)
        s_ += seg
        i += 1


def dash_poly(pen, pts, color, width=1.4, pattern=(8, 6)):
    for a, b in zip(pts, pts[1:]):
        dash_line(pen, a, b, color, width, pattern)


def quad_plan(pl, T, church_dx=0.0, ang=45.0, tone=0.62):
    """Schematic Main Quad footprint in local units (x across, y down; entrance at +y): a ring of buildings round
    the long inner court, an outer ring, and the church's cross plan at the head of the court."""
    pen = Pen(pl.lines)
    ink = SEPIA + (235,)

    def ring(o, i, gap_top=0.0, gap_bot=0.0):
        ox, oy = o
        ix, iy = i
        pts_o = [T(-ox, -oy), T(ox, -oy), T(ox, oy), T(-ox, oy)]
        pts_i = [T(-ix, -iy), T(ix, -iy), T(ix, iy), T(-ix, iy)]
        m = poly_mask(pts_o)
        Pen(m).poly(pts_i, fill=0)
        if gap_bot:
            Pen(m).poly([T(-gap_bot, iy - 1), T(gap_bot, iy - 1), T(gap_bot, oy + 1), T(-gap_bot, oy + 1)], fill=0)
        pl.region(m, Image.new("L", m.size, int(tone * 255)), ang, (226, 170, 116), None, 6.0)
        return pts_o, pts_i

    o1, i1 = ring((150, 88), (130, 70), gap_bot=10)
    o2, i2 = ring((100, 50), (84, 36), gap_bot=8)
    for pts in (o1, i1, o2, i2):
        pen.line(pts + [pts[0]], fill=ink, width=1.6)
    # arcade line round the inner court
    dash_poly(pen, [T(-80, -32), T(80, -32), T(80, 32), T(-80, 32), T(-80, -32)], SEPIA + (150,), 1.1, (5, 4))
    # church: nave from the court edge out through the rings, transepts, rounded apse
    cx = church_dx
    nave = [(cx - 13, -36), (cx + 13, -36), (cx + 13, -78), (cx + 30, -78), (cx + 30, -98), (cx + 13, -98),
            (cx + 13, -110), (cx - 13, -110), (cx - 13, -98), (cx - 30, -98), (cx - 30, -78), (cx - 13, -78)]
    apse = [(cx + 13 * math.cos(a), -110 - 13 * math.sin(a)) for a in np.linspace(0, math.pi, 14)]
    shape = [T(*p) for p in nave[:7]] + [T(*p) for p in apse] + [T(*p) for p in nave[7:]]
    pl.poly(shape, 0.85, ang + 90, (214, 112, 74), None, 5.0)
    pen.line(shape + [shape[0]], fill=SEPIA + (255,), width=2.0)
    return T(cx, -110), T(cx, -36)


def contour_layer(hfield, step, color, clip, width=1.2, index_every=4):
    """Iso-lines of a height field (in card px units of height) drawn at a constant line width."""
    gy, gx = np.gradient(hfield)
    g = np.sqrt(gx * gx + gy * gy) + 1e-6          # height per SS pixel
    q = hfield / step
    d = np.abs(q - np.round(q)) * step / g / SS      # distance to the nearest contour, card px
    major = (np.round(q).astype(int) % index_every) == 0
    w = np.where(major, width * 1.5, width)
    a = np.clip((w / 2 - d) * SS + 0.5, 0, 1) * np.where(major, 1.0, 0.6)
    a *= np.asarray(clip, np.float32) / 255.0
    lay = Image.new("RGBA", (W * SS, H * SS), color[:3] + (0,))
    lay.putalpha(Image.fromarray((a * color[3]).astype(np.uint8), "L"))
    return lay


def terrain(x0, y0, x1, y1, flat_below=None, seed=0):
    """Foothills rising toward the top of a panel: a slope, two spurs and a valley between them."""
    X, Y = _XX, _YY
    u = (X - x0) / (x1 - x0)
    v = (Y - y0) / (y1 - y0)
    h = (1 - v) * 260.0
    h += 70 * np.exp(-(((u - 0.22) / 0.16) ** 2 + ((v - 0.25) / 0.45) ** 2))
    h += 90 * np.exp(-(((u - 0.86) / 0.2) ** 2 + ((v - 0.18) / 0.5) ** 2))
    h -= 55 * np.exp(-(((u - 0.55) / 0.1) ** 2) - ((v - 0.1) / 0.6) ** 2)
    h += 16 * (noise(40 + seed, 60, 2) - 0.5)
    if flat_below is not None:
        vf = (flat_below - y0) / (y1 - y0)
        wgt = np.clip((vf - v) / vf, 0, 1) ** 1.6
        h = (h - (1 - vf) * 260.0) * wgt + 6.0      # the valley floor sits between two contour levels
    return h


def scene1(th):
    pl = Plate(6.0)
    pen = Pen(pl.lines)
    panels = ((54, 112, 450, 556), (466, 112, 862, 556))
    rule = SEPIA + (190,)
    for (x0, y0, x1, y1) in panels:
        pen.rect((x0, y0, x1, y1), outline=rule, width=1.4)
        pen.rect((x0 + 6, y0 + 6, x1 - 6, y1 - 6), outline=SEPIA + (90,), width=1.0)
    contour = (132, 96, 64, 200)
    # left: foothills everywhere; the Quad turned to sit along a contour, church off its centre line
    lx0, ly0, lx1, ly1 = panels[0]
    clip = poly_mask([(lx0 + 8, ly0 + 8), (lx1 - 8, ly0 + 8), (lx1 - 8, ly1 - 8), (lx0 + 8, ly1 - 8)])
    over(pl.lines, contour_layer(terrain(lx0, ly0, lx1, ly1), 12.0, contour, clip))
    T = _plan_T(250, 352, 0.92, -14)
    # clear the contours under the building footprint so the plan reads on top
    knock = poly_mask([T(-158, -128), T(158, -128), T(158, 96), T(-158, 96)])
    pl.lines = clip_to(pl.lines, Image.fromarray(255 - np.asarray(blur(knock, 3)), "L"))
    pen = Pen(pl.lines)
    for (x0, y0, x1, y1) in panels[:1]:
        pen.rect((x0, y0, x1, y1), outline=rule, width=1.4)
        pen.rect((x0 + 6, y0 + 6, x1 - 6, y1 - 6), outline=SEPIA + (90,), width=1.0)
    quad_plan(pl, T, church_dx=62)
    dash_line(Pen(pl.lines), T(0, -150), T(0, 110), (190, 84, 40, 170), 1.6)
    # right: hills only beyond; a flat site with one axis running through the entrance to the church
    rx0, ry0, rx1, ry1 = panels[1]
    clip = poly_mask([(rx0 + 8, ry0 + 8), (rx1 - 8, ry0 + 8), (rx1 - 8, ry1 - 8), (rx0 + 8, ry1 - 8)])
    over(pl.lines, contour_layer(terrain(rx0, ry0, rx1, ry1, flat_below=ry0 + 96), 12.0, contour, clip))
    T2 = _plan_T(664, 362, 0.92, 0)
    quad_plan(pl, T2, church_dx=0)
    ax = new()
    pa = Pen(ax)
    dash_line(pa, (664, ry0 + 84), (664, ry1 - 8), (196, 78, 32, 255), 2.8, (22, 6, 4, 6))
    over(pl.lines, ax)
    paper = shade(vgrad(28, 694, [(0, (226, 214, 188)), (1, (204, 188, 158))], box_mask()), 0.94 + 0.1 * noise(3, 40, 3))
    hero = pl.render(0.9 + 0.2 * noise(3, 30, 2), backdrop=paper, floor=0.5, line_k=0.12)
    lf = font(("georgia.ttf", None), 22)
    for (x0, y0, x1, y1), label in zip(panels, ("OLMSTED", "STANFORD")):
        cx = (x0 + x1) / 2
        tw = text_width(label, lf, 4.0)
        bg = mask()
        Pen(bg).rect((cx - tw / 2 - 14, y1 - 46, cx + tw / 2 + 14, y1 - 12), fill=255)
        over(hero, fill(bg, (220, 206, 178, 255)))
        text(hero, (cx, y1 - 29), label, lf, SEPIA + (255,), tracking=4.0, anchor="mm")
    return hero


def _plan_T(ox, oy, s, deg):
    a = math.radians(deg)

    def T(x, y):
        return (ox + s * (x * math.cos(a) - y * math.sin(a)), oy + s * (x * math.sin(a) + y * math.cos(a)))
    return T


# ---------------------------------------------------------------------------------------------------------------
# 2  1906: the Memorial Arch, drawn dashed as demolished work, over the two bases that remain

def scene2(th):
    pl = Plate(7.0)
    Z0 = 54.0
    cam = Cam(458, 508, 840, eye=4.0)
    L = (-0.42, 0.68, -0.6)
    # ground: paving receding to the entrance
    gr_t = vgrad(508, 694, [(0, (150, 150, 150, 255)), (1, (100, 100, 100, 255))]).getchannel("R")
    pl.region(poly_mask([(28, 508), (888, 508), (888, 694), (28, 694)]), gr_t, 0.0, (240, 210, 164), (120, 96, 70, 18),
              6.0)
    for k in range(-14, 15):
        X = k * 3.0
        pl.joint([cam(X, 0, Z0 - 2), cam(X * 1.0, 0, 6.0)], 1.0)
    for Z in (50, 46.5, 43.3, 40.3, 37.5, 35, 32.7, 30.5, 28.5, 26.6):
        pl.joint([cam(-60, 0, Z), cam(60, 0, Z)], 1.0)
    # the court beyond the entrance, quieter than the forecourt
    pl.poly([cam(-40, 0, Z0), cam(40, 0, Z0), cam(40, 0, 400), cam(-40, 0, 400)], 0.4, 0.0, (240, 210, 164), None, 6.0)
    # Outer Quad front ranges either side of the entrance
    right = Wing(cam, (13.0, Z0), (1.0, 0.0), (0.0, 1.0))
    left = Wing(cam, (-44.0, Z0), (1.0, 0.0), (0.0, 1.0))
    for wing, u0, u1, n, seed, inner in ((left, 0.0, 31.0, 7, 21, 31.0), (right, 0.0, 31.0, 7, 22, 0.0)):
        info = arcade_wing(pl, wing, u0, u1, n, L, seed=seed, shadow_open=True, ext=0.3)
        paint_wall(pl, wing, info, u0, u1, seed=seed, wash=(176, 130, 84, 40))
        paint_columns(pl, wing, info, L)
        # hipped where the range meets the arch: the ridge stops short of the inner end
        hip = 7.0 if inner else -7.0
        r_in = wing.pt(inner - hip, 9.6, 6.5)
        r_out = wing.pt(u0 - 2 if inner else u1 + 2, 9.6, 6.5)
        e_in = wing.pt(inner, 6.1, -0.55)
        e_out = wing.pt(u0 - 2 if inner else u1 + 2, 6.1, -0.55)
        if inner:
            paint_roof(pl, wing, L, u0 - 2, inner, eave_pts=(e_out, e_in), ridge_pts=(r_out, r_in))
        else:
            paint_roof(pl, wing, L, inner, u1 + 2, eave_pts=(e_in, e_out), ridge_pts=(r_in, r_out))
    # the two surviving bases: rock-faced blocks with a plinth and a cap, inner faces turned toward the opening
    P = lambda X, h, z=0.0: cam(X, h, Z0 + z)
    for sgn in (-1, 1):
        xa, xb = sorted((sgn * 6.0, sgn * 13.0))
        inner = xa if sgn > 0 else xb
        # inner side face (in shade) and the sunlit top where the arch once rose
        pl.poly([P(inner, 0), P(inner, 0, 6.0), P(inner, 3.1, 6.0), P(inner, 3.1)], 0.12, 90.0, STONE_SHADE)
        pl.poly([P(xa, 3.6, -0.25), P(xb, 3.6, -0.25), P(xb, 3.6, 6.0), P(xa, 3.6, 6.0)], 0.9, 0.0, STONE,
                (200, 150, 96, 70))
        for zz in (1.4, 3.0, 4.6):
            pl.joint([P(xa, 3.6, zz), P(xb, 3.6, zz)], 1.0)
        for xx in np.linspace(xa, xb, 4)[1:-1]:
            pl.joint([P(xx, 3.6, -0.25), P(xx, 3.6, 6.0)], 1.0)
        base = Wing(cam, (xa, Z0), (1.0, 0.0), (0.0, 1.0))
        bw = xb - xa
        lit = lambert((0, 0, -1), L)
        info = dict(wall=poly_mask([P(xa, 0), P(xb, 0), P(xb, 3.1), P(xa, 3.1)]), centres=[], halfo=0.0,
                    wall_tone=0.2 + 0.7 * lit, ang_course=0.0)
        paint_wall(pl, base, info, 0, bw, eave=3.1, course=0.6, seed=30 + sgn, wash=(190, 140, 90, 60))
        # plinth and cap mouldings
        pl.poly([P(xa - 0.35, 0, -0.35), P(xb + 0.35, 0, -0.35), P(xb + 0.35, 0.9, -0.35), P(xa - 0.35, 0.9, -0.35)],
                0.62, 0.0, STONE, (190, 140, 90, 60))
        pl.joint([P(xa - 0.35, 0.9, -0.35), P(xb + 0.35, 0.9, -0.35)], 1.4)
        pl.poly([P(xa - 0.25, 3.1, -0.25), P(xb + 0.25, 3.1, -0.25), P(xb + 0.25, 3.6, -0.25), P(xa - 0.25, 3.6, -0.25)],
                0.82, 0.0, STONE, (190, 140, 90, 60))
        pl.stroke([P(xa - 0.25, 3.6, -0.25), P(xb + 0.25, 3.6, -0.25)], (255, 240, 210, 230), 1.6)
        pl.stroke([P(xa - 0.35, 0, -0.35), P(xa - 0.35, 0.9, -0.35), P(xa, 0.9), P(xa, 3.1), P(xa - 0.25, 3.1, -0.25),
                   P(xa - 0.25, 3.6, -0.25), P(xb + 0.25, 3.6, -0.25), P(xb + 0.25, 3.1, -0.25), P(xb, 3.1), P(xb, 0.9),
                   P(xb + 0.35, 0.9, -0.35), P(xb + 0.35, 0, -0.35)], COPPER + (235,), 2.0)
    hero = pl.render(0.84 + 0.3 * noise(12, 26, 3), backdrop=dusk_sky(508))
    # the lost arch: a faint ghost of its mass and a dashed draftsman's elevation of every edge
    ghost = Plate(7.0)
    gm = poly_mask([P(-13, 3.6), P(13, 3.6), P(13, 25), P(13.6, 25), P(13.6, 26.2), P(13, 26.2), P(13, 29.5),
                    P(-13, 29.5), P(-13, 26.2), P(-13.6, 26.2), P(-13.6, 25), P(-13, 25)])
    Pen(gm).poly([P(6, 3.6)] + [P(6 * math.cos(math.pi * i / 40), 13 + 6 * math.sin(math.pi * i / 40))
                                for i in range(41)] + [P(-6, 3.6)], fill=0)
    ghost.region(gm, Image.new("L", gm.size, 22), 45.0, (255, 255, 255))
    over(hero, fill(gm, (255, 250, 240, 46)))
    over(hero, ghost.render(lit=False))
    d = new()
    pd = Pen(d)
    ink = (255, 255, 255, 240)
    dpat = (9, 6)

    def dl(pts, w=1.6, pat=dpat, col=ink):
        dash_poly(pd, [P(*q) for q in pts], col, w, pat)
    dl([(-13, 3.6), (-13, 25), (-13.6, 25), (-13.6, 26.2), (-13, 26.2), (-13, 29.5), (13, 29.5), (13, 26.2),
        (13.6, 26.2), (13.6, 25), (13, 25), (13, 3.6)], 2.0)
    for r, w in ((6.0, 2.0), (7.4, 1.4)):
        dl([(r * math.cos(math.pi * i / 40), 13 + r * math.sin(math.pi * i / 40)) for i in range(41)], w)
    dl([(-6, 3.6), (-6, 13)], 2.0)
    dl([(6, 3.6), (6, 13)], 2.0)
    for X0, X1 in ((-13, -6), (6, 13)):
        dl([(X0, 12.3), (X1, 12.3)], 1.3)
        dl([(X0, 13.0), (X1, 13.0)], 1.3)
    # voussoirs, dotted
    for i in range(1, 17):
        t = math.pi * i / 17
        dl([(6 * math.cos(t), 13 + 6 * math.sin(t)), (7.4 * math.cos(t), 13 + 7.4 * math.sin(t))], 1.1, (3, 4))
    # frieze band and the attic above the cornice
    for hh in (21.0, 25.0):
        dl([(-13, hh), (13, hh)], 1.4)
    dl([(-13.6, 26.2), (13.6, 26.2)], 1.4)
    for X in (-6.5, 6.5):
        dl([(X, 26.2), (X, 29.5)], 1.1, (3, 4))
    over(hero, d)
    return clip_to(hero, box_mask())


# ---------------------------------------------------------------------------------------------------------------
# 3  Class Day: plaques in the Inner Quad arcade paving, and a time capsule in the ground below (section-perspective)

def scene3(th):
    pl = Plate(7.0)
    cam = Cam(540, 168, 600, eye=1.8)
    ZC = 3.9                                   # the section plane: everything nearer is cut away
    XI, XO, XB = -1.9, -2.65, 1.9              # colonnade inner / outer face, back wall
    EAVE, SPRING, BAY = 4.6, 2.6, 4.1
    L = (-0.62, 0.7, -0.36)
    P = cam
    # the sunlit courtyard seen through the arches: an even field of light
    pl.poly([P(-60, 0, ZC), P(XO, 0, ZC), P(XO, 0, 400), P(-60, 0, 400)], 0.6, 0.0, (240, 222, 186), (150, 116, 80, 30))
    for X in np.arange(-5.0, -34.0, -3.0):
        pl.joint([P(X, 0, ZC + 0.5), P(X, 0, 120)], 1.6)
    for Zg in np.arange(ZC + 1.0, 60.0, 3.0):
        pl.joint([P(-34, 0, Zg), P(XO, 0, Zg)], 1.4)
    opp = Wing(cam, (-34.0, 120.0), (0.0, -1.0), (-1.0, 0.0))
    oi = arcade_wing(pl, opp, 0.0, 117.0, 28, L, seed=43, ext=0.3)
    paint_wall(pl, opp, oi, 0.0, 117.0, seed=43, wash=(176, 130, 84, 30))
    paint_roof(pl, opp, L, 0.0, 117.0)
    # walk floor, paving joints
    pl.poly([P(XI, 0, ZC), P(XB, 0, ZC), P(XB, 0, 300), P(XI, 0, 300)], 0.06, 0.0, (240, 210, 164), (120, 96, 70, 24))
    for X in (-0.8, 1.0):
        pl.joint([P(X, 0, ZC), P(X, 0, 120)], 1.0)
    z = ZC + 0.6
    while z < 80:
        pl.joint([P(XI, 0, z), P(XB, 0, z)], 1.0)
        z += 1.2
    centres = [ZC - 0.9 + BAY * (k + 0.5) for k in range(12)]
    halfo = (BAY - 0.75) / 2
    # sun through each arch onto the floor
    lx, lz = -L[0] / L[1], -L[2] / L[1]
    for c in centres:
        pts = [(c - halfo, 0.0)] + [(c - halfo * math.cos(math.pi * i / 24), SPRING + halfo * math.sin(math.pi * i / 24))
                                    for i in range(25)] + [(c + halfo, 0.0)]
        fl = []
        for (zz, h) in pts:
            X = min(XB, XO + lx * h)
            fl.append(P(max(XI, X), 0, max(ZC, zz + lz * h)))
        pl.poly(fl, 0.42, 0.0, STONE)
    # class plaques: plain bronze rectangles in a line down the walk
    zp = ZC + 0.35
    k = 0
    while zp < 60:
        q = [P(-0.36, 0, zp), P(0.36, 0, zp), P(0.36, 0, zp + 0.5), P(-0.36, 0, zp + 0.5)]
        pl.poly(q, 0.78, 0.0, BRONZE, (150, 90, 40, 90), 5.0)
        if zp < 20:
            pl.stroke(q + [q[0]], (255, 214, 150, 200), 1.4 if zp < 8 else 1.0)
        zp += 1.55
        k += 1
    # back wall: rock-faced stone with arched doorways
    back = Wing(cam, (XB, 0.0), (0.0, 1.0), (1.0, 0.0))
    doors = [ZC + 2.0 + BAY * k for k in range(14)]
    wall = poly_mask([back.pt(ZC, 0), back.pt(200, 0), back.pt(200, EAVE), back.pt(ZC, EAVE)])
    for c in doors:
        Pen(wall).poly(back.opening(c - 0.7, c + 0.7, 2.2), fill=0)
    pl.poly([back.pt(ZC, 0, 0.4), back.pt(200, 0, 0.4), back.pt(200, EAVE, 0.4), back.pt(ZC, EAVE, 0.4)], 0.0, 90.0,
            STONE_SHADE)
    info = dict(wall=wall, centres=doors, halfo=0.7, wall_tone=0.3, ang_course=angle_of(back.pt(ZC, 1.0), back.pt(30, 1.0)))
    paint_wall(pl, back, info, ZC, 200, spring=2.2, eave=EAVE, course=0.46, seed=41, wash=(176, 130, 84, 34))
    # ceiling: dark, with the line where it meets the wall
    pl.poly([P(XO, EAVE, ZC), P(XB, EAVE, ZC), P(XB, EAVE, 300), P(XO, EAVE, 300)], 0.0, 0.0)
    pl.stroke([back.pt(ZC, EAVE), back.pt(120, EAVE)], STONE_SHADE + (120,), 1.2)
    # the colonnade: reveals (the faces of each pier turned toward us) then the inner face with the arches cut
    col = Wing(cam, (XI, 0.0), (0.0, 1.0), (-1.0, 0.0))
    rev, hole = mask(), mask()
    for c in centres:
        Pen(rev).poly(col.opening(c - halfo, c + halfo, SPRING, 0.0), fill=255)
        Pen(hole).poly(col.opening(c - halfo, c + halfo, SPRING, 0.75), fill=255)
    rev = Image.fromarray(np.clip(np.asarray(rev, np.float32) - np.asarray(hole, np.float32), 0, 255).astype(np.uint8), "L")
    pl.region(rev, Image.new("L", rev.size, 40), 90.0, STONE, (176, 130, 84, 40))
    cw = poly_mask([col.pt(ZC, 0), col.pt(200, 0), col.pt(200, EAVE), col.pt(ZC, EAVE)])
    for c in centres:
        Pen(cw).poly(col.opening(c - halfo, c + halfo, SPRING, 0.0), fill=0)
    ci = dict(wall=cw, centres=centres, halfo=halfo, wall_tone=0.09, ang_course=angle_of(col.pt(ZC, 3.5), col.pt(30, 3.5)))
    paint_wall(pl, col, ci, ZC, 200, spring=SPRING, eave=EAVE, course=0.46, seed=42, wash=(176, 130, 84, 30))
    for c in centres:
        pl.stroke(col.arch(c, SPRING, halfo, 0.75), (255, 232, 196, 170), 1.3)
    # --- the section through the near end -------------------------------------------------------------------
    y0 = P(0, 0, ZC)[1]
    xl, xr = 28, 888
    sx = lambda X: P(X, 0, ZC)[0]
    sy = lambda h: P(0, h, ZC)[1]
    deep = -1.5
    # soil below the paving
    pl.poly([(xl, sy(-0.16)), (xr, sy(-0.16)), (xr, sy(deep)), (xl, sy(deep))], 0.22, 0.0, (210, 182, 146), (90, 66, 48, 30), 6.0)
    rng = random.Random(7)
    for _ in range(40):
        x, h = rng.uniform(xl + 10, xr - 10), rng.uniform(deep + 0.1, -0.3)
        if abs(x - sx(0.06)) < 140 and -1.15 < h < -0.38:
            continue
        r = rng.uniform(3, 8)
        pl.poly([(x + r * math.cos(t), sy(h) + 0.7 * r * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 12)],
                0.0, 0.0)
        pl.stroke([(x + r * math.cos(t), sy(h) + 0.7 * r * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 13)],
                  (220, 196, 160, 150), 1.0)
    # paving slab and the two wall footings, cut and hatched
    pl.poly([(xl, y0), (xr, y0), (xr, sy(-0.16)), (xl, sy(-0.16))], 0.5, 45.0, STONE, (176, 130, 84, 60), 5.0)
    for (X0, X1) in ((XO - 0.15, XI + 0.15), (XB - 0.1, XB + 0.85)):
        pl.poly([(sx(X0), sy(-0.16)), (sx(X1), sy(-0.16)), (sx(X1), sy(-1.0)), (sx(X0), sy(-1.0))], 0.3, 45.0, STONE,
                (176, 130, 84, 60), 5.0)
        pl.stroke([(sx(X0), sy(-0.16)), (sx(X0), sy(-1.0)), (sx(X1), sy(-1.0)), (sx(X1), sy(-0.16))],
                  (255, 236, 206, 200), 1.4)
    for X in np.arange(-6.0, 6.0, 1.2):
        pl.joint([(sx(X), y0), (sx(X), sy(-0.16))], 1.2)
    # the back wall's cut end, outlined
    pl.poly([(sx(XB), 28), (sx(XB + 0.7), 28), (sx(XB + 0.7), y0), (sx(XB), y0)], 0.3, 45.0, STONE, (176, 130, 84, 50), 5.0)
    pl.stroke([(sx(XB), 28), (sx(XB), y0)], (255, 236, 206, 220), 1.6)
    # the time capsule, cut through, under the nearest plaque: a plain sealed box (its real form is not recorded here)
    cx0, cx1, ch0, ch1 = sx(-0.4), sx(0.4), sy(-0.42), sy(-0.95)
    rr = 7
    box = []
    for (qx, qy, a0) in ((cx1 - rr, ch0 + rr, -90), (cx1 - rr, ch1 - rr, 0), (cx0 + rr, ch1 - rr, 90), (cx0 + rr, ch0 + rr, 180)):
        box += [(qx + rr * math.cos(math.radians(a0 + 90 * i / 6)), qy + rr * math.sin(math.radians(a0 + 90 * i / 6)))
                for i in range(7)]
    pl.poly(box, 0.34, 90.0, (224, 228, 230), (120, 120, 120, 40))
    pl.stroke(box + [box[0]], (242, 244, 246, 255), 1.8)
    # section line along the cut edge of the paving
    pl.stroke([(xl, y0), (xr, y0)], (255, 240, 214, 255), 2.0)
    return pl.render(0.86 + 0.28 * noise(13, 26, 3), backdrop=dusk_sky(168))


SCENES = (scene0, scene1, scene2, scene3)

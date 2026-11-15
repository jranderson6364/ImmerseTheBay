"""Detailed schematic diagrams for the start-point corner buildings: Varian Physics, Spilker and Moore.

Huang is the fourth corner and has its own deck. Each drawing shows only an object or idea named in that card's
narration segment (tools/narration/narration.json). They are labelled-free diagrams, not reconstructions.
Card 0 of each deck carries an animated hologram (tools/render_holograms.py) over the illustration area, so its
static drawing is only a light frame that the video sits inside.

Canvas: the 1200 x 1280 story card. The illustration area is about x 110-810, y 230-720.
"""

import math

C = (245, 169, 103, 235)      # copper, the deck's line colour
PALE = (248, 239, 226, 235)   # warm white
BLUE = (116, 194, 242, 235)   # beams, signals, fields
DIM = (245, 169, 103, 110)    # copper at low strength, for construction lines
FAINT = (248, 239, 226, 90)

CORNER_IDS = ("varian", "spilker", "moore")


def _frame(d):
    """Corner brackets around the hologram window on card 0 (the video quad covers about x 120-820, y 251-644)."""
    for (x, y, sx, sy) in ((126, 258, 1, 1), (814, 258, -1, 1), (126, 638, 1, -1), (814, 638, -1, -1)):
        d.line((x, y, x + 46 * sx, y), fill=C, width=5)
        d.line((x, y, x, y + 46 * sy), fill=C, width=5)
    d.line((150, 690, 790, 690), fill=DIM, width=3)
    for x in range(170, 790, 40):
        d.line((x, 684, x, 696), fill=DIM, width=2)


def _dashes(d, a, b, color, width=3, dash=14, gap=10):
    (x0, y0), (x1, y1) = a, b
    n = math.hypot(x1 - x0, y1 - y0)
    if n == 0:
        return
    ux, uy = (x1 - x0) / n, (y1 - y0) / n
    s = 0.0
    while s < n:
        e = min(n, s + dash)
        d.line((x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e), fill=color, width=width)
        s += dash + gap


def _arrow(d, a, b, color, width=5, head=18):
    (x0, y0), (x1, y1) = a, b
    d.line((x0, y0, x1, y1), fill=color, width=width)
    ang = math.atan2(y1 - y0, x1 - x0)
    p1 = (x1 - head * math.cos(ang - 0.45), y1 - head * math.sin(ang - 0.45))
    p2 = (x1 - head * math.cos(ang + 0.45), y1 - head * math.sin(ang + 0.45))
    d.polygon([(x1, y1), p1, p2], fill=color)


def _dot(d, x, y, r, color):
    d.ellipse((x - r, y - r, x + r, y + r), fill=color)


def _ring(d, x, y, r, color, width=4):
    d.ellipse((x - r, y - r, x + r, y + r), outline=color, width=width)


def _person(d, x, y, h, color, width=4):
    """A simple standing figure, feet at (x, y), height h."""
    r = h * 0.12
    _ring(d, x, y - h + r, r, color, width)
    d.line((x, y - h + 2 * r, x, y - h * 0.42), fill=color, width=width)
    d.line((x - h * 0.2, y - h * 0.62, x + h * 0.2, y - h * 0.62), fill=color, width=width)
    d.line((x, y - h * 0.42, x - h * 0.15, y), fill=color, width=width)
    d.line((x, y - h * 0.42, x + h * 0.15, y), fill=color, width=width)


# -------------------------------------------------------------------------------------------------------------
# Varian Physics


def varian_klystron(d):
    """Segment 1: the 1937 klystron, in cutaway. Cathode, buncher cavity, drift tube, catcher cavity, collector."""
    cy = 470
    # Drift tube walls (cutaway: top and bottom edges only).
    d.line((250, cy - 34, 700, cy - 34), fill=C, width=6)
    d.line((250, cy + 34, 700, cy + 34), fill=C, width=6)
    # Cathode block and heater.
    d.rounded_rectangle((150, cy - 70, 250, cy + 70), radius=10, outline=C, width=7)
    d.line((236, cy - 40, 236, cy + 40), fill=PALE, width=7)
    for k in range(4):
        y = cy - 48 + k * 32
        d.arc((166, y, 206, y + 28), 90, 270, fill=FAINT, width=3)
    # Cavities: buncher (left) and catcher (right), drawn as toroids around the tube.
    for x, glow in ((340, False), (590, True)):
        d.rounded_rectangle((x - 42, cy - 118, x + 42, cy - 34), radius=22, outline=C, width=6)
        d.rounded_rectangle((x - 42, cy + 34, x + 42, cy + 118), radius=22, outline=C, width=6)
        d.line((x - 10, cy - 34, x - 10, cy - 20), fill=C, width=5)
        d.line((x + 10, cy - 34, x + 10, cy - 20), fill=C, width=5)
        d.line((x - 10, cy + 34, x - 10, cy + 20), fill=C, width=5)
        d.line((x + 10, cy + 34, x + 10, cy + 20), fill=C, width=5)
        if glow:
            for r in (54, 74):
                d.arc((x - r, cy - 118 - r * 0.2, x + r, cy - 34 + r * 0.2), 200, 340, fill=BLUE, width=3)
    # Input loop on the buncher, output waveguide rising from the catcher.
    d.line((340, cy + 118, 340, cy + 168), fill=PALE, width=5)
    d.arc((318, cy + 150, 362, cy + 194), 0, 360, fill=PALE, width=4)
    d.rectangle((572, 262, 608, cy - 118), outline=PALE, width=5)
    for k in range(3):
        y = 300 - k * 22
        d.arc((560, y - 14, 620, y + 14), 200, 340, fill=BLUE, width=4)
    # Collector.
    d.polygon([(700, cy - 56), (782, cy - 56), (800, cy - 30), (800, cy + 30), (782, cy + 56), (700, cy + 56)], outline=C, width=7)
    for k in range(4):
        d.line((720 + k * 18, cy - 46, 720 + k * 18, cy + 46), fill=DIM, width=3)
    # Electron beam: even before the buncher, bunched by the catcher.
    for k in range(6):
        _dot(d, 262 + k * 14, cy, 6, BLUE)
    bunch_centres = (420, 488, 556, 640)
    for b, bx in enumerate(bunch_centres):
        spread = 26 - b * 6
        for k in range(5):
            _dot(d, bx + (k - 2) * spread / 2, cy + ((k % 2) * 2 - 1) * 3, 6, BLUE if b < 3 else PALE)
    # A sine wave under the tube: the field the buncher puts on the beam.
    pts = [(x, cy + 214 + 18 * math.sin((x - 300) / 40)) for x in range(300, 690, 6)]
    d.line(pts, fill=DIM, width=3)


def varian_plaque(d):
    """Segment 2: the APS plaque honours NMR (Bloch) and electron scattering (Hofstadter). Two panels."""
    # Left panel: a spinning nucleus precessing in a magnet, with the RF coil around it.
    d.rounded_rectangle((132, 270, 460, 690), radius=20, outline=DIM, width=3)
    # Magnet poles.
    d.rectangle((180, 300, 412, 350), outline=C, width=6)
    d.rectangle((180, 612, 412, 662), outline=C, width=6)
    for x in range(200, 400, 34):
        _arrow(d, (x, 360), (x, 600), FAINT, width=2, head=10)
    # Precession cone.
    cx, cy = 296, 486
    d.ellipse((236, 392, 356, 424), outline=BLUE, width=3)
    d.line((cx, cy, 236, 408), fill=DIM, width=2)
    d.line((cx, cy, 356, 408), fill=DIM, width=2)
    _arrow(d, (cx, cy), (338, 400), BLUE, width=6, head=20)
    _dot(d, cx, cy, 26, PALE)
    d.arc((cx - 40, cy - 14, cx + 40, cy + 14), 200, 340, fill=C, width=4)
    # RF coil turns.
    for k in range(4):
        x = 214 + k * 18
        d.arc((x, 500, x + 24, 580), 90, 270, fill=C, width=4)
    d.arc((340, 500, 388, 580), 270, 90, fill=PALE, width=3)
    d.arc((356, 516, 404, 564), 270, 90, fill=PALE, width=3)
    # Right panel: an electron beam scattering off a nucleus.
    d.rounded_rectangle((480, 270, 808, 690), radius=20, outline=DIM, width=3)
    nx, ny = 674, 480
    for r in (70, 50):
        _ring(d, nx, ny, r, FAINT, 2)
    for k in range(7):
        ang = (k * 51 + 20) * math.pi / 180
        _dot(d, nx + 14 * math.cos(ang), ny + 14 * math.sin(ang), 11, C if k % 2 else PALE)
    for k in range(5):
        y = 420 + k * 30
        _arrow(d, (504, y), (606, y), BLUE, width=4, head=14)
    for ang in (-62, -32, 0, 28, 58):
        a = ang * math.pi / 180
        _dashes(d, (nx + 76 * math.cos(a), ny + 76 * math.sin(a)), (nx + 128 * math.cos(a), ny + 128 * math.sin(a)), BLUE, 4, 10, 8)
    # A detector arm on an arc, as in a scattering experiment.
    d.arc((nx - 128, ny - 128, nx + 128, ny + 128), -80, 80, fill=DIM, width=3)
    a = -32 * math.pi / 180
    d.rectangle((nx + 132 * math.cos(a) - 14, ny + 132 * math.sin(a) - 22, nx + 132 * math.cos(a) + 14, ny + 132 * math.sin(a) + 22), outline=PALE, width=4)


def varian_linac(d):
    """Segment 3: the 1947 linear accelerator. Electrons gain energy cavity by cavity; spacing grows as they speed up."""
    cy = 470
    # The tube with a chain of disc-loaded cavities, drawn in perspective so it recedes to the right.
    x = 150
    gap = 44
    xs = []
    while x < 790:
        xs.append(x)
        x += gap
        gap += 6
    d.line((140, cy - 30, 800, cy - 22), fill=C, width=5)
    d.line((140, cy + 30, 800, cy + 22), fill=C, width=5)
    for i, x in enumerate(xs):
        h = 80 - i * 3
        d.line((x, cy - h, x, cy - 30 + i * 0.6), fill=C, width=5)
        d.line((x, cy + 30 - i * 0.6, x, cy + h), fill=C, width=5)
        d.line((x - 8, cy - h, x + 8, cy - h), fill=C, width=5)
        d.line((x - 8, cy + h, x + 8, cy + h), fill=C, width=5)
    # Electron positions at equal time steps: farther apart as they speed up.
    p = 160.0
    step = 18.0
    for k in range(14):
        _dot(d, p, cy, 7, BLUE if k < 10 else PALE)
        p += step
        step *= 1.22
        if p > 780:
            break
    # Microwave feed: a waveguide on top, with the wave travelling along it.
    d.rectangle((150, 300, 520, 334), outline=PALE, width=4)
    pts = [(xx, 317 + 11 * math.sin((xx - 150) / 22)) for xx in range(156, 516, 4)]
    d.line(pts, fill=BLUE, width=3)
    d.line((338, 334, 338, cy - 70), fill=PALE, width=4)
    # Energy rising: a ramp under the tube.
    d.line((150, 680, 790, 680), fill=DIM, width=3)
    d.line((150, 680, 790, 590), fill=C, width=5)
    for k in range(1, 6):
        xx = 150 + k * 128
        d.line((xx, 672, xx, 688), fill=DIM, width=3)
    _arrow(d, (720, 640), (800, 586), C, width=5, head=18)


# -------------------------------------------------------------------------------------------------------------
# Spilker


def spilker_growth(d):
    """Segment 1: Stanford Telecommunications grew from 3 people to about 1,300, without venture capital."""
    # Three founders on the left.
    for k in range(3):
        _person(d, 200 + k * 54, 610, 150, PALE, 5)
    d.line((150, 616, 352, 616), fill=C, width=5)
    _arrow(d, (372, 520), (470, 520), C, width=6, head=22)
    # A field of small figures on the right, growing in rows (each dot stands for many people; not a count).
    rows = 9
    for r in range(rows):
        n = 4 + r
        for k in range(n):
            x = 500 + k * (300 / 12)
            y = 296 + r * 38
            if x > 800:
                continue
            col = PALE if (r + k) % 5 else C
            _dot(d, x, y, 6, col)
            d.line((x, y + 8, x, y + 20), fill=col, width=3)
    # A rising curve behind them.
    pts = [(500 + t * 300, 650 - 330 * (t ** 2.2)) for t in [i / 40 for i in range(41)]]
    d.line(pts, fill=BLUE, width=4)
    d.line((490, 660, 810, 660), fill=C, width=5)
    d.line((490, 660, 490, 290), fill=DIM, width=3)


def spilker_underground(d):
    """Segment 2: Applied Physics and the Ginzton Lab, with much of the lab space underground to control vibration."""
    gy = 400
    # Ground line with hatching, and the building above it.
    d.line((120, gy, 800, gy), fill=C, width=6)
    for x in range(126, 800, 22):
        d.line((x, gy + 2, x - 12, gy + 16), fill=DIM, width=2)
    d.rectangle((250, 262, 700, gy), outline=C, width=6)
    for k in range(5):
        d.rectangle((280 + k * 82, 290, 330 + k * 82, 360), outline=PALE, width=4)
    # Basement labs: two levels below grade.
    d.rectangle((210, gy + 30, 740, 690), outline=C, width=6)
    d.line((210, 560, 740, 560), fill=C, width=4)
    # Isolated slab on springs, holding an electron microscope column.
    d.rectangle((300, 640, 520, 660), outline=PALE, width=4)
    for x in (318, 410, 502):
        pts = [(x + (7 if j % 2 else -7), 662 + j * 5) for j in range(6)]
        d.line(pts, fill=PALE, width=3)
    col_x = 410
    d.polygon([(col_x - 34, 600), (col_x - 22, 450), (col_x + 22, 450), (col_x + 34, 600)], outline=PALE, width=5)
    for y in (480, 512, 544, 576):
        d.line((col_x - 30, y, col_x + 30, y), fill=FAINT, width=3)
    d.rectangle((col_x - 52, 600, col_x + 52, 640), outline=PALE, width=5)
    _dashes(d, (col_x, 456), (col_x, 600), BLUE, 3, 8, 6)
    # Vibration from the street above fading out before it reaches the labs.
    for k, amp in enumerate((16, 10, 5)):
        y = 380 - k * 0 + 0
        pts = [(560 + x, gy - 20 - k * 22 + amp * math.sin(x / 9)) for x in range(0, 170, 4)]
        d.line(pts, fill=BLUE if k == 0 else FAINT, width=3)
    # Optical table on the upper basement floor.
    d.rectangle((560, 500, 712, 516), outline=C, width=4)
    for x in (574, 698):
        d.line((x, 516, x, 556), fill=C, width=4)
    d.line((580, 486, 690, 486), fill=BLUE, width=3)
    for x in (580, 636, 690):
        d.rectangle((x - 7, 478, x + 7, 500), outline=PALE, width=3)


def spilker_prize(d):
    """Segment 3: the 2019 Queen Elizabeth Prize for Engineering, for GPS, given back to Stanford Engineering."""
    mx, my = 330, 470
    # Ribbon.
    d.polygon([(290, 268), (330, 360), (370, 268)], outline=C, width=5)
    d.line((290, 268, 370, 268), fill=C, width=5)
    # Medal with a globe and orbits engraved on it.
    _ring(d, mx, my, 118, C, 8)
    _ring(d, mx, my, 96, DIM, 3)
    _ring(d, mx, my, 52, PALE, 5)
    d.arc((mx - 52, my - 22, mx + 52, my + 22), 0, 360, fill=FAINT, width=3)
    d.line((mx, my - 52, mx, my + 52), fill=FAINT, width=3)
    for tilt in (-0.5, 0.5):
        pts = []
        for i in range(73):
            a = i * 2 * math.pi / 72
            x, y = 84 * math.cos(a), 30 * math.sin(a)
            pts.append((mx + x * math.cos(tilt) - y * math.sin(tilt), my + x * math.sin(tilt) + y * math.cos(tilt)))
        d.line(pts, fill=BLUE, width=3)
    for a in (40, 200):
        r = a * math.pi / 180
        _dot(d, mx + 84 * math.cos(r) * math.cos(0.5) - 30 * math.sin(r) * math.sin(0.5),
             my + 84 * math.cos(r) * math.sin(0.5) + 30 * math.sin(r) * math.cos(0.5), 8, PALE)
    # Arrow handing it on to the engineering school, drawn as a classic arched entry.
    _arrow(d, (470, 470), (580, 470), C, width=7, head=24)
    d.polygon([(600, 360), (700, 304), (800, 360)], outline=C, width=6)
    d.rectangle((610, 360, 790, 640), outline=C, width=6)
    for x in (636, 700, 764):
        d.arc((x - 22, 430, x + 22, 486), 180, 360, fill=PALE, width=4)
        d.line((x - 22, 458, x - 22, 560), fill=PALE, width=4)
        d.line((x + 22, 458, x + 22, 560), fill=PALE, width=4)
    d.line((590, 640, 810, 640), fill=C, width=6)


# -------------------------------------------------------------------------------------------------------------
# Moore


def _iso(x, y, z, ox, oy, s):
    """Isometric projection of lattice point (x, y, z) in units of s."""
    return (ox + (x - y) * s * 0.866, oy + (x + y) * s * 0.5 - z * s)


def moore_lattice(d):
    """Segment 1: the Geballe Laboratory for Advanced Materials. A crystal lattice under study, with a probe beam."""
    ox, oy, s = 420, 470, 62
    n = 3
    # Bonds.
    for x in range(n):
        for y in range(n):
            for z in range(n):
                a = _iso(x, y, z, ox, oy - 40, s)
                for dx, dy, dz in ((1, 0, 0), (0, 1, 0), (0, 0, 1)):
                    if x + dx < n and y + dy < n and z + dz < n:
                        b = _iso(x + dx, y + dy, z + dz, ox, oy - 40, s)
                        d.line((a, b), fill=DIM, width=3)
    # Atoms, back to front so nearer ones overlap farther ones. One vacancy and one substituted atom.
    pts = sorted(((x, y, z) for x in range(n) for y in range(n) for z in range(n)), key=lambda p: (p[0] + p[1], p[2]))
    for (x, y, z) in pts:
        px, py = _iso(x, y, z, ox, oy - 40, s)
        if (x, y, z) == (1, 2, 2):
            _ring(d, px, py, 14, FAINT, 2)
            continue
        if (x, y, z) == (2, 1, 1):
            _dot(d, px, py, 20, BLUE)
            continue
        _dot(d, px, py, 15, C if z == 2 else PALE)
        _ring(d, px, py, 15, (16, 26, 37, 255), 2)
    # A probe beam hitting the crystal and a diffraction pattern on a screen to the right.
    _dashes(d, (150, 300), (370, 420), BLUE, 4, 14, 8)
    d.rectangle((690, 300, 800, 640), outline=PALE, width=5)
    for i in range(-2, 3):
        for j in range(-3, 4):
            r = 7 if (i, j) == (0, 0) else max(3, 6 - abs(i) - abs(j))
            _dot(d, 745 + i * 18, 470 + j * 40, r, BLUE if (i + j) % 2 == 0 else PALE)
    for k in range(3):
        _dashes(d, (560, 460 + (k - 1) * 30), (684, 420 + (k - 1) * 90), FAINT, 2, 8, 8)
    d.line((150, 690, 800, 690), fill=C, width=5)


CORNER_VISUALS = {
    ("varian", 1): varian_klystron,
    ("varian", 2): varian_plaque,
    ("varian", 3): varian_linac,
    ("spilker", 1): spilker_growth,
    ("spilker", 2): spilker_underground,
    ("spilker", 3): spilker_prize,
    ("moore", 1): moore_lattice,
}


def draw_corner_visual(d, id, index):
    """Draws the diagram for a corner-building card. Returns False if this card isn't one of them."""
    if id not in CORNER_IDS:
        return False
    if index == 0:
        _frame(d)
        return True
    fn = CORNER_VISUALS.get((id, index))
    if fn is None:
        return False
    fn(d)
    return True

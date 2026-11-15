"""HP Garage story-card picture: Nazeli's garage drawing (Art/hpgarage/hpgarage_nazeli_art.png) on the deck's navy.

The garage is off the campus map (367 Addison Avenue, Palo Alto), so it has no baked footprint for heroes/footprint.py.
The drawing's near-black background is keyed out (dark reads as see-through on Spectacles) and it is centred in the
hero box over a soft copper pool of light.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
from PIL import Image

import story_cards_featured as F
from story_cards_featured import SS

ART = Path(__file__).resolve().parents[2] / "Assets/Retrospecs/Art/hpgarage/hpgarage_nazeli_art.png"
BOX = (28, 28, 888, 694)


def _drawing():
    im = Image.open(ART).convert("RGBA")
    a = np.asarray(im, np.float32).copy()
    v = a[..., :3].max(axis=-1)
    a[..., 3] = np.minimum(a[..., 3], np.clip((v - 28) / 37.0, 0, 1) * 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def scene_0(th):
    canvas = F.new()
    m = F.poly_mask([(BOX[0], BOX[1]), (BOX[2], BOX[1]), (BOX[2], BOX[3]), (BOX[0], BOX[3])])
    F.over(canvas, F.vgrad(BOX[1], BOX[3], [(0, (22, 31, 46, 255)), (1, (34, 44, 60, 255))], m))
    F.over(canvas, F.rgrad((458, 420), 360, [(0, (245, 169, 103, 70)), (1, (245, 169, 103, 0))], m, sy=0.55))
    art = _drawing()
    k = min(720 * SS / art.width, 560 * SS / art.height)
    art = art.resize((round(art.width * k), round(art.height * k)), Image.Resampling.LANCZOS)
    lay = F.new()
    lay.paste(art, (round(458 * SS - art.width / 2), round(361 * SS - art.height / 2)))
    F.over(canvas, lay)
    return canvas


SCENES = (scene_0,)

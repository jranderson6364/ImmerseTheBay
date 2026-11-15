"""Archive Gallery: real photos (Wikimedia Commons, public domain / CC) for Main Quad, Huang and Hoover.

Reads tools/archive-photos.json, downloads each file once into tools/cache/archive/ (1600 px Commons thumbnails), and
writes, per stop:

  Art/<id>/<id>_archive_cover.jpg      1280 x 720: a minimal collage of three tilted prints and "ARCHIVE GALLERY",
                                        on black (see-through on Spectacles). It takes the people hologram's place.
  Art/<id>/<id>_archive_frame_<n>.jpg  one framed print per photo, at the photo's own shape: a thin copper rim, and
                                        under it the year, a short title and the credit line, on black.

and Scripts/ArchivePhotos.ts (requireAsset switches plus each frame's aspect, width / height). Pinching the collage
explodes the prints out to the right as separate frames (Core/Archive.ts lays them out); pinching one folds them back.

Spectacles is additive: black reads as see-through, so there are no panels or boxes, only the prints and their text.
Photos get their levels lifted so dark archival prints don't vanish.

  python Retrospecs/tools/render_archive_gallery.py                 downloads (if needed) and renders into Assets
  python Retrospecs/tools/render_archive_gallery.py --preview DIR   renders into DIR + contact sheet, Assets untouched
"""

import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
ART = ROOT / "Assets" / "Retrospecs" / "Art"
CACHE = TOOLS / "cache" / "archive"
MANIFEST = TOOLS / "archive-photos.json"
TS_OUT = ROOT / "Assets" / "Retrospecs" / "Scripts" / "ArchivePhotos.ts"
UA = {"User-Agent": "RetrospecsArchiveBaker/0.1 (student hackathon project)"}

CW, CH = 1280, 720          # cover
PHOTO_H = 640               # print height in a frame texture (px); width follows the photo, clamped
MIN_ASPECT, MAX_ASPECT = 0.62, 1.9
RIM_W = 6
PAD = 14
CAPTION_H = 150

BLACK = (0, 0, 0)
COPPER = (245, 169, 103)
RIM = (255, 206, 150)
WHITE = (255, 255, 255)
MUTED = (165, 170, 180)

FONTS = Path("C:/Windows/Fonts")


def font(name, size):
    for cand in (FONTS / name, Path(name)):
        try:
            return ImageFont.truetype(str(cand), size)
        except OSError:
            pass
    return ImageFont.load_default()


SERIF_B = lambda s: font("georgiab.ttf", s)  # noqa: E731
SANS_B = lambda s: font("segoeuib.ttf", s)  # noqa: E731
SANS = lambda s: font("segoeui.ttf", s)  # noqa: E731


# ---------------------------------------------------------------------------------------------------------------
# Download

def fetch(url):
    for attempt in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(8 * (attempt + 1))
    raise SystemExit("Wikimedia rate limit: try again in a minute")


def commons_thumb(title, width=1600):
    q = urllib.parse.urlencode({"action": "query", "titles": title, "prop": "imageinfo", "iiprop": "url",
                                "iiurlwidth": width, "format": "json"})
    d = json.load(fetch("https://commons.wikimedia.org/w/api.php?" + q))
    info = next(iter(d["query"]["pages"].values()))["imageinfo"][0]
    return info.get("thumburl") or info["url"]


def local_photo(stop, i, photo):
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"{stop}_{i}.jpg"
    if not out.exists():
        url = commons_thumb(photo["file"])
        time.sleep(1.2)
        out.write_bytes(fetch(url).read())
    return Image.open(out).convert("RGB")


# ---------------------------------------------------------------------------------------------------------------
# Drawing

def lift(im):
    """Additive display: stretch levels, open the shadows, keep blacks off zero so the print reads as a print."""
    im = ImageOps.autocontrast(im, cutoff=0.5)
    lut = [int(26 + (255 - 26) * ((v / 255) ** 0.78)) for v in range(256)]
    return im.point(lut * 3)


def fit_font(draw, s, maker, size, width, floor=16):
    while size > floor and draw.textlength(s, font=maker(size)) > width:
        size -= 2
    return maker(size)


def print_of(photo, height):
    """The photo at `height` px, its shape clamped to MIN..MAX_ASPECT (centre crop beyond that), with a copper rim."""
    p = lift(photo)
    a = min(MAX_ASPECT, max(MIN_ASPECT, p.width / p.height))
    p = ImageOps.fit(p, (round(height * a), height), Image.LANCZOS, centering=(0.5, 0.45))
    framed = Image.new("RGB", (p.width + 2 * RIM_W, p.height + 2 * RIM_W), RIM)
    framed.paste(p, (RIM_W, RIM_W))
    return framed


def render_frame(photo, meta):
    pr = print_of(photo, PHOTO_H)
    w = max(pr.width, 700) + 2 * PAD
    im = Image.new("RGB", (w, PAD + pr.height + CAPTION_H), BLACK)
    im.paste(pr, ((w - pr.width) // 2, PAD))
    d = ImageDraw.Draw(im)
    tx, tw = PAD, w - 2 * PAD
    y = PAD + pr.height + 18
    year = meta["year"].upper()
    d.text((tx, y + 6), year, font=SANS_B(30), fill=COPPER)
    hx = tx + d.textlength(year, font=SANS_B(30)) + 16
    d.text((hx, y), meta["headline"], font=fit_font(d, meta["headline"], SERIF_B, 40, tw - (hx - tx)), fill=WHITE)
    d.text((tx, y + 62), meta["credit"], font=fit_font(d, meta["credit"], SANS, 26, tw), fill=MUTED)
    return im


def render_cover(photos):
    """Three prints fanned like a small stack of photographs, and a quiet label. Everything else is black."""
    im = Image.new("RGB", (CW, CH), BLACK)
    spots = [(-9, 405, 300), (8, 875, 295), (-1, 640, 320)]   # angle, centre x, centre y (the last sits on top)
    for (angle, cx, cy), ph in zip(spots, photos):
        pr = print_of(ph, 450)
        if pr.width > 640:
            pr = pr.resize((640, round(pr.height * 640 / pr.width)), Image.LANCZOS)
        mask = Image.new("L", pr.size, 255)
        pr = pr.rotate(angle, resample=Image.BICUBIC, expand=True)
        mask = mask.rotate(angle, resample=Image.BICUBIC, expand=True)
        im.paste(pr, (cx - pr.width // 2, cy - pr.height // 2), mask)
    d = ImageDraw.Draw(im)
    label = "ARCHIVE GALLERY"
    f = SANS_B(44)
    spaced = " ".join(label)  # letter-spaced
    lw = d.textlength(spaced, font=f)
    d.text(((CW - lw) / 2, CH - 98), spaced, font=f, fill=COPPER)
    d.line([((CW - lw) / 2, CH - 34), ((CW + lw) / 2, CH - 34)], fill=RIM, width=3)
    return im


# ---------------------------------------------------------------------------------------------------------------

def render(out_root=None):
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    written, aspects = [], {}
    for stop, entry in manifest.items():
        if stop.startswith("_"):
            continue
        photos = entry["photos"]
        dest = (out_root / stop) if out_root else (ART / stop)
        dest.mkdir(parents=True, exist_ok=True)
        imgs = [local_photo(stop, i, p) for i, p in enumerate(photos)]
        aspects[stop] = []
        for i, (img, p) in enumerate(zip(imgs, photos)):
            fr = render_frame(img, p)
            path = dest / f"{stop}_archive_frame_{i}.jpg"
            fr.save(path, quality=88, optimize=True)
            aspects[stop].append(round(fr.width / fr.height, 4))
            written.append(path)
        order = entry.get("collage", [1, 2, entry.get("cover", 0)])
        path = dest / f"{stop}_archive_cover.jpg"
        render_cover([imgs[i] for i in order]).save(path, quality=88, optimize=True)
        written.append(path)
    return written, aspects


def write_ts(aspects):
    """Scripts/ArchivePhotos.ts: requireAsset switches (Lens Studio needs literal paths) and each frame's aspect."""
    stops = list(aspects)
    lines = ["// GENERATED by tools/render_archive_gallery.py from tools/archive-photos.json. Do not edit by hand.",
             f"export const ARCHIVE_COUNTS: Record<string, number> = {{{', '.join(f'{k}: {len(aspects[k])}' for k in stops)}}}",
             "",
             "/** Each frame texture's width / height (print + caption), for sizing its quad. */",
             "export const ARCHIVE_ASPECTS: Record<string, number[]> = {"]
    lines += [f"  {k}: [{', '.join(str(a) for a in aspects[k])}]," for k in stops]
    lines += ["}", "", "export function hasArchive(id: string): boolean {", "  return (ARCHIVE_COUNTS[id] || 0) > 0", "}", "",
              "export function archiveCover(id: string): Texture | null {", "  switch (id) {"]
    lines += [f'    case "{k}": return requireAsset("../Art/{k}/{k}_archive_cover.jpg") as Texture' for k in stops]
    lines += ["    default: return null", "  }", "}", "",
              "export function archiveFrame(id: string, index: number): Texture | null {", "  switch (`${id}_${index}`) {"]
    for k in stops:
        lines += [f'    case "{k}_{i}": return requireAsset("../Art/{k}/{k}_archive_frame_{i}.jpg") as Texture'
                  for i in range(len(aspects[k]))]
    lines += ["    default: return null", "  }", "}", ""]
    TS_OUT.write_text(chr(10).join(lines), encoding="utf-8")
    return TS_OUT


def contact_sheet(paths, out):
    thumbs = [Image.open(p) for p in paths]
    for t in thumbs:
        t.thumbnail((420, 300))
    cols = 6
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * 430, rows * 310), (40, 40, 40))
    for i, t in enumerate(thumbs):
        sheet.paste(t, ((i % cols) * 430 + 5, (i // cols) * 310 + 5))
    sheet.save(out)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--preview":
        out = Path(sys.argv[2])
        paths, _ = render(out)
        contact_sheet(paths, out / "contact_sheet.jpg")
    else:
        paths, aspects = render()
        paths.append(write_ts(aspects))
    for p in paths:
        print(p)

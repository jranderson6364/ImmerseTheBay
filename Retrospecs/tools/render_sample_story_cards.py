"""Render the two illustrated Lens story cards with a translucent midnight-copper frame."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "Assets" / "Retrospecs" / "Art"
FONTS = Path("C:/Windows/Fonts")
W, H = 1200, 1280
CARD = (28, 28, 888, 1252)
NEXT = (928, 1010, 1174, 1132)
PANEL = (16, 26, 37, 158)  # See-through midnight; text and controls stay opaque.
COPPER = (245, 169, 103, 255)
WHITE = (255, 255, 255, 255)


def face(size, bold=False, serif=False):
    name = "georgiab.ttf" if bold and serif else "georgia.ttf" if serif else "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(FONTS / name), size)


def wrap(draw, text, f, max_width):
    lines = []
    for word in text.split():
        trial = (lines[-1] + " " + word) if lines else word
        if lines and draw.textlength(trial, font=f) > max_width:
            lines.append(word)
        elif lines:
            lines[-1] = trial
        else:
            lines = [word]
    return lines


def polygon(x0, y0, x1, y1, cut=34):
    return [(x0 + cut, y0), (x1 - cut, y0), (x1, y0 + cut),
            (x1, y1 - cut), (x1 - cut, y1), (x0 + cut, y1),
            (x0, y1 - cut), (x0, y0 + cut)]


def transparent_art(path):
    art = Image.open(path).convert("RGBA")
    pixels = art.load()
    for y in range(art.height):
        for x in range(art.width):
            r, g, b, a = pixels[x, y]
            bright = max(r, g, b)
            if bright < 28:
                pixels[x, y] = (r, g, b, 0)
            elif bright < 65:
                pixels[x, y] = (r, g, b, min(a, int((bright - 28) * 255 / 37)))
    art.thumbnail((750, 550), Image.Resampling.LANCZOS)
    return art


def draw_card(story):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon(polygon(*CARD), fill=PANEL, outline=COPPER, width=7)
    d.line([(60, 122), (60, 61), (130, 61)], fill=COPPER, width=5)
    d.line([(782, 1220), (855, 1220), (855, 1150)], fill=COPPER, width=5)
    d.text((88, 78), story["place"], font=face(31, bold=True, serif=True), fill=WHITE)
    d.rectangle((797, 67, 847, 117), outline=COPPER, width=3)
    d.text((807, 72), "×", font=face(34, bold=True), fill=WHITE)
    d.text((89, 158), story["eyebrow"], font=face(25, bold=True), fill=COPPER)

    art = transparent_art(ROOT / story["art"])
    im.alpha_composite(art, ((920 - art.width) // 2, 220 + (520 - art.height) // 2))
    d = ImageDraw.Draw(im)
    d.text((89, 754), story["year"], font=face(29, bold=True), fill=COPPER)
    y = 804
    headline = face(53, bold=True, serif=True)
    for line in wrap(d, story["headline"], headline, 740):
        d.text((88, y), line, font=headline, fill=WHITE)
        y += 68
    y += 10
    body = face(27, serif=True)
    for line in wrap(d, story["body"], body, 740):
        d.text((90, y), line, font=body, fill=WHITE)
        y += 42

    # Retain the hit regions expected by RetrospecsInfoPanel.buildImageCard.
    d.polygon(polygon(90, 1110, 535, 1202, 18), fill=(231, 125, 69, 255))
    d.text((130, 1130), "Explore More  ›", font=face(34, bold=True, serif=True), fill=WHITE)
    d.text((570, 1150), "ILLUSTRATION: NAZELI", font=face(17, bold=True), fill=WHITE)
    d.polygon(polygon(*NEXT, cut=18), fill=(23, 33, 46, 220), outline=COPPER, width=4)
    d.text((954, 1049), "Next Stop  ›", font=face(23, bold=True, serif=True), fill=WHITE)
    out = ROOT / story["out"]
    im.save(out, optimize=True)
    print(out)


draw_card({
    "place": "Huang Engineering Center",
    "eyebrow": "1996  /  ENGINEERING MILESTONES",
    "year": "1996",
    "headline": "Before Google became Google.",
    "body": "The lobby displays the toy-block servers Larry Page and Sergey Brin used to test PageRank.",
    "art": "huang/huang_nazeli_art.png",
    "out": "huang/huang_story_card.png",
})
draw_card({
    "place": "The HP Garage",
    "eyebrow": "1939  /  ORIGINS",
    "year": "1939",
    "headline": "Two friends. One garage.",
    "body": "Bill Hewlett and David Packard started HP in a Palo Alto garage, encouraged by Stanford professor Frederick Terman.",
    "art": "hpgarage/hpgarage_nazeli_art.png",
    "out": "hpgarage/hpgarage_story_card.png",
})

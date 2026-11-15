"""Render a ten-option visual comparison for the illustrated Retrospecs card."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "card-style-options"
OUT.mkdir(parents=True, exist_ok=True)
ART = ROOT / "Assets" / "Retrospecs" / "Art" / "huang" / "huang_nazeli_art.png"
FONTS = Path("C:/Windows/Fonts")
W, H = 480, 680

STYLES = [
    ("01", "Violet glow", "#171027", "#FDF8FF", "#CBA5FF", "#FF9138", "segoeuib.ttf", 38, 28, "pill", "glow"),
    ("02", "Stanford cardinal", "#FFF8EE", "#34251F", "#B43438", "#B43438", "georgiab.ttf", 18, 4, "square", "stripe"),
    ("03", "Midnight copper", "#101A25", "#F8F4E8", "#F5A967", "#E77D45", "bahnschrift.ttf", 23, 2, "cut", "corner"),
    ("04", "Campus archive", "#F3EBD9", "#26372E", "#4A705A", "#4A705A", "cambria.ttc", 5, 2, "square", "rule"),
    ("05", "Sunlit field note", "#FFECB4", "#342B39", "#714B98", "#714B98", "trebucbd.ttf", 30, 0, "pill", "tag"),
    ("06", "Electric blue", "#111E4B", "#FFFFFF", "#7BD9FF", "#31B5E7", "arialbd.ttf", 12, 4, "square", "stripe"),
    ("07", "Rose museum", "#F8E8E6", "#4C2434", "#A34C69", "#A34C69", "georgia.ttf", 40, 2, "pill", "rule"),
    ("08", "Graphite signal", "#202429", "#F6F8F7", "#B8E86D", "#B8E86D", "consolab.ttf", 8, 2, "square", "corner"),
    ("09", "Cobalt + coral", "#E6ECFF", "#18235C", "#E6635D", "#E6635D", "segoeuib.ttf", 26, 0, "pill", "tag"),
    ("10", "Gallery white", "#FFFFFF", "#222222", "#A24436", "#222222", "georgiab.ttf", 2, 1, "square", "rule"),
]


def rgb(value):
    return tuple(bytes.fromhex(value.lstrip("#")))


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def fit_lines(draw, words, face, width, max_lines=3):
    lines = []
    for word in words.split():
        attempt = (lines[-1] + " " + word) if lines else word
        if lines and draw.textlength(attempt, font=face) > width:
            lines.append(word)
        elif lines:
            lines[-1] = attempt
        else:
            lines = [word]
    return lines[:max_lines]


art = Image.open(ART).convert("RGBA")
p = art.load()
for y in range(art.height):
    for x in range(art.width):
        r, g, b, a = p[x, y]
        v = max(r, g, b)
        if v < 28:
            p[x, y] = (r, g, b, 0)
        elif v < 65:
            p[x, y] = (r, g, b, min(a, int((v - 28) * 255 / 37)))
art.thumbnail((390, 330), Image.Resampling.LANCZOS)


def draw_option(style):
    num, name, bg, fg, accent, button, face, radius, border, action, detail = style
    bg, fg, accent, button = map(rgb, (bg, fg, accent, button))
    im = Image.new("RGB", (W, H), (234, 231, 227))
    d = ImageDraw.Draw(im)
    panel = (7, 7, W - 8, H - 8)
    d.rounded_rectangle(panel, radius=radius, fill=bg, outline=accent if border else None, width=border)
    if detail == "glow":
        glow = Image.new("RGBA", (W, H))
        gd = ImageDraw.Draw(glow)
        gd.rounded_rectangle((16, 16, W - 17, H - 17), radius=radius, outline=(*accent, 115), width=10)
        im = Image.alpha_composite(im.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(10))).convert("RGB")
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((19, 19, W - 20, H - 20), radius=max(2, radius - 9), outline=accent, width=1)
    elif detail == "stripe":
        d.rectangle((7, 7, W - 8, 18), fill=accent)
    elif detail == "corner":
        d.line((25, 56, 25, 27, 69, 27), fill=accent, width=3)
        d.line((W - 69, H - 27, W - 25, H - 27, W - 25, H - 56), fill=accent, width=3)
    elif detail == "rule":
        d.line((30, 59, W - 30, 59), fill=accent, width=2)
        d.line((30, 598, W - 30, 598), fill=accent, width=2)
    elif detail == "tag":
        d.rounded_rectangle((25, 25, 254, 59), radius=12, fill=accent)

    tiny = font("segoeuib.ttf", 13)
    small = font("segoeui.ttf", 17)
    titleface = font(face, 34 if num not in ("04", "07") else 36)
    meta_color = fg if detail == "tag" else accent
    if detail == "tag":
        d.text((36, 32), "HUANG ENGINEERING CENTER", font=tiny, fill=bg)
    else:
        d.text((31, 30), "HUANG ENGINEERING CENTER", font=tiny, fill=fg)
    d.text((W - 48, 29), "×", font=font("segoeuib.ttf", 23), fill=fg)
    d.text((31, 72), "1996  /  ENGINEERING", font=tiny, fill=meta_color)

    # The same illustration and scale are used in every option.
    art_layer = Image.new("RGBA", (W, H))
    art_layer.alpha_composite(art, ((W - art.width) // 2, 117 + (305 - art.height) // 2))
    im = Image.alpha_composite(im.convert("RGBA"), art_layer).convert("RGB")
    d = ImageDraw.Draw(im)
    y = 424
    for line in fit_lines(d, "Before Google became Google.", titleface, 410):
        d.text((30, y), line, font=titleface, fill=fg)
        y += 39
    y += 8
    for line in fit_lines(d, "The lobby displays the toy-block servers Larry Page and Sergey Brin used to test PageRank.", small, 418, 3):
        d.text((31, y), line, font=small, fill=fg)
        y += 23

    box = (30, 607, 251, 652)
    if action == "pill":
        d.rounded_rectangle(box, radius=22, fill=button)
    elif action == "cut":
        d.polygon([(30, 607), (236, 607), (251, 622), (251, 652), (30, 652)], fill=button)
    else:
        d.rectangle(box, fill=button)
    button_fg = bg if num in ("06", "08") else (255, 255, 255)
    d.text((49, 619), "Explore more  ›", font=font("segoeuib.ttf", 18), fill=button_fg)
    d.text((281, 621), "Next stop  →", font=font("segoeuib.ttf", 15), fill=accent if num != "09" else fg)
    path = OUT / f"{num}-{name.lower().replace(' ', '-')}.png"
    im.save(path)
    return im


images = [draw_option(s) for s in STYLES]
GAP, LABEL_H, COLS = 26, 52, 5
sheet = Image.new("RGB", (COLS * W + (COLS + 1) * GAP, 2 * (H + LABEL_H) + 3 * GAP), "#EEEDEB")
sd = ImageDraw.Draw(sheet)
for i, (style, card) in enumerate(zip(STYLES, images)):
    col, row = i % COLS, i // COLS
    x, y = GAP + col * (W + GAP), GAP + row * (H + LABEL_H + GAP)
    sd.text((x + 2, y + 4), f"{style[0]}  {style[1]}", font=font("segoeuib.ttf", 22), fill="#222222")
    sheet.paste(card, (x, y + LABEL_H))
sheet.save(OUT / "all-ten.png", optimize=True)
print(OUT / "all-ten.png")

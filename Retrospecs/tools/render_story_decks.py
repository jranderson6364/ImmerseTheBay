"""Build illustrated cards for every selectable landmark and Lens asset references."""

import json
import re
import uuid
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from story_visuals_corners import draw_corner_visual

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "Assets/Retrospecs/Art"
DATA = json.loads((Path(__file__).parent / "story-cards.json").read_text(encoding="utf-8"))
NARRATION = {item["id"]: item["segments"] for item in json.loads((Path(__file__).parent / "narration/narration.json").read_text(encoding="utf-8"))["landmarks"]}
FONTS = Path("C:/Windows/Fonts")
W, H = 1200, 1280
PANEL = (16, 26, 37, 158)
COPPER = (245, 169, 103, 255)
WHITE = (255, 255, 255, 255)
NAMES = {"hoover": "Hoover Tower", "huang": "Huang Engineering Center", "hpgarage": "The HP Garage", "memchu": "Memorial Church"}
CARDS_TS = (ROOT / "Assets/Retrospecs/Core/Cards.ts").read_text(encoding="utf-8")
# Hand-written decks (centerpieces plus the start-point corner buildings) follow their baked narration card for card.
HAND = set(DATA)
for match in re.finditer(r'    id: "([a-z0-9]+)", name: "([^"]+)", label: "[^"]+", namesake: "[^"]*",', CARDS_TS):
    card_id, name = match.groups()
    NAMES.setdefault(card_id, name)
    if card_id in DATA:
        continue
    end = CARDS_TS.find('\n  },', match.end())
    block = CARDS_TS[match.end():end]
    facts = re.findall(r'\{id: "([^"]+)", theme: "([^"]+)", text: "([^"]+)", source: ([^}]+)\}', block)
    DATA[card_id] = [{"year": "STANFORD", "headline": theme.title(), "body": body,
                      "source": source, "factId": fact_id} for fact_id, theme, body, source in facts[:2]]
    NAMES[card_id] = name


def face(size, bold=False, serif=False):
    name = "georgiab.ttf" if bold and serif else "georgia.ttf" if serif else "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(FONTS / name), size)


def wrap(draw, text, font, width):
    lines = []
    for word in text.split():
        trial = lines[-1] + " " + word if lines else word
        if lines and draw.textlength(trial, font=font) > width:
            lines.append(word)
        elif lines:
            lines[-1] = trial
        else:
            lines.append(word)
    return lines


def poly(x0, y0, x1, y1, cut=34):
    return [(x0+cut,y0),(x1-cut,y0),(x1,y0+cut),(x1,y1-cut),
            (x1-cut,y1),(x0+cut,y1),(x0,y1-cut),(x0,y0+cut)]


def source_art(id, index):
    # These existing drawings depict exactly these two stories; they are not reused for later slides.
    if (id, index) not in (("huang", 0), ("hpgarage", 0)):
        return None
    src = ART / id / f"{id}_nazeli_art.png"
    im = Image.open(src).convert("RGBA")
    p = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a = p[x,y]
            v = max(r,g,b)
            if v < 28: p[x,y] = (r,g,b,0)
            elif v < 65: p[x,y] = (r,g,b,min(a,int((v-28)*255/37)))
    im.thumbnail((745,530), Image.Resampling.LANCZOS)
    return im


def draw_visual(d, id, index):
    # Distinct schematic illustrations. Each shows an object in its matching sourced narration segment.
    c = (245,169,103,235)
    pale = (248,239,226,235)
    if draw_corner_visual(d, id, index):
        return
    if (id,index) == ("hoover",0):  # tower
        d.polygon([(384,680),(384,328),(411,298),(509,298),(536,328),(536,680)], outline=c, width=7)
        d.rectangle((399,328,520,592), outline=c, width=5)
        for y in (365,410,455,500,545):
            d.line((409,y,509,y),fill=c,width=3)
        d.polygon([(377,309),(459,261),(543,309)], outline=c, width=6)
        d.line((357,680,563,680),fill=c,width=8)
    elif (id,index) == ("hoover",1):  # carillon bells from the fair
        for x,top,r in ((314,350,55),(460,294,72),(625,360,52)):
            d.line((x,top-35,x,top),fill=pale,width=5)
            d.arc((x-r,top,x+r,top+205),180,360,fill=c,width=7)
            d.line((x-r,top+101,x+r,top+101),fill=c,width=6)
            d.ellipse((x-13,top+98,x+13,top+124),fill=pale)
        d.line((230,306,712,306),fill=c,width=5)
    elif (id,index) == ("hoover",2):  # public and staff lifts
        for x,count in ((280,14),(535,21)):
            d.rectangle((x,293,x+160,679),outline=c,width=6)
            d.line((x+80,310,x+80,652),fill=pale,width=4)
            d.polygon([(x+45,405),(x+115,405),(x+115,503),(x+45,503)],outline=pale,width=5)
            d.text((x+80,579),str(count),font=face(48,True,True),fill=WHITE,anchor="mm")
        d.line((225,680,754,680),fill=c,width=5)
    elif (id,index) == ("hoover",3):  # radio room
        d.rounded_rectangle((261,337,680,624),radius=18,outline=c,width=8)
        for x in (360,500,606):
            d.ellipse((x-26,538,x+26,590),outline=pale,width=5)
        d.arc((302,365,642,535),180,360,fill=pale,width=6)
        d.line((315,644,625,644),fill=c,width=5)
        for x in (360,420,480,540): d.line((x,623,x,655),fill=c,width=4)
    elif (id,index) == ("huang",1):  # octagonal engineering center and auditorium
        d.polygon([(332,342),(412,292),(543,292),(623,342),(623,626),(543,676),(412,676),(332,626)],outline=c,width=8)
        d.polygon([(385,580),(385,440),(570,440),(570,580)],outline=pale,width=5)
        d.arc((402,459,553,559),180,360,fill=pale,width=5)
        for x in (430,478,526): d.line((x,584,x,611),fill=c,width=5)
    elif (id,index) == ("huang",2):  # ten four-GB drives
        for row in range(5):
            for col in range(2):
                x,y=305+col*185,315+row*68
                d.rounded_rectangle((x,y,x+150,y+51),radius=8,outline=c,width=5)
                d.ellipse((x+118,y+19,x+131,y+32),fill=pale)
        d.line((273,685,675,685),fill=c,width=5)
    elif (id,index) == ("huang",3):  # water and energy reduction
        d.polygon([(375,302),(284,455),(281,519),(314,570),(375,593),(436,570),(469,519),(466,455)],outline=c,width=8)
        d.line((373,375,342,459),fill=pale,width=6)
        d.polygon([(590,297),(510,478),(584,478),(540,653),(685,437),(608,437),(659,297)],outline=c,width=8)
    elif (id,index) == ("huang",4):  # replica garage workbench
        d.polygon([(263,465),(685,465),(660,532),(286,532)],outline=c,width=7)
        for x in (310,630): d.line((x,533,x,679),fill=c,width=7)
        d.rounded_rectangle((365,351,558,462),radius=12,outline=pale,width=6)
        d.ellipse((394,379,448,433),outline=c,width=5)
        for x in (486,523): d.ellipse((x-11,406,x+11,428),outline=c,width=4)
    elif (id,index) == ("hpgarage",1):  # HP 200A oscillator
        d.rounded_rectangle((279,349,682,590),radius=19,outline=c,width=8)
        d.arc((325,383,468,533),180,360,fill=pale,width=6)
        d.line((344,502,447,502),fill=pale,width=5)
        for x in (534,600,648): d.ellipse((x-23,488,x+23,534),outline=c,width=5)
        d.line((294,606,667,606),fill=c,width=6)
    elif (id,index) == ("hpgarage",2):  # move from garage to research park
        d.polygon([(270,517),(400,408),(530,517),(530,663),(270,663)],outline=c,width=7)
        d.rectangle((340,559,410,663),outline=pale,width=5)
        d.line((534,550,614,550),fill=pale,width=6)
        d.polygon([(598,519),(649,550),(598,581)],fill=pale)
        d.rectangle((641,358,737,664),outline=c,width=7)
        for y in (400,460,520,580): d.line((660,y,718,y),fill=pale,width=4)
    elif (id,index) == ("memchu",0):  # Jane's umbrella and memorial
        d.arc((270,342,670,533),180,360,fill=c,width=9)
        d.line((470,433,470,648),fill=pale,width=7)
        d.arc((470,603,558,695),0,180,fill=pale,width=7)
        for x in (335,405,535,605): d.line((x,383,x,455),fill=c,width=4)
    elif (id,index) == ("memchu",1):  # fallen spire; no invented reconstruction
        d.polygon([(276,538),(470,411),(664,538)],outline=c,width=7)
        d.rectangle((302,539,638,675),outline=c,width=6)
        d.line((470,274,470,396),fill=pale,width=8)
        d.line((439,316,494,353),fill=pale,width=7)
        d.line((470,397,540,455),fill=c,width=6)
    elif (id,index) == ("memchu",2):  # tesserae mosaic
        colors=[c,pale,(201,161,229,235),(255,207,153,235)]
        for row in range(8):
            for col in range(12):
                x,y=260+col*36,324+row*39
                d.rectangle((x,y,x+28,y+30),fill=colors[(row*3+col*5)%4])
        d.rectangle((247,311,695,648),outline=c,width=6)
    elif (id,index) == ("memchu",3):  # organ pipes
        for col in range(11):
            h=205+20*(5-abs(col-5))
            x=270+col*39
            d.rectangle((x,650-h,x+26,650),outline=c,width=5)
            d.line((x+7,650-h+24,x+19,650-h+24),fill=pale,width=4)
        d.line((254,667,714,667),fill=c,width=7)
    else:
        # A quiet architectural elevation for the smaller stops, varied by building id.
        seed = sum((i + 1) * ord(ch) for i, ch in enumerate(id)) + index * 31
        left, top = 282, 335
        width, height = 390, 320
        d.polygon([(left,top+45),(left+width//2,top-15),(left+width,top+45)],outline=c,width=7)
        d.rectangle((left,top+45,left+width,top+height),outline=c,width=7)
        for row in range(3):
            for col in range(4):
                x, y = left+36+col*91, top+86+row*75
                if (seed + row + col) % 3:
                    d.rectangle((x,y,x+46,y+42),outline=pale,width=4)
                else:
                    d.arc((x,y,x+46,y+60),180,360,fill=pale,width=4)
        d.line((left-44,top+height+12,left+width+44,top+height+12),fill=c,width=7)


def draw_slide(id, index, slide, count):
    im = Image.new("RGBA", (W,H), (0,0,0,0))
    d = ImageDraw.Draw(im)
    d.polygon(poly(28,28,888,1252),fill=PANEL,outline=COPPER,width=7)
    d.line((60,122,60,61,130,61),fill=COPPER,width=5)
    d.line((782,1220,855,1220,855,1150),fill=COPPER,width=5)
    title_size = 31
    while d.textlength(NAMES[id],font=face(title_size,True,True)) > 680 and title_size > 21:
        title_size -= 1
    d.text((88,78),NAMES[id],font=face(title_size,True,True),fill=WHITE)
    d.rectangle((797,67,847,117),outline=COPPER,width=3)
    d.text((807,72),"×",font=face(34,True),fill=WHITE)
    d.text((89,157),f"STORY {index+1} / {count}",font=face(25,True),fill=COPPER)
    a = source_art(id,index)
    if a is not None:
        im.alpha_composite(a,((920-a.width)//2,216+(520-a.height)//2))
        d = ImageDraw.Draw(im)
    else:
        draw_visual(d,id,index)
    d.text((89,755),slide["year"],font=face(30,True),fill=COPPER)
    headline = face(52,True,True)
    y = 807
    lines = wrap(d,slide["headline"],headline,740)
    if len(lines) > 2:
        headline = face(47,True,True)
        lines = wrap(d,slide["headline"],headline,740)
    for line in lines:
        d.text((88,y),line,font=headline,fill=WHITE)
        y += 68
    y += 8
    body_size = 27
    while y + len(wrap(d,slide["body"],face(body_size,serif=True),740)) * (body_size+15) > 1090 and body_size > 21:
        body_size -= 1
    body = face(body_size,serif=True)
    for line in wrap(d,slide["body"],body,740):
        if y > 1090: raise ValueError(f"Body overflows: {id} {index}")
        d.text((90,y),line,font=body,fill=WHITE)
        y += body_size + 15
    d.polygon(poly(90,1110,535,1202,18),fill=(231,125,69,255))
    action = "Next Card  ›" if index+1<count else ("Replay Card  ›" if count == 1 else "Replay Cards  ›")
    d.text((130,1130),action,font=face(31,True,True),fill=WHITE)
    d.text((568,1152),"ILLUSTRATION: NAZELI" if a is not None else "RETROSPECS",font=face(17,True),fill=WHITE)
    d.polygon(poly(928,1010,1174,1132,18),fill=(23,33,46,220),outline=COPPER,width=4)
    d.text((953,1049),"Next Stop  ›",font=face(23,True,True),fill=WHITE)
    out = ART / id / f"{id}_story_card_{index}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out,optimize=True)
    return out


all_outputs=[]
for id, slides in DATA.items():
    if not 1 <= len(slides) <= 5: raise ValueError(f"{id}: expected 1–5 cards")
    if id in HAND and len(slides) != len(NARRATION[id]):
        raise ValueError(f"{id}: cards and voice segments differ")
    for i, slide in enumerate(slides):
        if id in HAND and slide["source"] not in NARRATION[id][i]["sources"]:
            raise ValueError(f"{id} {i}: card source is absent from matching narration")
        out = draw_slide(id,i,slide,len(slides))
        all_outputs.append(out)
        meta = out.with_suffix(out.suffix + ".meta")
        if not meta.exists():
            asset_id = uuid.uuid4()
            meta.write_text(f'''- !<AssetImportMetadata/{uuid.uuid4()}>
  ImportedAssetIds:
    Texture: !<reference> {asset_id}
  ImporterName: FileTextureImporter
  PrimaryAsset: !<reference> {asset_id}
  PackageType: NotAPackage
  LegacyPackagePolicy: ~
  ExtraData:
    {{}}
  AssetDataMap:
    {{}}
  DependentFiles:
    []
  ImporterSettings: !<AssetImporterSettings>
    {{}}
  CompressionSettings: !<SingleCompressionSettings>
    CompressorName: Performance
    CompressionSettings: !<TextureCompressionMipmapSettings>
      Level: Medium
      Mipmap: false
''', encoding="utf-8")

lines=["// GENERATED by tools/render_story_decks.py. Hand-written narration decks (centerpieces and the start-point corner buildings) plus one or two cards per other building.",
       "export const STORY_CARD_COUNTS: Record<string, number> = {" + ", ".join(f"{k}: {len(v)}" for k,v in DATA.items()) + "}",
       "export function storyCardTexture(id: string, index: number): Texture | null {",
       "  index = index % (STORY_CARD_COUNTS[id] || 1)",
       "  const key = `${id}_${index}`", "  switch (key) {"]
for id,slides in DATA.items():
    for i,_ in enumerate(slides):
        lines.append(f'    case "{id}_{i}": return requireAsset("../Art/{id}/{id}_story_card_{i}.png") as Texture')
lines += ["    default: return null", "  }", "}",
          "export function storyCardFactId(id: string, index: number): string {",
          "  index = index % (STORY_CARD_COUNTS[id] || 1)",
          "  const key = `${id}_${index}`", "  switch (key) {"]
for id,slides in DATA.items():
    for i,slide in enumerate(slides):
        lines.append(f'    case "{id}_{i}": return "{slide["factId"]}"')
lines += ["    default: return \"\"", "  }", "}", ""]
(ROOT/"Assets/Retrospecs/Scripts/StoryDeck.ts").write_text("\n".join(lines),encoding="utf-8")
print(f"Rendered {len(all_outputs)} story cards and StoryDeck.ts")

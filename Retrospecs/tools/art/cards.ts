/**
 * Card art for the placeholder export: one SVG builder that feeds both the PNG (rendered with resvg, no text) and
 * the mock-up SVG (same drawing plus the real Cards.ts text), so the two can never drift apart.
 * Colours come from the PALETTE constant at the top of tools/export-art.ts (passed in as `pal`).
 */

export type Pal = Record<"cardinal" | "gold" | "sandstone" | "lightSand" | "outline" | "cream" | "cardinalSoft" | "goldSoft", string>

export const CARD_W = 1600
export const CARD_H = 1000

/** Text regions in card pixels (top-left x, y, width, height). The Lens types the words into these. */
export const LAYOUT = {
  frame: {x: 40, y: 40, w: 1520, h: 920, r: 64},
  accent: {x: 40, y: 40, w: 1520, h: 26},
  title: {x: 100, y: 100, w: 1020, h: 150},
  namesake: {x: 100, y: 258, w: 1020, h: 60},
  divider: {x: 100, y: 336, w: 1020, h: 5},
  fact: {x: 100, y: 372, w: 1020, h: 530},
  icon: {cx: 1345, cy: 500, r: 190}
}

export type Motif =
  | "namesake" | "founder" | "inside" | "architecture" | "fun"
  | "books" | "leaf" | "globe" | "atom" | "chart" | "chip" | "plane" | "plus" | "flask" | "frame" | "chat" | "briefcase" | "bag"

/** Simple flat icons drawn in a 200 x 200 box centred on 0,0. `fg` is the icon colour, `bg` the badge colour. */
function icon(m: Motif, fg: string, bg: string): string {
  switch (m) {
    case "namesake": // person bust
      return `<circle cx="0" cy="-38" r="38" fill="${fg}"/><path d="M-72,84 Q-72,8 0,8 Q72,8 72,84 Z" fill="${fg}"/>`
    case "founder": // light bulb with rays
      return `<circle cx="0" cy="-22" r="54" fill="${fg}"/><rect x="-24" y="28" width="48" height="24" rx="6" fill="${fg}"/><rect x="-18" y="58" width="36" height="14" rx="6" fill="${fg}"/>` +
        [-60, -30, 0, 30, 60].map((a) => `<rect x="-5" y="-118" width="10" height="22" rx="5" fill="${fg}" transform="rotate(${a} 0 -22)"/>`).join("")
    case "inside": // open doorway
      return `<rect x="-62" y="-88" width="124" height="176" rx="8" fill="${fg}"/><path d="M-44,-70 L30,-56 L30,88 L-44,70 Z" fill="${bg}"/><circle cx="16" cy="12" r="8" fill="${fg}"/>`
    case "architecture": // pediment and columns
      return `<path d="M-90,-42 L0,-92 L90,-42 Z" fill="${fg}"/>` + [-62, -13, 36].map((x) => `<rect x="${x}" y="-30" width="26" height="98" fill="${fg}"/>`).join("") +
        `<rect x="-92" y="72" width="184" height="18" rx="4" fill="${fg}"/>`
    case "fun": { // star
      const pts: string[] = []
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 38 : 92
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2
        pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r + 6).toFixed(1)}`)
      }
      return `<polygon points="${pts.join(" ")}" fill="${fg}"/>`
    }
    case "books":
      return `<rect x="-80" y="-60" width="38" height="140" rx="4" fill="${fg}"/><rect x="-34" y="-80" width="38" height="160" rx="4" fill="${fg}"/><rect x="22" y="-56" width="38" height="140" rx="4" fill="${fg}" transform="rotate(14 41 84)"/><rect x="-92" y="80" width="184" height="12" rx="4" fill="${fg}"/>`
    case "leaf":
      return `<path d="M0,-90 C66,-60 74,34 0,90 C-74,34 -66,-60 0,-90 Z" fill="${fg}"/><path d="M0,-70 L0,86" stroke="${bg}" stroke-width="8" stroke-linecap="round"/><path d="M0,-10 L-30,-36 M0,20 L32,-6 M0,48 L-28,24" stroke="${bg}" stroke-width="6" stroke-linecap="round"/>`
    case "globe":
      return `<circle cx="0" cy="0" r="86" fill="${fg}"/><ellipse cx="0" cy="0" rx="34" ry="86" fill="none" stroke="${bg}" stroke-width="7"/><path d="M-86,0 L86,0 M-74,-42 L74,-42 M-74,42 L74,42" stroke="${bg}" stroke-width="7"/>`
    case "atom":
      return [0, 60, 120].map((a) => `<ellipse cx="0" cy="0" rx="90" ry="32" fill="none" stroke="${fg}" stroke-width="11" transform="rotate(${a})"/>`).join("") + `<circle cx="0" cy="0" r="20" fill="${fg}"/>`
    case "chart":
      return `<rect x="-80" y="10" width="40" height="70" rx="4" fill="${fg}"/><rect x="-20" y="-40" width="40" height="120" rx="4" fill="${fg}"/><rect x="40" y="-80" width="40" height="160" rx="4" fill="${fg}"/><rect x="-92" y="84" width="184" height="10" rx="4" fill="${fg}"/>`
    case "chip":
      return `<rect x="-56" y="-56" width="112" height="112" rx="10" fill="${fg}"/><rect x="-30" y="-30" width="60" height="60" rx="6" fill="${bg}"/>` +
        [-36, -12, 12, 36].map((p) => `<rect x="${p - 5}" y="-84" width="10" height="24" fill="${fg}"/><rect x="${p - 5}" y="60" width="10" height="24" fill="${fg}"/><rect x="-84" y="${p - 5}" width="24" height="10" fill="${fg}"/><rect x="60" y="${p - 5}" width="24" height="10" fill="${fg}"/>`).join("")
    case "plane":
      return `<path d="M-90,6 L88,-70 L20,84 L-6,24 Z" fill="${fg}"/><path d="M-6,24 L88,-70" stroke="${bg}" stroke-width="7"/>`
    case "plus":
      return `<rect x="-28" y="-84" width="56" height="168" rx="10" fill="${fg}"/><rect x="-84" y="-28" width="168" height="56" rx="10" fill="${fg}"/>`
    case "flask":
      return `<path d="M-22,-86 L22,-86 L22,-24 L76,70 Q82,86 64,86 L-64,86 Q-82,86 -76,70 L-22,-24 Z" fill="${fg}"/><path d="M-50,40 L50,40 L66,70 L-66,70 Z" fill="${bg}"/>`
    case "frame":
      return `<rect x="-86" y="-70" width="172" height="140" rx="8" fill="${fg}"/><rect x="-66" y="-50" width="132" height="100" fill="${bg}"/><path d="M-66,50 L-20,-6 L10,26 L34,4 L66,50 Z" fill="${fg}"/><circle cx="34" cy="-26" r="12" fill="${fg}"/>`
    case "chat":
      return `<rect x="-88" y="-74" width="120" height="84" rx="22" fill="${fg}"/><path d="M-60,4 L-70,40 L-30,8 Z" fill="${fg}"/><rect x="-20" y="0" width="108" height="76" rx="22" fill="${fg}" opacity="0.8"/><path d="M60,70 L72,100 L36,72 Z" fill="${fg}" opacity="0.8"/>`
    case "briefcase":
      return `<rect x="-88" y="-40" width="176" height="122" rx="14" fill="${fg}"/><path d="M-34,-40 L-34,-70 Q-34,-80 -24,-80 L24,-80 Q34,-80 34,-70 L34,-40" fill="none" stroke="${fg}" stroke-width="12"/><rect x="-88" y="6" width="176" height="8" fill="${bg}"/>`
    case "bag":
      return `<path d="M-74,-34 L74,-34 L86,88 L-86,88 Z" fill="${fg}"/><path d="M-34,-34 L-34,-56 Q-34,-88 0,-88 Q34,-88 34,-56 L34,-34" fill="none" stroke="${fg}" stroke-width="12"/>`
  }
}

export interface CardArtSpec {
  motif: Motif
  /** Badge and accent-bar colour key. */
  accent: keyof Pal
}

/** The card drawing (no text). `extra` is appended inside the root (used by the mock-up). */
export function cardSvg(pal: Pal, spec: CardArtSpec, extra = ""): string {
  const f = LAYOUT.frame, a = LAYOUT.accent, d = LAYOUT.divider, ic = LAYOUT.icon
  const acc = pal[spec.accent]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
<defs>
  <filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.cream}"/><stop offset="1" stop-color="${pal.lightSand}"/></linearGradient>
  <clipPath id="clip"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r}"/></clipPath>
</defs>
<!-- soft glow edge -->
<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r}" fill="none" stroke="${pal.gold}" stroke-width="26" stroke-opacity="0.85" filter="url(#glow)"/>
<!-- warm light panel -->
<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r}" fill="url(#fill)" fill-opacity="0.94"/>
<!-- accent bar -->
<g clip-path="url(#clip)"><rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${acc}"/></g>
<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r}" fill="none" stroke="${pal.outline}" stroke-width="4"/>
<!-- divider under the title and namesake line -->
<rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="2" fill="${pal.sandstone}"/>
<!-- icon / graphic area -->
<circle cx="${ic.cx}" cy="${ic.cy}" r="${ic.r + 14}" fill="${pal.gold}" fill-opacity="0.7" filter="url(#halo)"/>
<circle cx="${ic.cx}" cy="${ic.cy}" r="${ic.r}" fill="${acc}"/>
<circle cx="${ic.cx}" cy="${ic.cy}" r="${ic.r - 14}" fill="none" stroke="${pal.cream}" stroke-width="5" stroke-opacity="0.8"/>
<g transform="translate(${ic.cx} ${ic.cy}) scale(1.2)">${icon(spec.motif, pal.cream, acc)}</g>
${extra}</svg>
`
}

// ---------------------------------------------------------------------------------------------------------------
// Mock-up

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

/** Greedy word wrap with an average glyph width of 0.53 em (generic sans-serif). */
export function wrap(text: string, fontPx: number, widthPx: number): string[] {
  const maxChars = Math.max(8, Math.floor(widthPx / (fontPx * 0.53)))
  const lines: string[] = []
  let cur = ""
  for (const w of text.split(/\s+/)) {
    if (!cur) cur = w
    else if ((cur + " " + w).length <= maxChars) cur += " " + w
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function textBlock(text: string, box: {x: number; y: number; w: number; h: number}, sizes: number[], weight: string, fill: string, lineH = 1.3): string {
  // Largest size whose wrapped lines fit the box (the Lens also wraps, then shrinks).
  let size = sizes[sizes.length - 1]
  let lines = wrap(text, size, box.w)
  for (const s of sizes) {
    const l = wrap(text, s, box.w)
    if (l.length * s * lineH <= box.h) {
      size = s
      lines = l
      break
    }
  }
  const tspans = lines.map((l, i) => `<tspan x="${box.x}" dy="${i === 0 ? size : (size * lineH).toFixed(1)}">${xmlEscape(l)}</tspan>`).join("")
  return `<text x="${box.x}" y="${box.y}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="#000000" stroke-width="${(size * 0.06).toFixed(1)}" paint-order="stroke">${tspans}</text>`
}

/** Card drawing plus dashed region guides and the real Cards.ts title, namesake line and fact text. */
export function mockupSvg(pal: Pal, spec: CardArtSpec, title: string, namesake: string, factText: string, note: string): string {
  const L = LAYOUT
  const guide = (b: {x: number; y: number; w: number; h: number}) =>
    `<rect x="${b.x - 8}" y="${b.y - 6}" width="${b.w + 16}" height="${b.h + 12}" fill="none" stroke="${pal.outline}" stroke-width="2" stroke-dasharray="12 8"/>`
  const parts = [
    `<!-- MOCK-UP. ${xmlEscape(note)} Dashed boxes are the text regions (px, top-left x,y,w,h): title ${L.title.x},${L.title.y},${L.title.w},${L.title.h}; namesake ${L.namesake.x},${L.namesake.y},${L.namesake.w},${L.namesake.h}; fact ${L.fact.x},${L.fact.y},${L.fact.w},${L.fact.h}. The Lens draws white text with a black outline. -->`,
    `<!-- title region -->`, guide(L.title), textBlock(title, L.title, [64, 56, 48, 42], "bold", "#FFFFFF", 1.15),
    `<!-- namesake region${namesake ? "" : ": this card has no namesake, so the line stays empty"} -->`, guide(L.namesake),
    namesake ? textBlock(namesake, L.namesake, [40, 34, 30, 26], "normal", pal.goldSoft, 1.1) : "",
    `<!-- fact region -->`, guide(L.fact), textBlock(factText, L.fact, [46, 42, 38, 34], "normal", "#FFFFFF", 1.35),
    ""
  ]
  return cardSvg(pal, spec, parts.join("\n"))
}

/**
 * Compact focus card layout (cm, card-local, y up, centred on 0,0). One short, wide card instead of a tall stack:
 * the art (if any) sits in a column on the left, the words on the right, a large X close button in the top-right
 * corner and a "Next spot" button along the bottom-right. Short and wide fits the Spectacles view (narrow
 * vertically) while the wearer's eyes move between the card and the floor map. Pure, so it's unit-tested.
 */
import {MeshChunk} from "./MapMesh"
import {Rect2, fitMedia} from "./Focus"

export interface CompactInput {
  /** Card width (cm). */
  width: number
  /** Heights of the text pieces as they'll be drawn (cm), 0 when absent. */
  titleH: number
  namesakeH: number
  bodyH: number
  sourceH: number
  /** Art aspect (w / h), or 0 for no art. */
  artAspect: number
}

export interface CompactLayout {
  /** Whole card. */
  card: Rect2
  /** Accent bar along the top. */
  accent: Rect2
  /** Text column (title at its top). */
  text: Rect2
  /** Art picture (fitted to its aspect) and the frame box it sits in, or null. */
  art: Rect2 | null
  artBox: Rect2 | null
  /** Artist credit line under the art, or null. */
  credit: Rect2 | null
  /** Close button: drawn square and the bigger hit box. */
  close: Rect2
  closeHit: Rect2
  /** Next spot button: drawn pill and hit box. */
  next: Rect2
  nextHit: Rect2
  /** Ask button (mic + "Ask"), left of Next spot: drawn pill and hit box. */
  ask: Rect2
  askHit: Rect2
  /** Top y of each text piece (cm) in the text column. */
  titleTop: number
  namesakeTop: number
  bodyTop: number
  sourceTop: number
}

export const COMPACT = {
  pad: 2.4,
  accentH: 0.8,
  closeCm: 8,
  /** The hit box extends this much past the drawn button on every side. */
  hitPadCm: 2.5,
  nextW: 20,
  nextH: 6,
  askW: 13,
  gap: 0.8,
  artColumnFrac: 0.4,
  creditH: 2.6,
  minArtH: 14
}

/** Text column width for a card of `width`, with or without an art column. */
export function compactTextWidth(width: number, hasArt: boolean): number {
  const p = COMPACT.pad
  const inner = width - 2 * p
  // The title row also holds the close button.
  return hasArt ? inner * (1 - COMPACT.artColumnFrac) - p : inner
}

export function compactLayout(c: CompactInput): CompactLayout {
  const P = COMPACT.pad
  const W = c.width
  const hasArt = c.artAspect > 0
  const textW = compactTextWidth(W, hasArt)
  // Title row is at least as tall as the close button, so the X never overlaps the namesake.
  const titleRow = Math.max(c.titleH, COMPACT.closeCm)
  const textH =
    titleRow + (c.namesakeH ? COMPACT.gap * 0.5 + c.namesakeH : 0) + (c.bodyH ? COMPACT.gap + c.bodyH : 0) +
    (c.sourceH ? COMPACT.gap * 0.5 + c.sourceH : 0)
  const contentH = Math.max(textH + COMPACT.gap + COMPACT.nextH, hasArt ? COMPACT.minArtH + COMPACT.creditH : 0)
  const H = COMPACT.accentH + P + contentH + P
  const x0 = -W / 2, x1 = W / 2, y0 = -H / 2, y1 = H / 2
  const top = y1 - COMPACT.accentH - P

  let art: Rect2 | null = null
  let artBox: Rect2 | null = null
  let credit: Rect2 | null = null
  let textX0 = x0 + P
  if (hasArt) {
    const colW = (W - 2 * P) * COMPACT.artColumnFrac
    const boxH = contentH - COMPACT.creditH
    artBox = {x0: x0 + P, y0: top - boxH, x1: x0 + P + colW, y1: top}
    const f = fitMedia(c.artAspect, colW - 1.2, boxH - 1.2)
    const cx = (artBox.x0 + artBox.x1) / 2, cy = (artBox.y0 + artBox.y1) / 2
    art = {x0: cx - f.w / 2, y0: cy - f.h / 2, x1: cx + f.w / 2, y1: cy + f.h / 2}
    credit = {x0: artBox.x0, y0: artBox.y0 - COMPACT.creditH, x1: artBox.x1, y1: artBox.y0}
    textX0 = artBox.x1 + P
  }
  const textX1 = textX0 + textW
  const close: Rect2 = {x0: x1 - P - COMPACT.closeCm, y0: top - COMPACT.closeCm, x1: x1 - P, y1: top}
  // Bottom row of the text column: [Ask] [Next spot], both shrunk alike when the column is too narrow for their
  // full widths (a card with art), never past the column's left edge. Heights stay, so targets stay >= minimum.
  const rowGap = 2 * COMPACT.gap
  const room = x1 - P - textX0
  const k = Math.min(1, (room - rowGap) / (COMPACT.nextW + COMPACT.askW))
  const nextW = COMPACT.nextW * k, askW = COMPACT.askW * k
  const next: Rect2 = {x0: x1 - P - nextW, y0: y0 + P, x1: x1 - P, y1: y0 + P + COMPACT.nextH}
  // Generous toward the card edges, tight toward the text, so a pinch on the words never hits a button.
  const hp = COMPACT.hitPadCm, inward = COMPACT.gap * 0.4
  const closeHit: Rect2 = {x0: close.x0 - inward, y0: close.y0 - inward, x1: close.x1 + hp, y1: close.y1 + hp}
  const nextHit: Rect2 = {x0: next.x0 - inward, y0: next.y0 - hp, x1: next.x1 + hp, y1: next.y1 + inward}
  const askX1 = next.x0 - rowGap
  const ask: Rect2 = {x0: askX1 - askW, y0: next.y0, x1: askX1, y1: next.y1}
  const askHit: Rect2 = {x0: ask.x0 - inward, y0: ask.y0 - hp, x1: ask.x1 + inward * 0.9, y1: ask.y1 + inward}

  const titleTop = top
  const namesakeTop = top - titleRow - COMPACT.gap * 0.5
  const bodyTop = (c.namesakeH ? namesakeTop - c.namesakeH : top - titleRow) - COMPACT.gap
  const sourceTop = (c.bodyH ? bodyTop - c.bodyH : bodyTop + COMPACT.gap) - COMPACT.gap * 0.5
  return {
    card: {x0, y0, x1, y1},
    accent: {x0, y0: y1 - COMPACT.accentH, x1, y1},
    text: {x0: textX0, y0: y0 + P, x1: textX1, y1: top},
    art, artBox, credit,
    close, closeHit,
    next, nextHit,
    ask, askHit,
    titleTop, namesakeTop, bodyTop, sourceTop
  }
}

/** A bold X inside `r` (two crossed bars `thick` cm wide), both windings, 8 floats per vertex like quadsChunk. */
export function crossChunk(r: Rect2, thick: number, z = 0): MeshChunk {
  const verts: number[] = []
  const idx: number[] = []
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2
  const half = (Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2) * Math.SQRT2 * 0.62
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const ux = Math.cos(a), uy = Math.sin(a) // along the bar
    const vx = -uy, vy = ux // across it
    const t = thick / 2
    const b = verts.length / 8
    const pts = [
      [cx - ux * half - vx * t, cy - uy * half - vy * t],
      [cx + ux * half - vx * t, cy + uy * half - vy * t],
      [cx + ux * half + vx * t, cy + uy * half + vy * t],
      [cx - ux * half + vx * t, cy - uy * half + vy * t]
    ]
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]]
    pts.forEach((p, i) => verts.push(p[0], p[1], z, 0, 0, 1, uv[i][0], uv[i][1]))
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2)
  }
  return {verts, idx}
}

// ---------------------------------------------------------------------------
// Angular sizing (Snap, "Positioning and Sizing Content":
// https://developers.snap.com/spectacles/best-practices/design-for-spectacles/positioning-sizing-content).
// Cards are specified in degrees and converted to cm at their distance, so distance and size can't drift apart.

export const SPECTACLES = {
  /** Far field is 60-160 cm; detailed content is most comfortable at about 1 m. */
  farFieldMinCm: 60,
  farFieldMaxCm: 160,
  /** Usable binocular width: 53 cm at 110 cm and 75 cm at 160 cm, i.e. about 27 degrees. */
  binocularWidthDeg: 27,
  /** Targets: at least 2 degrees (the table's "best" column is about 3), at least 1 degree apart. */
  minTargetDeg: 2,
  bestTargetDeg: 3,
  minTargetGapDeg: 1
}

const RAD = Math.PI / 180

/** Size (cm) that subtends `deg` at `distanceCm`. */
export function cmForDeg(deg: number, distanceCm: number): number {
  return 2 * distanceCm * Math.tan((deg * RAD) / 2)
}

/** Angle (degrees) that `cm` subtends at `distanceCm`. */
export function degForCm(cm: number, distanceCm: number): number {
  return (2 * Math.atan(cm / 2 / distanceCm)) / RAD
}

/** `r` grown about its centre to at least minW x minH (never shrunk). */
export function growToMin(r: Rect2, minW: number, minH = minW): Rect2 {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2
  const w = Math.max(Math.abs(r.x1 - r.x0), minW) / 2
  const h = Math.max(Math.abs(r.y1 - r.y0), minH) / 2
  return {x0: cx - w, y0: cy - h, x1: cx + w, y1: cy + h}
}

/**
 * Compact card scale and local width. The text is built in local cm (`bodyLineLocalCm` is the body's line pitch),
 * so the scale is what puts one body line at `bodyLineDeg`; the local width is then whatever gives `widthDeg`.
 */
export function compactCardSize(widthDeg: number, bodyLineDeg: number, distanceCm: number, bodyLineLocalCm: number): {scale: number; width: number} {
  const scale = cmForDeg(bodyLineDeg, distanceCm) / bodyLineLocalCm
  return {scale, width: cmForDeg(widthDeg, distanceCm) / scale}
}

/** Illustrated story card: the 1200 x 1280 texture (portrait card plus the Next Stop button to its right). */
export const STORY_CARD = {widthCm: 67.5, heightCm: 72, texW: 1200, texH: 1280}

/** Story card scale: the whole texture spans `widthDeg` at `distanceCm`. */
export function storyCardScale(widthDeg: number, distanceCm: number): number {
  return cmForDeg(widthDeg, distanceCm) / STORY_CARD.widthCm
}

/**
 * Story card buttons in card-local cm (y up, centred), each grown about its drawn centre to at least `minLocalCm`.
 * Pixel boxes are the drawn buttons in the texture (top-left origin).
 */
export function storyCardHits(minLocalCm: number): {close: Rect2; more: Rect2; next: Rect2} {
  const {widthCm: W, heightCm: H, texH} = STORY_CARD
  const k = H / texH
  const px = (x0: number, y0: number, x1: number, y1: number) =>
    growToMin({x0: -W / 2 + x0 * k, x1: -W / 2 + x1 * k, y0: H / 2 - y1 * k, y1: H / 2 - y0 * k}, minLocalCm)
  return {
    close: px(786, 60, 854, 132),
    more: px(88, 1100, 545, 1210),
    next: px(920, 1000, 1182, 1142)
  }
}

/**
 * The Ask button on the illustrated story card, drawn as a mesh (it isn't in the texture): in the empty right-hand
 * column, directly above the baked Next Stop button and the same width. Taller than Next Stop, so it is already past
 * the minimum target size and its hit box stays clear of Next Stop's grown one. Card-local cm.
 */
export function storyAskButton(minLocalCm: number): {drawn: Rect2; hit: Rect2} {
  const next = storyCardHits(0).next
  const drawn: Rect2 = {x0: next.x0, x1: next.x1, y0: -18.4, y1: -8.4}
  const g = growToMin(drawn, minLocalCm)
  // Extra reach outward (right, up), never down toward Next Stop.
  return {drawn, hit: {x0: g.x0, y0: g.y0, x1: g.x1 + 1.5, y1: g.y1 + 1.5}}
}

/**
 * A microphone drawn from rectangles inside the square of side `s` centred on (cx, cy): capsule, the U-shaped
 * cradle, stem and base. Used on the Ask button and the chat's listening line.
 */
export function micGlyphRects(cx: number, cy: number, s: number): Rect2[] {
  const r = (x0: number, y0: number, x1: number, y1: number): Rect2 => ({x0: cx + x0 * s, y0: cy + y0 * s, x1: cx + x1 * s, y1: cy + y1 * s})
  return [
    r(-0.17, -0.04, 0.17, 0.48), // capsule
    r(-0.34, -0.14, -0.25, 0.16), // cradle left
    r(0.25, -0.14, 0.34, 0.16), // cradle right
    r(-0.34, -0.23, 0.34, -0.14), // cradle bottom
    r(-0.045, -0.4, 0.045, -0.23), // stem
    r(-0.22, -0.48, 0.22, -0.4) // base
  ]
}

/** True when two rects overlap (touching edges don't count). */
export function rectsOverlap(a: Rect2, b: Rect2): boolean {
  const ax0 = Math.min(a.x0, a.x1), ax1 = Math.max(a.x0, a.x1), ay0 = Math.min(a.y0, a.y1), ay1 = Math.max(a.y0, a.y1)
  const bx0 = Math.min(b.x0, b.x1), bx1 = Math.max(b.x0, b.x1), by0 = Math.min(b.y0, b.y1), by1 = Math.max(b.y0, b.y1)
  return ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1
}

/** True when the card-local point (cm) is inside `r`. */
export function inRect(r: Rect2, x: number, y: number): boolean {
  return x >= Math.min(r.x0, r.x1) && x <= Math.max(r.x0, r.x1) && y >= Math.min(r.y0, r.y1) && y <= Math.max(r.y0, r.y1)
}

/**
 * Focus mode helpers (pure TypeScript, unit-tested): easing, the number graphic for the info panel, layout of the
 * panel and the per-building extras around a focused building, and flat quad meshes.
 *
 * The info panel must never invent facts. `extractFigures` only lifts numbers that are already written in a fact's
 * text, and every label it returns is built from that matched text. The money bar compares against the largest
 * dollar amount already in Cards.ts, and says which building that is.
 */
import {CARDS, Card, Fact} from "./Cards"
import {MeshChunk} from "./MapMesh"

// ---------------------------------------------------------------------------
// Easing and blends

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Smooth ease-in-out (smoothstep) of a 0..1 value. */
export function easeInOut(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** Moves a linear 0..1 blend toward `target` so a full sweep takes `durationSec`. Reversible mid-way. */
export function stepBlend(current: number, target: number, dt: number, durationSec: number): number {
  if (durationSec <= 0) return target
  const step = dt / durationSec
  if (current < target) return Math.min(target, current + step)
  if (current > target) return Math.max(target, current - step)
  return current
}

export interface FocusTuning {
  /** Uniform scale of the focused building at full focus. */
  focusScale: number
  /** Extra lift of the focused building (map cm). */
  focusLiftCm: number
  /** Height scale of every other building at full focus ("smaller, not gone"). */
  backgroundScale: number
  /** Brightness multiplier of everything else at full focus (additive display: lower = more see-through). */
  backgroundDim: number
}

export const DEFAULT_FOCUS: FocusTuning = {focusScale: 1.8, focusLiftCm: 1.2, backgroundScale: 0.35, backgroundDim: 0.35}

/** Scale and brightness of a background chunk or an unfocused landmark for an eased background blend `bg`. */
export function backgroundLook(bg: number, t: FocusTuning): {scaleY: number; dim: number} {
  return {scaleY: lerp(1, t.backgroundScale, bg), dim: lerp(1, t.backgroundDim, bg)}
}

/**
 * Transform of one landmark. `bg` is the eased background blend, `fb` its own eased focus blend (1 = it is the
 * focus). An unfocused landmark shrinks in height like the background; the focused one grows uniformly and lifts.
 */
export function landmarkLook(bg: number, fb: number, t: FocusTuning): {scaleXZ: number; scaleY: number; liftCm: number; dim: number} {
  const back = backgroundLook(bg, t)
  return {
    scaleXZ: lerp(1, t.focusScale, fb),
    scaleY: lerp(back.scaleY, t.focusScale, fb),
    liftCm: t.focusLiftCm * fb,
    dim: lerp(back.dim, 1, fb)
  }
}

// ---------------------------------------------------------------------------
// Numbers already in the fact text

export type FigureKind = "money" | "percent" | "year" | "measure"

export interface Figure {
  kind: FigureKind
  value: number
  /** Short display form, built only from the matched text ("$30M", "57%", "1992", "285 feet"). */
  label: string
  /** The exact substring of the fact this came from. */
  source: string
  index: number
}

// Units we show after a bare number. Longest first so "square feet" beats "feet".
const MEASURE_UNITS = ["square feet", "specialized labs", "feet", "people", "pipes", "bells", "bell", "labs", "seat", "years old"]

const WORD_SCALE: Record<string, number> = {thousand: 1e3, million: 1e6, billion: 1e9}

function num(s: string): number {
  return parseFloat(s.replace(/,/g, ""))
}

/** Compact dollars: 30e6 -> "$30M", 77.4e6 -> "$77.4M", 6e6 -> "$6M", 2500 -> "$2,500". */
export function formatMoney(usd: number): string {
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString()
  if (usd >= 1e9) return "$" + fmt(usd / 1e9) + "B"
  if (usd >= 1e6) return "$" + fmt(usd / 1e6) + "M"
  if (usd >= 1e3 && usd % 1000 === 0) return "$" + fmt(usd / 1e3) + "K"
  return "$" + String(Math.round(usd)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/** Every money amount, percentage, year and unit measure written in `text`, in reading order. */
export function extractFigures(text: string): Figure[] {
  const out: Figure[] = []
  const taken: [number, number][] = []
  const free = (a: number, b: number) => taken.every(([x, y]) => b <= x || a >= y)
  const add = (f: Figure) => {
    taken.push([f.index, f.index + f.source.length])
    out.push(f)
  }
  let m: RegExpExecArray | null

  // "$30 million", "$2,500", "30 million dollar(s)", "77.4 million dollars".
  const moneyA = /\$(\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|million|billion))?/gi
  while ((m = moneyA.exec(text))) {
    const v = num(m[1]) * (m[2] ? WORD_SCALE[m[2].toLowerCase()] : 1)
    add({kind: "money", value: v, label: formatMoney(v), source: m[0], index: m.index})
  }
  const moneyB = /\b(\d[\d,]*(?:\.\d+)?)\s*(thousand|million|billion)?\s*dollars?\b/gi
  while ((m = moneyB.exec(text))) {
    if (!free(m.index, m.index + m[0].length)) continue
    const v = num(m[1]) * (m[2] ? WORD_SCALE[m[2].toLowerCase()] : 1)
    add({kind: "money", value: v, label: formatMoney(v), source: m[0], index: m.index})
  }

  const pct = /\b(\d+(?:\.\d+)?)\s*(?:percent|%)/gi
  while ((m = pct.exec(text))) {
    if (!free(m.index, m.index + m[0].length)) continue
    add({kind: "percent", value: num(m[1]), label: m[1] + "%", source: m[0], index: m.index})
  }

  // Years 1800-2099, not part of a longer number ("1,300", "10,000") or an ordinal.
  const year = /(^|[^\d,.$])((?:18|19|20)\d\d)(?!\d|,\d|st|nd|rd|th|s\b)/g
  while ((m = year.exec(text))) {
    const at = m.index + m[1].length
    if (!free(at, at + 4)) continue
    add({kind: "year", value: num(m[2]), label: m[2], source: m[2], index: at})
  }

  // "84 by 30 feet": keep both sides together so it never reads as just "30 feet".
  const dims = new RegExp(`\\b(\\d[\\d,]*)\\s+by\\s+(\\d[\\d,]*)\\s+(${MEASURE_UNITS.join("|")})\\b`, "gi")
  while ((m = dims.exec(text))) {
    if (!free(m.index, m.index + m[0].length)) continue
    add({kind: "measure", value: num(m[1]) * num(m[2]), label: `${m[1]} × ${m[2]} ${m[3].toLowerCase()}`, source: m[0], index: m.index})
  }

  // "285 feet", "208,000 square feet", "1,300 people", "300-seat", "48-bell", "28 years old".
  const measure = new RegExp(`\\b(\\d[\\d,]*)(?:-|\\s+)(${MEASURE_UNITS.join("|")})\\b`, "gi")
  while ((m = measure.exec(text))) {
    if (!free(m.index, m.index + m[0].length)) continue
    const unit = m[2].toLowerCase()
    const label = /-/.test(m[0]) ? `${m[1]}-${unit}` : `${m[1]} ${unit}`
    add({kind: "measure", value: num(m[1]), label, source: m[0], index: m.index})
  }

  return out.sort((a, b) => a.index - b.index)
}

/** Largest dollar amount in all facts, with the card it belongs to (the money bar's full scale). */
export function largestGift(cards: Card[] = CARDS): {value: number; cardId: string; label: string} | null {
  let best: {value: number; cardId: string; label: string} = null
  for (const c of cards) {
    for (const f of c.facts) {
      for (const g of extractFigures(f.text)) {
        if (g.kind === "money" && (!best || g.value > best.value)) best = {value: g.value, cardId: c.id, label: c.label}
      }
    }
  }
  return best
}

export type GraphicKind = "bar" | "callout" | "timeline"

export interface PanelGraphic {
  kind: GraphicKind
  /** Big number text. */
  big: string
  /** Small line under the graphic. Only rearranged text and numbers from Cards.ts. */
  caption: string
  /** Bar fill, 0..1 (bar only). */
  fraction?: number
  /** Timeline ticks: position 0..1 along the line and the year label (timeline only). */
  ticks?: {t: number; label: string}[]
  /** Other numbers from the same fact, shown as small chips. */
  chips: string[]
}

/**
 * Picks one graphic for a fact, or null when it has no numbers. Priority: money (bar against the largest gift in
 * the notes), percent (bar out of 100), two or more years (timeline), one year or a measure (big-number callout).
 */
export function panelGraphic(fact: Fact | null, cards: Card[] = CARDS): PanelGraphic | null {
  if (!fact) return null
  const figs = extractFigures(fact.text)
  if (!figs.length) return null
  const money = figs.filter((f) => f.kind === "money")
  const pct = figs.filter((f) => f.kind === "percent")
  const years = figs.filter((f) => f.kind === "year")
  const measures = figs.filter((f) => f.kind === "measure")
  const chipsExcept = (used: Figure[]) => figs.filter((f) => used.indexOf(f) < 0).map((f) => f.label).slice(0, 3)

  if (money.length) {
    const m = money.reduce((a, b) => (b.value > a.value ? b : a))
    const top = largestGift(cards)
    const full = top && top.value >= m.value ? top : {value: m.value, cardId: "", label: ""}
    const caption = full.cardId && full.value > m.value ? `${m.label} next to ${formatMoney(full.value)} (${full.label}), the largest sum in my notes` : `${m.label}, the largest sum in my notes`
    return {kind: "bar", big: m.label, caption, fraction: clamp01(m.value / full.value), chips: chipsExcept([m])}
  }
  if (pct.length) {
    const p = pct[0]
    return {kind: "bar", big: p.label, caption: p.source, fraction: clamp01(p.value / 100), chips: chipsExcept([p])}
  }
  if (years.length >= 2) {
    const vals = years.map((y) => y.value)
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const seen: Record<string, boolean> = {}
    const ticks = years
      .filter((y) => (seen[y.label] ? false : (seen[y.label] = true)))
      .map((y) => ({t: hi > lo ? (y.value - lo) / (hi - lo) : 0.5, label: y.label}))
      .sort((a, b) => a.t - b.t)
    return {kind: "timeline", big: `${lo}–${hi}`, caption: `${hi - lo} years apart`, ticks, chips: chipsExcept(years)}
  }
  const one = years[0] || measures[0] || figs[0]
  return {kind: "callout", big: one.label, caption: "", chips: chipsExcept([one])}
}

// ---------------------------------------------------------------------------
// Footprint size and layout around the focused building

/** Largest distance (m) from a centre to a baked footprint ring (decimetres east, north, interleaved). */
export function footprintRadiusM(ringXY: number[], centerE: number, centerN: number): number {
  let r = 0
  for (let i = 0; i + 1 < ringXY.length; i += 2) {
    r = Math.max(r, Math.hypot(ringXY[i] / 10 - centerE, ringXY[i + 1] / 10 - centerN))
  }
  return r
}

export interface P3 {
  x: number
  y: number
  z: number
}

export interface FocusLayout {
  /** Info panel (main screen) centre. */
  panel: P3
  /** Exploded model centre: the screen to the wearer's right of the main screen. */
  showcase: P3
  /** Experience centre: the screen to the wearer's left of the main screen. */
  experience: P3
  /** Horizontal unit vectors: the wall's right, and from the screens back toward the wearer. */
  right: P3
  toCam: P3
}

// ---------------------------------------------------------------------------
// The "wall of TVs": floating screens in front of the wearer at about eye height.
//
// Wall frame: `origin` is the wearer's eye position when the wall was last placed, `yaw` the heading it faces
// (forward = (sin yaw, 0, cos yaw)). Local coordinates: x to the wearer's right, y up, z forward (cm). The main
// screen sits straight ahead; the side screens sit on the same circle around the eyes, one either side, each turned
// to face the wearer. The wall only re-centres (smoothly) when the wearer turns or walks well away, so it never
// jitters with small head motion.

export interface WallConfig {
  /** Main screen size (cm). The info panel publishes its real size here each time it builds. */
  mainWidthCm: number
  mainHeightCm: number
  /** Distance from the eyes to the main screen (cm). */
  distanceCm: number
  /** How far below eye height the main screen's centre sits (cm). */
  dropCm: number
  /** Width of a side screen (the exploded model / experience slot, cm). */
  sideSizeCm: number
  /** Angular gap between screens (degrees). */
  gapDeg: number
  /** Re-centre once the wearer's heading is this far from the wall's (degrees). Keep it past the side screens. */
  followDeg: number
  /** ...or once the eyes are this far from where the wall was placed (cm). */
  followCm: number
  /** Re-centring speed (1/s, exponential approach). */
  followSpeed: number
  /** Clear space kept between the main screen's bottom edge and the line from the eyes to the focused building (cm). */
  sightMarginCm: number
}

export const DEFAULT_WALL: WallConfig = {
  mainWidthCm: 60, mainHeightCm: 44, distanceCm: 130, dropCm: 14, sideSizeCm: 40, gapDeg: 6,
  followDeg: 40, followCm: 45, followSpeed: 3, sightMarginCm: 4
}

/** Live wall config (the info panel copies its inputs and its built size in here). */
export const TV_WALL: WallConfig = {...DEFAULT_WALL}

const DEG = Math.PI / 180

/** Heading (radians) of a horizontal direction: 0 = +z, pi/2 = +x. */
export function yawOf(dx: number, dz: number): number {
  return Math.atan2(dx, dz)
}

/** a - b wrapped to (-pi, pi]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d <= -Math.PI) d += 2 * Math.PI
  return d
}

export class TvWall {
  active = false
  origin: P3 = {x: 0, y: 0, z: 0}
  yaw = 0
  following = false

  /** Places the wall at the eyes `cam`, facing heading `yaw`, immediately. */
  reset(cam: P3, yaw: number) {
    this.origin = {x: cam.x, y: cam.y, z: cam.z}
    this.yaw = yaw
    this.following = false
    this.active = true
  }

  deactivate() {
    this.active = false
    this.following = false
  }

  forward(): P3 {
    return {x: Math.sin(this.yaw), y: 0, z: Math.cos(this.yaw)}
  }

  /** The wearer's right when facing the wall (facing f, right = (-f.z, 0, f.x)). */
  right(): P3 {
    return {x: -Math.cos(this.yaw), y: 0, z: Math.sin(this.yaw)}
  }

  toWorld(l: P3): P3 {
    const f = this.forward()
    const r = this.right()
    return {x: this.origin.x + r.x * l.x + f.x * l.z, y: this.origin.y + l.y, z: this.origin.z + r.z * l.x + f.z * l.z}
  }

  toLocal(w: P3): P3 {
    const f = this.forward()
    const r = this.right()
    const dx = w.x - this.origin.x
    const dz = w.z - this.origin.z
    return {x: dx * r.x + dz * r.z, y: w.y - this.origin.y, z: dx * f.x + dz * f.z}
  }

  /**
   * Lazy follow. `cam` is the eye position, `viewYaw` the wearer's heading (from up x camera-right, so it stays
   * defined when looking down at the floor map). Starts re-centring when the heading is off by more than
   * `followDeg` or the eyes moved more than `followCm`, then eases toward the wearer until aligned again.
   * Returns true while it is moving.
   */
  update(cam: P3, viewYaw: number, dt: number, cfg: WallConfig = TV_WALL): boolean {
    if (!this.active) return false
    const dYaw = angleDiff(viewYaw, this.yaw)
    const dist = Math.hypot(cam.x - this.origin.x, cam.y - this.origin.y, cam.z - this.origin.z)
    if (!this.following && (Math.abs(dYaw) > cfg.followDeg * DEG || dist > cfg.followCm)) this.following = true
    if (!this.following) return false
    const k = 1 - Math.exp(-Math.max(0, dt) * cfg.followSpeed)
    this.yaw = this.yaw + dYaw * k
    this.origin = {x: lerp(this.origin.x, cam.x, k), y: lerp(this.origin.y, cam.y, k), z: lerp(this.origin.z, cam.z, k)}
    const left = Math.hypot(cam.x - this.origin.x, cam.y - this.origin.y, cam.z - this.origin.z)
    if (Math.abs(angleDiff(viewYaw, this.yaw)) < 2 * DEG && left < 3) this.following = false
    return true
  }
}

/** The one wall shared by the info panel (which places and moves it) and the side screens (which ride on it). */
export const sharedWall = new TvWall()

export interface WallSlots {
  /** Local centres (cm). */
  main: P3
  left: P3
  right: P3
  /** Angle of the side screens' centres from straight ahead (radians). */
  sideAngle: number
}

/**
 * Local slot centres. `topLocal` (optional) is the focused building's top in wall coordinates: the main screen
 * rises, if needed, so its bottom edge stays above the line of sight to it.
 */
export function wallSlots(cfg: WallConfig = TV_WALL, topLocal?: P3): WallSlots {
  const D = cfg.distanceCm
  let y = -cfg.dropCm
  if (topLocal && topLocal.z > 1) {
    const lineX = (topLocal.x * D) / topLocal.z
    const lineY = (topLocal.y * D) / topLocal.z
    if (Math.abs(lineX) < cfg.mainWidthCm / 2 + cfg.sightMarginCm) {
      const need = lineY + cfg.sightMarginCm + cfg.mainHeightCm / 2
      // Rise above the sightline, but never put the screen's centre more than 10 cm above the eyes.
      if (need > y) y = Math.min(need, 10)
    }
  }
  const halfMain = Math.atan(cfg.mainWidthCm / 2 / D)
  const halfSide = Math.atan(cfg.sideSizeCm / 2 / D)
  const a = halfMain + cfg.gapDeg * DEG + halfSide
  const sy = -cfg.dropCm
  return {
    main: {x: 0, y, z: D},
    right: {x: D * Math.sin(a), y: sy, z: D * Math.cos(a)},
    left: {x: -D * Math.sin(a), y: sy, z: D * Math.cos(a)},
    sideAngle: a
  }
}

/**
 * World layout of the focus screens. They float in front of the wearer (`cam`, the eyes) at about eye height: on
 * the shared wall when it is placed (the info panel places it on show(), before the controller asks for this),
 * otherwise facing the focused building. `top` is the top of the focused building (the main screen stays above the
 * line of sight to it), `base` its footprint centre. The old above-the-building sizes in `o` are still accepted for
 * the controller's call, but only `sideObjectCm` matters now (it widens the side slots if larger).
 */
export function focusLayout(
  base: P3, top: P3, cam: P3,
  o: {panelWidthCm?: number; panelHeightCm?: number; panelGapCm?: number; sideObjectCm?: number; sideGapCm?: number},
  wall: TvWall = sharedWall,
  cfg: WallConfig = TV_WALL
): FocusLayout {
  let w = wall
  if (!w.active) {
    w = new TvWall()
    const dx = top.x - cam.x
    const dz = top.z - cam.z
    w.reset(cam, Math.hypot(dx, dz) > 1e-6 ? yawOf(dx, dz) : yawOf(base.x - cam.x, base.z - cam.z))
  }
  const c = o.sideObjectCm && o.sideObjectCm > cfg.sideSizeCm ? {...cfg, sideSizeCm: o.sideObjectCm} : cfg
  const s = wallSlots(c, w.toLocal(top))
  const f = w.forward()
  return {
    panel: w.toWorld(s.main),
    showcase: w.toWorld(s.right),
    experience: w.toWorld(s.left),
    right: w.right(),
    toCam: {x: -f.x, y: 0, z: -f.z}
  }
}

// ---------------------------------------------------------------------------
// Artist media (Nazeli Sayra Kurtoğlu's illustrations and animation; see Art/nazeli_samples/README.md)

/** Credit line shown under her art on the focus screen. */
export const ARTIST_CREDIT = "Art: Nazeli Sayra Kurtoğlu"

/** Largest w x h with the given aspect (w / h) inside maxW x maxH. */
export function fitMedia(aspect: number, maxW: number, maxH: number): {w: number; h: number} {
  const a = aspect > 0 && isFinite(aspect) ? aspect : 16 / 9
  return a >= maxW / maxH ? {w: maxW, h: maxW / a} : {w: maxH * a, h: maxH}
}

/** Idle exit: true once nothing has been spoken for `idleSec` since the last speech (or since focus began). */
export function idleExpired(now: number, lastActiveAt: number, idleSec: number): boolean {
  return idleSec > 0 && now - lastActiveAt >= idleSec
}

// ---------------------------------------------------------------------------
// Flat quads for the panel (XY plane, facing +Z and -Z), 8 floats per vertex like MapMesh.

export interface Rect2 {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function quadsChunk(rects: Rect2[], z = 0): MeshChunk {
  const verts: number[] = []
  const idx: number[] = []
  for (const r of rects) {
    const b = verts.length / 8
    const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1)
    const y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1)
    verts.push(x0, y0, z, 0, 0, 1, 0, 0, x1, y0, z, 0, 0, 1, 1, 0, x1, y1, z, 0, 0, 1, 1, 1, x0, y1, z, 0, 0, 1, 0, 1)
    // Both windings so the quad shows from either side.
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2)
  }
  return {verts, idx}
}

/** Rectangular frame (four thin quads) around a rect. */
export function frameRects(r: Rect2, thickness: number): Rect2[] {
  const t = thickness
  return [
    {x0: r.x0, y0: r.y1 - t, x1: r.x1, y1: r.y1},
    {x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y0 + t},
    {x0: r.x0, y0: r.y0 + t, x1: r.x0 + t, y1: r.y1 - t},
    {x0: r.x1 - t, y0: r.y0 + t, x1: r.x1, y1: r.y1 - t}
  ]
}

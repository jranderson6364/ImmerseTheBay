/**
 * "Pile of money": a donor's gift drawn as a real-scale pile of $1 bills on pallets, plus a 1.75 m person for scale.
 * Pure TypeScript (no Lens types), unit-tested in tests/money.test.ts.
 *
 * Gift amounts come ONLY from facts in Core/Cards.ts: each gift names a fact id and the amount is parsed from that
 * fact's text, so the caption can never drift from the spoken fact. Every physical number shown on screen comes
 * from a source constant below.
 *
 * Mesh layout matches Core/MapMesh.ts: 8 floats per vertex (position xyz, normal xyz, texture0 uv), UInt16 indices,
 * chunks under 64,000 vertices, double-sided triangles. Units: centimetres, Y up, the pile's FRONT faces +Z.
 */
import {factById} from "./Cards"
import {V3} from "./Geo"
import {MeshChunk, vertexCount} from "./MapMesh"

// ---------------------------------------------------------------------------
// Sourced constants (opened Nov 14 2026)

/** "measuring 6.14 x 2.61 inches" (1929 entry, size of Federal Reserve notes since then). */
export const NOTE_SIZE_SRC = "https://www.uscurrency.gov/history"
/** "No matter the denomination, a banknote weighs approximately 1 gram." (BEP FAQ says the same: https://www.bep.gov/currency/faqs/) */
export const NOTE_WEIGHT_SRC = "https://www.uscurrency.gov/about-us/currency-facts"
/** 100 notes to a pile with a band, 1,000-note bundles, 4,000-note bricks, 16,000-note Cash Paks, and
 * "one skid of those bricks would contain $64 million" of $100 bills, so 640,000 notes per skid. */
export const PACKAGING_SRC = "https://www.bep.gov/currency/how-money-is-made/"
/**
 * SECONDARY SOURCE. No BEP or US Currency Education Program page that could be opened gives the thickness.
 * This page states 0.0043 in and attributes it to the BEP and to Louisenthal; replace with a primary page if found.
 */
export const NOTE_THICKNESS_SRC = "https://www.chroniclecollectibles.com/how-thick-is-a-100-dollar-bill/"
export const NOTE_THICKNESS_IS_PRIMARY = false

const IN = 2.54
export const NOTE_LENGTH_IN = 6.14
export const NOTE_WIDTH_IN = 2.61
export const NOTE_THICKNESS_IN = 0.0043
export const NOTE_MASS_G = 1
export const NOTE_LENGTH_CM = NOTE_LENGTH_IN * IN // 15.5956
export const NOTE_WIDTH_CM = NOTE_WIDTH_IN * IN // 6.6294
export const NOTE_THICKNESS_CM = NOTE_THICKNESS_IN * IN // 0.010922
/** 1.1292 cm³ per note. */
export const NOTE_VOLUME_CM3 = NOTE_LENGTH_CM * NOTE_WIDTH_CM * NOTE_THICKNESS_CM

export const NOTES_PER_STRAP = 100
export const NOTES_PER_BUNDLE = 1000
export const NOTES_PER_BRICK = 4000
export const NOTES_PER_CASH_PAK = 16000
/** $64M of $100 bills per skid (PACKAGING_SRC). */
export const NOTES_PER_SKID = 640000

// ---------------------------------------------------------------------------
// Geometry ASSUMPTIONS (not sourced, never shown as text): how bundles sit in a brick and bricks on a skid.

/** A brick = 4 bundles, assumed 2 wide (across the note) x 2 high: 15.6 (Z, note length) x 13.3 (X) x 21.8 cm (Y). */
export const BRICK_X_CM = 2 * NOTE_WIDTH_CM
export const BRICK_Y_CM = 2 * (NOTES_PER_BUNDLE * NOTE_THICKNESS_CM)
export const BRICK_Z_CM = NOTE_LENGTH_CM
/** 160 bricks per skid, assumed as 8 (X) x 5 (Z) x 4 layers: a 106 x 78 x 87 cm load (0.72 m³). */
export const SKID_BRICKS_X = 8
export const SKID_BRICKS_Z = 5
export const SKID_LAYERS = 4
export const BRICKS_PER_LAYER = SKID_BRICKS_X * SKID_BRICKS_Z
export const BRICKS_PER_SKID = NOTES_PER_SKID / NOTES_PER_BRICK // 160
/** Assumed 48 x 40 in wooden pallet, about 14.4 cm tall. */
export const PALLET_X_CM = 48 * IN
export const PALLET_Z_CM = 40 * IN
export const PALLET_H_CM = 14.4
const DECK_CM = 1.9
const AISLE_CM = 18
/** Small see-through gap between brick layers: on an additive display a gap reads as a seam line. */
const LAYER_GAP_CM = 0.8
const BAND_W_CM = 3
const BAND_LIFT_CM = 0.25

// ---------------------------------------------------------------------------
// Gifts (from Cards.ts only)

export type GiftKind = "gift" | "pledge" | "joint gift"

export interface Gift {
  cardId: string
  factId: string
  kind: GiftKind
  /** Who gave it, for the caption (only when the card's building isn't simply named after the giver). */
  donors?: string
  amountUSD: number
  /** The fact's source URL from Cards.ts. */
  source: string
}

const GIFT_FACTS: {cardId: string; factId: string; kind: GiftKind; donors?: string}[] = [
  {cardId: "huang", factId: "huang.1", kind: "gift"},
  {cardId: "y2e2", factId: "y2e2.1", kind: "gift"},
  {cardId: "gates", factId: "gates.1", kind: "gift"},
  {cardId: "hewlett", factId: "hewlett.1", kind: "pledge"},
  // packard.1: Hewlett and Packard gave it together "to finish rebuilding this part of campus", not for Packard alone.
  {cardId: "packard", factId: "packard.1", kind: "joint gift", donors: "Hewlett & Packard"}
]

/** "30 million dollar", "77.4 million dollars" -> USD, rounded to whole dollars. NaN if the text has no amount. */
export function parseMillionDollars(text: string): number {
  const m = /(\d+(?:\.\d+)?) million dollars?/.exec(text)
  return m ? Math.round(parseFloat(m[1]) * 1e6) : NaN
}

export function giftFor(cardId: string): Gift | undefined {
  for (const g of GIFT_FACTS) {
    if (g.cardId !== cardId) continue
    const f = factById(g.factId)
    if (!f || f.card.id !== cardId) return undefined
    const amountUSD = parseMillionDollars(f.fact.text)
    if (!(amountUSD > 0)) return undefined
    return {cardId, factId: g.factId, kind: g.kind, donors: g.donors, amountUSD, source: f.fact.source}
  }
  return undefined
}

export function allGifts(): Gift[] {
  const r: Gift[] = []
  for (const g of GIFT_FACTS) {
    const x = giftFor(g.cardId)
    if (x) r.push(x)
  }
  return r
}

// ---------------------------------------------------------------------------
// Stack / layout

export interface SkidLayout {
  /** Bricks on this skid (160 for a full one). */
  bricks: number
  /** Bottom of the pallet, cm above the tower base. */
  y: number
  /** Load height in cm (pallet excluded). */
  loadH: number
  /** Deterministic jitter so the stack doesn't look machine-perfect. */
  dx: number
  dz: number
  yawDeg: number
}

export interface TowerLayout {
  /** Tower base centre in pile coordinates (cm, front = +Z). */
  x: number
  z: number
  skids: SkidLayout[]
  heightCm: number
  /** Order the towers appear in (back-centre first). */
  order: number
}

export interface MoneyStack {
  amountUSD: number
  denomination: number
  notes: number
  /** Whole 4,000-note bricks drawn; looseNotes (< 4,000) are counted in volume/mass but not drawn. */
  bricks: number
  looseNotes: number
  straps: number
  skids: number
  /** Total bill volume (no air, no pallets). */
  volumeM3: number
  massKg: number
  massTonnes: number
  /** Side of a cube with the bills' volume: the "3.2 m cube" in the caption. */
  cubeSideM: number
  tiersPerTower: number
  towers: TowerLayout[]
  /** Bounding box of the drawn pallet pile in cm. */
  footprint: {widthCm: number; depthCm: number; heightCm: number}
  sizes: {
    noteCm: [number, number, number]
    strapCm: [number, number, number]
    bundleCm: [number, number, number]
    brickCm: [number, number, number]
    skidLoadCm: [number, number, number]
    palletCm: [number, number, number]
  }
  sources: {size: string; weight: string; packaging: string; thickness: string; thicknessIsPrimary: boolean}
}

export interface StackOptions {
  /** Skids per tower. Default: 3, or more for big gifts so the pile stays at about 32 towers or fewer. */
  tiersPerTower?: number
}

/** Deterministic 0..1 hash. */
function rand(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function loadHeightFor(bricks: number): number {
  const layers = Math.ceil(bricks / BRICKS_PER_LAYER)
  return layers * BRICK_Y_CM + Math.max(0, layers - 1) * LAYER_GAP_CM
}

export function billsToStack(amountUSD: number, denomination = 1, opts: StackOptions = {}): MoneyStack {
  const notes = Math.round(amountUSD / denomination)
  const bricks = Math.floor(notes / NOTES_PER_BRICK)
  const looseNotes = notes - bricks * NOTES_PER_BRICK
  const skids = Math.ceil(bricks / BRICKS_PER_SKID)
  const volumeCm3 = notes * NOTE_VOLUME_CM3
  const massKg = (notes * NOTE_MASS_G) / 1000
  const tiers = Math.max(1, Math.round(opts.tiersPerTower || Math.max(3, Math.ceil(skids / 32))))
  const nTowers = Math.ceil(skids / tiers)

  // Grid a bit wider than deep, facing the wearer (+Z). Fill back-centre first so the pile steps down to the front.
  const cols = Math.max(1, Math.ceil(Math.sqrt(nTowers * 1.4)))
  const rows = Math.max(1, Math.ceil(nTowers / cols))
  const pitchX = PALLET_X_CM + AISLE_CM
  const pitchZ = PALLET_Z_CM + AISLE_CM
  const cells: {c: number; r: number; x: number; z: number; pri: number}[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * pitchX
      const z = (r - (rows - 1) / 2) * pitchZ // r = 0 is the back row
      cells.push({c, r, x, z, pri: r * 10 + Math.abs(c - (cols - 1) / 2)})
    }
  }
  cells.sort((a, b) => a.pri - b.pri)

  const towers: TowerLayout[] = []
  let left = bricks
  for (let t = 0; t < nTowers; t++) {
    const cell = cells[t]
    const tower: TowerLayout = {x: cell.x, z: cell.z, skids: [], heightCm: 0, order: t}
    let y = 0
    for (let k = 0; k < tiers && left > 0; k++) {
      const b = Math.min(BRICKS_PER_SKID, left)
      left -= b
      const loadH = loadHeightFor(b)
      tower.skids.push({
        bricks: b, y, loadH,
        dx: (rand(t, k) - 0.5) * 8,
        dz: (rand(k + 7, t) - 0.5) * 8,
        yawDeg: (rand(t + 3, k + 5) - 0.5) * 6
      })
      y += PALLET_H_CM + loadH
    }
    tower.heightCm = y
    towers.push(tower)
  }

  let minX = 0, maxX = 0, minZ = 0, maxZ = 0, maxH = 0
  towers.forEach((t, i) => {
    const x0 = t.x - PALLET_X_CM / 2, x1 = t.x + PALLET_X_CM / 2, z0 = t.z - PALLET_Z_CM / 2, z1 = t.z + PALLET_Z_CM / 2
    if (i === 0 || x0 < minX) minX = x0
    if (i === 0 || x1 > maxX) maxX = x1
    if (i === 0 || z0 < minZ) minZ = z0
    if (i === 0 || z1 > maxZ) maxZ = z1
    maxH = Math.max(maxH, t.heightCm)
  })

  const strapH = NOTES_PER_STRAP * NOTE_THICKNESS_CM
  return {
    amountUSD, denomination, notes, bricks, looseNotes,
    straps: Math.ceil(notes / NOTES_PER_STRAP),
    skids,
    volumeM3: volumeCm3 / 1e6,
    massKg,
    massTonnes: massKg / 1000,
    cubeSideM: Math.cbrt(volumeCm3 / 1e6),
    tiersPerTower: tiers,
    towers,
    footprint: {widthCm: maxX - minX, depthCm: maxZ - minZ, heightCm: maxH},
    sizes: {
      noteCm: [NOTE_WIDTH_CM, NOTE_THICKNESS_CM, NOTE_LENGTH_CM],
      strapCm: [NOTE_WIDTH_CM, strapH, NOTE_LENGTH_CM],
      bundleCm: [NOTE_WIDTH_CM, strapH * 10, NOTE_LENGTH_CM],
      brickCm: [BRICK_X_CM, BRICK_Y_CM, BRICK_Z_CM],
      skidLoadCm: [SKID_BRICKS_X * BRICK_X_CM, loadHeightFor(BRICKS_PER_SKID), SKID_BRICKS_Z * BRICK_Z_CM],
      palletCm: [PALLET_X_CM, PALLET_H_CM, PALLET_Z_CM]
    },
    sources: {size: NOTE_SIZE_SRC, weight: NOTE_WEIGHT_SRC, packaging: PACKAGING_SRC, thickness: NOTE_THICKNESS_SRC, thicknessIsPrimary: NOTE_THICKNESS_IS_PRIMARY}
  }
}

// ---------------------------------------------------------------------------
// Mesh

export type MoneyGroup = "bill" | "billTop" | "band" | "pallet"
export const MONEY_GROUPS: MoneyGroup[] = ["bill", "billTop", "band", "pallet"]

/** Bright colours: the display is additive, so anything dark is see-through. */
export const MONEY_COLORS: Record<MoneyGroup | "figure", [number, number, number, number]> = {
  bill: [0.45, 1.0, 0.55, 1],
  billTop: [0.72, 1.0, 0.76, 1],
  band: [1.0, 0.96, 0.62, 1],
  pallet: [1.0, 0.62, 0.18, 1],
  figure: [0.85, 0.93, 1.0, 1]
}

const STRIDE = 8
const MAX_VERTS = 64000

/** Chunk writer with an optional yaw + offset applied to every vertex. */
class Writer {
  chunks: MeshChunk[] = []
  private cur: MeshChunk = {verts: [], idx: []}
  private c = 1
  private s = 0
  private ox = 0
  private oy = 0
  private oz = 0

  setXform(yawDeg: number, ox: number, oy: number, oz: number) {
    const a = (yawDeg * Math.PI) / 180
    this.c = Math.cos(a)
    this.s = Math.sin(a)
    this.ox = ox
    this.oy = oy
    this.oz = oz
  }

  /** One quad (4 verts, double-sided). Corners in local coords, before the transform. */
  quad(p: number[][], n: number[]) {
    if (this.cur.verts.length / STRIDE + 4 > MAX_VERTS) this.flush()
    const b = this.cur.verts.length / STRIDE
    const nx = n[0] * this.c + n[2] * this.s, nz = -n[0] * this.s + n[2] * this.c
    for (const q of p) {
      const x = q[0] * this.c + q[2] * this.s + this.ox
      const z = -q[0] * this.s + q[2] * this.c + this.oz
      this.cur.verts.push(x, q[1] + this.oy, z, nx, n[1], nz, 0, 0)
    }
    this.cur.idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2)
  }

  /** Axis-aligned box [x0,x1] x [y0,y1] x [z0,z1]. `faces` picks which faces: +x -x +y -y +z -z. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, faces = "+x-x+y-y+z-z") {
    if (faces.indexOf("+x") >= 0) this.quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0])
    if (faces.indexOf("-x") >= 0) this.quad([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0])
    if (faces.indexOf("+y") >= 0) this.quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0])
    if (faces.indexOf("-y") >= 0) this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0])
    if (faces.indexOf("+z") >= 0) this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1])
    if (faces.indexOf("-z") >= 0) this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1])
  }

  flush() {
    if (this.cur.idx.length) this.chunks.push(this.cur)
    this.cur = {verts: [], idx: []}
  }

  done(): MeshChunk[] {
    this.flush()
    return this.chunks
  }
}

export interface TowerMesh {
  /** Tower base centre in the pile's frame (origin applied). Put one transform here per tower. */
  position: V3
  heightCm: number
  order: number
  /** Geometry relative to `position`, one chunk list per colour group. */
  groups: Record<MoneyGroup, MeshChunk[]>
}

export interface MoneyPileMesh {
  towers: TowerMesh[]
  vertexCount: number
}

function writePallet(w: Writer) {
  const hx = PALLET_X_CM / 2, hz = PALLET_Z_CM / 2
  w.box(-hx, hx, PALLET_H_CM - DECK_CM, PALLET_H_CM, -hz, hz) // top deck
  w.box(-hx, hx, 0, DECK_CM, -hz, hz, "+x-x+y+z-z") // bottom deck
  const sw = 3.8 // stringers run along X, at the front, middle and back
  for (const zc of [-hz + sw / 2, 0, hz - sw / 2]) w.box(-hx, hx, DECK_CM, PALLET_H_CM - DECK_CM, zc - sw / 2, zc + sw / 2, "+x-x+z-z")
}

/**
 * One skid's load: brick layers as separate slabs (the gaps read as seams), the topmost face in the lighter
 * `billTop` group, and the denomination bands as stripes across the middle of every row of straps.
 */
function writeLoad(bricks: number, y0: number, bill: Writer, top: Writer, band: Writer) {
  const lx = SKID_BRICKS_X * BRICK_X_CM, lz = SKID_BRICKS_Z * BRICK_Z_CM
  const x0 = -lx / 2, z0 = -lz / 2
  const layers = Math.ceil(bricks / BRICKS_PER_LAYER)
  for (let l = 0; l < layers; l++) {
    const inLayer = Math.min(BRICKS_PER_LAYER, bricks - l * BRICKS_PER_LAYER)
    const ya = y0 + l * (BRICK_Y_CM + LAYER_GAP_CM)
    const yb = ya + BRICK_Y_CM
    const isTop = l === layers - 1
    // Up to two boxes per layer: full rows (front to back), then a part row.
    const fullRows = Math.floor(inLayer / SKID_BRICKS_X)
    const rest = inLayer - fullRows * SKID_BRICKS_X
    const boxes: number[][] = []
    if (fullRows > 0) boxes.push([x0, x0 + lx, z0, z0 + fullRows * BRICK_Z_CM, fullRows])
    if (rest > 0) boxes.push([x0, x0 + rest * BRICK_X_CM, z0 + fullRows * BRICK_Z_CM, z0 + (fullRows + 1) * BRICK_Z_CM, 1])
    for (const [bx0, bx1, bz0, bz1, nRows] of boxes) {
      bill.box(bx0, bx1, ya, yb, bz0, bz1, "+x-x+z-z")
      // Top face: where nothing sits on it (top layer, or the uncovered part of a full layer under a part layer).
      if (isTop) top.box(bx0, bx1, ya, yb, bz0, bz1, "+y")
      // Bands run round the middle of each strap, across the note: vertical stripes on the +-X faces at each row's
      // centre, and across the top of the top layer.
      for (let r = 0; r < nRows; r++) {
        const zc = bz0 + (r + 0.5) * BRICK_Z_CM
        const za = zc - BAND_W_CM / 2, zb = zc + BAND_W_CM / 2
        band.quad([[bx1 + BAND_LIFT_CM, ya, za], [bx1 + BAND_LIFT_CM, yb, za], [bx1 + BAND_LIFT_CM, yb, zb], [bx1 + BAND_LIFT_CM, ya, zb]], [1, 0, 0])
        band.quad([[bx0 - BAND_LIFT_CM, ya, zb], [bx0 - BAND_LIFT_CM, yb, zb], [bx0 - BAND_LIFT_CM, yb, za], [bx0 - BAND_LIFT_CM, ya, za]], [-1, 0, 0])
        if (isTop) band.quad([[bx0, yb + BAND_LIFT_CM, za], [bx0, yb + BAND_LIFT_CM, zb], [bx1, yb + BAND_LIFT_CM, zb], [bx1, yb + BAND_LIFT_CM, za]], [0, 1, 0])
      }
    }
  }
}

/** Builds every tower's meshes. `origin` shifts the whole pile (cm); the pile's front faces +Z. */
export function buildMoneyPile(layout: MoneyStack, origin: V3 = {x: 0, y: 0, z: 0}): MoneyPileMesh {
  const towers: TowerMesh[] = []
  let total = 0
  for (const t of layout.towers) {
    const w: Record<MoneyGroup, Writer> = {bill: new Writer(), billTop: new Writer(), band: new Writer(), pallet: new Writer()}
    for (const s of t.skids) {
      for (const g of MONEY_GROUPS) w[g].setXform(s.yawDeg, s.dx, s.y, s.dz)
      writePallet(w.pallet)
      writeLoad(s.bricks, PALLET_H_CM, w.bill, w.billTop, w.band)
    }
    const groups = {bill: w.bill.done(), billTop: w.billTop.done(), band: w.band.done(), pallet: w.pallet.done()}
    for (const g of MONEY_GROUPS) total += vertexCount(groups[g])
    towers.push({position: {x: origin.x + t.x, y: origin.y, z: origin.z + t.z}, heightCm: t.heightCm, order: t.order, groups})
  }
  return {towers, vertexCount: total}
}

/** Number of mesh objects (draw calls) the pile needs: one per non-empty chunk. */
export function pileDrawCalls(pile: MoneyPileMesh): number {
  let n = 0
  for (const t of pile.towers) for (const g of MONEY_GROUPS) n += t.groups[g].length
  return n
}

/**
 * Scale figure: a box-limbed person, standing at the origin, facing +Z. Chosen over a measuring pole because on an
 * additive display a solid bright human shape is recognised instantly at 5-15 m, while a pole's tick marks are a few
 * cm wide and vanish at that distance, and a lone pole reads as another of the Lens's sightline pillars.
 */
export function buildScaleFigure(heightCm = 175): MeshChunk {
  const w = new Writer()
  const h = heightCm
  const legW = 0.075 * h, legD = 0.07 * h, hipGap = 0.02 * h
  const legTop = 0.47 * h
  const torsoW = 0.24 * h, torsoD = 0.12 * h, torsoTop = 0.82 * h
  const armW = 0.055 * h, armTop = 0.8 * h, armBot = 0.44 * h
  const headS = 0.12 * h
  // Legs (slightly apart).
  w.box(-hipGap / 2 - legW, -hipGap / 2, 0, legTop, -legD / 2, legD / 2)
  w.box(hipGap / 2, hipGap / 2 + legW, 0, legTop, -legD / 2, legD / 2)
  // Torso.
  w.box(-torsoW / 2, torsoW / 2, legTop + 0.005 * h, torsoTop, -torsoD / 2, torsoD / 2)
  // Arms with a small gap from the torso, so the silhouette reads.
  const ag = 0.012 * h
  w.box(-torsoW / 2 - ag - armW, -torsoW / 2 - ag, armBot, armTop, -armW / 2, armW / 2)
  w.box(torsoW / 2 + ag, torsoW / 2 + ag + armW, armBot, armTop, -armW / 2, armW / 2)
  // Neck gap, then head; the head top is exactly heightCm.
  w.box(-headS * 0.42, headS * 0.42, h - headS, h, -headS * 0.45, headS * 0.45)
  return w.done()[0]
}

// ---------------------------------------------------------------------------
// Text and animation

/** "30", "77.4": at most one decimal, no trailing ".0". */
export function fmt1(x: number): string {
  const r = Math.round(x * 10) / 10
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)
}

/**
 * "$30 million gift = 30 million $1 bills · 30 tonnes". Empty string if the card has no sourced gift.
 * Tonnes use 1 g per note (NOTE_WEIGHT_SRC); the cube is the bills' own volume (NOTE_SIZE_SRC, NOTE_THICKNESS_SRC).
 */
export function captionFor(cardId: string, denomination = 1): string {
  const g = giftFor(cardId)
  if (!g) return ""
  const s = billsToStack(g.amountUSD, denomination)
  const what = g.donors ? `${g.donors} ${g.kind}` : g.kind
  const notesM = fmt1(s.notes / 1e6)
  return `$${fmt1(g.amountUSD / 1e6)} million ${what} = ${notesM} million $${denomination} bills · ${fmt1(s.massTonnes)} tonnes`
}

/**
 * Grow-in progress (0..1, eased) for tower `i` of `n` at `t` seconds: towers start staggered across the first 60% of
 * `durationS` and each grows over the remaining 40%, so the whole pile is up at `durationS`.
 */
export function towerGrow(i: number, n: number, t: number, durationS = 2): number {
  const each = durationS * 0.4
  const start = n > 1 ? (i / (n - 1)) * (durationS - each) : 0
  const u = Math.max(0, Math.min(1, (t - start) / each))
  // Ease out with a little overshoot, like a stack settling.
  const c = 1.4
  return u >= 1 ? 1 : 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2)
}

/**
 * Where to put the pile along the line to a real building (cm from the wearer): short of the building by
 * `standoffCm` plus half the pile's depth, capped at `maxCm` (a far building would make the pile a speck), and never
 * closer than `minCm`.
 */
export function pileDistanceCm(buildingDistanceM: number, pileDepthCm: number, maxCm = 1500, standoffCm = 300, minCm = 400): number {
  const d = buildingDistanceM * 100 - standoffCm - pileDepthCm / 2
  return Math.max(minCm + pileDepthCm / 2, Math.min(maxCm, d))
}

/** Y rotation (radians) that turns the pile's front (+Z) from `from` toward `to`, in the horizontal plane. */
export function yawToward(from: V3, to: V3): number {
  return Math.atan2(to.x - from.x, to.z - from.z)
}

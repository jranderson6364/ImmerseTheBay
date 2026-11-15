/**
 * Procedural low-poly models for the most important landmarks, so they read as themselves on the 1:600 map
 * instead of as plain extruded footprints. Pure (no Lens globals), unit-tested in tests/landmark-models.test.ts.
 *
 * Frame: the same as Core/MapMesh.ts. Centimetres, X = east, Z = -north, Y up; footprint metres become map cm
 * through o.cmPerM and o.center; real heights are multiplied by o.cmPerM * o.verticalExaggeration.
 * Small round details (domes, arches, the rose window) are proportioned in map space rather than exaggerated, so a
 * dome stays a dome instead of a 4x stretched bullet; tall stretches (Hoover's shaft) absorb the difference so the
 * total height still matches the real height times the exaggeration.
 *
 * Vertex layout: 8 floats (position, normal, uv = 0), every triangle emitted in both windings (as MapMesh does),
 * one chunk per part, each far under the 64k MeshBuilder limit (every model stays under about 6k vertices).
 *
 * Parts: `body` is walls and masonry and takes the landmark state colour; `accent` is the red clay-tile roofs and
 * Hoover's dome; `trim` is the cool, dim "shade/glass" layer (arch recesses, windows, glass prow, atrium
 * skylights). On the additive display dim reads as recessed or see-through, which is what openings and glass need.
 */
import {BakedBuilding, LANDMARKS} from "../Data/CampusData"
import {MapMeshOptions, MeshChunk} from "./MapMesh"

export interface LandmarkModel {
  /** Walls and masonry: colour this by landmark state. */
  body: MeshChunk
  /** Clay-tile roofs and domes (fixed colour). Absent when the model has none. */
  accent?: MeshChunk
  /** Recesses, windows and glass (fixed colour). Absent when the model has none. */
  trim?: MeshChunk
  /** Highest Y of any vertex in the model, cm (where the label goes). */
  topCm: number
}

/** Landmark ids that have a model; everything else returns null and keeps its extrusion. */
export const MODELLED_LANDMARKS = ["hoover", "memchu", "mainquad", "huang", "gates", "packard", "hewlett", "y2e2", "spilker", "cantor"]

const STRIDE = 8
const MAX_VERTS = 64000
const MITER_LIMIT = 2.5

type P3 = [number, number, number]
type P2 = [number, number]

class Mesh {
  verts: number[] = []
  idx: number[] = []

  get n(): number {
    return this.verts.length / STRIDE
  }

  v(x: number, y: number, z: number, nx = 0, ny = 1, nz = 0): number {
    this.verts.push(x, y, z, nx, ny, nz, 0, 0)
    return this.n - 1
  }

  /** Double-sided triangle. */
  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c, a, c, b)
  }

  quad(a: number, b: number, c: number, d: number) {
    this.tri(a, b, c)
    this.tri(a, c, d)
  }

  /** Convex planar polygon (fan) with a computed normal. */
  poly(pts: P3[]) {
    if (pts.length < 3) return
    const [a, b, c] = pts
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1])
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l
    ny /= l
    nz /= l
    const base = this.n
    for (const p of pts) this.v(p[0], p[1], p[2], nx, ny, nz)
    for (let i = 1; i + 1 < pts.length; i++) this.tri(base, base + i, base + i + 1)
  }

  chunk(): MeshChunk | undefined {
    if (!this.idx.length) return undefined
    if (this.n > MAX_VERTS) throw new Error("landmark model chunk over 64k vertices")
    return {verts: this.verts, idx: this.idx}
  }
}

/** The three part meshes of one model. */
class Parts {
  body = new Mesh()
  accent = new Mesh()
  trim = new Mesh()

  finish(): LandmarkModel | null {
    const body = this.body.chunk()
    if (!body) return null
    let top = 0
    for (const m of [this.body, this.accent, this.trim]) for (let i = 1; i < m.verts.length; i += STRIDE) top = Math.max(top, m.verts[i])
    return {body, accent: this.accent.chunk(), trim: this.trim.chunk(), topCm: top}
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Local frames: (a, b) in map cm along a unit axis u and its perpendicular p = (-uz, ux); y is map cm up.

interface Frame {
  ox: number
  oz: number
  ux: number
  uz: number
}

function at(f: Frame, a: number, b: number): P2 {
  return [f.ox + f.ux * a - f.uz * b, f.oz + f.uz * a + f.ux * b]
}

function P(f: Frame, a: number, b: number, y: number): P3 {
  const [x, z] = at(f, a, b)
  return [x, y, z]
}

/** The same frame turned k quarter turns (u becomes p for k = 1). */
function turn(f: Frame, k: number): Frame {
  let ux = f.ux, uz = f.uz
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) {
    const t = ux
    ux = -uz
    uz = t
  }
  return {ox: f.ox, oz: f.oz, ux, uz}
}

/** Frame whose +a axis points along a compass bearing (degrees), origin at map (x, z). */
function bearingFrame(x: number, z: number, bearingDeg: number): Frame {
  const r = (bearingDeg * Math.PI) / 180
  return {ox: x, oz: z, ux: Math.sin(r), uz: -Math.cos(r)}
}

/** Point in the frame's local (a, b). */
function local(f: Frame, x: number, z: number): P2 {
  const dx = x - f.ox, dz = z - f.oz
  return [dx * f.ux + dz * f.uz, -dx * f.uz + dz * f.ux]
}

// ---------------------------------------------------------------------------------------------------------------
// Primitive helpers.

/** Oriented box over local [a0, a1] x [b0, b1], y0..y1; top optional, no bottom (it sits on something). */
function box(m: Mesh, f: Frame, a0: number, a1: number, b0: number, b1: number, y0: number, y1: number, top = true) {
  const c = [P(f, a0, b0, 0), P(f, a1, b0, 0), P(f, a1, b1, 0), P(f, a0, b1, 0)]
  for (let i = 0; i < 4; i++) {
    const p = c[i], q = c[(i + 1) % 4]
    m.poly([[p[0], y0, p[2]], [q[0], y0, q[2]], [q[0], y1, q[2]], [p[0], y1, p[2]]])
  }
  if (top) m.poly(c.map((p): P3 => [p[0], y1, p[2]]))
}

/** Regular n-gon in the frame, centred at local (ca, cb). */
function ngon(f: Frame, ca: number, cb: number, r: number, n: number, phase = 0): P2[] {
  const pts: P2[] = []
  for (let i = 0; i < n; i++) {
    const t = phase + (i / n) * Math.PI * 2
    pts.push(at(f, ca + Math.cos(t) * r, cb + Math.sin(t) * r))
  }
  return pts
}

/** Prism or frustum between two rings of the same length (convex), with an optional top cap. */
function frustum(m: Mesh, lo: P2[], hi: P2[], y0: number, y1: number, cap = true) {
  const n = lo.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    m.poly([[lo[i][0], y0, lo[i][1]], [lo[j][0], y0, lo[j][1]], [hi[j][0], y1, hi[j][1]], [hi[i][0], y1, hi[i][1]]])
  }
  if (cap) m.poly(hi.map((p): P3 => [p[0], y1, p[1]]))
}

/** Pyramid / cone from a convex ring at y0 to an apex. */
function pyramid(m: Mesh, ring: P2[], y0: number, apex: P3) {
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length
    m.poly([[ring[i][0], y0, ring[i][1]], [ring[j][0], y0, ring[j][1]], apex])
  }
}

/** Dome (quarter-ellipse profile) of horizontal radius r and height h on a circle at (cx, cz, y0). */
function dome(m: Mesh, cx: number, cz: number, r: number, y0: number, h: number, segs = 12, rings = 4) {
  const base = m.n
  for (let k = 0; k < rings; k++) {
    const phi = (k / rings) * (Math.PI / 2)
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2
      const ca = Math.cos(phi)
      m.v(cx + Math.cos(t) * r * ca, y0 + Math.sin(phi) * h, cz + Math.sin(t) * r * ca, Math.cos(t) * ca, Math.sin(phi), Math.sin(t) * ca)
    }
  }
  const apex = m.v(cx, y0 + h, cz, 0, 1, 0)
  for (let k = 0; k + 1 < rings; k++) {
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs
      m.quad(base + k * segs + i, base + k * segs + j, base + (k + 1) * segs + j, base + (k + 1) * segs + i)
    }
  }
  const last = base + (rings - 1) * segs
  for (let i = 0; i < segs; i++) m.tri(last + i, last + ((i + 1) % segs), apex)
}

/**
 * Gable roof over local [a0, a1] x [b0, b1] with the ridge along a. Slopes go to `roof`, the two gable-end
 * triangles to `wall` (they are masonry). `over` pushes the eaves out.
 */
function gableRoof(roof: Mesh, wall: Mesh, f: Frame, a0: number, a1: number, b0: number, b1: number, yE: number, yR: number, over = 0) {
  const bm = (b0 + b1) / 2
  roof.poly([P(f, a0 - over, b0 - over, yE), P(f, a1 + over, b0 - over, yE), P(f, a1 + over, bm, yR), P(f, a0 - over, bm, yR)])
  roof.poly([P(f, a0 - over, b1 + over, yE), P(f, a1 + over, b1 + over, yE), P(f, a1 + over, bm, yR), P(f, a0 - over, bm, yR)])
  wall.poly([P(f, a0, b0, yE), P(f, a0, b1, yE), P(f, a0, bm, yR)])
  wall.poly([P(f, a1, b0, yE), P(f, a1, b1, yE), P(f, a1, bm, yR)])
}

/** Hipped roof over local [a0, a1] x [b0, b1] (ridge along the longer side; a pyramid if square). */
function hipRoof(m: Mesh, f: Frame, a0: number, a1: number, b0: number, b1: number, yE: number, yR: number, over = 0) {
  a0 -= over
  a1 += over
  b0 -= over
  b1 += over
  if (b1 - b0 > a1 - a0) {
    hipRoof(m, turn(f, 1), b0, b1, -a1, -a0, yE, yR)
    return
  }
  const hw = (b1 - b0) / 2
  const bm = (b0 + b1) / 2
  const r0 = Math.min(a0 + hw, (a0 + a1) / 2), r1 = Math.max(a1 - hw, (a0 + a1) / 2)
  m.poly([P(f, a0, b0, yE), P(f, a1, b0, yE), P(f, r1, bm, yR), P(f, r0, bm, yR)])
  m.poly([P(f, a1, b1, yE), P(f, a0, b1, yE), P(f, r0, bm, yR), P(f, r1, bm, yR)])
  m.poly([P(f, a0, b1, yE), P(f, a0, b0, yE), P(f, r0, bm, yR)])
  m.poly([P(f, a1, b0, yE), P(f, a1, b1, yE), P(f, r1, bm, yR)])
}

/**
 * One face of an arcade: `nOpen` round-headed openings between piers, on the plane b = `face` (outward +b),
 * `depth` deep, over local a in [-w, w] and y in [y0, y1]. Semicircular heads are round in map space.
 * The openings are left empty, so whatever sits behind (a `trim` core) shows through as the recess.
 */
function arcadeFace(m: Mesh, f: Frame, w: number, face: number, depth: number, y0: number, y1: number, nOpen: number, pierW: number, segs = 6) {
  const span = (2 * w - (nOpen + 1) * pierW) / nOpen
  const R = span / 2
  const crown = Math.min(R * 0.6, (y1 - y0) * 0.15)
  const spring = y1 - crown - R
  const fb = face, bb = face - depth
  for (let i = 0; i <= nOpen; i++) {
    const a = -w + i * (span + pierW)
    box(m, f, a, a + pierW, bb, fb, y0, spring, false)
  }
  for (let i = 0; i < nOpen; i++) {
    const c = -w + pierW + i * (span + pierW) + R
    for (let s = 0; s < segs; s++) {
      const t0 = Math.PI - (s / segs) * Math.PI, t1 = Math.PI - ((s + 1) / segs) * Math.PI
      const a0 = c + Math.cos(t0) * R, a1 = c + Math.cos(t1) * R
      const y0s = spring + Math.sin(t0) * R, y1s = spring + Math.sin(t1) * R
      for (const b of [fb, bb]) m.poly([P(f, a0, b, y0s), P(f, a1, b, y1s), P(f, a1, b, y1), P(f, a0, b, y1)])
      m.poly([P(f, a0, fb, y0s), P(f, a1, fb, y1s), P(f, a1, bb, y1s), P(f, a0, bb, y0s)])
    }
  }
  // The solid band above the arches, across the full width including over the piers.
  for (const b of [fb, bb]) {
    for (let i = 0; i <= nOpen; i++) {
      const a = -w + i * (span + pierW)
      m.poly([P(f, a, b, spring), P(f, a + pierW, b, spring), P(f, a + pierW, b, y1), P(f, a, b, y1)])
    }
  }
}

/** Flat panel on the plane b = `face` (slightly proud), round-headed: a in [c-r, c+r], y from y0 to spring + r. */
function archPanel(m: Mesh, f: Frame, face: number, c: number, r: number, y0: number, spring: number, segs = 8) {
  const pts: P3[] = [P(f, c + r, face, y0)]
  for (let s = 0; s <= segs; s++) {
    const t = (s / segs) * Math.PI
    pts.push(P(f, c + Math.cos(t) * r, face, spring + Math.sin(t) * r))
  }
  pts.push(P(f, c - r, face, y0))
  m.poly(pts)
}

/** Disc on the plane b = `face` (a round window), centred at (c, y), radius r. */
function discPanel(m: Mesh, f: Frame, face: number, c: number, y: number, r: number, segs = 12) {
  const pts: P3[] = []
  for (let s = 0; s < segs; s++) {
    const t = (s / segs) * Math.PI * 2
    pts.push(P(f, c + Math.cos(t) * r, face, y + Math.sin(t) * r))
  }
  m.poly(pts)
}

// ---------------------------------------------------------------------------------------------------------------
// Footprints.

interface Footprint {
  /** All ring points in map cm, global index order matching the baked triangles. */
  x: number[]
  z: number[]
  /** Ring start indices (outer ring first), with the total point count appended. */
  starts: number[]
  /** Per point: outward mitre offset (away from the building material; length >= 1). */
  mx: number[]
  mz: number[]
  /** Per point: length of the shorter adjacent edge, cm. */
  minEdge: number[]
  tri: number[]
  /** Minimum-area bounding rectangle of the outer ring: centred frame, u along the longer side. */
  frame: Frame
  halfA: number
  halfB: number
}

function footprint(b: BakedBuilding, o: MapMeshOptions): Footprint {
  const [, , , ring, holes, tri] = b
  const nPts = ring.length / 2
  const starts = [0, ...holes, nPts]
  const x: number[] = [], z: number[] = []
  for (let i = 0; i < nPts; i++) {
    x.push((ring[2 * i] / 10 - o.center.e) * o.cmPerM)
    z.push(-(ring[2 * i + 1] / 10 - o.center.n) * o.cmPerM)
  }
  const mx = new Array(nPts).fill(0), mz = new Array(nPts).fill(0), minEdge = new Array(nPts).fill(0)
  for (let r = 0; r + 1 < starts.length; r++) {
    const s = starts[r], n = starts[r + 1] - s
    if (n < 3) continue
    let area = 0
    for (let k = 0; k < n; k++) {
      const i = s + k, j = s + ((k + 1) % n)
      area += ring[2 * i] * ring[2 * j + 1] - ring[2 * j] * ring[2 * i + 1]
    }
    // Same convention as MapMesh: outer rings CCW in (east, north), holes CW; flip otherwise.
    const sgn = (r === 0 ? area > 0 : area < 0) ? 1 : -1
    const enx: number[] = [], enz: number[] = [], len: number[] = []
    for (let k = 0; k < n; k++) {
      const i = s + k, j = s + ((k + 1) % n)
      const dx = x[j] - x[i], dz = z[j] - z[i]
      const l = Math.hypot(dx, dz) || 1
      len.push(l)
      enx.push((-dz / l) * sgn)
      enz.push((dx / l) * sgn)
    }
    for (let k = 0; k < n; k++) {
      const p = (k - 1 + n) % n
      let bx = enx[p] + enx[k], bz = enz[p] + enz[k]
      const bl = Math.hypot(bx, bz)
      if (bl < 1e-6) {
        bx = enx[k]
        bz = enz[k]
      } else {
        bx /= bl
        bz /= bl
      }
      const sc = 1 / Math.max(bx * enx[k] + bz * enz[k], 1 / MITER_LIMIT)
      mx[s + k] = bx * sc
      mz[s + k] = bz * sc
      minEdge[s + k] = Math.min(len[p], len[k])
    }
  }
  // Minimum-area rectangle: one side is collinear with some edge of the outer ring (true for its hull; close enough).
  const n0 = starts[1]
  let best = {area: Infinity, f: {ox: 0, oz: 0, ux: 1, uz: 0} as Frame, ha: 0, hb: 0}
  for (let k = 0; k < n0; k++) {
    const j = (k + 1) % n0
    const dx = x[j] - x[k], dz = z[j] - z[k]
    const l = Math.hypot(dx, dz)
    if (l < 1e-6) continue
    const f0: Frame = {ox: 0, oz: 0, ux: dx / l, uz: dz / l}
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
    for (let i = 0; i < n0; i++) {
      const [a, bb] = local(f0, x[i], z[i])
      a0 = Math.min(a0, a)
      a1 = Math.max(a1, a)
      b0 = Math.min(b0, bb)
      b1 = Math.max(b1, bb)
    }
    const area = (a1 - a0) * (b1 - b0)
    if (area < best.area - 1e-9) {
      const [cx, cz] = at(f0, (a0 + a1) / 2, (b0 + b1) / 2)
      let f: Frame = {ox: cx, oz: cz, ux: f0.ux, uz: f0.uz}
      let ha = (a1 - a0) / 2, hb = (b1 - b0) / 2
      if (hb > ha) {
        f = turn(f, 1)
        const t = ha
        ha = hb
        hb = t
      }
      best = {area, f, ha, hb}
    }
  }
  return {x, z, starts, mx, mz, minEdge, tri, frame: best.f, halfA: best.ha, halfB: best.hb}
}

/** Walls along every ring from y0 to y1, pulled `inset` cm inside the roof edge. */
function walls(m: Mesh, fp: Footprint, y0: number, y1: number, inset = 0) {
  for (let r = 0; r + 1 < fp.starts.length; r++) {
    const s = fp.starts[r], n = fp.starts[r + 1] - s
    if (n < 3) continue
    for (let k = 0; k < n; k++) {
      const i = s + k, j = s + ((k + 1) % n)
      const x1 = fp.x[i] - fp.mx[i] * inset, z1 = fp.z[i] - fp.mz[i] * inset
      const x2 = fp.x[j] - fp.mx[j] * inset, z2 = fp.z[j] - fp.mz[j] * inset
      m.poly([[x1, y0, z1], [x2, y0, z2], [x2, y1, z2], [x1, y1, z1]])
    }
  }
}

/** Flat cap over the footprint at y (baked earcut triangles). */
function flatTop(m: Mesh, fp: Footprint, y: number) {
  const base = m.n
  for (let i = 0; i < fp.x.length; i++) m.v(fp.x[i], y, fp.z[i])
  for (let t = 0; t < fp.tri.length; t += 3) m.tri(base + fp.tri[t], base + fp.tri[t + 1], base + fp.tri[t + 2])
}

/** Per-point inset positions for a hipped approximation: `d` cm in from the edge, clamped near short edges. */
function insetPoints(fp: Footprint, d: number): {qx: number[]; qz: number[]} {
  const qx: number[] = [], qz: number[] = []
  for (let i = 0; i < fp.x.length; i++) {
    const di = Math.min(d, 0.4 * fp.minEdge[i])
    qx.push(fp.x[i] - fp.mx[i] * di)
    qz.push(fp.z[i] - fp.mz[i] * di)
  }
  return {qx, qz}
}

/**
 * Hipped-roof approximation over any footprint (holes included): every edge gets a slope rising `rise` cm over an
 * inset of `d` cm, and the inset footprint (same baked triangles, moved vertices) closes the top. For the deep
 * campus buildings this reads as a hipped clay-tile roof with a flat crown, which is what they mostly are.
 */
function insetRoof(m: Mesh, fp: Footprint, yE: number, rise: number, d: number) {
  const {qx, qz} = insetPoints(fp, d)
  const yR = yE + rise
  for (let r = 0; r + 1 < fp.starts.length; r++) {
    const s = fp.starts[r], n = fp.starts[r + 1] - s
    if (n < 3) continue
    for (let k = 0; k < n; k++) {
      const i = s + k, j = s + ((k + 1) % n)
      m.poly([[fp.x[i], yE, fp.z[i]], [fp.x[j], yE, fp.z[j]], [qx[j], yR, qz[j]], [qx[i], yR, qz[i]]])
    }
  }
  // Crown: inset triangles, except any the inset turned inside out (narrow necks between rings), which are drawn
  // at their original positions instead so the crown never shows folded slivers.
  const base = m.n
  for (let i = 0; i < qx.length; i++) m.v(qx[i], yR, qz[i])
  let orig = -1
  for (let t = 0; t < fp.tri.length; t += 3) {
    const [i, j, k] = [fp.tri[t], fp.tri[t + 1], fp.tri[t + 2]]
    if (triArea(fp.x, fp.z, i, j, k) * triArea(qx, qz, i, j, k) > 0) {
      m.tri(base + i, base + j, base + k)
      continue
    }
    if (orig < 0) {
      orig = m.n
      for (let q = 0; q < fp.x.length; q++) m.v(fp.x[q], yR, fp.z[q])
    }
    m.tri(orig + i, orig + j, orig + k)
  }
}

function triArea(xs: number[], zs: number[], a: number, b: number, c: number): number {
  return (xs[b] - xs[a]) * (zs[c] - zs[a]) - (zs[b] - zs[a]) * (xs[c] - xs[a])
}

/** Crown triangles the inset turns inside out (insetRoof redraws those un-inset); a diagnostic for tuning. */
export function insetFlipCount(b: BakedBuilding, o: MapMeshOptions, dM: number): number {
  const fp = footprint(b, o)
  const {qx, qz} = insetPoints(fp, dM * o.cmPerM)
  let flips = 0
  for (let t = 0; t < fp.tri.length; t += 3) {
    const [i, j, k] = [fp.tri[t], fp.tri[t + 1], fp.tri[t + 2]]
    if (triArea(fp.x, fp.z, i, j, k) * triArea(qx, qz, i, j, k) <= 0) flips++
  }
  return flips
}

// ---------------------------------------------------------------------------------------------------------------
// Models.

interface Scale {
  /** cm per real metre, horizontal. */
  h: number
  /** cm per real metre, vertical (with exaggeration). */
  v: number
}

function scaleOf(o: MapMeshOptions): Scale {
  return {h: o.cmPerM, v: o.cmPerM * o.verticalExaggeration}
}

/** Real height of a footprint (baked), with a floor so data gaps still give a building. */
function heightM(b: BakedBuilding, fallback: number): number {
  return b[0] > 0 ? b[0] : fallback
}

/**
 * Hoover Tower (Arthur Brown Jr., 1941; 87 m, observation deck at 76 m). Sources: Wikipedia "Hoover Tower";
 * PCAD (pcad.lib.washington.edu/building/6780) on the "arcaded dome form" modelled on the tower of the New
 * Cathedral of Salamanca; Stanford Magazine on the belvedere level. The OSM footprint (about 37 m square) is the
 * tower with its lower base block, so: a base block on the real footprint, a plain square shaft centred on it,
 * a slightly wider belvedere with three round-headed openings a side (count from photos, not a cited source),
 * a cornice, an octagonal drum, the dome and a small lantern with a ball finial.
 * The shaft is drawn about 20 m wide (real: roughly 12-13 m, estimated from photos) so it still reads as a tower
 * rather than a needle under the 4x vertical stretch.
 */
function hoover(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const fp = footprint(b, o)
  const f = fp.frame
  const p = new Parts()
  const yTop = heightM(b, 87) * s.v
  // Base block (the lower library floors around the tower foot) with a low tile roof.
  const yBase = Math.min(14 * s.v, yTop * 0.18)
  walls(p.body, fp, 0, yBase, o.wallInsetCm || 0)
  insetRoof(p.accent, fp, yBase, 1.5 * s.v, Math.min(4 * s.h, fp.halfB * 0.4))
  // Proportions above the shaft in map space, from the shaft half-width.
  const sh = Math.min(fp.halfB * 0.55, 10.5 * s.h)
  const bh = sh * 1.12 // belvedere half-width
  const sillH = sh * 0.18
  const belH = sh * 3.2
  const corH = sh * 0.28
  const drumR = sh * 0.86, drumH = sh * 0.4
  const domeR = sh * 0.82, domeH = domeR * 1.1
  const lanR = domeR * 0.26, lanH = domeR * 0.55
  const capH = lanR * 1.1, ballR = lanR * 0.55
  const upper = sillH + belH + corH + drumH + domeH * 0.97 + lanH + capH + ballR * 2
  const yShaftTop = Math.max(yBase + sh * 4, yTop - upper)
  box(p.body, f, -sh, sh, -sh, sh, yBase * 0.5, yShaftTop, false)
  // String course under the belvedere.
  let y = yShaftTop
  box(p.body, f, -bh * 1.04, bh * 1.04, -bh * 1.04, bh * 1.04, y, y + sillH)
  y += sillH
  // Belvedere: a dim core behind four arcaded faces.
  const depth = sh * 0.16
  box(p.trim, f, -(bh - depth), bh - depth, -(bh - depth), bh - depth, y, y + belH, false)
  for (let k = 0; k < 4; k++) arcadeFace(p.body, turn(f, k), bh, bh, depth, y, y + belH, 3, sh * 0.2)
  y += belH
  // Cornice, slightly wider, then the drum, dome, lantern and ball.
  box(p.body, f, -bh * 1.12, bh * 1.12, -bh * 1.12, bh * 1.12, y, y + corH)
  y += corH
  const drum = ngon(f, 0, 0, drumR, 8, Math.PI / 8)
  frustum(p.body, drum, drum, y, y + drumH)
  y += drumH
  const [cx, cz] = at(f, 0, 0)
  dome(p.accent, cx, cz, domeR, y, domeH, 12, 4)
  y += domeH * 0.97
  const lan = ngon(f, 0, 0, lanR, 6)
  frustum(p.body, lan, lan, y, y + lanH, false)
  y += lanH
  pyramid(p.accent, lan, y, [cx, y + capH, cz])
  y += capH
  dome(p.body, cx, cz, ballR, y, ballR * 2, 6, 3)
  return p.finish()
}

/** Compass bearing of the Main Quad's walls (the campus grid); Memorial Church's axis follows it. */
function quadBearing(): number {
  const q = LANDMARKS.filter((l) => l.id === "mainquad")[0]
  return q && q.wallBearing ? q.wallBearing : 15
}

/**
 * Memorial Church (Shepley, Rutan & Coolidge / Charles Coolidge plan, dedicated 1903). Source: Wikipedia
 * "Stanford Memorial Church": cruciform, about 58 m long and 46 m wide, the facade facing north onto the Inner
 * Quad with three arched entrances under a gable carrying the large mosaic, a round-headed window (the original
 * rose window was lost in 1906), and no spire since 1906; the crossing now has a low tiled hipped roof.
 * There is no OSM footprint, so the model is built around `anchor` (which sits about 30 m south of the Inner
 * Quad's south arcade, near the crossing) with its axis on the Main Quad grid.
 */
function memchu(anchor: {x: number; z: number}, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const H = (m: number) => m * s.v
  const L = (m: number) => m * s.h
  // +a points to the facade (bearing of the grid, north-north-east); b across.
  const f = bearingFrame(anchor.x, anchor.z, quadBearing())
  const p = new Parts()
  const front = L(22), crossA0 = L(-4), crossA1 = L(-18), back = L(-28), apseR = L(7)
  // Nave (gable roof) with lower side aisles (lean-to roofs).
  const nb = L(7), ab = L(12)
  box(p.body, f, crossA0, front, -nb, nb, 0, H(14), false)
  gableRoof(p.accent, p.body, f, crossA0, front, -nb, nb, H(14), H(21), L(0.5))
  for (const side of [-1, 1]) {
    const b0 = Math.min(side * nb, side * ab), b1 = Math.max(side * nb, side * ab)
    box(p.body, f, crossA0, front, b0, b1, 0, H(8), false)
    const outer = side * ab, inner = side * nb
    p.accent.poly([P(f, crossA0, outer, H(8)), P(f, front, outer, H(8)), P(f, front, inner, H(11.5)), P(f, crossA0, inner, H(11.5))])
  }
  // Transepts (ridge across the axis) and the low crossing with its hipped roof.
  const tb = L(23)
  box(p.body, f, crossA1, crossA0, -tb, tb, 0, H(14), false)
  gableRoof(p.accent, p.body, turn(f, 1), -tb, tb, -crossA0, -crossA1, H(14), H(21), L(0.5))
  box(p.body, f, crossA1 + L(1), crossA0 - L(1), -L(8), L(8), H(14), H(18.5), true)
  hipRoof(p.accent, f, crossA1 + L(1), crossA0 - L(1), -L(8), L(8), H(18.5), H(22.5), L(0.4))
  // Chancel and the half-octagon apse.
  box(p.body, f, back, crossA1, -nb, nb, 0, H(14), false)
  gableRoof(p.accent, p.body, f, back, crossA1, -nb, nb, H(14), H(21), L(0.5))
  const apse: P2[] = []
  for (let i = 0; i <= 4; i++) {
    const t = Math.PI / 2 + (i / 4) * Math.PI
    apse.push(at(f, back + Math.cos(t) * apseR, Math.sin(t) * apseR))
  }
  for (let i = 0; i < 4; i++) p.body.poly([[apse[i][0], 0, apse[i][1]], [apse[i + 1][0], 0, apse[i + 1][1]], [apse[i + 1][0], H(13), apse[i + 1][1]], [apse[i][0], H(13), apse[i][1]]])
  const [ax, az] = at(f, back, 0)
  for (let i = 0; i < 4; i++) p.accent.poly([[apse[i][0], H(13), apse[i][1]], [apse[i + 1][0], H(13), apse[i + 1][1]], [ax, H(19), az]])
  // Facade: a screen wall across nave and aisles whose gable stands proud of the nave roof.
  const fa = front, fb = front + L(2)
  box(p.body, f, fa, fb, -ab, ab, 0, H(11), true)
  box(p.body, f, fa, fb, -nb - L(1), nb + L(1), H(11), H(17), false)
  for (const a of [fa, fb]) p.body.poly([P(f, a, -nb - L(1), H(17)), P(f, a, nb + L(1), H(17)), P(f, a, 0, H(24))])
  p.body.poly([P(f, fa, -nb - L(1), H(17)), P(f, fb, -nb - L(1), H(17)), P(f, fb, 0, H(24)), P(f, fa, 0, H(24))])
  p.body.poly([P(f, fa, nb + L(1), H(17)), P(f, fb, nb + L(1), H(17)), P(f, fb, 0, H(24)), P(f, fa, 0, H(24))])
  // On the facade face (a = fb + a hair), in a frame whose +b points out of the facade: mosaic arch, the round
  // window in the gable, and the three arched doors.
  const out: Frame = turn(f, -1) // +b of `out` is +a of f
  const face = fb + L(0.15)
  const toOut = (bAcross: number) => -bAcross // along-face coordinate in `out`: a_out = -b_f
  archPanel(p.trim, out, face, toOut(0), L(5.5), H(9), H(14.5) - L(5.5) * 0.2, 10)
  discPanel(p.trim, out, face, toOut(0), H(19.5), L(1.8), 12)
  archPanel(p.trim, out, face + L(0.05), toOut(0), L(1.6), 0, H(5), 6)
  for (const side of [-1, 1]) archPanel(p.trim, out, face + L(0.05), toOut(side * L(4.5)), L(1.2), 0, H(4.2), 6)
  return p.finish()
}

/**
 * Main Quad (Shepley, Rutan & Coolidge, 1887-1903): sandstone ranges with red clay-tile hipped roofs around the
 * Inner Quad, an arcade running round the court. Source: Wikipedia "Stanford University" campus section and
 * aerial photos. Built from the real multipolygon footprint (outer ring plus court holes); eaves are capped at
 * 8 m (the baked 19 m is the complex's tallest part) so Memorial Church rises clearly out of it. The largest hole
 * is the Inner Quad; it gets a low lean-to arcade on piers along its inner edge.
 */
function mainQuad(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const fp = footprint(b, o)
  const p = new Parts()
  const yE = Math.min(heightM(b, 8), 8) * s.v
  walls(p.body, fp, 0, yE, o.wallInsetCm || 0)
  insetRoof(p.accent, fp, yE, 3.5 * s.v, 3 * s.h)
  // The Inner Quad: the hole with the largest area.
  let bestR = -1, bestA = 0
  for (let r = 1; r + 1 < fp.starts.length; r++) {
    const st = fp.starts[r], n = fp.starts[r + 1] - st
    let a = 0
    for (let k = 0; k < n; k++) {
      const i = st + k, j = st + ((k + 1) % n)
      a += fp.x[i] * fp.z[j] - fp.x[j] * fp.z[i]
    }
    if (Math.abs(a) > bestA) {
      bestA = Math.abs(a)
      bestR = r
    }
  }
  if (bestR > 0) {
    const st = fp.starts[bestR], n = fp.starts[bestR + 1] - st
    const depth = 4 * s.h, yLo = 4.5 * s.v, yHi = 6 * s.v
    const pier = 0.9 * s.h, spacing = 7 * s.h
    for (let k = 0; k < n; k++) {
      const i = st + k, j = st + ((k + 1) % n)
      // Mitres point away from the material, i.e. into the court for a hole.
      const ix = fp.x[i] + fp.mx[i] * depth, iz = fp.z[i] + fp.mz[i] * depth
      const jx = fp.x[j] + fp.mx[j] * depth, jz = fp.z[j] + fp.mz[j] * depth
      p.accent.poly([[fp.x[i], yHi, fp.z[i]], [fp.x[j], yHi, fp.z[j]], [jx, yLo, jz], [ix, yLo, iz]])
      // Piers along the outer (court-side) edge of the arcade.
      const ex = jx - ix, ez = jz - iz
      const len = Math.hypot(ex, ez)
      if (len < spacing * 0.5) continue
      const cnt = Math.max(1, Math.round(len / spacing))
      const ef: Frame = {ox: ix, oz: iz, ux: ex / len, uz: ez / len}
      for (let c = 0; c < cnt; c++) {
        const a = ((c + 0.5) / cnt) * len
        box(p.body, ef, a - pier / 2, a + pier / 2, -pier / 2, pier / 2, 0, yLo, false)
      }
    }
  }
  return p.finish()
}

/**
 * Generic campus building: walls on the real footprint and a hipped clay-tile roof (true hip on a rectangle,
 * the inset approximation otherwise). Returns the parts and the eave height so callers can add their cue.
 */
function tiledBuilding(b: BakedBuilding, o: MapMeshOptions, fallbackM: number, riseM: number, insetM: number): {p: Parts; fp: Footprint; yE: number; yR: number} {
  const s = scaleOf(o)
  const fp = footprint(b, o)
  const p = new Parts()
  const yR = heightM(b, fallbackM) * s.v
  const yE = Math.max(yR * 0.5, yR - riseM * s.v)
  walls(p.body, fp, 0, yE, o.wallInsetCm || 0)
  const rect = fp.starts.length === 2 && fp.starts[1] === 4
  if (rect) hipRoof(p.accent, fp.frame, -fp.halfA, fp.halfA, -fp.halfB, fp.halfB, yE, yR, 0.5 * s.h)
  else insetRoof(p.accent, fp, yE, yR - yE, Math.min(insetM * s.h, fp.halfB * 0.35))
  return {p, fp, yE, yR}
}

/**
 * Huang Engineering Center (Bohlin Cywinski Jackson, 2010). Sources: Stanford campus map / ICME directions
 * (a four-storey octagonal rotunda, the 300-seat NVIDIA Auditorium below it), photos for the tile roof.
 * The main block is the rectangle on the footprint's longest wall; the rotunda is fitted to the curved lobe
 * that sticks out of it, and drawn as an octagonal drum a little taller than the block with a tiled octagonal
 * roof and a glazed band under the eaves.
 */
function huang(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const fp = footprint(b, o)
  const p = new Parts()
  const n0 = fp.starts[1]
  // Longest edge = the block's long wall; p axis points into the polygon.
  let li = 0, ll = 0
  for (let k = 0; k < n0; k++) {
    const j = (k + 1) % n0
    const l = Math.hypot(fp.x[j] - fp.x[k], fp.z[j] - fp.z[k])
    if (l > ll) {
      ll = l
      li = k
    }
  }
  const lj = (li + 1) % n0
  let f: Frame = {ox: fp.x[li], oz: fp.z[li], ux: (fp.x[lj] - fp.x[li]) / ll, uz: (fp.z[lj] - fp.z[li]) / ll}
  // Make +b point into the building (towards the centroid).
  let cx = 0, cz = 0
  for (let i = 0; i < n0; i++) {
    cx += fp.x[i] / n0
    cz += fp.z[i] / n0
  }
  if (local(f, cx, cz)[1] < 0) f = {ox: fp.x[lj], oz: fp.z[lj], ux: -f.ux, uz: -f.uz}
  // Block depth: the farthest wall parallel to the long wall that is at least a quarter of its length.
  let depth = 0, a0 = Infinity, a1 = -Infinity
  for (let k = 0; k < n0; k++) {
    const j = (k + 1) % n0
    const [pa, pb] = local(f, fp.x[k], fp.z[k])
    const [qa, qb] = local(f, fp.x[j], fp.z[j])
    const l = Math.hypot(qa - pa, qb - pb)
    if (l >= ll * 0.25 && Math.abs(qb - pb) < l * 0.18) depth = Math.max(depth, (pb + qb) / 2)
  }
  if (depth <= 0) depth = fp.halfB * 2
  const lobe: P2[] = []
  for (let i = 0; i < n0; i++) {
    const [a, bb] = local(f, fp.x[i], fp.z[i])
    if (bb <= depth + 0.5 * s.h) {
      a0 = Math.min(a0, a)
      a1 = Math.max(a1, a)
    } else lobe.push([a, bb])
  }
  const yR = heightM(b, 9) * s.v
  const yE = yR - 3 * s.v
  // Main block: walls, hipped tile roof.
  box(p.body, f, a0, a1, 0, depth, 0, yE, false)
  hipRoof(p.accent, f, a0, a1, 0, depth, yE, yR, 0.5 * s.h)
  // Rotunda.
  if (lobe.length >= 3) {
    let ca = 0, cb = 0
    for (const [a, bb] of lobe) {
      ca += a / lobe.length
      cb += bb / lobe.length
    }
    let r = 0
    for (const [a, bb] of lobe) r += Math.hypot(a - ca, bb - cb) / lobe.length
    r = Math.max(r, 4 * s.h)
    const oct = ngon(f, ca, cb, r, 8, Math.PI / 8)
    const yRot = yE + 2 * s.v
    frustum(p.body, oct, oct, 0, yRot, false)
    const glass = ngon(f, ca, cb, r * 1.02, 8, Math.PI / 8)
    frustum(p.trim, glass, glass, yRot - 1.6 * s.v, yRot - 0.4 * s.v, false)
    const [rx, rz] = at(f, ca, cb)
    const eave = ngon(f, ca, cb, r * 1.08, 8, Math.PI / 8)
    pyramid(p.accent, eave, yRot, [rx, yRot + r * 0.5, rz])
  }
  return p.finish()
}

/** Footprint point with the largest projection on a map-space direction (dx, dz). */
function extremePoint(fp: Footprint, dx: number, dz: number): number {
  let best = 0, bv = -Infinity
  for (let i = 0; i < fp.starts[1]; i++) {
    const v = fp.x[i] * dx + fp.z[i] * dz
    if (v > bv) {
      bv = v
      best = i
    }
  }
  return best
}

/**
 * Packard Electrical Engineering (Pei Cobb Freed, 1999). Source: Stanford Magazine "Chips off the old block": a
 * see-through glass prow/atrium facing the entrance to the Science and Engineering Quad, between Packard and
 * Hewlett. Clay-tile roof; the prow is the glass wedge at the footprint's pointed east end, standing a storey
 * proud of the roof.
 */
function packard(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const {p, fp, yR} = tiledBuilding(b, o, 12, 3.5, 5)
  const n0 = fp.starts[1]
  const i = extremePoint(fp, 1, 0)
  const prev = (i - 1 + n0) % n0, next = (i + 1) % n0
  const t = 0.55
  const pts: P2[] = [
    [fp.x[i], fp.z[i]],
    [fp.x[i] + (fp.x[next] - fp.x[i]) * t, fp.z[i] + (fp.z[next] - fp.z[i]) * t],
    [fp.x[i] + (fp.x[prev] - fp.x[i]) * t, fp.z[i] + (fp.z[prev] - fp.z[i]) * t]
  ]
  frustum(p.trim, pts, pts, 0, yR + 3 * s.v, true)
  return p.finish()
}

/**
 * Y2E2, the Jerry Yang and Akiko Yamazaki Environment and Energy Building (Boora Architects, 2008). Sources: Palo
 * Alto Online (2008) and office-52.com: four atria from ground to roof, each capped by a raised triangular
 * skylight. Modelled as the tiled building with four glass prisms (triangular section) on the long arm's spine.
 */
function y2e2(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const {p, fp, yR} = tiledBuilding(b, o, 9, 2.5, 5)
  // Long arm: the frame from the footprint's longest edge, atria along it at the arm's mid-depth.
  const n0 = fp.starts[1]
  let li = 0, ll = 0
  for (let k = 0; k < n0; k++) {
    const j = (k + 1) % n0
    const l = Math.hypot(fp.x[j] - fp.x[k], fp.z[j] - fp.z[k])
    if (l > ll) {
      ll = l
      li = k
    }
  }
  const lj = (li + 1) % n0
  let f: Frame = {ox: fp.x[li], oz: fp.z[li], ux: (fp.x[lj] - fp.x[li]) / ll, uz: (fp.z[lj] - fp.z[li]) / ll}
  let cx = 0, cz = 0
  for (let i = 0; i < n0; i++) {
    cx += fp.x[i] / n0
    cz += fp.z[i] / n0
  }
  if (local(f, cx, cz)[1] < 0) f = {ox: fp.x[lj], oz: fp.z[lj], ux: -f.ux, uz: -f.uz}
  const armB = Math.min(fp.halfB, 15 * s.h) // mid-depth of a ~30 m deep arm
  const w = 4 * s.h, d = 3.5 * s.h, hgt = 2.5 * s.v
  for (let k = 0; k < 4; k++) {
    const a = ll * (0.14 + 0.24 * k)
    // Triangular-section skylight: ridge across the arm.
    const y0 = yR - 1.2 * s.v
    p.trim.poly([P(f, a - w, armB - d, y0), P(f, a + w, armB - d, y0), P(f, a + w, armB, y0 + hgt), P(f, a - w, armB, y0 + hgt)])
    p.trim.poly([P(f, a - w, armB + d, y0), P(f, a + w, armB + d, y0), P(f, a + w, armB, y0 + hgt), P(f, a - w, armB, y0 + hgt)])
    p.trim.poly([P(f, a - w, armB - d, y0), P(f, a - w, armB + d, y0), P(f, a - w, armB, y0 + hgt)])
    p.trim.poly([P(f, a + w, armB - d, y0), P(f, a + w, armB + d, y0), P(f, a + w, armB, y0 + hgt)])
  }
  return p.finish()
}

/**
 * Gates Computer Science (Robert A.M. Stern Architects, 1996). Source: ramsa.com project page: low-pitched clay
 * tile roofs over buff limestone, deeply recessed windows. Cue: a band of recessed windows (dim) round the top
 * floor under the eaves, on the real footprint, which keeps its rounded corner bay.
 */
function gates(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const {p, fp, yE} = tiledBuilding(b, o, 19, 3, 5)
  walls(p.trim, fp, yE - 2.6 * s.v, yE - 0.6 * s.v, -0.06)
  return p.finish()
}

/**
 * Hewlett Teaching Center (Pei Cobb Freed / James Ingo Freed, 1999; Wikipedia "Hewlett Teaching Center"): two large
 * auditoriums, forming the gateway to the Science and Engineering Quad with Packard. Tile roof on the real
 * footprint, which keeps the curved auditorium end; cue: a glazed ground-floor band (dim) under the masonry.
 */
function hewlett(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const {p, fp} = tiledBuilding(b, o, 9, 2.5, 4)
  walls(p.trim, fp, 0.6 * s.v, 2.6 * s.v, -0.06)
  return p.finish()
}

/**
 * Spilker Engineering and Applied Sciences (Bohlin Cywinski Jackson, 2010; no detailed source found). A simple
 * rectangle under a hipped clay-tile roof (Science and Engineering Quad roofs are clay tile, Stanford Magazine);
 * cue: a ridge clerestory/skylight strip (dim glass), as on the other SEQ buildings.
 */
function spilker(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const {p, fp, yR} = tiledBuilding(b, o, 12, 3.5, 5)
  const f = fp.frame
  const run = Math.max(fp.halfA - fp.halfB, fp.halfA * 0.3)
  box(p.trim, f, -run, run, -1.2 * s.h, 1.2 * s.h, yR - 0.3 * s.v, yR + 1.2 * s.v, true)
  return p.finish()
}

/** Compass bearing Cantor's entrance faces (assumed: east, onto Lomita Drive; not confirmed by a source). */
const CANTOR_FACADE_BEARING = 105

/**
 * Cantor Arts Center, the 1894 Leland Stanford Jr. Museum (Percy & Hamilton; neoclassical, modelled on the National
 * Archaeological Museum in Athens; quake06.stanford.edu). A low tiled building on the real footprint (with its
 * courtyard hole) and a hexastyle portico with a pediment centred on the facade side. The column count and the
 * facade direction come from photos/recollection, not a cited source (see CANTOR_FACADE_BEARING).
 */
function cantor(b: BakedBuilding, o: MapMeshOptions): LandmarkModel | null {
  const s = scaleOf(o)
  const {p, fp, yE} = tiledBuilding(b, o, 9, 2.5, 4)
  // Pick the OBB side whose outward normal is closest to the facade bearing.
  const r = (CANTOR_FACADE_BEARING * Math.PI) / 180
  const wx = Math.sin(r), wz = -Math.cos(r)
  let bestK = 0, bestDot = -Infinity
  for (let k = 0; k < 4; k++) {
    const t = turn(fp.frame, k)
    // Outward normal of the +b side of `t` is p = (-uz, ux).
    const d = -t.uz * wx + t.ux * wz
    if (d > bestDot) {
      bestDot = d
      bestK = k
    }
  }
  const f = turn(fp.frame, bestK)
  const half = bestK % 2 === 0 ? fp.halfB : fp.halfA
  const face = half
  const depthP = 5 * s.h, hw = 9 * s.h
  const yCol = Math.max(yE * 0.85, 6 * s.v)
  // Steps / stylobate, six columns, entablature, pediment.
  box(p.body, f, -hw - s.h, hw + s.h, face - s.h, face + depthP + s.h, 0, 0.8 * s.v)
  const colR = 0.6 * s.h
  for (let c = 0; c < 6; c++) {
    const a = -hw + (c / 5) * (2 * hw)
    const ring = ngon(f, a, face + depthP - colR, colR, 6)
    frustum(p.body, ring, ring, 0.8 * s.v, yCol, false)
  }
  box(p.body, f, -hw - 0.5 * s.h, hw + 0.5 * s.h, face, face + depthP + 0.3 * s.h, yCol, yCol + 1.2 * s.v)
  const yP = yCol + 1.2 * s.v
  // Pediment: gable triangle front and back, roof slopes over the portico.
  const fr = face + depthP + 0.3 * s.h
  for (const bb of [face, fr]) p.body.poly([P(f, -hw - 0.5 * s.h, bb, yP), P(f, hw + 0.5 * s.h, bb, yP), P(f, 0, bb, yP + 2.5 * s.v)])
  p.accent.poly([P(f, -hw - 0.7 * s.h, face, yP), P(f, -hw - 0.7 * s.h, fr + 0.2 * s.h, yP), P(f, 0, fr + 0.2 * s.h, yP + 2.5 * s.v), P(f, 0, face, yP + 2.5 * s.v)])
  p.accent.poly([P(f, hw + 0.7 * s.h, face, yP), P(f, hw + 0.7 * s.h, fr + 0.2 * s.h, yP), P(f, 0, fr + 0.2 * s.h, yP + 2.5 * s.v), P(f, 0, face, yP + 2.5 * s.v)])
  // Dim recess behind the columns (the entrance wall).
  p.trim.poly([P(f, -hw, face + 0.1 * s.h, 0.8 * s.v), P(f, hw, face + 0.1 * s.h, 0.8 * s.v), P(f, hw, face + 0.1 * s.h, yCol), P(f, -hw, face + 0.1 * s.h, yCol)])
  return p.finish()
}

/**
 * A recognisable low-poly model for a landmark, or null to keep the plain extrusion.
 * @param id landmark id (see MODELLED_LANDMARKS)
 * @param b its baked footprint, or null when it has none (Memorial Church)
 * @param anchor the landmark's map position in map-frame cm (x east, z = -north), as makeLandmark's `map.x/map.z`;
 *   used only when there is no footprint
 * @param o the same mesh options as the map (cmPerM, center, verticalExaggeration, wallInsetCm)
 */
export function buildLandmarkModel(id: string, b: BakedBuilding | null, anchor: {x: number; z: number}, o: MapMeshOptions): LandmarkModel | null {
  if (id === "memchu") return memchu(anchor, o)
  if (!b || b[3].length < 6) return null
  switch (id) {
    case "hoover":
      return hoover(b, o)
    case "mainquad":
      return mainQuad(b, o)
    case "huang":
      return huang(b, o)
    case "packard":
      return packard(b, o)
    case "y2e2":
      return y2e2(b, o)
    case "gates":
      return gates(b, o)
    case "hewlett":
      return hewlett(b, o)
    case "spilker":
      return spilker(b, o)
    case "cantor":
      return cantor(b, o)
    default:
      return null
  }
}

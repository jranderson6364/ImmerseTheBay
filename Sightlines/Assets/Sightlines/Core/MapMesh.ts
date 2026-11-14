/**
 * Turns the baked OSM footprints into interleaved vertex/index arrays for Lens MeshBuilder
 * (layout: position xyz, normal xyz, texture0 uv). Pure, unit-tested.
 *
 * Roofs and walls are separate chunk lists so they can use different brightness on an unlit material;
 * that contrast is what makes the map read as 3D when you look down at it. Roofs and walls are further split
 * by height band and by a neighbour-alternating tone, so adjacent buildings get different colours.
 * Outlines (a bright mitred strip around every roof perimeter, a short lip down the outside, and optional
 * vertical lines at sharp corners) are their own chunk list so they can be drawn in an edge colour.
 * Each chunk stays under 64,000 vertices because MeshBuilder only supports UInt16 indices.
 */
import {BakedBuilding} from "../Data/CampusData"
import {EN} from "./Geo"

export interface MeshChunk {
  verts: number[]
  idx: number[]
}

export interface MapMeshOptions {
  /** Map centimetres per real metre: 100 / scale denominator (1:600 -> 0.167). */
  cmPerM: number
  /** Vertical exaggeration so low campus buildings stay visible at map scale. */
  verticalExaggeration: number
  /** Wearer position in local metres; the map is centred here. */
  center: EN
  /** Only buildings whose first vertex lies within this radius (metres) of the centre are included. */
  radiusM: number
  /** Minimum drawn height in cm, so flat buildings still show a wall. */
  minHeightCm: number
  /** Height band upper bounds in real metres: [8, 15] means <8 m, 8-15 m, >15 m. Default [8, 15]. */
  bandThresholdsM?: number[]
  /** Width of the roof outline strip in cm. 0 disables outlines. Default 0.2. */
  outlineWidthCm?: number
  /** How far the outline strip floats above the roof, in cm (avoids z-fighting). Default 0.03. */
  outlineLiftCm?: number
  /** Height of the lip that runs down the outside of the wall top, in cm. Default = outlineWidthCm. */
  outlineDropCm?: number
  /** Vertical corner lines where the footprint turns by at least this many degrees. 0 disables. Default 45. */
  cornerAngleDeg?: number
  /** Walls are pulled this far (cm) inside the roof edge so the roof and outline overhang them. Default 0. */
  wallInsetCm?: number
}

export const DEFAULT_BAND_THRESHOLDS_M = [8, 15]
/** Number of alternating tones per height band (neighbours get different tones). */
export const TONES = 2

const MAX_VERTS = 64000
const VERTEX_STRIDE = 8
const MITER_LIMIT = 2.5
/** Footprints whose bounding boxes come within this many metres are neighbours for tone alternation. */
const NEIGHBOUR_PAD_M = 2.5

class ChunkWriter {
  chunks: MeshChunk[] = []
  private cur: MeshChunk = {verts: [], idx: []}

  ensure(nVerts: number) {
    if (this.cur.verts.length / VERTEX_STRIDE + nVerts > MAX_VERTS) this.flush()
  }

  base(): number {
    return this.cur.verts.length / VERTEX_STRIDE
  }

  v(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    this.cur.verts.push(x, y, z, nx, ny, nz, 0, 0)
  }

  i(...ids: number[]) {
    for (const id of ids) this.cur.idx.push(id)
  }

  /** Double-sided quad a-b-c-d, so it renders whichever way culling is set. */
  quad(a: number, b: number, c: number, d: number) {
    this.i(a, b, c, a, c, d, a, c, b, a, d, c)
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

export function buildingHeightCm(b: BakedBuilding, o: MapMeshOptions): number {
  return Math.max(o.minHeightCm, b[0] * o.cmPerM * o.verticalExaggeration)
}

/**
 * Height band index for a real height in metres. With [8, 15]: <8 m -> 0, 8-15 m (both inclusive) -> 1, >15 m -> 2.
 * The first threshold is inclusive at the bottom of band 1; later thresholds are inclusive at the top of their band.
 */
export function heightBand(heightM: number, thresholdsM: number[] = DEFAULT_BAND_THRESHOLDS_M): number {
  let band = 0
  for (const t of thresholdsM) if (heightM > t || (band === 0 && heightM >= t)) band++
  return band
}

/** Per-vertex geometry of one closed ring in map cm: positions, outward mitre offsets, and turn angles. */
interface RingFrame {
  x: number[]
  z: number[]
  /** Mitre offset per vertex: unit-width offset away from the building material (length >= 1). */
  mx: number[]
  mz: number[]
  /** Turn angle at each vertex in degrees (0 = straight). */
  turn: number[]
}

function ringFrames(b: BakedBuilding, o: MapMeshOptions): RingFrame[] {
  const [, , , ring, holes] = b
  const nPts = ring.length / 2
  const starts = [0, ...holes, nPts]
  const frames: RingFrame[] = []
  for (let r = 0; r < starts.length - 1; r++) {
    const s = starts[r]
    const n = starts[r + 1] - s
    if (n < 3) continue
    const x: number[] = [], z: number[] = []
    let area = 0
    for (let k = 0; k < n; k++) {
      const i = s + k
      const j = s + ((k + 1) % n)
      area += ring[2 * i] * ring[2 * j + 1] - ring[2 * j] * ring[2 * i + 1]
      x.push((ring[2 * i] / 10 - o.center.e) * o.cmPerM)
      z.push(-(ring[2 * i + 1] / 10 - o.center.n) * o.cmPerM)
    }
    // Outer rings should be CCW in (east, north) and holes CW; then (-dz, dx) in map space points away from the
    // building material. Flip if a ring came in the other way round.
    const sgn = (r === 0 ? area > 0 : area < 0) ? 1 : -1
    // Edge normals.
    const enx: number[] = [], enz: number[] = [], edx: number[] = [], edz: number[] = []
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n
      const dx = x[k2] - x[k], dz = z[k2] - z[k]
      const len = Math.hypot(dx, dz) || 1
      edx.push(dx / len)
      edz.push(dz / len)
      enx.push((-dz / len) * sgn)
      enz.push((dx / len) * sgn)
    }
    const mx: number[] = [], mz: number[] = [], turn: number[] = []
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
      const cos = bx * enx[k] + bz * enz[k]
      const scale = 1 / Math.max(cos, 1 / MITER_LIMIT)
      mx.push(bx * scale)
      mz.push(bz * scale)
      const d = Math.max(-1, Math.min(1, edx[p] * edx[k] + edz[p] * edz[k]))
      turn.push((Math.acos(d) * 180) / Math.PI)
    }
    frames.push({x, z, mx, mz, turn})
  }
  return frames
}

/** Roof (earcut triangles) for one building. */
function writeRoof(b: BakedBuilding, o: MapMeshOptions, roofs: ChunkWriter) {
  const [, , , ring, , tri] = b
  const nPts = ring.length / 2
  const h = buildingHeightCm(b, o)
  roofs.ensure(nPts)
  const rb = roofs.base()
  for (let i = 0; i < nPts; i++) roofs.v((ring[2 * i] / 10 - o.center.e) * o.cmPerM, h, -(ring[2 * i + 1] / 10 - o.center.n) * o.cmPerM, 0, 1, 0)
  // Footprints are CCW in (east, north); with X = east, Z = -north that order already faces +Y under the
  // right-hand rule. Emit both windings anyway so culling settings on the material can't hide roofs.
  for (let t = 0; t < tri.length; t += 3) {
    roofs.i(rb + tri[t], rb + tri[t + 1], rb + tri[t + 2])
    roofs.i(rb + tri[t], rb + tri[t + 2], rb + tri[t + 1])
  }
}

/** Walls: each ring (outer, then holes) is closed; one double-sided quad per edge, optionally inset. */
function writeWalls(b: BakedBuilding, o: MapMeshOptions, frames: RingFrame[], walls: ChunkWriter) {
  const h = buildingHeightCm(b, o)
  const inset = o.wallInsetCm || 0
  for (const f of frames) {
    const n = f.x.length
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n
      const x1 = f.x[k] - f.mx[k] * inset, z1 = f.z[k] - f.mz[k] * inset
      const x2 = f.x[j] - f.mx[j] * inset, z2 = f.z[j] - f.mz[j] * inset
      const dx = x2 - x1, dz = z2 - z1
      const len = Math.hypot(dx, dz) || 1
      // Normal direction only matters for lit materials; walls are double-sided.
      const nx = -dz / len
      const nz = dx / len
      walls.ensure(4)
      const wb = walls.base()
      walls.v(x1, 0, z1, nx, 0, nz)
      walls.v(x2, 0, z2, nx, 0, nz)
      walls.v(x2, h, z2, nx, 0, nz)
      walls.v(x1, h, z1, nx, 0, nz)
      walls.quad(wb, wb + 1, wb + 2, wb + 3)
    }
  }
}

/**
 * Outline: a mitred strip straddling every roof perimeter (outer ring and holes) just above the roof, a lip down
 * the outside of the wall top so the edge also reads from an angle, and thin vertical lines at sharp corners.
 */
function writeOutline(b: BakedBuilding, o: MapMeshOptions, frames: RingFrame[], out: ChunkWriter) {
  const w = o.outlineWidthCm === undefined ? 0.2 : o.outlineWidthCm
  if (w <= 0) return
  const h = buildingHeightCm(b, o)
  const top = h + (o.outlineLiftCm === undefined ? 0.03 : o.outlineLiftCm)
  const low = Math.max(0, h - (o.outlineDropCm === undefined ? w : o.outlineDropCm))
  const cornerDeg = o.cornerAngleDeg === undefined ? 45 : o.cornerAngleDeg
  const hw = w / 2
  for (const f of frames) {
    const n = f.x.length
    out.ensure(3 * n)
    const base = out.base()
    for (let k = 0; k < n; k++) {
      // inner (on the roof), outer (overhanging), outer low (bottom of the lip)
      out.v(f.x[k] - f.mx[k] * hw, top, f.z[k] - f.mz[k] * hw, 0, 1, 0)
      out.v(f.x[k] + f.mx[k] * hw, top, f.z[k] + f.mz[k] * hw, 0, 1, 0)
      out.v(f.x[k] + f.mx[k] * hw, low, f.z[k] + f.mz[k] * hw, f.mx[k], 0, f.mz[k])
    }
    for (let k = 0; k < n; k++) {
      const a = base + 3 * k
      const c = base + 3 * ((k + 1) % n)
      out.quad(a, a + 1, c + 1, c) // top strip
      out.quad(a + 1, a + 2, c + 2, c + 1) // lip
    }
    if (cornerDeg <= 0) continue
    for (let k = 0; k < n; k++) {
      if (f.turn[k] < cornerDeg) continue
      // Two crossed thin quads from the ground to the strip, at the outside of the corner.
      const len = Math.hypot(f.mx[k], f.mz[k]) || 1
      const ux = f.mx[k] / len, uz = f.mz[k] / len
      const cx = f.x[k] + f.mx[k] * hw * 0.5, cz = f.z[k] + f.mz[k] * hw * 0.5
      out.ensure(8)
      for (const [ax, az] of [[ux, uz], [-uz, ux]]) {
        const cb = out.base()
        out.v(cx - ax * hw, 0, cz - az * hw, az, 0, -ax)
        out.v(cx + ax * hw, 0, cz + az * hw, az, 0, -ax)
        out.v(cx + ax * hw, top, cz + az * hw, az, 0, -ax)
        out.v(cx - ax * hw, top, cz - az * hw, az, 0, -ax)
        out.quad(cb, cb + 1, cb + 2, cb + 3)
      }
    }
  }
}

export function withinRadius(b: BakedBuilding, o: MapMeshOptions): boolean {
  const e = b[3][0] / 10 - o.center.e
  const n = b[3][1] / 10 - o.center.n
  return Math.hypot(e, n) <= o.radiusM
}

/** Footprint bounding box in metres: [minE, minN, maxE, maxN]. */
function bbox(b: BakedBuilding): number[] {
  const r = b[3]
  let a = Infinity, c = Infinity, d = -Infinity, e = -Infinity
  for (let i = 0; i < r.length; i += 2) {
    a = Math.min(a, r[i] / 10)
    c = Math.min(c, r[i + 1] / 10)
    d = Math.max(d, r[i] / 10)
    e = Math.max(e, r[i + 1] / 10)
  }
  return [a, c, d, e]
}

/**
 * Deterministic greedy colouring: each listed building gets the lowest tone (0..TONES-1) not used by an
 * already-coloured neighbour in the same height band (bounding boxes within NEIGHBOUR_PAD_M). With two tones
 * a dense cluster can still put two same-tone buildings side by side; it minimises that, it does not forbid it.
 */
export function assignTones(buildings: BakedBuilding[], indices: number[], thresholdsM: number[] = DEFAULT_BAND_THRESHOLDS_M): Map<number, number> {
  const boxes = indices.map((i) => bbox(buildings[i]))
  const bands = indices.map((i) => heightBand(buildings[i][0], thresholdsM))
  const tones = new Map<number, number>()
  for (let a = 0; a < indices.length; a++) {
    const used = new Array(TONES).fill(0)
    for (let c = 0; c < a; c++) {
      if (bands[c] !== bands[a]) continue
      const p = boxes[a], q = boxes[c]
      if (p[0] - NEIGHBOUR_PAD_M > q[2] || q[0] - NEIGHBOUR_PAD_M > p[2] || p[1] - NEIGHBOUR_PAD_M > q[3] || q[1] - NEIGHBOUR_PAD_M > p[3]) continue
      used[tones.get(indices[c])]++
    }
    // Lowest unused tone; if all are used, the least used one.
    let best = 0
    for (let t = 1; t < TONES; t++) if (used[t] < used[best]) best = t
    tones.set(indices[a], best)
  }
  return tones
}

export interface CampusMesh {
  /** roofBands[band][tone] -> chunks. Bands follow bandThresholdsM; tones alternate between neighbours. */
  roofBands: MeshChunk[][][]
  wallBands: MeshChunk[][][]
  /** Roof perimeter outlines and corner lines for every background building. */
  outlines: MeshChunk[]
  /** All roof / wall chunks flattened (the same chunk objects as in the band lists; for counting). */
  roofs: MeshChunk[]
  walls: MeshChunk[]
}

/** Background campus: every building in range except the excluded (landmark) indices. */
export function buildCampusMesh(buildings: BakedBuilding[], o: MapMeshOptions, exclude: Set<number>): CampusMesh {
  const thresholds = o.bandThresholdsM || DEFAULT_BAND_THRESHOLDS_M
  const nBands = thresholds.length + 1
  const roofW: ChunkWriter[][] = [], wallW: ChunkWriter[][] = []
  for (let band = 0; band < nBands; band++) {
    roofW.push([])
    wallW.push([])
    for (let t = 0; t < TONES; t++) {
      roofW[band].push(new ChunkWriter())
      wallW[band].push(new ChunkWriter())
    }
  }
  const outlines = new ChunkWriter()
  const included: number[] = []
  buildings.forEach((b, i) => {
    if (!exclude.has(i) && withinRadius(b, o)) included.push(i)
  })
  const tones = assignTones(buildings, included, thresholds)
  for (const i of included) {
    const b = buildings[i]
    const band = heightBand(b[0], thresholds)
    const tone = tones.get(i)
    const frames = ringFrames(b, o)
    writeRoof(b, o, roofW[band][tone])
    writeWalls(b, o, frames, wallW[band][tone])
    writeOutline(b, o, frames, outlines)
  }
  const roofBands = roofW.map((ts) => ts.map((w) => w.done()))
  const wallBands = wallW.map((ts) => ts.map((w) => w.done()))
  const flat = (x: MeshChunk[][][]) => {
    const r: MeshChunk[] = []
    for (const ts of x) for (const cs of ts) for (const c of cs) r.push(c)
    return r
  }
  return {roofBands, wallBands, outlines: outlines.done(), roofs: flat(roofBands), walls: flat(wallBands)}
}

/** One building as its own mesh (roof and walls together), for landmarks that highlight independently. */
export function buildSingleBuilding(b: BakedBuilding, o: MapMeshOptions): MeshChunk {
  const w = new ChunkWriter()
  writeRoof(b, o, w)
  writeWalls(b, o, ringFrames(b, o), w)
  return w.done()[0] || {verts: [], idx: []}
}

/** One building's outline (perimeter strip, lip, corner lines) as its own mesh. Empty if outlines are off. */
export function buildBuildingOutline(b: BakedBuilding, o: MapMeshOptions): MeshChunk {
  const w = new ChunkWriter()
  writeOutline(b, o, ringFrames(b, o), w)
  return w.done()[0] || {verts: [], idx: []}
}

/** Sum of vertices across chunks. */
export function vertexCount(chunks: MeshChunk[]): number {
  let n = 0
  for (const c of chunks) n += c.verts.length / VERTEX_STRIDE
  return n
}

/**
 * Where a landmark sits on the map (cm, map frame): its true spot if within `radiusM` of the centre, otherwise
 * pinned just outside the disc edge (`radiusCm + pinOffsetCm`) in its true direction. `forcePin` always pins
 * (off-map cards).
 */
export function landmarkMapPlacement(en: EN, center: EN, cmPerM: number, radiusM: number, pinOffsetCm = 3, forcePin = false): {x: number; y: number; z: number; pinned: boolean} {
  const de = en.e - center.e
  const dn = en.n - center.n
  const d = Math.hypot(de, dn)
  if (d < 1e-9) return {x: 0, y: 0, z: 0, pinned: false}
  if (d <= radiusM && !forcePin) return {x: de * cmPerM, y: 0, z: -dn * cmPerM, pinned: false}
  const r = radiusM * cmPerM + pinOffsetCm
  return {x: (de / d) * r, y: 0, z: (-dn / d) * r, pinned: true}
}

/** Flat disc (triangle fan as triangles) for the map base, radius in cm. */
export function buildDisc(radiusCm: number, segments = 64, y = -0.05): MeshChunk {
  const verts: number[] = [0, y, 0, 0, 1, 0, 0, 0]
  const idx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    verts.push(Math.sin(a) * radiusCm, y, Math.cos(a) * radiusCm, 0, 1, 0, 0, 0)
    if (i > 0) idx.push(0, i, i + 1)
  }
  return {verts, idx}
}

/** Ring (annulus) for the map edge or a highlight halo. */
export function buildRing(radiusCm: number, widthCm: number, segments = 96, y = 0): MeshChunk {
  const verts: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const s = Math.sin(a), c = Math.cos(a)
    verts.push(s * radiusCm, y, c * radiusCm, 0, 1, 0, 0, 0)
    verts.push(s * (radiusCm - widthCm), y, c * (radiusCm - widthCm), 0, 1, 0, 0, 0)
    if (i > 0) {
      const b = (i - 1) * 2
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2, b, b + 2, b + 1, b + 1, b + 2, b + 3)
    }
  }
  return {verts, idx}
}

/**
 * A tube along a polyline (square cross-section, cheap), for beams and arcs. Points in cm.
 * Double-sided so it renders regardless of culling.
 */
export function buildTube(points: {x: number; y: number; z: number}[], widthCm: number): MeshChunk {
  const verts: number[] = []
  const idx: number[] = []
  const hw = widthCm / 2
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const q = points[Math.min(i + 1, points.length - 1)]
    const o = points[Math.max(i - 1, 0)]
    let tx = q.x - o.x, ty = q.y - o.y, tz = q.z - o.z
    const tl = Math.hypot(tx, ty, tz) || 1
    tx /= tl; ty /= tl; tz /= tl
    // side = t × up (or t × x if t is vertical); up2 = side × t
    let sx = ty * 0 - tz * 1, sy = tz * 0 - tx * 0, sz = tx * 1 - ty * 0
    if (Math.hypot(sx, sy, sz) < 1e-3) {
      sx = 0; sy = tz; sz = -ty
    }
    const sl = Math.hypot(sx, sy, sz) || 1
    sx /= sl; sy /= sl; sz /= sl
    const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
    for (const [a, b] of corners) {
      verts.push(p.x + (sx * a + ux * b) * hw, p.y + (sy * a + uy * b) * hw, p.z + (sz * a + uz * b) * hw, sx * a + ux * b, sy * a + uy * b, sz * a + uz * b, 0, 0)
    }
    if (i > 0) {
      const b0 = (i - 1) * 4, b1 = i * 4
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4
        idx.push(b0 + k, b1 + k, b1 + k2, b0 + k, b1 + k2, b0 + k2)
        idx.push(b0 + k, b1 + k2, b1 + k, b0 + k, b0 + k2, b1 + k2)
      }
    }
  }
  return {verts, idx}
}

/** Points along a parabolic arc from a to b peaking at `heightCm` above the straight line. */
export function arcPoints(a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}, heightCm: number, segments = 32) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    pts.push({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + 4 * heightCm * t * (1 - t), z: a.z + (b.z - a.z) * t})
  }
  return pts
}

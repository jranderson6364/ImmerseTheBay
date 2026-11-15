/**
 * Real-world building overlay: pure maths and mesh generation for the life-size nametag and outline that float on a
 * real Stanford building when the wearer looks at it outdoors. No Lens globals; unit-tested with bun.
 *
 * Frames follow Geo.ts / MapMesh.ts: local metres are east (e), north (n); the overlay frame is the RetrospecsMap
 * `worldRoot` frame (X = east, Y = up, Z = -north, centimetres, wearer's surveyed position at the origin, floor at
 * Y = 0), but at real scale: 1 m = 100 cm instead of the map's 1:600.
 */
import {BUILDINGS, LANDMARKS, BakedBuilding, BakedLandmark} from "../Data/CampusData"
import {cardById} from "./Cards"
import {EN, V3, formatDistance} from "./Geo"
import {MeshChunk, buildTube} from "./MapMesh"

/** What the locator hands the overlay. `worldPos` is world space, centimetres, at the building's position. */
export interface LocatorResult {
  id: string
  name: string
  worldPos: V3
  distanceM: number
  /** "camera" / "gemini" (vision-confirmed) or "gps" (estimate). Matched loosely, see overlayStyle. */
  source: string
  /** 0..1 (a 0..100 percentage or "high" / "medium" / "low" is also accepted). */
  confidence: number | string
  /** Optional real height in metres; used only when the id has no baked footprint. */
  heightM?: number
}

// ---------------------------------------------------------------------------------------------------------------
// Nametag placement

export interface NametagOptions {
  /** Tags further than this are drawn at this distance along the true bearing. Default 60 m. */
  maxRenderM?: number
  /** Target angular height of the title line in degrees. Default 2.5. */
  targetDeg?: number
  /** The angular size is clamped to this range when the scale clamps bite. Default [2, 3]. */
  minDeg?: number
  maxDeg?: number
  /** Height in cm of one WorldLabel title line at scale 1. Default 2 (the prefab's text box is 2 units tall). */
  labelHeightCmAtScale1?: number
  /** Eye height above the ground, metres. Used to keep the tag on the building's roof line when clamped. Default 1.6. */
  eyeHeightM?: number
  /** Clear gap between roof and the bottom of the tag, metres at real scale. Default max(2, 0.12 * height). */
  gapM?: number
  /** Distances below this are treated as this (avoids a zero-size tag). Default 2 m. */
  minDistanceM?: number
}

export interface NametagPlacement {
  /** Distance from the wearer the tag is actually drawn at, metres (<= maxRenderM). */
  renderDistanceM: number
  /** True when the building is further than maxRenderM and the tag was pulled in along the bearing. */
  clamped: boolean
  /** renderDistanceM / real distance (1 when not clamped). Scale the outline about the eye by this to keep it aligned. */
  k: number
  /** Height of the tag's centre above the ground at the render distance, metres. */
  heightM: number
  /** The same height at the building's real distance (equal to heightM when not clamped). */
  realHeightM: number
  /** Uniform scale for the WorldLabel holder. */
  scale: number
  /** Height of the title line at the render distance, cm. */
  textHeightCm: number
  /** Angular height of the title line as seen from the eye, degrees. */
  angularDeg: number
}

const DEG = Math.PI / 180

/**
 * Where and how big to draw a building's nametag. The tag sits `gapM` above the roof; its scale keeps the title at
 * about `targetDeg` tall. Buildings beyond `maxRenderM` get the tag at `maxRenderM` along the same bearing, with its
 * height scaled about the eye so it still appears over the roof line, and `clamped` set.
 */
export function nametagPlacement(distanceM: number, buildingHeightM: number, o: NametagOptions = {}): NametagPlacement {
  const maxRenderM = o.maxRenderM === undefined ? 60 : o.maxRenderM
  const targetDeg = o.targetDeg === undefined ? 2.5 : o.targetDeg
  const minDeg = o.minDeg === undefined ? 2 : o.minDeg
  const maxDeg = o.maxDeg === undefined ? 3 : o.maxDeg
  const unitCm = o.labelHeightCmAtScale1 === undefined ? 2 : o.labelHeightCmAtScale1
  const eye = o.eyeHeightM === undefined ? 1.6 : o.eyeHeightM
  const h = Math.max(0, isFinite(buildingHeightM) ? buildingHeightM : 9)
  const gap = o.gapM === undefined ? Math.max(2, 0.12 * h) : o.gapM
  const d = Math.max(o.minDistanceM === undefined ? 2 : o.minDistanceM, isFinite(distanceM) ? distanceM : 0)
  const clamped = d > maxRenderM
  const r = clamped ? maxRenderM : d
  const k = r / d
  // Angular size -> text height at the render distance -> scale (clamped to the allowed angular band).
  const sizeFor = (deg: number) => 2 * r * 100 * Math.tan((deg * DEG) / 2)
  const textHeightTarget = sizeFor(Math.min(maxDeg, Math.max(minDeg, targetDeg)))
  const scale = Math.min(sizeFor(maxDeg), Math.max(sizeFor(minDeg), textHeightTarget)) / unitCm
  const textHeightCm = scale * unitCm
  // Tag centre at real scale: roof + gap + half the (real-equivalent) text height.
  const realHeightM = h + gap + textHeightCm / 100 / k / 2
  const heightM = eye + (realHeightM - eye) * k
  const angularDeg = (2 * Math.atan(textHeightCm / 100 / 2 / r)) / DEG
  return {renderDistanceM: r, clamped, k, heightM, realHeightM, scale, textHeightCm, angularDeg}
}

// ---------------------------------------------------------------------------------------------------------------
// Confidence -> style

export interface OverlayStyle {
  /** Gemini / camera confirmed the building. */
  verified: boolean
  /** Dashed outline for estimates; solid when confirmed. */
  dashed: boolean
  /** 0.55..1: multiplier on the colour. Never lower: on the additive display dark is invisible outdoors. */
  brightness: number
  /** Outline / subtitle colour (already multiplied by brightness), RGBA. */
  color: [number, number, number, number]
  /** Badge text and colour. */
  badge: string
  badgeColor: [number, number, number, number]
  /** Normalised confidence 0..1. */
  confidence: number
}

const VERIFIED_RGB = [1.0, 0.96, 0.86] // warm white: clean and crisp against real facades
const ESTIMATE_RGB = [1.0, 0.76, 0.32] // warm amber

export function normaliseConfidence(c: number | string): number {
  if (typeof c === "string") {
    const s = c.toLowerCase()
    if (s.indexOf("high") >= 0) return 0.9
    if (s.indexOf("med") >= 0) return 0.6
    if (s.indexOf("low") >= 0) return 0.3
    const n = parseFloat(s)
    return isFinite(n) ? normaliseConfidence(n) : 0.5
  }
  if (!isFinite(c)) return 0.5
  const v = c > 1 ? c / 100 : c
  return Math.max(0, Math.min(1, v))
}

export function isVerifiedSource(source: string): boolean {
  return /camera|gemini|vision|verified|confirm/i.test(source || "")
}

/** Solid and bright when the camera (Gemini) confirmed it; dashed and dimmer when it is a GPS estimate. */
export function overlayStyle(source: string, confidence: number | string): OverlayStyle {
  const c = normaliseConfidence(confidence)
  const verified = isVerifiedSource(source)
  // A confirmed but shaky match stays solid only from 0.5 up; anything from GPS is dashed.
  const dashed = !verified || c < 0.5
  const brightness = Math.max(0.55, Math.min(1, verified ? 0.85 + 0.15 * c : 0.55 + 0.2 * c))
  const rgb = verified ? VERIFIED_RGB : ESTIMATE_RGB
  const color: [number, number, number, number] = [rgb[0] * brightness, rgb[1] * brightness, rgb[2] * brightness, 1]
  return {
    verified,
    dashed,
    brightness,
    color,
    badge: verified ? "verified by camera" : "estimated from GPS",
    badgeColor: verified ? [0.55, 1.0, 0.7, 1] : [1.0, 0.8, 0.4, 1],
    confidence: c
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Building lookup and tag text

export interface OverlayBuilding {
  /** Index into BUILDINGS, or -1 when there is no footprint (Memorial Church, off-map cards, unknown names). */
  index: number
  building: BakedBuilding | null
  landmark: BakedLandmark | null
  /** Real height in metres (footprint height, else the landmark's, else 9). */
  heightM: number
}

/**
 * Finds the footprint for a locator result: landmark id first, then the locator's "b<BUILDINGS index>" ids, then an
 * exact (case-insensitive) OSM / landmark name.
 */
export function overlayBuildingFor(id: string, name = ""): OverlayBuilding {
  const bi = /^b(\d+)$/.exec(id || "")
  if (bi) {
    const i = parseInt(bi[1], 10)
    if (i >= 0 && i < BUILDINGS.length) {
      const lmForB = LANDMARKS.filter((l) => l.building === i)[0] || null
      return {index: i, building: BUILDINGS[i], landmark: lmForB, heightM: BUILDINGS[i][0]}
    }
  }
  const lm = LANDMARKS.filter((l) => l.id === id)[0] || null
  if (lm && lm.building >= 0) return {index: lm.building, building: BUILDINGS[lm.building], landmark: lm, heightM: BUILDINGS[lm.building][0]}
  if (lm) return {index: -1, building: null, landmark: lm, heightM: lm.heightM || 9}
  const want = (name || "").trim().toLowerCase()
  if (want) {
    const byName = LANDMARKS.filter((l) => l.name.toLowerCase() === want || l.osmName.toLowerCase() === want)[0]
    if (byName) return overlayBuildingFor(byName.id)
    for (let i = 0; i < BUILDINGS.length; i++) {
      if (BUILDINGS[i][2] && BUILDINGS[i][2].toLowerCase() === want) return {index: i, building: BUILDINGS[i], landmark: null, heightM: BUILDINGS[i][0]}
    }
  }
  return {index: -1, building: null, landmark: null, heightM: 9}
}

export interface TagText {
  title: string
  /** Namesake line from Cards.ts plus the distance ("Bill Gates, Microsoft co-founder · 120 m"), or just the distance. */
  subtitle: string
  distance: string
}

/** Card label + namesake (never invented: empty when the card has none) + formatted distance. */
export function tagText(id: string, name: string, distanceM: number): TagText {
  const card = cardById(id)
  const title = card ? card.label : name || id
  const distance = formatDistance(Math.max(0, distanceM || 0))
  const namesake = card && card.namesake ? card.namesake : ""
  return {title, subtitle: namesake ? `${namesake} · ${distance}` : distance, distance}
}

// ---------------------------------------------------------------------------------------------------------------
// Footprint / roofline outline at real scale

export interface OutlineOptions {
  /** Tube width in cm. Default 10. */
  widthCm?: number
  /** Break the lines into dashes (estimates). Default false. */
  dashed?: boolean
  /** Dash and gap lengths in real metres. Defaults 2.5 / 1.5. */
  dashM?: number
  gapM?: number
  /** Vertical posts at corners turning at least this much (degrees). 0 disables. Default 45. */
  cornerDeg?: number
  /** Ground ring lift in cm (avoids fighting the floor). Default 5. */
  groundLiftCm?: number
}

export interface FootprintOutline {
  /** Ground ring(s): outer ring and courtyard holes. */
  ground: MeshChunk[]
  /** Roofline at the building's real height. */
  roof: MeshChunk[]
  /** Vertical corner posts from ground to roof. */
  posts: MeshChunk[]
  /** Roof height in cm (real scale). */
  heightCm: number
  /** Footprint vertex centroid in the overlay frame (cm, y = 0). */
  centroid: V3
  /** The ring polylines (closed, first point not repeated) in the overlay frame at y = 0, for scan effects. */
  rings: V3[][]
}

const MAX_CHUNK_VERTS = 64000
const TUBE_VERTS_PER_SEGMENT = 8

/** Packs 2-point tubes into chunks that stay under 64k vertices (UInt16 indices). */
class TubeChunks {
  chunks: MeshChunk[] = []
  private cur: MeshChunk = {verts: [], idx: []}

  constructor(private widthCm: number) {}

  /** One straight segment, extended by half a width at both ends so corners close without central-difference pinching. */
  seg(a: V3, b: V3) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const len = Math.hypot(dx, dy, dz)
    if (len < 1e-6) return
    const e = this.widthCm / 2 / len
    const t = buildTube([{x: a.x - dx * e, y: a.y - dy * e, z: a.z - dz * e}, {x: b.x + dx * e, y: b.y + dy * e, z: b.z + dz * e}], this.widthCm)
    if (this.cur.verts.length / 8 + TUBE_VERTS_PER_SEGMENT > MAX_CHUNK_VERTS) this.flush()
    const base = this.cur.verts.length / 8
    for (const v of t.verts) this.cur.verts.push(v)
    for (const i of t.idx) this.cur.idx.push(base + i)
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

/** Closed polyline as tubes, solid or dashed (dash phase carried round corners). */
function ringTubes(out: TubeChunks, ring: V3[], y: number, dashed: boolean, dashCm: number, gapCm: number) {
  const n = ring.length
  let phase = 0 // distance into the current dash+gap period
  const period = dashCm + gapCm
  for (let k = 0; k < n; k++) {
    const a = ring[k], b = ring[(k + 1) % n]
    const pa = {x: a.x, y, z: a.z}, pb = {x: b.x, y, z: b.z}
    if (!dashed) {
      out.seg(pa, pb)
      continue
    }
    const len = Math.hypot(pb.x - pa.x, pb.z - pa.z)
    let s = 0
    while (s < len - 1e-6) {
      const inDash = phase < dashCm
      const step = Math.min(len - s, inDash ? dashCm - phase : period - phase)
      if (inDash) {
        const t0 = s / len, t1 = (s + step) / len
        out.seg({x: pa.x + (pb.x - pa.x) * t0, y, z: pa.z + (pb.z - pa.z) * t0}, {x: pa.x + (pb.x - pa.x) * t1, y, z: pa.z + (pb.z - pa.z) * t1})
      }
      s += step
      phase = (phase + step) % period
    }
  }
}

/** Splits a baked ring into closed polylines (outer, then holes) in the overlay frame. */
export function footprintRings(b: BakedBuilding, center: EN, cmPerWorldM = 100): V3[][] {
  const [, , , ring, holes] = b
  const nPts = ring.length / 2
  const starts = [0, ...holes, nPts]
  const rings: V3[][] = []
  for (let r = 0; r < starts.length - 1; r++) {
    const pts: V3[] = []
    for (let i = starts[r]; i < starts[r + 1]; i++) {
      pts.push({x: (ring[2 * i] / 10 - center.e) * cmPerWorldM, y: 0, z: -(ring[2 * i + 1] / 10 - center.n) * cmPerWorldM})
    }
    if (pts.length >= 3) rings.push(pts)
  }
  return rings
}

/**
 * Life-size outline of one building: a ground ring and a roofline at its real height (outer ring plus courtyards),
 * plus vertical posts at sharp corners, all as thin tubes. Same east/north -> X/-Z convention as MapMesh, centred
 * on `center` (the wearer's surveyed position, local metres), so it drops straight under RetrospecsMap.worldRoot.
 */
export function footprintOutline(b: BakedBuilding, center: EN, cmPerWorldM = 100, o: OutlineOptions = {}): FootprintOutline {
  const w = o.widthCm === undefined ? 10 : o.widthCm
  const dashed = !!o.dashed
  const dashCm = (o.dashM === undefined ? 2.5 : o.dashM) * cmPerWorldM
  const gapCm = (o.gapM === undefined ? 1.5 : o.gapM) * cmPerWorldM
  const cornerDeg = o.cornerDeg === undefined ? 45 : o.cornerDeg
  const lift = o.groundLiftCm === undefined ? 5 : o.groundLiftCm
  const heightCm = Math.max(1, b[0]) * cmPerWorldM
  const rings = footprintRings(b, center, cmPerWorldM)
  const ground = new TubeChunks(w)
  const roof = new TubeChunks(w)
  const posts = new TubeChunks(w)
  let cx = 0, cz = 0, cn = 0
  rings.forEach((ring, r) => {
    ringTubes(ground, ring, lift, dashed, dashCm, gapCm)
    ringTubes(roof, ring, heightCm, dashed, dashCm, gapCm)
    const n = ring.length
    for (let k = 0; k < n; k++) {
      if (r === 0) {
        cx += ring[k].x
        cz += ring[k].z
        cn++
      }
      if (cornerDeg <= 0) continue
      const p = ring[(k - 1 + n) % n], c = ring[k], q = ring[(k + 1) % n]
      const ax = c.x - p.x, az = c.z - p.z, bx = q.x - c.x, bz = q.z - c.z
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz)
      if (la < 1e-6 || lb < 1e-6) continue
      const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb)))) / DEG
      if (turn < cornerDeg) continue
      if (dashed) {
        // Dashed posts: same rhythm, vertically.
        const period = dashCm + gapCm
        for (let y = lift; y < heightCm; y += period) posts.seg({x: c.x, y, z: c.z}, {x: c.x, y: Math.min(heightCm, y + dashCm), z: c.z})
      } else {
        posts.seg({x: c.x, y: lift, z: c.z}, {x: c.x, y: heightCm, z: c.z})
      }
    }
  })
  return {
    ground: ground.done(),
    roof: roof.done(),
    posts: posts.done(),
    heightCm,
    centroid: {x: cn ? cx / cn : 0, y: 0, z: cn ? cz / cn : 0},
    rings
  }
}

/** A single solid ring (the scanline that sweeps up the building), at y = 0; move its object to animate. */
export function scanRing(rings: V3[][], widthCm: number): MeshChunk[] {
  const out = new TubeChunks(widthCm)
  for (const r of rings) ringTubes(out, r, 0, false, 1, 0)
  return out.done()
}

// ---------------------------------------------------------------------------------------------------------------
// Animation curves

/** Seconds -> {scanY 0..1 (or -1 when the sweep is over), brightness multiplier}. Sweep, then a gentle pulse. */
export function overlayAnimation(t: number, sweepS = 1, pulseHz = 0.6): {scan: number; brightness: number} {
  if (t < sweepS) {
    const u = Math.max(0, t / sweepS)
    // Ease out; the outline fades in behind the scanline.
    const e = 1 - (1 - u) * (1 - u)
    return {scan: e, brightness: 0.35 + 0.65 * e}
  }
  // Pulse between 0.78 and 1.0: never toward black (black is invisible on the additive display).
  const p = 0.5 + 0.5 * Math.cos((t - sweepS) * pulseHz * 2 * Math.PI)
  return {scan: -1, brightness: 0.78 + 0.22 * p}
}

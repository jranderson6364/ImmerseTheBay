/**
 * Bakes central Stanford's OpenStreetMap buildings into a compact TypeScript data module the Lens can load
 * without any OBJ imports or scene wiring.
 *
 *   bun Sightlines/tools/bake-campus.ts            # uses the cached Overpass response if present
 *   bun Sightlines/tools/bake-campus.ts --refresh  # re-downloads from Overpass
 *
 * Output: Sightlines/Assets/Sightlines/Data/CampusData.ts
 *   - origin (Huang Engineering Center), metres-per-degree constants
 *   - every building within RADIUS_M: footprint ring(s) in decimetres east/north of the origin, height,
 *     roof triangles (earcut, holes supported), optional OSM name and start year
 *   - landmark records (matched by OSM name) with their building index and centroid
 *
 * Map data (c) OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright
 */
import earcut from "earcut"
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, "cache", "stanford_osm.json")
const OUT = join(HERE, "..", "Assets", "Sightlines", "Data", "CampusData.ts")

// Origin: Huang Engineering Center (OSM Nominatim, checked Nov 14 2026). The table/judging position is an
// offset from here, set in the Lens.
const ORIGIN = {lat: 37.42793, lon: -122.17447}
const RADIUS_M = 1100
const BBOX = "37.4175,-122.1885,37.4405,-122.1600" // S,W,N,E: covers RADIUS_M around the origin
const M_PER_DEG_LAT = 110574
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180)
const LEVEL_M = 3.6
const DEFAULT_H = 9

/** Landmarks the guide knows. `match` is tested against OSM name tags (case-insensitive). */
const LANDMARKS: {id: string; name: string; match: RegExp; heightM?: number}[] = [
  {id: "huang", name: "Huang Engineering Center", match: /huang engineering/i},
  {id: "gates", name: "Gates Computer Science", match: /gates (computer science|building|hall)|william gates/i},
  {id: "packard", name: "Packard Electrical Engineering", match: /^packard$|packard (electrical|building)|david packard/i},
  {id: "y2e2", name: "Y2E2", match: /y2e2|yang (and|&) yamazaki|environment (and|&) energy/i},
  {id: "shriram", name: "Shriram Center", match: /shriram/i},
  {id: "spilker", name: "Spilker Building", match: /spilker/i},
  {id: "allen", name: "Paul G. Allen Building", match: /paul g\.? allen|allen building/i},
  {id: "hewlett", name: "Hewlett Teaching Center", match: /hewlett teaching/i},
  {id: "hoover", name: "Hoover Tower", match: /hoover tower/i, heightM: 87},
  {id: "mainquad", name: "Main Quad", match: /^main quad$/i},
  {id: "cantor", name: "Cantor Arts Center", match: /cantor/i}
]

/** Landmarks with no separate OSM footprint (Memorial Church sits inside the Main Quad polygon). */
const POINT_LANDMARKS = [{id: "memchu", name: "Memorial Church", lat: 37.42692, lon: -122.17051, heightM: 24}]

type LonLat = [number, number]
interface OsmGeom {lat: number; lon: number}
interface OsmEl {
  type: "way" | "relation"
  id: number
  tags?: Record<string, string>
  geometry?: OsmGeom[]
  members?: {type: string; role: string; geometry?: OsmGeom[]}[]
}

async function loadOsm(refresh: boolean): Promise<{elements: OsmEl[]}> {
  if (!refresh && existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, "utf8"))
  const query = `[out:json][timeout:90];(way["building"](${BBOX});relation["building"](${BBOX}););out geom;`
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "sightlines-campus-bake/0.1", Accept: "application/json"},
    body: "data=" + encodeURIComponent(query)
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const text = await res.text()
  mkdirSync(dirname(CACHE), {recursive: true})
  writeFileSync(CACHE, text)
  return JSON.parse(text)
}

const toLocal = (g: OsmGeom): LonLat => [(g.lon - ORIGIN.lon) * M_PER_DEG_LON, (g.lat - ORIGIN.lat) * M_PER_DEG_LAT]

function cleanRing(ring: LonLat[]): LonLat[] {
  const out: LonLat[] = []
  for (const p of ring) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3) out.push(p)
  }
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.3) out.pop()
  }
  return out
}

function signedArea(r: LonLat[]): number {
  let s = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

/** Joins open way segments of a multipolygon role into closed rings. */
function assembleRings(segments: LonLat[][]): LonLat[][] {
  const rings: LonLat[][] = []
  const pool = segments.map((s) => s.slice())
  const same = (a: LonLat, b: LonLat) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
  while (pool.length) {
    let ring = pool.shift()!
    let grew = true
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i]
        const end = ring[ring.length - 1]
        if (same(end, s[0])) ring = ring.concat(s.slice(1))
        else if (same(end, s[s.length - 1])) ring = ring.concat(s.slice(0, -1).reverse())
        else continue
        pool.splice(i, 1)
        grew = true
        break
      }
    }
    if (ring.length >= 4) rings.push(ring)
  }
  return rings
}

function heightOf(tags: Record<string, string>): number {
  const h = parseFloat((tags.height || "").replace(/[^0-9.]/g, ""))
  if (isFinite(h) && h > 2 && h < 150) return h
  const lv = parseFloat(tags["building:levels"] || "")
  if (isFinite(lv) && lv > 0 && lv < 40) return lv * LEVEL_M + 1
  return DEFAULT_H
}

function yearOf(tags: Record<string, string>): number {
  const m = (tags.start_date || "").match(/(1[89]\d\d|20\d\d)/)
  return m ? parseInt(m[1], 10) : 0
}

interface Building {
  outer: LonLat[]
  holes: LonLat[][]
  h: number
  name: string
  year: number
  osm: string
}

function collect(elements: OsmEl[]): Building[] {
  const out: Building[] = []
  for (const el of elements) {
    const tags = el.tags || {}
    if (tags["building:part"] || tags.building === "roof" || tags.building === "no") continue
    let polys: {outer: LonLat[]; holes: LonLat[][]}[] = []
    if (el.type === "way" && el.geometry) {
      polys = [{outer: el.geometry.map(toLocal), holes: []}]
    } else if (el.type === "relation" && el.members) {
      const outers = assembleRings(el.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry!.map(toLocal)))
      const inners = assembleRings(el.members.filter((m) => m.role === "inner" && m.geometry).map((m) => m.geometry!.map(toLocal)))
      // Attach each inner ring to the outer that contains its first point.
      polys = outers.map((o) => ({outer: o, holes: [] as LonLat[][]}))
      for (const inner of inners) {
        const host = polys.find((p) => pointInRing(inner[0], p.outer))
        if (host) host.holes.push(inner)
      }
    }
    for (const p of polys) {
      const outer = cleanRing(p.outer)
      if (outer.length < 3 || Math.abs(signedArea(outer)) < 12) continue
      const c = centroid(outer)
      if (Math.hypot(c[0], c[1]) > RADIUS_M) continue
      out.push({outer, holes: p.holes.map(cleanRing).filter((r) => r.length >= 3), h: heightOf(tags), name: tags.name || "", year: yearOf(tags), osm: `${el.type}/${el.id}`})
    }
  }
  return out
}

function pointInRing(pt: LonLat, ring: LonLat[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Length-weighted dominant edge bearing, folded into [0, 90). */
function dominantWallBearing(r: LonLat[]): number {
  const bins = new Array(90).fill(0)
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]
    const len = Math.hypot(x2 - x1, y2 - y1)
    const b = (((Math.atan2(x2 - x1, y2 - y1) * 180) / Math.PI) % 90 + 90) % 90
    bins[Math.floor(b) % 90] += len
  }
  let best = 0
  for (let i = 1; i < 90; i++) if (bins[i] > bins[best]) best = i
  // Refine with the weighted mean of edges in the winning bin's neighbourhood.
  let sw = 0, s = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]
    const len = Math.hypot(x2 - x1, y2 - y1)
    let b = (((Math.atan2(x2 - x1, y2 - y1) * 180) / Math.PI) % 90 + 90) % 90
    let d = b - (best + 0.5)
    if (d > 45) b -= 90
    if (d < -45) b += 90
    d = b - (best + 0.5)
    if (Math.abs(d) < 3) {
      sw += len
      s += len * b
    }
  }
  const m = sw > 0 ? s / sw : best + 0.5
  return ((m % 90) + 90) % 90
}

function centroid(r: LonLat[]): LonLat {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]
    const f = x1 * y2 - x2 * y1
    a += f
    cx += (x1 + x2) * f
    cy += (y1 + y2) * f
  }
  if (Math.abs(a) < 1e-9) return r[0]
  return [cx / (3 * a), cy / (3 * a)]
}

async function main() {
  const osm = await loadOsm(process.argv.includes("--refresh"))
  const buildings = collect(osm.elements)

  // Landmark matching: largest named footprint per landmark.
  const landmarkHits = new Map<string, number>()
  buildings.forEach((b, i) => {
    for (const lm of LANDMARKS) {
      if (!b.name || !lm.match.test(b.name)) continue
      const prev = landmarkHits.get(lm.id)
      if (prev === undefined || Math.abs(signedArea(b.outer)) > Math.abs(signedArea(buildings[prev].outer))) landmarkHits.set(lm.id, i)
    }
  })
  for (const lm of LANDMARKS) {
    const i = landmarkHits.get(lm.id)
    if (i !== undefined && lm.heightM) buildings[i].h = lm.heightM
  }

  // Encode: decimetre integers, rings CCW outer / CW holes, earcut roof triangles over [outer, ...holes].
  const dm = (v: number) => Math.round(v * 10)
  let triCount = 0, vertCount = 0
  const rows: string[] = []
  buildings.forEach((b) => {
    const outer = signedArea(b.outer) < 0 ? b.outer.slice().reverse() : b.outer
    const holes = b.holes.map((h) => (signedArea(h) > 0 ? h.slice().reverse() : h))
    const flat: number[] = []
    const holeIdx: number[] = []
    for (const p of outer) flat.push(dm(p[0]), dm(p[1]))
    for (const h of holes) {
      holeIdx.push(flat.length / 2)
      for (const p of h) flat.push(dm(p[0]), dm(p[1]))
    }
    const tri = earcut(flat, holeIdx.length ? holeIdx : undefined, 2)
    triCount += tri.length / 3
    vertCount += flat.length / 2
    rows.push(`[${Math.round(b.h)},${b.year},${JSON.stringify(b.name)},[${flat.join(",")}],[${holeIdx.join(",")}],[${tri.join(",")}]]`)
  })

  const landmarks = LANDMARKS.map((lm) => {
    const i = landmarkHits.get(lm.id)
    if (i === undefined) return null
    const c = centroid(buildings[i].outer)
    const lat = ORIGIN.lat + c[1] / M_PER_DEG_LAT
    const lon = ORIGIN.lon + c[0] / M_PER_DEG_LON
    return `  {id: "${lm.id}", name: ${JSON.stringify(lm.name)}, osmName: ${JSON.stringify(buildings[i].name)}, building: ${i}, east: ${c[0].toFixed(1)}, north: ${c[1].toFixed(1)}, lat: ${lat.toFixed(6)}, lon: ${lon.toFixed(6)}, heightM: ${Math.round(buildings[i].h)}, year: ${buildings[i].year}, wallBearing: ${dominantWallBearing(buildings[i].outer).toFixed(1)}}`
  }).filter(Boolean)
  for (const p of POINT_LANDMARKS) {
    const east = (p.lon - ORIGIN.lon) * M_PER_DEG_LON
    const north = (p.lat - ORIGIN.lat) * M_PER_DEG_LAT
    landmarks.push(`  {id: "${p.id}", name: ${JSON.stringify(p.name)}, osmName: "", building: -1, east: ${east.toFixed(1)}, north: ${north.toFixed(1)}, lat: ${p.lat}, lon: ${p.lon}, heightM: ${p.heightM}, year: 0, wallBearing: 0}`)
  }

  const missing = LANDMARKS.filter((lm) => !landmarkHits.has(lm.id)).map((lm) => lm.id)
  const src = `// GENERATED by Sightlines/tools/bake-campus.ts — do not edit by hand.
// Map data (c) OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
// ${buildings.length} buildings within ${RADIUS_M} m of Huang; ${vertCount} footprint vertices; ${triCount} roof triangles.

export const CAMPUS_ORIGIN = {lat: ${ORIGIN.lat}, lon: ${ORIGIN.lon}}
export const M_PER_DEG_LAT = ${M_PER_DEG_LAT}
export const M_PER_DEG_LON = ${M_PER_DEG_LON.toFixed(3)}
export const CAMPUS_RADIUS_M = ${RADIUS_M}

/** [heightM, startYear (0 = unknown), osmName, ringXY (decimetres east,north), holeStartIndices, roofTriangles] */
export type BakedBuilding = [number, number, string, number[], number[], number[]]

export interface BakedLandmark {
  id: string
  name: string
  osmName: string
  building: number
  east: number
  north: number
  lat: number
  lon: number
  heightM: number
  year: number
  /** Compass bearing (0-90) of the footprint's dominant wall direction; walls run at this bearing + k*90. */
  wallBearing: number
}

export const LANDMARKS: BakedLandmark[] = [
${landmarks.join(",\n")}
]

export const BUILDINGS: BakedBuilding[] = [
${rows.join(",\n")}
]
`
  mkdirSync(dirname(OUT), {recursive: true})
  writeFileSync(OUT, src)
  console.log(`buildings ${buildings.length}, verts ${vertCount}, roof tris ${triCount}, ${(src.length / 1024).toFixed(0)} KB`)
  console.log(`landmarks found: ${landmarks.length}/${LANDMARKS.length}; missing: ${missing.join(", ") || "none"}`)
  for (const lm of LANDMARKS) {
    const i = landmarkHits.get(lm.id)
    if (i !== undefined) console.log(`  ${lm.id.padEnd(8)} <- "${buildings[i].name}" h=${Math.round(buildings[i].h)} year=${buildings[i].year || "?"}`)
  }
  const names = buildings.filter((b) => b.name).map((b) => b.name)
  writeFileSync(join(HERE, "cache", "names.txt"), names.sort().join("\n"))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

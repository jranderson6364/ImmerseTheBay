/**
 * Building locator logic: pure TypeScript (no Lens globals), unit-tested with bun.
 *
 *  - SPOTS / nearestSpot(): snap a GPS fix to a pre-surveyed standing spot.
 *  - chooseWearerPosition(): GPS vs spot vs the fixed survey position (indoor / table mode).
 *  - viewConeCandidates(): buildings and landmarks inside the wearer's view cone, ranked.
 *  - identifySchema() / buildIdentifyPrompt() / parseIdentifyReply(): the Gemini "which building is this?" call.
 *  - acceptDepth(): sanity check for a depth-cache world point against the GPS distance.
 *
 * Frames are the same as Core/Geo.ts: local metres east (e) / north (n) from the campus origin, compass bearings
 * in degrees clockwise from north. BUILDINGS rings are in DECIMETRES (divide by 10).
 */
import {BUILDINGS, BakedBuilding, CAMPUS_RADIUS_M, LANDMARKS} from "../Data/CampusData"
import {EN, angleDiff, bearingDeg, distanceM, enToLatLon, latLonToEN, norm360} from "./Geo"

// ---------------------------------------------------------------------------
// Standing spots

export interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  /** A GPS fix within this many metres snaps to the spot. */
  radiusM: number
  /** Indoor spots are never chosen from GPS; only explicitly (GPS is meaningless in the Huang basement). */
  indoor: boolean
  /** True when the coordinate is an estimate, not read from CampusData or surveyed on site. */
  estimated: boolean
  note: string
}

const lm = (id: string) => LANDMARKS.find((l) => l.id === id)
const huang = lm("huang")
const mainquad = lm("mainquad")
// ESTIMATE: ~8 m outside Huang's north face (the footprint's north edge is at n ~ +37 m), toward the
// Science & Engineering Quad. Replace with a Google Maps long-press of the taped X before the shoot.
const huangOutside = enToLatLon({e: 10, n: 45})
// ESTIMATE: ~12 m south of Gates' south face (footprint n ~ 213 m at its lowest), toward Packard / the Huang path.
const gatesOutside = enToLatLon({e: 85, n: 200})

export const SPOTS: Spot[] = [
  {id: "huang-table", name: "Huang basement table", lat: huang.lat, lon: huang.lon, radiusM: 40, indoor: true, estimated: false, note: "LANDMARKS huang centroid; the basement is directly under it"},
  {id: "huang-outside", name: "Huang exterior", lat: huangOutside.lat, lon: huangOutside.lon, radiusM: 35, indoor: false, estimated: true, note: "estimated point just north of Huang"},
  {id: "gates-outside", name: "Gates exterior", lat: gatesOutside.lat, lon: gatesOutside.lon, radiusM: 30, indoor: false, estimated: true, note: "estimated point just south of Gates (LANDMARKS gates centroid is inside the building)"},
  {id: "mainquad", name: "Main Quad", lat: mainquad.lat, lon: mainquad.lon, radiusM: 60, indoor: false, estimated: false, note: "LANDMARKS mainquad centroid"}
]

export function spotById(id: string): Spot | undefined {
  return SPOTS.find((s) => s.id === id)
}

/** Nearest OUTDOOR spot whose radius contains the fix, or null. */
export function nearestSpot(lat: number, lon: number, spots: Spot[] = SPOTS): {spot: Spot; distanceM: number} | null {
  const p = latLonToEN(lat, lon)
  let best: {spot: Spot; distanceM: number} = null
  for (const s of spots) {
    if (s.indoor) continue
    const d = distanceM(p, latLonToEN(s.lat, s.lon))
    if (d <= s.radiusM && (!best || d < best.distanceM)) best = {spot: s, distanceM: d}
  }
  return best
}

export interface GpsFix {
  lat: number
  lon: number
  /** Horizontal accuracy in metres. */
  accuracyM: number
  /** Milliseconds since epoch, from the fix itself (GeoPosition.timestamp). */
  timestampMs: number
  /** Local clock (Date.now()) when the fix arrived. Age is measured from this when set, to avoid clock skew. */
  receivedMs?: number
}

export interface WearerPosition {
  en: EN
  source: "gps" | "spot" | "survey"
  spotId: string
  reason: string
}

export interface WearerOptions {
  /** Worse accuracy than this means indoor / table mode. */
  maxAccuracyM?: number
  /** A fix older than this is ignored. */
  maxAgeS?: number
  nowMs: number
  /** Explicitly chosen spot ("" = auto). An indoor spot forces the survey position. */
  forcedSpotId?: string
}

export function chooseWearerPosition(fix: GpsFix | null, survey: EN, o: WearerOptions): WearerPosition {
  const maxAcc = o.maxAccuracyM == null ? 25 : o.maxAccuracyM
  const maxAge = o.maxAgeS == null ? 15 : o.maxAgeS
  const forced = o.forcedSpotId ? spotById(o.forcedSpotId) : undefined
  if (forced && forced.indoor) return {en: survey, source: "survey", spotId: forced.id, reason: `indoor spot ${forced.name}: GPS ignored, using survey position`}
  if (forced) return {en: latLonToEN(forced.lat, forced.lon), source: "spot", spotId: forced.id, reason: `forced spot ${forced.name}`}
  if (!fix) return {en: survey, source: "survey", spotId: "", reason: "no GPS fix yet: using survey position"}
  const ageS = (o.nowMs - (fix.receivedMs == null ? fix.timestampMs : fix.receivedMs)) / 1000
  if (ageS > maxAge) return {en: survey, source: "survey", spotId: "", reason: `GPS fix is ${ageS.toFixed(0)} s old: using survey position`}
  if (!(fix.accuracyM <= maxAcc)) return {en: survey, source: "survey", spotId: "", reason: `GPS accuracy ${Math.round(fix.accuracyM)} m > ${maxAcc} m: indoor/table mode, using survey position`}
  const fixEN = latLonToEN(fix.lat, fix.lon)
  const offM = Math.hypot(fixEN.e, fixEN.n)
  if (offM > CAMPUS_RADIUS_M) return {en: survey, source: "survey", spotId: "", reason: `GPS fix is ${(offM / 1000).toFixed(1)} km from campus (outside the ${CAMPUS_RADIUS_M} m map): using survey position`}
  const s = nearestSpot(fix.lat, fix.lon)
  if (s) return {en: latLonToEN(s.spot.lat, s.spot.lon), source: "spot", spotId: s.spot.id, reason: `GPS ±${Math.round(fix.accuracyM)} m snapped to ${s.spot.name} (${Math.round(s.distanceM)} m away)`}
  return {en: latLonToEN(fix.lat, fix.lon), source: "gps", spotId: "", reason: `GPS ±${Math.round(fix.accuracyM)} m`}
}

// ---------------------------------------------------------------------------
// Footprint geometry

/** Outer ring and holes of a baked building, in local metres. */
export function footprintRings(b: BakedBuilding): EN[][] {
  const ring = b[3]
  const n = ring.length / 2
  const starts = [0, ...b[4], n]
  const rings: EN[][] = []
  for (let r = 0; r + 1 < starts.length; r++) {
    const pts: EN[] = []
    for (let i = starts[r]; i < starts[r + 1]; i++) pts.push({e: ring[2 * i] / 10, n: ring[2 * i + 1] / 10})
    if (pts.length >= 3) rings.push(pts)
  }
  return rings
}

function inRing(p: EN, ring: EN[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.n > p.n !== b.n > p.n && p.e < ((b.e - a.e) * (p.n - a.n)) / (b.n - a.n) + a.e) inside = !inside
  }
  return inside
}

/** Inside the outer ring and not inside any hole (a courtyard counts as outside). */
export function insideFootprint(p: EN, rings: EN[][]): boolean {
  if (!rings.length || !inRing(p, rings[0])) return false
  for (let i = 1; i < rings.length; i++) if (inRing(p, rings[i])) return false
  return true
}

/** Closest point to p on any edge of any ring. */
export function nearestPointOnRings(p: EN, rings: EN[][]): EN {
  let best: EN = rings[0][0]
  let bestD = 1e18
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      const dx = b.e - a.e
      const dy = b.n - a.n
      const len2 = dx * dx + dy * dy
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.e - a.e) * dx + (p.n - a.n) * dy) / len2)) : 0
      const q = {e: a.e + t * dx, n: a.n + t * dy}
      const d = (q.e - p.e) ** 2 + (q.n - p.n) ** 2
      if (d < bestD) {
        bestD = d
        best = q
      }
    }
  }
  return best
}

/** First point where a ray from p along `bearing` hits any ring edge, or null. */
export function rayHitRings(p: EN, bearing: number, rings: EN[][]): EN | null {
  const de = Math.sin((bearing * Math.PI) / 180)
  const dn = Math.cos((bearing * Math.PI) / 180)
  let bestT = Infinity
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      const se = b.e - a.e
      const sn = b.n - a.n
      const den = de * sn - dn * se
      if (Math.abs(den) < 1e-12) continue
      const t = ((a.e - p.e) * sn - (a.n - p.n) * se) / den
      const u = ((a.e - p.e) * dn - (a.n - p.n) * de) / den
      if (t > 0 && u >= 0 && u <= 1 && t < bestT) bestT = t
    }
  }
  return bestT < Infinity ? {e: p.e + de * bestT, n: p.n + dn * bestT} : null
}

/**
 * Smallest angular offset between `heading` and the footprint as seen from p: 0 when the heading falls inside the
 * footprint's bearing span, else the offset to the nearest vertex bearing.
 */
export function angularOffset(p: EN, heading: number, rings: EN[][]): number {
  let lo = Infinity
  let hi = -Infinity
  let minAbs = Infinity
  for (const v of rings[0]) {
    const d = angleDiff(bearingDeg(p, v), heading)
    lo = Math.min(lo, d)
    hi = Math.max(hi, d)
    minAbs = Math.min(minAbs, Math.abs(d))
  }
  // Seen from outside, a footprint spans < 180 deg, so a span crossing 0 (and not wrapping at +/-180) contains the heading.
  if (lo <= 0 && hi >= 0 && hi - lo < 180) return 0
  return minAbs
}

// ---------------------------------------------------------------------------
// View cone

export interface Candidate {
  /** LANDMARKS id when the building is a landmark, else "b<index>". */
  id: string
  name: string
  /** Index into BUILDINGS, or -1 for a point-only landmark (Memorial Church). */
  building: number
  landmark: boolean
  /** Compass bearing from the wearer to the aim point. */
  bearingDeg: number
  /** Metres from the wearer to the aim point. */
  distanceM: number
  /** Degrees between the heading and the footprint (0 = the gaze ray is on it). */
  offsetDeg: number
  /** Closest footprint point to the wearer. */
  nearest: EN
  /** Where the gaze ray hits the footprint, or null if it misses. */
  hit: EN | null
  /** The point overlays should anchor to: `hit` if any, else `nearest`. */
  aim: EN
  centroid: EN
  heightM: number
  /** Outer ring + holes in metres (empty for point-only landmarks). */
  rings: EN[][]
  score: number
}

export interface ConeOptions {
  halfAngleDeg?: number
  maxDistM?: number
  /** Skip anything nearer than this. Containment already drops the building you're in; keep this small. */
  minDistM?: number
  limit?: number
  /** Include buildings with no OSM name. They can't be named for Gemini, so the default is false. */
  includeUnnamed?: boolean
  /** Degrees of ranking penalty per 100 m. */
  degPer100m?: number
  /** Always keep in-cone LANDMARKS (e.g. Hoover far away) before filling the list with other buildings. Default true. */
  reserveLandmarks?: boolean
}

interface Source {
  id: string
  name: string
  building: number
  landmark: boolean
  rings: EN[][]
  centroid: EN
  heightM: number
}

let sourcesCache: Source[] = null

function sources(): Source[] {
  if (sourcesCache) return sourcesCache
  const byBuilding: Record<number, (typeof LANDMARKS)[number]> = {}
  for (const l of LANDMARKS) if (l.building >= 0) byBuilding[l.building] = l
  const out: Source[] = []
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i]
    const rings = footprintRings(b)
    if (!rings.length) continue
    const l = byBuilding[i]
    let ce = 0
    let cn = 0
    for (const v of rings[0]) {
      ce += v.e
      cn += v.n
    }
    const centroid = l ? {e: l.east, n: l.north} : {e: ce / rings[0].length, n: cn / rings[0].length}
    out.push({id: l ? l.id : "b" + i, name: l ? l.name : b[2], building: i, landmark: !!l, rings, centroid, heightM: l ? l.heightM : b[0]})
  }
  for (const l of LANDMARKS) {
    if (l.building < 0) out.push({id: l.id, name: l.name, building: -1, landmark: true, rings: [], centroid: {e: l.east, n: l.north}, heightM: l.heightM})
  }
  sourcesCache = out
  return out
}

/** All locatable things (landmarks first by id lookup). */
export function candidateById(id: string): Source | undefined {
  return sources().find((s) => s.id === id)
}

/**
 * Buildings and landmarks inside the view cone, ranked by offsetDeg + distance penalty (nearest-to-gaze first).
 * Anything containing the wearer, or within minDistM, is skipped.
 */
export function viewConeCandidates(me: EN, headingDeg: number, o: ConeOptions = {}): Candidate[] {
  const half = o.halfAngleDeg == null ? 30 : o.halfAngleDeg
  const maxD = o.maxDistM == null ? 700 : o.maxDistM
  const minD = o.minDistM == null ? 5 : o.minDistM
  const limit = o.limit == null ? 10 : o.limit
  const per100 = o.degPer100m == null ? 1 : o.degPer100m
  const heading = norm360(headingDeg)
  const out: Candidate[] = []
  for (const s of sources()) {
    if (!s.landmark && !o.includeUnnamed && !s.name) continue
    let nearest: EN
    let hit: EN | null = null
    let offset: number
    if (s.rings.length) {
      if (insideFootprint(me, s.rings)) continue
      nearest = nearestPointOnRings(me, s.rings)
      offset = angularOffset(me, heading, s.rings)
      if (offset === 0) hit = rayHitRings(me, heading, s.rings)
    } else {
      nearest = s.centroid
      offset = Math.abs(angleDiff(bearingDeg(me, s.centroid), heading))
    }
    const nearD = distanceM(me, nearest)
    if (nearD < minD || nearD > maxD || offset > half) continue
    const aim = hit || nearest
    const d = distanceM(me, aim)
    out.push({
      id: s.id, name: s.name || s.id, building: s.building, landmark: s.landmark,
      bearingDeg: bearingDeg(me, aim), distanceM: d, offsetDeg: offset, nearest, hit, aim,
      centroid: s.centroid, heightM: s.heightM, rings: s.rings, score: offset + (nearD / 100) * per100
    })
  }
  out.sort((a, b) => a.score - b.score)
  if (o.reserveLandmarks === false || out.length <= limit) return out.slice(0, limit)
  const keep = out.filter((c) => c.landmark).slice(0, limit)
  for (const c of out) {
    if (keep.length >= limit) break
    if (!c.landmark) keep.push(c)
  }
  return keep.sort((a, b) => a.score - b.score)
}

/** Aim point on a candidate's footprint along a specific bearing (e.g. Gemini's pixel), else its usual aim. */
export function aimAlongBearing(me: EN, c: Candidate, bearing: number): EN {
  if (!c.rings.length) return c.centroid
  return rayHitRings(me, bearing, c.rings) || c.aim
}

/** The "estimated" fallback: the top-ranked candidate if it is within maxOffsetDeg of the gaze. */
export function fallbackCandidate(cands: Candidate[], maxOffsetDeg = 10): Candidate | null {
  const top = cands[0]
  return top && top.offsetDeg <= maxOffsetDeg ? top : null
}

// ---------------------------------------------------------------------------
// Gemini

export const IDENTIFY_SYSTEM_PROMPT = `You identify Stanford University buildings in a photo taken by AR glasses.
You get the photo and a list of candidate buildings that lie in the wearer's view, with each one's compass bearing
and distance from the wearer. Choose the ONE candidate building that is most prominent near the centre of the photo.
Only answer with an id from the list. If none of the candidates is clearly visible, answer "none".
confidence is 0 to 1. pixelX and pixelY mark a point on that building's facade, on a 0-1000 scale
(0,0 = top-left of the image, 1000,1000 = bottom-right).`

export function buildIdentifyPrompt(cands: Candidate[], headingDeg: number): string {
  const lines = cands.map((c) => `- ${c.id}: ${c.name} (bearing ${Math.round(c.bearingDeg)}°, ${Math.round(c.distanceM)} m, ${Math.round(c.offsetDeg)}° from centre)`)
  return `The wearer is facing compass bearing ${Math.round(norm360(headingDeg))}°. Candidates:\n${lines.join("\n")}\nWhich candidate is in the centre of the photo?`
}

export function identifySchema(candidateIds: string[]): any {
  return {
    type: "object",
    properties: {
      buildingId: {type: "string", enum: [...candidateIds, "none"], description: "Candidate id, or none."},
      confidence: {type: "number", description: "0 to 1."},
      pixelX: {type: "number", description: "0-1000, left to right."},
      pixelY: {type: "number", description: "0-1000, top to bottom."}
    },
    required: ["buildingId", "confidence"]
  }
}

export type IdentifyReply =
  | {ok: true; buildingId: string; confidence: number; pixel: {x: number; y: number} | null}
  | {ok: false; reason: string}

/** Parses and validates Gemini's reply (a JSON string, possibly code-fenced, or an object). */
export function parseIdentifyReply(raw: unknown, candidateIds: string[]): IdentifyReply {
  let o: any = raw
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim())
    } catch (e) {
      return {ok: false, reason: "not JSON"}
    }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return {ok: false, reason: "not an object"}
  const id = o.buildingId
  if (typeof id !== "string") return {ok: false, reason: "buildingId missing"}
  if (id !== "none" && candidateIds.indexOf(id) < 0) return {ok: false, reason: `buildingId "${id}" is not a candidate`}
  const conf = o.confidence
  if (typeof conf !== "number" || !isFinite(conf) || conf < 0 || conf > 1) return {ok: false, reason: "confidence must be a number in [0, 1]"}
  const hasX = o.pixelX !== undefined && o.pixelX !== null
  const hasY = o.pixelY !== undefined && o.pixelY !== null
  if (hasX !== hasY) return {ok: false, reason: "pixelX and pixelY must come together"}
  let pixel: {x: number; y: number} | null = null
  if (hasX) {
    const x = o.pixelX
    const y = o.pixelY
    if (typeof x !== "number" || typeof y !== "number" || !isFinite(x) || !isFinite(y) || x < 0 || x > 1000 || y < 0 || y > 1000) {
      return {ok: false, reason: "pixelX/pixelY must be numbers in [0, 1000]"}
    }
    pixel = {x, y}
  }
  return {ok: true, buildingId: id, confidence: conf, pixel: id === "none" ? null : pixel}
}

// ---------------------------------------------------------------------------
// Depth refinement

export interface DepthCheck {
  ok: boolean
  reason: string
}

/**
 * Accepts a depth-cache point only if it is a real distance (the cache returns a point at the device when it has
 * no valid depth) and agrees with the GPS distance to the footprint within tolerance.
 */
export function acceptDepth(depthHorizM: number, expectedM: number, minM = 2, tolFrac = 0.35, tolAbsM = 8): DepthCheck {
  if (!isFinite(depthHorizM)) return {ok: false, reason: "no depth"}
  if (depthHorizM < minM) return {ok: false, reason: `depth ${depthHorizM.toFixed(1)} m is below ${minM} m (no valid depth)`}
  const tol = Math.max(tolAbsM, expectedM * tolFrac)
  const err = Math.abs(depthHorizM - expectedM)
  if (err > tol) return {ok: false, reason: `depth ${depthHorizM.toFixed(1)} m vs GPS ${expectedM.toFixed(1)} m (tolerance ${tol.toFixed(1)} m)`}
  return {ok: true, reason: `depth ${depthHorizM.toFixed(1)} m agrees with GPS ${expectedM.toFixed(1)} m`}
}

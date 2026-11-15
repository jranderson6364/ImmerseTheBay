/**
 * OSM highway tag classification for the Retrospecs path bake (tools/bake-paths.ts). Pure, unit-tested.
 *
 * Kind codes are stored in Data/PathsData.ts and read by Core/MapMesh.ts buildPathRibbons():
 *   0 road, 1 bike path, 2 foot path, 3 road with a painted bike lane (drawn as a road plus a dashed bike stripe).
 */
export const KIND_ROAD = 0
export const KIND_BIKE = 1
export const KIND_FOOT = 2
export const KIND_ROAD_BIKELANE = 3

const ROAD = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "service",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link"
])
const FOOT = new Set(["footway", "pedestrian", "path", "track", "bridleway"])
/** service=* values that are mostly parking-lot clutter at map scale. */
const MINOR_SERVICE = new Set(["parking_aisle", "driveway", "drive-through", "emergency_access"])
const BIKE_LANE_VALUES = new Set(["lane", "track", "shared_lane", "opposite_lane", "opposite_track", "share_busway"])
// cycleway:*=separate means the lane is mapped as its own highway=cycleway way, so the road gets no stripe.
const BIKE_LANE_KEYS = ["cycleway", "cycleway:both", "cycleway:left", "cycleway:right"]

export interface ClassifyOptions {
  /** Drop service roads tagged as parking aisles / driveways. Default true. */
  dropMinorService?: boolean
}

/** Returns a kind code, or -1 if the way is not drawn. */
export function classifyWay(tags: Record<string, string>, opts: ClassifyOptions = {}): number {
  const hw = tags.highway
  if (!hw) return -1
  if (tags.area === "yes" || tags.indoor === "yes" || tags.indoor === "corridor") return -1
  if (tags.access === "no" && !tags.bicycle && !tags.foot) return -1
  if (hw === "cycleway") return KIND_BIKE
  const bikeOk = tags.bicycle === "designated" || tags.bicycle === "yes"
  if (FOOT.has(hw)) {
    return bikeOk ? KIND_BIKE : KIND_FOOT
  }
  if (ROAD.has(hw)) {
    if (hw === "service" && (opts.dropMinorService !== false) && MINOR_SERVICE.has(tags.service || "")) return -1
    for (const k of BIKE_LANE_KEYS) if (BIKE_LANE_VALUES.has(tags[k] || "")) return KIND_ROAD_BIKELANE
    return KIND_ROAD
  }
  return -1
}

type XY = [number, number]

/** Douglas-Peucker polyline simplification (tolerance in the same units as the points). Keeps both ends. */
export function simplifyDP(pts: XY[], tol: number): XY[] {
  if (pts.length <= 2) return pts.slice()
  const keep = new Array(pts.length).fill(false)
  keep[0] = keep[pts.length - 1] = true
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = pts[a], [bx, by] = pts[b]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    let best = -1, bestD = tol
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]
      let d: number
      if (len2 < 1e-12) d = Math.hypot(px - ax, py - ay)
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      }
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) {
      keep[best] = true
      stack.push([a, best], [best, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

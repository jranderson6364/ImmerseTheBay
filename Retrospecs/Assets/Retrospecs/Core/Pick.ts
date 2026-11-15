/**
 * Building picking, on the tabletop map and out in the real world.
 *
 * The old pick scored `distance - circumscribed radius`, so a huge, irregular footprint (Main Quad) won anywhere
 * inside its big circle, even with the cursor right on Hoover Tower. Here every landmark is tested against its real
 * outer ring: if the point falls inside one or more footprints the smallest one wins (the specific beats the
 * sprawling); otherwise the nearest footprint EDGE within a slack wins.
 *
 * In the world, the same idea works on bearings: each landmark covers an arc of the horizon as seen from the wearer.
 * If the view direction is inside one or more arcs, the nearest building wins (it is in front); otherwise the
 * smallest angular miss within a tolerance wins.
 */
import {EN, angleDiff, bearingDeg, distanceM} from "./Geo"

export interface XZ {
  x: number
  z: number
}

/** Outer ring of a baked building as EN metres (ringXY is decimetres east/north; holes start at point indices). */
export function outerRingEN(ringXY: number[], holeStarts: number[]): EN[] {
  const nPts = Math.floor(ringXY.length / 2)
  const end = holeStarts && holeStarts.length ? Math.min(holeStarts[0], nPts) : nPts
  const out: EN[] = []
  for (let i = 0; i < end; i++) out.push({e: ringXY[2 * i] / 10, n: ringXY[2 * i + 1] / 10})
  return out
}

export function pointInPolygon(p: XZ, poly: XZ[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export function polygonArea(poly: XZ[]): number {
  let s = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j].x + poly[i].x) * (poly[j].z - poly[i].z)
  return Math.abs(s) / 2
}

/** Distance from p to the polygon's boundary (0 on an edge). */
export function distanceToPolygonEdge(p: XZ, poly: XZ[]): number {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]
    const b = poly[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)))
  }
  return best
}

export interface MapPickCandidate {
  id: string
  /** Centre on the map (cm). */
  center: XZ
  /** Footprint outline on the map (cm). Empty for point landmarks / edge pins: those use `radius`. */
  poly: XZ[]
  /** Fallback radius (cm) when there is no polygon, or a grown radius for the focused building. */
  radius: number
  /** Centerpiece: when the point is inside it and an ordinary landmark at once, the centerpiece wins. */
  priority?: boolean
}

/**
 * Landmark under a map-local point (cm). Inside a footprint: smallest footprint wins. Otherwise the nearest edge
 * within `slackCm`. Point landmarks are discs of `radius`.
 */
export function pickOnMap(p: XZ, cands: MapPickCandidate[], slackCm = 2): string | null {
  let insideId: string = null
  let insideArea = Infinity
  let insidePriority = false
  let nearId: string = null
  let nearGap = slackCm
  for (const c of cands) {
    let inside: boolean
    let gap: number
    let area: number
    if (c.poly && c.poly.length >= 3) {
      inside = pointInPolygon(p, c.poly)
      gap = inside ? 0 : distanceToPolygonEdge(p, c.poly)
      area = polygonArea(c.poly)
      // A grown (focused) building keeps a disc of its focus radius as a target too.
      if (!inside && c.radius > 0) {
        const dg = Math.hypot(p.x - c.center.x, p.z - c.center.z) - c.radius
        if (dg <= 0) inside = true
        gap = Math.min(gap, Math.max(0, dg))
      }
    } else {
      const d = Math.hypot(p.x - c.center.x, p.z - c.center.z)
      inside = d <= c.radius
      gap = Math.max(0, d - c.radius)
      area = Math.PI * c.radius * c.radius
    }
    if (inside) {
      const pri = !!c.priority
      // Priority first (a centerpiece beats an ordinary landmark), then the smallest footprint.
      if ((pri && !insidePriority) || (pri === insidePriority && area < insideArea)) {
        insideArea = area
        insideId = c.id
        insidePriority = pri
      }
    } else if (gap < nearGap) {
      nearGap = gap
      nearId = c.id
    }
  }
  return insideId || nearId
}

export interface ColumnPickCandidate extends MapPickCandidate {
  /** Current roof height on the map (cm above the map surface). */
  topCm: number
}

/**
 * Landmark the wearer is pointing at on the map, following the ray through the buildings' heights: aiming at the
 * shaft of a tall tower (Hoover) used to land on the floor well behind it, because only the floor hit was tested.
 * Walks the ray from the tallest roof down to the floor; the first footprint (or pad) the ray is inside, among
 * buildings at least that tall, wins (it is the nearest thing along the ray). Otherwise the floor pick with slack.
 * `eye` and `hit` are map-local (cm); `hit` is where the ray meets the map surface.
 */
export function pickAlongRay(eye: {x: number; y: number; z: number}, hit: {x: number; y: number; z: number}, cands: ColumnPickCandidate[], slackCm = 2, steps = 40): string | null {
  const floor = {x: hit.x, z: hit.z}
  const dy = hit.y - eye.y
  if (!(dy < -1e-4) || !cands.length) return pickOnMap(floor, cands, slackCm)
  let maxTop = 0
  for (const c of cands) maxTop = Math.max(maxTop, c.topCm)
  const t0 = Math.max(0, (maxTop - eye.y) / dy)
  const t1 = Math.max(t0, (Math.min(hit.y, 0) - eye.y) / dy)
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps
    const x = eye.x + (hit.x - eye.x) * t
    const y = eye.y + dy * t
    const z = eye.z + (hit.z - eye.z) * t
    const tall = cands.filter((c) => c.topCm >= y)
    if (!tall.length) continue
    const id = pickOnMap({x, z}, tall, 0)
    if (id) return id
  }
  return pickOnMap(floor, cands, slackCm)
}

export interface WorldPickCandidate {
  id: string
  /** Landmark centre (EN metres). */
  en: EN
  /** Footprint outline (EN metres). Empty for point landmarks: those use `radiusM`. */
  ring: EN[]
  /** Radius (m) used when there is no ring. */
  radiusM: number
  /** Roof height (m). Looking above a near building's roof sees past it (Hoover Tower behind the Quad). */
  heightM: number
  /** Extra radius (m) that widens the arc, for landmarks that are hard to aim at (Hoover Tower). */
  padM?: number
}

export interface BearingArc {
  /** Centre bearing of the arc (deg). */
  center: number
  /** Half-width of the arc (deg). */
  half: number
  distM: number
}

/** The arc of horizon a building covers, seen from `me`. */
export function bearingArc(me: EN, c: WorldPickCandidate): BearingArc {
  const distM = distanceM(me, c.en)
  const centre = bearingDeg(me, c.en)
  let half: number
  if (c.ring && c.ring.length >= 3) {
    half = 0
    for (const v of c.ring) half = Math.max(half, Math.abs(angleDiff(bearingDeg(me, v), centre)))
  } else {
    half = (Math.atan2(c.radiusM, Math.max(1, distM)) * 180) / Math.PI
  }
  if (c.padM && c.padM > 0) half = Math.max(half, (Math.atan2(c.padM, Math.max(1, distM)) * 180) / Math.PI)
  // Never thinner than 2 degrees (a far tower is still aimable) and never a full circle.
  return {center: centre, half: Math.max(2, Math.min(80, half)), distM}
}

/**
 * Which real building is the wearer facing? Inside one or more arcs: the nearest one whose roof is above the
 * view ray wins (looking up past the Quad's roofline finds Hoover Tower). Otherwise the smallest miss within
 * `toleranceDeg`. `viewPitchDeg` is the gaze elevation (+ up); `eyeM` the eye height above the ground. Buildings closer than `minDistM` (you're standing in or against them) and farther than
 * `maxDistM` are skipped.
 */
export function pickByBearing(me: EN, viewBearing: number, cands: WorldPickCandidate[], viewPitchDeg = 0, toleranceDeg = 6, minDistM = 15, maxDistM = 1500, eyeM = 1.6): string | null {
  let insideId: string = null
  let insideDist = Infinity
  let nearId: string = null
  let nearMiss = toleranceDeg
  for (const c of cands) {
    const arc = bearingArc(me, c)
    if (arc.distM < minDistM || arc.distM > maxDistM) continue
    const off = Math.abs(angleDiff(viewBearing, arc.center))
    // Ray passes over this roof: it is not what you're looking at (unless nothing else is there).
    const roofPitch = (Math.atan2(Math.max(0, c.heightM) - eyeM, arc.distM) * 180) / Math.PI
    const over = viewPitchDeg > roofPitch + 1
    if (off <= arc.half && !over) {
      if (arc.distM < insideDist) {
        insideDist = arc.distM
        insideId = c.id
      }
    } else if (off - arc.half < nearMiss) {
      nearMiss = off - arc.half
      nearId = c.id
    }
  }
  return insideId || nearId
}

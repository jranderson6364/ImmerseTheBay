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
}

/**
 * Landmark under a map-local point (cm). Inside a footprint: smallest footprint wins. Otherwise the nearest edge
 * within `slackCm`. Point landmarks are discs of `radius`.
 */
export function pickOnMap(p: XZ, cands: MapPickCandidate[], slackCm = 2): string | null {
  let insideId: string = null
  let insideArea = Infinity
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
      if (area < insideArea) {
        insideArea = area
        insideId = c.id
      }
    } else if (gap < nearGap) {
      nearGap = gap
      nearId = c.id
    }
  }
  return insideId || nearId
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

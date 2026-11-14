/**
 * Pure geometry for Sightlines (no Lens globals, unit-tested with bun).
 *
 * Frames:
 *  - Local metres: east (e), north (n) from the campus origin (Huang).
 *  - Map frame (Lens, centimetres, the MapRoot's local space): X = east, Y = up, Z = -north.
 *  - Compass bearing: degrees clockwise from north. Bearing b in the map frame is (sin b, 0, -cos b).
 *  - Lens world: Y up. A horizontal world direction's yaw = atan2(x, z) (radians), matching quat.angleAxis about +Y.
 */
import {CAMPUS_ORIGIN, M_PER_DEG_LAT, M_PER_DEG_LON} from "../Data/CampusData"

export interface V3 {x: number; y: number; z: number}
export interface EN {e: number; n: number}

export const DEG = Math.PI / 180

export function latLonToEN(lat: number, lon: number): EN {
  return {e: (lon - CAMPUS_ORIGIN.lon) * M_PER_DEG_LON, n: (lat - CAMPUS_ORIGIN.lat) * M_PER_DEG_LAT}
}

export function enToLatLon(p: EN): {lat: number; lon: number} {
  return {lat: CAMPUS_ORIGIN.lat + p.n / M_PER_DEG_LAT, lon: CAMPUS_ORIGIN.lon + p.e / M_PER_DEG_LON}
}

/** Compass bearing in degrees [0, 360) from a to b. */
export function bearingDeg(a: EN, b: EN): number {
  return norm360(Math.atan2(b.e - a.e, b.n - a.n) / DEG)
}

export function distanceM(a: EN, b: EN): number {
  return Math.hypot(b.e - a.e, b.n - a.n)
}

export function norm360(d: number): number {
  return ((d % 360) + 360) % 360
}

/** Signed smallest difference a - b in degrees, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = norm360(a - b)
  if (d > 180) d -= 360
  return d
}

/** Direction of a compass bearing expressed in the map frame (unit, horizontal). */
export function bearingToMapDir(bearing: number): V3 {
  return {x: Math.sin(bearing * DEG), y: 0, z: -Math.cos(bearing * DEG)}
}

/** Yaw (radians) of a horizontal vector, as used by quat.angleAxis(yaw, up). */
export function yawOf(v: V3): number {
  return Math.atan2(v.x, v.z)
}

/**
 * Yaw (radians) to apply to the MapRoot so that map bearing `facingBearing` lines up with the world direction
 * `facingWorld` (the direction the wearer faced during calibration).
 */
export function mapYawFor(facingWorld: V3, facingBearing: number): number {
  return yawOf(facingWorld) - yawOf(bearingToMapDir(facingBearing))
}

/** Compass bearing of a world-space horizontal direction, given the map yaw from calibration. */
export function worldDirToBearing(dirWorld: V3, mapYaw: number): number {
  // Undo the map rotation: the world yaw minus mapYaw is the yaw in the map frame.
  const y = yawOf(dirWorld) - mapYaw
  const local = {x: Math.sin(y), y: 0, z: Math.cos(y)}
  return norm360(Math.atan2(local.x, -local.z) / DEG)
}

/**
 * Facing direction from two pinches along a wall, made while facing it: first the LEFT point, then the RIGHT.
 * Returns the horizontal unit direction into the wall (up × (right - left)), or null if the points are too close.
 */
export function facingFromWallPinches(left: V3, right: V3, minSeparationCm = 25): V3 | null {
  const dx = right.x - left.x
  const dz = right.z - left.z
  const len = Math.hypot(dx, dz)
  if (len < minSeparationCm) return null
  // up (0,1,0) × d(dx,0,dz) = (1*dz - 0, 0, 0 - 1*dx) = (dz, 0, -dx)
  return {x: dz / len, y: 0, z: -dx / len}
}

/**
 * A rectilinear building's walls run at wallBearing + k*90. Choose the face bearing (the direction the wearer looks
 * when facing the wall) closest to a hint: the compass heading if available, else the configured value.
 */
export function snapFacingBearing(wallBearing: number, hint: number): number {
  let best = norm360(wallBearing)
  let bestErr = 999
  for (let k = 0; k < 4; k++) {
    const c = norm360(wallBearing + k * 90)
    const err = Math.abs(angleDiff(c, hint))
    if (err < bestErr) {
      best = c
      bestErr = err
    }
  }
  return best
}

/** Map-frame position (cm) of a local metre point, given the wearer's own position and the map scale. */
export function enToMap(p: EN, center: EN, cmPerM: number): V3 {
  return {x: (p.e - center.e) * cmPerM, y: 0, z: -(p.n - center.n) * cmPerM}
}

export function compassWord(bearing: number): string {
  const words = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]
  return words[Math.round(norm360(bearing) / 45) % 8]
}

export function formatDistance(m: number): string {
  if (m < 950) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1)} km`
}

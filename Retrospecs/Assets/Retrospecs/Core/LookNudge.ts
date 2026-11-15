/**
 * Look-around nudge. Spectacles show only a narrow window of the world, so content placed off to the sides (the 3D
 * experience, diagram loops, the people screen) or down below (the map) is easy to miss. This decides when to show
 * a head-locked arrow at the edge of the view and which way it points. Pure, so it's unit-tested.
 *
 * Angles are offsets from the gaze in degrees: yaw + = right, pitch + = up.
 */

export interface NudgeTarget {
  id: string
  yawDeg: number
  pitchDeg: number
}

export const NUDGE = {
  /** Half the comfortable view: a target inside this box counts as "in view". */
  viewHalfYawDeg: 14,
  viewHalfPitchDeg: 11,
  /** Looking at a target this long marks it seen; it's not pointed at again until the nudge is reset. */
  seenDwellSec: 0.5,
  /** Wait after a reset before the first arrow (let the wearer read the card first). */
  firstDelaySec: 3,
  /** Pause after a target is found before pointing at the next. */
  betweenSec: 1.5,
  /** Map nudge (tour mode, no card open): arrow toward the map once it has been out of view this long. */
  mapAwaySec: 7
}

export interface NudgeState {
  seen: Record<string, true>
  dwell: Record<string, number>
  /** Time since reset. */
  t: number
  /** Time since the last target was marked seen (Infinity until one is). */
  sinceSeen: number
  /** Target the arrow currently points at, kept until found so the arrow doesn't flip between sides. */
  current: string | null
}

export function newNudgeState(): NudgeState {
  return {seen: {}, dwell: {}, t: 0, sinceSeen: Infinity, current: null}
}

export function inView(t: NudgeTarget): boolean {
  return Math.abs(t.yawDeg) <= NUDGE.viewHalfYawDeg && Math.abs(t.pitchDeg) <= NUDGE.viewHalfPitchDeg
}

export interface NudgeOutput {
  show: boolean
  targetId: string | null
  /** Direction on the view plane (radians, 0 = right, pi/2 = up), meaningful when show is true. */
  angleRad: number
}

const HIDDEN: NudgeOutput = {show: false, targetId: null, angleRad: 0}

/**
 * One frame of the focus-mode nudge: marks targets seen once looked at, and points at the nearest unseen one that's
 * out of view. Mutates `s`.
 */
export function stepNudge(s: NudgeState, targets: NudgeTarget[], dt: number): NudgeOutput {
  s.t += Math.max(0, dt)
  s.sinceSeen += Math.max(0, dt)
  for (const t of targets) {
    if (s.seen[t.id]) continue
    if (inView(t)) {
      s.dwell[t.id] = (s.dwell[t.id] || 0) + Math.max(0, dt)
      if (s.dwell[t.id] >= NUDGE.seenDwellSec) {
        s.seen[t.id] = true
        s.sinceSeen = 0
        if (s.current === t.id) s.current = null
      }
    } else {
      s.dwell[t.id] = 0
    }
  }
  if (s.t < NUDGE.firstDelaySec || s.sinceSeen < NUDGE.betweenSec) return HIDDEN
  const open = targets.filter((t) => !s.seen[t.id])
  if (!open.length) return HIDDEN
  let pick = open.find((t) => t.id === s.current) || null
  if (!pick) {
    pick = open.reduce((a, b) => (Math.hypot(b.yawDeg, b.pitchDeg) < Math.hypot(a.yawDeg, a.pitchDeg) ? b : a))
    s.current = pick.id
  }
  // While the wearer is already looking at it (dwelling), hide the arrow.
  if (inView(pick)) return HIDDEN
  return {show: true, targetId: pick.id, angleRad: Math.atan2(pick.pitchDeg, pick.yawDeg)}
}

/** Map nudge: `away` is how long the map has been out of view; returns the arrow once it's past mapAwaySec. */
export function mapNudge(map: NudgeTarget, awaySec: number): NudgeOutput {
  if (inView(map) || awaySec < NUDGE.mapAwaySec) return HIDDEN
  return {show: true, targetId: map.id, angleRad: Math.atan2(map.pitchDeg, map.yawDeg)}
}

/** Gaze offsets of a point given in camera-local space (Lens Studio cameras look down -z). */
export function offsetsFromLocal(id: string, x: number, y: number, z: number): NudgeTarget {
  const fwd = -z
  const yawDeg = (Math.atan2(x, fwd) * 180) / Math.PI
  const pitchDeg = (Math.atan2(y, Math.hypot(x, fwd)) * 180) / Math.PI
  return {id, yawDeg, pitchDeg}
}

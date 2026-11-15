/**
 * "Bring the map here": after the wearer has walked a long way from the map (left the table behind), looking down
 * and pinching with both hands respawns it in front of them, rebuilt around where they now stand.
 *
 * Pure: the controller passes distances, head pitch and pinch state each frame and acts on the returned phase.
 * The offer only appears when the wearer is far from the map AND has walked far from where it was last placed, so
 * it never shows during the normal table demo (standing at the table, glancing down, two-hand gestures).
 */

export interface RespawnRules {
  /** Wearer must be at least this far (horizontal metres) from the map's centre. */
  minMapDistM: number
  /** Wearer must have walked at least this far (metres) from where the map was last placed. */
  minWalkedM: number
  /** Head must be pitched at least this far below the horizon (degrees, positive = down). */
  minLookDownDeg: number
  /** Both pinches must be held this long (s) to respawn. */
  holdSec: number
}

export const DEFAULT_RESPAWN: RespawnRules = {minMapDistM: 6, minWalkedM: 8, minLookDownDeg: 35, holdSec: 0.8}

export interface RespawnInput {
  now: number
  /** Horizontal distance from the wearer to the map's centre (m). */
  mapDistM: number
  /** Distance walked since the map was last placed (m). */
  walkedM: number
  /** Head pitch below the horizon (degrees, positive = looking down). */
  lookDownDeg: number
  /** Both hands tracked and pinching. */
  bothPinching: boolean
  /** Only in the tour (not calibrating, not mid-quiz). */
  active: boolean
}

export type RespawnPhase = "none" | "offer" | "holding" | "fire"

export interface RespawnState {
  /** When both pinches started while offered (-1 = not holding). */
  holdStart: number
  /** Set once fired, until the pinches are released (one respawn per gesture). */
  fired: boolean
}

export function newRespawnState(): RespawnState {
  return {holdStart: -1, fired: false}
}

/** Far enough away, and walked far enough, that bringing the map over makes sense. Ignores where they look. */
export function farFromMap(i: Pick<RespawnInput, "mapDistM" | "walkedM" | "active">, r: RespawnRules = DEFAULT_RESPAWN): boolean {
  return i.active && i.mapDistM >= r.minMapDistM && i.walkedM >= r.minWalkedM
}

/**
 * Advances the gesture one frame (mutates `s`). "offer": show the "pinch both hands" hint. "holding": both pinches
 * held, not long enough yet (`progress` 0..1). "fire": respawn now (returned once per gesture).
 */
export function stepRespawn(s: RespawnState, i: RespawnInput, r: RespawnRules = DEFAULT_RESPAWN): {phase: RespawnPhase; progress: number} {
  if (!i.bothPinching) {
    s.holdStart = -1
    s.fired = false
  }
  const offered = farFromMap(i, r) && i.lookDownDeg >= r.minLookDownDeg
  if (s.fired) return {phase: "none", progress: 0}
  if (!offered) {
    s.holdStart = -1
    return {phase: "none", progress: 0}
  }
  if (!i.bothPinching) return {phase: "offer", progress: 0}
  if (s.holdStart < 0) s.holdStart = i.now
  const progress = r.holdSec <= 0 ? 1 : Math.min(1, (i.now - s.holdStart) / r.holdSec)
  if (progress >= 1) {
    s.fired = true
    s.holdStart = -1
    return {phase: "fire", progress: 1}
  }
  return {phase: "holding", progress}
}

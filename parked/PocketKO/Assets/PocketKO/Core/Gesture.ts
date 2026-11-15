/**
 * Gesture detection from wrist positions (world space, centimetres, Lens frame: +Y up).
 * Pure TS: feed it samples from SIK hand tracking each frame; it reports slam/swing/poke/toss.
 */
import {Gesture} from "./Moves"

export interface V3 {
  x: number
  y: number
  z: number
}

export interface GestureConfig {
  /** Peak speed (cm/s) along the gesture axis needed to count. */
  slam: number
  swing: number
  poke: number
  toss: number
  /** Minimum seconds between two detections. */
  refractory: number
  /** Samples averaged for velocity. */
  window: number
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  slam: 110,
  swing: 130,
  poke: 100,
  toss: 110,
  refractory: 0.45,
  window: 3
}

export interface Detection {
  gesture: Gesture
  speed: number
}

const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z
const sub = (a: V3, b: V3): V3 => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z})
const scale = (a: V3, s: number): V3 => ({x: a.x * s, y: a.y * s, z: a.z * s})
const norm = (a: V3): V3 => {
  const l = Math.sqrt(dot(a, a)) || 1
  return scale(a, 1 / l)
}

/**
 * One detector per hand. `push` returns a detection on the frame a gesture fires.
 * `forward` is the direction from the player toward the monster (horizontal), `right` the player's right.
 */
export class GestureDetector {
  private samples: {t: number; p: V3}[] = []
  private lastFire = -1e9
  constructor(private cfg: GestureConfig = DEFAULT_GESTURE_CONFIG) {}

  reset() {
    this.samples = []
  }

  push(t: number, p: V3, forward: V3, right: V3): Detection | null {
    this.samples.push({t, p})
    const keep = this.cfg.window + 1
    if (this.samples.length > keep) this.samples.splice(0, this.samples.length - keep)
    if (this.samples.length < keep) return null
    const a = this.samples[0]
    const b = this.samples[this.samples.length - 1]
    const dt = b.t - a.t
    if (dt <= 1e-4) return null
    const v = scale(sub(b.p, a.p), 1 / dt)
    if (t - this.lastFire < this.cfg.refractory) return null

    const f = norm({x: forward.x, y: 0, z: forward.z})
    const r = norm({x: right.x, y: 0, z: right.z})
    const down = -v.y
    const side = Math.abs(dot(v, r))
    const fwd = dot(v, f)
    const up = v.y

    // Score each gesture by how far past its threshold it is; pick the strongest, and require it to dominate.
    const cands: {g: Gesture; s: number; speed: number}[] = [
      {g: "slam", s: down / this.cfg.slam, speed: down},
      {g: "swing", s: side / this.cfg.swing, speed: side},
      {g: "poke", s: fwd / this.cfg.poke, speed: fwd},
      {g: "toss", s: (up + Math.max(0, fwd) * 0.5) / this.cfg.toss, speed: up}
    ]
    cands.sort((x, y) => y.s - x.s)
    const best = cands[0]
    if (best.s < 1) return null
    if (cands[1].s > best.s * 0.85) return null // ambiguous motion: wait for a clearer frame
    this.lastFire = t
    this.samples = []
    return {gesture: best.g, speed: best.speed}
  }
}

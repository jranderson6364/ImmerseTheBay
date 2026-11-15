/**
 * Pocket KO round logic. Pure TS state machine: the Lens (and the browser preview) call
 * start / beginScan / moveReady / gesture / tick, then drain `events` to drive visuals and audio.
 */
import {Detection} from "./Gesture"
import {GESTURE_HINT, Move} from "./Moves"

export type Phase = "intro" | "need_weapon" | "analyzing" | "armed" | "finisher" | "ko" | "results"

export interface GameConfig {
  monsterHp: number
  /** Minimum "analyzing your weapon" cooldown even if Gemini answers sooner (seconds). */
  analyzeCooldown: number
  /** Intro (monster drop) duration. */
  introSeconds: number
  /** HP fraction at which the next hit becomes the FINAL BLOW. */
  finisherAt: number
  /** HP fraction at which to pre-warm the Orbis session. */
  prewarmAt: number
  roundSeconds: number
  /** Damage multiplier for the wrong gesture ("sloppy hit"). */
  sloppy: number
  hitCooldown: number
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  monsterHp: 100,
  analyzeCooldown: 3.5,
  introSeconds: 2.5,
  finisherAt: 0.2,
  prewarmAt: 0.5,
  roundSeconds: 120,
  sloppy: 0.35,
  hitCooldown: 0.5
}

export type GameEvent =
  | {type: "phase"; phase: Phase}
  | {type: "announce"; text: string; speak: boolean}
  | {type: "hit"; damage: number; total: number; sloppy: boolean; crit: boolean; color: string; index: number; of: number}
  | {type: "effect"; effect: string}
  | {type: "burn_tick"; damage: number}
  | {type: "prewarm"}
  | {type: "finisher_ready"}
  | {type: "ko"; move: Move}
  | {type: "timeout"}
  | {type: "results"; summary: RoundSummary}

export interface RoundSummary {
  won: boolean
  seconds: number
  mvp: string
  objects: {name: string; move: string; damage: number}[]
  bestCombo: number
}

/** Staleness: repeated hits with the same object get weaker. */
const STALE = [1, 0.75, 0.55, 0.4, 0.3]

export class PocketKOGame {
  phase: Phase = "intro"
  hp: number
  maxHp: number
  move: Move | null = null
  pendingMove: Move | null = null
  combo = 0
  bestCombo = 0
  events: GameEvent[] = []

  private cfg: GameConfig
  private t0 = 0
  private phaseAt = 0
  private analyzeAt = 0
  private lastHitAt = -1e9
  private usesOfCurrent = 0
  private lastObject = ""
  private seen: Record<string, boolean> = {}
  private damageBy: Record<string, {move: string; damage: number}> = {}
  private stunUntil = 0
  private slipped = false
  private burnUntil = 0
  private burnAcc = 0
  private prewarmed = false

  constructor(cfg: Partial<GameConfig> = {}) {
    this.cfg = {...DEFAULT_GAME_CONFIG, ...cfg}
    this.hp = this.maxHp = this.cfg.monsterHp
  }

  get hpFraction(): number {
    return this.hp / this.maxHp
  }

  get stunned(): boolean {
    return this.stunUntil > 0
  }

  start(now: number) {
    this.t0 = now
    this.setPhase("intro", now)
    this.announce("Incoming! A wild GLORP lands on your table!", true)
  }

  /** The player held something up and asked to scan it. Returns false if a scan isn't allowed now. */
  beginScan(now: number): boolean {
    if (this.phase !== "need_weapon" && this.phase !== "armed" && this.phase !== "finisher") return false
    this.pendingMove = null
    this.analyzeAt = now
    this.setPhase("analyzing", now)
    this.announce("Analyzing your weapon…", true)
    return true
  }

  /** Gemini answered (or the fallback kicked in). The weapon arms once the cooldown has passed. */
  moveReady(move: Move) {
    if (this.phase === "analyzing") this.pendingMove = move
  }

  tick(now: number, dt: number) {
    if (this.phase === "intro" && now - this.phaseAt >= this.cfg.introSeconds) {
      this.setPhase("need_weapon", now)
      this.announce("Grab ANYTHING and hold it up to scan!", true)
    }
    if (this.phase === "analyzing" && this.pendingMove && now - this.analyzeAt >= this.cfg.analyzeCooldown) {
      this.arm(this.pendingMove, now)
    }
    if (this.stunUntil > 0 && now >= this.stunUntil) this.stunUntil = 0
    if (this.burnUntil > 0) {
      if (now >= this.burnUntil) this.burnUntil = 0
      else if (this.hp > this.finisherHp() + 1) {
        this.burnAcc += 2.5 * dt
        if (this.burnAcc >= 1) {
          const d = Math.floor(this.burnAcc)
          this.burnAcc -= d
          this.hp = Math.max(this.finisherHp() + 1, this.hp - d)
          this.events.push({type: "burn_tick", damage: d})
        }
      }
    }
    const fighting = this.phase !== "ko" && this.phase !== "results" && this.phase !== "intro"
    if (fighting && now - this.t0 >= this.cfg.roundSeconds) {
      this.events.push({type: "timeout"})
      this.announce("Time! The GLORP escapes…", true)
      this.finish(now, false)
    }
  }

  /** A gesture was detected on the hand holding the object. Returns total damage dealt (0 if ignored). */
  gesture(det: Detection, now: number): number {
    if (!this.move || (this.phase !== "armed" && this.phase !== "finisher")) return 0
    if (now - this.lastHitAt < this.cfg.hitCooldown) return 0
    this.lastHitAt = now
    const m = this.move
    const sloppy = det.gesture !== m.gesture

    if (this.phase === "finisher") {
      if (sloppy) {
        this.announce(`So close! ${GESTURE_HINT[m.gesture]}`, true)
        return 0
      }
      const dmg = this.hp
      this.hp = 0
      this.credit(m, dmg)
      this.events.push({type: "hit", damage: dmg, total: dmg, sloppy: false, crit: true, color: m.color, index: 0, of: 1})
      this.events.push({type: "ko", move: m})
      this.setPhase("ko", now)
      this.announce(`K.O.! ${m.move_name} FINISHES IT!`, true)
      return dmg
    }

    let mult = (sloppy ? this.cfg.sloppy : 1) * STALE[Math.min(this.usesOfCurrent, STALE.length - 1)]
    mult *= 1 + Math.min(this.combo, 5) * 0.2
    let crit = false
    if (this.slipped) {
      mult *= 1.5
      crit = true
      this.slipped = false
    }
    if (this.stunned) mult *= 1.25
    this.usesOfCurrent++

    const hits = m.effect === "multi" && !sloppy ? 3 : 1
    const per = Math.max(1, Math.round((m.damage * mult * (hits === 3 ? 0.45 : 1))))
    let total = 0
    for (let i = 0; i < hits; i++) {
      const before = this.hp
      this.hp = Math.max(this.finisherHp(), this.hp - per)
      const d = before - this.hp
      total += d
      this.events.push({type: "hit", damage: d, total, sloppy, crit, color: m.color, index: i, of: hits})
    }
    this.credit(m, total)

    if (!sloppy) this.applyEffect(m, now)
    else this.announce(`Sloppy! ${GESTURE_HINT[m.gesture]}`, false)

    if (!this.prewarmed && this.hpFraction <= this.cfg.prewarmAt) {
      this.prewarmed = true
      this.events.push({type: "prewarm"})
    }
    if (this.hp <= this.finisherHp()) {
      this.setPhase("finisher", now)
      this.events.push({type: "finisher_ready"})
      this.announce(`FINAL BLOW! ${GESTURE_HINT[m.gesture]}`, true)
    }
    return total
  }

  /** The KO cinematic finished (or was skipped). */
  koDone(now: number) {
    if (this.phase === "ko") this.finish(now, true)
  }

  /** Lets the Lens Preview / browser preview skip straight to the finisher. */
  debugSetHp(hp: number, now: number) {
    this.hp = Math.max(0, Math.min(this.maxHp, hp))
    if (this.hp <= this.finisherHp() && this.move) {
      this.setPhase("finisher", now)
      this.events.push({type: "finisher_ready"})
    }
  }

  drain(): GameEvent[] {
    const e = this.events
    this.events = []
    return e
  }

  // -------------------------------------------------------------------------

  private finisherHp(): number {
    return Math.ceil(this.maxHp * this.cfg.finisherAt)
  }

  private arm(move: Move, now: number) {
    const isNew = !this.seen[move.object_name]
    if (move.object_name !== this.lastObject) {
      this.usesOfCurrent = 0
      if (isNew && this.lastObject) {
        this.combo++
        this.bestCombo = Math.max(this.bestCombo, this.combo)
      }
    }
    this.seen[move.object_name] = true
    this.lastObject = move.object_name
    this.move = move
    this.pendingMove = null
    this.setPhase(this.hp <= this.finisherHp() ? "finisher" : "armed", now)
    const combo = this.combo > 0 ? ` New weapon combo x${(1 + Math.min(this.combo, 5) * 0.2).toFixed(1)}!` : ""
    const safety = move.unsafe ? " Careful, that one's dangerous. Grab something softer!" : move.fragile ? " Gently, it's fragile!" : ""
    this.announce(`${move.hype} ${GESTURE_HINT[move.gesture]}${combo}${safety}`, true)
  }

  private applyEffect(m: Move, now: number) {
    if (m.effect === "none" || m.effect === "multi") return
    this.events.push({type: "effect", effect: m.effect})
    if (m.effect === "stun") this.stunUntil = now + 2.5
    if (m.effect === "slip") this.slipped = true
    if (m.effect === "burn") this.burnUntil = now + 4
  }

  private credit(m: Move, dmg: number) {
    const cur = this.damageBy[m.object_name] || {move: m.move_name, damage: 0}
    cur.damage += dmg
    cur.move = m.move_name
    this.damageBy[m.object_name] = cur
  }

  private finish(now: number, won: boolean) {
    const objects = Object.keys(this.damageBy).map((name) => ({name, move: this.damageBy[name].move, damage: this.damageBy[name].damage}))
    objects.sort((a, b) => b.damage - a.damage)
    this.setPhase("results", now)
    this.events.push({
      type: "results",
      summary: {won, seconds: Math.round(now - this.t0), mvp: objects.length ? objects[0].name : "nothing", objects, bestCombo: this.bestCombo}
    })
  }

  private setPhase(p: Phase, now: number) {
    this.phase = p
    this.phaseAt = now
    this.events.push({type: "phase", phase: p})
  }

  private announce(text: string, speak: boolean) {
    this.events.push({type: "announce", text, speak})
  }
}

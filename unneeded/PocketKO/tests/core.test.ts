// Run: bun test unneeded/PocketKO/tests
import {describe, expect, test} from "bun:test"
import {DEMO_MOVES, FALLBACK_MOVE, MAX_DAMAGE, MIN_DAMAGE, validateMove} from "../Assets/PocketKO/Core/Moves"
import {GestureDetector, V3} from "../Assets/PocketKO/Core/Gesture"
import {PocketKOGame} from "../Assets/PocketKO/Core/Game"

const F: V3 = {x: 0, y: 0, z: -1}
const R: V3 = {x: 1, y: 0, z: 0}

function motion(det: GestureDetector, from: V3, vel: V3, frames = 8, fps = 60) {
  let out = null
  for (let i = 0; i <= frames && !out; i++) {
    const t = i / fps
    out = det.push(t, {x: from.x + vel.x * t, y: from.y + vel.y * t, z: from.z + vel.z * t}, F, R)
  }
  return out
}

describe("validateMove", () => {
  test("garbage gives the fallback", () => {
    expect(validateMove(null).move).toEqual(FALLBACK_MOVE)
    expect(validateMove("x").move.move_name).toBe(FALLBACK_MOVE.move_name)
  })
  test("clamps damage, fixes enums, uppercases the move", () => {
    const {move, warnings} = validateMove({object_name: "Banana", move_name: "peel out", damage: 999, effect: "laser", gesture: "dance", color: "teal"})
    expect(move.damage).toBe(MAX_DAMAGE)
    expect(move.effect).toBe("none")
    expect(move.gesture).toBe("slam")
    expect(move.color).toBe("yellow")
    expect(move.move_name).toBe("PEEL OUT")
    expect(move.object_name).toBe("banana")
    expect(warnings.length).toBeGreaterThan(0)
  })
  test("fragile things are forced to a gentle poke, unsafe things do minimum damage", () => {
    expect(validateMove({object_name: "iPhone", gesture: "slam", damage: 30}).move.gesture).toBe("poke")
    expect(validateMove({object_name: "scissors", gesture: "swing", damage: 30}).move.damage).toBe(MIN_DAMAGE)
    expect(validateMove({object_name: "phonebook", gesture: "slam"}).move.gesture).toBe("slam")
  })
})

describe("GestureDetector", () => {
  test("detects each gesture from its motion", () => {
    expect(motion(new GestureDetector(), {x: 0, y: 0, z: 0}, {x: 0, y: -200, z: 0})?.gesture).toBe("slam")
    expect(motion(new GestureDetector(), {x: 0, y: 0, z: 0}, {x: 220, y: 0, z: 0})?.gesture).toBe("swing")
    expect(motion(new GestureDetector(), {x: 0, y: 0, z: 0}, {x: 0, y: 0, z: -180})?.gesture).toBe("poke")
    expect(motion(new GestureDetector(), {x: 0, y: 0, z: 0}, {x: 0, y: 200, z: 0})?.gesture).toBe("toss")
  })
  test("ignores slow drifting and ambiguous diagonals", () => {
    expect(motion(new GestureDetector(), {x: 0, y: 0, z: 0}, {x: 20, y: -30, z: 10})).toBeNull()
    expect(motion(new GestureDetector(), {x: 0, y: 0, z: 0}, {x: 150, y: -140, z: 0})).toBeNull()
  })
  test("refractory period stops double fires", () => {
    const d = new GestureDetector()
    expect(motion(d, {x: 0, y: 0, z: 0}, {x: 0, y: -200, z: 0})).not.toBeNull()
    // Immediately slam again: still inside the refractory window.
    let again = null
    for (let i = 0; i < 6; i++) again = again || d.push(0.2 + i / 60, {x: 0, y: -40 - i * 4, z: 0}, F, R)
    expect(again).toBeNull()
  })
})

function play(game: PocketKOGame, from: number, until: number, dt = 0.05) {
  for (let t = from; t <= until; t += dt) game.tick(t, dt)
}

describe("PocketKOGame", () => {
  test("full round: intro, scan cooldown, hits, finisher, KO, results", () => {
    const g = new PocketKOGame()
    g.start(0)
    play(g, 0, 3)
    expect(g.phase).toBe("need_weapon")

    expect(g.beginScan(3)).toBe(true)
    g.moveReady(DEMO_MOVES[0]) // banana answers instantly…
    play(g, 3, 5)
    expect(g.phase).toBe("analyzing") // …but the cooldown holds it
    play(g, 5, 7)
    expect(g.phase).toBe("armed")

    let now = 7
    const events: string[] = []
    while (g.phase === "armed") {
      now += 1
      g.gesture({gesture: "slam", speed: 200}, now)
      if (g.phase === "armed" && now > 40) throw new Error("never reached finisher")
    }
    expect(g.phase).toBe("finisher")
    const drained = g.drain().map((e) => e.type)
    expect(drained).toContain("prewarm")
    expect(drained).toContain("finisher_ready")

    // Wrong gesture on the finisher does nothing; the right one KOs.
    expect(g.gesture({gesture: "swing", speed: 200}, now + 1)).toBe(0)
    expect(g.gesture({gesture: "slam", speed: 200}, now + 2)).toBeGreaterThan(0)
    expect(g.phase).toBe("ko")
    expect(g.hp).toBe(0)
    g.koDone(now + 10)
    const results = g.drain().find((e) => e.type === "results") as any
    expect(results.summary.won).toBe(true)
    expect(results.summary.mvp).toBe("banana")
    void events
  })

  test("hits can't skip the finisher, and repeats get stale", () => {
    const g = new PocketKOGame({analyzeCooldown: 0})
    g.start(0)
    play(g, 0, 3)
    g.beginScan(3)
    g.moveReady({...DEMO_MOVES[2], damage: 30})
    play(g, 3, 3.2)
    const d1 = g.gesture({gesture: "swing", speed: 200}, 4)
    const d2 = g.gesture({gesture: "swing", speed: 200}, 5)
    expect(d2).toBeLessThan(d1)
    for (let i = 0; i < 20 && g.phase === "armed"; i++) g.gesture({gesture: "swing", speed: 200}, 6 + i)
    expect(g.hp).toBeGreaterThan(0) // stops at the finisher threshold
    expect(g.phase).toBe("finisher")
  })

  test("a new object builds a combo; sloppy gestures do less", () => {
    const g = new PocketKOGame({analyzeCooldown: 0})
    g.start(0)
    play(g, 0, 3)
    g.beginScan(3)
    g.moveReady(DEMO_MOVES[1])
    play(g, 3, 3.2)
    const sloppy = g.gesture({gesture: "slam", speed: 200}, 4)
    g.beginScan(5)
    g.moveReady(DEMO_MOVES[2])
    play(g, 5, 5.2)
    expect(g.combo).toBe(1)
    const clean = g.gesture({gesture: "swing", speed: 200}, 6)
    expect(clean).toBeGreaterThan(sloppy)
  })

  test("multi-hit moves land three hits", () => {
    const g = new PocketKOGame({analyzeCooldown: 0})
    g.start(0)
    play(g, 0, 3)
    g.beginScan(3)
    g.moveReady(DEMO_MOVES[1]) // keys: multi, poke
    play(g, 3, 3.2)
    g.drain()
    g.gesture({gesture: "poke", speed: 200}, 4)
    expect(g.drain().filter((e) => e.type === "hit").length).toBe(3)
  })

  test("timeout ends the round as a loss", () => {
    const g = new PocketKOGame({roundSeconds: 10})
    g.start(0)
    play(g, 0, 11)
    expect(g.phase).toBe("results")
    const r = g.drain().find((e) => e.type === "results") as any
    expect(r.summary.won).toBe(false)
  })
})

import {describe, expect, test} from "bun:test"
import {DEFAULT_RESPAWN, RespawnInput, farFromMap, newRespawnState, stepRespawn} from "../Assets/Retrospecs/Core/Respawn"

const far = (o: Partial<RespawnInput>): RespawnInput => ({now: 0, mapDistM: 20, walkedM: 20, lookDownDeg: 50, bothPinching: false, active: true, ...o})

describe("bring the map here", () => {
  test("never offered at the table, even looking down and pinching both hands", () => {
    const s = newRespawnState()
    for (let t = 0; t < 3; t += 0.1) expect(stepRespawn(s, far({now: t, mapDistM: 1, walkedM: 0.5, bothPinching: true})).phase).toBe("none")
  })

  test("needs both: far from the map and walked far", () => {
    expect(farFromMap(far({walkedM: 2}))).toBe(false) // map was placed far off, but the wearer hasn't moved
    expect(farFromMap(far({mapDistM: 2}))).toBe(false) // walked a lap and came back to the map
    expect(farFromMap(far({}))).toBe(true)
    expect(farFromMap(far({active: false}))).toBe(false)
  })

  test("offered only while looking down", () => {
    const s = newRespawnState()
    expect(stepRespawn(s, far({lookDownDeg: 10})).phase).toBe("none")
    expect(stepRespawn(s, far({})).phase).toBe("offer")
  })

  test("fires once after holding both pinches, then waits for release", () => {
    const s = newRespawnState()
    expect(stepRespawn(s, far({now: 0, bothPinching: true})).phase).toBe("holding")
    const mid = stepRespawn(s, far({now: DEFAULT_RESPAWN.holdSec / 2, bothPinching: true}))
    expect(mid.phase).toBe("holding")
    expect(mid.progress).toBeCloseTo(0.5)
    expect(stepRespawn(s, far({now: DEFAULT_RESPAWN.holdSec, bothPinching: true})).phase).toBe("fire")
    // Still far by these numbers (the caller resets distances after respawning), still holding: no second fire.
    expect(stepRespawn(s, far({now: 5, bothPinching: true})).phase).toBe("none")
    expect(stepRespawn(s, far({now: 6})).phase).toBe("offer")
  })

  test("looking up mid-hold cancels it", () => {
    const s = newRespawnState()
    stepRespawn(s, far({now: 0, bothPinching: true}))
    expect(stepRespawn(s, far({now: 0.5, bothPinching: true, lookDownDeg: 0})).phase).toBe("none")
    expect(stepRespawn(s, far({now: 0.6, bothPinching: true})).phase).toBe("holding") // restarts the hold
    expect(stepRespawn(s, far({now: 0.6 + DEFAULT_RESPAWN.holdSec * 0.9, bothPinching: true})).phase).toBe("holding")
  })
})

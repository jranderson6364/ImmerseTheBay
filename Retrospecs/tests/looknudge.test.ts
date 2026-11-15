import {describe, expect, test} from "bun:test"
import {NUDGE, mapNudge, newNudgeState, offsetsFromLocal, stepNudge} from "../Assets/Retrospecs/Core/LookNudge"

const left = {id: "exp", yawDeg: -30, pitchDeg: 0}
const right = {id: "people", yawDeg: 40, pitchDeg: 0}

describe("look-around nudge", () => {
  test("waits, then points at the nearest unseen side piece", () => {
    const s = newNudgeState()
    expect(stepNudge(s, [left, right], 1).show).toBe(false)
    const o = stepNudge(s, [left, right], NUDGE.firstDelaySec)
    expect(o.show).toBe(true)
    expect(o.targetId).toBe("exp")
    expect(Math.cos(o.angleRad)).toBeLessThan(0) // points left
  })

  test("looking at a target marks it seen, then moves on to the next", () => {
    const s = newNudgeState()
    stepNudge(s, [left, right], NUDGE.firstDelaySec + 0.1)
    const seenLeft = {...left, yawDeg: 2}
    stepNudge(s, [seenLeft, {...right, yawDeg: 70}], NUDGE.seenDwellSec + 0.01)
    expect(s.seen.exp).toBe(true)
    expect(stepNudge(s, [left, right], 0.1).show).toBe(false) // brief pause after finding one
    const o = stepNudge(s, [left, right], NUDGE.betweenSec)
    expect(o.targetId).toBe("people")
    expect(Math.cos(o.angleRad)).toBeGreaterThan(0)
  })

  test("a glance shorter than the dwell doesn't count", () => {
    const s = newNudgeState()
    stepNudge(s, [{...left, yawDeg: 0}], NUDGE.seenDwellSec * 0.5)
    stepNudge(s, [left], 0.01)
    stepNudge(s, [{...left, yawDeg: 0}], NUDGE.seenDwellSec * 0.6)
    expect(s.seen.exp).toBeUndefined()
  })

  test("nothing left unseen hides the arrow", () => {
    const s = newNudgeState()
    s.seen = {exp: true, people: true}
    expect(stepNudge(s, [left, right], 10).show).toBe(false)
  })

  test("map nudge points down after the map has been out of view a while", () => {
    const map = {id: "map", yawDeg: 0, pitchDeg: -45}
    expect(mapNudge(map, 1).show).toBe(false)
    const o = mapNudge(map, NUDGE.mapAwaySec + 1)
    expect(o.show).toBe(true)
    expect(Math.sin(o.angleRad)).toBeLessThan(-0.9)
    expect(mapNudge({...map, pitchDeg: -5}, 99).show).toBe(false)
  })

  test("camera-local offsets: -z is straight ahead", () => {
    const a = offsetsFromLocal("a", 0, 0, -100)
    expect(Math.abs(a.yawDeg)).toBeLessThan(1e-9)
    const r = offsetsFromLocal("r", 100, 0, -100)
    expect(r.yawDeg).toBeCloseTo(45)
    const d = offsetsFromLocal("d", 0, -100, -100)
    expect(d.pitchDeg).toBeCloseTo(-45)
  })
})

import {describe, expect, test} from "bun:test"
import {isNextSpotIntent, nextSpot, spotTier} from "../Assets/Retrospecs/Core/NextSpot"
import {CENTERPIECES, isCenterpiece} from "../Assets/Retrospecs/Core/Centerpieces"
import {CARDS} from "../Assets/Retrospecs/Core/Cards"
import {LANDMARKS} from "../Assets/Retrospecs/Data/CampusData"
import {latLonToEN} from "../Assets/Retrospecs/Core/Geo"

const positions = {
  a: {e: 0, n: 0},
  b: {e: 10, n: 0},
  c: {e: 100, n: 0},
  d: {e: 5, n: 0}
}
const tier: Record<string, number> = {a: 0, b: 0, c: 0, d: 2}

describe("nextSpot", () => {
  test("richest tier first, nearest within it", () => {
    expect(nextSpot({currentId: "a", from: {e: 0, n: 0}, positions, shown: [], tierOf: (id) => tier[id]})).toBe("b")
  })
  test("skips what was shown, then falls to the next tier", () => {
    expect(nextSpot({currentId: "a", from: {e: 0, n: 0}, positions, shown: ["b"], tierOf: (id) => tier[id]})).toBe("c")
    expect(nextSpot({currentId: "a", from: {e: 0, n: 0}, positions, shown: ["b", "c"], tierOf: (id) => tier[id]})).toBe("d")
  })
  test("never returns the current building; wraps when everything was shown", () => {
    const id = nextSpot({currentId: "a", from: {e: 0, n: 0}, positions, shown: ["a", "b", "c", "d"], tierOf: (id) => tier[id]})
    expect(id).not.toBe("a")
    expect(id).toBe("b")
  })
  test("nothing in focus: measures from the wearer", () => {
    expect(nextSpot({currentId: "", from: {e: 99, n: 0}, positions, shown: [], tierOf: (id) => tier[id]})).toBe("c")
  })
  test("empty when there is nowhere else", () => {
    expect(nextSpot({currentId: "a", from: {e: 0, n: 0}, positions: {a: {e: 0, n: 0}}, shown: [], tierOf: () => 0})).toBe("")
  })
  test("on the real campus, the first stops from the start point are the centerpieces", () => {
    const pos: Record<string, {e: number; n: number}> = {}
    for (const c of CARDS) {
      const l = LANDMARKS.filter((x) => x.id === c.id)[0]
      if (c.offMap) pos[c.id] = latLonToEN(c.offMap.lat, c.offMap.lon)
      else if (l) pos[c.id] = {e: l.east, n: l.north}
    }
    const shown: string[] = []
    let cur = ""
    for (let i = 0; i < CENTERPIECES.length; i++) {
      cur = nextSpot({currentId: cur, from: {e: 0, n: 0}, positions: pos, shown, tierOf: (id) => spotTier(isCenterpiece(id), false)})
      shown.push(cur)
    }
    expect(shown.slice().sort()).toEqual(CENTERPIECES.slice().sort())
  })
})

describe("isNextSpotIntent", () => {
  for (const s of ["next", "Next spot.", "next one please", "show me somewhere else", "somewhere else", "take me somewhere else", "skip", "skip this one", "okay next", "keep going", "move on", "show me another place", "something else"]) {
    test(`"${s}" moves on`, () => expect(isNextSpotIntent(s)).toBe(true))
  }
  for (const s of ["what's next to Hoover?", "tell me more", "what's that", "show me more", "who is it named after", "next to the church what is that", ""]) {
    test(`"${s}" does not`, () => expect(isNextSpotIntent(s)).toBe(false))
  }
})

describe("spotTier", () => {
  test("centerpieces, then narrated or illustrated, then the rest", () => {
    expect(spotTier(true, false)).toBe(0)
    expect(spotTier(false, true)).toBe(1)
    expect(spotTier(false, false)).toBe(2)
  })
})

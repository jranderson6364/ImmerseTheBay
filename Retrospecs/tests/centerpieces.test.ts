import {describe, expect, test} from "bun:test"
import {LANDMARKS, BUILDINGS} from "../Assets/Retrospecs/Data/CampusData"
import {cardById} from "../Assets/Retrospecs/Core/Cards"
import {EXPERIENCES} from "../Assets/Retrospecs/Core/Experiences"
import {CENTERPIECES, PICK_PAD_M, isCenterpiece, labelScaleFor} from "../Assets/Retrospecs/Core/Centerpieces"
import {latLonToEN} from "../Assets/Retrospecs/Core/Geo"
import {ColumnPickCandidate, MapPickCandidate, outerRingEN, pickAlongRay, pickByBearing, pickOnMap} from "../Assets/Retrospecs/Core/Pick"

const CM_PER_M = 0.1
const center = latLonToEN(37.42802, -122.17423)

function mapCands(withPads: boolean): MapPickCandidate[] {
  return LANDMARKS.map((l) => {
    const poly = l.building >= 0 ? outerRingEN(BUILDINGS[l.building][3], BUILDINGS[l.building][4]).map((v) => ({x: (v.e - center.e) * CM_PER_M, z: -(v.n - center.n) * CM_PER_M})) : []
    const pad = withPads && PICK_PAD_M[l.id] ? PICK_PAD_M[l.id] * CM_PER_M : 0
    return {id: l.id, center: {x: (l.east - center.e) * CM_PER_M, z: -(l.north - center.n) * CM_PER_M}, poly, radius: poly.length ? pad : Math.max(1.5, pad), priority: withPads && isCenterpiece(l.id)}
  })
}

describe("centerpieces", () => {
  test("each one has a card and an experience", () => {
    for (const id of CENTERPIECES) {
      expect(cardById(id)).toBeTruthy()
      expect(EXPERIENCES.some((e) => e.landmarkIds.indexOf(id) >= 0)).toBe(true)
    }
  })
  test("labels are bigger than the rest", () => {
    expect(labelScaleFor("hoover")).toBeGreaterThan(labelScaleFor("mainquad"))
  })
  test("no pad covers another landmark's centre", () => {
    for (const id of Object.keys(PICK_PAD_M)) {
      const me = LANDMARKS.find((l) => l.id === id)
      if (!me) continue // HP Garage is an off-map pin, not a campus landmark
      const near = LANDMARKS.filter((l) => l.id !== id && Math.hypot(l.east - me.east, l.north - me.north) < PICK_PAD_M[id])
      expect(near.map((l) => l.id)).toEqual([])
    }
  })
  test("a point 30 m west of Hoover (outside its 23 m footprint) picks Hoover only once padded", () => {
    const h = mapCands(true).find((c) => c.id === "hoover")
    const p = {x: h.center.x - 30 * CM_PER_M, z: h.center.z}
    expect(pickOnMap(p, mapCands(true), 0)).toBe("hoover")
    expect(pickOnMap(p, mapCands(false), 0)).not.toBe("hoover")
  })
  test("a point 20 m from Memorial Church picks it", () => {
    const m = mapCands(true).find((c) => c.id === "memchu")
    expect(pickOnMap({x: m.center.x, z: m.center.z + 20 * CM_PER_M}, mapCands(true), 0)).toBe("memchu")
  })
  test("priority beats a smaller ordinary footprint", () => {
    const sq = (cx: number, r: number) => [{x: cx - r, z: -r}, {x: cx + r, z: -r}, {x: cx + r, z: r}, {x: cx - r, z: r}]
    const cands: MapPickCandidate[] = [
      {id: "big", center: {x: 0, z: 0}, poly: sq(0, 5), radius: 0, priority: true},
      {id: "small", center: {x: 0, z: 0}, poly: sq(0, 1), radius: 0}
    ]
    expect(pickOnMap({x: 0, z: 0}, cands)).toBe("big")
    expect(pickOnMap({x: 0, z: 0}, cands.map((c) => ({...c, priority: false})))).toBe("small")
  })
  test("the world arc widens with padM", () => {
    const h = LANDMARKS.find((l) => l.id === "hoover")
    const ring = outerRingEN(BUILDINGS[h.building][3], BUILDINGS[h.building][4])
    const w = {id: "hoover", en: {e: h.east, n: h.north}, ring, radiusM: 8, heightM: 87}
    const me = {e: h.east - 300, n: h.north}
    expect(pickByBearing(me, 90 + 6.5, [w], 0, 0)).toBe(null)
    expect(pickByBearing(me, 90 + 4, [{...w, padM: PICK_PAD_M.hoover}], 0, 0)).toBe("hoover")
  })

  test("aiming at a tall tower's shaft picks the tower, not the floor behind it", () => {
    const sq = (cx: number, r: number) => [{x: cx - r, z: -r}, {x: cx + r, z: -r}, {x: cx + r, z: r}, {x: cx - r, z: r}]
    const cands: ColumnPickCandidate[] = [
      {id: "tower", center: {x: 0, z: 0}, poly: sq(0, 2), radius: 0, topCm: 50},
      {id: "behind", center: {x: 36, z: 0}, poly: sq(36, 8), radius: 0, topCm: 3}
    ]
    // Eye 60 cm up, 40 cm in front; aimed at the tower's middle (y = 30 at x = 0): the floor hit is at x = 40.
    const eye = {x: -40, y: 60, z: 0}
    const hit = {x: 40, y: 0, z: 0}
    expect(pickOnMap({x: hit.x, z: hit.z}, cands, 2)).toBe("behind")
    expect(pickAlongRay(eye, hit, cands, 2)).toBe("tower")
    // Aimed past the tower's top: the ray clears it and lands on the building behind.
    expect(pickAlongRay({x: -40, y: 120, z: 0}, {x: 36, y: 0, z: 0}, cands, 2)).toBe("behind")
  })
})

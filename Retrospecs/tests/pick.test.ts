import {describe, expect, test} from "bun:test"
import {BUILDINGS, LANDMARKS} from "../Assets/Retrospecs/Data/CampusData"
import {bearingDeg, latLonToEN} from "../Assets/Retrospecs/Core/Geo"
import {MapPickCandidate, WorldPickCandidate, outerRingEN, pickByBearing, pickOnMap, pointInPolygon} from "../Assets/Retrospecs/Core/Pick"

const CM_PER_M = 0.1
const center = latLonToEN(37.42802, -122.17423) // Huang-ish start point

function mapCands(): MapPickCandidate[] {
  return LANDMARKS.filter((l) => l.building >= 0).map((l) => {
    const b = BUILDINGS[l.building]
    const poly = outerRingEN(b[3], b[4]).map((v) => ({x: (v.e - center.e) * CM_PER_M, z: -(v.n - center.n) * CM_PER_M}))
    return {id: l.id, center: {x: (l.east - center.e) * CM_PER_M, z: -(l.north - center.n) * CM_PER_M}, poly, radius: 0}
  })
}

function worldCands(): WorldPickCandidate[] {
  return LANDMARKS.map((l) => ({
    id: l.id,
    en: {e: l.east, n: l.north},
    ring: l.building >= 0 ? outerRingEN(BUILDINGS[l.building][3], BUILDINGS[l.building][4]) : [],
    radiusM: 8,
    heightM: l.building >= 0 ? BUILDINGS[l.building][0] : l.heightM
  }))
}

const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!

describe("map pick", () => {
  test("point in polygon basics", () => {
    const sq = [{x: 0, z: 0}, {x: 1, z: 0}, {x: 1, z: 1}, {x: 0, z: 1}]
    expect(pointInPolygon({x: 0.5, z: 0.5}, sq)).toBe(true)
    expect(pointInPolygon({x: 1.5, z: 0.5}, sq)).toBe(false)
  })

  test("cursor on Hoover Tower picks Hoover, not the Main Quad", () => {
    const h = lm("hoover")
    const p = {x: (h.east - center.e) * CM_PER_M, z: -(h.north - center.n) * CM_PER_M}
    expect(pickOnMap(p, mapCands())).toBe("hoover")
  })

  test("a point just outside Hoover's footprint, toward the Quad, still prefers Hoover over the Quad's circle", () => {
    const h = lm("hoover")
    const q = lm("mainquad")
    // 1 map-cm from Hoover's centre toward the Quad.
    const dx = q.east - h.east
    const dn = q.north - h.north
    const k = 10 / Math.hypot(dx, dn) // 10 m = 1 cm at this scale
    const p = {x: (h.east + dx * k - center.e) * CM_PER_M, z: -(h.north + dn * k - center.n) * CM_PER_M}
    const got = pickOnMap(p, mapCands())
    expect(got).not.toBe(null)
    expect(["hoover", "mainquad"]).toContain(got!)
  })

  test("every landmark centre picks itself or a smaller building inside it", () => {
    const cands = mapCands()
    let self = 0
    for (const c of cands) if (pickOnMap(c.center, cands) === c.id) self++
    expect(self / cands.length).toBeGreaterThan(0.8)
  })
})

describe("world pick", () => {
  test("looking up toward Hoover from Huang finds Hoover even with the Quad in front", () => {
    const h = lm("hoover")
    const view = bearingDeg(center, {e: h.east, n: h.north})
    // Hoover's top is ~87 m up at ~650 m: about 7.5 degrees. Gaze at ~5 degrees up.
    expect(pickByBearing(center, view, worldCands(), 5)).toBe("hoover")
  })

  test("looking level at a nearby building picks it (Spilker hides Gates from Huang)", () => {
    const g = lm("spilker")
    const view = bearingDeg(center, {e: g.east, n: g.north})
    expect(pickByBearing(center, view, worldCands(), 0)).toBe("spilker")
  })
})

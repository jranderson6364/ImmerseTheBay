import {describe, expect, test} from "bun:test"
import {BUILDINGS, LANDMARKS} from "../Assets/Sightlines/Data/CampusData"
import {angleDiff, bearingDeg, distanceM, enToLatLon, latLonToEN} from "../Assets/Sightlines/Core/Geo"
import {
  SPOTS, acceptDepth, aimAlongBearing, angularOffset, chooseWearerPosition, fallbackCandidate, footprintRings,
  identifySchema, insideFootprint, nearestSpot, parseIdentifyReply, rayHitRings, viewConeCandidates
} from "../Assets/Sightlines/Core/Locate"

const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!
const at = (id: string) => ({e: lm(id).east, n: lm(id).north})
const huangRings = footprintRings(BUILDINGS[lm("huang").building])
const outside = latLonToEN(SPOTS.find((s) => s.id === "huang-outside")!.lat, SPOTS.find((s) => s.id === "huang-outside")!.lon)

describe("spots", () => {
  test("a fix at Huang never picks the indoor table; near the exterior spot it snaps there", () => {
    const h = lm("huang")
    const atCentroid = nearestSpot(h.lat, h.lon)
    expect(atCentroid === null || atCentroid.spot.indoor === false).toBe(true)
    const p = enToLatLon({e: outside.e + 4, n: outside.n - 3})
    const s = nearestSpot(p.lat, p.lon)
    expect(s!.spot.id).toBe("huang-outside")
    expect(s!.spot.indoor).toBe(false)
  })

  test("far from every spot returns null", () => {
    const p = enToLatLon({e: -600, n: -600})
    expect(nearestSpot(p.lat, p.lon)).toBeNull()
  })

  test("picks the nearer spot within its radius (Gates exterior, Main Quad)", () => {
    const g = enToLatLon({e: 88, n: 198})
    expect(nearestSpot(g.lat, g.lon)!.spot.id).toBe("gates-outside")
    const q = lm("mainquad")
    expect(nearestSpot(q.lat, q.lon)!.spot.id).toBe("mainquad")
  })

  test("every outdoor spot is outside every building footprint", () => {
    for (const s of SPOTS.filter((x) => !x.indoor)) {
      const p = latLonToEN(s.lat, s.lon)
      for (const b of BUILDINGS) expect(insideFootprint(p, footprintRings(b))).toBe(false)
    }
  })

  test("the Huang exterior spot is outside Huang's footprint", () => {
    expect(insideFootprint(outside, huangRings)).toBe(false)
    expect(insideFootprint(at("huang"), huangRings)).toBe(true)
  })
})

describe("wearer position", () => {
  const survey = {e: 12.4, n: -5.1}
  const now = 1_000_000
  const fix = (en: {e: number; n: number}, acc: number, ageS = 1) => ({...enToLatLon(en), accuracyM: acc, timestampMs: now - ageS * 1000})
  const fixOf = (en: {e: number; n: number}, acc: number, ageS = 1) => {
    const f = fix(en, acc, ageS)
    return {lat: f.lat, lon: f.lon, accuracyM: f.accuracyM, timestampMs: f.timestampMs}
  }

  test("poor accuracy keeps the survey position (indoor/table mode)", () => {
    const w = chooseWearerPosition(fixOf({e: 200, n: 200}, 40), survey, {nowMs: now})
    expect(w.source).toBe("survey")
    expect(w.en).toEqual(survey)
    expect(w.reason).toContain("indoor")
  })

  test("forced indoor spot ignores a good fix", () => {
    const w = chooseWearerPosition(fixOf({e: 200, n: 200}, 5), survey, {nowMs: now, forcedSpotId: "huang-table"})
    expect(w.source).toBe("survey")
    expect(w.spotId).toBe("huang-table")
  })

  test("stale or missing fix keeps the survey position", () => {
    expect(chooseWearerPosition(null, survey, {nowMs: now}).source).toBe("survey")
    expect(chooseWearerPosition(fixOf({e: 200, n: 200}, 5, 60), survey, {nowMs: now}).source).toBe("survey")
  })

  test("a good fix away from spots is used as-is; near a spot it snaps", () => {
    const w = chooseWearerPosition(fixOf({e: 200, n: 200}, 6), survey, {nowMs: now})
    expect(w.source).toBe("gps")
    expect(distanceM(w.en, {e: 200, n: 200})).toBeLessThan(0.01)
    const s = chooseWearerPosition(fixOf({e: 88, n: 203}, 6), survey, {nowMs: now})
    expect(s.source).toBe("spot")
    expect(s.spotId).toBe("gates-outside")
  })

  test("a confident fix off campus (e.g. a simulated Preview location) keeps the survey position", () => {
    const w = chooseWearerPosition({lat: 37.7749, lon: -122.4194, accuracyM: 5, timestampMs: now}, survey, {nowMs: now})
    expect(w.source).toBe("survey")
    expect(w.reason).toContain("km from campus")
  })

  test("age uses the local receive time when present (fix clock skew ignored)", () => {
    const f = {...fixOf({e: 200, n: 200}, 5), timestampMs: now - 3_600_000, receivedMs: now - 2000}
    expect(chooseWearerPosition(f, survey, {nowMs: now}).source).toBe("gps")
  })
})

describe("footprint geometry", () => {
  test("ray from outside hits Huang's wall; nearest point is on the near edge", () => {
    const b = bearingDeg(outside, at("huang"))
    const hit = rayHitRings(outside, b, huangRings)
    expect(hit).not.toBeNull()
    expect(distanceM(outside, hit!)).toBeLessThan(distanceM(outside, at("huang")))
    expect(rayHitRings(outside, b + 180, huangRings)).toBeNull()
  })

  test("angular offset is 0 inside the footprint's bearing span", () => {
    const b = bearingDeg(outside, at("huang"))
    expect(angularOffset(outside, b, huangRings)).toBe(0)
    expect(angularOffset(outside, b + 120, huangRings)).toBeGreaterThan(30)
  })
})

describe("view cone", () => {
  const me = outside

  test("looking at Gates from outside Huang ranks Gates first, with bearing, distance and nearest point", () => {
    const heading = bearingDeg(me, at("gates"))
    const c = viewConeCandidates(me, heading, {halfAngleDeg: 30, maxDistM: 700})
    expect(c.length).toBeGreaterThan(0)
    const g = c.find((x) => x.id === "gates")!
    expect(g).toBeDefined()
    expect(g.offsetDeg).toBe(0)
    expect(g.hit).not.toBeNull()
    expect(Math.abs(angleDiff(g.bearingDeg, heading))).toBeLessThan(1e-6)
    expect(g.distanceM).toBeLessThan(distanceM(me, at("gates")))
    expect(distanceM(me, g.nearest)).toBeLessThanOrEqual(g.distanceM + 1e-6)
    // Ranked by score, ascending.
    for (let i = 1; i < c.length; i++) expect(c[i].score).toBeGreaterThanOrEqual(c[i - 1].score)
  })

  test("Hoover, nearly due east and 650 m away, is a candidate looking east; nothing behind is", () => {
    const heading = bearingDeg(me, at("hoover"))
    const c = viewConeCandidates(me, heading, {halfAngleDeg: 20, maxDistM: 800, limit: 50})
    expect(c.some((x) => x.id === "hoover")).toBe(true)
    for (const x of c) expect(x.offsetDeg).toBeLessThanOrEqual(20)
  })

  test("excludes the building the wearer stands in and anything nearer than minDistM", () => {
    const c = viewConeCandidates(at("huang"), 0, {halfAngleDeg: 180, maxDistM: 300, limit: 1000, minDistM: 25})
    expect(c.some((x) => x.id === "huang")).toBe(false)
    for (const x of c) expect(distanceM(at("huang"), x.nearest)).toBeGreaterThanOrEqual(25)
  })

  test("standing just outside Huang and facing it identifies Huang (nametag case)", () => {
    const c = viewConeCandidates(me, bearingDeg(me, at("huang")), {halfAngleDeg: 30, maxDistM: 700, limit: 8})
    expect(c[0].id).toBe("huang")
    expect(c[0].distanceM).toBeLessThan(15)
  })

  test("with the component defaults (30°, 700 m, 8), Hoover reaches the Gemini list looking east", () => {
    for (const from of [me, {e: lm("mainquad").east, n: lm("mainquad").north}]) {
      const c = viewConeCandidates(from, bearingDeg(from, at("hoover")), {halfAngleDeg: 30, maxDistM: 700, limit: 8})
      expect(c.length).toBeLessThanOrEqual(8)
      expect(c.some((x) => x.id === "hoover")).toBe(true)
    }
  })

  test("Memorial Church (point-only landmark) appears when looked at", () => {
    const from = {e: lm("memchu").east, n: lm("memchu").north + 120}
    const c = viewConeCandidates(from, 180, {halfAngleDeg: 15, maxDistM: 300, limit: 50})
    const m = c.find((x) => x.id === "memchu")
    expect(m).toBeDefined()
    expect(m!.building).toBe(-1)
  })

  test("unnamed buildings are left out by default and get b<index> ids when included", () => {
    const c = viewConeCandidates(me, 0, {halfAngleDeg: 180, maxDistM: 1100, limit: 2000})
    for (const x of c) expect(x.name.length).toBeGreaterThan(0)
    const all = viewConeCandidates(me, 0, {halfAngleDeg: 180, maxDistM: 1100, limit: 2000, includeUnnamed: true})
    expect(all.length).toBeGreaterThan(c.length)
    expect(all.some((x) => /^b\d+$/.test(x.id))).toBe(true)
  })

  test("fallback takes the top candidate only within 10 degrees", () => {
    const heading = bearingDeg(me, at("gates"))
    const c = viewConeCandidates(me, heading)
    expect(fallbackCandidate(c)!.offsetDeg).toBeLessThanOrEqual(10)
    expect(fallbackCandidate([{...c[0], offsetDeg: 14}])).toBeNull()
    expect(fallbackCandidate([])).toBeNull()
  })

  test("aimAlongBearing moves the aim point along another ray on the same footprint", () => {
    const heading = bearingDeg(me, at("gates"))
    const g = viewConeCandidates(me, heading).find((x) => x.id === "gates")!
    const p = aimAlongBearing(me, g, heading + 1)
    expect(Math.abs(angleDiff(bearingDeg(me, p), heading + 1))).toBeLessThan(1e-6)
  })
})

describe("Gemini reply", () => {
  const ids = ["gates", "packard", "b42"]

  test("accepts a valid candidate, with and without a pixel", () => {
    expect(parseIdentifyReply('{"buildingId":"gates","confidence":0.8,"pixelX":500,"pixelY":420}', ids)).toEqual({ok: true, buildingId: "gates", confidence: 0.8, pixel: {x: 500, y: 420}})
    expect(parseIdentifyReply({buildingId: "packard", confidence: 0.4}, ids)).toEqual({ok: true, buildingId: "packard", confidence: 0.4, pixel: null})
    expect(parseIdentifyReply('```json\n{"buildingId":"none","confidence":0.1}\n```', ids)).toEqual({ok: true, buildingId: "none", confidence: 0.1, pixel: null})
  })

  test("rejects anything else", () => {
    const bad: unknown[] = [
      "not json", null, 42, "[]", {confidence: 0.5},
      {buildingId: "hoover", confidence: 0.9}, // real, but not a candidate
      {buildingId: "Gates", confidence: 0.9}, // case matters
      {buildingId: "gates", confidence: 1.5},
      {buildingId: "gates", confidence: "high"},
      {buildingId: "gates", confidence: 0.5, pixelX: 100},
      {buildingId: "gates", confidence: 0.5, pixelX: 1200, pixelY: 10},
      {buildingId: "gates", confidence: 0.5, pixelX: "1", pixelY: 10}
    ]
    for (const b of bad) expect(parseIdentifyReply(b, ids).ok).toBe(false)
  })

  test("schema enum is the candidate ids plus none", () => {
    const s = identifySchema(ids)
    expect(s.properties.buildingId.enum).toEqual(["gates", "packard", "b42", "none"])
    expect(s.required).toEqual(["buildingId", "confidence"])
  })
})

describe("depth sanity", () => {
  test("rejects the at-the-device point the cache returns without depth", () => {
    expect(acceptDepth(0.1, 40).ok).toBe(false)
    expect(acceptDepth(NaN, 40).ok).toBe(false)
  })
  test("accepts agreement within tolerance, rejects disagreement", () => {
    expect(acceptDepth(36, 40).ok).toBe(true)
    expect(acceptDepth(12, 40).ok).toBe(false)
    expect(acceptDepth(9, 4).ok).toBe(true) // absolute tolerance floor of 8 m
  })
})

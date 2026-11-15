import {describe, expect, test} from "bun:test"
import {PATHS, BakedPath, PATH_BIKE, PATH_FOOT, PATH_ROAD, PATH_ROAD_BIKELANE} from "../Assets/Retrospecs/Data/PathsData"
import {MeshChunk, PATH_Y, PathRibbonOptions, buildPathRibbons, clipPolylineToCircle, dashPolyline, vertexCount} from "../Assets/Retrospecs/Core/MapMesh"
import {KIND_BIKE, KIND_FOOT, KIND_ROAD, KIND_ROAD_BIKELANE, classifyWay, simplifyDP} from "../tools/path-classify"

const OPTS: PathRibbonOptions = {cmPerM: 100 / 600, center: {e: 0, n: 0}, radiusM: 700, roadWidthCm: 1.3, bikeWidthCm: 0.65, footWidthCm: 0.4}

function wellFormed(c: MeshChunk) {
  expect(c.verts.length % 8).toBe(0)
  const n = c.verts.length / 8
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThan(64000)
  expect(c.idx.length % 3).toBe(0)
  let bad = 0
  for (const i of c.idx) if (!(i >= 0 && i < n && Number.isInteger(i))) bad++
  expect(bad).toBe(0)
  let nonFinite = 0
  for (const v of c.verts) if (!Number.isFinite(v)) nonFinite++
  expect(nonFinite).toBe(0)
}

function maxRadius(cs: MeshChunk[]): number {
  let m = 0
  for (const c of cs) for (let i = 0; i < c.verts.length; i += 8) m = Math.max(m, Math.hypot(c.verts[i], c.verts[i + 2]))
  return m
}

function ys(cs: MeshChunk[]): Set<number> {
  const s = new Set<number>()
  for (const c of cs) for (let i = 1; i < c.verts.length; i += 8) s.add(c.verts[i])
  return s
}

describe("path classification", () => {
  test("bike paths", () => {
    expect(classifyWay({highway: "cycleway", bicycle: "designated"})).toBe(KIND_BIKE)
    expect(classifyWay({highway: "cycleway"})).toBe(KIND_BIKE)
    expect(classifyWay({highway: "footway", bicycle: "yes"})).toBe(KIND_BIKE)
    expect(classifyWay({highway: "path", bicycle: "designated"})).toBe(KIND_BIKE)
  })

  test("foot paths", () => {
    expect(classifyWay({highway: "footway"})).toBe(KIND_FOOT)
    expect(classifyWay({highway: "footway", bicycle: "dismount"})).toBe(KIND_FOOT)
    expect(classifyWay({highway: "pedestrian"})).toBe(KIND_FOOT)
  })

  test("roads and bike lanes", () => {
    expect(classifyWay({highway: "residential"})).toBe(KIND_ROAD)
    expect(classifyWay({highway: "tertiary", bicycle: "yes"})).toBe(KIND_ROAD)
    expect(classifyWay({highway: "tertiary", "cycleway:right": "lane"})).toBe(KIND_ROAD_BIKELANE)
    expect(classifyWay({highway: "secondary", cycleway: "lane"})).toBe(KIND_ROAD_BIKELANE)
    expect(classifyWay({highway: "secondary", "cycleway:both": "separate"})).toBe(KIND_ROAD)
  })

  test("parking aisles are optional; steps, corridors and areas are dropped", () => {
    expect(classifyWay({highway: "service", service: "parking_aisle"})).toBe(-1)
    expect(classifyWay({highway: "service", service: "parking_aisle"}, {dropMinorService: false})).toBe(KIND_ROAD)
    expect(classifyWay({highway: "service"})).toBe(KIND_ROAD)
    expect(classifyWay({highway: "steps"})).toBe(-1)
    expect(classifyWay({highway: "corridor"})).toBe(-1)
    expect(classifyWay({highway: "pedestrian", area: "yes"})).toBe(-1)
    expect(classifyWay({building: "yes"})).toBe(-1)
  })

  test("Douglas-Peucker drops collinear points and keeps corners", () => {
    const s = simplifyDP([[0, 0], [1, 0.1], [2, 0], [3, 0], [3, 5]], 1.2)
    expect(s).toEqual([[0, 0], [3, 0], [3, 5]])
  })
})

describe("path ribbons", () => {
  test("baked data has every kind", () => {
    const kinds = new Set(PATHS.map((p) => p[0]))
    for (const k of [PATH_ROAD, PATH_BIKE, PATH_FOOT, PATH_ROAD_BIKELANE]) expect(kinds.has(k)).toBe(true)
    for (const p of PATHS) expect(p[1].length % 2).toBe(0)
  })

  test("real data: stride 8, indices in range, chunks under 64k, inside the radius, y per kind", () => {
    const m = buildPathRibbons(PATHS, OPTS)
    const R = OPTS.radiusM * OPTS.cmPerM
    for (const list of [m.roads, m.bike, m.foot]) {
      expect(list.length).toBeGreaterThan(0)
      for (const c of list) wellFormed(c)
      expect(maxRadius(list)).toBeLessThanOrEqual(R + 1e-6)
    }
    expect([...ys(m.roads)]).toEqual([PATH_Y.road])
    expect([...ys(m.foot)]).toEqual([PATH_Y.foot])
    expect([...ys(m.bike)].sort()).toEqual([PATH_Y.bike, PATH_Y.bikeLane].sort())
    for (const y of [PATH_Y.road, PATH_Y.foot, PATH_Y.bike, PATH_Y.bikeLane]) {
      expect(y).toBeGreaterThan(-0.05)
      expect(y).toBeGreaterThanOrEqual(0.02)
      expect(y).toBeLessThan(0.05) // under the "you are here" ring
    }
    // Budget: the background buildings are ~44k; keep the whole map well under 120k.
    expect(vertexCount(m.roads) + vertexCount(m.bike) + vertexCount(m.foot)).toBeLessThan(60000)
  })

  test("a width of 0 leaves the kind out", () => {
    const m = buildPathRibbons(PATHS, {...OPTS, footWidthCm: 0, roadWidthCm: 0})
    expect(m.foot.length).toBe(0)
    expect(m.roads.length).toBe(0)
    expect(m.bike.length).toBeGreaterThan(0)
  })

  test("a path crossing the disc is cut at the edge; one fully outside makes nothing", () => {
    // East-west road through the centre, from 1000 m west to 1000 m east (decimetres).
    const through: BakedPath = [PATH_ROAD, [-10000, 0, 10000, 0]]
    const outside: BakedPath = [PATH_ROAD, [9000, 9000, 9500, 9000]]
    const m = buildPathRibbons([through, outside], OPTS)
    expect(m.roads.length).toBe(1)
    const c = m.roads[0]
    wellFormed(c)
    expect(c.verts.length / 8).toBe(4) // one straight quad
    const R = OPTS.radiusM * OPTS.cmPerM
    let maxX = -Infinity, minX = Infinity
    for (let i = 0; i < c.verts.length; i += 8) {
      maxX = Math.max(maxX, c.verts[i])
      minX = Math.min(minX, c.verts[i])
      expect(Math.abs(Math.abs(c.verts[i + 2]) - 0.65)).toBeLessThan(1e-3) // half of 1.3 cm either side (cap tips clamped to R)
    }
    expect(maxX).toBeGreaterThan(R - 0.1)
    expect(maxX).toBeLessThanOrEqual(R)
    expect(minX).toBeLessThan(-(R - 0.1))
    expect(buildPathRibbons([outside], OPTS).roads.length).toBe(0)
  })

  test("the clip is around the wearer, not the origin", () => {
    const short: BakedPath = [PATH_BIKE, [0, 0, 100, 0]] // 10 m at the origin
    expect(buildPathRibbons([short], {...OPTS, center: {e: 0, n: 0}}).bike.length).toBe(1)
    expect(buildPathRibbons([short], {...OPTS, center: {e: 800, n: 0}}).bike.length).toBe(0)
  })

  test("clipPolylineToCircle splits a path that leaves and re-enters", () => {
    const runs = clipPolylineToCircle([[-20, 0], [0, 20], [20, 0]], 15)
    expect(runs.length).toBe(2)
    for (const r of runs) for (const p of r) expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(15 + 1e-9)
  })

  test("sharp corners and duplicate points stay finite", () => {
    const hairpin: BakedPath = [PATH_ROAD, [0, 0, 500, 0, 500, 0, 0, 30, 0, 30]]
    const m = buildPathRibbons([hairpin], OPTS)
    for (const c of m.roads) wellFormed(c)
  })

  test("bike-lane stripes are dashed with the phase carried round corners", () => {
    const d = dashPolyline([[0, 0], [1.8, 0], [1.8, 2.0]], 0.8, 0.6)
    // 0-0.8 on, 0.8-1.4 off, 1.4-2.2 on (turns the corner at 1.8), 2.2-2.8 off, 2.8-3.6 on, 3.6-3.8 off.
    expect(d.length).toBe(3)
    expect(d[1].length).toBe(3)
    const lane: BakedPath = [PATH_ROAD_BIKELANE, [0, 0, 1000, 0]] // 100 m = 16.7 cm
    const m = buildPathRibbons([lane], OPTS)
    expect(m.roads.length).toBe(1)
    expect(vertexCount(m.bike)).toBe(4 * Math.ceil(16.6667 / 1.4))
    expect(buildPathRibbons([lane], {...OPTS, bikeWidthCm: 0}).bike.length).toBe(0)
  })
})

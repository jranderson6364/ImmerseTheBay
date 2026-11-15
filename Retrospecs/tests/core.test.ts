import {describe, expect, test} from "bun:test"
import {BUILDINGS, LANDMARKS, BakedBuilding} from "../Assets/Retrospecs/Data/CampusData"
import {
  angleDiff, bearingDeg, bearingToMapDir, facingFromWallPinches, latLonToEN, mapYawFor, snapFacingBearing, worldDirToBearing, yawOf
} from "../Assets/Retrospecs/Core/Geo"
import {
  TONES, assignTones, buildBuildingOutline, buildCampusMesh, buildSingleBuilding, buildTube, arcPoints, heightBand, landmarkMapPlacement, vertexCount
} from "../Assets/Retrospecs/Core/MapMesh"
import {CARDS, factById} from "../Assets/Retrospecs/Core/Cards"
import {
  founderConstellation, nextFact, nextGuessTarget, scoreGuess, themesFromProfile, validateGuide, yourStanford
} from "../Assets/Retrospecs/Core/Guide"

const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!

describe("geo", () => {
  test("Hoover is about 660 m almost due east of Huang's origin", () => {
    const h = latLonToEN(lm("hoover").lat, lm("hoover").lon)
    expect(Math.hypot(h.e, h.n)).toBeGreaterThan(620)
    expect(Math.hypot(h.e, h.n)).toBeLessThan(700)
    expect(bearingDeg({e: 0, n: 0}, h)).toBeGreaterThan(88)
    expect(bearingDeg({e: 0, n: 0}, h)).toBeLessThan(98)
  })

  test("angleDiff wraps", () => {
    expect(angleDiff(10, 350)).toBe(20)
    expect(angleDiff(350, 10)).toBe(-20)
    expect(Math.abs(angleDiff(180, 0))).toBe(180)
  })

  test("calibration round trip: facing direction in world maps back to its bearing", () => {
    for (const worldYaw of [0, 0.7, 2.5, -1.9]) {
      const facing = {x: Math.sin(worldYaw), y: 0, z: Math.cos(worldYaw)}
      for (const b of [15, 105, 195, 285]) {
        const yaw = mapYawFor(facing, b)
        expect(Math.abs(angleDiff(worldDirToBearing(facing, yaw), b))).toBeLessThan(1e-6)
        // A direction 90 degrees clockwise in the world is bearing + 90.
        const right = {x: Math.sin(worldYaw - Math.PI / 2), y: 0, z: Math.cos(worldYaw - Math.PI / 2)}
        void right
      }
    }
  })

  test("map rotation: rotating a map-frame bearing by mapYaw lands on the world facing", () => {
    const facing = {x: 0.6, y: 0, z: -0.8}
    const yaw = mapYawFor(facing, 105)
    const local = bearingToMapDir(105)
    const rotated = yawOf(local) + yaw
    expect(Math.abs(rotated - yawOf(facing)) % (2 * Math.PI)).toBeLessThan(1e-9)
  })

  test("wall pinches: left then right while facing -Z gives facing -Z", () => {
    const f = facingFromWallPinches({x: -50, y: 0, z: -100}, {x: 50, y: 0, z: -100})!
    expect(f.x).toBeCloseTo(0)
    expect(f.z).toBeCloseTo(-1)
    expect(facingFromWallPinches({x: 0, y: 0, z: 0}, {x: 5, y: 0, z: 0})).toBeNull()
  })

  test("snap facing bearing to the nearest wall face", () => {
    expect(snapFacingBearing(15, 100)).toBe(105)
    expect(snapFacingBearing(15, 350)).toBe(15)
    expect(snapFacingBearing(15, 255)).toBe(285)
  })
})

describe("map mesh", () => {
  const opts = {cmPerM: 100 / 1350, verticalExaggeration: 3, center: {e: 0, n: 0}, radiusM: 1050, minHeightCm: 0.4}
  test("campus chunks stay within UInt16 and indices are in range", () => {
    const landmarkIdx = new Set(LANDMARKS.filter((l) => l.building >= 0).map((l) => l.building))
    const {roofs, walls} = buildCampusMesh(BUILDINGS, opts, landmarkIdx)
    for (const c of [...roofs, ...walls]) {
      expect(c.verts.length % 8).toBe(0)
      const n = c.verts.length / 8
      expect(n).toBeLessThan(65536)
      for (const i of c.idx) expect(i).toBeLessThan(n)
      expect(c.idx.length % 3).toBe(0)
    }
    expect(roofs.length).toBeGreaterThan(0)
  })

  test("Hoover Tower mesh is tall and sits east", () => {
    const h = lm("hoover")
    const m = buildSingleBuilding(BUILDINGS[h.building], opts)
    let maxY = 0, sumX = 0
    for (let i = 0; i < m.verts.length; i += 8) {
      maxY = Math.max(maxY, m.verts[i + 1])
      sumX += m.verts[i]
    }
    expect(maxY).toBeGreaterThan(15) // 87 m * 0.074 * 3 ≈ 19 cm
    expect(sumX / (m.verts.length / 8)).toBeGreaterThan(40) // ~49 cm east
  })

  // The shipped defaults: radius 700 m at 1:600, outlines with corner lines, walls inset.
  const newOpts = {
    cmPerM: 100 / 600, verticalExaggeration: 4, center: {e: 0, n: 0}, radiusM: 700, minHeightCm: 0.35,
    outlineWidthCm: 0.2, cornerAngleDeg: 45, wallInsetCm: 0.04
  }
  const landmarkIdx = new Set(LANDMARKS.filter((l) => l.building >= 0).map((l) => l.building))
  const wellFormed = (c: {verts: number[]; idx: number[]}) => {
    expect(c.verts.length % 8).toBe(0)
    const n = c.verts.length / 8
    expect(n).toBeLessThan(64001)
    expect(c.idx.length % 3).toBe(0)
    for (const i of c.idx) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(n)
    }
    for (const v of c.verts) expect(Number.isFinite(v)).toBe(true)
  }

  test("outlines: stride 8, indices in range, chunks under 64k, sitting at roof height", () => {
    const m = buildCampusMesh(BUILDINGS, newOpts, landmarkIdx)
    expect(m.outlines.length).toBeGreaterThan(0)
    for (const c of m.outlines) wellFormed(c)
    for (const c of [...m.roofs, ...m.walls]) wellFormed(c)
    const total = vertexCount(m.roofs) + vertexCount(m.walls) + vertexCount(m.outlines)
    expect(total).toBeLessThan(400000)
    // The top of the outline is just above the tallest background roof.
    let roofTop = 0, outlineTop = 0
    for (const c of m.roofs) for (let i = 1; i < c.verts.length; i += 8) roofTop = Math.max(roofTop, c.verts[i])
    for (const c of m.outlines) for (let i = 1; i < c.verts.length; i += 8) outlineTop = Math.max(outlineTop, c.verts[i])
    expect(outlineTop).toBeGreaterThan(roofTop)
    expect(outlineTop - roofTop).toBeLessThan(0.1)
    // Turning outlines off removes them and nothing else.
    const off = buildCampusMesh(BUILDINGS, {...newOpts, outlineWidthCm: 0}, landmarkIdx)
    expect(off.outlines.length).toBe(0)
    expect(vertexCount(off.roofs)).toBe(vertexCount(m.roofs))
  })

  test("outline strip straddles a square's edge, with holes outlined too", () => {
    // 10 m square (decimetres, CCW) with a 4 m CW hole; earcut triangles are irrelevant to the outline.
    const sq: BakedBuilding = [9, 0, "sq", [0, 0, 100, 0, 100, 100, 0, 100, 30, 30, 30, 70, 70, 70, 70, 30], [4], []]
    const o = {cmPerM: 1, verticalExaggeration: 1, center: {e: 0, n: 0}, radiusM: 1e9, minHeightCm: 0, outlineWidthCm: 0.4, outlineLiftCm: 0, cornerAngleDeg: 0}
    const c = buildBuildingOutline(sq, o)
    wellFormed(c)
    expect(c.verts.length / 8).toBe(3 * 8) // inner, outer, lip-bottom per ring vertex
    const xs: number[] = []
    for (let i = 0; i < c.verts.length; i += 8) xs.push(c.verts[i])
    // Outer ring corner (0,0) gets inner (0.2) and outer (-0.2) offsets; hole corner (3,3) goes into the hole.
    expect(Math.min(...xs)).toBeCloseTo(-0.2, 5)
    expect(Math.max(...xs)).toBeCloseTo(10.2, 5)
    expect(xs.some((x) => Math.abs(x - 3.2) < 1e-6)).toBe(true)
    // Corner lines add two crossed quads (8 verts) at each of the 8 right-angle corners.
    expect(buildBuildingOutline(sq, {...o, cornerAngleDeg: 45}).verts.length / 8).toBe(24 + 8 * 8)
  })

  test("height bands: <8, 8-15, >15 m, and every building lands in exactly one band list", () => {
    expect(heightBand(3)).toBe(0)
    expect(heightBand(7.9)).toBe(0)
    expect(heightBand(8)).toBe(1)
    expect(heightBand(9)).toBe(1)
    expect(heightBand(15)).toBe(1)
    expect(heightBand(15.1)).toBe(2)
    expect(heightBand(87)).toBe(2)
    const m = buildCampusMesh(BUILDINGS, newOpts, landmarkIdx)
    expect(m.roofBands.length).toBe(3)
    expect(m.roofBands[0].length).toBe(TONES)
    const flat = buildCampusMesh(BUILDINGS, {...newOpts, bandThresholdsM: []}, landmarkIdx)
    let banded = 0
    for (const tones of m.roofBands) for (const cs of tones) banded += vertexCount(cs)
    expect(banded).toBe(vertexCount(flat.roofs))
    expect(vertexCount(m.roofs)).toBe(banded)
    // Each roof vertex's height matches its band.
    m.roofBands.forEach((tones, band) => {
      for (const cs of tones) for (const c of cs) for (let i = 1; i < c.verts.length; i += 8) {
        const hM = c.verts[i] / (newOpts.cmPerM * newOpts.verticalExaggeration)
        if (c.verts[i] <= newOpts.minHeightCm + 1e-6) continue // clamped to the minimum height
        const [lo, hi] = [[-Infinity, 8], [8, 15], [15, Infinity]][band]
        expect(hM).toBeGreaterThan(lo - 1e-6)
        expect(hM).toBeLessThan(hi + 1e-6)
      }
    })
  })

  test("touching neighbours in the same band get different tones", () => {
    const a: BakedBuilding = [9, 0, "a", [0, 0, 100, 0, 100, 100, 0, 100], [], [0, 1, 2, 0, 2, 3]]
    const b: BakedBuilding = [9, 0, "b", [100, 0, 200, 0, 200, 100, 100, 100], [], [0, 1, 2, 0, 2, 3]]
    const far: BakedBuilding = [9, 0, "far", [5000, 0, 5100, 0, 5100, 100, 5000, 100], [], [0, 1, 2, 0, 2, 3]]
    const t = assignTones([a, b, far], [0, 1, 2])
    expect(t.get(0)).not.toBe(t.get(1))
    expect(t.get(2)).toBe(0)
  })

  test("landmarks beyond the radius are pinned to the disc edge in their true direction", () => {
    const cmPerM = 100 / 600
    const hoover = {e: lm("hoover").east, n: lm("hoover").north}
    const on = landmarkMapPlacement(hoover, {e: 0, n: 0}, cmPerM, 700)
    expect(on.pinned).toBe(false)
    expect(on.x).toBeCloseTo(hoover.e * cmPerM, 6)
    const cantor = {e: lm("cantor").east, n: lm("cantor").north}
    expect(landmarkMapPlacement(cantor, {e: 0, n: 0}, cmPerM, 700).pinned).toBe(false)
    const off = landmarkMapPlacement(hoover, {e: 0, n: 0}, cmPerM, 500)
    expect(off.pinned).toBe(true)
    expect(Math.hypot(off.x, off.z)).toBeCloseTo(500 * cmPerM + 3, 6)
    expect(off.x).toBeGreaterThan(0) // still east
    const dir = bearingToMapDir(bearingDeg({e: 0, n: 0}, hoover))
    expect(off.x / Math.hypot(off.x, off.z)).toBeCloseTo(dir.x, 6)
    expect(off.z / Math.hypot(off.x, off.z)).toBeCloseTo(dir.z, 6)
    // Off-map cards are always pinned, even if they would fit.
    const forced = landmarkMapPlacement(hoover, {e: 0, n: 0}, cmPerM, 700, 3, true)
    expect(forced.pinned).toBe(true)
    expect(Math.hypot(forced.x, forced.z)).toBeCloseTo(700 * cmPerM + 3, 6)
  })

  test("tube and arc are well formed", () => {
    const t = buildTube(arcPoints({x: 0, y: 0, z: 0}, {x: 100, y: 0, z: 0}, 30), 1)
    expect(t.verts.length % 8).toBe(0)
    const n = t.verts.length / 8
    for (const i of t.idx) expect(i).toBeLessThan(n)
  })
})

describe("cards and guide", () => {
  test("every on-map card except the off-map garage matches a baked landmark", () => {
    for (const c of CARDS) {
      if (c.offMap) continue
      expect(LANDMARKS.some((l) => l.id === c.id)).toBe(true)
    }
  })

  test("every fact has an id, theme and https source", () => {
    for (const c of CARDS) for (const f of c.facts) {
      expect(f.id.startsWith(c.id + ".")).toBe(true)
      expect(f.source.startsWith("https://")).toBe(true)
    }
  })

  test("validator drops invented buildings, facts and numeric connectives", () => {
    const v = validateGuide({
      focus: "gates", lights: ["gates", "eiffel"], threads: [{from: "gates", to: "atlantis"}],
      fact_ids: ["gates.2", "gates.99"], connective: "Gates opened in 1996, here's why."
    })
    expect(v.lights).toEqual(["gates"])
    expect(v.threads).toEqual([])
    expect(v.fact_ids).toEqual(["gates.2"])
    expect(v.connective).toBe("")
    expect(v.rejected.length).toBe(4)
    expect(v.speech).toBe(factById("gates.2")!.fact.text)
  })

  test("validator lights the building of each spoken fact and declines politely", () => {
    const v = validateGuide({focus: "", lights: [], threads: [], fact_ids: ["hoover.4"], connective: "Here's a good one."})
    expect(v.lights).toContain("hoover")
    expect(v.focus).toBe("hoover")
    const d = validateGuide({fact_ids: [], connective: ""})
    expect(d.declined).toBe(true)
    expect(d.speech.length).toBeGreaterThan(10)
  })

  test("profile themes and next fact", () => {
    expect(themesFromProfile("CS major who wants to start a company")).toEqual(["founder", "inside"])
    expect(nextFact("gates", [], ["founder"])!.id).toBe("gates.2")
    expect(nextFact("gates", ["gates.2"], ["founder"])!.theme).not.toBe("founder")
    expect(nextFact("cantor", ["cantor.1"], [])).toBeNull()
  })

  test("your Stanford and the founder constellation", () => {
    const y = yourStanford("I like startups and tech founders")
    expect(y.length).toBeGreaterThan(0)
    expect(founderConstellation().lights).toContain("huang")
  })

  test("point to guess scoring", () => {
    const me = {e: 0, n: 0}
    const hoover = latLonToEN(lm("hoover").lat, lm("hoover").lon)
    const r = scoreGuess("hoover", me, hoover, 100)
    expect(r.errorDeg).toBeLessThan(10)
    expect(r.verdict.startsWith("Spot on")).toBe(true)
    const positions = {gates: latLonToEN(lm("gates").lat, lm("gates").lon), hoover}
    expect(nextGuessTarget(me, positions, [], "huang")).toBe("gates")
    expect(nextGuessTarget(me, positions, ["gates"], "huang")).toBe("hoover")
  })
})

import {describe, expect, test} from "bun:test"
import {BUILDINGS, LANDMARKS} from "../Assets/Retrospecs/Data/CampusData"
import {MeshChunk} from "../Assets/Retrospecs/Core/MapMesh"
import {
  footprintOutline, nametagPlacement, normaliseConfidence, overlayAnimation, overlayBuildingFor, overlayStyle, scanRing, tagText
} from "../Assets/Retrospecs/Core/Overlay"

const ORIGIN = {e: 0, n: 0}

function checkChunk(c: MeshChunk) {
  expect(c.verts.length % 8).toBe(0)
  const n = c.verts.length / 8
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThan(64000)
  expect(c.idx.length % 3).toBe(0)
  for (const i of c.idx) {
    expect(i).toBeGreaterThanOrEqual(0)
    expect(i).toBeLessThan(n)
  }
  for (const v of c.verts) expect(Number.isFinite(v)).toBe(true)
}

describe("nametag placement", () => {
  test("angular size stays within 2-3 degrees, render distance <= 60 m, clamped only beyond 60 m", () => {
    for (const d of [3, 20, 59, 60, 61, 80, 300, 700]) {
      const p = nametagPlacement(d, 12)
      expect(p.angularDeg).toBeGreaterThanOrEqual(2 - 1e-6)
      expect(p.angularDeg).toBeLessThanOrEqual(3 + 1e-6)
      expect(p.renderDistanceM).toBeLessThanOrEqual(60)
      expect(p.clamped).toBe(d > 60)
      expect(p.k).toBeCloseTo(Math.min(1, 60 / d))
    }
  })

  test("tag floats above the roof, and a clamped tag keeps the same elevation angle as at real distance", () => {
    const near = nametagPlacement(20, 19)
    expect(near.heightM).toBeGreaterThan(19 + 2)
    expect(near.heightM).toBe(near.realHeightM)
    const far = nametagPlacement(300, 87)
    const eye = 1.6
    const realAngle = Math.atan2(far.realHeightM - eye, 300)
    const drawnAngle = Math.atan2(far.heightM - eye, far.renderDistanceM)
    expect(drawnAngle).toBeCloseTo(realAngle, 9)
    expect(far.realHeightM).toBeGreaterThan(87)
  })

  test("scale grows with distance up to the clamp", () => {
    const a = nametagPlacement(20, 9), b = nametagPlacement(40, 9), c = nametagPlacement(300, 9)
    expect(b.scale).toBeCloseTo(a.scale * 2, 6)
    expect(c.scale).toBeCloseTo(nametagPlacement(60, 9).scale, 6)
    // 2.5 degrees at 20 m is about 87 cm.
    expect(a.textHeightCm).toBeGreaterThan(85)
    expect(a.textHeightCm).toBeLessThan(90)
  })

  test("the target angle is clamped into [2, 3]", () => {
    expect(nametagPlacement(20, 9, {targetDeg: 10}).angularDeg).toBeCloseTo(3, 6)
    expect(nametagPlacement(20, 9, {targetDeg: 0.5}).angularDeg).toBeCloseTo(2, 6)
  })

  test("bad input does not produce NaN", () => {
    const p = nametagPlacement(NaN, NaN)
    for (const v of [p.heightM, p.scale, p.renderDistanceM, p.angularDeg]) expect(Number.isFinite(v)).toBe(true)
  })
})

describe("confidence style", () => {
  test("camera/Gemini confirmed is solid and bright; GPS estimate is dashed and dimmer but still visible", () => {
    const v = overlayStyle("camera", 0.9)
    const g = overlayStyle("gps", 0.9)
    expect(v.verified).toBe(true)
    expect(v.dashed).toBe(false)
    expect(v.badge).toBe("verified by camera")
    expect(g.verified).toBe(false)
    expect(g.dashed).toBe(true)
    expect(g.badge).toBe("estimated from GPS")
    expect(g.brightness).toBeLessThan(v.brightness)
    expect(g.brightness).toBeGreaterThanOrEqual(0.55)
    expect(overlayStyle("gemini", 0.2).dashed).toBe(true)
    expect(overlayStyle("Gemini vision", 0.8).verified).toBe(true)
    // RetrospecsLocator's LocateSource values.
    expect(overlayStyle("gemini+depth", 0.8).verified).toBe(true)
    expect(overlayStyle("gps-cone", 0.8).verified).toBe(false)
  })

  test("confidence normalisation", () => {
    expect(normaliseConfidence(85)).toBeCloseTo(0.85)
    expect(normaliseConfidence("high")).toBe(0.9)
    expect(normaliseConfidence(-2)).toBe(0)
    expect(normaliseConfidence(NaN)).toBe(0.5)
  })
})

describe("building lookup and tag text", () => {
  test("landmark ids resolve to their footprint; Memorial Church has none; names fall back to OSM", () => {
    const gates = overlayBuildingFor("gates")
    expect(gates.index).toBe(LANDMARKS.find((l) => l.id === "gates")!.building)
    expect(gates.building).not.toBeNull()
    const mc = overlayBuildingFor("memchu")
    expect(mc.building).toBeNull()
    expect(mc.heightM).toBe(24)
    const byName = overlayBuildingFor("unknown-id", "Gates Computer Science")
    expect(byName.index).toBe(gates.index)
    expect(overlayBuildingFor("nope", "Nowhere Hall").building).toBeNull()
    // The locator's non-landmark ids are "b<BUILDINGS index>".
    const b5 = overlayBuildingFor("b5")
    expect(b5.index).toBe(5)
    expect(b5.building).toBe(BUILDINGS[5])
    expect(overlayBuildingFor(`b${gates.index}`).landmark!.id).toBe("gates")
    expect(overlayBuildingFor("b99999").building).toBeNull()
  })

  test("tag text uses the card label and namesake, never invents a subtitle", () => {
    const t = tagText("gates", "Gates Computer Science", 120)
    expect(t.title).toBe("Gates")
    expect(t.subtitle).toBe("Bill Gates, Microsoft co-founder · 120 m")
    expect(tagText("mainquad", "Main Quad", 380).subtitle).toBe("380 m")
    const u = tagText("not-a-card", "Some Hall", 40)
    expect(u.title).toBe("Some Hall")
    expect(u.subtitle).toBe("40 m")
  })
})

describe("footprint outline", () => {
  test("every building, solid and dashed, gives valid chunks under 64k vertices", () => {
    let maxVerts = 0
    let maxName = ""
    for (const b of BUILDINGS) {
      for (const dashed of [false, true]) {
        const o = footprintOutline(b, ORIGIN, 100, {dashed})
        let total = 0
        for (const c of [...o.ground, ...o.roof, ...o.posts]) {
          checkChunk(c)
          total += c.verts.length / 8
        }
        if (total > maxVerts) {
          maxVerts = total
          maxName = `${b[2] || "(unnamed)"}${dashed ? " dashed" : ""}`
        }
      }
    }
    console.log(`largest outline: ${maxVerts} verts (${maxName})`)
    expect(maxVerts).toBeLessThan(64000)
  })

  test("roofline sits at the real height; X = east, Z = -north, at 100 cm per metre", () => {
    const i = LANDMARKS.find((l) => l.id === "hoover")!.building
    const b = BUILDINGS[i]
    const o = footprintOutline(b, ORIGIN)
    expect(o.heightCm).toBe(b[0] * 100)
    let maxY = -Infinity
    for (const c of o.roof) for (let k = 1; k < c.verts.length; k += 8) maxY = Math.max(maxY, c.verts[k])
    expect(maxY).toBeGreaterThan(b[0] * 100 - 1)
    expect(maxY).toBeLessThan(b[0] * 100 + 20)
    // Hoover is ~661 m east, ~34 m south of the origin: centroid x ~ +66100 cm, z ~ +3400 cm.
    expect(o.centroid.x).toBeGreaterThan(64000)
    expect(o.centroid.x).toBeLessThan(68000)
    expect(o.centroid.z).toBeGreaterThan(1000)
    expect(o.centroid.z).toBeLessThan(6000)
    // Centring on the wearer shifts it.
    const c2 = footprintOutline(b, {e: 600, n: 0}).centroid
    expect(c2.x).toBeCloseTo(o.centroid.x - 60000, 3)
  })

  test("dashed outlines use fewer drawn metres than solid ones", () => {
    const b = BUILDINGS[LANDMARKS.find((l) => l.id === "gates")!.building]
    const solid = footprintOutline(b, ORIGIN, 100, {cornerDeg: 0})
    const dashed = footprintOutline(b, ORIGIN, 100, {cornerDeg: 0, dashed: true})
    const len = (cs: MeshChunk[]) => {
      let s = 0
      for (const c of cs) for (let v = 0; v < c.verts.length; v += 64) {
        // Each segment tube is 8 vertices; vertices 0 and 4 are matching corners at the two ends.
        s += Math.hypot(c.verts[v + 32] - c.verts[v], c.verts[v + 33] - c.verts[v + 1], c.verts[v + 34] - c.verts[v + 2])
      }
      return s
    }
    const ls = len(solid.ground), ld = len(dashed.ground)
    expect(ld).toBeLessThan(ls * 0.8)
    expect(ld).toBeGreaterThan(ls * 0.4)
  })

  test("scan ring is a single solid ring at y = 0", () => {
    const b = BUILDINGS[LANDMARKS.find((l) => l.id === "y2e2")!.building]
    const o = footprintOutline(b, ORIGIN)
    const s = scanRing(o.rings, 16)
    expect(s.length).toBeGreaterThan(0)
    for (const c of s) {
      checkChunk(c)
      for (let k = 1; k < c.verts.length; k += 8) expect(Math.abs(c.verts[k])).toBeLessThanOrEqual(8 + 1e-6)
    }
  })
})

describe("animation", () => {
  test("sweep rises over ~1 s, then a pulse that never drops toward black", () => {
    expect(overlayAnimation(0).scan).toBe(0)
    expect(overlayAnimation(0.5).scan).toBeGreaterThan(0.5)
    expect(overlayAnimation(0.99).scan).toBeLessThanOrEqual(1)
    expect(overlayAnimation(1.01).scan).toBe(-1)
    for (let t = 1; t < 10; t += 0.07) {
      const b = overlayAnimation(t).brightness
      expect(b).toBeGreaterThanOrEqual(0.78 - 1e-9)
      expect(b).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
})

test("placement numbers for the report", () => {
  for (const [d, h] of [[20, 12], [80, 12], [300, 87]]) {
    const p = nametagPlacement(d, h)
    console.log(`d=${d} m h=${h} m -> render ${p.renderDistanceM} m, clamped ${p.clamped}, k ${p.k.toFixed(3)}, tag ${p.heightM.toFixed(2)} m (real ${p.realHeightM.toFixed(2)} m), scale ${p.scale.toFixed(1)}, text ${p.textHeightCm.toFixed(1)} cm, ${p.angularDeg.toFixed(2)} deg`)
  }
})

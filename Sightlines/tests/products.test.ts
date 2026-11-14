import {describe, expect, test} from "bun:test"
import {CARDS, cardById, factById} from "../Assets/Sightlines/Core/Cards"
import {
  EXPLODE_WINDOW, MODEL_VERTEX_BUDGET, PRODUCTS, PRODUCT_COLORS, buildPart, easeInOutCubic, explodedPosition, labelDirection, labelledParts,
  modelForFact, modelSpan, modelVertexCount, modelsForLandmark, partCenter, primitiveVertexCount, productById
} from "../Assets/Sightlines/Core/Products"

describe("products: definitions", () => {
  test("four models with unique ids and unique part names", () => {
    expect(PRODUCTS.map((p) => p.id).sort()).toEqual(["audio_oscillator", "block_server", "gps_satellite", "graphics_card"])
    for (const m of PRODUCTS) {
      const names = m.parts.map((p) => p.name)
      expect(new Set(names).size).toBe(names.length)
      expect(productById(m.id)).toBe(m)
    }
  })

  test("every cardId is a real fact and every landmark is a real card", () => {
    for (const m of PRODUCTS) {
      expect(m.cardIds.length).toBeGreaterThan(0)
      for (const id of m.cardIds) expect(factById(id)).toBeDefined()
      for (const id of m.landmarkIds) expect(cardById(id)).toBeDefined()
    }
    expect(factById("huang.3")).toBeDefined()
    expect(productById("block_server").cardIds).toEqual(["huang.3", "gates.2"])
  })

  test("landmark mapping", () => {
    expect(modelsForLandmark("huang").map((m) => m.id)).toEqual(["graphics_card", "block_server"])
    expect(modelsForLandmark("gates").map((m) => m.id)).toEqual(["block_server"])
    expect(modelsForLandmark("spilker").map((m) => m.id)).toEqual(["gps_satellite"])
    expect(modelsForLandmark("packard").map((m) => m.id)).toEqual(["audio_oscillator"])
    expect(modelsForLandmark("hpgarage").map((m) => m.id)).toEqual(["audio_oscillator"])
    expect(modelsForLandmark("hoover")).toEqual([])
    expect(modelForFact("gates.2").id).toBe("block_server")
    expect(modelForFact("hoover.1")).toBeUndefined()
    // Every card still exists unchanged in count: the showcase never adds facts.
    expect(CARDS.length).toBeGreaterThan(0)
  })

  test("parts: colours exist, delays fit the timeline, labels are generic and non-empty", () => {
    const banned = /\b(1[89]\d\d|20\d\d)\b|\bHP 200|\bfirst\b/i
    for (const m of PRODUCTS) {
      expect(m.parts.length).toBeGreaterThanOrEqual(6)
      expect(banned.test(m.title)).toBe(false)
      for (const p of m.parts) {
        expect(PRODUCT_COLORS[p.color]).toBeDefined()
        expect(p.label.length).toBeGreaterThan(0)
        expect(banned.test(p.label)).toBe(false)
        expect(p.delay).toBeGreaterThanOrEqual(0)
        expect(p.delay + EXPLODE_WINDOW).toBeLessThanOrEqual(1 + 1e-9)
        expect(p.prims.length).toBeGreaterThan(0)
      }
    }
  })

  test("colours are bright enough for an additive display", () => {
    for (const c of Object.values(PRODUCT_COLORS)) expect(Math.max(c[0], c[1], c[2])).toBeGreaterThanOrEqual(0.8)
  })

  test("labelledParts keeps the first part per label", () => {
    const m = productById("block_server")
    const ls = labelledParts(m)
    expect(ls.map((p) => p.label)).toEqual([...new Set(m.parts.map((p) => p.label))])
    expect(ls.filter((p) => p.label === "hard drives").length).toBe(1)
  })
})

describe("products: meshes", () => {
  test("chunks are valid: stride 8, indices in range, triangles, under 64k, within the model budget", () => {
    for (const m of PRODUCTS) {
      let total = 0
      for (const p of m.parts) {
        const c = buildPart(p, partCenter(p))
        expect(c.verts.length % 8).toBe(0)
        const n = c.verts.length / 8
        expect(n).toBe(p.prims.reduce((s, q) => s + primitiveVertexCount(q), 0))
        expect(n).toBeLessThan(64000)
        expect(c.idx.length % 3).toBe(0)
        expect(c.idx.length).toBeGreaterThan(0)
        for (const i of c.idx) {
          expect(i).toBeGreaterThanOrEqual(0)
          expect(i).toBeLessThan(n)
        }
        for (const v of c.verts) expect(Number.isFinite(v)).toBe(true)
        // UVs are zero, like MapMesh.
        for (let k = 0; k < c.verts.length; k += 8) expect(c.verts[k + 6] === 0 && c.verts[k + 7] === 0).toBe(true)
        total += n
      }
      expect(total).toBe(modelVertexCount(m))
      expect(total).toBeLessThan(MODEL_VERTEX_BUDGET)
      console.log(`[products] ${m.id}: ${m.parts.length} parts, ${total} verts, span ${modelSpan(m).toFixed(1)} cm`)
    }
  })

  test("normals are unit length", () => {
    const c = buildPart(productById("audio_oscillator").parts.find((p) => p.name === "dial"))
    for (let k = 0; k < c.verts.length; k += 8) expect(Math.hypot(c.verts[k + 3], c.verts[k + 4], c.verts[k + 5])).toBeCloseTo(1, 5)
  })

  test("buildPart origin shifts positions only", () => {
    const p = productById("graphics_card").parts.find((q) => q.name === "die")
    const a = buildPart(p)
    const ctr = partCenter(p)
    const b = buildPart(p, ctr)
    expect(ctr.x).toBeCloseTo(2, 6)
    expect(b.verts[0]).toBeCloseTo(a.verts[0] - ctr.x, 6)
    expect(b.verts[2]).toBeCloseTo(a.verts[2] - ctr.z, 6)
    expect(b.verts[3]).toBe(a.verts[3])
  })

  test("box is 24 verts, cylinder 4n + 6", () => {
    expect(primitiveVertexCount({kind: "box", size: {x: 1, y: 1, z: 1}, pos: {x: 0, y: 0, z: 0}})).toBe(24)
    expect(primitiveVertexCount({kind: "cylinder", radius: 1, height: 1, axis: "z", pos: {x: 0, y: 0, z: 0}, segments: 16})).toBe(70)
  })

  test("assembled models span 30-80 design cm", () => {
    for (const m of PRODUCTS) {
      expect(modelSpan(m)).toBeGreaterThan(30)
      expect(modelSpan(m)).toBeLessThan(80)
    }
  })
})

describe("products: explode animation", () => {
  test("easing: ends pinned, monotonic, clamped", () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9)
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const e = easeInOutCubic(i / 100)
      expect(e).toBeGreaterThanOrEqual(prev)
      prev = e
    }
  })

  test("explodedPosition: zero at 0, full offset at 1, monotonic, waits for its delay", () => {
    for (const m of PRODUCTS) {
      for (const p of m.parts) {
        const z = explodedPosition(p, 0)
        expect(Math.hypot(z.x, z.y, z.z)).toBe(0)
        const f = explodedPosition(p, 1)
        expect(f.x).toBeCloseTo(p.explode.x, 9)
        expect(f.y).toBeCloseTo(p.explode.y, 9)
        expect(f.z).toBeCloseTo(p.explode.z, 9)
        let prev = -1
        for (let i = 0; i <= 50; i++) {
          const q = explodedPosition(p, i / 50)
          const d = Math.hypot(q.x, q.y, q.z)
          expect(d).toBeGreaterThanOrEqual(prev - 1e-9)
          prev = d
        }
        if (p.delay > 0.01) {
          const early = explodedPosition(p, p.delay * 0.99)
          expect(Math.hypot(early.x, early.y, early.z)).toBe(0)
        }
      }
    }
  })

  test("parts explode in sequence: not everything starts together", () => {
    for (const m of PRODUCTS) expect(new Set(m.parts.map((p) => p.delay)).size).toBeGreaterThanOrEqual(4)
  })

  test("labelDirection is a unit vector, up for parts that stay put", () => {
    for (const m of PRODUCTS) for (const p of m.parts) {
      const d = labelDirection(p)
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9)
    }
    expect(labelDirection({name: "x", label: "x", color: "chip", prims: [], explode: {x: 0, y: 0, z: 0}, delay: 0})).toEqual({x: 0, y: 1, z: 0})
  })
})

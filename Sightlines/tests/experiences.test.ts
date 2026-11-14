import {describe, expect, test} from "bun:test"
import {cardById, factById} from "../Assets/Sightlines/Core/Cards"
import {
  BELL_GROUPS, CARILLON_BELLS, CARILLON_ORIGINAL, DESIGN_SCALE_CM, EXPERIENCES, EXPERIENCE_MESH_BUDGET, EXPERIENCE_VERTEX_BUDGET, EXP_COLORS,
  GATES_EDGES, GATES_NODES, GPS_PIN, bellGroupSlots, bellSlot, buildNode, experienceById, experienceFor, experienceStats, labelWeight, pageRank,
  posedBounds, qAxis, qFromTo, qMul, qRot, satellitePositions, surferWalks, visibleSatellites, windowOpen
} from "../Assets/Sightlines/Core/Experiences"
import {buildPrims, primitiveVertexCount} from "../Assets/Sightlines/Core/Products"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)
const SAMPLE_TIMES: number[] = []
for (let t = 0; t <= 30; t += 0.1) SAMPLE_TIMES.push(t)

describe("experiences: registry", () => {
  test("seven experiences covering the key buildings", () => {
    expect(EXPERIENCES.map((e) => e.id)).toEqual(["huang", "gates", "spilker", "y2e2", "hoover", "memchu", "hp"])
    for (const id of ["huang", "gates", "spilker", "y2e2", "hoover", "memchu"]) expect(experienceFor(id).id).toBe(id)
    for (const id of ["packard", "hewlett", "hpgarage"]) expect(experienceFor(id).id).toBe("hp")
    expect(experienceFor("allen")).toBeUndefined()
    expect(experienceFor("nope")).toBeUndefined()
    expect(experienceById("hp").landmarkIds).toEqual(["packard", "hewlett", "hpgarage"])
  })

  test("every landmark is a real card, claimed once, and every factId is a real fact", () => {
    const seen = new Set<string>()
    for (const e of EXPERIENCES) {
      for (const id of e.landmarkIds) {
        expect(cardById(id)).toBeDefined()
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
      for (const f of e.factIds) expect(factById(f)).toBeDefined()
      const names = e.nodes.map((n) => n.name)
      expect(new Set(names).size).toBe(names.length)
    }
  })
})

describe("experiences: sourcing rule", () => {
  test("sourced labels: source matches the fact; digits and capitalised words come from the card", () => {
    for (const e of EXPERIENCES) {
      for (const l of e.labels) {
        if (!l.factId) {
          // Generic labels never carry numbers.
          expect(/\d/.test(l.text)).toBe(false)
          continue
        }
        const f = factById(l.factId)
        expect(f).toBeDefined()
        expect(l.source).toBe(f.fact.source)
        expect(l.source.startsWith("https://")).toBe(true)
        // The label's fact belongs to a card this experience illustrates.
        expect(e.factIds).toContain(l.factId)
        const hay = (f.fact.text + " " + f.card.name + " " + f.card.namesake).toLowerCase()
        for (const d of l.text.match(/\d[\d,.]*/g) || []) expect(f.fact.text).toContain(d)
        const words = l.text.match(/[A-Z][A-Za-z'.]*/g) || []
        for (const w of words) expect(hay).toContain(w.replace(/\.$/, "").toLowerCase())
      }
    }
  })

  test("generic labels carry no capitalised proper names except at sentence start", () => {
    for (const e of EXPERIENCES) for (const l of e.labels) if (!l.factId) expect(/ [A-Z]/.test(l.text)).toBe(false)
  })

  test("the carillon numbers are the card's numbers", () => {
    const f = factById("hoover.4").fact.text
    expect(f).toContain(`${CARILLON_BELLS}-bell`)
    expect(f).toContain(`${CARILLON_ORIGINAL} bells`)
    expect(BELL_GROUPS.reduce((a, b) => a + b, 0)).toBe(CARILLON_BELLS)
    expect(BELL_GROUPS.slice(0, 6).reduce((a, b) => a + b, 0)).toBe(CARILLON_ORIGINAL)
  })
})

describe("experiences: budgets and size", () => {
  test("vertex and mesh budgets", () => {
    for (const e of EXPERIENCES) {
      const s = experienceStats(e)
      console.log(`experience ${e.id}: ${s.verts} verts, ${s.meshes} meshes, ${e.labels.length} labels`)
      expect(s.verts).toBeLessThanOrEqual(EXPERIENCE_VERTEX_BUDGET)
      expect(s.meshes).toBeLessThanOrEqual(EXPERIENCE_MESH_BUDGET)
      expect(s.verts).toBeGreaterThan(0)
    }
  })

  test("about 30-60 cm across at scaleCm 40, never taller than 50, sitting on the anchor", () => {
    expect(DESIGN_SCALE_CM).toBe(40)
    for (const e of EXPERIENCES) {
      for (const t of SAMPLE_TIMES) {
        const b = posedBounds(e, t)
        if (!isFinite(b.min.x)) continue
        expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeLessThanOrEqual(60)
        expect(b.max.y).toBeLessThanOrEqual(50)
        expect(b.min.y).toBeGreaterThan(-3)
      }
      const s = posedBounds(e, e.settle + 2)
      const across = Math.max(s.max.x - s.min.x, s.max.z - s.min.z)
      expect(across).toBeGreaterThanOrEqual(30)
    }
  })

  test("labels sit within the experience's neighbourhood", () => {
    for (const e of EXPERIENCES) for (const l of e.labels) {
      expect(Math.hypot(l.pos.x, l.pos.z)).toBeLessThan(30)
      expect(l.pos.y).toBeGreaterThanOrEqual(0)
      expect(l.pos.y).toBeLessThan(50)
    }
  })
})

describe("experiences: geometry", () => {
  test("every node builds a valid double-sided chunk", () => {
    for (const e of EXPERIENCES) for (const n of e.nodes) {
      expect(EXP_COLORS[n.color]).toBeDefined()
      const c = buildNode(n)
      expect(c.verts.length % 8).toBe(0)
      const nv = c.verts.length / 8
      expect(nv).toBeGreaterThan(0)
      expect(nv).toBeLessThan(64000)
      expect(c.idx.length % 6).toBe(0)
      for (const i of c.idx) expect(i >= 0 && i < nv).toBe(true)
      for (const v of c.verts) expect(Number.isFinite(v)).toBe(true)
    }
  })

  test("sphere and frustum primitives", () => {
    const s = buildPrims([{kind: "sphere", radius: 2, pos: {x: 1, y: 2, z: 3}, segments: 10, rings: 6}])
    expect(s.verts.length / 8).toBe(primitiveVertexCount({kind: "sphere", radius: 2, pos: {x: 0, y: 0, z: 0}, segments: 10, rings: 6}))
    for (let i = 0; i < s.verts.length; i += 8) near(Math.hypot(s.verts[i] - 1, s.verts[i + 1] - 2, s.verts[i + 2] - 3), 2, 1e-9)
    const f = buildPrims([{kind: "cylinder", radius: 2, radiusTop: 0.5, height: 4, axis: "y", pos: {x: 0, y: 0, z: 0}, segments: 8}])
    let topR = 0, botR = 0
    for (let i = 0; i < f.verts.length; i += 8) {
      const r = Math.hypot(f.verts[i], f.verts[i + 2])
      if (f.verts[i + 1] > 1.9) topR = Math.max(topR, r)
      if (f.verts[i + 1] < -1.9) botR = Math.max(botR, r)
    }
    near(topR, 0.5, 1e-9)
    near(botR, 2, 1e-9)
  })
})

describe("experiences: animation", () => {
  test("poses: one per node, finite, at every sampled time", () => {
    for (const e of EXPERIENCES) for (const t of SAMPLE_TIMES) {
      const p = e.poses(t)
      expect(p.length).toBe(e.nodes.length)
      for (const q of p) {
        for (const v of [q.pos.x, q.pos.y, q.pos.z, q.scale.x, q.scale.y, q.scale.z, q.rot.x, q.rot.y, q.rot.z, q.rot.w]) expect(Number.isFinite(v)).toBe(true)
        near(Math.hypot(q.rot.x, q.rot.y, q.rot.z, q.rot.w), 1, 1e-6)
        expect(Math.min(q.scale.x, q.scale.y, q.scale.z)).toBeGreaterThan(0)
      }
    }
  })

  test("things actually move", () => {
    for (const e of EXPERIENCES) {
      const a = e.poses(e.settle + 1), b = e.poses(e.settle + 2.3)
      let moved = 0
      for (let i = 0; i < a.length; i++) {
        const d = Math.hypot(a[i].pos.x - b[i].pos.x, a[i].pos.y - b[i].pos.y, a[i].pos.z - b[i].pos.z) + Math.abs(a[i].scale.y - b[i].scale.y) + Math.abs(a[i].rot.w - b[i].rot.w)
        if (d > 1e-3) moved++
      }
      expect(moved).toBeGreaterThan(0)
    }
  })

  test("label weights fade in and out inside 0..1", () => {
    for (const e of EXPERIENCES) for (const l of e.labels) {
      expect(labelWeight(e, l, l.from - 0.01)).toBe(0)
      const mid = l.to === undefined ? l.from + 1 : (l.from + l.to) / 2
      expect(labelWeight(e, l, mid)).toBeGreaterThan(0.5)
      if (l.to !== undefined) expect(labelWeight(e, l, l.to + 0.01)).toBe(0)
      // A persistent label never blinks off, even in a looping experience.
      if (l.to === undefined) for (let k = 0; k < 4; k++) for (const dt of [0, 0.05, 0.5]) expect(labelWeight(e, l, l.from + 1 + dt + k * Math.max(1, e.loop))).toBe(1)
    }
  })

  test("quaternion helpers", () => {
    const q = qAxis({x: 0, y: 1, z: 0}, 90)
    const v = qRot(q, {x: 0, y: 0, z: 1})
    near(v.x, 1)
    near(v.z, 0)
    const ab = qMul(qAxis({x: 1, y: 0, z: 0}, 90), qAxis({x: 0, y: 1, z: 0}, 90))
    const w = qRot(ab, {x: 0, y: 0, z: 1}) // y first: +z -> +x, then x about x stays +x
    near(w.x, 1)
    const ft = qFromTo({x: 0, y: 1, z: 0}, {x: 0.6, y: 0, z: 0.8})
    const u = qRot(ft, {x: 0, y: 1, z: 0})
    near(u.x, 0.6)
    near(u.z, 0.8)
    const flip = qRot(qFromTo({x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0}), {x: 0, y: 1, z: 0})
    near(flip.y, -1)
  })
})

describe("experiences: lessons", () => {
  test("PageRank sums to 1 and the most-linked page ranks highest", () => {
    const r = pageRank(GATES_NODES.length, GATES_EDGES)
    near(r.reduce((a, b) => a + b, 0), 1, 1e-9)
    const top = r.indexOf(Math.max(...r))
    expect(top).toBe(0)
    // Pages with no in-links get only the teleport share.
    for (const i of [5, 7]) near(r[i], 0.15 / GATES_NODES.length, 1e-9)
    // Textbook check: a two-page cycle splits evenly.
    const c = pageRank(2, [[0, 1], [1, 0]])
    near(c[0], 0.5, 1e-9)
  })

  test("surfers follow real links (or teleport) and visit the top page most", () => {
    const walks = surferWalks()
    const visits = new Array(GATES_NODES.length).fill(0)
    for (const w of walks) for (let h = 0; h < w.length; h++) {
      const [a, b, jump] = w[h]
      if (!jump) expect(GATES_EDGES.some(([x, y]) => x === a && y === b)).toBe(true)
      if (h > 0) expect(a).toBe(w[h - 1][1])
      visits[b]++
    }
    expect(visits.indexOf(Math.max(...visits))).toBe(0)
  })

  test("GPS beams go to the satellites highest above the pin", () => {
    for (const t of [0, 3, 7.5, 20]) {
      const sats = satellitePositions(t)
      expect(sats.length).toBe(9)
      const vis = visibleSatellites(sats)
      expect(vis.length).toBe(4)
      expect(new Set(vis).size).toBe(4)
      // No unchosen satellite is higher than the lowest chosen one.
      // Elevation = cosine between the pin's local up (globe centre -> pin) and the direction to the satellite.
      const up = {x: GPS_PIN.x, y: GPS_PIN.y - 19, z: GPS_PIN.z}
      const ul = Math.hypot(up.x, up.y, up.z)
      const elev = (i: number) => {
        const d = {x: sats[i].x - GPS_PIN.x, y: sats[i].y - GPS_PIN.y, z: sats[i].z - GPS_PIN.z}
        return (d.x * up.x + d.y * up.y + d.z * up.z) / (ul * Math.hypot(d.x, d.y, d.z))
      }
      const lowestChosen = Math.min(...vis.map(elev))
      for (let i = 0; i < sats.length; i++) if (vis.indexOf(i) < 0) expect(elev(i)).toBeLessThanOrEqual(lowestChosen + 1e-9)
      // The best one is genuinely overhead.
      expect(Math.max(...vis.map(elev))).toBeGreaterThan(0.2)
    }
  })

  test("Y2E2 windows start closed, open fully, and close again", () => {
    expect(windowOpen(0, 0)).toBe(0)
    let max = 0, min = 1
    for (let t = 1; t < 20; t += 0.05) {
      const o = windowOpen(t, 2)
      max = Math.max(max, o)
      min = Math.min(min, o)
    }
    expect(max).toBeGreaterThan(0.99)
    expect(min).toBeLessThan(0.01)
  })

  test("carillon: 48 distinct helix slots, the largest bell first, sizes shrink upward", () => {
    const groups = bellGroupSlots()
    expect(groups.map((g) => g.length)).toEqual(BELL_GROUPS)
    const all = groups.flat()
    expect(all.length).toBe(CARILLON_BELLS)
    expect(new Set(all).size).toBe(CARILLON_BELLS)
    expect(groups[0]).toEqual([0])
    for (let i = 1; i < CARILLON_BELLS; i++) expect(bellSlot(i).size).toBeLessThan(bellSlot(i - 1).size)
    // The first 35 bells to arrive are not simply the 35 largest (nothing sourced says which were the originals).
    const first35 = groups.slice(0, 6).flat().sort((a, b) => a - b)
    expect(first35).not.toEqual(Array.from({length: 35}, (_, i) => i))
  })
})

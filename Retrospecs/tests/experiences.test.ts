import {describe, expect, test} from "bun:test"
import {cardById, factById} from "../Assets/Retrospecs/Core/Cards"
import {
  BELL_GROUPS, CARILLON_BELLS, CARILLON_ORIGINAL, CLARK_LOOP, DESIGN_SCALE_CM, KL_BEADS, KL_BUNCHES, KL_LOOP, KL_SQUEEZE, KL_X0, KL_X1, KL_XB, KL_XC,
  clarkWindow, icosahedron, klystronBeadX, klystronBunching, klystronPulseAge, EXPERIENCES, EXPERIENCE_MESH_BUDGET, EXPERIENCE_VERTEX_BUDGET, EXP_COLORS,
  GATES_EDGES, GATES_NODES, GPS_PIN, bellGroupSlots, bellSlot, buildNode, experienceById, experienceFor, experienceStats, labelWeight, pageRank,
  posedBounds, qAxis, qFromTo, qMul, qRot, satellitePositions, surferWalks, visibleSatellites, windowOpen,
  HOOVER_LOOP, HOOVER_STRIKE, HUANG_HOP_S, HUANG_LOOP, HUANG_PARALLEL_START, HUANG_SERIAL_START, MQ_ARCH_Z, MQ_CHURCH_OFF, MQ_LOOP, MQ_T,
  hooverSwing, huangCoreHeight, huangWave
} from "../Assets/Retrospecs/Core/Experiences"
import {buildPrims, primitiveVertexCount} from "../Assets/Retrospecs/Core/Products"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)
const SAMPLE_TIMES: number[] = []
for (let t = 0; t <= 30; t += 0.1) SAMPLE_TIMES.push(t)

describe("experiences: registry", () => {
  test("eleven experiences covering the key buildings", () => {
    expect(EXPERIENCES.map((e) => e.id)).toEqual(["mainquad", "huang", "gates", "spilker", "y2e2", "hoover", "memchu", "hp", "varian", "clark", "moore"])
    for (const id of ["mainquad", "huang", "gates", "spilker", "y2e2", "hoover", "memchu", "varian", "clark", "moore"]) expect(experienceFor(id).id).toBe(id)
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

  test("klystron: an even beam before the buncher, tight bunches after the catcher", () => {
    const per = KL_BEADS / KL_BUNCHES
    const L = KL_X1 - KL_X0
    const even = L / KL_BEADS
    expect(klystronBunching(KL_XB - 1)).toBe(0)
    expect(klystronBunching(KL_XC + 1)).toBe(1)
    // Bunch 0 is beads 0..per-1. Time when its first bead's lab position is at x: s = (x - X0) / L.
    const spread = (x: number) => {
      const t = ((x - KL_X0) / L) * KL_LOOP
      const xs = Array.from({length: per}, (_, k) => klystronBeadX(k, t))
      for (let k = 1; k < per; k++) expect(xs[k]).toBeGreaterThan(xs[k - 1])
      return {xs, w: xs[per - 1] - xs[0]}
    }
    const before = spread(-15)
    for (let k = 1; k < per; k++) near(before.xs[k] - before.xs[k - 1], even, 1e-9)
    const after = spread(KL_XC + 1.5)
    near(after.w, (per - 1) * even * (1 - KL_SQUEEZE), 1e-9)
    expect(after.w).toBeLessThan(0.3 * before.w)
    // Every bead's motion repeats each loop.
    for (let k = 0; k < KL_BEADS; k++) near(klystronBeadX(k, 1.3), klystronBeadX(k, 1.3 + KL_LOOP), 1e-9)
  })

  test("klystron: the output pulse fires as each bunch centre crosses the catcher", () => {
    const per = KL_BEADS / KL_BUNCHES
    const period = KL_LOOP / KL_BUNCHES
    let fires = 0
    for (let t = 0; t < 2 * KL_LOOP; t += 0.001) {
      const age = klystronPulseAge(t)
      if (age < 0.002) fires++
      expect(age).toBeGreaterThanOrEqual(0)
      expect(age).toBeLessThan(period + 1e-9)
      if (age < 0.005) {
        // Some bunch's centre (midway between its middle two beads) is at the catcher.
        let best = Infinity
        for (let j = 0; j < KL_BUNCHES; j++) {
          const a = klystronBeadX(j * per + per / 2 - 1, t), b = klystronBeadX(j * per + per / 2, t)
          if (b > a) best = Math.min(best, Math.abs((a + b) / 2 - KL_XC))
        }
        expect(best).toBeLessThan(0.1)
      }
    }
    // Two loops, four bunches each: eight pulses, each caught by one or two samples.
    expect(fires).toBeGreaterThanOrEqual(2 * KL_BUNCHES)
    expect(fires).toBeLessThanOrEqual(4 * KL_BUNCHES)
  })

  test("clark: the window comes out folded, opens flat, loads, and folds away again", () => {
    const e = experienceById("clark")
    const iL = e.nodes.findIndex((n) => n.name === "window_left")
    const iR = e.nodes.findIndex((n) => n.name === "window_right")
    // Hidden at the start of each loop.
    for (const t of [0, CLARK_LOOP]) {
      expect(clarkWindow(t).emerge).toBe(0)
      expect(e.poses(t)[iL].scale.x).toBeLessThan(0.01)
    }
    const w = clarkWindow(7)
    expect(w).toEqual({emerge: 1, open: 1, loadL: 1, loadR: 1})
    // Fully open, both leaves have one orientation (a single flat panel) and full size.
    const p = e.poses(7)
    near(Math.abs(p[iL].rot.x * p[iR].rot.x + p[iL].rot.y * p[iR].rot.y + p[iL].rot.z * p[iR].rot.z + p[iL].rot.w * p[iR].rot.w), 1, 1e-9)
    near(p[iL].scale.x, 1, 1e-9)
    // Folded on the way out: both leaves extend the same way from the spine, like a closed book.
    const f = e.poses(1.5)
    const extL = qRot(f[iL].rot, {x: -1, y: 0, z: 0}), extR = qRot(f[iR].rot, {x: 1, y: 0, z: 0})
    near(extL.x * extR.x + extL.y * extR.y + extL.z * extR.z, 1, 1e-6)
  })

  test("clark: the spinning wireframe is a regular icosahedron", () => {
    const ico = icosahedron(4.5)
    expect(ico.verts.length).toBe(12)
    expect(ico.edges.length).toBe(30)
    const l0 = Math.hypot(ico.verts[ico.edges[0][0]].x - ico.verts[ico.edges[0][1]].x, ico.verts[ico.edges[0][0]].y - ico.verts[ico.edges[0][1]].y, ico.verts[ico.edges[0][0]].z - ico.verts[ico.edges[0][1]].z)
    for (const [a, b] of ico.edges) near(Math.hypot(ico.verts[a].x - ico.verts[b].x, ico.verts[a].y - ico.verts[b].y, ico.verts[a].z - ico.verts[b].z), l0, 1e-9)
    for (const v of ico.verts) near(Math.hypot(v.x, v.y, v.z), 4.5, 1e-9)
  })

  test("varian and clark use the cardinal pop palette only", () => {
    for (const id of ["varian", "clark"]) for (const n of experienceById(id).nodes) expect(["cardinal", "softgold", "linen"]).toContain(n.color)
  })
})

describe("experiences: the redesigned Quad, Huang and Hoover scenes", () => {
  const nodeIndex = (id: string, name: string) => {
    const i = experienceById(id).nodes.findIndex((n) => n.name === name)
    expect(i).toBeGreaterThanOrEqual(0)
    return i
  }
  const visible = (p: {scale: {x: number; y: number; z: number}}) => Math.max(p.scale.x, p.scale.y, p.scale.z) >= 0.01

  test("each loops seamlessly: poses repeat one loop later", () => {
    for (const [id, loop] of [["mainquad", MQ_LOOP], ["huang", HUANG_LOOP], ["hoover", HOOVER_LOOP]] as [string, number][]) {
      const e = experienceById(id)
      expect(e.loop).toBe(loop)
      for (const t of [0.5, 3.3, 7.7, loop - 1.3]) {
        const a = e.poses(t), b = e.poses(t + loop)
        for (let i = 0; i < a.length; i++) {
          near(a[i].pos.x, b[i].pos.x, 1e-6)
          near(a[i].pos.y, b[i].pos.y, 1e-6)
          near(a[i].scale.y, b[i].scale.y, 1e-6)
        }
      }
      // Every looped label has an end inside the loop, so no caption outlives its scene.
      for (const l of e.labels) if (l.to !== undefined) expect(l.to).toBeLessThanOrEqual(loop)
    }
  })

  test("no pop at the loop wrap, and nothing reaches back through the focus-wall bezel (z = -22)", () => {
    for (const [id, loop] of [["mainquad", MQ_LOOP], ["huang", HUANG_LOOP], ["hoover", HOOVER_LOOP]] as [string, number][]) {
      const e = experienceById(id)
      for (const k of [1, 2]) {
        const a = e.poses(k * loop - 0.02), b = e.poses(k * loop + 0.02)
        for (let i = 0; i < a.length; i++) {
          if (!visible(a[i]) && !visible(b[i])) continue
          const sa = Math.max(a[i].scale.x, a[i].scale.y, a[i].scale.z), sb = Math.max(b[i].scale.x, b[i].scale.y, b[i].scale.z)
          expect(`${id}.${e.nodes[i].name} ${Math.abs(sa - sb) < 0.15}`).toBe(`${id}.${e.nodes[i].name} true`)
        }
      }
      // Posed vertices, not posedBounds: rotated boxes overstate how far the spinning bell groups reach.
      const chunks = e.nodes.map(buildNode)
      for (let t = 0; t <= 30; t += 0.2) {
        const poses = e.poses(t)
        let minZ = Infinity
        poses.forEach((p, i) => {
          if (!visible(p)) return
          const v = chunks[i].verts
          for (let k = 0; k < v.length; k += 8) minZ = Math.min(minZ, p.pos.z + qRot(p.rot, {x: v[k] * p.scale.x, y: v[k + 1] * p.scale.y, z: v[k + 2] * p.scale.z}).z)
        })
        expect(minZ).toBeGreaterThan(-21)
      }
    }
  })

  test("main quad: the church starts off the axis and slides onto it (mainquad.2)", () => {
    const e = experienceById("mainquad"), c = nodeIndex("mainquad", "church")
    near(e.poses(MQ_T.churchRise[1])[c].pos.x, MQ_CHURCH_OFF, 1e-9)
    near(e.poses(MQ_T.churchSlide[1] + 0.1)[c].pos.x, 0, 1e-9)
  })

  test("main quad: the ghost arch closes over solid bases and stays up (mainquad.3)", () => {
    const e = experienceById("mainquad")
    const L = nodeIndex("mainquad", "ghost_crown_l"), R = nodeIndex("mainquad", "ghost_crown_r"), B = nodeIndex("mainquad", "arch_bases")
    // Before the bases come up there is no ghost.
    expect(visible(e.poses(MQ_T.bases[0] - 0.1)[L])).toBe(false)
    // Mid-way the two halves lean apart; once closed both are upright and their crowns meet on the centre line.
    const mid = e.poses((MQ_T.crowns[0] + MQ_T.crowns[1]) / 2)
    expect(Math.abs(mid[L].rot.w)).toBeLessThan(0.999)
    const p = e.poses(MQ_T.attic[1] + 1)
    near(Math.abs(p[L].rot.w), 1, 1e-9)
    near(Math.abs(p[R].rot.w), 1, 1e-9)
    near(p[L].pos.x + p[R].pos.x, 0, 1e-9)
    near(p[L].pos.z, MQ_ARCH_Z, 1e-9)
    for (const t of [MQ_T.legs[0], MQ_T.attic[1], e.settle]) expect(visible(e.poses(t)[B])).toBe(true)
  })

  test("main quad: the time capsule is buried, then hidden, and never sinks past the floor (mainquad.4)", () => {
    const e = experienceById("mainquad"), c = nodeIndex("mainquad", "time_capsule")
    expect(visible(e.poses(MQ_T.capsuleDrop[1])[c])).toBe(true)
    expect(visible(e.poses(MQ_T.capsuleSink[1] + 0.1)[c])).toBe(false)
    for (let t = MQ_T.capsuleDrop[0]; t < MQ_T.capsuleSink[1] + 0.5; t += 0.05) expect(posedBounds(e, t).min.y).toBeGreaterThan(-3)
  })

  test("huang: serial cores are computed one at a time and stay frozen; parallel cores all track the live wave", () => {
    const N = 5
    for (let t = HUANG_SERIAL_START + 0.01; t < HUANG_PARALLEL_START - 0.05; t += 0.07) {
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const visit = HUANG_SERIAL_START + (i * N + j) * HUANG_HOP_S
        near(huangCoreHeight(i, j, t), t < visit ? 1 : huangWave(i, j, visit), 1e-9)
      }
    }
    // The serial picture, once finished, is not the live wave: it's stale.
    let stale = 0
    const t = HUANG_PARALLEL_START - 0.1
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) stale = Math.max(stale, Math.abs(huangCoreHeight(i, j, t) - huangWave(i, j, t)))
    expect(stale).toBeGreaterThan(1)
    for (const tp of [HUANG_PARALLEL_START + 0.5, HUANG_PARALLEL_START + 3]) {
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) near(huangCoreHeight(i, j, tp), huangWave(i, j, tp), 1e-9)
    }
  })

  test("hoover: the largest bell is still until the strike, sound only after it, and all 48 bells are up by settle", () => {
    const e = experienceById("hoover")
    for (let t = 0; t < HOOVER_STRIKE; t += 0.1) {
      expect(hooverSwing(t)).toBe(0)
      for (let r = 0; r < 4; r++) expect(visible(e.poses(t)[nodeIndex("hoover", "sound_" + r)])).toBe(false)
    }
    let swing = 0
    for (let t = HOOVER_STRIKE; t < HOOVER_STRIKE + 3; t += 0.05) swing = Math.max(swing, Math.abs(hooverSwing(t)))
    expect(swing).toBeGreaterThan(15)
    expect(e.poses(HOOVER_STRIKE + 2).some((p, i) => e.nodes[i].name.startsWith("sound_") && visible(p))).toBe(true)
    const p = e.poses(e.settle)
    for (let g = 1; g < BELL_GROUPS.length; g++) near(p[nodeIndex("hoover", "bells_" + g)].scale.y, 1, 1e-9)
  })
})

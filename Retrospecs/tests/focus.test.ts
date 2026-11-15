import {beforeEach, describe, expect, test} from "bun:test"
import {CARDS, factById} from "../Assets/Retrospecs/Core/Cards"
import {BUILDINGS, LANDMARKS} from "../Assets/Retrospecs/Data/CampusData"
import {
  ARTIST_CREDIT, DEFAULT_FOCUS, DEFAULT_WALL, P3, TvWall, angleDiff, easeInOut, extractFigures, fitMedia, focusLayout, footprintRadiusM,
  formatMoney, frameRects, idleExpired, landmarkLook, largestGift, panelGraphic, quadsChunk, sharedWall, stepBlend, wallSlots
} from "../Assets/Retrospecs/Core/Focus"

const fact = (id: string) => factById(id).fact
const digits = (s: string) => s.replace(/[^\d]/g, "")

describe("focus blends", () => {
  test("easing is smooth and clamped", () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.5)).toBeCloseTo(0.5)
    expect(easeInOut(-1)).toBe(0)
    expect(easeInOut(2)).toBe(1)
  })

  test("stepBlend sweeps in the given time and can reverse mid-way", () => {
    let t = 0
    for (let i = 0; i < 30; i++) t = stepBlend(t, 1, 1 / 60, 0.6)
    expect(t).toBeCloseTo(30 / 60 / 0.6)
    for (let i = 0; i < 60; i++) t = stepBlend(t, 1, 1 / 60, 0.6)
    expect(t).toBe(1)
    t = stepBlend(t, 0, 0.3, 0.6)
    expect(t).toBeCloseTo(0.5)
    expect(stepBlend(0.3, 1, 0.1, 0)).toBe(1)
  })

  test("unfocused buildings get smaller and dimmer, not gone; the focus grows", () => {
    const other = landmarkLook(1, 0, DEFAULT_FOCUS)
    expect(other.scaleY).toBeGreaterThan(0.1)
    expect(other.scaleY).toBeLessThan(1)
    expect(other.dim).toBeGreaterThan(0.1)
    expect(other.dim).toBeLessThan(1)
    const focus = landmarkLook(1, 1, DEFAULT_FOCUS)
    expect(focus.scaleXZ).toBeGreaterThanOrEqual(1.6)
    expect(focus.scaleXZ).toBeLessThanOrEqual(2)
    expect(focus.scaleY).toBeCloseTo(focus.scaleXZ)
    expect(focus.liftCm).toBeGreaterThan(0)
    expect(focus.dim).toBe(1)
    const rest = landmarkLook(0, 0, DEFAULT_FOCUS)
    expect(rest).toEqual({scaleXZ: 1, scaleY: 1, liftCm: 0, dim: 1})
  })

  test("idle exit after the set time; 0 means never", () => {
    expect(idleExpired(30, 4, 25)).toBe(true)
    expect(idleExpired(28, 4, 25)).toBe(false)
    expect(idleExpired(1e6, 0, 0)).toBe(false)
  })
})

describe("numbers already in the facts", () => {
  test("money, years, percent and measures", () => {
    expect(extractFigures(fact("huang.1").text).map((f) => f.label)).toEqual(["1992", "$30M"])
    expect(extractFigures(fact("packard.1").text).map((f) => f.label)).toEqual(["1994", "$77.4M"])
    expect(extractFigures(fact("y2e2.2").text).map((f) => f.label)).toEqual(["57%"])
    expect(extractFigures(fact("memchu.2").text).map((f) => f.label)).toEqual(["84 × 30 feet", "3,300 pipes"])
    expect(extractFigures(fact("spilker.2").text).map((f) => f.label)).toEqual(["1,300 people"])
  })

  test("no years from parts of longer numbers, ordinals or addresses", () => {
    const figs = extractFigures("At 367 Addison Avenue, its 50th year, with 1,300 people and 10,000 square feet, in 1939.")
    expect(figs.filter((f) => f.kind === "year").map((f) => f.label)).toEqual(["1939"])
  })

  test("formatMoney", () => {
    expect(formatMoney(30e6)).toBe("$30M")
    expect(formatMoney(77.4e6)).toBe("$77.4M")
    expect(formatMoney(2500)).toBe("$2,500")
    expect(formatMoney(5000)).toBe("$5K")
  })

  test("every figure comes from its fact's own text", () => {
    for (const c of CARDS) {
      for (const f of c.facts) {
        for (const g of extractFigures(f.text)) {
          expect(f.text.slice(g.index, g.index + g.source.length)).toBe(g.source)
          if (g.kind !== "money") for (const part of g.label.split(/[^\d,.]+/).filter((p) => /\d/.test(p))) expect(f.text).toContain(part)
        }
      }
    }
  })

  test("panel graphics only use numbers from Cards.ts", () => {
    const allDigits = CARDS.map((c) => c.facts.map((f) => digits(f.text)).join(" ")).join(" ")
    for (const c of CARDS) {
      for (const f of c.facts) {
        const g = panelGraphic(f)
        if (!g) continue
        // Money labels are compact ("$30M" for "30 million dollars"); everything else is digit-for-digit.
        if (!g.big.startsWith("$") && g.kind !== "timeline") expect(f.text).toContain(g.big.split(" ")[0].replace(/-.*|%$/g, ""))
        if (g.fraction !== undefined) {
          expect(g.fraction).toBeGreaterThan(0)
          expect(g.fraction).toBeLessThanOrEqual(1)
        }
        for (const k of g.ticks || []) expect(f.text).toContain(k.label)
        expect(allDigits.length).toBeGreaterThan(0)
      }
    }
  })

  test("money bar is scaled to the largest sum in the notes", () => {
    const top = largestGift()!
    expect(top.value).toBeGreaterThanOrEqual(77.4e6)
    const g = panelGraphic(fact("huang.1"))!
    expect(g.kind).toBe("bar")
    expect(g.big).toBe("$30M")
    expect(g.fraction).toBeCloseTo(30e6 / top.value)
    expect(g.chips).toEqual(["1992"])
  })

  test("two years make a timeline, one year a callout, no numbers no graphic", () => {
    const t = panelGraphic(fact("memchu.1"))!
    expect(t.kind).toBe("timeline")
    expect(t.ticks!.map((k) => k.label)).toEqual(["1899", "1903"])
    expect(t.ticks![0].t).toBe(0)
    expect(t.ticks![1].t).toBe(1)
    expect(panelGraphic(fact("memchu.3"))!.kind).toBe("callout")
    expect(panelGraphic(fact("memchu.3"))!.big).toBe("1906")
    const plain = CARDS.flatMap((c) => c.facts).find((f) => !/\d/.test(f.text))
    if (plain) expect(panelGraphic(plain)).toBeNull()
    expect(panelGraphic(null)).toBeNull()
  })
})

describe("layout", () => {
  test("footprint radius of Huang is building-sized", () => {
    const lm = LANDMARKS.find((l) => l.id === "huang")!
    const r = footprintRadiusM(BUILDINGS[lm.building][3], lm.east, lm.north)
    expect(r).toBeGreaterThan(15)
    expect(r).toBeLessThan(150)
  })

})

describe("wall of TVs", () => {
  const o = {panelWidthCm: 30, panelHeightCm: 24, panelGapCm: 6, sideObjectCm: 40, sideGapCm: 4}
  // Wearer standing south of the building (map +z is south), eyes 160 cm up, looking north (-z) at the floor map.
  const cam = {x: 0, y: 160, z: 140}
  const base = {x: 0, y: 0, z: 0}
  const top = {x: 0, y: 10, z: 0}
  const cfg = {...DEFAULT_WALL}
  const off = () => new TvWall()
  const sub = (a: P3, b: P3) => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z})
  const len = (a: P3) => Math.hypot(a.x, a.y, a.z)
  const deg = (r: number) => (r * 180) / Math.PI

  beforeEach(() => sharedWall.deactivate())

  test("screens float in front of the wearer at about eye height, not above the building", () => {
    const L = focusLayout(base, top, cam, o, off(), cfg)
    const d = sub(L.panel, cam)
    expect(d.z).toBeLessThan(0) // in front (toward the building)
    expect(Math.hypot(d.x, d.z)).toBeGreaterThanOrEqual(100)
    expect(Math.hypot(d.x, d.z)).toBeLessThanOrEqual(160)
    expect(d.y).toBeLessThanOrEqual(-5)
    expect(d.y).toBeGreaterThanOrEqual(-25)
    expect(L.panel.y).toBeGreaterThan(top.y + 100)
    for (const p of [L.showcase, L.experience]) {
      expect(Math.abs(p.y - cam.y)).toBeLessThanOrEqual(25)
      expect(len(sub(p, cam))).toBeGreaterThanOrEqual(100)
      expect(len(sub(p, cam))).toBeLessThanOrEqual(160)
    }
    // Facing -z, the wearer's right is +x; the model is on the right, the experience on the left.
    expect(L.right.x).toBeCloseTo(1)
    expect(L.toCam.z).toBeCloseTo(1)
    expect(L.showcase.x).toBeGreaterThan(0)
    expect(L.experience.x).toBeLessThan(0)
  })

  test("main screen is comfortably large and inside the central view", () => {
    const s = wallSlots(cfg)
    expect(cfg.mainWidthCm).toBeGreaterThanOrEqual(50)
    expect(cfg.mainWidthCm).toBeLessThanOrEqual(70)
    // Half-angles from the eyes: well inside a 46 degree diagonal field of view.
    const halfW = deg(Math.atan(cfg.mainWidthCm / 2 / s.main.z))
    const top = deg(Math.atan((s.main.y + cfg.mainHeightCm / 2) / s.main.z))
    const bottom = deg(Math.atan((s.main.y - cfg.mainHeightCm / 2) / s.main.z))
    expect(halfW).toBeLessThan(16)
    expect(top).toBeLessThan(12)
    expect(bottom).toBeGreaterThan(-23)
  })

  test("side screens do not overlap the main screen or each other", () => {
    const s = wallSlots({...cfg, sideSizeCm: o.sideObjectCm})
    const halfMain = Math.atan(cfg.mainWidthCm / 2 / cfg.distanceCm)
    const halfSide = Math.atan(o.sideObjectCm / 2 / cfg.distanceCm)
    expect(s.sideAngle - halfSide).toBeGreaterThan(halfMain)
    // Inner edge of the right screen (it faces the eyes, so its edge is along the tangent) clears the main screen.
    const innerX = s.right.x - (o.sideObjectCm / 2) * Math.cos(s.sideAngle)
    expect(innerX).toBeGreaterThan(cfg.mainWidthCm / 2)
    expect(s.left.x).toBeCloseTo(-s.right.x)
  })

  test("the main screen stays above the line of sight to the focused building", () => {
    // A building far across the floor map: the sightline is shallow, so the screen must rise.
    const w = off()
    w.reset(cam, Math.PI) // facing -z
    const farTop = {x: 0, y: 60, z: -260}
    const L = focusLayout(base, farTop, cam, o, w, cfg)
    const t = w.toLocal(farTop)
    const s = w.toLocal(L.panel)
    const lineY = (t.y * s.z) / t.z
    expect(s.y - cfg.mainHeightCm / 2).toBeGreaterThanOrEqual(lineY + cfg.sightMarginCm - 1e-6)
    expect(L.panel.y).toBeGreaterThan(cam.y - cfg.dropCm)
    // A building on the floor nearby: the default drop already clears it.
    const near = focusLayout(base, top, cam, o, w, cfg)
    expect(near.panel.y).toBeCloseTo(cam.y - cfg.dropCm)
  })

  test("uses the shared wall once the panel places it", () => {
    sharedWall.reset(cam, Math.PI / 2) // facing +x
    const L = focusLayout(base, top, cam, o)
    expect(L.panel.x).toBeGreaterThan(cam.x + 100)
    expect(Math.abs(L.panel.z - cam.z)).toBeLessThan(1)
  })

  test("lazy follow: looking at a side screen keeps the wall still; turning well away re-centres smoothly", () => {
    const w = off()
    w.reset(cam, Math.PI)
    const s = wallSlots(cfg)
    const outerEdge = s.sideAngle + Math.atan(cfg.sideSizeCm / 2 / cfg.distanceCm)
    expect(deg(outerEdge)).toBeLessThan(cfg.followDeg)
    // Small head motion and looking at either side screen: no move.
    for (const a of [0.05, -0.05, s.sideAngle, -s.sideAngle, outerEdge]) {
      expect(w.update({x: cam.x + 3, y: cam.y - 2, z: cam.z}, Math.PI + a, 1 / 60, cfg)).toBe(false)
      expect(w.yaw).toBe(Math.PI)
    }
    // Turn 60 degrees: it starts following, but does not snap in one frame.
    const target = Math.PI + (60 * Math.PI) / 180
    expect(w.update(cam, target, 1 / 60, cfg)).toBe(true)
    expect(Math.abs(angleDiff(target, w.yaw))).toBeGreaterThan((50 * Math.PI) / 180)
    let frames = 1
    while (w.following && frames < 600) {
      w.update(cam, target, 1 / 60, cfg)
      frames++
    }
    expect(frames).toBeGreaterThan(20)
    expect(Math.abs(deg(angleDiff(target, w.yaw)))).toBeLessThan(2)
    expect(w.following).toBe(false)
  })

  test("walking away re-centres on the new eye position", () => {
    const w = off()
    w.reset(cam, Math.PI)
    const moved = {x: cam.x + 80, y: cam.y, z: cam.z}
    for (let i = 0; i < 600; i++) w.update(moved, Math.PI, 1 / 60, cfg)
    expect(Math.abs(w.origin.x - moved.x)).toBeLessThan(3)
  })

  test("wall frame round-trips local and world points", () => {
    const w = off()
    w.reset({x: 10, y: 150, z: -20}, 0.7)
    const l = {x: 12, y: -14, z: 130}
    const back = w.toLocal(w.toWorld(l))
    expect(back.x).toBeCloseTo(l.x)
    expect(back.y).toBeCloseTo(l.y)
    expect(back.z).toBeCloseTo(l.z)
    expect(angleDiff(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2)
  })

  test("art screen fits Nazeli's pieces inside its box at their own aspect", () => {
    for (const aspect of [446 / 602, 1003 / 604, 16 / 9]) {
      const r = fitMedia(aspect, 56, 30)
      expect(r.w).toBeLessThanOrEqual(56 + 1e-6)
      expect(r.h).toBeLessThanOrEqual(30 + 1e-6)
      expect(r.w / r.h).toBeCloseTo(aspect)
      expect(Math.max(r.w / 56, r.h / 30)).toBeCloseTo(1)
    }
    expect(ARTIST_CREDIT).toBe("Art: Nazeli Sayra Kurtoğlu")
  })
})

describe("focus geometry", () => {

  test("quads are double-sided with valid indices; frames have four sides", () => {
    const c = quadsChunk([{x0: 0, y0: 0, x1: 2, y1: 1}, ...frameRects({x0: -1, y0: -1, x1: 1, y1: 1}, 0.1)])
    expect(c.verts.length % 8).toBe(0)
    expect(c.idx.length).toBe(5 * 12)
    for (const i of c.idx) expect(i).toBeLessThan(c.verts.length / 8)
  })
})

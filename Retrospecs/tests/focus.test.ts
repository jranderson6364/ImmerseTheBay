import {describe, expect, test} from "bun:test"
import {CARDS, factById} from "../Assets/Retrospecs/Core/Cards"
import {BUILDINGS, LANDMARKS} from "../Assets/Retrospecs/Data/CampusData"
import {
  DEFAULT_FOCUS, easeInOut, extractFigures, focusLayout, footprintRadiusM, formatMoney, frameRects, idleExpired, landmarkLook,
  largestGift, panelGraphic, quadsChunk, stepBlend
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

  test("panel above the building; model and experience either side, clear of the panel", () => {
    const o = {panelWidthCm: 30, panelHeightCm: 24, panelGapCm: 6, sideObjectCm: 40, sideGapCm: 4}
    // Wearer south of the building (map +z is south), looking north.
    const L = focusLayout({x: 0, y: 0, z: 0}, {x: 0, y: 10, z: 0}, {x: 0, y: 160, z: 140}, o)
    expect(L.panel.y).toBe(10 + 6 + 12)
    expect(L.toCam.z).toBeCloseTo(1)
    // Facing -z, the wearer's right is +x.
    expect(L.right.x).toBeCloseTo(1)
    expect(L.showcase.x).toBeGreaterThan(o.panelWidthCm / 2 + o.sideObjectCm / 2)
    expect(L.experience.x).toBeLessThan(-(o.panelWidthCm / 2 + o.sideObjectCm / 2))
    expect(L.showcase.y).toBe(L.panel.y)
  })

  test("quads are double-sided with valid indices; frames have four sides", () => {
    const c = quadsChunk([{x0: 0, y0: 0, x1: 2, y1: 1}, ...frameRects({x0: -1, y0: -1, x1: 1, y1: 1}, 0.1)])
    expect(c.verts.length % 8).toBe(0)
    expect(c.idx.length).toBe(5 * 12)
    for (const i of c.idx) expect(i).toBeLessThan(c.verts.length / 8)
  })
})

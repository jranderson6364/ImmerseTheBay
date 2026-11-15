import {describe, expect, test} from "bun:test"
import {COMPACT, compactLayout, crossChunk, inRect} from "../Assets/Retrospecs/Core/CardLayout"

const base = {width: 64, titleH: 5, namesakeH: 2, bodyH: 12, sourceH: 0}

function inside(a: {x0: number; y0: number; x1: number; y1: number}, b: {x0: number; y0: number; x1: number; y1: number}) {
  return a.x0 >= b.x0 - 1e-6 && a.x1 <= b.x1 + 1e-6 && a.y0 >= b.y0 - 1e-6 && a.y1 <= b.y1 + 1e-6
}
function overlap(a: {x0: number; y0: number; x1: number; y1: number}, b: {x0: number; y0: number; x1: number; y1: number}) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

describe("compactLayout", () => {
  test("short and wide: under half as tall as wide, with or without art", () => {
    for (const artAspect of [0, 640 / 368, 1003 / 604]) {
      const L = compactLayout({...base, artAspect})
      const h = L.card.y1 - L.card.y0
      expect(h).toBeLessThan(base.width * 0.6)
      expect(L.card.x1 - L.card.x0).toBe(base.width)
    }
  })
  test("buttons, art and text stay on the card and don't collide", () => {
    const L = compactLayout({...base, artAspect: 640 / 368})
    for (const r of [L.close, L.next, L.text, L.art!, L.artBox!, L.credit!]) expect(inside(r, L.card)).toBe(true)
    expect(overlap(L.close, L.next)).toBe(false)
    expect(overlap(L.artBox!, L.text)).toBe(false)
    expect(overlap(L.artBox!, L.close)).toBe(false)
    expect(inside(L.art!, L.artBox!)).toBe(true)
  })
  test("the X is a big target in the top-right corner, with a larger hit box", () => {
    const L = compactLayout({...base, artAspect: 0})
    expect(L.close.x1 - L.close.x0).toBeGreaterThanOrEqual(COMPACT.closeCm - 1e-6)
    expect(L.close.x1).toBeGreaterThan(L.card.x1 - COMPACT.pad - 0.01)
    expect(L.close.y1).toBeGreaterThan(L.card.y1 - COMPACT.accentH - COMPACT.pad - 0.01)
    expect(inside(L.close, L.closeHit)).toBe(true)
    expect(inRect(L.closeHit, L.close.x1 + 2, L.close.y1 + 2)).toBe(true)
  })
  test("hit boxes stay off the words", () => {
    for (const artAspect of [0, 640 / 368]) {
      const L = compactLayout({...base, sourceH: 3, artAspect})
      const textBottom = L.sourceTop - 3
      expect(L.nextHit.y1).toBeLessThanOrEqual(textBottom + 1e-6)
      // Title stops 9 cm short of the text column's right edge; the X hit box must not reach it.
      expect(L.closeHit.x0).toBeGreaterThanOrEqual(L.text.x1 - 9 - 1e-6)
      expect(L.closeHit.y0).toBeGreaterThanOrEqual(L.namesakeTop - 1e-6)
    }
  })
  test("text pieces run top to bottom", () => {
    const L = compactLayout({...base, sourceH: 3, artAspect: 0})
    expect(L.titleTop).toBeGreaterThan(L.namesakeTop)
    expect(L.namesakeTop).toBeGreaterThan(L.bodyTop)
    expect(L.bodyTop).toBeGreaterThan(L.sourceTop)
    // The body ends above the Next button.
    expect(L.bodyTop - base.bodyH).toBeGreaterThanOrEqual(L.next.y1 - 1e-6)
  })
  test("no art: no art rects", () => {
    const L = compactLayout({...base, artAspect: 0})
    expect(L.art).toBeNull()
    expect(L.credit).toBeNull()
  })
})

describe("crossChunk", () => {
  test("two double-sided bars inside the box", () => {
    const r = {x0: 0, y0: 0, x1: 8, y1: 8}
    const c = crossChunk(r, 1)
    expect(c.verts.length).toBe(8 * 8)
    expect(c.idx.length).toBe(24)
    for (let i = 0; i < c.verts.length; i += 8) expect(inRect({x0: -0.5, y0: -0.5, x1: 8.5, y1: 8.5}, c.verts[i], c.verts[i + 1])).toBe(true)
  })
})

import {SPECTACLES, STORY_CARD, cmForDeg, compactCardSize, degForCm, growToMin, storyCardHits, storyCardScale} from "../Assets/Retrospecs/Core/CardLayout"

describe("angular sizing (Snap positioning and sizing guide)", () => {
  test("cm and degrees round-trip, and match Snap's table (53 cm at 110 cm is about 27 degrees)", () => {
    expect(degForCm(cmForDeg(20, 140), 140)).toBeCloseTo(20, 6)
    expect(degForCm(53, 110)).toBeGreaterThan(26)
    expect(degForCm(53, 110)).toBeLessThan(28)
    // Snap's minimum button column is about 2 degrees.
    expect(degForCm(4, 110)).toBeCloseTo(2.08, 1)
  })
  test("growToMin grows about the centre and never shrinks", () => {
    const r = growToMin({x0: 0, y0: 0, x1: 2, y1: 10}, 6)
    expect(r).toEqual({x0: -2, y0: 0, x1: 4, y1: 10})
  })
  test("compact card at defaults: inside the binocular width, text the same angle as before, buttons >= 2 degrees", () => {
    const D = 140
    const {scale, width} = compactCardSize(24, 0.76, D, 0.032 * 52)
    expect(degForCm(width * scale, D)).toBeCloseTo(24, 6)
    expect(24).toBeLessThan(SPECTACLES.binocularWidthDeg)
    // Old: 1.664 cm local line x 1.5 at 188.5 cm.
    expect(degForCm(0.032 * 52 * scale, D)).toBeCloseTo(degForCm(0.032 * 52 * 1.5, 188.5), 1)
    expect(width).toBeGreaterThan(40) // compactLayout's text column needs room
    expect(degForCm(COMPACT.closeCm * scale, D)).toBeGreaterThanOrEqual(SPECTACLES.minTargetDeg)
    expect(degForCm(COMPACT.nextH * scale, D)).toBeGreaterThanOrEqual(SPECTACLES.minTargetDeg)
  })
  test("story card hit areas reach 3 degrees, stay on the texture, and keep >= 1 degree apart", () => {
    const D = 140
    const s = storyCardScale(20.3, D)
    expect(degForCm(STORY_CARD.widthCm * s, D)).toBeCloseTo(20.3, 6)
    const hits = storyCardHits(cmForDeg(SPECTACLES.bestTargetDeg, D) / s)
    const tex = {x0: -STORY_CARD.widthCm / 2, y0: -STORY_CARD.heightCm / 2, x1: STORY_CARD.widthCm / 2, y1: STORY_CARD.heightCm / 2}
    const list = [hits.close, hits.more, hits.next]
    for (const r of list) {
      expect(degForCm((r.x1 - r.x0) * s, D)).toBeGreaterThanOrEqual(SPECTACLES.bestTargetDeg - 1e-9)
      expect(degForCm((r.y1 - r.y0) * s, D)).toBeGreaterThanOrEqual(SPECTACLES.bestTargetDeg - 1e-9)
      expect(inside(r, tex)).toBe(true)
    }
    const gap = (a: typeof hits.close, b: typeof hits.close) =>
      Math.max(Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1))
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(degForCm(gap(list[i], list[j]) * s, D)).toBeGreaterThanOrEqual(SPECTACLES.minTargetGapDeg)
    // For reference, the unpadded X (68 px wide) was under Snap's 2 degree minimum.
    expect(degForCm(68 * (72 / 1280) * s, D)).toBeLessThan(SPECTACLES.minTargetDeg)
  })
})

describe("flankHeadings", () => {
  const {flankHeadings, halfWidthDeg} = require("../Assets/Retrospecs/Core/CardLayout")
  test("equal gaps either side of the card", () => {
    const card = 20.3, gap = 4
    const l = halfWidthDeg(30, 150), r = halfWidthDeg(56, 165)
    const h = flankHeadings(card, gap, l, r)
    const leftGap = -card / 2 - (h.left + l)
    const rightGap = h.right - r - card / 2
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(1e-9)
    expect(leftGap).toBeCloseTo(gap)
    expect(h.left).toBeLessThan(0)
    expect(h.right).toBeGreaterThan(0)
  })
  test("halfWidthDeg", () => {
    expect(halfWidthDeg(200, 100)).toBeCloseTo(45)
  })
})

import {STORY_SPLIT_PX, storySliceChunk} from "../Assets/Retrospecs/Core/CardLayout"
describe("story card slices", () => {
  test("the full slice spans the card with 0..1 UVs; the button column starts right of the portrait", () => {
    const full = storySliceChunk(0, 0, STORY_CARD.texW, STORY_CARD.texH)
    expect(full.verts.slice(0, 8)).toEqual([-STORY_CARD.widthCm / 2, -STORY_CARD.heightCm / 2, 0, 0, 0, 1, 0, 0])
    expect(full.verts.slice(16, 24)).toEqual([STORY_CARD.widthCm / 2, STORY_CARD.heightCm / 2, 0, 0, 0, 1, 1, 1])
    // Next Stop's drawn box (px 920..1182) sits wholly inside the column, the portrait (ends ~890 px) outside it.
    expect(STORY_SPLIT_PX).toBeGreaterThan(890)
    expect(STORY_SPLIT_PX).toBeLessThan(920)
  })
})

import {describe, expect, test} from "bun:test"
import {CARDS} from "../Assets/Retrospecs/Core/Cards"
import {isTourCommand, suggestedQuestions} from "../Assets/Retrospecs/Core/AskBubble"
import {DEMO_SUGGESTED_QUESTION} from "../Assets/Retrospecs/Core/DemoScript"
import {
  STORY_CARD, cmForDeg, compactLayout, micGlyphRects, rectsOverlap, storyAskButton, storyCardHits, storyCardScale
} from "../Assets/Retrospecs/Core/CardLayout"

type R = {x0: number; y0: number; x1: number; y1: number}
const inside = (a: R, b: R) => a.x0 >= b.x0 - 1e-6 && a.x1 <= b.x1 + 1e-6 && a.y0 >= b.y0 - 1e-6 && a.y1 <= b.y1 + 1e-6

describe("suggestedQuestions", () => {
  test("every card with facts offers 1 to 3 chips, each answered by its own checked fact", () => {
    for (const c of CARDS) {
      if (!c.facts.length) continue
      const qs = suggestedQuestions(c)
      expect(qs.length).toBeGreaterThan(0)
      expect(qs.length).toBeLessThanOrEqual(3)
      for (const q of qs) expect(c.facts.some((f) => f.id === q.factId)).toBe(true)
    }
  })
  test("the demo's last stop leads with the suggested question", () => {
    const huang = CARDS.find((c) => c.id === "huang")!
    expect(suggestedQuestions(huang)[0].label).toBe(DEMO_SUGGESTED_QUESTION)
  })
  test("drops questions already asked, and handles no card", () => {
    const huang = CARDS.find((c) => c.id === "huang")!
    const first = suggestedQuestions(huang)
    const next = suggestedQuestions(huang, [first[0].factId], [first[0].label])
    expect(next.map((q) => q.label)).not.toContain(first[0].label)
    expect(suggestedQuestions(null)).toEqual([])
  })
})

describe("isTourCommand", () => {
  test("tour commands go to the tour", () => {
    for (const t of ["next spot", "What's that?", "go back", "recalibrate", "I like art", "show me the demo"]) expect(isTourCommand(t)).toBe(true)
  })
  test("real questions go to the guide", () => {
    for (const t of ["What is this building made of?", "I want to know who built it", "Who's it named after?", "when was it built", "what's next to Hoover"])
      expect(isTourCommand(t)).toBe(false)
  })
})

describe("Ask button layout", () => {
  test("story card: above Next Stop, at least the minimum target, hit boxes clear of every other button", () => {
    for (const D of [110, 140, 180]) {
      const min = cmForDeg(3, D) / storyCardScale(20.3, D)
      const ask = storyAskButton(min)
      const hits = storyCardHits(min)
      for (const other of [hits.next, hits.more, hits.close]) expect(rectsOverlap(ask.hit, other)).toBe(false)
      expect(ask.drawn.y0).toBeGreaterThan(storyCardHits(0).next.y1)
      expect(ask.hit.y1 - ask.hit.y0).toBeGreaterThanOrEqual(min - 1e-6)
      // In the right-hand column, off the portrait card (which ends at texture x 888), and on the texture.
      expect(ask.drawn.x0).toBeGreaterThan(-STORY_CARD.widthCm / 2 + (888 * STORY_CARD.heightCm) / STORY_CARD.texH)
      expect(ask.drawn.x1).toBeLessThanOrEqual(STORY_CARD.widthCm / 2)
    }
  })
  test("compact card: Ask pill on the card, clear of Next spot, the X, the art and the text", () => {
    for (const width of [44, 64]) {
      for (const artAspect of [0, 640 / 368]) {
        const L = compactLayout({width, titleH: 5, namesakeH: 2, bodyH: 12, sourceH: 0, artAspect})
        expect(inside(L.ask, L.card)).toBe(true)
        expect(rectsOverlap(L.askHit, L.nextHit)).toBe(false)
        expect(rectsOverlap(L.ask, L.close)).toBe(false)
        if (L.artBox) expect(rectsOverlap(L.ask, L.artBox)).toBe(false)
        if (L.credit) expect(rectsOverlap(L.ask, L.credit)).toBe(false)
      }
    }
  })
  test("mic glyph stays inside its square", () => {
    for (const r of micGlyphRects(1, 2, 4)) expect(inside(r, {x0: -1, y0: 0, x1: 3, y1: 4})).toBe(true)
  })
})

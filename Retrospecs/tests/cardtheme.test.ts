import {describe, expect, test} from "bun:test"
import {readFileSync} from "fs"
import {join} from "path"
import {
  BAKED_ASK_CARDS, CARD_THEMES, DECK_THEME, RENDER_BASE, TEXT_LAYER, cornerFor, hasBakedAsk, meshLayer, themeFor
} from "../Assets/Retrospecs/Core/CardTheme"
import {STORY_CARD, shapeChunk, shapeFrameChunk, shapeOutline, storyAskButton} from "../Assets/Retrospecs/Core/CardLayout"

const GEN = readFileSync(join(import.meta.dir, "../tools/story_cards_featured.py"), "utf-8")

describe("card themes", () => {
  test("every story card (tools/story-cards.json, all drawn with the deck template) has the baked tab and copper", () => {
    const deck = readFileSync(join(import.meta.dir, "../tools/render_story_decks.py"), "utf-8")
    const ids = Object.keys(JSON.parse(readFileSync(join(import.meta.dir, "../tools/story-cards.json"), "utf-8")))
    expect([...BAKED_ASK_CARDS].sort()).toEqual([...ids].sort())
    const copper = /COPPER = \((\d+), (\d+), (\d+)/.exec(deck).slice(1).map(Number)
    for (const id of ids) expect(CARD_THEMES[id].accent.slice(0, 3).map((v) => Math.round(v * 255))).toEqual(copper)
  })
  test("ids without a deck card get the older decks' navy and copper and no baked tab", () => {
    expect(themeFor("hpgarage")).toBe(CARD_THEMES.mainquad)
    expect(themeFor("")).toBe(DECK_THEME)
    const deck = readFileSync(join(import.meta.dir, "../tools/render_story_decks.py"), "utf-8")
    const copper = /COPPER = \((\d+), (\d+), (\d+)/.exec(deck).slice(1).map(Number)
    expect(DECK_THEME.accent.slice(0, 3).map((v) => Math.round(v * 255))).toEqual(copper)
    expect(hasBakedAsk("mainquad")).toBe(true)
    expect(hasBakedAsk("hpgarage")).toBe(true)
    expect(hasBakedAsk("")).toBe(false)
    expect(cornerFor(CARD_THEMES.huang).chamfer).toBe(true)
  })
  test("generator's ASK_BOX is storyAskButton's drawn rect in texture pixels", () => {
    const [x0, y0, x1, y1] = /ASK_BOX = \((\d+), (\d+), (\d+), (\d+)\)/.exec(GEN).slice(1).map(Number)
    const d = storyAskButton(0).drawn
    const k = STORY_CARD.texH / STORY_CARD.heightCm
    const px = (x: number) => (x + STORY_CARD.widthCm / 2) * k
    const py = (y: number) => (STORY_CARD.heightCm / 2 - y) * k
    expect(Math.abs(px(d.x0) - x0)).toBeLessThan(1.5)
    expect(Math.abs(px(d.x1) - x1)).toBeLessThan(1.5)
    expect(Math.abs(py(d.y1) - y0)).toBeLessThan(1.5)
    expect(Math.abs(py(d.y0) - y1)).toBeLessThan(1.5)
  })
})

describe("draw order", () => {
  test("text is drawn after every mesh layer, and layers follow z", () => {
    for (const z of [-0.05, 0, 0.03, 0.05, 0.08, 0.16, 5]) expect(meshLayer(z)).toBeLessThan(TEXT_LAYER)
    expect(meshLayer(-0.05)).toBeLessThan(meshLayer(0))
    expect(meshLayer(0.03)).toBeLessThan(meshLayer(0.04))
    expect(meshLayer(0.04)).toBeLessThan(meshLayer(0.05))
    // The window's whole range sits above the card's.
    expect(RENDER_BASE.panel + TEXT_LAYER).toBeLessThan(RENDER_BASE.chat + meshLayer(-1))
  })
})

describe("rounded shapes", () => {
  const r = {x0: -5, y0: -2, x1: 5, y1: 2}
  test("outline stays inside the rect, same point count for every style", () => {
    const n = shapeOutline(r, 1).length
    for (const [rad, ch] of [[0, false], [1, false], [1, true], [9, false]] as [number, boolean][]) {
      const pts = shapeOutline(r, rad, ch)
      expect(pts.length).toBe(n)
      for (const [x, y] of pts) {
        expect(x).toBeGreaterThanOrEqual(r.x0 - 1e-9)
        expect(x).toBeLessThanOrEqual(r.x1 + 1e-9)
        expect(y).toBeGreaterThanOrEqual(r.y0 - 1e-9)
        expect(y).toBeLessThanOrEqual(r.y1 + 1e-9)
      }
    }
  })
  test("rounded corners are cut in; chamfer cuts top-left and bottom-right only", () => {
    const has = (pts: number[][], x: number, y: number) => pts.some((p) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9)
    const round = shapeOutline(r, 1)
    expect(has(round, r.x1, r.y1)).toBe(false)
    const ch = shapeOutline(r, 1, true)
    expect(has(ch, r.x1, r.y1)).toBe(true) // top-right square
    expect(has(ch, r.x0, r.y0)).toBe(true) // bottom-left square
    expect(has(ch, r.x0, r.y1)).toBe(false) // top-left cut
    expect(has(ch, r.x1, r.y0)).toBe(false) // bottom-right cut
  })
  test("meshes are well formed (8 floats per vertex, indices in range, both windings)", () => {
    for (const c of [shapeChunk(r, 1, false, 0.03), shapeFrameChunk(r, 1, 0.3, true, 0.04)]) {
      expect(c.verts.length % 8).toBe(0)
      const nv = c.verts.length / 8
      expect(c.idx.length % 6).toBe(0)
      for (const i of c.idx) expect(i).toBeLessThan(nv)
    }
    expect(shapeChunk(r, 1, false, 0.03).verts[2]).toBeCloseTo(0.03)
  })
})

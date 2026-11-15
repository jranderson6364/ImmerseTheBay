import {describe, expect, test} from "bun:test"
import {factById} from "../Assets/Retrospecs/Core/Cards"
import {vertexCount, MeshChunk} from "../Assets/Retrospecs/Core/MapMesh"
import {
  BRICKS_PER_SKID, MONEY_GROUPS, NOTES_PER_BRICK, NOTES_PER_SKID, NOTE_VOLUME_CM3, NOTE_SIZE_SRC, NOTE_THICKNESS_SRC,
  NOTE_WEIGHT_SRC, PACKAGING_SRC, allGifts, billsToStack, buildMoneyPile, buildScaleFigure, captionFor, giftFor,
  parseMillionDollars, pileDistanceCm, pileDrawCalls, towerGrow
} from "../Assets/Retrospecs/Core/Money"

function wellFormed(c: MeshChunk) {
  expect(c.verts.length % 8).toBe(0)
  const n = c.verts.length / 8
  expect(n).toBeLessThan(64000)
  expect(c.idx.length % 3).toBe(0)
  for (const i of c.idx) {
    expect(i).toBeGreaterThanOrEqual(0)
    expect(i).toBeLessThan(n)
  }
  for (const v of c.verts) expect(Number.isFinite(v)).toBe(true)
}

describe("gifts come from Cards.ts", () => {
  const expected: Record<string, number> = {huang: 30e6, y2e2: 50e6, gates: 6e6, hewlett: 50e6, packard: 77.4e6}

  test("each gift's amount is parsed from its card fact, with the fact's source", () => {
    const gifts = allGifts()
    expect(gifts.map((g) => g.cardId).sort()).toEqual(Object.keys(expected).sort())
    for (const g of gifts) {
      expect(g.amountUSD).toBe(Math.round(expected[g.cardId]))
      expect(g.factId.startsWith(g.cardId + ".")).toBe(true)
      const f = factById(g.factId)!
      expect(f.card.id).toBe(g.cardId)
      expect(g.source).toBe(f.fact.source)
      expect(parseMillionDollars(f.fact.text)).toBe(g.amountUSD)
    }
    expect(giftFor("hoover")).toBeUndefined()
    expect(giftFor("hewlett")!.kind).toBe("pledge")
  })

  test("parser rounds to whole dollars", () => {
    expect(parseMillionDollars("gave 77.4 million dollars to")).toBe(77400000)
    expect(parseMillionDollars("a 30 million dollar gift")).toBe(30000000)
    expect(Number.isNaN(parseMillionDollars("no money here"))).toBe(true)
  })
})

describe("billsToStack", () => {
  test("30M $1 bills: about 34 m³, 3.2 m cube, 30 tonnes", () => {
    const s = billsToStack(30e6)
    expect(s.notes).toBe(30e6)
    expect(s.volumeM3).toBeGreaterThan(33.5)
    expect(s.volumeM3).toBeLessThan(34.2)
    expect(s.cubeSideM).toBeCloseTo(3.236, 2)
    expect(s.massTonnes).toBe(30)
    expect(s.bricks).toBe(7500)
    expect(s.looseNotes).toBe(0)
    expect(s.skids).toBe(47)
  })

  test("note volume uses 6.14 x 2.61 x 0.0043 in", () => {
    expect(NOTE_VOLUME_CM3).toBeCloseTo(6.14 * 2.61 * 0.0043 * 2.54 ** 3, 9)
  })

  test("every gift: bricks are whole, skids hold all bricks, towers hold all skids", () => {
    const cube: Record<string, string> = {huang: "3.2", y2e2: "3.8", gates: "1.9", hewlett: "3.8", packard: "4.4"}
    for (const g of allGifts()) {
      const s = billsToStack(g.amountUSD)
      expect(s.bricks * NOTES_PER_BRICK + s.looseNotes).toBe(s.notes)
      expect(Number.isInteger(s.bricks)).toBe(true)
      let bricks = 0, skids = 0
      for (const t of s.towers) for (const k of t.skids) {
        bricks += k.bricks
        skids++
        expect(k.bricks).toBeLessThanOrEqual(BRICKS_PER_SKID)
      }
      expect(bricks).toBe(s.bricks)
      expect(skids).toBe(s.skids)
      expect(s.towers.length).toBeLessThanOrEqual(32)
      expect(s.cubeSideM.toFixed(1)).toBe(cube[g.cardId])
      // A believable pile, not one cube: several towers, and no taller than about 4 skids.
      if (s.skids > 3) expect(s.towers.length).toBeGreaterThan(2)
      expect(s.footprint.heightCm).toBeLessThan(420)
    }
  })

  test("skid capacity matches BEP's $64M of $100s", () => {
    expect(NOTES_PER_SKID).toBe(64e6 / 100)
    const s = billsToStack(64e6, 100)
    expect(s.skids).toBe(1)
    expect(s.towers.length).toBe(1)
  })

  test("sources are recorded", () => {
    const s = billsToStack(6e6)
    expect(s.sources.size).toBe(NOTE_SIZE_SRC)
    expect(s.sources.weight).toBe(NOTE_WEIGHT_SRC)
    expect(s.sources.packaging).toBe(PACKAGING_SRC)
    expect(s.sources.thickness).toBe(NOTE_THICKNESS_SRC)
    for (const u of [NOTE_SIZE_SRC, NOTE_WEIGHT_SRC, PACKAGING_SRC, NOTE_THICKNESS_SRC]) expect(u.startsWith("https://")).toBe(true)
  })
})

describe("money mesh", () => {
  test("largest gift stays under 60k vertices and about 130 draw calls; chunks are well formed", () => {
    const g = allGifts().sort((a, b) => b.amountUSD - a.amountUSD)[0]
    expect(g.cardId).toBe("packard")
    const s = billsToStack(g.amountUSD)
    const pile = buildMoneyPile(s, {x: 0, y: 0, z: 0})
    expect(pile.vertexCount).toBeLessThan(60000)
    expect(pileDrawCalls(pile)).toBeLessThanOrEqual(130)
    let sum = 0
    for (const t of pile.towers) for (const grp of MONEY_GROUPS) {
      for (const c of t.groups[grp]) wellFormed(c)
      sum += vertexCount(t.groups[grp])
    }
    expect(sum).toBe(pile.vertexCount)
    console.log(`[money] ${g.cardId}: ${s.skids} skids, ${pile.towers.length} towers, ${pile.vertexCount} verts, ${pileDrawCalls(pile)} draw calls`)
  })

  test("pile sits on the floor and the origin shifts it", () => {
    const s = billsToStack(30e6)
    const a = buildMoneyPile(s)
    const b = buildMoneyPile(s, {x: 100, y: 0, z: -50})
    expect(b.towers[0].position.x - a.towers[0].position.x).toBe(100)
    let minY = Infinity, maxY = -Infinity
    for (const t of a.towers) for (const grp of MONEY_GROUPS) for (const c of t.groups[grp]) {
      for (let i = 1; i < c.verts.length; i += 8) {
        minY = Math.min(minY, c.verts[i])
        maxY = Math.max(maxY, c.verts[i])
      }
    }
    expect(minY).toBeCloseTo(0, 6)
    expect(maxY).toBeLessThan(s.footprint.heightCm + 1)
    expect(maxY).toBeGreaterThan(s.footprint.heightCm - 1)
  })

  test("scale figure is exactly the requested height", () => {
    const f = buildScaleFigure(175)
    wellFormed(f)
    let maxY = 0
    for (let i = 1; i < f.verts.length; i += 8) maxY = Math.max(maxY, f.verts[i])
    expect(maxY).toBeCloseTo(175, 6)
  })
})

describe("caption and animation", () => {
  test("captions are computed from the numbers", () => {
    expect(captionFor("huang")).toBe("$30 million gift = 30 million $1 bills · 30 tonnes")
    expect(captionFor("hewlett")).toBe("$50 million pledge = 50 million $1 bills · 50 tonnes")
    expect(captionFor("packard")).toBe("$77.4 million Hewlett & Packard joint gift = 77.4 million $1 bills · 77.4 tonnes")
    expect(captionFor("gates")).toBe("$6 million gift = 6 million $1 bills · 6 tonnes")
    expect(captionFor("hoover")).toBe("")
  })

  test("grow-in finishes at 2 s and is staggered", () => {
    expect(towerGrow(0, 10, 0)).toBe(0)
    expect(towerGrow(9, 10, 1.0)).toBe(0)
    for (let i = 0; i < 10; i++) expect(towerGrow(i, 10, 2)).toBe(1)
    expect(towerGrow(0, 1, 0.8)).toBe(1)
  })

  test("pile distance is short of the building and capped", () => {
    expect(pileDistanceCm(60, 500)).toBe(1500)
    expect(pileDistanceCm(10, 500)).toBe(650)
    expect(pileDistanceCm(12, 400)).toBe(700)
  })
})

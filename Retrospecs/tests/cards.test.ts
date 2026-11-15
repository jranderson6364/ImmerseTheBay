import {describe, expect, test} from "bun:test"
import {LANDMARKS} from "../Assets/Retrospecs/Data/CampusData"
import {CARDS, cardById, factById} from "../Assets/Retrospecs/Core/Cards"
import {distanceM, latLonToEN} from "../Assets/Retrospecs/Core/Geo"

/** Card and fact ids that other code (Money.ts, Products.ts, Guide, tests) relies on. They must never change. */
const ORIGINAL: Record<string, string[]> = {
  huang: ["huang.1", "huang.2", "huang.3", "huang.4"],
  gates: ["gates.1", "gates.2", "gates.3", "gates.4"],
  packard: ["packard.1", "packard.2", "packard.3"],
  y2e2: ["y2e2.1", "y2e2.2", "y2e2.3", "y2e2.4"],
  shriram: ["shriram.1", "shriram.2", "shriram.3", "shriram.4"],
  spilker: ["spilker.1", "spilker.2", "spilker.3", "spilker.4"],
  allen: ["allen.1", "allen.2"],
  hewlett: ["hewlett.1", "hewlett.2"],
  hoover: ["hoover.1", "hoover.2", "hoover.3", "hoover.4"],
  memchu: ["memchu.1", "memchu.2", "memchu.3", "memchu.4"],
  mainquad: ["mainquad.1"],
  cantor: ["cantor.1"],
  hpgarage: ["hpgarage.1"]
}

/** Landmarks added for the wider tour: card id -> exact OSM name the bake must match. */
const ADDED: Record<string, string> = {
  varian: "Varian Physics Laboratory",
  moore: "Moore Material Research",
  mccullough: "McCullough",
  durand: "Durand Building",
  sequoia: "Sequoia Hall",
  greenearth: "Green Earth Sciences Building",
  mitchell: "Mitchell Earth Sciences Building",
  gilbert: "Gilbert Hall",
  clark: "James H. Clark Center",
  likashing: "Li Ka Shing Center",
  coda: "Computing & Data Science",
  bassbio: "Anne T. and Robert M. Bass Biology Research Building",
  sapp: "Sapp Center for Science Teaching and Learning",
  oldunion: "Old Union",
  tresidder: "Tresidder Memorial Union",
  greenlib: "Bing Wing",
  lathrop: "Lathrop Library",
  bookstore: "Stanford Bookstore",
  littlefield: "Littlefield Center"
}

/** Default map centre in the Lens (RetrospecsController startLat/startLon). The map disc is 700 m around it. */
const MAP_CENTER = latLonToEN(37.4281869, -122.1735285)
const MAP_RADIUS_M = 700
const THEMES = ["namesake", "founder", "inside", "architecture", "fun"]

describe("cards", () => {
  test("every original card and fact id still resolves", () => {
    for (const id of Object.keys(ORIGINAL)) {
      expect(cardById(id)).toBeDefined()
      for (const fid of ORIGINAL[id]) expect(factById(fid)?.card.id).toBe(id)
    }
  })

  test("card ids and fact ids are unique, and fact ids are prefixed with their card id", () => {
    const cardIds = new Set<string>()
    const factIds = new Set<string>()
    for (const c of CARDS) {
      expect(cardIds.has(c.id)).toBe(false)
      cardIds.add(c.id)
      for (const f of c.facts) {
        expect(factIds.has(f.id)).toBe(false)
        factIds.add(f.id)
        expect(f.id.startsWith(c.id + ".")).toBe(true)
      }
    }
  })

  test("every card has a label, name, at least one sourced fact, and valid themes", () => {
    for (const c of CARDS) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.label.length).toBeLessThanOrEqual(20)
      expect(c.name.length).toBeGreaterThan(0)
      expect(typeof c.namesake).toBe("string")
      expect(c.facts.length).toBeGreaterThan(0)
      for (const f of c.facts) {
        expect(f.source.startsWith("https://")).toBe(true)
        expect(f.text.length).toBeGreaterThan(10)
        expect(THEMES).toContain(f.theme)
      }
    }
  })

  test("every on-map card has a baked landmark, and no two landmarks share a footprint", () => {
    for (const c of CARDS) if (!c.offMap) expect(LANDMARKS.some((l) => l.id === c.id)).toBe(true)
    const used = new Set<number>()
    for (const l of LANDMARKS) {
      if (l.building < 0) continue
      expect(used.has(l.building)).toBe(false)
      used.add(l.building)
    }
  })

  test("added landmarks match the intended OSM footprint and sit inside the 700 m map", () => {
    for (const id of Object.keys(ADDED)) {
      const l = LANDMARKS.find((x) => x.id === id)
      expect(l).toBeDefined()
      expect(l!.osmName).toBe(ADDED[id])
      expect(l!.building).toBeGreaterThanOrEqual(0)
      expect(distanceM(MAP_CENTER, {e: l!.east, n: l!.north})).toBeLessThan(MAP_RADIUS_M)
      expect(cardById(id)).toBeDefined()
    }
  })
})

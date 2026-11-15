import {describe, expect, test} from "bun:test"
import {
  DEMO_STOPS, DemoState, demoHasNextStop, demoHint, demoIsLastCard, demoLine, demoNext, demoNudgeLine, demoPickTarget,
  demoSegment, demoStart, demoStopId
} from "../Assets/Retrospecs/Core/DemoScript"
import {cardById} from "../Assets/Retrospecs/Core/Cards"
import {LANDMARKS} from "../Assets/Retrospecs/Data/CampusData"
import {NARRATION} from "../Assets/Retrospecs/Data/NarrationData"

function run(events: Parameters<typeof demoNext>[1][]): DemoState {
  let s = demoStart()
  for (const ev of events) s = demoNext(s, ev)
  return s
}

describe("locked judge demo", () => {
  test("starts at the Main Quad, then Huang, then a question", () => {
    expect(DEMO_STOPS.map((s) => s.id)).toEqual(["mainquad", "huang"])
  })

  test("every stop is a real, carded, narrated building on the map, with valid segments", () => {
    for (const stop of DEMO_STOPS) {
      expect(cardById(stop.id)).toBeTruthy()
      expect(LANDMARKS.some((l) => l.id === stop.id)).toBe(true)
      const segs = (NARRATION as any)[stop.id] as unknown[]
      expect(segs && segs.length).toBeTruthy()
      expect(stop.cards.length).toBeGreaterThan(0)
      expect(stop.cards.length).toBeLessThanOrEqual(3) // keeps the demo near two minutes
      for (const i of stop.cards) expect(i >= 0 && i < segs.length).toBe(true)
    }
  })

  test("walks open → aim → cards → aim → cards → ask → end", () => {
    let s = demoStart()
    expect(s.step).toBe("open")
    s = demoNext(s, "mapOpened")
    expect(s).toEqual({step: "aim", stop: 0, card: 0})
    expect(demoPickTarget(s)).toBe("mainquad")
    s = demoNext(s, "picked")
    expect(s.step).toBe("cards")
    expect(demoSegment(s)).toBe(DEMO_STOPS[0].cards[0])
    for (let i = 1; i < DEMO_STOPS[0].cards.length; i++) s = demoNext(s, "cardPinch")
    expect(demoIsLastCard(s)).toBe(true)
    expect(demoHasNextStop(s)).toBe(true)
    s = demoNext(s, "cardPinch")
    expect(s).toEqual({step: "aim", stop: 1, card: 0})
    expect(demoPickTarget(s)).toBe("huang")
    s = demoNext(s, "picked")
    for (let i = 1; i < DEMO_STOPS[1].cards.length; i++) s = demoNext(s, "cardPinch")
    expect(demoHasNextStop(s)).toBe(false)
    s = demoNext(s, "cardPinch")
    expect(s.step).toBe("ask")
    expect(demoStopId(s)).toBe("huang") // Huang stays in focus for the question
    s = demoNext(s, "answered")
    expect(s.step).toBe("end")
    s = demoNext(s, "restart")
    expect(s).toEqual({step: "aim", stop: 0, card: 0})
  })

  test("stray events never skip a step", () => {
    expect(demoNext(demoStart(), "picked").step).toBe("open")
    expect(demoNext(demoStart(), "cardPinch").step).toBe("open")
    expect(demoNext(demoStart(), "restart").step).toBe("open")
    const aim = run(["mapOpened"])
    expect(demoNext(aim, "cardPinch")).toEqual(aim)
    expect(demoNext(aim, "answered")).toEqual(aim)
    const cards = run(["mapOpened", "picked"])
    expect(demoNext(cards, "picked")).toEqual(cards)
    expect(demoNext(cards, "answered")).toEqual(cards)
    const ask = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.map(() => "cardPinch" as const), "picked", ...DEMO_STOPS[1].cards.map(() => "cardPinch" as const)])
    expect(ask.step).toBe("ask")
    expect(demoNext(ask, "cardPinch")).toEqual(ask)
    expect(demoNext(ask, "picked")).toEqual(ask)
    const off: DemoState = {step: "off", stop: 0, card: 0}
    expect(demoNext(off, "mapOpened")).toEqual(off)
    expect(demoNext(off, "restart")).toEqual(off)
  })

  test("only the aim step has a pick target", () => {
    expect(demoPickTarget(demoStart())).toBe("")
    expect(demoPickTarget(run(["mapOpened", "picked"]))).toBe("")
    expect(demoSegment(run(["mapOpened"]))).toBe(-1)
  })

  test("tips and lines tell the visitor exactly what to do", () => {
    const aim = run(["mapOpened"])
    expect(demoHint(aim, "Main Quad")).toMatch(/right hand.*ray.*Main Quad/i)
    expect(demoHint(aim, "Main Quad", true)).toMatch(/pinch now/i)
    expect(demoLine(aim, "Main Quad")).toMatch(/Main Quad/)
    const cards = run(["mapOpened", "picked"])
    expect(demoHint(cards, "Main Quad")).toMatch(/Card 1 of \d.*pinch/i)
    expect(demoLine(cards, "Main Quad")).toBe("") // the narration is talking
    const last = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.slice(1).map(() => "cardPinch" as const)])
    expect(demoHint(last, "Main Quad")).toMatch(/Next Stop/)
    const ask = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.map(() => "cardPinch" as const), "picked", ...DEMO_STOPS[1].cards.map(() => "cardPinch" as const)])
    expect(demoHint(ask, "Huang")).toMatch(/LEFT hand/)
    expect(demoNudgeLine(ask, "Huang")).toMatch(/left hand/i)
    expect(demoHint(demoNext(ask, "answered"), "")).toMatch(/start again/i)
  })
})

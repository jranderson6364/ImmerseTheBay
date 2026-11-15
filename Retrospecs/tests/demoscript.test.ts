import {describe, expect, test} from "bun:test"
import {
  DEMO_ASK_TIMEOUT_SEC, DEMO_SKIP_HOLD_SEC, DEMO_STOPS, demoAnswerMaxSec, DemoState, demoSkipHint, isRestartDemoIntent, demoHasNextStop, demoHint, demoIsLastCard, demoLine, demoNext, demoNudgeLine, demoPickTarget,
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
  test("starts at the Main Quad, then Huang (with the question), then Hoover", () => {
    expect(DEMO_STOPS.map((s) => s.id)).toEqual(["mainquad", "huang", "hoover"])
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

  test("walks open → aim → cards → Main Quad archive → Huang → ask → Hoover → end", () => {
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
    expect(demoHasNextStop(s)).toBe(false) // the archive comes first
    expect(demoHint(s, "Main Quad")).toContain("real photos")
    s = demoNext(s, "cardPinch")
    // The Main Quad's Archive Gallery comes before Huang: card pinches don't skip it, only finishing the gallery does.
    expect(s.step).toBe("archive")
    expect(demoStopId(s)).toBe("mainquad")
    expect(demoLine(s, "Main Quad")).toContain("archive gallery")
    expect(demoNudgeLine(s, "Main Quad")).toContain("archive gallery")
    expect(demoNext(s, "cardPinch")).toEqual(s)
    expect(demoNext(s, "picked")).toEqual(s)
    s = demoNext(s, "archiveDone")
    expect(s).toEqual({step: "aim", stop: 1, card: 0})
    expect(demoPickTarget(s)).toBe("huang")
    s = demoNext(s, "picked")
    for (let i = 1; i < DEMO_STOPS[1].cards.length; i++) s = demoNext(s, "cardPinch")
    expect(demoHasNextStop(s)).toBe(false) // the question comes first
    s = demoNext(s, "cardPinch")
    // Then the question, still at Huang; its answer leads on to Hoover.
    expect(s.step).toBe("ask")
    expect(demoStopId(s)).toBe("huang")
    expect(demoNext(s, "cardPinch")).toEqual(s)
    s = demoNext(s, "answered")
    expect(s).toEqual({step: "aim", stop: 2, card: 0})
    expect(demoPickTarget(s)).toBe("hoover")
    s = demoNext(s, "picked")
    for (let i = 1; i < DEMO_STOPS[2].cards.length; i++) s = demoNext(s, "cardPinch")
    expect(demoHasNextStop(s)).toBe(false)
    expect(demoHint(s, "Hoover Tower")).toMatch(/continue/i)
    s = demoNext(s, "cardPinch")
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
    const ask = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.map(() => "cardPinch" as const), "archiveDone", "picked", ...DEMO_STOPS[1].cards.map(() => "cardPinch" as const)])
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
    expect(demoHint(aim, "Main Quad")).toMatch(/right hand.*Main Quad/i)
    expect(demoHint(aim, "Main Quad", true)).toMatch(/pinch now/i)
    expect(demoLine(aim, "Main Quad")).toMatch(/Main Quad/)
    const cards = run(["mapOpened", "picked"])
    expect(demoHint(cards, "Main Quad")).toMatch(/Card 1 of \d.*pinch/i)
    expect(demoLine(cards, "Main Quad")).toBe("") // the narration is talking
    const last = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.slice(1).map(() => "cardPinch" as const)])
    expect(demoHint(last, "Main Quad")).toMatch(/real photos/i) // the Main Quad's last card leads to its Photo Archive
    const archive = demoNext(last, "cardPinch")
    expect(demoHint(archive, "Main Quad")).toMatch(/look right.*archive gallery/i)
    const ask = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.map(() => "cardPinch" as const), "archiveDone", "picked", ...DEMO_STOPS[1].cards.map(() => "cardPinch" as const)])
    expect(demoHint(ask, "Huang")).toMatch(/Ask Me More/)
    expect(demoNudgeLine(ask, "Huang")).toMatch(/Ask Me More/)
    expect(demoNext(ask, "answered").step).toBe("aim") // on to Hoover
    const end = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.map(() => "cardPinch" as const), "archiveDone", "picked", ...DEMO_STOPS[1].cards.map(() => "cardPinch" as const), "answered", "picked", ...DEMO_STOPS[2].cards.map(() => "cardPinch" as const)])
    expect(end.step).toBe("end")
    expect(demoHint(end, "")).toMatch(/all yours/i)
    expect(demoHint(end, "")).not.toMatch(/left/i)
  })

  test("no in-between line mentions the arc, the ray or an axis", () => {
    const ask = run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.map(() => "cardPinch" as const), "archiveDone", "picked", ...DEMO_STOPS[1].cards.map(() => "cardPinch" as const)])
    const states = [demoStart(), run(["mapOpened"]), run(["mapOpened", "picked", ...DEMO_STOPS[0].cards.map(() => "cardPinch" as const)]), ask, demoNext(ask, "answered")]
    for (const st of states) for (const s of [demoLine(st, "Huang"), demoHint(st, "Huang")]) expect(s).not.toMatch(/(arc|ray|axis)/i)
  })

  test("the answer gets time to finish before the closing line", () => {
    expect(demoAnswerMaxSec("word ".repeat(80))).toBeGreaterThan(50)
    expect(DEMO_ASK_TIMEOUT_SEC).toBeGreaterThan(36)
  })

  test("presenter controls: restart phrases and the skip countdown", () => {
    for (const p of ["restart demo", "Reset the demo.", "start the demo over", "replay the tutorial"]) expect(isRestartDemoIntent(p)).toBe(true)
    for (const p of ["who designed the main quad", "demo", "restart", "what's the demographic"]) expect(isRestartDemoIntent(p)).toBe(false)
    expect(demoSkipHint(0.3)).toBe("")
    expect(demoSkipHint(1.2)).toMatch(/both pinches.*4$/)
    expect(demoSkipHint(4.5)).toMatch(/1$/)
    expect(demoSkipHint(DEMO_SKIP_HOLD_SEC)).toBe("")
  })
})

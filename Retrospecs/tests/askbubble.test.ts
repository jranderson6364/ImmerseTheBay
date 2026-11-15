import {describe, expect, test} from "bun:test"
import {CARDS} from "../Assets/Retrospecs/Core/Cards"
import {buildingMentioned, chatHeading, normalizeForMatch, phrasesFor} from "../Assets/Retrospecs/Core/AskBubble"

const m = (q: string) => buildingMentioned(q, CARDS)

describe("buildingMentioned", () => {
  test("finds buildings by label, full name and alias", () => {
    expect(m("When was Hoover Tower built?")).toBe("hoover")
    expect(m("how tall is hoover")).toBe("hoover")
    expect(m("Who paid for the Huang Engineering Center")).toBe("huang")
    expect(m("tell me about mem chu")).toBe("memchu")
    expect(m("what's inside the Gates building")).toBe("gates")
  })

  test("longest phrase wins", () => {
    expect(m("What happened in the Hewlett-Packard garage?")).toBe("hpgarage")
    expect(m("is the HP garage open")).toBe("hpgarage")
    expect(m("what's in Green Library")).toBe("greenlib")
    expect(m("what do they study in Green Earth Sciences")).toBe("greenearth")
  })

  test("whole words only", () => {
    expect(m("tell me more")).toBe("")
    expect(m("what's that building")).toBe("")
    expect(m("anything else about it?")).toBe("")
    expect(m("tell me more about Moore")).toBe("moore")
  })

  test("earliest mention breaks ties", () => {
    expect(m("is Gates older than Packard")).toBe("gates")
  })

  test("normalizes punctuation and case", () => {
    expect(normalizeForMatch("Y2E2, the Building!")).toBe(" y2e2 the building ")
    expect(m("What is Y2E2?")).toBe("y2e2")
  })

  test("every card has at least one phrase", () => {
    for (const c of CARDS) expect(phrasesFor(c).length).toBeGreaterThan(0)
  })
})

test("chatHeading", () => {
  expect(chatHeading("Huang")).toBe("Ask · Huang")
  expect(chatHeading("")).toBe("Ask · Stanford")
})

import {locateOnlyTarget} from "../Assets/Retrospecs/Core/AskBubble"

describe("locateOnlyTarget", () => {
  const l = (q: string) => locateOnlyTarget(q, CARDS)
  test("plain where/show-me requests select the building", () => {
    expect(l("Show me where Hoover Tower is")).toBe("hoover")
    expect(l("show me where the HP garage is.")).toBe("hpgarage")
    expect(l("Where's Green Library?")).toBe("greenlib")
    expect(l("where is memorial church")).toBe("memchu")
    expect(l("Can you show me the Huang Engineering Center?")).toBe("huang")
    expect(l("find Gates on the map please")).toBe("gates")
    expect(l("take me to the main quad")).toBe("mainquad")
    expect(l("which one is Y2E2")).toBe("y2e2")
  })
  test("real questions still get answered", () => {
    expect(l("Where is Hoover Tower and when was it built?")).toBe("")
    expect(l("why is Hoover where it is")).toBe("")
    expect(l("show me what's inside Huang")).toBe("")
    expect(l("when was Hoover Tower built")).toBe("")
    expect(l("where is the bathroom")).toBe("")
    expect(l("show me where it is")).toBe("")
  })
})

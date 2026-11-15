import {describe, expect, test} from "bun:test"
import {COACH_FIRST, coachAim, coachAllowsPick, coachHint, coachLine, coachNext, coachWrongPickLine, suggestedBuilding} from "../Assets/Retrospecs/Core/Coach"
import {CENTERPIECES} from "../Assets/Retrospecs/Core/Centerpieces"
import {cardById} from "../Assets/Retrospecs/Core/Cards"

describe("indoor demo coach", () => {
  test("walks start → pick → card → done", () => {
    let s = coachNext("start", "mapOpened")
    expect(s).toBe("pick")
    s = coachNext(s, "picked")
    expect(s).toBe("card")
    s = coachNext(s, "more")
    expect(s).toBe("done")
  })

  test("any card action finishes it; stray events don't skip steps", () => {
    for (const ev of ["more", "next", "closed", "picked"] as const) expect(coachNext("card", ev)).toBe("done")
    expect(coachNext("card", "mapOpened")).toBe("card")
    expect(coachNext("start", "picked")).toBe("start")
    expect(coachNext("pick", "closed")).toBe("pick")
    expect(coachNext("off", "picked")).toBe("off")
  })

  test("the pick step only accepts the target building", () => {
    expect(coachAllowsPick("pick", "hoover", "hoover")).toBe(true)
    expect(coachAllowsPick("pick", "gates", "hoover")).toBe(false)
    expect(coachAllowsPick("pick", "", "hoover")).toBe(false) // nothing aimed at: no free pass
    for (const step of ["card", "done", "off"] as const) expect(coachAllowsPick(step, "gates", "hoover")).toBe(true)
  })

  test("aim: nothing, the target, or something else", () => {
    expect(coachAim("", "hoover")).toBe("none")
    expect(coachAim("hoover", "hoover")).toBe("target")
    expect(coachAim("gates", "hoover")).toBe("other")
  })

  test("pick tips explain the hand ray, steer off wrong buildings, and say pinch on the target", () => {
    expect(coachHint("pick", "none", "Hoover Tower")).toMatch(/right hand.*ray.*Hoover Tower/i)
    expect(coachHint("pick", "other", "Hoover Tower", "Gates")).toMatch(/Gates.*Hoover Tower/)
    expect(coachHint("pick", "target", "Hoover Tower")).toMatch(/pinch now/i)
    expect(coachHint("off", "none", "")).toBe("")
    expect(coachWrongPickLine("Hoover Tower", "Gates")).toContain("Hoover Tower")
  })

  test("only the first two steps speak; the guide narrates the rest", () => {
    expect(coachLine("start")).toMatch(/pinch/i)
    expect(coachLine("pick", "Hoover Tower")).toMatch(/cursor.*Hoover Tower/)
    expect(coachLine("card")).toBe("")
  })

  test("suggests the Main Quad first: the biggest, easiest target", () => {
    expect(COACH_FIRST[0]).toBe("mainquad")
    expect(cardById("mainquad")).toBeTruthy()
    for (const id of CENTERPIECES) expect(COACH_FIRST).toContain(id)
    expect(suggestedBuilding(["gates", "huang", "hoover", "mainquad"], COACH_FIRST)).toBe("mainquad")
    expect(suggestedBuilding(["gates", "huang", "hoover"], COACH_FIRST)).toBe("hoover")
    expect(suggestedBuilding(["gates"], ["hoover"])).toBe("gates")
    expect(suggestedBuilding([], ["hoover"])).toBe("")
  })
})

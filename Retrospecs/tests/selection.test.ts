import {describe, expect, test} from "bun:test"
import {
  DEBOUNCE_SEC,
  HOVER_HOLD_SEC,
  LOCK_MIN_SEC,
  MIN_FOCUS_IDLE_SEC,
  POST_SPEECH_LOCK_SEC,
  SWITCH_DWELL_SEC,
  SelectionInput,
  decideSelection,
  focusIdleExpired,
  hoverHeldSec,
  isLocked,
  newHoverState,
  selectionTarget,
  stepHover
} from "../Assets/Retrospecs/Core/Selection"

const base = (o: Partial<SelectionInput>): SelectionInput => ({now: 10, focusId: "hoover", lastActionAt: 8, locked: true, pickId: "", pickHeldSec: 0, ...o})

describe("lock", () => {
  test("locked right after selecting, and while speaking", () => {
    expect(isLocked(10, 9, -1, false)).toBe(true)
    expect(isLocked(100, 9, -1, true)).toBe(true)
  })
  test("stays locked briefly after speech ends, then unlocks", () => {
    expect(isLocked(20, 0, 20 - POST_SPEECH_LOCK_SEC / 2, false)).toBe(true)
    expect(isLocked(20, 0, 20 - POST_SPEECH_LOCK_SEC - 0.01, false)).toBe(false)
    expect(isLocked(LOCK_MIN_SEC + 0.01, 0, -1, false)).toBe(false)
  })
})

describe("selection decision", () => {
  test("accidental pinch on a neighbour stays put (more)", () => {
    const s = base({pickId: "green", pickHeldSec: 0.1})
    expect(decideSelection(s)).toBe("more")
    expect(selectionTarget("more", s)).toBe("hoover")
  })
  test("unhovered fallback pick never switches while locked", () => {
    expect(decideSelection(base({pickId: "green", pickHeldSec: 0}))).toBe("more")
  })
  test("deliberate dwell switches", () => {
    const s = base({pickId: "green", pickHeldSec: SWITCH_DWELL_SEC})
    expect(decideSelection(s)).toBe("switch")
    expect(selectionTarget("switch", s)).toBe("green")
    expect(decideSelection(base({pickId: "green", pickHeldSec: SWITCH_DWELL_SEC - 0.01}))).toBe("more")
  })
  test("unlocked: a hovered neighbour switches at once", () => {
    expect(decideSelection(base({locked: false, pickId: "green", pickHeldSec: 0}))).toBe("switch")
  })
  test("empty pinch or same building = more, never deselect", () => {
    expect(decideSelection(base({pickId: ""}))).toBe("more")
    expect(decideSelection(base({pickId: "hoover", pickHeldSec: 0}))).toBe("more")
    expect(decideSelection(base({locked: false, pickId: ""}))).toBe("more")
  })
  test("nothing focused: a pick selects, nothing aimed is the caller's fallback", () => {
    expect(decideSelection(base({focusId: "", locked: false, pickId: "green"}))).toBe("switch")
    expect(decideSelection(base({focusId: "", locked: false, pickId: ""}))).toBe("none")
  })
  test("debounce: a second pinch within the window is ignored", () => {
    expect(decideSelection(base({now: 10, lastActionAt: 10 - DEBOUNCE_SEC / 2}))).toBe("ignore")
    expect(decideSelection(base({now: 10, lastActionAt: 10 - DEBOUNCE_SEC, pickId: ""}))).toBe("more")
    expect(decideSelection(base({lastActionAt: -1, focusId: "", pickId: "green"}))).toBe("switch")
  })
})

describe("hover hysteresis", () => {
  test("from nothing, adopts at once", () => {
    const h = stepHover(newHoverState(), "hoover", 1)
    expect(h.id).toBe("hoover")
    expect(hoverHeldSec(h, 1.3)).toBeCloseTo(0.3)
  })
  test("brief flicker to a neighbour stays put", () => {
    const h = stepHover(newHoverState(), "hoover", 0)
    stepHover(h, "green", 1)
    stepHover(h, "green", 1 + HOVER_HOLD_SEC / 2)
    expect(h.id).toBe("hoover")
    stepHover(h, "hoover", 1.15)
    stepHover(h, "green", 1.2)
    stepHover(h, "green", 1.2 + HOVER_HOLD_SEC * 0.9)
    expect(h.id).toBe("hoover")
  })
  test("a neighbour held long enough takes over; dwell counts from when it first appeared", () => {
    const h = stepHover(newHoverState(), "hoover", 0)
    stepHover(h, "green", 1)
    stepHover(h, "green", 1 + HOVER_HOLD_SEC)
    expect(h.id).toBe("green")
    expect(hoverHeldSec(h, 1.5)).toBeCloseTo(0.5)
  })
  test("brief drop to nothing keeps the hover; a sustained one clears it", () => {
    const h = stepHover(newHoverState(), "hoover", 0)
    stepHover(h, "", 1)
    stepHover(h, "", 1.1)
    expect(h.id).toBe("hoover")
    stepHover(h, "", 1 + HOVER_HOLD_SEC)
    expect(h.id).toBe("")
    expect(hoverHeldSec(h, 5)).toBe(0)
  })
})

describe("focus idle", () => {
  test("never fires while speaking", () => {
    expect(focusIdleExpired(1000, 0, 25, true)).toBe(false)
  })
  test("waits at least the floor after speech, even if the scene says less", () => {
    expect(focusIdleExpired(MIN_FOCUS_IDLE_SEC - 1, 0, 25, false)).toBe(false)
    expect(focusIdleExpired(MIN_FOCUS_IDLE_SEC, 0, 25, false)).toBe(true)
    expect(focusIdleExpired(45, 0, 50, false)).toBe(false)
  })
  test("0 = never", () => {
    expect(focusIdleExpired(1e6, 0, 0, false)).toBe(false)
  })
})

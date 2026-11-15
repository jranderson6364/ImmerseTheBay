/**
 * Indoor demo coach: a short walkthrough for someone who has never worn Specs. No calibration, no "face east":
 *
 *   start  "Pinch to open the map."                       any pinch places the map in front of you
 *   pick   "Aim your hand's ray at the Main Quad, pinch."  ONLY the suggested building can be picked, so the visitor
 *                                                         proves they can steer the cursor before anything else
 *   card   "Pinch the card for more · Next spot · X"      after the Main Quad opens
 *   done   "That's it. Pinch Ask on a card to ask."     after one more action, then it fades out
 *
 * Pure TypeScript (no Lens Studio APIs), unit-tested in tests/coach.test.ts.
 */

export type CoachStep = "start" | "pick" | "card" | "done" | "off"

/** What just happened, as far as the coach cares. */
export type CoachEvent = "mapOpened" | "picked" | "more" | "next" | "closed"

/** Where the cursor is during the pick step: nowhere, on the building we asked for, or on some other building. */
export type CoachAim = "none" | "target" | "other"

/** How long the closing tip stays up before the coach goes quiet (s). */
export const DONE_HOLD_SEC = 8

export function coachNext(step: CoachStep, ev: CoachEvent): CoachStep {
  if (step === "start" && ev === "mapOpened") return "pick"
  if (step === "pick" && ev === "picked") return "card"
  if (step === "card" && ev !== "mapOpened") return "done"
  return step
}

/** During the pick step only the suggested building may be selected; every other step allows anything. */
export function coachAllowsPick(step: CoachStep, pickId: string, suggestId: string): boolean {
  if (step !== "pick" || !suggestId) return true
  return pickId === suggestId
}

export function coachAim(hoverId: string, suggestId: string): CoachAim {
  if (!hoverId) return "none"
  return hoverId === suggestId ? "target" : "other"
}

/**
 * The tip shown under the caption for this step ("" = none). `target` = the building we asked for, `other` = the
 * one the cursor is on instead (pick step only).
 */
export function coachHint(step: CoachStep, aim: CoachAim, target: string, other = ""): string {
  const t = target || "the glowing building"
  switch (step) {
    case "start":
      return "Pinch your thumb and index finger together to start."
    case "pick":
      if (aim === "target") return `${t} turned blue. Pinch now!`
      if (aim === "other") return `That's ${other || "another building"}. Move your hand to ${t}, the gold one.`
      return `Raise your right hand. Aim its ray at ${t}, the gold one.`
    case "card":
      return "Pinch the card for more  ·  Next spot for another  ·  X to close"
    case "done":
      return "You've got it. Pick any building, or pinch Ask on its card to ask a question."
    default:
      return ""
  }
}

/** Spoken once when a step starts ("" = stay quiet: the guide is narrating). */
export function coachLine(step: CoachStep, target = ""): string {
  switch (step) {
    case "start":
      return "Welcome to Retrospecs, a tour guide for Stanford. Pinch your thumb and finger together to start."
    case "pick":
      return `Raise your right hand. The ray from your hand is your cursor. Aim it at ${target || "the glowing building"}, the gold one. When it turns blue, pinch.`
    default:
      return ""
  }
}

/** Spoken when the visitor pinches the wrong building during the pick step. */
export function coachWrongPickLine(target: string, other: string): string {
  return `That's ${other || "a different building"}. Try ${target}, the gold one.`
}

/** Buildings the pick step points people at, best first: the Main Quad is the biggest, easiest target on the map. */
export const COACH_FIRST: string[] = ["mainquad", "hoover", "huang", "hpgarage", "memchu"]

/** The building the pick step points people at: the first preferred building that is on the map. */
export function suggestedBuilding(onMap: string[], preferred: string[]): string {
  for (const id of preferred) if (onMap.indexOf(id) >= 0) return id
  return onMap.length ? onMap[0] : ""
}

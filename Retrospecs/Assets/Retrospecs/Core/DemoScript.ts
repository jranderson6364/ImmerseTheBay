/**
 * Locked judge demo (`demoMode` on the controller): a fixed two-minute path a first-timer can't get lost in.
 *
 *   open   "Pinch to open the map."                     any pinch places the map in front of you
 *   aim    "Aim your right hand's ray at the Main Quad"  ONLY the stop's building can light up or be picked
 *   cards  "Pinch the card for the next one"            each card pinch shows the stop's next scripted card;
 *                                                        on the last card, a pinch moves on (Next Stop glows)
 *          ... the same aim + cards for Huang ...
 *   ask    "Pinch your LEFT hand and ask a question"    only the left hand (or the mic bubble) does anything
 *   end    "That's the demo"                            a right pinch or "restart demo" starts over for the next judge
 *
 * Every stop lists the narration segments it plays (`cards`), so a content change can't stretch the demo past two
 * minutes: only these segments are shown, in this order.
 *
 * Pure TypeScript (no Lens Studio APIs), unit-tested in tests/demoscript.test.ts.
 */

export type DemoStep = "open" | "aim" | "cards" | "ask" | "end" | "off"

export interface DemoStop {
  /** Landmark / card id. */
  id: string
  /** Narration segment indices to show, in order (0 = overview). Two per stop keeps the demo near two minutes. */
  cards: number[]
}

export const DEMO_STOPS: DemoStop[] = [
  {id: "mainquad", cards: [0, 1]},
  {id: "huang", cards: [0, 2]}
]

/** A question the checked cards answer, so it works even when the venue Wi-Fi doesn't. */
export const DEMO_SUGGESTED_QUESTION = "Who is this building named after?"

/** The ask step moves on once the answer finishes speaking, or after this long whatever happens (s). */
export const DEMO_ASK_TIMEOUT_SEC = 25

export interface DemoState {
  step: DemoStep
  /** Index into DEMO_STOPS. */
  stop: number
  /** Index into the stop's `cards`. */
  card: number
}

export type DemoEvent = "mapOpened" | "picked" | "cardPinch" | "answered" | "restart"

export function demoStart(): DemoState {
  return {step: "open", stop: 0, card: 0}
}

export function demoNext(s: DemoState, ev: DemoEvent, stops: DemoStop[] = DEMO_STOPS): DemoState {
  if (s.step === "off") return s
  if (ev === "restart") return s.step === "open" ? s : {step: "aim", stop: 0, card: 0}
  switch (s.step) {
    case "open":
      return ev === "mapOpened" ? {step: "aim", stop: 0, card: 0} : s
    case "aim":
      return ev === "picked" ? {step: "cards", stop: s.stop, card: 0} : s
    case "cards": {
      if (ev !== "cardPinch") return s
      const n = stops[s.stop] ? stops[s.stop].cards.length : 0
      if (s.card + 1 < n) return {step: "cards", stop: s.stop, card: s.card + 1}
      if (s.stop + 1 < stops.length) return {step: "aim", stop: s.stop + 1, card: 0}
      return {step: "ask", stop: s.stop, card: s.card}
    }
    case "ask":
      return ev === "answered" ? {step: "end", stop: s.stop, card: s.card} : s
    default:
      return s
  }
}

/** The stop's building ("" outside a stop). In `ask` and `end`, the last stop's building stays in focus. */
export function demoStopId(s: DemoState, stops: DemoStop[] = DEMO_STOPS): string {
  if (s.step === "open" || s.step === "off") return ""
  return stops[s.stop] ? stops[s.stop].id : ""
}

/** The only building that may light up or be picked right now ("" = none). */
export function demoPickTarget(s: DemoState, stops: DemoStop[] = DEMO_STOPS): string {
  return s.step === "aim" ? demoStopId(s, stops) : ""
}

/** Narration segment to play for the current card (-1 = none). */
export function demoSegment(s: DemoState, stops: DemoStop[] = DEMO_STOPS): number {
  if (s.step !== "cards") return -1
  const stop = stops[s.stop]
  return stop && s.card < stop.cards.length ? stop.cards[s.card] : -1
}

export function demoIsLastCard(s: DemoState, stops: DemoStop[] = DEMO_STOPS): boolean {
  if (s.step !== "cards") return false
  const stop = stops[s.stop]
  return !!stop && s.card === stop.cards.length - 1
}

/** True when the last card's pinch leads to another building (Next Stop), false when it leads to the question. */
export function demoHasNextStop(s: DemoState, stops: DemoStop[] = DEMO_STOPS): boolean {
  return s.stop + 1 < stops.length
}

/** Step label for the caption, like "Stop 1 of 2". */
export function demoProgress(s: DemoState, stops: DemoStop[] = DEMO_STOPS): string {
  if (s.step === "aim" || s.step === "cards") return `Stop ${s.stop + 1} of ${stops.length}`
  if (s.step === "ask") return "Last step"
  return ""
}

/** The tip under the caption. `onTarget`: the cursor is on the stop's building (aim step). */
export function demoHint(s: DemoState, label: string, onTarget = false, stops: DemoStop[] = DEMO_STOPS): string {
  const t = label || "the gold building"
  switch (s.step) {
    case "open":
      return "Pinch your thumb and index finger together to open the map."
    case "aim":
      if (onTarget) return `${t} turned blue. Pinch now!`
      return s.stop === 0
        ? `Raise your right hand. Aim its ray at ${t}, the big gold one.`
        : `Now aim at ${t}, the gold one. Follow the arc.`
    case "cards": {
      const n = stops[s.stop] ? stops[s.stop].cards.length : 1
      const count = `Card ${s.card + 1} of ${n}`
      // The animation, person and diagram sit beside the card, past the edge of the display: say where to look.
      const look = s.card === 0 ? "  ·  Turn your head left and right to see more" : ""
      if (!demoIsLastCard(s, stops)) return `${count}${look}  ·  Aim at the card and pinch for the next one`
      return demoHasNextStop(s, stops) ? `${count}  ·  Pinch Next Stop on the card to move on` : `${count}  ·  Pinch the card when you're ready for the last step`
    }
    case "ask":
      return `Pinch your LEFT hand, then ask out loud. Try: "${DEMO_SUGGESTED_QUESTION}"`
    case "end":
      return "That's Retrospecs. Thanks for trying it!  ·  Pinch to start again"
    default:
      return ""
  }
}

/** Spoken once when a step starts ("" = stay quiet: the narration is talking). */
export function demoLine(s: DemoState, label: string): string {
  const t = label || "the gold building"
  switch (s.step) {
    case "open":
      return "Welcome to Retrospecs, a tour guide for Stanford. Pinch your thumb and finger together to open the map."
    case "aim":
      return s.stop === 0
        ? `Raise your right hand. The ray from your hand is your cursor. Aim it at ${t}, the big gold building. When it turns blue, pinch.`
        : `Next stop: ${t}. Follow the arc and aim at the gold building, then pinch.`
    case "ask":
      return `Last thing. You can ask me anything. Pinch your left hand and ask, for example: ${DEMO_SUGGESTED_QUESTION}`
    case "end":
      return "That's the demo. Thanks for touring Stanford with Retrospecs."
    default:
      return ""
  }
}

/** Spoken when the visitor pinches somewhere the step doesn't use. */
export function demoNudgeLine(s: DemoState, label: string): string {
  switch (s.step) {
    case "aim":
      return `Aim at ${label || "the gold building"} first, then pinch.`
    case "cards":
      return "Point your right hand at the card, then pinch."
    case "ask":
      return "Use your left hand: pinch it, then ask your question."
    default:
      return ""
  }
}

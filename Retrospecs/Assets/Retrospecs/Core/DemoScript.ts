/**
 * Locked judge demo (`demoMode` on the controller): a fixed two-minute path a first-timer can't get lost in.
 *
 *   open   "Pinch to open the map."                     any pinch places the map in front of you
 *   aim    "Point your right hand at the Main Quad"     ONLY the stop's building can light up or be picked
 *   cards  "Pinch Next Card"                            each card pinch shows the stop's next scripted card;
 *                                                        on the last card, a pinch moves on. Ask Me More and
 *                                                        Next Stop stay hidden until the ask step / free roam.
 *   archive "Look right · Pinch the Archive Gallery"      Main Quad only (`archive: true`): the collage right of the
 *                                                        card explodes into framed real photos splayed out on the
 *                                                        right; pinching any photo folds them back and moves on
 *          ... the same aim + cards for Huang ...
 *   ask    "Pinch Ask Me More"                           Huang only (`ask: true`): only the glowing Ask button, which
 *                                                        appears now (then a question chip or voice); the answer moves on
 *   aim    "Last stop: Hoover Tower"                     the finale (`cards: []`): the pinch opens Hoover the normal
 *                                                        free-roam way and the guided part ends right there
 *   end    "Now it's all yours"                         the guided part is over: everything unlocks (free roam)
 *
 * Presenter controls: hold BOTH pinches for 5 s at any step to skip straight to free roam (for filming), and say
 * "restart demo" at any time to set the guided path up again for the next judge.
 *
 * Every stop lists the narration segments it plays (`cards`), so a content change can't stretch the demo past two
 * minutes: only these segments are shown, in this order.
 *
 * Pure TypeScript (no Lens Studio APIs), unit-tested in tests/demoscript.test.ts.
 */

export type DemoStep = "open" | "aim" | "cards" | "archive" | "ask" | "end" | "off"

export interface DemoStop {
  /** Landmark / card id. */
  id: string
  /**
   * Narration segment indices to show, in order (0 = overview). Two per stop keeps the demo near two minutes. Empty
   * on the finale: picking it ends the guided part, and the building opens as in free roam.
   */
  cards: number[]
  /** After the cards, open the Archive Gallery (Core/Archive.ts) before moving on. */
  archive?: boolean
  /** After the cards (and archive), the Ask Me More question before moving on. */
  ask?: boolean
}

export const DEMO_STOPS: DemoStop[] = [
  {id: "mainquad", cards: [0, 1], archive: true},
  {id: "huang", cards: [0, 2], ask: true},
  {id: "hoover", cards: []}
]

/** A question the checked cards answer, so it works even when the venue Wi-Fi doesn't. */
/** The first chip in the chat: answered from the checked card, offline, so it works even when the Wi-Fi doesn't. */
export const DEMO_SUGGESTED_QUESTION = "Who's it named after?"

/** Spoken when Ask is pinched before the ask step. */
export const DEMO_ASK_LATER_LINE = "Questions come a little later. Pinch the card for the next one."

/**
 * The ask step moves on when the answer FINISHES speaking (its own done callback), never on a timer that could cut
 * it off. Safety nets only: no answer at all after DEMO_ASK_TIMEOUT_SEC (the web lookup tries two providers at up
 * to 18 s each), or an answer whose audio never reports finishing (demoAnswerMaxSec).
 */
export const DEMO_ASK_TIMEOUT_SEC = 45

/** Pause between the end of the answer and the closing line (s). */
export const DEMO_AFTER_ANSWER_SEC = 0.8

/** Most an answer may take from the moment it is handed to speech: TTS latency plus generous reading time (s). */
export function demoAnswerMaxSec(text: string): number {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length
  return 20 + words / 2
}

/** Hold both pinches this long (s) to skip the guided demo. The countdown tip shows after DEMO_SKIP_SHOW_SEC. */
export const DEMO_SKIP_HOLD_SEC = 5
export const DEMO_SKIP_SHOW_SEC = 1

/** "restart demo" / "reset the demo" / "start the demo over": the presenter sets the guided path up again. */
export function isRestartDemoIntent(raw: string): boolean {
  const t = (raw || "").toLowerCase()
  return /\b(restart|reset|replay)( the)? (guided )?(demo|tour guide|tutorial)\b|\bstart (the )?(demo|tutorial) (over|again)\b/.test(t)
}

/** Tip while both pinches are held ("" = not yet, or done). */
export function demoSkipHint(heldSec: number): string {
  if (heldSec < DEMO_SKIP_SHOW_SEC || heldSec >= DEMO_SKIP_HOLD_SEC) return ""
  return `Keep holding both pinches to skip the guided demo… ${Math.ceil(DEMO_SKIP_HOLD_SEC - heldSec)}`
}

export interface DemoState {
  step: DemoStep
  /** Index into DEMO_STOPS. */
  stop: number
  /** Index into the stop's `cards`. */
  card: number
}

export type DemoEvent = "mapOpened" | "picked" | "cardPinch" | "archiveDone" | "answered" | "restart"

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
      if (ev !== "picked") return s
      return stops[s.stop] && stops[s.stop].cards.length ? {step: "cards", stop: s.stop, card: 0} : afterCards(s, stops)
    case "cards": {
      if (ev !== "cardPinch") return s
      const n = stops[s.stop] ? stops[s.stop].cards.length : 0
      if (s.card + 1 < n) return {step: "cards", stop: s.stop, card: s.card + 1}
      if (stops[s.stop] && stops[s.stop].archive) return {step: "archive", stop: s.stop, card: s.card}
      return afterCards(s, stops)
    }
    case "archive":
      return ev === "archiveDone" ? afterCards(s, stops) : s
    case "ask":
      return ev === "answered" ? afterStop(s, stops) : s
    default:
      return s
  }
}

/** After a stop's cards (and archive): its question, if it has one, else the next stop. */
function afterCards(s: DemoState, stops: DemoStop[]): DemoState {
  if (stops[s.stop] && stops[s.stop].ask) return {step: "ask", stop: s.stop, card: s.card}
  return afterStop(s, stops)
}

/** Where a finished stop leads: the next stop's aim, or free roam after the last one. */
function afterStop(s: DemoState, stops: DemoStop[]): DemoState {
  if (s.stop + 1 < stops.length) return {step: "aim", stop: s.stop + 1, card: 0}
  return {step: "end", stop: s.stop, card: s.card}
}

/** The stop's building ("" outside a stop). In `ask` and `end`, that stop's building stays in focus. */
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

/** True when the last card's pinch leads straight to another building (Next Stop), not a question or the end. */
export function demoHasNextStop(s: DemoState, stops: DemoStop[] = DEMO_STOPS): boolean {
  const stop = stops[s.stop]
  return s.stop + 1 < stops.length && !(stop && (stop.ask || stop.archive))
}

/** True on the finale: the last stop, with no scripted cards, whose pick hands over to free roam. */
export function demoIsFinale(s: DemoState, stops: DemoStop[] = DEMO_STOPS): boolean {
  return s.stop === stops.length - 1 && !!stops[s.stop] && stops[s.stop].cards.length === 0
}

/** True when the stop's last card leads to its Archive Gallery. */
export function demoHasArchive(s: DemoState, stops: DemoStop[] = DEMO_STOPS): boolean {
  return !!stops[s.stop] && !!stops[s.stop].archive
}

/** Step label for the caption, like "Stop 1 of 2". */
export function demoProgress(s: DemoState, stops: DemoStop[] = DEMO_STOPS): string {
  if (s.step === "aim" || s.step === "cards" || s.step === "archive" || s.step === "ask") return `Stop ${s.stop + 1} of ${stops.length}`
  return ""
}

/** The tip under the caption. `onTarget`: the cursor is on the stop's building (aim step). */
export function demoHint(s: DemoState, label: string, onTarget = false, stops: DemoStop[] = DEMO_STOPS): string {
  const t = label || "the gold building"
  switch (s.step) {
    case "open":
      return "Pinch your thumb and index finger together to open the map."
    case "aim":
      if (onTarget) return `${t} is blue. Pinch now!`
      if (demoIsFinale(s, stops)) return `Last stop: point at ${t}, then pinch and explore on your own`
      return s.stop === 0 ? `Point your right hand at ${t}, then pinch` : `Point at ${t}, then pinch`
    case "cards": {
      const n = stops[s.stop] ? stops[s.stop].cards.length : 1
      const count = `Card ${s.card + 1} of ${n}`
      // The 3D animation and the founder sit either side of the card, past the edge of the display: say where to look.
      const look = s.card === 0 ? "  ·  Look left and right" : ""
      if (!demoIsLastCard(s, stops)) return `${count}${look}  ·  Pinch Next Card`
      if (demoHasArchive(s, stops)) return `${count}  ·  Pinch the card for real photos`
      return demoHasNextStop(s, stops) ? `${count}  ·  Pinch the card for the next stop` : `${count}  ·  Pinch the card to continue`
    }
    case "archive":
      return "Look right  ·  Pinch the Archive Gallery"
    case "ask":
      return `Pinch Ask Me More, then ask out loud or tap a question. Try "${DEMO_SUGGESTED_QUESTION}"`
    case "end":
      return "Now it's all yours  ·  Pinch any building  ·  Pinch Ask Me More to ask"
    default:
      return ""
  }
}

/** Spoken once when a step starts ("" = stay quiet: the narration is talking). */
export function demoLine(s: DemoState, label: string): string {
  const t = label || "the gold building"
  switch (s.step) {
    case "open":
      return "Welcome to Retrospecs, your Stanford tour guide. Pinch your thumb and finger together to open the map."
    case "aim":
      if (demoIsFinale(s)) return `Last stop, ${t}. Point at it and pinch, and then the campus is yours to explore.`
      return s.stop === 0
        ? `Point your right hand at ${t}. When it turns blue, pinch.`
        : `Next up, ${t}. Point at it and pinch.`
    case "archive":
      return "Want to see the real thing? Look to your right and pinch the archive gallery."
    case "ask":
      return "Now you ask. Pinch Ask Me More, and ask me anything."
    case "end":
      return "That's the guided tour. Now it's all yours. Pinch any building to explore."
    default:
      return ""
  }
}

/** Spoken when the visitor pinches somewhere the step doesn't use. */
export function demoNudgeLine(s: DemoState, label: string): string {
  switch (s.step) {
    case "aim":
      return `Point at ${label || "the gold building"} first, then pinch.`
    case "cards":
      return "Point at the card, then pinch."
    case "archive":
      return "Look right, point at the archive gallery, and pinch."
    case "ask":
      return "Pinch Ask Me More on the card."
    default:
      return ""
  }
}

/** Caption while the Archive Gallery's prints are out. */
export function demoArchiveOpenHint(): string {
  return "Look over the photos  ·  Pinch any photo to put them back and move on"
}

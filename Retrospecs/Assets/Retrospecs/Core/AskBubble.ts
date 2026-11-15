/**
 * "Ask": the one way to ask a question (the Ask button on the card opens the chat's mic). Pure, unit-tested.
 *
 * A spoken question ("when was Hoover Tower built?") selects the building it names as if it had been pinched, so
 * the map highlight, card, 3D pieces and holograms come up with the answer. Matching is on whole words, longest
 * phrase first, so "Hewlett-Packard garage" is the HP Garage (not Hewlett or Packard), "Green Library" is not
 * "Green Earth Sciences", and "tell me more" never means Moore.
 */
import {Card, Fact} from "./Cards"
import {isNextSpotIntent} from "./NextSpot"

/** Extra spoken forms beyond each card's name, label and id (ASR spellings included). */
export const BUILDING_ALIASES: Record<string, string[]> = {
  huang: ["hwang", "huang center"],
  y2e2: ["y 2 e 2", "y two e two", "why two e two", "environment and energy building"],
  hoover: ["hoover"],
  memchu: ["mem chu", "memorial church", "stanford church"],
  hpgarage: ["hp garage", "h p garage", "hewlett packard garage", "hewlett-packard garage", "the garage"],
  varian: ["varian"],
  clark: ["clark"],
  coda: ["coda", "co da"],
  likashing: ["li ka shing", "lee ka shing"],
  greenlib: ["green library", "bing wing"],
  greenearth: ["green earth"],
  mainquad: ["main quad"],
  bassbio: ["bass biology", "bass"],
  sapp: ["sapp"],
  tresidder: ["tresidder"],
  oldunion: ["old union"],
  bookstore: ["bookstore", "book store"]
}

/** Lowercase, punctuation to spaces, single-spaced, padded so " word " tests whole words. */
export function normalizeForMatch(s: string): string {
  return " " + (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " "
}

/** Every phrase that names `card`: its name (minus a leading "the"), label, id and aliases, normalized. */
export function phrasesFor(card: Card): string[] {
  const raw = [card.name, card.name.replace(/^the\s+/i, ""), card.label, card.id, ...(BUILDING_ALIASES[card.id] || [])]
  // A name with a trailing qualifier ("Green Library, Bing Wing", "Y2E2, the ...") also matches its first part.
  for (const r of [card.name]) if (r.indexOf(",") > 0) raw.push(r.slice(0, r.indexOf(",")))
  const out: string[] = []
  for (const r of raw) {
    const n = normalizeForMatch(r).trim()
    if (n.length >= 3 && out.indexOf(n) < 0) out.push(n)
  }
  return out
}

/**
 * The building a question names ("" if none): the first one mentioned, where a phrase nested inside a longer
 * matching phrase doesn't count on its own.
 */
export function buildingMentioned(question: string, cards: Card[]): string {
  const q = normalizeForMatch(question)
  const hits: {id: string; at: number; end: number}[] = []
  for (const c of cards) {
    for (const p of phrasesFor(c)) {
      let from = 0
      for (;;) {
        const at = q.indexOf(" " + p + " ", from)
        if (at < 0) break
        hits.push({id: c.id, at, end: at + p.length + 1})
        from = at + 1
      }
    }
  }
  // A phrase inside a longer one ("hewlett" in "hewlett packard garage") is part of that name, not its own.
  const own = hits.filter((h) => !hits.some((o) => o !== h && o.end - o.at > h.end - h.at && o.at <= h.at && o.end >= h.end))
  own.sort((a, b) => a.at - b.at || b.end - b.at - (a.end - a.at))
  return own.length ? own[0].id : ""
}

/** Chat window heading: who is being asked about. */
export function chatHeading(label: string): string {
  return label ? `Ask · ${label}` : "Ask · Stanford"
}

// ---------------------------------------------------------------------------
// Suggested questions: tap-to-ask chips under the chat's mic. Each is answered from the building's checked card
// fact, offline and instantly, so the demo never depends on the venue's Wi-Fi or a noisy room's speech recognition.

export interface SuggestedQuestion {
  /** Chip text, phrased as the visitor would ask it. */
  label: string
  /** The checked fact that answers it. */
  factId: string
}

/** One question per fact theme, in the order the chips list them. */
const THEME_QUESTIONS: {theme: Fact["theme"]; label: string}[] = [
  {theme: "namesake", label: "Who's it named after?"},
  {theme: "founder", label: "What's the founder story?"},
  {theme: "inside", label: "What's inside?"},
  {theme: "fun", label: "Tell me something surprising"},
  {theme: "architecture", label: "How was it designed?"}
]

/**
 * Up to `max` chips for `card`: one per theme it has a fact for, in THEME_QUESTIONS order, preferring a fact the
 * visitor hasn't heard yet. Questions in `asked` (labels) are left out, so follow-up chips are always new ones.
 */
export function suggestedQuestions(card: Card | null | undefined, heard: string[] = [], asked: string[] = [], max = 3): SuggestedQuestion[] {
  if (!card) return []
  const out: SuggestedQuestion[] = []
  for (const q of THEME_QUESTIONS) {
    if (out.length >= max) break
    if (asked.indexOf(q.label) >= 0) continue
    const facts = card.facts.filter((f) => f.theme === q.theme)
    if (!facts.length) continue
    const fresh = facts.find((f) => heard.indexOf(f.id) < 0)
    out.push({label: q.label, factId: (fresh || facts[0]).id})
  }
  return out
}

/**
 * True for spoken tour commands ("next spot", "what's that", "go back", "recalibrate", "I like art", ...) that the
 * Ask mic hands to the tour instead of looking up on the web. Mirrors the command list in the controller's
 * handleUtterance.
 */
export function isTourCommand(raw: string): boolean {
  const t = (raw || "").toLowerCase().replace(/[?!]+$/, "").trim()
  return (
    /\b(tutorial|how does this work|show me how)\b|^(show me the |start the )?demo\.?$/.test(t) ||
    /\b(recalibrate|calibrate)\b/.test(t) ||
    // Whole utterance only: "what is this building made of?" is a question, not "identify what I'm looking at".
    /^(what('?s| is) (that|this)( building| place)?|what am i looking at)\.?$/.test(t) ||
    /\b(explode|take it apart|show me again)\b/.test(t) ||
    /^(close|hide|clear)( it| that| the model| everything)?\.?$/.test(t) ||
    /^(go |take me )?back( out)?\.?$|^(close|exit)( focus| the (card|panel)| this)?\.?$/.test(t) ||
    /\breset (the )?tour\b/.test(t) ||
    isNextSpotIntent(t) ||
    // Profile lines ("I like art"), but not questions that start with "I want to know ...".
    /^(i like|i love|i study|i'?m (a|an|into|studying)|i am (a|an|into|studying)|my (major|favou?rite))\b/.test(t)
  )
}

/**
 * The building a "just show me where it is" request names ("show me where Hoover Tower is", "where's Green
 * Library?", "find the HP garage"), or "" when the question asks anything more ("where is Hoover and when was it
 * built?", "why is Hoover where it is?"). The Ask chat selects that building on the map and closes instead of answering.
 */
export function locateOnlyTarget(question: string, cards: Card[]): string {
  const id = buildingMentioned(question, cards)
  if (!id) return ""
  const card = cards.find((c) => c.id === id)
  if (!card) return ""
  // Replace the building's name with X (longest phrase first), then the rest must be a pure "where / show me".
  let q = normalizeForMatch(question)
  const phrases = phrasesFor(card).sort((a, b) => b.length - a.length)
  for (const p of phrases) q = q.split(" " + p + " ").join(" X ")
  q = q.replace(/\s+/g, " ").trim()
  const lead = "(?:(?:hey|ok|okay|um|uh|so) )*(?:(?:can|could|would) you |please |i want to see |i d like to see )*"
  const tail = "(?: (?:is|are|located|at|on the map|please|again|for me))*"
  const the = "(?:the )?"
  const patterns = [
    `^${lead}(?:show me|show|point (?:me )?(?:to|at|out)|find|highlight|select|take me to|go to|open)(?: where)? ${the}X${tail}$`,
    `^${lead}(?:where is|where s|wheres|where are|which (?:one|building) is|where can i find|where do i find) ${the}X${tail}$`
  ]
  return patterns.some((p) => new RegExp(p).test(q)) ? id : ""
}

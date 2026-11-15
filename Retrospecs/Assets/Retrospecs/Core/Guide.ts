/**
 * Guide logic: what to say, what to light up, and what to quiz next. Pure, unit-tested.
 *
 * The model receives the sourced cards, the wearer's profile and what they have already heard, and returns ONE
 * structured answer: which facts to speak (by id), which buildings to light, which pairs to connect, and a short
 * connective sentence. validateGuide() drops anything not in the cards, so a hallucinated building or fact never
 * reaches the map or the voice.
 */
import {CARDS, Card, Fact, Theme, cardById, factById} from "./Cards"
import {EN, angleDiff, bearingDeg, compassWord, distanceM, formatDistance} from "./Geo"

export interface GuideAnswer {
  focus: string
  lights: string[]
  threads: {from: string; to: string}[]
  fact_ids: string[]
  connective: string
}

export interface ValidatedAnswer extends GuideAnswer {
  /** Everything the validator removed, for the debug overlay. */
  rejected: string[]
  /** Speech: connective + the chosen facts' exact sourced text. */
  speech: string
  /** True when the model said the cards don't cover the question. */
  declined: boolean
}

/** Gemini response_schema (OpenAPI subset). */
export const GUIDE_SCHEMA = {
  type: "object",
  properties: {
    focus: {type: "string", description: "Card id the answer is mainly about, or empty."},
    lights: {type: "array", items: {type: "string"}, description: "Card ids to light up on the map (max 6)."},
    threads: {
      type: "array",
      items: {type: "object", properties: {from: {type: "string"}, to: {type: "string"}}, required: ["from", "to"]},
      description: "Pairs of card ids to connect with a glowing thread (max 4)."
    },
    fact_ids: {type: "array", items: {type: "string"}, description: "Fact ids to read aloud, in order (max 3)."},
    connective: {type: "string", description: "One short spoken sentence (max 20 words) that ties the facts to the question. No new facts, numbers or names."}
  },
  required: ["focus", "lights", "threads", "fact_ids", "connective"]
}

export const GUIDE_SYSTEM_PROMPT = `You are a friendly Stanford campus tour guide speaking through AR glasses.
You may ONLY use the facts in the provided cards. Never add facts, numbers, names or dates of your own.
Answer by choosing:
- fact_ids: 1 to 3 fact ids whose text answers the question (they are read aloud verbatim, in your order);
- lights: card ids to light up on the 3D map (the buildings that answer the question);
- threads: pairs of card ids to connect when the answer links buildings (for example same founder or company);
- connective: ONE short sentence, max 20 words, that introduces or links the facts. It must not contain any fact.
Prefer facts the visitor has NOT heard yet and themes that match their interests.
If the cards do not cover the question, return empty fact_ids and a connective like "My notes don't cover that, but ask me about who a building is named for."
Use only ids that appear in the cards.`

export function cardsForPrompt(cards: Card[] = CARDS): string {
  return cards
    .map((c) => `[${c.id}] ${c.name}${c.namesake ? ` (named for ${c.namesake})` : ""}; tags: ${c.tags.join(", ")}\n` + c.facts.map((f) => `  ${f.id} (${f.theme}): ${f.text}`).join("\n"))
    .join("\n")
}

export function buildGuidePrompt(question: string, focusId: string, profile: string, heard: string[]): string {
  const focus = focusId ? cardById(focusId) : undefined
  return [
    `CARDS:\n${cardsForPrompt()}`,
    `VISITOR PROFILE: ${profile || "not given"}`,
    `ALREADY HEARD: ${heard.length ? heard.join(", ") : "nothing yet"}`,
    focus ? `THE VISITOR IS LOOKING AT: [${focus.id}] ${focus.name}` : "THE VISITOR IS NOT LOOKING AT A SPECIFIC BUILDING.",
    `QUESTION: ${question}`
  ].join("\n\n")
}

const MAX_LIGHTS = 6
const MAX_THREADS = 4
const MAX_FACTS = 3

export function validateGuide(raw: any, heard: string[] = []): ValidatedAnswer {
  const rejected: string[] = []
  const obj = raw && typeof raw === "object" ? raw : {}
  const isCard = (id: any) => typeof id === "string" && !!cardById(id)

  let focus = typeof obj.focus === "string" ? obj.focus : ""
  if (focus && !isCard(focus)) {
    rejected.push(`focus:${focus}`)
    focus = ""
  }

  const lights: string[] = []
  for (const id of Array.isArray(obj.lights) ? obj.lights : []) {
    if (!isCard(id)) rejected.push(`light:${id}`)
    else if (lights.indexOf(id) < 0 && lights.length < MAX_LIGHTS) lights.push(id)
  }

  const threads: {from: string; to: string}[] = []
  for (const t of Array.isArray(obj.threads) ? obj.threads : []) {
    if (!t || !isCard(t.from) || !isCard(t.to) || t.from === t.to) {
      rejected.push(`thread:${t && t.from}->${t && t.to}`)
      continue
    }
    if (threads.length < MAX_THREADS) threads.push({from: t.from, to: t.to})
  }

  const fact_ids: string[] = []
  for (const id of Array.isArray(obj.fact_ids) ? obj.fact_ids : []) {
    if (typeof id !== "string" || !factById(id)) rejected.push(`fact:${id}`)
    else if (fact_ids.indexOf(id) < 0 && fact_ids.length < MAX_FACTS) fact_ids.push(id)
  }

  // Every fact's building should be visible on the map; light it if the model forgot.
  for (const id of fact_ids) {
    const c = factById(id)!.card.id
    if (lights.indexOf(c) < 0 && lights.length < MAX_LIGHTS) lights.push(c)
  }
  if (!focus && fact_ids.length) focus = factById(fact_ids[0])!.card.id

  let connective = typeof obj.connective === "string" ? obj.connective.trim() : ""
  if (connective.split(/\s+/).length > 30) {
    rejected.push("connective:too long")
    connective = ""
  }
  if (/\d/.test(connective)) {
    // A number in the connective means the model is stating a fact of its own; drop it.
    rejected.push("connective:contains a number")
    connective = ""
  }

  const declined = fact_ids.length === 0
  const facts = fact_ids.map((id) => factById(id)!.fact.text)
  const speech = (declined ? connective || "My notes don't cover that one. Try asking who a building is named after." : [connective, ...facts].filter(Boolean).join(" "))
  void heard
  return {focus, lights, threads, fact_ids, connective, rejected, speech, declined}
}

// ---------------------------------------------------------------------------
// Profile -> preferred themes

const THEME_WORDS: [Theme, RegExp][] = [
  ["founder", /\b(start ?ups?|founders?|companies|company|entrepreneur\w*|business|tech|silicon|invest\w*|vc)\b/i],
  ["architecture", /\b(architect\w*|design\w*|buildings?|art|sustainab\w*|green|energy)\b/i],
  ["inside", /\b(research|science|labs?|engineer\w*|cs|computer|physics|bio\w*|classes|study|major)\b/i],
  ["namesake", /\b(history|people|names?|named|donors?|famous)\b/i],
  ["fun", /\b(fun|weird|cool|trivia|surpris\w*)\b/i]
]

export function themesFromProfile(profile: string): Theme[] {
  const out: Theme[] = []
  for (const [theme, re] of THEME_WORDS) if (re.test(profile || "")) out.push(theme)
  return out
}

/** Next unheard fact for a building, preferring the visitor's themes; null when everything's been heard. */
export function nextFact(cardId: string, heard: string[], themes: Theme[]): Fact | null {
  const card = cardById(cardId)
  if (!card) return null
  const fresh = card.facts.filter((f) => heard.indexOf(f.id) < 0)
  if (!fresh.length) return null
  const ranked = fresh.slice().sort((a, b) => rank(a.theme, themes) - rank(b.theme, themes))
  return ranked[0]
}

function rank(t: Theme, themes: Theme[]): number {
  const i = themes.indexOf(t)
  return i < 0 ? 10 + ["namesake", "founder", "inside", "fun", "architecture"].indexOf(t) : i
}

/** "Your Stanford": cards whose facts best match the profile themes (on-map only). */
export function yourStanford(profile: string, max = 4): string[] {
  const themes = themesFromProfile(profile)
  const words = (profile || "").toLowerCase()
  const scored = CARDS.filter((c) => !c.offMap).map((c) => {
    let s = 0
    for (const f of c.facts) if (themes.indexOf(f.theme) >= 0) s += 1
    for (const t of c.tags) if (words.indexOf(t.split(" ")[0]) >= 0) s += 2
    return {id: c.id, s}
  })
  scored.sort((a, b) => b.s - a.s)
  return scored.filter((x) => x.s > 0).slice(0, max).map((x) => x.id)
}

/** Buildings named for tech founders: the local answer for the constellation demo if the network is down. */
export function founderConstellation(): {lights: string[]; threads: {from: string; to: string}[]} {
  const lights = CARDS.filter((c) => c.tags.indexOf("tech founder") >= 0 && !c.offMap).map((c) => c.id)
  return {lights, threads: [{from: "packard", to: "hpgarage"}, {from: "hewlett", to: "hpgarage"}]}
}

// ---------------------------------------------------------------------------
// Point to guess

export interface GuessResult {
  targetId: string
  trueBearing: number
  pointedBearing: number
  errorDeg: number
  verdict: string
}

/** Picks the next quiz target: an un-guessed card at least `minDistM` away (direction is meaningless up close). */
export function nextGuessTarget(me: EN, positions: Record<string, EN>, guessed: string[], exclude: string, minDistM = 60): string | null {
  const ids = Object.keys(positions).filter((id) => id !== exclude && guessed.indexOf(id) < 0 && distanceM(me, positions[id]) >= minDistM)
  if (!ids.length) return null
  // Nearest first: easier and keeps the tour local; the off-map garage comes last.
  ids.sort((a, b) => distanceM(me, positions[a]) - distanceM(me, positions[b]))
  return ids[0]
}

export function scoreGuess(targetId: string, me: EN, target: EN, pointedBearing: number): GuessResult {
  const trueBearing = bearingDeg(me, target)
  const errorDeg = Math.abs(angleDiff(pointedBearing, trueBearing))
  const card = cardById(targetId)
  const name = card ? card.label : targetId
  const dist = formatDistance(distanceM(me, target))
  let verdict: string
  if (errorDeg <= 10) verdict = `Spot on! ${name} is ${dist} ${compassWord(trueBearing)}. Off by just ${Math.round(errorDeg)} degrees.`
  else if (errorDeg <= 30) verdict = `Close. ${name} is ${dist} ${compassWord(trueBearing)}. You were off by ${Math.round(errorDeg)} degrees.`
  else verdict = `Not quite. ${name} is ${dist} to the ${compassWord(trueBearing)}. Off by ${Math.round(errorDeg)} degrees.`
  return {targetId, trueBearing, pointedBearing, errorDeg, verdict}
}

export function guessPrompt(targetId: string): string {
  const c = cardById(targetId)
  return `Point to where you think ${c ? c.name : targetId} is, then pinch.`
}

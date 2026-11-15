/**
 * "Ask further": live, web-grounded answers about the building in focus. Pure, unit-tested.
 *
 * The narrated tour (baked ElevenLabs clips) and the card guide (Core/Guide.ts) only ever speak sourced, checked
 * facts. This path is deliberately different: when a visitor wants to go beyond those notes, one Gemini call with
 * Google Search grounding answers from the live web. To keep that honest:
 *  - the prompt lists what the visitor has already been told, so the answer adds to it instead of repeating it;
 *  - the answer is labelled as coming from the web (with source domains) only when grounding metadata came back,
 *    and as "general knowledge" otherwise, so it never passes as one of the checked facts;
 *  - nothing here lights buildings or marks facts heard: there is no validator, so it only speaks.
 */
import {Card} from "./Cards"

export interface LiveSource {
  /** Usually the site's domain (Gemini puts the domain in `title`; the uri is a Google redirect). */
  title: string
  uri: string
}

export interface LiveAnswer {
  /** Text to speak: plain sentences, no markdown, citation marks or URLs. */
  speech: string
  /** Distinct web sources, in the order the model cited them. */
  sources: LiveSource[]
  /** True when the response carried grounding metadata (a real web search ran). */
  grounded: boolean
  /** Search queries the model ran, for the logger. */
  queries: string[]
}

export interface LiveTurn {
  q: string
  a: string
}

/** Spoken before a live answer so it is never confused with the checked narration. */
export const LIVE_PREFIX_WEB = "From what I found online:"
export const LIVE_PREFIX_GENERAL = "This isn't in my checked notes, but generally:"
/** Filler while the search runs. Warmed at startup so it plays instantly. */
export const LOOKING_UP_LINE = "Let me look that up."

export const LIVE_SYSTEM_PROMPT = `You are a friendly Stanford campus tour guide speaking through AR glasses.
The visitor is standing near a specific Stanford building and wants to know more than the tour notes cover.
Use Google Search to answer from current, reliable sources (Stanford sites first, then reputable news and references).
Rules:
- Answer in 2 or 3 short spoken sentences, at most 50 words. Lead with the single most interesting point. Plain text only: no lists, markdown, URLs or citation marks.
- Add something NEW. Do not repeat what the visitor was already told unless the question asks for it.
- Be specific (names, years, numbers) only when your sources support it. If sources disagree or you are unsure, say so briefly.
- For anything that changes (hours, events, exhibits, construction, who works there now), say "as of today" (never "as of my last update" or "my knowledge cutoff").
- If you can't find a good answer, say so in one sentence and suggest one related thing the visitor could ask.
- Stay on the building, its people, history, architecture and what happens inside. Politely decline unrelated or unsafe requests.`

/** Visitor phrases that mean "go beyond the notes and look it up". "tell me more" is NOT one: it advances narration. */
export function isAskFurtherIntent(text: string): boolean {
  const t = (text || "").toLowerCase()
  return /\b(look (it|that|this) up|look up|search( the web| online| for)?|google( it| that)?|ask (more|further)|ask something else|go deeper|dig deeper|what else (is|can|do|should)|anything else (about|to know)|more about (it|this|that|this building|that building)|online)\b/.test(t)
}

/** Strips a leading "look it up"-style command so the model sees the real question (or an empty one). */
export function stripAskFurtherCommand(text: string): string {
  return (text || "")
    .replace(/^\s*(hey,?\s*)?(please\s+)?(can you\s+|could you\s+)?(look (it|that|this) up|look up|search( the web| online)?( for)?|google( it| that)?|ask (more|further)|dig deeper|go deeper)[\s,:.!?-]*/i, "")
    .trim()
}

/**
 * Prompt for the grounded call. `told` is everything the visitor has already heard about this building
 * (narration segments and card facts); `recent` is the last few live Q/A turns for follow-ups like "when was that?".
 */
export function buildLivePrompt(question: string, card: Card | undefined, told: string[], recent: LiveTurn[] = [], profile = ""): string {
  const q = (question || "").trim() || (card ? `Tell me something interesting about ${card.name} that isn't in the tour.` : "Tell me something interesting about Stanford.")
  const lines: string[] = []
  if (card) {
    lines.push(`BUILDING: ${card.name}, Stanford University, Stanford, California${card.namesake ? ` (named for ${card.namesake})` : ""}.`)
    if (card.offMap) lines.push(`(It is off the main campus, at latitude ${card.offMap.lat.toFixed(5)}, longitude ${card.offMap.lon.toFixed(5)}.)`)
  } else {
    lines.push("BUILDING: none in focus; the visitor is on the Stanford University campus.")
  }
  const toldClean = dedupe(told.map((s) => (s || "").trim()).filter(Boolean)).slice(0, 12)
  if (toldClean.length) lines.push("ALREADY TOLD THE VISITOR:\n" + toldClean.map((s) => "- " + clip(s, 400)).join("\n"))
  if (profile) lines.push(`VISITOR INTERESTS: ${clip(profile, 200)}`)
  const recentClean = recent.slice(-3)
  if (recentClean.length) lines.push("EARLIER IN THIS CONVERSATION:\n" + recentClean.map((r) => `Visitor: ${clip(r.q, 200)}\nGuide: ${clip(r.a, 400)}`).join("\n"))
  lines.push(`QUESTION: ${q}`)
  return lines.join("\n\n")
}

/** Parses a Gemini generateContent response (grounded or not). Returns null when there is no usable text. */
export function parseLiveReply(response: any): LiveAnswer | null {
  const cand = response && response.candidates && response.candidates[0]
  if (!cand) return null
  const parts: any[] = (cand.content && cand.content.parts) || []
  const raw = parts
    .map((p) => (p && typeof p.text === "string" && !p.thought ? p.text : ""))
    .join(" ")
    .trim()
  const speech = cleanForSpeech(raw)
  if (!speech) return null
  const gm = cand.groundingMetadata || cand.grounding_metadata || null
  const chunks: any[] = (gm && (gm.groundingChunks || gm.grounding_chunks)) || []
  const sources: LiveSource[] = []
  const seen: Record<string, boolean> = {}
  for (const c of chunks) {
    const w = c && c.web
    if (!w) continue
    const title = String(w.domain || w.title || domainOf(w.uri) || "").trim()
    const key = title.toLowerCase()
    if (!title || seen[key]) continue
    seen[key] = true
    sources.push({title, uri: String(w.uri || "")})
  }
  const queries: string[] = ((gm && (gm.webSearchQueries || gm.web_search_queries)) || []).map(String)
  const grounded = !!gm && (sources.length > 0 || queries.length > 0)
  return {speech, sources, grounded, queries}
}

/**
 * Parses an OpenAI chat completion from a web-search model (gpt-4o-mini-search-preview): text in
 * choices[0].message.content, sources in message.annotations[].url_citation. The fallback when Gemini grounding
 * is unavailable.
 */
export function parseOpenAILiveReply(response: any): LiveAnswer | null {
  const msg = response && response.choices && response.choices[0] && response.choices[0].message
  if (!msg || typeof msg.content !== "string") return null
  // Search models append "([site](url))" citations inline; drop them before cleaning.
  const speech = cleanForSpeech(msg.content.replace(/\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, ""))
  if (!speech) return null
  const sources: LiveSource[] = []
  const seen: Record<string, boolean> = {}
  for (const a of msg.annotations || []) {
    const c = a && a.url_citation
    if (!c || !c.url) continue
    const title = domainOf(c.url) || String(c.title || "")
    if (!title || seen[title]) continue
    seen[title] = true
    sources.push({title, uri: String(c.url)})
  }
  return {speech, sources, grounded: sources.length > 0, queries: []}
}

/** Plain spoken text: no markdown, bullets, citation marks or URLs, capped at `maxSentences` / `maxWords`. */
export function cleanForSpeech(text: string, maxSentences = 3, maxWords = 60): string {
  let t = (text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[(\d+(\s*,\s*\d+)*)\]/g, "") // [1], [2, 3]
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1") // markdown links
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim()
  if (!t) return ""
  const sentences = t.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [t]
  const out: string[] = []
  let words = 0
  for (const s of sentences) {
    const st = s.trim()
    if (!st) continue
    const n = st.split(/\s+/).length
    if (out.length && (out.length >= maxSentences || words + n > maxWords)) break
    out.push(st)
    words += n
  }
  t = out.join(" ")
  // A single runaway sentence: cut at the word cap.
  const w = t.split(/\s+/)
  if (w.length > maxWords + 10) t = w.slice(0, maxWords).join(" ").replace(/[,;:]$/, "") + "…"
  return t
}

/** What to say and caption for a live answer, labelled by whether a web search actually backed it. */
export function presentLive(a: LiveAnswer, buildingLabel: string): {parts: string[]; caption: string} {
  const domains = a.sources.slice(0, 3).map((s) => s.title)
  if (a.grounded) {
    return {
      parts: [LIVE_PREFIX_WEB, a.speech],
      caption: `${buildingLabel ? buildingLabel + " · " : ""}From the web${domains.length ? ": " + domains.join(", ") : ""}`
    }
  }
  return {parts: [LIVE_PREFIX_GENERAL, a.speech], caption: `${buildingLabel ? buildingLabel + " · " : ""}Not from a web search (general knowledge)`}
}

function domainOf(uri: string): string {
  const m = /^https?:\/\/([^/]+)/i.exec(uri || "")
  return m ? m[1].replace(/^www\./, "") : ""
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

function dedupe(xs: string[]): string[] {
  const seen: Record<string, boolean> = {}
  return xs.filter((x) => (seen[x] ? false : (seen[x] = true)))
}

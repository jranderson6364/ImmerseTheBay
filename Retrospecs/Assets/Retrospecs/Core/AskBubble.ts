/**
 * The "ask" bubble: which building a free-form question is about. Pure, unit-tested.
 *
 * A question asked through the bubble ("when was Hoover Tower built?") selects that building as if it had been
 * pinched, so the map highlight, card, 3D pieces and holograms come up with the answer. Matching is on whole words,
 * longest phrase first, so "Hewlett-Packard garage" is the HP Garage (not Hewlett or Packard), "Green Library" is
 * not "Green Earth Sciences", and "tell me more" never means Moore.
 */
import {Card} from "./Cards"

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

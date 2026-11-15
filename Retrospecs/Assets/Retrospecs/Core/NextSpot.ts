/**
 * "Show me somewhere else": picks the next building to visit without the wearer having to aim at one, like
 * scrolling to the next post. Pure: callers pass positions and what has been shown.
 *
 * Order: the richest stops first (tier 0: centerpieces, tier 1: buildings with narration or art, tier 2: the rest),
 * and within a tier the nearest one to where the tour is now, so the map hops around a neighbourhood instead of
 * zig-zagging across campus. Once every building has been shown, the cycle starts again.
 */

export interface SpotPos {
  e: number
  n: number
}

export interface NextSpotInput {
  /** Building in focus now ("" = none): the distance is measured from it, else from `from`. */
  currentId: string
  /** Where the wearer stands (campus EN metres), used when nothing is in focus. */
  from: SpotPos
  /** Every selectable building and its position. */
  positions: Record<string, SpotPos>
  /** Buildings already shown this cycle (via "next" or a pinch). */
  shown: string[]
  /** Tier per id (0 = show first). Missing ids count as the last tier. */
  tierOf: (id: string) => number
}

/** The next building to show, or "" when there is nothing else. */
export function nextSpot(s: NextSpotInput): string {
  const ids = Object.keys(s.positions).filter((id) => id !== s.currentId)
  if (!ids.length) return ""
  let pool = ids.filter((id) => s.shown.indexOf(id) < 0)
  if (!pool.length) pool = ids // everything seen: go around again
  const here = (s.currentId && s.positions[s.currentId]) || s.from
  let best = ""
  let bestTier = Infinity
  let bestD = Infinity
  for (const id of pool) {
    const p = s.positions[id]
    const tier = s.tierOf(id)
    const t = tier >= 0 ? tier : 99
    const d = Math.hypot(p.e - here.e, p.n - here.n)
    if (t < bestTier || (t === bestTier && (d < bestD || (d === bestD && id < best)))) {
      best = id
      bestTier = t
      bestD = d
    }
  }
  return best
}

/**
 * Voice phrases that mean "show me somewhere else". Whole short utterances only, so a question like "what's next to
 * Hoover?" still goes to the guide, and "tell me more" stays the next narration segment.
 */
export function isNextSpotIntent(raw: string): boolean {
  const t = (raw || "").toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim()
  const lead = "(?:(?:ok(?:ay)?|alright|great|cool|nice|thanks|please) )?(?:(?:can you |could you )?(?:show|take) me |let'?s go |go )?"
  const core =
    "(?:next|next (?:spot|stop|one|place|building|please)|somewhere else|(?:to )?another (?:spot|place|building|stop)|" +
    "something else|skip(?: it| this| this one)?|keep going|move on)"
  return new RegExp(`^${lead}${core}(?: please)?$`).test(t)
}

/** Tier for the next-spot order: 0 centerpieces, 1 buildings with narration or art, 2 everything else. */
export function spotTier(isCenterpiece: boolean, hasNarrationOrArt: boolean): number {
  return isCenterpiece ? 0 : hasNarrationOrArt ? 1 : 2
}

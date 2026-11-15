/**
 * Colours of the illustrated story cards (tools/story_cards_featured.py THEMES), as 0..1 RGBA for the mesh UI that
 * sits with them: the Ask Me More button on cards without it baked in, and the Ask Me More window. Ids without a deck
 * card get the older decks' navy and copper (DECK_THEME). Pure, so it's unit-tested.
 *
 * Also the draw-order ladder for the mesh UI. Text doesn't write depth, so without an explicit order a button's fill
 * can be drawn after its label and paint over it (which one goes first can change as the head moves: "the text
 * sometimes disappears"). Every part gets `renderOrder = base + layer`, text always on the top layer.
 */

export interface CardTheme {
  /** Panel gradient, top and bottom (the window and button fills). */
  top: number[]
  bottom: number[]
  /** Kicker text, the mic badge, the active outline. */
  accent: number[]
  /** Thin outline round panels and buttons. */
  rim: number[]
  /** Primary button gradient (hovered fills use the top of it). */
  button: number[][]
  /** Corner style of the card's buttons. */
  frame: "round" | "chamfer" | "step"
}

const rgb = (r: number, g: number, b: number): number[] => [r / 255, g / 255, b / 255, 1]

/** Copper deck cards with a painted picture and the Ask tab baked in (tools/story_cards_deck.py): chamfered buttons. */
const COPPER_DECK: CardTheme = {
  top: rgb(16, 26, 37), bottom: rgb(8, 13, 20), accent: rgb(245, 169, 103), rim: rgb(245, 169, 103),
  button: [rgb(236, 134, 76), rgb(206, 104, 60)], frame: "chamfer"
}

/**
 * Story card textures with the Ask Me More tab baked in: every building's card is now drawn with the copper deck
 * template (render_story_decks.py DECK_HERO_IDS, the ids in tools/story-cards.json).
 */
export const BAKED_ASK_CARDS = [
  "mainquad", "huang", "hoover", "hpgarage", "memchu", "varian", "spilker", "moore",
  "gates", "packard", "y2e2", "shriram", "allen", "hewlett", "cantor", "mccullough",
  "durand", "sequoia", "greenearth", "mitchell", "gilbert", "clark", "likashing", "coda",
  "bassbio", "sapp", "oldunion", "tresidder", "greenlib", "lathrop", "bookstore", "littlefield"
]

export const CARD_THEMES: Record<string, CardTheme> = {}
for (const id of BAKED_ASK_CARDS) CARD_THEMES[id] = COPPER_DECK

/**
 * Fallback for ids without a deck card (the compact card): the older story decks' navy panel and copper
 * (tools/render_story_decks.py PANEL, COPPER), so the mesh Ask Me More button and the window match.
 */
export const DECK_THEME: CardTheme = {
  top: rgb(16, 26, 37), bottom: rgb(8, 13, 20), accent: rgb(245, 169, 103), rim: rgb(245, 169, 103),
  button: [rgb(206, 104, 60), rgb(150, 62, 36)], frame: "round"
}

export function themeFor(cardId: string): CardTheme {
  return CARD_THEMES[cardId] || DECK_THEME
}

export function hasBakedAsk(cardId: string): boolean {
  return BAKED_ASK_CARDS.indexOf(cardId) >= 0
}

/** `c` scaled toward white by `k` (0 = unchanged, 1 = white); alpha kept. */
export function lighten(c: number[], k: number): number[] {
  return [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k, c[3]]
}

/** Corner radius (fraction of the shorter side) for a theme's buttons: rounded, chamfered (cut) or square. */
export function cornerFor(theme: CardTheme): {radius: number; chamfer: boolean} {
  if (theme.frame === "round") return {radius: 0.28, chamfer: false}
  if (theme.frame === "chamfer") return {radius: 0.2, chamfer: true}
  return {radius: 0, chamfer: false}
}

// ---------------------------------------------------------------------------
// Draw order

/** Base render order of the focus card and the Ask Me More window (above the map's default 0). */
export const RENDER_BASE = {panel: 100, chat: 200}
/** Text is drawn after every mesh layer of its panel. */
export const TEXT_LAYER = 50

/**
 * Layer of a mesh part from its z offset (cm, card-local), so the order follows the intended stacking: the card fill
 * (z < 0) first, then frame, button fills, rims, glyphs, media, hover outlines. Always below TEXT_LAYER.
 */
export function meshLayer(z: number): number {
  return Math.max(-10, Math.min(TEXT_LAYER - 1, Math.round(z * 100)))
}

/**
 * Buildings whose focus view is exactly one 3D animation (left of the card) and one founder screen (right of it),
 * evenly spaced, with no diagram loop beside or inside the card. Add an id here once its deck uses the copper deck
 * template (tools/story_cards_deck.py) and it has a people hologram.
 */
export const SIMPLE_FOCUS_IDS = ["mainquad", "huang", "hoover"]

export function isSimpleFocus(cardId: string): boolean {
  return SIMPLE_FOCUS_IDS.indexOf(cardId) >= 0
}

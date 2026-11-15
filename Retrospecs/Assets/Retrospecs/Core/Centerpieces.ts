/**
 * The tour's centerpieces: the few buildings with the fullest content (art, experience, narration). On the map they
 * read brighter, carry bigger gold labels and are easier to select; the other landmarks stay selectable but quieter.
 */

export const CENTERPIECES: string[] = ["hoover", "huang", "hpgarage", "memchu"]

export function isCenterpiece(id: string): boolean {
  return CENTERPIECES.indexOf(id) >= 0
}

/**
 * Extra pick radius (real metres) around a landmark, on the map and out in the world. Hoover's footprint is tiny
 * next to the Main Quad, Memorial Church is a point landmark, and the HP Garage is a pin on the map edge.
 * Every pad stays clear of other landmarks' centres (tests/centerpieces.test.ts).
 */
export const PICK_PAD_M: Record<string, number> = {hoover: 35, memchu: 30, hpgarage: 15}

/** Map label size relative to Label Scale. */
export function labelScaleFor(id: string): number {
  return isCenterpiece(id) ? 1.3 : 0.85
}

/** Map label colour at rest (not hovered, not focused). */
export function labelColorFor(id: string): number[] {
  return isCenterpiece(id) ? [1.0, 0.86, 0.55, 1] : [0.72, 0.7, 0.66, 1]
}

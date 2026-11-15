import {describe, expect, test} from "bun:test"
import {CARDS, factById} from "../Assets/Retrospecs/Core/Cards"
import {STORY_CARD_COUNTS, storyCardFactId} from "../Assets/Retrospecs/Scripts/StoryDeck"

describe("illustrated story decks", () => {
  test("every selectable building has a card backed by one of its sourced facts", () => {
    for (const card of CARDS) {
      const count = STORY_CARD_COUNTS[card.id]
      expect(count).toBeGreaterThanOrEqual(1)
      // Full hand-written decks: the centerpieces and the start-point corner buildings around Huang.
      if (!["hoover", "huang", "hpgarage", "memchu", "varian", "spilker", "moore"].includes(card.id)) expect(count).toBeLessThanOrEqual(2)
      for (let i = 0; i < count; i++) {
        const factId = storyCardFactId(card.id, i)
        if (factId) expect(factById(factId)?.card.id).toBe(card.id)
      }
      expect(storyCardFactId(card.id, count)).toBe(storyCardFactId(card.id, 0))
    }
  })
})

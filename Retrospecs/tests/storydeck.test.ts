import {describe, expect, test} from "bun:test"
import {CARDS, factById} from "../Assets/Retrospecs/Core/Cards"
import {STORY_CARD_COUNTS, storyCardFactId} from "../Assets/Retrospecs/Scripts/StoryDeck"

describe("illustrated story decks", () => {
  test("every selectable building has a card backed by one of its sourced facts", () => {
    for (const card of CARDS) {
      const count = STORY_CARD_COUNTS[card.id]
      expect(count).toBeGreaterThanOrEqual(1)
      // Four-card decks for the three centerpieces; every other building has exactly one card.
      if (["mainquad", "hoover", "huang"].includes(card.id)) expect(count).toBe(4)
      else expect(count).toBe(1)
      for (let i = 0; i < count; i++) {
        const factId = storyCardFactId(card.id, i)
        if (factId) expect(factById(factId)?.card.id).toBe(card.id)
      }
      expect(storyCardFactId(card.id, count)).toBe(storyCardFactId(card.id, 0))
    }
  })
  test("one-card stops keep the fact that carries their 3D model", () => {
    expect(storyCardFactId("gates", 0)).toBe("gates.2")
    expect(storyCardFactId("spilker", 0)).toBe("spilker.1")
    expect(storyCardFactId("packard", 0)).toBe("packard.1")
    expect(storyCardFactId("hpgarage", 0)).toBe("hpgarage.1")
  })
})

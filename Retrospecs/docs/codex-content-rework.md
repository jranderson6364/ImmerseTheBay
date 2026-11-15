# Codex prompt: Retrospecs content rework (cards, art, holograms)

Paste everything below the line into Codex.

---

You are reworking the **content** of Retrospecs, a Snap Spectacles (2024) Lens built in Lens Studio 5.15.4 at `Retrospecs/` in this repo. It's a Stanford tour guide. A 3D campus map floats in front of you. You aim your hand's ray at a building and pinch, and an illustrated card opens with baked narration.

We demo to judges in **two minutes** soon. After a test run, the feedback was that each place is **too cluttered** and **a lot of the content is not good**: weak cards, weak images, filler facts. Your job is to make each place feel like one clear, beautiful, true story.

## The new format for every place

Each selectable place shows exactly these four things, and nothing else:

1. **Cards.** A short deck of illustrated story cards with matching narration, one baked voice clip per card. Each card makes one strong point: a surprising, specific, sourced fact told in one or two spoken sentences, about 12–20 seconds aloud. No lists of departments and no square footage unless it is genuinely surprising. Write for a first-time visitor wearing glasses, not for a brochure.
2. **One animation.** A small animated 3D "experience" (`Core/Experiences.ts`) that teaches the one big idea of the place.
3. **One person hologram.** The founder, namesake, builder or key person behind the place, as a looping illustrated 16:9 screen (`Art/<id>/<id>_people_hologram.mp4`, wired in `Scripts/PeopleHolograms.ts`).
4. **One diagram.** A schematic loop of a documented object or mechanism (`Art/<id>/<id>_story_hologram.mp4`, wired in `Scripts/StoryHolograms.ts`). It explains something visually; it is not a portrait.

The code side is already done. Money piles and exploded product models are now off by default (`showMoneyPiles` and `showExplodedModels` on the controller). Don't build content for them, and don't delete them.

## Priority order (the demo path first)

The locked judge demo (`Core/DemoScript.ts`, owned by Claude, **do not edit**) goes:

1. **Main Quad**: plays narration segments `[0, 1]`.
2. **Huang Engineering Center**: plays segments `[0, 2]`.
3. The judge asks one voice question, for example "Who is this building named after?"

So, in order:

- **P0, Main Quad.** Today it has 4 narration segments but **only 1 story card** (`STORY_CARD_COUNTS.mainquad = 1`), so every pinch shows the same image. It also has **no animation, no person hologram and no diagram**. Build all four pieces. Its first two segments must be the two best Main Quad stories, because those are what the judges hear. Ideas to verify, not assume: Leland and Jane Stanford founding it for Leland Jr.; Olmsted's plan and the fights over it; the 1906 earthquake destroying the Memorial Arch. A natural person hologram is Jane and Leland Stanford. Possible animations are the Quad's arcades assembling around the inner court, or the 1906 quake taking down the arch.
- **P0, Huang.** Segments 0 and 2 are what the judges hear. Make them the strongest: the toy-block Google server, Jensen Huang. Check that card 0 and card 2 art match those segments exactly. The person hologram currently shows Page and Brin; decide whether the namesake (Jensen Huang) or the Google founders tell the stronger story for the cards you keep, and make the hologram match the cards.
- **P1, the other centerpieces**: Hoover Tower, HP Garage, Memorial Church. Same four-piece format; tighten and replace weak cards.
- **P2, everything else selectable.** Cut weak facts instead of padding. Two good cards beat four filler cards.

## Rules (non-negotiable)

- **Every fact needs a real source URL that you opened and read.** `Core/Cards.ts` is "the only facts the guide may speak". Unverified facts stay out. No invented numbers, dates or quotes.
- **Experiences labels:** every label with a digit or a proper name needs a `factId` into `Cards.ts`, and `tests/experiences.test.ts` checks that its digits and capitalised words appear in that fact. Labels without a `factId` stay generic with no digits. Read the DESIGN NOTE and SOURCING sections at the top of `Core/Experiences.ts` first, and respect `EXPERIENCE_VERTEX_BUDGET` and `EXPERIENCE_MESH_BUDGET`.
- **Story decks:** read `docs/story-decks.md`. `tools/story-cards.json` holds slide copy, order and a source per slide. `tools/render_story_decks.py` checks that slide counts match `tools/narration/narration.json` and that each slide's source appears in its voice segment. **Card count must equal narration segment count for every stop.**
- **People holograms:** read `Assets/Retrospecs/Art/PEOPLE_HOLOGRAMS.md`. They are AI-generated interpretive illustrations in the established style: lavender-and-cream engraved linework with gold highlights, on pure black (black is invisible on the additive display), no text or logos. Keep the documentation table up to date.
- **Additive display:** black renders as transparent. Use bright line art on black; avoid big filled light areas that wash out the view.
- **Spoken endings:** segments currently end with "Pinch again to hear more" or "look toward X". In the demo, the on-screen tip tells people what to do, so end each segment on the story itself, with no instructions.
- Don't touch `Scripts/RetrospecsController.ts`, `Scripts/RetrospecsInfoPanel.ts`, `Scripts/RetrospecsMap.ts`, `Core/DemoScript.ts` or `Core/Coach.ts`. If a content change truly needs a code change there, write it up instead of making it.
- If you change the segment indices that the demo uses (Main Quad `[0, 1]`, Huang `[0, 2]`), say so explicitly in your summary, because `DEMO_STOPS` must change to match.

## Pipeline (regenerate, never hand-edit generated files)

```powershell
# narration text and sources
#   edit Retrospecs/tools/narration/narration.json, then:
bun Retrospecs/tools/build-narration.ts          # -> Data/NarrationData.ts
bun Retrospecs/tools/bake-voice.ts --dry-run     # character count first (billing)
bun Retrospecs/tools/bake-voice.ts --only mainquad   # re-bake changed clips (--force for edited text)
# cards and diagrams
python Retrospecs/tools/render_story_decks.py    # -> Art/*/..._story_card_N.png + Scripts/StoryDeck.ts
python Retrospecs/tools/render_holograms.py      # diagram loops
python Retrospecs/tools/render_people_holograms.py   # people loops from the source PNGs
bun test Retrospecs/tests                         # must pass (currently 284 tests)
```

`bake-voice.ts` reads `ELEVENLABS_API_KEY` from `Retrospecs/tools/.env`. Never commit keys. After re-baking, list the clip names that changed: they must be re-dragged into `RetrospecsGuide > Narration Clips` in Lens Studio, which only a human can do. If new art files need to be wired by `requireAsset`, update the generated or wired TS files so the literal paths exist.

## Definition of done

- Main Quad and Huang each show four pieces: cards with art that changes on every card, one animation, one person hologram, one diagram. Every fact is sourced.
- Card count equals narration count for every stop. `bun test Retrospecs/tests` passes.
- A short report covering:
  - per place, what you cut, what you added, and each new fact's source URL
  - which clips need re-baking or re-dragging into Lens Studio
  - anything you couldn't verify and left out
  - a contact sheet PNG of the new Main Quad and Huang cards in `docs/card-style-options/`

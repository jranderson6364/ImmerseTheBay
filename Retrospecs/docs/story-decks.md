# Story decks

Main Quad, Huang, and Hoover each have four newly written cards, matched one for one with ElevenLabs narration. Their focus views pair the deck with an animated 3D experience and a person hologram: Olmsted, Jensen Huang, and Herbert Hoover respectively.

Every other building has exactly one card in the same copper deck style, written from its opening narration segment. Its picture is the building's real OpenStreetMap footprint, extruded and seen from above at dusk (`tools/heroes/footprint.py`, from `Data/CampusData.ts`). Heights are stretched ×2.4 so low buildings read as buildings, and neighbours in front are ghosted. The HP Garage is off the map, so it uses Nazeli's garage drawing (`tools/heroes/hpgarage.py`). Memorial Church has no footprint in the bake, so a copper pin marks it inside the Quad. The card's button reads **Hear More**: it plays the building's next narration segment while the card stays put. Mitchell has only one segment, so its button reads **Replay Card**. Each card keeps the fact that carries the building's 3D model (Gates `gates.2`, Spilker `spilker.1`, Packard `packard.1`, HP Garage `hpgarage.1`), and the opening diagram loops for Memorial Church, Varian, Spilker and Moore still play over the picture. Long names get a short card title (`SHORT_TITLES` in `render_story_decks.py`). The contact sheet is [`card-style-options/one-card-stops.png`](card-style-options/one-card-stops.png).

| Stop | Cards | Visual sequence |
| --- | ---: | --- |
| Main Quad | 4 | Sunlit arcade receding into the Quad; cyanotype plan with the centred axis and Olmsted's off-axis church on vellum; spectral Memorial Arch over its two surviving bases; cutaway of a plaque in the paving and the time capsule below |
| Hoover Tower | 4 | Floodlit tower with a 285 ft scale; polished bronze bell beside the 48-bell count (35 original, 13 later); the view through the 14th-floor arches with sound rings; wartime radio receiver, tubes and headphones |
| Huang Engineering Center | 4 | Lit gateway where circuit traces meet; isometric cutaway of the dean's office, Terman Library and 300-seat auditorium around a hub; PageRank servers in colourful toy blocks over a link graph; half-lit energy ring on the east–west axis |
| Every other building | 1 | The building's real footprint at dusk (HP Garage: Nazeli's drawing) |

Copy, segment order, and a source URL for every slide are in [`tools/story-cards.json`](../tools/story-cards.json). `tools/render_story_decks.py` checks that only the three centerpieces have more than one card, that a multi-card deck's count matches `tools/narration/narration.json`, and that each slide's source appears in the matching voice segment (segment 0 for one-card stops). It renders 1200 × 1280 translucent PNGs and generates `Assets/Retrospecs/Scripts/StoryDeck.ts`, whose literal asset paths let Lens Studio import them. The main **Next Card** region advances narration and image together. **Next Stop** changes buildings. The final card offers **Replay Cards**.

Main Quad, Huang and Hoover use the copper deck template, `tools/story_cards_deck.py`: a translucent midnight panel, a copper chamfered frame, Georgia type, white text, and baked Close, Next Card / Replay Cards, Ask Me More and Next Stop buttons that stay inside the `storyCardHits` / `storyAskButton` regions of `Core/CardLayout.ts`. Their pictures come from `tools/heroes/<id>.py`, which exposes `SCENES`; the contract is in `tools/heroes/__init__.py`. To give another building this look, write `heroes/<id>.py`, add the id to `DECK_HERO_IDS` in `render_story_decks.py` and to `BAKED_ASK_CARDS` / `CARD_THEMES` in `Core/CardTheme.ts`, and, if it has a people hologram, to `SIMPLE_FOCUS_IDS`. Those buildings show one 3D animation left of the card and one founder screen right of it, with equal gaps (`flankGapDeg`) and no diagram loop. Preview without touching Assets: `python Retrospecs/tools/story_cards_deck.py --preview <dir>`. The contact sheet is [`card-style-options/deck-story-cards.png`](card-style-options/deck-story-cards.png).

The opening card for Memorial Church (and Varian, Spilker and Moore) also uses 4-second silent H.264 schematic loops built by `tools/render_holograms.py`. The HP Garage retains Nazeli's original workbench animation. These diagrams show documented objects and actions; they are not literal historical reconstructions or portraits. The new opening loops are embedded over the picture area of their first card. The existing HP clip remains a separate workbench display.

Rebuild:

```powershell
python Retrospecs/tools/render_story_decks.py
python Retrospecs/tools/render_holograms.py
```

The contact sheet is [`docs/card-style-options/story-decks.png`](card-style-options/story-decks.png). The video frame sheet is [`docs/card-style-options/hologram-frames.png`](card-style-options/hologram-frames.png).

The ElevenLabs key in this workspace returns `missing_permissions` for `image_video_generation`; the loops above were created locally. To switch to generated video later, use an ElevenLabs key with that permission and review each scene against its slide source before replacing a file.

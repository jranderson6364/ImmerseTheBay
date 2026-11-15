# Centerpiece story decks

The four centerpiece stops have one visual card for each existing narration segment:

| Stop | Cards | Visual sequence |
| --- | ---: | --- |
| Hoover Tower | 4 | Tower and archive; Belgian bells; two elevators; wartime radio room |
| Huang Engineering Center | 5 | PageRank server; engineering center; ten drives; water and energy; HP workbench replica |
| HP Garage | 3 | Garage; HP 200A audio oscillator; move to Stanford Research Park |
| Memorial Church | 4 | Jane Stanford's umbrella; lost spire; Venetian mosaic; organ pipes |

Copy, segment order, and a primary source URL for every slide are in [`tools/story-cards.json`](../tools/story-cards.json). `tools/render_story_decks.py` checks that every deck has 3–5 slides, that its count matches `tools/narration/narration.json`, and that each slide's source appears in the matching voice segment. It renders 1200 × 1280 translucent PNGs and generates `Assets/Retrospecs/Scripts/StoryDeck.ts`, whose literal asset paths let Lens Studio import them. The main **Next Card** region advances narration and image together. **Next Stop** changes buildings. The final card offers **Replay Cards**.

The opening slides for Hoover, Huang, and Memorial Church also use 4-second silent H.264 schematic loops built by `tools/render_holograms.py`. The HP Garage retains Nazeli's original workbench animation. These diagrams show documented objects and actions; they are not literal historical reconstructions or portraits. The new opening loops are embedded over the picture area of their first card. The existing HP clip remains a separate workbench display.

Rebuild:

```powershell
python Retrospecs/tools/render_story_decks.py
python Retrospecs/tools/render_holograms.py
```

The contact sheet is [`docs/card-style-options/story-decks.png`](card-style-options/story-decks.png). The video frame sheet is [`docs/card-style-options/hologram-frames.png`](card-style-options/hologram-frames.png).

The ElevenLabs key in this workspace returns `missing_permissions` for `image_video_generation`; the loops above were created locally. To switch to generated video later, use an ElevenLabs key with that permission and review each scene against its slide source before replacing a file.

# Retrospecs tools

These run offline, on a laptop, to bake data and art into `Assets/Retrospecs/`. The Lens never runs them: it only loads their outputs. Every generated file says which script made it and is marked "do not edit by hand". Run the scripts from the repository root.

TypeScript tools use [bun](https://bun.sh) (`cd Retrospecs/tools && bun install` once). Python tools need Pillow and numpy, and the video ones also need `imageio-ffmpeg`.

## Data

| Script | Output | What it does |
| --- | --- | --- |
| `bake-campus.ts` | `Data/CampusData.ts` | Bakes OpenStreetMap buildings around Huang (footprints, heights, roofs) plus the landmark records. |
| `bake-paths.ts` (+ `path-classify.ts`) | `Data/PathsData.ts` | Bakes roads, bike paths and foot paths. `--refresh` re-downloads from Overpass. |
| `build-narration.ts` | `Data/NarrationData.ts`, `Data/NarrationClips.ts` | Converts `narration/narration.json` (the spoken tour, with a source for every segment) into TypeScript. |
| `bake-voice.ts` | `Audio/narration/*.mp3` | Renders each narration segment with ElevenLabs, so narration plays instantly and offline. Reads `ELEVENLABS_API_KEY` from `tools/.env` (git-ignored, never committed). |

## Cards and art

| Script | Output | What it does |
| --- | --- | --- |
| `render_story_decks.py` | `Art/<id>/<id>_story_card_<n>.png`, `Scripts/StoryDeck.ts` | The illustrated story cards for every selectable building. Uses `story_cards_deck.py` (the deck template), `story_cards_featured.py`, `story_visuals_corners.py` and `heroes/<id>.py` (pictures for each building). Text comes from `story-cards.json` and `Core/Cards.ts`. |
| `render_archive_gallery.py` | `Art/<id>/<id>_archive_*.jpg`, `Scripts/ArchivePhotos.ts` | The Archive Gallery: downloads the photos in `archive-photos.json` from Wikimedia Commons (public domain / CC), then bakes the collage and the framed, credited prints. |
| `render_holograms.py` | `Art/<id>/<id>_story_hologram.mp4` | Schematic diagram loops for the opening cards: documented objects, not portraits. |
| `render_people_holograms.py` | `Art/<id>/<id>_people_hologram.mp4` | Encodes the AI-illustrated people pictures as short loops (see `Art/PEOPLE_HOLOGRAMS.md`). |
| `export-art.ts` (+ `art/`) | `Art/<id>/<id>_3d.glb`, card mock-ups | Placeholder 3D elements and card mock-ups. |
| `build-sfx.py` | `Audio/sfx/*.wav` | Synthesises the click and whoosh (no samples or licences). |

## Previews (not used by the Lens)

`render_card_style_options.py`, `render_sample_story_cards.py` and `render_experience_previews.ts` write comparison sheets and stills into `Retrospecs/docs/`. They record design decisions and can be re-run at any time.

`cache/` holds downloads and is ignored by git.

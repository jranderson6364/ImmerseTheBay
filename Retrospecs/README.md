# Retrospecs Lens

A Stanford tour guide in your glasses. A 3D campus map unfolds on the floor around you, lined up with the real campus. Look at a building and pinch to hear who it's named for, the founder story behind it, and what's inside. Main Quad, Huang and Hoover Tower each play an illustrated story deck alongside the narration, and open an Archive Gallery of real historical photos. Ask anything the checked cards don't cover, and the guide searches the web live and tells you the answer came from the web. Concept: [docs/retrospecs-concept.md](../docs/retrospecs-concept.md).

Built on Snap's MIT-licensed [Depth Cache sample](https://github.com/specs-devs/samples/tree/5.15.4) (`5.15.4` branch). It reuses the sample's Remote Service Gateway setup, ASR, and WorldLabel prefab. Map data (buildings, roads, bike and foot paths) © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.

## For judges: the two-minute tour

1. **Put the Specs on and pinch.** The RETROSPECS title lifts away. Pinch again and a 3D map of Stanford unfolds in front of you. It's built from real OpenStreetMap footprints, roads and bike paths.
2. **Main Quad.** Point at the glowing building and pinch. An illustrated story card opens, with an animated 3D lesson on its left, and the guide narrates. Pinch the card for the next story.
3. **Archive Gallery.** Look right and pinch the photo collage. It explodes into real archival photos of the Quad from the 1890s to the 1906 earthquake, each credited. Pinch any photo to fold them back.
4. **Huang, then a question.** Same flow at the Huang Engineering Center. Then pinch **Ask Me More** and ask anything out loud. Checked facts answer instantly and offline. Anything else is looked up live and labelled as coming from the web.
5. **Hoover Tower**, then free roam: every building on the map is yours to explore.

Presenter controls: hold both pinches for 5 s to skip to free roam, and say "restart demo" to reset for the next judge.

## How it works

```
 Spectacles input (SIK hand rays, pinches, ASR)
          │
          ▼
 Scripts/RetrospecsController.ts ── the conductor: modes, pinches, the guided demo, focus on a building
          │
          ├─ Scripts/RetrospecsMap.ts ........ builds the 3D campus at runtime from Data/CampusData.ts + PathsData.ts
          ├─ Scripts/RetrospecsInfoPanel.ts .. the story card, side screens and the Archive Gallery
          ├─ Scripts/RetrospecsExperiences.ts  the animated 3D lesson beside each stop
          ├─ Scripts/RetrospecsGuide.ts ...... voice: baked narration clips, Gemini Q&A, live web answers, TTS
          └─ Scripts/AskChat.ts .............. the Ask Me More window (mic, transcript, suggested questions)

 Core/*.ts: pure TypeScript logic with no Lens Studio APIs, unit-tested with bun (tests/*.test.ts)
 Data/*.ts: generated data (OSM campus, paths, narration). Art/: baked cards, holograms, archive photos
```

**Trust model.** The guide only states facts from `Core/Cards.ts`, and every fact there carries a source URL that was opened and checked. The AI picks and frames those facts but can't add new ones: `Core/Guide.ts` validates every answer and drops invented buildings, facts and numbers. Live web answers (`Core/AskLive.ts`) are always labelled as coming from the web. Archive photos are public domain or Creative Commons, with credits on each print ([Art/ARCHIVE_PHOTOS.md](Assets/Retrospecs/Art/ARCHIVE_PHOTOS.md)). The people holograms are AI illustrations and are documented as such ([Art/PEOPLE_HOLOGRAMS.md](Assets/Retrospecs/Art/PEOPLE_HOLOGRAMS.md)).

## What's here

Everything Retrospecs-specific lives under `Assets/Retrospecs/`. The rest of `Assets/` is Snap's Depth Cache sample, which supplies the gateway, ASR and label prefab.

**Scripts: Lens Studio components and runtime glue**

| Path | What it is |
| --- | --- |
| `Scripts/RetrospecsController.ts` | The main component. Title screen, guided judge demo, calibration and indoor modes, pinch routing, focus on a building, voice commands, Next Stop, map respawn. |
| `Scripts/RetrospecsMap.ts` | Builds the map at runtime, plus highlights, labels, threads, arcs and sightline pillars. |
| `Scripts/RetrospecsInfoPanel.ts` | The focus card (baked story-card PNGs with live buttons), the diagram and people side screens, and the Archive Gallery collage that explodes into prints. |
| `Scripts/RetrospecsExperiences.ts` | Builds and animates the 3D lesson beside each stop (`Core/Experiences.ts`). |
| `Scripts/RetrospecsGuide.ts` | Voice and brain: baked ElevenLabs narration, Gemini Q&A with a response schema, live web answers, OpenAI TTS over the Remote Service Gateway. |
| `Scripts/AskChat.ts` · `AskBridge.ts` | The Ask Me More window, plus the hand-off from the sample's mic bubble. |
| `Scripts/TitleScreen.ts` | The opening RETROSPECS title card. |
| `Scripts/RetrospecsLocator.ts` · `RetrospecsOverlay.ts` | Outdoors: GPS plus Gemini identify the real building you're looking at, and a life-size nametag and outline float on it. |
| `Scripts/RetrospecsShowcase.ts` · `RetrospecsMoney.ts` | Optional extras (off by default): exploded product diagrams and real-scale "pile of money" gifts. |
| `Scripts/LabelStyle.ts` · `ScreenBezel.ts` | Small visual helpers: free-floating WorldLabels and TV bezels. |
| `Scripts/StoryDeck.ts` · `StoryHolograms.ts` · `PeopleHolograms.ts` · `ArchivePhotos.ts` | Texture lookups (`requireAsset` switches). `StoryDeck` and `ArchivePhotos` are **generated** by their render scripts. |

**Core: pure logic, unit-tested (`tests/<name>.test.ts`)**

| Path | What it is |
| --- | --- |
| `Core/Cards.ts` | **The only facts the guide may speak**, each with a source URL. Edit facts here. |
| `Core/Guide.ts` | Gemini prompt and schema, the validator (drops invented buildings, facts and numbers), profile themes, the fact picker and point-to-guess scoring. |
| `Core/AskLive.ts` · `AskBubble.ts` | Ask further (web-grounded answers, labelled as from the web), plus spoken-question routing. |
| `Core/DemoScript.ts` | The locked judge demo as a state machine: Main Quad → Archive Gallery → Huang → question → Hoover → free roam. |
| `Core/Archive.ts` | Archive Gallery layout and animation (`tools/archive-photos.json` holds the photo list and credits). |
| `Core/Experiences.ts` · `Products.ts` · `Money.ts` · `LandmarkModels.ts` | Procedural 3D: per-building lessons, exploded products, money piles, low-poly landmark models. |
| `Core/Geo.ts` · `MapMesh.ts` · `Pick.ts` · `Locate.ts` · `Overlay.ts` | Geometry: lat/long ↔ map frame, calibration math, mesh building, picking on the map and in the world, GPS snapping, the real-world overlay. |
| `Core/Focus.ts` · `CardLayout.ts` · `CardTheme.ts` · `LookNudge.ts` | Card and side-screen layout in degrees at 140 cm (Snap's far-field guidance), themes, and "look left / right" nudges. |
| `Core/Selection.ts` · `NextSpot.ts` · `Centerpieces.ts` · `Respawn.ts` · `Coach.ts` | Interaction rules: selection lock-in, Next Stop order, centerpiece emphasis, "bring the map here", and the indoor coach. |
| `Core/Throttle.ts` · `Sfx.ts` | Gateway request pacing and UI sounds. |

**Data, art, tools, tests**

| Path | What it is |
| --- | --- |
| `Data/CampusData.ts` · `PathsData.ts` | **Generated.** 562 OSM buildings and 2,086 paths around Huang. Regenerate with `bun Retrospecs/tools/bake-campus.ts` / `bake-paths.ts`. |
| `Data/NarrationData.ts` · `NarrationClips.ts` | **Generated** by `tools/build-narration.ts` from `tools/narration/narration.json`. The baked mp3s are in `Audio/narration/`. |
| `Art/<building>/` | Baked story cards, hologram loops, 3D models and archive photos for each building. Credits: [ARCHIVE_PHOTOS.md](Assets/Retrospecs/Art/ARCHIVE_PHOTOS.md), [PEOPLE_HOLOGRAMS.md](Assets/Retrospecs/Art/PEOPLE_HOLOGRAMS.md). |
| `tools/` | Offline bakers, listed in [tools/README.md](tools/README.md). |
| `tests/` | `bun test Retrospecs/tests` (332 tests), covering every `Core/` module plus the generated data. |
| `docs/` | [story-decks.md](docs/story-decks.md) (how the cards are made), plus card-style and model previews. |

## One-time setup in Lens Studio (about 15 minutes)

Built for **original Spectacles (2024) with Lens Studio 5.15.4**. The base is the Depth Cache sample from Snap's `5.15.4` branch, and the scripts type-check with zero errors against the 5.15.4 API and packages. Don't open it in Lens Studio 5.22. (Partsight's base came from the newer 5.22 branch, which is why Retrospecs doesn't reuse it.)

1. **Open** `Retrospecs/Retrospecs.esproj`.
2. **Gateway token:** Window → Remote Service Gateway Token → Generate. Paste it into the scene's `RemoteServiceGatewayCredentials` object. Never commit the token.
3. **Experimental APIs:** Project Settings → enable Experimental APIs, so internet and microphone work together in an unpublished Lens.
4. **Disable the sample's flow:** on the object with `SceneController`, uncheck that component. Leave everything else on. The sample's floating mic button hides itself while Retrospecs runs (the card's Ask button replaces it), and `DepthCache` is harmless.
5. **Add Retrospecs:** create a SceneObject named `Retrospecs` with three script components:

   | Component | Inputs |
   | --- | --- |
   | `RetrospecsMap` | `material`: `Assets/Materials/White.mat` · `labelPrefab`: `Assets/Prefabs/WorldLabel.prefab` |
   | `RetrospecsGuide` | Defaults are fine |
   | `RetrospecsController` | `camera`: the scene's Camera object · `map`: the RetrospecsMap component · `guide`: the RetrospecsGuide component · `asr`: the ASRController object |

   **Real-world visuals (optional, all on the same `Retrospecs` object):**

   | Component | Inputs | Then set on `RetrospecsController` |
   | --- | --- | --- |
   | `RetrospecsLocator` | `camera`: Camera · `map`: RetrospecsMap · `depthCache`: the sample's DepthCache | `locator` |
   | `RetrospecsOverlay` | `material`: White.mat · `labelPrefab`: WorldLabel.prefab · `camera`: Camera | `overlay` |
   | `RetrospecsMoney` | `material`: White.mat · `labelPrefab`: WorldLabel.prefab · `camera`: Camera | `money` |
   | `RetrospecsShowcase` | `material`: White.mat · `labelPrefab`: WorldLabel.prefab · `camera`: Camera | `showcase` |

   Each one is optional: if it isn't wired, the controller skips it. The Camera's **Far** clip must be 100000 so tags on distant real buildings render. `Scene.scene` already has this, but check the Inspector if Lens Studio still shows 1000. On the controller, turn `moneyOnMap` **off** outdoors so the pile is life-size; leave it on for the indoor table demo.

6. **Preview check:** in the Preview panel, click once to calibrate, treating the camera's facing as the start-point direction. The fixed floor map is about 2.3 m across, centred 106 cm ahead, so you stand near its back edge. Click again while looking at a building: it lights up and the logger shows `[Retrospecs] say: …`. Text-to-speech and Gemini need the gateway token.
7. **Device:** pair the Specs and push the Lens. Logger lines start with `[Retrospecs]`.

## Controls

| Input | What happens |
| --- | --- |
| **Guided judge demo** (`demoMode` on the controller, default ON) | Any pinch opens the map, then a fixed path ([Core/DemoScript.ts](Assets/Retrospecs/Core/DemoScript.ts)): (1) aim at the **Main Quad** (only it can light up or be picked) and pinch; (2) pinch the card for its next card; on the last card, a pinch on the card moves on; (3) **Archive Gallery**: look right and pinch the small photo collage (it breathes); it explodes into framed archival photos splayed out on the right, and pinching any photo folds them back and moves on (see [Art/ARCHIVE_PHOTOS.md](Assets/Retrospecs/Art/ARCHIVE_PHOTOS.md)); (4) aim and cards for **Huang**, then pinch the glowing Ask Me More and ask one question; the demo moves on when the answer finishes; (5) aim and cards for **Hoover Tower**; (6) "Now it's all yours": **everything unlocks** (free roam, exactly as with `demoMode` off). Each stop plays only the narration segments listed in `DEMO_STOPS` (Main Quad 0, 1 · Huang 0, 2 · Hoover 0, 1), so it stays near two minutes. Every step has a spoken direction and an on-screen tip. While guided, cards never time out, and map picks, voice commands, respawn and the card's X are off. **Presenter controls:** hold **both pinches for 5 s** at any point to skip straight to free roam (for filming; a countdown shows after 1 s), and say **"restart demo"** any time to set the guided path up again for the next judge. |
| **Indoor demo coach** (`indoorDemo`, used when `demoMode` is off) | No calibration: any pinch opens the map in front of you. A short coach then walks a first-timer through it: (1) "Aim its ray at the Main Quad"; only that building can be selected until it's picked; (2) "Pinch the card for more · Next spot · X to close"; (3) "You've got it…", which fades after 8 s. Say "demo" or "show me how" to run it again. Turn it OFF when filming outdoors to get the start-point calibration below. |
| **Calibrate** (first thing, `indoorDemo` off) | At the default start point, stand where the North-South and East-West walkways cross just east of Huang, face east between Physics and Moore, and pinch once. The pink arrow at “You are here” follows your facing direction. With `useStartPoint` off, use two wall pinches at the surveyed spot instead. |
| **Right pinch** | Tells you about the building you're looking at: on the map if you look down, or the real direction if you look out. |
| **Right pinch (short)** | Only with `showExplodedModels` / `showMoneyPiles` on (both OFF by default, so each place shows just its card, animation, person hologram and diagram). If the fact has a product (Huang: graphics card or toy-block server; Gates: server; Spilker: GPS satellite; Packard/HP Garage: audio oscillator), an exploded model floats in front of you while it speaks. If the building has a sourced gift, a pile of $1 bills with a 1.75 m person for scale appears: on the map indoors, or life-size outdoors. |
| **Right pinch (hold ≥ 0.6 s)** or say "what's that" | Outdoors: GPS plus Gemini identify the real building in view. It gets a nametag and roofline sweep: solid cyan when the camera confirms it, dashed amber when it's only a GPS estimate. Its fact is spoken and its gift pile stands beside it. |
| "explode" / "take it apart" · "hide" | Replays the exploded model · clears the models, money pile and tags. |
| **Ask** (the cyan mic button on every card) | The one way to ask. Opens the chat window with a pulsing mic and two or three suggested questions for that building. Tap a question for an instant answer from the checked card facts (works offline), or say anything: tour commands ("next spot", "what's that") go to the tour, other questions get a live web answer. The left hand does nothing on its own, and the sample's floating mic is hidden while Retrospecs runs. |
| **Point and pinch** (in a quiz; the quiz is off for the demo, `QUIZ_ENABLED` in the controller) | Stretch your arm toward the building, then pinch. You're scored in degrees, the true direction arcs out, and a new fact unlocks. |
| **Both hands pinch and twist** | Nudges the map's rotation if it's misaligned. |
| "lift" / "table" · "floor" | Map at table height in front of you · back on the floor. |
| **Look down, hold both pinches** (only after walking away from the map) | Once you're at least 6 m from the map's centre and have walked 8 m from where it was placed, looking down (35° or more) shows "Pinch with both hands to bring it here". Hold both pinches for 0.8 s and the map is rebuilt around where you now stand (calibration spot plus how far you've walked), in front of you. The calibrated rotation, table/floor choice and size stay the same. While the hint shows, single pinches do nothing. It never appears at the table. Tune it in the "Bring the map here" group (`respawnEnabled` etc.). |
| "I'm a … / I like …" | Sets your profile. "Your Stanford" lights up. |
| "Which buildings are named after tech founders?" | AI answer (constellation of buildings). Falls back to a local answer if the network is down. |
| "look it up" · "look up …" · "search …" · "what else …" · "dig deeper" | **Ask further.** A live web answer about the building in focus, from Gemini with Google Search grounding (OpenAI's web-search model is the fallback). It goes beyond the baked narration and the checked cards, and is told what you've already heard so it doesn't repeat. The answer goes on the focus card with its source domains. It's spoken with a "From what I found online" prefix, so it can't pass for a checked fact; if no search actually ran, it says "This isn't in my checked notes". Takes about 5–7 s. |
| Any question about the building in focus that the cards don't cover | Falls through to ask further automatically (`askFurther` on the controller). For 45 s afterwards, follow-ups like "when was that?" stay on the web path. "tell me more" still plays the next narration segment. |
| "something new" · "quiz me" · "recalibrate" · "reset tour" | As named. |
| **Explore More** on the illustrated Huang or HP Garage card | Plays the next story segment for that stop. The complete card is a PNG, including its text and artwork. |
| **X on the card** (point the ray at it and pinch) | Closes the card, stops the guide talking, and brings the whole map back. |
| **Next Stop** beside the illustrated card · "next" · "next spot" · "somewhere else" · "skip" | Moves on to another stop without aiming: centerpieces first (Hoover, Huang, HP Garage, Memorial Church), then narrated or illustrated buildings, then the rest, nearest first within each group. Starts with that building's overview. |

### Map tuning (`RetrospecsMap` Inspector)

| Input | Default | What it does |
| --- | --- | --- |
| `radiusM` | 700 | Real metres shown. Hoover (662 m) and Cantor (641 m) need at least ~670. Any landmark beyond it is pinned to the disc edge in its true direction. |
| `scaleDenominator` | 600 | Map geometry scale 1:N. The fixed placement applies a 1× world scale, making the 700 m disc about 2.3 m across. |
| `showOutlines` / `outlineWidthCm` | on / 0.2 | Bright pale-ice edge strip around every roof (and courtyard), with a short lip down the wall. Landmarks get a warm-white one 25% wider. 0.15–0.25 reads best. |
| `showCornerLines` | on | Thin vertical lines at corners sharper than 45°. Turn off if the map looks busy. |
| `wallInsetCm` | 0.04 | Pulls walls slightly inside the roof edge so the roof and outline overhang them. |
| `showRoads` / `roadWidthCm` | on / 1.3 | Roads as flat warm grey-white ribbons under the buildings. 1.3 cm is about 8 m at 1:600. |
| `showBikePaths` / `bikeWidthCm` | on / 0.65 | Bike paths as solid lime-green ribbons (about 4 m). Also controls the dashed green stripe down roads with painted bike lanes (`bikeLaneWidthCm`, 0.4). |
| `showFootpaths` / `footWidthCm` | off / 0.4 | Foot paths and sidewalks, faint. They are dense, so they are off by default. |

Background roofs are coloured by height: steel blue under 8 m, periwinkle from 8 to 15 m, lavender over 15 m. Walls are about half as bright. Each band has two tones, and neighbouring buildings alternate between them. Most campus buildings have no OSM height and bake as 9 m, so the tone alternation does most of the separating. Landmarks keep the amber, gold, cyan and white state colours. The build log line reports chunks and background vertex count: about 44k at the defaults.

Paths come from `Data/PathsData.ts`, baked by `bun Retrospecs/tools/bake-paths.ts` (add `--refresh` to re-download from Overpass). The bake is separate from `CampusData.ts`, so landmark building indices never move. Ribbons sit at y 0.02–0.045 cm, staggered by kind, and are clipped to `radiusM` around the wearer. The log line adds path vertex counts: about 2k road and 5k bike at the defaults, plus about 3.7k with foot paths on.

## Calibration at the venue (do this before the judges arrive)

- **Default start point:** `useStartPoint` is on. Stand at the walkway intersection just east of Huang (`startLat` / `startLon` in `RetrospecsController`), face east along the East-West Axis between Physics and Moore, and pinch once. `startFacingDeg` is 104.8°. Mark the exact standing spot and verify the facing direction on site; these coordinates and direction have not yet been tested there.
- **Check alignment:** the “You are here” pin should be at the intersection, and the map's East-West walkway should line up with the real one. Look toward Hoover Tower (about 93° from Huang) as a second directional check. Walk a few metres and confirm the map stays in place. If alignment is off, adjust the marked spot or `startLat` / `startLon` before the demo.
- **Wall fallback:** turn `useStartPoint` off to use two wall pinches at `surveyLat` / `surveyLon` (Huang by default). Set `facingHint` to the wall face you use. The wall directions are 15° / 105° / 195° / 285°.

## Device test checklist (do these first, in order)

| # | Test | Pass | If it fails |
| --- | --- | --- | --- |
| 1 | Push. The logger shows `map built in X s` | Under 2 s, no "not valid" mesh lines | Turn off `showCornerLines`, then lower `radiusM` (and `scaleDenominator` with it) |
| 2 | At the marked walkway intersection, face east between Physics and Moore and pinch once | Map unfolds in front; “You are here” and walkway axes match the real intersection | Check `useStartPoint`, `startLat` / `startLon`, and `startFacingDeg`; record the Logger's calibrated bearing and yaw |
| 3 | Look down at the map | Readable 3D buildings with bright roof outlines, roofs brighter than walls | Raise `verticalExaggeration` to 4; say "lift" |
| 4 | Right-pinch while looking at mini Hoover | Hoover lights up, its fact is spoken, and a pillar appears about 9 m out to the east | Check the gateway token (needed for text-to-speech) |
| 5 | (Only if `QUIZ_ENABLED` is on) Wait for the quiz, point, pinch | Orange (your guess) and green (truth) arcs, plus a degrees score | Pinch with your arm extended. The knuckle position is what's scored |
| 6 | Left-pinch: "Which buildings are named after tech founders?" | Several buildings light up with threads, answered in under 8 s | The local fallback answer plays after 8 s |
| 7 | Frame rate with the map open | Smooth | Turn off `showCornerLines`, then lower `radiusM`. The map is about 230 buildings at 700 m |

## Known limits

- **Map mesh layout:** generated meshes now include `texture0` UVs for `White.mat`. If the map is still invisible, check the Preview camera angle and Logger for mesh warnings.
- **Progress resets every launch** (`persistProgress` is off) so each judge starts fresh. Turn it on for personal use.
- **The point-to-guess quiz is off** (`QUIZ_ENABLED = false`). With it on, the quiz starts 1.5 s after narration ends, and Ask still opens the mic during a quiz.
- **Calibration** defaults to a known outdoor start point and facing direction. The wall-pinch method remains available with `useStartPoint` off.
- **Labels** use the sample's WorldLabel prefab. They pop in with a random delay of up to 1.7 s, which is the prefab's own animation.
- **Voice:** card narration plays pre-rendered ElevenLabs clips (`Audio/narration`, listed in `Data/NarrationClips.ts`). Live answers use the gateway's OpenAI text-to-speech.
- **Unverified facts are kept out of `Cards.ts`.** Before adding any fact, open its source page.

## Tokens

The gateway tokens live only in your local `Assets/Scene.scene`. `Retrospecs/.gitattributes` runs a git clean filter that blanks `openAIToken`, `googleToken` and `snapToken` on commit. After cloning, set it up once, then paste your own tokens in Lens Studio:

```bash
git config filter.striptokens.clean "sed -E 's/^([[:space:]]*(openAIToken|googleToken|snapToken):).*/\1 \"\"/'"
git config filter.striptokens.smudge cat
git config filter.striptokens.required true
```

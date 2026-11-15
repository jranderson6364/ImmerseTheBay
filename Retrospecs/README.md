# Retrospecs Lens

A Stanford tour guide in your glasses. A 3D campus map unfolds on the floor around you, lined up with the real campus. Look at a building and pinch to hear who it's named for, the founder story behind it, and what's inside. Then the guide quizzes you: "Point to where you think Gates is." Concept: [docs/retrospecs-concept.md](../docs/retrospecs-concept.md).

Built on Snap's MIT-licensed [Depth Cache sample](https://github.com/specs-devs/samples/tree/5.15.4) (`5.15.4` branch). It reuses the sample's Remote Service Gateway setup, ASR, and WorldLabel prefab. Map data (buildings, roads, bike and foot paths) © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.

## What's here

| Path | What it is |
| --- | --- |
| `Assets/Retrospecs/Data/CampusData.ts` | **Generated.** 562 OSM buildings within 1.1 km of Huang: footprints, heights, roof triangles, plus 13 landmark records. Regenerate with `bun Retrospecs/tools/bake-campus.ts`. |
| `Assets/Retrospecs/Core/Geo.ts` | Lat/long to local metres, bearings, wall-pinch calibration math. Pure TypeScript, unit-tested. |
| `Assets/Retrospecs/Core/MapMesh.ts` | Footprints to MeshBuilder arrays (roofs and walls, chunks kept under 65k vertices), plus tubes and arcs. Unit-tested. |
| `Assets/Retrospecs/Core/Cards.ts` | **The only facts the guide may speak**, each with a source URL. Edit facts here. |
| `tools/render_story_decks.py` | Renders the four centerpiece decks plus one or two illustrated cards for every other selectable building, using the sourced facts in `Cards.ts`. Run `python Retrospecs/tools/render_story_decks.py` after editing them. |
| `Assets/Retrospecs/Core/Guide.ts` | Gemini prompt and schema, the validator (drops invented buildings, facts and numbers), profile themes, fact picker, point-to-guess scoring. Unit-tested. |
| `Assets/Retrospecs/Scripts/RetrospecsMap.ts` | Builds the map at runtime, plus highlights, labels, threads, arcs and sightline pillars. |
| `Assets/Retrospecs/Core/AskLive.ts` | Ask further: grounded-answer prompt, reply parsing (Gemini grounding and OpenAI citations), speech cleanup, "from the web" labelling. Unit-tested. |
| `Assets/Retrospecs/Scripts/RetrospecsGuide.ts` | Gemini Q&A, live web answers (`askLive`), and OpenAI text-to-speech over the Remote Service Gateway. |
| `Assets/Retrospecs/Scripts/RetrospecsController.ts` | Calibration, floor/table map, gaze pick, voice commands, point-to-guess, saved progress. |
| `tests/` | `bun test Retrospecs/tests` (16 tests). |

## One-time setup in Lens Studio (about 15 minutes)

Built for **original Spectacles (2024) with Lens Studio 5.15.4**. The base is the Depth Cache sample from Snap's `5.15.4` branch, and the scripts type-check with zero errors against the 5.15.4 API and packages. Don't open it in Lens Studio 5.22. (Partsight's base came from the newer 5.22 branch, which is why Retrospecs doesn't reuse it.)

1. **Open** `Retrospecs/Retrospecs.esproj`.
2. **Gateway token:** Window → Remote Service Gateway Token → Generate. Paste it into the scene's `RemoteServiceGatewayCredentials` object. Never commit the token.
3. **Experimental APIs:** Project Settings → enable Experimental APIs, so internet and microphone work together in an unpublished Lens.
4. **Disable the sample's flow:** on the object with `SceneController`, uncheck that component. Leave everything else on. The sample's floating mic button still works and feeds Retrospecs' voice commands, and `DepthCache` is harmless.
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
| **Indoor demo** (`indoorDemo` on the controller, default ON) | For judging indoors. No calibration: any pinch opens the map in front of you. A short coach then walks a first-timer through it, as a tip under the caption: (1) "Raise your right hand. Aim its ray at Hoover Tower, the gold one." Only Hoover can be selected in this step: other buildings don't turn blue, the tip names the building the cursor is on and steers back to Hoover, a wrong pinch gets a spoken nudge, and voice shortcuts and left pinch are off until Hoover is picked. When the cursor reaches Hoover it turns blue and the tip says "Pinch now!". (2) once the card opens, "Pinch the card for more · Next spot · X to close", (3) after one more action, "You've got it…", which fades after 8 s. Only the first two steps are spoken. Say "demo" or "show me how" to run it again. Turn it OFF when filming outdoors to get the start-point calibration below. |
| **Calibrate** (first thing, `indoorDemo` off) | At the default start point, stand where the North-South and East-West walkways cross just east of Huang, face east between Physics and Moore, and pinch once. The pink arrow at “You are here” follows your facing direction. With `useStartPoint` off, use two wall pinches at the surveyed spot instead. |
| **Right pinch** | Tells you about the building you're looking at: on the map if you look down, or the real direction if you look out. |
| **Right pinch (short)** | If the fact has a product (Huang: graphics card or toy-block server; Gates: server; Spilker: GPS satellite; Packard/HP Garage: audio oscillator), an exploded model floats in front of you while it speaks. If the building has a sourced gift, a pile of $1 bills with a 1.75 m person for scale appears: on the map indoors, or life-size outdoors. |
| **Right pinch (hold ≥ 0.6 s)** or say "what's that" | Outdoors: GPS plus Gemini identify the real building in view. It gets a nametag and roofline sweep: solid cyan when the camera confirms it, dashed amber when it's only a GPS estimate. Its fact is spoken and its gift pile stands beside it. |
| "explode" / "take it apart" · "hide" | Replays the exploded model · clears the models, money pile and tags. |
| **Left pinch** | Ask by voice. |
| **Point and pinch** (in a quiz) | Stretch your arm toward the building, then pinch. You're scored in degrees, the true direction arcs out, and a new fact unlocks. |
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
| 5 | Wait for the quiz, point, pinch | Orange (your guess) and green (truth) arcs, plus a degrees score | Pinch with your arm extended. The knuckle position is what's scored |
| 6 | Left-pinch: "Which buildings are named after tech founders?" | Several buildings light up with threads, answered in under 8 s | The local fallback answer plays after 8 s |
| 7 | Frame rate with the map open | Smooth | Turn off `showCornerLines`, then lower `radiusM`. The map is about 230 buildings at 700 m |

## Known limits

- **Map mesh layout:** generated meshes now include `texture0` UVs for `White.mat`. If the map is still invisible, check the Preview camera angle and Logger for mesh warnings.
- **Progress resets every launch** (`persistProgress` is off) so each judge starts fresh. Turn it on for personal use.
- **The quiz starts 1.5 s after narration ends.** Left pinch always opens the mic, even during a quiz.
- **Calibration** defaults to a known outdoor start point and facing direction. The wall-pinch method remains available with `useStartPoint` off.
- **Labels** use the sample's WorldLabel prefab. They pop in with a random delay of up to 1.7 s, which is the prefab's own animation.
- **Voice** is the gateway's OpenAI text-to-speech. Pre-rendered ElevenLabs clips aren't wired up; that needs a key and an audio-array input.
- **Unverified facts are kept out of `Cards.ts`.** Before adding any fact, open its source page.

## Tokens

The gateway tokens live only in your local `Assets/Scene.scene`. `Retrospecs/.gitattributes` runs a git clean filter that blanks `openAIToken`, `googleToken` and `snapToken` on commit. After cloning, set it up once, then paste your own tokens in Lens Studio:

```bash
git config filter.striptokens.clean "sed -E 's/^([[:space:]]*(openAIToken|googleToken|snapToken):).*/\1 \"\"/'"
git config filter.striptokens.smudge cat
git config filter.striptokens.required true
```

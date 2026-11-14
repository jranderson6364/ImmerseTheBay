# Sightlines Lens

A Stanford tour guide in your glasses. A 3D campus map unfolds on the floor around you, lined up with the real campus. Look at a building and pinch to hear who it's named for, the founder story behind it, and what's inside. Then the guide quizzes you: "Point to where you think Gates is." Concept: [docs/sightlines-concept.md](../docs/sightlines-concept.md).

Built on Snap's MIT-licensed [Depth Cache sample](https://github.com/specs-devs/samples/tree/5.15.4) (`5.15.4` branch). It reuses the sample's Remote Service Gateway setup, ASR, and WorldLabel prefab. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.

## What's here

| Path | What it is |
| --- | --- |
| `Assets/Sightlines/Data/CampusData.ts` | **Generated.** 562 OSM buildings within 1.1 km of Huang: footprints, heights, roof triangles, plus 13 landmark records. Regenerate with `bun Sightlines/tools/bake-campus.ts`. |
| `Assets/Sightlines/Core/Geo.ts` | Lat/long to local metres, bearings, wall-pinch calibration math. Pure TypeScript, unit-tested. |
| `Assets/Sightlines/Core/MapMesh.ts` | Footprints to MeshBuilder arrays (roofs and walls, chunks kept under 65k vertices), plus tubes and arcs. Unit-tested. |
| `Assets/Sightlines/Core/Cards.ts` | **The only facts the guide may speak**, each with a source URL. Edit facts here. |
| `Assets/Sightlines/Core/Guide.ts` | Gemini prompt and schema, the validator (drops invented buildings, facts and numbers), profile themes, fact picker, point-to-guess scoring. Unit-tested. |
| `Assets/Sightlines/Scripts/SightlinesMap.ts` | Builds the map at runtime, plus highlights, labels, threads, arcs and sightline pillars. |
| `Assets/Sightlines/Scripts/SightlinesGuide.ts` | Gemini Q&A and OpenAI text-to-speech over the Remote Service Gateway. |
| `Assets/Sightlines/Scripts/SightlinesController.ts` | Calibration, floor/table map, gaze pick, voice commands, point-to-guess, saved progress. |
| `tests/` | `bun test Sightlines/tests` (16 tests). |

## One-time setup in Lens Studio (about 15 minutes)

Built for **original Spectacles (2024) with Lens Studio 5.15.4**. The base is the Depth Cache sample from Snap's `5.15.4` branch, and the scripts type-check with zero errors against the 5.15.4 API and packages. Don't open it in Lens Studio 5.22. (Partsight's base came from the newer 5.22 branch, which is why Sightlines doesn't reuse it.)

1. **Open** `Sightlines/Sightlines.esproj`.
2. **Gateway token:** Window → Remote Service Gateway Token → Generate. Paste it into the scene's `RemoteServiceGatewayCredentials` object. Never commit the token.
3. **Experimental APIs:** Project Settings → enable Experimental APIs, so internet and microphone work together in an unpublished Lens.
4. **Disable the sample's flow:** on the object with `SceneController`, uncheck that component. Leave everything else on. The sample's floating mic button still works and feeds Sightlines' voice commands, and `DepthCache` is harmless.
5. **Add Sightlines:** create a SceneObject named `Sightlines` with three script components:

   | Component | Inputs |
   | --- | --- |
   | `SightlinesMap` | `material`: `Assets/Materials/White.mat` · `labelPrefab`: `Assets/Prefabs/WorldLabel.prefab` |
   | `SightlinesGuide` | Defaults are fine |
   | `SightlinesController` | `camera`: the scene's Camera object · `map`: the SightlinesMap component · `guide`: the SightlinesGuide component · `asr`: the ASRController object |

   **Real-world visuals (optional, all on the same `Sightlines` object):**

   | Component | Inputs | Then set on `SightlinesController` |
   | --- | --- | --- |
   | `SightlinesLocator` | `camera`: Camera · `map`: SightlinesMap · `depthCache`: the sample's DepthCache | `locator` |
   | `SightlinesOverlay` | `material`: White.mat · `labelPrefab`: WorldLabel.prefab · `camera`: Camera | `overlay` |
   | `SightlinesMoney` | `material`: White.mat · `labelPrefab`: WorldLabel.prefab · `camera`: Camera | `money` |
   | `SightlinesShowcase` | `material`: White.mat · `labelPrefab`: WorldLabel.prefab · `camera`: Camera | `showcase` |

   Each one is optional: if it isn't wired, the controller skips it. The Camera's **Far** clip must be 100000 so tags on distant real buildings render. `Scene.scene` already has this, but check the Inspector if Lens Studio still shows 1000. On the controller, turn `moneyOnMap` **off** outdoors so the pile is life-size; leave it on for the indoor table demo.

6. **Preview check:** in the Preview panel, click once to "calibrate", using the camera's facing as the wall. The floor map appears about 140 cm in front of the camera; look down to see it. Click again while looking at a building: it lights up and the logger shows `[Sightlines] say: …`. Text-to-speech and Gemini need the gateway token.
7. **Device:** pair the Specs and push the Lens. Logger lines start with `[Sightlines]`.

## Controls

| Input | What happens |
| --- | --- |
| **Calibrate** (first thing) | Face a wall, then pinch a point on its **left**, then its **right**, at least 30 cm apart. Or say "skip" to use the direction you're facing. |
| **Right pinch** | Tells you about the building you're looking at: on the map if you look down, or the real direction if you look out. |
| **Right pinch (short)** | If the fact has a product (Huang: graphics card or toy-block server; Gates: server; Spilker: GPS satellite; Packard/HP Garage: audio oscillator), an exploded model floats in front of you while it speaks. If the building has a sourced gift, a pile of $1 bills with a 1.75 m person for scale appears: on the map indoors, or life-size outdoors. |
| **Right pinch (hold ≥ 0.6 s)** or say "what's that" | Outdoors: GPS plus Gemini identify the real building in view. It gets a nametag and roofline sweep: solid cyan when the camera confirms it, dashed amber when it's only a GPS estimate. Its fact is spoken and its gift pile stands beside it. |
| "explode" / "take it apart" · "hide" | Replays the exploded model · clears the models, money pile and tags. |
| **Left pinch** | Ask by voice. |
| **Point and pinch** (in a quiz) | Stretch your arm toward the building, then pinch. You're scored in degrees, the true direction arcs out, and a new fact unlocks. |
| **Both hands pinch and twist** | Nudges the map's rotation if it's misaligned. |
| "lift" / "table" · "floor" | Map at table height in front of you · back on the floor. |
| "I'm a … / I like …" | Sets your profile. "Your Stanford" lights up. |
| "Which buildings are named after tech founders?" | AI answer (constellation of buildings). Falls back to a local answer if the network is down. |
| "something new" · "quiz me" · "recalibrate" · "reset tour" | As named. |

### Map tuning (`SightlinesMap` Inspector)

| Input | Default | What it does |
| --- | --- | --- |
| `radiusM` | 700 | Real metres shown. Hoover (662 m) and Cantor (641 m) need at least ~670. Any landmark beyond it is pinned to the disc edge in its true direction. |
| `scaleDenominator` | 600 | Map scale 1:N. 700 m at 1:600 is a disc about 2.3 m across. Change both together to keep the physical size (radius cm = `radiusM` × 100 / N). |
| `showOutlines` / `outlineWidthCm` | on / 0.2 | Bright pale-ice edge strip around every roof (and courtyard), with a short lip down the wall. Landmarks get a warm-white one 25% wider. 0.15–0.25 reads best. |
| `showCornerLines` | on | Thin vertical lines at corners sharper than 45°. Turn off if the map looks busy. |
| `wallInsetCm` | 0.04 | Pulls walls slightly inside the roof edge so the roof and outline overhang them. |

Background roofs are coloured by height: steel blue under 8 m, periwinkle from 8 to 15 m, lavender over 15 m. Walls are about half as bright. Each band has two tones, and neighbouring buildings alternate between them. Most campus buildings have no OSM height and bake as 9 m, so the tone alternation does most of the separating. Landmarks keep the amber, gold, cyan and white state colours. The build log line reports chunks and background vertex count: about 44k at the defaults.

## Calibration at the venue (do this before the judges arrive)

- **Where you stand:** `surveyLat` / `surveyLon` on `SightlinesController`. The default is Huang's centroid; the basement is directly under it.
- **The wall:** Huang's walls run at **15° / 105° / 195° / 285°** (computed from its OSM footprint). Set `facingHint` to roughly the compass direction you face when looking at your calibration wall: 105 means you face east-southeast. Get that once from a phone compass in the room, or read it off a map. Only accuracy within ±45° matters, because the value snaps to the nearest wall face.
- **Don't trust a phone compass in the basement.** The steel can throw it off by more than 45°. Work out which basement wall is the ~105° (east-facing) one from Huang's footprint on a map, then confirm with the Hoover check below.
- **Outdoor shoot (today, about 4:40–5:15 PM):** stand just outside Huang and calibrate on its exterior wall, which has the same 15/105/195/285° bearings. Put your actual spot's lat/long into `surveyLat` / `surveyLon`; read it off Google Maps by long-pressing the spot. Tape an X there so retakes line up.
- **Check it:** look toward Hoover Tower. It's 660 m away at 93°, nearly due east. Pinch while facing that way and its sightline pillar should appear. Compare against a printed north-up map. If it's off, use the two-hand twist.

## Device test checklist (do these first, in order)

| # | Test | Pass | If it fails |
| --- | --- | --- | --- |
| 1 | Push. The logger shows `map built in X s` | Under 2 s, no "not valid" mesh lines | Turn off `showCornerLines`, then lower `radiusM` (and `scaleDenominator` with it) |
| 2 | Calibrate with two wall pinches | Map unfolds at your feet | Say "skip" to calibrate from your facing direction |
| 3 | Look down at the map | Readable 3D buildings with bright roof outlines, roofs brighter than walls | Raise `verticalExaggeration` to 4; say "lift" |
| 4 | Right-pinch while looking at mini Hoover | Hoover lights up, its fact is spoken, and a pillar appears about 9 m out to the east | Check the gateway token (needed for text-to-speech) |
| 5 | Wait for the quiz, point, pinch | Orange (your guess) and green (truth) arcs, plus a degrees score | Pinch with your arm extended. The knuckle position is what's scored |
| 6 | Left-pinch: "Which buildings are named after tech founders?" | Several buildings light up with threads, answered in under 8 s | The local fallback answer plays after 8 s |
| 7 | Frame rate with the map open | Smooth | Turn off `showCornerLines`, then lower `radiusM`. The map is about 230 buildings at 700 m |

## Known limits

- **Map mesh layout:** generated meshes now include `texture0` UVs for `White.mat`. If the map is still invisible, check the Preview camera angle and Logger for mesh warnings.
- **Progress resets every launch** (`persistProgress` is off) so each judge starts fresh. Turn it on for personal use.
- **The quiz starts 1.5 s after narration ends.** Left pinch always opens the mic, even during a quiz.
- **Calibration** uses a known wall, not GPS or the compass. That's deliberate: both are unreliable indoors. GPS-based walking mode isn't built.
- **Labels** use the sample's WorldLabel prefab. They pop in with a random delay of up to 1.7 s, which is the prefab's own animation.
- **Voice** is the gateway's OpenAI text-to-speech. Pre-rendered ElevenLabs clips aren't wired up; that needs a key and an audio-array input.
- **Unverified facts are kept out of `Cards.ts`.** Before adding any fact, open its source page.

## Tokens

The gateway tokens live only in your local `Assets/Scene.scene`. `Sightlines/.gitattributes` runs a git clean filter that blanks `openAIToken`, `googleToken` and `snapToken` on commit. After cloning, set it up once, then paste your own tokens in Lens Studio:

```bash
git config filter.striptokens.clean "sed -E 's/^([[:space:]]*(openAIToken|googleToken|snapToken):).*/\1 \"\"/'"
git config filter.striptokens.smudge cat
git config filter.striptokens.required true
```

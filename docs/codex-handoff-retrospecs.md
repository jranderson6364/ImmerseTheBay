# Handoff to Codex: get the Retrospecs Lens running

## Current handoff — November 14, 2026

**Resume here.** Jason has `Retrospecs/Retrospecs.esproj` open in Lens Studio 5.15.4. Scene wiring is saved. He manually entered the OpenAI, Google, and Snap gateway tokens. Voice works. The map originally appeared as a palm-tree camera image and then only one tall rectangle. We added zero `texture0` UVs to every generated mesh vertex and added the UV attribute to `RetrospecsMap.meshObject`. After that change, the first calibration tap fails with:

```
InternalError: Wrong number of vertices
appendVerticesInterleaved@native
meshObject@Assets/Retrospecs/Scripts/RetrospecsMap.ts:319
build@Assets/Retrospecs/Scripts/RetrospecsMap.ts:109
finishCalibration@Assets/Retrospecs/Scripts/RetrospecsController.ts:170
```

**Next action:** fix this runtime mesh error before asking Jason to reset Preview. Inspect `Core/MapMesh.ts` and `Scripts/RetrospecsMap.ts` for a vertex stride mismatch, especially the roof chunk passed by `build` near line 109. Check actual chunk vertex counts and Lens Studio's `MeshBuilder.appendVerticesInterleaved` requirements. It may be loading a stale compiled `MapMesh.ts` (6 floats per vertex) with the new 8-float layout; this is a hypothesis, not a diagnosis. An adapter in `meshObject` that expands a 6-float core vertex into 8 floats may make the boundary explicit. Re-run `bun test Retrospecs/tests` and `bunx -p typescript@5.6.3 tsc -p Retrospecs/tsconfig.json --pretty false`, then have Jason reset Preview and tap once. The previous change passed 16 unit tests and type-check, but failed at runtime.

**Current file changes:** `Retrospecs/Assets/Retrospecs/Core/MapMesh.ts` emits 8 floats per vertex (xyz position, xyz normal, two zero UVs), `Retrospecs/Assets/Retrospecs/Scripts/RetrospecsMap.ts` declares `texture0`, `Retrospecs/tests/core.test.ts` expects stride 8, and `Retrospecs/README.md` describes UVs. `Retrospecs/` is untracked on `main`; no commit was made. `Assets/Scene.scene` contains credentials: do not print token values, include them in a handoff, or commit them to a public repo. The Lens Studio MCP server was not exposed in the available tools. Jason chose manual guidance and stopped computer use; do not resume computer use unless he asks. The original Spectacles (2024) device test and submission are still outstanding. Deadline: Sunday November 15 at 9:00 AM Pacific.

The older checklist below describes the intended setup and test sequence. Its unchecked setup steps predate the current handoff; scene wiring, token entry, and working voice have since been confirmed by Jason.

Written November 14, 2026, Saturday afternoon (Pacific). The submission deadline is **Sunday 9:00 AM**: Devpost, a 30-second vertical video, and a public MIT repo. Judging is a live table demo in the Huang basement, Sunday 10 AM to noon.

## Goal for this session

Use computer use to open the project in Lens Studio, wire the scene, confirm it works in Preview, and push it to Jason's **original Spectacles (2024)**. Report what you saw at each checkpoint below, with Logger text. Fix code issues if they come up.

## Current state (all verified unless marked)

- **Project:** `Retrospecs/Retrospecs.esproj`. It is Snap's Depth Cache sample from the **`5.15.4` branch** of github.com/specs-devs/samples, plus our code in `Retrospecs/Assets/Retrospecs/`.
- **Lens Studio:** 5.15.4 is installed at `C:\Program Files\Snap Inc\Lens Studio`, which is correct for original Spectacles.
  - **Do not** open `Partsight/` for this. It was saved by Lens Studio 5.22 and targets newer Specs.
- **Verified:**
  - The Retrospecs scripts type-check with **zero errors** against the 5.15.4 declarations and packages. See "Type-check" below.
  - `bun test Retrospecs/tests` passes: 16 tests.
- **Not verified:** the scene wiring isn't done. Nothing has run in the Lens Studio Preview or on the device.
- **Git:** nothing is committed (`Retrospecs/` is untracked). **Don't commit unless Jason asks.** Once the gateway token is pasted, it is saved in `Assets/Scene.scene`. Remove it, or check for it, before any commit to the public repo.

## What the Lens does

A Stanford tour guide in the glasses:

1. **Map:** a 3D campus map (562 OSM buildings, built at runtime with `MeshBuilder`) unfolds on the floor, centred on the wearer.
2. **Calibration:** the map is north-aligned by pinching two points along a wall of known compass bearing. Huang's walls run at 15/105/195/285°.
3. **Tour:** right-pinch while looking at a building, real or on the map, and it speaks a sourced fact.
4. **Point to guess:** the guide asks you to point at another building and pinch. You're scored in degrees, the guess and true arcs are drawn, and a new fact unlocks.
5. **Questions:** left pinch opens the mic for a question. Gemini, through the Remote Service Gateway, returns a schema-validated answer that lights buildings and draws threads.

Product context:
- `docs/retrospecs-concept.md`
- `Retrospecs/README.md`: setup, controls, device checklist, calibration notes

## File map

| Path | Role |
| --- | --- |
| `Retrospecs/Assets/Retrospecs/Scripts/RetrospecsController.ts` | Calibration, floor/table placement, gaze pick, pinch/voice routing, quiz flow |
| `Retrospecs/Assets/Retrospecs/Scripts/RetrospecsMap.ts` | Builds the map meshes, labels (WorldLabel prefab), highlights, arcs, pillars |
| `Retrospecs/Assets/Retrospecs/Scripts/RetrospecsGuide.ts` | Gemini `generateContent` with `response_schema` plus OpenAI TTS, through the gateway |
| `Retrospecs/Assets/Retrospecs/Core/*.ts` | Pure logic: geo, mesh generation, sourced cards, guide validator and scoring (unit-tested) |
| `Retrospecs/Assets/Retrospecs/Data/CampusData.ts` | Generated by `bun Retrospecs/tools/bake-campus.ts` (OSM, ODbL). Don't hand-edit |
| `Retrospecs/Assets/Scripts/*` | Stock Depth Cache sample scripts (ASRController, WorldLabel, SpeechUI, …) |

## Steps (with checkpoints)

**1. Open the project.** Close any open project, including `SpectaclesSandbox.esproj`, which may be open. Then File → Open → `Retrospecs\Retrospecs.esproj`.
- ✅ Checkpoint: no red script errors in the Logger. Note any warnings.

**2. Gateway token.**
- Window → Remote Service Gateway Token → Generate. If that menu is missing, install "Remote Service Gateway Token Generator" from the Asset Library.
- Paste the token into the `RemoteServiceGatewayCredentials` component in the scene.
- This needs Jason's Snap login. If Lens Studio asks him to sign in, stop and ask him; don't enter credentials yourself.

**3. Project Settings → enable Experimental APIs.** Internet and microphone together in an unpublished Lens need it.

**4. Turn off the sample's flow.** Find the object with the `SceneController` component and uncheck **only that component**. Leave `DepthCache`, `ASRController` and `SpeechUI` enabled. The sample's mic button also feeds our voice handler.

**5. Create a SceneObject `Retrospecs` with three script components:**

| Component | Inputs |
| --- | --- |
| `RetrospecsMap` | `material` = `Assets/Materials/White.mat`; `labelPrefab` = `Assets/Prefabs/WorldLabel.prefab` |
| `RetrospecsGuide` | defaults |
| `RetrospecsController` | `camera` = the scene's Camera object; `map` = the RetrospecsMap component; `guide` = the RetrospecsGuide component; `asr` = the object with ASRController |

Leave the other inputs at their defaults. `persistProgress` stays **off** so each judge starts fresh.

**6. Preview test.**
- Click the Preview once. That calibrates, using the camera's facing as the wall.
- ✅ Expect:
  - The Logger shows `[Retrospecs] map built in X s`.
  - The map unfolds around the camera's floor position.
  - No `mesh … is not valid` lines.
- Aim the preview camera down at the map and click again.
- ✅ Expect a landmark to glow, plus `[Retrospecs] say: …`. You hear the voice if the token works.
- Take a screenshot of the Preview for the report.

**7. Push to the Spectacles.** Pair the device using Lens Studio's device pairing, then Send to Spectacles. Jason has to put the glasses on and act, so relay these instructions to him:

| # | Jason does | Expected |
| --- | --- | --- |
| 1 | Launch | Logger: `map built` in under 2 s |
| 2 | Face a wall; pinch left point, then right point (≥ 30 cm apart), or say "skip" | Map unfolds at his feet |
| 3 | Look down at the map | Readable 3D buildings |
| 4 | Look at mini Hoover (east edge), right-pinch | Hoover glows, fact spoken, light pillar appears to the east |
| 5 | Wait for "Point to where you think … is"; arm out; pinch | Orange and green arcs, degrees score |
| 6 | Left-pinch: "Which buildings are named after tech founders?" | Several buildings light up with threads, in under 8 s (local fallback after 8 s) |

## Likely issues and the fix for each

| Symptom | Fix |
| --- | --- |
| Map invisible in Preview, or the Logger mentions `texture0` | `White.mat`'s shader wants UVs. In `Core/MapMesh.ts`, add 2 zero floats per vertex (stride 6 → 8, everywhere verts are pushed or `/6` is used). In `RetrospecsMap.meshObject`, add `{name: "texture0", components: 2}` to the MeshBuilder layout. Re-run the tests. |
| Map renders but is too flat or dim | Raise `verticalExaggeration` to 4 on RetrospecsMap. Raise the colour values in `COLORS` in `RetrospecsMap.ts`. The additive display shows dark colours as transparent. |
| Labels huge or tiny | Change `labelScale` on RetrospecsMap (default 0.35). |
| Gemini answers rejected or empty | Check the `[Retrospecs] validator dropped:` lines. The response schema is `GUIDE_SCHEMA` in `Core/Guide.ts`. Try `model` = `gemini-2.5-flash` or `gemini-2.0-flash` on RetrospecsGuide. |
| Frame rate drops | Lower `radiusM` on RetrospecsMap to 700. |
| Calibration rotated wrong | Two-hand pinch-and-twist nudges the yaw. Or set `facingHint` on the controller to the rough compass direction of the wall you face. It snaps to 15/105/195/285°. |

## Type-check (re-run after any code change)

The Lens packages are zip files (`Retrospecs/Packages/*.lspkg`). The check used:
- a temp tsconfig with paths `<Pkg>.lspkg/*` → the extracted `Package/Assets/*`,
- the 5.15.4 declarations at `SpectaclesSandbox.esproj/Cache/TypeScript/lib/LensifyTS/Declarations/**/*.d.ts`,
- `bunx -p typescript@5.6.3 tsc -p <tsconfig>`,
- **no** `experimentalDecorators`, because Lens uses TC39 decorators.

Expected result: 0 errors. Also run `bun test Retrospecs/tests`.

## Rules that apply

- **Facts:** the guide may speak only facts in `Core/Cards.ts`, and each one has a source URL. Don't add facts without opening a primary source. Already kept out: Gates "room 360", Ram Shriram's Google investment, the Allen building's Microsoft link.
- **Repo:** all code is MIT, open source. Credit OpenStreetMap (ODbL) and Snap's sample (already in `Retrospecs/README.md`).
- **ElevenLabs:** optional and not wired. Jason can put a key in the repo-root `.env` as `ELEVENLABS_API_KEY`. Pre-rendering clips would need a script plus an `AudioTrackAsset[]` input, so do it only after the device demo works.
- **Today's outdoor video shoot:** about 4:40–5:15 PM. Calibrate on Huang's exterior wall, with the spot's lat/lon in `surveyLat` / `surveyLon`. See the calibration section of `Retrospecs/README.md`.

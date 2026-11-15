# Partsight Lens

Hold an everyday object and press Scan. A to-scale exploded diagram appears on the real object. Pull your hands apart to explode it, pinch a part to hear what it does, and ask questions by voice. The design rationale is in [docs/partsight-decision.md](../../docs/partsight-decision.md).

This Lens Studio project is built on Snap's MIT-licensed [Depth Cache sample](https://github.com/specs-devs/samples). It reuses the sample's camera + depth pairing, ASR, and Remote Service Gateway setup. The original sample README is [DEPTH-CACHE-README.md](DEPTH-CACHE-README.md), and its license and terms are in [LICENSE-SNAP-SAMPLE.md](LICENSE-SNAP-SAMPLE.md).

## What's here

| Path | What it is |
| --- | --- |
| `Assets/Partsight/Core/PartSpec.ts` | Parts-spec types, the Gemini prompt and response schema, the validator (clamps, dedupes, drops bad references), safety gate, scale and explode math. Pure TS, unit-tested. |
| `Assets/Partsight/Core/HeroSpecs.ts` | Hand-written **Verified** specs for a retractable pen, a 2xAA flashlight, and a pin-tumbler padlock. **Tape-measure your real objects and update `overall_mm`.** |
| `Assets/Partsight/Scripts/PartsightGemini.ts` | Remote Service Gateway Gemini calls: image to spec, and grounded Q&A. |
| `Assets/Partsight/Scripts/PartsightRenderer.ts` | Builds the diagram: unit meshes scaled to mm, staggered explode, labels and leader lines, pinch selection, step animations. |
| `Assets/Partsight/Scripts/PartsightController.ts` | Scan flow, depth-based measurement and placement, two-hand explode/rotate, voice commands, TTS. |
| `Assets/Partsight/Meshes/ps_*.obj` | Unit meshes (box, rounded box, cylinder, tube, capsule, cone, sphere, torus, U-shape, spring, gear). Regenerate with `bun unneeded/Partsight/tools/gen-unit-meshes.ts`. |
| `tests/` | `bun test unneeded/Partsight/tests` |
| `Assets/Scripts`, `Assets/Prefabs`, … | The Depth Cache sample, unchanged. |

## One-time setup in Lens Studio (about 20 minutes)

You need Lens Studio 5.15.4+ and the loaner Specs on Snap OS 5.64+.

1. **Open** `unneeded/Partsight/Partsight.esproj`. Lens Studio imports the `.obj` meshes automatically.
2. **Gateway token:** Window → Remote Service Gateway Token → generate one. Paste it into the scene's `RemoteServiceGatewayCredentials` object. Never commit the token.
3. **Experimental APIs:** Project Settings → enable Experimental APIs. The camera and internet must work together in one Lens, which is fine for an unpublished device push.
4. **Disable the sample's flow:** select the object that has `SceneController` and uncheck that component. Keep `DepthCache`, `ASRController`, and `SpeechUI` enabled; the mic button in `SpeechUI` now feeds Partsight's voice commands.
5. **Add Partsight:** create a SceneObject named `Partsight` and add three script components: `PartsightGemini`, `PartsightRenderer`, `PartsightController`.
   - **Renderer:**
     - `camera`: the scene's Camera object.
     - `solidMaterial`: `Assets/Materials/White.mat`, or any material with a Base Color.
     - `ghostMaterial`: optional; a duplicate of White with blend mode set to Normal or Premultiplied Alpha.
     - `labelPrefab`: `Assets/Prefabs/WorldLabel.prefab`.
     - Drag each `ps_*` mesh into the matching slot. Only `meshBox` is required; the others fall back to it.
   - **Controller:**
     - `camera`, `depthCache` (the DepthCache object), `gemini`, `renderer`, `asr` (the ASRController object).
     - Optional: `statusText`, `badgeLabel`, `infoText` (Text components, e.g. a head-locked panel).
     - Optional: SIK PinchButtons for Scan, Explode, Step, and Example. Drag each button's `Interactable` into `scanButton`, `explodeButton`, and so on.
6. **Preview check:** click in the Preview to "scan". Without a camera image it cycles through the Verified hero examples 45 cm ahead, which is enough to check rendering, labels, and explode (use the Explode button or the voice command).
7. **Device:** pair the Specs and push the Lens. The logger shows `[Partsight]` lines with timings.

## Controls

| Input | Effect |
| --- | --- |
| Scan button, or say "scan" / "what is this" | Capture, generate, measure, place. |
| Both hands pinching, pull apart / together | Explode / collapse (up to 2x). Twisting your hands rotates the diagram. |
| Pinch a part | Highlights it and speaks its function. |
| "explode", "explode more", "collapse" | Explode controls. |
| "zoom in", "zoom out", "real size" | Zoom; real size returns to 1:1. |
| "rotate" / "rotate left" | 45 degree turns. |
| "how does it work" / "next step" | Plays the next how-it-works step. |
| "show example" | Loads the next Verified hero. |
| Anything else | A question, answered only from the spec. |

## Device test checklist (do these first)

| # | Test | Pass | If it fails |
| --- | --- | --- | --- |
| 1 | Push the Lens; logs show `Pipeline OK — depth/color pairs are forming` within 5 s. | Pairs form | Check Experimental APIs and camera permission. The sample falls back to the right camera automatically. |
| 2 | Scan 6 tray objects. `spec response after X s` appears in the log. | Under 8 s each, valid diagrams | Switch `PartsightGemini.specModel` between flash and pro. Tighten the prompt in `PartSpec.ts`. |
| 3 | Scan a 30 cm box at 0.5, 1, and 2 m and read the badge (`… mm (measured)`). | Within 15% | Make the pinch-two-ends method the default (not built yet; see Next). |
| 4 | Load a hero, explode with two hands, pinch 3 parts. | Smooth, selectable | Raise the `minCm` collider size in the renderer; lower `explodeRangeCm`. |
| 5 | Ask "why does it click?" on the pen. | Spoken answer in under 5 s | Turn off `speakResponses` and read the text panel instead. |

## Known limits and next steps

- **Pinch-to-measure fallback** is not built yet. Depth-from-bounding-box is the only automatic scale. If test 3 fails, add it to `PartsightController.measure`.
- **Placement** puts the diagram's centre at the object's depth point and aligns the long axis with the measured direction. If it drifts, re-scan.
- **Leader lines** are thin boxes, and labels are sized for 0.5–1 m. Adjust `labelScale` as needed.
- **Hidden low-confidence parts** use the ghost material. Without one they are drawn at lower alpha with the solid material, which may look solid on some materials.
- **ElevenLabs** is not wired. TTS goes through the gateway's OpenAI `gpt-4o-mini-tts`.
- The safety gate, hero lookup, and validator are covered by unit tests. Everything else needs the device.

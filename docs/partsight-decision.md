# Decision: Partsight, a to-scale exploded view of everyday objects

November 14, 2026, ~3 AM. This replaces [pump-xray-decision.md](pump-xray-decision.md), which the user rejected because it covered only one object.

Five agents reviewed the generalized "explode anything" idea, and an independent judge then decided. The five were a critic, a part-aware 3D generation researcher, a Spectacles pipeline engineer, an advocate for diagrams built from simple shapes, and an advocate for realistic meshes. Capability claims are marked where they are not verified on the device yet.

> **Partsight:** Hold any everyday object and pinch. A to-scale exploded diagram slides out of it in your hand, with every part labeled, animated, and explained by voice.

## Is it a good idea?

**Yes, with conditions.** Taken literally ("any object, exact internals, AI-generated meshes"), it scores about 55. As a *typical-design* explainer it scores about 80, and 85+ if scale anchoring and the explode-out-of-the-object moment work on the device.

[Teardown](https://teardownai.app/) already turns a phone photo into a labeled 2D exploded view. It also already marks parts lists as "Sourced" or "Estimated". Partsight beats it only if all five of these hold:

1. The diagram is 3D and anchored to the real object.
2. With the diagram collapsed, its outline sits on the real object at true size. When it explodes, the parts slide out of the object you are holding.
3. Your hands control exploding and rotating.
4. You can ask questions by voice while holding the object.
5. Every part honestly shows **Typical design** or **Verified**.

Without the to-scale overlay, this is Teardown on worse hardware.

## Key findings

- **Real brand schematics are not available as 3D.** Parts sites have 2D diagrams only, and scraping them is a terms-of-service risk. A brand's parts *list* as text grounding is a Stretch goal.
- **No hosted service gives named, to-scale parts with their internals.**
  - Snap3D returns a single GLB with no parts.
  - [Meshy Auto Split](https://docs.meshy.ai/en/api/auto-split) and [Tripo SmartSegment](https://developers.tripo3d.ai/en/docs/mesh-smartsegment) take minutes and only cut up the outer surface. A pump's check valve will never appear.
  - Research models (PartCrafter, PartPacker, OmniPart) require self-hosting on a GPU.
- **What works:** a vision LLM writes a structured parts spec, and the Lens draws it from styled shapes. It is fast (about 3–8 s, estimated), every part is separate by design, it is to scale, and it is honest.
- **No laptop needed at runtime.** Snap's [Depth Cache sample](https://github.com/specs-devs/samples) already captures a frame on the glasses, sends it to Gemini through the Remote Service Gateway, gets back labeled bounding boxes, and projects them into 3D using depth. Building on it removes the Wi-Fi client-isolation risk and the Bluetooth risk.
- **Model upload speed doesn't matter.** The payload is a few KB of JSON, not a mesh.
- **ElevenLabs is not needed.** Remote audio loading exists (`loadResourceAsAudioTrackAsset`, format unverified), but the gateway's OpenAI TTS already works on the device. ElevenLabs is Stretch.

## Architecture

```
[Spectacles Lens, built on the Depth Cache sample]
 warm CaptureSession --pinch--> 1008 px still + cached depth
   --> Remote Service Gateway Gemini: {archetype, bbox, overall_mm, parts[], how_it_works[]}
   --> validator (clamp into bbox, nudge overlaps, drop bad part refs)
 bbox corners + depth -> DeviceCamera.unproject -> real length (pinch-two-ends fallback)
 PartFactory: pre-modeled beveled unit meshes scaled in metres, collider per part
 Spectacles Interaction Kit: manipulate root (rotate/zoom), slider + two-hand pull = explode, pinch = select part
 ASR question -> LLM grounded on the spec -> gateway TTS answer
[Laptop: Lens Studio, debug log, backup video only]
```

The parts spec has these fields:
- archetype (enum)
- `overall_mm`
- up to 12 parts, each with:
  - `shape` (enum: box, rbox, cylinder, tube, capsule, cone, torus, spring, gear, plate, ghost_shell)
  - `dims_mm`, `pos_mm`, `rot_deg`, `explode_mm`
  - colour and material (enums)
  - `function` (80 characters or fewer)
  - `confidence` and `hidden`
- `how_it_works` steps, each using one of the actions press, slide, rotate, compress, release, flow, glow

### Making it look designed, not like grey boxes

- Pre-modeled beveled unit meshes (cylinder, box, capsule, cone, spring, gear, threaded rod, ghost shell), sized by scaling.
- A toon palette with inverted-hull outlines.
- Numbered leader-line callouts in the style of IKEA instructions.
- A staggered, eased explode.
- Flow particles.

### Honesty and safety rules

1. Classify the archetype first, then generate parts only from that archetype's template.
2. Label everything **Typical design** unless it is a Verified hero object.
3. Draw hidden parts with confidence of 0.75 or lower as dashed ghosts marked "(likely)".
4. Show electronics at block level only (battery, board, switch).
5. Use at most 12 parts.
6. Voice answers may cite only parts in the spec. Otherwise the answer begins "I can't see that; a typical design has…".
7. Name a brand only if it can be read from visible text.
8. **Category gate:**
   - Phones and laptops, lithium-battery or mains-powered devices, medical devices, car parts, weapons, and pressurized containers show the exterior only, with "not safe to open".
   - Headphones, drills, and coffee machines render at block level, labeled "rough".

## Scope

| Priority | Work |
| --- | --- |
| **Must** | Pinch → capture → Gemini JSON → validator → styled renderer. Explode slider and two-hand pull. Rotate and zoom. Pinch a part for its label and a spoken blurb. Voice Q&A grounded in the spec. Ruler bar marked "measured" or "est.". To-scale ghost overlay. Three **Verified** hero specs written by hand (retractable pen, flashlight, pin-tumbler padlock), measured with a tape, bundled in the Lens. Loading sequence: bbox outline, then rough parts, then labels. Category safety gate. |
| **Next** | How-it-works step animations. A predict-then-reveal quiz ("which part makes the click?"). |
| **Stretch** | A Snap3D exterior shell that fades out as the object explodes. ElevenLabs voice, only if a remote MP3 loads in under 2 s. Brand parts-list grounding. |
| **Cut** | Live mesh segmentation, self-hosted models, laptop relay, phone or Bluetooth link, Orbis/Visko, schematic scraping. |

A hero may get one custom Blender part if it takes under 45 minutes, for example the pen's cam ring.

## Thirty-second demo

| Time | Beat |
| --- | --- |
| 0–5 s | "Pick anything off this tray." The judge hands over a pen. |
| 5–12 s | Pinch. A scanning outline appears: "Retractable pen, 142 mm, measured." The ghost snaps onto the real pen. |
| 12–20 s | The wearer pulls their hands apart. The spring, cam, refill, and barrel slide out, numbered. Pinching the cam gives: "This rotating cam alternates the lock positions." |
| 20–27 s | "Why does it click twice?" The spoken answer cites the cam and the spring. |
| 27–30 s | An unfamiliar tray item shows "Typical design" with a dashed hidden spring. End card: "Honest about what it can't see." |

**Judging table:**
- A tray of 8 tested objects: the 3 heroes plus a stapler, thermos, scissors, spray bottle, and bike pedal.
- A matte surface and good light.
- Two charged Specs, swapped about every 20 minutes (about 45 minutes of battery each).
- The backup video on the laptop.

## Plan

Roles: A = AI and spec, B = renderer and interaction, C = scale, voice, props, and demo.

| When | Work and gates |
| --- | --- |
| **Sat 3–5 AM** | Run the five integration tests in parallel (list below). |
| Sat 5–6 AM | C buys and measures the tray objects and writes the hero specs. A and B rest in shifts. |
| Sat 6 AM–12 PM | Build the end-to-end path: pinch → JSON → validator → shapes → explode. **Gate at 12 PM:** the pen works on the device. If not, cut back to the 3 heroes plus "typical" for named archetypes only. |
| Sat 12–6 PM | Labels and callouts, part select with TTS, voice Q&A, ruler and overlay, styling, safety gate. **6 PM feature freeze.** After that, Next items only, and only if all of Must works. |
| Sat 6 PM–1 AM | How-it-works animations, prompt tuning across all 8 tray objects, loading sequence. Sleep in staggered 3-hour shifts. |
| Sun 1–5 AM | Polish. Run each tray object 5 times, log failures, and patch the prompt and validator. |
| Sun 5–7 AM | Backup video, README, Devpost, rehearse the 30-second demo 10 times. |
| **Sun 7:30 AM** | Submit. Hard deadline 9 AM. |

The five integration tests, with their kill rules:
1. **Camera plus Gemini in one Lens.** Push the Depth Cache sample to the device and confirm the camera and the gateway's Gemini work together. *Kill rule:* if this still fails at 6 AM, the user names the object by voice or text instead, while the overlay and scale still come from pinching.
2. **JSON for the tray.** Gemini returns JSON that matches the schema for 6 tray objects, each in under 8 s.
3. **Sizing.** Measure a 30 cm box at 0.5, 1, and 2 m; it passes if each reading is within 15%. *Kill rule:* if it fails, pinching the two ends becomes the default scale method.
4. **Parts and interaction.** Spawn 12 shapes, each with a collider, pinch-select, and the explode slider.
5. **Voice round trip.** ASR → LLM → gateway TTS, plus loading one remote MP3.

**With 2 people:** merge C into A. Drop the how-it-works animations and the quiz. Keep only 2 heroes (pen and flashlight). Freeze features at 4 PM.

## Tracks

- **AI Horizons:** vision AI generates a structured, to-scale 3D teardown on the glasses in seconds, grounded and tagged with confidence.
- **Virtuous Reality:** hands-on mechanical literacy for any learner, using objects they already own.
- **ManageXR (sponsor):** the AI sees what you hold and teaches you how it works. It is glasses-native and repeatable.
- **Visko:** dropped. Orbis can't be central to this, and showing a live stream inside the Lens is unproven.

## Unverified until tested on the device

- Depth-based sizing accuracy.
- Gemini latency and JSON reliability.
- Camera and internet permissions working together in a pushed Lens.
- Whether the gateway TTS works on Spectacles.
- Remote audio formats.
- Two-hand manipulation settings.

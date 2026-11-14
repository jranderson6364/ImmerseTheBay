# Decision: Pump X-Ray (exploded view + Q&A, generated video cut)

> **Superseded** by [partsight-decision.md](partsight-decision.md). The user wanted a version that works for any object, not a single one.

November 14, 2026, ~2 AM. Result of a two-round adversarial review. Seven first-round panelists: a hardware auditor, an advocate for the original idea, a prosecutor, an Orbis-first advocate, a no-video coach advocate, a wildcard ideator, and a prize strategist. Three finalist champions wrote rebuttals, then an independent judge decided. Scores are judgment calls, not data.

## The idea under review

Look at a real object, see an exploded 3D view beside it, and ask questions or pick parts. Generated video (Orbis) animates the mechanism and goes deeper into whatever the wearer wants to learn.

## Verdict

**Build Pump X-Ray. Cut Orbis from the submission.**

> Pump a real floor pump and see your own stroke drive the piston, valve, and airflow inside it. The glasses spot why air is leaking and walk you through the fix until the ball bounces.

Why it won:

1. **Generated video can't show mechanisms accurately.** Orbis is a world generator: 640x368, 2–4 s prompt lag, no physics guarantees. Asked to show "air past a check valve", it would likely render something plausible but wrong. That clip would sit next to a correct model that judges can check against the real pump. The repo's own [place-stories rule](place-stories-concept.md) already says not to use generated video for mechanisms that must be correct.
2. **Visko can't be won this way.** Visko requires Orbis to be "the heart" of the experience. Once authored geometry carries the truth, Orbis becomes a captioned side panel, which is a garnish by construction. Visko also penalizes wasteful credit use. Even the Orbis-first champion conceded.
3. **Animation driven by the wearer's own stroke does what the video was meant to do, better.** Generated video can't sync to your hand. This, together with a live diagnosis and a real fix, also answers the "just another exploded-view app" critique (JigSpace, Teardown, and CurioCity and Zappatory Labs in Snap's showcase).
4. **Feasibility.** The hardware auditor rated authored exploded view + part pick + grounded LLM GREEN (10–14 h). Showing Orbis live inside the Lens has no official path and was rated YELLOW-RED (+8–12 h).

What was rejected, and why:

- **F2: core + a time-limited Orbis portal.** Scores ranged from 68 to 86. The gate would have protected the core, but the upside fails the "heart" test.
- **F3: an Orbis-first "Inside Out" voyage.** It has no real task, ManageXR fit is about zero, and it rests on the riskiest display path.
- **A separate Visko-only entry, an Orbis "what if" beat, or an "imagine inside" intro.** These double the work, are still a garnish, or waste seconds of the 30 s video.
- **Open-ended "explain anything" and Snap3D on the fly.** Snap3D returns a single mesh with no parts in 20–60 s, so an exploded view is impossible.

One thing should be said plainly: **the literal request for generated mechanism video is not met.** What it was for (animation that teaches the mechanism) is met by authored, hand-driven animation. Orbis stays a post-hackathon idea. One verified fact for later: `scripts/test_orbis_cottage.py` does receive RGB frames in Python via `on_frame`, so the laptop side of a relay works.

## Scope

| Priority | Work |
| --- | --- |
| **Must** | Authored exploded pump with about 6 parts as pinchable child meshes. SIK hand keypoints drive the virtual piston with the real stroke. Authored airflow particles: red leak at the head, green when sealed. Camera still → Remote Service Gateway Gemini, limited to authored part IDs and failure states → highlight the part plus one fix instruction. Physical before/after: flat ball, then it bounces. |
| **Next** | One predict beat ("pinch where you think air escapes" before the reveal, about 1 h). TTS reads the fix. |
| **Stretch** | A second object-pack stub to prove repeat usefulness for ManageXR. ASR "why?" questions, with a pinch fallback. |
| **Cut** | Orbis/Visko, Snap3D, free-form "explain anything", spoken grading, score card, failure tree, WebView. |

## Thirty-second demo

Vertical video, captured with the temple button, plus phone B-roll.

| Time | Beat |
| --- | --- |
| 0–4 s | Flat basketball. "Pump isn't working?" |
| 4–9 s | The wearer looks at the pump and pinches. Gemini returns "Pump head not sealed", and the exploded view appears. |
| 9–16 s | The wearer pumps. The virtual piston follows the hand, and red particles leak at the head. |
| 16–20 s | Predict beat: pinch where you think air escapes. The X-ray confirms it. |
| 20–25 s | "Push the head down, flip the lever." The particles turn green. |
| 25–30 s | The ball bounces. End card: "Pump X-Ray: see how it works while you fix it." |

## Plan (3 people)

Roles: **A** Lens core, **B** hands and particles, **C** AI, assets, and submission.

| When | Work and gates |
| --- | --- |
| Sat 2–4 AM | All three: deploy a blank Lens to the Spectacles. Get a floor pump and ball. **Gate:** a Lens runs on the device by 4 AM; otherwise everyone debugs pairing only. |
| Sat 4–9 AM | Sleep. C wakes at 8 AM and sets up the pump model and part-ID list. |
| Sat 9 AM–2 PM | A: explode view and per-part pinch. B: hand-to-piston sync. C: camera still → Gemini on the device. **Gate at 1 PM:** Gemini returns a valid part ID on the device; otherwise fall back to a pinch-selected symptom menu. Never spend more than 2 h on one API. |
| Sat 2–6 PM | B: particles and leak/seal state. A: integration and fix flow. C: TTS, predict beat, and the MIT repo. **6 PM:** freeze features. If the loop doesn't run end to end, cut Next. |
| Sat 6–11 PM | Polish, device test runs, rough video. |
| Sat 11 PM–5 AM | Sleep in shifts, at least 5 h each. |
| Sun 5–8 AM | Final takes, edit, Devpost. **Gate at 7:30 AM:** everything uploaded. |
| Sun 8–9 AM | Buffer. Submit by 8:30 AM. |

With 2 people: split C's work, cut the predict beat and TTS, and timebox Gemini to 1.5 h before switching to the symptom menu.

## Tracks

- **AI Horizons:** vision AI grounded to a real object's parts diagnoses a live failure while your hand drives the mechanism.
- **Virtuous Reality:** repair literacy, so people understand and fix things instead of replacing them.
- **ManageXR (sponsor):** glasses-native. The AI sees your pump and responds while you work, and object packs make it reusable.

## Risks and first device checks

1. Camera access is blocked in Lenses that use the internet. Enable Experimental APIs (push the Lens to the device unpublished); fall back to the symptom menu.
2. Hand tracking loses the pumping hand. Smooth the keypoints, map the piston from wrist height, and pump slowly on camera.
3. Gemini is slow or returns wrong IDs. Use JSON output limited to authored IDs, a "scanning" animation, and a pinch override.
4. The battery lasts about 45 min. Bring USB-C power.
5. The placed model drifts. Place it by pinching on the pump, and keep a re-place gesture.

Verify on device first:

1. Snap OS and Lens Studio versions, and that a Lens deploys.
2. Camera still plus a Remote Service Gateway Gemini call working together in one Lens.
3. Stable hand keypoints during a real pumping stroke at arm's length.

## New ideas from the review worth keeping

- **Predict-Then-X-Ray:** guess what's inside before the reveal. One beat is folded into the plan above.
- **Misconception Detective:** say how you think the object works, and the AI shows where your mental model breaks.
- **Scale Dive:** each "why?" zooms one scale deeper.
- **Make It Break:** a failure-mode simulator.
- **Inside Out (Orbis):** start a live world from a camera still of your object and steer a voyage inside it. This is the best idea if a future event is built around Visko.

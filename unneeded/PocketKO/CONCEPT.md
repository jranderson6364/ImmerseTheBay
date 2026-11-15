# Pocket KO: your junk is your arsenal

November 14, 2026, Saturday morning. This builds on the user's direction: everyday items become useful in a game, plus over-the-top generated KO animations, the dumb bowling-alley-screen kind.

> A monster crash-lands on your table. Your only weapons are whatever's in your pockets. The AI turns each object into a move. You physically swing, slam, or poke with the real thing. The final blow gets a ridiculous AI-generated KO cinematic starring your actual banana.

## Core loop (one round is about 60–90 s)

1. **Monster drop.** A cartoon monster lands on the real table with screen shake and a TTS announcer.
2. **Arm up.** Grab any real object and hold it up. The camera snaps it, and Gemini invents a move with:
   - a name ("Potassium Slam")
   - damage (clamped 10–40)
   - an effect (stun, burn, slip, multi-hit)
   - **the gesture that triggers it:** slam, swing, poke, or flick
   - a one-line hype call that the announcer reads out
3. **Attack with the real thing.** Hand tracking watches the hand holding the object. A wrist-velocity spike in the move's gesture direction, aimed at the monster, lands the hit. Damage numbers pop, the monster recoils, and the effect plays on the monster.
4. **Variety bonus.** Repeating an object weakens it; a new object gets a combo multiplier. That pushes players to raid the room for random stuff.
5. **Finisher.** At low HP the announcer calls "FINAL BLOW." The next hit triggers the **generated KO cinematic**:
   - The camera still of *your* table and object seeds Orbis (`set_image`).
   - The prompt is built from Gemini's move, e.g. "a giant banana slams the monster flat, bowling-alley strike animation, confetti, slow motion."
   - The wearer **steers it live** by voice ("more explosions", "slow-mo", "zoom out"), using `set_prompt` while it streams.
   - It plays on a **jumbotron** above the table: a portal in-lens if the relay works, and always on a laptop screen for the crowd.
6. **Fight card.** A results card shows the MVP object, moves used, and damage. Stretch: an Imagen "fight poster" starring the object.

## Why glasses, not a phone

- Both hands hold and swing real objects, and **your real hand motion with the real object is the controller**.
- The monster and the effects live on your real table around real objects; you walk around it and lean in.
- On a phone, one hand holds the screen and the game shrinks to a 6-inch window, so it's a worse game, not a convenience loss.

## Prior art checked

| Thing | What it does | Gap |
| --- | --- | --- |
| [RealityGuard](https://www.realityguardar.com/) | Tower defense on your tables/floors (phone and MR) | Real objects aren't recognized or turned into moves |
| [LensLab (Devpost)](https://devpost.com/software/lenslab) | Spectacles + Gemini + Snap3D recreates what you look at | No game, no object-as-weapon |
| [Peridot Beyond](https://voicesofvr.com/1454-niantic-launches-virtual-pet-ar-game-peridot-beyond-on-snaps-spectacles/) | Spectacles pets react to real objects | Not a game where objects gain powers |

**Not found:** AI-invented moves from arbitrary real objects, triggered by physically swinging them, plus a live generated finisher seeded from the real scene.

## Tracks

| Track | Pitch |
| --- | --- |
| **Game Changer** (main) | Fun and engagement: every round is different because every room and every pocket is different. Judges play with their own stuff. |
| **AI Horizons** (main) | AI turns arbitrary physical objects into balanced game mechanics, including the gesture, and generates a live world-model cinematic conditioned on your real scene. |
| **Visko Living Worlds** (sponsor) | Orbis streams the finisher live, seeded from the real table, and the player steers it by voice. Storytelling or interactivity category. |
| Creative Zenith | Alternative main track if the craft lands better than the AI depth. |

Visko's honest risk: Orbis is the climax, not the whole experience. The pitch is that the KO cinematic is the payoff every round builds toward. If the in-lens relay fails, the laptop jumbotron still streams live and steerable, but judges may count it as less "in XR".

## Build plan (3 people, about 20 hours)

| Owner | Work |
| --- | --- |
| **A: game core (Lens)** | Monster model and animation (hit flash, squash, recoil, KO pose), HP and damage numbers, round state, variety combo, results card. |
| **B: objects and hands (Lens)** | Capture → Gemini move JSON with a validator that clamps stats and enum-checks the gesture (reuses the Partsight validator pattern), effects attached to the hand keypoint, wrist-velocity gesture detection. |
| **C: finisher (laptop + Lens)** | Python Orbis server (extends `unneeded/scripts/test_orbis_cottage.py`): WebSocket from the Lens with object name + camera still → `set_image` + prompt → stream. Laptop jumbotron window first, then a JPEG-over-wss relay to an in-lens portal (spike). Voice steering → `set_prompt`. |

**Gates**

- **By Sat 1 PM:** Orbis seeded with a phone photo of a banana on a table produces a funny KO clip (test on the laptop). If it looks bad, change the prompt style or use Imagen stills as a comic-panel finisher.
- **By Sat 3 PM:** the in-lens relay shows at least 3 fps, or it's jumbotron-only, with no more relay work.
- **By Sat 6 PM:** a full round plays on device. Freeze features.
- **Overnight:** tune Gemini prompts on 20 random objects, record the video, write the Devpost.

**Reuse from Partsight:** the Depth Cache base project, the Gemini client pattern, TTS, the validator pattern and tests, and the preview tooling.

## Risks and answers

- **It's button-mashing.** The gesture is dictated by the object's move, so you have to read the move, the variety bonus forces you to switch, and the effects (stun, slip) change timing.
- **Gemini makes boring or broken moves.** Use a fixed enum of gestures and effects, clamp damage, and give the prompt a "funny but fair" style guide. A hand-written fallback move covers unknown objects.
- **Latency.** Gemini takes about 3–5 s per object (masked by an "analyzing your weapon…" bit from the announcer). Orbis's first frames take a few seconds, so start the session when the monster is at low HP, not at the finisher.
- **Orbis credits and session cap.** One short session per finisher; no idle sessions (Visko disqualifies waste).
- **Hand tracking while holding objects.** Holding something can occlude fingers, so detect the gesture from wrist motion, not finger pose. Test on device first.
- **Copyright.** An original monster and announcer. No existing fighting-game catchphrases, characters, or bowling-chain animations.

## Thirty-second demo

| Time | Beat |
| --- | --- |
| 0–4 s | A monster crash-lands on the judge's table. Announcer: "Grab a weapon!" |
| 4–10 s | The judge grabs their keys: "KEY JAB! Poke to strike!" Poke, and a hit lands with the damage number. |
| 10–16 s | Their phone: "NOTIFICATION BARRAGE! Flick!" Flick, multi-hit, combo x2. |
| 16–22 s | Our banana: "FINAL BLOW!" Slam. |
| 22–30 s | The jumbotron plays a generated clip of a giant banana flattening the monster on that exact table. The judge yells "slow-mo!" and it slows. "K.O.!" |

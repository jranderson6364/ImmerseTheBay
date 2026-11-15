# Retrospecs: multi-agent analysis results

November 14, 2026.
- **Agents:** 8 in total. Five critics read [retrospecs-concept.md](retrospecs-concept.md) through separate lenses: prior art, Spectacles feasibility, a simulated judging panel, demo/video, and experience design. One evolver wrote 3 variants. Two judges with different priorities scored all candidates.
- **Rubric:** the same as the earlier idea runs. Wow ×2; fun, glasses, impact, feasibility and novelty ×1.5; AI ×1. Maximum 105.
- **Caveat:** prior-art and API claims come from agents and have not been re-checked.

> **Superseded in part (Nov 14):** the team moved away from a history focus. The time scrub and 1906 quake are dropped. Point-to-guess, the surveyed registration method, ask-the-map and pre-rendered voice carried forward into the [tour-guide concept](retrospecs-concept.md).

## Leaderboard

| Candidate | Judge 1 (feasibility and novelty) | Judge 2 (video and basement wow) | Average |
| --- | --- | --- | --- |
| **B. Retrospecs 1906:** time scrub, quake, lift-out | 60.5 | **67** | **63.75** |
| **C. Ask the Map:** AI answers in space across all buildings | **63.5** | 63.5 | 63.5 |
| A. Steady: one rig, five buildings, all beats ship | 58 | 59.5 | 58.75 |
| Original concept (current doc) | 50 | 52 | 51 |

The critics scored the original between 51 and 63.5. **The original ranks below every entry on the team's run-1 leaderboard.** All three variants beat it.

## What every critic agreed on

1. **The basement kills the outdoor payoffs.**
   - The ghost spire on the real church, look-to-ask at real buildings, and look down then up at Hoover can't happen at the judging table.
   - The table demo has to be a complete experience built around the map, not a fallback.
2. **GPS plus compass cannot land the spire on Memorial Church.**
   - From the Main Quad (about 60–100 m away), a 20 m position error is 11–18° of bearing. Compass drift adds to that.
   - The fix: **one registration method everywhere**. A surveyed origin (a taped spot), plus yaw from one World Query pinch on a wall, using the hit normal against that wall's OSM bearing.
   - Use it in the basement and at a taped spot on the Quad for the video. Say so in the caption ("hand-surveyed at this spot").
   - Live GPS stays as a debug overlay only.
3. **The 2.5 m map at 1:650 is too small to read.** Memorial Church comes out about 4 cm tall, so "the mini spire falls" is invisible.
   - Keep the floor map for the opening, at about 1.5 m and 1:1350.
   - Then pinch to lift it to table height.
   - When a building is selected, **lift it out** to chest height at 30–40 cm.
4. **The AI is a chatbot as written.** Reordering whitelisted facts for one building reads as "AR tour guide #51" to an AI Horizons judge.
   - The fix: make the AI a **spatial query engine across all the cards**. "Show me everything the 1906 quake touched" lights a set of buildings, with threads between them.
   - Run a validator, and show it in an overlay that rejects made-up IDs on screen.
5. **Cut the live ElevenLabs relay.**
   - Pre-render every sourced fact offline in the ElevenLabs voice and ship the clips as Lens assets: no key on the device, no network hop.
   - Live AI only chooses which clips and beats to play.
   - Declines use Gateway TTS as a quieter "aside" voice.
6. **Cut the scope.**
   - Buildings: 3–5 (Huang, Hoover, Memorial Church, the museum/Cantor, and the HP garage as an edge pointer).
   - Beats: 3.
   - Single-shot function call: one call returns `lights[], threads[], fact_ids[], connective`. No multi-turn tool loop.

## Prior art the critics found (beyond ECHOES and TimeLens)

- **Booster's JetPack Tours.** A Spectacles Lensathon 2025 entry that recognizes monuments and answers "tell me more" with audio. Same device, same core loop.
- **The Time Dial** (MIT Reality Hack 2026, on Spectacles). Then-and-now history on site.
- **Android XR's look-down map.** Google's prototype shows a map when you tilt your head down. A flat map is not new. Ours is distinct only as **3D, north-aligned and beamed to the real buildings**.
- **Immerse the Bay 2025 entries** "Are we there yet?!" (AR navigation plus place stories) and "Portals" (heritage). Returning judges may have seen this category.
- **StanX** (CS147, 2017). Earlier Stanford AR campus stories.
- **No prior art found for these three:**
  - a time scrub on a world-registered floor map,
  - point-to-guess direction scoring,
  - LLM-chosen spatial beats driving the map and the real building together.

  **Pitch those, and name ECHOES and Android XR yourself.**

## Recommended direction: B's spine, C's brain, A's safety net

Both judges' picks converge on this combination:

1. **Opening:** a 3D Stanford unfolds on the floor around you, with you as the dot inside Huang.
   - In the basement, one beam runs up through the ceiling to the Terman Library, which is inside Huang.
   - One beam runs through the wall to Hoover at 93°. The judge checks it against a north-up printed map on the table. A phone compass is unreliable in a steel building.
2. **Time scrub (hero mechanic):** twist your wrist to move from 1885 to today, and campus builds itself.
   - Only sourced landmarks carry dates: Mausoleum 1889, Quad 1891, museum 1894, MemChu 1903, Hoover 1941, Huang 2010.
   - Other OSM buildings fade in as "today", labeled approximate.
3. **1906:** the map shakes. Only the sourced damage falls: MemChu's spire and clock tower, and the museum. One authored narration plays.
4. **Lift-out:** pinch Memorial Church and it rises to chest height. The narrator tells its story, framed by your chip (Founder or History), and the spire falls on the model with dust and a thud.
5. **Ask the map (the AI):** an open question gets one validated function call. The map lights the answer set, threads draw between buildings, the pre-rendered fact clips play, and a short connecting line ties them together. The validator overlay is on.
6. **Something new: point to guess.** "Point to where you think the HP garage is." The true thread arcs out, with "off by 14°". Then one new sourced fact unlocks. This uses your body in a real room, which a phone or a VR headset can't score.
7. **Video:** the outdoor shot is a **bonus, not a dependency**. Shoot the spire falling on the real MemChu from the taped Quad spot at civil twilight: about 4:40–5:15 PM today, or 6:20–6:55 AM Sunday as backup. Agents estimated sunset at about 4:55 PM; check it. Everything else is filmable indoors.

**Cut order, decided at hour 8:**
- **Must:** floor unfold, then Memorial Church lift-out with the spire fall.
- **Then:** scrub with a simple topple quake.
- **Then:** single-shot "ask the map" for one question type.
- **Then:** one point-to-guess target.
- **Dropped:** walking/follow mode, timeline ribbon, connect beams, live ElevenLabs, camera vision unless proven on device by hour 2–4, and Visko.

## Hour budget (feasibility critic plus variant A)

| Work | Hours |
| --- | --- |
| OSM bake script: one merged background mesh plus separate landmark meshes, under 30k triangles | 3 |
| Floor placement, lift, wall-pinch registration | 2.5 |
| Head-ray pick | 1 |
| Cards and sourcing (parallel) | 2 |
| ElevenLabs pre-render script (parallel) | 1.5 |
| Gateway function plus validator (port from Partsight) | 2.5 |
| Scrub, quake, lift-out, spire | 3–5 |
| Point-to-guess | 1 |
| Outdoor shoot plus edit | 3 |

**The single loaner device is the bottleneck.** Book a device slot for each lane every 2 hours, and test in the editor in between.

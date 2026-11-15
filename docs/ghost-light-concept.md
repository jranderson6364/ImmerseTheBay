# Ghost Light: an on-book rehearsal partner for actors

November 14, 2026. This came out of a rapid pitch-and-kill round; the rejected pitches are listed at the end. *Ghost light* is the lamp theatres leave burning on an empty stage overnight.

## The problem

In early rehearsals actors are **"on book"**: they block scenes (learn where to move) while holding the script. That means:
- one or both hands are taken, so they can't handle props;
- their eyes are down, so they can't make eye contact;
- they keep losing their place on the page.

Directors want actors **off book** fast. Between rehearsals, actors drill lines alone with phone apps (Scriptation, coldRead, LineLearner). Those apps keep you seated and staring at a screen, which is exactly what blocking practice is not.

Prior art found:
- VR remote-rehearsal research ([Stage Together](https://dl.acm.org/doi/10.1145/3537972.3537977), [UCL mixed-reality acting](https://reality.cs.ucl.ac.uk/projects/beaming/actingInMR.pdf), [Virtual Rehearsal Suite](https://dl.acm.org/doi/fullHtml/10.1145/3573381.3596158)). The last one notes that performers keep taking the headset off to read the script.
- AR *for audiences* ([WashU](https://artsci.washu.edu/ampersand/theater-augmented-reality-technology-bridges-audience-and-stage), [CMU TheatAR](https://www.cmu.edu/news/stories/archives/2018/december/theatAR-project.html)).
- Phone teleprompter apps ([Scriptation's list](https://scriptation.com/blog/best-apps-for-actors/)).
- Teleprompter text on Even G1 glasses.

**No search turned up an AR-glasses rehearsal partner that follows the script, prompts only when you stall, and marks blocking on the floor.**

## Why glasses, and not a phone or a fixed screen

- **Hands busy:** props, gestures, a scene partner.
- **Moving through space:** you cross the stage, so no fixed screen can follow you.
- **Eyes up:** eye contact with your partner is the point of rehearsal.
- **Tied to the floor:** blocking marks live at specific spots on the stage.
- **Implicit input:** your own voice drives everything. Speech recognition follows where you are in the script, hears your scene partner's cue lines, and notices when you stall. You never press anything.

## The experience

1. **Load a scene** (pasted text, two or three characters). Pick your role.
2. **Director pass (optional):** someone wearing the glasses walks the blocking and says "mark" at each spot. That saves a floor mark tied to the current line.
3. **Rehearse:**
   - A glowing **spike mark** sits on the floor where you need to be next.
   - Your partner's lines are heard and the script advances automatically.
   - On your line, **nothing is shown**, because the goal is off book. If you stall for about 2.5 s, the first two words fade in, then the full line, the way a real stage prompter works.
   - If you leave your mark, an edge arrow points back to it.
4. **Notes after the scene:** "3 prompts, 2 paraphrases (you said *'I never wanted this'*, the script says *'I never asked for this'*), missed the cross on line 7." Gemini grades paraphrase versus meaning, and the report suggests which lines to drill.

## Tracks

| Track | Fit |
| --- | --- |
| **Creative Zenith** | Artistry and craft: a tool for performers. |
| **AI Horizons** | Live script alignment over streaming speech recognition, telling partner cues from your own lines, Gemini paraphrase grading. |
| **ManageXR (sponsor)** | Glasses-native, the AI hears and sees what you do, a real task, repeat use every rehearsal. |
| Visko | Skip. An optional "living set" backdrop isn't worth the risk. |

## Critique (and answers)

- **"It's just a teleprompter in glasses."** A teleprompter shows the text constantly. Ghost Light deliberately hides it and prompts only on a stall. It also handles blocking marks and gives notes afterwards. It's a memorization trainer, not a reading aid.
- **"The market is tiny."** School drama, community theatre, college productions, improv and speech teams, plus anyone memorizing a talk. The pitch is a vivid niche, not a TAM slide.
- **Speech recognition will mishear lines.** The script follows by fuzzy matching on a rolling window, not exact text. Paraphrase grading runs only at the end, so recognition errors don't break the scene in real time.
- **Telling the partner's voice from yours:** there's no speaker separation. Alignment fixes this, because the script says whose line comes next. If a stretch matches the partner's line, it's theirs.
- **Floor marks drift:** marks only need roughly 20 cm accuracy, and Spectacles world tracking handles that easily.
- **Battery (about 45 min):** a scene run is 2 to 10 minutes. Fine.

## Spectacles feasibility (about 20 hours)

- Speech recognition with streaming partial results (verified in the Depth Cache sample's `ASRController`).
- World-anchored floor marks: the device's world position, plus World Query or a fixed height offset.
- Text near your eye line, head-locked and low.
- RSG Gemini for the notes.
- **The script follower is pure TypeScript and unit-testable**, like Partsight's validator.
- Reuses the Partsight base project (gateway, speech recognition, TTS, project setup). The Partsight-specific renderer isn't needed.

## Thirty-second demo

| Time | Beat |
| --- | --- |
| 0–4 s | A judge holds a cue card and reads the partner's line. |
| 4–10 s | The wearer walks to the glowing mark and delivers their line, eyes up. |
| 10–16 s | They blank. After 2.5 s, "*I never…*" fades in, and they finish. |
| 16–24 s | The judge's next cue triggers a new mark across the "stage". The wearer crosses and nails it. |
| 24–30 s | Notes card: "1 prompt, 1 paraphrase, blocking 3/3." |

Judging table: tape a 2 m "stage" on the floor, use a two-character scene that is public domain or written by the team, and let the judge play the scene partner.

## Widening it: performers who move from memory

User feedback: theater alone isn't widespread enough. The core mechanic generalizes to **anyone who must perform from memory while moving, with hands and eyes busy**:

| Group | What they memorize | Today's tools | AR glasses version found? |
| --- | --- | --- | --- |
| Dance teams, studios, K-pop / TikTok crews, cheer, show choir | Formations, spots, counts | Phone formation apps with "follow my dot" ([Sway](https://swayformations.com/), [Stancz](https://stancz.com/en), [Choreoto](https://choreoto.com/)); printed spike sheets ([DanceTeacherWeb](https://www.danceteacherweb.com/free-formation-and-spacing-tool-for-dance-teachers-and-choreographers/)) | **None found** |
| Marching band, drumline, color guard (indoor winter guard) | Drill "dots" per set, counts, step size | Phone/tablet drill readers ([UDBapp](https://www.ultimatedrillbook.com/), [BandDrills](https://banddrills.com/), [Drillbook Next](https://apps.apple.com/us/app/drillbook-next-reader/id795739546), [OpenMarch](https://openmarch.com/)) | **None found** |
| Actors | Blocking + lines | Script apps | None found (above) |
| Musicians memorizing a solo | Notes, lyrics | Sheet music on glasses shown on a timer ([AugmentedChords, a Mentra hackathon project](https://github.com/kevinlinxc/AugmentedChords); [HN demo](https://news.ycombinator.com/item?id=43876243)); falling notes on keyboards (PianoVision, Quest) | Score display yes; **a memory mode that listens and only prompts when you stall: not found** |

### Formation mode (recommended core)

**Ghost Light: Formations.**
- You see **your own ghost** walking your path on the beat, plus a glowing spot where you must land on count 8.
- Your real position against the ghost is scored live: "half a step behind", "on spot".
- **AI in the loop:** point the glasses at a printed dot sheet or a formation chart, and Gemini turns it into your path. The same can be done by recording a choreographer walking it.

Why glasses:
- Your body is moving and your hands are full (instrument, flag, partner).
- Your eyes must stay up.
- The spot lives on the floor.
- Your position is the input.

### Honest hardware notes

- **Outdoor marching** has two problems. Bright sun washes out an additive display, and tracking over a 100-yard field is unproven. So lead with **indoor** groups (dance studios, theater, winter guard and indoor drumline, which perform on gym floors) and keep football fields as future work.
- Spectacles indoor tracking is plenty for roughly 15 cm "on spot" scoring.

### Musicians, specifically

**Already done:**
- sheet music on glasses (timer or pedal page turns)
- falling notes onto a real keyboard
- chord charts
- metronome HUDs

**Not found:**
- A **memory-mode prompter**. It listens through the mic, follows your place in the piece, shows nothing, and fades in only the next bar when you stall or miss notes. For vocalists it can follow lyrics with speech recognition. Instruments need on-device pitch tracking (YIN on mic PCM); that works for monophonic instruments and voice, and is risky for piano chords.
- **Drill for marching musicians** (Formation mode above).

## Rejected pitches (kill reasons)

| Pitch | Killed because |
| --- | --- |
| CPR coach | Already done: Laerdal QCPR feedback, HoloLens CPR research. |
| Parkinson's gait cues | Strolll already does exactly this. |
| Tracing and drawing guides | Phone tracing apps plus Quest/Vision Pro tracing; Spectacles drift ruins millimetre lines. |
| Climbing route beta | Projector climbing walls and research exist; you can't demo it at a table. |
| Rubik's cube solver arrows | Phone and HoloLens solvers exist; tracking a turning cube is beyond cloud latency. |
| ASL coach on your own hand | ASL VR apps and research exist. |
| First-person ghost hands (knots, tricks) | VR motor-learning research; a weak track fit. |
| Pipetting well tracker | Light-box plates and Gilson TRACKMAN solve it better. |
| Per-pan cooking timers | Cooking AR is crowded. |
| Chess or board-game overlays | AR chess is everywhere. |
| PT exercise rep counter | Kemtai, XRHealth. |
| Pour-line bartending | Trivial; drift. |

# Sightlines pitch

Working pitch for the November 15, 2026 Immerse the Bay table judging and 30-second vertical submission video. The Lens is coded, but scene wiring, Preview, and Spectacles behavior are still awaiting verification. Record and say only the beats that actually work on the device.

## The idea in one line

**Sightlines turns Stanford into a tour you can see and steer: a campus map unfolds around you, answers light up the places they describe, and your next discovery begins by pointing into the real world.**

Short title card: **Sightlines — a campus tour you can see.**

## The story to tell

The campus is full of stories hidden behind familiar names. Standing in Huang, you can be steps from the building named for NVIDIA co-founder Jensen Huang and still miss the connection. Sightlines puts a north-aligned 3D Stanford map at your feet. Select a building to hear a sourced fact; ask a question spanning buildings and the answer becomes a pattern of light on the map. Then point toward the next place and see how close your guess was. The real direction is the reveal.

The distinct moment is **point to guess**. It turns a passive tour into a physical game and makes the map's alignment visible. Lead with that moment in the video and let a judge try it at the table.

## 30-second vertical video: shot and voice draft

Shoot one clean interaction at a surveyed spot. Use actual Lens capture for the AR view and a phone shot for the person's gesture. Keep the audio understandable without voiceover by using short captions. Never replace a failed live response with a mock overlay without labeling it as a prototype visualization.

| Time | Picture | Spoken line or caption |
| --- | --- | --- |
| 0–3 s | Wearer outside Huang; plain campus view. | **“Which way is Gates?”** |
| 3–8 s | Lens capture: the 3D map unfolds with Huang marked “you are here.” | **“Meet Sightlines.”** |
| 8–14 s | Mini Huang lights up; one short sourced fact. | **“This is named for NVIDIA co-founder Jensen Huang.”** |
| 14–22 s | Guide prompts for Gates; phone shot of wearer pointing; cut to Lens capture of guess arc, true arc, and degree score. | **“Point where you think Gates is.”** / **“Off by [actual score]°.”** |
| 22–27 s | Ask about tech founders; multiple buildings light up if the live query works. Otherwise use a second building selection. | **“Ask a question. See the answer across campus.”** |
| 27–30 s | Best frame of wearer and map; title. | **“Sightlines. A campus tour you can see.”** |

**Edit rule:** favor a legible map and one convincing point-and-reveal over fast cuts through every feature. Show the actual score from the recording. If no outdoor registration is verified, film the table-height map indoors and say “a 3D tour of Stanford,” without claiming the view aligns to outdoor buildings.

## Table pitch and live demo: about two minutes

**Opening, 15 seconds:** “We walk past these buildings every day, but their stories are invisible. We built Sightlines for Spectacles: a Stanford tour guide that places a 3D map around you and turns questions into places you can see.”

**Map and fact, 35 seconds:** Put on the glasses at the surveyed spot and reveal the map. “We are in Huang. When I select it, the building lights up and the guide tells me a sourced fact: it is named for Jensen and Lori Huang, and Jensen co-founded NVIDIA.” Let the judge see the highlight and hear or read the fact. If voice is unavailable, read the fact aloud and identify that as the demo fallback.

**Hero interaction, 40 seconds:** “Now it asks where Gates is. Point where you think it is.” Let the judge or wearer point and pinch. Pause for the guess arc, true direction, and actual score. “That direction is based on our surveyed campus map. The quiz teaches where the next story lives.”

**Question across places, 20 seconds:** If the live query works, ask “Which buildings are named after tech founders?” Show the answer lighting several buildings. “The AI chooses places and verified facts; the map shows the relationship.” If it does not work, select a second building and say “The cross-campus question is still being tested,” then move to the close.

**Close, 10 seconds:** “Sightlines makes a tour spatial and interactive. You look, ask, and point instead of reading a list of landmarks.” Invite one judge question or one quick point-to-guess turn.

For repeat judges, reset the tour and start from the same calibrated position. Keep the video queued as a fallback. The required submission is a 30-second vertical video, public MIT repository, and Devpost entry by Sunday 9 AM; the event materials specify table judging, not a stage pitch.

## Answers for likely judge questions

| Question | Direct answer |
| --- | --- |
| Why glasses? | The map relates to where you stand and face. Looking and pointing are the controls, and the reveal is a real direction, so the wearer can keep looking at campus. |
| Where does the AI fit? | The live guide is designed to choose a set of buildings and fact IDs for a question, then the app validates those IDs against sourced cards before lighting the map. The offline founder answer is a fallback, not proof of a live AI response. |
| How accurate is the alignment? | This prototype uses a surveyed starting location and wall-based heading calibration, then allows a manual yaw correction. It does not provide continuous GPS walking registration. Quote a measured error only after testing it on device. |
| Where do facts come from? | The shipped cards carry source URLs, mainly Stanford pages. The guide is constrained to those cards; it should say when coverage is missing. |
| What is built now? | The Lens code, campus geometry, cards, guide, and point-to-guess logic are present and unit-tested. Scene wiring, Preview, and device behavior must be confirmed before making a live-demo claim. |
| What would come next? | More campus coverage, smoother registration while walking, and a source handoff for visitors who want to read more. |

## Claim check before recording or judging

- [ ] Map visibly renders and remains readable in Lens Studio Preview and on the original Spectacles.
- [ ] On-device calibration and table/floor placement work at the chosen spot.
- [ ] Building selection shows the correct highlight and a sourced fact; identify whether audio is live TTS or a spoken demo fallback.
- [ ] Point-to-guess shows both arcs and a correct degree score from the actual gesture.
- [ ] A live cross-building question returns valid building IDs on device before calling it an AI demo.
- [ ] The video is vertical, at most 30 seconds, and its overlays match recorded behavior.

Until these pass, use the pitch as a script draft, not as evidence that the full experience runs on hardware.

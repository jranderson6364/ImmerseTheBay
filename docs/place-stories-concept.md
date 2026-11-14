# Place Stories: a source-grounded living place guide

Exploration note, November 13, 2026. Candidate concept for the assigned Snap Spectacles; no implementation or device feasibility is established yet.

## Pitch

Look at a landmark, ask a question, and enter a short, steerable visual explanation of one documented aspect of that place. The live scene is an interpretation; concise facts and citations stay in a separate, verified layer.

**Example:** Look at Hoover Tower and ask, “Why was it built?” The glasses identify a likely match and ask for confirmation. A brief sourced answer appears and is spoken. A portal beside the tower shows an interpretive 1941 scene. The wearer chooses “architecture” or “archives,” and the live scene changes direction without ending the stream. A visible label says “AI interpretation, not archival footage.”

## What is already close

- [ECHOES (October 2026)](https://arxiv.org/abs/2610.34865) is an AR-glasses docent that combines visual site grounding, a historical knowledge base, adaptive questions, and source-aware glanceable responses. The recognition-plus-sourced-guide portion is therefore not new.
- [TimeLens](https://play.google.com/store/apps/details?id=nl.ciceroni.timelens) offers location-based historical AR panoramas with narration on a phone.
- The proposed distinction is **live, user-steered interpretation tied to a source-checked claim or question**, while separating evidence from generated imagery. This is a product hypothesis, not a claim of first-ever invention.

## Architecture and trust boundary

1. **Find candidates:** Spectacles location/heading narrows nearby landmarks. Google Places Nearby Search and Place Details provide candidates and metadata. GPS or Places alone cannot determine the exact building in gaze. Use one camera still, a pre-registered target, or wearer confirmation to disambiguate.
2. **Answer from a prepared place card:** `place_id`, display name, coordinates, approved claims, source URLs, images/assets with rights, and a small set of allowable scene beats. The assistant answers only from these claims and says when the card lacks evidence. Show a small source affordance.
3. **Render the live experience:** Lens Studio shows text, a portal or panel, and input controls. A server owns API credentials and any generation requests. Orbis streams a scene that can be retargeted by the wearer; its pixels are never treated as historical evidence.
4. **Keep scenes bounded:** Prompts specify documented era, viewpoint, and allowed elements, but generation may still invent details. Do not call the scene a reconstruction unless an expert has validated it. Do not use generated video to explain exact architecture or mechanisms that must be geometrically correct; use authored diagrams or archival images for that.

The Visko Living Worlds sponsor challenge requires Orbis at the heart of the Sunday XR demo, **streaming live and responding to user steering**. A prerecorded Orbis clip does not satisfy that criterion. Reactor's published Orbis API uses a WebRTC session and live prompt changes; its browser SDK is documented, but a reliable path to show that stream in a Lens on the loaner Spectacles still needs an on-device test. If it cannot be displayed on glasses, a companion browser alone may be a weak fit for the XR sponsor track.

## Hoover Tower pilot content

Stanford's [campus architecture page](https://architectplanning.stanford.edu/hoover-tower) says Arthur Brown Jr. designed the tower, construction ran 1939–1941, the height is 285 feet, and it houses galleries, offices, library holdings, a carillon, and an observation deck. Stanford's [community page](https://community.stanford.edu/opportunities/hoover-tower) currently says the observation deck is closed until January 25, 2027. A demo should distinguish enduring history from changing visitor information.

Choose a visual beat that is honest about uncertainty: an abstract animated archive of records flowing into the tower, or a stylized design study of its massing. A literal 1941 crowd, workers, costumes, or exact construction process is harder to verify and may be misleading.

## Weekend build gate

| Gate | Proof | Fallback |
| --- | --- | --- |
| Spectacles basics | Lens deploys; text, gesture, and audio work | Text and pinch control |
| Place selection | One target correctly selected on device | User selects Hoover Tower from one nearby card or an on-site marker |
| Source answer | One short claim with working Stanford source link | Fully authored narration and source card |
| Orbis integration | Live stream visible in XR; wearer action visibly changes scene | Keep the place guide as the main project and skip the Visko sponsor entry |

Build one place and two steerable beats before adding general landmark recognition. The Sunday judging room is indoors, so the team must have an honest indoor demonstration mode: a printed photo/marker or a small tower model clearly labeled as the demo stand-in. Capture the outdoor recognition flow separately only if it actually works.

## Thirty-second demo shape

0–5s: wearer points at the target and confirms “Hoover Tower.” 5–10s: one sourced fact is spoken and shown. 10–18s: a small interpretive portal starts streaming. 18–25s: wearer selects “Show the archive story”; Orbis changes the live scene. 25–30s: show the source and “AI interpretation” label.

## First decisions

- Confirm whether “LiveLab voice” means a specific service; it is not named in the event's published sponsor tracks. Snap's Remote Service Gateway documents TTS and real-time voice as possible options, subject to versions, permissions, and testing.
- Get the Visko team key and a working Orbis session; test playback on Spectacles immediately. The stream and the device integration are the largest feasibility risks.
- Decide whether the core experience is **historical interpretation** or **how this place works today**. Either can use the same place card, but the source and scene design should stay focused for the first demo.

## References

- [2026 event tracks](https://live.immersethebay.org/tracks)
- [Snap Spectacles location API](https://developers.snap.com/spectacles/about-spectacles-features/apis/location)
- [Snap camera module](https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module)
- [Google Places Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Reactor Orbis prompting and API guide](https://www.reactor.inc/learn/visko-orbis-prompting-api)
- [Visko Orbis paper](https://arxiv.org/abs/2607.26694)

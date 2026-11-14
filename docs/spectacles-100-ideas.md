# Snap Spectacles: 100 ideas, critically screened

November 13, 2026. Decision memo for the 36-hour Immerse the Bay build. The assigned hardware is Snap Spectacles; exact model and OS remain to be checked at pickup. This is an original ideation screen informed by three independent lenses: product and adoption, implementation and demo reliability, and market, accessibility, and privacy. Scores are judgment calls, not measured market data.

## Decision frame

We favor concepts that (1) solve a task better in the wearer's view than on a phone, (2) can be proven on one loaner device in 30 seconds, (3) can be built in Lens Studio in 36 hours, (4) fit a published 2026 track, and (5) do not depend on unsafe or misleading claims. We use **A** for a serious finalist, **B** for a viable but less competitive concept, **C** for a real idea with a major hackathon weakness, and **D** for a poor choice under these conditions. A tier is a prioritization, not a claim that an idea has no merit.

Snap's [Spectacles introduction](https://developers.snap.com/spectacles/get-started/introduction) establishes Lens Studio, hand gestures, voice, and multiplayer. The [Camera Module](https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module) supports stills and streams but must be tested on device; it reports no cameras in the editor preview. [Spatial Anchors](https://developers.snap.com/spectacles/about-spectacles-features/apis/spatial-anchors) place persistent world content, but do not track movable objects. [Remote Service Gateway](https://developers.snap.com/spectacles/about-spectacles-features/apis/remoteservice-gateway) offers AI services with version and token requirements. [Transparent Permission](https://developers.snap.com/spectacles/permission-privacy/transparent-permission) governs camera or microphone data combined with internet access. The event constraints are recorded in [event-brief.md](event-brief.md) and [submission-checklist.md](submission-checklist.md).

## 100 concepts and the objection that matters most

### 1–10: Mechanisms and physical science

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 1 | **Mechanism Coach:** reveal a hand pump's inner parts, then guide one valve fix | **A** | Strong physical transformation plus an action; only credible with one authored object and bounded guidance. |
| 2 | Pure exploded-object encyclopedia | B | Excellent 30-second visual, but a phone video often teaches as well unless the wearer manipulates the real thing. |
| 3 | Real lever force arrows | A | Causality becomes visible in place; a force estimate would need calibration, so show qualitative arrows. |
| 4 | Breadboard current-flow tutor | A | Powerful spatial explanation; wire recognition is too brittle, so use a known, prebuilt circuit. |
| 5 | Gear-train speed and torque overlay | B | Clear visual physics; requires a geared prop and carefully authored motion. |
| 6 | Bicycle drivetrain explainer | B | Rich mechanism with practical value; moving chain, clutter, and occlusion hurt alignment. |
| 7 | Water-filter flow cutaway | B | Hands-free instruction and invisible flow fit AR; finding a compelling physical prop may be hard. |
| 8 | Camera-lens optics ray visualizer | B | Beautiful, educational rays; exact refraction claims invite physics errors. |
| 9 | Coffee-machine cutaway | B | Familiar repeatable appliance; varied machines make a generic experience weak. |
| 10 | Elevator mechanism tabletop model | C | Visually dramatic, but no access to the real mechanism and little immediate task value. |

### 11–20: Repair and assembly

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 11 | Three-step bike-pump valve troubleshooting | **A** | Hands busy and visual cues matter; restrict to a benign, known failure and confirm each step. |
| 12 | Flat-pack shelf assembly overlay | **A** | Clear mass-use case; loose piece tracking and authoring exact geometry threaten the build. |
| 13 | Desk-lamp bulb replacement guide | B | Simple and demonstrable; electrical-safety messaging must be precise, and the task is short. |
| 14 | Bike tire patch guide | B | Genuine hands-free value; wet, dirty, or outdoor conditions make a live demo less predictable. |
| 15 | 3D-printer jam recovery | B | Strong maker niche and repeat use; requires the right printer and fault on site. |
| 16 | Cable-port setup guide for one workstation | B | Avoids repeated manual lookup; cables look alike and often occlude ports. |
| 17 | Sewing-machine threading overlay | B | Good hands-free niche; small parts require precision that Spectacles may not sustain. |
| 18 | Faucet aerator cleaning coach | C | Practical and safe; water, cramped geometry, and a bathroom demo are awkward. |
| 19 | Vacuum-filter replacement | C | Easy to author but low novelty and a weak 30-second arc. |
| 20 | General AI repair-anything assistant | D | Open-world recognition and unsafe hallucinated steps make it untrustworthy in 36 hours. |

### 21–30: Learning and training

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 21 | Origami fold guide on real paper | **A** | Exact hands-in-view guidance has clear AR value; paper tracking and fold-state inference are fragile. |
| 22 | One lab experiment setup coach | **A** | A repeatable training workflow; focus on one safe, prepared experiment. |
| 23 | Piano key overlay for one phrase | B | Immediate gratification; keyboard registration, field of view, and hand occlusion limit reliability. |
| 24 | Guitar chord fingering | B | Hands-free practice fits; strings and fingers are visually crowded. |
| 25 | Pottery shaping guide | C | Hands-busy task; deforming clay makes feedback hard without specialized sensing. |
| 26 | On-object vocabulary lesson | B | AI and vision are straightforward; floating labels alone are easy phone-app territory. |
| 27 | Sign-language fingerspelling practice | C | Social value is high; an inaccurate recognizer could teach wrong hand shapes. |
| 28 | Anatomy overlay on a mannequin | B | Strong classroom demo; accurate registration and assets cost time. |
| 29 | Chemistry molecule builder over a real kit | B | Fun 3D manipulation; a tabletop app could deliver much of the value. |
| 30 | Drone flight-control explainer | C | Interesting invisible dynamics; actual flight is unsafe and hard to stage indoors. |

### 31–40: Accessibility and personal support

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 31 | **HomeCue:** last-marked item place plus reminder | A | Compelling social-good story; a saved anchor cannot tell whether the item moved. Timestamp and correction are mandatory. |
| 32 | Speaker-aware live captions | B | High value for some users; latency, ASR errors, speaker direction, and consent complicate the demo. |
| 33 | Indoor route to one accessible entrance | C | Potentially high impact; localization failure can mislead someone relying on it. |
| 34 | Executive-function task cards by station | B | Repeated daily value; manual setup and generic checklist feel limit differentiation. |
| 35 | Low-vision contrast enhancer | C | Requires target-user validation and may not work well on this display. |
| 36 | Package-label reader | B | Useful hands-free reading; OCR errors matter for instructions and labels. |
| 37 | Medicine-label reader and reminder | D | Medication mistakes are high stakes and would need clinical-grade safeguards. |
| 38 | Opt-in person note card from marker | B | Could support recall while respecting consent; marker setup makes it awkward socially. |
| 39 | Remote family note anchored in a home | B | Warm, human use; authentication and household permissions are substantial product work. |
| 40 | Real-time conversational prompt coach | C | Private social support may help; bystander privacy and social awkwardness are serious. |

### 41–50: Environment and civic use

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 41 | Local recycling-sort coach | B | Repeatable and easily filmed; classification errors and local rules erode trust. |
| 42 | Tree-species field journal | B | Strong glasses-native logging; species certainty and outdoor constraints need care. |
| 43 | Accessibility-barrier audit recorder | B | Useful for civic teams; reports need human verification and an operational partner. |
| 44 | Litter cleanup scavenger guide | C | Positive impact; little reason for AR beyond gamified markers. |
| 45 | Plant-care observation diary | B | Repeatable physical context; diagnosis from a single image is unreliable. |
| 46 | Household energy-leak visualizer | C | Invisible energy is appealing, but valid readings need sensors or bills. |
| 47 | Water-use overlay on a faucet | C | Good behavior cue; any numeric savings without metering would be fabricated. |
| 48 | Wildfire preparedness room checklist | C | Social relevance, but hazard detection and safety advice must be bounded. |
| 49 | Public-transit stop navigator | D | Outdoor localization and mobility safety exceed the hackathon. |
| 50 | Grocery allergen scanner | D | An OCR or ingredient miss can cause harm; not a sound quick prototype claim. |

### 51–60: Museums, narrative, and creativity

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 51 | One artifact's layered history | **A** | Beautiful 30-second story and safe interaction; needs rights-cleared, factual content. |
| 52 | Historical street reconstruction | C | Strong spectacle but much asset and site work; outside lighting and alignment add risk. |
| 53 | Architectural hidden structure | B | Spatially meaningful for design education; needs exact building model. |
| 54 | Local mural story portal | B | Accessible cultural storytelling; artist permissions and context are prerequisites. |
| 55 | AR sculpture attached to furniture | B | Creative Zenith fit; repeated need is weak and interaction craft must be exceptional. |
| 56 | Gesture-driven music on objects | B | Immediate delight; AI or utility track fit is thin. |
| 57 | Living tabletop ecology terrarium | B | Attractive visuals; long-term simulation quality is hard to show in half a minute. |
| 58 | Interactive oral history at a location | B | Strong emotional angle; recording and consent work dominate. |
| 59 | Snap3D room-object remix | C | Generation is novel; runtime latency and inconsistent assets threaten demo control. |
| 60 | AI-imagined world from room mesh | D | Highly unpredictable latency, geometry, and performance in a 36-hour build. |

### 61–70: Games and playful interaction

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 61 | Physical escape room with two props | B | Strong Game Changer fit; prop setup and one-shot replay limit repeat use. |
| 62 | Room scavenger hunt | B | Easily understood; content design and tracking matter more than novelty. |
| 63 | Tabletop chess variant | C | Fun but familiar; multiplayer requires more devices or a clumsy spectator view. |
| 64 | Spatial Simon Says | C | Robust and fast to build; too shallow for a strong judging story. |
| 65 | Constellation finding | C | Charming; outdoor lighting and orientation accuracy hurt on-device proof. |
| 66 | AR mini-golf around furniture | C | Clear play; collision mapping and floor space can fail in the judging room. |
| 67 | Gesture spellcasting on household objects | B | Visually impressive; needs polished art to rise above a tech demo. |
| 68 | Cooperative tabletop puzzle | C | Collaboration is fun, but another device or mirrored view adds setup. |
| 69 | Real-object rhythm game | B | Good hand input and instant feedback; physical-object link may be superficial. |
| 70 | Dance footprints on a floor | C | Strong demo if room permits; tracking, field of view, and social comfort constrain use. |

### 71–80: Workflows and collaboration

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 71 | Remote expert places arrows in wearer's view | B | Strong long-run product; remote video, annotation registration, and privacy exceed safe hackathon scope. |
| 72 | Workstation checklist pinned to one machine | B | Useful, feasible, and repeated; needs context-aware transitions to beat paper. |
| 73 | Warehouse pick route | C | Commercial demand; access to inventory/map data is the blocker. |
| 74 | Field technician observation log | B | Hands-free documentation fits; enterprise workflow integration is absent. |
| 75 | Tool handoff tags | C | Could improve teamwork; every tool requires tagging and cooperation. |
| 76 | Apprentice skill recording | C | Rich training data; bystander consent and review workflows are too big. |
| 77 | Shared whiteboard around a machine | C | Intuitive collaboration; second headset and synchronization are a demo liability. |
| 78 | Event opt-in identity badges | C | Useful networking, but identity and consent make real adoption nontrivial. |
| 79 | Public-speaking cue cards | B | Easy and useful; low visual differentiation from teleprompters. |
| 80 | Interview-practice coach | C | AI feedback can help; the physical world adds little. |

### 81–90: Food, home, and shopping

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 81 | Coffee brewing step coach | B | Well-scoped repeated routine; most value is timers and text, already on phones. |
| 82 | Cooking mise-en-place overlay | B | Hands-free sequencing helps; hot surfaces and food-safety claims add risk. |
| 83 | Pantry snapshot to recipe | C | Familiar AI phone use; weak reason to render in AR. |
| 84 | Shopping furniture placement | C | Proven AR use; asset scale and retailer integration are outside scope. |
| 85 | Clothing-fit preview | D | Precise body/garment modeling and sizing are not hackathon-ready. |
| 86 | Home appliance filter reminder | C | Repeatable but little need for spatial display. |
| 87 | Laundry-care symbol explainer | B | Fast and concrete; image OCR and language UI are the main work, not XR. |
| 88 | Package unboxing and setup guide | B | A clear visual task; must choose one exact product. |
| 89 | Houseplant pruning guide | C | Spatial cues could help, but species-specific advice is uncertain. |
| 90 | Room decluttering coach | C | Broad appeal; subjective recommendations and continuous scanning are weakly grounded. |

### 91–100: Spatial data, navigation, and safety

| # | Idea | Tier | Critical judgment |
|---:|---|:---:|---|
| 91 | Indoor venue wayfinding for one route | C | Visual arrows fit glasses; a one-room demo proves little about map scalability. |
| 92 | Emergency exit drill simulator | B | Safe as explicitly simulated training; must never claim operational routing. |
| 93 | Hazard spotting during real work | D | False negatives could be dangerous; reliable detection is too broad. |
| 94 | Lab safety checklist on known bench | B | Strong task context; needs human-authored rules and explicit confirmation. |
| 95 | Live crosswalk aid | D | High consequences from latency or localization errors. |
| 96 | Dynamic queue guidance at an event | C | Requires live venue data and has limited immersive value. |
| 97 | Persistent personal waypoints | B | Direct use of anchors; relocalization and clutter decide usability. |
| 98 | Campus orientation portals | C | Attractive for newcomers; site prep and one-time use limit value. |
| 99 | Spatial parking-location marker | C | Useful, but outdoor/global persistence is more complex than an indoor anchor. |
| 100 | Object-loss prevention through continuous vision | D | Implies reliable inventory and tracking the hardware does not provide. |

## Ten finalists, ranked for this event

The score is a directional judgment out of 100: wearer value (25), glasses-native fit (20), 36-hour feasibility (25), 30-second proof (20), and safety/trust (10). It is not a market forecast. The finalists are product directions, not ten simultaneous features.

| Rank | Direction | Score | Best reason to build | Most likely reason to lose |
|---:|---|---:|---|---|
| 1 | **Mechanism Coach: one object, one diagnosed fix** | **89** | Combines vivid spatial explanation with a completed physical task | Too much model/registration/AI scope |
| 2 | One-object repair coach without exploded model | 87 | Highest practical repeat value and hands-free fit | Three steps can look like floating instructions |
| 3 | Exploded mechanism lesson with causal animation | 85 | Clearest, safest 30-second visual | May be judged an attractive 3D encyclopedia |
| 4 | Flat-pack assembly guide | 82 | Obvious task and broad user demand | Exact piece tracking/authoring |
| 5 | Lab experiment coach | 81 | Social-good and education value with a repeatable workflow | Requires a prepared safe experiment |
| 6 | Physics force visualizer | 80 | Distinctive XR understanding and craft | Qualitative teaching may feel narrow |
| 7 | Breadboard circuit tutor | 78 | Makes invisible current visible where learning occurs | Wire-level alignment and electrical caveats |
| 8 | HomeCue memory companion | 76 | Strongest emotional/social impact narrative | Stale saved places and substantial setup burden |
| 9 | Origami fold guide | 75 | Clearly useful hands-in-view guidance | Fold state and paper registration |
| 10 | One museum artifact's layered story | 73 | Polished visual and narrative potential | Little repeat utility and rights/content dependency |

### Why #1 wins the argument

Use **one familiar, benign mechanical object**, preferably a bicycle hand pump if the team has one. A wearer looks at it, pinches to reveal a prepared exploded pump beside the real pump, selects the valve or piston to see airflow, then performs one guided troubleshooting step such as checking the valve connection. The question “Why is no air going in?” produces an answer grounded in a tiny authored part/step record. This is a better XR justification than labels alone: the model exposes hidden causality *at the moment of action*, while the wearer keeps both hands available. The judge can see a physical before/after without trusting an unbounded model.

Its hardest problem is product coherence. A lesson and a repair guide can become two disconnected demos. Make the repair step depend on the causal explanation: “Air escapes here when this seal is loose; check this connection.” The user should be able to inspect, understand, act, and confirm in one flow. Do not claim automatic fault diagnosis; the demo presents a user-selected symptom and one approved check. A simpler stapler could replace the pump if it is the prop the team can model and bring reliably.

### Where the others beat #1

- **#2 repair coach** beats it on ongoing utility and simpler asset production. It loses visual differentiation unless the cues are exceptionally well registered to the prop.
- **#3 pure mechanism lesson** is the safer route if hardware, camera, or AI setup stalls. It still needs a learning challenge or causal interaction so the 3D model does more than expand.
- **#4 assembly** may be the best commercial product. For this weekend, a single shelf's exact pieces, instructions, and alignment cost more than expected.
- **#5 lab coach** may be strongest for Virtuous Reality if the team has an educator and safe bench setup. An uncontrolled experiment adds risk.
- **#6 force visualizer** could win Creative Zenith with exceptional craft, but its practical repeat-use case is weaker.
- **#7 circuit tutor** can be an excellent AI Horizons entry if a known circuit is available. Avoid claiming computer vision understands arbitrary wires.
- **#8 HomeCue** has the most meaningful human story. It should show “last marked here at [time]” rather than “your keys are here”; its key capability depends on anchors relocalizing, family setup, and user trust.
- **#9 origami** has unusually clear glasses-native value and a compact prop. Tracking paper state is a major technical risk; manual next-step controls are a workable fallback.
- **#10 museum story** is easiest to make safe and beautiful, but a venue/content strategy would be needed beyond the hackathon.

## Build gate and recommended scope

1. Pair the assigned Spectacles and deploy a blank Lens. Confirm the model, OS, Lens Studio version, gesture input, and whether the team can mirror or record the wearer view. The exact loaner capability is still unverified.
2. Put one 3D pump or stapler model beside one real prop and make a pinch reveal three authored parts. This is the non-network core.
3. Add one animated causal flow and one user-selected symptom with a single approved check. Preserve an explicit “I don't know” response for questions outside authored facts.
4. Add camera recognition or Remote Service Gateway only after a camera still plus a bounded answer succeeds *on device*. A visible marker or manual object selection is a valid, honest fallback. Do not put API tokens in the MIT repository.
5. Use an object-adjacent marker or controlled tabletop placement if world-anchor relocalization is unreliable. A world anchor is optional to the core story.
6. Target **Virtuous Reality** if the prototype centers practical learning/access to repair skills, plus **AI Horizons** only if live AI genuinely interprets the selected part or question. If the art and interaction are the stronger achievement, use **Creative Zenith** as the second main track instead. The event allows at most two main tracks.

**Thirty-second proof:** real pump and symptom (0–4s), pinch and exploded model (4–10s), select valve to see airflow (10–16s), ask why pressure is lost and receive a short source-bound answer (16–23s), perform/confirm the connection check (23–30s). If live AI is slow, record the authored core first and show the AI result only if it actually works on the device.

## Decision and limitations

Build **Mechanism Coach** for one prop. It ranks first because it has a concrete task, an immediately legible Spectacles interaction, and a deterministic core that can survive a poor network. The key contingency is simple: if the model/prop registration is not stable by the first working session, ship the same prepared mechanism lesson without the repair layer; do not pivot to a generic assistant.

This screen did not interview users, test the loaner, inspect team skills, or obtain a physical prop. The scores and track fit should be updated after the first on-device test and final event announcements. This report deliberately penalizes concepts that would make strong longer-term products but cannot be responsibly demonstrated in this 36-hour setting.

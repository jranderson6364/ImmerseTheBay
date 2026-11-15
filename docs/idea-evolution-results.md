# Idea evolution results (run 1)

3 rounds, 73 agents: generated, checked for prior art and Spectacles feasibility, then scored. Max weighted score is 105 (wow x2; fun, glasses, impact, feasibility, novelty x1.5; AI x1).

## Leaderboard

| # | Score | Round | Idea | Wow | Fun | Glasses | Impact | AI | Feasible | Novel |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 71.5 | 3 | Glow Trail: The Chicken Is Following You | 8 | 7 | 8 | 7 | 6 | 5 | 6 |
| 2 | 69 | 2 | Point and Name: The Glasses That Make You the Commander | 7 | 6 | 7 | 7 | 7 | 6 | 6 |
| 3 | 68 | 2 | Red Ceiling: The Heat Line | 7 | 7 | 7 | 7 | 6 | 6 | 5 |
| 4 | 67 | 2 | Her Eyes, Your House: Dementia Hazard Hunt | 6 | 6 | 8 | 8 | 7 | 5 | 5 |
| 5 | 67 | 3 | Bycatch: Cut the Net | 7 | 7 | 7 | 6 | 5 | 6 | 6 |
| 6 | 66.5 | 3 | Bee's-Eye: Nectar Desert Detector | 7 | 7 | 7 | 6 | 6 | 6 | 5 |
| 7 | 66 | 1 | Knee-High: The Reach Line | 7 | 7 | 7 | 7 | 7 | 5 | 4 |
| 8 | 65.5 | 3 | Wide Enough: The Ghost Chair | 7 | 6 | 7 | 7 | 5 | 6 | 5 |
| 9 | 64.5 | 2 | Storm Map: Chase the Sun | 6 | 6 | 7 | 7 | 6 | 6 | 5 |
| 10 | 64 | 1 | Flashover: Your Kitchen Is the Fuel | 7 | 8 | 7 | 6 | 5 | 6 | 3 |
| 11 | 64 | 1 | Heartline: Keep the Room Alive | 7 | 7 | 8 | 7 | 5 | 6 | 2 |
| 12 | 63.5 | 1 | Contamination Kaiju | 7 | 7 | 7 | 5 | 6 | 6 | 4 |
| 13 | 62 | 2 | Rot Preview: See Your Bin's Future | 7 | 6 | 6 | 6 | 6 | 6 | 4 |
| 14 | 62 | 3 | Fuse Line | 7 | 6 | 7 | 7 | 6 | 6 | 2 |
| 15 | 61.5 | 1 | The House That Signs | 6 | 6 | 7 | 8 | 6 | 5 | 3 |
| 16 | 60.5 | 2 | Fuse Box: Blast Radius | 7 | 7 | 6 | 6 | 6 | 5 | 3 |
| 17 | 60.5 | 3 | Ghost Drill: Learn the Roll on Your Real Friends | 7 | 4 | 7 | 7 | 6 | 4 | 5 |
| 18 | 60 | 1 | Thirst: Your Lunch Floods the Room | 6 | 6 | 6 | 5 | 6 | 7 | 4 |

## Verdicts and risks

### 1. Glow Trail: The Chicken Is Following You (71.5)

Touch raw chicken and your hands glow green. Every object you grab picks up a glowing print. When a hot hand reaches for ready-to-eat food (salad, bread, a plated dish), Gemini sees it coming and the food flashes a red STOP field before you touch it. Glo Germ shows the mess afterward; this one stops it before it happens.

**Verdict:** The kitchen covered in green handprints is a real jaw-drop shot, and the greasy-hands reason for using glasses is honest. The weak point is the mechanics. Fingertip-to-mesh contact on Spectacles is noisy, and Gemini judging which hand regions got scrubbed would be close to random. The honest fallback turns the AI into a trigger plus a label maker, which hurts AI Horizons and ManageXR. It is also a reveal, not a fix: Glo Germ and Clean-AR already do the reveal, so judges who know them will ask what the AI adds beyond the visual.

**Killer risk:** Hand tracking breaks at exactly the moments the demo needs it. Spectacles tracking is camera-based, so it degrades or drops when a hand grips an object (fridge handle, shaker), when the two hands overlap and occlude each other (all of handwashing), with fast motion, and possibly near shiny or wet sinks. There is no touch sensor either. 'Contact' has to be inferred as fingertip within a few cm of a World Query hit, and that is noisy at the 1-2 cm level and misses small objects whose mesh barely exists. The headline feature is Gemini judging which hand regions were scrubbed from frame bursts, and that is the least reliable part: 1-3 s of latency per call, no consistent per-finger reasoning, and hands blurred together in the frame. So the 'missed thumb stays bright' moment would be close to random. A second risk: the additive display washes out in a bright kitchen, which dulls the 'kitchen lit up' pull-back. The display's FOV is also small, so the wide reveal only shows the prints inside the FOV at any moment.

**Closest existing:**
- [Clean-AR (HoloLens 2 + Azure Kinect research prototype, 2021)](https://www.researchgate.net/publication/354181552_Clean-AR_Using_Augmented_Reality_for_Reducing_the_Risk_of_Contamination_from_Airborne_Disease_Agents_on_Surfaces): High on mechanics: tracks human movement, marks likely-contaminated surfaces with virtual red dots on the real room, and the dots are removed when cleaning staff wipe by hand. The difference is that its source is simulated airborne particles from a patient, not hand contact with raw food. It also needs an external Kinect and workstation. The authors say no prior work monitored movement to flag high-risk touched surfaces.
- [Glo Germ (UV gel and blacklight kits) and the BfR blacklight cross-contamination video](https://www.bfr.bund.de/en/notification/foodborne-infections-new-video-makes-the-invisible-visible/): Same reveal, done physically: glowing paste on raw meat traced to hands, handles and the sink under UV light, plus checking wash coverage under UV. This is the exact 'horrified by your trail' moment the idea recreates digitally.

### 2. Point and Name: The Glasses That Make You the Commander (69)

When someone collapses, one pinch makes the AI read the real crowd. It fires beams to three specific strangers and feeds you their exact words in your ear: 'Point at red jacket. Say: YOU, call 911.' Your finger lines up with the beam, the tag locks, and your own loud human voice breaks the bystander effect. The AI picks who does what, and the human gives the order.

**Verdict:** Beams locking onto three real strangers is the strongest visual in the Heartline family, and AI reading a crowd is real technical depth. The core logic has a hole, though. Only the wearer can see the beams and tags, and the glasses speaker can't reach a stranger 4 m away in a loud lobby, so the 'you, you, and you' moment is never actually delivered to the people it is meant for. 'Someone' already owns the freeze/bystander framing on Spectacles, and the live track-and-reassign loop is a 20-hour trap. As pitched it is a staged, video-only illusion that a sharp judge will take apart in one question.

**Killer risk:** Snapping a role onto each person in the scan is easy, but a live crowd scene is not. Gemini vision on one frame takes about 1-4 s through RSG. Its bboxes on small or overlapping people in a busy lobby are loose, so the Depth Cache point can land on the wall behind a person instead of their torso. That makes the beam miss or wobble at the moment the video is selling. The bigger problem is that the "tag turns green when that person moves" and "reassign if they don't move" loop means re-detecting the same people and matching them across frames every few seconds. That needs identity matching across Gemini calls, and Gemini is not a tracker, so it is the part most likely to eat the whole 20 h. Secondary risks: (1) GPS works poorly indoors on Spectacles, so a real AED route in a campus lobby will be wrong. (2) The glasses speaker is too quiet for bystanders 3-5 m away in a noisy lobby to hear their assignment. (3) Bystanders cannot see the beams, because only the wearer and the capture video can. Judges may ask how a stranger knows they were picked. (4) Sending camera frames to the internet needs the Extended Permissions / experimental toggle on the dev device. That is fine for a demo but not publishable. (5) The ethics pitch has a hole: pinching and scanning delays the start of CPR. Frame the scan as one pinch while kneeling, then hands go straight to the chest.

**Closest existing:**
- [Someone (Snap Spectacles Lens, Devpost 'Learn AR with SPECS' hackathon)](https://github.com/ahammadshawki8/Someone): Very high on the concept. It is a Spectacles CPR Lens built for frozen bystanders, with a 110 bpm compression target, an AED step, and a scripted 911-dispatcher voice. It explicitly tells the user to point at one specific person rather than the crowd. It already owns the 'break the freeze / bystander effect' framing on the same device. However, the delegation is a voice instruction only. There is no vision-based person detection, no 3D tags on real people, and no tracking of whether they moved.
- [Proximity Pulse (Snap Spectacles hackathon showcase)](https://developers.snap.com/spectacles/spectacles-community/hackathon-showcase): Medium. A Spectacles project giving bystanders real-time CPR feedback. It covers the CPR layer but has no crowd role assignment.

### 3. Red Ceiling: The Heat Line (68)

Gemini scans your real room for exits and anything blocking them. Then a glowing sheet of heat drops from your ceiling, and you have to get your head under it and reach the exit Gemini picked, which may not be the door you expected.

**Verdict:** This is the strongest physical hook so far: a glowing line drops through your own room, and your body is the controller. The weak point is that "MR fire escape in your own home, scored on time" is already a Devpost project, and full hands-and-knees crawling is where Spectacles tracking is most likely to fail on camera. The AI is mostly a pre-scan plus scripted lines, so a judge may see it as a Quest-demo port unless the AI itself creates the surprise.

**Killer risk:** The main risk is tracking during the crawl. Spectacles 6DoF tracking is camera-based. When the wearer drops to hands and knees, the cameras face carpet and baseboards from 30-60 cm, often in dim dorm light, while the head moves fast. Expect drift or tracking loss. When that happens, head height jumps and anchors slip, which breaks the 'HEAD: 1.7 m' meter, the exit path and the Depth Cache anchors at the moment the video needs them.

Smaller risks:
- Plain white ceilings give sparse depth. World Query depth updates at only 5 Hz and returns null outside the field of view, so the ceiling hit-test may fail.
- The field of view is about 46 degrees, so the red ceiling layer shows only as a band when the wearer looks up. A drop to chest height reads well; a ceiling only reads if the wearer looks at it.
- Gemini Live is a single preview model. Over hackathon Wi-Fi it adds latency and can drop the WebSocket. Gemini can also mislabel a closet as a door, the exact mistake the pitch promises to catch.
- The video problem: the lens capture is first-person, so 'wearer drops to the floor' needs a second phone filming third-person, plus compositing.
- Safety and accuracy: real-world crawling while wearing glasses, and the fire-safety advice must be correct. Checking the door with the back of the hand and staying low are real guidance. Verify the 'under 2 minutes' statistic before it goes in the video.

**Closest existing:**
- ["A Fire" Training App (Devpost hackathon, Quest 3 MR)](https://devpost.com/software/a-fire-training-app): Very close. It is a mixed reality home-escape trainer: you scan your own room, mark the doors, then escape through MR smoke and fire, scored by a survivability percentage that drops with escape time. 'Stay low to the ground' was only on their roadmap, so head-height scoring was not built.
- [Extinguish: Fire Extinguisher Training (Meta Quest, passthrough)](https://www.meta.com/experiences/extinguish-fire-extinguisher-training/4478562792268745/): Fire appears on your real couches and desks and spreads up your real walls in passthrough. It is about extinguishing fires, not escaping, and has no smoke-layer height mechanic.

### 4. Her Eyes, Your House: Dementia Hazard Hunt (67)

A caregiver walks through Mom's real house. Gemini finds the objects that dementia misreads, and each one bursts into a misperception made of light: the dark mat turns into a spiraling tunnel of falling light rings, the glossy floor ripples with bright caustics, and a glowing figure appears in the mirror. Each effect dissolves only when you fix the real object and a re-scan confirms the fix.

**Verdict:** The impact is real and the problem fits glasses well, but the hero shot, a black bottomless pit, is the one thing an additive optical see-through display cannot draw. As written it is a faint glowing ring on a mat that is still plainly visible, and post-production would have to fake it. The reveal itself also comes from A Walk Through Dementia, so health judges may see it as borrowed. The new part is the fix-and-verify loop on your real home, and that loop has to carry the pitch in a visual form, made of light.

**Killer risk:** The jaw-drop moment depends on drawing darkness, and Spectacles can't do that. The display is additive optical see-through, so black and dark pixels render as transparent. A "bottomless pit" means darkening the real floor, and these glasses can only add light. Through the lenses the pit becomes a faint glowing ring sitting on a doormat that is still clearly visible. The same limit weakens the "shadowy stranger" in the mirror, which is dark by nature. Spectacles screen capture composites the lens over the camera feed in much the same way, so the 2-second hero shot will look underwhelming unless it is faked in post, and judges at a table will see the weak version. Three detection risks stack on top. Depth on mirrors and glossy tile is unreliable: stereo depth and hit tests return the reflected scene or nothing at all, so the mirror and puddle anchors drift or fail exactly where they matter. Gemini's "glossy floor" bounding boxes are fuzzy, and its bbox coordinates are normalized 0-1000 in [ymin,xmin,ymax,xmax] order, so they need careful mapping to the Depth Cache's pixel frame. Re-scan verification ("the mat was flipped") is the riskiest step for a non-deterministic model, and one camera-to-Gemini-to-anchor round trip takes about 2-5 s. Doc check: I could not confirm the additive-display point on developers.snap.com. The compatibility list's Camera, Internet and Graphics sections were collapsed, and the design-guide URL I tried returned 404. It comes from known Spectacles hardware behavior, so the first build hour should confirm it on the device.

**Closest existing:**
- [A Walk Through Dementia (Alzheimer's Research UK, Google, UCL)](https://www.awalkthroughdementia.org/): High on the core reveal. This free VR/360 app already shows dementia misperceptions inside a home: dark rugs and shadows read as holes, shiny floors look wet, and reflections confuse. The difference is that its home is canned and virtual, not your real home, and it does no AI detection and no fix loop.
- [Home Mobility Hazards Detected via Object Recognition in AR (eCAADe/SIGraDi 2019)](https://papers.cumincad.org/data/works/att/ecaadesigradi2019_016.pdf): High on the mechanism. A caregiver points a portable AR device at a home, object recognition finds carpets, cables and furniture, and the tool flags hazards and suggests fixes. It does not render the misperceptions themselves.

### 5. Bycatch: Cut the Net (67)

Look at a can of tuna or a sushi plate and a glowing fishing net hauls up out of it right in front of you, with its real bycatch tangled inside: a turtle, a shark, a dolphin. The tangled animals match the actual bycatch numbers for that catch method. Pinch the net to cut it by choosing the better option on the shelf, and the animals swim free.

**Verdict:** This is the first idea in the set where the opening shot actually sells itself: a turtle rising off a tuna can makes sense with the sound off. The weak part is the AI. Gemini mostly does OCR feeding a 10-row lookup table, and the catch method usually isn't printed on cans, so the clever-sounding part is really a hard-coded demo. The 46-degree FOV also kills the head-orbit beat. Impact is consumer-guilt nudging, which judges have seen many times (SASSI, Seafood Watch, the Better Choice lens), so the spectacle has to carry the pitch without help.

**Killer risk:** Two risks together could kill the jaw-drop shot. (1) Field of view: Spectacles (2024) have a diagonal FOV of about 46 degrees, and the on-device capture records only that FOV. A 1 m turtle circling your head will be cropped, or will leave the frame for most of its orbit. The "rises off the can and swims past the camera" beat only works if the animals stay inside roughly a 1 m box in front of the wearer, and in a vertical edit the crop gets even tighter. (2) Content and art, not code: most retail tuna cans don't print the catch method. Gemini will guess, or come back with "unknown" and produce no animal. The single builder also has to find, rig, or animate a turtle, a shark, a dolphin and a fish school in ~20h, alongside the camera, Gemini and depth pipeline. Swim cycles that look cheap will kill the "glowing ocean" look faster than any API failure. Additive glow on the see-through display also washes out under bright grocery-store fluorescents.

**Closest existing:**
- [Sea Shepherd x Resn 'Below the Surface AR' (2020)](https://mobile-ar.reality.news/news/sea-shepherds-web-based-augmented-reality-experience-spotlights-damage-done-by-fishing-industry-0251709/): WebAR campaign that shows dolphins caught as bycatch in nets inside an immersive scene. It has the same emotional bycatch visual, but it is a one-off awareness piece that is not tied to a real product or a buying decision.
- [WWF-SASSI app AI camera](https://wwfsassi.co.za/resource-tools/): Consumer app that rates sustainability. Its AI camera identifies a whole fish at the counter, which is the same 'scan the seafood and get a rating' loop. It runs on a phone, gives a flat list of results, and has no spatial or bycatch visuals.

### 6. Bee's-Eye: Nectar Desert Detector (66.5)

Look at any planting and Gemini tells you, honestly, what a bee gets out of it. Real pollinator plants light up with their documented UV nectar guides (sourced from published UV photos of that species) and glowing forage trails. Showy-but-useless ornamentals and lawns get an additive red 'nectar desert' mesh, and a pinch drops ghost native plants that would fix the gap.

**Verdict:** The opening shot, a flower lighting up with a neon bullseye and bees streaking in, is one of the stronger openers in this batch. But two parts of the pitch are false. The UV patterns are made up, not sensed, and the additive display can't turn the lawn grey, so a biology-literate impact judge can pull it apart in one question. It's also mid-November, the sunflowers aren't blooming, the AI is mostly species-ID-plus-lookup that phone apps already do, and the concept is close to Penn State student proposals. As written it is a pretty filter, not an 8.

**Killer risk:** The pitch depends on two visuals that won't survive real conditions. (1) The core reveal is fabricated. Gemini sees only the RGB camera image and has no UV data, so it can't detect real nectar guides. Every "UV bullseye" has to be a hand-made stylized texture per species. A biology-savvy judge on an impact-scored track will ask "is that the real pattern?", so the team should show only real reference UV photos for 3 to 5 species and say so in the pitch. (2) The Spectacles display is additive (see-through waveguide), so it can't grey out or darken the real world. "Bee mode turns everything grey and the lawn is a dull nectar desert" can't be rendered; black renders as transparent. The contrast has to come from adding things (glow on good plants, a faint wire grid and red tag on the lawn), not from desaturating reality. Practical risks on top of that: it's mid-November at Stanford, so sunflowers and black-eyed Susans won't be blooming outdoors and they'd need potted or cut flowers. Gemini vision takes about 2 to 5 s per frame through RSG and misidentifies ornamentals. Depth Cache points jitter on small flower heads, so a decal pinned to a petal will drift or float in front of it. Outdoor sun washes out the display and hurts depth and hand tracking.

**Closest existing:**
- [Animal Vision app (honeybee mode)](https://animalvision.app/en/species/honeybee/): A live camera filter that shows the world 'as a bee sees it'. The app admits phone cameras can't capture UV, so its UV look is false color. That covers the bee-mode look but not species ID, flower-pinned nectar guides, or planting advice.
- [Univ. of Exeter / Univ. of Queensland animal-vision software (micaToolbox and similar)](https://www.fastcompany.com/3049617/use-this-app-to-see-colors-through-the-eyes-of-other-animals): Research software that turns photos into bee-vision images. These are still images, not AR, and they do no plant reasoning.

### 7. Knee-High: The Reach Line (66)

A glowing line at 1 m wraps around your real walls, and a stylized ghost toddler crawls to every real hazard below it. It grabs a ghost copy of your actual bleach bottle, and only stops when you lift the real one above the line.

**Verdict:** The ghost toddler gives the video a main character, and the child-safety impact is real. But the hero shot depends on two things that don't exist: X-ray vision into a closed cabinet, and navmesh routing. A realistic toddler rig built in 20 hours will likely look creepy, not cute. The AI half is a shipping phone app (BabyProof), so without a sharper glasses-native mechanic, a judge will say "BabyProof with a mascot". Fixing this needs an honest, measurable AI loop and a stylized character, not a better pitch.

**Killer risk:** The X-ray beat in the hero video cannot work. The camera cannot see inside a closed cabinet, so Gemini has nothing to detect, and Snap OS has no navmesh or semantic floor plan to route a crawler around furniture. There are three other big risks. (1) Character art: the toddler needs a convincing crawl/reach/turn rig in about 20 hours. Mixamo-style crawl animations are made for adult rigs, and a scaled-down adult can look creepy rather than cute, which works against the "cute and horrifying" tone. (2) Reliability: Gemini takes 2-6 seconds per frame and gives inconsistent boxes for small things like cords and outlets. Depth Cache misses on dark or reflective cabinet interiors or thin cords and returns no point, so hazard pins float or never appear. (3) Fix confirmation: telling "pods moved up high" apart from "pods out of frame" with vision alone gives false positives on stage.

**Closest existing:**
- [BabyProof (babyproof.io)](https://babyproof.io/): Very high on the core function. A phone app that uses ARKit/ARCore to map a room, sends frames to OpenAI vision to detect baby hazards, overlays warning markers, and links to products like outlet covers and cabinet locks. This is essentially the same AI pipeline, just on a phone and without a character.
- [Baby-Safe Home AR (Google Play)](https://play.google.com/store/apps/details?id=at.techbee.babysafe): High. Camera-based object detection that flags items in your real home as dangerous for babies.

### 8. Wide Enough: The Ghost Chair (65.5)

A life-size translucent wheelchair rolls ahead of you down the real sidewalk inside a 36-inch light corridor. When a scooter, bin or sign pinches the path, it jams with a thud and the corridor shatters red. Move the obstacle and it rolls on. If you can't move it, Gemini works out who owns it and files the report to them.

**Verdict:** The shatter-and-heal tunnel is a strong, readable visual. Everyone has stepped around a scooter, and the heal-when-you-move-it loop works as a game. Two things hold it back. A cyan rectangle is abstract, so it doesn't hit emotionally. And the "real measurement" claim is the weakest part technically: free-width scanning outdoors will jitter right at the 36-inch threshold, and Gemini only does a shallow movable-or-fixed label. Project Sidewalk, RASSAR and 311 apps already cover the audit-and-report side, so the in-place moment has to carry the whole idea.

**Killer risk:** The "measurement, not a guess" claim. The depth-based hit test has no documented range, runs at 5 Hz, and only sees what is in the field of view. Outdoors on a sidewalk, it will not cleanly find "both edges" of a clear path. A curb edge, a grass verge or a wall gap is not a surface the ray hits, a thin sign pole may be missed or noisy, and nothing will resolve depth reliably at 15 m. An automatic free-width scan will jitter by about 10 cm or more, which flips the red/cyan verdict at the 36-inch threshold on camera. Secondary risks: outdoor sunlight washes out the display for the wearer (capture still composites fine), RSG and location need a phone hotspot outdoors, and Gemini takes 1 to 3 s per frame, which kills the 4-second shatter beat if it sits in the critical path.

**Closest existing:**
- [Project Sidewalk (UW Makeability Lab)](https://makeabilitylab.cs.washington.edu/project/sidewalk/): Crowdsources sidewalk accessibility labels (obstructions, missing ramps) with AI validation. It runs in 35+ cities. It is the main existing audit-and-report platform, but it works from Street View imagery and has no in-situ AR or measurement.
- [RASSAR: Room Accessibility and Safety Scanning in AR (CHI 2024)](https://dl.acm.org/doi/10.1145/3613904.3642140): Very close in technique. It uses phone LiDAR and CV to measure accessibility violations and overlays them in AR against configurable ADA-style rules. It is indoor-only and has no gamified fix loop.

### 9. Storm Map: Chase the Sun (64.5)

A parent scans a loud room with a pinch. Glowing electric weather appears on the real sources of sensory load: white-blue lightning on the grinder, bright rain under the speaker, a vortex over the crowded table. A golden sunbeam lands on the calmest booth and grows brighter as the parent and kid walk toward it, measured live, so finding calm becomes a game the kid can watch and play.

**Verdict:** This is the strongest metaphor in the batch, but the hero shot as written can't be filmed: Spectacles use an additive display, so a "dark rolling storm cloud" shows up as a faint ghost, and the "82 dB to 58 dB" readout claims a calibrated meter the mic isn't. The core pitch, AR that routes autistic people around sensory triggers, is already taken (Louie, HushMap, Quokalm). What's left is a playful overlay, and if Gemini puts the storm on the wrong object it just reads as random particles. There's also a framing gap: the parent wears the glasses while the kid, who is the one overloaded, sees nothing, so the "a kid can enjoy it" claim is never actually delivered.

**Killer risk:** Two things can each kill the opening beat. (1) Display physics: the Spectacles display is additive, so black and dark pixels show as transparent. To the wearer, a 'dark rolling storm cloud' looks like a faint ghost. It may also look washed out in the capture, which is the 30s video. The jaw-drop shot has to be redesigned as bright, emissive weather: glowing white-blue cloud edges, bright rain streaks and white lightning flashes. Test a capture in the first 2 hours. (2) Sensing honesty: the mic is not a calibrated SPL meter. It is placed for the wearer's voice and likely has device-side gain control or noise suppression. getAudioFrame gives relative amplitude (dBFS), not '82 dB to 58 dB'. Ambient readings may be flattened or dominated by the wearer and the parent talking. Gemini also tends to hallucinate flickering lights from one still, since flicker isn't visible in a single frame, and bbox-to-3D through the Depth Cache misses on shiny or far objects like ceiling panels. In a live cafe with ~20h and one dev, the AI storm can easily land on the wrong object. A demo then reads as 'random particles', not 'it understands the room'.

**Closest existing:**
- [Louie: An Augmented Reality Sensory Trigger Wayfinding System for People with Autism (Ohio State)](https://innovate.osu.edu/available_technologies/43077/Louie-An-Augmented-Reality-Sensory-Trigger-Wayfinding-System-for-People-with-Autism): The closest concept match. It is AR wayfinding that warns autistic users ahead of time about the sensory triggers they choose (sounds, sights, smells, crowds) and integrates noise-cancelling headphones. It is a university licensing listing, and the public details are thin. It appears to be route-level and phone-based, not live per-object source painting on glasses. Still, the core pitch, 'AR shows sensory triggers and routes you around them', is taken.
- [HushMap (iOS)](https://www.pharmatools.ai/hushmap): A sensory-friendly map app that predicts noise, crowds and lighting per venue. It has a built-in phone-mic dB measurement for live reporting. It covers the 'measure dB, find quiet places' half, but only as 2D color-coded maps with no in-room spatial overlay.

### 10. Flashover: Your Kitchen Is the Fuel (64)

Gemini scans your real stovetop area for what would actually burn (the towel on the oven handle, the paper towel roll, the oil bottle, the flour canister). Then it lights a grease fire on your cold pan that spreads along those exact objects unless you grab the right thing in time.

**Verdict:** The water fireball is a real thumb-stopping shot, and "getting it wrong is the fun part" is the right instinct. Still, AR and VR grease-fire trainers are crowded: IRWINO, FAST XR, EHS VR, a Quest kitchen title, and even a Quest 3 Devpost home-fire drill. The engineer's fallback also moves the AI out of the real-time loop, so the AI ends up as a setup labeler and a debrief voice, which is weak for AI Horizons and ManageXR. On an additive display in a lit kitchen the fireball may look faint, so the wow depends on dim-light filming and a wizard-of-oz trigger.

**Killer risk:** The pitch says Gemini classifies the object in hand "every frame." That is not how it works. Each Remote Service Gateway vision call is a network round trip of about 1 to 3 seconds. Frames of a hand gripping a lid or cup are also blurry and partly blocked by the hand, so Gemini will often return the wrong object or nothing. The whole game depends on the fireball firing the instant the user grabs something. If the reaction lands 2 seconds late, or the lid gets read as a plate, the game stops working, both in the demo and at a judging table. Smaller risks, roughly in order:
(a) Fire spreading along the ceiling needs the world mesh to cover the ceiling. Spectacles mesh the area near the user fairly well, but ceilings are sparse and slow to mesh. The fireball may clip or float.
(b) Big additive particle systems on Spectacles hit thermal and frame-rate limits. A fireball filling the room is the heaviest shot in the video, so it is also the one most likely to stutter.
(c) The additive display only shows bright fire well. That suits fire, but it looks faint in a brightly lit kitchen and in spectacles capture, so film in dim light.
(d) Publishing a lens that combines camera and internet needs Transparent Permission (per the Camera Module doc). For a hackathon dev build this is only a limitation, not a blocker.
(e) Use a cold pan and never a lit stove, and say so on screen. The dial-turned-off check is extra vision work with little payoff. Fake it or cut it.

**Closest existing:**
- [EHS VR Cooking Oil scenario](https://en.ehsvr.com/szkolenie-vr-ppoz-pozar-oleju-w-kuchni): Very high on concept. A VR pan-oil fire where the user has to act, and the app shows the consequence of the wrong action. It is fully virtual and runs in a virtual kitchen, not the user's own stove.
- [IRWINO FIRE AR](https://www.irwino.com/en/fire-ar/): High. An AR fire simulator that anchors virtual fires in the real environment, including cooking-pot and deep-fryer scenarios. The user fights them with real extinguishers, and it offers water, CO2 and powder agents.

### 11. Heartline: Keep the Room Alive (64)

Someone collapses and the whole room starts going grey. Your chest compressions push color, sound and light back into the world, and a live AI 911 dispatcher talks you through until the AED arrives.

**Verdict:** A beating heart inside a pillow is a strong first shot and the hands-on-chest argument for glasses holds up. The problem is that it isn't new. CPReality published the blood-to-brain hologram in 2019, its RCT found no gain over a standard feedback manikin, and at least three Spectacles CPR coach Lenses already exist from a recent SPECS hackathon, so judges at this event may have seen it. The AI is thin: compression rate is peak counting, and Gemini only runs a single placement check. Meanwhile stacked-hand tracking is likely to break the sync the whole shot depends on.

**Killer risk:** Hand tracking will probably drop out during real CPR. CPR hand position is one palm stacked on the other with the fingers interlocked, pushed down fast at the bottom edge of the camera's view while the user leans over. Stacked, interlocked, self-occluding hands are the classic failure case for camera-based hand tracking, and the docs make no promise about it. If isTracked() flickers, the compression count and depth readings stutter and the heart beats out of time with the user's hands. That would kill the 5-second jaw-drop shot, because the whole effect depends on the heart beating in sync. Second risk: Spectacles' small display field of view plus looking steeply down at the chest. The heart may clip at the edge of the frame or look washed out on the additive display in a bright room.

**Closest existing:**
- [CPReality (HoloLens + Laerdal manikin, Balian et al., Heliyon 2019)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6684477/): Nearly the same concept: an AR hologram of blood flowing to the organs that rises or falls with compression quality, plus a 110 bpm heartbeat guide when the rate leaves 100-120/min. Users in that study asked for the hologram to sit on the manikin, which is Heartline's pitch.
- [CPReality randomized pilot (Frontiers in Digital Health 2020)](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2020.00001/full): Same system tested against a standard feedback manikin. It found no improvement in CPR quality, which weakens the impact claim.

### 12. Contamination Kaiju (63.5)

Every piece of litter hatches a goo monster that only dies in the bin Gemini judges correct. Toss it in the wrong bin and it splits and floods the whole bin with goo, which is what one wrong item really does to a recycling batch.

**Verdict:** This is Pokemon-Go-for-trash. Monstrash, Litter Crusaders and Pukemon already did it on phones, and the team's own 100-ideas list has it too, so judges will recognize the pitch in about 2 seconds. The slime rising from a real bag is a genuinely fun shot, but it depends on fragile detection that takes 2 to 6 seconds. The trash also can't be tracked once it's picked up, and the engineer's 16 hours eats almost the whole 20-hour budget. As pitched, picking up one wrapper doesn't matter much and the AI just picks costumes. The only part that's both new and important is the bin-sorting judgment, and the original buries it at second 20.

**Killer risk:** The magic moment in the video depends on two things the stack doesn't do well. First, detection and latency. You capture a frame, Gemini returns a bbox, then Depth Cache turns it into a 3D point. Over the venue Wi-Fi that round trip will probably take 2 to 6 seconds (I haven't timed it). Small, low-contrast litter on grass 2 to 4 m away, or a dark can in shade, will often be missed, or the bbox will be off enough that Depth Cache drops the slime 30 cm to the side or behind the item. Second, nothing tracks the trash once it moves. When you pick up the real bag, the anchor stays on the ground, and no per-frame object tracker can follow the item in your hand. The "right bin glows like a portal" step and the second vision check that confirms the item went in add two more Gemini round trips. They also need the bins to be identifiable from a single frame (labels and colors vary). One more risk to verify on day one: whether Spectacles' own capture records the AR overlay cleanly while Camera Module and network calls are running, and whether the frame rate drops from the particles plus the camera stream. If the in-glasses recording looks bad, the 30-second video fails no matter how good the code is.

**Closest existing:**
- [Monstrash (iOS)](https://apps.apple.com/kh/app/monstrash/id1479534914): High. A phone AR game where each piece of real trash you find unlocks its own AR mini-game or creature. It is the same idea of turning a piece of litter into a game encounter, but on a phone and without bin-sorting verification. The listing dates from 2021.
- [Litter Crusaders (GitHub)](https://github.com/windigo98/Litter-Crusaders-Maps): High in concept. A Pokemon-Go-style litter cleanup game in which 'litter monsters' are found and 'bosses defeated' while cleaning parks. Each kind of litter is a collectible creature in a 'Litter-dex'. Map-based, with no on-object AR.

### 13. Rot Preview: See Your Bin's Future (62)

Hold any item over a real bin and the glasses show you what happens to that whole batch if you let go. A pizza box over Recycling makes the bin's contents bloom with neon mold and creep up the wall. Swing it over Compost and the mold dies back while the compost bin sprouts glowing moss. You only ever see the consequence before the mistake, never after it.

**Verdict:** The mold bloom is a strong, gross, shareable opening shot, and I found no prior art for it. Everything else is weak. The sorting step the pitch calls new is already shipped by Oscar Sort at universities, and any Gemini or Meta AI glasses can answer "which bin?" out loud. The "under a second" claim is false, since RSG vision takes 1.5 to 4 s. There is no reliable signal for the moment an item is dropped, and a mold that doesn't cling to real surfaces turns into a floating sprite, which loses the one thing that makes this idea worth doing. As pitched it's a reskinned hackathon sorter with one great VFX beat. The fix is to make the bloom the product and drop the verdict-on-drop flow.

**Killer risk:** You can't get a sub-second verdict or a mold that hugs the real surfaces. A Gemini vision call through the Remote Service Gateway realistically takes 1.5 to 4 s, and longer on hackathon Wi-Fi. Gemini also misjudges condition ("greasy", "liquid inside") from a low-res Spectacles frame. On top of that, the lens has no reliable signal for the moment an item is dropped: SIK tracks hands, not objects, so a release over a bin is guesswork. For the bloom to "spread over the bin's contents and up the wall", the mold has to stick to real geometry. Spectacles gives you hit tests, not a full world mesh you can paint on (I haven't confirmed this in the current docs). Without that the mold reads as a floating sprite, and the jaw-drop shot fails. Lens Studio's camera-plus-network permissions add one more risk. RSG is the sanctioned path, but anything outside it needs Experimental APIs, and those block publishing.

**Closest existing:**
- [Oscar Sort (Intuitive AI)](https://news.asu.edu/20250829-environment-and-sustainability-asus-new-aipowered-oscar-sort-devices-help-recycling): Very high on the core loop. A camera at the bin sees the item you hold and tells you which bin it goes in, within about a second, including split-item steps like 'separate sleeve from cup'. It is trained on each campus's own rules and installed at ASU, UW-Madison, TCU, airports and arenas. It shows the verdict on a mounted 2D screen, not in AR. Intuitive AI is also beta-testing a phone app, Oscar Pocket.
- [SortIQ (Smart Edge Technologies) on Meta Ray-Ban glasses](https://www.smartedgetech.io/sortiq.html): Medium. AI sorting judgments made through head-worn glasses from a continuous camera feed. It is aimed at industrial textile sorting, has no AR overlay, and its accuracy figures come only from vendor marketing.

### 14. Fuse Line (62)

Embers land on the real fuel Gemini spots near your house, then a burning fuse visibly crawls along the real ground from each one to your real siding. Physically break the chain (move the woodpile, rake the mulch) and you watch the fuse die before it reaches the wall.

**Verdict:** The opening shot is strong: orange embers at golden hour landing on a real woodpile is the best visual in this batch. The idea itself has been done, though. ZoneZero (same name, Gemini, SF, three weeks ago), the IBHS AR app (2021) and a handful of Zone 0 scanners already cover detect, measure, fix and re-verify. A Bay Area judge who has seen any of them will mark it down hard. Beyond that, the build is fragile: outdoor dusk tracking, the gutter target and a slow round trip over a hotspot all make the live 'it caught fire on the real object' moment risky, and "tower defense" oversells what is really a single clear-and-rescan loop.

**Killer risk:** Outdoor dusk plus a moving teammate breaks the perception chain. Spectacles 6DoF tracking and World Query depth get worse in low light and on low-texture ground, and Depth Cache only works for nearby targets, so the gutter line (about 4 to 6 m up, thin, at a steep angle) will probably not resolve to a stable 3D point. Gemini boxes for 'bark mulch' and 'dry leaves' are loose, so the flames may sit at the wrong spot or drift off the real object in the take. A Snap OS capture showing a fire floating 1 m from the woodpile kills the jaw-drop. A second risk is RSG over a phone hotspot in a yard: a round trip of 3 to 8 s or more per scan, plus the 'fixed' re-scan has to come back clean on camera. Also unverified: whether the Gemini path through RSG returns usable bounding boxes in the format the Depth Cache sample expects. Partsight suggests yes, but test it on outdoor material first.

**Closest existing:**
- [ZoneZero (Gemini 4 Argon SF Hackathon, Oct 25 2026)](https://github.com/Anmol-tech/ZoneZero): Nearly identical concept and even the same name. You film your house, Gemini plus an ember simulation shows how embers would ignite it, and you test fixes until it survives. It is phone and 3D-model based rather than glasses-native, and it was built three weeks ago in SF, so Bay Area judges may have seen it.
- [IBHS Wildfire Ready Virtual (AR phone app plus Quest VR, 2021)](https://ibhs.org/ibhs-news-releases/new-interactive-wildfire-ready-app-demonstrates-impact-of-wildfire-resistance-actions-in-virtual-reality/): An established free AR app. You point your phone at your home to see weak points, and it animates embers and fire hitting the 0-5 ft zone (for example a wood fence carrying fire to the house) and then shows the mitigated fix.

### 15. The House That Signs (61.5)

Look at anything in your home and its ASL sign comes out of the object itself: glowing ghost hands rise from the milk carton and sign MILK at you, and Gemini turns your own kitchen into your deaf baby's first-words curriculum.

**Verdict:** The stakes are real and moving, but the core mechanic has been built many times: hand-tracked ASL tutors with ghost hands, a project with nearly the same name, an ASL tutor on Spectacles, and Snap's own ASL lens. Snap judges will think "seen it" within 3 seconds. The finger grading also depends on exactly the hand poses SIK tracks worst (self-occlusion, two hands touching), so the judging-table demo will flicker unless the sign list is cut to easy one-handed shapes. The parts that are actually new are the home-as-curriculum AI and object-triggered recall, so the pitch has to lead with those, and the team needs a Deaf or ASL-fluent reviewer.

**Killer risk:** The hand tracking will not hold up on the signs that matter. SIK gives 21 keypoints per hand. But 'MORE' (both hands' fingertips tapping together), 'MILK' (a closed fist squeezing) and anything near the face ('mom', 'dad', 'eat') involve self-occlusion, hands touching, or hand positions outside the Spectacles camera field of view. In those cases the keypoints jitter, swap or drop out, and the red-to-green finger grading flickers or falsely fails. That breaks the demo at a judging table. A second risk: the docs describe no posable rigged ghost-hand mesh. HandVisual only follows the live hand. So the 'ghost hands lift off your real hands and form the sign' shot means building your own template rig: record keypoint poses per sign, then draw joint spheres and bone capsules at those poses relative to the live wrist. That eats hours, and it looks like a skeleton rather than a hand unless the design teammate makes it beautiful. Also, ASL correctness needs validation. A wrong sign in a social-good pitch is a credibility hit, and so is a hearing team teaching Deaf culture without consulting anyone from the Deaf community.

**Closest existing:**
- [First Signs (Amazon Build, Ship, Shape hackathon, GitHub DanKam0001/first-signs)](https://github.com/DanKam0001/first-signs): Almost the same pitch: hearing families learn their Deaf baby's first ASL signs, with on-device hand tracking and live feedback. It even has the same name. Built for phone camera plus Fire TV, not glasses.
- [A.S.L.A.N. (Devpost, 2024)](https://devpost.com/software/a-s-l-a-n): Quest passthrough ASL tutor that uses Oculus Ghost Hands (HandGhost pose component) to show the target handshape over the user. This is the ghost-hands mechanic itself.

### 16. Fuse Box: Blast Radius (60.5)

Spoiling food grows a lit cartoon fuse, and the AI also shows which items are making their neighbors go bad faster. Ethylene producers like bananas and tomatoes emit a visible shockwave that speeds up the fuses of sensitive produce nearby. You defuse by cooking the fuses that are burning fastest and moving the 'bombs' away from their victims.

**Verdict:** The sparking-fuse visual is the first idea in this batch that is actually fun to watch. Underneath it, though, the product is a crowded fridge-scan-to-recipe loop, and Snap's own Spectacles hackathon showcase already lists one, so Snap judges are likely to see a reskin. Inside a fridge the depth and hand-occlusion problems put the hero shot at real risk. The 'days left from one photo' claim also falls apart the moment an AI Horizons judge asks how the model knows. The fix: stage it on a counter or a produce drawer, take days-left from the FoodKeeper table, and add one AI mechanic the prior work doesn't have.

**Killer risk:** Anchoring inside a fridge is the weak point, and three things stack up. First, depth at fridge range is the worst case. Items sit about 30-60 cm away, packed close together, behind shiny or wet surfaces, with glass shelves and light glare. The cached depth pixel under a Gemini bounding box often lands on the shelf, the back wall or a neighboring item, so fuses drift or float. Gemini's boxes are also loose, which makes the centroid land between items. Second, the snip interaction fights the scene. The hand reaching into the fridge blocks the camera's view of the item and moves it, so the anchor stops matching the item, and hand tracking degrades with the hand partly inside a shelf. You get fuses snipping themselves or never snipping. Third, the video and the judges. Spectacles only cover about 46 degrees diagonally, so three fuses on different shelves may not all fit in frame from a natural standing position. DepthModule may count as an experimental API: the docs say experimental lenses get an 'Experimental Mode' watermark burned into recordings, and the watermark cannot be removed. I could not confirm which APIs that list includes, so test whether Partsight's recordings show it. Gemini's 'days left' from one photo is also a guess, and an AI Horizons judge will ask how it knows the milk has 2 days left.

**Closest existing:**
- [Snap Spectacles Hackathon Showcase entry: hands-free AI assistant that spots spoiling food and gives recipes to cut waste (Spectacles + Gemini visual reasoning on freshness)](https://developers.snap.com/spectacles/spectacles-community/hackathon-showcase): Very high. Same device, same AI stack (Gemini vision for freshness) and the same recipe-to-cut-waste loop. This is already on Snap's own developer showcase, so Snap judges may recognize it. It does not seem to have the per-item world-anchored fuse, the countdown visuals or the multi-item 'defuse' recipe solver. The showcase listing is a short teaser, so I could not confirm the project name, the event or its exact feature set.
- [Augmented Reality Based Interactive Cooking Guide (Magic Leap One, Sensors 2022)](https://doi.org/10.3390/s22218290): High. Head-worn AR recognizes the ingredients in view and suggests recipes. The paper's background mentions expiration tracking, but the study itself does not demonstrate it. No gamification.

### 17. Ghost Drill: Learn the Roll on Your Real Friends (60.5)

Point your Spectacles at a friend lying on the floor. A glowing ghost of them peels out of their body and rolls them into the recovery position, and you race to copy it on the real person. It's a 60-second party-safety drill your RA runs at every dorm meeting, so the skill is already in your hands on the night it counts.

**Verdict:** The ghost-leaves-the-body shot is a real hook. Everything else is a grim first-aid lens in a category Snap has already rewarded (Emergensee, plus several CPR entries). It also depends on full-body retargeting from noisy single-frame Gemini keypoints, which one developer cannot make reliable in 20 hours, so the jaw-drop shot is the part most likely to fail. On repeat use: nobody is wearing Spectacles at the moment a friend passes out. The '1,500 deaths' stat is also misleading, because most of those deaths are drunk-driving crashes, not choking. Judges who know that will discount it.

**Killer risk:** The ghost has to peel away from the real body and roll on its own, and that shot is the hardest part of the build. Spectacles has no body tracking for other people (the compatibility list I fetched does not show any body-tracking API, so assume there is none). Every joint therefore comes from Gemini 2D points on one frame, which takes about 2 to 5 seconds per call over RSG. Those points then go through Depth Cache on a person lying down in a dim room, often at an angle and half-covered by a couch or blanket. Expect the keypoints to wobble, the far-side limbs to be wrong, and noisy depth on dark clothing. In ~20h, one dev cannot reliably retarget a keyframed roll onto IK built from 8 to 12 noisy 3D points. The likely result is a twisted ghost with folded limbs, which ruins the jaw-drop moment at second 3. The per-limb "glows green when it matches" check also needs a fresh Gemini frame every 3 to 5 seconds. That makes the live copy-along slow and laggy, because Gemini will misjudge knee angle and whether the face is down. Secondary risks: dim lighting hurts both Gemini and depth, and the overlay has to show up in the Spectacles capture for the vertical video (the pitch depends on footage captured on the glasses).

**Closest existing:**
- [Emergensee (Team ZapChat), Snap Lens Fest 2024 Lensathon winner](https://ar.snap.com/lensathon-recap): Spectacles lens teaching laypeople an emergency first-aid procedure (EpiPen). It won Snap's own hackathon, so Snap judges have already seen and rewarded 'first aid on Spectacles'.
- [Someone (Snap SPECS lens, Devpost 'Learn AR with SPECS')](https://github.com/ahammadshawki8/Someone): Hands-free Spectacles lens that walks frozen bystanders through CPR step by step and lets 911 see what you see. The same bystander-emergency framing, but for CPR instead of the recovery position.

### 18. Thirst: Your Lunch Floods the Room (60)

Look at your tray and the water your meal took to make floods the floor around you at true volume. A burger puts the whole cafeteria shin-deep in glowing water, and it drains out when you swap the patty.

**Verdict:** The hero shot breaks on the hardware. A 1.34 m translucent cube half a meter from your face gets cropped by the roughly 46 degree FOV and washes out on the additive display, so the 'tower' would show up in the capture as a faint, clipped slab. The concept is a known sustainability-calculator category: a Spectacles showcase entry already scans items for water and carbon, and AwARe already shows a meal's resources at room scale. The AI only labels food and looks numbers up in a table. Impact stops at awareness with no proven behavior change, so this is a pretty infographic unless the visual changes form.

**Killer risk:** The jaw-drop shot is a display-physics problem, not an AI problem. Spectacles has a narrow field of view (about 46 degrees diagonal), so a 1.34 m cube anchored at a tray about 0.6 m away fills more than the view and gets cropped. You only see one face or edge, and the recorded video shows a clipped slab instead of a tower. The display is also additive: translucent pale-blue "glass water" looks faint and ghostly, and in a bright cafeteria it nearly disappears, because dark and clear pixels render as see-through. A real fluid sim is not available. A water column built from particles or a shader is doable, but making it look like liquid will eat hours. Secondary risks: Gemini over the RSG can take 2 to 5 s per frame and misjudges portions. Depth Cache can drop the anchor on shiny trays. ASR can fail in a noisy venue. Capturing on-device video while running camera, RSG, VFX and ASR together may drop frames or overheat the device.

**Closest existing:**
- [Spectacles Hackathon Showcase entry (unnamed, possibly Matterly): scan an object to see its lifecycle with real carbon and water impact data, database-first with AI fallback, voice sustainability advisor, comparison tools](https://developers.snap.com/spectacles/spectacles-community/hackathon-showcase): High in concept and on the same device. It already does 'AI sees an item, shows its water and carbon footprint from a database, voice advisor compares alternatives'. It targets everyday objects or purchases, not meals on a tray, and the snippet does not mention a true-scale volume visual.
- [AwARe (handheld AR food sustainability research prototype)](https://nerosa.nl/wp-content/uploads/2024/08/Viz4CandS_AwARe___author_version_for_open_access.pdf): High. It visualizes the crops, water and livestock behind a meal at room scale in the user's kitchen and dining room, and compares ingredient lists. That covers the same core 'see a meal's hidden resources in your room' idea, but on a phone, from a list of ingredients rather than vision on the real plate.

## Blueprints for the top 3

# Immerse the Bay 2026: Final Top 3 (Snap Spectacles)

Scoring: Glow Trail 71.5 · Point and Name 69 · Red Ceiling 68 (wow / fun / whyGlasses / impact / aiFit / feasibility / novelty, verified in rounds 2 and 3).

Ground rules applied to all three:
- **No floating 2D screens.** Every label is world-anchored: on an object, on a person, or on the floor. Stat cards and title cards are end cards the video team adds in the edit, not UI in the lens.
- **Honest AI.** Gemini runs on stills at about 1-3 s latency, so anything that has to happen in the moment runs locally every frame. Gemini decides what things are and where they are, ahead of time.
- **Vertical video.** Lens-capture aspect ratio is not confirmed for 9:16. In Hour 1, record a 10 s capture on device and check the crop. Plan every storyboard as cuts between a 9:16 phone shot from third person and a cropped or composited lens view.
- **Parallel lanes.** One TypeScript builder. Designer: VFX assets, decals, sound, location and wardrobe. Video editor: storyboard, phone rig, shot list, end cards, and a safety cut by Hour 12.

---

## 1. Glow Trail: The Chicken Is Following You (71.5)

### The Spatial Hook
Touch raw chicken and your hands glow radioactive green. Every handle you grab keeps a glowing print. The moment a hot hand gets close to your salad, the bowl throws up a red force field, so you get stopped before you contaminate it, not shown the mess afterward.

### Core Spatial Loop (first 30 s)
1. **Arm:** Gemini sees raw poultry in a still, and both hands flare green. The glow is a shader on the SIK hand mesh plus joint particles.
2. **Spread:** each grab or pinch-release near an object Gemini named (fridge handle, salt, grinder) stamps a glowing print onto that object's Depth Cache 3D anchor.
3. **Intercept:** ready-to-eat items (salad, bread, plated food) carry invisible danger spheres. A hot palm within about 15 cm triggers a red pulsing field, a spatial buzz, and the TTS line "Chicken hands. Wash first."
4. **Cleanse:** in the sink zone, a 20 s ring timer on the wrist dissolves the glow joint by joint, in proportion to local joint motion. A lazy thumb stays lit.
5. **Wipe down:** each print has a floating world-anchored tag above it ("WIPE ME"). It fades only when Gemini confirms from a still that the surface is being wiped.

### Tech & SDK Architecture
- **Camera Module** gives one still about every 2 s (one capture in flight; capture sessions idle out after 60 s, so keep the session alive). Frames go through **RSG Gemini** `generateContent` with a strict JSON prompt: `{hazards:[{label:"raw_poultry",bbox}], rte:[{label:"salad",bbox}], objects:[{label:"salt shaker",bbox}]}`.
- **Depth Cache (from Partsight)** maps each bbox centre to a world point using the pose of the frame it came from, which gives frozen anchors for prints and danger zones. Merge a new detection with an existing anchor when it lands within 10 cm and has the same label.
- **SIK HandInputData:** grab/pinch strength and palm position are the touch signal. Joint velocities (thumb, index, middle, ring, pinky, palm) drive wash scoring. Freeze on `isTracked=false`.
- **World Query:** one hit test sets the sink zone and covers big surfaces like the counter, for when a grab misses every named object.
- **TTS** carries the warnings. **Snap Cloud** keeps an optional session score ("3 surfaces contaminated, 3 cleaned").
- **Latency masking:**
  - Classification happens before the reach. The kitchen is pre-scanned in the first 3-5 s, and anchors persist.
  - The intercept is a local per-frame distance check, so it costs 0 ms of AI time.
  - While a Gemini call is pending, a scanning shimmer plays on the target so the wait looks deliberate.
  - The wipe check is asynchronous; the print dims to 50% immediately and clears on Gemini's yes.
- **What to say at the judging table:** "Gemini decides what is raw, what is ready-to-eat, and what got touched by name. The glasses enforce that model every frame. No gel, no timer, no manual tagging."

### Asset Shortcut Strategy
- Hand glow: use the SIK hand-mesh material with emissive green and additive bloom, plus a Lens Studio particle template. Don't model anything custom.
- Handprint decal: the designer draws one PNG handprint (an emissive alpha texture) and one smear variant.
- STOP field: a Fresnel sphere shader with a scrolling hex texture, sized to the bbox.
- Ring timer: a radial-fill shader on a wrist-anchored torus.
- Audio: Geiger-style crackle for hot hands, a sub-bass thump for the STOP, a bright chime when clean. All from free SFX packs.

### Build Milestones
- **Hours 0-1:** check tracking while gripping a fridge handle and a shaker. Check the lens-capture aspect ratio.
- **Hour 6 (core):** Gemini JSON, then Depth Cache anchors, then the green-hands trigger (with a pinch-on-palm override), then prints spawning on grab near named anchors.
- **Hour 12 (feature lock):** the salad intercept, wash scoring by joint motion with the scripted lazy thumb, and Gemini wipe confirmation. **Shoot the safety take** using the hard-coded JSON plus pinch-spawned prints.
- **Hour 18 (polish/audio):** bloom tuning, spatial SFX, TTS lines, and the **final shoot** in a dimmed kitchen with under-cabinet light. Several takes of the intercept.
- **Hours 18-20:** editing, Devpost, and cleaning up the repo README.

### 30-Second Vertical Storyboard
| s | Shot | On screen |
|---|---|---|
| 0-1 | Lens POV, close: a knife into raw chicken | A Gemini scan shimmer, then the world tag "RAW POULTRY" |
| 1-3 | Lens POV | **Both hands detonate neon green.** Geiger crackle. |
| 3-6 | Lens POV, quick cuts | Grab the fridge handle, then salt, then grinder. Each one flashes a glowing handprint. |
| 6-9 | Lens POV | One more grab, the phone, and a print lands on it |
| 9-12 | Phone 3rd-person, pull-back, composited | The whole kitchen dotted with green prints. The wearer is oblivious. |
| 12-14 | Lens POV | A green hand drifts toward a bright salad |
| 14-16 | Lens POV, slow-mo in edit | **The bowl erupts in a red hex force field.** Thump. TTS: "Chicken hands. Wash first." |
| 16-17 | Phone 3rd-person | The hand freezes an inch away |
| 17-22 | Lens POV, sink | The wrist ring counts down 20 s (sped up in the edit). Glow dissolves joint by joint. **The thumb stays lit.** |
| 22-24 | Lens POV | Extra thumb scrub. Chime. Hands clean. |
| 24-28 | Lens POV, quick cuts | Wipe the handle, salt and grinder. "WIPE ME" tags turn to checks and fade. |
| 28-30 | End card (edit) | "Glo Germ, without the gel. Before it happens." + title |

### Killer Risk + Fallback
- **Risk:** hand tracking drops while gripping objects and while the hands overlap during washing. Any visible flicker kills the magic.
- **Fallback:**
  - Prints anchor to Depth Cache points on named objects, triggered by release, so a dropout mid-grip doesn't matter.
  - Wash scoring keeps the last good joint state while tracking is lost.
  - The intercept only needs palm position on a single, unoccluded hand.
  - For the video: the pinch-spawn re-performance plus hard-coded JSON. Shoot in a dim room so the additive display reads.
- **Second risk:** a bright kitchen washes out the display. Shoot at night with low ambient light.

### Closest Existing Products & How We Differ
- Clean-AR (HoloLens 2 + Kinect, 2021) puts contamination marks on a real room and clears them by wiping. Its source is simulated airborne particles, and it needs external sensors. https://www.researchgate.net/publication/354181552_Clean-AR_Using_Augmented_Reality_for_Reducing_the_Risk_of_Contamination_from_Airborne_Disease_Agents_on_Surfaces
- Glo Germ / BfR blacklight video show the same reveal, physically, after the fact. https://www.bfr.bund.de/en/notification/foodborne-infections-new-video-makes-the-invisible-visible/
- Spark EmTech VR hygiene training is fully virtual worker training. https://sparkemtech.co.uk/blog/vr-training-for-food-grade-ppe-and-hygiene-discipline
- Frontiers 2022 AR handwashing covers washing only. https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2022.934694/full
- Drexel "Don't Wash Your Chicken" tells the same story as a non-interactive animation. https://drexel.edu/news/archive/2013/August/Dont-Wash-Your-Chicken-Food-Safety-Campaign/
- AR Cooking Guide (Sensors 2022) does ingredient recognition with no contamination layer. https://doi.org/10.3390/s22218290
- **What's different:** the AI arms the hazard with no gel, tracks prints by object name, **intercepts before contact**, and confirms cleanup, all on bare glasses. Don't claim the visual is new. Claim the prevention loop.

---

## 2. Point and Name: The Glasses That Make You the Commander (69)

### The Spatial Hook
Someone collapses. One pinch, and three neon beams lock onto three real strangers, each tagged CALL 911 / GET AED / CLEAR SPACE. Your ear gets the exact line to shout, and your own pointing finger fires the order.

### Core Spatial Loop (first 30 s)
1. **Scan:** pinch, one still, and Gemini returns up to 3 people as JSON (bbox, clothing descriptor, position) plus a role ranking (someone holding a phone gets 911; whoever is nearest the exit gets the AED).
2. **Tag:** Depth Cache freezes a torso anchor per person. Beams fire, then outlines, then giant billboard tags appear.
3. **Command:** TTS whispers in the wearer's ear only: "Point at red jacket. Say: You, call 911." An index-finger ray from SIK has to align within about 8 degrees of the anchor. The reticle snaps, the tag shows LOCKED, and the wearer shouts.
4. **Confirm:** the wearer says "he's calling" (ASR keyword) or pinches the tag, and it turns green. If no confirmation comes within 10 s, the role reassigns to the next person in the same JSON. No vision tracking across frames.
5. **Hands to chest:** a small cadence pulse on the chest anchor. CPR coaching is a footnote.

### Tech & SDK Architecture
- **Camera Module** still → **RSG Gemini** with strict JSON → **Depth Cache** gives frozen 3D anchors. Fall back to the bbox top-centre and push the anchor in 30 cm if the depth lands on the wall.
- **SIK:** pinch trigger. Index-tip ray versus anchor-direction angle for the lock.
- **ASR:** keywords "calling", "got it", "on it". **TTS:** private earpiece coaching only. Strangers' appearance is never announced to the room.
- **VFX:** line renderer beams, an outline billboard ring, and floating tag text.
- **AED arrow:** a floor arrow anchored to a pre-placed world point, not GPS (GPS is weak indoors).
- **Latency masking:** a radial "reading the crowd" sweep plays during the 1-4 s Gemini call. Beams launch the moment the JSON arrives. A hard-coded backup JSON makes the filmed shot deterministic on bad Wi-Fi.
- **What to say at the judging table:** "The AI does the picking, the spatial targeting and the confirm-or-reassign loop. The human voice delivers the order, because strangers can't see AR, but they can't ignore someone pointing at them by name."

### Asset Shortcut Strategy
- Beams: a Lens Studio line or trail template with a neon gradient.
- Tags: three pre-designed emissive text panels anchored to people (not screens).
- Reticle: one ring sprite with a snap animation.
- Actors: three teammates and friends in **high-contrast solid clothing** (red, yellow, blue), standing 2-4 m apart against a plain wall.

### Build Milestones
- **Hour 6 (core):** pinch, still, Gemini JSON, Depth Cache anchors, beams and tags on three people.
- **Hour 12 (feature lock):** TTS script lines, the point-alignment lock, ASR confirm, 10 s reassign, AED floor arrow. **Shoot the safety take** with the hard-coded JSON.
- **Hour 18 (polish/audio):** heartbeat bed, beam "whoosh" SFX, and the **final shoot** with actors. Pipe TTS to the editor's track for clarity.

### 30-Second Vertical Storyboard
| s | Shot | On screen |
|---|---|---|
| 0-2 | Phone 3rd-person | A person drops. The crowd freezes. Edit caption: "Everyone waits for someone else." |
| 2-3 | Lens POV | Pinch. Radial sweep. |
| 3-5 | Lens POV | **Three neon beams slam onto three strangers**, with outlines and giant tags |
| 5-7 | Lens POV | The whisper: "Point at red jacket." The finger rises, the reticle slides along the beam, **LOCKED** |
| 7-9 | Phone 3rd-person | The wearer bellows, "YOU in the red jacket, call 911!" The stranger grabs a phone. |
| 9-12 | Fast cuts | Yellow → GET AED (floor arrow appears), blue → CLEAR SPACE |
| 12-15 | Lens POV | The wearer: "He's calling." The tag turns green. |
| 15-18 | Lens POV | Blue hesitates for 10 s, then **the beam reassigns** to a new person |
| 18-23 | Phone + Lens | The wearer kneels, a cadence pulse on the chest, the AED runner returns |
| 23-27 | Lens POV | All three tags green |
| 27-30 | End card (edit) | Bystander-effect stat (**verify the source before using**) + "Point and Name" |

### Killer Risk + Fallback
- **Risk:** loose bboxes on overlapping people put the Depth Cache point on the wall, so beams wobble or miss. The "stranger can't see the beams" critique also comes up.
- **Fallback:**
  - Stage the actors spaced apart in solid colours.
  - Use the hard-coded JSON for the hero take.
  - Anchor-offset heuristic.
  - Answer the critique as designed: the human voice is the delivery channel.
- **Ethics:** frame the scan as a single pinch while kneeling, use no identity recognition, and keep audio private.
- **Novelty risk:** the "Someone" Lens already owns the bystander framing. Lead with the AI crowd-tasking.

### Closest Existing Products & How We Differ
- "Someone" (a Spectacles CPR Lens) gives voice-only advice to "point at one person", with no vision and no 3D tags. https://github.com/ahammadshawki8/Someone
- Proximity Pulse does CPR feedback on Spectacles. https://developers.snap.com/spectacles/spectacles-community/hackathon-showcase
- Emergensee (Lensathon 2024 winner) does emergency training. https://voicesofvr.com/1467-ar-medical-training-app-wins-spectacles-hackathon-my-concluding-thoughts-on-snap-spectacles/
- BioData Mining 2025 AI+AR first aid is single-user only. https://link.springer.com/article/10.1186/s13040-025-00473-6
- Smart-glasses dispatcher-assisted BLS is remote coaching with no crowd tasking. https://www.sciencedirect.com/science/article/abs/pii/S0735675723003315
- PulsePoint does phone alerts and an AED registry, not in-scene roles. https://www.pulsepoint.org/
- **What's different:** vision-picked roles on real bodies, a point-to-lock gesture, and confirm-or-reassign.

---

## 3. Red Ceiling: The Heat Line (68)

### The Spatial Hook
A glowing sheet of heat drops from your real ceiling. Seen edge-on, it's a razor-bright red horizon at your exact eye level, and the AI has already condemned the door you were going to use.

### Core Spatial Loop (first 30 s)
1. **Pre-scan:** a 5 s walk-through. Gemini still or stills → exits, windows and blockers as JSON → Depth Cache anchors. Gemini ranks the routes, flags the blocked door, and the floor path draws to the alternate exit. This is a pre-scan, not live rerouting; rescan after moving furniture to get a new plan.
2. **Alarm:** spatial smoke-alarm audio. The heat plane descends from floor + 2.4 m on a timer.
3. **Get low:** head height is camera Y minus the calibrated floor. Below the plane, the whole view tint flips red → cool blue, and the floor meter turns green.
4. **Door check:** the back of the hand hovers near the door anchor (SIK palm-normal check), which registers "checked", then a proximity TTS line plays.
5. **Score:** an end card in the edit, plus an optional floor-anchored score in the lens.

### Tech & SDK Architecture
- **World Query** floor hit test plus a pinch-calibrated standing height. Low-pass filtered, and frozen on tracking loss.
- **Heat plane:** a world-locked additive volumetric plane. Head-below-plane drives a full-view tint (a post-effect, not a panel).
- **Camera + RSG Gemini** (non-live) for one scan, **Depth Cache** for anchors, **SIK** palm normal for the door check, **AudioComponent** for spatial audio, **TTS** for proximity lines. Gemini Live (`gemini-2.0-flash-live-preview-04-09`) only adds the "that's a closet" moment if hours are left over.
- **Latency masking:** the scan happens before the alarm, so the AI cost is hidden in the setup beat, which reads as a dramatic "analyzing room" sweep.

### Asset Shortcut Strategy
Heat plane: a scrolling noise shader with emissive orange and an edge glow. Path: a dashed floor ribbon. Alarm sound: a free SFX pack. One dorm room plus hallway as the location, lit well.

### Build Milestones
- **Hours 0-1:** **crouch-tracking test** (go/no-go).
- **Hour 6 (core):** floor calibration, head-height meter, descending plane plus tint swap.
- **Hour 12 (feature lock):** Gemini exit/blocker scan, route pick and blocked-door beat, door check, TTS. Safety take.
- **Hour 18 (polish/audio):** spatial alarm, bloom, **final shoot** on a 3-4 m crouch route.

### 30-Second Vertical Storyboard
| s | Shot | On screen |
|---|---|---|
| 0-2 | Lens POV | A scan box locks onto the door, then **the door turns red**: world tag "BLOCKED: basket + chair" |
| 2-4 | Lens POV | The path snaps to the window |
| 4-6 | Lens POV | Alarm. The heat sheet falls from the ceiling. |
| 6-9 | Lens POV | **An edge-on blazing red horizon at eye level.** Floor tag "HEAD 1.62 / HEAT 1.20" |
| 9-12 | Phone 3rd-person | The wearer drops into a crouch |
| 12-14 | Lens POV | **The view floods red → blue**, the meter goes green |
| 14-20 | Lens POV | Low route along the glowing floor path |
| 20-24 | Lens POV | Back of the hand to the door: "checked." TTS: "Hot handle means use the window." |
| 24-27 | Phone 3rd-person | Reaches the window exit |
| 27-30 | End card (edit) | "Out in 0:38 · under the heat 91%" + escape-time stat (**verify "as little as 2 minutes" before filming**) |

### Killer Risk + Fallback
- **Risk:** 6DoF tracking drifts or drops when the head goes low and fast, aimed at carpet.
- **Fallback:**
  - Crouch to about 1 m rather than crawling.
  - Use a well-lit route.
  - Freeze the last good height value on tracking loss.
  - Pinch-placed exits if the Gemini scan mislabels.
- **Novelty risk:** a Devpost Quest MR home-escape project already exists. Lead with head-height scoring and the AI blocked-door call.

### Closest Existing Products & How We Differ
- "A Fire" Training App (Devpost, Quest 3 MR) is a scan-your-home escape with a time score, where "stay low" was only on the roadmap. https://devpost.com/software/a-fire-training-app
- Extinguish (Quest passthrough) is about putting fires out, not escaping. https://www.meta.com/experiences/extinguish-fire-extinguisher-training/4478562792268745/
- Safety Education: Fire Evacuation is a VR evacuation trainer. https://www.meta.com/experiences/safety-education-fire-evacuation/8711248042301928/
- EHS VR "Escape my House" uses a virtual house. https://en.ehsvr.com/ewakuacja-z-domu-vr-szkolenie
- Sensors 2020 smoke-layer research is academic only. https://doi.org/10.3390/s20123607
- Pro-XR FAST XR is enterprise extinguisher training. https://pro-xr.com/en/fast-xr-fire-formation-virtual-reality-mixed-reality/
- **What's different:** head height against the heat line is the scored mechanic, Gemini finds the exits automatically with no manual marking, it runs on see-through glasses you can actually move in, and it scores the door check.

---

## Recommendation: Build Glow Trail

Each idea scored against the three factors that decide this weekend:

| Factor | Glow Trail | Point and Name | Red Ceiling |
|---|---|---|---|
| Jaw-drop in 0-5 s | **Hands detonate green at 0:01**, needs no setup | Beams at 0:03, but needs a collapse setup | Door turns red at 0:01, but the horizon (the real hero) lands at 0:06 |
| One builder, ~20 h on the Partsight Depth Cache | **Best fit:** "Gemini names object, then Depth Cache anchors it" *is* Partsight; single user; no actors; kitchen easy to stage | Good reuse, but needs 3+ actors and a staged crowd | Main dependency is crouch tracking, which Partsight never tested |
| AI claim survives one judge question | "What does AI add over Glo Germ?" → "It arms itself with no gel, names every touched object, stops you before contact, and verifies cleanup." Holds up. | "Strangers can't see AR." → answered by the shout, but the ethics of scanning strangers invites follow-ups | "Isn't this the Quest Devpost demo?" → hardest to answer |

Glow Trail wins all three, and it hits every track:
- **Virtuous Reality:** foodborne illness, at home, in every kitchen.
- **AI Horizons:** a vision-built kitchen state model plus an intercept.
- **ManageXR:** AI sees what you see while your hands are dirty, every time you cook.

It is also the most *fun*. It plays like a horror game where your own germs chase you.

**Backup: Point and Name.** It shares the same Gemini-JSON → Depth Cache pipeline, so the Hour-1 to Hour-4 work carries over. **Switch at Hour 4** if both of these hold:
- (a) Depth Cache anchors on small kitchen objects (shaker, grinder) miss by more than 10 cm even after merge and offset tuning
- (b) SIK loses the hand on most grip or release events

People-sized targets are far more forgiving. Don't switch after Hour 6. Past that point, cut scope instead: drop the wash scoring, keep the hands arming, the prints, and the salad intercept, which alone carry the 30 s video.

**Hour-1 checklist:** lens-capture aspect ratio, grip-tracking test, Gemini JSON round-trip latency on venue Wi-Fi, and dimmed-kitchen location confirmed by the designer.

---

# Run 2 (seeded from run 1, stricter Spectacles rules, feasibility gate >= 6, attack-and-repair)

81 agents. Best new score 73.5 vs run 1 best 71.5: scores have plateaued, so the search stopped here.

## Leaderboard

| # | Score | Round | Idea | Wow | Fun | Glasses | Impact | AI | Feasible | Novel |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 73.5 | 3 | Tip of the Tongue: The Word Is Hiding in the Fridge | 7 | 6 | 8 | 8 | 7 | 6 | 7 |
| 2 | 73 | 2 | Spike Scout: The Room Rewired for Leo | 7 | 6 | 6 | 8 | 8 | 7 | 7 |
| 3 | 70.5 | 3 | Teacup Tower: Balance Practice the Kitchen Can See | 6 | 7 | 7 | 8 | 6 | 8 | 5 |
| 4 | 70 | 3 | Sun Clock: The Afternoon That Hurts Grandma | 7 | 6 | 8 | 7 | 5 | 6 | 7 |
| 5 | 69.5 | 1 | Glass Ghost: Fix the Window That Kills Birds | 7 | 6 | 7 | 7 | 6 | 6 | 7 |
| 6 | 69.5 | 2 | Firefly Anchor: Your Panic, Made Visible, Then Settled on Your Room | 7 | 6 | 7 | 7 | 6 | 7 | 6 |
| 7 | 68.5 | 3 | Left Behind: Light Piles Up Where You Never Look | 6 | 6 | 8 | 8 | 7 | 6 | 5 |
| 8 | 68 | 2 | Moth Halo: Lights Out, Verified | 7 | 7 | 6 | 6 | 6 | 5 | 8 |
| 9 | 68 | 2 | Tip Zone: Which Drawer Kills | 7 | 6 | 7 | 7 | 6 | 6 | 6 |
| 10 | 67.5 | 1 | Spark Gap: Brown-Bag Lightning | 7 | 6 | 6 | 7 | 7 | 6 | 6 |
| 11 | 67.5 | 1 | Unbake: The Dish That Talks Back to the Kitchen | 7 | 6 | 6 | 7 | 7 | 8 | 4 |
| 12 | 67.5 | 3 | Fuse: Your Stove Lights a Fuse When You Walk Away | 6 | 6 | 8 | 7 | 6 | 6 | 6 |
| 13 | 64.5 | 1 | Burner Breath: Race the Plume | 6 | 5 | 7 | 7 | 6 | 6 | 6 |
| 14 | 63.5 | 2 | Pop-Up: The Whisper Coach for Bedtime Stories | 7 | 6 | 7 | 7 | 6 | 5 | 4 |
| 15 | 63 | 1 | Echo: The Ripple That Chooses | 6 | 4 | 8 | 7 | 6 | 6 | 5 |
| 16 | 61.5 | 2 | Above the Cane: Walk Maya's Body Down the Block | 6 | 5 | 7 | 7 | 6 | 5 | 5 |
| 17 | 61.5 | 3 | Don't Look Away: Spider Exposure That Moves When You Flinch | 6 | 6 | 7 | 7 | 6 | 6 | 3 |
| 18 | 61 | 1 | Hooked: The Kitchen-Table Mail Sort | 6 | 6 | 4 | 7 | 7 | 6 | 5 |

## Finalists after attack and repair

### Tip of the Tongue: Her Own Words Find the Fridge (73.5)

**Sinking question:** Your AI's main skill is telling a phonemic near-miss ("frish") apart from a semantic paraphase ("cooker") and a wrong answer. But Snap's ASR only returns cleaned-up real-word text, with no phonemes and no confidence score. So when a real aphasic speaker says "frish" and the transcript comes back as "fish" or "fresh", how does the grader know what she actually said? And if it can't, why isn't the "adaptive SLP-grade cueing" just a script that an actor reads correctly?

**Why it sinks:** The pitch says the AI is visibly smart because it sorts each answer as correct, semantic, phonemic near-miss or wrong, then chooses the next cue the way an SLP would. That claim is how the idea qualifies for AI Horizons and Virtuous Reality.

The engineer's doc check shows the problem. The ASR Module's onTranscriptionUpdate returns only text and isFinal, with no confidence and no phoneme output. It snaps speech to real words. A phonemic paraphasia, the error type this design is built to catch, gets turned into a different real word before the grader ever sees it:
- "frish" becomes "fish", which grades as wrong or semantic.
- Halting speech with long pauses gets chopped into fragments by silence termination.

The local fuzzy and first-letter matcher then grades the ASR's guess, not the patient's speech. So the SOUNDS LIKE and CLOSE glyphs are least reliable for the users the product is meant to serve.

The 30-second video can't prove this works, because Rosa is a scripted actor who says clean real words ("Fridge!", "cooker"). Any SLP or technical judge will see that the clinical intelligence on screen is only shown working on non-aphasic speech.

Without that grading, what's left is:
- a fixed cue ladder (semantic cue, then first letter, then the word) that existing apps already deliver, such as Tactus Therapy's Naming Therapy and Constant Therapy;
- floating letters on a fridge.

That leaves the AI decorative and the impact claim unproven.

**Repair:** The attack is right on one point: Snap's ASR snaps speech to real words, so grading phonemic near-misses ("frish") from its text is not honest. The fix is to change what the AI grades, not to add a new sensor. The repaired design no longer claims phonemic grading. It is rebuilt around Semantic Feature Analysis (SFA), an established, evidence-based aphasia naming therapy that runs entirely on real words, which the ASR transcribes well.

In SFA the patient describes the object she cannot name: what it is used for, where it lives, what it looks like, what group it belongs to, and what it reminds her of. Describing around a word (circumlocution) is the main behavior in anomic aphasia, the most common type in people living at home. Those descriptions are ordinary words like "cold", "milk", "kitchen" and "keeps food", so the transcript is reliable exactly where the AI needs it.

The AI's job becomes visible reasoning over her own words:
1. It sorts each phrase into an SFA feature slot (use, location, property, category, association).
2. It turns each phrase into a glowing shard labeled with her word and a slot glyph.
3. It sees which slots are still empty and asks about the most useful one ("Where in the house is it?"). It does not walk a fixed ladder.
4. Only after 3 or more features, or a long stall, does it spend a stronger cue (the first-letter shard). It logs which slots and cues each word needed.

The video can prove this on screen even with an actor, because the clue shards are built from whatever she actually said. That separates it from Tactus Therapy or Constant Therapy, whose cues are fixed and written in advance.

Grading is honest by design:
- **Correct:** the target word or an LLM-generated synonym or regional variant (cooker, icebox) appears in the transcript.
- **Different real word:** this is never called a phonemic error. It gets a neutral "keep going" and is stored only as a feature candidate.
- **No SOUNDS LIKE glyph.**

Phonemic scoring from raw audio through Gemini Live is listed as future work, not claimed.

Changes to the voice loop:
- Half-duplex: ASR is muted while TTS plays and resumes about 300 ms after playback ends.
- ASR fragments are collected over the whole turn, so halting speech does not get split into separate answers. Pinch means "I'm done", with a 6 s idle timeout as backup.
- Feature slotting is a keyword lexicon first, plus one OpenAI call per turn that returns strict JSON. Shards appear while the call is still running, so there is no dead air.

Everything else carries over unchanged: the Depth Cache anchoring, the 3-4 objects locked during a pre-scan, the actor framing, and the backup takes.

### Spike Scout: The Sensory Audit That Interviews the Room (73)

**Sinking question:** The parent is standing in the room and knows Leo better than any model does. So what does the AI show them that they could not see or decide themselves in five seconds? And when the AI tags something "likely hand dryer", how is the parent supposed to check whether that is true?

**Why it sinks:** Everything the glasses do is for the one person who needs it least. The parent is already there, can already see the TV, the restroom door and the fish tank, and has just said out loud what Leo hates and loves. The AI's "re-rank" is that same sentence handed back as colored urchins. Swelling the restroom urchin after "he hates sudden loud noises" is a keyword match the parent made in their own head before they finished speaking.

The route is no better. Door, then check-in, then the chair by the fish tank is something any parent picks without help, and a 3-bead path across a dentist lobby is not a planning problem. Moving the orb to a two-seat bench when the sister comes along is also obvious, not smart.

The triggers that actually wreck a visit are about timing and what other people do: a dryer going off, a crying kid, a 25-minute wait, a drill starting up. None of those show up when you scan an empty lobby on a different day. The hidden ones are, by the team's own admission, guesses. The parent has no way to verify them except opening the restroom door, which they would do anyway.

Leo never wears the glasses. The only thing that reaches him is a saved social story on a phone, and that is a commodity app category (social-story and visual-schedule apps already exist). So the XR part is decorative for this user. The part that helps the child is a phone feature. Ask "who is better off, and how much?" and the honest answer is "a parent who already had all of this in their head", which caps Virtuous Reality impact. It also hands AI Horizons and ManageXR judges an easy line: "the AI repeats the user back to them."

**Repair:** The attack is right that the parent is the wrong wearer. The parent already knows Leo, can already see the room, and cannot check the AI's guesses. The repair moves the glasses to the venue's front-desk staff member (dentist office, library, museum, clinic). That person runs the room every day but does not know sensory accessibility. Their tacit knowledge (the dryer is loud, the drill starts at 9, the PA goes off) is exactly what a family can't see on a quiet scouting day.

The AI changes from someone who repeats you back to you into a sensory auditor that interviews you, and it does two things the wearer cannot do alone.
(1) It measures. The mic samples loudness at each spot the staffer pinches, before ASR starts, so it reports dB numbers a person can't perceive (e.g. 64 dB at check-in vs 47 dB by the fish tank). The calm seat is picked from measured data, not guessed.
(2) It generates questions from what it sees. 'I see a ceiling speaker. Are there overhead announcements?' 'Restroom sign. Is there a hand dryer?' 'Hallway door. Can drilling be heard from here?' The staffer answers by voice or pinch, which turns hedged 'likely' tags into confirmed or dismissed tags. The person verifying is the one who actually knows the building, so the verification problem goes away. It also captures the timing triggers the attack said a single scan misses ('drill runs 9 to 12', 'PA every 10 min').

The 're-plan' beat becomes profile switching instead of echoing a sentence. The staffer says 'sound-sensitive kid', and the room's urchins and route rearrange. Then 'light-sensitive kid', and they rearrange differently (the fluorescent-panel urchin swells, the TV wall urchin swells, and the calm orb moves away from the window). That is a visible multi-constraint trade-off the staffer could not do in five seconds.

Output: one walk produces a sensory guide with several profiles, saved to Snap Cloud. Every family that visits gets it, plus a social story with a quiet route. That answers 'who is better off, and how much': many families per venue instead of one parent who already knew. Today, venues usually get this through paid certification programs or by never doing it. The guide also gets repeated use, because staff re-walk the room after a remodel or for a new profile (the ManageXR repeat-usefulness criterion).

Scope stays within the same Partsight capture, Gemini and Depth Cache pipeline. Two things are added: generating questions from the vision JSON, and per-bead dB sampling. Both are small. Hands-free still matters because the staffer walks the real floor, pinches at spots and talks. Connected Lenses are dropped (the engineer warned about combining them with the camera). There are no text cards, only glowing beads, urchins and TTS. Honest caveats: the 'likely' tags only become facts when the staffer confirms them, and the calm-seat logic follows published sensory-friendly design heuristics. The team should not claim clinical validation.

### Teacup Tower: The Balance Game That Only Says 'Slow Down' (70.5)

**Sinking question:** Your AI's main job is to decide whether an 80-year-old at risk of falling can loosen her grip on the counter. What does an LLM add there that a fixed rule from her physical therapist ("hold 10 s steady with light touch, three days in a row, then try fingertips") doesn't? And who is accountable when the model tells her to let go and she falls in her kitchen, alone, wearing a headset with a 46-degree field of view?

**Why it sinks:** This question hits the impact score and the AI score with one blow, and the pitch has no good answer to it.

1) The AI is either decorative or dangerous. The "smart" output is choosing the next Otago exercise, its duration and the support level. Otago is a fixed progression that a PT prescribes, and a threshold table over RMS and time-to-wobble does the same job on purpose, and does it more safely. An LLM only stands out where it departs from that table. Any departure that loosens support for a fall-risk user is exactly what a health judge wants removed.

2) The safety story contradicts itself. The pitch calls this solo daily practice with no clinician in the loop. The video, though, needs "a spotter just out of frame", which admits it is unsafe without one. The game also rewards longer holds on one leg, and the wearer's gaze is pulled down and sideways to cups on the counter. Older adults hold still better when they look forward at a fixed point at eye height, so the game works against the balance task itself.

3) The trend claim is weak. "Wobble time dropped 30%, worth mentioning to her care team" comes from head translation, not her centre of mass. That head motion is measured while she touches the counter, which by design cuts sway to a few millimetres, close to VIO jitter. A judge will ask whether the family alert is signal or noise. With no validation, "practice trend, not diagnosis" turns into "unvalidated alert that worries families".

4) Fixing it guts the AI. Take the support-loosening decision away from the AI and give it to a PT-set rule, and the AI shrinks to narrating a JSON summary. That is a weak result for AI Horizons and for ManageXR's "AI helps with a real task". Leave the decision with the AI and the Virtuous Reality judge marks it as a fall-liability risk. Either way the idea loses the track it most needs.

Prior art makes it worse. Sway-biofeedback games on HoloLens, Kinect and Wii Balance Board already exist, so the AR stacking-cups layer is all that is new. That layer is the hook for the 30-second video, not the impact claim.

**Repair:** The repair answers the sinking question by rule: the AI can only make a session easier or stop it. It can never make one harder or loosen her support. Progression (which stances are unlocked, the support level, the maximum hold time) lives in a PT/caregiver "care card" stored in Snap Cloud, and the AI cannot write to it. Where the LLM earns its place is the part a threshold table cannot do: understanding what she says, out loud, in her own words, mid-practice ("my knee's cranky from gardening" vs "I feel a bit woozy"), and checking her practice spot through the camera.

Changes:

1. **Stopping on red flags.** Dizziness, chest symptoms or new pain trigger a hard-coded stop. The AI parses free speech, so it catches phrasings a keyword list misses. It then tells her to sit, and sends family a note.

2. **Tailoring within limits.** The AI reorders and shortens today's set within the PT's ranges. For example: "knee's sore, so we'll do the supported heel raises first and keep the one-leg holds at 5 seconds."

3. **Safe-spot check.** One Gemini frame checks the practice spot before each session, from standing height. It rejects a rolling chair or towel bar, and flags a rug edge or a step stool behind her ("move that bath mat first"). This is the visible "AI sees what you see" moment for ManageXR.

4. **Tower at eye height.** The tower moves up onto the backsplash or upper-cabinet line, placed by a wall hit test. She looks straight ahead at a fixed point, which helps balance instead of pulling her gaze down and sideways.

5. **Honest impact claim.** It is now adherence, not detection. Home balance programs (Otago-style) are prescribed with a hand on a stable counter, and people stop doing them because they are boring. Family receives a practice and adherence note ("5 of 7 days, longest steady hold 18 s, said her knee was sore Tuesday"), not a mm-sway health alert.

6. **Steady-seconds measure.** Wobble is "steady seconds" measured against her own baseline, with a threshold of about 2 cm, well above VIO jitter. Head sway drives the visuals only.

7. **Spotter in the video.** The video's spotter is standard filming practice, stated plainly. The product only offers counter-supported stances the PT unlocked.

The jaw-drop shot survives: the world-locked tower tilts against still cabinet lines in POV, and a cup drops off the ledge into gold sparks. The build stays at about 14 h with no new hard systems. The care card is a Supabase row seeded by hand.

## Verdicts and risks

### 1. Tip of the Tongue: The Word Is Hiding in the Fridge (73.5)

For stroke survivors with aphasia, each big object in their own home is circled by a swarm of blank glowing shards that hide its name. Each cue from an adaptive speech-therapy AI turns one shard into a letter or a picture clue. When she says the word, the swarm slams together into the gleaming word on the real fridge.

**Verdict:** This is the strongest emotional story in the set and the glasses case is real: cues appear on her own fridge, hands-free. It has a clinical hole, though. If the word FRIDGE is drawn in shards before she names it, the task becomes reading aloud, not naming, and any SLP judge will notice in seconds. The 'AI notices the near-miss' beat also depends on ASR that snaps aphasic speech to real words and adds 2-4 s per turn, so the smartest moment is also the one most likely to fail on camera. The visual is pretty, but floating letters are smaller and less surprising than the caption suggests, and therapy content is only moderately fun.

**Killer risk:** The voice loop is the killer risk, not the visuals. The ASR Module gives only text and isFinal, with no confidence score and no phoneme output. It snaps speech to real words, so a phonemic near-miss like "frish" comes back as "fresh" or "fish". Aphasic, halting speech with long pauses also gets cut into fragments by silence termination. Each turn chains ASR finalization, a non-streaming Chat Completions call, and TTS, which adds about 2-4 s per turn. The mic can also pick up the TTS cue and grade it as her answer. If any of these misfire on camera, the beat "AI notices the near-miss and changes its hint" turns into a mis-grade or dead air. The video has no slack for that. A second risk is ethics and credibility with impact judges: the pitch claims to be clinical, so implying it replaces an SLP or showing a "real patient" will get challenged.

**Closest existing:**
- [AphasiaGPT (UNC stroke-survivor app)](https://aphasiagpt.ai/): Webcam/camera Word Finder names objects, pronounces them, plus an AI coach with hints. Phone/web, no AR overlay, no clinical cue hierarchy on the user's own objects, and glasses are only a stated future idea. Moderate overlap on 'camera + aphasia + AI hints'.
- [iName It (Smarty Ears)](https://www.smartyearsapps.com/iname-it/): Non-AI iPad app with the standard cueing hierarchy (semantic, first sound, etc.) and logs which cue helped. No camera, no real-world objects, no spatial anchoring. Overlaps the cue logic only.

### 2. Spike Scout: The Room Rewired for Leo (73)

A parent scouts a new place before their autistic child visits. Glowing urchins sprout only from big visible things and swell or shrink as the parent describes the child, and the AI plants a calm-seat beacon plus a 3-bead route that the parent walks right then, so the plan is tested in the real room rather than just written down.

**Verdict:** This is the strongest kind of idea in this set. The social-good story is concrete, and the profile sentence that visibly reshapes the room is a real AI beat that judges can see working. It has two weak spots. The best triggers (hum, a hand dryer behind a door, smells) cannot be seen in one frame, so the hero shot depends on Gemini not hallucinating. And without the spatial re-rank it is "HushMap plus a social story app", which a phone AR app could largely do. Wow is capped at 7 because the urchins are small inside a 46-degree FOV, and the story and cards section in the back half of the video is the most boring and most commodity part.

**Killer risk:** The AI's output for one frame decides the whole jaw-drop beat, and it is the least reliable part. Gemini has to (a) name real sensory triggers in an ordinary lobby and (b) return boxes good enough that Depth Cache drops each urchin on the right object. Several of the best triggers in the script cannot be seen in a single frame: a light's buzz or flicker, a hand dryer behind a closed door, the smell of a coffee machine. So Gemini will either hallucinate them in plausible-looking spots or skip them, and the urchins land on blank wall or in mid-air while the parent watches. A second risk is the microphone. ASR (VoiceML) and MicrophoneAudioProvider both want the mic. If they cannot run at the same time, the 'spikes throb with the real hum' beat stops during speech, or ASR fails. Also, the 30 s video only works if the venue frame gives clean results on the first try, and the demo has to be filmed at a real lobby-like location, which takes time from build hours. Lesser risks: the story cards stacked beside each spot drift toward the banned 'floating 2D screen' look. The 'calm seat' choice is a guess from one frame that a judge with autism experience could challenge. The ethics of reducing a specific child to 'spike' creatures needs careful framing. Docs check: the Spectacles permissions overview says camera and mic plus internet are blocked in published Lenses, except that Remote Service Gateway to Snap internal services is allowed with sensitive data. So Gemini via RSG with the camera is legal, but avoid plain fetch or Connected Lenses in the same Lens. MicrophoneAudioProvider getAudioFrame/start/stop exist in Lens Scripting (v145+). I did not confirm on device that ASR and the raw mic run at the same time.

**Closest existing:**
- [HushMap / Sensly / Sensory Maps / Quokalm / Jome / ComfortMap (crowdsourced sensory venue maps)](https://devpost.com/software/hushmap): Same user need (autism parents scouting places for noise, light and crowds before a visit). They use ratings, mic decibel readings and heatmaps on a 2D map. None do a live in-room walkthrough, anchor anything to physical objects, or pick a seat.
- [Social story makers (Social Story Creator AI, Accessible Hive, Touch Autism, Schedule n Stories)](https://www.socialstorycreator.app/): Same output: a personalized story built from photos of the real place. They are 2D apps with no spatial scan and no automatic trigger detection. The AI-written story is the weakest differentiator, because this feature is already commodity.

### 3. Teacup Tower: Balance Practice the Kitchen Can See (70.5)

A daily balance-practice game for older adults. The cups are stacked on the real kitchen counter and lean with her amplified head sway, so you can watch her wobble against a fixed real edge. An AI coach watches the sway trace, talks with her mid-set, and rebuilds tomorrow's routine around her.

**Verdict:** This is one of the more buildable concepts so far. Its core sensor is head pose, the most reliable one on the device, and falls in older adults are a serious social-good problem. As pitched, though, the hero shot can't be filmed: Spectacles capture is POV only, so the sway cancels out and looks like camera shake. HoloLens sway-game pilots already exist, so a health judge may see it as a port. The AI is the thinnest part. The pick of a safe support and the 'ask about her BP med' line feel tacked on, and the med line is a medical overclaim that could cost the impact score.

**Killer risk:** The build is easy. The real risk is the 0-4 s video beat. 'Close on Grandma with a glowing tower swaying in front of her' is a third-person AR shot, and Spectacles capture only records the wearer's POV. In POV, head sway also moves the camera, so the tower's motion mostly cancels out on screen and reads as a shaky shot, not as a tower wobbling in sync. Getting a third-person view takes a second Spectacles in a Connected Lens session (only Spectacles can join, and colocated alignment adds setup and bugs) or a composite made in post. Two smaller risks: (1) head pose mixes real body sway with neck motion like glancing at the cups or nodding while talking. Fix: show the tower straight ahead at eye height, sample only translation in the horizontal plane, and mute voice AI during the hold. (2) Medical overclaiming ('clinical sway sensor', 'ask about her BP med') can sink an impact-focused judge. Frame it as a trend flag, not a diagnosis, and don't call it validated. Also cast a willing older actor early, with a spotter in frame.

**Closest existing:**
- [HoloLens AR balance training pilot (BMC Geriatrics 2021): older adults, games, headset-measured sway](https://bmcgeriatr.biomedcentral.com/articles/10.1186/s12877-021-02061-9): High on concept: AR headset games for older adults with sway measured from the headset. Academic pilot only, HoloLens, not a consumer product, no AI planning, no cloud history, and the results were mixed.
- [HMD-based balance evaluation with holographic feedback (Sustainability 2019, HoloLens)](https://doi.org/10.3390/su11226453): High on mechanism: headset IMU head displacement correlates with center-of-pressure sway, and holographic objects give real-time feedback. Validation study in young adults only.

### 4. Sun Clock: The Afternoon That Hurts Grandma (70)

Look at the real sunlight on Grandma's floor right now. The Lens locks onto it, then fast-forwards the sun to a July heat-wave afternoon. Glowing patches crawl across her room and land on her chair, her pill shelf and her bed. The AI reasons about each object it sees ('her insulin sits in 2 hours of direct sun, that is above its 30 C storage limit'), ranks the fixes for her specific risks, checks each fix from one frame, and replays the afternoon to prove it worked.

**Verdict:** The sun-patch timelapse sliding onto a real chair is a strong visual that is new in XR, and it fits the additive display well: small, bright and anchored to the floor. But the impressive part is deterministic NOAA math, and the AI is a generic heat-advice writer plus a yes/no blind check, so AI Horizons and ManageXR judges will see it as weak. The idea also depends on indoor compass heading and window geometry from loose boxes. A 20-degree error makes the patch miss the chair and the 'proof' becomes theater. As pitched it is a solid 7 that slides to a 5 if the patch is visibly wrong on camera.

**Killer risk:** The sun patch only looks right if the Lens knows true north inside world-tracking space AND knows the exact window rectangle in 3D. Both are weak points. (1) The Location docs say heading improves as the user walks, needs about 20 s of rotation to initialize after an OS install, and is magnetometer-based. Indoors near steel, appliances and the laptop running the demo, expect errors of 10-30 degrees, and the heading can drift relative to the world-tracking frame. A 20-degree azimuth error moves a 3 PM patch by a meter or more, so it misses the chair and the 'proof' becomes theater. (2) Window glass does not get meshed (it reads as a hole or as whatever is behind it), and Gemini boxes are loose. So the window corners can't come from vision or hit-testing on the glass, and a wrong window size or height warps the parallelogram. Lesser risks: (a) The demo is in November at Stanford, where the sun is low (about 30 degrees elevation at noon) and the day is short. The real patch geometry differs from the 'heat wave' story, so the team has to simulate a July date, which judges may question. (b) Multi-ray hit tests onto a lumpy World Mesh (rug, chair) give jagged patch edges unless the projection is precomputed and smoothed. (c) Getting a lowered blind to clip the patch needs the blind's bottom-edge height, and a vision 'blinds down' check alone can't provide it. (d) The flashy visual is deterministic math. Judges on the AI tracks may see the AI as a plan writer plus a yes/no check, so the plan has to visibly reason over the predicted sun hours and the risk factors.

**Closest existing:**
- [SunOnTrack (AR sun path in camera view, shows sun path at a window)](https://www.sunontrack.app/): Same core physics (date, location, sun path overlaid in AR, window use case). No floor-patch timelapse, no personalized risk plan, no vision verification. Phone-only.
- [Sun Tracker AR (sun path and shadow simulator, sun/shade report)](https://suntracker.app/): AR sun path and shadow simulation with a daily sun report, but exterior and shadow focused, not interior patches through windows. Not tied to heat safety.

### 5. Glass Ghost: Fix the Window That Kills Birds (69.5)

At dusk, a glowing ghost warbler flies into the tree reflected in your window and shatters into feathers. Gemini reads the pane like a bird would, lays out glowing guides for real tape dots, then checks your actual dots and only lets the next bird turn away once your fix is good enough.

**Verdict:** The bird hitting the glass is a strong, emotional opening shot, and nobody seems to have done bird strikes in XR. The problem is that the hero moment depends on the one thing Spectacles cannot sense: glass. A sunlit window will also wash out the additive glow, so if anchoring fails the bird hits empty air and the pitch is gone. The AI work as written is mostly tagging a photo, and the payoff (a virtual bird dodging virtual dots) changes nothing in the real world. Judges will read it as a staged effect unless the AI checks a real physical fix.

**Killer risk:** Depth and World Query cannot see glass. The hit test ray-casts against a depth map, and a clear pane gives either no depth or the depth of what is behind it or reflected in it. A pinch on the glass, or a Depth Cache lookup at Gemini's pane bbox, returns a point on the tree outside, the fern behind, or null. The bird then hits empty air a meter beyond the window, and the dot grid floats off the pane at a tilt. That breaks the spatial hook ("the bird hits the real glass"), and it breaks during the 0-4 s shot that carries the pitch. A second risk hits the video: a sunlit patio window is the brightest thing in view, so the additive cyan bird and dots wash out against it in the capture. Smaller risk: Gemini takes 1-4 s per frame, so the reasoning step adds visible dead air unless the edit hides it.

**Closest existing:**
- [FLAP Canada FLAP App (BirdSafe DIY risk assessment)](https://flap.org): Questionnaire-based estimate of collision threat per facade that tells you which windows to treat with markers. Same goal, but no AI vision, no AR, no visual moment.
- [ProtectBirds (Hugging Face Space)](https://huggingface.co/spaces/AimeeBingmouQu/ProtectBirds): Upload a photo of a glass curtain wall and AI estimates collision risk. Similar AI-risk-from-image idea, but a 2D web demo for architects, not glasses, no AR bird, no overlay.

### 6. Firefly Anchor: Your Panic, Made Visible, Then Settled on Your Room (69.5)

The firefly swarm is a live readout of your own voice: the microphone measures how fast and shaky your speech is and turns that into how chaotic the swarm is. An AI that sees your room talks you through 5-4-3-2-1 with sensory follow-up questions about the real objects, so the swarm only calms, and lands on things, as you actually calm down.

**Verdict:** The best part is the swarm landing on a real houseplant. It is small, bright and near the object, so it suits the additive display and is a strong video shot. The idea has three weak spots. Judges will ask why someone mid-panic attack puts on a dev kit. Once the engineer's deterministic fallback is in place, the AI is effectively "pick 5 objects, then play prompts", which reads as label lookup plus a script. And the chaotic swarm is decoration, not tied to anything about the user. Grounding on Spectacles also already exists (Niche/MySight, Reality Hack 2026), so the firefly mechanic and the AI's visible reasoning have to carry the novelty.

**Killer risk:** The killer risk is the orchestration loop with realtime voice AI. The demo needs several things to happen in order: the realtime model speaks a prompt, the user looks at the object and names it, the model confirms that object (through a function call or transcript parse), the swarm flies there, and then the next prompt. With Gemini Live on the 2.0 flash-live preview, function calling and turn-taking are unreliable. It interrupts, talks over the user, mishears "the plant", and adds 1-3 s of latency, which feels anything but calming. Debugging this on-device eats the 20h. Second risk: the Depth Cache anchors come from one frame. If the 5 chosen objects are not all in that first camera view, or Gemini's loose box center lands on the wall behind the plant, the fireflies settle in mid-air next to the object. On an additive 46-degree display that reads as fake in the video. Third risk is pitch-level. Judges may challenge "panic attack + AI" on safety. The 988 handoff must be scripted and deterministic, not left to the LLM. Also, a real panicking person would not put on a dev kit. Frame it as a nightly or pre-exam grounding practice that is also available in the moment. Video risk: "hundreds of chaotic fireflies" drawn across the room will be clipped by the FOV. Keep the swarm about 0.6 m in front of the face and capture the shot with Spectacles recording, not a composite.

**Closest existing:**
- [Niche / MySight (Reality Hack 2026, Snap Spectacles mental health project)](https://github.com/Nmagic144/Niche): Same device, same domain: Lens Studio overlay that guides paced breathing, mindfulness and grounding, prioritized when the user looks stressed. It uses generic overlays and prompts, not AI-chosen real objects with a swarm settling on them. Seen only as a GitHub page, so its depth is unverified.
- [CMU HCII AR/VR stress-management research](https://www.hcii.cmu.edu/news/ar-vr-for-stress): Planned grounding practices such as naming objects around you in AR/VR, with LLM-suggested guidance. It was a prototype with no known polished demo, so it is academic prior art for the concept, not a competing product.

### 7. Left Behind: Light Piles Up Where You Never Look (68.5)

For stroke survivors with hemispatial neglect, the room grows fireflies wherever the head hasn't turned, so the space itself becomes a glowing map of the half his brain dropped. An AI therapist hides real questions in that half and checks each spoken answer against what the camera saw.

**Verdict:** This is the strongest social-good premise in the batch, and it really does need head-worn tracking. But the pitch's two best beats can't be filmed or built as written. Spectacles capture can't record the over-the-shoulder shot of fireflies the man doesn't see, and the daughter-in-a-second-pair beat conflicts with the rule that camera use and Connected Lenses can't run together. The core loop of rewards placed on the neglected side already exists in academic VR and AR work, so the only defensible new part is the AI layer that writes and grades questions about the real room. Feasibility is about 6, not the 9 the pitch claims.

**Killer risk:** The hero shot and the caregiver beat both contradict Spectacles privacy rules and how capture works. (1) Per developers.snap.com/spectacles/permission-privacy/overview, camera and microphone data cannot be used at the same time as external connectivity, including Connected Lenses. RSG and Snap Cloud are exempt, so camera plus Gemini works, but camera plus Connected Lenses in one Lens does not. Experimental mode only changes the publishing rules, it does not unlock sharing. So the 25-30s daughter-in-a-second-pair beat probably cannot run in the same Lens that captures frames. (2) The 0-5s jaw-drop is an over-the-shoulder view of hundreds of fireflies the man cannot see. Spectacles capture records only the wearer's own 46-degree first-person view, so nothing on the device can film that shot. You would need a second synced, co-located wearer (blocked by point 1) or a post-production composite. Secondary risks: (a) at setup the AI needs frames of the neglected side, which means someone has to look left. That is fine for the video, but clinically it means a caregiver does the setup scan. (b) Head yaw is only a proxy, because neglect also persists inside the visual field after the head turns. An OT judge may push on this, so frame it as scanning-therapy adherence and not diagnosis. (c) Hundreds of particle emitters anchored on hit-test points are fine, but with an additive display and a 46-degree FOV, "a whole shelf of light pouring back" will look sparse unless the particles are big and bright.

**Closest existing:**
- [Dual Task Neglect System (AR-gamified neglect assessment + rehab, coin collection in neglected field)](https://sciforum.net/paper/19383): High on the core mechanic: a game that places collectibles in the neglected hemifield of an AR headset. Tested only on healthy participants.
- [HEMIRehApp (KU Leuven) immersive VR game for spatial attention after stroke](https://www.neuropsychologylab.be/hemirehapp/): High on concept: gamified, patient-tailored headset scanning training for neglect, with a feasibility study in stroke patients. VR, not passthrough AR, and no AI.

### 8. Moth Halo: Lights Out, Verified (68)

At blue hour, look at an outdoor light and the AI reads how harmful it is from one frame plus its surroundings (open sky, a tree line, which way it faces). That judgment sets the size of a glowing moth swarm and a lost-warbler spirit. You agree on one fix by voice that fits your constraints, and the AI verifies it two ways: a before/after vision check and the camera's own jump in exposure time. The swarm scatters only when the real light has actually changed.

**Verdict:** This is the best-looking idea in the set: glowing particles around a bright lamp suit the additive display, and the swarm bursting when the light clicks off is a real 3-second hook. But it is a night shoot on a device whose SLAM, depth and auto-exposure are weakest in the dark, and ON/OFF is the only fix the AI can reliably verify. That shrinks the smart AI to a light-switch detector with a speech attached. Judges will ask why it is not phone AR, and porch-light impact is real but small per user, so impact and aiFit stay mid until the AI's judgment visibly changes the outcome.

**Killer risk:** Night operation hits the device's weakest sensors all at once. (1) 6DoF/SLAM and depth both need visible texture. On a dark porch the only bright thing is the bulb, and the area around it may be too dark. The world anchor can then drift or fail to initialize, and Depth Cache stereo depth returns nothing near a blown-out light. A swarm sliding off the lamp during the hero shot kills the video. (2) The Camera Module docs say auto-exposure is always on and manual ISO/exposure is not supported. A bright bulb therefore clips to white and the rest goes black, so "cool-white vs warm" and "shielded vs unshielded" from one auto-exposed frame are guesses that Gemini will state confidently. Only ON vs OFF is reliably verifiable. The others (color temperature, beam direction, shield) are sometimes guessable from an auto-exposed frame but are not robust in a live demo. (3) The indoor hackathon table has no porch at night. Judging needs a lamp prop and room lights down. Also note: camera plus internet needs the Transparent Permission/experimental path, which is fine for a dev demo but not publishable.

**Closest existing:**
- [iNaturalist Project PorchLight](https://www.inaturalist.org/projects/project-porchlight): Citizen-science campaign about insects drawn to porch lights and timer or motion-light fixes. It has no AR, no AI fixture analysis and no verification step.
- [Audubon Lights Out program and DarkSky Fixture Seal of Approval database](https://www.audubon.org/our-work/cities-and-towns/lights-out): The same advice (shield, aim down, warm 3000K or lower, switch off at night) as a campaign and a fixture lookup list. No photo recognition or AR.

### 9. Tip Zone: Which Drawer Kills (68)

Pinch the top corner of a real dresser. A glowing life-size twin, built from your own measurements, shows a toddler-weight glow climbing the drawer the AI picked as the trigger, and the dresser tips onto the footprints. Then the AI reruns the fall with your fix in place.

**Verdict:** The ghost dresser falling is a real flinch moment and fits the hardware: one big object, one rotation tween, small glowing content. But the two things that carry the pitch are its weakest parts. If Gemini guesses the geometry, the ghost will look visibly wrong over a real dresser. And 'strap seen' rests on spotting a small white bracket from one frame, the exact failure from the last run, which is also an ethics risk on a child-safety product. The AI as written mostly produces a hazard checklist that phone apps already offer, so aiFit and novelty both depend on making the AI's reasoning drive the simulation itself.

**Killer risk:** The ghost has to line up with the real dresser, and the payoff hinges on a bracket being seen. (1) A single Depth Cache point gives position but not orientation or size. Gemini's loose bbox plus its W/H/D guess can come back 20-40% off, and in an over-the-shoulder shot a ghost that is visibly too big, too small or rotated looks like a bug, not a twin. Tipping toward the wrong face kills the jaw-drop moment. (2) The 15-25s payoff relies on Gemini seeing an anti-tip strap or bracket from one frame. That is a small, usually white object, often behind or on top of the furniture. This is exactly the small-object, loose-bbox failure from the previous run, and a false 'strap seen' on a child-safety product is an ethical problem, not just a demo glitch. Smaller risks: the camera still plus Gemini round trip takes 2-5 s, so the 0-5s beat needs the analysis already cached. The WorldQuery Ground classification is experimental and depth updates at about 5 Hz. Lens Studio Preview returns no cameras, so all of the vision path has to be tested on device. A lens that sends frames to a backend needs Transparent Permission before publishing (fine for the hackathon, but worth noting).

**Closest existing:**
- [BabyProof (AR baby-hazard scanner, ARKit/ARCore, phone)](https://babyproof.io/): Phone AR room scan that marks child hazards by age. Covers general hazard detection, not tip-over physics or a strap check.
- [Babyproofing Home (App Store AI app)](https://apps.apple.com/us/app/babyproofing-home/id6759097698): AI flags tip-over risk from unsecured dressers, shelves and TVs from photos. Same hazard category and the same AI-reasoning role, but as a static checklist with no simulation.

### 10. Spark Gap: Brown-Bag Lightning (67.5)

A caregiver tips Grandpa's medicine bag onto the table, and glowing arcs crackle between the bottles that fight. Then she tells the AI one fact about him, and the arcs visibly re-wire: some flare red, new ones snap on. The result is a pharmacist question list that is already written.

**Verdict:** Lightning jumping between real pill bottles is a strong opening shot that is easy to read, and it suits an additive display, but underneath it is a commodity phone interaction checker (PillPal, Drugs.com), and judges will ask why it needs glasses. The demo also depends on reading small, curved, glossy labels from one frame at counter distance, so one misread or invented interaction sinks both the demo and the impact story. As pitched, the AI's visible intelligence is mostly lookup. The personalization ('81, kidney issues') is its smartest part and is buried at the end.

**Killer risk:** Reading small, curved pharmacy labels from one Spectacles camera frame. At counter distance (60-90 cm) with 5-6 bottles about 15 cm apart, each label covers only a few dozen pixels of text, wraps around a cylinder, and is often glossy. Gemini will misread or skip some drug names, or worse, hallucinate a plausible one. That breaks the demo, which depends on warfarin and ibuprofen being read correctly before the arc fires. There is also a credibility risk: if the LLM makes up an interaction or misjudges how severe one is, medically literate judges will dismiss the project. A safety tool that is confidently wrong is negative impact on the Virtuous Reality track. Secondary risks: (1) loose bboxes on bottles that sit close together can land the Depth Cache points on the wrong bottle or on the counter behind it, so arcs connect the wrong pair; (2) the realtime voice session plus the vision call adds 3-6 s of combined latency, which fights the "arc at 0:02" beat; (3) pointing at a thin arc to pick it is imprecise.

**Closest existing:**
- [PillPal (open-source GitHub project)](https://github.com/calistaruiz/PillPal): Photo of pill bottles read by AI, normalized via RxNorm, interaction check with FDA label data, plain-language explanation read aloud. Same core AI function, but on a phone as a list with no spatial or in-world overlay.
- [PharmacyAI (iPhone app, GPT-4o-mini)](https://pharmacyai-app.com/): Identifies drugs from bottles and boxes and answers interaction questions. Phone only, no spatial visualization.

### 11. Unbake: The Dish That Talks Back to the Kitchen (67.5)

Look at your plate and it unbakes into a floating exploded diagram of the likely recipe. The AI then hears the server's answer to your allergy question and catches it when that answer isn't really an answer.

**Verdict:** The "dinner explodes" shot is the strongest opening image in this batch, and the stack is easy for one builder (single frame, one anchor, voice). The premise is still an allergen scanner. AllergyLens already exists on Spectacles, and SafeEat, Bite Smart and similar phone apps already make the inference. That makes a phone the honest comparison, so whyGlasses is weak. The scripted green "safe" ending is a liability on an impact track: a confident wrong green can kill someone. As pitched it is a pretty reskin of a solved app with a dangerous ending. It needs a new AI job and an ending that never certifies the food as safe.

**Killer risk:** The technical stack is easy. The real risk is the safety and credibility of the claim. The scripted ending ('ring collapses back into the plate, glowing green') shows an LLM telling someone with a peanut allergy that their food is safe. Any judge on the Virtuous Reality impact track, or anyone who knows anaphylaxis, will call it dangerous: ingredient inference from one photo is probabilistic, dish ID fails on ambiguous plates (mole vs. brown sauce, a curry with no visual cues), and a confident wrong 'green' can kill someone. Second-order technical risks, each manageable: (1) Gemini vision plus JSON round trip takes 2-5 s, which kills the 'instant explosion' beat unless it is masked. (2) The AI returns ingredient names that have no matching glyph asset. (3) The 20 cm ring over a plate in a bright restaurant is dim on the additive display (fine on camera capture, weaker live at a judging table). (4) Camera plus internet in one Lens: allowed through the Remote Service Gateway path, but it needs the experimental/extended permissions setup tested on device early (hour 1), not on Saturday night.

**Closest existing:**
- [AllergyLens (Snap Spectacles, Learn AR with SPECS hackathon)](https://github.com/mukesh-Guntumadugu/AllergyLens): Same device and same problem: a Spectacles lens that checks restaurant dishes against a personal allergy, religious and fitness profile. It marks dishes green or red, and tapping a red dish shows the problem ingredient and whether the server can omit it. It works from menu items rather than the plated food. Its notes say camera reading was not working and ingredients were hand-entered. Unknown dishes get a server lookup labeled 'typical', and a dish stays amber if the lookup times out or disagrees.
- [SafeEat / PixCalo / Bite Smart / Allergy Lens (phone apps)](https://safeeat.app/): Phone apps that photograph a menu or a prepared dish and use vision AI to infer likely hidden ingredients and allergens against your profile. PixCalo matches the photo to a large recipe database. Bite Smart offers cross-contamination alerts as a paid feature. Several generate questions to ask staff. This is the same inference step, without the AR.

### 12. Fuse: Your Stove Lights a Fuse When You Walk Away (67.5)

Look at what's cooking and the AI judges its risk from one frame, then sets how fast a fuse burns. As you walk off, a glowing fuse lays itself along the exact path you take, and a spark races down it toward you. Water left to boil gets a slow, lazy spark. Oil on high gets one that catches you at the couch in 90 seconds.

**Verdict:** The glasses-native logic is the strongest part: only a wearable knows you left the stove and where you went, and unattended cooking is a real, well-documented top cause of home fires. The pitched hero shot fails, though. A third-person couch view with the rope running around a corner can't be recorded on Spectacles. In first person the rope sits behind you, outside the 46 deg FOV, and a straight pan-to-user line draws through walls. Without a visible change in the leash, judges who know KitchenGuard, iGuard and similar sensors will read this as "a stove timer with a pretty line". Live flame at the venue is also unlikely, so the AI's risk call has to be shown by contrasting two prop pans, not one real hot one.

**Killer risk:** The hero shot can't be captured honestly, and the rope's core visual fights the hardware. (1) Spectacles record only what the wearer sees. The 0-5 s third-person shot of a guy on the couch with a rope running around a corner to the pan would have to be VFX composited by the editors, and judges who know Spectacles will spot it. (2) In first person the rope is behind you, where the pan is. With a ~46 deg FOV you only see it when you turn around. There is no occlusion through walls without a scanned world mesh, so a rope "around the doorframe" draws straight through the wall unless you route it along a breadcrumb trail of your own head positions. (3) Leaving the room stresses 6DoF tracking: anchor drift, plus relocalisation in a dim hallway or a featureless room. A drifting anchor makes the rope swim. (4) A live flame and hot oil are almost certainly banned at the venue and judging table. Without them the vision AI's "oil, high flame" call is never shown for real. Overall it reads as a timer with a pretty line unless the risk reasoning visibly changes the leash.

**Closest existing:**
- [KitchenGuard Camera](https://kitchenguardcamera.com/): Stove-mounted AI camera detects active burners and unattended pots and pushes a phone alert. Same hazard (absence) and same AI-sees-pan idea, but a fixed camera and a notification, with no tether, no personalization, no wearer-aware distance.
- [CTS Smart Stove Sensor (cooktopsafety.com)](https://cooktopsafety.com/): Thermal sensor warns by voice and light when a burner is unattended and can cut power. Has a timer and an escalation ladder. Strong prior art for 'unattended cooking alarm', but no AI reasoning about food type and no spatial UI.

### 13. Burner Breath: Race the Plume (64.5)

Light a gas burner and a compact glowing ember column rises off the flame, then sends a thin bright river toward your kid's high chair, where a small glowing 'lung' fills up with a live NO2 number. You then race the AI to find the fix in your own kitchen: hood, window, back burner, or lid. Each try visibly bends the river and drains the lung.

**Verdict:** The message is strong and real: gas-stove NO2 and childhood asthma, happening every night. But the hero shot is a scripted cartoon. It would wash out on a bright white ceiling and can't fit burner, ceiling and high chair into a 46 degree FOV, so the cause-and-effect beat falls apart on camera. The AI mostly labels one frame and recites a stat. It can't truly tell a ducted hood from a recirculating one, and "is that real data?" undercuts both impact and AI Horizons. It is also a guilt lesson rather than something fun. Right now it is a decent PSA with a fragile visual, not an 8.

**Killer risk:** The hero shot (a ceiling tide crawling toward the high chair) is the part most likely to break, for two reasons. (1) Geometry and FOV: the ceiling is blank, white and has no texture, so depth and hit tests there are unreliable. With a 46 degree FOV, the user cannot see the burner, the ceiling and the high chair in one frame. So the "boils off the burner, rolls across the ceiling, creeps to the chair" beat needs a head pan, and the recording loses the cause-and-effect. (2) Visibility: an additive orange glow on a brightly lit white kitchen ceiling washes out in Spectacles capture. Kitchens are bright, and a bright ceiling is the worst background for an additive display. There is also a credibility risk for AI Horizons and Virtuous Reality: the plume is a scripted cartoon with no sensor behind it. Gemini also cannot reliably tell a ducted hood from a recirculating one in a photo. If judges ask "is that real NO2 data?", the impact claim gets weaker, unless the AI's reasoning (asking about the hood, ranking fixes for this layout) is shown clearly and the overlay is labeled as a model.

**Closest existing:**
- [From Invisible to Actionable: AR Interactions with Indoor CO2 (CHI '26 paper, arXiv)](https://arxiv.org/html/2602.01084): Phone AR research prototype with a wrist CO2 sensor. Shows pollutant as bubbles in the room, and users clear them by opening windows or aiming a fan. Same 'make invisible air visible, act to fix it' loop. It uses a real sensor and covers CO2, not gas-stove NO2. No AI scene reasoning, no child-zone targeting, not on glasses.
- [Digital Atmosphere (Studio Above&Below)](https://thentrythis.org/notes/2021/10/08/creative-ways-to-visualisesonify-of-air-quality-data/): AR headset plus wearable pollution sensor, showing a flock of particles driven by real air quality. Same visual idea of glowing particles for air pollution. It is outdoor/ambient art, not a kitchen, with no AI and no fix-it guidance.

### 14. Pop-Up: The Whisper Coach for Bedtime Stories (63.5)

A parent who struggles with English wears Spectacles and reads a picture book aloud to their child. The AI quietly whispers hard words in their ear before they stumble, suggests a question to ask the child about the picture, and each page they read makes a glowing creature breach out of the paper.

**Verdict:** The whale breaching from a real page is a strong 2-second shot. But as written the pitch can't be built: Spectacles users must be 18 or older, so the 7-year-old wearer and the child's reaction to the creature can't happen. The core gate, "the creature leaps only if you read correctly", also rests on ASR that auto-corrects children's speech and gives no confidence scores. On top of that, page-triggered 3D lenses already exist on Spectacles (the NLB/LePub lenses and a Gemini book-to-3D hackathon entry), so the visual alone won't impress judges. The AI tutoring is the real differentiator, and in this version it is the least reliable part.

**Killer risk:** The 7-year-old cannot be the wearer. Snap's Spectacles terms (snap.com/terms/spectacles) say the user must be at least 18. The frames are also adult-sized, and a demo built around a child wearing a head-mounted display will draw questions about safety and policy from judges and Snap staff. That undermines the 0-3s shot as written: no child in the glasses, no POV of a child's reading.

Second risk, close behind: the ASR docs list only `text` and `isFinal`. They give no word timings, no confidence scores and no microphone details. Child speech, misreadings and re-reads are exactly where ASR auto-corrects toward fluent text. So detecting a mispronounced 'enormous' is unreliable: ASR may transcribe the intended word even when the reader stumbles, or mangle the word when it was read correctly. If the core gate (creature leaps only when read correctly) misfires live, the AI looks dumb.

Smaller risks:
- About 30 prefabs is unrealistic for one dev. Plan on 6-8.
- Gemini takes 1-4 s per page, which is fine at page-turn cadence.
- Anchoring on a hand-held, moving book drifts, so the book should lie on a table.

**Closest existing:**
- [Snap Spectacles Augmented Reading Lenses (Singapore NLB x LePub)](https://www.designboom.com/technology/snapchat-ar-glasses-lenses-visuals-sounds-book-reading-spectacles-05-29-2025/): Spectacles lenses that scan a physical book as it is read and trigger audio and visual effects. Same device, same physical-book premise. It is not an AI reading tutor and does not listen to the child.
- [Spectacles hackathon showcase entry: book-to-3D-world lens (Gemini page snapshots)](https://developers.snap.com/spectacles/spectacles-community/hackathon-showcase): A community Spectacles lens that sends page snapshots to Gemini, gets back a keyword and shows a matching 3D model on the book. This is the same technical pipeline as our one-frame-per-page step. It targets general books and has no read-aloud feedback loop.

### 15. Echo: The Ripple That Chooses (63)

For people with low vision or field loss: say where you're going, nod, and a sonar ripple sweeps the room. The ripple ignores everything except the two or three things the AI decided matter for you and your goal, which stay lit as bright beacons placed inside the part of your vision that still works, while the hazards you can't see ping from your blind side.

**Verdict:** The hook depends on the World Mesh tracing every edge, and on Spectacles the mesh is coarse, holey, 5 Hz and blind to thin geometry, so the jaw-drop shot is the weakest part on device. A mesh-scan ripple is also a familiar XR effect that judges have seen before. The AI half ('what's ahead?' scene description plus obstacle pings) is the most common blind/low-vision hackathon pattern, so the AI looks generic. It is a solid assistive project, but it is not fun, and its novelty comes only from combining known parts.

**Killer risk:** The hero shot promises the ripple "tracing every edge" (door frames, stair edges, chair legs, a half-open cabinet door). Spectacles World Mesh is coarse, beta, 5 Hz, holey, and range-limited to about 4 m, with no semantic labels and no CPU access to indices. Thin geometry like chair legs, a cabinet door edge, or a curled rug will not be in the mesh at all, and normal-discontinuity edge lines on a lumpy, low-poly mesh render as blobby noise rather than crisp contours. Separately, the "dim hallway" setting the video wants also degrades 6DoF tracking and mesh quality, and the camera frame Gemini sees gets darker and noisier. So the jaw-drop first 5 seconds is the part most likely to look mediocre on device. A smaller risk is the safety framing: judges may challenge putting an unreliable mobility aid on low-vision users, so the pitch must call it an assistive layer, not a cane replacement.

**Closest existing:**
- [AR for VIPs, 'singing mesh' (HoloLens, student/hackathon)](https://drfoxdesign.com/ar-for-vips): Sonified the headset spatial mesh with 3D audio beacons for visually impaired navigation. Same core sonar-via-mesh idea, but audio-only, no visual ripple, no AI guide. Team found the full-mesh approach overwhelming and added a nearby-only 'Spotlight Mode'.
- [SonarSight (GitHub, Ray-Ban Meta hackathon project)](https://github.com/PranavAchar01/SonarSight): Even the name matches. Glasses camera feed, on-device YOLO, and stereo-panned sonar pings toward obstacles, built for blind and low-vision users. Audio-only, with no display and no visual ripple. Its README says the AI assistant is not part of the live runtime.

### 16. Above the Cane: Walk Maya's Body Down the Block (61.5)

A sighted volunteer loads the body profile of a specific blind pedestrian, for example Maya: 1.78 m tall, long cane, no guide dog. A glowing cyan outline of Maya's walking body then projects 3 m ahead on the sidewalk, with a ghost cane sweeping at its feet. When the volunteer stops and pinches at something, Gemini decides whether Maya's cane would find it or her face would. It gives the answer as a red glowing impact mark on her outline, then drafts a ready-to-submit 311 report and adds a shared pin.

**Verdict:** The reveal works. Most viewers really don't know a cane only covers the ground, and a ghost cane passing under a branch says that in two seconds. Everything else is fragile. The red sheet is seen edge-on and washes out in sunlight. The sparks are faked from one noisy depth point on a leafy branch against sky. The precise "1.6 m, overhangs 40 cm" line is likely to be made up. Once the reveal is over it becomes a clipboard sidewalk audit with a mocked 311 filing, which judges will read as UnCane plus AVision. Feasibility and novelty are both middling, and the fun drops off after second 5.

**Killer risk:** The core demo is a 3D height measurement of a thin overhead object, taken outdoors while walking, and that is the weakest case for the hardware. Depth on a leafy branch or a narrow truck mirror 2-4 m away against bright sky is sparse and noisy. Gemini's loose box center often lands on sky or a gap between leaves. The unprojected point can then come back missing, far away, or meters off, so "Branch at 1.6 m, overhangs by 40 cm" is a made-up number unless the point holds still. Several things compound this. 6DoF and the World Query ground hit get flaky at walking speed outdoors. Sun washes out the additive display, so the red band and sparks look faint in daylight. GPS needs the phone tethered. Real SF 311 filing (Open311) needs an API key and moderation, so that step will be mocked. There is also a visual trap: a horizontal sheet at the wearer's own eye height is seen edge-on and shows up as a thin line or nothing. The band has to span about 1.2-2.0 m, sit below eye level, and be drawn as a glowing slab or grid so it actually reads on camera. Contact sparks need a real intersection with the branch, but all you have is one noisy 3D point, so the collision has to be faked by spawning particles at that point. One subtler issue: orientation-and-mobility experts will point out that guide dogs and some cane techniques partly handle this, so the claim that a cane misses it must be worded carefully.

**Closest existing:**
- [UnCane (opencv-uncane, GitHub)](https://github.com/yadavmanan/opencv-uncane): Same problem framing: cane misses head-height branches and truck mirrors. Differs: a wearable warning for the blind user, not a sighted-volunteer audit on AR glasses.
- [Eye-as (Devpost) and sonar glasses and caps](https://devpost.com/software/project-name-tbnuld): Head-level hazard detection for blind users, with many academic and commercial variants. Differs: they warn the user and file nothing.

### 17. Don't Look Away: Spider Exposure That Moves When You Flinch (61.5)

Arachnophobia exposure as a reverse game of Red Light, Green Light. A small glowing spider freezes while you hold your gaze on it and creeps closer only when you look away, inside a safety ladder that an AI coach sets and you can stop with one pinch.

**Verdict:** Graded AR spider exposure is a solved research category. Phobys is RCT-validated and does almost exactly this on a phone, so any judge who knows XR therapy will say "already done", and the head-yaw signal alone does not overcome that. The leap onto a thin chair arm is the shot that sells the video, and it is also the least reliable part of the chain. The "speech shakiness" signal is fiction. The "70% less looking away" end card is an unsupported efficacy claim. The core is sound: real impact, head pose is a real signal, and a spider on real furniture is visceral. But as pitched it is a port with a nicer voice, not a new idea.

**Killer risk:** The money shot is the spider leaping onto the real chair arm a meter from the user. That chain depends on Gemini picking a thin, small surface (a chair arm or table edge) from one frame with a loose box, then Depth Cache or a World Query hit landing on it. Gemini boxes are loose and 5 Hz depth misses thin geometry, so the 3D point often lands on the floor or wall behind the arm. The spider then floats in air or sinks into furniture on camera, and the illusion dies in the one beat that sells the video. A second risk is the 'AI decides' beat. Realtime voice models do not reliably follow a titration protocol or emit a structured decision on cue, and they cannot measure speech shakiness. If the decision is left to free-form realtime chat, the AI may step closer while the user says 8, or ramble for 3-4 s while the video needs a crisp beat. Smaller risks: the wireframe spider needs a good rigged walk cycle (art time for a teammate), the spider may leave the 46-degree FOV when it sits at the chair arm beside the user, and clinical claims ('70% less looking away', 'therapy') draw judge skepticism unless framed as clinician-assigned homework.

**Closest existing:**
- [Phobys (smartphone AR spider exposure, RCT-validated, therapist-guided)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10911123/): Very high on concept: AR spiders placed in your real surroundings for graded exposure. Differs only in phone vs glasses.
- [Virtual Exposure Therapist (2025 AI-adaptive VR spider framework with 3 progressive scenarios)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12564376): High on AI-titrated graded exposure for spiders. VR with physiological sensing rather than AR with head-yaw.

### 18. Hooked: The Kitchen-Table Mail Sort (61)

Grandma sorts a pile of real paper mail on her kitchen table. Each scam letter sprouts a glowing fishing line with barbed hooks on its manipulation tactics, legit letters stay clean, and the AI explains how a fake copied a real one.

**Verdict:** The hook-and-line metaphor is the only original part, and it is a good one. The rest is a crowded category: scam-check, Aura and carrier filters already do the camera-reads-a-message verdict. The core use case undercuts itself. If the scam is a text on her phone, a phone app reads it better than a glasses camera squinting at a glary screen, and no grandmother owns Spectacles. The hero shot also depends on the riskiest part of the build: reading a handheld phone screen and getting depth on a moving phone. The far-off 'angler' silhouette uses a lot of the 46 degree FOV on an empty dim shape that an additive display renders poorly.

**Killer risk:** The weak point is reading a phone screen held in the hand. The Spectacles RGB camera has to read the text off an emissive phone screen at arm's length, and that screen will show glare, moire, auto-dimming and motion blur. The camera frame is also offset from the eye, so if Gemini cannot read the message, the demo has nothing to reason about. There is a second problem with Depth Cache: it gives depth for a small, moving, handheld phone, and that depth is often wrong or hits the hand or background. The line would then start from empty space instead of out of the phone, and that ruins the second-2 video beat. Latency adds to this. Pinch, then still capture, then a Gemini vision call (2-4 s), then TTS means a dead 3-5 s before the line fires, which hurts a 30 s video. Smaller risks are permission and experimental-API flags on Camera Module plus network access (the Remote Service Gateway is the supported path, but check the build settings early) and Realtime voice sessions dropping on venue Wi-Fi.

**Closest existing:**
- [oskobx/scam-check (FaceTime AI agent: hold up a letter, get plain-English verdict)](https://github.com/oskobx/scam-check): Same core loop (camera sees letter/text, AI explains red flags to a senior) but a flat video-call agent with no spatial or visual-metaphor layer.
- [Aura / Robokiller / carrier real-time call and text scam alerts](https://www.savingadvice.com/articles/2026/05/19/10736148_combatting-elder-fraud-integrated-smart-systems-can-automatically-alert-family-or-911-to-scams-and-emergencies.html): Detect scam phrases like urgency and gift cards, but as filters or alerts, not a coach and not camera- or glasses-based.

## Run 2 blueprints

# Immerse the Bay 2026: Final Build Brief (Top 3, post-attack)

**Verdict up front:** Build **Tip of the Tongue: Her Own Words Find the Fridge**. If it stalls by Hour 6, fall back to **Spike Scout**. The two share about 80% of the pipeline. The pick rests on two tests. First, which hero shot reads in real POV capture on the first take: a swarm bursting from a fridge reads well. Second, which build has the fewest unverified dependencies on device: it reuses Partsight's Camera → Gemini → Depth Cache pipeline on one big object, and an actor speaking clearly gets past ASR easily. It is also the only one that turns the judging table into a live demo, because a judge can describe an object and watch *their own words* fly into the swarm.

**Honesty note:** all three scored 70.5–73.5 *before* repair, against the previous run's 68–71.5. That gap is inside the noise. These three are safer, with fewer traps for tracking, hands and vision, but they have **not clearly broken the ~70 plateau**. Wow is 6–7 on all three, which is exactly the axis the team complained about. The section "vs. previous run" has the details.

---

## Global production notes (apply to all three)

- **Lens Studio versions:** ASR Module needs LS 5.9+ and Spectacles OS 5.61+. Remote Service Gateway needs LS 5.10.1+. Gemini Live on RSG supports only `gemini-2.0-flash-live-preview`. OpenAI Chat Completions on RSG **does not stream**. Check the project version before Hour 1.
- **Permissions:** camera or mic data sent over RSG needs the permission prompt or Extended Permissions for Experimental APIs. Using RSG with sensitive data is allowed in published Lenses. Do **not** mix plain `fetch` or Connected Lenses with camera use in the same Lens.
- **Vertical crop:** Spectacles POV capture is **not natively 9:16**. Check the actual capture aspect on device in Hour 1. Keep every hero element (swarm, urchins, tower) in the **center third** of the frame so the vertical crop never cuts it. Captions go in the top and bottom bands that the editors add.
- **Footage timeline:** the editors need real POV footage by **Hour 13–15**, not Hour 18. Filming happens at feature lock. Hours 18–20 are a reshoot and buffer slot before the Sunday 9 AM deadline.
- **Location is a real constraint:** Tip of the Tongue and Teacup need a kitchen. Look for a venue kitchenette or a teammate's apartment, and book it now. Spike Scout needs a lobby-like room with a TV, restroom door and seating. Stanford building lobbies on a Saturday night can work, but get access confirmed.
- **Banned-list check (passed):** no in-lens text cards or panels. Text appears only as single words or glyphs anchored on objects. Phone or tablet views appear only as cutaways in the edit. Input is pinch, voice and head pose. No hand-object contact and no two-hand gestures.

---

## 1. Tip of the Tongue: Her Own Words Find the Fridge (73.5)

**Attack it survived:** *"Snap ASR snaps 'frish' to 'fish' and gives no phonemes or confidence, so the near-miss grading is fake."* **Repair:** the design dropped phonemic grading and was rebuilt on **Semantic Feature Analysis (SFA)**, an evidence-based anomia therapy. SFA runs on real words she says while describing the object ("cold", "milk", "kitchen"), and ASR transcribes those well. A different real word gets a neutral "keep going" and is never labeled a sound error. Phonemic scoring is listed as future work.

### Spatial Hook
SFA works best on the patient's own familiar objects, and only glasses can build her own spoken clues into a glowing constellation around the real fridge while she looks at it, hands-free.

### Core Spatial Loop (first 30 s)
1. **Pre-scan (done once, before the session):** pinch. One frame goes to Gemini, which returns 3–4 big targets (fridge, stove, sink, table), each with an SFA feature map (use, location, property, category, association) and a list of accepted synonyms.
2. **She looks at the fridge:** about 20 blank cyan shards burst out of the door and orbit within about 0.5 m of the anchor, with a shimmer sound.
3. **She talks around the word** ("It's... cold. The milk..."): each phrase flies into the swarm as a shard labeled with *her* word plus a slot glyph (❄ property, 🥛 use).
4. **The AI sees an empty slot and asks about it** ("Where in your house does it live?"). It holds back the first-letter cue until she has given 3 or more features or stalled for a long time.
5. **She says "Fridge!"** The swarm implodes into FRIDGE with a white flash and a spatial-audio slam.
6. **Stove:** she says "cooker" and the AI accepts it as a synonym. It says "Yes, a cooker. Many people call it a stove. Say it with me," and the shards assemble into STOVE.
7. The log goes to Snap Cloud. It records which slots and cue level each word needed, and hard words come back later in the session (spaced retrieval).

### Tech & SDK Architecture
| Layer | Module | Notes |
|---|---|---|
| Scan | Camera Module (one still) → RSG **Gemini** vision, JSON schema | Returns `[{label, box, featureMap{use,location,property,category,association}, synonyms[], firstPhoneme}]` |
| Anchor | **Depth Cache** (Partsight) maps box center to a 3D point | Backup 1: World Query hit test at box center. Backup 2: point and pinch to place |
| Gaze select | Head-pose ray against anchor positions (cone of about 15°) | Wakes the swarm. No hand input needed |
| Voice in | **ASR** HighAccuracy, `silenceUntilTerminationMs ≈ 2500` | Half-duplex: ASR stops during TTS and restarts about 300 ms after. Fragments are collected for the whole turn. The turn ends on pinch ("I'm done") or 6 s idle |
| Grading | **Local first:** lemma or synonym match (correct). Keyword lexicon places features into slots | Most turns finish in under 1 s |
| Reasoning | RSG **OpenAI Chat Completions**, strict JSON `{slots:[{phrase,slot}], targetSaid, nextPrompt, useFirstLetter}` | One call per turn, for leftover phrases and the next prompt |
| Voice out | TTS (Snap TTS or OpenAI TTS via RSG) | Prompts and the modeled word |
| Visuals | Per-shard Text3D plus an emissive quad, script tweens (orbit, flip, implode), VFX spark flash | Additive-safe: bright cyan and white only |
| Audio | Spatial Audio components | Shimmer, chime, slam |
| Log | Snap Cloud (Supabase) `attempts(word, slots_used, cue_level, ts)` plus a tiny web page | Cutaway view for the SLP or family |

**Latency masking:**
- **Scan (1–4 s Gemini):** a "listening" particle ring pulses at the gaze point and spatial shimmer audio plays. Targets are locked during the pre-scan, so the live demo never waits on vision.
- **Each turn:** the local lexicon spawns a labeled shard **the instant ASR finalizes**, before the OpenAI call returns. The LLM result then re-slots the shard (its glyph flips) and sets the next prompt.
- **TTS:** cache short stock prompts ("Keep going", "Say it with me") as pre-rendered audio. Run live TTS only for dynamic questions.

### Asset Shortcut Strategy
- Shards are a single emissive rounded quad prefab plus Text3D. Use no custom meshes.
- Slot glyphs are 5 PNG icons (Material Symbols or Noto emoji), with an additive material.
- Implode flash: reuse a Lens Studio VFX template (sparks or burst) and recolor it.
- Audio: freesound.org CC0 shimmer, chime and impact files. Run them through one reverb send.
- The SLP view is a single static HTML page reading Supabase. A teammate builds it in Figma, then codes it as plain HTML.
- Copy the Partsight scene wholesale: camera capture, the RSG wiring and Depth Cache are already done.

### Build Milestones (about 20 h)
- **H0–1:** check LS version and capture aspect on device. Fork Partsight. Book the kitchen.
- **H6, core:** the pre-scan anchors swarms on fridge and stove. Gaze wakes a swarm. ASR turn collection works (half-duplex). The local lexicon spawns labeled shards. Saying the target word implodes the swarm.
- **H12, feature lock:** OpenAI slotting and next-prompt JSON work, the first-letter cue is held back, synonym acceptance works ("cooker" → STOVE modeling), the Snap Cloud log is written, and the SLP page is up. **Freeze code.**
- **H12–15, filming block:** actor as "Rosa" in the kitchen. Get 3 clean takes per beat plus B-roll of the swarm bursting. The editors start cutting right away.
- **H18, polish and audio:** spatial audio mix, glyph polish, shard timing tuned for camera. Devpost text and repo README, including the limits stated openly. Prepare the judging-table demo flow.
- **H18–20:** reshoot any weak beat, export the final video, submit.

### 30 s Vertical Storyboard
| s | Shot | On screen / audio |
|---|---|---|
| 0–2 | POV: kitchen, fridge in center frame | About 20 cyan shards **burst out of the door** and orbit. Shimmer SFX |
| 2–4 | Hold on the swarm | Caption: *"After her stroke, Rosa knows what this is. She can't find the word."* |
| 4–7 | Swarm orbiting | Rosa (VO): "It's... cold." The shard flips to **COLD ❄** and locks on with a chime |
| 7–9 | Same | "The milk..." **MILK 🥛** flies in |
| 9–11 | Swarm shows a gap | AI (warm TTS): "Where in your house does it live?" |
| 11–13 | Same | "Kitchen." Third shard locks on. Caption: *"The AI builds the clue from HER words."* |
| 13–16 | Implosion | "Fridge!" The swarm **slams into FRIDGE** with a white flash and slam SFX |
| 16–19 | Whip to the stove | A new swarm bursts. "The hot... cooker." |
| 19–23 | Stove | AI: "Yes, a cooker. Many people call it a stove. Say it with me." The shards assemble into STOVE as she repeats it |
| 23–27 | Phone cutaway (SLP view) | *"9 objects named. Use clues help most. Stove: 3 clues Monday → 1 today."* |
| 27–30 | End card | *"Tip of the Tongue: practice between therapy sessions, on your own things."* Actor portrayal disclosed |

### Killer Risk + Fallback
- **Risk:** halting real-patient speech still fragments. A clinical judge may also push on "is this validated?" and on the ethics of the framing.
- **Fallback:** fragments are collected across the whole turn, pinch ends a turn, and the idle timeout is 6 s. The demo uses an actor, disclosed on screen. The pitch says "home practice between SLP sessions, not a replacement," cites SFA as the evidence base, and states openly that sound errors are not graded.
- **Tech fallbacks:**
  - If Depth Cache fails, use a hit test, then point and pinch.
  - If OpenAI is slow, the local lexicon alone drives the shards and a fixed slot-order policy picks the next prompt.
  - If live TTS is slow, use the pre-rendered prompts.
- **Unverified on device:** how ASR handles 2.5 s silences in HighAccuracy mode. Test this in Hour 2.

### Closest Existing + How We Differ
- **AphasiaGPT** (https://aphasiagpt.ai/): a phone or web camera word finder with AI hints. *We differ* by anchoring cues on the real object in AR, using SFA slotting built from her own words, and holding back the stronger cue the way an SLP would.
- **iName It, Smarty Ears** (https://www.smartyearsapps.com/iname-it/): a fixed cue hierarchy on an iPad. *We differ* because our cues are generated from what she actually says, on her own objects.
- **Tactus Therapy Naming Therapy** (https://tactustherapy.com/app/naming/) and **Constant Therapy** (https://constanttherapy.com/): pre-written cue ladders on a tablet. *(URLs from prior knowledge, not re-verified this run.)* *We differ* in the same way: live cues from her own words, on real objects.
- **KCL smartglasses co-design study, Sci Reports 2025** (https://www.nature.com/articles/s41598-025-22253-2): validates the need and warns that gestures are awkward and that ASR can misread aphasic speech. Cite it as support for voice plus pinch only and for honest grading.
- **AR aphasia concept paper** (https://www.researchgate.net/publication/309516479_Language_Therapy_of_Aphasia_Supported_by_Augmented_Reality_Applications) and **HearThrive / WordFinder hackathon projects** (https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/gallery/3974): academic or phone-based, with no shard mechanic and no SFA loop.

---

## 2. Spike Scout: The Sensory Audit That Interviews the Room (73)

**Attack it survived:** *"The parent already knows the kid and the room, so the AI just repeats the parent back to them, and Leo never wears the glasses."* **Repair:** the wearer becomes the **venue's front-desk staffer**, who knows the building but not sensory accessibility. The AI **measures** dB at each spot, a number a person can't perceive. It **interviews** the staffer about hidden or timed triggers it infers from what it sees, and it **re-plans per sensory profile**. One walk publishes a guide for every future family.

### Spatial Hook
The audit only works by walking the real floor. The staffer pinches at each spot to sample real decibels there, and the AI pins triggers and a quiet route onto the physical objects and floor, hands-free.

### Core Spatial Loop (first 30 s)
1. Pinch to scan. One frame goes to Gemini, which lists only big visible objects (TV, ceiling speaker, restroom door, hallway door, fish tank, seats) with loose boxes.
2. Magenta urchins pop onto each object through Depth Cache. Their spikes throb at the dB just measured, with a small glowing number near each.
3. The AI asks inferred questions aloud: "Restroom sign. Is there a hand dryer?" The staffer answers: "Yes, and the drill starts at nine." The restroom urchin swells, and a new urchin bursts onto the hallway door tagged "drill 9–12".
4. "Plan for a sound-sensitive kid." A teal calm orb arcs to the 47 dB corner chair, and 3 floor beads drop along a route that skirts the restroom. Each bead chimes as she walks past it.
5. "Now a light-sensitive kid." The urchins re-rank, the orb flies to a different seat, and the beads redraw.
6. A badge reads *"Sensory guide published: 2 profiles."* The guide goes to Snap Cloud.

### Tech & SDK Architecture
| Layer | Module | Notes |
|---|---|---|
| Scan | Camera Module still → RSG Gemini vision (JSON) | Big visible objects only |
| Anchors | Depth Cache maps box center to 3D. World Query snaps to wall, ceiling or floor | If depth fails, place at a fixed distance along the box ray |
| Measure | **MicrophoneAudioProvider** `getAudioFrame` RMS → dB, sampled at each pinch spot during the measure phase only | Run `stop()` before ASR starts. **Running both at once is unconfirmed on device.** If they conflict, replay the stored dB |
| Pass 2 | Gemini text call (JSON): objects + dB + audit rubric → `questions[]` | Inferred hidden or timed triggers |
| Answers | ASR → Gemini folds answers in → `triggers[{id, status: confirmed/dismissed/timed, window}]` | |
| Pass 3 | Gemini, once per profile → `{severity per trigger, calmSeatId, waypoints[3], reasons[]}` | One spoken reason per choice |
| Output | TTS for questions and reasons. Spatial-audio bead chimes. VFX urchins (spike scale driven by dB × severity) | |
| Publish | Snap Cloud guide JSON plus social story text, read on the family's phone | Cached hero-lobby JSON replay switch, clearly labeled in the repo |

**Latency masking:**
- The urchins appear first as "scanning" seed particles at the box centers while pass 2 runs.
- The first audit question is pre-generated during the scan, so TTS starts the moment the urchins land.
- Profile re-plans tween the urchins toward their new sizes as soon as the profile name is recognized, then settle when the JSON arrives.

### Asset Shortcut Strategy
- Urchin: an icosphere with instanced cone spikes (one prefab), an emissive magenta material, and a vertex or scale pulse from script.
- Orb and beads: sphere primitives with additive glow and a trail.
- Use small Text3D for dB numbers and tags only. Use no panels.
- Audio: CC0 chimes. TTS for everything spoken.
- The family phone guide is a static HTML page reading Supabase.

### Build Milestones
- **H6, core:** scan → urchins on real objects (reuse Partsight). dB sampling per pinch. A single profile → orb plus 3 beads.
- **H12, feature lock:** generated questions → answers fold in → confirmed or timed urchins. Two-profile re-plan. Snap Cloud publish. Cached replay switch.
- **H12–15, filming:** lobby venue (access confirmed beforehand), staffer actor, 3 takes per beat.
- **H18, polish:** urchin pulse feel, spatial mix, Devpost.
- **H18–20:** reshoot and submit.

### 30 s Vertical Storyboard
| s | Shot | On screen / audio |
|---|---|---|
| 0–3 | POV lobby, pinch | **Urchins pop** onto the TV, speaker, restroom door and hallway door, throbbing. "64 dB" glows near check-in |
| 3–6 | Urchins | Caption: *"Every autistic kid's dentist visit starts here."* |
| 6–9 | Restroom urchin | AI: "Restroom sign. Is there a hand dryer?" |
| 9–12 | Hallway door | Staffer: "Yes, and the drill starts at nine." The restroom urchin swells hot pink and a **new urchin bursts onto the hallway door**: "drill 9–12" |
| 12–14 | Wide | Staffer: "Plan for a sound-sensitive kid." |
| 14–18 | Orb arc | The teal orb flies to the corner chair ("47 dB"). 3 beads drop. The staffer walks the route and each bead chimes |
| 18–20 | Same | "Now a light-sensitive kid." |
| 20–24 | **Re-plan** | The urchins reshuffle (fluorescent panel and TV swell, speaker shrinks). The orb flies to the window bench. The beads redraw underfoot |
| 24–27 | Badge | *"Sensory guide published: 2 profiles"* |
| 27–30 | Phone cutaway, end card | A family opens the guide. *"Spike Scout: one 5-minute walk, every family after."* |

### Killer Risk + Fallback
- **Risk:** Gemini's single frame lands urchins on blank wall, or the mic and ASR conflict and kill the measured-dB beat. Venue access eats filming time.
- **Fallback:**
  - Restrict to big visible objects and hedge every tag as "likely" until the staffer confirms it.
  - Snap urchins to the nearest wall or ceiling hit.
  - Use stored-dB replay if the mic conflicts.
  - Keep the cached hero-lobby JSON (labeled).
  - Cut scope in this order: Snap Cloud publish, then the second profile, then live mic.
- **Credibility:** follow published sensory-friendly design heuristics, with no clinical claims.

### Closest Existing + How We Differ
- **HushMap and other sensory venue maps** (https://devpost.com/software/hushmap): crowdsourced 2D ratings and heatmaps. *We differ* because the audit is done in the room, by the staffer, with measured dB, AI-generated questions and a re-plan for each profile.
- **Social Story Creator AI** (https://www.socialstorycreator.app/): a commodity story maker. For us it is only a by-product, not the pitch.
- **Autism AR research, Brain Power / Glass** (https://spectrum.ieee.org/nonverbal-autism): social-cue teaching, not venue auditing.
- **Venue sensory certification programs, e.g. KultureCity Sensory Inclusive** (https://www.kulturecity.org/): paid, consultant-led certification. *(URL from prior knowledge, not re-verified this run.)* *We differ* with a self-serve 5-minute audit that staff can redo after a remodel.

---

## 3. Teacup Tower: The Balance Game That Only Says "Slow Down" (70.5)

**Attack it survived:** *"An LLM deciding when an 80-year-old at fall risk can let go of the counter is either decorative or a liability."* **Repair:** progression lives in a PT-owned **care card** in Snap Cloud that the AI cannot write to. The AI can only **shorten, reorder or stop** a session. It parses free speech for red flags ("woozy", "chest tight"), and a hard-coded stop rule then ends the session. It runs a one-frame safe-spot check. The tower moves to **eye height** so her gaze stays forward. The impact claim is **adherence**, not detection.

### Spatial Hook
The tower is world-locked at eye height on her own backsplash, above the counter her hand is holding. Her head is the sensor and the cabinet lines are the fixed reference, so the game sits exactly where the exercise happens.

### Core Spatial Loop (first 30 s)
1. "Let's practice." One frame goes to Gemini for the safe-spot check: "Counter's solid. That bath mat behind your left heel, slide it away first?"
2. A wall hit test plants a gold ledge on the backsplash at eye level, and 5 glowing teacups stack onto it with chimes.
3. Pinch to start. She lifts a foot. The cups lean opposite her horizontal head sway at about 6× gain, against still cabinet edges. Every 10 steady seconds adds a cup.
4. A wobble (above 2 cm from her baseline) tips the tower. The top cup slides off and bursts into gold sparks with a porcelain clink.
5. Between sets only, the realtime voice check-in asks: "How's that knee?" She says, "Bit cranky, gardening." The AI swaps one-leg holds for heel raises and keeps them short, within care-card limits.
6. The adherence log goes to Snap Cloud, and family get a weekly note.

### Tech & SDK Architecture
| Layer | Module | Notes |
|---|---|---|
| Sway | Camera transform `getWorldPosition()` each UpdateEvent, horizontal plane, high-passed | Drives tilt and steady-seconds against her baseline (about 2 cm threshold, well above VIO jitter). Visuals only, never a clinical measure |
| Placement | World Query HitTestSession on the wall or backsplash | Ledge at eye height |
| Safe spot | Camera still → RSG Gemini vision JSON `{supportOk, hazards[], spokenReason}` | |
| Coach | RSG OpenAI Realtime **or** Gemini Live (2.0 flash live preview only). Fallback: ASR → one text call → TTS | **Muted during holds.** Gets the care card plus the sway summary JSON |
| Guardrail | Hard-coded red-flag stop. The AI can only output actions from `{shorten, reorder, rest, stop}` | Care card is read-only to the AI |
| FX | Emissive teacup mesh ×5, gold particle burst, spatial clink and chime | |
| Data | Snap Cloud `care_card`, `sessions(date, stance, steady_s, said)` | Care card seeded by hand |

**Latency masking:**
- The safe-spot check runs while the ledge and cups are animating in.
- Voice turns happen only in the rest periods between holds, when a pause is natural.
- The sway loop is fully local, with zero network in the game loop.

### Asset Shortcut Strategy
- Get a teacup from Sketchfab or Poly Haven (CC0/CC-BY) and decimate it. Use one emissive gold material.
- The ledge is a scaled cube.
- Use a stock spark VFX.
- Get a porcelain clink from freesound CC0.
- **Docs for this idea came from memory. Verify the head-pose, hit-test and Realtime APIs in Hour 1.**

### Build Milestones
- **H6, core:** the ledge lands on the wall, sway drives tilt, steady-seconds adds cups, a wobble drops a cup with sparks.
- **H12, feature lock:** safe-spot check, voice check-in between sets with care-card guardrails, red-flag stop, Snap Cloud log. **Cast an older actor and book a spotter.**
- **H12–15, filming:** kitchen. Spotter disclosed as standard filming practice.
- **H18, polish and audio.**
- **H18–20:** buffer.

### 30 s Vertical Storyboard
| s | Shot | On screen / audio |
|---|---|---|
| 0–4 | POV: gold teacup tower at eye height above the counter | The tower **tilts further and further** against still cabinet lines, the top cup slides off into gold sparks, clink. Caption: *"Her wobble, made visible."* |
| 4–8 | POV floor glance | AI: "That bath mat behind your heel, slide it away first?" She moves it |
| 8–14 | Tower rebuild | Pinch, foot lifts. A steady hold adds cups with chimes |
| 14–20 | Rest beat | AI: "How's that knee?" She says, "Cranky, gardening." AI: "Heel raises today, short holds." |
| 20–24 | Caption | *"It can only say slow down. Her PT sets the rest."* |
| 24–28 | Phone footage (labeled, no AR) | The actor laughs as she sets her foot down |
| 28–30 | Family phone note | *"5 of 7 days this week."* End card |

### Killer Risk + Fallback
- **Risk:** in POV, head sway also moves the camera, so the tilt can read as a shaky shot. Novelty is the weakest of the three (HoloLens sway games already exist).
- **Fallback:**
  - Use 6–8× gain and lean the tower opposite her sway against still cabinet lines.
  - For the hero shot, composite a 3D tower driven by the logged sway CSV onto phone footage, labeled "visualization of recorded data".
  - If Realtime voice is flaky, use ASR → text → TTS.
  - If Snap Cloud slips, use a local store and a seeded week.

### Closest Existing + How We Differ
- **HoloLens AR balance pilot, BMC Geriatrics 2021** (https://bmcgeriatr.biomedcentral.com/articles/10.1186/s12877-021-02061-9) and **HMD sway feedback study** (https://doi.org/10.3390/su11226453): validate the mechanism, but have no AI, no voice and no guardrailed coach.
- **McMaster AI-adaptive AR falls trial** (https://trial.medpath.com/clinical-trial/789e80b8868c41b0/nct07781995-ai-augmented-reality-training-falls-older-adults): ML that *increases* difficulty. *We differ* because our AI can only make a session easier, and the PT owns progression.
- **Konstanz balance AR glasses** (https://www.gesundheitsindustrie-bw.de/en/article/news/fall-prevention-help-balance-enhancing-ar-glasses): stabilization patterns, not a game.
- **IMU fall-detection eyeglasses** (https://pmc.ncbi.nlm.nih.gov/articles/PMC10221500/): detection, not training.

---

## vs. the previous run's best (honest)

| | Total | Hero visual | Core tech risk | AI depth |
|---|---|---|---|---|
| Glow Trail | 71.5 | **Strongest jaw-drop (handprint reveal)** | Fingertip contact is noisy. Gemini judging of scrubbed regions is close to random. Glo Germ already owns the reveal | Weak |
| Point and Name | 69 | Strong (beams on strangers) | Cross-frame tracking is a trap. 'Someone' owns bystander framing | Strong |
| Red Ceiling | 68 | Strong physical hook | Crawling breaks tracking. MR fire escape exists | Thin |
| **Tip of the Tongue** | 73.5 | Good (swarm from the fridge, her words fly in) | Low. Reuses Partsight. Actor ASR is clean | **Visible and personal** |
| **Spike Scout** | 73 | Good (urchins, live re-plan) | Medium. Mic and ASR together unconfirmed. Venue needed | **Strongest reasoning** |
| **Teacup Tower** | 70.5 | Medium (POV wobble legibility) | Lowest build risk | Moderate (guardrailed) |

**Verdict:**
- **Where these beat the previous run:** buildability and AI credibility. None depends on hand contact, cross-frame tracking or crawling, and every AI beat is something a judge can watch reason on camera.
- **Where they don't:**
  - Raw jaw-drop: Glow Trail's handprint shot is still the most arresting single frame, and nothing here clearly tops it.
  - Score: the totals were assigned before repair and are within 1–3 points of the old ones, which is noise. Expect roughly 72–75, not a breakthrough.
- **Biggest lever left:** the first 2 seconds of footage. Over-invest in shard density, brightness and the burst sound for Tip of the Tongue.

---

## Recommendation: build Tip of the Tongue

1. **Hero shot reads in POV on the first take:** a big, still fridge with a bright swarm in center frame, and no reliance on the wearer's own motion (unlike Teacup).
2. **Fewest unverified on-device dependencies:** the Camera → Gemini → Depth Cache path is already proven in Partsight. ASR with a clear-speaking actor is low risk. No mic and ASR concurrency issue (unlike Spike Scout). No venue access needed beyond a kitchen.
3. **Track fit:**
   - Virtuous Reality: about 2M Americans live with aphasia, and practice dose is the bottleneck.
   - AI Horizons: SFA reasoning over her own words, with a strategy for which cue to hold back.
   - ManageXR: the AI sees her real objects and helps with a daily task that repeats.
4. **Judging-table demo:** a judge describes the fridge and watches their own words become shards. Spike Scout and Teacup can't match that interactivity.

**Fallback:** if the swarm is not anchored and imploding on a real object by **Hour 6**, pivot to **Spike Scout**. It uses the same scan and anchor pipeline, so the Hour 6 work carries over.

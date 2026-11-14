# Sightlines: a Stanford tour guide in your glasses

Working concept, revised November 14, 2026 (third pass).

**What this pass changes:**
- The team narrowed the scope to **the Stanford tour guide's job**: facts about the buildings, the founders and namesakes behind them, and what happens inside. History is a seasoning, not the theme.
- **Point-to-guess** is now the core "learn something new" mechanic.
- It keeps the strongest fixes from the [multi-agent analysis](sightlines-analysis-results.md):
  - one surveyed registration method,
  - a floor map that lifts to table height,
  - AI that answers across the whole map,
  - pre-rendered narration,
  - a demo designed for the basement.
- The time scrub and 1906 quake from that analysis are dropped.
- The trust model comes from [place-stories](place-stories-concept.md): every fact has a source, and the AI only picks and frames facts.

## One sentence

A 3D map of Stanford unfolds at your feet, lined up with the real campus. Ask about any building and your guide tells you who it's named for, the founder story behind it and what happens inside, then challenges you to point to the next one.

## What a tour guide does, and what the glasses do

| Tour guide | Sightlines |
| --- | --- |
| "You're here, and that's Hoover Tower over there" | The floor map with you on the dot. Beams from the mini buildings to the real ones |
| Answers "what's that building?" | Look at it (real or on the map) and ask |
| Tells the founder story behind a name | Each building's card holds the namesake, their company and why they gave, all sourced |
| Tailors the tour to the group | Tell it what you're into, and "your Stanford" lights up on the map |
| Keeps you engaged | **Point to guess**: "Point to where you think Gates is." You're scored in degrees, then the next fact unlocks |
| Groups related stops | "Which buildings are named after tech founders?" lights a constellation on the map |

## Design rule: show the story in 3D, don't read it

**Voice tells the story and 3D shows it.** Text is limited to short labels on the buildings. If the answer is a floating text card, we built a phone app. So each building story gets a 3D moment, on the map and on the real building:

| Story | 3D visual |
| --- | --- |
| Founder behind the name | The building rises and glows, and an arc flies to where the company started (the HP garage edge pointer) |
| When it was built | The building grows out of the ground in its year, and same-era neighbors light up |
| What changed (Memorial Church's spire, 1906) | A glowing wireframe of the missing piece appears where it stood, then falls |
| How big it is (Hoover, 285 ft) | A true-scale outline to look up at |
| How buildings connect | A constellation of glowing buildings linked by threads |

All of these are bright wireframes, glows and arcs, because the additive display can't render dark shapes.

## The experience

### 1. "You are here": the floor map

- A 3D model of central campus unfolds on the floor around you. It is about 1.5 m across at roughly 1:1350, so the map covers about a 1 km radius.
- You stand on the dot. **Your own building glows**, and in the judging room that building is Huang.
- The map is **north-aligned and registered to where you actually stand**, so mini Hoover sits in the same direction as the real Hoover.
- A beam runs from each highlighted mini building toward the real one, through walls if it has to.
- One pinch lifts the map to table height. That's where you spend the rest of the time, because a raised map fits in the 46° field of view and works at a crowded table.
- Buildings off the map, like the HP garage 2.4 km away, show as **edge pointers** with a distance.

### 2. Where you are and what you're looking at

- A ray along your head direction picks the building you're looking at, on the map or in the real world, and highlights it.
- When two candidates are close together, the AI uses the wording of your question ("the church") or asks you to confirm.

### 3. Ask the guide

You can ask about one building:
- "Who's this named after?"
- "What happens in here?"
- "What's the story behind Huang?"

The guide answers with the namesake and founder story, what's inside, and one surprising fact. **The map shows the answer too**: the building rises and glows, and related buildings light up.

You can also ask across the whole map:
- "Which buildings are named after tech founders?" Huang (NVIDIA), Y2E2 (Yahoo), Gates (Microsoft), Shriram (early Google investor), Packard (HP) and Spilker (GPS) all light up, and threads run to the garage where HP started.
- "Where do CS classes happen?"
- "Show me the buildings from the 1890s."

**How the AI works:**
- One validated function call per question returns `lights[], threads[], fact_ids[], connective`.
- **What gets dropped:** any building or fact that isn't in the cards is rejected and shown in a debug overlay. Questions with no card coverage get a polite "my notes don't cover that".
- This is the AI Horizons story: the model chooses *which places* answer your question and explains the pattern in space. It isn't reading out a paragraph.

### 4. Personalized

- **Setting it up:** at the start, say one sentence, such as "I'm a CS major who wants to start a company" or "I'm a parent and I like architecture".
- **Your Stanford:** 3–4 matching buildings glow at once, with a suggested walking order. That suggested walk is what "your Stanford" means.
- **Answers:** later answers lead with the facts that match your interests.

### 5. Something new: point to guess

After each building, the guide quizzes you on a nearby one:
1. **"Point to where you think the Gates building is."** Raise your hand and point: the real direction if you're outside, or on the map.
2. The true direction appears as an arc, along with your score: **"off by 14°"**.
3. One new sourced fact about that building unlocks. Your streak and best score are kept.
4. Repeat. Each building has 4–6 facts tagged by theme (namesake and founder, what's inside, architecture, fun fact), and the guide never repeats one.

**Why this belongs on glasses:**
- **It needs your body in a real room.** A phone can't score where your arm points, and a VR map has no real directions to be wrong about.
- **It works indoors**, because it only depends on direction.
- **It doubles as the accuracy proof:** the arc that scores you is the same registration the judge can check.

## Why AR, and not VR or a phone

| Claim | Where the demo proves it |
| --- | --- |
| **It's registered to the real campus.** Directions are real, so the beam to Hoover points at Hoover. A VR campus can point anywhere. | Judge checks the Hoover beam (93°, east) against a printed north-up map |
| **Your body is the controller.** You point, look and walk; you don't tap. | Point-to-guess scored in degrees |
| **Eyes up, hands free.** The real job of a tour is looking at buildings. A phone puts a screen in the way, and nobody holds one up for a whole walk. | Video: walking the engineering quad, asking by voice |
| **The map wraps around you.** A 3D campus at your feet beats a postage stamp on a screen. | The floor unfold |

**Honest concession:** a phone is better for long reading. "Send to phone" passes along the source links.

## Registration: one method, everywhere

GPS (about 20 m) and the compass can't place things accurately near buildings. The numbers are in the previous version's analysis. So use **a surveyed origin**:
1. **Origin:** a taped spot with a known lat/long.
2. **Heading:** one pinch on a wall. Yaw = that wall's OSM bearing minus the World Query hit normal.
3. **Where it's used:** in the Huang basement for judging, and at one taped spot on the engineering quad for the video. The video caption says "surveyed at this spot".
4. **Live GPS and compass** appear only as a debug overlay and as a pitch line for future walking mode.

## Content: buildings and founders

Each fact has a source in the [verified table](#verified-facts). **Engineering-quad focus:**
- These buildings are close to the judging room and to each other.
- They're dense with founder stories.
- They're the outdoor shoot location.

| Building | Namesake / founder angle | Status |
| --- | --- | --- |
| **Huang Engineering Center** | Jensen Huang (NVIDIA co-founder, MS EE '92) and Lori Huang; $30M; opened 2010; NVIDIA Auditorium inside | Verified |
| **Gates Computer Science** | Bill Gates' gift (about $6M); PageRank/Google work by Page and Brin, marked by an IEEE Milestone | Verified ("room 360" only with a hedge) |
| **Y2E2** | Jerry Yang (Yahoo co-founder; Yahoo began in a campus trailer) and Akiko Yamazaki, $50M | Verified |
| **Shriram Center** | Ram Shriram, Stanford trustee; $57–61M, the largest of the four quad buildings | Verified (the Google-investor link isn't on the Stanford page; confirm it) |
| **Spilker** | James Spilker, GPS pioneer: an easter egg for a location app | Verified |
| **Packard EE** | David Packard, HP co-founder, who studied EE at Stanford; part of the $77.4M 1994 H&P gift | Verified |
| **Hewlett Teaching Center** | William Hewlett; the $77.4M 1994 Hewlett and Packard gift funded it; opened 1999 | Verified |
| **Paul G. Allen** | Microsoft co-founder Paul Allen's 1996 gift funded the expansion of the Center for Integrated Systems; at the 1997 dedication he played guitar with the band D'Cuckoo | Verified (gift amount unconfirmed) |
| **Hoover Tower** | Herbert Hoover, from Stanford's first class; 285 ft; 1941 | Verified |
| **Memorial Church** | Built by Jane Stanford; its spire fell in 1906 (one fun fact) | Verified |
| **HP Garage** (edge pointer, 2.4 km) | "Birthplace of Silicon Valley"; Hewlett and Packard, encouraged by Terman | Verified |

**Gaps to close before cards ship:**
- Open every source URL for facts still marked as search summaries.
- Locate Pars pro Toto (the 12 stone spheres just outside Huang) and Mozart I on the Packard lawn. Neither is in OSM, so pin them by hand on site.
- Photograph Huang's Innovations Tour display cases to confirm what's on view.

**Also needed:** current names. The engineering quad is now the **Robert Rosenkranz Science and Engineering Quad** (renamed in 2025).

The full story research is in the [story catalog](sightlines-story-catalog.md), which has about 460 sourced stories, a top 25 and coverage of 164 of the 256 named map buildings. Raw tables are in [sightlines-stories/](sightlines-stories/).

## Demo zone: the four corners around Huang

The demo and the outdoor shoot happen right around Huang, so the content goes deepest here. The four corners are the four Rosenkranz Quad buildings (Huang, Y2E2, Spilker and Shriram, Boora-designed, 2008–14, using about half the energy of conventional buildings). The ring around them is everything within about 200 m. Each story below has a source in the catalog (V = source page opened, W = Wikipedia only).

**The four corners**

| Building | From Huang | Best story | 3D moment | Status |
| --- | --- | --- | --- | --- |
| **Huang** (you're in it) | 0 m | Display cases hold Google's 1996 server (ten 4 GB drives in a case made of toy building blocks), Yahoo's first servers "Akebono" and "Konishiki", an HP garage workbench replica, an Intel 4004, a GeForce 256 and Knuth displays. A self-guided "Innovations Tour" runs through the building. $30M from Jensen and Lori Huang; the NVIDIA Auditorium seats 300. It skipped LEED certification and spent the fee on the green features. | Bright bricks stack inside mini-Huang, then arcs fly to Gates, Y2E2 and the HP garage | V |
| **Y2E2** | 93 m, 288° | $50M from Jerry Yang and Akiko Yamazaki, both Class of 1990. Yahoo began in a campus trailer. The building recycles gray water. | A Yahoo-purple glow, with a water loop cycling through the floors | V |
| **Spilker** | 104 m, 22° | GPS pioneer James Spilker grew Stanford Telecommunications from 3 people to more than 1,300 with no venture capital. Much of the lab equipment sits underground to control vibration. | A GPS satellite ring orbits above, and the floors drop below the map | V (gift $28M or $31M; sources conflict) |
| **Shriram** | 128 m, 329° | The largest of the four, with 34 labs, for bioengineering and chemical engineering. | Lab benches light up floor by floor | V |
| **Pars pro Toto** (the quad itself) | just outside Huang, not pinned | Alicja Kwade's 12 stone spheres, 16 to 98 inches across, installed April 2021. The stone comes from 8 countries: five from India, one each from Italy, Portugal, Sweden, Norway, Brazil, Finland and Turkey. She set their positions by tossing small spheres onto a model of the quad and placing them where they landed. A Stanford Engineering summary puts them at 200 lb to 23 tons. Funded by an unnamed alumni family. [Stanford Report, 2021](https://news.stanford.edu/stories/2021/04/alicja-kwade-site-specific-installation-stanford-science-engineering-quad-suggests-alternate-realities) | Twelve glowing spheres scatter like thrown marbles and settle, then each one shoots a thin arc to its home country on a globe at the map's edge | V (weights from a search summary only) |

**The ring (within about 200 m)**

| Building | From Huang | Best story | Status |
| --- | --- | --- | --- |
| HEPL South | 94 m, 194° | Hansen's 1947 linear accelerator ("We have accelerated electrons"), the line that led to SLAC. Gravity Probe B tested Einstein with gyroscopes round to within about 40 atoms. | V (linac); W (Gravity Probe B) |
| Green Earth Sciences | 137 m, 163° | Cecil Green, Texas Instruments co-founder. Plaza rocks mimic fault lines. | W |
| Moore Materials Research | 142 m, 94° | Gordon (Intel co-founder) and Betty Moore; dedicated 2000. | V |
| Durand | 157 m, 137° | William Durand, wind-tunnel and propeller pioneer; Aero/Astro. One of his propellers is on display in Huang. | V |
| McCullough | 157 m, 109° | Materials science, 1965; the chip lab (CIS) started in its basement, and French President Mitterrand visited in 1984 to learn about Silicon Valley. | V |
| Packard EE | 161 m, 18° | David Packard; part of the $77.4M 1994 H&P gift; a robotics lab in the basement since 2024. Mozart I, Kenneth Snelson's tensegrity sculpture, stands on the lawn (moved there in 2021). | V |
| Varian Physics | 182 m, 70° | An APS plaque marks Bloch's 1946 discovery of NMR, the basis of MRI and Stanford's first Nobel. The Varian brothers built the klystron in an old physics basement in 1937. | V |
| Hewlett Teaching Center | 185 m, 48° | William Hewlett; the $77.4M H&P gift, a $110M project that opened in 1999. | V |
| Paul G. Allen | 194 m, 346° | Paul Allen's 1996 gift expanded the chip lab; he played guitar at the 1997 dedication. Home of the Stanford Nanofabrication Facility. | V |
| Gates CS (just past the ring) | 262 m, 24° | The PageRank IEEE Milestone plaque (2024) in the 4th-floor foyer, next to the TCP plaque. Brin rollerbladed the halls. By the commonly told account, the name "Google" came from a 1997 brainstorm in room 360. | V (room 360 hedged) |

**Ready-made demo queries for this zone:**
- "Which of these buildings are named for tech founders?" lights Huang (NVIDIA), Y2E2 (Yahoo), Moore (Intel), Packard and Hewlett (HP), Allen and Gates (Microsoft), Spilker (Stanford Telecom) and Green Earth Sciences (TI), all within about 260 m of the judge.
- "Where did Silicon Valley start?" threads the HP garage edge pointer, Varian's klystron, Packard and Hewlett, Gates and the Huang servers.
- Point-to-guess round: "Which building is named for a GPS pioneer?" (Spilker, 104 m) and "Where is Google's first server?" (you're standing in it).

## Voice

- **Narration:** pre-render every sourced fact in ElevenLabs, offline with a script, and ship the clips as Lens audio. No API key on the device and no network hop.
- **Live AI:** only chooses `fact_ids` and the short connective line. The connective line plays through Gateway TTS, or shows as a caption if the network is slow.
- **AI Playground:** the Remote Service Gateway setup is reused. Gemini Live and Realtime speech-to-speech are not needed.

## Tracks

- **AI Horizons (primary):** spatial query engine across buildings, personalization that changes the map, and a visible validator.
- **Creative Zenith (second):** the floor unfold, lift and point-to-guess arcs.
- **ManageXR:** enter only if a camera step works (read a building sign or plaque to confirm the building). Gate this by hour 4.
- **Visko:** skip.

## Judging: what we actually have to deliver

Per the opening-ceremony slides:
- **Required:** Devpost, a **30-second vertical video** and a public repo by **9 AM Sunday**.
- **Judging:** **in person at our table**, 10 AM–noon in the Huang basement.
- The slides give **no stage pitch and no pitch length**. Prepare a 2–3 minute table demo anyway, and confirm the format in Discord.

### Table demo (about 2.5 min)

| Time | What happens |
| --- | --- |
| Before | Lens pre-surveyed: taped spot, one wall pinch. Printed north-up campus map on the table |
| 0:00 | Glasses on. The map unfolds at the judge's feet: "You're inside Huang." |
| 0:15 | "Look at that wall." The beam is Hoover Tower, 660 m east. The judge checks it on the printed map |
| 0:30 | "Tell it what you're into." Their Stanford lights up |
| 0:50 | Pinch to lift the map. Pinch Huang: "Who's this named after?" Founder story plus a source chip |
| 1:20 | "Point to where you think Gates is." Arc, "off by 18°", new fact unlocked |
| 1:50 | Judge's own question across the map, such as "Which buildings are named after founders?" The constellation lights up |
| 2:20 | "Outdoors, this lines up with the real buildings. That's our video." |

### 30-second vertical video

| Time | Shot |
| --- | --- |
| 0–5 s | Phone, third person: the wearer on the engineering quad. Cut to lens capture: the map unfolds at their feet |
| 5–12 s | They look at the real Gates building: "Who's this named after?" Narrated founder story, with the mini Gates glowing |
| 12–20 s | "Point to where you think Huang is." They point, the arc reveals the real direction, "off by 9°", a new fact |
| 20–26 s | "Which buildings are named after tech founders?" The constellation lights up on the map, with beams to the real buildings |
| 26–30 s | Title card: "Sightlines: your Stanford tour guide" |

**Shoot window:** twilight, so the additive display reads. Today about 4:40–5:15 PM; sunset is roughly 4:55 PM per the agents, so check it. Backup Sunday about 6:20–6:55 AM.

## Build gate

| # | Gate | Fallback |
| --- | --- | --- |
| 1 | Baked map (OSM, one merged mesh plus about 9 landmark meshes) renders on the floor and lifts | Boxes for the landmarks only |
| 2 | Surveyed origin plus wall-pinch: the Hoover beam matches the printed map within about 10° | Hand-nudge the yaw |
| 3 | Head-ray pick and ask: one validated function call, the right fact clip plays, the map lights | Pre-scripted answers for 3 questions |
| 4 | Point-to-guess: hand ray, arc reveal, degrees score, fact unlock | Head direction instead of hand |
| 5 | Cross-building query (founders constellation) | Fixed theme buttons |
| 6 | Personalization lights "your Stanford" | Two chips (Founder / Builder) |
| 7 | Outdoor footage at twilight | Indoor-only video |

**Cut order if behind:** keep 1–4 at all costs. Gates 5 and 6 come next. The camera step, walking mode and lift-out models get cut.

## Verified facts

Checked November 14, mostly from search summaries; open each URL before a card ships. Distances are from Huang (37.42793, −122.17447). Coordinates are from OSM Nominatim unless marked ≈.

| Building | Lat, lon | From Huang | Facts and sources |
| --- | --- | --- | --- |
| Huang Engineering Center | 37.42793, −122.17447 | 0 m | Jen-Hsun "Jensen" Huang (MS EE '92, NVIDIA co-founder) and Lori Huang gave $30M. Dedicated Oct 5, 2010. Houses the Terman Engineering Library and the NVIDIA Auditorium. [Stanford Engineering](https://engineering.stanford.edu/news/huang-center-dedicated-lauded-stanfords-engineering-anchor) |
| Gates Computer Science | 37.43010, −122.17329 | 262 m NNE (24°) | Built 1994–96 with a $6M gift from Bill Gates ([Stanford CS](https://www.cs.stanford.edu/about/gates-computer-science-building)). PageRank and BackRub work by Page and Brin, 1996–98, is marked by an IEEE Milestone plaque from 2024 ([ETHW](https://ethw.org/Milestones:PageRank_and_the_Birth_of_Google,_1996-1998)) |
| Y2E2 | 37.42818, −122.17547 | 93 m W (288°) | Jerry Yang (Yahoo co-founder) and Akiko Yamazaki gave $50M. Dedicated 2008, the first of four new engineering-quad buildings. [Stanford Engineering 100](https://engineering100.stanford.edu/stories/designing-for-the-future) |
| Shriram Center | 37.42892, −122.17521 | 128 m NNW (329°) | Ram and Vijay Shriram gave $61M in total. Opened 2014. Ram Shriram is a Stanford trustee; the early-Google-investor link isn't on this page, so confirm it elsewhere. [Stanford Engineering](https://engineering.stanford.edu/news/bioengineering-and-chemical-engineering-building-named-gifts-shrirams) |
| Spilker | 37.42880, −122.17404 | 104 m NNE (22°) | Named for GPS pioneer James Spilker; underground labs control vibration. Sources in [catalog file A](sightlines-stories/A-science-engineering-quad.md). |
| Packard EE | 37.42932, −122.17392 | 161 m NNE (18°) | David Packard studied EE at Stanford. Part of the $77.4M 1994 Hewlett and Packard gift. [Stanford Magazine](https://stanfordmag.org/contents/building-for-the-future) |
| Hewlett Teaching Center | 37.42904, −122.17291 | 185 m NE (48°) | Funded mainly by the $77.4M 1994 Hewlett and Packard gift; $110M project; opened 1999. [Palo Alto Online, 1994](https://www.paloaltoonline.com/morgue/news/1994_Oct_14.SCIENCE.html), [Stanford Magazine](https://stanfordmag.org/contents/a-campus-transformed) |
| Paul G. Allen | 37.42963, −122.17501 | 194 m NNW (346°) | Paul Allen's 1996 gift funded the Center for Integrated Systems expansion (architect Antoine Predock); dedicated 1997. [SystemX history](https://systemx.stanford.edu/about/history), [Stanford Magazine](https://stanfordmag.org/contents/a-campus-transformed) |
| Building 420 (formerly Jordan Hall) | 37.42857, −122.17082 | 330 m ENE (78°) | The Agassiz statue fell from the facade in 1906 and stuck in the pavement. Renamed 2020. OSM still labels it "Jordan Hall". Sources in [catalog file B](sightlines-stories/B-main-quad-central.md). |
| Hoover Tower | 37.42762, −122.16699 | about 660 m E (93°) | Designed by Arthur Brown Jr., completed 1941 for the 50th anniversary, 285 ft. Hoover was in the 1891 "Pioneer" class. [Architecture & Planning](https://architectplanning.stanford.edu/hoover-tower), [Hoover Institution](https://www.hoover.org/about/herbert-hoover) |
| Memorial Church | 37.42692, −122.17051 | about 370 m ESE (108°) | Dedicated Jan 25, 1903. The 1906 quake brought down its spire and clock tower, and neither was rebuilt. [ORSL](https://orsl.stanford.edu/memorial-church-history) |
| Main Quad | — | about 350 m E | Olmsted master plan, built by Shepley, Rutan & Coolidge. Opened Oct 1, 1891. [PCAD](https://pcad.lib.washington.edu/building/1683/) (find a stanford.edu source) |
| Cantor Arts Center | 37.43301, −122.17088 | about 650 m NNE | Opened 1894 as the Leland Stanford Junior Museum. [Cantor history](https://museum.stanford.edu/about/history) |
| Stanford Mausoleum | 37.43651, −122.16994 | about 1.0 km NNE | Tomb of the three Stanfords, completed 1889. Leland Jr. died of typhoid in Florence in March 1884, at 15 ([stanford.edu history](https://www.stanford.edu/about/history)). [Stanford Magazine](https://stanfordmag.org/contents/what-you-don-t-know-about-the-mausoleum) |
| HP Garage, 367 Addison Ave | 37.44302, −122.15464 | about 2.4 km NE (46°) | Hewlett and Packard met at Stanford and were encouraged by Terman. Partnership dates to 1939. California Historical Landmark No. 976, "Birthplace of Silicon Valley". [CA OHP](https://ohp.parks.ca.gov/ListedResources/Detail/976) |

Other sources:
- **Engineering quad renamed:** now the Robert Rosenkranz Science and Engineering Quad, per [Stanford Report, 2025](https://news.stanford.edu/stories/2025/05/engineering-quad-donor-gift).
- **Terman's Stanford Industrial Park, 1951:** [Stanford Report](https://news.stanford.edu/stories/2026/10/stanford-research-park-75-year-anniversary).

**Keep out:**
- Calling Gates room 360 "Google's first office" (that was a Menlo Park garage). The "Google" name story may be used with the hedge "by the commonly told account".
- Cisco's building (only the departments are known).
- Jane Stanford paying faculty with her jewels (use the Jewel Fund for library books instead).
- Mausoleum ghosts.
- "Hoover is lit red for wins" (only Big Game week lighting is verified, and it starts Nov 16, after judging).
- For Snap, say only "Snap's founders were Kappa Sigma brothers". Don't say who had the idea or that it was built in the house.

Leland Jr.'s cause of death and the Allen and Hewlett gift stories are now verified and no longer kept out. Full verdicts are in [catalog §4](sightlines-story-catalog.md#4-keep-out-list-updated-verdicts).

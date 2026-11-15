# What people say they need from AR glasses

November 14, 2026, Saturday morning. This was a needs scan to find problems where reality plus a phone is not enough.

**Coverage caveat: Reddit could not be read from this environment.** The research agents' search tools block reddit.com, and the browser connection refuses it for safety reasons. Evidence below comes from:
- Hacker News wishlist threads
- HearingTracker forum threads (caption-glasses users)
- Meta community forums (blind users)
- the AzBilliards forum
- peer-reviewed studies
- vendor pages

Frequency labels are inferred, not counted. To add Reddit evidence, paste threads in by hand.

## The test

Glasses beat a phone when several of these are true:
1. Hands are busy.
2. Eyes can't leave the task or the person.
3. The information belongs at a spot in the world.
4. The important thing is invisible.
5. True scale matters.
6. It is time-critical.
7. Feedback has to be continuous while you act.

Device limits:
- Spectacles (2024) can only add light. No blur, no blackout, no low-vision contrast boost.
- No eye tracking.
- About 45 minutes of battery.

## What people asked for

| Need (in users' terms) | Source | How often | Already exists? |
| --- | --- | --- | --- |
| Captions that show **who said what**, and leave out my own voice | [HearingTracker](https://forum.hearingtracker.com/t/captify-pro-live-caption-glasses/106368), [HearingTracker](https://forum.hearingtracker.com/t/smart-glasses-experience/92703) | Very common | Caption glasses exist (Captify ~$848, Even G1), but they merge all voices into one block and fail in noise |
| Visual cues to break **Parkinson's freezing of gait** (lines on the floor) | [PMC trial review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5468397/), [Cleveland Clinic](https://consultqd.clevelandclinic.org/studying-augmented-reality-visual-cues-to-treat-freezing-of-gait-in-parkinsons) | Moderate; trial evidence mixed to positive | Strolll (clinical AR); earlier glasses were bulky with a small field of view |
| **Aphasia**: phrase prompts for stressful exchanges, such as ordering coffee | [Co-design study](https://pmc.ncbi.nlm.nih.gov/articles/PMC12583751/) | Moderate (co-design) | Research only. Users rejected two-handed and pinch gestures, so one-hand or large targets |
| Hands-free **sheet music**: page turns, auto-follow, metronome while playing | [HN](https://news.ycombinator.com/item?id=43876243) | Several | Hobby demos on Even G1; about 3 s latency complaints |
| Hands-free **reference while working**: port maps, diagrams, manuals | [HN](https://news.ycombinator.com/item?id=47225741), [Forbes](https://www.forbes.com/sites/ethankarp/2026/09/18/the-next-factory-interface-may-be-a-pair-of-glasses-if-were-smart/) | Several | Enterprise only (RealWear, Iristick) |
| Read text and labels aloud **word for word**, not summarized; read prices, expiration dates, currency (blind users) | [Meta forum](https://communityforums.atmeta.com/discussions/OffTopic/ray-ban-feature-suggestions-for-visually-impaired-users/1274107) | Several | Seeing AI and Envision on phones; Meta AI tends to summarize. Audio-only, so no display is needed |
| **Remember names** of people I've met | [HN](https://news.ycombinator.com/item?id=47225741), [Alzheimer's Society](https://www.alzheimers.org.uk/get-support/publications-and-factsheets/dementia-together/personalised-ai-assistant-smart-glasses-early-stage-dementia) | Common (dementia, face blindness) | Wispy and Vela use face recognition, **which Snap reportedly doesn't allow in Lenses** |
| Recipe steps and timers with messy hands | [BGR](https://www.bgr.com/2184702/meta-ray-ban-killer-apps/), [Engadget](https://www.engadget.com/2268183/new-york-times-cooking-is-coming-to-metas-ai-and-display-glasses/) | Several | Crowded (Meta Display, NYT Cooking) |
| Pool ghost-ball and bank lines | [AzBilliards](https://forums.azbilliards.com/threads/smart-glasses-and-pool.382454/) | Niche | Projector systems; ball tracking is hard |
| Translation and walking navigation | [HN](https://news.ycombinator.com/item?id=50439805) | Very common | Already shipped by Meta, Even and others |

## Candidates scored

| Idea | Test criteria passed | Evidence of need | Prior art risk | Builds in ~24 h on Spectacles | Table demo |
| --- | --- | --- | --- | --- | --- |
| **Step Cue: Parkinson's freezing-of-gait cues.** Floor-anchored stepping lines appear when walking stalls (detected from head motion) or on a voice cue ("step"). Metronome audio, turn-in-place guides. | 2, 3, 6, 7 | Clinical trials; strong patient need | Medium (Strolll, research) | **High.** Floor plane plus world-locked lines plus head-pose velocity. No cloud needed. | A judge walks, stops, and lines appear. Very visceral. |
| **CPR coach.** Hand placement marker, compression rate and depth from wrist tracking, live "faster / harder / good" | 1, 2, 3, 6, 7 | Bystander CPR rates are low; feedback improves quality (to cite) | Medium (HoloLens training research) | **High.** Hand tracking plus metronome. No cloud needed. | A judge does compressions on a pillow or dummy. |
| **Who Said What: speaker-attributed captions.** Caption bubbles anchored near each speaker, coloured per person, own voice excluded | 2, 3, 7 | **Strongest user-voiced complaint** | High (caption glasses exist); the gap is attribution | **Medium.** ASR works. Attribution would come from camera or head direction because mic direction isn't exposed; risky in noise. | Two people talk to the wearer. |
| **Phrase Partner: aphasia support.** The camera sees the context (café counter, pharmacy) and offers 3–4 large one-tap phrases, spoken by TTS | 2, 3 | Co-design study | **Low** | **Medium-high.** Camera, Gemini, large one-hand buttons, TTS. | A judge plays the barista. |
| **Hands-free sheet music.** Score pinned above the instrument, voice or nod page turns, metronome | 1, 2, 7 | HN wishes | Low-medium | Medium. The text and score display is fine; auto-follow by listening is risky. | Needs an instrument at the table. |
| **Spoken reader for blind users** (word-for-word, prices, dates) | 1 (audio) | Several | High (Meta, Envision); doesn't use the display | High | Weak for an XR event, since it is audio-only. |

## Recommendation

**Top two to choose between:**

1. **Step Cue (Parkinson's freezing of gait).**
   - Real clinical evidence that visual floor cues help.
   - A task where looking at a phone is impossible: you are mid-step and need the cue on the floor in front of you, right now.
   - No AI on the critical path, so it is very reliable at the judging table.
   - Strong Virtuous Reality fit. Add AI Horizons only if the AI adapts the cues, for example detecting doorways, which are a common freeze trigger, through camera plus Gemini.
2. **CPR coach.**
   - Even stronger on "a phone can't do this": both hands are on the chest.
   - Equally buildable.
   - It is more of a training tool than daily use.

**Most novel:** Phrase Partner (aphasia), with low prior art and a strong AI-in-XR story. Its need is backed by one co-design study, and the demo depends on role-play.

**Avoid:** anything using face recognition (dementia name tags), low-vision enhancement (needs passthrough), and crowded categories (translation, cooking, navigation).

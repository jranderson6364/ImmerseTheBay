# Focus keeper, ad blocker, networking: prior art, feedback, and hybrids

November 14, 2026, early Saturday morning. This is a review of three new ideas, written after the team questioned Partsight ([partsight-decision.md](partsight-decision.md)). Three research agents covered prior art and hardware limits. The conclusions below are the moderator's synthesis. Claims about Snap policy that rest on press quotes rather than written terms are marked.

## The constraint that shapes all three

Spectacles (2024) has an **additive, see-through display**. It can only add light, so black renders as transparent. There is **no per-region dimming**: the tint is global and automatic, and no API was found that lets a Lens control it. **No eye tracking** is exposed to developers, as far as we could find. Head pose, hand tracking, the colour camera, the microphone, depth, and cloud AI are all available.

So **nothing in the real world can be blurred, blacked out, or hidden.** You can only cover it with bright content, add cues, or replace what the wearer pays attention to. Both "block everything except the task" and "black out the ad" are physically impossible on this device.

## 1. ADHD focus keeper

**Prior art:** none found on Spectacles, Vision Pro, or Quest, though the search was shallow. Similar concepts exist on other hardware:
- Oasis (Dyson Award): electrochromic peripheral dimming, which needs different hardware.
- LensSmart: a concept for subtask highlighting.
- Narbis: an EEG headband that tints the lenses when focus drops.

Body doubling (Focusmate) is an established consumer habit. A 2025 VR body-doubling preprint (12 adults) found self-reported gains, but objective accuracy did not significantly improve. The evidence is thin, so the pitch should not claim the app treats ADHD.

**Feedback:**
- Blocking and blurring are out.
- An arrow plus a timer alone is undifferentiated; a phone does that.
- The glasses-native angle is an **AI body double that sees your task.** It chunks the work into next steps and notices when you drift, using head pose and periodic camera checks such as "phone in hand" or "TV on". It then brings you back with a cue anchored to the real task.

**Verdict:** the strongest of the three after reframing. It is not crowded on this platform, it is used daily (which ManageXR's repeat-usefulness criterion rewards), it has a clear social-good story, and it is buildable.

## 2. Real-world ad blocker

**Prior art: already built on this exact device.** Stijn Spanhove made a Spectacles ad blocker with Gemini and Snap's Depth Cache sample, the same base as Partsight. It covers ads with red squares naming the brand. TechRadar noted the blocker was more distracting than the ads.

There is more:
- A Quest 3 YOLOv9 real-world ad block project (Hackaday), anchored using depth, with choppy results.
- Brand Killer (PennApps 2015).
- An ACM CHI 2025 paper, "Ad-Blocked Reality".

**Feedback:**
- Blacking out is impossible.
- Cloud vision takes 1–8 s, so new ads lag.
- Judges will raise safety signage and harm to small businesses.

**Verdict:** don't build it as stated. Better framings:
- **Sober Lens:** replace only alcohol, gambling, or vape ads with a calm card (streak, coping tip, call a sponsor) for people in recovery.
- **Ad-to-info:** replace ads with something useful.

Both are better as a **feature** inside idea 1 than as a standalone project.

## 3. Event networking with guest list + LinkedIn

**Prior art and backlash:**
- Harvard's I-XRAY (2024) used Meta Ray-Bans and face search to identify strangers.
- In 2026 Meta reportedly considered "Name Tag" face recognition for its glasses, then removed dormant code after more than 70 advocacy groups objected.

**Platform rules:**
- Evan Spiegel (Engadget, AWE 2026): "There are certain use cases, like facial recognition, that we don't allow in Lenses." This is an executive quote; we could not read the written terms, so confirm with a Snap mentor.
- The Lens guidelines prohibit revealing other people's personal information.
- LinkedIn's terms forbid scraping.
- Event apps (Brella, Swapcard, Grip) already do opt-in AI matchmaking and badge scans.

**Feedback:**
- The face-recognition plus LinkedIn version risks disqualification, breaks platform rules, and is exactly what Virtuous Reality judges will penalize.
- A **consent-first** version is fine: attendees opt in with a short form, the glasses read their **badge QR or printed name**, and you see their card, a "why talk to them" line matched to *your* goals, and your private voice notes.

**Verdict:** a viable runner-up. It has a great live-demo hook, because judges can opt in at the table by scanning a QR. It is less novel than idea 1 (it competes with event apps), and it is mostly a lookup UI.

## Hybrids and new ideas

| Idea | Pitch | Why it's strong | Risk |
| --- | --- | --- | --- |
| **Lock In** (1 + 2) | An AI body double for focus sprints. Say the task, and it splits it into 3–5 steps pinned to your desk. Every ~15 s it checks the camera. When your phone, a TV, or an ad pulls you away, it drops a bright task card over the distraction and gives a spoken nudge ("12 minutes left on problem 3"). A world-locked time ring shows time passing. | Uses the hardware honestly: replacing, not blocking. Glasses-native AI that sees what you see. Repeat daily use, and the ADHD story fits Virtuous Reality. Reuses Partsight's Gemini, depth anchoring, ASR, and TTS code. | The 45 min battery (design for 20–25 min sprints). Camera-check cost and latency. Don't claim it treats ADHD. |
| **Pset Body Double** (Lock In for homework) | Lock In, but it reads the worksheet you're on and gives a Socratic hint for the next step, never the answer. | A personal, credible user (students). Hints over answers is a trust story judges like. | Reading handwriting is variable. The scope needs to stay on "next step", not full tutoring. |
| **Warm Intro** (3, consent-first) | Opt-in cards via badge QR or OCR. The glasses rank the room against *your* goals. After a chat, a voice note becomes a follow-up draft. | The demo works on judges. The privacy-by-design story is clear. | Overlaps with event apps. Needs opted-in people at the demo. |
| **Mutual Reveal** (3 + Connected Lenses) | Two wearers hold a gesture, and only the fields both opted into appear. | Privacy as the feature. | Needs two Spectacles, and Connected Lens sync is risky in 26 hours. |
| **Sober Lens** (2) | Swap alcohol, gambling, and vape ads for a recovery card. | Strong social good, narrow classifier. | The demo needs real ads on hand. Narrow audience. |
| **Event Mission** (1 + 3) | Lock In for networking: "meet 3 people about XR hardware". Opted-in cards and nudges keep you on mission instead of hanging out at the snack table. | Combines both stories. | Two products' scope in one weekend. |

## Recommendation

1. **Build Lock In**, with Sober-style distraction replacement as its signature moment. A Pset Body Double mode is a stretch goal if the core works by Saturday evening.
2. Keep **Warm Intro** as the backup if the team prefers a social/demo-driven project.
3. **Drop** the blackout ad blocker and any face-recognition networking.

### Lock In, 30-second demo sketch

| Time | Beat |
| --- | --- |
| 0–5 s | "Lock in: finish problem set 3, 25 minutes." Three step cards pin to the desk, and a time ring starts. |
| 5–12 s | The wearer works. The companion says "step 1 done?" and a pinch checks it off. |
| 12–20 s | The wearer picks up their phone. Within a few seconds a bright card covers the phone: "Back to step 2: 14 minutes left." |
| 20–26 s | Turning away from the desk brings up an edge arrow back to the task. |
| 26–30 s | The sprint ends: "3 of 3 done, 2 drifts caught." |

### Tracks

Virtuous Reality, plus AI Horizons, plus the ManageXR sponsor track.

### First device checks

1. A camera still every 15 s plus a Gemini "is the wearer off task?" call: latency, and whether the battery holds.
2. A card anchored over a detected phone using Depth Cache: does it stay put through head motion?
3. Head-pose drift detection relative to a desk anchor.

# SeatCheck: an AI car-seat checker in your glasses

November 14, 2026. Winner of a non-arts pitch-and-kill round; the rejected pitches are listed at the end.

> Buckle your kid in. The glasses watch your hands and the seat, flag the mistakes that matter (chest clip too low, loose harness, seat that moves, wrong recline), and walk you through each fix right on the seat, hands-free.

## Why it matters

- **About half or more of car seats are used or installed wrong.** NHTSA's national study counted safety-relevant misuse in roughly 46% of seats; Safe Kids, citing NHTSA, says 59%; a 2025 *Pediatrics* paper puts it at about 80%. ([NHTSA DOT HS 812 142](https://crashstats.nhtsa.dot.gov/Api/Public/ViewPublication/812142), [Safe Kids](https://www.safekids.org/post/more-half-car-seats-are-not-installed-correctly), [Pediatrics 2025](https://publications.aap.org/pediatrics/article-abstract/156/5/e2025071867/204570/Interactive-Virtual-Presence-to-Remotely-Assist)) Verify against the NHTSA primary report before quoting a figure.
- The fix today is a certified technician (CPST), who is scarce outside cities, or a manual and videos.
- The same 2025 *Pediatrics* trial tested **remote help through a phone video app**, so remote assistance is credible. **No AR or glasses checker was found.**

## Why glasses, and not a phone

- **Both hands are busy:** pulling straps, pressing the seat, holding a child.
- **Your body is leaning into a back seat** and your eyes are on the child.
- **Each check sits at a spot on the seat:** the chest clip, the belt path, the recline indicator.
- **Your own hand is the sensor.** In the "less than 1 inch of movement at the belt path" test, the wearer tugs the seat and hand tracking measures how far the hand, and so the seat, moved. A phone can't do this hands-free.

## The checks (generic, from NHTSA and AAP guidance)

| Check | How the glasses do it | Fix cue |
| --- | --- | --- |
| Chest clip at armpit level | Camera still → Gemini finds the clip and armpits on the child or doll | Arrow on the clip: "slide up about 3 cm" |
| Harness snug (pinch test) | Prompt: "pinch the strap at the collarbone." Hand tracking confirms the pinch spot; the wearer says "slack" or "tight" | "Pull the adjuster strap" |
| Seat moves less than 1 inch at the belt path | Wearer grips at the belt path and tugs; wrist displacement is measured | "Kneel in the seat and tighten the belt" |
| Straps not twisted | Gemini on the still | Highlight the twisted section |
| Rear- or forward-facing suits the child | Wearer gives the child's age and weight once; Gemini identifies the seat type | Card explaining the rule |
| Recline indicator in range | Gemini reads the bubble or line indicator | "Add a towel under the base" |

Every run ends with an honest close: **"Checked 6 common mistakes. This is not a certified inspection. Find a free CPST near you."**

## Tracks

| Track | Pitch |
| --- | --- |
| **Virtuous Reality** | Child safety, and access to technician-level help for families far from a CPST. |
| **AI Horizons** | Vision checks grounded in a fixed checklist, plus a hand-measured physical test. |
| **ManageXR (sponsor)** | The AI sees what you see, it's a real task, and it repeats: every new caregiver, every car swap, every time the child grows. |

## Critique

- **Liability.** A wrong "all good" is dangerous. So it never certifies. It only flags known mistakes, it shows when it's uncertain, and it always points to a CPST. Precision over recall: it says "can't tell, check manually" rather than guessing.
- **Seat variety.** Infant, convertible and booster seats, and many brands. Scope it to generic checks that apply to every seat; brand manuals are future work.
- **Gemini reliability.** Use bounded questions on one still each ("Is the chest clip above, at, or below armpit level? Answer `above`, `at`, `below`, or `unknown`") and test them on about 30 photos.
- **Demo props.** Buy a convertible car seat (about $60–100) and a doll this morning. Strap the seat to a chair at the judging table.
- **Hand-tracking measurement:** accuracy at the needed scale (2.5 cm) is unverified, so test it first.

## Thirty-second demo

| Time | Beat |
| --- | --- |
| 0–4 s | A parent buckles the doll in: "Check my seat." |
| 4–10 s | Scan. A red marker on the chest clip: "Too low: slide to armpit level." The wearer slides it, and it turns green. |
| 10–18 s | "Grip at the belt path and tug." The wearer tugs: "Moved 4 cm. Tighten the belt." The wearer tightens and tugs again: "1 cm, good." |
| 18–25 s | Pinch test at the collarbone. Straps green. |
| 25–30 s | "6 of 6 checked. Not a certified inspection. Nearest free CPST: …" |

## Build plan (about 22 hours, reusing the Partsight base)

1. Test on the device (hour 1): hand-tracking displacement accuracy during a tug, and Gemini clip-height answers on 10 doll photos.
2. Checklist state machine as pure TypeScript with unit tests (like `PartSpec.ts`).
3. Gemini bounded-question client, reusing `PartsightGemini`.
4. Marker anchored at the Gemini bounding box via Depth Cache (exactly what the sample does).
5. Tug measurement from SIK wrist keypoints.
6. Voice prompts with TTS; result card.
7. Cut line: if the tug test is unreliable, keep it as a guided self-report and lead with the clip and strap checks.

## Rejected this round

| Pitch | Killed because |
| --- | --- |
| Language "hint when you stall" | [Glossana](https://glossana.glass/) already does it on glasses. |
| WIC / unit-price shelf glance | A real pain point ([NPI brief](https://ucanr.edu/program/nutrition-policy-institute/article/wic-app-modifications-needed-improve-wic-participants)), but a phone held up to the shelf is nearly as good, and data mismatches would recreate the checkout problem. |
| Pill-organizer filling checker | Good, but narrower and less visceral than car seats; compartments are small for tracking. |
| Lab bench safety partner | LabLight and other AR protocol tools exist. |
| Wheelchair route guidance | Navigation is crowded; weak demo indoors. |
| Delivery-driver door finding | Amazon is reportedly building driver glasses. |
| Gym form coach | The camera faces outward; it can't see your body. |
| Stop the Bleed / triage | Reads as a CPR-style training clone; AR triage research exists. |
| Sound awareness for deaf users | Phones and watches already classify sounds; there's no mic direction API. |

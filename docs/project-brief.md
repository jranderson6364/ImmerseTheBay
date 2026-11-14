# XR project concepts and device brief

Draft for team discussion, November 13, 2026. **Assigned loaner: Snap Spectacles.** The final concept is still open.

## Current concept choices

- **HomeCue:** a memory companion with saved item locations, reminders, family notes, and grounded questions. Details below are a working draft.
- **How Does This Work?:** point at a real object, identify it, show a prepared exploded 3D model beside it, select parts, and ask questions about function and sourced history. An assembly mode could reverse the animation later. The [Exploded reference project](https://github.com/O-tech477/exploded) uses hand-authored primitive models and has no visible reuse license; treat it as interaction inspiration, not code or asset source.

## One sentence

HomeCue helps an older adult find familiar objects, remember plans, and recall context about people through simple prompts placed in their physical space.

## User and experience

The wearer uses a mixed reality headset at home. A trusted family member can help set up item locations and reminders. The prototype uses fictional people and objects for its demo; it is an assistive concept, not a clinical or safety device.

The product direction is a personal companion: the wearer can ask for help in plain language, get concise answers from saved facts, and receive only useful scheduled prompts. It shows the source and age of a memory (for example, "Keys last marked on the shelf at 2:15 PM") and offers a simple way to correct it. Family notes retain their sender. It does not impersonate a caregiver, infer medical facts, or present uncertain memories as certain.

| Need | XR interaction | Source of truth |
| --- | --- | --- |
| "Where are my keys?" | Point toward their saved place in a scanned room. Show "last marked here" and a timestamp. | Item record linked to a spatial anchor. The system cannot know if someone moved the keys afterward. |
| "What do I need to do?" | Scheduled prompt that can be acknowledged or postponed. | Reminder record with time and status. |
| Family sends a note | Show the note with sender and time. | Authenticated family message; display its original text. |
| "Who is this?" | Show an opt-in person card with name, relationship, and a few facts after explicit selection or a visible marker. | Person record entered and confirmed by the user/family. Automatic face identification is outside the first prototype. |
| "What did Sarah tell me?" | Voice/text assistant answers using saved notes and records, with source and time. | Controlled retrieval from local records; if absent, say it does not know. |

These interactions share a small memory data model: `Item(name, anchor, updatedAt)`, `Person(name, relationship, facts)`, `Reminder(text, dueAt, status, author)`, and `Message(text, sender, createdAt)`.

## Track fit

- Primary: **Virtuous Reality** (social impact and accessible independent living).
- Possible second: **AI Horizons** if a live assistant makes grounded queries in XR; otherwise **Creative Zenith** if the interaction and visual craft are strongest.
- ManageXR sponsor track is relevant only if the team builds a useful responsive smart glasses implementation that meets its criteria.

## Working direction and sponsor tradeoff

As of Friday evening, HomeCue is a candidate and may change after a Spectacles feasibility test. The assigned glasses make an in-view, hands-free experience possible, but require Lens Studio rather than Unity. HomeCue would target Virtuous Reality and possibly AI Horizons if the grounded assistant is live. The object-explainer concept would likely target AI Horizons and a second track based on its final experience. Check sponsor criteria after the concept is chosen.

ManageXR judges glasses-native design, responsive AI that sees what the wearer sees, and repeat usefulness. A glasses version could focus on spoken questions, a camera snapshot, reminders, and concise audio replies. It would lose the spatial arrow or need a separate display-capable platform and implementation. Pursue the sponsor track only if a glasses prototype can run on loaner hardware early without jeopardizing the core Quest demo.

Visko requires Orbis to be central to an XR experience, streaming a world live on Sunday while the user steers it. A possible related concept is a caregiver practice environment: the user steers a simulated home visit and practices responding to memory difficulties. That is a separate product direction. An Orbis video stream would not provide reliable factual memory cues for the real home. Do not add Visko to HomeCue solely for track entry.

## Buildable demo

1. On Spectacles, place a world-anchored marker at the last known location of keys in one room.
2. Ask "Where are my keys?" and see an in-world pointer plus the time the location was saved.
3. Trigger one scheduled reminder and acknowledge it.
4. If network integration is ready, ask "What do I need today?" and get a short answer from stored reminders. Show a family note with sender and time.
5. If time remains, tap or scan a visible marker to open a person card. Do not depend on automatic face identification for the demo.

## Scope and ownership

| Priority | Work |
| --- | --- |
| Must | Spectacles Lens, one world anchor, item query, in-view pointer or marker, one scheduled reminder, device demo. |
| Next | Grounded LLM query over saved records; family note delivered remotely with authenticated sender. |
| Stretch | Opt-in person card via marker/explicit selection, multiple rooms, item tags, accessibility polish. |

Keep automatic face recognition, continuous object tracking, medication adherence claims, and hazard detection out of the critical path. A scene scan locates surfaces; it does not inventory movable objects. Remote messages and LLM calls need network access, so keep the item and scheduled-reminder demo local.

Suggested owners for a three-person team: Spectacles/Lens Studio and anchors; records/assistant integration; reminders/UI/family note and demo. Pick one integration owner and one submission owner. First milestone for either concept: pair the assigned Spectacles, deploy a basic Lens, then place one visible object in the room. Test camera, microphone, network, and anchor permissions before committing to the final interaction.

## Assistant behavior

Speech or text input goes to an intent layer. Tool calls retrieve approved `Item`, `Reminder`, `Message`, and `Person` records. The assistant may summarize retrieved records and cite their timestamps. It must say when a fact is missing, and must never invent a location, a person identity, or medical guidance. Adding or changing saved facts requires an explicit confirmation flow. The runtime model key belongs in a backend, not the Unity app. Codex development credits are separate from runtime API billing.

Use fictional demo data. Avoid storing raw camera frames or personal family details in the repository, logs, or a public demo. Obtain consent for any real person record or remote family access.

## Technical references and open choices

- [Snap Spectacles and Lens Studio introduction](https://developers.snap.com/spectacles/get-started/introduction)
- [Snap spatial anchors](https://developers.snap.com/spectacles/about-spectacles-features/apis/spatial-anchors)
- [Snap camera module](https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module)
- [Snap remote service gateway](https://developers.snap.com/spectacles/about-spectacles-features/apis/remoteservice-gateway)
- [Snap permissions and privacy](https://developers.snap.com/spectacles/permission-privacy/overview)

Decide after device checkout: exact Spectacles model and OS, whether voice input is reliable in the demo room, and whether the team chooses HomeCue or the object explainer. Confirm up to two main tracks on the submission form.

## Assigned hardware

The team was assigned Snap Spectacles. Confirm the exact model, OS version, paired phone, and developer access at pickup. Unity Quest plans and earlier equipment rankings are superseded for the active build.

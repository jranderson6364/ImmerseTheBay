# HomeCue: XR memory companion

Draft for team discussion, November 13, 2026.

## One sentence

HomeCue helps an older adult find familiar objects, remember plans, and recall context about people through simple prompts placed in their physical space.

## User and experience

The wearer uses a mixed reality headset at home. A trusted family member can help set up item locations and reminders. The prototype uses fictional people and objects for its demo; it is an assistive concept, not a clinical or safety device.

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

As of Friday evening, HomeCue is the team's working concept and may change after hardware checkout or a feasibility test. Prioritize a working Quest 3S spatial demo for Virtuous Reality, with AI Horizons if the grounded assistant is live. The Quest supports in-world pointers, room context, and saved anchors; a headset is less suitable for continuous daily wear.

ManageXR judges glasses-native design, responsive AI that sees what the wearer sees, and repeat usefulness. A glasses version could focus on spoken questions, a camera snapshot, reminders, and concise audio replies. It would lose the spatial arrow or need a separate display-capable platform and implementation. Pursue the sponsor track only if a glasses prototype can run on loaner hardware early without jeopardizing the core Quest demo.

Visko requires Orbis to be central to an XR experience, streaming a world live on Sunday while the user steers it. A possible related concept is a caregiver practice environment: the user steers a simulated home visit and practices responding to memory difficulties. That is a separate product direction. An Orbis video stream would not provide reliable factual memory cues for the real home. Do not add Visko to HomeCue solely for track entry.

## Buildable demo

1. Scan one room on a Quest 3S and mark a shelf as the last known location of keys.
2. Ask "Where are my keys?" and see an in-world pointer plus the time the location was saved.
3. Trigger one scheduled reminder and acknowledge it.
4. If network integration is ready, ask "What do I need today?" and get a short answer from stored reminders. Show a family note with sender and time.
5. If time remains, tap or scan a visible marker to open a person card. Do not depend on automatic face identification for the demo.

## Scope and ownership

| Priority | Work |
| --- | --- |
| Must | Quest passthrough app, one-room scene setup, one saved item anchor, item query, in-world pointer, one scheduled reminder, device demo. |
| Next | Grounded LLM query over saved records; family note delivered remotely with authenticated sender. |
| Stretch | Opt-in person card via marker/explicit selection, multiple rooms, item tags, accessibility polish. |

Keep automatic face recognition, continuous object tracking, medication adherence claims, and hazard detection out of the critical path. A scene scan locates surfaces; it does not inventory movable objects. Remote messages and LLM calls need network access, so keep the item and scheduled-reminder demo local.

Suggested owners for a three-person team: XR/anchors; records/assistant integration; reminders/UI/family note and demo. Pick one integration owner and one submission owner. First milestone: install and launch a passthrough build on the actual loaner device, then create and restore one anchor.

## Assistant behavior

Speech or text input goes to an intent layer. Tool calls retrieve approved `Item`, `Reminder`, `Message`, and `Person` records. The assistant may summarize retrieved records and cite their timestamps. It must say when a fact is missing, and must never invent a location, a person identity, or medical guidance. Adding or changing saved facts requires an explicit confirmation flow. The runtime model key belongs in a backend, not the Unity app. Codex development credits are separate from runtime API billing.

Use fictional demo data. Avoid storing raw camera frames or personal family details in the repository, logs, or a public demo. Obtain consent for any real person record or remote family access.

## Technical references and open choices

- [Meta Mixed Reality Utility Kit scene data](https://developers.meta.com/vr/documentation/unity/unity-mr-utility-kit-manage-scene-data/)
- [Meta spatial anchors](https://developers.meta.com/vr/documentation/unity/unity-spatial-anchors-persist-content/)
- [Meta Passthrough Camera API](https://developers.meta.com/vr/documentation/unity/unity-pca-overview/)
- [Meta developer data use policy](https://developers.meta.com/vr/policy/data-use/) (review before building any identity feature)

Decide after device checkout: exact Quest OS/SDK versions, whether voice input is reliable in the demo room, and whether the family note will use a tiny backend or a preloaded demo message. Confirm up to two main tracks on the submission form.

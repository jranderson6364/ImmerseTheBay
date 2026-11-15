# Retrospecs

**A Stanford tour guide in your Spectacles.** A 3D map of campus unfolds in front of you, built from real OpenStreetMap data. Point at a building and pinch: an illustrated story card opens, the guide tells you who it's named for and what happened there, and an Archive Gallery explodes into real historical photos. Ask anything out loud. Checked facts answer instantly, and anything else is looked up live and labelled as coming from the web.

Built for Immerse the Bay 2026 (Stanford XR hackathon, November 13–15) on Snap Spectacles with Lens Studio 5.15.4.

## Judges, start here

| | |
| --- | --- |
| **What to try** | [The two-minute tour](Retrospecs/README.md#for-judges-the-two-minute-tour): Main Quad → Archive Gallery → Huang → ask a question → Hoover Tower → free roam. |
| **How it works** | [Architecture and trust model](Retrospecs/README.md#how-it-works). The guide only speaks facts that carry a checked source, and the AI can frame them but never invent them. |
| **Where the code is** | [`Retrospecs/Assets/Retrospecs/`](Retrospecs/README.md#whats-here): `Scripts/` (Lens components), `Core/` (pure logic, 332 unit tests), `Data/` (baked OSM campus and narration), `Art/` (cards, holograms, archive photos). |
| **Run it** | [Lens Studio setup](Retrospecs/README.md#one-time-setup-in-lens-studio-about-15-minutes) and `bun test Retrospecs/tests`. |
| **Credits** | Map © OpenStreetMap contributors (ODbL). Archive photos: Wikimedia Commons, public domain / CC ([list](Retrospecs/Assets/Retrospecs/Art/ARCHIVE_PHOTOS.md)). People holograms are AI illustrations ([note](Retrospecs/Assets/Retrospecs/Art/PEOPLE_HOLOGRAMS.md)). Built on Snap's MIT-licensed Depth Cache sample. |

## Repository map

| Path | Status | What it is |
| --- | --- | --- |
| [`Retrospecs/`](Retrospecs/README.md) | **Active, the submission** | The Lens project, its tests, its offline bakers ([`tools/`](Retrospecs/tools/README.md)) and its design notes. |
| [`docs/`](docs/README.md) | Notes | Concept, pitch, research and event notes. The [index](docs/README.md) separates current docs from early brainstorms. |
| `out/` | Notes | Submission drafts (Devpost copy) and preview renders. |
| `scripts/` | Utility | A render test for the parked Pocket KO prototype. |
| [`Partsight/`](Partsight/README.md) | Earlier prototype | Our first build this weekend. It's kept for reference and isn't part of the submission. Why we moved on: [docs/partsight-decision.md](docs/partsight-decision.md). |
| [`parked/PocketKO/`](parked/PocketKO/STATUS.md) | Parked prototype | Everyday objects become fighting moves. It's kept for reference and isn't part of the submission. |

## Working practices

- Keep the experience small enough to demo reliably in a few minutes.
- Test on the actual hardware early and keep a fallback demo recording.
- Keep source, assets, setup steps and credits together, so teammates can reproduce the build.
- Never commit credentials. Gateway tokens are stripped by a git filter (see [Tokens](Retrospecs/README.md#tokens)).

Licensed under the [MIT License](LICENSE).

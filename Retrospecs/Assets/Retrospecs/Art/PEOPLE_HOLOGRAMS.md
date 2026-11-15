# People hologram illustrations

These are **AI-generated interpretive illustrations**, not archival images or verified likenesses. They depict the named people and story settings to accompany the sourced card text. They should be presented as illustrations if used outside this Lens.

| Stop | Depiction | Source image / Lens video |
| --- | --- | --- |
| mainquad | Frederick Law Olmsted with a campus plan and Main Quad arcade | `mainquad/mainquad_people_hologram_source.png` / `mainquad/mainquad_people_hologram.mp4` |
| hoover | Young Herbert Hoover with geology map and samples | `hoover/hoover_people_hologram_source.png` / `hoover/hoover_people_hologram.mp4` |
| huang | Jensen Huang with an illustrative GPU chip | `huang/huang_people_hologram_source.png` / `huang/huang_people_hologram.mp4` |
| memchu | Jane Stanford with Memorial Church plans and model | `memchu/memchu_people_hologram_source.png` / `memchu/memchu_people_hologram.mp4` |
| varian | Russell and Sigurd Varian with a klystron | `varian/varian_people_hologram_source.png` / `varian/varian_people_hologram.mp4` |
| spilker | James Spilker Jr. with GPS signals and globe | `spilker/spilker_people_hologram_source.png` / `spilker/spilker_people_hologram.mp4` |
| moore | Gordon and Betty Moore with a silicon wafer and science plans | `moore/moore_people_hologram_source.png` / `moore/moore_people_hologram.mp4` |

The source PNGs were made with the built-in image generation tool. The original six used `hpgarage/hpgarage_nazeli_art.png` as a **style reference only**. Main Quad and the new Huang illustration follow the same 16:9 engraved lavender, cream, and gold treatment on black. No photographic portrait references were supplied, so facial resemblance is approximate.

Run `python Retrospecs/tools/render_people_holograms.py` to regenerate the MP4s from the PNGs. The resulting loops are 640 × 360, 24 fps, four seconds, H.264 baseline, yuv420p, without audio. Motion is a one-pixel hover and slight brightness pulse. The black background is keyed to zero for the additive display. The images were generated for this project; they are separate from Nazeli's original samples in `nazeli_samples/`.

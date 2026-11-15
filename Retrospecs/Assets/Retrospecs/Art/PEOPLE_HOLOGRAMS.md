# People hologram illustrations

These are **AI-generated interpretive illustrations**, not archival images or verified likenesses. They depict the named people and story settings to accompany the sourced card text. They should be presented as illustrations if used outside this Lens.

| Stop | Depiction | Source image / Lens video |
| --- | --- | --- |
| hoover | Young Herbert Hoover with geology map and samples | `hoover/hoover_people_hologram_source.png` / `hoover/hoover_people_hologram.mp4` |
| huang | Larry Page and Sergey Brin with a toy-block storage server | `huang/huang_people_hologram_source.png` / `huang/huang_people_hologram.mp4` |
| memchu | Jane Stanford with Memorial Church plans and model | `memchu/memchu_people_hologram_source.png` / `memchu/memchu_people_hologram.mp4` |
| varian | Russell and Sigurd Varian with a klystron | `varian/varian_people_hologram_source.png` / `varian/varian_people_hologram.mp4` |
| spilker | James Spilker Jr. with GPS signals and globe | `spilker/spilker_people_hologram_source.png` / `spilker/spilker_people_hologram.mp4` |
| moore | Gordon and Betty Moore with a silicon wafer and science plans | `moore/moore_people_hologram_source.png` / `moore/moore_people_hologram.mp4` |

The six source PNGs were made with the built-in image generation tool, using `hpgarage/hpgarage_nazeli_art.png` as a **style reference only**. The shared prompt requested a single wide 16:9 AR people illustration in lavender-and-cream engraved linework with gold highlights, luminous subjects on pure black, no text or logos, and no reuse of the garage characters or setting. Each subject and setting is listed in the table above. No photographic portrait references were supplied to the generator, so facial resemblance is approximate.

Run `python Retrospecs/tools/render_people_holograms.py` to regenerate the MP4s from the PNGs. The resulting loops are 640 × 360, 24 fps, four seconds, H.264 baseline, yuv420p, without audio. Motion is a one-pixel hover and slight brightness pulse. The black background is keyed to zero for the additive display. The images were generated for this project; they are separate from Nazeli's original samples in `nazeli_samples/`.

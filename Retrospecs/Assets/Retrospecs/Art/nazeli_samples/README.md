# Nazeli's Sightlines samples

Original files from Nazeli Sayra Kurtoğlu's replies to **“Sightlines: building graphics brief”** on November 14, 2026. The originals in this folder are untouched; Lens-ready copies live in the building folders (below).

| File | Sample subject | Status |
| --- | --- | --- |
| `Two friends, one garage.png` | HP garage story card | **In the Lens** for `hpgarage` (fact `hpgarage.1`) |
| `Before Google_ Early Storage Server.png` | Huang / early storage server card | **In the Lens** for `huang` (fact `huang.3`) |
| `Hewlett-Packard-anim.mp4` | Hewlett and Packard at the workbench with the oscillator | **In the Lens** for `hpgarage` |
| `ElevenLabs_video_gemini-omni-flash-1-2_...mp4` | The same two 1930s HP characters building the toy-block server rack | **Not used**: the rack matches `huang.3`, but that story is Larry Page and Sergey Brin in 1996, so the figures are the wrong people. Needs a redraw with Page and Brin. |

## Lens-ready copies

| File | What it is |
| --- | --- |
| `huang/huang_card_huang.3.nazeli.png`, `hpgarage/hpgarage_card_hpgarage.1.nazeli.png` | 1600 x 1000 transparent, text-free cards in the export format: illustration only, centred on the graphic circle (1345, 500), clear of the title / namesake / fact regions. |
| `huang/huang_nazeli_art.png`, `hpgarage/hpgarage_nazeli_art.png` | Tight crops on black, used at runtime. |
| `hpgarage/hpgarage_nazeli_anim.mp4` | 640 x 360, 4 s, H.264 baseline, no audio (2.7 MB to 0.35 MB). |

What changed from her files:
- **Copy, button and border removed.** The Lens types the words itself, from `Core/Cards.ts`.
- **Contrast lifted for the additive display.** Black is see-through on Spectacles, so dark strokes vanish. Colours get gamma 0.8 and a floor of about 22% (18% for the video), so her line art still emits light.
- **Matte cleaned.** Small specks of the PNGs' transparency fringe are dropped.
- **Video background keyed.** The animation had a light checkerboard baked into the frames, which would show as a glowing white box. The background is keyed to black, only where it connects to the frame edge, so white shirts stay.

## Copy check against `Core/Cards.ts`

- **Huang:** her copy says the server was "built by" Page and Brin and "Exhibited at Huang". The sourced fact (`huang.3`) says the lobby shows the toy-block-encased servers they *used to test PageRank*. "Built by" is unsourced; "Exhibited at Huang" matches.
- **Garage:** her copy matches `hpgarage.1` (Hewlett, Packard, Terman, 1939, off campus). The card header names the Packard EE building. The art stays on the garage, not Packard, because Packard's facts are about the 1994 gift, the robotics lab and the 1999 glass building.

## How it shows

In focus mode, the card's media row above the info panel shows her art (and the animation, looping, for the HP Garage). This sits alongside the existing 3D model and experience, not instead of them. It is wired on the `RetrospecsInfoPanel` component:
- `Show Media`: on/off for comparison.
- `Media Material`: `Materials/CaptureTexture.mat`.
- Slots `media1..4 Id / Texture`: `huang`, `hpgarage`, `hpgarage`.

/**
 * Schematic opening-card loops: the four centerpiece stories, plus the start-point corner buildings around Huang
 * (Varian, Spilker, Moore). Rendered by tools/render_holograms.py.
 */
export function storyHologram(id: string): Texture | null {
  switch (id) {
    case "hoover": return requireAsset("../Art/hoover/hoover_story_hologram.mp4") as Texture
    case "huang": return requireAsset("../Art/huang/huang_story_hologram.mp4") as Texture
    case "memchu": return requireAsset("../Art/memchu/memchu_story_hologram.mp4") as Texture
    case "varian": return requireAsset("../Art/varian/varian_story_hologram.mp4") as Texture
    case "spilker": return requireAsset("../Art/spilker/spilker_story_hologram.mp4") as Texture
    case "moore": return requireAsset("../Art/moore/moore_story_hologram.mp4") as Texture
    default: return null
  }
}

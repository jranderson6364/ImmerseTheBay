/** People on screen in a building's story. Only clips with the correct people belong here. */
export function peopleHologram(id: string): Texture | null {
  switch (id) {
    case "mainquad": return requireAsset("../Art/mainquad/mainquad_people_hologram.mp4") as Texture
    case "hpgarage": return requireAsset("../Art/hpgarage/hpgarage_nazeli_anim.mp4") as Texture
    case "hoover": return requireAsset("../Art/hoover/hoover_people_hologram.mp4") as Texture
    case "huang": return requireAsset("../Art/huang/huang_people_hologram.mp4") as Texture
    case "memchu": return requireAsset("../Art/memchu/memchu_people_hologram.mp4") as Texture
    case "varian": return requireAsset("../Art/varian/varian_people_hologram.mp4") as Texture
    case "spilker": return requireAsset("../Art/spilker/spilker_people_hologram.mp4") as Texture
    case "moore": return requireAsset("../Art/moore/moore_people_hologram.mp4") as Texture
    default: return null
  }
}

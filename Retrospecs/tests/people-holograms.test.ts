import {expect, test} from "bun:test"

test("people holograms contain only verified people clips", async () => {
  const source = await Bun.file(new URL("../Assets/Retrospecs/Scripts/PeopleHolograms.ts", import.meta.url)).text()
  expect(source).not.toMatch(/_story_hologram\.mp4/)
  expect(source).not.toMatch(/case\s+["']huang["']\s*:\s*return\s+requireAsset\(["'][^"']*huang_nazeli_anim\.mp4/)
  expect(source).toMatch(/case\s+["']hpgarage["']\s*:\s*return\s+requireAsset\(["'][^"']*hpgarage_nazeli_anim\.mp4/)
})

test("each key stop has a bundled people clip", async () => {
  const source = await Bun.file(new URL("../Assets/Retrospecs/Scripts/PeopleHolograms.ts", import.meta.url)).text()
  for (const id of ["hoover", "huang", "hpgarage", "memchu", "varian", "spilker", "moore"]) {
    expect(source).toMatch(new RegExp(`case ["']${id}["']:`))
    const filename = id === "hpgarage" ? "hpgarage_nazeli_anim.mp4" : `${id}_people_hologram.mp4`
    expect(await Bun.file(new URL(`../Assets/Retrospecs/Art/${id}/${filename}`, import.meta.url)).exists()).toBe(true)
  }
})

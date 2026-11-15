import {describe, expect, test} from "bun:test"
import {existsSync, readFileSync} from "fs"
import {join} from "path"
import {archiveEase, archiveExtent, archiveLayout} from "../Assets/Retrospecs/Core/Archive"
import {DEMO_STOPS, demoArchiveOpenHint} from "../Assets/Retrospecs/Core/DemoScript"

const ROOT = join(import.meta.dir, "..")
const manifest = JSON.parse(readFileSync(join(ROOT, "tools/archive-photos.json"), "utf8"))
const stops = Object.keys(manifest).filter((k) => !k.startsWith("_"))
const generated = readFileSync(join(ROOT, "Assets/Retrospecs/Scripts/ArchivePhotos.ts"), "utf8")

describe("archive gallery", () => {
  test("covers the three demo stops, five photos each", () => {
    expect(stops.sort()).toEqual(DEMO_STOPS.map((s) => s.id).sort())
    for (const k of stops) expect(manifest[k].photos.length).toBe(5)
  })

  test("every photo is free to use and credited", () => {
    for (const k of stops) {
      for (const p of manifest[k].photos) {
        expect(p.file.startsWith("File:")).toBe(true)
        expect(/^(Public domain|CC0|CC BY(-SA)? \d\.\d)$/.test(p.license)).toBe(true)
        expect(p.credit).toContain(p.license === "Public domain" ? "Public domain" : p.license)
        for (const f of ["year", "headline", "caption"]) expect((p[f] || "").length).toBeGreaterThan(0)
      }
    }
  })

  test("baked art and its Lens Studio import exist for every print and collage", () => {
    for (const k of stops) {
      const files = [`${k}_archive_cover.jpg`, `${k}_archive_cover_pinch.jpg`, ...manifest[k].photos.map((_: unknown, i: number) => `${k}_archive_frame_${i}.jpg`)]
      for (const f of files) {
        const path = join(ROOT, "Assets/Retrospecs/Art", k, f)
        expect(existsSync(path)).toBe(true)
        expect(existsSync(path + ".meta")).toBe(true)
        expect(generated).toContain(`../Art/${k}/${f}`)
      }
      expect(generated).toMatch(new RegExp(`${k}: \\[(\\d+\\.?\\d*, ){4}\\d+\\.?\\d*\\]`)) // five aspects
    }
  })

  test("exploded layout: equal-height prints, three to a row, no overlaps, centred", () => {
    const aspects = [1.5, 0.8, 1.3, 1.0, 1.7]
    const slots = archiveLayout(aspects, 24, 4)
    expect(slots.length).toBe(5)
    for (const s of slots) expect(s.h).toBe(24)
    slots.forEach((s, i) => expect(s.w).toBeCloseTo(aspects[i] * 24, 6))
    expect(slots[0].y).toBeGreaterThan(slots[3].y) // first row on top
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j]
        const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 3.99 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2 + 3.99
        expect(apart).toBe(true)
      }
    }
    const ext = archiveExtent(slots)
    expect(ext.hh).toBeCloseTo(24 + 2, 6) // two rows of 24 with a 4 cm gap
    const top = slots.slice(0, 3)
    expect(top[0].x - top[0].w / 2).toBeCloseTo(-(top[2].x + top[2].w / 2), 6) // the row is centred
  })

  test("explode animation eases out and clamps", () => {
    expect(archiveEase(-1)).toBe(0)
    expect(archiveEase(0)).toBe(0)
    expect(archiveEase(1)).toBe(1)
    expect(archiveEase(2)).toBe(1)
    expect(archiveEase(0.5)).toBeGreaterThan(0.5)
  })

  test("the open-gallery tip says how to move on", () => {
    expect(demoArchiveOpenHint()).toMatch(/pinch any photo/i)
  })
})

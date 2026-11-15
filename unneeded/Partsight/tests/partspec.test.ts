// Run: bun test unneeded/Partsight/tests
import {describe, expect, test} from "bun:test"
import {
  MAX_PARTS,
  applyMeasuredLength,
  explodeOrder,
  explodedPosition,
  partStyle,
  rotatedHalfExtent,
  safetyCategory,
  scaleLabel,
  validateSpec,
  buildQuestionPrompt,
  GEMINI_SPEC_SCHEMA
} from "../Assets/Partsight/Core/PartSpec"
import {findHeroSpec, heroCount, heroSpecByIndex} from "../Assets/Partsight/Core/HeroSpecs"

const STAPLER = {
  object_name: "Desk stapler",
  archetype: "lever_spring",
  summary: "Pressing the top drives a blade that pushes one staple through paper onto the anvil.",
  bbox_2d: [300, 120, 700, 880],
  overall_mm: {x: 180, y: 55, z: 30},
  parts: [
    {id: "base", name: "Base", shape: "rbox", dims_mm: {x: 180, y: 8, z: 30}, pos_mm: {x: 0, y: -23, z: 0}, explode_mm: {x: 0, y: -30, z: 0}, color: "grey", function: "Holds the anvil.", confidence: 0.95, hidden: false},
    {id: "anvil", name: "Anvil", shape: "plate", dims_mm: {x: 25, y: 2, z: 12}, pos_mm: {x: 70, y: -18, z: 0}, explode_mm: {x: 0, y: -15, z: 0}, color: "white", function: "Bends staple legs.", confidence: 0.9, hidden: false},
    {id: "spring", name: "Pusher spring", shape: "spring", dims_mm: {x: 80, y: 8, z: 8}, pos_mm: {x: 0, y: 0, z: 0}, explode_mm: {x: 0, y: 0, z: 0}, color: "yellow", function: "Feeds staples.", confidence: 0.95, hidden: true},
    {id: "spring", name: "Return spring", shape: "spring", dims_mm: {x: 20, y: 6, z: 6}, pos_mm: {x: -70, y: 5, z: 0}, explode_mm: {x: 0, y: 30, z: 0}, color: "yellow", function: "Lifts the lever.", confidence: 0.6, hidden: true},
    {id: "driver", name: "Driver blade", shape: "plate", dims_mm: {x: 13, y: 30, z: 1}, pos_mm: {x: 500, y: 0, z: 0}, explode_mm: {x: 0, y: 40, z: 0}, color: "teal", function: "Pushes a staple down.", confidence: 0.8, hidden: false}
  ],
  how_it_works: [
    {text: "Press the top lever.", part_ids: ["driver"], action: "press", axis: "y", amount: -5},
    {text: "This step points at nothing.", part_ids: ["ghost_part"], action: "slide"}
  ]
}

describe("validateSpec", () => {
  test("never throws on garbage and always yields a part", () => {
    for (const junk of [null, undefined, 42, "x", [], {parts: "no"}, {parts: [null, 3]}]) {
      const {spec} = validateSpec(junk as any)
      expect(spec.parts.length).toBeGreaterThan(0)
    }
  })

  test("dedupes ids, fixes enums, clamps parts inside the object, drops bad steps", () => {
    const {spec, warnings} = validateSpec(STAPLER)
    const ids = spec.parts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain("spring_2")
    const driver = spec.parts.find((p) => p.id === "driver")!
    expect(driver.color).not.toBe("teal" as any)
    const e = rotatedHalfExtent(driver.dims_mm, driver.rot_deg)
    expect(driver.pos_mm.x + e.x).toBeLessThanOrEqual((spec.overall_mm.x / 2) * 1.05 + 1e-6)
    expect(spec.how_it_works.length).toBe(1)
    expect(warnings.some((w) => w.includes("dropped how_it_works"))).toBe(true)
  })

  test("hidden parts are capped at 0.75 confidence and drawn dashed", () => {
    const {spec} = validateSpec(STAPLER)
    const s = spec.parts.find((p) => p.id === "spring")!
    expect(s.confidence).toBeLessThanOrEqual(0.75)
    expect(partStyle(s, spec)).toBe("dashed")
  })

  test("zero explode vectors get a real outward vector", () => {
    const {spec} = validateSpec(STAPLER)
    const s = spec.parts.find((p) => p.id === "spring")!
    const l = Math.hypot(s.explode_mm.x, s.explode_mm.y, s.explode_mm.z)
    expect(l).toBeGreaterThan(8)
  })

  test("caps part count", () => {
    const many = {...STAPLER, parts: Array.from({length: 20}, (_, i) => ({...STAPLER.parts[0], id: "p" + i}))}
    expect(validateSpec(many).spec.parts.length).toBe(MAX_PARTS)
  })

  test("safety gate strips internals", () => {
    const {spec} = validateSpec({...STAPLER, object_name: "iPhone 15"})
    expect(spec.design_label).toBe("exterior_only")
    expect(spec.parts.length).toBe(1)
    expect(spec.parts[0].shape).toBe("ghost_shell")
    expect(spec.how_it_works.length).toBe(0)
    expect(spec.safety_note.length).toBeGreaterThan(0)
  })

  test("safety keywords match whole words only", () => {
    expect(safetyCategory("pillow")).toBe("ok")
    expect(safetyCategory("pill bottle")).toBe("exterior_only")
    expect(safetyCategory("phones")).toBe("exterior_only")
    expect(safetyCategory("wireless headphones")).toBe("rough")
    expect(safetyCategory("stapler")).toBe("ok")
  })
})

describe("scale", () => {
  test("measured length rescales uniformly", () => {
    const {spec} = validateSpec(STAPLER)
    const r = applyMeasuredLength(spec, 150)
    expect(r.applied).toBe(true)
    expect(Math.round(r.spec.overall_mm.x)).toBe(150)
    expect(r.spec.scale_source).toBe("measured")
    expect(scaleLabel(r.spec)).toBe("150 mm (measured)")
  })

  test("wild measurements are rejected", () => {
    const {spec} = validateSpec(STAPLER)
    expect(applyMeasuredLength(spec, 5000).applied).toBe(false)
    expect(applyMeasuredLength(spec, NaN).applied).toBe(false)
    expect(scaleLabel(spec)).toBe("~180 mm (est.)")
  })
})

describe("explode", () => {
  test("t=0 is assembled, t=1 is fully exploded, t>1 keeps going", () => {
    const {spec} = validateSpec(STAPLER)
    const order = explodeOrder(spec.parts)
    const p = spec.parts[0]
    const a = explodedPosition(p, order[0], spec.parts.length, 0)
    const b = explodedPosition(p, order[0], spec.parts.length, 1)
    const c = explodedPosition(p, order[0], spec.parts.length, 1.5)
    expect(a).toEqual(p.pos_mm)
    expect(b.y).toBeCloseTo(p.pos_mm.y + p.explode_mm.y, 5)
    expect(c.y).toBeCloseTo(p.pos_mm.y + p.explode_mm.y * 1.5, 5)
  })

  test("order is a permutation", () => {
    const {spec} = validateSpec(STAPLER)
    const order = explodeOrder(spec.parts)
    expect([...order].sort((x, y) => x - y)).toEqual(spec.parts.map((_, i) => i))
  })
})

describe("hero specs", () => {
  test("every hero validates cleanly with no warnings and fits its bbox", () => {
    for (let i = 0; i < heroCount(); i++) {
      const spec = heroSpecByIndex(i)
      expect(spec.design_label).toBe("verified")
      expect(spec.scale_source).toBe("authored")
      expect(spec.how_it_works.length).toBeGreaterThan(2)
      // Re-validate the raw output: a clean hero produces no fixes.
      const again = validateSpec(spec, {designLabel: "verified", scaleSource: "authored"})
      expect(again.warnings).toEqual([])
      for (const st of spec.how_it_works) {
        for (const id of st.part_ids) expect(spec.parts.some((p) => p.id === id)).toBe(true)
      }
    }
  })

  test("hero lookup matches whole words", () => {
    expect(findHeroSpec("blue retractable pen")?.object_name).toBe("Retractable ballpoint pen")
    expect(findHeroSpec("LED Flashlight")?.object_name).toBe("2xAA LED flashlight")
    expect(findHeroSpec("Master padlock")?.object_name).toBe("Pin-tumbler padlock")
    expect(findHeroSpec("pencil")).toBeNull()
    expect(findHeroSpec("open box")).toBeNull()
    expect(findHeroSpec("clock")).toBeNull()
  })
})

describe("prompts", () => {
  test("question prompt carries the spec and selection", () => {
    const spec = heroSpecByIndex(0)
    const p = buildQuestionPrompt(spec, "why does it click twice?", "rotating_cam")
    expect(p).toContain("rotating_cam")
    expect(p).toContain("why does it click twice?")
  })

  test("Gemini schema lists required top-level keys", () => {
    expect(GEMINI_SPEC_SCHEMA.required).toContain("parts")
  })
})

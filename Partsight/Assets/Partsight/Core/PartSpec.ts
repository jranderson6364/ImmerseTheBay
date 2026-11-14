/**
 * Partsight parts-spec: types, Gemini prompt + response schema, validator, scale and explode math.
 *
 * This file is pure TypeScript with no Lens Studio globals, so it runs in Lens Studio
 * and in Bun/Node tests (see Partsight/tests). Keep it that way.
 *
 * Coordinate frame (object-local, millimetres):
 *   origin = centre of the object's bounding box, +X = the object's long axis,
 *   +Y = up as the object normally sits, +Z = toward the viewer.
 * Round unit meshes (cylinder, tube, cone, capsule, spring, gear) have their axis along local +X.
 * dims_mm is the size of the part's own bounding box in its local frame, before rotation.
 * rot_deg is Euler degrees applied X, then Y, then Z.
 */

export const SPEC_VERSION = 1
export const MAX_PARTS = 12
export const MAX_STEPS = 6
export const HIDDEN_CONFIDENCE_CAP = 0.75

export const SHAPES = [
  "box",
  "rbox",
  "plate",
  "cylinder",
  "tube",
  "capsule",
  "cone",
  "sphere",
  "torus",
  "u_shape",
  "spring",
  "gear",
  "ghost_shell"
] as const
export type Shape = (typeof SHAPES)[number]

export const ARCHETYPES = [
  "lever_spring",
  "rotary_drive",
  "fluid_pump",
  "electrical_circuit",
  "latch_lock",
  "fastener_enclosure",
  "cutting_tool",
  "container",
  "other"
] as const
export type Archetype = (typeof ARCHETYPES)[number]

export const PALETTE = ["blue", "orange", "yellow", "green", "red", "purple", "grey", "white"] as const
export type PaletteColor = (typeof PALETTE)[number]

/** RGBA 0-1, tuned for additive displays (bright, saturated). */
export const PALETTE_RGBA: Record<PaletteColor, [number, number, number, number]> = {
  blue: [0.25, 0.6, 1.0, 1],
  orange: [1.0, 0.55, 0.15, 1],
  yellow: [1.0, 0.88, 0.2, 1],
  green: [0.3, 0.9, 0.45, 1],
  red: [1.0, 0.3, 0.3, 1],
  purple: [0.7, 0.45, 1.0, 1],
  grey: [0.7, 0.72, 0.76, 1],
  white: [0.95, 0.95, 0.97, 1]
}

export const MATERIALS = ["metal", "plastic", "rubber", "glass", "electronics", "fabric", "wood", "other"] as const
export type MaterialKind = (typeof MATERIALS)[number]

export const ACTIONS = ["press", "slide", "rotate", "compress", "release", "flow", "glow"] as const
export type StepAction = (typeof ACTIONS)[number]

/** verified = hand-checked hero spec; typical = AI generic design; rough = shaky category; exterior_only = safety gate. */
export const DESIGN_LABELS = ["verified", "typical", "rough", "exterior_only"] as const
export type DesignLabel = (typeof DESIGN_LABELS)[number]

export const SCALE_SOURCES = ["authored", "measured", "estimated"] as const
export type ScaleSource = (typeof SCALE_SOURCES)[number]

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface PartSpecPart {
  id: string
  name: string
  shape: Shape
  dims_mm: Vec3
  pos_mm: Vec3
  rot_deg: Vec3
  explode_mm: Vec3
  color: PaletteColor
  material: MaterialKind
  function: string
  confidence: number
  hidden: boolean
}

export interface HowItWorksStep {
  text: string
  part_ids: string[]
  action: StepAction
  /** Object-local axis for slide/rotate/compress. */
  axis: "x" | "y" | "z"
  /** mm for slide/compress, degrees for rotate. */
  amount: number
}

export interface PartsSpec {
  spec_version: number
  object_name: string
  archetype: Archetype
  design_label: DesignLabel
  scale_source: ScaleSource
  summary: string
  safety_note: string
  overall_mm: Vec3
  /** Gemini convention: [ymin, xmin, ymax, xmax] in 0-1000 image coordinates. */
  bbox_2d: number[]
  parts: PartSpecPart[]
  how_it_works: HowItWorksStep[]
}

// ---------------------------------------------------------------------------
// Safety gate
// ---------------------------------------------------------------------------

/** Never show invented internals for these; exterior shell only. */
export const EXTERIOR_ONLY_KEYWORDS = [
  "phone",
  "iphone",
  "smartphone",
  "laptop",
  "tablet",
  "ipad",
  "battery pack",
  "power bank",
  "lithium",
  "charger",
  "vape",
  "e-cigarette",
  "microwave",
  "outlet",
  "power strip",
  "space heater",
  "inhaler",
  "insulin",
  "epipen",
  "syringe",
  "pacemaker",
  "medical",
  "pill",
  "gun",
  "pistol",
  "rifle",
  "firearm",
  "ammunition",
  "knife",
  "blade",
  "aerosol",
  "propane",
  "fire extinguisher",
  "pressurized",
  "car battery",
  "airbag"
]

/** Designs vary too much; render at block level and label "rough". */
export const ROUGH_KEYWORDS = [
  "headphone",
  "earbud",
  "airpods",
  "drill",
  "coffee machine",
  "espresso",
  "blender",
  "speaker",
  "controller",
  "camera",
  "watch",
  "keyboard",
  "mouse",
  "toy",
  "printer"
]

/** Whole-word, plural-tolerant match ("pill" does not match "pillow"; "phones" matches "phone"). */
function matchesAny(name: string, keywords: string[]): boolean {
  const n = name.toLowerCase()
  return keywords.some((k) => new RegExp("\\b" + k.replace(/[-]/g, "\\-") + "(s|es)?\\b").test(n))
}

export function safetyCategory(objectName: string): "ok" | "rough" | "exterior_only" {
  if (matchesAny(objectName, EXTERIOR_ONLY_KEYWORDS)) return "exterior_only"
  if (matchesAny(objectName, ROUGH_KEYWORDS)) return "rough"
  return "ok"
}

// ---------------------------------------------------------------------------
// Prompt + Gemini response schema
// ---------------------------------------------------------------------------

export const SPEC_SYSTEM_PROMPT = `You are Partsight, an engineering-diagram generator inside AR glasses.
The user is holding or looking at ONE everyday object. Produce a to-scale, exploded "typical design" diagram of it as JSON.

Process (follow in order):
1. Identify the single object the user means (the most central, held, or largest foreground object). Give bbox_2d as [ymin, xmin, ymax, xmax] in 0-1000 image coordinates.
2. Choose its archetype. Build parts only from what a TYPICAL object of that class contains. Never claim a brand or model unless its name is clearly printed and readable in the image.
3. Estimate overall_mm (real size; X = the long axis, Y = up, Z = toward the viewer).
4. List at most 12 parts. Merge tiny parts (screws, washers) into their parent. Every part must fit inside overall_mm when assembled.
5. For each part, give a simple shape, its size, position, rotation, and an explode vector (direction and distance the part moves when the diagram is exploded, 20-80 mm, pointing away from the centre, parts on the same axis moving progressively further).
6. Give 2-6 how_it_works steps that reference part ids.

Coordinate rules: millimetres; origin = centre of the object's bounding box. Round shapes (cylinder, tube, cone, capsule, spring, gear) have their axis along X before rotation; to stand one upright use rot_deg z=90. dims_mm is the part's size in its own frame before rotation.

Honesty rules:
- confidence: 0.9+ only for parts almost every object of this class has and that are visible; parts you cannot see get hidden=true and confidence at most 0.75.
- Electronics: block level only (battery, circuit board, switch, motor, LED, coil). No chip names, component values, or voltages beyond a battery's nominal rating.
- If the object has no moving or functional internals (a mug, a book), give 1-4 parts describing its layers or materials and say so in summary.
- Phones, laptops, tablets, lithium batteries, mains-powered appliances, medical devices, weapons, knives, pressurized containers, and car parts: return only one part with shape "ghost_shell" for the exterior and set safety_note to explain it is not safe to open. No internals.
- function: one plain sentence, max 80 characters, what the part does.
- summary: max 160 characters, how the whole object works.

Use short snake_case ids. Colors from the palette only; give adjacent parts different colors.`

/** Gemini responseSchema (OpenAPI subset). Mirrors PartsSpec minus fields the Lens fills in. */
export const GEMINI_SPEC_SCHEMA = {
  type: "object",
  properties: {
    object_name: {type: "string"},
    archetype: {type: "string", enum: [...ARCHETYPES]},
    summary: {type: "string"},
    safety_note: {type: "string"},
    bbox_2d: {type: "array", items: {type: "number"}},
    overall_mm: vec3Schema(),
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          name: {type: "string"},
          shape: {type: "string", enum: [...SHAPES]},
          dims_mm: vec3Schema(),
          pos_mm: vec3Schema(),
          rot_deg: vec3Schema(),
          explode_mm: vec3Schema(),
          color: {type: "string", enum: [...PALETTE]},
          material: {type: "string", enum: [...MATERIALS]},
          function: {type: "string"},
          confidence: {type: "number"},
          hidden: {type: "boolean"}
        },
        required: ["id", "name", "shape", "dims_mm", "pos_mm", "explode_mm", "color", "function", "confidence", "hidden"]
      }
    },
    how_it_works: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: {type: "string"},
          part_ids: {type: "array", items: {type: "string"}},
          action: {type: "string", enum: [...ACTIONS]},
          axis: {type: "string", enum: ["x", "y", "z"]},
          amount: {type: "number"}
        },
        required: ["text", "part_ids", "action"]
      }
    }
  },
  required: ["object_name", "archetype", "summary", "bbox_2d", "overall_mm", "parts", "how_it_works"]
}

function vec3Schema() {
  return {
    type: "object",
    properties: {x: {type: "number"}, y: {type: "number"}, z: {type: "number"}},
    required: ["x", "y", "z"]
  }
}

export const QA_SYSTEM_PROMPT = `You are Partsight, answering a spoken question about an object shown as an exploded diagram in AR glasses.
Answer ONLY from the diagram spec you are given. Speak in at most 2 short sentences (under 40 words), plain language, no markdown.
If the spec does not cover the question, start with "I can't see that from here;" and then say what a typical design usually has, briefly.
If design_label is "typical" or "rough", do not claim certainty about this exact unit. Never give instructions for opening devices the spec marks as not safe to open.
Return JSON: {"answer": string, "part_ids": [ids of parts your answer is about, from the spec only]}.`

export const GEMINI_QA_SCHEMA = {
  type: "object",
  properties: {
    answer: {type: "string"},
    part_ids: {type: "array", items: {type: "string"}}
  },
  required: ["answer", "part_ids"]
}

export function buildQuestionPrompt(spec: PartsSpec, question: string, selectedPartId?: string): string {
  const compact = {
    object_name: spec.object_name,
    design_label: spec.design_label,
    summary: spec.summary,
    safety_note: spec.safety_note,
    overall_mm: spec.overall_mm,
    parts: spec.parts.map((p) => ({
      id: p.id,
      name: p.name,
      function: p.function,
      material: p.material,
      confidence: p.confidence,
      hidden: p.hidden
    })),
    how_it_works: spec.how_it_works.map((s) => ({text: s.text, part_ids: s.part_ids}))
  }
  const sel = selectedPartId ? `\nThe user is currently pointing at part "${selectedPartId}".` : ""
  return `Diagram spec:\n${JSON.stringify(compact)}${sel}\n\nQuestion: ${question}`
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export interface ValidationResult {
  spec: PartsSpec
  warnings: string[]
}

function num(v: any, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : v
  return typeof n === "number" && isFinite(n) ? n : fallback
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function vec(v: any, fallback: Vec3): Vec3 {
  if (Array.isArray(v)) return {x: num(v[0], fallback.x), y: num(v[1], fallback.y), z: num(v[2], fallback.z)}
  if (v == null || typeof v !== "object") return {x: fallback.x, y: fallback.y, z: fallback.z}
  return {x: num(v.x, fallback.x), y: num(v.y, fallback.y), z: num(v.z, fallback.z)}
}

function oneOf<T extends string>(v: any, allowed: readonly T[], fallback: T): T {
  if (typeof v !== "string") return fallback
  const s = v.trim().toLowerCase()
  return (allowed as readonly string[]).indexOf(s) >= 0 ? (s as T) : fallback
}

function text(v: any, max: number, fallback = ""): string {
  if (typeof v !== "string") return fallback
  const s = v.replace(/\s+/g, " ").trim()
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s
}

export function slugify(s: string): string {
  const out = (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
  return out || "part"
}

function len(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

function maxComponent(v: Vec3): number {
  return Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))
}

/** Axis-aligned half-extent of a box of size d after Euler rotation r (degrees). */
export function rotatedHalfExtent(d: Vec3, r: Vec3): Vec3 {
  const rx = (r.x * Math.PI) / 180
  const ry = (r.y * Math.PI) / 180
  const rz = (r.z * Math.PI) / 180
  const cx = Math.cos(rx),
    sx = Math.sin(rx)
  const cy = Math.cos(ry),
    sy = Math.sin(ry)
  const cz = Math.cos(rz),
    sz = Math.sin(rz)
  // R = Rz * Ry * Rx (X applied first)
  const m = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx]
  ]
  const h = [d.x / 2, d.y / 2, d.z / 2]
  const e = m.map((row) => Math.abs(row[0]) * h[0] + Math.abs(row[1]) * h[1] + Math.abs(row[2]) * h[2])
  return {x: e[0], y: e[1], z: e[2]}
}

const DEFAULT_OVERALL: Vec3 = {x: 120, y: 40, z: 40}

/**
 * Turns whatever the model returned into a safe, renderable PartsSpec.
 * Never throws; always returns at least one part.
 */
export function validateSpec(raw: any, opts: {designLabel?: DesignLabel; scaleSource?: ScaleSource} = {}): ValidationResult {
  const warnings: string[] = []
  const r = raw && typeof raw === "object" ? raw : {}
  if (raw == null || typeof raw !== "object") warnings.push("spec was not an object")

  const objectName = text(r.object_name, 60, "object")
  const archetype = oneOf(r.archetype, ARCHETYPES, "other")
  const category = safetyCategory(objectName)

  let overall = vec(r.overall_mm, DEFAULT_OVERALL)
  overall = {x: clamp(Math.abs(overall.x), 5, 2000), y: clamp(Math.abs(overall.y), 2, 2000), z: clamp(Math.abs(overall.z), 2, 2000)}

  let designLabel: DesignLabel = opts.designLabel || "typical"
  if (category === "rough" && designLabel === "typical") designLabel = "rough"

  let bbox = Array.isArray(r.bbox_2d) ? r.bbox_2d.slice(0, 4).map((v: any) => clamp(num(v, 0), 0, 1000)) : []
  if (bbox.length !== 4 || bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
    if (r.bbox_2d != null) warnings.push("bbox_2d invalid; using image centre")
    bbox = [250, 250, 750, 750]
  }

  const rawParts: any[] = Array.isArray(r.parts) ? r.parts : []
  if (rawParts.length > MAX_PARTS) warnings.push(`trimmed ${rawParts.length - MAX_PARTS} extra parts`)

  const usedIds: Record<string, boolean> = {}
  const idMap: Record<string, string> = {}
  const parts: PartSpecPart[] = []
  const half = {x: overall.x / 2, y: overall.y / 2, z: overall.z / 2}
  const maxDim = Math.max(overall.x, overall.y, overall.z)

  for (let i = 0; i < rawParts.length && parts.length < MAX_PARTS; i++) {
    const p = rawParts[i] || {}
    const name = text(p.name, 40, "") || text(p.id, 40, `Part ${i + 1}`)
    let id = slugify(typeof p.id === "string" && p.id ? p.id : name)
    const originalId = typeof p.id === "string" ? p.id : id
    if (usedIds[id]) {
      let k = 2
      while (usedIds[id + "_" + k]) k++
      id = id + "_" + k
      warnings.push(`duplicate part id renamed to ${id}`)
    }
    usedIds[id] = true
    idMap[originalId] = id
    idMap[slugify(originalId)] = id

    const shape = oneOf(p.shape, SHAPES, "box")
    let dims = vec(p.dims_mm, {x: maxDim / 4, y: maxDim / 4, z: maxDim / 4})
    dims = {
      x: clamp(Math.abs(dims.x), 0.5, maxDim * 1.05),
      y: clamp(Math.abs(dims.y), 0.5, maxDim * 1.05),
      z: clamp(Math.abs(dims.z), 0.5, maxDim * 1.05)
    }
    const rot = vec(p.rot_deg, {x: 0, y: 0, z: 0})
    let pos = vec(p.pos_mm, {x: 0, y: 0, z: 0})

    // Keep the assembled part inside the object's bounding box (5% slack).
    const e = rotatedHalfExtent(dims, rot)
    const clamped = {
      x: clampCentre(pos.x, e.x, half.x * 1.05),
      y: clampCentre(pos.y, e.y, half.y * 1.05),
      z: clampCentre(pos.z, e.z, half.z * 1.05)
    }
    if (Math.abs(clamped.x - pos.x) + Math.abs(clamped.y - pos.y) + Math.abs(clamped.z - pos.z) > 0.5) {
      warnings.push(`moved ${id} back inside the object`)
    }
    pos = clamped

    const hidden = p.hidden === true
    let confidence = clamp(num(p.confidence, 0.6), 0, 1)
    if (hidden && confidence > HIDDEN_CONFIDENCE_CAP && designLabel !== "verified") confidence = HIDDEN_CONFIDENCE_CAP

    parts.push({
      id,
      name,
      shape,
      dims_mm: dims,
      pos_mm: pos,
      rot_deg: rot,
      explode_mm: vec(p.explode_mm, {x: 0, y: 0, z: 0}),
      color: oneOf(p.color, PALETTE, PALETTE[i % PALETTE.length]),
      material: oneOf(p.material, MATERIALS, "other"),
      function: text(p.function, 80, ""),
      confidence,
      hidden
    })
  }

  if (parts.length === 0) {
    warnings.push("no parts; using exterior shell")
    parts.push(shellPart(overall))
  }

  fixExplodeVectors(parts, overall)

  let safetyNote = text(r.safety_note, 160, "")
  let steps = validateSteps(r.how_it_works, idMap, usedIds, warnings)

  if (category === "exterior_only") {
    designLabel = "exterior_only"
    parts.length = 0
    parts.push(shellPart(overall))
    steps = []
    if (!safetyNote) safetyNote = "Not safe to open: this kind of device has batteries, mains power, or sealed parts."
    warnings.push("safety gate: exterior only")
  }

  return {
    spec: {
      spec_version: SPEC_VERSION,
      object_name: objectName,
      archetype,
      design_label: designLabel,
      scale_source: opts.scaleSource || "estimated",
      summary: text(r.summary, 160, ""),
      safety_note: safetyNote,
      overall_mm: overall,
      bbox_2d: bbox,
      parts,
      how_it_works: steps
    },
    warnings
  }
}

function clampCentre(c: number, halfExtent: number, bound: number): number {
  if (halfExtent >= bound) return 0
  return clamp(c, -bound + halfExtent, bound - halfExtent)
}

function shellPart(overall: Vec3): PartSpecPart {
  return {
    id: "exterior",
    name: "Exterior",
    shape: "ghost_shell",
    dims_mm: {x: overall.x, y: overall.y, z: overall.z},
    pos_mm: {x: 0, y: 0, z: 0},
    rot_deg: {x: 0, y: 0, z: 0},
    explode_mm: {x: 0, y: 0, z: 0},
    color: "grey",
    material: "other",
    function: "Outer housing.",
    confidence: 0.9,
    hidden: false
  }
}

/** Every non-shell part needs a non-trivial explode vector that points away from the centre. */
function fixExplodeVectors(parts: PartSpecPart[], overall: Vec3) {
  const maxDim = Math.max(overall.x, overall.y, overall.z)
  const minLen = Math.max(8, maxDim * 0.12)
  const maxLen = maxDim * 1.2
  const longAxis: "x" | "y" | "z" = overall.x >= overall.y && overall.x >= overall.z ? "x" : overall.y >= overall.z ? "y" : "z"
  parts.forEach((p, i) => {
    if (p.shape === "ghost_shell" && parts.length > 1) return
    let ev = p.explode_mm
    if (len(ev) < 1) {
      // Push outward along whichever axis the part is furthest from centre; tie-break on the long axis.
      const rel = {x: p.pos_mm.x / overall.x, y: p.pos_mm.y / overall.y, z: p.pos_mm.z / overall.z}
      const ax = Math.abs(rel.x) >= Math.abs(rel.y) && Math.abs(rel.x) >= Math.abs(rel.z) ? "x" : Math.abs(rel.y) >= Math.abs(rel.z) ? "y" : "z"
      const useAxis = maxComponent(rel) < 0.05 ? longAxis : ax
      const sign = (p.pos_mm as any)[useAxis] < 0 ? -1 : (p.pos_mm as any)[useAxis] > 0 ? 1 : i % 2 === 0 ? 1 : -1
      ev = {x: 0, y: 0, z: 0}
      ;(ev as any)[useAxis] = sign * maxDim * 0.35
    }
    const l = len(ev)
    if (l < minLen) ev = scaleVec(ev, minLen / l)
    else if (l > maxLen) ev = scaleVec(ev, maxLen / l)
    p.explode_mm = ev
  })
}

function scaleVec(v: Vec3, s: number): Vec3 {
  return {x: v.x * s, y: v.y * s, z: v.z * s}
}

function validateSteps(raw: any, idMap: Record<string, string>, used: Record<string, boolean>, warnings: string[]): HowItWorksStep[] {
  const list: any[] = Array.isArray(raw) ? raw : []
  const out: HowItWorksStep[] = []
  for (let i = 0; i < list.length && out.length < MAX_STEPS; i++) {
    const s = list[i] || {}
    const ids: string[] = (Array.isArray(s.part_ids) ? s.part_ids : [])
      .map((pid: any) => (typeof pid === "string" ? idMap[pid] || idMap[slugify(pid)] || (used[slugify(pid)] ? slugify(pid) : "") : ""))
      .filter((pid: string) => !!pid)
    const t = text(s.text, 90, "")
    if (!t || ids.length === 0) {
      warnings.push(`dropped how_it_works step ${i + 1}`)
      continue
    }
    const action = oneOf(s.action, ACTIONS, "glow")
    const axis = oneOf(s.axis, ["x", "y", "z"] as const, "x")
    const defaultAmount = action === "rotate" ? 45 : action === "slide" || action === "compress" ? 5 : 0
    const limit = action === "rotate" ? 360 : 100
    out.push({text: t, part_ids: ids, action, axis, amount: clamp(num(s.amount, defaultAmount), -limit, limit)})
  }
  return out
}

// ---------------------------------------------------------------------------
// Scale
// ---------------------------------------------------------------------------

export function longestDim(v: Vec3): number {
  return Math.max(v.x, v.y, v.z)
}

/**
 * Uniformly rescales the spec so its longest dimension equals a real measurement.
 * Rejects measurements more than 4x off the estimate (likely a depth or pinch error).
 */
export function applyMeasuredLength(spec: PartsSpec, measuredMm: number): {spec: PartsSpec; applied: boolean; factor: number} {
  const est = longestDim(spec.overall_mm)
  if (!isFinite(measuredMm) || measuredMm <= 0 || est <= 0) return {spec, applied: false, factor: 1}
  const factor = measuredMm / est
  if (factor < 0.25 || factor > 4) return {spec, applied: false, factor}
  const s = (v: Vec3) => scaleVec(v, factor)
  return {
    spec: {
      ...spec,
      scale_source: spec.scale_source === "authored" ? "authored" : "measured",
      overall_mm: s(spec.overall_mm),
      parts: spec.parts.map((p) => ({...p, dims_mm: s(p.dims_mm), pos_mm: s(p.pos_mm), explode_mm: s(p.explode_mm)})),
      how_it_works: spec.how_it_works.map((st) =>
        st.action === "slide" || st.action === "compress" ? {...st, amount: st.amount * factor} : st
      )
    },
    applied: true,
    factor
  }
}

export function scaleLabel(spec: PartsSpec): string {
  const mm = Math.round(longestDim(spec.overall_mm))
  if (spec.scale_source === "measured") return `${mm} mm (measured)`
  if (spec.scale_source === "authored") return `${mm} mm (verified)`
  return `~${mm} mm (est.)`
}

export function badgeText(spec: PartsSpec): string {
  switch (spec.design_label) {
    case "verified":
      return "VERIFIED DESIGN"
    case "rough":
      return "ROUGH SKETCH: designs vary"
    case "exterior_only":
      return "EXTERIOR ONLY: not safe to open"
    default:
      return "TYPICAL DESIGN: yours may differ"
  }
}

// ---------------------------------------------------------------------------
// Explode animation
// ---------------------------------------------------------------------------

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * Staggered explode: parts with shorter explode vectors leave first, so the
 * diagram unfolds from the inside out. Returns a 0-1 progress for part i.
 */
export function staggeredProgress(t: number, order: number, count: number, stagger = 0.35): number {
  if (count <= 1) return easeInOutCubic(t)
  const start = (order / (count - 1)) * stagger
  return easeInOutCubic((t - start) / (1 - stagger))
}

/** Order index per part (0 = moves first). */
export function explodeOrder(parts: PartSpecPart[]): number[] {
  const idx = parts.map((p, i) => ({i, l: len(p.explode_mm)}))
  idx.sort((a, b) => a.l - b.l || a.i - b.i)
  const order = new Array(parts.length)
  idx.forEach((e, rank) => (order[e.i] = rank))
  return order
}

/** Position (mm, object-local) of part i at explode amount t in [0, 1] (t may exceed 1 for "explode more"). */
export function explodedPosition(part: PartSpecPart, order: number, count: number, t: number): Vec3 {
  const over = Math.max(0, t - 1)
  const k = staggeredProgress(Math.min(t, 1), order, count) + over
  return {
    x: part.pos_mm.x + part.explode_mm.x * k,
    y: part.pos_mm.y + part.explode_mm.y * k,
    z: part.pos_mm.z + part.explode_mm.z * k
  }
}

/** Display style for a part (renderer maps this to materials). */
export function partStyle(part: PartSpecPart, spec: PartsSpec): "solid" | "ghost" | "dashed" {
  if (part.shape === "ghost_shell") return "ghost"
  if (spec.design_label !== "verified" && part.hidden && part.confidence <= HIDDEN_CONFIDENCE_CAP) return "dashed"
  return "solid"
}

export function partCallout(part: PartSpecPart, index: number, spec: PartsSpec): string {
  const likely = partStyle(part, spec) === "dashed" ? " (likely)" : ""
  return `${index + 1}. ${part.name}${likely}`
}

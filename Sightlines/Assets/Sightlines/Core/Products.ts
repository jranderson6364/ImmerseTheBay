/**
 * Procedural "exploded diagram" product models for the Sightlines showcase. Pure TypeScript, unit-tested.
 *
 * Each model is a list of parts; each part is a handful of boxes and cylinders in design centimetres (the
 * assembled model is roughly 40-75 cm across; the showcase rescales it to the requested size). Parts are built
 * as separate meshes so the showcase can explode them by lerping transforms, never by rebuilding meshes.
 *
 * Facts: titles and part labels are deliberately generic ("hard drives", "solar array", "GPU die",
 * "vacuum tubes"). No model claims a year, count or spec; the shapes are illustrative, not replicas.
 * The only story link is `cardIds`, which point at facts already sourced in Core/Cards.ts.
 *
 * Mesh format matches Core/MapMesh.ts: 8 floats per vertex (position xyz, normal xyz, texture0 uv = 0,0),
 * UInt16 indices, both windings emitted so material culling can't hide faces.
 */
import {MeshChunk} from "./MapMesh"

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type Axis = "x" | "y" | "z"

/** Axis-aligned box of `size` centred at `pos`, optionally rotated (Euler degrees, X then Y then Z, about `pos`). */
export interface BoxPrim {
  kind: "box"
  size: Vec3
  pos: Vec3
  rot?: Vec3
}

/** Capped cylinder along `axis`, centred at `pos`, optionally rotated like a box. */
export interface CylinderPrim {
  kind: "cylinder"
  radius: number
  height: number
  axis: Axis
  pos: Vec3
  segments?: number
  rot?: Vec3
  /** Radius at the +axis end; defaults to `radius`. Set it for a cone or frustum (bells, spires). */
  radiusTop?: number
}

/** UV sphere centred at `pos` (nodes, globes, bell crowns). */
export interface SpherePrim {
  kind: "sphere"
  radius: number
  pos: Vec3
  /** Around the equator; default 14. */
  segments?: number
  /** Pole to pole; default 8. */
  rings?: number
}

export type Primitive = BoxPrim | CylinderPrim | SpherePrim

/** Bright colour groups. The Spectacles display is additive: dark reads as transparent, so nothing here is dark. */
export type ColorGroup = "shell" | "frame" | "accent" | "chip" | "board" | "metal" | "glow" | "red" | "violet" | "yellow" | "leader"

export const PRODUCT_COLORS: Record<ColorGroup, [number, number, number, number]> = {
  shell: [0.55, 0.75, 1.0, 1],
  frame: [0.3, 0.95, 1.0, 1],
  accent: [1.0, 0.6, 0.2, 1],
  chip: [0.95, 0.97, 1.0, 1],
  board: [0.35, 1.0, 0.55, 1],
  metal: [0.8, 0.86, 0.96, 1],
  glow: [1.0, 0.82, 0.35, 1],
  red: [1.0, 0.42, 0.45, 1],
  violet: [0.72, 0.6, 1.0, 1],
  yellow: [1.0, 0.95, 0.4, 1],
  leader: [0.9, 0.95, 1.0, 1]
}

export interface ProductPart {
  /** Stable id within the model. */
  name: string
  /** Generic label shown beside the part. Parts sharing a label are labelled once (see labelledParts). */
  label: string
  color: ColorGroup
  prims: Primitive[]
  /** Where the part travels when fully exploded, design cm, model frame. Zero means it stays put. */
  explode: Vec3
  /** When the part starts moving, as a fraction of the explode timeline (0..1 - EXPLODE_WINDOW). */
  delay: number
  /** Optional spin about the part's own centre while shown (fans). */
  spin?: {axis: Axis; degPerSec: number}
  /** Direction from the part centre to its label. Defaults to the explode direction, or up. */
  labelDir?: Vec3
}

export interface ProductModel {
  id: string
  title: string
  /** Fact ids in Core/Cards.ts that this model illustrates. */
  cardIds: string[]
  /** Landmark (card) ids whose buildings show this model. */
  landmarkIds: string[]
  parts: ProductPart[]
}

/** Each part's own move takes this fraction of the timeline; delay + window <= 1. */
export const EXPLODE_WINDOW = 0.4
/** Recommended per-model vertex budget (the brief says about 20k). */
export const MODEL_VERTEX_BUDGET = 20000
const MAX_CHUNK_VERTS = 64000
const STRIDE = 8

// ---------------------------------------------------------------------------------------------------------------
// Primitive helpers

const v3 = (x: number, y: number, z: number): Vec3 => ({x, y, z})

function box(w: number, h: number, d: number, x: number, y: number, z: number, rot?: Vec3): BoxPrim {
  return rot ? {kind: "box", size: v3(w, h, d), pos: v3(x, y, z), rot} : {kind: "box", size: v3(w, h, d), pos: v3(x, y, z)}
}

function cyl(radius: number, height: number, axis: Axis, x: number, y: number, z: number, segments = 16, rot?: Vec3): CylinderPrim {
  const c: CylinderPrim = {kind: "cylinder", radius, height, axis, pos: v3(x, y, z), segments}
  if (rot) c.rot = rot
  return c
}

/**
 * A course-by-course toy-block wall along X or Z: bricks of `brickLen` in running bond (alternate rows offset by
 * half a brick), with small gaps so the seams read on an additive display. `from`/`to` run along `along`.
 */
function brickWall(along: "x" | "z", from: number, to: number, fixed: number, thickness: number, y0: number, rows: number, rowH: number, brickLen = 8, gap = 0.35): BoxPrim[] {
  const out: BoxPrim[] = []
  for (let r = 0; r < rows; r++) {
    let s = from
    let next = from + (r % 2 ? brickLen / 2 : brickLen)
    while (s < to - 1e-6) {
      const e = Math.min(next, to)
      const len = e - s - gap
      const mid = (s + e) / 2
      const y = y0 + r * rowH + rowH / 2
      if (along === "x") out.push(box(len, rowH - gap, thickness, mid, y, fixed))
      else out.push(box(thickness, rowH - gap, len, fixed, y, mid))
      s = e
      next = e + brickLen
    }
  }
  return out
}

/** Studs on top of a plate area (toy-block bumps), in a grid with `pitch` spacing. */
function studs(x0: number, x1: number, z0: number, z1: number, yTop: number, pitch = 4, radius = 1.2, height = 1.2): CylinderPrim[] {
  const out: CylinderPrim[] = []
  for (let x = x0 + pitch / 2; x < x1; x += pitch) {
    for (let z = z0 + pitch / 2; z < z1; z += pitch) out.push(cyl(radius, height, "y", x, yTop + height / 2, z, 10))
  }
  return out
}

/** Fan blades around a hub in the XY plane, centred at (cx, cy, cz). */
function fanBlades(cx: number, cy: number, cz: number, n: number, radius: number): BoxPrim[] {
  const out: BoxPrim[] = []
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 360
    const rad = (a * Math.PI) / 180
    const r = radius * 0.55
    out.push(box(radius * 0.32, radius * 0.72, 0.25, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, cz, v3(0, 25, a - 90)))
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Models

/** Graphics card: PCB, GPU die, memory chips, heatsink fins, fans, bracket. Generic layout, not a specific board. */
function graphicsCard(): ProductModel {
  const fins: BoxPrim[] = []
  for (let i = 0; i < 44; i++) fins.push(box(0.3, 18, 5.2, -21.5 + i * 1.0, 0, 4.6))
  const mem: BoxPrim[] = []
  for (const [dx, dy] of [[-7, 4], [-7, -4], [11, 4], [11, -4], [-3, 8], [7, 8], [-3, -8], [7, -8]]) mem.push(box(3, 2.4, 0.5, 2 + dx, dy, 0.65))
  const vrm: BoxPrim[] = []
  for (let i = 0; i < 8; i++) vrm.push(box(1.4, 1.4, 0.7, -16 + i * 1.9, 7.8, 0.75))
  const shroud = [
    box(50, 1.4, 2, 0, 10.3, 9), box(50, 1.4, 2, 0, -10.3, 9), box(1.4, 22, 2, -24.3, 0, 9), box(1.4, 22, 2, 24.3, 0, 9), box(1.4, 22, 2, 0, 0, 9)
  ]
  const fan = (cx: number): Primitive[] => [cyl(2.4, 1.4, "z", cx, 0, 8.4, 16), ...fanBlades(cx, 0, 8.4, 7, 9)]
  return {
    id: "graphics_card",
    title: "Graphics card",
    cardIds: ["huang.1"],
    landmarkIds: ["huang"],
    parts: [
      {name: "shroud", label: "fan shroud", color: "accent", prims: shroud, explode: v3(0, 0, 22), delay: 0},
      {name: "fan_left", label: "cooling fans", color: "frame", prims: fan(-12), explode: v3(-4, 0, 16), delay: 0.08, spin: {axis: "z", degPerSec: 220}},
      {name: "fan_right", label: "cooling fans", color: "frame", prims: fan(12), explode: v3(4, 0, 16), delay: 0.12, spin: {axis: "z", degPerSec: -220}},
      {name: "heatsink", label: "heatsink fins", color: "metal", prims: [...fins, box(44, 18, 0.6, 0, 0, 1.9)], explode: v3(0, 0, 11), delay: 0.2},
      {name: "heat_pipes", label: "heat pipes", color: "glow", prims: [cyl(0.5, 40, "x", 0, 3, 2.5, 8), cyl(0.5, 40, "x", 0, -1, 2.5, 8), cyl(0.5, 40, "x", 0, -5, 2.5, 8)], explode: v3(0, 0, 7), delay: 0.26},
      {name: "bracket", label: "mounting bracket", color: "metal", prims: [box(0.6, 24, 11, -25.6, 0, 3.5), box(1.2, 2.4, 4, -26.4, 6, 3.5), box(1.2, 2.4, 4, -26.4, 1, 3.5), box(1.2, 2.4, 4, -26.4, -4, 3.5), box(2, 1, 11, -26.6, 12, 3.5)], explode: v3(-12, 0, 0), delay: 0.18},
      {name: "backplate", label: "backplate", color: "violet", prims: [box(46, 19, 0.4, 1, 0, -1.2)], explode: v3(0, 0, -10), delay: 0.3},
      {name: "package", label: "chip package", color: "yellow", prims: [box(8, 8, 0.6, 2, 0, 0.7)], explode: v3(0, 0, 4.5), delay: 0.42},
      {name: "die", label: "GPU die", color: "chip", prims: [box(4.4, 4.4, 0.6, 2, 0, 1.3)], explode: v3(0, 3, 8), delay: 0.5, labelDir: v3(0.5, 1, 0.4)},
      {name: "memory", label: "memory chips", color: "violet", prims: mem, explode: v3(0, 0, 5.5), delay: 0.46, labelDir: v3(1, -1, 0.3)},
      {name: "power", label: "power stages", color: "red", prims: vrm, explode: v3(0, 6, 3.5), delay: 0.48},
      {name: "pcb", label: "circuit board", color: "board", prims: [box(48, 20, 0.8, 0, 0, 0)], explode: v3(0, 0, 0), delay: 0, labelDir: v3(-1, -0.6, 0)},
      {name: "connector", label: "edge connector", color: "glow", prims: [box(24, 1.6, 0.9, 4, -10.8, 0)], explode: v3(0, -7, 0), delay: 0.55}
    ]
  }
}

/** Toy-block server enclosure around hard drives (card huang.3 / gates.2). Brick colours are per wall. */
function blockServer(): ProductModel {
  const rowH = 3.6
  const rows = 8
  const y0 = 2.4
  const top = y0 + rows * rowH
  const base: BoxPrim[] = []
  const lid: Primitive[] = []
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      base.push(box(7.65, 2.05, 7.65, -16 + i * 8, 1.2, -8 + j * 8))
      lid.push(box(7.65, 2.05, 7.65, -16 + i * 8, top + 1.2, -8 + j * 8))
    }
  }
  lid.push(...studs(-20, 20, -12, 12, top + 2.2))
  const drive = (i: number): ProductPart => ({
    name: "drive_" + i,
    label: "hard drives",
    color: "metal",
    prims: [box(26, 4, 18, 0, 7 + i * 6, 3), box(18, 0.3, 12, 0, 9.15 + i * 6, 3.5), box(5, 1.6, 1.2, -8, 7 + i * 6, -6.6)],
    explode: v3(0, (i - 1.5) * 3, 12 + i * 2),
    delay: 0.32 + i * 0.05,
    labelDir: v3(1, 0.4, 0.4)
  })
  const cables: BoxPrim[] = []
  for (let i = 0; i < 4; i++) cables.push(box(1.6, 0.3, 2.4, -8, 7 + i * 6, -6.2 - 1.2), box(1.6, 6, 0.3, -8 + (i - 1.5) * 2.2, 10 + i * 3, -6.9))
  return {
    id: "block_server",
    title: "Toy-block server",
    cardIds: ["huang.3", "gates.2"],
    landmarkIds: ["huang", "gates"],
    parts: [
      {name: "lid", label: "toy-block lid", color: "frame", prims: lid, explode: v3(0, 14, 0), delay: 0},
      {name: "wall_left", label: "toy-block walls", color: "red", prims: brickWall("z", -8, 12, -18, 4, y0, rows, rowH), explode: v3(-12, 0, 0), delay: 0.1},
      {name: "wall_right", label: "toy-block walls", color: "yellow", prims: brickWall("z", -8, 12, 18, 4, y0, rows, rowH), explode: v3(12, 0, 0), delay: 0.14, labelDir: v3(1, 1, 0)},
      {name: "wall_back", label: "toy-block walls", color: "board", prims: brickWall("x", -20, 20, -10, 4, y0, rows, rowH), explode: v3(0, 0, -12), delay: 0.2},
      {name: "base", label: "toy-block base", color: "shell", prims: base, explode: v3(0, -8, 0), delay: 0.16},
      drive(0),
      drive(1),
      drive(2),
      drive(3),
      {name: "board", label: "circuit board", color: "board", prims: [box(28, 26, 0.8, 0, 17, -7.4), box(4, 4, 0.6, 6, 22, -6.7), box(3, 3, 0.6, -2, 14, -6.7)], explode: v3(0, 4, -6), delay: 0.5},
      {name: "cables", label: "cables", color: "accent", prims: cables, explode: v3(0, 8, -3), delay: 0.56}
    ]
  }
}

/** GPS satellite: bus, solar array wings on booms, antenna array. Generic shape, not a specific block. */
function gpsSatellite(): ProductModel {
  const wing = (sign: number): BoxPrim[] => {
    const cells: BoxPrim[] = []
    for (let p = 0; p < 2; p++) {
      const x0 = sign * (12.5 + p * 13)
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) cells.push(box(3.9, 0.4, 3.2, x0 + sign * (2.15 + i * 4.2), 0, -6.3 + j * 4.2))
      cells.push(box(12.6, 0.6, 0.4, x0 + sign * 6.3, 0, -8.2), box(12.6, 0.6, 0.4, x0 + sign * 6.3, 0, 8.2))
    }
    return cells
  }
  const elements: Primitive[] = [box(14, 1, 14, 0, -10.5, 0)]
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    elements.push(cyl(0.7, 6, "y", Math.cos(a) * 5, -14, Math.sin(a) * 5, 8))
  }
  elements.push(cyl(0.9, 7, "y", 0, -14.5, 0, 10))
  return {
    id: "gps_satellite",
    title: "GPS satellite",
    cardIds: ["spilker.1", "spilker.2", "spilker.4"],
    landmarkIds: ["spilker"],
    parts: [
      {name: "bus", label: "satellite body", color: "glow", prims: [box(16, 20, 16, 0, 0, 0), box(12, 0.4, 12, 0, 10.2, 0)], explode: v3(0, 0, 0), delay: 0, labelDir: v3(0.3, 1, 0.6)},
      {name: "array_left", label: "solar array", color: "violet", prims: wing(-1), explode: v3(-16, 0, 0), delay: 0.05},
      {name: "array_right", label: "solar array", color: "violet", prims: wing(1), explode: v3(16, 0, 0), delay: 0.05, labelDir: v3(0.4, 1, 0)},
      {name: "boom_left", label: "array booms", color: "metal", prims: [cyl(0.6, 4.6, "x", -10.3, 0, 0, 10), box(1.2, 1.2, 1.2, -12.3, 0, 0)], explode: v3(-7, 0, 0), delay: 0.2},
      {name: "boom_right", label: "array booms", color: "metal", prims: [cyl(0.6, 4.6, "x", 10.3, 0, 0, 10), box(1.2, 1.2, 1.2, 12.3, 0, 0)], explode: v3(7, 0, 0), delay: 0.2},
      {name: "antennas", label: "antenna array", color: "frame", prims: elements, explode: v3(0, -16, 0), delay: 0.35, labelDir: v3(0.6, -1, 0.4)},
      {name: "radiator_left", label: "radiator panels", color: "chip", prims: [box(0.4, 16, 12, -8.3, 0, 0)], explode: v3(-4, 0, 0), delay: 0.5, labelDir: v3(-0.3, 0.4, 1)},
      {name: "radiator_right", label: "radiator panels", color: "chip", prims: [box(0.4, 16, 12, 8.3, 0, 0)], explode: v3(4, 0, 0), delay: 0.5}
    ]
  }
}

/** Audio oscillator: case, front panel, dial, knobs, and the vacuum tubes inside. Generic, not a replica. */
function audioOscillator(): ProductModel {
  const marks: BoxPrim[] = []
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    marks.push(box(0.3, 1.2, 0.3, -6 + Math.cos(a) * 6.2, 2 + Math.sin(a) * 6.2, 15.2, v3(0, 0, (a * 180) / Math.PI - 90)))
  }
  const tube = (x: number, z: number, h: number): Primitive[] => [cyl(1.9, 1.2, "y", x, -7.4, z, 12), cyl(1.5, h, "y", x, -6.8 + h / 2, z, 14), cyl(0.6, 0.8, "y", x, -6.8 + h + 0.4, z, 8)]
  return {
    id: "audio_oscillator",
    title: "Audio oscillator",
    cardIds: ["hpgarage.1", "packard.1"],
    landmarkIds: ["hpgarage", "packard"],
    parts: [
      {
        name: "case", label: "case", color: "shell",
        prims: [box(40, 0.8, 26, 0, 12, 0), box(40, 0.8, 26, 0, -12, 0), box(0.8, 24, 26, -19.6, 0, 0), box(0.8, 24, 26, 19.6, 0, 0), box(40, 24, 0.8, 0, 0, -12.6), box(10, 1.2, 2, 0, 13, 0)],
        explode: v3(0, 16, -8), delay: 0
      },
      {name: "front", label: "front panel", color: "frame", prims: [box(40, 24, 1, 0, 0, 13.5)], explode: v3(0, 0, 9), delay: 0.12, labelDir: v3(-1, -1, 0.3)},
      {name: "dial", label: "frequency dial", color: "chip", prims: [cyl(6.8, 1, "z", -6, 2, 14.5, 32), cyl(1.4, 2, "z", -6, 2, 15.5, 12), box(0.5, 6, 0.4, -6, 4.6, 15.3), ...marks], explode: v3(-3, 3, 15), delay: 0.22},
      {name: "knobs", label: "control knobs", color: "accent", prims: [cyl(1.8, 2.2, "z", 11, 5, 15.1, 14), cyl(1.8, 2.2, "z", 11, -2, 15.1, 14), cyl(1.2, 1.8, "z", 5, -8, 14.9, 12)], explode: v3(5, 0, 13), delay: 0.28},
      {name: "terminals", label: "output terminals", color: "red", prims: [cyl(0.9, 2.4, "z", 13, -8, 15.2, 10), cyl(0.9, 2.4, "z", 16, -8, 15.2, 10)], explode: v3(6, -3, 12), delay: 0.32},
      {name: "chassis", label: "chassis", color: "metal", prims: [box(38, 0.8, 24, 0, -8.4, -0.5)], explode: v3(0, -10, 0), delay: 0.38},
      {name: "tubes", label: "vacuum tubes", color: "glow", prims: [...tube(-12, -6, 7), ...tube(-6, -6, 7), ...tube(0, -6, 8.5), ...tube(6, -6, 7)], explode: v3(0, 10, -2), delay: 0.46, labelDir: v3(-0.6, 1, 0)},
      {name: "transformer", label: "transformer", color: "violet", prims: [box(6, 6, 5, 13, -5, -6), box(6.8, 1, 5.8, 13, -1.6, -6)], explode: v3(8, 8, -6), delay: 0.5},
      {name: "capacitors", label: "capacitors", color: "yellow", prims: [cyl(1.4, 5, "y", -12, -5.5, 4, 12), cyl(1.4, 5, "y", -8.5, -5.5, 4, 12), cyl(1.0, 3.5, "y", 8, -6.2, 3, 10)], explode: v3(-6, 8, 6), delay: 0.54}
    ]
  }
}

export const PRODUCTS: ProductModel[] = [graphicsCard(), blockServer(), gpsSatellite(), audioOscillator()]

export function productById(id: string): ProductModel | undefined {
  for (const p of PRODUCTS) if (p.id === id) return p
  return undefined
}

/** Models for a building, in display order (Huang: graphics card first, then the toy-block server). */
export function modelsForLandmark(landmarkId: string): ProductModel[] {
  return PRODUCTS.filter((p) => p.landmarkIds.indexOf(landmarkId) >= 0)
}

/** The model that illustrates a fact id from Core/Cards.ts, if any. */
export function modelForFact(factId: string): ProductModel | undefined {
  for (const p of PRODUCTS) if (p.cardIds.indexOf(factId) >= 0) return p
  return undefined
}

/** The first part for each distinct label: those get the leader line and label. */
export function labelledParts(model: ProductModel): ProductPart[] {
  const seen: Record<string, boolean> = {}
  const out: ProductPart[] = []
  for (const p of model.parts) {
    if (seen[p.label]) continue
    seen[p.label] = true
    out.push(p)
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry

function rotate(p: Vec3, rot: Vec3 | undefined): Vec3 {
  if (!rot) return p
  let {x, y, z} = p
  const rx = (rot.x * Math.PI) / 180, ry = (rot.y * Math.PI) / 180, rz = (rot.z * Math.PI) / 180
  if (rx) {
    const c = Math.cos(rx), s = Math.sin(rx)
    const ny = y * c - z * s
    z = y * s + z * c
    y = ny
  }
  if (ry) {
    const c = Math.cos(ry), s = Math.sin(ry)
    const nx = x * c + z * s
    z = -x * s + z * c
    x = nx
  }
  if (rz) {
    const c = Math.cos(rz), s = Math.sin(rz)
    const nx = x * c - y * s
    y = x * s + y * c
    x = nx
  }
  return {x, y, z}
}

/** Maps a Y-axis-local cylinder point onto the requested axis (a proper rotation, so normals stay valid). */
function toAxis(p: Vec3, axis: Axis): Vec3 {
  if (axis === "x") return {x: p.y, y: -p.x, z: p.z}
  if (axis === "z") return {x: p.x, y: -p.z, z: p.y}
  return p
}

class PartWriter {
  verts: number[] = []
  idx: number[] = []

  vert(prim: Primitive, local: Vec3, normal: Vec3, origin: Vec3): number {
    const rot = prim.kind === "sphere" ? undefined : prim.rot
    const p = rotate(local, rot)
    const n = rotate(normal, rot)
    const id = this.verts.length / STRIDE
    this.verts.push(p.x + prim.pos.x - origin.x, p.y + prim.pos.y - origin.y, p.z + prim.pos.z - origin.z, n.x, n.y, n.z, 0, 0)
    return id
  }

  /** Both windings, like MapMesh, so culling never hides a face. */
  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c, a, c, b)
  }
}

function writeBox(w: PartWriter, b: BoxPrim, origin: Vec3) {
  const h = {x: b.size.x / 2, y: b.size.y / 2, z: b.size.z / 2}
  // normal axis, then the two in-plane axes
  const faces: [Vec3, Vec3, Vec3][] = [
    [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)],
    [v3(-1, 0, 0), v3(0, 0, 1), v3(0, 1, 0)],
    [v3(0, 1, 0), v3(0, 0, 1), v3(1, 0, 0)],
    [v3(0, -1, 0), v3(1, 0, 0), v3(0, 0, 1)],
    [v3(0, 0, 1), v3(1, 0, 0), v3(0, 1, 0)],
    [v3(0, 0, -1), v3(0, 1, 0), v3(1, 0, 0)]
  ]
  for (const [n, u, v] of faces) {
    const ids: number[] = []
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = {
        x: (n.x + u.x * a + v.x * c) * h.x,
        y: (n.y + u.y * a + v.y * c) * h.y,
        z: (n.z + u.z * a + v.z * c) * h.z
      }
      ids.push(w.vert(b, p, n, origin))
    }
    w.tri(ids[0], ids[1], ids[2])
    w.tri(ids[0], ids[2], ids[3])
  }
}

function writeCylinder(w: PartWriter, c: CylinderPrim, origin: Vec3) {
  const seg = Math.max(3, Math.floor(c.segments || 16))
  const hh = c.height / 2
  const r0 = c.radius
  const r1 = c.radiusTop === undefined ? c.radius : c.radiusTop
  // Side normal of a frustum tilts by the slope; for a plain cylinder ny = 0.
  const slope = Math.atan2(r0 - r1, c.height)
  const ny = Math.sin(slope), nr = Math.cos(slope)
  const put = (p: Vec3, n: Vec3) => w.vert(c, toAxis(p, c.axis), toAxis(n, c.axis), origin)
  // side
  const side: number[] = []
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    const cx = Math.cos(a), sz = Math.sin(a)
    side.push(put(v3(cx * r0, -hh, sz * r0), v3(cx * nr, ny, sz * nr)))
    side.push(put(v3(cx * r1, hh, sz * r1), v3(cx * nr, ny, sz * nr)))
  }
  for (let i = 0; i < seg; i++) {
    const a = side[2 * i], b = side[2 * i + 1], d = side[2 * i + 2], e = side[2 * i + 3]
    w.tri(a, b, e)
    w.tri(a, e, d)
  }
  // caps
  for (const sgn of [1, -1]) {
    const r = sgn > 0 ? r1 : r0
    const center = put(v3(0, sgn * hh, 0), v3(0, sgn, 0))
    const ring: number[] = []
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      ring.push(put(v3(Math.cos(a) * r, sgn * hh, Math.sin(a) * r), v3(0, sgn, 0)))
    }
    for (let i = 0; i < seg; i++) w.tri(center, ring[i], ring[i + 1])
  }
}

function writeSphere(w: PartWriter, s: SpherePrim, origin: Vec3) {
  const seg = Math.max(3, Math.floor(s.segments || 14))
  const rings = Math.max(2, Math.floor(s.rings || 8))
  const ids: number[] = []
  for (let j = 0; j <= rings; j++) {
    const th = (j / rings) * Math.PI
    const y = Math.cos(th), rr = Math.sin(th)
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const n = v3(Math.cos(a) * rr, y, Math.sin(a) * rr)
      ids.push(w.vert(s, v3(n.x * s.radius, n.y * s.radius, n.z * s.radius), n, origin))
    }
  }
  const row = seg + 1
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = ids[j * row + i], b = ids[j * row + i + 1], c = ids[(j + 1) * row + i], d = ids[(j + 1) * row + i + 1]
      w.tri(a, c, d)
      w.tri(a, d, b)
    }
  }
}

/** Exact vertex count a primitive produces (box 24; cylinder 4 * segments + 6; sphere (rings + 1) * (segments + 1)). */
export function primitiveVertexCount(p: Primitive): number {
  if (p.kind === "box") return 24
  if (p.kind === "sphere") return (Math.max(2, Math.floor(p.rings || 8)) + 1) * (Math.max(3, Math.floor(p.segments || 14)) + 1)
  const seg = Math.max(3, Math.floor(p.segments || 16))
  return 4 * seg + 6
}

/** A list of primitives as one mesh chunk, vertices relative to `origin`. Throws past one UInt16 chunk. */
export function buildPrims(prims: Primitive[], origin: Vec3 = v3(0, 0, 0), name = "prims"): MeshChunk {
  let n = 0
  for (const p of prims) n += primitiveVertexCount(p)
  if (n >= MAX_CHUNK_VERTS) throw new Error(`${name} has ${n} vertices; split it (limit ${MAX_CHUNK_VERTS})`)
  const w = new PartWriter()
  for (const p of prims) {
    if (p.kind === "box") writeBox(w, p, origin)
    else if (p.kind === "sphere") writeSphere(w, p, origin)
    else writeCylinder(w, p, origin)
  }
  return {verts: w.verts, idx: w.idx}
}

/**
 * One part as a single mesh chunk. Vertices are relative to `origin` (default: the model origin); the showcase
 * passes partCenter(part) so the part can spin about its own centre. Throws if a part would exceed one chunk.
 */
export function buildPart(part: ProductPart, origin: Vec3 = v3(0, 0, 0)): MeshChunk {
  return buildPrims(part.prims, origin, "part " + part.name)
}

export interface Bounds {
  min: Vec3
  max: Vec3
}

function primBounds(p: Primitive): Bounds {
  if (p.kind === "sphere") {
    const r = p.radius
    return {min: v3(p.pos.x - r, p.pos.y - r, p.pos.z - r), max: v3(p.pos.x + r, p.pos.y + r, p.pos.z + r)}
  }
  // Conservative: use the rotated corners of the primitive's local box.
  const h = p.kind === "box" ? {x: p.size.x / 2, y: p.size.y / 2, z: p.size.z / 2} : toAxisExtent(p)
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity)
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const q = rotate(v3(sx * h.x, sy * h.y, sz * h.z), p.rot)
    min.x = Math.min(min.x, q.x + p.pos.x); max.x = Math.max(max.x, q.x + p.pos.x)
    min.y = Math.min(min.y, q.y + p.pos.y); max.y = Math.max(max.y, q.y + p.pos.y)
    min.z = Math.min(min.z, q.z + p.pos.z); max.z = Math.max(max.z, q.z + p.pos.z)
  }
  return {min, max}
}

function toAxisExtent(c: CylinderPrim): Vec3 {
  const r = Math.max(c.radius, c.radiusTop === undefined ? c.radius : c.radiusTop), h = c.height / 2
  if (c.axis === "x") return v3(h, r, r)
  if (c.axis === "z") return v3(r, r, h)
  return v3(r, h, r)
}

function mergeBounds(list: Bounds[]): Bounds {
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity)
  for (const b of list) {
    min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y); min.z = Math.min(min.z, b.min.z)
    max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y); max.z = Math.max(max.z, b.max.z)
  }
  return {min, max}
}

export function partBounds(part: ProductPart): Bounds {
  return mergeBounds(part.prims.map(primBounds))
}

/** Centre of a part's bounding box, model frame (the part's pivot in the showcase). */
export function partCenter(part: ProductPart): Vec3 {
  const b = partBounds(part)
  return v3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
}

/** Assembled bounding box of the whole model. */
export function modelBounds(model: ProductModel): Bounds {
  return mergeBounds(model.parts.map(partBounds))
}

/** Longest assembled extent, design cm. The showcase scales by scaleCm / modelSpan. */
export function modelSpan(model: ProductModel): number {
  const b = modelBounds(model)
  return Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z)
}

export function modelVertexCount(model: ProductModel): number {
  let n = 0
  for (const part of model.parts) for (const p of part.prims) n += primitiveVertexCount(p)
  return n
}

// ---------------------------------------------------------------------------------------------------------------
// Animation

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Ease in and out (cubic): 0 -> 0, 1 -> 1, monotonic, flat at both ends. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** A part's own eased progress (0..1) at timeline position t (0 = assembled, 1 = fully exploded). */
export function partProgress(part: ProductPart, t: number): number {
  return easeInOutCubic((clamp01(t) - part.delay) / EXPLODE_WINDOW)
}

/** Offset from the assembled position at timeline t: zero at t = 0, the full explode vector at t = 1. */
export function explodedPosition(part: ProductPart, t: number): Vec3 {
  const e = partProgress(part, t)
  return v3(part.explode.x * e, part.explode.y * e, part.explode.z * e)
}

/** Unit direction from the part centre to its label: labelDir, else the explode direction, else up. */
export function labelDirection(part: ProductPart): Vec3 {
  const d = part.labelDir || part.explode
  const l = Math.hypot(d.x, d.y, d.z)
  if (l < 1e-2) return v3(0, 1, 0)
  return v3(d.x / l, d.y / l, d.z / l)
}

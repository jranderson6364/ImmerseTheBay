/**
 * Building "experiences": a small animated 3D lesson that appears beside a building when it's selected.
 * Pure TypeScript, unit-tested (tests/experiences.test.ts). Scripts/RetrospecsExperiences.ts builds the meshes once
 * and applies `poses(t)` to plain transforms every frame. Meshes are never rebuilt while animating.
 *
 * DESIGN NOTE: one idea per building, chosen from the brainstorm.
 *   mainquad A living blueprint (loops every 19 s). A gold grid unrolls on the ground and the plan draws itself on it
 *            (mainquad.1). The church rises off the axis and slides onto it (mainquad.2), the axis draws out from its
 *            door, and six arcade wings rise round the courtyard with tile roofs dropping on. Then solid arch bases
 *            come up, the ground shudders, and the lost Memorial Arch draws itself up from them as a rose wireframe
 *            ghost: piers, two half-arches swinging shut, an attic (mainquad.3). Last, a time capsule drops in and is
 *            buried beside the arcade's plaques and a new plaque seals it (mainquad.4). Everything sinks back into
 *            the plan. The ghost is drawn rather than collapsed so it doesn't repeat memchu. Proportions are visual.
 *   huang    One core, or all of them (loops every 14 s). A chip's lid lifts off a 5 x 5 array of cores. One worker
 *            hops core to core computing a ripple, so the surface comes out stale and jagged. Then a sheet of data
 *            falls onto every core at once and the ripple runs live across the whole array. That is the idea behind
 *            NVIDIA's GPUs. (Money piles already exist in RetrospecsMoney, so they aren't repeated here.)
 *   gates    PageRank you can watch. Eight pages and their links. Each node's size is its real PageRank, computed
 *            here by power iteration. Three "random surfers" hop along the links, so they visit the big nodes most.
 *   spilker  The GPS constellation. Three inclined orbit rings carry satellites around a small globe. Signal lines
 *            run from the four highest satellites to a "you are here" pin, with pulses travelling down them.
 *   y2e2     The breathing building. The facade windows open and close on their own in a slow wave, and air motes
 *            flow in through them, across the floors, and up and out through the atria.
 *   hoover   The tower that rings (loops every 22 s). A gold scan ring climbs as the tower extrudes section by section
 *            (hoover.1) and the dome drops on. The largest bell rises inside to the belfry and its deck (hoover.3).
 *            Gold hoops open round the belfry and the other bells spiral up from the ground onto them in arrival
 *            groups. A caption appears when 35 are in place and another at 48. Then the largest bell swings, shells
 *            of sound swell out with each stroke, and the carillon shivers. Hoop layout is visual only.
 *   memchu   The spire that fell. The church stands, shakes, and its tower and spire topple through the roof and
 *            vanish. A faint outline remains, because they were never rebuilt. The facade mosaic twinkles.
 *   packard / hewlett / hpgarage   From the garage. Six generic, unlabelled devices fly out of the garage door one
 *            by one along a rising arc: an oscillator, an instrument, a calculator, a desktop, a laptop and a printer.
 *            No product names or years are shown. Only the garage facts in Cards.ts are labelled.
 *   varian   The klystron, in cutaway (front half of the drift tube and cavities removed). Electron beads leave the
 *            cathode evenly spaced, pass the buncher cavity, and close into four bunches over the drift. Each bunch
 *            swells the catcher cavity as it passes, and a glowing pulse rises up the output waveguide and spreads
 *            out as a ring. Loops every 6 s. Bunching is drawn as each bead closing on its bunch centre (an idealised
 *            picture, not a simulation). Only varian.2 is labelled; part names are generic.
 *   clark    Graphics, then the web. clark.1 is about the companies, while clark.2 and clark.3 are about the
 *            building, so the scene does both. A generic, logo-free workstation sits on the courtyard's circular
 *            stage (clark.3), ringed by three wireframe wings around the courtyard (clark.2). A wireframe
 *            icosahedron spins above it (3D graphics), and a browser-like window folds out of the screen, opens flat,
 *            and fills with placeholder blocks (the web), then folds back. Loops every 12 s. No browser or company
 *            names appear except in the clark.1 label. The open labs and bridges are not shown: no card fact
 *            mentions them.
 *            Both use the "Cardinal pop (toned down)" palette: cardinal hero, soft gold accent, linen neutrals.
 *   moore    A crystal under study. A 3 x 3 x 3 lattice turns on a pedestal, a probe beam scatters off it onto a
 *            screen where a grid of diffraction spots lights up, and one atom hops into a neighbouring vacancy and
 *            back. Only the moore.2 lab name is labelled; lattice size and spot layout are visual only. Same palette.
 *   Rejected: a falling-spire-only idea for the Quad (no card fact for it), and HP product names and years (none
 *   verified from a primary source in time, so the devices stay generic).
 *
 * SOURCING: every label that shows a number or a proper name has a `factId` into Core/Cards.ts, and its `source`
 * constant equals that fact's source URL. Tests check that each digit run, and each capitalised word, appears in the
 * fact, card name or namesake. Labels without a factId are generic and contain no digits. Shapes are illustrative:
 * the bell count (48) and the 35-bell moment come from hoover.4. Orbit tilt, node layout and core count are visual
 * only and never labelled.
 *
 * FRAME: design centimetres, sized for scaleCm = 40 (the component scales by scaleCm / DESIGN_SCALE_CM). The origin
 * is the base centre at the anchor, +Y is up and +Z faces the viewer. Each experience is 30-60 cm across and at most
 * about 45 cm tall.
 *
 * Mesh format matches Core/MapMesh.ts: 8 floats per vertex (position, normal, uv 0,0), UInt16, double-sided.
 */
import {Card, Fact, factById} from "./Cards"
import {MeshChunk, buildTube} from "./MapMesh"
import {Primitive, Vec3, buildPrims, clamp01, easeInOutCubic} from "./Products"

export const DESIGN_SCALE_CM = 40
export const EXPERIENCE_VERTEX_BUDGET = 15000
export const EXPERIENCE_MESH_BUDGET = 40

// ---------------------------------------------------------------------------------------------------------------
// Colours: warm and bright, matching the warm map palette in RetrospecsMap. The display is additive, so dark
// colours read as see-through. Each node is one mesh object in one colour.

export type ExpColor = "gold" | "amber" | "cream" | "clay" | "rose" | "sand" | "white" | "sage" | "cardinal" | "softgold" | "linen"

export const EXP_COLORS: Record<ExpColor, [number, number, number, number]> = {
  // Older names, remapped onto the project's "Cardinal pop (toned down)" palette so every experience matches.
  gold: [0xe9 / 255, 0xbe / 255, 0x5c / 255, 1], // = softgold
  amber: [0.9, 0.62, 0.34, 1], // warm gold-orange, between gold and cardinal
  cream: [0xe8 / 255, 0xdc / 255, 0xc6 / 255, 1], // = linen
  clay: [0xd2 / 255, 0x3a / 255, 0x44 / 255, 1], // = cardinal (the hero colour)
  rose: [0.9, 0.48, 0.5, 1], // light cardinal
  sand: [0.78, 0.7, 0.57, 1], // muted sandstone
  white: [0.96, 0.93, 0.87, 1], // warm white
  sage: [0.58, 0.76, 0.5, 1], // muted sage (Y2E2 air, nature cues)
  // "Cardinal pop (toned down)" palette, used by varian and clark: hero, accent, neutral.
  cardinal: [0xd2 / 255, 0x3a / 255, 0x44 / 255, 1], // #D23A44 Stanford cardinal
  softgold: [0xe9 / 255, 0xbe / 255, 0x5c / 255, 1], // #E9BE5C soft gold
  linen: [0xe8 / 255, 0xdc / 255, 0xc6 / 255, 1] // #E8DCC6 cream / light sand
}

// ---------------------------------------------------------------------------------------------------------------
// Types

export interface Quat {
  x: number
  y: number
  z: number
  w: number
}

/** A node's transform in the experience frame (design cm). The node's mesh is built about its own origin. */
export interface Pose {
  pos: Vec3
  rot: Quat
  scale: Vec3
}

export interface TubeSpec {
  points: Vec3[]
  width: number
}

export interface ExpNode {
  name: string
  color: ExpColor
  prims?: Primitive[]
  tubes?: TubeSpec[]
}

export interface ExpLabel {
  text: string
  /** Experience frame, design cm. */
  pos: Vec3
  /** Seconds (looped time if the experience loops) when the label fades in, and optionally out. */
  from: number
  to?: number
  /** Required for any label with a number or a proper name. */
  factId?: string
  /** Must equal factById(factId).fact.source; kept beside the text so the provenance is visible in code. */
  source?: string
}

export interface Experience {
  id: string
  title: string
  /** Card ids whose selection shows this experience. */
  landmarkIds: string[]
  /** One line: what it teaches. */
  idea: string
  /** Card facts it draws on. */
  factIds: string[]
  nodes: ExpNode[]
  labels: ExpLabel[]
  /** Loop length in seconds for label timing; 0 means the timeline plays once and then holds. */
  loop: number
  /** Time by which everything is in place (for size checks). */
  settle: number
  /** One pose per node, same order as `nodes`. */
  poses(t: number): Pose[]
}

// ---------------------------------------------------------------------------------------------------------------
// Small maths

const v3 = (x: number, y: number, z: number): Vec3 => ({x, y, z})
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z)
const mul = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k)
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z)
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1
  return v3(a.x / l, a.y / l, a.z / l)
}
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const X = v3(1, 0, 0)
const Y = v3(0, 1, 0)
const Z = v3(0, 0, 1)
const TAU = Math.PI * 2
/** Tiny but non-zero, so transforms stay invertible. The component also clamps. */
export const HIDDEN = 1e-4

export const QI: Quat = {x: 0, y: 0, z: 0, w: 1}

/** Rotation of `deg` degrees about `axis` (right-handed, like Lens quat.angleAxis). */
export function qAxis(axis: Vec3, deg: number): Quat {
  const a = norm(axis)
  const h = (deg * Math.PI) / 360
  const s = Math.sin(h)
  return {x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(h)}
}

/** a * b: applies b first, then a. */
export function qMul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  }
}

export function qRot(q: Quat, v: Vec3): Vec3 {
  const u = v3(q.x, q.y, q.z)
  const t = mul(cross(u, v), 2)
  return add(add(v, mul(t, q.w)), cross(u, t))
}

/** Shortest rotation taking unit vector a onto unit vector b. */
export function qFromTo(a: Vec3, b: Vec3): Quat {
  const d = dot(a, b)
  if (d < -0.999999) {
    let axis = cross(X, a)
    if (len(axis) < 1e-6) axis = cross(Y, a)
    return qAxis(axis, 180)
  }
  const c = cross(a, b)
  const q = {x: c.x, y: c.y, z: c.z, w: 1 + d}
  const l = Math.hypot(q.x, q.y, q.z, q.w)
  return {x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l}
}

const pose = (pos: Vec3, rot: Quat = QI, s: number | Vec3 = 1): Pose => ({pos, rot, scale: typeof s === "number" ? v3(s, s, s) : s})
const hidden = (pos: Vec3): Pose => pose(pos, QI, HIDDEN)

/** 0..1 ramp over [a, b], eased. */
function ramp(t: number, a: number, b: number): number {
  return easeInOutCubic((t - a) / Math.max(1e-6, b - a))
}

/** Hump: 0 outside [0,1], 1 in the middle. */
function bump(u: number): number {
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u)
}

function frac(x: number): number {
  return x - Math.floor(x)
}

/** Deterministic pseudo-random sequence (LCG), so the animation is identical every run and testable. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, rot?: Vec3): Primitive {
  return rot ? {kind: "box", size: v3(w, h, d), pos: v3(x, y, z), rot} : {kind: "box", size: v3(w, h, d), pos: v3(x, y, z)}
}

function cyl(radius: number, height: number, axis: "x" | "y" | "z", x: number, y: number, z: number, segments = 14, radiusTop?: number): Primitive {
  const c: Primitive = {kind: "cylinder", radius, height, axis, pos: v3(x, y, z), segments}
  if (radiusTop !== undefined) c.radiusTop = radiusTop
  return c
}

function sphere(radius: number, x: number, y: number, z: number, segments = 14, rings = 8): Primitive {
  return {kind: "sphere", radius, pos: v3(x, y, z), segments, rings}
}

/** Closed circle in a plane: normal "y" is horizontal (XZ), "z" is in XY, "x" is in YZ. */
function circle(c: Vec3, r: number, normal: "x" | "y" | "z", n = 40): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU
    const u = Math.cos(a) * r, w = Math.sin(a) * r
    if (normal === "y") pts.push(v3(c.x + u, c.y, c.z + w))
    else if (normal === "z") pts.push(v3(c.x + u, c.y + w, c.z))
    else pts.push(v3(c.x, c.y + u, c.z + w))
  }
  return pts
}

/** Closed axis-aligned square loop in the XZ plane at height y. */
function squareLoop(cx: number, y: number, cz: number, half: number): Vec3[] {
  return [v3(cx - half, y, cz - half), v3(cx + half, y, cz - half), v3(cx + half, y, cz + half), v3(cx - half, y, cz + half), v3(cx - half, y, cz - half)]
}

/** Label with its fact provenance attached. Throws at load time if the fact id is wrong. */
function sourced(text: string, factId: string, pos: Vec3, from: number, to?: number): ExpLabel {
  const f = factById(factId)
  if (!f) throw new Error(`experience label "${text}": unknown fact ${factId}`)
  const l: ExpLabel = {text, pos, from, factId, source: f.fact.source}
  if (to !== undefined) l.to = to
  return l
}

function generic(text: string, pos: Vec3, from: number, to?: number): ExpLabel {
  const l: ExpLabel = {text, pos, from}
  if (to !== undefined) l.to = to
  return l
}

// ---------------------------------------------------------------------------------------------------------------
// Shared pose helpers for the extruded scenes (Main Quad, Huang, Hoover)

/** Rising out of the ground: y-only scale, fully hidden at 0 so nothing invisible counts toward the bounds. */
function riseScale(k: number): Vec3 {
  return k < 0.005 ? v3(HIDDEN, HIDDEN, HIDDEN) : v3(1, k, 1)
}

function grow(k: number): number {
  return Math.max(HIDDEN, k)
}

/** Squashes a pose toward the ground plane (y = 0) by k: the loop outro, where everything sinks back down. */
function sink(p: Pose, k: number): Pose {
  if (k >= 1) return p
  if (k < 0.005) return pose(v3(p.pos.x, 0, p.pos.z), QI, HIDDEN)
  return {pos: v3(p.pos.x, p.pos.y * k, p.pos.z), rot: p.rot, scale: v3(p.scale.x, Math.max(HIDDEN, p.scale.y * k), p.scale.z)}
}

/** Semicircle in the vertical plane through `c` spanned by `dir` (horizontal unit) and up, from -dir to +dir. */
function vArc(c: Vec3, dir: Vec3, r: number, n = 10): Vec3[] {
  const pts: Vec3[] = []
  for (let k = 0; k <= n; k++) {
    const a = Math.PI - (k / n) * Math.PI
    pts.push(add(c, add(mul(dir, Math.cos(a) * r), v3(0, Math.sin(a) * r, 0))))
  }
  return pts
}

/** The 12 edges of an axis-aligned box as 4 tube polylines (two rings and four uprights). */
function wireBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, width: number): TubeSpec[] {
  const ring = (y: number) => [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, z1), v3(x0, y, z1), v3(x0, y, z0)]
  const out: TubeSpec[] = [{points: ring(y0), width}, {points: ring(y1), width}]
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) out.push({points: [v3(x, y0, z), v3(x, y1, z)], width})
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Main Quad: a living blueprint

export const MQ_LOOP = 19
/** Where the church first stands in the blueprint (off the axis), before it slides onto the axis (mainquad.2). */
export const MQ_CHURCH_OFF = 10
const MQ_CHURCH_Z = -13
export const MQ_ARCH_Z = 16
const MQ_ARCH_SPRING = 13 // height where the ghost arch's curve starts
const MQ_ARCH_R = 5 // half the opening
const MQ_ARCH_PIER = 3.5
const MQ_BASE_H = 3
const MQ_CAPSULE = v3(-14.3, 0, 7)
const MQ_GRID_HALF = 22
const MQ_GRID_BACK = -20
/** Arcade wings in the order they rise, sweeping round the courtyard: [start, end, courtyard-side normal, open].
 * The two front wings are open colonnades (no block behind) so the courtyard stays visible from the front. */
const MQ_WINGS: [Vec3, Vec3, Vec3, boolean][] = [
  [v3(-18, 0, -13), v3(-7, 0, -13), v3(0, 0, 1), false],
  [v3(-18, 0, -12), v3(-18, 0, 9.5), v3(1, 0, 0), false],
  [v3(-18, 0, 10.5), v3(-6.5, 0, 10.5), v3(0, 0, -1), true],
  [v3(6.5, 0, 10.5), v3(18, 0, 10.5), v3(0, 0, -1), true],
  [v3(18, 0, -12), v3(18, 0, 9.5), v3(-1, 0, 0), false],
  [v3(7, 0, -13), v3(18, 0, -13), v3(0, 0, 1), false]
]

/** One arcade wing on the ground from a to b (axis-aligned): a row of round arches on the courtyard side in front of
 * a two-storey block (unless `open`), plus a low tile roof. Built in the experience frame. */
function arcadeWing(a: Vec3, b: Vec3, inward: Vec3, open = false): {stone: Primitive[]; arches: TubeSpec[]; roof: Primitive[]} {
  const d = norm(sub(b, a))
  const L = len(sub(b, a))
  const c = lerp3(a, b, 0.5)
  const alongX = Math.abs(d.x) > 0.5
  const sized = (l: number, h: number, dep: number) => (alongX ? v3(l, h, dep) : v3(dep, h, l))
  const at = (off: number, y: number) => add(c, add(mul(inward, off), v3(0, y, 0)))
  const block = (l: number, h: number, dep: number, off: number, y: number, rot?: Vec3): Primitive => {
    const s = sized(l, h, dep), p = at(off, y)
    return box(s.x, s.y, s.z, p.x, p.y, p.z, rot)
  }
  const xz = (p: Vec3): [number, number, number] => [p.x, 2.6, p.z]
  const bays = Math.max(2, Math.round(L / 3.6))
  const pitch = L / bays
  const stone: Primitive[] = [block(L + 1, 0.8, 1.3, 1.6, 7.0, undefined)]
  if (open) for (let k = 0; k <= bays; k++) stone.push(box(0.9, 5.2, 0.9, ...xz(add(add(a, mul(d, k * pitch)), mul(inward, -0.6)))))
  else stone.push(block(L + 1, 7.4, 3.4, -1.7, 3.7, undefined))
  const arches: TubeSpec[] = []
  for (let k = 0; k <= bays; k++) {
    const p = add(add(a, mul(d, k * pitch)), mul(inward, 1.6))
    stone.push(box(0.9, 5.2, 0.9, p.x, 2.6, p.z))
    if (k < bays) arches.push({points: vArc(add(add(a, mul(d, (k + 0.5) * pitch)), add(mul(inward, 1.6), v3(0, 5.2, 0))), d, pitch / 2 - 0.45), width: 0.4})
  }
  // Gable roof over block and arcade: two slabs falling away from a ridge, toward the courtyard and away from it.
  const tilt = 24
  const roof: Primitive[] = []
  const half = open ? 1.5 : 3.3, ridge = open ? 0.5 : -0.6
  for (const side of [-1, 1]) {
    const n = mul(inward, side)
    const rot = alongX ? v3(tilt * Math.sign(n.z), 0, 0) : v3(0, 0, -tilt * Math.sign(n.x))
    roof.push(block(L + 1.4, 0.4, half / Math.cos((tilt * Math.PI) / 180), ridge + (side * half) / 2, 7.4 + (half / 2) * Math.tan((tilt * Math.PI) / 180) + 0.2, rot))
  }
  return {stone, arches, roof}
}

/** Left half of the ghost arch, hinged at its springing point (local origin); the right half is its mirror. */
function ghostCrown(side: number): TubeSpec[] {
  const R = MQ_ARCH_R, E = MQ_ARCH_R + MQ_ARCH_PIER
  const out: TubeSpec[] = []
  for (const z of [-1.5, 1.5]) {
    const intrados: Vec3[] = [], extrados: Vec3[] = []
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * (Math.PI / 2)
      intrados.push(v3(side * (R - R * Math.cos(a)), R * Math.sin(a), z))
      extrados.push(v3(side * (R - E * Math.cos(a)), E * Math.sin(a), z))
    }
    out.push({points: intrados, width: 0.45}, {points: extrados, width: 0.45})
    // Spandrel outline: up the outer edge and along the top to the centre line.
    out.push({points: [v3(side * (R - E), 0, z), v3(side * (R - E), E, z), v3(side * R, E, z)], width: 0.35})
    // Voussoir joints.
    for (const f of [0.25, 0.5, 0.75]) {
      const a = f * (Math.PI / 2)
      out.push({points: [v3(side * (R - R * Math.cos(a)), R * Math.sin(a), z), v3(side * (R - E * Math.cos(a)), E * Math.sin(a), z)], width: 0.25})
    }
  }
  for (const k of [0, 4, 8]) {
    const a = (k / 8) * (Math.PI / 2)
    const p = v3(side * (R - R * Math.cos(a)), R * Math.sin(a), 0)
    out.push({points: [v3(p.x, p.y, -1.5), v3(p.x, p.y, 1.5)], width: 0.3})
  }
  return out
}

/** Time windows of the Main Quad's sequence (looped seconds), exported for tests. */
export const MQ_T = {
  grid: [0, 1.6], plan: [0.8, 2.2], churchRise: [2.0, 3.2], churchSlide: [3.6, 5.0], axis: [4.8, 5.8], wings: 5.4,
  bases: [9.0, 9.6], quake: [9.4, 10.8], legs: [10.2, 11.0], crowns: [11.0, 12.0], attic: [11.8, 12.5],
  capsuleDrop: [13.0, 14.2], capsuleSink: [14.4, 15.3], plaque: [15.0, 15.7], outro: [18.0, 18.9]
}

function mainquad(): Experience {
  const T = MQ_T
  // Blueprint grid on the ground, built from its back edge so it can unroll toward the viewer.
  const grid: TubeSpec[] = []
  const depth = 2 * MQ_GRID_HALF - 2
  // Lines are split into short runs so nothing long and flat sorts badly against the buildings standing on it.
  const runs = (a: Vec3, b: Vec3, n: number) => Array.from({length: n + 1}, (_, k) => lerp3(a, b, k / n))
  for (let x = -MQ_GRID_HALF; x <= MQ_GRID_HALF + 1e-6; x += 4) grid.push({points: runs(v3(x, 0.05, 0), v3(x, 0.05, depth), 8), width: 0.22})
  for (let z = 0; z <= depth + 1e-6; z += 3.5) grid.push({points: runs(v3(-MQ_GRID_HALF, 0.05, z), v3(MQ_GRID_HALF, 0.05, z), 8), width: 0.22})
  // The plan drawn on it: every wing's footprint, the church, the arch bases and the courtyard.
  const plan: TubeSpec[] = [{points: squareLoop(0, 0.2, -1.5, 11.5).map((p) => v3(p.x * 1.15, p.y, p.z)), width: 0.3}]
  for (const [a, b, n, open] of MQ_WINGS) {
    const o = mul(n, open ? -1.1 : -3.4), i = mul(n, 2.1)
    plan.push({points: [add(a, i), add(b, i), add(b, o), add(a, o), add(a, i)].map((p) => v3(p.x, 0.2, p.z)), width: 0.3})
  }
  plan.push({points: [v3(-6, 0.2, -12.2), v3(6, 0.2, -12.2), v3(6, 0.2, -19.6), v3(-6, 0.2, -19.6), v3(-6, 0.2, -12.2)], width: 0.3})
  for (const s of [-1, 1]) {
    const x0 = s * MQ_ARCH_R, x1 = s * (MQ_ARCH_R + MQ_ARCH_PIER)
    plan.push({points: [v3(x0, 0.2, MQ_ARCH_Z - 1.5), v3(x1, 0.2, MQ_ARCH_Z - 1.5), v3(x1, 0.2, MQ_ARCH_Z + 1.5), v3(x0, 0.2, MQ_ARCH_Z + 1.5), v3(x0, 0.2, MQ_ARCH_Z - 1.5)], width: 0.3})
  }
  const nodes: ExpNode[] = [
    {name: "blueprint_grid", color: "gold", tubes: grid},
    {name: "blueprint_plan", color: "white", tubes: plan},
    {name: "axis", color: "gold", tubes: [{points: [v3(0, 0, 0), v3(0, 0, 37)], width: 0.6}]},
    {name: "axis_pulse", color: "white", prims: [sphere(0.75, 0, 0, 0, 10, 6)]}
  ]
  // Memorial Church at the head of the axis, built about its own footprint centre so it can slide.
  const church: Primitive[] = [box(12, 11, 1.6, 0, 5.5, 0), box(9, 9.5, 6.4, 0, 4.75, -3.8)]
  const mosaic: TubeSpec[] = [
    {points: [v3(-6.3, 11, 0.9), v3(0, 15.2, 0.9), v3(6.3, 11, 0.9)], width: 0.5},
    {points: [v3(-4.6, 6.3, 0.9), v3(4.6, 6.3, 0.9), v3(4.6, 9.8, 0.9), v3(-4.6, 9.8, 0.9), v3(-4.6, 6.3, 0.9)], width: 0.45}
  ]
  for (const ax of [-3.4, 0, 3.4]) mosaic.push({points: [v3(ax - 1.2, 0, 0.9), ...vArc(v3(ax, 3.4, 0.9), X, 1.2, 8), v3(ax + 1.2, 0, 0.9)], width: 0.4})
  const churchRoof: Primitive[] = []
  for (const s of [-1, 1]) churchRoof.push(box(5.2, 0.45, 7, s * 2.35, 10.6, -3.8, v3(0, 0, -s * 28)))
  churchRoof.push(box(1.6, 3.2, 1.6, 0, 12.8, -3.8), cyl(1.1, 1.6, "y", 0, 15.2, -3.8, 10, 0.2))
  nodes.push(
    {name: "church", color: "cream", prims: church},
    {name: "church_mosaic", color: "gold", prims: [box(8.6, 3.0, 0.3, 0, 8.05, 0.95)], tubes: mosaic},
    {name: "church_roof", color: "clay", prims: churchRoof}
  )
  MQ_WINGS.forEach(([a, b, n, open], i) => {
    const w = arcadeWing(a, b, n, open)
    nodes.push({name: "arcade_" + i, color: "cream", prims: w.stone, tubes: w.arches})
  })
  MQ_WINGS.forEach(([a, b, n, open], i) => nodes.push({name: "roof_" + i, color: "clay", prims: arcadeWing(a, b, n, open).roof}))
  // The Memorial Arch: solid surviving bases, then a wireframe ghost that draws itself up from them.
  const pierX = MQ_ARCH_R + MQ_ARCH_PIER / 2
  const legs: TubeSpec[] = []
  for (const s of [-1, 1]) {
    const x0 = s * MQ_ARCH_R, x1 = s * (MQ_ARCH_R + MQ_ARCH_PIER)
    legs.push(...wireBox(Math.min(x0, x1), Math.max(x0, x1), 0, MQ_ARCH_SPRING - MQ_BASE_H, -1.5, 1.5, 0.45))
    legs.push({points: [v3(x0, 4.5, -1.5), v3(x1, 4.5, -1.5), v3(x1, 4.5, 1.5), v3(x0, 4.5, 1.5), v3(x0, 4.5, -1.5)], width: 0.3})
    legs.push({points: [v3(s * pierX, 0, 1.5), v3(s * pierX, MQ_ARCH_SPRING - MQ_BASE_H, 1.5)], width: 0.25})
  }
  const E = MQ_ARCH_R + MQ_ARCH_PIER
  const attic = wireBox(-E, E, 0, 4, -1.5, 1.5, 0.45)
  attic.push({points: [v3(-E, 2, 1.5), v3(E, 2, 1.5)], width: 0.3})
  nodes.push(
    {name: "arch_bases", color: "sand", prims: [-1, 1].map((s) => box(MQ_ARCH_PIER + 0.4, MQ_BASE_H, 3.4, s * pierX, MQ_BASE_H / 2, MQ_ARCH_Z))},
    {name: "ghost_legs", color: "rose", tubes: legs},
    {name: "ghost_crown_l", color: "rose", tubes: ghostCrown(1)},
    {name: "ghost_crown_r", color: "rose", tubes: ghostCrown(-1)},
    {name: "ghost_attic", color: "rose", tubes: attic},
    {name: "shock_ring", color: "white", tubes: [{points: circle(v3(0, 0, 0), 1, "y", 48), width: 0.05}]},
    {name: "class_plaques", color: "gold", prims: [-8, -5, -2, 1, 4].map((z) => box(1.6, 0.25, 1.1, MQ_CAPSULE.x, 0.15, z))},
    {name: "new_plaque", color: "gold", prims: [box(1.9, 0.3, 1.4, 0, 0, 0)]},
    {name: "time_capsule", color: "amber", prims: [cyl(0.8, 2.4, "y", 0, 0, 0, 12), sphere(0.8, 0, 1.2, 0, 12, 6), sphere(0.8, 0, -1.2, 0, 12, 6)]}
  )
  const idx: Record<string, number> = {}
  nodes.forEach((n, i) => (idx[n.name] = i))
  return {
    id: "mainquad",
    title: "A living blueprint",
    landmarkIds: ["mainquad"],
    idea: "The Quad builds itself out of its plan: the church slides onto the axis, the arcades rise, the lost Memorial Arch returns as a ghost over its real bases, and a class buries its capsule.",
    factIds: ["mainquad.1", "mainquad.2", "mainquad.3", "mainquad.4"],
    nodes,
    labels: [
      sourced("campus plan: Frederick Law Olmsted", "mainquad.1", v3(0, 20, -4), 0.4, 3.6),
      sourced("Leland Stanford centered the church", "mainquad.2", v3(0, 22, -12), 3.6, 6.8),
      sourced("the Quad opened in 1891", "mainquad.1", v3(0, 15, 2), 6.9, 9.4),
      sourced("Memorial Arch, lost in 1906", "mainquad.3", v3(0, 29, MQ_ARCH_Z), 10.6, 17.9),
      sourced("its bases remain", "mainquad.3", v3(12.5, 3, MQ_ARCH_Z + 2), 11.6, 17.9),
      sourced("Class Day plaque and time capsule", "mainquad.4", v3(-15, 9, 2), 13.0, 17.9)
    ],
    loop: MQ_LOOP,
    settle: 15.8,
    poses(t: number): Pose[] {
      const u = frac(t / MQ_LOOP) * MQ_LOOP
      const out: Pose[] = new Array(nodes.length)
      const r = (w: number[]) => ramp(u, w[0], w[1])
      const down = 1 - r(T.outro)
      // Blueprint: the grid unrolls from the back edge, then rolls back up at the very end of the loop.
      const unroll = Math.min(r(T.grid), 1 - ramp(u, T.outro[1] - 0.2, MQ_LOOP - 0.05))
      out[idx.blueprint_grid] = unroll < 0.005 ? hidden(v3(0, 0, MQ_GRID_BACK)) : pose(v3(0, 0, MQ_GRID_BACK), QI, v3(1, 1, unroll))
      const plan = r(T.plan) * down
      out[idx.blueprint_plan] = plan < 0.005 ? hidden(v3(0, 0, 0)) : pose(v3(0, 0, 0), QI, v3(plan, 1, plan))
      // Church: rises off the axis, then slides onto it.
      const cx = MQ_CHURCH_OFF * (1 - r(T.churchSlide))
      const cRise = r(T.churchRise)
      const cPose = pose(v3(cx, 0, MQ_CHURCH_Z), QI, riseScale(cRise))
      out[idx.church] = cPose
      out[idx.church_mosaic] = pose(v3(cx, 0, MQ_CHURCH_Z), QI, riseScale(ramp(u, T.churchRise[0] + 0.4, T.churchRise[1] + 0.3)))
      const roofE = ramp(u, T.churchRise[1] - 0.2, T.churchRise[1] + 0.4)
      out[idx.church_roof] = roofE < 0.005 ? hidden(v3(cx, 0, MQ_CHURCH_Z)) : pose(v3(cx, 6 * (1 - roofE), MQ_CHURCH_Z))
      // The axis draws out from the church door toward the arch once the church is centred; a pulse then runs it.
      const ax = r(T.axis)
      out[idx.axis] = ax < 0.005 ? hidden(v3(0, 0.35, -12)) : pose(v3(0, 0.35, -12), QI, v3(1, 1, ax))
      const pu = frac((u - T.axis[1]) / 2.6)
      out[idx.axis_pulse] = u < T.axis[1] ? hidden(v3(0, 0.6, -12)) : pose(v3(0, 0.9, -12 + 37 * pu), QI, grow(bump(pu) * 1.4))
      // Arcade wings rise one after another round the courtyard; each tile roof drops on half a second later.
      for (let i = 0; i < MQ_WINGS.length; i++) {
        const s = T.wings + i * 0.4
        out[idx["arcade_" + i]] = pose(v3(0, 0, 0), QI, riseScale(ramp(u, s, s + 0.9)))
        const e = ramp(u, s + 0.6, s + 1.2)
        out[idx["roof_" + i]] = e < 0.005 ? hidden(v3(0, 0, 0)) : pose(v3(0, 7 * (1 - e), 0))
      }
      // Memorial Arch: the bases come up solid, the ground shudders, and the ghost draws itself up from them.
      const quake = r(T.quake)
      const shake = quake > 0 && quake < 1 ? 0.35 * Math.sin(u * 55) * bump(quake) : 0
      out[idx.arch_bases] = pose(v3(shake, 0, 0), QI, riseScale(r(T.bases)))
      out[idx.shock_ring] = hidden(v3(0, 0.3, MQ_ARCH_Z))
      if (quake > 0 && quake < 1) out[idx.shock_ring] = pose(v3(0, 0.3, MQ_ARCH_Z), QI, 1 + 17 * quake)
      const breathe = 1 + 0.025 * Math.sin(TAU * 0.5 * u)
      const legs = r(T.legs)
      out[idx.ghost_legs] = pose(v3(0, MQ_BASE_H, MQ_ARCH_Z), QI, legs < 0.005 ? v3(HIDDEN, HIDDEN, HIDDEN) : v3(1, legs * breathe, 1))
      const cr = r(T.crowns)
      const crGrow = grow(clamp01(cr * 3))
      const legTop = MQ_BASE_H + (MQ_ARCH_SPRING - MQ_BASE_H) * breathe
      out[idx.ghost_crown_l] = cr < 0.005 ? hidden(v3(-MQ_ARCH_R, MQ_ARCH_SPRING, MQ_ARCH_Z)) : pose(v3(-MQ_ARCH_R, legTop, MQ_ARCH_Z), qAxis(Z, 100 * (1 - cr)), crGrow)
      out[idx.ghost_crown_r] = cr < 0.005 ? hidden(v3(MQ_ARCH_R, MQ_ARCH_SPRING, MQ_ARCH_Z)) : pose(v3(MQ_ARCH_R, legTop, MQ_ARCH_Z), qAxis(Z, -100 * (1 - cr)), crGrow)
      const at = r(T.attic)
      const atticY = legTop + MQ_ARCH_R + MQ_ARCH_PIER
      out[idx.ghost_attic] = at < 0.005 ? hidden(v3(0, atticY, MQ_ARCH_Z)) : pose(v3(0, atticY + 5 * (1 - at), MQ_ARCH_Z), QI, grow(at))
      // Class Day: earlier plaques glint into view, the capsule drops in and is buried, the new plaque seals it.
      out[idx.class_plaques] = pose(v3(0, 0, 0), QI, riseScale(ramp(u, T.capsuleDrop[0] - 0.4, T.capsuleDrop[0] + 0.2)))
      const drop = r(T.capsuleDrop), bury = r(T.capsuleSink)
      if (drop < 0.005 || bury > 0.995) out[idx.time_capsule] = hidden(add(MQ_CAPSULE, v3(0, 2.2, 0)))
      else out[idx.time_capsule] = pose(add(MQ_CAPSULE, v3(0, 2.2 + 12 * (1 - drop) - 3 * bury, 0)), QI, grow(Math.min(1, drop * 2) * (1 - 0.85 * bury)))
      const pl = r(T.plaque)
      out[idx.new_plaque] = pl < 0.005 ? hidden(add(MQ_CAPSULE, v3(0, 0.2, 0))) : pose(add(MQ_CAPSULE, v3(0, 0.2 + 6 * (1 - pl), 0)), qAxis(Y, 180 * (1 - pl)), grow(pl))
      // A soft ring marks the plaque landing (the shock ring is free again by then).
      const glint = ramp(u, T.plaque[1] - 0.1, T.plaque[1] + 0.9)
      if (glint > 0 && glint < 1) out[idx.shock_ring] = pose(add(MQ_CAPSULE, v3(0, 0.3, 0)), QI, 1 + 5 * glint)
      // Outro: everything sinks back into the plan before the loop starts again.
      for (let i = 2; i < out.length; i++) out[i] = sink(out[i], down)
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Huang: one core at a time, then every core at once

const HUANG_N = 5
const HUANG_PITCH = 5.6
export const HUANG_LOOP = 14
export const HUANG_SERIAL_START = 2.0
export const HUANG_HOP_S = 0.15
export const HUANG_PARALLEL_START = 6.2
const HUANG_PARALLEL_END = 12.2
const HUANG_FRAME_S = 0.8
const HUANG_TILT = qAxis(X, 30) // top face turned toward the viewer
const HUANG_LIFT = v3(0, 14, 0)

/** The picture the array is computing: core (i, j)'s height at time t, a ripple spreading from the centre. */
export function huangWave(i: number, j: number, t: number): number {
  const r = Math.hypot(i - (HUANG_N - 1) / 2, j - (HUANG_N - 1) / 2)
  return 1.0 + 7.5 * (0.5 + 0.5 * Math.sin(1.7 * r - 3.4 * t))
}

/** Core (i, j)'s height: flat until the one serial worker reaches it (then frozen at what it computed), and live
 * for every core at once in the parallel phase. Exported for tests. */
export function huangCoreHeight(i: number, j: number, t: number): number {
  const tl = frac(t / HUANG_LOOP) * HUANG_LOOP
  const visit = HUANG_SERIAL_START + (i * HUANG_N + j) * HUANG_HOP_S
  const held = tl < visit ? 1 : huangWave(i, j, visit)
  const live = ramp(tl, HUANG_PARALLEL_START, HUANG_PARALLEL_START + 0.35)
  const h = held + (huangWave(i, j, tl) - held) * live
  const up = ramp(tl, 1.5, 2.0) * (1 - ramp(tl, HUANG_PARALLEL_END + 0.5, HUANG_PARALLEL_END + 1.2))
  return h * up
}

function huang(): Experience {
  const frame = (p: Vec3) => add(HUANG_LIFT, qRot(HUANG_TILT, p))
  const coreXZ = (i: number, j: number) => v3((j - 2) * HUANG_PITCH, 0, (i - 2) * HUANG_PITCH)
  const rim: Primitive[] = [box(32, 1.2, 32, 0, 0.6, 0)]
  for (const s of [-1, 1]) rim.push(box(32, 0.8, 0.8, 0, 1.6, s * 15.6), box(0.8, 0.8, 32, s * 15.6, 1.6, 0))
  // Contact pads along every edge of the package, so it reads as a chip.
  for (let k = 0; k < 9; k++) {
    const q = -12.8 + k * 3.2
    rim.push(box(1.6, 0.4, 1.0, q, 0.2, 16.6), box(1.6, 0.4, 1.0, q, 0.2, -16.6), box(1.0, 0.4, 1.6, 16.6, 0.2, q), box(1.0, 0.4, 1.6, -16.6, 0.2, q))
  }
  // Bus traces: a lattice between the cores, running out to the pads.
  const traces: TubeSpec[] = []
  for (let k = 0; k < HUANG_N; k++) {
    const q = (k - 2) * HUANG_PITCH
    traces.push({points: [v3(-15, 1.3, q), v3(15, 1.3, q)], width: 0.3}, {points: [v3(q, 1.3, -15), v3(q, 1.3, 15)], width: 0.3})
  }
  const nodes: ExpNode[] = [
    {name: "package", color: "clay", prims: rim},
    {name: "traces", color: "gold", tubes: traces},
    {name: "lid", color: "cream", prims: [box(27, 1.2, 27, 0, 0, 0), box(15, 0.8, 15, 0, 0.9, 0)], tubes: [{points: squareLoop(0, 1.4, 0, 7.5), width: 0.4}]}
  ]
  for (let i = 0; i < HUANG_N; i++) for (let j = 0; j < HUANG_N; j++) nodes.push({name: `core_${i}_${j}`, color: "gold", prims: [box(4.4, 1, 4.4, 0, 0.5, 0)]})
  // One worker for the serial pass; a whole sheet of data (one block per core) and its feed lines for the parallel one.
  const sheet: Primitive[] = [], feeds: TubeSpec[] = []
  for (let i = 0; i < HUANG_N; i++) for (let j = 0; j < HUANG_N; j++) {
    const c = coreXZ(i, j)
    sheet.push(box(2.8, 1.4, 2.8, c.x, 0, c.z))
    feeds.push({points: [v3(c.x, 0, c.z), v3(c.x, 1, c.z)], width: 0.5})
  }
  nodes.push(
    {name: "worker", color: "white", prims: [sphere(1.7, 0, 0, 0, 12, 8)], tubes: [{points: [v3(0, 0, 0), v3(0, 7, 0)], width: 0.5}]},
    {name: "data_sheet", color: "white", prims: sheet},
    {name: "feeds", color: "white", tubes: feeds}
  )
  const coreBase = 1.2
  return {
    id: "huang",
    title: "One core, or all of them",
    landmarkIds: ["huang"],
    idea: "A chip opens; one worker computes a ripple core by core and the picture comes out stale and jagged, then every core computes at once and the ripple runs live. That is how a GPU works.",
    factIds: ["huang.1"],
    nodes,
    labels: [
      sourced("Jensen Huang, NVIDIA co-founder", "huang.1", v3(0, 40, -4), 0.3),
      generic("one core at a time", v3(-14, 33, 6), HUANG_SERIAL_START, HUANG_PARALLEL_START - 0.2),
      generic("every core at once", v3(14, 33, 6), HUANG_PARALLEL_START + 0.2, HUANG_PARALLEL_END + 0.4)
    ],
    loop: HUANG_LOOP,
    settle: 7,
    poses(t: number): Pose[] {
      const tl = frac(t / HUANG_LOOP) * HUANG_LOOP
      // Raw time, not looped: the chip appears once and stays through every loop wrap.
      const appear = grow(ramp(t, 0, 0.5))
      const out: Pose[] = [pose(frame(v3(0, 0, 0)), HUANG_TILT, appear), pose(frame(v3(0, 0, 0)), HUANG_TILT, appear)]
      // The lid lifts off and spins away to open the chip; it settles back on at the end of the loop.
      const off = Math.min(ramp(tl, 0.7, 1.8), 1 - ramp(tl, HUANG_LOOP - 1.0, HUANG_LOOP - 0.2))
      const lidS = tl < 0.7 ? appear : grow(1 - off)
      out.push(lidS < 0.005 ? hidden(frame(v3(0, 2, 0))) : pose(frame(v3(0, 2.2 + 10 * off, 0)), qMul(HUANG_TILT, qAxis(Y, 120 * off)), lidS))
      // Cores. The one the serial worker is on flares as it computes.
      const serialK = Math.floor((tl - HUANG_SERIAL_START) / HUANG_HOP_S)
      for (let i = 0; i < HUANG_N; i++) for (let j = 0; j < HUANG_N; j++) {
        const h = huangCoreHeight(i, j, tl)
        const k = i * HUANG_N + j
        const flare = tl >= HUANG_SERIAL_START && tl < HUANG_PARALLEL_START && serialK === k ? 1 + 0.25 * bump((tl - HUANG_SERIAL_START - k * HUANG_HOP_S) / HUANG_HOP_S) : 1
        out.push(h < 0.005 ? hidden(frame(v3(0, coreBase, 0))) : pose(frame(add(coreXZ(i, j), v3(0, coreBase, 0))), HUANG_TILT, v3(flare, h, flare)))
      }
      // Worker: hops from core to core in reading order, an arc per hop, with a feed line dropping into it.
      const sEnd = HUANG_SERIAL_START + HUANG_N * HUANG_N * HUANG_HOP_S
      if (tl < HUANG_SERIAL_START - 0.3 || tl > sEnd + 0.4) out.push(hidden(frame(v3(-14, 8, -11))))
      else {
        const s = (tl - HUANG_SERIAL_START) / HUANG_HOP_S
        const k = Math.max(0, Math.min(HUANG_N * HUANG_N - 1, Math.floor(s)))
        const nk = Math.min(HUANG_N * HUANG_N - 1, k + 1)
        const f = s < 0 ? 0 : easeInOutCubic(clamp01((s - k) * 1.6 - 0.6))
        const pa = coreXZ(Math.floor(k / HUANG_N), k % HUANG_N), pb = coreXZ(Math.floor(nk / HUANG_N), nk % HUANG_N)
        const p = add(lerp3(pa, pb, f), v3(0, coreBase + 10.5 + 2.5 * Math.sin(Math.PI * f), 0))
        const k0 = Math.min(ramp(tl, HUANG_SERIAL_START - 0.3, HUANG_SERIAL_START), 1 - ramp(tl, sEnd, sEnd + 0.4))
        out.push(pose(frame(p), HUANG_TILT, grow(k0)))
      }
      // Parallel: a sheet of data falls onto every core at once, once per frame, down 25 feed lines together.
      const par = tl >= HUANG_PARALLEL_START - 0.2 && tl < HUANG_PARALLEL_END
      const fu = frac((tl - HUANG_PARALLEL_START + 0.2) / HUANG_FRAME_S)
      const top = 19
      const land = 10.5
      if (par) out.push(pose(frame(v3(0, top - (top - land) * easeInOutCubic(fu / 0.75), 0)), HUANG_TILT, grow(fu < 0.75 ? Math.min(1, fu * 6) : 1 - (fu - 0.75) / 0.25)))
      else out.push(hidden(frame(v3(0, top, 0))))
      const feed = ramp(tl, HUANG_PARALLEL_START - 0.4, HUANG_PARALLEL_START) * (1 - ramp(tl, HUANG_PARALLEL_END - 0.2, HUANG_PARALLEL_END + 0.2))
      out.push(feed < 0.005 ? hidden(frame(v3(0, land, 0))) : pose(frame(v3(0, land, 0)), HUANG_TILT, v3(1, feed * (top - land) * (0.85 + 0.15 * Math.cos(TAU * fu)), 1)))
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Gates: PageRank

export const GATES_NODES: Vec3[] = [
  v3(0, 26, 0), v3(-13, 18, 4), v3(13, 20, -3), v3(-8, 7, -6), v3(9, 8, 6), v3(-16, 32, -5), v3(15, 33, 4), v3(2, 12, 11)
]
export const GATES_EDGES: [number, number][] = [
  [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [0, 1], [0, 2], [3, 1], [4, 2], [7, 4], [5, 1], [6, 2], [1, 3], [2, 6]
]

/** PageRank by power iteration (damping d). Nodes without out-links spread their rank evenly. Sums to 1. */
export function pageRank(n: number, edges: [number, number][], d = 0.85, iterations = 80): number[] {
  const out: number[][] = []
  for (let i = 0; i < n; i++) out.push([])
  for (const [a, b] of edges) out[a].push(b)
  let r = new Array(n).fill(1 / n)
  for (let it = 0; it < iterations; it++) {
    const next = new Array(n).fill((1 - d) / n)
    for (let i = 0; i < n; i++) {
      if (!out[i].length) {
        for (let j = 0; j < n; j++) next[j] += (d * r[i]) / n
      } else {
        for (const j of out[i]) next[j] += (d * r[i]) / out[i].length
      }
    }
    r = next
  }
  return r
}

export function gatesRadius(rank: number): number {
  return 1.3 + 16 * rank
}

const GATES_HOP_S = 1.1
const GATES_HOPS = 60
const GATES_SURFERS = 3

/** Each surfer's path: a list of [from, to, teleported]. With probability 0.15 a surfer jumps to a random node. */
export function surferWalks(seed = 7): [number, number, boolean][][] {
  const out: number[][] = []
  for (let i = 0; i < GATES_NODES.length; i++) out.push([])
  for (const [a, b] of GATES_EDGES) out[a].push(b)
  const walks: [number, number, boolean][][] = []
  for (let s = 0; s < GATES_SURFERS; s++) {
    const r = rng(seed + s * 101)
    let at = [5, 7, 3][s]
    const w: [number, number, boolean][] = []
    for (let h = 0; h < GATES_HOPS; h++) {
      const jump = r() < 0.15
      const to = jump ? Math.floor(r() * GATES_NODES.length) : out[at][Math.floor(r() * out[at].length)]
      w.push([at, to, jump])
      at = to
    }
    walks.push(w)
  }
  return walks
}

function gates(): Experience {
  const ranks = pageRank(GATES_NODES.length, GATES_EDGES)
  const radii = ranks.map(gatesRadius)
  const nodes: ExpNode[] = GATES_NODES.map((_, i) => ({name: "page_" + i, color: (i === 0 ? "gold" : "amber") as ExpColor, prims: [sphere(1, 0, 0, 0, 16, 10)]}))
  const tubes: TubeSpec[] = []
  for (const [a, b] of GATES_EDGES) {
    const pa = GATES_NODES[a], pb = GATES_NODES[b]
    const dir = norm(sub(pb, pa))
    const s = add(pa, mul(dir, radii[a]))
    const e = sub(pb, mul(dir, radii[b] + 0.2))
    tubes.push({points: [s, e], width: 0.3})
    // Arrowhead: a short thick stub just before the target.
    tubes.push({points: [sub(e, mul(dir, 1.6)), e], width: 0.9})
  }
  nodes.push({name: "links", color: "cream", tubes})
  for (let s = 0; s < GATES_SURFERS; s++) nodes.push({name: "surfer_" + s, color: "white", prims: [sphere(0.9, 0, 0, 0, 10, 6)]})
  const walks = surferWalks()
  const loopS = GATES_HOP_S * GATES_HOPS
  return {
    id: "gates",
    title: "PageRank",
    landmarkIds: ["gates"],
    idea: "A page matters if pages that matter link to it: random surfers end up on the big nodes most often.",
    factIds: ["gates.2"],
    nodes,
    labels: [
      sourced("PageRank, developed here starting in 1996", "gates.2", v3(0, 42, 0), 0.3),
      generic("more links in = bigger page", v3(0, 1, 12), 1.5)
    ],
    loop: 0,
    settle: 0,
    poses(t: number): Pose[] {
      const out: Pose[] = []
      for (let i = 0; i < GATES_NODES.length; i++) {
        const grow = ramp(t, 0.1 * i, 0.1 * i + 0.6)
        const pulse = 1 + 0.08 * Math.sin(TAU * 0.6 * t + i * 1.3)
        out.push(pose(GATES_NODES[i], QI, Math.max(HIDDEN, radii[i] * pulse * grow)))
      }
      out.push(pose(v3(0, 0, 0), QI, Math.max(HIDDEN, ramp(t, 0.4, 1.2))))
      const tl = frac(t / loopS) * loopS
      const hop = Math.floor(tl / GATES_HOP_S)
      const u = (tl - hop * GATES_HOP_S) / GATES_HOP_S
      for (let s = 0; s < GATES_SURFERS; s++) {
        const [a, b, jump] = walks[s][hop % GATES_HOPS]
        const pa = GATES_NODES[a], pb = GATES_NODES[b]
        if (t < 1.2) {
          out.push(hidden(pa))
        } else if (jump) {
          // Teleport: shrink away at a, reappear at b.
          const k = u < 0.5 ? 1 - u * 2 : u * 2 - 1
          out.push(pose(u < 0.5 ? pa : pb, QI, Math.max(HIDDEN, k)))
        } else {
          out.push(pose(lerp3(pa, pb, easeInOutCubic((u - 0.2) / 0.8))))
        }
      }
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Spilker: the GPS constellation

const GPS_C = v3(0, 19, 0)
const GPS_R = 7.5
const GPS_ORBIT = 16
const GPS_INCL = 55
const GPS_PLANES = 3
const GPS_SATS = 3
const GPS_DEG_PER_S = 14
const GPS_BEAMS = 4
const PIN_DIR = norm(v3(0, Math.sin((37 * Math.PI) / 180), Math.cos((37 * Math.PI) / 180)))
export const GPS_PIN = add(GPS_C, mul(PIN_DIR, GPS_R))

function planeRot(j: number, t: number): Quat {
  const plane = qMul(qAxis(Y, j * 120 + 15), qAxis(X, GPS_INCL))
  return qMul(plane, qAxis(Y, GPS_DEG_PER_S * t + j * 40))
}

function satLocal(k: number): Vec3 {
  const a = (k / GPS_SATS) * TAU
  return v3(Math.cos(a) * GPS_ORBIT, 0, Math.sin(a) * GPS_ORBIT)
}

/** World (experience-frame) positions of all satellites at time t. */
export function satellitePositions(t: number): Vec3[] {
  const out: Vec3[] = []
  for (let j = 0; j < GPS_PLANES; j++) {
    const q = planeRot(j, t)
    for (let k = 0; k < GPS_SATS; k++) out.push(add(GPS_C, qRot(q, satLocal(k))))
  }
  return out
}

/** Indices of the `n` satellites highest above the pin's horizon. */
export function visibleSatellites(sats: Vec3[], n = GPS_BEAMS): number[] {
  const scored = sats.map((s, i) => ({i, e: dot(norm(sub(s, GPS_PIN)), PIN_DIR)}))
  scored.sort((a, b) => b.e - a.e)
  return scored.slice(0, n).map((s) => s.i)
}

function spilker(): Experience {
  const globe: TubeSpec[] = [
    {points: circle(GPS_C, GPS_R, "y", 48), width: 0.32},
    {points: circle(add(GPS_C, v3(0, GPS_R * Math.sin(0.61), 0)), GPS_R * Math.cos(0.61), "y", 40), width: 0.25},
    {points: circle(add(GPS_C, v3(0, -GPS_R * Math.sin(0.61), 0)), GPS_R * Math.cos(0.61), "y", 40), width: 0.25}
  ]
  for (const lon of [0, 60, 120]) {
    const q = qAxis(Y, lon)
    globe.push({points: circle(v3(0, 0, 0), GPS_R, "z", 48).map((p) => add(GPS_C, qRot(q, p))), width: 0.25})
  }
  const nodes: ExpNode[] = [
    {name: "globe", color: "sand", tubes: globe},
    {name: "pin", color: "rose", prims: [sphere(0.8, 0, 0, 0, 12, 8)], tubes: [{points: [v3(0, 0, 0), mul(PIN_DIR, 1.8)], width: 0.35}]}
  ]
  for (let j = 0; j < GPS_PLANES; j++) {
    nodes.push({name: "orbit_" + j, color: "amber", tubes: [{points: circle(v3(0, 0, 0), GPS_ORBIT, "y", 64), width: 0.2}]})
    const sats: Primitive[] = []
    for (let k = 0; k < GPS_SATS; k++) {
      const p = satLocal(k)
      const yaw = v3(0, -(k / GPS_SATS) * 360, 0)
      sats.push(box(1.6, 1.6, 1.6, p.x, p.y, p.z, yaw), box(0.9, 4.4, 0.15, p.x, p.y, p.z, yaw))
    }
    nodes.push({name: "sats_" + j, color: "gold", prims: sats})
  }
  for (let b = 0; b < GPS_BEAMS; b++) nodes.push({name: "beam_" + b, color: "cream", tubes: [{points: [v3(0, 0, 0), v3(0, 1, 0)], width: 0.16}]})
  for (let b = 0; b < GPS_BEAMS; b++) nodes.push({name: "pulse_" + b, color: "white", prims: [sphere(0.45, 0, 0, 0, 8, 6)]})
  return {
    id: "spilker",
    title: "GPS constellation",
    landmarkIds: ["spilker"],
    idea: "Your position comes from timing signals from several satellites at once, always the ones overhead.",
    factIds: ["spilker.1", "spilker.2", "spilker.4"],
    nodes,
    labels: [
      sourced("James Spilker Jr., GPS pioneer", "spilker.1", v3(0, 40, 0), 0.3),
      generic("you are here", add(GPS_PIN, v3(3.5, 2.5, 1)), 1.0),
      sourced("the civilian GPS signal", "spilker.2", v3(-13, 5, 6), 2.0)
    ],
    loop: 0,
    settle: 0,
    poses(t: number): Pose[] {
      const grow = ramp(t, 0, 0.8)
      // Globe geometry is authored in the experience frame, so its node sits at the origin.
      const out: Pose[] = [pose(v3(0, 0, 0)), pose(GPS_PIN, QI, Math.max(HIDDEN, ramp(t, 0.6, 1.0)))]
      for (let j = 0; j < GPS_PLANES; j++) {
        const g = Math.max(HIDDEN, ramp(t, 0.2 + j * 0.25, 1.0 + j * 0.25))
        const q = planeRot(j, t)
        out.push(pose(GPS_C, q, g), pose(GPS_C, q, g))
      }
      const sats = satellitePositions(t)
      const vis = visibleSatellites(sats)
      for (let b = 0; b < GPS_BEAMS; b++) {
        const s = sats[vis[b]]
        const d = sub(s, GPS_PIN)
        const on = t > 1.8 && dot(norm(d), PIN_DIR) > 0.05
        out.push(on ? pose(GPS_PIN, qFromTo(Y, norm(d)), v3(1, len(d) * grow, 1)) : hidden(GPS_PIN))
      }
      for (let b = 0; b < GPS_BEAMS; b++) {
        const s = sats[vis[b]]
        const on = t > 2.0 && dot(norm(sub(s, GPS_PIN)), PIN_DIR) > 0.05
        out.push(on ? pose(lerp3(s, GPS_PIN, frac(t * 0.7 + b * 0.25))) : hidden(GPS_PIN))
      }
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Y2E2: the breathing building

const Y2_W = 34
const Y2_D = 12
const Y2_FLOOR = 4
const Y2_FLOORS = 4
const Y2_COLS = [-13.6, -6.8, 0, 6.8, 13.6]
const Y2_ATRIA = [-11, 0, 11]
const Y2_BREATH_S = 7
const Y2_MOTES = 12

/** Window openness 0..1 for a facade column at time t: a slow breath that travels across the facade. */
export function windowOpen(t: number, col: number): number {
  const s = t - 0.6 - col * 0.25
  return s <= 0 ? 0 : 0.5 - 0.5 * Math.cos((TAU * s) / Y2_BREATH_S)
}

function polylineAt(pts: Vec3[], u: number): Vec3 {
  const segs: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const l = len(sub(pts[i], pts[i - 1]))
    segs.push(l)
    total += l
  }
  let d = clamp01(u) * total
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) return lerp3(pts[i], pts[i + 1], segs[i] > 0 ? Math.min(1, d / segs[i]) : 0)
    d -= segs[i]
  }
  return pts[pts.length - 1]
}

function y2e2(): Experience {
  const hx = Y2_W / 2, hz = Y2_D / 2, top = Y2_FLOOR * Y2_FLOORS
  const frame: Primitive[] = []
  for (let f = 0; f <= Y2_FLOORS; f++) frame.push(box(Y2_W, 0.5, Y2_D, 0, f * Y2_FLOOR, 0))
  for (const x of [-hx, hx]) for (const z of [-hz, hz]) frame.push(box(0.7, top, 0.7, x, top / 2, z))
  for (const x of [-8.5, 0, 8.5]) frame.push(box(0.6, top, 0.6, x, top / 2, -hz))
  const atria: TubeSpec[] = []
  for (const ax of Y2_ATRIA) {
    for (let f = 0; f <= Y2_FLOORS; f++) atria.push({points: squareLoop(ax, f * Y2_FLOOR + 0.4, 0, 2), width: 0.22})
    // Raised skylight over each atrium.
    atria.push({points: squareLoop(ax, top + 2.2, 0, 2.4), width: 0.25})
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) atria.push({points: [v3(ax + sx * 2.4, top, sz * 2.4), v3(ax + sx * 2.4, top + 2.2, sz * 2.4)], width: 0.22})
  }
  const nodes: ExpNode[] = [
    {name: "structure", color: "sand", prims: frame},
    {name: "atria", color: "amber", tubes: atria}
  ]
  // Windows on floors 1-3 of the front face, hinged at the top edge (mesh hangs below the node origin).
  const windows: {col: number; pos: Vec3}[] = []
  for (let row = 1; row < Y2_FLOORS; row++) {
    for (let c = 0; c < Y2_COLS.length; c++) {
      windows.push({col: c, pos: v3(Y2_COLS[c], (row + 1) * Y2_FLOOR - 0.4, hz + 0.3)})
      nodes.push({name: `window_${row}_${c}`, color: "gold", prims: [box(5.4, 3.0, 0.2, 0, -1.5, 0)]})
    }
  }
  // Air motes: in through a window, across the floor, up the nearest atrium and out above the roof.
  const motes: {col: number; path: Vec3[]; phase: number}[] = []
  for (let m = 0; m < Y2_MOTES; m++) {
    const col = m % Y2_COLS.length
    const row = 1 + (m % 3)
    const x = Y2_COLS[col]
    let ax = Y2_ATRIA[0]
    for (const a of Y2_ATRIA) if (Math.abs(a - x) < Math.abs(ax - x)) ax = a
    const y = row * Y2_FLOOR + 1.8
    motes.push({col, phase: (m * 0.37) % 1, path: [v3(x, y, hz + 7), v3(x, y, hz), v3(ax, y, 0), v3(ax, top + 3, 0), v3(ax + 1.5, top + 7, -3)]})
    nodes.push({name: "air_" + m, color: "white", prims: [sphere(0.55, 0, 0, 0, 8, 6)]})
  }
  return {
    id: "y2e2",
    title: "A building that breathes",
    landmarkIds: ["y2e2"],
    idea: "Windows open by themselves and the atria pull fresh air up through the building instead of fans.",
    factIds: ["y2e2.2"],
    nodes,
    labels: [
      sourced("The building breathes", "y2e2.2", v3(0, top + 10, 0), 0.3),
      sourced("its windows open and close on their own", "y2e2.2", v3(0, 0.8, hz + 5), 1.5)
    ],
    loop: 0,
    settle: 0,
    poses(t: number): Pose[] {
      const out: Pose[] = [pose(v3(0, 0, 0)), pose(v3(0, 0, 0), QI, v3(1, Math.max(HIDDEN, ramp(t, 0.2, 1.0)), 1))]
      for (const w of windows) out.push(pose(w.pos, qAxis(X, -40 * windowOpen(t, w.col))))
      for (const m of motes) {
        const u = frac(t / 5.5 + m.phase)
        const k = Math.sqrt(windowOpen(t, m.col))
        out.push(k < 0.05 ? hidden(m.path[0]) : pose(polylineAt(m.path, u), QI, k * Math.min(1, bump(u) * 3)))
      }
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Hoover: the tower rises, the carillon gathers, the largest bell rings

export const CARILLON_BELLS = 48 // hoover.4
export const CARILLON_ORIGINAL = 35 // hoover.4
/** Bells per arrival group: the first group is the largest bell alone (it swings), and the first 35 bells
 * arrive before the caption about them (1 + 7 + 7 + 7 + 7 + 6 = 35, then 7 + 6 = 13 more). */
export const BELL_GROUPS = [1, 7, 7, 7, 7, 6, 7, 6]
const BELL_GROUP_START = [4.0, 5.0, 5.8, 6.6, 7.4, 8.2, 12.0, 12.8]
const BELL_RISE_S = 1.4
export const HOOVER_LOOP = 22
export const HOOVER_STRIKE = 14.8
const HOOVER_SWING_HZ = 0.5
const HOOVER_OUTRO = 21.0
const HOOVER_SHELLS = 4
const HOOVER_SHELL_LIFE = 3.2
/** Centre of the bell crown, about which each arrival group spirals in. */
const BELFRY = v3(0, 31, 0)
/** Concentric hoops of bells around the belfry, inner (largest bells, lowest) to outer (smallest, highest). */
const BELL_HOOPS = [{n: 9, r: 8.6, y: 28.6}, {n: 16, r: 12.6, y: 31.2}, {n: 22, r: 16.6, y: 33.8}]
/** Tower sections in build order: [name, base height, height]. Each is built about its own base so it extrudes up. */
const HOOVER_SECTIONS: [string, number, number][] = [["podium", 0, 3.5], ["shaft_low", 3.5, 14.5], ["shaft_high", 18, 11.5], ["belfry", 29.5, 7.8]]
const HOOVER_BUILD: [number, number][] = [[0.3, 0.8], [0.7, 1.8], [1.7, 2.7], [2.6, 3.3]]
const HOOVER_DOME_BASE = 37.3

/** Slot i (0 = the largest bell, hung inside the belfry): crown (hang point) position and bell size. */
export function bellSlot(i: number): {pos: Vec3; size: number} {
  if (i === 0) return {pos: v3(0, 35.6, 0), size: 2.2}
  let k = i - 1
  const size = 1.95 - (1.1 * (i - 1)) / (CARILLON_BELLS - 2)
  for (let h = 0; h < BELL_HOOPS.length; h++) {
    const hoop = BELL_HOOPS[h]
    if (k < hoop.n) {
      const a = (k / hoop.n) * TAU + h * 0.35 + Math.PI / 2
      return {pos: v3(Math.cos(a) * hoop.r, hoop.y, Math.sin(a) * hoop.r), size}
    }
    k -= hoop.n
  }
  throw new Error(`no bell slot ${i}`)
}

/** Which slots each arrival group fills. Slot 0 comes first; the rest are shuffled so that arrival order
 * (and so the "35" moment) is not tied to bell size: nothing sourced says which bells were the originals. */
export function bellGroupSlots(): number[][] {
  const rest: number[] = []
  for (let i = 1; i < CARILLON_BELLS; i++) rest.push(i)
  const r = rng(1939)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const tmp = rest[i]
    rest[i] = rest[j]
    rest[j] = tmp
  }
  const groups: number[][] = [[0]]
  let k = 0
  for (let g = 1; g < BELL_GROUPS.length; g++) {
    groups.push(rest.slice(k, k + BELL_GROUPS[g]))
    k += BELL_GROUPS[g]
  }
  return groups
}

function bellPrims(c: Vec3, s: number, seg = 12): Primitive[] {
  return [
    cyl(0.28 * s, 0.35 * s, "y", c.x, c.y - 0.17 * s, c.z, 8),
    cyl(0.95 * s, 1.2 * s, "y", c.x, c.y - 0.95 * s, c.z, seg, 0.55 * s),
    cyl(1.0 * s, 0.22 * s, "y", c.x, c.y - 1.66 * s, c.z, seg)
  ]
}

/** Largest bell's swing angle (degrees, about X, toward the viewer) at looped time tl. */
export function hooverSwing(tl: number): number {
  if (tl < HOOVER_STRIKE) return 0
  const env = ramp(tl, HOOVER_STRIKE, HOOVER_STRIKE + 0.8) * (1 - ramp(tl, HOOVER_OUTRO - 0.6, HOOVER_OUTRO))
  return 24 * Math.sin(TAU * HOOVER_SWING_HZ * (tl - HOOVER_STRIKE)) * env
}

function hoover(): Experience {
  const nodes: ExpNode[] = [
    {name: "plaza", color: "sand", tubes: [{points: circle(v3(0, 0.1, 0), 11, "y", 48), width: 0.4}, {points: squareLoop(0, 0.1, 0, 8), width: 0.3}]},
    {name: "scan_ring", color: "gold", tubes: [{points: squareLoop(0, 0, 0, 6.4), width: 0.6}]}
  ]
  // Podium, two shaft sections and the belfry, all in local coordinates above their own base.
  const podium: Primitive[] = [box(15, 0.8, 15, 0, 0.4, 0), box(12.6, 2.7, 12.6, 0, 2.15, 0)]
  const low: Primitive[] = [box(8.6, 14.5, 8.6, 0, 7.25, 0), box(9.4, 0.7, 9.4, 0, 14.15, 0)]
  const high: Primitive[] = [box(8.2, 11.5, 8.2, 0, 5.75, 0)]
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    low.push(box(1.3, 14.5, 1.3, sx * 4.3, 7.25, sz * 4.3))
    high.push(box(1.2, 11.5, 1.2, sx * 4.1, 5.75, sz * 4.1))
  }
  // Tall window slits on every face of the upper shaft (gold, so they glow against the stone).
  const windows: Primitive[] = []
  for (let f = 0; f < 4; f++) {
    const q = qAxis(Y, f * 90)
    for (const dx of [-1.6, 1.6]) {
      const p = qRot(q, v3(dx, 5.2, 4.15))
      windows.push(f % 2 ? box(0.3, 8.4, 0.8, p.x, p.y, p.z) : box(0.8, 8.4, 0.3, p.x, p.y, p.z))
    }
  }
  // Belfry: the observation deck and balustrade (hoover.3), four corner piers and an open arch on each face.
  const belfry: Primitive[] = [box(11.6, 0.8, 11.6, 0, 0.4, 0), box(10, 0.7, 10, 0, 7.45, 0)]
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) belfry.push(box(2.2, 6.4, 2.2, sx * 3.6, 4.0, sz * 3.6), box(0.4, 1.2, 0.4, sx * 5.5, 1.4, sz * 5.5))
  const glow: TubeSpec[] = [{points: squareLoop(0, 2.0, 0, 5.5), width: 0.35}]
  for (let f = 0; f < 4; f++) {
    const q = qAxis(Y, f * 90)
    const pts = [v3(-2.5, 0.8, 0), ...vArc(v3(0, 4.6, 0), X, 2.5, 10), v3(2.5, 0.8, 0)]
    glow.push({points: pts.map((p) => qRot(q, add(p, v3(0, 0, 4.75)))), width: 0.4})
  }
  const dome: Primitive[] = [
    box(8, 1.0, 8, 0, 0.5, 0),
    cyl(3.9, 3.6, "y", 0, 2.8, 0, 16, 1.4),
    cyl(1.2, 1.8, "y", 0, 5.5, 0, 10),
    cyl(1.45, 1.2, "y", 0, 7.0, 0, 10, 0.15),
    cyl(0.22, 1.8, "y", 0, 8.4, 0, 6)
  ]
  nodes.push(
    {name: "podium", color: "sand", prims: podium},
    {name: "shaft_low", color: "sand", prims: low},
    {name: "shaft_high", color: "sand", prims: high},
    {name: "belfry", color: "cream", prims: belfry},
    {name: "windows", color: "gold", prims: windows},
    {name: "belfry_glow", color: "gold", tubes: glow},
    {name: "dome", color: "clay", prims: dome},
    {name: "hoops", color: "gold", tubes: BELL_HOOPS.map((h) => ({points: circle(v3(0, h.y - BELFRY.y, 0), h.r, "y", 56), width: 0.3}))}
  )
  const slots = bellGroupSlots()
  const first = bellSlot(0)
  // The largest bell is built about its own crown so it can swing.
  nodes.push({name: "bell_big", color: "gold", prims: bellPrims(v3(0, 0, 0), first.size, 16)})
  for (let g = 1; g < slots.length; g++) {
    const prims: Primitive[] = []
    for (const i of slots[g]) {
      const b = bellSlot(i)
      prims.push(...bellPrims(sub(b.pos, BELFRY), b.size))
    }
    nodes.push({name: "bells_" + g, color: "gold", prims})
  }
  // Sound: shells of three great circles that swell out from the big bell, one per stroke.
  for (let r = 0; r < HOOVER_SHELLS; r++) {
    nodes.push({name: "sound_" + r, color: "cream", tubes: [{points: circle(v3(0, 0, 0), 1, "y", 48), width: 0.05}, {points: circle(v3(0, 0, 0), 1, "x", 40), width: 0.04}, {points: circle(v3(0, 0, 0), 1, "z", 40), width: 0.04}]})
  }
  const idx: Record<string, number> = {}
  nodes.forEach((n, i) => (idx[n.name] = i))
  const bellsDone = BELL_GROUP_START[BELL_GROUP_START.length - 1] + BELL_RISE_S
  const shellC = v3(0, first.pos.y - 2, 0)
  return {
    id: "hoover",
    title: "The tower that rings",
    landmarkIds: ["hoover"],
    idea: "Hoover Tower rises section by section, its carillon gathers round the belfry from 35 bells to 48, and the largest bell swings and sends out rings of sound.",
    factIds: ["hoover.1", "hoover.3", "hoover.4"],
    nodes,
    labels: [
      sourced("285 feet tall, finished in 1941", "hoover.1", v3(14, 22, 4), 1.0, 5.0),
      sourced("a carillon on the 14th floor", "hoover.3", v3(-14, 37, 4), 4.6, 8.6),
      sourced("35 bells from Belgium's pavilion at the 1939 World's Fair", "hoover.4", v3(0, 47, 0), BELL_GROUP_START[5] + BELL_RISE_S + 0.1, 11.9),
      sourced("48 bells", "hoover.4", v3(0, 47, 0), bellsDone + 0.1, HOOVER_OUTRO),
      sourced("For Peace Alone Do I Ring", "hoover.4", v3(0, 22, 9), HOOVER_STRIKE + 0.4, HOOVER_OUTRO)
    ],
    loop: HOOVER_LOOP,
    settle: bellsDone + 0.6,
    poses(t: number): Pose[] {
      const tl = frac(t / HOOVER_LOOP) * HOOVER_LOOP
      const down = 1 - ramp(tl, HOOVER_OUTRO, HOOVER_LOOP - 0.1)
      const out: Pose[] = new Array(nodes.length)
      out[idx.plaza] = pose(v3(0, 0, 0), QI, grow(ramp(tl, 0, 0.5)))
      // A gold ring climbs the tower and each section extrudes up behind it.
      const scanY = 37 * ramp(tl, 0.3, 3.3)
      const scanOn = tl > 0.2 && tl < 3.6
      out[idx.scan_ring] = scanOn ? pose(v3(0, scanY, 0), QI, grow(Math.min(ramp(tl, 0.2, 0.4), 1 - ramp(tl, 3.3, 3.6)))) : hidden(v3(0, 0, 0))
      HOOVER_SECTIONS.forEach(([name, base], s) => {
        out[idx[name]] = pose(v3(0, base, 0), QI, riseScale(ramp(tl, HOOVER_BUILD[s][0], HOOVER_BUILD[s][1])))
      })
      out[idx.windows] = pose(v3(0, 18, 0), QI, riseScale(ramp(tl, HOOVER_BUILD[2][0] + 0.2, HOOVER_BUILD[2][1] + 0.2)))
      out[idx.belfry_glow] = pose(v3(0, 29.5, 0), QI, riseScale(ramp(tl, HOOVER_BUILD[3][0] + 0.2, HOOVER_BUILD[3][1] + 0.2)))
      const d = ramp(tl, 3.1, 3.8)
      out[idx.dome] = d < 0.005 ? hidden(v3(0, HOOVER_DOME_BASE, 0)) : pose(v3(0, HOOVER_DOME_BASE + 5 * (1 - d), 0), qAxis(Y, 90 * (1 - d)), grow(d))
      // Hoops open out from the tower before the bells arrive on them.
      const hp = ramp(tl, BELL_GROUP_START[1] - 0.6, BELL_GROUP_START[1] + 0.2)
      out[idx.hoops] = hp < 0.005 ? hidden(BELFRY) : pose(BELFRY, QI, v3(hp, 1, hp))
      // Largest bell: rises up inside the tower to the belfry, then swings from the strike on.
      const e0 = ramp(tl, BELL_GROUP_START[0], BELL_GROUP_START[0] + BELL_RISE_S)
      out[idx.bell_big] = e0 < 0.005 ? hidden(v3(0, 10, 0)) : pose(lerp3(v3(0, 10, 0), first.pos, e0), qAxis(X, hooverSwing(tl)), grow(e0))
      // Other groups spiral up from the ground into their hoops, a vortex round the tower. After the strike the
      // whole carillon shivers in sympathy, group by group.
      const ring = tl < HOOVER_STRIKE ? 0 : ramp(tl, HOOVER_STRIKE, HOOVER_STRIKE + 1)
      for (let g = 1; g < BELL_GROUPS.length; g++) {
        const e = ramp(tl, BELL_GROUP_START[g], BELL_GROUP_START[g] + BELL_RISE_S)
        const shiver = ring * 3 * Math.sin(TAU * 1.0 * (tl - HOOVER_STRIKE) - g * 0.9)
        out[idx["bells_" + g]] = e < 0.005 ? hidden(v3(0, 5, 0)) : pose(v3(0, BELFRY.y - 26 * (1 - e), 0), qAxis(Y, -320 * (1 - e) + shiver), grow(0.25 + 0.75 * e))
      }
      // Sound shells, one per stroke, swelling out flattened so they stay under the 50 cm ceiling.
      for (let r = 0; r < HOOVER_SHELLS; r++) {
        const s = tl - HOOVER_STRIKE - 0.25 - (r * HOOVER_SHELL_LIFE) / HOOVER_SHELLS
        const u = s < 0 ? -1 : frac(s / HOOVER_SHELL_LIFE)
        if (u < 0 || u > 0.92 || tl > HOOVER_OUTRO) out[idx["sound_" + r]] = hidden(shellC)
        else {
          // Capped at 19.5 so the rings stay in front of the focus-wall bezel's back panel (z = -22).
          const k = 4 + 15.5 * (1 - (1 - u) * (1 - u))
          out[idx["sound_" + r]] = pose(shellC, QI, v3(k, 0.6 * k, k))
        }
      }
      for (let i = 0; i < out.length; i++) out[i] = sink(out[i], down)
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Memorial Church: the spire that fell

const MC_TOWER_BASE = v3(0, 10, -5)
const MC_TOWER_H = 8
const MC_SPIRE_R = 4.3
const MC_SHAKE = 2.5
const MC_FALL = 4.0
const MC_SINK = 5.8
const MC_GONE = 7.2
const MC_GHOST = 7.4

function memchu(): Experience {
  const body: Primitive[] = [box(16, 10, 26, 0, 5, -1), box(34, 9, 9, 0, 4.5, -5)]
  const rise = 8 * Math.tan((32 * Math.PI) / 180)
  const roofs: Primitive[] = [
    box(8 / Math.cos((32 * Math.PI) / 180) + 0.4, 0.6, 26.4, 4, 10 + rise / 2, -1, v3(0, 0, -32)),
    box(8 / Math.cos((32 * Math.PI) / 180) + 0.4, 0.6, 26.4, -4, 10 + rise / 2, -1, v3(0, 0, 32)),
    box(34.4, 0.6, 4.5 / Math.cos((32 * Math.PI) / 180) + 0.4, 0, 9 + 1.4, -5 + 2.25, v3(32, 0, 0)),
    box(34.4, 0.6, 4.5 / Math.cos((32 * Math.PI) / 180) + 0.4, 0, 9 + 1.4, -5 - 2.25, v3(-32, 0, 0))
  ]
  const fz = 12.3
  const trim: TubeSpec[] = [
    {points: [v3(-8.4, 10, fz), v3(0, 10 + rise + 0.3, fz), v3(8.4, 10, fz)], width: 0.5},
    {points: [v3(-8, 10, fz), v3(8, 10, fz)], width: 0.4}
  ]
  for (const ax of [-4.6, 0, 4.6]) {
    const pts: Vec3[] = [v3(ax - 1.6, 0, fz), v3(ax - 1.6, 3, fz)]
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI - (k / 8) * Math.PI
      pts.push(v3(ax + Math.cos(a) * 1.6, 3 + Math.sin(a) * 1.6, fz))
    }
    pts.push(v3(ax + 1.6, 0, fz))
    trim.push({points: pts, width: 0.4})
  }
  const nodes: ExpNode[] = [
    {name: "church", color: "sand", prims: body},
    {name: "roofs", color: "clay", prims: roofs},
    {name: "trim", color: "cream", tubes: trim}
  ]
  // Facade mosaic: 3 rows x 9 tiles, alternating gold and amber; each row-colour set twinkles on its own.
  const mosaicRows: Vec3[] = []
  for (let r = 0; r < 3; r++) {
    const cy = 5.6 + r * 1.35
    for (const c of [0, 1]) {
      const tiles: Primitive[] = []
      for (let i = c; i < 9; i += 2) tiles.push(box(1.25, 1.1, 0.25, (i - 4) * 1.45, 0, 0))
      mosaicRows.push(v3(0, cy, fz + 0.15))
      nodes.push({name: `mosaic_${r}_${c}`, color: c ? "amber" : "gold", prims: tiles})
    }
  }
  const th = MC_TOWER_H
  nodes.push({name: "tower", color: "sand", prims: [box(7, th, 7, 0, th / 2, 0), box(7.6, 0.6, 7.6, 0, th, 0)]})
  nodes.push({name: "spire", color: "rose", prims: [cyl(MC_SPIRE_R, 13, "y", 0, 6.5, 0, 4, 0.2), box(0.4, 2.4, 0.4, 0, 14, 0), box(1.5, 0.4, 0.4, 0, 14.4, 0)]})
  const debrisStart: Vec3[] = [v3(-2.5, 7, -2.5), v3(2.5, 7.5, 2), v3(-2, 6, 2.5), v3(2.2, 6.5, -2.4)]
  const debrisVel: Vec3[] = [v3(-6, 5, -2), v3(7, 6, 3), v3(-4, 7, 5), v3(5, 4, -4)]
  for (let d = 0; d < debrisStart.length; d++) nodes.push({name: "debris_" + d, color: "sand", prims: [box(1.8, 1.4, 1.6, 0, 0, 0, v3(20 * d, 35 * d, 10))]})
  const ghost: TubeSpec[] = []
  const h = 3.5
  for (const y of [0, th]) ghost.push({points: squareLoop(0, y, 0, h), width: 0.15})
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ghost.push({points: [v3(sx * h, 0, sz * h), v3(sx * h, th, sz * h)], width: 0.15})
    ghost.push({points: [v3(sx * h, th, sz * h), v3(0, th + 13, 0)], width: 0.15})
  }
  nodes.push({name: "ghost", color: "cream", tubes: ghost})
  return {
    id: "memchu",
    title: "The spire that fell",
    landmarkIds: ["memchu"],
    idea: "The 1906 earthquake brought the tower and spire down through the roof, and they were never rebuilt.",
    factIds: ["memchu.2", "memchu.3"],
    nodes,
    labels: [
      sourced("facade mosaic, the largest in America when installed", "memchu.2", v3(0, 18.5, 14), 0.4, MC_SHAKE - 0.2),
      sourced("the 1906 earthquake", "memchu.3", v3(0, 38, -5), MC_SHAKE, MC_GONE + 0.4),
      sourced("They were never rebuilt", "memchu.3", v3(0, 36, -5), MC_GHOST + 0.6)
    ],
    loop: 0,
    settle: 1,
    poses(t: number): Pose[] {
      const out: Pose[] = [pose(v3(0, 0, 0)), pose(v3(0, 0, 0)), pose(v3(0, 0, 0))]
      let m = 0
      for (let r = 0; r < 3; r++) {
        for (const c of [0, 1]) {
          const tw = Math.max(0, Math.sin(TAU * (0.5 * t + r * 0.23 + c * 0.5)))
          out.push(pose(mosaicRows[m++], QI, v3(1, 1 + 0.12 * tw * tw, 1 + 2 * tw)))
        }
      }
      // Tower: shakes, then crumbles down into the roof.
      const amp = t < MC_SHAKE ? 0 : 3 * ramp(t, MC_SHAKE, MC_FALL)
      const shake = qMul(qAxis(Z, amp * Math.sin(TAU * 9 * t)), qAxis(X, amp * 0.6 * Math.sin(TAU * 7 * t + 1)))
      const crumble = ramp(t, MC_FALL, MC_GONE)
      const towerScale = t >= MC_GONE ? HIDDEN : Math.max(HIDDEN, 1 - crumble)
      const towerPos = sub(MC_TOWER_BASE, v3(0, 3 * crumble, 0))
      out.push(pose(towerPos, shake, v3(Math.max(HIDDEN, 1 - 0.3 * crumble), towerScale, Math.max(HIDDEN, 1 - 0.3 * crumble))))
      // Spire: rides the shaking tower, then topples about its +X base edge and sinks through the roof.
      const top = add(MC_TOWER_BASE, qRot(shake, v3(0, MC_TOWER_H, 0)))
      const fall = ramp(t, MC_FALL, MC_SINK)
      const rot = qMul(qAxis(Z, -105 * fall), shake)
      const hinge = add(top, v3(MC_SPIRE_R, 0, 0))
      const sink = ramp(t, MC_SINK - 0.4, MC_GONE)
      const spirePos = sub(add(hinge, qRot(rot, v3(-MC_SPIRE_R, 0, 0))), v3(0, 10 * fall * fall + 4 * sink, 0))
      out.push(pose(spirePos, rot, t >= MC_GONE ? HIDDEN : Math.max(HIDDEN, 1 - sink)))
      // Debris: thrown out of the tower top when it gives way.
      for (let d = 0; d < debrisStart.length; d++) {
        const s = t - MC_FALL
        if (s < 0 || t > MC_GONE) {
          out.push(hidden(add(MC_TOWER_BASE, debrisStart[d])))
          continue
        }
        const p = add(add(MC_TOWER_BASE, debrisStart[d]), add(mul(debrisVel[d], s), v3(0, -9.8 * s * s, 0)))
        if (p.y < 0.5) p.y = 0.5
        out.push(pose(p, qAxis(v3(1, 1, 0), 200 * s), Math.max(HIDDEN, 1 - ramp(t, MC_SINK, MC_GONE))))
      }
      out.push(pose(MC_TOWER_BASE, QI, v3(1, Math.max(HIDDEN, ramp(t, MC_GHOST, MC_GHOST + 1.2)), 1)))
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// HP: from the garage

const HP_DOOR = v3(-14, 2.5, 5)
const HP_START = 0.8
const HP_STEP = 1.0
const HP_FLY = 1.3

export function hpSlot(k: number, n = 6): Vec3 {
  const u = k / (n - 1)
  return v3(-6 + 23 * u, 8 + 22 * Math.sin((u * Math.PI) / 2), 2 + 3 * Math.sin(u * Math.PI))
}

/** Six generic devices; each is a body node and a face node in a second colour that share one pose. */
function hpDevices(): {body: Primitive[]; face: Primitive[]; bodyColor: ExpColor}[] {
  const keys: Primitive[] = []
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) keys.push(box(0.6, 0.5, 0.2, (c - 1) * 0.8, -1.9 + r * 0.8, 0.42))
  const lidRot = v3(-15, 0, 0)
  const lidN = v3(0, Math.sin((15 * Math.PI) / 180), Math.cos((15 * Math.PI) / 180))
  const lidC = v3(0, 0.92, -2.37)
  return [
    {
      bodyColor: "gold",
      body: [box(6, 4, 3.6, 0, 0, 0)],
      face: [cyl(1.3, 0.4, "z", -1.2, 0.3, 2.0, 18), cyl(0.5, 0.6, "z", 1.7, 0.9, 2.0, 10), cyl(0.5, 0.6, "z", 1.7, -0.9, 2.0, 10)]
    },
    {
      bodyColor: "amber",
      body: [box(6, 4.4, 4.4, 0, 0, 0)],
      face: [box(3.2, 2.4, 0.3, -0.9, 0.4, 2.3), cyl(0.45, 0.5, "z", 2.0, 1.0, 2.3, 10), cyl(0.45, 0.5, "z", 2.0, -1.0, 2.3, 10)]
    },
    {bodyColor: "clay", body: [box(3, 5.2, 0.7, 0, 0, 0)], face: [box(2.4, 1, 0.2, 0, 1.8, 0.42), ...keys]},
    {
      bodyColor: "sand",
      body: [box(5.4, 3.8, 0.5, 0, 2.2, 0), box(0.6, 1.4, 0.5, 0, -0.4, -0.2), box(2.4, 0.3, 1.6, 0, -1.1, 0), box(5, 0.3, 1.8, 0, -1.1, 2.2)],
      face: [box(4.6, 3, 0.15, 0, 2.2, 0.32)]
    },
    {
      bodyColor: "rose",
      body: [box(5.6, 0.35, 3.8, 0, -1, 0), box(5.6, 3.6, 0.3, lidC.x, lidC.y, lidC.z, lidRot)],
      face: [box(5, 3.1, 0.1, lidC.x + lidN.x * 0.2, lidC.y + lidN.y * 0.2, lidC.z + lidN.z * 0.2, lidRot), box(4.6, 0.1, 2, 0, -0.78, 0.6)]
    },
    {
      bodyColor: "gold",
      body: [box(6.4, 2.6, 4.4, 0, 0, 0), box(5, 0.2, 2.4, 0, 1.6, -2.6, v3(25, 0, 0)), box(5, 0.2, 2, 0, -0.2, 3.0)],
      face: [box(4, 0.08, 3, 0, 1.9, -2.9, v3(25, 0, 0)), box(4.6, 0.3, 0.1, 0, 0.5, 2.25)]
    }
  ]
}

function hp(): Experience {
  const gx = -14
  const garage: Primitive[] = [
    box(10, 6, 0.5, gx, 3, -4.5), box(0.5, 6, 9, gx - 5, 3, 0), box(0.5, 6, 9, gx + 5, 3, 0), box(10, 1.2, 0.5, gx, 5.4, 4.5),
    box(0.8, 6, 0.6, gx - 4.6, 3, 4.5), box(0.8, 6, 0.6, gx + 4.6, 3, 4.5)
  ]
  const rr = 5.6 / Math.cos((30 * Math.PI) / 180)
  const roof: Primitive[] = [
    box(rr, 0.5, 10, gx + 2.8, 6 + 1.6, 0, v3(0, 0, -30)), box(rr, 0.5, 10, gx - 2.8, 6 + 1.6, 0, v3(0, 0, 30))
  ]
  // A glowing workbench just inside the door.
  const bench: Primitive[] = [box(6, 0.4, 2.4, gx, 2.4, -2.5), box(0.4, 2.2, 0.4, gx - 2.6, 1.1, -2.5), box(0.4, 2.2, 0.4, gx + 2.6, 1.1, -2.5), box(1.6, 1.2, 1.2, gx - 1, 3.2, -2.6)]
  const arcPts: Vec3[] = [HP_DOOR]
  for (let i = 0; i <= 30; i++) arcPts.push(hpSlot((i / 30) * 5))
  const nodes: ExpNode[] = [
    {name: "garage", color: "sand", prims: garage},
    {name: "garage_roof", color: "clay", prims: roof},
    {name: "bench", color: "gold", prims: bench},
    {name: "timeline", color: "cream", tubes: [{points: arcPts, width: 0.22}]}
  ]
  const devices = hpDevices()
  devices.forEach((d, k) => {
    nodes.push({name: "device_" + k, color: d.bodyColor, prims: d.body})
    nodes.push({name: "device_" + k + "_face", color: d.bodyColor === "sand" || d.bodyColor === "gold" ? "white" : "cream", prims: d.face})
  })
  const n = devices.length
  return {
    id: "hp",
    title: "From the garage",
    landmarkIds: ["packard", "hewlett", "hpgarage"],
    idea: "Hewlett and Packard's company grew from one garage into generations of instruments and computers.",
    factIds: ["hpgarage.1"],
    nodes,
    labels: [
      sourced("Bill Hewlett and David Packard started HP in 1939", "hpgarage.1", v3(gx, 13, 2), 0.3),
      sourced("367 Addison Avenue", "hpgarage.1", v3(gx, 0.8, 7), 0.6),
      sourced("the Birthplace of Silicon Valley", "hpgarage.1", v3(8, 38, 2), HP_START + n * HP_STEP + 0.6)
    ],
    loop: 0,
    settle: HP_START + (n - 1) * HP_STEP + HP_FLY + 0.2,
    poses(t: number): Pose[] {
      const out: Pose[] = [pose(v3(0, 0, 0)), pose(v3(0, 0, 0)), pose(v3(0, 0, 0)), pose(v3(0, 0, 0), QI, v3(1, Math.max(HIDDEN, ramp(t, 0.2, 1.0)), 1))]
      for (let k = 0; k < n; k++) {
        const slot = hpSlot(k, n)
        const t0 = HP_START + k * HP_STEP
        const e = ramp(t, t0, t0 + HP_FLY)
        let p: Vec3
        let yaw: number
        let s: number
        if (t < t0) {
          p = HP_DOOR
          yaw = 180
          s = HIDDEN
        } else if (e < 1) {
          // Quadratic Bezier from the door, bowing out toward the viewer.
          const c = v3((HP_DOOR.x + slot.x) / 2, slot.y + 6, slot.z + 8)
          const a = lerp3(HP_DOOR, c, e), b = lerp3(c, slot, e)
          p = lerp3(a, b, e)
          yaw = 180 * (1 - e)
          s = 0.3 + 0.7 * e
        } else {
          const age = t - t0 - HP_FLY
          p = add(slot, v3(0, 0.4 * Math.sin(TAU * 0.35 * age + k), 0))
          yaw = 12 * Math.sin(TAU * 0.12 * age + k * 0.8)
          s = 1
        }
        const pp = pose(p, qAxis(Y, yaw), s)
        out.push(pp, pp)
      }
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Varian: the klystron

export const KL_Y = 16 // beam axis height
export const KL_X0 = -17.6 // cathode face, where beads appear
export const KL_X1 = 19 // inside the collector, where beads end
export const KL_XB = -5 // buncher (input) cavity
export const KL_XC = 7 // catcher (output) cavity
export const KL_BEADS = 24
export const KL_BUNCHES = 4
export const KL_LOOP = 6
const KL_L = KL_X1 - KL_X0
const KL_PER = KL_BEADS / KL_BUNCHES
/** Fraction by which each bead closes on its bunch centre once fully bunched. */
export const KL_SQUEEZE = 0.8
const KL_HIDE_X = 18.5 // beads vanish once inside the collector
const KL_CAV_R = 5.5
const KL_CAV_H = 1.6
const KL_DRIFT_R = 1.8
const KL_WG_TOP = 30
const KL_PULSE_TRAVEL = 0.8

/** Bunching strength 0..1 at x: none before the buncher, growing over the drift, full from the catcher on. */
export function klystronBunching(x: number): number {
  return clamp01((x - KL_XB) / (KL_XC - KL_XB))
}

/** Bead k's position along the beam at time t (looping). Beads leave the cathode evenly spaced; past the buncher
 * each closes on its bunch centre. Bunch centres themselves move at the beam speed, so they are evenly spaced too. */
export function klystronBeadX(k: number, t: number): number {
  const s = frac(t / KL_LOOP + k / KL_BEADS)
  const xl = KL_X0 + KL_L * s
  const m = (((k % KL_PER) + KL_PER) % KL_PER) - (KL_PER - 1) / 2
  return xl - klystronBunching(xl) * KL_SQUEEZE * m * (KL_L / KL_BEADS)
}

/** Seconds since a bunch centre last crossed the catcher cavity (repeats every KL_LOOP / KL_BUNCHES). */
export function klystronPulseAge(t: number): number {
  const sC = (KL_XC - KL_X0) / KL_L
  const period = KL_LOOP / KL_BUNCHES
  return frac(KL_BUNCHES * (t / KL_LOOP - sC + (KL_PER - 1) / 2 / KL_BEADS)) * period
}

/** Back half of a circle in the YZ plane at x = cx (the cutaway keeps z <= 0). */
function backArc(cx: number, cy: number, r: number, n = 12): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI
    pts.push(v3(cx, cy + Math.cos(a) * r, -Math.sin(a) * r))
  }
  return pts
}

/** Closed rectangle loop in the XZ plane at height y. */
function rectLoop(cx: number, y: number, cz: number, hx: number, hz: number): Vec3[] {
  return [v3(cx - hx, y, cz - hz), v3(cx + hx, y, cz - hz), v3(cx + hx, y, cz + hz), v3(cx - hx, y, cz + hz), v3(cx - hx, y, cz - hz)]
}

/** A resonant cavity in cutaway, built about its own centre (beam along X). */
function cavityTubes(): TubeSpec[] {
  const R = KL_CAV_R, r = KL_DRIFT_R + 0.1, h = KL_CAV_H
  const w = 0.25
  const out: TubeSpec[] = []
  for (const x of [-h, h]) out.push({points: backArc(x, 0, R, 16), width: w}, {points: backArc(x, 0, r, 10), width: w})
  for (const a of [0, Math.PI / 2, Math.PI]) {
    const cy = Math.cos(a), sz = -Math.sin(a)
    for (const x of [-h, h]) out.push({points: [v3(x, r * cy, r * sz), v3(x, R * cy, R * sz)], width: w})
    out.push({points: [v3(-h, R * cy, R * sz), v3(h, R * cy, R * sz)], width: w})
  }
  // The interaction gap: the drift-tube lips either side of it, drawn whole so the beam reads as passing through.
  for (const x of [-0.7, 0.7]) out.push({points: circle(v3(x, 0, 0), r, "x", 20), width: 0.3})
  return out
}

function varian(): Experience {
  const stand: Primitive[] = [
    box(46, 1, 10, 0, 0.5, 0),
    box(1.2, 11.5, 1.2, -20, 6.75, 0), box(1.2, 11.2, 1.2, 20.5, 6.6, 0),
    box(1, KL_Y - KL_CAV_R - 1, 1, KL_XB, (KL_Y - KL_CAV_R + 1) / 2, -1.5), box(1, KL_Y - KL_CAV_R - 1, 1, KL_XC, (KL_Y - KL_CAV_R + 1) / 2, -1.5)
  ]
  const drift: TubeSpec[] = []
  for (let x = -16; x <= 16; x += 2.5) {
    if (Math.abs(x - KL_XB) < 2.2 || Math.abs(x - KL_XC) < 2.2) continue
    drift.push({points: backArc(x, KL_Y, KL_DRIFT_R, 10), width: 0.18})
  }
  const spans: [number, number][] = [[-17.4, KL_XB - 0.7], [KL_XB + 0.7, KL_XC - 0.7], [KL_XC + 0.7, 17]]
  for (const [a, b] of spans) {
    for (const ang of [0, Math.PI / 2, Math.PI]) {
      const y = KL_Y + Math.cos(ang) * KL_DRIFT_R, z = -Math.sin(ang) * KL_DRIFT_R
      drift.push({points: [v3(a, y, z), v3(b, y, z)], width: 0.18})
    }
  }
  const wgBase = KL_Y + KL_CAV_R
  const wg: TubeSpec[] = []
  for (const y of [wgBase, wgBase + 3, wgBase + 6, KL_WG_TOP]) wg.push({points: rectLoop(KL_XC, y, 0, 1.5, 1.0), width: 0.22})
  wg.push({points: rectLoop(KL_XC, KL_WG_TOP + 1.5, 0, 2.6, 1.8), width: 0.22})
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    wg.push({points: [v3(KL_XC + sx * 1.5, wgBase, sz * 1.0), v3(KL_XC + sx * 1.5, KL_WG_TOP, sz * 1.0), v3(KL_XC + sx * 2.6, KL_WG_TOP + 1.5, sz * 1.8)], width: 0.22})
  }
  const collector: Primitive[] = [cyl(3.8, 7, "x", 20.5, KL_Y, 0, 16)]
  for (const x of [18.4, 19.8, 21.2, 22.6]) collector.push(cyl(4.7, 0.4, "x", x, KL_Y, 0, 16))
  const nodes: ExpNode[] = [
    {name: "stand", color: "linen", prims: stand},
    {name: "cathode", color: "linen", prims: [cyl(3.5, 4, "x", -20, KL_Y, 0, 16), cyl(3.0, 1.0, "x", -17.7, KL_Y, 0, 16, 2.2)]},
    {name: "cathode_face", color: "softgold", prims: [cyl(2.0, 0.4, "x", 0, 0, 0, 16)]},
    {name: "drift_tube", color: "linen", tubes: drift},
    {name: "buncher", color: "cardinal", tubes: cavityTubes()},
    {name: "catcher", color: "cardinal", tubes: cavityTubes()},
    {name: "waveguide", color: "linen", tubes: wg},
    {name: "collector", color: "cardinal", prims: collector},
    {name: "pulse", color: "softgold", prims: [sphere(1.2, 0, 0, 0, 12, 8)]},
    {name: "pulse_ring", color: "softgold", tubes: [{points: circle(v3(0, 0, 0), 1, "y", 48), width: 0.12}]}
  ]
  for (let k = 0; k < KL_BEADS; k++) nodes.push({name: "electron_" + k, color: "softgold", prims: [sphere(0.5, 0, 0, 0, 8, 6)]})
  return {
    id: "varian",
    title: "The klystron",
    landmarkIds: ["varian"],
    idea: "A klystron bunches an even electron beam with one cavity, and each bunch rings a second cavity, making a strong radio pulse.",
    factIds: ["varian.2"],
    nodes,
    labels: [
      sourced("Russell Varian, klystron co-inventor", "varian.2", v3(0, 44, 0), 0.3),
      sourced("the klystron, demonstrated in 1937", "varian.2", v3(0, 40.5, 0), 0.8),
      generic("cathode", v3(-20, 4.5, 6), 1.2),
      generic("resonant cavities", v3(1, 4.5, 6), 1.4),
      generic("collector", v3(20.5, 4.5, 6), 1.6),
      generic("evenly spaced", v3(-11, 21, 3), 1.8),
      generic("bunched", v3(13, 21, 3), 2.0),
      generic("output pulse", v3(14, 31, 2), 2.4)
    ],
    loop: KL_LOOP,
    settle: 0,
    poses(t: number): Pose[] {
      const grow = Math.max(HIDDEN, ramp(t, 0, 0.6))
      const rf = Math.sin((TAU * KL_BUNCHES * t) / KL_LOOP)
      const age = klystronPulseAge(t)
      const fired = t - age >= 0
      const ring = 1 + 0.12 * bump(age / 0.5) * (fired ? 1 : 0)
      const out: Pose[] = [
        pose(v3(0, 0, 0)),
        pose(v3(0, 0, 0)),
        pose(v3(-17.2, KL_Y, 0), QI, v3(1, 1 + 0.05 * Math.sin(TAU * 1.3 * t), 1 + 0.05 * Math.sin(TAU * 1.3 * t))),
        pose(v3(0, 0, 0), QI, v3(Math.max(HIDDEN, ramp(t, 0.1, 0.8)), 1, 1)),
        // Buncher: driven by the input signal, it breathes in step with the bunching.
        pose(v3(KL_XB, KL_Y, 0), QI, v3(1, 1 + 0.05 * rf, 1 + 0.05 * rf)),
        // Catcher: swells as each bunch passes through its gap.
        pose(v3(KL_XC, KL_Y, 0), QI, v3(1, ring, ring)),
        pose(v3(0, 0, 0)),
        pose(v3(0, 0, 0))
      ]
      // Output pulse: rises up the waveguide after each bunch, then spreads out from the mouth as a ring.
      if (fired && age < KL_PULSE_TRAVEL) {
        const u = age / KL_PULSE_TRAVEL
        out.push(pose(v3(KL_XC, KL_Y + 2 + (KL_WG_TOP + 1.5 - KL_Y - 2) * u, 0), QI, 0.6 + 0.6 * u))
      } else out.push(hidden(v3(KL_XC, KL_Y, 0)))
      const ru = (age - KL_PULSE_TRAVEL + 0.1) / 0.6
      if (fired && ru > 0 && ru < 1) {
        const k = 1.8 + 6 * ru
        const fade = 1 - ramp(ru, 0.6, 1)
        out.push(pose(v3(KL_XC, KL_WG_TOP + 1.8 + 2 * ru, 0), QI, v3(Math.max(HIDDEN, k * fade), 1, Math.max(HIDDEN, k * fade))))
      } else out.push(hidden(v3(KL_XC, KL_WG_TOP, 0)))
      for (let k = 0; k < KL_BEADS; k++) {
        const x = klystronBeadX(k, t)
        const s = x >= KL_HIDE_X ? HIDDEN : Math.max(HIDDEN, grow * clamp01((x - KL_X0) / 0.8))
        out.push(pose(v3(x, KL_Y, 0), QI, s))
      }
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Clark: a workstation on the courtyard stage, and a window that unfolds out of it

export const CLARK_LOOP = 12
const CL_WING_IN = 15
const CL_WING_OUT = 20
const CL_WING_H = 5
const CL_WINGS = [270, 150, 30] // centre angles (degrees); +Z (90) faces the viewer, so the front stays open
const CL_WING_SPAN = 80
const CL_STAGE_R = 9
const CL_SCREEN = v3(0, 12.25, 2.8)
const CL_PANEL = v3(11.5, 16, 5)
const CL_PANEL_YAW = -15
const CL_LEAF_W = 8
const CL_LEAF_H = 10
const CL_WIRE_C = v3(0, 27, -1)
const CL_WIRE_R = 4.5

/** Window state 0..1 at time t (looped): out of the screen, unfolded, page loaded (left, right), then back again. */
export function clarkWindow(t: number): {emerge: number; open: number; loadL: number; loadR: number} {
  const tl = frac(t / CLARK_LOOP) * CLARK_LOOP
  return {
    emerge: ramp(tl, 0.6, 2.2) - ramp(tl, 10.8, 11.6),
    open: ramp(tl, 2.2, 3.4) - ramp(tl, 10.0, 10.8),
    loadL: ramp(tl, 3.4, 4.4) - ramp(tl, 9.4, 10.0),
    loadR: ramp(tl, 4.0, 5.0) - ramp(tl, 9.4, 10.0)
  }
}

/** Unit icosahedron scaled to radius r: 12 vertices and 30 equal edges. */
export function icosahedron(r: number): {verts: Vec3[]; edges: [number, number][]} {
  const p = (1 + Math.sqrt(5)) / 2
  const raw: Vec3[] = []
  for (const a of [-1, 1]) for (const b of [-p, p]) raw.push(v3(0, a, b), v3(a, b, 0), v3(b, 0, a))
  const verts = raw.map((q) => mul(norm(q), r))
  const edges: [number, number][] = []
  for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) if (Math.abs(len(sub(raw[i], raw[j])) - 2) < 1e-6) edges.push([i, j])
  return {verts, edges}
}

function arcXZ(r: number, y: number, a0deg: number, a1deg: number, n = 12): Vec3[] {
  const pts: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const a = ((a0deg + ((a1deg - a0deg) * i) / n) * Math.PI) / 180
    pts.push(v3(Math.cos(a) * r, y, Math.sin(a) * r))
  }
  return pts
}

function clark(): Experience {
  const wings: TubeSpec[] = []
  for (const c of CL_WINGS) {
    const a0 = c - CL_WING_SPAN / 2, a1 = c + CL_WING_SPAN / 2
    for (const y of [0.3, CL_WING_H]) for (const r of [CL_WING_IN, CL_WING_OUT]) wings.push({points: arcXZ(r, y, a0, a1), width: 0.35})
    wings.push({points: arcXZ(CL_WING_OUT, CL_WING_H / 2, a0, a1), width: 0.22})
    for (const a of [a0, a1]) {
      const ca = Math.cos((a * Math.PI) / 180), sa = Math.sin((a * Math.PI) / 180)
      for (const r of [CL_WING_IN, CL_WING_OUT]) wings.push({points: [v3(ca * r, 0.3, sa * r), v3(ca * r, CL_WING_H, sa * r)], width: 0.35})
      for (const y of [0.3, CL_WING_H]) wings.push({points: [v3(ca * CL_WING_IN, y, sa * CL_WING_IN), v3(ca * CL_WING_OUT, y, sa * CL_WING_OUT)], width: 0.35})
    }
  }
  const desk: Primitive[] = [box(16, 0.6, 10, 0, 6, -0.5)]
  for (const sx of [-1, 1]) for (const z of [-5, 4]) desk.push(box(0.6, 4.9, 0.6, sx * 7.4, 0.8 + 2.45, z))
  const ico = icosahedron(CL_WIRE_R)
  const wire: TubeSpec[] = ico.edges.map(([a, b]) => ({points: [ico.verts[a], ico.verts[b]], width: 0.3}))
  for (const q of ico.verts) wire.push({points: [mul(q, 0.94), mul(q, 1.06)], width: 0.7})
  // Window leaves, each built about the shared spine (x = 0): the left leaf spans -x, the right leaf +x.
  const hw = CL_LEAF_W, hh = CL_LEAF_H / 2
  const leaf = (sx: number): ExpNode["tubes"] => [
    {points: [v3(0, -hh, 0), v3(sx * hw, -hh, 0), v3(sx * hw, hh, 0), v3(0, hh, 0)], width: 0.28},
    {points: [v3(0, hh - 1.4, 0), v3(sx * hw, hh - 1.4, 0)], width: 0.2}
  ]
  const frameL: ExpNode = {name: "window_left", color: "cardinal", tubes: leaf(-1), prims: [box(hw, 1.2, 0.15, -hw / 2, hh - 0.7, 0)]}
  const frameR: ExpNode = {name: "window_right", color: "cardinal", tubes: [{points: [v3(0, -hh, 0), v3(0, hh, 0)], width: 0.28}, ...(leaf(1) || [])]}
  const contentL: Primitive[] = [box(6.4, 3.8, 0.15, -4.2, 0.5, 0.15)]
  for (let i = 0; i < 3; i++) contentL.push(box(6.6 - i * 1.4, 0.45, 0.12, -0.7 - (6.6 - i * 1.4) / 2, -2.4 - i * 0.85, 0.15))
  const contentR: Primitive[] = [box(5.2, 0.55, 0.12, 0.7 + 2.6, hh - 0.7, 0.15)]
  for (let i = 0; i < 6; i++) {
    const w = [6.6, 5.8, 6.2, 4.4, 6.4, 3.6][i]
    contentR.push(box(w, 0.45, 0.12, 0.7 + w / 2, 2.2 - i * 1.05, 0.15))
  }
  contentR.push(box(2.6, 0.9, 0.12, 0.7 + 1.3 + 3.6, -4.0, 0.15))
  const nodes: ExpNode[] = [
    {name: "wings", color: "linen", tubes: wings},
    {name: "stage", color: "cardinal", prims: [cyl(CL_STAGE_R, 0.8, "y", 0, 0.4, 0, 32)]},
    {name: "desk", color: "linen", prims: desk},
    {name: "workstation", color: "linen", prims: [box(9, 2, 6, 0, 7.3, -1.5), box(9, 7.5, 7, 0, 12.05, -1.5), box(3, 0.6, 2, 0, 8.6, -1.5)]},
    {name: "screen", color: "softgold", prims: [box(7.4, 5.8, 0.2, 0, 0, 0)]},
    {name: "keyboard", color: "linen", prims: [box(9, 0.5, 2.4, 0, 6.55, 3), box(1, 0.4, 1.6, 6, 6.5, 3)]},
    {name: "wireframe", color: "cardinal", tubes: wire},
    frameL,
    frameR,
    {name: "page_left", color: "softgold", prims: contentL},
    {name: "page_right", color: "softgold", prims: contentR}
  ]
  return {
    id: "clark",
    title: "Graphics, then the web",
    landmarkIds: ["clark"],
    idea: "Clark's two companies in one picture: a workstation drawing 3D graphics, and a web browser window opening out of it.",
    factIds: ["clark.1", "clark.2", "clark.3"],
    nodes,
    labels: [
      sourced("Jim Clark, founder of Silicon Graphics and Netscape", "clark.1", v3(0, 38, 0), 0.3),
      sourced("three wings wrapped around a courtyard", "clark.2", v3(-17, 7.5, 4), 1.0),
      sourced("the courtyard's circular stage", "clark.3", v3(0, 1.2, 11), 1.4)
    ],
    loop: CLARK_LOOP,
    settle: 0,
    poses(t: number): Pose[] {
      const w = clarkWindow(t)
      const tl = frac(t / CLARK_LOOP) * CLARK_LOOP
      const glow = 1 + 0.05 * bump((tl - 0.3) / 2.2)
      const spin = qMul(qAxis(Y, 36 * t), qAxis(Z, 25))
      const out: Pose[] = [
        pose(v3(0, 0, 0), QI, v3(1, Math.max(HIDDEN, ramp(t, 0.1, 0.9)), 1)),
        pose(v3(0, 0, 0)),
        pose(v3(0, 0, 0)),
        pose(v3(0, 0, 0)),
        pose(v3(0, 12.25, 2.65), QI, v3(glow, glow, 1)),
        pose(v3(0, 0, 0)),
        pose(CL_WIRE_C, spin, Math.max(HIDDEN, ramp(t, 0.3, 1.0)))
      ]
      if (w.emerge < 1e-3) {
        for (let i = 0; i < 4; i++) out.push(hidden(CL_SCREEN))
        return out
      }
      const spine = lerp3(CL_SCREEN, CL_PANEL, w.emerge)
      const s = 0.12 + 0.88 * w.emerge
      const yaw = qAxis(Y, CL_PANEL_YAW * w.emerge)
      // Folded, both leaves point toward the viewer like a closed book; open, they lie flat in one plane.
      const rotL = qMul(yaw, qAxis(Y, 90 * (1 - w.open)))
      const rotR = qMul(yaw, qAxis(Y, -90 * (1 - w.open)))
      out.push(pose(spine, rotL, s), pose(spine, rotR, s))
      out.push(pose(spine, rotL, v3(Math.max(HIDDEN, s * w.loadL), s, s)), pose(spine, rotR, v3(Math.max(HIDDEN, s * w.loadR), s, s)))
      return out
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Moore: a crystal under study (moore.2, the Geballe Laboratory for Advanced Materials)
//
// A 3 x 3 x 3 lattice turns slowly on a pedestal. A probe beam comes in from the left, rays scatter to a screen on
// the right and a grid of spots lights up there (a diffraction pattern, drawn as an idealised picture). Mid-loop one
// atom hops into the vacancy beside it, and hops back near the end. Lattice size and spot layout are visual only.

export const MOORE_LOOP = 9
const MO_C = v3(0, 19, 0) // lattice centre
const MO_A = 5.2 // lattice spacing
const MO_ATOM = 1.25
const MO_VAC = v3(MO_A, MO_A, MO_A) // the empty site (lattice frame)
const MO_HOP = v3(0, MO_A, MO_A) // the atom that hops into it
const MO_SCREEN_X = 21
const MO_BEAM_X0 = -24

/** 0 at the atom's own site, 1 once it has hopped into the vacancy. */
export function mooreHop(t: number): number {
  const tl = frac(t / MOORE_LOOP) * MOORE_LOOP
  return easeInOutCubic(ramp(tl, 3.6, 4.4)) * (1 - easeInOutCubic(ramp(tl, 7.6, 8.4)))
}

function moore(): Experience {
  const atoms: Primitive[] = []
  const bonds: TubeSpec[] = []
  const key = (p: Vec3) => `${p.x},${p.y},${p.z}`
  const skip = new Set([key(MO_VAC), key(MO_HOP)])
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const p = v3(i * MO_A, j * MO_A, k * MO_A)
    if (!skip.has(key(p))) atoms.push(sphere(MO_ATOM, p.x, p.y, p.z, 12, 8))
    if (i < 1) bonds.push({points: [p, v3(p.x + MO_A, p.y, p.z)], width: 0.16})
    if (j < 1) bonds.push({points: [p, v3(p.x, p.y + MO_A, p.z)], width: 0.16})
    if (k < 1) bonds.push({points: [p, v3(p.x, p.y, p.z + MO_A)], width: 0.16})
  }
  const stand: Primitive[] = [
    box(50, 1, 14, 0, 0.5, 0),
    cyl(2.2, MO_C.y - MO_A * 1.6 - 1, "y", 0, (MO_C.y - MO_A * 1.6 + 1) / 2, 0, 16),
    cyl(4.5, 0.8, "y", 0, MO_C.y - MO_A * 1.6, 0, 20),
    // Screen post and source housing.
    box(1, MO_C.y - 7, 1, MO_SCREEN_X, (MO_C.y - 7) / 2 + 1, 0),
    box(1, MO_C.y - 2, 1, MO_BEAM_X0 - 2, (MO_C.y - 2) / 2 + 1, 0)
  ]
  const source: Primitive[] = [box(5, 4, 4, MO_BEAM_X0 - 2, MO_C.y, 0), cyl(1.2, 1.5, "x", MO_BEAM_X0 + 1, MO_C.y, 0, 12)]
  const screen: TubeSpec[] = [{points: [v3(0, -7, -7), v3(0, 7, -7), v3(0, 7, 7), v3(0, -7, 7), v3(0, -7, -7)], width: 0.3}]
  const spots: Primitive[] = []
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    if ((a + b) % 2 !== 0) continue
    const r = a === 0 && b === 0 ? 0.9 : 0.55
    spots.push(sphere(r, 0, a * 2.6, b * 2.6, 8, 6))
  }
  // Scattered rays, from the lattice centre to a few of the spots (node origin at the lattice centre).
  const rays: TubeSpec[] = []
  for (const [a, b] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0]]) {
    rays.push({points: [v3(0, 0, 0), v3(MO_SCREEN_X, a * 2.6, b * 2.6)], width: 0.1})
  }
  const nodes: ExpNode[] = [
    {name: "stand", color: "linen", prims: stand},
    {name: "source", color: "cardinal", prims: source},
    {name: "bonds", color: "sand", tubes: bonds},
    {name: "atoms", color: "linen", prims: atoms},
    {name: "hopper", color: "cardinal", prims: [sphere(MO_ATOM * 1.15, 0, 0, 0, 12, 8)]},
    {name: "vacancy", color: "softgold", tubes: [{points: circle(v3(0, 0, 0), MO_ATOM * 1.1, "z", 24), width: 0.12}]},
    {name: "beam", color: "softgold", tubes: [{points: [v3(0, 0, 0), v3(-MO_BEAM_X0, 0, 0)], width: 0.35}]},
    {name: "rays", color: "softgold", tubes: rays},
    {name: "screen", color: "linen", tubes: screen},
    {name: "spots", color: "softgold", prims: spots}
  ]
  return {
    id: "moore",
    title: "A crystal under study",
    landmarkIds: ["moore"],
    idea: "Materials research looks inside crystals: a probe beam scatters into a pattern that reveals the lattice, and defects like a vacancy move atom by atom.",
    factIds: ["moore.2"],
    nodes,
    labels: [
      sourced("Geballe Laboratory for Advanced Materials", "moore.2", v3(0, 42, 0), 0.3),
      generic("a crystal lattice", v3(0, 33, 4), 0.8),
      generic("probe beam", v3(-14, MO_C.y + 4, 3), 1.2),
      generic("diffraction pattern", v3(MO_SCREEN_X, MO_C.y + 10, 2), 1.9),
      generic("an atom hops into a vacancy", v3(0, 6, 8), 3.6, 6.6)
    ],
    loop: MOORE_LOOP,
    settle: 0,
    poses(t: number): Pose[] {
      const tl = frac(t / MOORE_LOOP) * MOORE_LOOP
      const grow = Math.max(HIDDEN, easeInOutCubic(ramp(t, 0, 0.7)))
      // Turns back and forth over a quarter turn, so the front face stays readable.
      const rot = qMul(qAxis(Y, 30 + 35 * Math.sin((TAU * t) / MOORE_LOOP)), qAxis(X, -14))
      const at = (p: Vec3) => add(MO_C, qRot(rot, p))
      const hop = mooreHop(t)
      const beamOn = t < 0.9 ? 0 : 1
      const beam = Math.max(HIDDEN, ramp(t, 0.9, 1.4))
      const shine = beamOn * ramp(t, 1.4, 1.9) * (0.85 + 0.15 * Math.sin(TAU * 1.5 * tl))
      return [
        pose(v3(0, 0, 0)),
        pose(v3(0, 0, 0)),
        pose(MO_C, rot, grow),
        pose(MO_C, rot, grow),
        pose(at(lerp3(MO_HOP, MO_VAC, hop)), rot, grow * (1 + 0.15 * bump(hop * 2 - 0.5))),
        // The vacancy ring sits on whichever site is empty.
        pose(at(lerp3(MO_VAC, MO_HOP, hop > 0.5 ? 1 : 0)), rot, Math.max(HIDDEN, grow * (1 - bump(hop * 2 - 0.5)))),
        pose(v3(MO_BEAM_X0, MO_C.y, 0), QI, v3(beam, 1, 1)),
        pose(MO_C, QI, Math.max(HIDDEN, shine)),
        pose(v3(MO_SCREEN_X, MO_C.y, 0), QI, grow),
        pose(v3(MO_SCREEN_X, MO_C.y, 0), QI, Math.max(HIDDEN, shine))
      ]
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Registry and helpers

export const EXPERIENCES: Experience[] = [mainquad(), huang(), gates(), spilker(), y2e2(), hoover(), memchu(), hp(), varian(), clark(), moore()]

/** Experience for a card id (several cards may share one, e.g. the HP trio), or undefined. */
export function experienceFor(cardId: string): Experience | undefined {
  for (const e of EXPERIENCES) if (e.landmarkIds.indexOf(cardId) >= 0) return e
  return undefined
}

export function experienceById(id: string): Experience | undefined {
  for (const e of EXPERIENCES) if (e.id === id) return e
  return undefined
}

/** One node's mesh, built about its own origin. */
export function buildNode(node: ExpNode): MeshChunk {
  const parts: MeshChunk[] = []
  if (node.prims && node.prims.length) parts.push(buildPrims(node.prims, v3(0, 0, 0), "node " + node.name))
  for (const tb of node.tubes || []) parts.push(buildTube(tb.points, tb.width))
  const verts: number[] = []
  const idx: number[] = []
  for (const p of parts) {
    const base = verts.length / 8
    for (const v of p.verts) verts.push(v)
    for (const i of p.idx) idx.push(i + base)
  }
  if (verts.length / 8 >= 64000) throw new Error(`node ${node.name} has ${verts.length / 8} vertices`)
  return {verts, idx}
}

export interface ExperienceStats {
  verts: number
  meshes: number
}

export function experienceStats(e: Experience): ExperienceStats {
  let verts = 0
  for (const n of e.nodes) verts += buildNode(n).verts.length / 8
  return {verts, meshes: e.nodes.length}
}

/** Label opacity/scale 0..1 at time t: 0.4 s fades at each end of [from, to). Only labels with a `to` follow the
 * loop; a persistent label (no `to`) stays up once it has appeared. */
export function labelWeight(e: Experience, label: ExpLabel, t: number): number {
  const tl = e.loop > 0 && label.to !== undefined ? frac(t / e.loop) * e.loop : t
  const a = clamp01((tl - label.from) / 0.4)
  const b = label.to === undefined ? 1 : clamp01((label.to - tl) / 0.4)
  return Math.min(a, b)
}

export interface Bounds3 {
  min: Vec3
  max: Vec3
}

const boundsCache = new Map<ExpNode, Bounds3>()

function nodeLocalBounds(n: ExpNode): Bounds3 {
  let b = boundsCache.get(n)
  if (b) return b
  const c = buildNode(n)
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i < c.verts.length; i += 8) {
    min.x = Math.min(min.x, c.verts[i]); max.x = Math.max(max.x, c.verts[i])
    min.y = Math.min(min.y, c.verts[i + 1]); max.y = Math.max(max.y, c.verts[i + 1])
    min.z = Math.min(min.z, c.verts[i + 2]); max.z = Math.max(max.z, c.verts[i + 2])
  }
  b = {min, max}
  boundsCache.set(n, b)
  return b
}

/** Experience-frame bounds of everything visible at time t (posed local-box corners; nodes scaled below 1% skipped). */
export function posedBounds(e: Experience, t: number): Bounds3 {
  const poses = e.poses(t)
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity)
  e.nodes.forEach((n, i) => {
    const p = poses[i]
    if (Math.max(p.scale.x, p.scale.y, p.scale.z) < 0.01) return
    const lb = nodeLocalBounds(n)
    for (const cx of [lb.min.x, lb.max.x]) for (const cy of [lb.min.y, lb.max.y]) for (const cz of [lb.min.z, lb.max.z]) {
      const q = add(p.pos, qRot(p.rot, v3(cx * p.scale.x, cy * p.scale.y, cz * p.scale.z)))
      min.x = Math.min(min.x, q.x); max.x = Math.max(max.x, q.x)
      min.y = Math.min(min.y, q.y); max.y = Math.max(max.y, q.y)
      min.z = Math.min(min.z, q.z); max.z = Math.max(max.z, q.z)
    }
  })
  return {min, max}
}

/** The card behind a label's fact, for tests and logs. */
export function labelFact(label: ExpLabel): {card: Card; fact: Fact} | undefined {
  return label.factId ? factById(label.factId) : undefined
}

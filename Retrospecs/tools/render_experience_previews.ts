/** Still previews of the exact procedural meshes used by RetrospecsExperiences. Run with bun.
 * Writes <id>.png/.svg (one money-shot frame) and <id>_sequence.png (a strip of frames through the loop, with the
 * labels that are up at each moment) to docs/model-previews. Orthographic, flat-lit, painter-sorted triangles. */
import {mkdirSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {Resvg} from "@resvg/resvg-js"
import {Experience, buildNode, experienceFor, EXP_COLORS, labelWeight, qRot} from "../Assets/Retrospecs/Core/Experiences"

const out = join(import.meta.dir, "../docs/model-previews")
mkdirSync(out, {recursive: true})

interface Shot {name: string; still: number; sequence: number[]; captions: string[]}
const SHOTS: Record<string, Shot> = {
  mainquad: {name: "Main Quad", still: 16.6, sequence: [1.3, 4.3, 7.8, 11.5, 14.2], captions: ["blueprint", "church onto the axis", "arcades rise", "ghost arch draws up", "capsule buried"]},
  huang: {name: "Huang Engineering Center", still: 8.45, sequence: [1.3, 4.6, 6.75, 8.45], captions: ["lid lifts", "one core at a time", "the sheet lands", "every core at once"]},
  hoover: {name: "Hoover Tower", still: 16.7, sequence: [1.9, 6.6, 11.0, 16.7], captions: ["tower extrudes", "bells spiral up", "35 in place", "48 ring out"]}
}
const YAW = -0.5, PITCH = 0.42 // from the front, a little to the right and above

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
const view = (p: {x: number; y: number; z: number}) => {
  const cy = Math.cos(YAW), sy = Math.sin(YAW), cp = Math.cos(PITCH), sp = Math.sin(PITCH)
  const x = cy * p.x + sy * p.z
  const z = -sy * p.x + cy * p.z
  return {x, y: cp * p.y - sp * z, z: sp * p.y + cp * z}
}
const LIGHT = (() => {
  const l = {x: -0.35, y: 0.8, z: 0.5}
  const n = Math.hypot(l.x, l.y, l.z)
  return {x: l.x / n, y: l.y / n, z: l.z / n}
})()

interface Tri {depth: number; pts: {x: number; y: number}[]; fill: string}

/** View-space triangles of the experience at time t. */
function triangles(e: Experience, t: number): Tri[] {
  const poses = e.poses(t)
  const tris: Tri[] = []
  for (let ni = 0; ni < e.nodes.length; ni++) {
    const pose = poses[ni]
    if (Math.max(pose.scale.x, pose.scale.y, pose.scale.z) < 0.01) continue
    const chunk = buildNode(e.nodes[ni])
    const vs: {x: number; y: number; z: number}[] = []
    for (let i = 0; i < chunk.verts.length; i += 8) {
      const r = qRot(pose.rot, {x: chunk.verts[i] * pose.scale.x, y: chunk.verts[i + 1] * pose.scale.y, z: chunk.verts[i + 2] * pose.scale.z})
      vs.push(view({x: r.x + pose.pos.x, y: r.y + pose.pos.y, z: r.z + pose.pos.z}))
    }
    const rgb = EXP_COLORS[e.nodes[ni].color]
    const seen = new Set<string>()
    for (let i = 0; i < chunk.idx.length; i += 3) {
      const a = chunk.idx[i], b = chunk.idx[i + 1], c = chunk.idx[i + 2]
      const key = [a, b, c].sort((x, y) => x - y).join(",")
      if (seen.has(key)) continue
      seen.add(key)
      const A = vs[a], B = vs[b], C = vs[c]
      const u = {x: B.x - A.x, y: B.y - A.y, z: B.z - A.z}, w = {x: C.x - A.x, y: C.y - A.y, z: C.z - A.z}
      const n = {x: u.y * w.z - u.z * w.y, y: u.z * w.x - u.x * w.z, z: u.x * w.y - u.y * w.x}
      const nl = Math.hypot(n.x, n.y, n.z)
      if (nl < 1e-9 || Math.abs(n.z) / nl < 0.02) continue
      const lit = 0.5 + 0.55 * Math.abs((n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z) / nl)
      const col = rgb.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v * 255 * lit))))
      tris.push({depth: (A.z + B.z + C.z) / 3, pts: [A, B, C], fill: `rgb(${col.join(",")})`})
    }
  }
  return tris.sort((p, q) => p.depth - q.depth)
}

/** Projected extents over several times, so every panel of a scene shares one scale. */
function extents(e: Experience, times: number[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const t of times) for (const tr of triangles(e, t)) for (const p of tr.pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
  }
  return {x0, x1, y0, y1}
}

/** SVG for one frame inside the box (bx, by, bw, bh). */
function panel(e: Experience, t: number, ext: ReturnType<typeof extents>, bx: number, by: number, bw: number, bh: number, labelSize: number): string {
  const s = Math.min(bw / (ext.x1 - ext.x0), bh / (ext.y1 - ext.y0)) * 0.9
  const ox = bx + bw / 2 - ((ext.x0 + ext.x1) / 2) * s
  const oy = by + bh / 2 + ((ext.y0 + ext.y1) / 2) * s
  const parts = triangles(e, t).map((tr) => `<polygon points="${tr.pts.map((p) => `${(ox + p.x * s).toFixed(1)},${(oy - p.y * s).toFixed(1)}`).join(" ")}" fill="${tr.fill}" stroke="${tr.fill}" stroke-width="0.4"/>`)
  for (const l of e.labels) {
    const w = labelWeight(e, l, t)
    if (w < 0.5) continue
    const p = view(l.pos)
    const x = Math.max(bx + 8, Math.min(bx + bw - 8, ox + p.x * s)), y = Math.max(by + labelSize + 4, oy - p.y * s)
    parts.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="#ffffff" fill-opacity="${w.toFixed(2)}" font-family="Arial" font-size="${labelSize}" text-anchor="middle" paint-order="stroke" stroke="#101921" stroke-width="4">${esc(l.text)}</text>`)
  }
  return parts.join("\n")
}

const png = (svg: string) => new Resvg(svg, {background: "#101921"}).render().asPng()

for (const id of Object.keys(SHOTS)) {
  const shot = SHOTS[id]
  const e = experienceFor(id)
  if (!e) throw new Error(`No experience: ${id}`)
  const still = extents(e, [shot.still])
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="#101921"/>
  ${panel(e, shot.still, still, 60, 170, 1080, 700, 22)}
  <text x="70" y="94" fill="#f8efe0" font-family="Georgia" font-size="42">${esc(shot.name)}: ${esc(e.title)}</text>
  <text x="72" y="135" fill="#dfb477" font-family="Arial" font-size="21">3D EXPERIENCE · LENS MESH AT t = ${shot.still} s · LOOPS EVERY ${e.loop} s</text>
  </svg>`
  writeFileSync(join(out, `${id}.svg`), svg)
  writeFileSync(join(out, `${id}.png`), png(svg))
  const n = shot.sequence.length, pw = 520, ph = 560
  const ext = extents(e, shot.sequence)
  const frames = shot.sequence.map((t, i) => `${panel(e, t, ext, i * pw + 10, 70, pw - 20, ph - 120, 17)}
  <text x="${i * pw + pw / 2}" y="${ph - 22}" fill="#dfb477" font-family="Arial" font-size="20" text-anchor="middle">${i + 1}. ${esc(shot.captions[i])} (t = ${t} s)</text>`)
  const seq = `<svg xmlns="http://www.w3.org/2000/svg" width="${n * pw}" height="${ph}" viewBox="0 0 ${n * pw} ${ph}">
  <rect width="${n * pw}" height="${ph}" fill="#101921"/>
  <text x="20" y="44" fill="#f8efe0" font-family="Georgia" font-size="30">${esc(shot.name)}: ${esc(e.title)}, sequence</text>
  ${frames.join("\n")}
  </svg>`
  writeFileSync(join(out, `${id}_sequence.png`), png(seq))
  console.log(`${id}: still ${triangles(e, shot.still).length} triangles; sequence of ${n} -> ${join(out, `${id}.png`)}`)
}

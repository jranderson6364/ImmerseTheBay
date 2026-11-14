/**
 * Generates Partsight's unit meshes as OBJ files (MIT, no third-party assets).
 * Run from the repo root: bun Partsight/tools/gen-unit-meshes.ts
 *
 * Every mesh fits the unit cube [-0.5, 0.5]^3 so the renderer can scale it to dims_mm directly.
 * Round shapes have their axis along +X (matches PartSpec.ts).
 */
import {mkdirSync, writeFileSync} from "fs"
import {join} from "path"

type V = [number, number, number]
const OUT = join(import.meta.dir, "..", "Assets", "Partsight", "Meshes")
const SEG = 32

class MeshBuilder {
  tris: [V, V, V][] = []
  tri(a: V, b: V, c: V) {
    this.tris.push([a, b, c])
  }
  quad(a: V, b: V, c: V, d: V) {
    this.tri(a, b, c)
    this.tri(a, c, d)
  }
  /** Grid of points p[i][j]; wraps j if closedJ. Winding chosen so normals face outward for a CCW param. */
  grid(p: V[][], closedJ: boolean, flip = false) {
    for (let i = 0; i < p.length - 1; i++) {
      const n = p[i].length
      const jm = closedJ ? n : n - 1
      for (let j = 0; j < jm; j++) {
        const j2 = (j + 1) % n
        const a = p[i][j],
          b = p[i + 1][j],
          c = p[i + 1][j2],
          d = p[i][j2]
        if (flip) this.quad(a, b, c, d)
        else this.quad(a, d, c, b)
      }
    }
  }
  /** Fan cap from a centre point around a ring. */
  fan(center: V, ring: V[], flip = false) {
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length]
      if (flip) this.tri(center, b, a)
      else this.tri(center, a, b)
    }
  }
  toObj(name: string): string {
    // Orient outward: a closed mesh with outward-facing CCW triangles has positive signed volume.
    let vol = 0
    for (const [a, b, c] of this.tris) {
      vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])
    }
    if (vol < 0) this.tris = this.tris.map(([a, b, c]) => [a, c, b] as [V, V, V])
    const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
    const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    const norm = (a: V): V => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1
      return [a[0] / l, a[1] / l, a[2] / l]
    }
    const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    const key = (v: V) => v.map((x) => x.toFixed(5)).join(",")
    const faceN = this.tris.map(([a, b, c]) => norm(cross(sub(b, a), sub(c, a))))
    const byPos: Record<string, number[]> = {}
    this.tris.forEach((t, fi) => t.forEach((v) => (byPos[key(v)] = byPos[key(v)] || []).push(fi)))
    const cosLimit = Math.cos((55 * Math.PI) / 180)
    const lines: string[] = [`# Partsight unit mesh: ${name}`, `o ${name}`]
    const vn: string[] = []
    const f: string[] = []
    let idx = 1
    this.tris.forEach((t, fi) => {
      const corner: number[] = []
      t.forEach((v) => {
        let n: V = [0, 0, 0]
        for (const other of byPos[key(v)]) {
          if (dot(faceN[other], faceN[fi]) >= cosLimit) n = [n[0] + faceN[other][0], n[1] + faceN[other][1], n[2] + faceN[other][2]]
        }
        n = norm(n)
        lines.push(`v ${v[0].toFixed(5)} ${v[1].toFixed(5)} ${v[2].toFixed(5)}`)
        vn.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`)
        corner.push(idx++)
      })
      f.push(`f ${corner[0]}//${corner[0]} ${corner[1]}//${corner[1]} ${corner[2]}//${corner[2]}`)
    })
    return lines.concat(vn, f).join("\n") + "\n"
  }
}

const ring = (x: number, r: number, ry = r, rz = r, n = SEG): V[] =>
  Array.from({length: n}, (_, j) => {
    const a = (j / n) * Math.PI * 2
    return [x, Math.cos(a) * ry, Math.sin(a) * rz] as V
  })

/** Surface of revolution around X from a profile of (x, r) points; caps if first/last r > 0. */
function revolve(profile: [number, number][], capStart: boolean, capEnd: boolean): MeshBuilder {
  const m = new MeshBuilder()
  const rings = profile.map(([x, r]) => ring(x, r))
  m.grid(rings, true)
  if (capStart) m.fan([profile[0][0], 0, 0], rings[0], true)
  if (capEnd) m.fan([profile[profile.length - 1][0], 0, 0], rings[rings.length - 1])
  return m
}

function box(): MeshBuilder {
  const m = new MeshBuilder()
  const h = 0.5
  const c: V[] = [
    [-h, -h, -h],
    [h, -h, -h],
    [h, h, -h],
    [-h, h, -h],
    [-h, -h, h],
    [h, -h, h],
    [h, h, h],
    [-h, h, h]
  ]
  m.quad(c[4], c[5], c[6], c[7]) // +z
  m.quad(c[1], c[0], c[3], c[2]) // -z
  m.quad(c[5], c[1], c[2], c[6]) // +x
  m.quad(c[0], c[4], c[7], c[3]) // -x
  m.quad(c[7], c[6], c[2], c[3]) // +y
  m.quad(c[0], c[1], c[5], c[4]) // -y
  return m
}

/** Superellipsoid: e close to 0 = box, 1 = sphere. 0.2 gives a soft rounded box. */
function superellipsoid(e: number, nu = 24, nv = 32): MeshBuilder {
  const m = new MeshBuilder()
  const sp = (w: number, p: number) => Math.sign(w) * Math.pow(Math.abs(w), p)
  const pts: V[][] = []
  for (let i = 0; i <= nu; i++) {
    const u = -Math.PI / 2 + (i / nu) * Math.PI
    const row: V[] = []
    for (let j = 0; j < nv; j++) {
      const v = -Math.PI + (j / nv) * 2 * Math.PI
      row.push([0.5 * sp(Math.cos(u), e) * sp(Math.cos(v), e), 0.5 * sp(Math.sin(u), e), 0.5 * sp(Math.cos(u), e) * sp(Math.sin(v), e)])
    }
    pts.push(row)
  }
  m.grid(pts, true, true)
  return m
}

function cylinder() {
  return revolve(
    [
      [-0.5, 0.5],
      [0.5, 0.5]
    ],
    true,
    true
  )
}

function tube() {
  const m = new MeshBuilder()
  const ro = 0.5,
    ri = 0.42
  const o0 = ring(-0.5, ro),
    o1 = ring(0.5, ro),
    i0 = ring(-0.5, ri),
    i1 = ring(0.5, ri)
  m.grid([o0, o1], true)
  m.grid([i1, i0], true)
  m.grid([i0, o0], true)
  m.grid([o1, i1], true)
  return m
}

function capsule() {
  const prof: [number, number][] = []
  const r = 0.5,
    half = 0.5
  const cap = 8
  // Hemisphere radius in X is limited so the whole thing fits [-0.5, 0.5]; stretched by dims anyway.
  const hx = 0.25
  for (let i = 0; i <= cap; i++) {
    const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2)
    prof.push([-half + hx + Math.sin(a) * hx, Math.cos(a) * r])
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2)
    prof.push([half - hx + Math.sin(a) * hx, Math.cos(a) * r])
  }
  prof[0][1] = 0.0001
  prof[prof.length - 1][1] = 0.0001
  return revolve(prof, false, false)
}

/** Frustum: narrow at -X, wide (open-looking) at +X. */
function cone() {
  return revolve(
    [
      [-0.5, 0.15],
      [0.5, 0.5]
    ],
    true,
    true
  )
}

function sphere() {
  return superellipsoid(1, 16, 32)
}

function torus() {
  const m = new MeshBuilder()
  const R = 0.35,
    r = 0.15
  const pts: V[][] = []
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2
    const row: V[] = []
    for (let j = 0; j < 16; j++) {
      const b = (j / 16) * Math.PI * 2
      const rr = R + Math.cos(b) * r
      row.push([Math.sin(b) * r * (0.5 / 0.15) * 0.3, Math.cos(a) * rr, Math.sin(a) * rr])
    }
    pts.push(row)
  }
  m.grid(pts, true, true)
  return m
}

/** Sweep a circle (radius ry in-plane, rz in Z) along a polyline path in the XY plane. */
function sweepXY(path: [number, number][], ry: number, rz: number, closed = false): MeshBuilder {
  const m = new MeshBuilder()
  const rings: V[][] = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)]
    let tx = b[0] - a[0],
      ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    tx /= l
    ty /= l
    const nx = -ty,
      ny = tx
    return Array.from({length: 16}, (_, j) => {
      const t = (j / 16) * Math.PI * 2
      return [p[0] + nx * Math.cos(t) * ry, p[1] + ny * Math.cos(t) * ry, Math.sin(t) * rz] as V
    })
  })
  m.grid(rings, true)
  if (!closed) {
    m.fan([path[0][0], path[0][1], 0], rings[0], true)
    const last = path[path.length - 1]
    m.fan([last[0], last[1], 0], rings[rings.length - 1])
  }
  return m
}

function uShape() {
  const t = 0.1
  const R = 0.5 - t
  const path: [number, number][] = []
  const legBottom = -0.5,
    arcCentre = 0.5 - t - R
  for (let i = 0; i <= 6; i++) path.push([-R, legBottom + ((arcCentre - legBottom) * i) / 6])
  for (let i = 1; i <= 20; i++) {
    const a = Math.PI - (i / 20) * Math.PI
    path.push([Math.cos(a) * R, arcCentre + Math.sin(a) * R])
  }
  for (let i = 1; i <= 6; i++) path.push([R, arcCentre - ((arcCentre - legBottom) * i) / 6])
  return sweepXY(path, t, 0.5)
}

function spring() {
  const m = new MeshBuilder()
  const turns = 6,
    coilR = 0.4,
    wire = 0.08,
    steps = turns * 24
  const centre = (s: number): V => {
    const a = s * turns * Math.PI * 2
    return [-0.5 + wire + s * (1 - 2 * wire), Math.cos(a) * coilR, Math.sin(a) * coilR]
  }
  const rings: V[][] = []
  for (let i = 0; i <= steps; i++) {
    const s = i / steps
    const c = centre(s)
    // Frame: radial direction and axis direction are a good-enough normal plane for a shallow helix.
    const a = s * turns * Math.PI * 2
    const radial: V = [0, Math.cos(a), Math.sin(a)]
    const axis: V = [1, 0, 0]
    rings.push(
      Array.from({length: 10}, (_, j) => {
        const t = (j / 10) * Math.PI * 2
        return [
          c[0] + axis[0] * Math.sin(t) * wire,
          c[1] + radial[1] * Math.cos(t) * wire,
          c[2] + radial[2] * Math.cos(t) * wire
        ] as V
      })
    )
  }
  m.grid(rings, true)
  m.fan(centre(0), rings[0], true)
  m.fan(centre(1), rings[rings.length - 1])
  return m
}

function gear() {
  const m = new MeshBuilder()
  const teeth = 12
  const prof: [number, number][] = []
  for (let k = 0; k < teeth; k++) {
    const base = (k / teeth) * Math.PI * 2,
      w = (Math.PI * 2) / teeth
    const pts: [number, number][] = [
      [base, 0.4],
      [base + w * 0.2, 0.5],
      [base + w * 0.5, 0.5],
      [base + w * 0.7, 0.4]
    ]
    pts.forEach(([a, r]) => prof.push([Math.cos(a) * r, Math.sin(a) * r]))
  }
  const back: V[] = prof.map(([y, z]) => [-0.5, y, z])
  const front: V[] = prof.map(([y, z]) => [0.5, y, z])
  m.grid([back, front], true)
  m.fan([-0.5, 0, 0], back, true)
  m.fan([0.5, 0, 0], front)
  return m
}

const meshes: Record<string, () => MeshBuilder> = {
  box,
  rbox: () => superellipsoid(0.2),
  cylinder,
  tube,
  capsule,
  cone,
  sphere,
  torus,
  u_shape: uShape,
  spring,
  gear
}

mkdirSync(OUT, {recursive: true})
for (const [name, make] of Object.entries(meshes)) {
  const m = make()
  writeFileSync(join(OUT, `ps_${name}.obj`), m.toObj(`ps_${name}`))
  console.log(`ps_${name}.obj  ${m.tris.length} tris`)
}

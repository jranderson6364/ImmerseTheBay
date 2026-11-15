/**
 * Tiny glTF 2.0 binary (.glb) writer and read-back checker for the placeholder art export.
 * Positions, normals and indices only; one unlit (KHR_materials_unlit) material per colour; one mesh per node.
 * Input meshes use the Core/MapMesh.ts MeshChunk layout: 8 floats per vertex (pos xyz, normal xyz, uv), double-sided
 * by duplicated reverse-wound triangles. The writer drops those duplicates and sets doubleSided on the material.
 */
import type {MeshChunk} from "../../Assets/Retrospecs/Core/MapMesh"

export type RGB = readonly [number, number, number]

export interface GMaterial {
  name: string
  rgb: RGB
}

export interface GPrim {
  chunk: MeshChunk
  material: number
}

export interface GNode {
  name: string
  translation?: [number, number, number]
  rotation?: [number, number, number, number]
  scale?: [number, number, number]
  prims?: GPrim[]
  children?: GNode[]
}

// ---------------------------------------------------------------------------------------------------------------
// Matrices (column-major 4x4, like glTF)

export type M4 = number[]

export function trs(t?: number[], r?: number[], s?: number[]): M4 {
  const [x, y, z, w] = r || [0, 0, 0, 1]
  const [sx, sy, sz] = s || [1, 1, 1]
  const [tx, ty, tz] = t || [0, 0, 0]
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1
  ]
}

export function mmul(a: M4, b: M4): M4 {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
    o[c * 4 + r] = s
  }
  return o
}

export function xform(m: M4, x: number, y: number, z: number): [number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
}

export interface Box3 {
  min: [number, number, number]
  max: [number, number, number]
}

export function emptyBox(): Box3 {
  return {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]}
}

function grow(b: Box3, p: number[]) {
  for (let k = 0; k < 3; k++) {
    if (p[k] < b.min[k]) b.min[k] = p[k]
    if (p[k] > b.max[k]) b.max[k] = p[k]
  }
}

const maxScale = (s?: number[]) => (s ? Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])) : 1)

/** Exact world bounds of the in-memory tree; nodes whose own scale is below `hideBelow` (hidden parts) are skipped. */
export function treeBounds(root: GNode, parent: M4 = trs(), hideBelow = 0.01, out: Box3 = emptyBox()): Box3 {
  if (maxScale(root.scale) < hideBelow) return out
  const m = mmul(parent, trs(root.translation, root.rotation, root.scale))
  for (const p of root.prims || []) {
    const v = p.chunk.verts
    for (let i = 0; i < v.length; i += 8) grow(out, xform(m, v[i], v[i + 1], v[i + 2]))
  }
  for (const c of root.children || []) treeBounds(c, m, hideBelow, out)
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Writer

/** Drops reverse-wound duplicate triangles (same vertex set) and degenerate ones. */
export function singleSided(idx: number[]): number[] {
  const seen = new Set<string>()
  const out: number[] = []
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2]
    if (a === b || b === c || a === c) continue
    const k = [a, b, c].sort((p, q) => p - q).join(",")
    if (seen.has(k)) continue
    seen.add(k)
    out.push(a, b, c)
  }
  return out
}

export interface GlbStats {
  triangles: number
  meshes: number
  primitives: number
  nodes: number
  bytes: number
}

export function writeGlb(root: GNode, materials: GMaterial[], generator = "Retrospecs tools/export-art.ts"): {bytes: Uint8Array; stats: GlbStats} {
  const bin: Uint8Array[] = []
  let binLen = 0
  const bufferViews: any[] = []
  const accessors: any[] = []
  const meshes: any[] = []
  const nodes: any[] = []
  let triangles = 0
  let primitives = 0

  const pushView = (data: Uint8Array, target: number): number => {
    const pad = (4 - (binLen % 4)) % 4
    if (pad) {
      bin.push(new Uint8Array(pad))
      binLen += pad
    }
    bufferViews.push({buffer: 0, byteOffset: binLen, byteLength: data.byteLength, target})
    bin.push(data)
    binLen += data.byteLength
    return bufferViews.length - 1
  }

  const addPrim = (p: GPrim) => {
    const v = p.chunk.verts
    const n = v.length / 8
    const tri = singleSided(p.chunk.idx)
    const pos = new Float32Array(n * 3)
    const nor = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = v[i * 8]; pos[i * 3 + 1] = v[i * 8 + 1]; pos[i * 3 + 2] = v[i * 8 + 2]
      let nx = v[i * 8 + 3], ny = v[i * 8 + 4], nz = v[i * 8 + 5]
      const l = Math.hypot(nx, ny, nz)
      if (l < 1e-8) { nx = 0; ny = 1; nz = 0 } else { nx /= l; ny /= l; nz /= l }
      nor[i * 3] = nx; nor[i * 3 + 1] = ny; nor[i * 3 + 2] = nz
    }
    // min/max from the float32 values actually stored.
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      const x = pos[i * 3 + k]
      if (x < min[k]) min[k] = x
      if (x > max[k]) max[k] = x
    }
    const big = n > 65535
    const ind = big ? new Uint32Array(tri) : new Uint16Array(tri)
    const pv = pushView(new Uint8Array(pos.buffer), 34962)
    accessors.push({bufferView: pv, componentType: 5126, count: n, type: "VEC3", min, max})
    const pa = accessors.length - 1
    const nv = pushView(new Uint8Array(nor.buffer), 34962)
    accessors.push({bufferView: nv, componentType: 5126, count: n, type: "VEC3"})
    const na = accessors.length - 1
    const iv = pushView(new Uint8Array(ind.buffer), 34963)
    accessors.push({bufferView: iv, componentType: big ? 5125 : 5123, count: tri.length, type: "SCALAR"})
    const ia = accessors.length - 1
    triangles += tri.length / 3
    primitives++
    return {attributes: {POSITION: pa, NORMAL: na}, indices: ia, material: p.material, mode: 4}
  }

  const addNode = (g: GNode): number => {
    const node: any = {name: g.name}
    if (g.translation) node.translation = g.translation
    if (g.rotation) {
      const [x, y, z, w] = g.rotation
      const l = Math.hypot(x, y, z, w) || 1
      node.rotation = [x / l, y / l, z / l, w / l]
    }
    if (g.scale) node.scale = g.scale
    const idx = nodes.length
    nodes.push(node)
    if (g.prims && g.prims.length) {
      meshes.push({name: g.name, primitives: g.prims.map(addPrim)})
      node.mesh = meshes.length - 1
    }
    if (g.children && g.children.length) node.children = g.children.map(addNode)
    return idx
  }
  addNode(root)
  const pad = (4 - (binLen % 4)) % 4
  if (pad) {
    bin.push(new Uint8Array(pad))
    binLen += pad
  }

  const json = {
    asset: {version: "2.0", generator},
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{name: root.name, nodes: [0]}],
    nodes,
    meshes,
    materials: materials.map((m) => ({
      name: m.name,
      pbrMetallicRoughness: {baseColorFactor: [m.rgb[0], m.rgb[1], m.rgb[2], 1], metallicFactor: 0, roughnessFactor: 1},
      doubleSided: true,
      extensions: {KHR_materials_unlit: {}}
    })),
    accessors,
    bufferViews,
    buffers: [{byteLength: binLen}]
  }
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jpad = (4 - (jsonBytes.length % 4)) % 4
  if (jpad) {
    const j = new Uint8Array(jsonBytes.length + jpad)
    j.set(jsonBytes)
    j.fill(0x20, jsonBytes.length)
    jsonBytes = j
  }
  const total = 12 + 8 + jsonBytes.length + 8 + binLen
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true) // "glTF"
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, jsonBytes.length, true)
  dv.setUint32(16, 0x4e4f534a, true) // "JSON"
  out.set(jsonBytes, 20)
  let o = 20 + jsonBytes.length
  dv.setUint32(o, binLen, true)
  dv.setUint32(o + 4, 0x004e4942, true) // "BIN\0"
  o += 8
  for (const b of bin) {
    out.set(b, o)
    o += b.byteLength
  }
  return {bytes: out, stats: {triangles, meshes: meshes.length, primitives, nodes: nodes.length, bytes: total}}
}

// ---------------------------------------------------------------------------------------------------------------
// Read-back check

export interface GlbCheck {
  ok: boolean
  errors: string[]
  triangles: number
  meshes: number
  primitives: number
  nodeNames: string[]
  /** World bounds of every stored vertex through the node transforms (hidden nodes skipped). */
  bounds: Box3
}

const COMPONENT_SIZE: Record<number, number> = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
const TYPE_COUNT: Record<string, number> = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}

export function checkGlb(bytes: Uint8Array): GlbCheck {
  const errors: string[] = []
  const res: GlbCheck = {ok: false, errors, triangles: 0, meshes: 0, primitives: 0, nodeNames: [], bounds: emptyBox()}
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 28) {
    errors.push("file too short")
    return res
  }
  if (dv.getUint32(0, true) !== 0x46546c67) errors.push("bad magic")
  if (dv.getUint32(4, true) !== 2) errors.push("version is not 2")
  if (dv.getUint32(8, true) !== bytes.byteLength) errors.push("header length does not match file size")
  const jlen = dv.getUint32(12, true)
  if (dv.getUint32(16, true) !== 0x4e4f534a) errors.push("first chunk is not JSON")
  if (jlen % 4) errors.push("JSON chunk not 4-byte aligned")
  let gltf: any
  try {
    gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jlen)))
  } catch (e) {
    errors.push("JSON chunk does not parse: " + e)
    return res
  }
  const bo = 20 + jlen
  const blen = dv.getUint32(bo, true)
  if (dv.getUint32(bo + 4, true) !== 0x004e4942) errors.push("second chunk is not BIN")
  if (bo + 8 + blen !== bytes.byteLength) errors.push("BIN chunk length does not reach end of file")
  if (gltf.buffers?.[0]?.byteLength > blen) errors.push("buffer byteLength exceeds BIN chunk")
  const binStart = bo + 8
  if (gltf.asset?.version !== "2.0") errors.push("asset.version is not 2.0")

  const views = gltf.bufferViews || []
  const accs = gltf.accessors || []
  for (const [i, v] of views.entries()) {
    if (v.byteOffset + v.byteLength > blen) errors.push(`bufferView ${i} past end of BIN`)
  }
  const accData = (i: number): {arr: ArrayLike<number>; n: number} | null => {
    const a = accs[i]
    if (!a) {
      errors.push(`missing accessor ${i}`)
      return null
    }
    const v = views[a.bufferView]
    const cs = COMPONENT_SIZE[a.componentType], tc = TYPE_COUNT[a.type]
    if (!v || !cs || !tc) {
      errors.push(`accessor ${i} has bad view/type`)
      return null
    }
    const need = (a.byteOffset || 0) + a.count * cs * tc
    if (need > v.byteLength) {
      errors.push(`accessor ${i} count ${a.count} overruns its bufferView`)
      return null
    }
    const off = binStart + v.byteOffset + (a.byteOffset || 0)
    if (off % cs) errors.push(`accessor ${i} misaligned`)
    const buf = bytes.buffer.slice(bytes.byteOffset + off, bytes.byteOffset + off + a.count * cs * tc)
    const arr = a.componentType === 5126 ? new Float32Array(buf) : a.componentType === 5125 ? new Uint32Array(buf) : a.componentType === 5123 ? new Uint16Array(buf) : new Uint8Array(buf)
    return {arr, n: a.count}
  }

  const meshBoxes: Box3[][] = []
  const meshPos: ArrayLike<number>[][] = []
  for (const [mi, m] of (gltf.meshes || []).entries()) {
    const boxes: Box3[] = []
    const posList: ArrayLike<number>[] = []
    for (const p of m.primitives) {
      res.primitives++
      const pa = accData(p.attributes.POSITION)
      const na = accData(p.attributes.NORMAL)
      const ia = accData(p.indices)
      if (!pa || !na || !ia) continue
      if (na.n !== pa.n) errors.push(`mesh ${mi}: NORMAL count != POSITION count`)
      if (ia.n % 3) errors.push(`mesh ${mi}: index count not a multiple of 3`)
      res.triangles += ia.n / 3
      let imax = 0
      for (let k = 0; k < ia.n; k++) if (ia.arr[k] > imax) imax = ia.arr[k]
      if (imax >= pa.n) errors.push(`mesh ${mi}: index ${imax} >= vertex count ${pa.n}`)
      const acc = accs[p.attributes.POSITION]
      const b = emptyBox()
      for (let k = 0; k < pa.n; k++) grow(b, [pa.arr[k * 3], pa.arr[k * 3 + 1], pa.arr[k * 3 + 2]])
      for (let k = 0; k < 3; k++) {
        if (!acc.min || !acc.max || acc.min[k] !== b.min[k] || acc.max[k] !== b.max[k]) errors.push(`mesh ${mi}: POSITION min/max mismatch`)
      }
      for (let k = 0; k < na.n; k++) {
        const l = Math.hypot(na.arr[k * 3], na.arr[k * 3 + 1], na.arr[k * 3 + 2])
        if (Math.abs(l - 1) > 1e-3) {
          errors.push(`mesh ${mi}: non-unit normal`)
          break
        }
      }
      if (p.material === undefined || !gltf.materials?.[p.material]) errors.push(`mesh ${mi}: missing material`)
      boxes.push(b)
      posList.push(pa.arr)
    }
    meshBoxes.push(boxes)
    meshPos.push(posList)
  }
  res.meshes = (gltf.meshes || []).length
  for (const m of gltf.materials || []) {
    if (!m.extensions?.KHR_materials_unlit) errors.push(`material ${m.name} is not unlit`)
  }

  const walk = (ni: number, parent: M4) => {
    const n = gltf.nodes[ni]
    res.nodeNames.push(n.name)
    if (maxScale(n.scale) < 0.01) return
    const m = mmul(parent, trs(n.translation, n.rotation, n.scale))
    if (n.mesh !== undefined) {
      // Exact: every stored vertex through the node transforms (accessor boxes are loose under rotation).
      for (const a of meshPos[n.mesh] || []) {
        for (let k = 0; k + 2 < a.length; k += 3) grow(res.bounds, xform(m, a[k], a[k + 1], a[k + 2]))
      }
    }
    for (const c of n.children || []) walk(c, m)
  }
  for (const r of gltf.scenes?.[gltf.scene ?? 0]?.nodes || []) walk(r, trs())
  res.ok = errors.length === 0
  return res
}

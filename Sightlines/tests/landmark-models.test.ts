import {describe, expect, test} from "bun:test"
import {BUILDINGS, LANDMARKS} from "../Assets/Sightlines/Data/CampusData"
import {MapMeshOptions, MeshChunk, buildingHeightCm} from "../Assets/Sightlines/Core/MapMesh"
import {LandmarkModel, MODELLED_LANDMARKS, buildLandmarkModel} from "../Assets/Sightlines/Core/LandmarkModels"

const cmPerM = 100 / 600
const center = {e: 120, n: 40}
const o: MapMeshOptions = {cmPerM, verticalExaggeration: 4, center, radiusM: 1e9, minHeightCm: 0.5, outlineWidthCm: 0.2, cornerAngleDeg: 45, wallInsetCm: 0.04}

const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!
const anchorOf = (id: string) => ({x: (lm(id).east - center.e) * cmPerM, z: -(lm(id).north - center.n) * cmPerM})
const footprintOf = (id: string) => (lm(id).building >= 0 ? BUILDINGS[lm(id).building] : null)
const model = (id: string) => buildLandmarkModel(id, footprintOf(id), anchorOf(id), o)
const chunks = (m: LandmarkModel): MeshChunk[] => [m.body, m.accent, m.trim].filter((c): c is MeshChunk => !!c)
const nVerts = (m: LandmarkModel) => chunks(m).reduce((s, c) => s + c.verts.length / 8, 0)

describe("landmark models", () => {
  test("every modelled id builds a model; others return null", () => {
    for (const id of MODELLED_LANDMARKS) expect(model(id)).not.toBeNull()
    expect(model("shriram")).toBeNull()
    expect(model("allen")).toBeNull()
    expect(buildLandmarkModel("hoover", null, {x: 0, z: 0}, o)).toBeNull()
  })

  test("chunks: stride 8, whole triangles, indices in range, under 64k verts; optional parts absent when empty", () => {
    for (const id of MODELLED_LANDMARKS) {
      const m = model(id)!
      for (const c of chunks(m)) {
        expect(c.verts.length % 8).toBe(0)
        expect(c.idx.length % 3).toBe(0)
        expect(c.idx.length).toBeGreaterThan(0)
        const n = c.verts.length / 8
        expect(n).toBeLessThan(64000)
        for (const i of c.idx) {
          expect(Number.isInteger(i)).toBe(true)
          expect(i >= 0 && i < n).toBe(true)
        }
        for (const v of c.verts) expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  test("each model stays under about 6k vertices", () => {
    for (const id of MODELLED_LANDMARKS) expect(nVerts(model(id)!)).toBeLessThan(6000)
  })

  test("models stay within the footprint (or Memorial Church's anchor) plus a small margin", () => {
    const marginCm = 8 * cmPerM // porticos and eaves project a little
    for (const id of MODELLED_LANDMARKS) {
      const b = footprintOf(id)
      let x0: number, x1: number, z0: number, z1: number
      if (b) {
        x0 = z0 = Infinity
        x1 = z1 = -Infinity
        const r = b[3]
        for (let i = 0; i < r.length; i += 2) {
          const x = (r[i] / 10 - center.e) * cmPerM, z = -(r[i + 1] / 10 - center.n) * cmPerM
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          z0 = Math.min(z0, z)
          z1 = Math.max(z1, z)
        }
      } else {
        const a = anchorOf(id), R = 45 * cmPerM
        x0 = a.x - R
        x1 = a.x + R
        z0 = a.z - R
        z1 = a.z + R
      }
      for (const c of chunks(model(id)!)) {
        for (let i = 0; i < c.verts.length; i += 8) {
          expect(c.verts[i]).toBeGreaterThanOrEqual(x0 - marginCm)
          expect(c.verts[i]).toBeLessThanOrEqual(x1 + marginCm)
          expect(c.verts[i + 2]).toBeGreaterThanOrEqual(z0 - marginCm)
          expect(c.verts[i + 2]).toBeLessThanOrEqual(z1 + marginCm)
          expect(c.verts[i + 1]).toBeGreaterThanOrEqual(-1e-6)
        }
      }
    }
  })

  test("topCm equals the highest vertex and is near the real height times the exaggeration", () => {
    for (const id of MODELLED_LANDMARKS) {
      const m = model(id)!
      let top = 0
      for (const c of chunks(m)) for (let i = 1; i < c.verts.length; i += 8) top = Math.max(top, c.verts[i])
      expect(Math.abs(m.topCm - top)).toBeLessThan(1e-9)
      expect(m.topCm).toBeGreaterThan(2)
    }
    expect(Math.abs(model("hoover")!.topCm - 87 * cmPerM * 4)).toBeLessThan(0.5)
  })

  test("Hoover is taller than every other model and every background building", () => {
    const h = model("hoover")!.topCm
    for (const id of MODELLED_LANDMARKS) if (id !== "hoover") expect(model(id)!.topCm).toBeLessThan(h * 0.6)
    const hooverIdx = lm("hoover").building
    for (let i = 0; i < BUILDINGS.length; i++) if (i !== hooverIdx) expect(buildingHeightCm(BUILDINGS[i], o)).toBeLessThan(h)
  })

  test("Memorial Church rises out of the Main Quad roof and has no spire", () => {
    const church = model("memchu")!, quad = model("mainquad")!
    expect(church.topCm).toBeGreaterThan(quad.topCm * 1.5)
    expect(church.topCm).toBeLessThan(30 * cmPerM * 4)
  })

  test("Hoover's dome (accent) crowns the tower, and its belvedere has dim recesses behind the arches", () => {
    const m = model("hoover")!
    let domeTop = 0
    for (let i = 1; i < m.accent!.verts.length; i += 8) domeTop = Math.max(domeTop, m.accent!.verts[i])
    expect(domeTop).toBeGreaterThan(m.topCm * 0.93)
    let trimLo = Infinity
    for (let i = 1; i < m.trim!.verts.length; i += 8) trimLo = Math.min(trimLo, m.trim!.verts[i])
    expect(trimLo).toBeGreaterThan(m.topCm * 0.75)
  })

  test("deterministic", () => {
    expect(JSON.stringify(model("mainquad"))).toBe(JSON.stringify(model("mainquad")))
  })
})

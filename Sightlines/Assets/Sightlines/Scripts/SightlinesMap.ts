/**
 * Builds and draws the 3D campus map at runtime from the baked OSM data (no OBJ imports, no per-building wiring).
 *
 * Everything lives under `root`, whose LOCAL frame is the map frame: X = east, Y = up, Z = -north, centimetres,
 * with the wearer's surveyed position at the origin. The controller positions and rotates `root` after calibration.
 *
 * World-space extras (sightline pillars) live under `worldRoot`, which the controller keeps at the wearer's floor
 * with the same yaw as the map, so bearings agree everywhere.
 */
import {BUILDINGS, LANDMARKS, BakedLandmark} from "../Data/CampusData"
import {PATHS} from "../Data/PathsData"
import {tidyLabel} from "./LabelStyle"
import {CARDS, cardById} from "../Core/Cards"
import {EN, V3, bearingDeg, bearingToMapDir, distanceM, enToMap, formatDistance, latLonToEN} from "../Core/Geo"
import {
  MeshChunk, MapMeshOptions, arcPoints, buildBuildingOutline, buildCampusMesh, buildDisc, buildPathRibbons, buildRing, buildSingleBuilding, buildTube, buildingHeightCm,
  landmarkMapPlacement, vertexCount
} from "../Core/MapMesh"
import {WorldLabel} from "../../Scripts/WorldLabel"

export type LandmarkState = "dim" | "seen" | "lit" | "focus"

interface LandmarkView {
  id: string
  en: EN
  map: V3
  topCm: number
  obj: SceneObject | null
  material: Material | null
  /** Bright perimeter outline, a separate object so state colours on the body don't touch it. */
  outline: SceneObject | null
  label: SceneObject | null
  labelText: Text | null
  state: LandmarkState
  /** True for off-map cards and for landmarks beyond radiusM: pinned to the disc edge in their true direction. */
  offMap: boolean
}

// Additive display: black is invisible, brightness is opacity. Background buildings use a cool blue-to-violet ramp
// (brighter = taller); landmarks use warm amber/gold and cyan/white states, so they never read as background.
const COLORS: Record<string, [number, number, number, number]> = {
  // Warm campus palette: Stanford red-tile roofs and sandstone, not neon. Additive display: dark = see-through,
  // so everything that should read as solid stays fairly bright.
  // Background roofs by height band, two tones each (neighbouring buildings alternate tone).
  roofLow: [0.88, 0.56, 0.4, 1], // < 8 m: light clay
  roofLowAlt: [0.94, 0.64, 0.48, 1],
  roofMid: [0.84, 0.44, 0.32, 1], // 8-15 m (most of campus): red tile
  roofMidAlt: [0.92, 0.53, 0.38, 1],
  roofHigh: [0.9, 0.5, 0.46, 1], // > 15 m: rosy tile
  roofHighAlt: [0.96, 0.6, 0.54, 1],
  // Walls: sandstone at about half brightness, so roofs pop and walls read as sides.
  wallLow: [0.5, 0.4, 0.27, 1],
  wallLowAlt: [0.55, 0.44, 0.3, 1],
  wallMid: [0.46, 0.36, 0.24, 1],
  wallMidAlt: [0.52, 0.41, 0.28, 1],
  wallHigh: [0.5, 0.38, 0.3, 1],
  wallHighAlt: [0.56, 0.43, 0.34, 1],
  outline: [1.0, 0.93, 0.8, 1], // background roof edges: warm cream
  landmarkOutline: [1.0, 0.98, 0.9, 1], // landmark roof edges: near white, marks them as touchable
  base: [0.07, 0.07, 0.04, 1], // map disc: dark earth, almost see-through
  edge: [0.86, 0.74, 0.48, 1], // disc rim: sandstone gold
  // Paths lie flat under the buildings, so they stay dimmer than roofs and outlines.
  road: [0.56, 0.53, 0.47, 1], // roads: pale stone
  bike: [0.5, 0.74, 0.38, 1], // bike paths and bike-lane dashes: sage green
  foot: [0.26, 0.24, 0.2, 1], // foot paths: faint
  // Landmark states (body colour): honey sandstone, warmer once heard, glowing cream when lit.
  dim: [1.0, 0.84, 0.52, 1],
  seen: [1.0, 0.74, 0.3, 1],
  lit: [1.0, 0.95, 0.72, 1],
  focus: [1.0, 1.0, 1.0, 1],
  you: [1.0, 0.45, 0.55, 1],
  thread: [1.0, 0.86, 0.48, 1],
  guess: [1.0, 0.55, 0.2, 1],
  truth: [0.55, 0.92, 0.5, 1]
}

const MESH_VERTEX_STRIDE = 8
const MESH_VERTEX_BATCH = 512
const MESH_INDEX_BATCH = 3072 // divisible by three, so each call ends on a full triangle

@component
export class SightlinesMap extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Sightlines Map</span><br/><span style="color: #94A3B8; font-size: 11px;">Builds the campus from Data/CampusData.ts at runtime.</span>')
  @input
  @hint("Any material with a Base Color (e.g. Assets/Materials/White.mat). It is cloned per color.")
  material: Material

  @input
  @hint("Assets/Prefabs/WorldLabel.prefab")
  labelPrefab: ObjectPrefab

  @input
  @hint("Map scale 1:N. 600 -> 700 m is about 117 cm, so the disc is about 2.3 m across.")
  scaleDenominator: number = 600

  @input
  @hint("Vertical exaggeration so 3-storey buildings are visible at map scale")
  verticalExaggeration: number = 4

  @input
  @hint("Map radius in real metres. Hoover (662 m) and Cantor (641 m) need at least 670. Landmarks beyond it are pinned to the edge.")
  radiusM: number = 700

  @input
  @hint("Bright outline along every roof edge")
  showOutlines: boolean = true

  @input
  @hint("Roof outline width in map cm (0.15-0.25 reads well)")
  outlineWidthCm: number = 0.2

  @input
  @hint("Thin vertical lines at sharp building corners (part of the outline mesh)")
  showCornerLines: boolean = true

  @input
  @hint("Pull walls this far (cm) inside the roof edge so roofs and outlines overhang them")
  wallInsetCm: number = 0.04

  @input
  @hint("Roads (OSM, Data/PathsData.ts) as flat ribbons under the buildings")
  showRoads: boolean = true

  @input
  @hint("Bike paths, plus dashed stripes on roads with painted bike lanes")
  showBikePaths: boolean = true

  @input
  @hint("Foot paths and sidewalks (dense; faint)")
  showFootpaths: boolean = false

  @input
  @hint("Road width in map cm (8 m at 1:600 is about 1.3)")
  roadWidthCm: number = 1.3

  @input
  @hint("Bike path width in map cm (4 m at 1:600 is about 0.65)")
  bikeWidthCm: number = 0.65

  @input
  @hint("Foot path width in map cm (2.5 m at 1:600 is about 0.4)")
  footWidthCm: number = 0.4

  @input
  @hint("Width of the dashed bike-lane stripe down roads, map cm")
  bikeLaneWidthCm: number = 0.4

  @input @hint("Map label size. The status caption is 0.6 at 70 cm; map labels are 1.5-3 m away.") labelScale: number = 1.2

  @input @hint("Real-direction beacon label size per cm of distance (0.009 matches the status caption)") sightlineLabelPerCm: number = 0.009

  root: SceneObject
  worldRoot: SceneObject
  cmPerM = 100 / 600
  center: EN = {e: 0, n: 0}
  landmarks: Record<string, LandmarkView> = {}

  private temp: SceneObject[] = []
  private worldTemp: SceneObject[] = []
  private camera: SceneObject = null
  private pulseT = 0

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Builds the map centred on `center` (the wearer's surveyed position, local metres). */
  build(center: EN, camera: SceneObject) {
    this.camera = camera
    this.center = center
    this.cmPerM = 100 / this.scaleDenominator
    if (this.root) this.root.destroy()
    if (this.worldRoot) this.worldRoot.destroy()
    this.root = global.scene.createSceneObject("SightlinesMapRoot")
    this.worldRoot = global.scene.createSceneObject("SightlinesWorldRoot")
    this.landmarks = {}

    const opts: MapMeshOptions = {...this.meshStyle(), cmPerM: this.cmPerM, verticalExaggeration: this.verticalExaggeration, center, radiusM: this.radiusM, minHeightCm: 0.35}
    const started = getTime()

    // Base disc + glowing edge ring.
    const radiusCm = this.radiusM * this.cmPerM
    this.meshObject(this.root, "base", buildDisc(radiusCm + 1.5), COLORS.base)
    this.meshObject(this.root, "edge", buildRing(radiusCm + 1.5, 0.6, 128, 0.02), COLORS.edge)

    // Roads, bike paths and foot paths: flat ribbons just above the base, drawn before the buildings.
    const paths = buildPathRibbons(PATHS, {
      cmPerM: this.cmPerM,
      center,
      radiusM: this.radiusM,
      roadWidthCm: this.showRoads ? this.roadWidthCm : 0,
      bikeWidthCm: this.showBikePaths ? this.bikeWidthCm : 0,
      footWidthCm: this.showFootpaths ? this.footWidthCm : 0,
      bikeLaneWidthCm: Math.max(0, this.bikeLaneWidthCm)
    })
    let pathChunks = 0
    const drawPaths = (cs: MeshChunk[], kind: string) => cs.forEach((c, i) => {
      this.meshObject(this.root, `path_${kind}_${i}`, c, COLORS[kind])
      pathChunks++
    })
    drawPaths(paths.roads, "road")
    drawPaths(paths.bike, "bike")
    drawPaths(paths.foot, "foot")
    const pathVerts = {road: vertexCount(paths.roads), bike: vertexCount(paths.bike), foot: vertexCount(paths.foot)}

    // Background buildings (landmark footprints excluded; they get their own meshes).
    const exclude = new Set<number>()
    for (const l of LANDMARKS) if (l.building >= 0) exclude.add(l.building)
    const campus = buildCampusMesh(BUILDINGS, opts, exclude)
    const bandNames = ["Low", "Mid", "High"]
    let chunks = 0
    const draw = (bands: MeshChunk[][][], kind: string) => {
      bands.forEach((tones, band) => tones.forEach((cs, tone) => cs.forEach((c, i) => {
        const key = kind + bandNames[Math.min(band, bandNames.length - 1)] + (tone ? "Alt" : "")
        this.meshObject(this.root, `${kind}_${band}_${tone}_${i}`, c, COLORS[key])
        chunks++
      })))
    }
    draw(campus.roofBands, "roof")
    draw(campus.wallBands, "wall")
    campus.outlines.forEach((c, i) => {
      this.meshObject(this.root, "outlines" + i, c, COLORS.outline)
      chunks++
    })
    const verts = vertexCount(campus.roofs) + vertexCount(campus.walls) + vertexCount(campus.outlines)

    // Landmarks.
    for (const card of CARDS) {
      const baked = LANDMARKS.filter((l) => l.id === card.id)[0]
      if (card.offMap) {
        const en = latLonToEN(card.offMap.lat, card.offMap.lon)
        this.landmarks[card.id] = this.makeLandmark(card.id, en, null, 0, true)
      } else if (baked) {
        this.landmarks[card.id] = this.makeLandmark(card.id, {e: baked.east, n: baked.north}, baked, 0, false)
      }
    }

    // "You are here" marker: a small ring plus a short pillar at the centre.
    this.meshObject(this.root, "you_ring", buildRing(2.2, 0.6, 48, 0.05), COLORS.you)
    this.meshObject(this.root, "you_pillar", buildTube([{x: 0, y: 0, z: 0}, {x: 0, y: 6, z: 0}], 0.5), COLORS.you)

    print(`[Sightlines] map built in ${(getTime() - started).toFixed(2)} s: ${chunks} chunks, ${verts} background verts, ${Object.keys(this.landmarks).length} landmarks; paths ${pathChunks} chunks, verts road ${pathVerts.road} / bike ${pathVerts.bike} / foot ${pathVerts.foot}`)
  }

  private makeLandmark(id: string, en: EN, baked: BakedLandmark | null, _unused: number, offMap: boolean): LandmarkView {
    const card = cardById(id)
    // Anything beyond radiusM (not just the off-map cards) is pinned to the disc edge in its true direction.
    const place = landmarkMapPlacement(en, this.center, this.cmPerM, this.radiusM, 3, offMap)
    offMap = place.pinned
    const map: V3 = {x: place.x, y: 0, z: place.z}
    let topCm = 4
    let obj: SceneObject = null
    let material: Material = null
    let outline: SceneObject = null
    const opts: MapMeshOptions = {...this.meshStyle(), cmPerM: this.cmPerM, verticalExaggeration: this.verticalExaggeration, center: this.center, radiusM: 1e9, minHeightCm: 0.5}
    if (offMap) {
      // Pinned marker is built below.
    } else if (baked && baked.building >= 0) {
      const b = BUILDINGS[baked.building]
      topCm = buildingHeightCm(b, opts)
      const r = this.meshObject(this.root, "lm_" + id, buildSingleBuilding(b, opts), COLORS.dim)
      obj = r.obj
      material = r.material
      // A slightly wider outline than the background so landmarks stand out. Own object and material, so
      // setState() recolours only the body.
      const edge = buildBuildingOutline(b, {...opts, outlineWidthCm: opts.outlineWidthCm * 1.25})
      if (edge.idx.length) outline = this.meshObject(r.obj, "lm_" + id + "_edge", edge, COLORS.landmarkOutline).obj
    } else if (baked) {
      // Point landmark (Memorial Church): a small glowing post.
      topCm = Math.max(2, baked.heightM * this.cmPerM * this.verticalExaggeration)
      const r = this.meshObject(this.root, "lm_" + id, buildTube([{x: map.x, y: 0, z: map.z}, {x: map.x, y: topCm, z: map.z}], 1.2), COLORS.dim)
      obj = r.obj
      material = r.material
    }
    const placed = map
    if (offMap) {
      // Pinned to the map edge in its true direction (placement computed above).
      const m = this.meshObject(this.root, "lm_" + id, buildTube([{x: placed.x, y: 0, z: placed.z}, {x: placed.x, y: 5, z: placed.z}], 1.0), COLORS.dim)
      obj = m.obj
      material = m.material
      topCm = 5
    }
    const label = this.makeLabel(this.root, card ? card.label : id, new vec3(placed.x, topCm + 2.5, placed.z))
    return {id, en, map: placed, topCm, obj, material, outline, label: label.holder, labelText: label.text, state: "dim", offMap}
  }

  /** Outline and wall options shared by the background map and the landmarks. */
  private meshStyle(): {outlineWidthCm: number; cornerAngleDeg: number; wallInsetCm: number} {
    return {
      outlineWidthCm: this.showOutlines ? Math.max(0, this.outlineWidthCm) : 0,
      cornerAngleDeg: this.showCornerLines ? 45 : 0,
      wallInsetCm: Math.max(0, this.wallInsetCm)
    }
  }

  mapPosOf(en: EN): V3 {
    return enToMap(en, this.center, this.cmPerM)
  }

  /** Real distance and bearing from the wearer to a landmark. */
  distanceTo(id: string): number {
    const l = this.landmarks[id]
    return l ? distanceM(this.center, l.en) : 0
  }

  bearingTo(id: string): number {
    const l = this.landmarks[id]
    return l ? bearingDeg(this.center, l.en) : 0
  }

  setState(id: string, state: LandmarkState) {
    const l = this.landmarks[id]
    if (!l) return
    l.state = state
    if (l.material) this.setColor(l.material, COLORS[state])
  }

  /** Returns every landmark that is `lit` or `focus` to `seen` (or `dim` if never seen). */
  resetLights(seen: string[]) {
    for (const id of Object.keys(this.landmarks)) this.setState(id, seen.indexOf(id) >= 0 ? "seen" : "dim")
    this.clearTemp()
  }

  clearTemp() {
    for (const o of this.temp) o.destroy()
    this.temp = []
    for (const o of this.worldTemp) o.destroy()
    this.worldTemp = []
  }

  /** Glowing arc between two landmarks on the map. */
  drawThread(a: string, b: string, color = COLORS.thread) {
    const la = this.landmarks[a]
    const lb = this.landmarks[b]
    if (!la || !lb) return
    const pa = {x: la.map.x, y: la.topCm, z: la.map.z}
    const pb = {x: lb.map.x, y: lb.topCm, z: lb.map.z}
    const span = Math.hypot(pb.x - pa.x, pb.z - pa.z)
    this.temp.push(this.meshObject(this.root, "thread", buildTube(arcPoints(pa, pb, Math.max(4, span * 0.35), 28), 0.45), color).obj)
  }

  /** Arc from the wearer (map centre) toward a bearing, ending at `lengthCm` (or a landmark). */
  drawBearingArc(bearing: number, lengthCm: number, color: number[]) {
    const d = bearingToMapDir(bearing)
    const end = {x: d.x * lengthCm, y: 1, z: d.z * lengthCm}
    this.temp.push(this.meshObject(this.root, "arc", buildTube(arcPoints({x: 0, y: 5, z: 0}, end, Math.max(5, lengthCm * 0.3), 28), 0.5), color as any).obj)
  }

  drawArcToLandmark(id: string, color = COLORS.truth) {
    const l = this.landmarks[id]
    if (!l) return
    const end = {x: l.map.x, y: l.topCm, z: l.map.z}
    const span = Math.hypot(end.x, end.z)
    this.temp.push(this.meshObject(this.root, "arc", buildTube(arcPoints({x: 0, y: 5, z: 0}, end, Math.max(5, span * 0.3), 28), 0.6), color).obj)
  }

  /**
   * A tall pillar of light out in the real world along the true bearing, with a name + distance label: the
   * "sightline". Placed at min(real distance, maxCm) because direction is what matters.
   */
  drawSightline(id: string, maxCm = 900) {
    const l = this.landmarks[id]
    if (!l || !this.worldRoot) return
    const bearing = bearingDeg(this.center, l.en)
    const d = bearingToMapDir(bearing)
    const dist = Math.min(distanceM(this.center, l.en) * 100, maxCm)
    const base = {x: d.x * dist, y: 0, z: d.z * dist}
    // Thin beacon that stops just under the label, so it reads as a marker, not a wall.
    const pillar = this.meshObject(this.worldRoot, "sightline", buildTube([base, {x: base.x, y: 215, z: base.z}], 2.5), COLORS.lit).obj
    this.worldTemp.push(pillar)
    const card = cardById(id)
    // Scale the label with distance so it stays about as readable as the status caption (~0.009 scale per cm).
    const mul = Math.max(1, (dist * this.sightlineLabelPerCm) / Math.max(0.01, this.labelScale))
    const lab = this.makeLabel(this.worldRoot, `${card ? card.label : id} is this way · ${formatDistance(distanceM(this.center, l.en))}`, new vec3(base.x, 240, base.z), mul)
    this.worldTemp.push(lab.holder)
  }

  /** Short beam from the wearer's chest height along a world bearing (the guess pointer). */
  drawWorldBearing(bearing: number, color: number[], lengthCm = 300) {
    if (!this.worldRoot) return
    const d = bearingToMapDir(bearing)
    const o = this.meshObject(this.worldRoot, "pointer", buildTube([{x: d.x * 40, y: 120, z: d.z * 40}, {x: d.x * lengthCm, y: 120, z: d.z * lengthCm}], 2), color as any).obj
    this.worldTemp.push(o)
  }

  /** Nearest landmark to a map-local point (cm), within `maxCm`. */
  pickAtMapPoint(local: vec3, maxCm = 4): string | null {
    let best: string = null
    let bestD = maxCm
    for (const id of Object.keys(this.landmarks)) {
      const l = this.landmarks[id]
      const d = Math.hypot(l.map.x - local.x, l.map.z - local.z)
      if (d < bestD) {
        bestD = d
        best = id
      }
    }
    return best
  }

  // -------------------------------------------------------------------------

  private onUpdate() {
    if (!this.root || !this.camera) return
    this.pulseT += getDeltaTime()
    const camPos = this.camera.getTransform().getWorldPosition()
    // Billboard labels (yaw only) and pulse the focused landmark.
    for (const id of Object.keys(this.landmarks)) {
      const l = this.landmarks[id]
      if (l.label) this.faceCamera(l.label, camPos)
      if (l.state === "focus" && l.material) {
        const k = 0.75 + 0.25 * Math.sin(this.pulseT * 6)
        this.setColor(l.material, [COLORS.lit[0] * k + (1 - k), COLORS.lit[1] * k + (1 - k), COLORS.lit[2] * k + (1 - k), 1])
      }
    }
    for (const o of this.worldTemp) if (o.name.indexOf("label") === 0) this.faceCamera(o, camPos)
  }

  private faceCamera(o: SceneObject, camPos: vec3) {
    const t = o.getTransform()
    const p = t.getWorldPosition()
    const to = camPos.sub(p)
    const yaw = Math.atan2(to.x, to.z)
    t.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
  }

  private makeLabel(parent: SceneObject, text: string, localPos: vec3, scaleMul = 1): {holder: SceneObject; text: Text} {
    const holder = global.scene.createSceneObject("label")
    holder.setParent(parent)
    holder.getTransform().setLocalPosition(localPos)
    holder.getTransform().setLocalScale(vec3.one().uniformScale(this.labelScale * scaleMul))
    let t: Text = null
    if (this.labelPrefab) {
      const inner = this.labelPrefab.instantiate(holder)
      t = tidyLabel(inner, text)
    }
    return {holder, text: t}
  }

  meshObject(parent: SceneObject, name: string, chunk: MeshChunk, rgba: number[]): {obj: SceneObject; material: Material} {
    const vertexCount = chunk.verts.length / MESH_VERTEX_STRIDE
    if (chunk.verts.length % MESH_VERTEX_STRIDE !== 0) {
      throw new Error(`[Sightlines] ${name}: ${chunk.verts.length} vertex values are not a multiple of ${MESH_VERTEX_STRIDE}`)
    }
    for (const index of chunk.idx) {
      if (index < 0 || index >= vertexCount) {
        throw new Error(`[Sightlines] ${name}: index ${index} is outside ${vertexCount} vertices`)
      }
    }
    const obj = global.scene.createSceneObject(name)
    obj.setParent(parent)
    const builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3},
      {name: "texture0", components: 2}
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    // Keep native calls bounded and end each one on a full vertex.
    for (let start = 0; start < chunk.verts.length; start += MESH_VERTEX_BATCH * MESH_VERTEX_STRIDE) {
      const batch = chunk.verts.slice(start, start + MESH_VERTEX_BATCH * MESH_VERTEX_STRIDE)
      try {
        builder.appendVerticesInterleaved(batch)
      } catch (e) {
        throw new Error(`[Sightlines] ${name}: failed to append ${batch.length / MESH_VERTEX_STRIDE} vertices at offset ${start / MESH_VERTEX_STRIDE} of ${vertexCount}: ${e}`)
      }
    }
    if (builder.getVerticesCount() !== vertexCount) {
      throw new Error(`[Sightlines] ${name}: MeshBuilder received ${builder.getVerticesCount()} of ${vertexCount} vertices`)
    }
    for (let start = 0; start < chunk.idx.length; start += MESH_INDEX_BATCH) {
      builder.appendIndices(chunk.idx.slice(start, start + MESH_INDEX_BATCH))
    }
    if (!builder.isValid()) print(`[Sightlines] mesh ${name} is not valid (${chunk.verts.length / 8} verts)`)
    builder.updateMesh()
    const visual = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = builder.getMesh()
    const material = this.material.clone()
    visual.mainMaterial = material
    this.setColor(material, rgba)
    return {obj, material}
  }

  private setColor(m: Material, rgba: number[]) {
    try {
      m.mainPass.baseColor = new vec4(rgba[0], rgba[1], rgba[2], rgba[3])
    } catch (e) {
      // Material without a Base Color: leave as is.
    }
  }

  get colors() {
    return COLORS
  }
}

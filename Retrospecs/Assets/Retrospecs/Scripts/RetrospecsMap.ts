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
import {PICK_PAD_M, isCenterpiece, labelColorFor, labelScaleFor} from "../Core/Centerpieces"
import {buildLandmarkModel} from "../Core/LandmarkModels"
import {CARDS, cardById} from "../Core/Cards"
import {EN, V3, bearingDeg, bearingToMapDir, distanceM, enToMap, formatDistance, latLonToEN} from "../Core/Geo"
import {
  MeshChunk, MapMeshOptions, arcPoints, buildBuildingOutline, buildDownArrow, buildCampusMesh, buildDisc, buildPathRibbons, buildRing, buildSingleBuilding, buildTube, buildingHeightCm,
  landmarkMapPlacement, vertexCount
} from "../Core/MapMesh"
import {WorldLabel} from "../../Scripts/WorldLabel"
import {FocusTuning, backgroundLook, easeInOut, footprintRadiusM, landmarkLook, stepBlend} from "../Core/Focus"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {ColumnPickCandidate, WorldPickCandidate, XZ, outerRingEN, pickAlongRay, pickOnMap} from "../Core/Pick"

/** The cursor collider's half-size as a multiple of the map radius (see makeCursorTarget). */
const CURSOR_REACH = 1.6

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
  /** Focus mode: parent of `obj` at the footprint centre (floor level), so the body scales about its base. */
  pivot: SceneObject | null
  /** Footprint radius in map cm (before focus scaling). */
  footprintCm: number
  /** Focus blend, linear 0..1 (1 = this is the focused building). */
  focusT: number
  /** Soft ring at the base while focused (created on first focus). */
  halo: SceneObject | null
  haloMaterial: Material | null
  outlineMaterial: Material | null
  /** Real footprint outer ring (EN metres); empty for point landmarks. */
  ringEN: EN[]
  /** Footprint on the map (cm, before focus scaling); empty for point landmarks and edge pins. */
  poly: XZ[]
  /** Roof height (m) for line-of-sight picks. */
  heightM: number
}

interface BackgroundPart {
  obj: SceneObject
  material: Material
  rgba: number[]
  /** Buildings shrink in height; flat things (roads, disc) only dim. */
  scalesY: boolean
}

// Additive display: black is invisible, brightness is opacity.
/** Per-building focus scale (overrides Focus Scale). Main Quad's footprint is huge, so at 1.8x it buried its neighbours. */
const FOCUS_SCALE_FOR: Record<string, number> = {mainquad: 1.15}

const COLORS: Record<string, [number, number, number, number]> = {
  // "Cardinal pop" (toned down), background dim level 4: the campus is a near-wireframe of faint sandstone fills
  // with quiet sand outlines carrying each building's shape. The selected building is solid Stanford cardinal
  // with a soft gold edge, the only saturated, solid thing on the map.
  roofLow: [0.2, 0.18, 0.15, 1],
  roofLowAlt: [0.22, 0.2, 0.16, 1],
  roofMid: [0.2, 0.18, 0.15, 1],
  roofMidAlt: [0.22, 0.2, 0.16, 1],
  roofHigh: [0.22, 0.19, 0.16, 1],
  roofHighAlt: [0.24, 0.21, 0.17, 1],
  // Walls: barely there, so buildings read as glassy volumes.
  wallLow: [0.11, 0.1, 0.08, 1],
  wallLowAlt: [0.11, 0.1, 0.08, 1],
  wallMid: [0.11, 0.1, 0.08, 1],
  wallMidAlt: [0.11, 0.1, 0.08, 1],
  wallHigh: [0.11, 0.1, 0.08, 1],
  wallHighAlt: [0.11, 0.1, 0.08, 1],
  outline: [0.6, 0.55, 0.46, 1], // background roof edges: the wireframe, defined but quiet
  landmarkOutline: [0.82, 0.74, 0.6, 1], // selectable landmarks: a brighter edge marks them as touchable
  landmarkRoof: [0.55, 0.44, 0.36, 1], // modelled landmarks: their roofs and Hoover's dome give the silhouette (they have no outline)
  landmarkTrim: [0.12, 0.11, 0.1, 1], // modelled landmarks: recesses and glass
  // Map disc: translucent grey. On the glasses (additive) it shows as rgb*alpha ≈ 0.06, the same faint earth as the old
  // opaque [0.06, 0.05, 0.04]; in capture/preview, where the lens is composited over the camera by alpha, it is now a
  // light grey veil instead of a solid black sheet. Keep rgb*alpha near 0.06 if you retune it.
  base: [0.3, 0.28, 0.25, 0.2],
  edge: [0.62, 0.55, 0.42, 1], // disc rim: dull sandstone gold
  // Paths lie flat under the buildings, dimmer than roofs.
  road: [0.44, 0.42, 0.38, 1], // roads: grey stone
  bike: [0.42, 0.6, 0.36, 1], // bike paths and lanes: muted sage
  foot: [0.24, 0.23, 0.2, 1], // foot paths: faint
  // Landmark states (body colour). Unselected landmarks stay calm; "focus" is the one that pops.
  dim: [0.34, 0.3, 0.25, 1], // selectable, not yet heard: ghost sandstone (its brighter outline marks it)
  // Centerpieces (Core/Centerpieces.ts) at rest: warmer and brighter than the other landmarks, still not cardinal.
  featureDim: [0.62, 0.48, 0.3, 1],
  featureSeen: [0.66, 0.52, 0.32, 1],
  featureOutline: [1.0, 0.85, 0.52, 1],
  seen: [0.4, 0.34, 0.25, 1], // already heard: slightly warmer ghost
  lit: [0.85, 0.68, 0.36, 1], // lit by an answer: soft gold
  focus: [0.82, 0.23, 0.27, 1], // selected: Stanford cardinal (#D23A44), not neon
  focusEdge: [0.91, 0.75, 0.36, 1], // selected building's outline and halo: soft gold (#E9BE5C)
  pointer: [1.0, 0.8, 0.35, 1], // tutorial arrow: bright gold, same family as the lit target
  hover: [0.25, 0.85, 1.0, 1], // under the cursor, before the pinch: bright cyan, unlike anything else on the map
  you: [0.95, 0.45, 0.5, 1],
  thread: [0.93, 0.74, 0.4, 1],
  guess: [1.0, 0.55, 0.2, 1],
  truth: [0.55, 0.85, 0.5, 1]
}

const MESH_VERTEX_STRIDE = 8
const MESH_VERTEX_BATCH = 512
const MESH_INDEX_BATCH = 3072 // divisible by three, so each call ends on a full triangle

@component
export class RetrospecsMap extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Retrospecs Map</span><br/><span style="color: #94A3B8; font-size: 11px;">Builds the campus from Data/CampusData.ts at runtime.</span>')
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

  @input @hint("Draw recognisable models for key landmarks (Hoover, Memorial Church, Main Quad, Huang...) instead of plain extrusions") useLandmarkModels: boolean = true

  @input @hint("Real-direction beacon label size per cm of distance (0.009 matches the status caption)") sightlineLabelPerCm: number = 0.009

  @ui.group_start("World name tags (real buildings around you)")
  @input @hint("Float name tags over the real buildings around you, and highlight the one you're aiming at") showWorldTags: boolean = true
  @input @hint("How many of the nearest landmarks get a tag") worldTagCount: number = 10
  @input @hint("Only tag landmarks within this distance (m)") worldTagMaxM: number = 500
  @input @hint("Tags farther than this are drawn closer and smaller, so they look the same but stay inside the camera's far plane (m)") worldTagRenderM: number = 30
  @input @hint("Tag size per cm of drawn distance (0.006 = readable, 0.009 = big)") worldTagPerCm: number = 0.006
  @ui.group_end

  @ui.group_start("Focus mode (a selected building)")
  @input @hint("Focused building's scale (1.6-2 reads well)") focusScale: number = 1.8
  @input @hint("Extra lift of the focused building (map cm)") focusLiftCm: number = 1.2
  @input @hint("Height scale of every other building while focused. Smaller, not gone.") backgroundScale: number = 0.35
  @input @hint("Brightness of everything else while focused (additive display: lower = more see-through)") backgroundDim: number = 0.35
  // New input (not saved in the scene yet, so this default applies over the saved Focus Scale / Background Scale).
  @input @hint("ON: the map never moves on selection: the chosen building only changes colour (no growing, lifting or shrinking the rest), so footprints stay where the cursor expects them. OFF: grow / shrink as before.") stationaryFocus: boolean = true
  @input @hint("Stationary focus: brightness of everything else (higher than Background Dim, so neighbours stay easy to aim at)") stationaryDim: number = 0.6
  @input @hint("Seconds to go into focus") focusInSec: number = 0.6
  @input @hint("Seconds to come back out") focusOutSec: number = 0.6
  @input @hint("Soft ring at the focused building's base") showFocusHalo: boolean = true
  @ui.group_end

  root: SceneObject
  worldRoot: SceneObject
  cmPerM = 100 / 600
  center: EN = {e: 0, n: 0}
  landmarks: Record<string, LandmarkView> = {}
  /** Flat SIK target over the disc, so the hand-ray cursor lands on the map (see makeCursorTarget). */
  cursorTarget: Interactable = null
  /** Landmark under the cursor ("" = none): its outline turns gold. */
  hoverId = ""

  private temp: SceneObject[] = []
  /** The "you are here" ring and pillar (map-local; moved by setYouAt). */
  private youMarker: SceneObject = null

  /** Moves the "you are here" ring and pillar to `local` (map cm, y ignored). */
  setYouAt(local: vec3) {
    if (this.youMarker && !isNull(this.youMarker)) this.youMarker.getTransform().setLocalPosition(new vec3(local.x, 0, local.z))
  }
  private worldTemp: SceneObject[] = []
  private camera: SceneObject = null
  private pulseT = 0
  /** Tutorial pointer: a gold arrow bouncing over the building to pick, with a ripple at its base. */
  private pointer: SceneObject = null
  private pointerMat: Material = null
  private pointerRipple: SceneObject = null
  private pointerRippleMat: Material = null
  private pointerId = ""
  private bgParts: BackgroundPart[] = []
  /** Focused landmark id ("" = none) and the background blend, linear 0..1. */
  focusId = ""
  private bgT = 0
  private focusDirty = false

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Builds the map centred on `center` (the wearer's surveyed position, local metres). */
  build(center: EN, camera: SceneObject) {
    this.camera = camera
    this.center = center
    this.cmPerM = 100 / this.scaleDenominator
    // Drop every reference into the old roots before destroying them: threads, sightlines and tags are children, and
    // destroying them again later (clearTemp on the next pick) threw and left every later pick broken.
    this.temp = []
    this.worldTemp = []
    if (this.root && !isNull(this.root)) this.root.destroy()
    if (this.worldRoot && !isNull(this.worldRoot)) this.worldRoot.destroy()
    this.worldTags = {}
    this.worldTagIds = []
    this.pointer = null // a child of the old root, destroyed with it
    this.pointerRipple = null
    this.pointerId = ""
    this.root = global.scene.createSceneObject("RetrospecsMapRoot")
    this.worldRoot = global.scene.createSceneObject("RetrospecsWorldRoot")
    this.landmarks = {}
    this.cursorTarget = null
    this.hoverId = ""
    this.bgParts = []
    this.focusId = ""
    this.bgT = 0
    this.focusDirty = false

    const opts: MapMeshOptions = {...this.meshStyle(), cmPerM: this.cmPerM, verticalExaggeration: this.verticalExaggeration, center, radiusM: this.radiusM, minHeightCm: 0.35}
    const started = getTime()

    // Base disc + glowing edge ring.
    const radiusCm = this.radiusM * this.cmPerM
    this.trackBackground(this.meshObject(this.root, "base", buildDisc(radiusCm + 1.5), COLORS.base), COLORS.base, false)
    this.trackBackground(this.meshObject(this.root, "edge", buildRing(radiusCm + 1.5, 0.6, 128, 0.02), COLORS.edge), COLORS.edge, false)

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
      this.trackBackground(this.meshObject(this.root, `path_${kind}_${i}`, c, COLORS[kind]), COLORS[kind], false)
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
        this.trackBackground(this.meshObject(this.root, `${kind}_${band}_${tone}_${i}`, c, COLORS[key]), COLORS[key], true)
        chunks++
      })))
    }
    draw(campus.roofBands, "roof")
    draw(campus.wallBands, "wall")
    campus.outlines.forEach((c, i) => {
      this.trackBackground(this.meshObject(this.root, "outlines" + i, c, COLORS.outline), COLORS.outline, true)
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

    // "You are here" marker: a small ring plus a short pillar, at the centre until the map is brought over.
    this.youMarker = global.scene.createSceneObject("you_marker")
    this.youMarker.setParent(this.root)
    this.meshObject(this.youMarker, "you_ring", buildRing(2.2, 0.6, 48, 0.05), COLORS.you)
    this.meshObject(this.youMarker, "you_pillar", buildTube([{x: 0, y: 0, z: 0}, {x: 0, y: 6, z: 0}], 0.5), COLORS.you)
    this.makeCursorTarget(radiusCm)

    print(`[Retrospecs] map built in ${(getTime() - started).toFixed(2)} s: ${chunks} chunks, ${verts} background verts, ${Object.keys(this.landmarks).length} landmarks; paths ${pathChunks} chunks, verts road ${pathVerts.road} / bike ${pathVerts.bike} / foot ${pathVerts.foot}`)
  }

  /**
   * One thin box collider over the whole disc (plus the edge pointers just outside it) with an SIK Interactable,
   * so the hand-ray cursor appears on the map and the controller can pick the building under it.
   * Indirect targeting only: a hand near the lifted map must not switch to direct targeting and drop the ray.
   */
  private makeCursorTarget(radiusCm: number) {
    try {
      const o = global.scene.createSceneObject("map_cursor_target")
      o.setParent(this.root)
      o.getTransform().setLocalPosition(new vec3(0, 0.5, 0)) // top face ~1 cm up, near the footprints
      // Well past the rim (edge pointers sit 3 cm outside it): a ray aimed at a tall building near the edge (Hoover's
      // shaft) meets the floor far behind it, and must still land on this so the cursor shows and the pick runs.
      const half = radiusCm * CURSOR_REACH + 9
      const collider = o.createComponent("Physics.ColliderComponent") as ColliderComponent
      collider.fitVisual = false
      const box = Shape.createBoxShape()
      box.size = new vec3(half * 2, 1, half * 2)
      collider.shape = box
      // Collider before Interactable: SIK collects the colliders when the Interactable registers.
      const it = o.createComponent(Interactable.getTypeName()) as Interactable
      it.targetingMode = 2 // TargetingMode.Indirect
      this.cursorTarget = it
      print(`[Retrospecs] cursor target ready: ${Math.round(half * 2)} cm square over the map`)
    } catch (e) {
      print("[Retrospecs] cursor target unavailable: " + e)
    }
  }

  /** Gold outline on the landmark under the cursor; "" clears it. */
  setHover(id: string) {
    const next = id && this.landmarks[id] ? id : ""
    if (next === this.hoverId) return
    const prev = this.landmarks[this.hoverId]
    this.hoverId = next
    if (next) print(`[Retrospecs] cursor on ${next}`)
    // Restore the previous one's body colour, label size and tag; the new one is painted every frame in onUpdate.
    if (prev) {
      this.setState(prev.id, prev.state)
      this.restLabel(prev)
    }
    const l = this.landmarks[next]
    if (l) {
      this.applyOutline(l)
      if (l.label) l.label.getTransform().setLocalScale(vec3.one().uniformScale(this.labelScale * labelScaleFor(l.id) * 1.4))
      if (l.labelText) l.labelText.textFill.color = new vec4(COLORS.hover[0], COLORS.hover[1], COLORS.hover[2], 1)
    }
  }

  private outlineColor(l: LandmarkView, dim: number): number[] {
    if (l.id === this.hoverId && l.state !== "focus") return COLORS.hover
    if (l.state === "focus") return COLORS.focusEdge
    return this.dimmed(isCenterpiece(l.id) ? COLORS.featureOutline : COLORS.landmarkOutline, dim)
  }

  /** Body colour for a state: centerpieces glow warmer at rest ("dim" / "seen"). */
  private bodyColor(id: string, state: LandmarkState): number[] {
    if (isCenterpiece(id) && state === "dim") return COLORS.featureDim
    if (isCenterpiece(id) && state === "seen") return COLORS.featureSeen
    return COLORS[state]
  }

  private restLabel(l: LandmarkView) {
    if (l.label) l.label.getTransform().setLocalScale(vec3.one().uniformScale(this.labelScale * labelScaleFor(l.id)))
    if (l.labelText) {
      const c = labelColorFor(l.id)
      l.labelText.textFill.color = new vec4(c[0], c[1], c[2], 1)
    }
  }

  private applyOutline(l: LandmarkView) {
    if (l.outlineMaterial) this.setColor(l.outlineMaterial, this.outlineColor(l, this.landmarkDim(l)))
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
    let outlineMaterial: Material = null
    let footprintCm = 1.5
    const opts: MapMeshOptions = {...this.meshStyle(), cmPerM: this.cmPerM, verticalExaggeration: this.verticalExaggeration, center: this.center, radiusM: 1e9, minHeightCm: 0.5}
    // Recognisable procedural model (Hoover, MemChu, Main Quad, Huang, ...) where one exists; else the extrusion.
    const model = !offMap && baked && this.useLandmarkModels ? buildLandmarkModel(id, baked.building >= 0 ? BUILDINGS[baked.building] : null, {x: map.x, z: map.z}, opts) : null
    if (offMap) {
      // Pinned marker is built below.
    } else if (model) {
      const r = this.meshObject(this.root, "lm_" + id, model.body, this.bodyColor(id, "dim"))
      obj = r.obj
      material = r.material
      if (model.accent && model.accent.idx.length) this.meshObject(r.obj, "lm_" + id + "_roof", model.accent, COLORS.landmarkRoof)
      if (model.trim && model.trim.idx.length) this.meshObject(r.obj, "lm_" + id + "_trim", model.trim, COLORS.landmarkTrim)
      topCm = model.topCm
      footprintCm = baked.building >= 0 ? Math.max(0.8, footprintRadiusM(BUILDINGS[baked.building][3], baked.east, baked.north) * this.cmPerM) : 30 * this.cmPerM
    } else if (baked && baked.building >= 0) {
      const b = BUILDINGS[baked.building]
      topCm = buildingHeightCm(b, opts)
      footprintCm = Math.max(0.8, footprintRadiusM(b[3], baked.east, baked.north) * this.cmPerM)
      const r = this.meshObject(this.root, "lm_" + id, buildSingleBuilding(b, opts), this.bodyColor(id, "dim"))
      obj = r.obj
      material = r.material
      // A slightly wider outline than the background so landmarks stand out. Own object and material, so
      // setState() recolours only the body.
      const edge = buildBuildingOutline(b, {...opts, outlineWidthCm: opts.outlineWidthCm * 1.25})
      if (edge.idx.length) {
        const e = this.meshObject(r.obj, "lm_" + id + "_edge", edge, COLORS.landmarkOutline)
        outline = e.obj
        outlineMaterial = e.material
      }
    } else if (baked) {
      // Point landmark (Memorial Church): a small glowing post.
      topCm = Math.max(2, baked.heightM * this.cmPerM * this.verticalExaggeration)
      const r = this.meshObject(this.root, "lm_" + id, buildTube([{x: map.x, y: 0, z: map.z}, {x: map.x, y: topCm, z: map.z}], 1.2), this.bodyColor(id, "dim"))
      obj = r.obj
      material = r.material
    }
    const placed = map
    if (offMap) {
      // Pinned to the map edge in its true direction (placement computed above).
      const m = this.meshObject(this.root, "lm_" + id, buildTube([{x: placed.x, y: 0, z: placed.z}, {x: placed.x, y: 5, z: placed.z}], 1.0), this.bodyColor(id, "dim"))
      obj = m.obj
      material = m.material
      topCm = 5
    }
    // Focus pivot at the footprint centre on the floor; the body keeps its placement under it, so it scales
    // about its own base.
    let pivot: SceneObject = null
    if (obj) {
      pivot = global.scene.createSceneObject("lm_pivot_" + id)
      pivot.setParent(this.root)
      pivot.getTransform().setLocalPosition(new vec3(placed.x, 0, placed.z))
      obj.setParent(pivot)
      obj.getTransform().setLocalPosition(new vec3(-placed.x, 0, -placed.z))
    }
    const label = this.makeLabel(this.root, card ? card.label : id, new vec3(placed.x, topCm + 2.5, placed.z), labelScaleFor(id))
    if (label.text) {
      const c = labelColorFor(id)
      label.text.textFill.color = new vec4(c[0], c[1], c[2], 1)
    }
    const b = baked && baked.building >= 0 ? BUILDINGS[baked.building] : null
    const ringEN = b ? outerRingEN(b[3], b[4]) : []
    const poly = ringEN.length && !offMap ? ringEN.map((v) => ({x: (v.e - this.center.e) * this.cmPerM, z: -(v.n - this.center.n) * this.cmPerM})) : []
    const heightM = b ? b[0] : baked ? baked.heightM : 10
    return {
      id, en, map: placed, topCm, obj, material, outline, label: label.holder, labelText: label.text, state: "dim", offMap,
      pivot, footprintCm, focusT: 0, halo: null, haloMaterial: null, outlineMaterial, ringEN, poly, heightM
    }
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
    if (l.material) this.setColor(l.material, this.dimmed(this.bodyColor(id, state), this.landmarkDim(l)))
    this.applyOutline(l)
  }

  // -------------------------------------------------------------------------
  // Focus mode: the selected building grows and lifts; everything else shrinks in height and dims.

  /** Starts the smooth move into focus on `id`, or back out with null or "". Safe to call repeatedly. */
  setFocus(id: string | null) {
    const next = id && this.landmarks[id] ? id : ""
    if (next === this.focusId) return
    this.focusId = next
    this.focusDirty = true
  }

  /** True while any part of the map is still moving into or out of focus. */
  isFocusAnimating(): boolean {
    return this.focusDirty
  }

  /** Focused building's footprint radius at full focus, map cm. Use it to keep extras off the grown building. */
  focusClearanceCm(id: string): number {
    const l = this.landmarks[id]
    return l ? l.footprintCm * Math.max(1, this.tuning(id).focusScale) : 0
  }

  /**
   * World-space frame of a landmark at FULL focus, so layouts are stable from the first frame of the
   * transition: footprint centre on the map surface, top of the grown building, grown footprint radius (world cm).
   */
  focusFrame(id: string): {base: vec3; top: vec3; radiusWorldCm: number} | null {
    const l = this.landmarks[id]
    if (!l || !this.root) return null
    const t = this.root.getTransform()
    const w = t.getWorldTransform()
    const tune = this.tuning(id)
    const top = l.topCm * tune.focusScale + tune.focusLiftCm
    return {
      base: w.multiplyPoint(new vec3(l.map.x, 0, l.map.z)),
      top: w.multiplyPoint(new vec3(l.map.x, top, l.map.z)),
      radiusWorldCm: l.footprintCm * tune.focusScale * Math.abs(t.getWorldScale().x)
    }
  }

  /** Focus tuning; with `id`, that building's own focus scale (FOCUS_SCALE_FOR: Main Quad grows much less). */
  private tuning(id?: string): FocusTuning {
    if (this.stationaryFocus) {
      return {focusScale: 1, focusLiftCm: 0, backgroundScale: 1, backgroundDim: Math.max(0, Math.min(1, this.stationaryDim))}
    }
    const own = id && FOCUS_SCALE_FOR[id] > 0 ? FOCUS_SCALE_FOR[id] : this.focusScale
    return {
      focusScale: Math.max(0.1, own),
      focusLiftCm: this.focusLiftCm,
      backgroundScale: Math.max(0.02, Math.min(1, this.backgroundScale)),
      backgroundDim: Math.max(0, Math.min(1, this.backgroundDim))
    }
  }

  private trackBackground(r: {obj: SceneObject; material: Material}, rgba: number[], scalesY: boolean) {
    this.bgParts.push({obj: r.obj, material: r.material, rgba, scalesY})
  }

  private landmarkDim(l: LandmarkView): number {
    return landmarkLook(easeInOut(this.bgT), easeInOut(l.focusT), this.tuning(l.id)).dim
  }

  private dimmed(rgba: number[], k: number): number[] {
    return k >= 1 ? rgba : [rgba[0] * k, rgba[1] * k, rgba[2] * k, rgba[3]]
  }

  /** Advances the focus blends and applies them. Touches only transforms and material colours, never meshes. */
  private updateFocus(dt: number) {
    if (!this.focusDirty) return
    const tune = this.tuning()
    const bgTarget = this.focusId ? 1 : 0
    this.bgT = stepBlend(this.bgT, bgTarget, dt, bgTarget > this.bgT ? this.focusInSec : this.focusOutSec)
    let moving = this.bgT !== bgTarget
    const bg = easeInOut(this.bgT)

    const back = backgroundLook(bg, tune)
    for (const p of this.bgParts) {
      if (p.scalesY) p.obj.getTransform().setLocalScale(new vec3(1, back.scaleY, 1))
      this.setColor(p.material, this.dimmed(p.rgba, back.dim))
    }

    for (const id of Object.keys(this.landmarks)) {
      const l = this.landmarks[id]
      const target = id === this.focusId ? 1 : 0
      l.focusT = stepBlend(l.focusT, target, dt, target > l.focusT ? this.focusInSec : this.focusOutSec)
      if (l.focusT !== target) moving = true
      const fb = easeInOut(l.focusT)
      const look = landmarkLook(bg, fb, this.tuning(id))
      if (l.pivot) {
        const pt = l.pivot.getTransform()
        pt.setLocalScale(new vec3(look.scaleXZ, look.scaleY, look.scaleXZ))
        pt.setLocalPosition(new vec3(l.map.x, look.liftCm, l.map.z))
      }
      // The pulse in onUpdate owns the colour of a landmark in the "focus" state.
      if (l.material && l.state !== "focus") this.setColor(l.material, this.dimmed(this.bodyColor(id, l.state), look.dim))
      if (l.outlineMaterial) this.setColor(l.outlineMaterial, this.outlineColor(l, look.dim))
      if (l.label) {
        l.label.getTransform().setLocalPosition(new vec3(l.map.x, l.topCm * look.scaleY + look.liftCm + 2.5, l.map.z))
        // The info panel carries the focused building's name, so its small map label steps aside.
        l.label.enabled = fb < 0.5
        if (l.labelText) this.setTextBrightness(l.labelText, look.dim, labelColorFor(id))
      }
      this.updateHalo(l, fb)
    }
    if (!moving) this.focusDirty = false
  }

  private updateHalo(l: LandmarkView, fb: number) {
    if (!this.showFocusHalo || !l.pivot) return
    if (fb <= 0.001) {
      if (l.halo) l.halo.enabled = false
      return
    }
    if (!l.halo) {
      // Unit ring, scaled to the grown footprint below.
      const r = this.meshObject(this.root, "lm_halo_" + l.id, buildRing(1, 0.12, 64, 0.06), COLORS.focusEdge)
      l.halo = r.obj
      l.haloMaterial = r.material
      l.halo.getTransform().setLocalPosition(new vec3(l.map.x, 0, l.map.z))
    }
    l.halo.enabled = true
    const radius = (l.footprintCm * this.tuning(l.id).focusScale + 1.2) * Math.max(0.05, fb)
    l.halo.getTransform().setLocalScale(new vec3(radius, 1, radius))
    if (l.haloMaterial) this.setColor(l.haloMaterial, this.dimmed(COLORS.focusEdge, 0.8 * fb))
  }

  private setTextBrightness(t: Text, k: number, rgb: number[] = [1, 1, 1]) {
    try {
      t.textFill.color = new vec4(rgb[0] * k, rgb[1] * k, rgb[2] * k, 1)
    } catch (e) {
      // Text without a fill: leave as is.
    }
  }

  /** Returns every landmark that is `lit` or `focus` to `seen` (or `dim` if never seen). */
  resetLights(seen: string[]) {
    this.setPointer("")
    for (const id of Object.keys(this.landmarks)) this.setState(id, seen.indexOf(id) >= 0 ? "seen" : "dim")
    this.clearTemp()
  }

  /** Bouncing arrow pointing down at landmark `id` (the tutorial's target); "" hides it. */
  setPointer(id: string) {
    const next = id && this.landmarks[id] && this.root ? id : ""
    this.pointerId = next
    if (!next) {
      if (this.pointer && !isNull(this.pointer)) this.pointer.enabled = false
      if (this.pointerRipple && !isNull(this.pointerRipple)) this.pointerRipple.enabled = false
      return
    }
    if (!this.pointer || isNull(this.pointer)) {
      const a = this.meshObject(this.root, "tutorial_arrow", buildDownArrow(1.7, 2.8, 0.6, 3.6), COLORS.pointer)
      this.pointer = a.obj
      this.pointerMat = a.material
      const r = this.meshObject(this.root, "tutorial_ripple", buildRing(1, 0.18, 64, 0.08), COLORS.pointer)
      this.pointerRipple = r.obj
      this.pointerRippleMat = r.material
    }
    const l = this.landmarks[next]
    this.pointer.enabled = true
    this.pointerRipple.enabled = true
    this.pointerRipple.getTransform().setLocalPosition(new vec3(l.map.x, 0, l.map.z))
    this.pointerT = 0
    print(`[Retrospecs] tutorial arrow on ${next}`)
  }

  private pointerT = 0

  /** Bounce: drops onto the target, squashes a little on landing, springs back up. A ripple spreads from the base each landing. */
  private updatePointer(dt: number) {
    const l = this.pointerId ? this.landmarks[this.pointerId] : null
    if (!l || !this.pointer || isNull(this.pointer)) return
    this.pointerT += dt
    const period = 1.1
    const u = (this.pointerT % period) / period
    const hop = Math.abs(Math.sin(Math.PI * u)) // 0 at the landing, 1 at the top
    const squash = Math.max(0, 1 - hop * 6) // short squash right at the landing
    const look = landmarkLook(easeInOut(this.bgT), easeInOut(l.focusT), this.tuning(l.id))
    const baseY = l.topCm * look.scaleY + look.liftCm + 6.5
    const t = this.pointer.getTransform()
    t.setLocalPosition(new vec3(l.map.x, baseY + 3.2 * hop, l.map.z))
    t.setLocalScale(new vec3(1 + 0.18 * squash, 1 - 0.22 * squash, 1 + 0.18 * squash))
    t.setLocalRotation(quat.fromEulerAngles(0, this.pointerT * 1.6, 0))
    if (this.pointerMat) this.setColor(this.pointerMat, this.dimmed(COLORS.pointer, 0.85 + 0.15 * hop))
    // Ripple: grows from the footprint outward and fades over one bounce.
    if (this.pointerRipple && !isNull(this.pointerRipple)) {
      const r = Math.max(1.5, l.footprintCm) * (0.9 + 1.4 * u)
      this.pointerRipple.getTransform().setLocalScale(new vec3(r, 1, r))
      if (this.pointerRippleMat) this.setColor(this.pointerRippleMat, this.dimmed(COLORS.pointer, 0.9 * (1 - u)))
    }
  }

  clearTemp() {
    for (const o of this.temp) if (o && !isNull(o)) o.destroy()
    this.temp = []
    for (const o of this.worldTemp) if (o && !isNull(o)) o.destroy()
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

  /**
   * Landmark under the cursor at a map-local point (cm): the one whose footprint the point falls in or nearest to,
   * with `slackCm` of grace beyond the footprint edge so small buildings are still easy to hit. `only` (the locked
   * demo's target) tests that one footprint alone, so a neighbour can never win the pick.
   */
  pickUnderCursor(local: vec3, slackCm = 2, eyeLocal?: vec3, only = ""): string | null {
    const all = this.mapPickCandidates()
    const cands = only ? all.filter((c) => c.id === only) : all
    if (eyeLocal) return pickAlongRay(eyeLocal, local, cands, slackCm)
    return pickOnMap({x: local.x, z: local.z}, cands, slackCm)
  }

  /** Landmark at a map-local point (cm), within `maxCm` of its footprint; through the buildings' heights with `eyeLocal`. */
  pickAtMapPoint(local: vec3, maxCm = 4, eyeLocal?: vec3): string | null {
    if (eyeLocal) return pickAlongRay(eyeLocal, local, this.mapPickCandidates(), maxCm)
    return pickOnMap({x: local.x, z: local.z}, this.mapPickCandidates(), maxCm)
  }

  /**
   * Footprints for picking. Real outlines, so a point on Hoover never lands on the Main Quad's big bounding circle.
   * Point landmarks and edge pins are small discs.
   */
  private mapPickCandidates(): ColumnPickCandidate[] {
    const bg = easeInOut(this.bgT)
    return Object.keys(this.landmarks).map((id) => {
      const l = this.landmarks[id]
      // The focused building grows about its base, so its outline grows with it (scaled, not a bounding circle).
      const k = id === this.focusId ? Math.max(1, this.tuning(id).focusScale) : 1
      const poly = k === 1 ? l.poly : l.poly.map((v) => ({x: l.map.x + (v.x - l.map.x) * k, z: l.map.z + (v.z - l.map.z) * k}))
      // Hard-to-hit landmarks (Hoover's footprint is tiny next to the Quad) get a disc of PICK_PAD_M around them.
      const pad = PICK_PAD_M[id] > 0 ? PICK_PAD_M[id] * this.cmPerM * k : 0
      // Current height (grown when focused, shrunk while another building is), for picks along the ray.
      const look = landmarkLook(bg, easeInOut(l.focusT), this.tuning(id))
      const topCm = l.topCm * look.scaleY + look.liftCm
      return {id, center: {x: l.map.x, z: l.map.z}, poly, radius: poly.length ? pad : Math.max(1.5 * k, pad), priority: isCenterpiece(id), topCm}
    })
  }

  /** Real-world footprints, for "which building am I looking at" picks out in the world. */
  worldPickCandidates(): WorldPickCandidate[] {
    return Object.keys(this.landmarks).map((id) => {
      const l = this.landmarks[id]
      return {id, en: l.en, ring: l.ringEN, radiusM: 8, heightM: l.heightM, padM: PICK_PAD_M[id] || 0}
    })
  }

  // -------------------------------------------------------------------------

  private onUpdate() {
    if (!this.root || !this.camera) return
    this.pulseT += getDeltaTime()
    this.updateFocus(getDeltaTime())
    this.updatePointer(getDeltaTime())
    const camPos = this.camera.getTransform().getWorldPosition()
    // Billboard labels (yaw only) and pulse the focused landmark.
    for (const id of Object.keys(this.landmarks)) {
      const l = this.landmarks[id]
      if (l.label) this.faceCamera(l.label, camPos)
      if (l.state === "focus" && l.material) {
        const k = 0.9 + 0.1 * Math.sin(this.pulseT * 4) // gentle breathing, never washes out to white
        this.setColor(l.material, [COLORS.focus[0] * k, COLORS.focus[1] * k, COLORS.focus[2] * k, 1])
      }
    }
    // Hovered (aimed at, not yet pinched): pulsing cyan body, so it's obvious what a pinch will pick.
    const h = this.hoverId ? this.landmarks[this.hoverId] : null
    if (h && h.material && h.state !== "focus") {
      const k = 0.8 + 0.2 * Math.sin(this.pulseT * 6)
      this.setColor(h.material, [COLORS.hover[0] * k, COLORS.hover[1] * k, COLORS.hover[2] * k, 1])
    }
    for (const o of this.worldTemp) if (o.name.indexOf("label") === 0) this.faceCamera(o, camPos)
    this.updateWorldTags(camPos)
    // Gentle breathing glow on the focus halo once it has settled.
    const f = this.focusId ? this.landmarks[this.focusId] : null
    if (f && f.haloMaterial && f.halo && f.halo.enabled && !this.focusDirty) {
      this.setColor(f.haloMaterial, this.dimmed(COLORS.focusEdge, 0.7 + 0.2 * Math.sin(this.pulseT * 3)))
    }
  }

  // -------------------------------------------------------------------------
  // World name tags: the nearest landmarks get a floating name over the real building, re-projected from where
  // the wearer is now (worldRoot is pinned at map.center by the controller). Far ones are drawn closer and smaller
  // about the eye, which looks identical but stays inside the far plane. The hovered one turns cyan and grows.

  private worldTags: Record<string, {holder: SceneObject; text: Text; look?: string}> = {}
  private worldTagT = 0
  private worldTagIds: string[] = []

  private updateWorldTags(camPos: vec3) {
    if (!this.showWorldTags || !this.worldRoot || !this.labelPrefab) return
    const w = this.worldRoot.getTransform()
    const eye = w.getInvertedWorldTransform().multiplyPoint(camPos) // wearer, in the real-world frame (cm)
    // Re-choose which landmarks are tagged a few times a second (nearest N within range, plus the hovered one).
    this.worldTagT -= getDeltaTime()
    if (this.worldTagT <= 0) {
      this.worldTagT = 0.5
      const here = {e: this.center.e + eye.x / 100, n: this.center.n - eye.z / 100}
      const ids = Object.keys(this.landmarks)
        .map((id) => ({id, d: distanceM(here, this.landmarks[id].en)}))
        .filter((x) => x.d > 12 && x.d < this.worldTagMaxM)
        .sort((a, b) => a.d - b.d)
        .slice(0, Math.max(0, this.worldTagCount))
        .map((x) => x.id)
      if (this.hoverId && ids.indexOf(this.hoverId) < 0) ids.push(this.hoverId)
      for (const id of Object.keys(this.worldTags)) {
        if (ids.indexOf(id) < 0) {
          this.worldTags[id].holder.destroy()
          delete this.worldTags[id]
        }
      }
      for (const id of ids) {
        if (this.worldTags[id]) continue
        const card = cardById(id)
        this.worldTags[id] = this.makeLabel(this.worldRoot, card ? card.label : id, vec3.zero())
      }
      this.worldTagIds = ids
    }
    for (const id of this.worldTagIds) {
      const tag = this.worldTags[id]
      const l = this.landmarks[id]
      if (!tag || !l) continue
      // Real top of the building (+3 m), relative to the wearer's eye.
      const bx = (l.en.e - this.center.e) * 100
      const bz = -(l.en.n - this.center.n) * 100
      const by = (l.heightM + 3) * 100
      const v = new vec3(bx - eye.x, by - eye.y, bz - eye.z)
      const d = v.length
      if (d < 1) continue
      const k = Math.min(1, (this.worldTagRenderM * 100) / d)
      const pos = eye.add(v.uniformScale(k))
      const drawn = d * k
      const hovered = id === this.hoverId
      const t = tag.holder.getTransform()
      t.setLocalPosition(pos)
      t.setLocalScale(vec3.one().uniformScale(drawn * this.worldTagPerCm * (hovered ? 1.6 : 1)))
      this.faceCamera(tag.holder, camPos)
      const look = hovered ? "hover" : l.state === "focus" ? "focus" : "plain"
      if (tag.text && tag.look !== look) {
        tag.look = look
        const c = hovered ? COLORS.hover : l.state === "focus" ? COLORS.focusEdge : labelColorFor(id)
        tag.text.textFill.color = new vec4(c[0], c[1], c[2], 1)
        tag.text.text = (cardById(id) ? cardById(id).label : id) + (hovered ? "  · pinch" : "")
      }
    }
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
      throw new Error(`[Retrospecs] ${name}: ${chunk.verts.length} vertex values are not a multiple of ${MESH_VERTEX_STRIDE}`)
    }
    for (const index of chunk.idx) {
      if (index < 0 || index >= vertexCount) {
        throw new Error(`[Retrospecs] ${name}: index ${index} is outside ${vertexCount} vertices`)
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
        throw new Error(`[Retrospecs] ${name}: failed to append ${batch.length / MESH_VERTEX_STRIDE} vertices at offset ${start / MESH_VERTEX_STRIDE} of ${vertexCount}: ${e}`)
      }
    }
    if (builder.getVerticesCount() !== vertexCount) {
      throw new Error(`[Retrospecs] ${name}: MeshBuilder received ${builder.getVerticesCount()} of ${vertexCount} vertices`)
    }
    for (let start = 0; start < chunk.idx.length; start += MESH_INDEX_BATCH) {
      builder.appendIndices(chunk.idx.slice(start, start + MESH_INDEX_BATCH))
    }
    if (!builder.isValid()) print(`[Retrospecs] mesh ${name} is not valid (${chunk.verts.length / 8} verts)`)
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

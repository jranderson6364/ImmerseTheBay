/**
 * Real-world building overlay: when the locator says the wearer is looking at a real Stanford building, float a
 * life-size glowing nametag over it and trace its footprint and roofline at real scale.
 *
 * Geometry goes under SightlinesMap.worldRoot (the same frame drawSightline uses: X = east, Y = up, Z = -north, cm,
 * wearer's surveyed position at the origin, floor at Y = 0), here at 1 m = 100 cm. Buildings further than
 * `maxRenderM` are drawn scaled about the wearer's eye by renderDistance / realDistance, which looks identical from
 * where the wearer stands but stays inside the camera's far plane.
 */
import {EN} from "../Core/Geo"
import {MeshChunk, buildTube} from "../Core/MapMesh"
import {
  LocatorResult, NametagPlacement, OverlayStyle, footprintOutline, nametagPlacement, overlayAnimation, overlayBuildingFor, overlayStyle, scanRing, tagText
} from "../Core/Overlay"
import {WorldLabel} from "../../Scripts/WorldLabel"

/** What showBuilding returns, so callers (e.g. a money pile) can place things next to the tag. */
export interface OverlayTagInfo {
  id: string
  /** World-space centre of the nametag. */
  tagWorldPos: vec3
  /** World-space point just to the right of the tag (as the wearer sees it), at tag height. */
  besideWorldPos: vec3
  /** World-space ground point directly under the drawn tag. */
  groundWorldPos: vec3
  /** World-space ground point under besideWorldPos (a floor anchor for a pile next to the tag). */
  besideGroundWorldPos: vec3
  /** The tag's uniform scale (a size hint for things placed next to it). */
  scale: number
  placement: NametagPlacement
  style: OverlayStyle
}

interface Tag {
  id: string
  /** Everything for this building; destroying it removes the tag. */
  root: SceneObject
  /** Yaw-billboarded label holder. */
  labelHolder: SceneObject
  /** Outline materials (pulse) with their base colour. */
  materials: {m: Material; rgba: number[]}[]
  scan: SceneObject | null
  scanMaterial: Material | null
  /** Scan height in the scan object's parent units (cm, real scale). */
  heightCm: number
  t: number
}

const MESH_VERTEX_STRIDE = 8
const MESH_VERTEX_BATCH = 512
const MESH_INDEX_BATCH = 3072 // divisible by three, so each call ends on a full triangle
const TITLE_RGBA = [1, 1, 1, 1]
const SCAN_RGBA = [0.85, 1.0, 1.0, 1]

@component
export class SightlinesOverlay extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Sightlines Overlay</span><br/><span style="color: #94A3B8; font-size: 11px;">Life-size nametag and outline on the real building you look at.</span>')
  @input
  @hint("Any material with a Base Color (e.g. Assets/Materials/White.mat). It is cloned per object.")
  material: Material

  @input
  @hint("Assets/Prefabs/WorldLabel.prefab")
  labelPrefab: ObjectPrefab

  @input
  @hint("The scene's Camera object")
  camera: SceneObject

  @input
  @hint("Height in cm of one WorldLabel title line at scale 1. Check in Preview and adjust so a tag at 20 m reads about 2.5 degrees tall.")
  labelHeightCm: number = 2

  @input
  @hint("Target angular height of the title, degrees (clamped to 2-3)")
  targetAngleDeg: number = 2.5

  @input
  @hint("Tags and outlines further than this are pulled in along the true bearing (metres)")
  maxRenderM: number = 60

  @input
  @hint("Maximum tags shown at once; the oldest is removed")
  maxTags: number = 3

  @input
  @hint("Scanline sweep duration, seconds")
  sweepSeconds: number = 1

  @input
  @hint("Raise the camera far plane at runtime if it is too short to show tags at maxRenderM")
  extendCameraFar: boolean = true

  /** Wearer's surveyed position (local metres). Set it from SightlinesMap.center, or pass it to showBuilding. */
  center: EN = {e: 0, n: 0}

  private tags: Tag[] = []
  private farChecked = false

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  setCenter(center: EN) {
    this.center = center
  }

  /**
   * Shows (or replaces) the overlay for one locator result. `worldRoot` is SightlinesMap.worldRoot; `center` is
   * SightlinesMap.center (defaults to the last one set). Returns null if worldRoot is missing.
   */
  showBuilding(result: LocatorResult, worldRoot: SceneObject, center?: EN): OverlayTagInfo | null {
    if (!result || !worldRoot || isNull(worldRoot)) return null
    if (center) this.center = center
    this.ensureFar()
    this.hide(result.id)
    while (this.tags.length >= Math.max(1, this.maxTags)) this.removeTag(this.tags[0])

    const rootT = worldRoot.getTransform()
    const inv = rootT.getInvertedWorldTransform()
    const wp = new vec3(result.worldPos.x, result.worldPos.y, result.worldPos.z)
    const local = inv.multiplyPoint(wp)
    const camWorld = this.camera ? this.camera.getTransform().getWorldPosition() : rootT.getWorldPosition().add(new vec3(0, 160, 0))
    const eye = inv.multiplyPoint(camWorld)
    const eyeHeightM = eye.y > 50 && eye.y < 250 ? eye.y / 100 : 1.6

    // Horizontal direction and distance from the eye, in the worldRoot frame. worldPos.y is ignored (unknown height).
    let dx = local.x - eye.x
    let dz = local.z - eye.z
    let geomM = Math.hypot(dx, dz) / 100
    if (geomM < 0.5) {
      // Degenerate position: fall back to the camera's forward and the stated distance.
      // Horizontal view direction, as SightlinesController.viewHorizontal computes it.
      const f = this.camera ? inv.multiplyDirection(vec3.up().cross(this.camera.getTransform().right)) : new vec3(0, 0, -1)
      dx = f.x
      dz = f.z
      geomM = Math.max(2, result.distanceM || 20)
    }
    const hl = Math.hypot(dx, dz) || 1
    const dir = {x: dx / hl, z: dz / hl}

    const found = overlayBuildingFor(result.id, result.name)
    if (!found.building && !found.landmark && result.heightM > 0) found.heightM = result.heightM
    const style = overlayStyle(result.source, result.confidence)
    const place = nametagPlacement(geomM, found.heightM, {
      maxRenderM: this.maxRenderM, targetDeg: this.targetAngleDeg, labelHeightCmAtScale1: this.labelHeightCm, eyeHeightM
    })

    const root = global.scene.createSceneObject("overlay_" + result.id)
    root.setParent(worldRoot)
    const tag: Tag = {id: result.id, root, labelHolder: null, materials: [], scan: null, scanMaterial: null, heightCm: 0, t: 0}

    // Outline, scaled about the eye by k (k = 1 when not clamped).
    const k = place.k
    const renderedWidthCm = Math.max(6, place.renderDistanceM * 100 * 0.0025)
    if (found.building) {
      const pivot = global.scene.createSceneObject("overlay_pivot")
      pivot.setParent(root)
      pivot.getTransform().setLocalPosition(eye)
      pivot.getTransform().setLocalScale(vec3.one().uniformScale(k))
      const body = global.scene.createSceneObject("overlay_body")
      body.setParent(pivot)
      body.getTransform().setLocalPosition(eye.uniformScale(-1))
      const fo = footprintOutline(found.building, this.center, 100, {widthCm: renderedWidthCm / k, dashed: style.dashed})
      const drift = Math.hypot(fo.centroid.x - local.x, fo.centroid.z - local.z) / 100
      if (drift > 15) print(`[Sightlines] overlay ${result.id}: footprint centre is ${drift.toFixed(0)} m from the locator worldPos; check that worldRoot and the locator share a frame`)
      const parts: [string, MeshChunk[]][] = [["ground", fo.ground], ["roof", fo.roof], ["posts", fo.posts]]
      for (const [name, chunks] of parts) {
        chunks.forEach((c, i) => {
          const r = this.meshObject(body, `overlay_${name}${i}`, c, [0, 0, 0, 1])
          tag.materials.push({m: r.material, rgba: style.color})
        })
      }
      const scanChunks = scanRing(fo.rings, (renderedWidthCm * 1.6) / k)
      if (scanChunks.length) {
        const scan = global.scene.createSceneObject("overlay_scan")
        scan.setParent(body)
        scanChunks.forEach((c, i) => {
          const r = this.meshObject(scan, "overlay_scan" + i, c, SCAN_RGBA)
          tag.scanMaterial = r.material
        })
        tag.scan = scan
        tag.heightCm = fo.heightCm
      }
    }

    // Nametag, at the render distance along the true bearing.
    const tagLocal = new vec3(eye.x + dir.x * place.renderDistanceM * 100, place.heightM * 100, eye.z + dir.z * place.renderDistanceM * 100)
    const holder = global.scene.createSceneObject("label_overlay")
    holder.setParent(root)
    holder.getTransform().setLocalPosition(tagLocal)
    holder.getTransform().setLocalScale(vec3.one().uniformScale(place.scale))
    tag.labelHolder = holder
    const text = tagText(result.id, result.name, result.distanceM)
    const u = this.labelHeightCm
    this.makeLabel(holder, text.title, new vec3(0, 0, 0), 1, TITLE_RGBA)
    this.makeLabel(holder, text.subtitle, new vec3(0, -1.15 * u, 0), 0.55, style.color)
    this.makeLabel(holder, style.badge, new vec3(0, -1.9 * u, 0), 0.45, style.badgeColor)

    // Leader line from just under the tag down to the (scaled) roof line.
    const roofY = (eyeHeightM * 100 + (found.heightM * 100 - eyeHeightM * 100) * k)
    const tagBottom = tagLocal.y - place.textHeightCm * 1.6
    if (tagBottom - roofY > renderedWidthCm * 2) {
      const lead = this.meshObject(root, "overlay_leader", buildTube([{x: tagLocal.x, y: tagBottom, z: tagLocal.z}, {x: tagLocal.x, y: roofY, z: tagLocal.z}], renderedWidthCm * 0.6), [0, 0, 0, 1])
      tag.materials.push({m: lead.material, rgba: style.color})
    }

    this.tags.push(tag)
    this.onUpdateTag(tag, 0)

    const toWorld = rootT.getWorldTransform()
    const right = {x: -dir.z, z: dir.x}
    const besideCm = place.textHeightCm * 4
    return {
      id: result.id,
      tagWorldPos: toWorld.multiplyPoint(tagLocal),
      besideWorldPos: toWorld.multiplyPoint(new vec3(tagLocal.x + right.x * besideCm, tagLocal.y, tagLocal.z + right.z * besideCm)),
      groundWorldPos: toWorld.multiplyPoint(new vec3(tagLocal.x, 0, tagLocal.z)),
      besideGroundWorldPos: toWorld.multiplyPoint(new vec3(tagLocal.x + right.x * besideCm, 0, tagLocal.z + right.z * besideCm)),
      scale: place.scale,
      placement: place,
      style
    }
  }

  /** Removes one building's overlay, or all of them when `id` is omitted. */
  hide(id?: string) {
    for (const t of this.tags.slice()) if (id === undefined || t.id === id) this.removeTag(t)
  }

  get shownIds(): string[] {
    return this.tags.map((t) => t.id)
  }

  // -------------------------------------------------------------------------

  private removeTag(t: Tag) {
    const i = this.tags.indexOf(t)
    if (i >= 0) this.tags.splice(i, 1)
    if (t.root && !isNull(t.root)) t.root.destroy()
  }

  private ensureFar() {
    if (this.farChecked || !this.extendCameraFar || !this.camera) return
    this.farChecked = true
    const cam = this.camera.getComponent("Component.Camera") as Camera
    if (!cam) return
    const want = (this.maxRenderM + 20) * 100
    if (cam.far < want) {
      print(`[Sightlines] overlay: camera far plane ${cam.far} cm -> ${want} cm so real-world tags render`)
      cam.far = want
    }
  }

  private onUpdate() {
    if (!this.tags.length) return
    const dt = getDeltaTime()
    for (const t of this.tags.slice()) {
      // worldRoot is rebuilt on recalibration, which destroys our objects with it.
      if (!t.root || isNull(t.root)) {
        this.tags.splice(this.tags.indexOf(t), 1)
        continue
      }
      this.onUpdateTag(t, dt)
    }
  }

  private onUpdateTag(t: Tag, dt: number) {
    t.t += dt
    const a = overlayAnimation(t.t, this.sweepSeconds)
    for (const {m, rgba} of t.materials) this.setColor(m, [rgba[0] * a.brightness, rgba[1] * a.brightness, rgba[2] * a.brightness, 1])
    if (t.scan && !isNull(t.scan)) {
      if (a.scan < 0) {
        t.scan.enabled = false
      } else {
        t.scan.getTransform().setLocalPosition(new vec3(0, a.scan * t.heightCm, 0))
        if (t.scanMaterial) {
          const f = 1 - 0.4 * a.scan
          this.setColor(t.scanMaterial, [SCAN_RGBA[0] * f, SCAN_RGBA[1] * f, SCAN_RGBA[2] * f, 1])
        }
      }
    }
    if (this.camera && t.labelHolder && !isNull(t.labelHolder)) this.faceCamera(t.labelHolder, this.camera.getTransform().getWorldPosition())
  }

  /** Yaw-only billboard, as in SightlinesMap. */
  private faceCamera(o: SceneObject, camPos: vec3) {
    const tr = o.getTransform()
    const to = camPos.sub(tr.getWorldPosition())
    tr.setWorldRotation(quat.angleAxis(Math.atan2(to.x, to.z), vec3.up()))
  }

  private makeLabel(parent: SceneObject, text: string, localPos: vec3, scale: number, rgba: number[]): Text | null {
    const holder = global.scene.createSceneObject("label")
    holder.setParent(parent)
    holder.getTransform().setLocalPosition(localPos)
    holder.getTransform().setLocalScale(vec3.one().uniformScale(scale))
    if (!this.labelPrefab) return null
    const inner = this.labelPrefab.instantiate(holder)
    // The prefab root is saved at x = -100; centre it on the holder.
    inner.getTransform().setLocalPosition(vec3.zero())
    const wl = inner.getComponent(WorldLabel.getTypeName()) as WorldLabel
    if (!wl || !wl.textComp) return null
    wl.textComp.text = text
    try {
      wl.textComp.textFill.color = new vec4(rgba[0], rgba[1], rgba[2], rgba[3])
    } catch (e) {
      // Leave the prefab colour.
    }
    return wl.textComp
  }

  /** Same contract as SightlinesMap.meshObject (position, normal, texture0; stride 8; bounded batches). */
  private meshObject(parent: SceneObject, name: string, chunk: MeshChunk, rgba: number[]): {obj: SceneObject; material: Material} {
    const vertexCount = chunk.verts.length / MESH_VERTEX_STRIDE
    if (chunk.verts.length % MESH_VERTEX_STRIDE !== 0) {
      throw new Error(`[Sightlines] ${name}: ${chunk.verts.length} vertex values are not a multiple of ${MESH_VERTEX_STRIDE}`)
    }
    for (const index of chunk.idx) {
      if (index < 0 || index >= vertexCount) throw new Error(`[Sightlines] ${name}: index ${index} is outside ${vertexCount} vertices`)
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
    for (let start = 0; start < chunk.verts.length; start += MESH_VERTEX_BATCH * MESH_VERTEX_STRIDE) {
      builder.appendVerticesInterleaved(chunk.verts.slice(start, start + MESH_VERTEX_BATCH * MESH_VERTEX_STRIDE))
    }
    if (builder.getVerticesCount() !== vertexCount) {
      throw new Error(`[Sightlines] ${name}: MeshBuilder received ${builder.getVerticesCount()} of ${vertexCount} vertices`)
    }
    for (let start = 0; start < chunk.idx.length; start += MESH_INDEX_BATCH) builder.appendIndices(chunk.idx.slice(start, start + MESH_INDEX_BATCH))
    if (!builder.isValid()) print(`[Sightlines] mesh ${name} is not valid (${vertexCount} verts)`)
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
}

/**
 * Floating "exploded diagram" of a product tied to a building's founder story (Core/Products.ts).
 *
 * show() spawns the assembled model in front of the wearer. It turns slowly, holds for a moment, then flies apart
 * part by part over about 2.5 s; thin leader lines grow out to billboarded part labels. toggle() re-assembles it and
 * explodes it again; hide() removes it.
 *
 * Hierarchy (one SceneObject per part, so animation is a transform lerp, never a mesh rebuild):
 *   ShowcaseRoot (world position, yaw facing the wearer, pop-in scale)
 *     spin (slow turntable yaw)
 *       scale (uniform: scaleCm / model span)
 *         part_<name> (local position = part centre - model centre + explode offset)
 *           mesh (the part's mesh, built about its own centre; spins for fans)
 *           leader (thin tube from the part centre toward the label)  - first part per label only
 *           label (WorldLabel prefab, billboarded yaw-only toward the camera)
 *
 * Mesh building mirrors RetrospecsMap.meshObject exactly (8-float stride with texture0, batched appends), so any
 * runtime fix there applies here too.
 */
import {MeshChunk, buildTube} from "../Core/MapMesh"
import {tidyLabel} from "./LabelStyle"
import {P3, sharedWall} from "../Core/Focus"
import {addBezel} from "./ScreenBezel"
import {
  PRODUCT_COLORS, ColorGroup, ProductModel, ProductPart, Vec3, buildPart, explodedPosition, labelDirection, labelledParts, modelBounds,
  modelForFact, modelSpan, modelsForLandmark as productsForLandmark, partCenter, partProgress, productById
} from "../Core/Products"
import {WorldLabel} from "../../Scripts/WorldLabel"

const MESH_VERTEX_STRIDE = 8
const MESH_VERTEX_BATCH = 512
const MESH_INDEX_BATCH = 3072 // divisible by three, so each call ends on a full triangle

type Phase = "hold" | "explode" | "open" | "collapse"

interface PartView {
  part: ProductPart
  obj: SceneObject
  mesh: SceneObject
  /** Assembled local position (part centre minus model centre), design cm. */
  home: vec3
  leader: SceneObject | null
  label: SceneObject | null
  spinDeg: number
}

@component
export class RetrospecsShowcase extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Retrospecs Showcase</span><br/><span style="color: #94A3B8; font-size: 11px;">Exploded product models built at runtime from Core/Products.ts.</span>')
  @input
  @hint("Any material with a Base Color (e.g. Assets/Materials/White.mat). Cloned per colour.")
  material: Material

  @input
  @allowUndefined
  @hint("Assets/Prefabs/WorldLabel.prefab. Without it, leader lines show but labels don't.")
  labelPrefab: ObjectPrefab

  @input
  @allowUndefined
  @hint("Camera object for billboarding labels. If empty, labels face the faceToward point passed to show().")
  camera: SceneObject

  @input @hint("Default assembled size (cm across) when show() gets no scaleCm") defaultScaleCm: number = 50
  @input @hint("Turntable speed while assembled (deg/s); a third of this once exploded") rotateDegPerSec: number = 18
  @input @hint("Seconds the assembled model turns before it explodes") holdSeconds: number = 1.4
  @input @hint("Seconds for the full part-by-part explode") explodeSeconds: number = 2.5
  @input @hint("Seconds to re-assemble on toggle()") collapseSeconds: number = 1.2
  @input @hint("Label size multiplier (world, independent of model scale)") labelScale: number = 0.25
  @input @hint("Leader line length beyond the part centre (world cm)") leaderCm: number = 9
  @input @hint("Leader line thickness (world cm)") leaderWidthCm: number = 0.18

  private root: SceneObject = null
  private spin: SceneObject = null
  private parts: PartView[] = []
  private model: ProductModel = null
  private scale = 1
  private t = 0
  private phase: Phase = "hold"
  private phaseTime = 0
  private age = 0
  private yawDeg = 0
  private faceToward: vec3 = vec3.zero()
  private materials: Partial<Record<ColorGroup, Material>> = {}
  private landmarkCycle: Record<string, number> = {}
  /** Where it sits on the focus wall (wall-local cm), when shown while the wall is up; it then rides the wall. */
  private wallLocal: P3 = null

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Model ids for a building, in display order (Huang: graphics card, then the toy-block server). */
  modelsForLandmark(landmarkId: string): string[] {
    return productsForLandmark(landmarkId).map((m) => m.id)
  }

  /** The model illustrating a Cards.ts fact id, or "" if none. */
  modelForFact(factId: string): string {
    const m = modelForFact(factId)
    return m ? m.id : ""
  }

  isShowing(): boolean {
    return this.root !== null
  }

  currentModelId(): string {
    return this.model ? this.model.id : ""
  }

  /**
   * Spawns `modelId` assembled at `worldPos` (cm), its front turned toward `faceToward` (usually the camera), about
   * `scaleCm` across. Replaces whatever was showing. Returns false for an unknown id.
   */
  show(modelId: string, worldPos: vec3, faceToward: vec3, scaleCm?: number): boolean {
    const model = productById(modelId)
    if (!model) {
      print(`[Retrospecs] showcase: unknown model ${modelId}`)
      return false
    }
    this.hide()
    this.model = model
    this.faceToward = faceToward
    this.scale = (scaleCm && scaleCm > 0 ? scaleCm : this.defaultScaleCm) / Math.max(1, modelSpan(model))
    this.t = 0
    this.phase = "hold"
    this.phaseTime = 0
    this.age = 0
    this.yawDeg = 0

    this.root = global.scene.createSceneObject("ShowcaseRoot_" + model.id)
    const rt = this.root.getTransform()
    rt.setWorldPosition(worldPos)
    const to = faceToward.sub(worldPos)
    rt.setWorldRotation(quat.angleAxis(Math.atan2(to.x, to.z), vec3.up()))
    rt.setLocalScale(vec3.one().uniformScale(0.001))
    // On the focus wall: ride it (lazy follow) and sit in a TV bezel beside the main screen.
    this.wallLocal = sharedWall.active ? sharedWall.toLocal(worldPos) : null
    if (this.wallLocal) {
      const s = scaleCm && scaleCm > 0 ? scaleCm : this.defaultScaleCm
      addBezel(this.root, this.material, {x0: -0.5 * s, y0: -0.5 * s, x1: 0.5 * s, y1: 0.5 * s}, -0.6 * s)
      this.followWall()
    }

    this.spin = global.scene.createSceneObject("spin")
    this.spin.setParent(this.root)
    const scaleObj = global.scene.createSceneObject("scale")
    scaleObj.setParent(this.spin)
    scaleObj.getTransform().setLocalScale(vec3.one().uniformScale(this.scale))

    const b = modelBounds(model)
    const mc = new vec3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
    const labelled = labelledParts(model)
    let verts = 0
    for (const part of model.parts) {
      const c = partCenter(part)
      const obj = global.scene.createSceneObject("part_" + part.name)
      obj.setParent(scaleObj)
      const home = new vec3(c.x - mc.x, c.y - mc.y, c.z - mc.z)
      obj.getTransform().setLocalPosition(home)
      const chunk = buildPart(part, c)
      verts += chunk.verts.length / MESH_VERTEX_STRIDE
      const mesh = this.meshObject(obj, "mesh", chunk, part.color)
      const view: PartView = {part, obj, mesh, home, leader: null, label: null, spinDeg: 0}
      if (labelled.indexOf(part) >= 0) this.addLeaderAndLabel(view)
      this.parts.push(view)
    }
    print(`[Retrospecs] showcase ${model.id}: ${model.parts.length} parts, ${verts} verts, scale ${this.scale.toFixed(2)}`)
    this.applyPose()
    return true
  }

  /**
   * Convenience: shows the next model for a building (repeated calls cycle, e.g. Huang alternates graphics card and
   * toy-block server). Returns the model id shown, or "" if the building has none.
   */
  showForLandmark(landmarkId: string, worldPos: vec3, faceToward: vec3, scaleCm?: number): string {
    const ids = this.modelsForLandmark(landmarkId)
    if (!ids.length) return ""
    const k = this.landmarkCycle[landmarkId] || 0
    this.landmarkCycle[landmarkId] = k + 1
    const id = ids[k % ids.length]
    return this.show(id, worldPos, faceToward, scaleCm) ? id : ""
  }

  /** Re-assembles, then explodes again. If it's assembled or re-assembling, explodes now. */
  toggle() {
    if (!this.root) return
    if (this.phase === "explode" || this.phase === "open") this.setPhase("collapse")
    else this.setPhase("explode")
  }

  hide() {
    if (this.root) this.root.destroy()
    this.root = null
    this.spin = null
    this.parts = []
    this.model = null
    this.wallLocal = null
  }

  /** Keeps the model on its wall slot, facing the wall's eye point. */
  private followWall() {
    if (!this.root || !this.wallLocal || !sharedWall.active) return
    const p = sharedWall.toWorld(this.wallLocal)
    const o = sharedWall.origin
    const rt = this.root.getTransform()
    rt.setWorldPosition(new vec3(p.x, p.y, p.z))
    rt.setWorldRotation(quat.angleAxis(Math.atan2(o.x - p.x, o.z - p.z), vec3.up()))
  }

  private setPhase(p: Phase) {
    this.phase = p
    this.phaseTime = 0
  }

  private onUpdate() {
    if (!this.root) return
    const dt = getDeltaTime()
    this.age += dt
    this.phaseTime += dt
    if (this.phase === "hold" && this.phaseTime >= this.holdSeconds) this.setPhase("explode")
    else if (this.phase === "explode") {
      this.t = Math.min(1, this.t + dt / Math.max(0.1, this.explodeSeconds))
      if (this.t >= 1) this.setPhase("open")
    } else if (this.phase === "collapse") {
      this.t = Math.max(0, this.t - dt / Math.max(0.1, this.collapseSeconds))
      if (this.t <= 0) this.setPhase("hold")
    }
    const speed = this.phase === "open" ? this.rotateDegPerSec / 3 : this.rotateDegPerSec
    this.yawDeg = (this.yawDeg + speed * dt) % 360
    for (const v of this.parts) if (v.part.spin) v.spinDeg = (v.spinDeg + v.part.spin.degPerSec * dt) % 360
    this.followWall()
    this.applyPose()
  }

  private applyPose() {
    const pop = Math.min(1, this.age / 0.4)
    const popE = 1 - Math.pow(1 - pop, 3)
    this.root.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.001, popE)))
    this.spin.getTransform().setLocalRotation(quat.angleAxis((this.yawDeg * Math.PI) / 180, vec3.up()))
    const camPos = this.camera ? this.camera.getTransform().getWorldPosition() : this.faceToward
    for (const v of this.parts) {
      const off = explodedPosition(v.part, this.t)
      v.obj.getTransform().setLocalPosition(new vec3(v.home.x + off.x, v.home.y + off.y, v.home.z + off.z))
      if (v.part.spin) v.mesh.getTransform().setLocalRotation(quat.angleAxis((v.spinDeg * Math.PI) / 180, axisVec(v.part.spin.axis)))
      // Leaders and labels grow in over the last 30% of the part's own move, and shrink away when it re-assembles.
      const show = Math.max(0, Math.min(1, (partProgress(v.part, this.t) - 0.7) / 0.3))
      if (v.leader) v.leader.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.0001, show)))
      if (v.label) {
        const lt = v.label.getTransform()
        lt.setLocalScale(vec3.one().uniformScale(Math.max(0.0001, show * this.labelScale / this.scale)))
        const p = lt.getWorldPosition()
        const to = camPos.sub(p)
        lt.setWorldRotation(quat.angleAxis(Math.atan2(to.x, to.z), vec3.up()))
      }
    }
  }

  private addLeaderAndLabel(v: PartView) {
    const d = labelDirection(v.part)
    const len = this.leaderCm / this.scale
    const end: Vec3 = {x: d.x * len, y: d.y * len, z: d.z * len}
    const leaderObj = global.scene.createSceneObject("leader")
    leaderObj.setParent(v.obj)
    this.meshObject(leaderObj, "tube", buildTube([{x: 0, y: 0, z: 0}, end], this.leaderWidthCm / this.scale), "leader")
    v.leader = leaderObj
    if (!this.labelPrefab) return
    const holder = global.scene.createSceneObject("label")
    holder.setParent(v.obj)
    holder.getTransform().setLocalPosition(new vec3(end.x * 1.08, end.y * 1.08, end.z * 1.08))
    holder.getTransform().setLocalScale(vec3.one().uniformScale(0.0001))
    // Instantiated now (not when the part lands) so WorldLabel's own random pop-in delay runs during the hold.
    const inner = this.labelPrefab.instantiate(holder)
    tidyLabel(inner, v.part.label)
    v.label = holder
  }

  private materialFor(group: ColorGroup): Material {
    let m = this.materials[group]
    if (!m) {
      m = this.material.clone()
      const c = PRODUCT_COLORS[group]
      try {
        m.mainPass.baseColor = new vec4(c[0], c[1], c[2], c[3])
      } catch (e) {
        // Material without a Base Color: leave as is.
      }
      this.materials[group] = m
    }
    return m
  }

  /** Same MeshBuilder path as RetrospecsMap.meshObject (stride 8 with texture0, batched appends, count check). */
  private meshObject(parent: SceneObject, name: string, chunk: MeshChunk, group: ColorGroup): SceneObject {
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
    if (!builder.isValid()) print(`[Retrospecs] showcase mesh ${name} is not valid (${vertexCount} verts)`)
    builder.updateMesh()
    const visual = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = builder.getMesh()
    visual.mainMaterial = this.materialFor(group)
    return obj
  }
}

function axisVec(a: "x" | "y" | "z"): vec3 {
  return a === "x" ? vec3.right() : a === "z" ? vec3.forward() : vec3.up()
}

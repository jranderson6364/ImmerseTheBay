/**
 * Building experiences: a small animated 3D lesson beside the selected building (Core/Experiences.ts).
 *
 * The focus mode calls show(cardId, anchorWorldPos, faceToward, scaleCm) when a building is selected and hide()
 * when it's deselected. Meshes are built once per show(). Every frame the pure `poses(t)` are applied to plain
 * transforms, so animation never rebuilds a mesh.
 *
 * Hierarchy:
 *   ExperienceRoot (anchor world position = base centre, yaw so +Z faces faceToward, pop-in scale)
 *     scale (uniform: scaleCm / DESIGN_SCALE_CM)
 *       node_<name> (pose: local position / rotation / scale, design cm)
 *         mesh (RenderMeshVisual, one colour)
 *       label_<i> (WorldLabel prefab, billboarded yaw-only toward the camera, constant world size)
 *
 * Mesh building mirrors RetrospecsShowcase.meshObject and RetrospecsMap.meshObject (8-float stride with texture0,
 * batched appends, count check).
 */
import {MeshChunk} from "../Core/MapMesh"
import {DESIGN_SCALE_CM, EXP_COLORS, ExpColor, Experience, HIDDEN, Pose, buildNode, experienceFor, labelWeight} from "../Core/Experiences"
import {tidyLabel} from "./LabelStyle"
import {P3, sharedWall} from "../Core/Focus"
import {addBezel} from "./ScreenBezel"

const MESH_VERTEX_STRIDE = 8
const MESH_VERTEX_BATCH = 512
const MESH_INDEX_BATCH = 3072 // divisible by three, so each call ends on a full triangle

interface LabelView {
  index: number
  obj: SceneObject
}

@component
export class RetrospecsExperiences extends BaseScriptComponent {
  @ui.label('<span style="color: #F59E0B;">Retrospecs Experiences</span><br/><span style="color: #94A3B8; font-size: 11px;">Animated 3D lesson beside the selected building (Core/Experiences.ts).</span>')
  @input
  @hint("Any material with a Base Color (e.g. Assets/Materials/White.mat). Cloned per colour.")
  material: Material

  @input
  @allowUndefined
  @hint("Assets/Prefabs/WorldLabel.prefab. Without it the experience shows without captions.")
  labelPrefab: ObjectPrefab

  @input
  @allowUndefined
  @hint("Camera object for billboarding labels. If empty, labels face the faceToward point passed to show().")
  camera: SceneObject

  @input @hint("Size (cm across) when show() gets scaleCm <= 0") defaultScaleCm: number = 40
  @input @hint("Label size multiplier (world, independent of experience scale)") labelScale: number = 0.25
  @input @hint("Pop-in time (s)") popSeconds: number = 0.4

  private root: SceneObject = null
  private exp: Experience = null
  private nodeObjs: SceneObject[] = []
  private labels: LabelView[] = []
  private scale = 1
  private age = 0
  private faceToward: vec3 = vec3.zero()
  private materials: Partial<Record<ExpColor, Material>> = {}
  /** Where it sits on the focus wall (wall-local cm), when shown while the wall is up; it then rides the wall. */
  private wallLocal: P3 = null

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** True if the card id has an experience. */
  has(id: string): boolean {
    return !!experienceFor(id)
  }

  isShowing(): boolean {
    return this.root !== null
  }

  /** Experience id currently showing ("hp" for any of the HP cards), or "". */
  currentId(): string {
    return this.exp ? this.exp.id : ""
  }

  /**
   * Shows the experience for card `id` with its base centre at `anchorWorldPos` (cm), its front turned toward
   * `faceToward`, about `scaleCm` across. Replaces whatever is showing and restarts the animation. Returns false
   * (after hiding the previous one) when the card has no experience.
   */
  show(id: string, anchorWorldPos: vec3, faceToward: vec3, scaleCm: number): boolean {
    this.hide()
    const exp = experienceFor(id)
    if (!exp) return false
    this.exp = exp
    this.faceToward = faceToward
    this.scale = (scaleCm > 0 ? scaleCm : this.defaultScaleCm) / DESIGN_SCALE_CM
    this.age = 0

    this.root = global.scene.createSceneObject("ExperienceRoot_" + exp.id)
    const rt = this.root.getTransform()
    rt.setWorldPosition(anchorWorldPos)
    const to = faceToward.sub(anchorWorldPos)
    rt.setWorldRotation(quat.angleAxis(Math.atan2(to.x, to.z), vec3.up()))
    rt.setLocalScale(vec3.one().uniformScale(0.001))
    // On the focus wall: ride it (lazy follow) and sit in a TV bezel like the main screen beside it.
    this.wallLocal = sharedWall.active ? sharedWall.toLocal(anchorWorldPos) : null
    if (this.wallLocal) {
      const s = scaleCm > 0 ? scaleCm : this.defaultScaleCm
      addBezel(this.root, this.material, {x0: -0.65 * s, y0: -0.12 * s, x1: 0.65 * s, y1: 1.3 * s}, -0.55 * s)
      this.followWall()
    }

    const scaleObj = global.scene.createSceneObject("scale")
    scaleObj.setParent(this.root)
    scaleObj.getTransform().setLocalScale(vec3.one().uniformScale(this.scale))

    let verts = 0
    for (const node of exp.nodes) {
      const obj = global.scene.createSceneObject("node_" + node.name)
      obj.setParent(scaleObj)
      const chunk = buildNode(node)
      verts += chunk.verts.length / MESH_VERTEX_STRIDE
      if (chunk.idx.length) this.meshObject(obj, "mesh", chunk, node.color)
      this.nodeObjs.push(obj)
    }
    if (this.labelPrefab) {
      exp.labels.forEach((l, i) => {
        const holder = global.scene.createSceneObject("label_" + i)
        holder.setParent(scaleObj)
        holder.getTransform().setLocalPosition(new vec3(l.pos.x, l.pos.y, l.pos.z))
        holder.getTransform().setLocalScale(vec3.one().uniformScale(0.0001))
        const inner = this.labelPrefab.instantiate(holder)
        tidyLabel(inner, l.text)
        this.labels.push({index: i, obj: holder})
      })
    }
    print(`[Retrospecs] experience ${exp.id} for ${id}: ${exp.nodes.length} meshes, ${verts} verts, scale ${this.scale.toFixed(2)}`)
    this.applyPose()
    return true
  }

  hide() {
    if (this.root) this.root.destroy()
    this.root = null
    this.exp = null
    this.nodeObjs = []
    this.labels = []
    this.wallLocal = null
  }

  /** Keeps the experience on its wall slot, facing the wall's eye point. */
  private followWall() {
    if (!this.root || !this.wallLocal || !sharedWall.active) return
    const p = sharedWall.toWorld(this.wallLocal)
    const o = sharedWall.origin
    const rt = this.root.getTransform()
    rt.setWorldPosition(new vec3(p.x, p.y, p.z))
    rt.setWorldRotation(quat.angleAxis(Math.atan2(o.x - p.x, o.z - p.z), vec3.up()))
  }

  private onUpdate() {
    if (!this.root) return
    this.age += getDeltaTime()
    this.followWall()
    this.applyPose()
  }

  private applyPose() {
    const pop = Math.min(1, this.age / Math.max(0.01, this.popSeconds))
    const popE = 1 - Math.pow(1 - pop, 3)
    this.root.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.001, popE)))
    const poses = this.exp.poses(this.age)
    for (let i = 0; i < this.nodeObjs.length; i++) applyPose(this.nodeObjs[i].getTransform(), poses[i])
    const camPos = this.camera ? this.camera.getTransform().getWorldPosition() : this.faceToward
    for (const v of this.labels) {
      const w = labelWeight(this.exp, this.exp.labels[v.index], this.age)
      const lt = v.obj.getTransform()
      lt.setLocalScale(vec3.one().uniformScale(Math.max(0.0001, (w * this.labelScale) / this.scale)))
      const to = camPos.sub(lt.getWorldPosition())
      lt.setWorldRotation(quat.angleAxis(Math.atan2(to.x, to.z), vec3.up()))
    }
  }

  private materialFor(group: ExpColor): Material {
    let m = this.materials[group]
    if (!m) {
      m = this.material.clone()
      const c = EXP_COLORS[group]
      try {
        m.mainPass.baseColor = new vec4(c[0], c[1], c[2], c[3])
      } catch (e) {
        // Material without a Base Color: leave as is.
      }
      this.materials[group] = m
    }
    return m
  }

  /** Same MeshBuilder path as RetrospecsShowcase.meshObject (stride 8 with texture0, batched appends, count check). */
  private meshObject(parent: SceneObject, name: string, chunk: MeshChunk, group: ExpColor): SceneObject {
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
    if (!builder.isValid()) print(`[Retrospecs] experience mesh ${name} is not valid (${vertexCount} verts)`)
    builder.updateMesh()
    const visual = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = builder.getMesh()
    visual.mainMaterial = this.materialFor(group)
    return obj
  }
}

function applyPose(tr: Transform, p: Pose) {
  tr.setLocalPosition(new vec3(p.pos.x, p.pos.y, p.pos.z))
  tr.setLocalRotation(new quat(p.rot.w, p.rot.x, p.rot.y, p.rot.z))
  tr.setLocalScale(new vec3(Math.max(HIDDEN, p.scale.x), Math.max(HIDDEN, p.scale.y), Math.max(HIDDEN, p.scale.z)))
}

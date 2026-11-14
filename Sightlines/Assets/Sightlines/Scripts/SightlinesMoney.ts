/**
 * "Pile of money": shows a donor's gift as a real-scale pile of $1 bills on pallets beside the building, with a
 * 1.75 m person for scale and a floating caption. Amounts and captions come from Core/Money.ts, which reads them
 * from the sourced facts in Core/Cards.ts.
 *
 *  - show(cardId, worldPos, faceToward): real scale in world space (cm). The pile's front turns toward `faceToward`
 *    (usually the camera), and the person stands in front of it.
 *  - showOnMap(cardId, mapRoot, mapPos, cmPerM): the same pile at map scale on the tabletop map (indoor demo).
 *  - hide().
 *
 * The towers grow in over about 2 s; each pallet tower is one transform, so the animation costs one setLocalScale
 * per tower per frame.
 */
import {MeshChunk} from "../Core/MapMesh"
import {tidyLabel} from "./LabelStyle"
import {
  MONEY_COLORS, MONEY_GROUPS, MoneyGroup, PALLET_Z_CM, billsToStack, buildMoneyPile, buildScaleFigure, captionFor,
  giftFor, pileDistanceCm, pileDrawCalls, towerGrow
} from "../Core/Money"
import {bearingToMapDir} from "../Core/Geo"
import {WorldLabel} from "../../Scripts/WorldLabel"
import {SightlinesMap} from "./SightlinesMap"

const MESH_VERTEX_STRIDE = 8
const MESH_VERTEX_BATCH = 512
const MESH_INDEX_BATCH = 3072

@component
export class SightlinesMoney extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Sightlines Money</span><br/><span style="color: #94A3B8; font-size: 11px;">Real-scale pile of $1 bills for a building\'s sourced gift.</span>')
  @input
  @hint("Any material with a Base Color (e.g. Assets/Materials/White.mat). It is cloned per colour.")
  material: Material

  @input
  @allowUndefined
  @hint("Assets/Prefabs/WorldLabel.prefab (optional caption)")
  labelPrefab: ObjectPrefab

  @input
  @allowUndefined
  @hint("Camera object, so the caption keeps facing the wearer. Optional.")
  camera: SceneObject

  @input @hint("Seconds for the pile to grow in") growSeconds: number = 2
  @input @hint("Person for scale, cm") figureHeightCm: number = 175
  @input @hint("Caption scale in world mode") captionScale: number = 1.6
  @input @hint("Caption scale on the map") mapCaptionScale: number = 0.35

  private holder: SceneObject = null
  private caption: SceneObject = null
  private towers: {t: Transform; order: number}[] = []
  private t = -1
  private materials: Partial<Record<MoneyGroup | "figure", Material>> = {}
  private shownId = ""
  private shownKey = ""

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  get showing(): string {
    return this.shownId
  }

  /** True if this card has a sourced gift amount (huang, y2e2, gates, hewlett, packard). */
  hasGift(cardId: string): boolean {
    return !!giftFor(cardId)
  }

  /** Real-scale pile at `worldPos` (floor point, world cm), front turned toward `faceToward`. */
  show(cardId: string, worldPos: vec3, faceToward: vec3): boolean {
    this.hide()
    if (!giftFor(cardId)) return false
    const holder = global.scene.createSceneObject("MoneyPile_" + cardId)
    holder.getTransform().setWorldPosition(worldPos)
    const yaw = Math.atan2(faceToward.x - worldPos.x, faceToward.z - worldPos.z)
    holder.getTransform().setWorldRotation(quat.angleAxis(yaw, vec3.up()))
    this.build(cardId, holder, 1, this.captionScale, 60)
    return true
  }

  /**
   * Indoor fallback: the pile on the tabletop map at `mapPos` (map-local cm, y = 0 is the map surface).
   * `exaggeration` 1 is true map scale (at 1:900 a 3.2 m pile is about 0.4 cm); raise it to make it visible, and say so.
   */
  showOnMap(cardId: string, mapRoot: SceneObject, mapPos: vec3, cmPerM: number, exaggeration = 1, heightExaggeration = 1): boolean {
    this.hide()
    if (!giftFor(cardId) || !mapRoot) return false
    const holder = global.scene.createSceneObject("MoneyPileMap_" + cardId)
    holder.setParent(mapRoot)
    holder.getTransform().setLocalPosition(mapPos)
    if (this.camera) {
      const p = holder.getTransform().getWorldPosition()
      const c = this.camera.getTransform().getWorldPosition()
      holder.getTransform().setWorldRotation(quat.angleAxis(Math.atan2(c.x - p.x, c.z - p.z), vec3.up()))
    }
    const s = (cmPerM / 100) * exaggeration
    this.build(cardId, holder, s, this.mapCaptionScale, 2.5, s * heightExaggeration)
    return true
  }

  /**
   * One call for the controller after a landmark is identified. World mode: the pile stands on the floor between
   * the wearer and the building, a few degrees to the right of the line of sight, at most `maxWorldCm` away. If the
   * building is under 25 m away (you're in or at it, e.g. Huang at the default survey point) it goes along the
   * wearer's view instead. Map mode (indoor demo): on the tabletop map beside the building, toward the wearer, with
   * a true footprint and the map's vertical exaggeration so its height compares honestly with the buildings.
   * Re-showing the card already on display does nothing. Returns false if the card has no sourced gift.
   */
  showForLandmark(cardId: string, map: SightlinesMap, indoor: boolean, opts: {mapOffsetCm?: number; mapExaggeration?: number; maxWorldCm?: number; sideDeg?: number} = {}): boolean {
    const gift = giftFor(cardId)
    if (!gift || !map || !map.root || !this.camera) {
      this.hide()
      return false
    }
    const key = (indoor ? "map:" : "world:") + cardId
    if (this.shownKey === key && this.holder) return true
    const cam = this.camera.getTransform().getWorldPosition()
    if (indoor) {
      const l = map.landmarks[cardId]
      if (!l) return false
      const camLocal = map.root.getTransform().getInvertedWorldTransform().multiplyPoint(cam)
      let dx = camLocal.x - l.map.x, dz = camLocal.z - l.map.z
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      const off = opts.mapOffsetCm === undefined ? 4 : opts.mapOffsetCm
      const ok = this.showOnMap(cardId, map.root, new vec3(l.map.x + dx * off, 0, l.map.z + dz * off), map.cmPerM, opts.mapExaggeration || 1, map.verticalExaggeration)
      if (ok) this.shownKey = key
      return ok
    }
    const depth = billsToStack(gift.amountUSD).footprint.depthCm
    const distM = map.distanceTo(cardId)
    let world: vec3
    if (distM < 25 || !map.worldRoot) {
      const f = this.camera.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
      const fl = Math.hypot(f.x, f.z) || 1
      const d = pileDistanceCm(0, depth)
      const floorY = map.worldRoot ? map.worldRoot.getTransform().getWorldPosition().y : cam.y - 160
      world = new vec3(cam.x + (f.x / fl) * d, floorY, cam.z + (f.z / fl) * d)
    } else {
      const d = pileDistanceCm(distM, depth, opts.maxWorldCm || 1500)
      const dir = bearingToMapDir(map.bearingTo(cardId) + (opts.sideDeg === undefined ? 8 : opts.sideDeg))
      world = map.worldRoot.getTransform().getWorldTransform().multiplyPoint(new vec3(dir.x * d, 0, dir.z * d))
    }
    const ok = this.show(cardId, world, cam)
    if (ok) this.shownKey = key
    return ok
  }

  hide() {
    if (this.holder) this.holder.destroy()
    this.holder = null
    this.caption = null
    this.towers = []
    this.t = -1
    this.shownId = ""
    this.shownKey = ""
  }

  // -------------------------------------------------------------------------

  private build(cardId: string, holder: SceneObject, scale: number, captionScale: number, captionGapCm: number, scaleY = scale) {
    const gift = giftFor(cardId)
    const stack = billsToStack(gift.amountUSD)
    const pile = buildMoneyPile(stack)
    this.holder = holder
    this.shownId = cardId

    // Everything real-scale lives under `pile`, which carries the scale; the caption stays unscaled.
    const pileObj = global.scene.createSceneObject("pile")
    pileObj.setParent(holder)
    pileObj.getTransform().setLocalScale(new vec3(scale, scaleY, scale))

    let frontZ = -1e9, maxX = -1e9
    for (const tw of pile.towers) {
      const obj = global.scene.createSceneObject("tower")
      obj.setParent(pileObj)
      const tr = obj.getTransform()
      tr.setLocalPosition(new vec3(tw.position.x, tw.position.y, tw.position.z))
      tr.setLocalScale(new vec3(1, 0.001, 1))
      for (const g of MONEY_GROUPS) tw.groups[g].forEach((c, i) => this.meshObject(obj, g + i, c, g))
      this.towers.push({t: tr, order: tw.order})
      frontZ = Math.max(frontZ, tw.position.z + PALLET_Z_CM / 2)
      maxX = Math.max(maxX, tw.position.x)
    }

    // Person for scale: just in front of the pile, toward its right, facing the wearer.
    const fig = global.scene.createSceneObject("scaleFigure")
    fig.setParent(pileObj)
    fig.getTransform().setLocalPosition(new vec3(Math.min(maxX, 120), 0, frontZ + 60))
    this.meshObject(fig, "figure", buildScaleFigure(this.figureHeightCm), "figure")

    const text = captionFor(cardId)
    if (this.labelPrefab && text) {
      const cap = global.scene.createSceneObject("label")
      cap.setParent(holder)
      cap.getTransform().setLocalPosition(new vec3(0, stack.footprint.heightCm * scaleY + captionGapCm, 0))
      cap.getTransform().setLocalScale(vec3.one().uniformScale(captionScale))
      const inner = this.labelPrefab.instantiate(cap)
      tidyLabel(inner, text)
      this.caption = cap
    }
    this.t = 0
    print(`[Sightlines] money ${cardId}: ${text} | ${stack.skids} skids, ${pile.towers.length} towers, ${pile.vertexCount} verts, ${pileDrawCalls(pile) + 1} meshes`)
  }

  private onUpdate() {
    if (!this.holder) return
    if (this.t >= 0) {
      this.t += getDeltaTime()
      const n = this.towers.length
      for (const tw of this.towers) {
        const k = towerGrow(tw.order, n, this.t, this.growSeconds)
        tw.t.setLocalScale(new vec3(1, Math.max(0.001, k), 1))
      }
      if (this.t > this.growSeconds + 0.1) this.t = -1
    }
    if (this.caption && this.camera) {
      const tr = this.caption.getTransform()
      const p = tr.getWorldPosition()
      const c = this.camera.getTransform().getWorldPosition()
      tr.setWorldRotation(quat.angleAxis(Math.atan2(c.x - p.x, c.z - p.z), vec3.up()))
    }
  }

  private materialFor(g: MoneyGroup | "figure"): Material {
    let m = this.materials[g]
    if (!m) {
      m = this.material.clone()
      const c = MONEY_COLORS[g]
      try {
        m.mainPass.baseColor = new vec4(c[0], c[1], c[2], c[3])
      } catch (e) {
        // Material without a Base Color: leave as is.
      }
      this.materials[g] = m
    }
    return m
  }

  /** Same MeshBuilder path as SightlinesMap.meshObject (8-float stride, texture0, batched appends). */
  private meshObject(parent: SceneObject, name: string, chunk: MeshChunk, group: MoneyGroup | "figure"): SceneObject {
    const vertexCount = chunk.verts.length / MESH_VERTEX_STRIDE
    if (chunk.verts.length % MESH_VERTEX_STRIDE !== 0) {
      throw new Error(`[Sightlines] money ${name}: ${chunk.verts.length} vertex values are not a multiple of ${MESH_VERTEX_STRIDE}`)
    }
    for (const index of chunk.idx) {
      if (index < 0 || index >= vertexCount) throw new Error(`[Sightlines] money ${name}: index ${index} is outside ${vertexCount} vertices`)
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
      throw new Error(`[Sightlines] money ${name}: MeshBuilder received ${builder.getVerticesCount()} of ${vertexCount} vertices`)
    }
    for (let start = 0; start < chunk.idx.length; start += MESH_INDEX_BATCH) {
      builder.appendIndices(chunk.idx.slice(start, start + MESH_INDEX_BATCH))
    }
    if (!builder.isValid()) print(`[Sightlines] money mesh ${name} is not valid (${vertexCount} verts)`)
    builder.updateMesh()
    const visual = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = builder.getMesh()
    visual.mainMaterial = this.materialFor(group)
    return obj
  }
}

/**
 * A "TV" bezel behind a floating 3D object on the focus wall (Core/Focus.ts `sharedWall`): a dim fill and a thin
 * bright frame, so the exploded model and the experience read as screens beside the main info screen. Additive
 * display: the fill is barely there (black is see-through), the frame carries the shape.
 */
import {Rect2, frameRects, quadsChunk} from "../Core/Focus"

const BEZEL_FILL = [0.03, 0.026, 0.02, 1]
const BEZEL_FRAME = [0.6, 0.5, 0.34, 1]

/** Adds the bezel as a child of `parent`, in its local XY plane at depth `z` (facing +Z). Returns it, or null. */
export function addBezel(parent: SceneObject, material: Material, r: Rect2, z: number): SceneObject {
  if (!material) return null
  try {
    const holder = global.scene.createSceneObject("screen_bezel")
    holder.setParent(parent)
    quad(holder, material, [r], BEZEL_FILL, z)
    quad(holder, material, frameRects(r, Math.max(0.2, (r.x1 - r.x0) * 0.006)), BEZEL_FRAME, z + 0.02)
    return holder
  } catch (e) {
    print("[Retrospecs] screen bezel failed: " + e)
    return null
  }
}

function quad(parent: SceneObject, material: Material, rects: Rect2[], rgba: number[], z: number) {
  const chunk = quadsChunk(rects, z)
  const o = global.scene.createSceneObject("bezel_part")
  o.setParent(parent)
  const builder = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3},
    {name: "texture0", components: 2}
  ])
  builder.topology = MeshTopology.Triangles
  builder.indexType = MeshIndexType.UInt16
  builder.appendVerticesInterleaved(chunk.verts)
  builder.appendIndices(chunk.idx)
  builder.updateMesh()
  const visual = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  visual.mesh = builder.getMesh()
  const m = material.clone()
  try {
    m.mainPass.baseColor = new vec4(rgba[0], rgba[1], rgba[2], rgba[3])
  } catch (e) {
    // Material without a Base Color: leave as is.
  }
  visual.mainMaterial = m
}

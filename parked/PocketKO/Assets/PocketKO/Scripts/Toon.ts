/**
 * Small helpers for building cartoony things out of unit meshes at runtime.
 * Units are Lens world centimetres.
 */

export const PALETTE: Record<string, vec4> = {
  glorp: new vec4(0.45, 0.95, 0.3, 1),
  glorpDark: new vec4(0.22, 0.6, 0.15, 1),
  belly: new vec4(0.75, 1.0, 0.55, 1),
  white: new vec4(1, 1, 1, 1),
  black: new vec4(0.04, 0.04, 0.06, 1),
  yellow: new vec4(1, 0.88, 0.15, 1),
  red: new vec4(1, 0.25, 0.25, 1),
  orange: new vec4(1, 0.55, 0.1, 1),
  blue: new vec4(0.25, 0.65, 1, 1),
  purple: new vec4(0.7, 0.4, 1, 1),
  green: new vec4(0.35, 1, 0.4, 1),
  pink: new vec4(1, 0.45, 0.75, 1),
  gold: new vec4(1, 0.8, 0.0, 1)
}

export const CONFETTI = ["yellow", "red", "blue", "purple", "green", "pink", "orange"]

export class ToonKit {
  constructor(
    public meshes: {sphere: RenderMesh; box: RenderMesh; cylinder: RenderMesh},
    public material: Material
  ) {}

  /** A coloured mesh child. Returns the SceneObject and its own material clone (so colour can change). */
  part(parent: SceneObject, kind: "sphere" | "box" | "cylinder", color: vec4, pos: vec3, scale: vec3, name = "part"): {obj: SceneObject; mat: Material} {
    const obj = global.scene.createSceneObject(name)
    obj.setParent(parent)
    const t = obj.getTransform()
    t.setLocalPosition(pos)
    t.setLocalScale(scale)
    const v = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    v.mesh = this.meshes[kind]
    const mat = this.material.clone()
    setColor(mat, color)
    v.mainMaterial = mat
    return {obj, mat}
  }

  empty(parent: SceneObject, name: string, pos: vec3 = vec3.zero()): SceneObject {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    o.getTransform().setLocalPosition(pos)
    return o
  }
}

export function setColor(mat: Material, c: vec4) {
  try {
    mat.mainPass.baseColor = c
  } catch (e) {
    // Material without a baseColor parameter: leave it as is.
  }
}

export function lerpColor(a: vec4, b: vec4, t: number): vec4 {
  return new vec4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t)
}

/** Critically-damped-ish spring for squash & stretch. */
export class Spring {
  value: number
  vel = 0
  constructor(public target = 1, public stiffness = 260, public damping = 14) {
    this.value = target
  }
  kick(v: number) {
    this.vel += v
  }
  step(dt: number): number {
    const a = (this.target - this.value) * this.stiffness - this.vel * this.damping
    this.vel += a * dt
    this.value += this.vel * dt
    return this.value
  }
}

/** Horizontal yaw rotation that makes +Z face `toward` from `from`. */
export function faceYaw(from: vec3, toward: vec3): quat {
  const d = toward.sub(from)
  const flat = new vec3(d.x, 0, d.z)
  if (flat.length < 0.001) return quat.quatIdentity()
  return quat.lookAt(flat.normalize(), vec3.up())
}

export function randRange(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

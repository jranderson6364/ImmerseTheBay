/**
 * Cartoon effects: hit sparks, confetti, floating damage numbers and banners.
 * Text is created at runtime as world-space Text components that always face the camera.
 */
import {CONFETTI, PALETTE, ToonKit, randRange, setColor} from "./Toon"

interface Particle {
  obj: SceneObject
  vel: vec3
  spin: vec3
  life: number
  max: number
  size: number
  gravity: number
}

interface Popup {
  obj: SceneObject
  text: Text
  life: number
  max: number
  rise: number
  big: boolean
}

export class Fx {
  private particles: Particle[] = []
  private popups: Popup[] = []

  constructor(
    private kit: ToonKit,
    private parent: SceneObject,
    private camera: SceneObject,
    private textScale = 1
  ) {}

  /** Creates a world-space Text that faces the camera. */
  makeText(parent: SceneObject, initial: string, size: number, color: vec4): {obj: SceneObject; text: Text} {
    const obj = global.scene.createSceneObject("text")
    obj.setParent(parent)
    const text = obj.createComponent("Component.Text") as Text
    text.text = initial
    text.size = size
    try {
      text.horizontalAlignment = HorizontalAlignment.Center
      text.verticalAlignment = VerticalAlignment.Center
      text.textFill.color = color
      text.outlineSettings.enabled = true
      text.outlineSettings.size = 0.25
      text.outlineSettings.fill.color = PALETTE.black
      text.depthTest = false
    } catch (e) {
      // Styling is best-effort across Lens versions.
    }
    obj.getTransform().setLocalScale(vec3.one().uniformScale(this.textScale))
    return {obj, text}
  }

  sparks(at: vec3, colorName: string, count = 14, speed = 70) {
    const c = PALETTE[colorName] || PALETTE.yellow
    for (let i = 0; i < count; i++) {
      const dir = new vec3(randRange(-1, 1), randRange(0.2, 1.2), randRange(-1, 1)).normalize()
      this.spawn(at, i % 3 === 0 ? PALETTE.white : c, dir.uniformScale(randRange(speed * 0.5, speed)), randRange(0.8, 1.6), 0.55, 160)
    }
  }

  confetti(at: vec3, count = 70) {
    for (let i = 0; i < count; i++) {
      const dir = new vec3(randRange(-1, 1), randRange(0.8, 1.8), randRange(-1, 1)).normalize()
      const c = PALETTE[CONFETTI[i % CONFETTI.length]]
      this.spawn(at, c, dir.uniformScale(randRange(60, 140)), randRange(0.9, 1.5), randRange(1.6, 2.6), 90, true)
    }
  }

  popup(at: vec3, s: string, colorName: string, big = false) {
    const {obj, text} = this.makeText(this.parent, s, big ? 64 : 44, PALETTE[colorName] || PALETTE.yellow)
    obj.getTransform().setWorldPosition(at)
    this.popups.push({obj, text, life: big ? 1.6 : 1.0, max: big ? 1.6 : 1.0, rise: big ? 6 : 14, big})
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      p.vel = p.vel.add(new vec3(0, -p.gravity * dt, 0)).uniformScale(Math.max(0, 1 - dt * 1.5))
      const t = p.obj.getTransform()
      t.setWorldPosition(t.getWorldPosition().add(p.vel.uniformScale(dt)))
      t.setWorldRotation(t.getWorldRotation().multiply(quat.fromEulerVec(p.spin.uniformScale(dt))))
      const k = Math.max(0, p.life / p.max)
      t.setLocalScale(vec3.one().uniformScale(p.size * Math.min(1, k * 2)))
      if (p.life <= 0) {
        p.obj.destroy()
        this.particles.splice(i, 1)
      }
    }
    const look = this.facing()
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]
      p.life -= dt
      const age = p.max - p.life
      const t = p.obj.getTransform()
      t.setWorldPosition(t.getWorldPosition().add(new vec3(0, p.rise * dt, 0)))
      // Pop in big, settle, shrink out.
      const pop = age < 0.12 ? age / 0.12 * 1.4 : age < 0.25 ? 1.4 - ((age - 0.12) / 0.13) * 0.4 : p.life < 0.25 ? Math.max(0.01, p.life / 0.25) : 1
      t.setLocalScale(vec3.one().uniformScale(this.textScale * pop))
      if (look) t.setWorldRotation(look)
      if (p.life <= 0) {
        p.obj.destroy()
        this.popups.splice(i, 1)
      }
    }
  }

  /** Rotation that makes text face the wearer (same trick as the sample's FaceCamera). */
  facing(): quat | null {
    if (!this.camera) return null
    const ct = this.camera.getTransform()
    return quat.lookAt(ct.right.cross(vec3.up()), vec3.up())
  }

  private spawn(at: vec3, color: vec4, vel: vec3, size: number, life: number, gravity: number, flat = false) {
    const {obj, mat} = this.kit.part(this.parent, flat ? "box" : "sphere", color, vec3.zero(), vec3.one().uniformScale(size), "fx")
    void mat
    obj.getTransform().setWorldPosition(at)
    if (flat) obj.getTransform().setLocalScale(new vec3(size, size * 0.15, size * 0.6))
    this.particles.push({
      obj,
      vel,
      spin: new vec3(randRange(-8, 8), randRange(-8, 8), randRange(-8, 8)),
      life,
      max: life,
      size,
      gravity
    })
  }
}

export {setColor}

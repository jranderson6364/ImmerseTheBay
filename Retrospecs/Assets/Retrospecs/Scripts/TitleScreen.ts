/**
 * Opening title: RETROSPECS and the slogan, nothing else, floating at eye height about 1.4 m ahead and lazily
 * following the head so it's in view wherever the wearer looks. One pinch lifts it away and hands over to the guided
 * demo (the controller calls `dismiss`).
 *
 * Animation: the title rises into place as it fades in, the slogan follows a beat later, then both float gently.
 * On dismiss they drift up and fade, slogan first.
 *
 * Additive display: black is see-through and brightness is opacity, so fades scale colours toward black.
 */

const TITLE_RGBA = [1.0, 0.97, 0.9, 1]
const SLOGAN_RGBA = [1.0, 0.84, 0.55, 1]

const ROOT_SCALE = 2.0
const DISTANCE_CM = 140
/** Local cm (times ROOT_SCALE in the world). */
const TITLE_Y = 1.3
const SLOGAN_Y = -1.9
const TEXT_W = 26
const RISE_CM = 1.2
/** Text above size 80 doesn't render (RetrospecsInfoPanel), so the title is size 80 on a scaled object. */
const TITLE_SCALE = 1.6

const TITLE_IN = {delay: 0.2, dur: 1.4}
const SLOGAN_IN = {delay: 1.1, dur: 1.2}
const OUT_SEC = 0.7
/** The slogan leaves this much earlier than the title. */
const OUT_STAGGER = 0.15

interface Line {
  obj: SceneObject
  text: Text
  rgba: number[]
  y: number
  inDelay: number
  inDur: number
  outLead: number
}

export interface TitleCopy {
  title: string
  slogan: string
}

export class TitleScreen {
  private root: SceneObject
  private lines: Line[] = []
  private t = 0
  private outT = -1
  private onGone: () => void = null
  private placed = false

  constructor(private camera: SceneObject, copy: TitleCopy, font?: Font) {
    this.root = global.scene.createSceneObject("RetrospecsTitle")
    this.root.getTransform().setLocalScale(vec3.one().uniformScale(ROOT_SCALE))
    this.line("title", copy.title, TITLE_Y, 80, 0.12, TITLE_RGBA, font, TITLE_IN, 0, true, TITLE_SCALE)
    this.line("slogan", copy.slogan, SLOGAN_Y, 36, 0, SLOGAN_RGBA, font, SLOGAN_IN, OUT_STAGGER, false, 1)
    this.apply()
  }

  isOpen(): boolean {
    return !!this.root && this.outT < 0
  }

  /** Lifts away, then calls `onGone` once (the controller starts the demo there). */
  dismiss(onGone: () => void) {
    if (!this.isOpen()) return
    this.outT = 0
    this.onGone = onGone
  }

  /** Call every frame. */
  update(dt: number) {
    if (!this.root) return
    this.t += dt
    if (this.outT >= 0) {
      this.outT += dt
      if (this.outT >= OUT_SEC + OUT_STAGGER) return this.destroy()
    }
    this.follow(dt)
    this.apply()
  }

  private apply() {
    const float = 0.25 * Math.sin(this.t * 0.9)
    for (const l of this.lines) {
      const kin = easeOut(clamp01((this.t - l.inDelay) / l.inDur))
      let a = kin
      let rise = -RISE_CM * (1 - kin)
      if (this.outT >= 0) {
        const kout = easeIn(clamp01((this.outT - (OUT_STAGGER - l.outLead)) / OUT_SEC))
        a *= 1 - kout
        rise += RISE_CM * 1.5 * kout
      }
      l.obj.getTransform().setLocalPosition(new vec3(0, l.y + rise + float, 0))
      const c = new vec4(l.rgba[0] * a, l.rgba[1] * a, l.rgba[2] * a, Math.max(0.001, a))
      try {
        l.text.textFill.color = c
        if (l.text.outlineSettings.enabled) l.text.outlineSettings.fill.color = c
      } catch (e) {
        // Older Text: leave it.
      }
    }
  }

  private destroy() {
    try {
      this.root.destroy()
    } catch (e) {
      // Already gone.
    }
    this.root = null
    this.lines = []
    const cb = this.onGone
    this.onGone = null
    if (cb) cb()
  }

  /** Eye height, straight ahead (horizontal), lazily following the head. Snaps into place on the first frame. */
  private follow(dt: number) {
    const camT = this.camera.getTransform()
    const cam = camT.getWorldPosition()
    // Horizontal facing, same as RetrospecsController.viewHorizontal (stable when looking up or down).
    const v = vec3.up().cross(camT.right)
    let f = new vec3(v.x, 0, v.z)
    if (f.length < 1e-4) f = new vec3(0, 0, -1)
    f = f.normalize()
    const target = new vec3(cam.x + f.x * DISTANCE_CM, cam.y - 4, cam.z + f.z * DISTANCE_CM)
    const tr = this.root.getTransform()
    const pos = this.placed ? vec3.lerp(tr.getWorldPosition(), target, Math.min(1, dt * 2.2)) : target
    this.placed = true
    tr.setWorldPosition(pos)
    const toCam = cam.sub(pos)
    tr.setWorldRotation(quat.angleAxis(Math.atan2(toCam.x, toCam.z), vec3.up()))
  }

  private line(
    name: string, s: string, y: number, size: number, spacing: number, rgba: number[], font: Font,
    timing: {delay: number; dur: number}, outLead: number, bold: boolean, scale: number
  ) {
    if (!s) return
    try {
      const o = global.scene.createSceneObject("title_" + name)
      o.setParent(this.root)
      o.getTransform().setLocalScale(vec3.one().uniformScale(scale))
      const t = o.createComponent("Component.Text") as Text
      t.renderOrder = 900
      if (font) t.font = font
      t.text = s
      t.size = size
      t.letterSpacing = spacing
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.worldSpaceRect = Rect.create(-TEXT_W / 2 / scale, TEXT_W / 2 / scale, -3, 3)
      t.horizontalOverflow = HorizontalOverflow.Shrink
      t.verticalOverflow = VerticalOverflow.Overflow
      try {
        // Faux bold in the fill's own colour (black outlines vanish on the additive display).
        t.outlineSettings.enabled = bold
        t.outlineSettings.size = 0.05
      } catch (e) {
        // No outline support: plain text is fine.
      }
      this.lines.push({obj: o, text: t, rgba, y, inDelay: timing.delay, inDur: timing.dur, outLead})
    } catch (e) {
      print("[Retrospecs] title text failed: " + e)
    }
  }
}

function clamp01(k: number): number {
  return Math.max(0, Math.min(1, k))
}

function easeOut(k: number): number {
  return 1 - Math.pow(1 - k, 3)
}

function easeIn(k: number): number {
  return k * k
}

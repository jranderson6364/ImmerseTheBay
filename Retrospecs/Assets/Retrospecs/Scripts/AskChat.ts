/**
 * The "ask" chat window: a sticky panel in front of the wearer, above the focus card, showing the question asked
 * through the bubble and the live answer, with a big X to close it.
 *
 * Plain class (no scene wiring): the controller creates it with a material and the camera, calls update() every
 * frame, and routes right pinches / Preview taps to closeUnderRay() / rayOnWindow(). It follows lazily: it stays put
 * while the wearer looks around a little, and glides back in front of them after they turn or walk away.
 *
 * Every string on it is the visitor's own question, the answer text, its source line, or a fixed UI label.
 */
import {Rect2, frameRects, quadsChunk} from "../Core/Focus"
import {MeshChunk} from "../Core/MapMesh"
import {crossChunk, inRect} from "../Core/CardLayout"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"

// Same text metrics as the info panel (cm per point of size).
const LINE_CM_PER_PT = 0.032
const CHAR_CM_PER_PT = 0.0112

// Additive display: black is see-through, brightness is opacity.
const C = {
  fill: [0.06, 0.07, 0.09, 1],
  frame: [0.55, 0.85, 1.0, 1],
  accent: [0.4, 0.8, 1.0, 1],
  heading: [0.65, 0.9, 1.0, 1],
  question: [0.85, 0.82, 0.75, 1],
  answer: [1, 0.98, 0.94, 1],
  source: [0.7, 0.72, 0.75, 1],
  closeFill: [0.55, 0.12, 0.14, 1],
  closeFillHover: [0.95, 0.25, 0.28, 1],
  closeMark: [1, 0.92, 0.9, 1],
  rim: [0.95, 0.82, 0.58, 1],
  rimHover: [0.7, 1.0, 1.0, 1]
}

/** Layout knobs (cm, at the window's own distance). */
export interface AskChatOptions {
  distanceCm: number
  widthCm: number
  /** Centre height above eye level (degrees). Above the focus card, which sits about 12 degrees below. */
  elevationDeg: number
  /** Re-centre after turning this far (degrees) or walking this far (cm). */
  followDeg: number
  followCm: number
}

export const DEFAULT_ASK_CHAT: AskChatOptions = {distanceCm: 110, widthCm: 46, elevationDeg: 9, followDeg: 22, followCm: 45}

function wrappedLines(s: string, charsPerLine: number): number {
  let lines = 1
  let len = 0
  for (const word of s.split(/\s+/).filter((x) => !!x)) {
    const add = len === 0 ? word.length : len + 1 + word.length
    if (add <= charsPerLine || len === 0) len = add
    else {
      lines++
      len = word.length
    }
    while (len > charsPerLine) {
      lines++
      len -= charsPerLine
    }
  }
  return lines
}

function textHeight(s: string, w: number, size: number): number {
  return wrappedLines(s, Math.max(1, Math.floor(w / (CHAR_CM_PER_PT * size)))) * LINE_CM_PER_PT * size
}

interface Part {
  material?: Material
  text?: Text
  rgba: number[]
}

type ChatState = "listening" | "thinking" | "answer" | "error"

export class AskChat {
  private root: SceneObject = null
  private parts: Part[] = []
  private closeParts: {part: Part; base: number[]; hover: number[]}[] = []
  private closeHit: Rect2 = null
  private hitTarget: Interactable = null
  private hovered = false
  private open = false
  private fade = 0
  /** Where the window sits (world) and the head pose it was centred for. */
  private pos: vec3 = null
  private goal: vec3 = null
  private anchorEye: vec3 = null
  private anchorYaw = 0
  private state: ChatState = null
  private heading = ""
  /** The question / live-transcript line, updated in place while listening. */
  private questionText: Text = null

  constructor(
    private material: Material,
    private camera: SceneObject,
    private font: Font = null,
    private opts: AskChatOptions = DEFAULT_ASK_CHAT
  ) {}

  isOpen(): boolean {
    return this.open
  }

  showListening(heading: string, partial = "") {
    const line = partial ? `“${partial}”` : "Listening… ask me anything."
    // Partials arrive several times a second: update the text in place instead of rebuilding the window.
    if (this.open && this.state === "listening" && this.root && this.questionText && heading === this.heading) {
      try {
        this.questionText.text = line
        return
      } catch (e) {
        // Fall through to a rebuild.
      }
    }
    this.render("listening", heading, line, "", "")
  }

  showThinking(heading: string, question: string) {
    this.render("thinking", heading, question, "Looking that up…", "")
  }

  showAnswer(heading: string, question: string, answer: string, source: string) {
    this.render("answer", heading, question, answer, source)
  }

  showError(heading: string, question: string, message: string) {
    this.render("error", heading, question, message, "")
  }

  hide() {
    this.open = false
  }

  /** True while the right-hand ray (or the Preview mouse) is on the window. */
  rayOnWindow(): boolean {
    return this.hitPoint() !== null
  }

  /** True if the ray is on the X. */
  closeUnderRay(): boolean {
    const p = this.hitPoint()
    return !!p && !!this.closeHit && inRect(this.closeHit, p.x, p.y)
  }

  /** Call once per frame. */
  update(dt: number) {
    if (!this.root) return
    this.fade = Math.max(0, Math.min(1, this.fade + (this.open ? dt : -dt) / 0.25))
    if (!this.open && this.fade <= 0) {
      this.destroyRoot()
      return
    }
    this.follow(dt)
    const hov = this.open && this.closeUnderRay()
    if (hov !== this.hovered) {
      this.hovered = hov
      for (const c of this.closeParts) c.part.rgba = hov ? c.hover : c.base
    }
    const k = this.fade
    for (const p of this.parts) {
      const c = new vec4(p.rgba[0] * k, p.rgba[1] * k, p.rgba[2] * k, p.rgba[3] * k)
      try {
        if (p.material) p.material.mainPass.baseColor = c
        if (p.text) p.text.textFill.color = c
      } catch (e) {
        // No colour slot: leave as is.
      }
    }
  }

  // -------------------------------------------------------------------------
  // Placement: lazy head follow

  private head(): {eye: vec3; yaw: number} {
    const t = this.camera.getTransform()
    const eye = t.getWorldPosition()
    const v = vec3.up().cross(t.right) // stays defined when looking down
    const yaw = Math.hypot(v.x, v.z) > 1e-4 ? Math.atan2(v.x, v.z) : this.anchorYaw
    return {eye, yaw}
  }

  private spotFor(eye: vec3, yaw: number): vec3 {
    const d = this.opts.distanceCm
    const up = d * Math.tan((this.opts.elevationDeg * Math.PI) / 180)
    return new vec3(eye.x + Math.sin(yaw) * d, eye.y + up, eye.z + Math.cos(yaw) * d)
  }

  private recentre() {
    const h = this.head()
    this.anchorEye = h.eye
    this.anchorYaw = h.yaw
    this.goal = this.spotFor(h.eye, h.yaw)
  }

  private follow(dt: number) {
    const h = this.head()
    if (!this.goal) this.recentre()
    let dy = h.yaw - this.anchorYaw
    while (dy > Math.PI) dy -= 2 * Math.PI
    while (dy < -Math.PI) dy += 2 * Math.PI
    const walked = Math.hypot(h.eye.x - this.anchorEye.x, h.eye.z - this.anchorEye.z)
    if (Math.abs(dy) > (this.opts.followDeg * Math.PI) / 180 || walked > this.opts.followCm) this.recentre()
    this.pos = this.pos ? vec3.lerp(this.pos, this.goal, 1 - Math.exp(-dt * 5)) : this.goal
    const tr = this.root.getTransform()
    tr.setWorldPosition(this.pos)
    const d = h.eye.sub(this.pos)
    const yaw = quat.angleAxis(Math.atan2(d.x, d.z), vec3.up())
    const pitch = quat.angleAxis(-Math.atan2(d.y, Math.hypot(d.x, d.z)), vec3.right())
    tr.setWorldRotation(yaw.multiply(pitch))
  }

  // -------------------------------------------------------------------------
  // Content

  private render(state: ChatState, heading: string, question: string, answer: string, source: string) {
    if (!this.material || !this.camera) return
    const keepPos = this.root ? this.pos : null
    this.destroyRoot()
    this.root = global.scene.createSceneObject("AskChat")
    if (!keepPos || !this.open) {
      this.recentre()
      this.pos = this.goal
    } else this.pos = keepPos
    this.open = true
    this.state = state
    this.heading = heading
    if (this.fade <= 0) this.fade = 0.01

    const W = this.opts.widthCm
    const pad = 1.6
    const closeSize = 5.2
    const textW = W - 2 * pad
    const sizes = {heading: 40, question: 40, answer: 48, source: 32}
    const headH = Math.max(closeSize, LINE_CM_PER_PT * sizes.heading * 1.1)
    const qText = state === "listening" ? question : `You: ${question}`
    // Listening: room for about two lines, so the live transcript fits without resizing the window.
    const qMeasure = state === "listening" ? (qText.length > 160 ? qText : "x".repeat(160)) : qText
    const qH = question ? textHeight(qMeasure, textW, sizes.question) * 1.08 : 0
    const aH = answer ? textHeight(answer, textW, sizes.answer) * 1.08 : 0
    const sH = source ? textHeight(source, textW, sizes.source) * 1.08 : 0
    const gap = 0.9
    const H = pad + headH + gap + qH + (aH ? gap + aH : 0) + (sH ? gap * 0.6 + sH : 0) + pad
    const card = {x0: -W / 2, y0: -H / 2, x1: W / 2, y1: H / 2}

    this.quads([card], C.fill, -0.05)
    this.quads(frameRects(card, 0.3), C.frame, 0)
    this.quads([{x0: card.x0, y0: card.y1 - 0.5, x1: card.x1, y1: card.y1}], C.accent, 0.01)

    let y = card.y1 - pad
    // Heading row, X on the right.
    const headW = textW - closeSize - 1
    this.text(heading, card.x0 + pad + headW / 2, y - headH / 2, headW, headH, sizes.heading, C.heading)
    const close = {x0: card.x1 - pad - closeSize, y0: y - closeSize, x1: card.x1 - pad, y1: y}
    // Hit box at least ~3.5 degrees at the window's distance, overhanging the corner.
    const grow = 1.6
    this.closeHit = {x0: close.x0 - grow, y0: close.y0 - grow, x1: close.x1 + grow, y1: close.y1 + grow}
    this.closeParts = []
    this.closePart(() => this.quads([close], C.closeFill, 0.03), C.closeFill, C.closeFillHover)
    this.closePart(() => this.quads(frameRects(close, 0.35), C.rim, 0.04), C.rim, C.rimHover)
    this.closePart(() => this.chunk(crossChunk(close, 0.9, 0.05), C.closeMark), C.closeMark, [1, 1, 1, 1])
    this.hovered = false
    y -= headH + gap
    if (qH) {
      this.questionText = this.text(qText, 0, y - qH / 2, textW, qH, sizes.question, C.question)
      y -= qH
    }
    if (aH) {
      y -= gap
      this.text(answer, 0, y - aH / 2, textW, aH, sizes.answer, state === "error" ? C.source : C.answer)
      y -= aH
    }
    if (sH) {
      y -= gap * 0.6
      this.text(source, 0, y - sH / 2, textW, sH, sizes.source, C.source)
    }
    this.makeHitTarget({x0: card.x0 - 1, y0: card.y0 - 1, x1: card.x1 + grow, y1: card.y1 + grow})
    this.update(0)
  }

  private closePart(add: () => void, base: number[], hover: number[]) {
    const n = this.parts.length
    add()
    for (let i = n; i < this.parts.length; i++) this.closeParts.push({part: this.parts[i], base, hover})
  }

  private quads(rects: Rect2[], rgba: number[], z: number) {
    this.chunk(quadsChunk(rects, z), rgba)
  }

  private chunk(chunk: MeshChunk, rgba: number[]) {
    if (!chunk.idx.length) return
    const o = global.scene.createSceneObject("ask_chat_part")
    o.setParent(this.root)
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
    const m = this.material.clone()
    visual.mainMaterial = m
    this.parts.push({material: m, rgba})
  }

  private text(s: string, cx: number, cy: number, w: number, h: number, size: number, rgba: number[]): Text {
    const o = global.scene.createSceneObject("ask_chat_text")
    o.setParent(this.root)
    o.getTransform().setLocalPosition(new vec3(cx, cy, 0.08))
    try {
      const t = o.createComponent("Component.Text") as Text
      if (this.font) t.font = this.font
      t.text = s
      t.size = size
      t.horizontalAlignment = HorizontalAlignment.Left
      t.verticalAlignment = VerticalAlignment.Top
      t.worldSpaceRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
      t.horizontalOverflow = HorizontalOverflow.Wrap
      t.verticalOverflow = VerticalOverflow.Overflow
      t.sizeToFit = false
      this.parts.push({text: t, rgba})
      return t
    } catch (e) {
      print("[Retrospecs] ask chat text failed: " + e)
      return null
    }
  }

  private makeHitTarget(r: Rect2) {
    try {
      const o = global.scene.createSceneObject("ask_chat_ray_target")
      o.setParent(this.root)
      o.getTransform().setLocalPosition(new vec3((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0.2))
      const collider = o.createComponent("Physics.ColliderComponent") as ColliderComponent
      collider.fitVisual = false
      const box = Shape.createBoxShape()
      box.size = new vec3(Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0), 1)
      collider.shape = box
      // Collider before Interactable: SIK collects the colliders when the Interactable registers.
      const it = o.createComponent(Interactable.getTypeName()) as Interactable
      it.targetingMode = 2 // TargetingMode.Indirect
      this.hitTarget = it
    } catch (e) {
      print("[Retrospecs] ask chat: ray target unavailable: " + e)
    }
  }

  /** The ray's hit on the window in window-local cm, or null. */
  private hitPoint(): vec3 | null {
    if (!this.root || !this.open || !this.hitTarget) return null
    try {
      const inv = this.root.getTransform().getInvertedWorldTransform()
      for (const it of SIK.InteractionManager.getTargetingInteractors()) {
        if (!(it.inputType & (InteractorInputType.RightHand | InteractorInputType.Mouse))) continue
        const info = it.targetHitInfo
        if (info && info.interactable === this.hitTarget && info.hit) return inv.multiplyPoint(info.hit.position)
      }
    } catch (e) {
      // SIK not ready.
    }
    return null
  }

  private destroyRoot() {
    this.questionText = null
    this.parts = []
    this.closeParts = []
    this.closeHit = null
    this.hitTarget = null
    if (this.root && !isNull(this.root)) this.root.destroy()
    this.root = null
  }
}

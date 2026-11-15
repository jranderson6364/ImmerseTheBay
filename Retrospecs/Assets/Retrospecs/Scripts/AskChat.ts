/**
 * The "ask" chat window: a sticky panel in front of the wearer, above the focus card. The card's Ask button opens it
 * listening (a pulsing mic and the live transcript) with suggested-question chips to tap instead of speaking; it then
 * shows the question and the answer, with a big X to close it.
 *
 * Plain class (no scene wiring): the controller creates it with a material and the camera, calls update() every
 * frame, and routes right pinches / Preview taps to closeUnderRay() / chipUnderRay() / rayOnWindow(). It follows lazily: it stays put
 * while the wearer looks around a little, and glides back in front of them after they turn or walk away.
 *
 * Every string on it is the visitor's own question, the answer text, its source line, or a fixed UI label.
 */
import {Rect2, frameRects, quadsChunk} from "../Core/Focus"
import {MeshChunk} from "../Core/MapMesh"
import {crossChunk, inRect, micGlyphRects, shapeChunk, shapeFrameChunk} from "../Core/CardLayout"
import {CardTheme, RENDER_BASE, TEXT_LAYER, cornerFor, lighten, meshLayer, themeFor} from "../Core/CardTheme"
import {playSfx} from "../Core/Sfx"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"

// Same text metrics as the info panel (cm per point of size).
const LINE_CM_PER_PT = 0.032
const CHAR_CM_PER_PT = 0.0112

// Additive display: black is see-through, brightness is opacity. Colours come from the focused card's theme
// (Core/CardTheme), so the window reads as part of the card that opened it: dark panel, thin rim, accent kicker.
function palette(t: CardTheme) {
  const white = [1, 1, 1, 1]
  return {
    fill: t.top,
    frame: t.rim,
    accent: t.accent,
    heading: t.accent,
    question: [0.82, 0.8, 0.76, 1],
    answer: [1, 0.98, 0.95, 1],
    source: [0.66, 0.64, 0.6, 1],
    closeFill: t.bottom,
    closeFillHover: lighten(t.button[1], 0.05),
    closeMark: white,
    rim: t.rim,
    rimHover: white,
    mic: t.accent,
    micMark: t.bottom,
    chipFill: lighten(t.top, 0.05),
    chipFillHover: t.button[1],
    chipRim: t.rim,
    chipRimHover: white,
    chipText: [0.96, 0.95, 0.92, 1],
    chipTextHover: white
  }
}

/** "Ask · Main Quad" → "ASK ME MORE · MAIN QUAD": the window's kicker, named like the button that opens it. */
export function chatKicker(heading: string): string {
  return heading.replace(/^Ask\b/, "Ask Me More").toUpperCase()
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
  /** Suggested-question chips: hit boxes (window cm) and their parts, for hover and the demo's pulse. */
  private chipHits: Rect2[] = []
  private chipParts: {part: Part; base: number[]; hover: number[]}[][] = []
  private pulseChip = -1
  private clock = 0
  /** The listening mic's parts: they pulse while the mic is open. */
  private micParts: Part[] = []
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
  private theme: CardTheme = themeFor("")

  constructor(
    private material: Material,
    private camera: SceneObject,
    private font: Font = null,
    private opts: AskChatOptions = DEFAULT_ASK_CHAT
  ) {}

  isOpen(): boolean {
    return this.open
  }

  /** The focused card (its colours style the window from the next render on). */
  setTheme(cardId: string) {
    this.theme = themeFor(cardId)
  }

  /** The mic is open. `chips`: suggested questions to tap instead of speaking. */
  showListening(heading: string, partial = "", chips: string[] = []) {
    const line = partial ? `“${partial}”` : chips.length ? "Listening… say anything, or tap one:" : "Listening… ask me anything."
    // Partials arrive several times a second: update the text in place instead of rebuilding the window.
    const sameChips = chips.length === this.chipHits.length
    if (this.open && this.state === "listening" && this.root && this.questionText && heading === this.heading && sameChips) {
      try {
        this.questionText.text = line
        return
      } catch (e) {
        // Fall through to a rebuild.
      }
    }
    this.render("listening", heading, line, "", "", chips)
  }

  showThinking(heading: string, question: string) {
    this.render("thinking", heading, question, "…", "")
  }

  /** `chips`: follow-up questions to tap. */
  showAnswer(heading: string, question: string, answer: string, source: string, chips: string[] = []) {
    this.render("answer", heading, question, answer, source, chips)
  }

  showError(heading: string, question: string, message: string, chips: string[] = []) {
    this.render("error", heading, question, message, "", chips)
  }

  /** The chip under the ray (index), or -1. */
  chipUnderRay(): number {
    const p = this.hitPoint()
    if (!p) return -1
    for (let i = 0; i < this.chipHits.length; i++) if (inRect(this.chipHits[i], p.x, p.y)) return i
    return -1
  }

  /** Locked demo: chip `i` blinks to show what to tap (-1 = none). */
  setPulseChip(i: number) {
    this.pulseChip = i
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
    this.clock += dt
    const hov = this.open && this.closeUnderRay()
    if (hov !== this.hovered) {
      this.hovered = hov
      for (const c of this.closeParts) c.part.rgba = hov ? c.hover : c.base
    }
    const chip = this.open ? this.chipUnderRay() : -1
    const blink = this.pulseChip >= 0 && Math.floor(this.clock / 0.6) % 2 === 0
    for (let i = 0; i < this.chipParts.length; i++) {
      const on = i === chip || (blink && i === this.pulseChip)
      for (const c of this.chipParts[i]) c.part.rgba = on ? c.hover : c.base
    }
    // The open mic breathes, so it's obvious it is listening.
    const breathe = this.state === "listening" ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.clock * 5)) : 1
    const k = this.fade
    for (const p of this.parts) {
      const m = this.micParts.indexOf(p) >= 0 ? k * breathe : k
      const c = new vec4(p.rgba[0] * m, p.rgba[1] * m, p.rgba[2] * m, p.rgba[3] * m)
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

  private render(state: ChatState, heading: string, question: string, answer: string, source: string, chips: string[] = []) {
    if (!this.material || !this.camera) return
    const keepPos = this.root ? this.pos : null
    // Whoosh as the window opens, and again (softer) when an answer lands in it.
    if (!this.open) playSfx("whoosh")
    else if (state === "answer" && this.state !== "answer") playSfx("whoosh", 0.6)
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
    const C = palette(this.theme)
    const corner = cornerFor(this.theme)
    const sizes = {heading: 34, question: 40, answer: 48, source: 32, chip: 40}
    const headH = Math.max(closeSize, LINE_CM_PER_PT * sizes.heading * 1.1)
    const qText = state === "listening" ? question : `You: ${question}`
    // Listening: room for about two lines, so the live transcript fits without resizing the window.
    const qMeasure = state === "listening" ? (qText.length > 160 ? qText : "x".repeat(160)) : qText
    const qH = question ? textHeight(qMeasure, textW, sizes.question) * 1.08 : 0
    const aH = answer ? textHeight(answer, textW, sizes.answer) * 1.08 : 0
    const sH = source ? textHeight(source, textW, sizes.source) * 1.08 : 0
    const gap = 0.9
    // Chips: one full-width row each, about 3 degrees tall at the window's distance.
    const chipH = 5.6, chipGap = 0.8
    const chipsH = chips.length ? gap * 1.4 + chips.length * chipH + (chips.length - 1) * chipGap : 0
    const H = pad + headH + gap + qH + (aH ? gap + aH : 0) + (sH ? gap * 0.6 + sH : 0) + chipsH + pad
    const card = {x0: -W / 2, y0: -H / 2, x1: W / 2, y1: H / 2}

    // Window: the card's dark panel with its thin rim and corner style (rounded, cut or square).
    const winRad = corner.radius > 0 ? (corner.chamfer ? 2.4 : 1.8) : 0
    this.chunk(shapeChunk(card, winRad, corner.chamfer, -0.05), C.fill)
    this.chunk(shapeFrameChunk(card, winRad, 0.25, corner.chamfer, 0), C.frame)

    let y = card.y1 - pad
    // Heading row: the accent kicker ("ASK ME MORE · MAIN QUAD") with a short rule, X on the right.
    const headW = textW - closeSize - 1
    const kicker = chatKicker(heading)
    this.text(kicker, card.x0 + pad + headW / 2, y - headH / 2, headW, headH, sizes.heading, C.heading)
    const close = {x0: card.x1 - pad - closeSize, y0: y - closeSize, x1: card.x1 - pad, y1: y}
    // Hit box at least ~3.5 degrees at the window's distance, overhanging the corner.
    const grow = 1.6
    this.closeHit = {x0: close.x0 - grow, y0: close.y0 - grow, x1: close.x1 + grow, y1: close.y1 + grow}
    this.closeParts = []
    const closeRad = closeSize * corner.radius * 0.8
    this.closePart(() => this.chunk(shapeChunk(close, closeRad, corner.chamfer, 0.03), C.closeFill), C.closeFill, C.closeFillHover)
    this.closePart(() => this.chunk(shapeFrameChunk(close, closeRad, 0.25, corner.chamfer, 0.04), C.rim), C.rim, C.rimHover)
    this.closePart(() => this.chunk(crossChunk(close, 0.55, 0.05), C.closeMark), C.closeMark, [1, 1, 1, 1])
    this.hovered = false
    y -= headH + gap * 0.5
    // Thin accent rule under the kicker, like the year rule on the card.
    this.quads([{x0: card.x0 + pad, y0: y - 0.12, x1: card.x0 + pad + 6, y1: y + 0.12}], C.accent, 0.01)
    y -= gap * 0.5
    this.micParts = []
    if (qH) {
      if (state === "listening") {
        // An accent mic badge left of the transcript; it breathes in update().
        const m = Math.min(qH, 4.6)
        const n = this.parts.length
        const mx = card.x0 + pad + m / 2, my = y - m / 2
        this.chunk(shapeChunk({x0: mx - m / 2, y0: my - m / 2, x1: mx + m / 2, y1: my + m / 2}, m / 2, false, 0.03), C.mic)
        this.quads(micGlyphRects(mx, my, m * 0.62), C.micMark, 0.04)
        for (let i = n; i < this.parts.length; i++) this.micParts.push(this.parts[i])
        const w = textW - m - 1
        this.questionText = this.text(qText, card.x0 + pad + m + 1 + w / 2, y - qH / 2, w, qH, sizes.question, C.question)
      } else this.questionText = this.text(qText, 0, y - qH / 2, textW, qH, sizes.question, C.question)
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
      y -= sH
    }
    this.chipHits = []
    this.chipParts = []
    if (chips.length) {
      y -= gap * 1.4
      for (let i = 0; i < chips.length; i++) {
        const r = {x0: card.x0 + pad, y0: y - chipH, x1: card.x1 - pad, y1: y}
        const parts: {part: Part; base: number[]; hover: number[]}[] = []
        const add = (fn: () => void, base: number[], hover: number[]) => {
          const n = this.parts.length
          fn()
          for (let j = n; j < this.parts.length; j++) parts.push({part: this.parts[j], base, hover})
        }
        const chipRad = chipH * corner.radius
        add(() => this.chunk(shapeChunk(r, chipRad, corner.chamfer, 0.02), C.chipFill), C.chipFill, C.chipFillHover)
        add(() => this.chunk(shapeFrameChunk(r, chipRad, 0.2, corner.chamfer, 0.03), C.chipRim), C.chipRim, C.chipRimHover)
        // One line, always: shrink a long suggestion to fit the chip instead of wrapping into the chip below.
        const label = "›  " + chips[i]
        const lw = textW - 4
        const fit = Math.min(sizes.chip, lw / (CHAR_CM_PER_PT * Math.max(1, label.length)))
        add(() => this.text(label, 0, (r.y0 + r.y1) / 2, lw, chipH * 0.7, Math.max(18, Math.floor(fit)), C.chipText, true), C.chipText, C.chipTextHover)
        this.chipParts.push(parts)
        // Hit boxes split the gaps between rows, so there's no dead strip between chips.
        this.chipHits.push({x0: r.x0 - 1, y0: r.y0 - chipGap / 2, x1: r.x1 + 1, y1: r.y1 + chipGap / 2})
        y -= chipH + chipGap
      }
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
    // Fixed draw order by layer, text above all (Core/CardTheme): parts never swap as the head moves.
    const z = chunk.verts.length > 2 ? chunk.verts[2] : 0
    visual.renderOrder = RENDER_BASE.chat + meshLayer(z)
    const m = this.material.clone()
    if (z > 0) {
      try {
        m.mainPass.depthWrite = false
      } catch (e) {
        // No depth settings: the draw order still holds.
      }
    }
    visual.mainMaterial = m
    this.parts.push({material: m, rgba})
  }

  /** `middle`: centred vertically in its box (chips). */
  private text(s: string, cx: number, cy: number, w: number, h: number, size: number, rgba: number[], middle = false): Text {
    const o = global.scene.createSceneObject("ask_chat_text")
    o.setParent(this.root)
    o.getTransform().setLocalPosition(new vec3(cx, cy, 0.2))
    try {
      const t = o.createComponent("Component.Text") as Text
      t.renderOrder = RENDER_BASE.chat + TEXT_LAYER
      if (this.font) t.font = this.font
      t.text = s
      t.size = size
      t.horizontalAlignment = HorizontalAlignment.Left
      t.verticalAlignment = middle ? VerticalAlignment.Center : VerticalAlignment.Top
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
    this.chipHits = []
    this.chipParts = []
    this.micParts = []
    this.closeHit = null
    this.hitTarget = null
    if (this.root && !isNull(this.root)) this.root.destroy()
    this.root = null
  }
}

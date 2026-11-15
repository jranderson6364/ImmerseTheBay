/**
 * Focus-mode info screen: a floating "TV" in front of the wearer at about eye height (Core/Focus.ts `sharedWall`),
 * not glued to the map. It flies out of the selected building to its place on the wall, faces the wearer, and only
 * re-centres when the wearer turns or walks well away (lazy follow, smoothed). The exploded model and the
 * per-building experience ride the same wall as flanking screens (RetrospecsShowcase / RetrospecsExperiences).
 *
 * It shows the building's name, its namesake line (`Card.namesake`), the fact being spoken, and one graphic for a
 * number already written in that fact (see `panelGraphic`). For the buildings Nazeli Sayra Kurtoğlu drew (Huang,
 * HP Garage), a large framed art screen sits on top of the card, with her credit under it.
 *
 * It never invents facts: every string on it is Card / Fact text from Core/Cards.ts, a number lifted from that text,
 * the caller's `sourceLine`, or the artist credit.
 *
 * Usage: show(card, fact, anchorWorld, faceToward?, sourceLine?) once, setAnchor(worldPos) each frame while focused
 * (the building top: the screen keeps clear of the line of sight to it, and flies back into it on hide()).
 */
import {Card, Fact} from "../Core/Cards"
import {
  ARTIST_CREDIT, PanelGraphic, Rect2, TV_WALL, easeInOut, fitMedia, frameRects, panelGraphic, quadsChunk, sharedWall, stepBlend,
  wallSlots, yawOf
} from "../Core/Focus"
import {MeshChunk} from "../Core/MapMesh"

// Additive display: black is see-through, brightness is opacity. A dim fill gives the screen a body; the bright frame,
// accent bar and graphic carry the shape.
const PANEL_COLORS: Record<string, number[]> = {
  fill: [0.075, 0.062, 0.045, 1],
  frame: [0.95, 0.82, 0.58, 1],
  accent: [1.0, 0.72, 0.28, 1],
  track: [0.3, 0.25, 0.18, 1],
  bar: [1.0, 0.86, 0.5, 1],
  title: [1, 1, 1, 1],
  namesake: [1.0, 0.8, 0.45, 1],
  body: [0.95, 0.93, 0.88, 1],
  big: [1.0, 0.95, 0.75, 1],
  caption: [0.8, 0.76, 0.68, 1],
  artFill: [0.03, 0.025, 0.02, 1],
  credit: [1.0, 0.82, 0.55, 1]
}

interface FadePart {
  material?: Material
  text?: Text
  rgba: number[]
}

interface ArtItem {
  id: string
  tex: Texture
}

/** Nazeli's Lens-ready art, loaded by path when the Inspector slots are empty (see Art/nazeli_samples/README.md). */
let builtinArt: ArtItem[] = null
let builtinMaterial: Material = null

function tryAsset(load: () => Asset, label: string): Asset {
  try {
    const a = load()
    if (a) return a
  } catch (e) {
    print(`[Retrospecs] art: requireAsset failed for ${label}: ${e}`)
  }
  return null
}

function loadBuiltinArt(): ArtItem[] {
  if (builtinArt) return builtinArt
  builtinArt = []
  // Literal paths (relative to this script) so the asset references are visible to Lens Studio.
  const anim = tryAsset(() => requireAsset("../Art/hpgarage/hpgarage_nazeli_anim.mp4"), "hpgarage anim")
  const garage = tryAsset(() => requireAsset("../Art/hpgarage/hpgarage_nazeli_art.png"), "hpgarage art")
  const huang = tryAsset(() => requireAsset("../Art/huang/huang_nazeli_art.png"), "huang art")
  if (anim) builtinArt.push({id: "hpgarage", tex: anim as Texture})
  if (garage) builtinArt.push({id: "hpgarage", tex: garage as Texture})
  if (huang) builtinArt.push({id: "huang", tex: huang as Texture})
  print(`[Retrospecs] art: built-in Nazeli art loaded: hpgarage anim ${!!anim}, hpgarage still ${!!garage}, huang ${!!huang}`)
  return builtinArt
}

function loadBuiltinMaterial(): Material {
  if (builtinMaterial) return builtinMaterial
  const m = tryAsset(() => requireAsset("../../Materials/CaptureTexture.mat"), "CaptureTexture.mat")
  builtinMaterial = m ? (m as Material) : null
  print(`[Retrospecs] art: built-in media material loaded: ${!!builtinMaterial}`)
  return builtinMaterial
}

@component
export class RetrospecsInfoPanel extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Retrospecs Info Panel</span><br/><span style="color: #94A3B8; font-size: 11px;">Focus-mode screen floating in front of the wearer (wall of TVs).</span>')
  @input
  @allowUndefined
  @hint("Any material with a Base Color (e.g. Assets/Materials/White.mat). Cloned per colour. If empty, the controller passes the map's.")
  material: Material

  @input @allowUndefined @hint("Camera object (the wearer's head). Needed for the lazy follow.") camera: SceneObject
  @input @allowUndefined @hint("Optional font for the panel text (default font if empty)") font: Font

  // Kept for the controller's layout call; the screen's real size is screenWidthCm and its content.
  @input @hint("(Legacy, unused for placement)") panelWidthCm: number = 30
  @input @hint("(Legacy, unused for placement)") panelHeightCm: number = 24
  @input @hint("(Legacy, unused for placement)") panelGapCm: number = 6

  @input @hint("Main screen width (cm)") screenWidthCm: number = 60
  @input @hint("Distance from the eyes to the main screen (cm)") screenDistanceCm: number = 130
  @input @hint("Main screen centre below eye height (cm)") screenDropCm: number = 14
  @input @hint("Re-centre the screens when you turn this far away (degrees)") followAngleDeg: number = 40
  @input @hint("...or walk this far (cm)") followDistanceCm: number = 45
  @input @hint("Seconds to fly out / back") appearSec: number = 0.6
  @input @hint("Fly out of the building (on) or fade in at the wall (off)") flyFromBuilding: boolean = true

  @input @hint("Largest text sizes: text wraps, then shrinks only if it overflows its box") titleTextSize: number = 100
  @input namesakeTextSize: number = 58
  @input bodyTextSize: number = 50
  @input smallTextSize: number = 40

  // Artist media (Nazeli's illustrations and animation), shown as a large framed screen on top of the card.
  @input @hint("Show artist art screens. Turn off to compare with the plain card.") showMedia: boolean = true
  @input @allowUndefined @hint("Material with a baseTex slot (Assets/Materials/CaptureTexture.mat). If empty, loaded by path.") mediaMaterial: Material
  // Four optional slots: a card id (e.g. "huang") and an image or video texture. When no slot matches a card, the
  // built-in Nazeli art for Huang and the HP Garage is used.
  @input media1Id: string = ""
  @input @allowUndefined media1Texture: Texture
  @input media2Id: string = ""
  @input @allowUndefined media2Texture: Texture
  @input media3Id: string = ""
  @input @allowUndefined media3Texture: Texture
  @input media4Id: string = ""
  @input @allowUndefined media4Texture: Texture
  @input @hint("Largest art size (cm)") artMaxWidthCm: number = 56
  @input artMaxHeightCm: number = 24
  @input @hint("Raise the screen this much when it has art, so the art and the title share the central view (cm)") artLiftCm: number = 8
  @input @hint("Seconds per art piece when a building has several") artCycleSec: number = 8

  private root: SceneObject = null
  private parts: FadePart[] = []
  private t = 0
  private target = 0
  private anchor: vec3 = null
  private faceToward: vec3 = null
  private videos: VideoTextureProvider[] = []
  private artObjs: SceneObject[] = []
  private artIndex = 0
  private artClock = 0
  private blockHeight = 40
  private placed: vec3 = null
  private lift = 0
  /** Fly between the building and the wall (fresh show and hide); off when only the card content changes. */
  private fly = true

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    // Load Nazeli's built-in art up front, so the load result is in the log at Lens start (not only on focus).
    if (this.showMedia) {
      try {
        loadBuiltinArt()
        if (!this.mediaMaterial) loadBuiltinMaterial()
      } catch (e) {
        print("[Retrospecs] art: preload failed: " + e)
      }
    }
  }

  isShowing(): boolean {
    return this.target > 0
  }

  /** Builds the screen for `card` / `fact` (fact may be null: name and namesake only) and flies it out. */
  show(card: Card, fact: Fact | null, anchorWorld: vec3, faceToward?: vec3, sourceLine?: string) {
    if (!card || !this.material) return
    const wasShowing = !!this.root && this.target > 0
    this.clear()
    this.publishConfig()
    this.anchor = anchorWorld
    this.faceToward = faceToward || null
    this.root = global.scene.createSceneObject("RetrospecsInfoPanel")
    this.build(card, fact, sourceLine)
    TV_WALL.mainWidthCm = this.screenWidthCm
    // The block is lifted by `lift` inside the root: publish the height that puts its bottom edge where it really is.
    TV_WALL.mainHeightCm = Math.max(10, this.blockHeight - 2 * this.lift)
    // Place the wall in front of the wearer the first time; moving focus between buildings keeps it where it is.
    if (!sharedWall.active) {
      const eye = this.eye()
      if (eye) sharedWall.reset(eye, this.viewYaw(eye))
    }
    // Switching cards while showing: appear in place (no second fly-out).
    this.fly = !wasShowing
    this.t = wasShowing ? 0.6 : 0
    this.target = 1
    this.placed = null
    this.apply(0)
  }

  /** The focused building's top (world). The screen keeps clear of the line of sight to it and flies back into it. */
  setAnchor(anchorWorld: vec3) {
    this.anchor = anchorWorld
  }

  /** Flies back into the building, then removes itself. */
  hide() {
    this.fly = true
    this.target = 0
  }

  // -------------------------------------------------------------------------
  // Wall placement

  private publishConfig() {
    TV_WALL.distanceCm = Math.max(60, this.screenDistanceCm)
    TV_WALL.dropCm = this.screenDropCm
    TV_WALL.followDeg = this.followAngleDeg
    TV_WALL.followCm = this.followDistanceCm
  }

  private eye(): vec3 {
    if (this.camera) return this.camera.getTransform().getWorldPosition()
    return this.faceToward
  }

  /** The wearer's heading: from up x camera-right, so it stays defined when looking down at the floor map. */
  private viewYaw(eye: vec3): number {
    if (this.camera) {
      const v = vec3.up().cross(this.camera.getTransform().right)
      if (Math.hypot(v.x, v.z) > 1e-4) return yawOf(v.x, v.z)
    }
    if (this.anchor) return yawOf(this.anchor.x - eye.x, this.anchor.z - eye.z)
    return 0
  }

  private onUpdate() {
    if (!this.root) return
    const dt = getDeltaTime()
    if (this.camera && sharedWall.active) {
      const eye = this.camera.getTransform().getWorldPosition()
      sharedWall.update(eye, this.viewYaw(eye), dt)
    }
    this.t = stepBlend(this.t, this.target, dt, this.appearSec)
    if (this.t <= 0 && this.target <= 0) {
      this.clear()
      sharedWall.deactivate()
      return
    }
    this.cycleArt(dt)
    this.apply(dt)
  }

  /** Position, facing, scale and fade for the current blend. */
  private apply(dt: number) {
    if (!this.root || !sharedWall.active) return
    const k = easeInOut(this.t)
    const top = this.anchor ? sharedWall.toLocal(this.anchor) : undefined
    const slot = sharedWall.toWorld(wallSlots(TV_WALL, top).main)
    let goal = new vec3(slot.x, slot.y, slot.z)
    // Smooth small slot changes (the sightline clearance moves as the map moves); the wall itself is already smooth.
    if (this.placed && dt > 0) goal = vec3.lerp(this.placed, goal, 1 - Math.exp(-dt * 8))
    this.placed = goal
    const from = this.anchor && this.flyFromBuilding && this.fly ? new vec3(this.anchor.x, this.anchor.y + 4, this.anchor.z) : goal
    const centre = vec3.lerp(from, goal, k)
    const tr = this.root.getTransform()
    tr.setWorldPosition(centre)
    tr.setWorldScale(vec3.one().uniformScale(0.12 + 0.88 * k))
    // Face the wall's eye point (not the live head), so the screen holds still like a TV.
    const o = sharedWall.origin
    const d = new vec3(o.x - centre.x, o.y - centre.y, o.z - centre.z)
    const yaw = quat.angleAxis(Math.atan2(d.x, d.z), vec3.up())
    const pitch = quat.angleAxis(-Math.atan2(d.y, Math.hypot(d.x, d.z)), vec3.right())
    tr.setWorldRotation(yaw.multiply(pitch))
    const fade = Math.min(1, k * 1.25)
    for (const p of this.parts) {
      const c = new vec4(p.rgba[0] * fade, p.rgba[1] * fade, p.rgba[2] * fade, p.rgba[3] * fade)
      try {
        if (p.material) p.material.mainPass.baseColor = c
        if (p.text) p.text.textFill.color = c
      } catch (e) {
        // Material or text without a colour: leave as is.
      }
    }
  }

  // -------------------------------------------------------------------------
  // Content

  /**
   * Card layout (cm, top to bottom): accent bar, title, namesake, divider, fact, number graphic, source line. With
   * art, a framed art screen and the credit sit above the card. The whole block is centred on the screen's slot.
   * `sourceLine` marks a live "ask further" answer: no number graphic (it would compare against "my notes"), and a
   * small provenance line ("From the web: ...") along the bottom instead.
   */
  private build(card: Card, fact: Fact | null, sourceLine?: string) {
    const W = Math.max(30, this.screenWidthCm)
    const pad = 3.2
    const inner = W - pad * 2
    const accentH = 1.0
    const titleH = 6.6
    const namesakeH = card.namesake ? 4.4 : 0
    const art = this.artFor(card.id)
    // On the art buildings her art screen takes the graphic's place, which keeps the screen inside the view.
    const g = sourceLine || art.length ? null : panelGraphic(fact)
    const factLen = fact ? fact.text.length : 0
    const bodyH = fact ? (factLen > 260 ? 19 : factLen > 160 ? 16 : 13) : 0
    const graphicH = g ? 10 : 0
    const sourceH = sourceLine ? 3.2 : 0

    let cardH = accentH + 2.2 + titleH + 0.6 + namesakeH + 2.4
    if (fact) cardH += bodyH + 1.2
    cardH += graphicH + sourceH + pad - (fact || g || sourceLine ? 0 : 1.2)

    const artBox = art.length ? this.artBox(art) : null
    const creditH = 3.4
    const artBlockH = artBox ? artBox.h + 2 * 1.0 + creditH + 1.6 : 0
    this.blockHeight = cardH + artBlockH
    this.lift = artBox ? this.artLiftCm : 0

    // Card occupies the bottom of the block.
    const y0 = -this.blockHeight / 2 + this.lift
    const y1 = y0 + cardH
    const x0 = -W / 2, x1 = W / 2
    this.quads("fill", [{x0, y0, x1, y1}], PANEL_COLORS.fill, -0.05)
    this.quads("frame", frameRects({x0, y0, x1, y1}, 0.3), PANEL_COLORS.frame, 0)
    this.quads("accent", [{x0, y0: y1 - accentH, x1, y1}], PANEL_COLORS.accent, 0.01)

    let y = y1 - accentH - 2.2
    this.text("title", card.name, 0, y - titleH / 2, inner, titleH, this.titleTextSize, PANEL_COLORS.title, HorizontalAlignment.Left)
    y -= titleH + 0.6
    if (card.namesake) {
      this.text("namesake", card.namesake, 0, y - namesakeH / 2, inner, namesakeH, this.namesakeTextSize, PANEL_COLORS.namesake, HorizontalAlignment.Left)
      y -= namesakeH
    }
    y -= 1.0
    // Divider: a short bright lead-in, then a dim rule.
    this.quads("divider", [{x0: x0 + pad + 8, y0: y - 0.12, x1: x1 - pad, y1: y + 0.12}], PANEL_COLORS.track, 0.01)
    this.quads("divider_lead", [{x0: x0 + pad, y0: y - 0.2, x1: x0 + pad + 7, y1: y + 0.2}], PANEL_COLORS.accent, 0.02)
    y -= 1.4
    if (fact) {
      this.text("fact", fact.text, 0, y - bodyH / 2, inner, bodyH, this.bodyTextSize, PANEL_COLORS.body, HorizontalAlignment.Left, VerticalAlignment.Top)
      y -= bodyH + 1.2
    }
    if (g) {
      this.buildGraphic(g, x0 + pad, x1 - pad, y - graphicH, y)
      y -= graphicH
    }
    if (sourceLine) this.text("source", sourceLine, 0, y - sourceH / 2, inner, sourceH, this.smallTextSize, PANEL_COLORS.caption, HorizontalAlignment.Left)

    if (artBox) this.buildArt(art, artBox, y1 + 1.6 + creditH)
  }

  /** Art for `cardId`: the Inspector slots if any match, else Nazeli's built-in pieces. */
  private artFor(cardId: string): ArtItem[] {
    if (!this.showMedia) return []
    const slots: [string, Texture][] = [
      [this.media1Id, this.media1Texture], [this.media2Id, this.media2Texture],
      [this.media3Id, this.media3Texture], [this.media4Id, this.media4Texture]
    ]
    const wired = slots.filter(([id, tex]) => id === cardId && !!tex).map(([id, tex]) => ({id, tex}))
    if (wired.length) return wired
    if (cardId !== "huang" && cardId !== "hpgarage") return []
    return loadBuiltinArt().filter((a) => a.id === cardId)
  }

  private aspectOf(tex: Texture): number {
    try {
      const w = tex.getWidth(), h = tex.getHeight()
      if (w > 0 && h > 0) return w / h
    } catch (e) {
      // A video before its first frame cannot report its size: 16:9 (the HP animation is 640 x 360).
    }
    return 16 / 9
  }

  /** Art area height (the tallest piece at its fitted size). */
  private artBox(art: ArtItem[]): {w: number; h: number} {
    let h = 0
    let w = 0
    for (const a of art) {
      const r = fitMedia(this.aspectOf(a.tex), this.artMaxWidthCm, this.artMaxHeightCm)
      h = Math.max(h, r.h)
      w = Math.max(w, r.w)
    }
    return {w, h}
  }

  /**
   * The art screen: each piece at its own aspect inside a framed box, one at a time (cycling every artCycleSec when
   * there are several), with the credit line under it. `bottomY` is the bottom of the art box (block cm).
   */
  private buildArt(art: ArtItem[], box: {w: number; h: number}, bottomY: number) {
    const mat = this.mediaMaterial || loadBuiltinMaterial()
    if (!mat) {
      print("[Retrospecs] art: no media material (wire Media Material = Materials/CaptureTexture.mat)")
      return
    }
    const margin = 1.0
    const cy = bottomY + margin + box.h / 2
    art.forEach((a, i) => {
      const r = fitMedia(this.aspectOf(a.tex), this.artMaxWidthCm, this.artMaxHeightCm)
      const holder = global.scene.createSceneObject("panel_art_" + i)
      holder.setParent(this.root)
      const rect: Rect2 = {x0: -r.w / 2, y0: cy - r.h / 2, x1: r.w / 2, y1: cy + r.h / 2}
      const outer: Rect2 = {x0: rect.x0 - margin, y0: rect.y0 - margin, x1: rect.x1 + margin, y1: rect.y1 + margin}
      // TV body: dim fill and bright bezel around the art.
      this.quads("art_fill", [outer], PANEL_COLORS.artFill, -0.06, holder)
      this.quads("art_frame", frameRects(outer, 0.35), PANEL_COLORS.frame, 0, holder)
      const o = global.scene.createSceneObject("panel_art_media_" + i)
      o.setParent(holder)
      const visual = this.meshObject(o, quadsChunk([rect], 0.02))
      const m = mat.clone()
      try {
        m.mainPass.baseTex = a.tex
        m.mainPass.twoSided = true
      } catch (e) {
        print("[Retrospecs] art: media material has no baseTex: " + e)
      }
      visual.mainMaterial = m
      // Video textures: loop, muted, from the start each time the card opens.
      try {
        const vp = a.tex.control as VideoTextureProvider
        if (vp && typeof (vp as any).play === "function") {
          try {
            vp.volume = 0
          } catch (e) {
            // No volume control: the Lens copy has no audio track anyway.
          }
          vp.play(-1)
          this.videos.push(vp)
        }
      } catch (e) {
        // Still image.
      }
      holder.enabled = i === 0
      this.artObjs.push(holder)
    })
    this.artIndex = 0
    this.artClock = 0
    this.text("credit", ARTIST_CREDIT, 0, bottomY - 1.6 - 0.1, this.artMaxWidthCm, 3.0, this.smallTextSize, PANEL_COLORS.credit, HorizontalAlignment.Center)
    print(`[Retrospecs] art screen: ${art.length} piece(s), ${box.w.toFixed(1)} x ${box.h.toFixed(1)} cm, credit "${ARTIST_CREDIT}"`)
  }

  private cycleArt(dt: number) {
    if (this.artObjs.length < 2 || this.artCycleSec <= 0) return
    this.artClock += dt
    if (this.artClock < this.artCycleSec) return
    this.artClock = 0
    this.artObjs[this.artIndex].enabled = false
    this.artIndex = (this.artIndex + 1) % this.artObjs.length
    this.artObjs[this.artIndex].enabled = true
  }

  /** The number graphic, inside the box x0..x1, y0..y1 (block cm, about 10 cm tall). */
  private buildGraphic(g: PanelGraphic, x0: number, x1: number, y0: number, y1: number) {
    const w = x1 - x0
    const chips = g.chips.length ? g.chips.join("  ·  ") : ""
    const small = this.smallTextSize
    if (g.kind === "bar") {
      const barY = y0 + 3.0
      const fillTo = x0 + w * Math.max(0.02, g.fraction || 0)
      this.quads("bar_track", [{x0, y0: barY, x1, y1: barY + 1.4}], PANEL_COLORS.track, 0.01)
      this.quads("bar_fill", [{x0, y0: barY, x1: fillTo, y1: barY + 1.4}], PANEL_COLORS.bar, 0.02)
      const bigY = (barY + 1.4 + y1) / 2
      this.text("big", g.big, x0 + w * 0.22, bigY, w * 0.44, y1 - barY - 1.6, this.titleTextSize, PANEL_COLORS.big, HorizontalAlignment.Left)
      if (chips) this.text("chips", chips, x1 - w * 0.27, bigY, w * 0.54, 3, small, PANEL_COLORS.caption, HorizontalAlignment.Right)
      this.text("caption", g.caption, x0 + w / 2, y0 + 1.2, w, 2.4, small * 0.9, PANEL_COLORS.caption, HorizontalAlignment.Left)
    } else if (g.kind === "timeline") {
      const lineY = y0 + 3.6
      const ticks = g.ticks || []
      const rects: Rect2[] = [{x0, y0: lineY, x1, y1: lineY + 0.3}]
      for (const k of ticks) {
        const tx = x0 + w * (0.06 + 0.88 * k.t)
        rects.push({x0: tx - 0.18, y0: lineY - 0.8, x1: tx + 0.18, y1: lineY + 1.1})
      }
      this.quads("timeline", rects, PANEL_COLORS.bar, 0.02)
      for (const k of ticks) {
        const tx = x0 + w * (0.06 + 0.88 * k.t)
        this.text("tick", k.label, tx, lineY + 3.2, w * 0.24, 3.6, this.namesakeTextSize, PANEL_COLORS.big, HorizontalAlignment.Center)
      }
      this.text("caption", g.caption + (chips ? "   " + chips : ""), x0 + w / 2, y0 + 1.2, w, 2.4, small * 0.9, PANEL_COLORS.caption, HorizontalAlignment.Left)
    } else {
      // Big-number callout with an accent bar on its left.
      this.quads("callout_bar", [{x0, y0: y0 + 0.5, x1: x0 + 0.5, y1: y1 - 0.5}], PANEL_COLORS.accent, 0.02)
      const sub = [g.caption, chips].filter((s) => !!s).join("   ")
      const bigBottom = sub ? y0 + 3.0 : y0 + 0.5
      this.text("big", g.big, x0 + 1.5 + (w - 1.5) / 2, (bigBottom + y1) / 2, w - 1.5, y1 - bigBottom - 0.4, this.titleTextSize * 1.2, PANEL_COLORS.big, HorizontalAlignment.Left)
      if (sub) this.text("caption", sub, x0 + 1.5 + (w - 1.5) / 2, y0 + 1.4, w - 1.5, 2.4, small * 0.9, PANEL_COLORS.caption, HorizontalAlignment.Left)
    }
  }

  // -------------------------------------------------------------------------
  // Building blocks

  private quads(name: string, rects: Rect2[], rgba: number[], z: number, parent?: SceneObject) {
    const chunk = quadsChunk(rects, z)
    if (!chunk.idx.length) return
    const o = global.scene.createSceneObject("panel_" + name)
    o.setParent(parent || this.root)
    const visual = this.meshObject(o, chunk)
    const m = this.material.clone()
    visual.mainMaterial = m
    this.parts.push({material: m, rgba})
  }

  private text(
    name: string, s: string, cx: number, cy: number, w: number, h: number, size: number, rgba: number[],
    align: HorizontalAlignment, valign: VerticalAlignment = VerticalAlignment.Center
  ) {
    const o = global.scene.createSceneObject("panel_text_" + name)
    o.setParent(this.root)
    o.getTransform().setLocalPosition(new vec3(cx, cy, 0.08))
    try {
      const t = o.createComponent("Component.Text") as Text
      if (this.font) t.font = this.font
      t.text = s
      t.size = Math.max(4, Math.round(size))
      t.horizontalAlignment = align
      t.verticalAlignment = valign
      t.worldSpaceRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
      t.horizontalOverflow = HorizontalOverflow.Wrap
      // Wrap, and shrink only when the wrapped lines overflow the box (sizeToFit would also scale short text up).
      t.verticalOverflow = VerticalOverflow.Shrink
      t.sizeToFit = false
      try {
        t.outlineSettings.enabled = true
        t.outlineSettings.size = 0.06
        t.outlineSettings.fill.color = new vec4(0, 0, 0, 1)
      } catch (e) {
        // No outline support: plain text is fine.
      }
      this.parts.push({text: t, rgba})
    } catch (e) {
      print("[Retrospecs] info panel text failed: " + e)
    }
  }

  private meshObject(o: SceneObject, chunk: MeshChunk): RenderMeshVisual {
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
    return visual
  }

  private clear() {
    for (const v of this.videos) {
      try {
        v.stop()
      } catch (e) {
        // Already stopped.
      }
    }
    this.videos = []
    this.artObjs = []
    if (this.root) this.root.destroy()
    this.root = null
    this.parts = []
    this.t = 0
  }
}

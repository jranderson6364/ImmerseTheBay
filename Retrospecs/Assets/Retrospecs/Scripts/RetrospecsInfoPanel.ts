/**
 * Focus-mode info card: a floating panel in world space that rises out of the selected building and turns to face
 * the wearer. It shows the building's name, its namesake line (`Card.namesake`), the fact being spoken, and one
 * small graphic for a number already written in that fact (a bar for a dollar amount or percentage, a timeline for
 * two or more years, a big-number callout otherwise). See `panelGraphic` in Core/Focus.ts.
 *
 * It never invents facts: every string on it is Card / Fact text from Core/Cards.ts, or a number lifted from that
 * text. Geometry is MeshBuilder quads; text is plain Text components sized to fit their boxes.
 *
 * Usage: show(card, fact, anchorWorld) once, then setAnchor(worldPos) each frame while focused (so it follows the
 * map when it is dragged, turned or resized), and hide() to sink it back down.
 */
import {Card, Fact} from "../Core/Cards"
import {PanelGraphic, Rect2, easeInOut, frameRects, panelGraphic, quadsChunk, stepBlend} from "../Core/Focus"
import {MeshChunk} from "../Core/MapMesh"

// Additive display: black is see-through. The fill is barely there; frame, accent and bar carry the shape.
const PANEL_COLORS: Record<string, number[]> = {
  fill: [0.06, 0.05, 0.035, 1],
  frame: [0.95, 0.82, 0.58, 1],
  accent: [1.0, 0.74, 0.3, 1],
  track: [0.28, 0.24, 0.18, 1],
  bar: [1.0, 0.86, 0.5, 1],
  title: [1, 1, 1, 1],
  namesake: [1.0, 0.8, 0.45, 1],
  body: [0.94, 0.92, 0.86, 1],
  big: [1.0, 0.95, 0.75, 1],
  caption: [0.78, 0.74, 0.66, 1]
}

interface FadePart {
  material?: Material
  text?: Text
  rgba: number[]
}

@component
export class RetrospecsInfoPanel extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Retrospecs Info Panel</span><br/><span style="color: #94A3B8; font-size: 11px;">Focus-mode card above the selected building.</span>')
  @input
  @allowUndefined
  @hint("Any material with a Base Color (e.g. Assets/Materials/White.mat). Cloned per colour. If empty, the controller passes the map's.")
  material: Material

  @input @allowUndefined @hint("Camera object the panel turns toward. If empty, it faces the point given to show().") camera: SceneObject
  @input @allowUndefined @hint("Optional font for the panel text (default font if empty)") font: Font

  @input @hint("Panel width (world cm)") panelWidthCm: number = 30
  @input @hint("Panel height (world cm)") panelHeightCm: number = 24
  @input @hint("Gap between the building top and the panel's bottom edge (world cm)") panelGapCm: number = 6
  @input @hint("How far the panel rises while it appears (world cm)") riseCm: number = 10
  @input @hint("Seconds to rise in / sink out") appearSec: number = 0.5
  @input @hint("Largest text size; text wraps, then shrinks only if it overflows its box. A map label is about 135 at scale 1.") titleSize: number = 120
  @input bodySize: number = 72
  @input @hint("Turn fully toward the wearer (on) or only around the vertical axis (off)") tiltToViewer: boolean = true

  // Artist media (Nazeli's illustrations and animations), shown in a row above the card for comparison.
  @input @hint("Show artist illustrations / animations above the card. Turn off to compare with the plain card.") showMedia: boolean = true
  @input @allowUndefined @hint("Material with a baseTex texture slot (e.g. Assets/Materials/CaptureTexture.mat). Cloned per item.") mediaMaterial: Material
  // Four slots: a card id (e.g. "huang") and an image or video texture. Black is see-through on Spectacles: use art on black.
  @input media1Id: string = ""
  @input @allowUndefined media1Texture: Texture
  @input media2Id: string = ""
  @input @allowUndefined media2Texture: Texture
  @input media3Id: string = ""
  @input @allowUndefined media3Texture: Texture
  @input media4Id: string = ""
  @input @allowUndefined media4Texture: Texture
  @input @hint("Height of the media row above the card (world cm)") mediaHeightCm: number = 14

  private root: SceneObject = null
  private parts: FadePart[] = []
  private t = 0
  private target = 0
  private anchor: vec3 = null
  private faceToward: vec3 = null
  private videos: VideoTextureProvider[] = []

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  isShowing(): boolean {
    return this.target > 0
  }

  /** Builds the card for `card` / `fact` (fact may be null: name and namesake only) and starts it rising. */
  show(card: Card, fact: Fact | null, anchorWorld: vec3, faceToward?: vec3) {
    if (!card || !this.material) return
    this.clear()
    this.anchor = anchorWorld
    this.faceToward = faceToward || null
    this.root = global.scene.createSceneObject("RetrospecsInfoPanel")
    this.build(card, fact)
    this.t = 0
    this.target = 1
    this.apply()
  }

  /** World point the panel's bottom edge rises from (top of the focused building plus the gap is added here). */
  setAnchor(anchorWorld: vec3) {
    this.anchor = anchorWorld
  }

  /** Sinks back into the building, then removes itself. */
  hide() {
    this.target = 0
  }

  // -------------------------------------------------------------------------

  private build(card: Card, fact: Fact | null) {
    const W = this.panelWidthCm
    const H = this.panelHeightCm
    const x0 = -W / 2, x1 = W / 2, y0 = -H / 2, y1 = H / 2
    const pad = 1.4
    const inner = W - pad * 2

    this.quads("fill", [{x0, y0, x1, y1}], PANEL_COLORS.fill, -0.05)
    this.quads("frame", frameRects({x0, y0, x1, y1}, 0.22), PANEL_COLORS.frame, 0)
    this.quads("accent", [{x0, y0: y1 - 0.7, x1, y1}], PANEL_COLORS.accent, 0.01)

    // Header: name, namesake line, divider.
    let y = y1 - 1.2
    this.text("title", card.name, 0, y - 1.8, inner, 3.6, this.titleSize, PANEL_COLORS.title, HorizontalAlignment.Left)
    y -= 3.9
    if (card.namesake) {
      this.text("namesake", card.namesake, 0, y - 1.1, inner, 2.2, this.bodySize * 0.8, PANEL_COLORS.namesake, HorizontalAlignment.Left)
      y -= 2.6
    }
    this.quads("divider", [{x0: x0 + pad, y0: y - 0.35, x1: x1 - pad, y1: y - 0.2}], PANEL_COLORS.track, 0.01)
    y -= 0.8

    const g = panelGraphic(fact)
    const graphicH = g ? 7 : 0
    const bodyBottom = y0 + pad + graphicH
    if (fact) {
      const h = Math.max(2, y - bodyBottom)
      this.text("fact", fact.text, 0, y - h / 2, inner, h, this.bodySize, PANEL_COLORS.body, HorizontalAlignment.Left, VerticalAlignment.Top)
    }
    if (g) this.buildGraphic(g, x0 + pad, x1 - pad, y0 + pad, y0 + pad + graphicH)
    this.buildMedia(card.id, y1 + 1.2)
  }

  /** Artist media for `cardId`, side by side in a row whose bottom edge is at `bottomY` (panel cm). */
  private buildMedia(cardId: string, bottomY: number) {
    if (!this.showMedia || !this.mediaMaterial) return
    const slots: [string, Texture][] = [
      [this.media1Id, this.media1Texture], [this.media2Id, this.media2Texture],
      [this.media3Id, this.media3Texture], [this.media4Id, this.media4Texture]
    ]
    const items: Texture[] = slots.filter(([id, tex]) => id === cardId && !!tex).map(([, tex]) => tex)
    if (!items.length) return
    const h = this.mediaHeightCm
    const gap = 1.2
    const widths = items.map((tex) => {
      let aspect = 16 / 9
      try {
        const w = tex.getWidth(), ht = tex.getHeight()
        if (w > 0 && ht > 0) aspect = w / ht
      } catch (e) {
        // Keep 16:9 for a texture that cannot report its size yet (video before its first frame).
      }
      return h * aspect
    })
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1)
    print(`[Retrospecs] artist media for ${cardId}: ${items.length} item(s), row ${total.toFixed(1)} x ${h} cm`)
    let x = -total / 2
    items.forEach((tex, i) => {
      const o = global.scene.createSceneObject("panel_media_" + i)
      o.setParent(this.root)
      const builder = new MeshBuilder([
        {name: "position", components: 3},
        {name: "normal", components: 3},
        {name: "texture0", components: 2}
      ])
      const chunk = quadsChunk([{x0: x, y0: bottomY, x1: x + widths[i], y1: bottomY + h}], 0)
      builder.topology = MeshTopology.Triangles
      builder.indexType = MeshIndexType.UInt16
      builder.appendVerticesInterleaved(chunk.verts)
      builder.appendIndices(chunk.idx)
      builder.updateMesh()
      const visual = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = builder.getMesh()
      const m = this.mediaMaterial.clone()
      try {
        m.mainPass.baseTex = tex
        m.mainPass.twoSided = true
      } catch (e) {
        print("[Retrospecs] media material has no baseTex: " + e)
      }
      visual.mainMaterial = m
      // Video textures: loop, muted, from the start each time the card opens.
      try {
        const vp = tex.control as VideoTextureProvider
        if (vp && typeof (vp as any).play === "function") {
          try {
            vp.volume = 0
          } catch (e) {
            // No volume control: the Lens copies have no audio track anyway.
          }
          vp.play(-1)
          this.videos.push(vp)
        }
      } catch (e) {
        // Still image.
      }
      x += widths[i] + gap
    })
  }

  /** The number graphic, inside the box x0..x1, y0..y1 (panel cm). */
  private buildGraphic(g: PanelGraphic, x0: number, x1: number, y0: number, y1: number) {
    const w = x1 - x0
    const chips = g.chips.length ? g.chips.join(" · ") : ""
    if (g.kind === "bar") {
      const barY = y0 + 2.6
      const fillTo = x0 + w * Math.max(0.02, g.fraction || 0)
      this.quads("bar_track", [{x0, y0: barY, x1, y1: barY + 1.1}], PANEL_COLORS.track, 0.01)
      this.quads("bar_fill", [{x0, y0: barY, x1: fillTo, y1: barY + 1.1}], PANEL_COLORS.bar, 0.02)
      this.text("big", g.big, x0 + w * 0.2, barY + 2.6, w * 0.4, 2.8, this.titleSize, PANEL_COLORS.big, HorizontalAlignment.Left)
      if (chips) this.text("chips", chips, x0 + w * 0.7, barY + 2.6, w * 0.6, 2, this.bodySize * 0.7, PANEL_COLORS.caption, HorizontalAlignment.Right)
      this.text("caption", g.caption, x0 + w / 2, y0 + 1.1, w, 2, this.bodySize * 0.65, PANEL_COLORS.caption, HorizontalAlignment.Left)
    } else if (g.kind === "timeline") {
      const lineY = y0 + 2.8
      const ticks = g.ticks || []
      const rects: Rect2[] = [{x0, y0: lineY, x1, y1: lineY + 0.25}]
      for (const k of ticks) {
        const tx = x0 + w * (0.06 + 0.88 * k.t)
        rects.push({x0: tx - 0.15, y0: lineY - 0.7, x1: tx + 0.15, y1: lineY + 0.95})
      }
      this.quads("timeline", rects, PANEL_COLORS.bar, 0.02)
      ticks.forEach((k, i) => {
        const tx = x0 + w * (0.06 + 0.88 * k.t)
        this.text("tick", k.label, tx, lineY + 2.2, w * 0.3, 2.4, this.titleSize * 0.8, PANEL_COLORS.big, HorizontalAlignment.Center)
        void i
      })
      this.text("caption", g.caption + (chips ? "   " + chips : ""), x0 + w / 2, y0 + 0.9, w, 1.8, this.bodySize * 0.65, PANEL_COLORS.caption, HorizontalAlignment.Left)
    } else {
      // Big-number callout with an accent bar on its left.
      this.quads("callout_bar", [{x0, y0: y0 + 0.4, x1: x0 + 0.45, y1: y1 - 0.4}], PANEL_COLORS.accent, 0.02)
      this.text("big", g.big, x0 + 1.2 + w * 0.35, (y0 + y1) / 2 + 0.6, w * 0.7, 4.2, this.titleSize * 1.3, PANEL_COLORS.big, HorizontalAlignment.Left)
      const sub = [g.caption, chips].filter((s) => !!s).join("   ")
      if (sub) this.text("caption", sub, x0 + 1.2 + (w - 1.2) / 2, y0 + 0.9, w - 1.2, 1.8, this.bodySize * 0.65, PANEL_COLORS.caption, HorizontalAlignment.Left)
    }
  }

  private quads(name: string, rects: Rect2[], rgba: number[], z: number) {
    const chunk = quadsChunk(rects, z)
    const o = global.scene.createSceneObject("panel_" + name)
    o.setParent(this.root)
    const mat = this.meshVisual(o, chunk)
    if (mat) this.parts.push({material: mat, rgba})
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

  private meshVisual(o: SceneObject, chunk: MeshChunk): Material | null {
    if (!chunk.idx.length) return null
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
    return m
  }

  private onUpdate() {
    if (!this.root) return
    const dt = getDeltaTime()
    this.t = stepBlend(this.t, this.target, dt, this.appearSec)
    if (this.t <= 0 && this.target <= 0) {
      this.clear()
      return
    }
    this.apply()
  }

  /** Position, facing, scale and fade for the current blend. */
  private apply() {
    if (!this.root || !this.anchor) return
    const k = easeInOut(this.t)
    const tr = this.root.getTransform()
    const centre = new vec3(this.anchor.x, this.anchor.y + this.panelGapCm + this.panelHeightCm / 2 - this.riseCm * (1 - k), this.anchor.z)
    tr.setWorldPosition(centre)
    tr.setWorldScale(vec3.one().uniformScale(0.25 + 0.75 * k))
    const toward = this.camera ? this.camera.getTransform().getWorldPosition() : this.faceToward
    if (toward) {
      const d = toward.sub(centre)
      const yaw = quat.angleAxis(Math.atan2(d.x, d.z), vec3.up())
      const pitch = this.tiltToViewer ? quat.angleAxis(-Math.atan2(d.y, Math.hypot(d.x, d.z)), vec3.right()) : quat.quatIdentity()
      tr.setWorldRotation(yaw.multiply(pitch))
    }
    for (const p of this.parts) {
      const c = new vec4(p.rgba[0] * k, p.rgba[1] * k, p.rgba[2] * k, p.rgba[3] * k)
      try {
        if (p.material) p.material.mainPass.baseColor = c
        if (p.text) p.text.textFill.color = c
      } catch (e) {
        // Material or text without a colour: leave as is.
      }
    }
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
    if (this.root) this.root.destroy()
    this.root = null
    this.parts = []
    this.t = 0
  }
}

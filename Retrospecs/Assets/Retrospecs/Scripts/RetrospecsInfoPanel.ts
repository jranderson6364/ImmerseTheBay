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
import {
  CompactLayout, SPECTACLES, STORY_CARD, cmForDeg, compactCardSize, compactLayout, compactTextWidth, crossChunk, degForCm, inRect,
  micGlyphRects, storyAskButton, storyCardHits, storyCardScale
} from "../Core/CardLayout"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {storyCardTexture} from "./StoryDeck"
import {storyHologram} from "./StoryHolograms"
import {peopleHologram} from "./PeopleHolograms"

/** What the card's buttons do (the controller acts on it). */
export type PanelButton = "close" | "next" | "more" | "ask" | ""

// Compact card text sizes (the scene's saved title/body sizes are for the old tall card).
const COMPACT_SIZES = {title: 64, namesake: 44, body: 52, small: 38, button: 46}
// Button colours: bright, so they read on the additive display; hovered = brighter and cyan-white.
const BUTTON_COLORS = {
  closeFill: [0.55, 0.12, 0.14, 1], closeFillHover: [0.95, 0.25, 0.28, 1],
  closeMark: [1, 0.92, 0.9, 1], closeMarkHover: [1, 1, 1, 1],
  nextFill: [0.36, 0.26, 0.1, 1], nextFillHover: [0.75, 0.55, 0.2, 1],
  nextText: [1.0, 0.88, 0.62, 1], nextTextHover: [1, 1, 1, 1],
  rim: [0.95, 0.82, 0.58, 1], rimHover: [1.0, 0.96, 0.82, 1],
  // Ask: the chat window's cyan, so the button and the window it opens read as one thing.
  askFill: [0.07, 0.28, 0.4, 1], askFillHover: [0.18, 0.58, 0.8, 1],
  askRim: [0.55, 0.9, 1.0, 1], askRimHover: [0.85, 1.0, 1.0, 1],
  askMark: [0.85, 0.97, 1.0, 1], askMarkHover: [1, 1, 1, 1]
}

interface ButtonView {
  kind: "close" | "next" | "more" | "ask"
  hit: {x0: number; y0: number; x1: number; y1: number}
  parts: {part: FadePart; base: number[]; hover: number[]}[]
  /** Objects shown only while the button is hovered (or pulsing): the story card's outline. */
  toggles?: SceneObject[]
}

/** Story card hover outline: the bright copper of the card's own frame (render_story_decks.py COPPER, lifted). */
const STORY_BUTTON_RIM = [1.0, 0.78, 0.52, 1]

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

// World-space Text metrics per point of `size` (cm), measured on the 60 cm screen: line pitch and average character
// width. Used to pick sizes and box heights in code instead of VerticalOverflow.Shrink in fixed boxes, which kept the
// body text small and is the suspect for the title and namesake not showing.
const LINE_CM_PER_PT = 0.032
const CHAR_CM_PER_PT = 0.0112
// Text drawn at size 100 didn't render at all in the preview (the title went missing); 72 did, 80 is untested. Every
// panel text is capped here, so an Inspector value or the number graphic's 1.2x can't make text vanish.
const MAX_TEXT_SIZE = 80

function wrappedLines(s: string, charsPerLine: number): number {
  let lines = 1
  let len = 0
  for (const word of s.split(/\s+/).filter((x) => !!x)) {
    const add = len === 0 ? word.length : len + 1 + word.length
    if (add <= charsPerLine || len === 0) {
      len = add
    } else {
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

/** Largest size up to `size` whose wrapped lines fit `w` x `maxH` cm; with the line count and the height it takes. */
function fitText(s: string, w: number, maxH: number, size: number): {size: number; lines: number; h: number} {
  let sz = Math.min(size, MAX_TEXT_SIZE)
  for (;;) {
    const lines = wrappedLines(s, Math.max(1, Math.floor(w / (CHAR_CM_PER_PT * sz))))
    const h = lines * LINE_CM_PER_PT * sz
    if (h <= maxH || sz <= 12) return {size: sz, lines, h}
    sz = Math.max(12, sz * 0.92)
  }
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
let builtinStoryMaterial: Material = null

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
  // Placeholder: this clip shows the HP characters, not Page and Brin. Swap in a redraw when it arrives.
  const huangAnim = tryAsset(() => requireAsset("../Art/huang/huang_nazeli_anim.mp4"), "huang anim")
  const huang = tryAsset(() => requireAsset("../Art/huang/huang_nazeli_art.png"), "huang art")
  if (anim) builtinArt.push({id: "hpgarage", tex: anim as Texture})
  if (garage) builtinArt.push({id: "hpgarage", tex: garage as Texture})
  if (huangAnim) builtinArt.push({id: "huang", tex: huangAnim as Texture})
  if (huang) builtinArt.push({id: "huang", tex: huang as Texture})
  print(
    `[Retrospecs] art: built-in Nazeli art loaded: hpgarage anim ${!!anim}, hpgarage still ${!!garage}, ` +
      `huang anim ${!!huangAnim}, huang still ${!!huang}`
  )
  return builtinArt
}

function loadBuiltinMaterial(): Material {
  if (builtinMaterial) return builtinMaterial
  const m = tryAsset(() => requireAsset("../../Materials/CaptureTexture.mat"), "CaptureTexture.mat")
  builtinMaterial = m ? (m as Material) : null
  print(`[Retrospecs] art: built-in media material loaded: ${!!builtinMaterial}`)
  return builtinMaterial
}

function loadStoryMaterial(): Material {
  if (builtinStoryMaterial) return builtinStoryMaterial
  const m = tryAsset(() => requireAsset("../../Materials/StoryCardAlpha.mat"), "StoryCardAlpha.mat")
  builtinStoryMaterial = m ? (m as Material) : null
  return builtinStoryMaterial
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
  // New inputs (not saved in the scene yet, so these defaults apply even though the scene overrides the ones above).
  @input @hint("Keep the screens fixed in the room where they appear (walk up to them). Off = lazy follow.") worldLocked: boolean = true
  @input @hint("Multiplies Screen Distance: 1.85 puts the 130 cm screen about 2.4 m away") distanceScale: number = 1.85
  @input @hint("Multiplies the screen's size (text and art grow with it) so it stays readable farther back") sizeScale: number = 1.5
  @input @hint("Seconds to fly out / back") appearSec: number = 0.6
  @input @hint("Fly out of the building (on) or fade in at the wall (off)") flyFromBuilding: boolean = true

  // About 0.032 cm of line pitch per point: body 72 is a 2.3 cm line at the 130 cm screen distance. Capped at 80.
  @input @hint("Largest text sizes (max 80: larger text didn't render). Text wraps and the card grows to fit.") titleTextSize: number = 80
  @input namesakeTextSize: number = 64
  @input bodyTextSize: number = 72
  @input smallTextSize: number = 50

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

  // Compact card (new inputs, so the scene's saved values for the old tall card don't apply).
  @input @hint("Short, wide card: art on the left, words on the right, X to close, Next spot button. Off = the old tall card.") compactCard: boolean = true
  @input @hint("Compact card: degrees below eye level for its centre, so it sits between the horizon and the floor map") compactPitchDeg: number = 12
  @input @hint("(Legacy, unused: see Card Distance)") compactDistanceScale: number = 1.45
  @input @hint("(Legacy, unused: see Compact Width Deg)") compactWidthCm: number = 90

  // Angular sizing (Snap's Spectacles positioning and sizing guide, see Core/CardLayout.ts SPECTACLES). These are new
  // inputs, so the scene's saved values for the legacy ones above don't apply.
  @input @hint("Compact and story cards: distance from the eyes (cm). Snap: far field is 60-160 cm, about 1 m is most comfortable for detail.") cardDistanceCm: number = 140
  @input @hint("Compact card width (degrees). Snap's usable binocular width is about 27.") compactWidthDeg: number = 24
  @input @hint("Compact card body line height (degrees). Sets the text size, and with it the card's scale.") compactBodyLineDeg: number = 0.76
  @input @hint("Illustrated story card width (degrees, the whole texture including Next Stop)") storyCardWidthDeg: number = 20.3
  @input @hint("Smallest button hit area (degrees). Snap: at least 2, about 3 is best.") minTargetDeg: number = 3

  private root: SceneObject = null
  private parts: FadePart[] = []
  private t = 0
  private target = 0
  private anchor: vec3 = null
  private faceToward: vec3 = null
  private videos: VideoTextureProvider[] = []
  private hologram: SceneObject = null
  private hologramId = ""
  private hologramVideo: VideoTextureProvider = null
  private peopleScreen: SceneObject = null
  private peopleId = ""
  private peopleVideo: VideoTextureProvider = null
  private imageCard = false
  /** Building of the card on screen ("" once hidden), so a new pick re-places the card where the wearer faces. */
  private shownCardId = ""
  /** World scale and local width (cm) of the card being shown, set by each build. */
  private cardScale = 1
  private cardWidthLocal = 60
  private artObjs: SceneObject[] = []
  private artIndex = 0
  private artClock = 0
  private blockHeight = 40
  private placed: vec3 = null
  private lift = 0
  /** Fly between the building and the wall (fresh show and hide); off when only the card content changes. */
  private fly = true
  /** Compact card: buttons (card-local hit boxes), the card's ray target, and the button under the ray. */
  private buttons: ButtonView[] = []
  private hitTarget: Interactable = null
  private hovered: PanelButton = ""

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

  /**
   * The key building's diagram loop (StoryHolograms) on its own 16:9 screen at
   * `pos`, turned to face `eye`. Stays up while the story pages, replaced when another building is picked.
   */
  showSideHologram(id: string, pos: vec3, eye: vec3, widthCm: number) {
    if (this.hologramId === id && this.hologram) return
    this.hideSideHologram()
    let tex: Texture = null
    try {
      tex = storyHologram(id)
    } catch (e) {
      print("[Retrospecs] side hologram missing for " + id + ": " + e)
    }
    const screen = this.createSideScreen(tex, id, pos, eye, widthCm, "Side_hologram_")
    if (!screen) return
    this.hologram = screen.object
    this.hologramId = id
    this.hologramVideo = screen.video
    print(`[Retrospecs] side hologram ${id}: ${screen.width.toFixed(0)} x ${screen.height.toFixed(0)} cm`)
  }

  /** A separate people screen. HP Garage can occupy the original side position while its diagram is absent. */
  showPeopleHologram(id: string, pos: vec3, eye: vec3, widthCm: number) {
    if (this.peopleId === id && this.peopleScreen) return
    this.hidePeopleHologram()
    let tex: Texture = null
    try {
      tex = peopleHologram(id)
    } catch (e) {
      print("[Retrospecs] people hologram missing for " + id + ": " + e)
    }
    const screen = this.createSideScreen(tex, id, pos, eye, widthCm, "People_hologram_")
    if (!screen) return
    this.peopleScreen = screen.object
    this.peopleId = id
    this.peopleVideo = screen.video
    print(`[Retrospecs] people hologram ${id}: ${screen.width.toFixed(0)} x ${screen.height.toFixed(0)} cm`)
  }

  private createSideScreen(tex: Texture, id: string, pos: vec3, eye: vec3, widthCm: number, prefix: string):
      {object: SceneObject; video: VideoTextureProvider; width: number; height: number} | null {
    const mat = this.mediaMaterial || loadBuiltinMaterial()
    if (!tex || !mat) return null
    const hw = Math.max(10, widthCm) / 2, hh = (hw * 9) / 16
    const object = global.scene.createSceneObject(prefix + id)
    const tr = object.getTransform()
    tr.setWorldPosition(pos)
    const d = eye.sub(pos)
    const yaw = quat.angleAxis(Math.atan2(d.x, d.z), vec3.up())
    const pitch = quat.angleAxis(-Math.atan2(d.y, Math.hypot(d.x, d.z)), vec3.right())
    tr.setWorldRotation(yaw.multiply(pitch))
    const visual = this.meshObject(object, quadsChunk([{x0: -hw, y0: -hh, x1: hw, y1: hh}], 0))
    const material = mat.clone()
    material.mainPass.baseTex = tex
    material.mainPass.twoSided = true
    visual.mainMaterial = material
    let video: VideoTextureProvider = null
    try {
      video = tex.control as VideoTextureProvider
      video.volume = 0
      const play = () => {
        try {
          if (!object.enabled) return
          if (video.status === VideoStatus.Playing) return
          video.play(-1)
        } catch (e) {
          print("[Retrospecs] side hologram play failed: " + e)
        }
      }
      if (video.status === VideoStatus.Preparing) video.onPlaybackReady.add(play)
      else play()
    } catch (e) {
      print("[Retrospecs] side hologram start failed: " + e)
    }
    return {object, video, width: 2 * hw, height: 2 * hh}
  }

  hideSideHologram() {
    if (this.hologram) this.hologram.enabled = false
    if (this.hologramVideo) try { this.hologramVideo.stop() } catch (e) { /* Already stopped. */ }
    if (this.hologram) this.hologram.destroy()
    this.hologram = null
    this.hologramId = ""
    this.hologramVideo = null
  }

  hidePeopleHologram() {
    if (this.peopleScreen) this.peopleScreen.enabled = false
    if (this.peopleVideo) try { this.peopleVideo.stop() } catch (e) { /* Already stopped. */ }
    if (this.peopleScreen) this.peopleScreen.destroy()
    this.peopleScreen = null
    this.peopleId = ""
    this.peopleVideo = null
  }

  /** Builds the screen for `card` / `fact` (fact may be null: name and namesake only) and flies it out. */
  show(card: Card, fact: Fact | null, anchorWorld: vec3, faceToward?: vec3, sourceLine?: string, storyIndex = 0) {
    if (!card || !this.material) return
    const wasShowing = !!this.root && this.target > 0
    this.clear()
    const storyTexture = sourceLine ? null : storyCardTexture(card.id, storyIndex)
    this.imageCard = !!storyTexture
    this.publishConfig()
    this.anchor = anchorWorld
    this.faceToward = faceToward || null
    this.root = global.scene.createSceneObject("RetrospecsInfoPanel")
    if (storyTexture) this.buildImageCard(storyTexture, card.id, storyIndex)
    else if (this.compactCard) this.buildCompact(card, fact, sourceLine)
    else {
      this.cardScale = this.sizeScale > 0 ? this.sizeScale : 1
      this.cardWidthLocal = this.screenWidthCm
      this.build(card, fact, sourceLine)
    }
    const s = this.size()
    TV_WALL.mainWidthCm = this.cardWidthLocal * s
    const D = TV_WALL.distanceCm
    print(`[Retrospecs] card: ${(this.cardWidthLocal * s).toFixed(1)} x ${(this.blockHeight * s).toFixed(1)} cm at ${D.toFixed(0)} cm = ${degForCm(this.cardWidthLocal * s, D).toFixed(1)} x ${degForCm(this.blockHeight * s, D).toFixed(1)} deg`)
    // The block is lifted by `lift` inside the root: publish the height that puts its bottom edge where it really is.
    TV_WALL.mainHeightCm = Math.max(10, this.blockHeight - 2 * this.lift) * s
    // Place the card where the wearer is facing whenever a building is picked (turn around and pick one behind you,
    // the card appears there), then leave it fixed in the room. Paging the same building's story keeps it in place.
    const newBuilding = card.id !== this.shownCardId
    this.shownCardId = card.id
    if (!sharedWall.active || newBuilding) {
      const eye = this.eye()
      if (eye) sharedWall.reset(eye, this.viewYaw(eye))
    }
    // Switching cards while showing: appear in place (no second fly-out).
    // A different building flies out fresh to its new spot.
    const inPlace = wasShowing && !newBuilding
    this.fly = !inPlace
    this.t = inPlace ? 0.6 : 0
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

  private size(): number {
    return this.cardScale > 0 ? this.cardScale : 1
  }

  private publishConfig() {
    const angular = this.compactCard || this.imageCard
    const d = angular ? 1 : this.distanceScale > 0 ? this.distanceScale : 1
    TV_WALL.distanceCm = angular ? Math.max(SPECTACLES.farFieldMinCm, this.cardDistanceCm) : Math.max(60, this.screenDistanceCm * d)
    // Compact: a fixed angle below eye level (between the horizon and the floor map). Old card: same angle as before.
    TV_WALL.dropCm = this.compactCard || this.imageCard ? TV_WALL.distanceCm * Math.tan((Math.max(0, this.compactPitchDeg) * Math.PI) / 180) : this.screenDropCm * d
    // World-locked: the wall never re-centres, so the screens stay put and grow as you walk up to them.
    TV_WALL.followDeg = this.worldLocked ? 1e6 : this.followAngleDeg
    TV_WALL.followCm = this.worldLocked ? 1e9 : this.followDistanceCm
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
    this.updateButtons()
    this.apply(dt)
  }

  // -------------------------------------------------------------------------
  // Buttons (compact card)

  /**
   * The card button under the right-hand ray (or the Preview mouse), "" if none. The whole card is one ray target;
   * the hit point is mapped into card cm and tested against each button's (generous) hit box.
   */
  buttonUnderRay(): PanelButton {
    if (!this.root || !this.hitTarget || this.target <= 0 || !this.buttons.length) return ""
    let interactors
    try {
      interactors = SIK.InteractionManager.getTargetingInteractors()
    } catch (e) {
      return ""
    }
    const inv = this.root.getTransform().getInvertedWorldTransform()
    for (const it of interactors) {
      if (!(it.inputType & (InteractorInputType.RightHand | InteractorInputType.Mouse))) continue
      const info = it.targetHitInfo
      if (!info || info.interactable !== this.hitTarget || !info.hit) continue
      const p = inv.multiplyPoint(info.hit.position)
      for (const b of this.buttons) if (inRect(b.hit, p.x, p.y)) return b.kind
    }
    return ""
  }

  /** True while the ray is anywhere on the card (a pinch there must not select a building behind it). */
  rayOnCard(): boolean {
    if (!this.root || !this.hitTarget || this.target <= 0) return false
    try {
      for (const it of SIK.InteractionManager.getTargetingInteractors()) {
        if (!(it.inputType & (InteractorInputType.RightHand | InteractorInputType.Mouse))) continue
        const info = it.targetHitInfo
        if (info && info.interactable === this.hitTarget) return true
      }
    } catch (e) {
      // SIK not ready.
    }
    return false
  }

  /** Locked demo: the button the judge should press next glows (blinks between rest and hover). "" = none. */
  private pulse: PanelButton = ""
  private pulseClock = 0
  private pulseLit = false

  setPulse(kind: PanelButton) {
    this.pulse = kind
    this.pulseClock = 0
    this.pulseLit = false
    this.hovered = "-" as PanelButton // force a repaint on the next frame
  }

  private updateButtons() {
    if (!this.buttons.length) return
    const h = this.buttonUnderRay()
    let lit = false
    if (this.pulse && this.buttons.some((b) => b.kind === this.pulse)) {
      this.pulseClock += getDeltaTime()
      lit = Math.floor(this.pulseClock / 0.6) % 2 === 0
    }
    if (h === this.hovered && lit === this.pulseLit) return
    this.hovered = h
    this.pulseLit = lit
    for (const b of this.buttons) {
      const on = b.kind === h || (lit && b.kind === this.pulse)
      for (const p of b.parts) p.part.rgba = on ? p.hover : p.base
      if (b.toggles) for (const o of b.toggles) o.enabled = on
    }
  }

  /** One thin box collider over the card with an SIK Interactable (indirect), so the ray cursor lands on it. */
  private makeHitTarget(r: Rect2) {
    try {
      const o = global.scene.createSceneObject("panel_ray_target")
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
      print("[Retrospecs] card buttons: ray target unavailable: " + e)
    }
  }

  /** Adds a part and remembers it for hover recolouring. */
  private buttonPart(b: ButtonView, before: number, base: number[], hover: number[]) {
    for (let i = before; i < this.parts.length; i++) b.parts.push({part: this.parts[i], base, hover})
  }

  private buildImageCard(tex: Texture, cardId: string, storyIndex: number) {
    const mat = loadStoryMaterial()
    if (!mat) return
    // The 1200 x 1280 texture maps to a 67.5 x 72 cm panel (local), scaled so it spans storyCardWidthDeg. The portrait
    // card is on the left; the separate Next Stop button occupies the texture's right-hand extension.
    const D = TV_WALL.distanceCm
    this.cardScale = storyCardScale(this.storyCardWidthDeg > 0 ? this.storyCardWidthDeg : 20.3, D)
    this.cardWidthLocal = STORY_CARD.widthCm
    const hw = STORY_CARD.widthCm / 2, hh = STORY_CARD.heightCm / 2
    const rect = {x0: -hw, y0: -hh, x1: hw, y1: hh}
    const visual = this.meshObject(this.root, quadsChunk([rect], 0))
    const material = mat.clone()
    material.mainPass.baseTex = tex
    material.mainPass.twoSided = true
    visual.mainMaterial = material
    if (storyIndex === 0 && cardId !== "hpgarage") {
      const video = storyHologram(cardId)
      const videoMat = this.mediaMaterial || loadBuiltinMaterial()
      if (video && videoMat) {
        // Sits wholly inside the illustration region of the baked story card.
        const r = {x0: -27, y0: -0.2, x1: 12.4, y1: 21.9}
        const movie = this.meshObject(this.root, quadsChunk([r], 0.08))
        const m = videoMat.clone()
        m.mainPass.baseTex = video
        m.mainPass.twoSided = true
        movie.mainMaterial = m
        this.startVideo(video, cardId)
      }
    }
    // Hit areas grown to at least minTargetDeg (the drawn buttons in the art are smaller; Snap counts the collider).
    const minLocal = cmForDeg(Math.max(SPECTACLES.minTargetDeg, this.minTargetDeg), D) / this.cardScale
    const hits = storyCardHits(minLocal)
    this.buttons = [
      {kind: "close", hit: hits.close, parts: []},
      {kind: "more", hit: hits.more, parts: []},
      {kind: "next", hit: hits.next, parts: []}
    ]
    // Hover feedback: the buttons are baked into the art, so each gets a thin outline in the card's own copper,
    // drawn just OUTSIDE the drawn button so it never sits over the label. Nothing covers the button itself, and
    // the outline is switched off (not merely black) at rest, so it can't show as a dark box in a recording.
    const drawn = storyCardHits(0)
    for (const b of this.buttons) {
      const r = drawn[b.kind]
      const pad = 0.9
      const outer = {x0: r.x0 - pad, y0: r.y0 - pad, x1: r.x1 + pad, y1: r.y1 + pad}
      const n = this.parts.length
      const rim = this.quads("hover_rim_" + b.kind, frameRects(outer, 0.35), STORY_BUTTON_RIM, 0.16)
      this.buttonPart(b, n, STORY_BUTTON_RIM, STORY_BUTTON_RIM)
      if (rim) {
        rim.enabled = false
        b.toggles = [rim]
      }
    }
    // Ask isn't in the texture: drawn as a mesh button in the empty column above Next Stop, so it can glow.
    const ask = storyAskButton(minLocal)
    this.buttons.push(this.buildAskButton(ask.drawn, ask.hit, 84))
    this.hovered = ""
    this.blockHeight = STORY_CARD.heightCm
    this.lift = 0
    this.makeHitTarget({x0: rect.x0 - 3, y0: rect.y0 - 3, x1: rect.x1 + 3, y1: rect.y1 + 3})
    print("[Retrospecs] complete illustrated story card ready")
  }

  /**
   * The compact card: a short, wide screen. Art column on the left (Nazeli's art, when the building has it), title
   * with a big X close button, the namesake on one line, the spoken fact, and a "Next spot" button. Every word is
   * Card / Fact text, the caller's source line, or a button label.
   */
  private buildCompact(card: Card, fact: Fact | null, sourceLine?: string) {
    // Sized by angle: the body line sets the scale (text reads the same at any distance), the width the rest.
    const size = compactCardSize(
      this.compactWidthDeg > 0 ? this.compactWidthDeg : 24,
      this.compactBodyLineDeg > 0 ? this.compactBodyLineDeg : 0.76,
      TV_WALL.distanceCm,
      LINE_CM_PER_PT * COMPACT_SIZES.body
    )
    const W = Math.max(40, size.width)
    this.cardScale = size.scale
    this.cardWidthLocal = W
    const art = this.artFor(card.id)
    const aspect = art.length ? this.artBox(art).w / Math.max(0.01, this.artBox(art).h) : 0
    const textW = compactTextWidth(W, art.length > 0)
    const titleW = textW - 9 // keep the title clear of the close button
    const S = COMPACT_SIZES
    const title = fitText(card.name, titleW, LINE_CM_PER_PT * S.title * 2.05, S.title)
    const namesake = card.namesake ? fitText(card.namesake, textW, LINE_CM_PER_PT * S.namesake * 1.05, S.namesake) : null
    const body = fact ? fitText(fact.text, textW, 15, S.body) : null
    const source = sourceLine ? fitText(sourceLine, textW, 4, S.small) : null
    const L: CompactLayout = compactLayout({
      width: W,
      titleH: title.h * 1.08,
      namesakeH: namesake ? namesake.h * 1.08 : 0,
      bodyH: body ? body.h * 1.08 : 0,
      sourceH: source ? source.h * 1.08 : 0,
      artAspect: aspect
    })
    this.blockHeight = L.card.y1 - L.card.y0
    this.lift = 0
    this.quads("fill", [L.card], PANEL_COLORS.fill, -0.05)
    this.quads("frame", frameRects(L.card, 0.3), PANEL_COLORS.frame, 0)
    this.quads("accent", [L.accent], PANEL_COLORS.accent, 0.01)

    const tx = (L.text.x0 + L.text.x1) / 2
    const titleH = title.h * 1.08
    this.text("title", card.name, L.text.x0 + titleW / 2, L.titleTop - titleH / 2, titleW, titleH, title.size, PANEL_COLORS.title, HorizontalAlignment.Left)
    if (namesake) {
      const h = namesake.h * 1.08
      this.text("namesake", card.namesake, tx, L.namesakeTop - h / 2, textW, h, namesake.size, PANEL_COLORS.namesake, HorizontalAlignment.Left)
    }
    if (body) {
      const h = body.h * 1.08
      this.text("fact", fact.text, tx, L.bodyTop - h / 2, textW, h, body.size, PANEL_COLORS.body, HorizontalAlignment.Left)
    }
    if (source) {
      const h = source.h * 1.08
      this.text("source", sourceLine, tx, L.sourceTop - h / 2, textW, h, source.size, PANEL_COLORS.caption, HorizontalAlignment.Left)
    }

    // Close: a solid red-ish square with a bold white X and a bright rim. Big hit box.
    const close: ButtonView = {kind: "close", hit: L.closeHit, parts: []}
    let n = this.parts.length
    this.quads("close_fill", [L.close], BUTTON_COLORS.closeFill, 0.03)
    this.buttonPart(close, n, BUTTON_COLORS.closeFill, BUTTON_COLORS.closeFillHover)
    n = this.parts.length
    this.quads("close_rim", frameRects(L.close, 0.35), BUTTON_COLORS.rim, 0.04)
    this.buttonPart(close, n, BUTTON_COLORS.rim, BUTTON_COLORS.rimHover)
    n = this.parts.length
    this.chunkPart("close_x", crossChunk(L.close, 1.1, 0.05), BUTTON_COLORS.closeMark)
    this.buttonPart(close, n, BUTTON_COLORS.closeMark, BUTTON_COLORS.closeMarkHover)

    // Next spot: an amber pill with its label.
    const next: ButtonView = {kind: "next", hit: L.nextHit, parts: []}
    n = this.parts.length
    this.quads("next_fill", [L.next], BUTTON_COLORS.nextFill, 0.03)
    this.buttonPart(next, n, BUTTON_COLORS.nextFill, BUTTON_COLORS.nextFillHover)
    n = this.parts.length
    this.quads("next_rim", frameRects(L.next, 0.3), BUTTON_COLORS.rim, 0.04)
    this.buttonPart(next, n, BUTTON_COLORS.rim, BUTTON_COLORS.rimHover)
    n = this.parts.length
    const nw = L.next.x1 - L.next.x0, nh = L.next.y1 - L.next.y0
    this.text("next_label", "Next spot  >", (L.next.x0 + L.next.x1) / 2, (L.next.y0 + L.next.y1) / 2, nw - 1, nh * 0.7, S.button, BUTTON_COLORS.nextText, HorizontalAlignment.Center)
    this.buttonPart(next, n, BUTTON_COLORS.nextText, BUTTON_COLORS.nextTextHover)
    this.buttons = [close, next, this.buildAskButton(L.ask, L.askHit, S.button)]
    this.hovered = ""

    if (L.art && L.artBox) this.buildCompactArt(art, L)
    // Ray target over the whole card, plus the hit boxes' overhang past the edge.
    this.makeHitTarget({x0: L.card.x0 - 3, y0: L.card.y0 - 3, x1: L.card.x1 + 3, y1: L.card.y1 + 3})
  }

  /**
   * The Ask button: a cyan pill with a microphone and "Ask". The one way to ask a question; it opens the chat's mic
   * and its suggested-question chips. `size` is the label's text size.
   */
  private buildAskButton(r: Rect2, hit: Rect2, size: number): ButtonView {
    const C = BUTTON_COLORS
    const b: ButtonView = {kind: "ask", hit, parts: []}
    let n = this.parts.length
    this.quads("ask_fill", [r], C.askFill, 0.03)
    this.buttonPart(b, n, C.askFill, C.askFillHover)
    n = this.parts.length
    this.quads("ask_rim", frameRects(r, 0.35), C.askRim, 0.04)
    this.buttonPart(b, n, C.askRim, C.askRimHover)
    const h = r.y1 - r.y0
    const s = h * 0.62
    const gx = r.x0 + Math.max(0.6, h * 0.14) + s / 2, cy = (r.y0 + r.y1) / 2
    n = this.parts.length
    this.quads("ask_mic", micGlyphRects(gx, cy, s), C.askMark, 0.05)
    this.buttonPart(b, n, C.askMark, C.askMarkHover)
    const lx0 = gx + s / 2 + h * 0.08, lx1 = r.x1 - h * 0.1
    n = this.parts.length
    this.text("ask_label", "Ask", (lx0 + lx1) / 2, cy, Math.max(1, lx1 - lx0), h * 0.7, size, C.askMark, HorizontalAlignment.Center)
    this.buttonPart(b, n, C.askMark, C.askMarkHover)
    return b
  }

  /** Art column of the compact card: one piece at a time (cycling), framed, with the credit under it. */
  private buildCompactArt(art: ArtItem[], L: CompactLayout) {
    const mat = this.mediaMaterial || loadBuiltinMaterial()
    if (!mat) {
      print("[Retrospecs] art: no media material (wire Media Material = Materials/CaptureTexture.mat)")
      return
    }
    const box = L.artBox
    this.quads("art_fill", [box], PANEL_COLORS.artFill, -0.04)
    this.quads("art_frame", frameRects(box, 0.3), PANEL_COLORS.frame, 0)
    const bw = box.x1 - box.x0 - 1.2, bh = box.y1 - box.y0 - 1.2
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2
    art.forEach((a, i) => {
      const r = fitMedia(this.aspectOf(a.tex), bw, bh)
      const holder = global.scene.createSceneObject("panel_art_" + i)
      holder.setParent(this.root)
      const o = global.scene.createSceneObject("panel_art_media_" + i)
      o.setParent(holder)
      const visual = this.meshObject(o, quadsChunk([{x0: cx - r.w / 2, y0: cy - r.h / 2, x1: cx + r.w / 2, y1: cy + r.h / 2}], 0.02))
      const m = mat.clone()
      try {
        m.mainPass.baseTex = a.tex
        m.mainPass.twoSided = true
      } catch (e) {
        print("[Retrospecs] art: media material has no baseTex: " + e)
      }
      visual.mainMaterial = m
      this.startVideo(a.tex, a.id)
      holder.enabled = i === 0
      this.artObjs.push(holder)
    })
    this.artIndex = 0
    this.artClock = 0
    if (L.credit) {
      const c = L.credit
      this.text("credit", ARTIST_CREDIT, (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, c.x1 - c.x0, c.y1 - c.y0, COMPACT_SIZES.small, PANEL_COLORS.credit, HorizontalAlignment.Center)
    }
    print(`[Retrospecs] art (compact card): ${art.length} piece(s) in a ${(box.x1 - box.x0).toFixed(1)} x ${(box.y1 - box.y0).toFixed(1)} cm column`)
  }

  /** A fading mesh part from a ready-made chunk (the X). */
  private chunkPart(name: string, chunk: MeshChunk, rgba: number[]) {
    if (!chunk.idx.length) return
    const o = global.scene.createSceneObject("panel_" + name)
    o.setParent(this.root)
    const visual = this.meshObject(o, chunk)
    const m = this.material.clone()
    visual.mainMaterial = m
    this.parts.push({material: m, rgba})
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
    tr.setWorldScale(vec3.one().uniformScale(this.size() * (0.12 + 0.88 * k)))
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
    // Heights follow the wrapped text: title and namesake up to two lines each, the fact up to about 22 cm.
    const title = fitText(card.name, inner, LINE_CM_PER_PT * this.titleTextSize * 2.05, this.titleTextSize)
    const namesake = card.namesake ? fitText(card.namesake, inner, LINE_CM_PER_PT * this.namesakeTextSize * 2.05, this.namesakeTextSize) : null
    const body = fact ? fitText(fact.text, inner, 22, this.bodyTextSize) : null
    const titleH = title.h * 1.08
    const namesakeH = namesake ? namesake.h * 1.08 : 0
    const art = this.artFor(card.id)
    // On the art buildings her art screen takes the graphic's place, which keeps the screen inside the view.
    const g = sourceLine || art.length ? null : panelGraphic(fact)
    const bodyH = body ? body.h * 1.08 : 0
    const graphicH = g ? 10 : 0
    const sourceH = sourceLine ? fitText(sourceLine, inner, 6, this.smallTextSize).h * 1.08 : 0

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
    this.text("title", card.name, 0, y - titleH / 2, inner, titleH, title.size, PANEL_COLORS.title, HorizontalAlignment.Left)
    y -= titleH + 0.6
    if (card.namesake) {
      this.text("namesake", card.namesake, 0, y - namesakeH / 2, inner, namesakeH, namesake.size, PANEL_COLORS.namesake, HorizontalAlignment.Left)
      y -= namesakeH
    }
    y -= 1.0
    // Divider: a short bright lead-in, then a dim rule.
    this.quads("divider", [{x0: x0 + pad + 8, y0: y - 0.12, x1: x1 - pad, y1: y + 0.12}], PANEL_COLORS.track, 0.01)
    this.quads("divider_lead", [{x0: x0 + pad, y0: y - 0.2, x1: x0 + pad + 7, y1: y + 0.2}], PANEL_COLORS.accent, 0.02)
    y -= 1.4
    if (fact) {
      this.text("fact", fact.text, 0, y - bodyH / 2, inner, bodyH, body.size, PANEL_COLORS.body, HorizontalAlignment.Left)
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
    if (cardId !== "huang" && cardId !== "hpgarage") return wired
    // Wired slots first, then any built-in piece they don't already cover. (The scene's Huang slot holds only the
    // still, which used to hide the Huang animation.)
    const nameOf = (t: Texture) => {
      try {
        return t.name || ""
      } catch (e) {
        return ""
      }
    }
    const have = wired.map((a) => nameOf(a.tex)).filter((s) => !!s)
    const extra = loadBuiltinArt().filter((a) => a.id === cardId && have.indexOf(nameOf(a.tex)) < 0)
    // Keep the emailed illustration visible with the words. The HP animation has its own life-size scene.
    // Huang's current animation depicts the HP founders, so do not show it as Page and Brin.
    return wired.concat(extra).filter((a) => !this.isVideo(a.tex))
  }

  private isVideo(tex: Texture): boolean {
    try {
      const c = tex.control as any
      return !!c && typeof c.play === "function"
    } catch (e) {
      return false
    }
  }

  private aspectOf(tex: Texture): number {
    try {
      const w = tex.getWidth(), h = tex.getHeight()
      if (w > 0 && h > 0) return w / h
    } catch (e) {
      // A video before its first frame cannot report its size. Both Nazeli animations are 640 x 368 (360 padded with
      // 4 px of black top and bottom: Spectacles wants both sides a multiple of 16; black is see-through).
    }
    return 640 / 368
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
      this.startVideo(a.tex, a.id)
      holder.enabled = i === 0
      this.artObjs.push(holder)
    })
    this.artIndex = 0
    this.artClock = 0
    this.text("credit", ARTIST_CREDIT, 0, bottomY - 1.6 - 0.1, this.artMaxWidthCm, 3.0, this.smallTextSize, PANEL_COLORS.credit, HorizontalAlignment.Center)
    print(`[Retrospecs] art screen: ${art.length} piece(s), ${box.w.toFixed(1)} x ${box.h.toFixed(1)} cm, credit "${ARTIST_CREDIT}"`)
  }

  /**
   * Loops a video texture (muted). The asset has Auto Play on, so it may already be playing (play() then throws, which
   * used to drop the video silently), or still preparing (play() before it's ready does nothing on device). Restart
   * when stopped, wait for onPlaybackReady while preparing, and log the state so a device run shows what happened.
   */
  private startVideo(tex: Texture, id: string) {
    let vp: VideoTextureProvider = null
    try {
      const c = tex.control as any
      if (c && typeof c.play === "function" && "status" in c) vp = c as VideoTextureProvider
    } catch (e) {
      return
    }
    if (!vp) return
    try {
      vp.volume = 0
    } catch (e) {
      // No volume control: the clips have no audio track anyway.
    }
    const playNow = (why: string) => {
      try {
        if (vp.status === VideoStatus.Playing) vp.stop()
      } catch (e) {
        // Not playing.
      }
      try {
        vp.play(-1)
        print(`[Retrospecs] art video ${id}: playing (${why})`)
      } catch (e) {
        print(`[Retrospecs] art video ${id}: play failed (${why}): ${e}`)
      }
    }
    let status = -1
    try {
      status = vp.status
    } catch (e) {
      // Unknown.
    }
    print(`[Retrospecs] art video ${id}: status ${status} (Playing=${VideoStatus.Playing}, Preparing=${VideoStatus.Preparing})`)
    if (status === VideoStatus.Preparing) {
      // Once only: play() fires onPlaybackReady again, which used to restart the clip every few frames (frozen look).
      let started = false
      try {
        vp.onPlaybackReady.add(() => {
          if (started) return
          started = true
          playNow("ready")
        })
      } catch (e) {
        playNow("no ready event")
      }
    } else {
      playNow("status " + status)
    }
    this.videos.push(vp)
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

  private quads(name: string, rects: Rect2[], rgba: number[], z: number, parent?: SceneObject): SceneObject | null {
    const chunk = quadsChunk(rects, z)
    if (!chunk.idx.length) return null
    const o = global.scene.createSceneObject("panel_" + name)
    o.setParent(parent || this.root)
    const visual = this.meshObject(o, chunk)
    const m = this.material.clone()
    visual.mainMaterial = m
    this.parts.push({material: m, rgba})
    return o
  }

  private text(
    name: string, s: string, cx: number, cy: number, w: number, h: number, size: number, rgba: number[],
    align: HorizontalAlignment
  ) {
    const o = global.scene.createSceneObject("panel_text_" + name)
    o.setParent(this.root)
    o.getTransform().setLocalPosition(new vec3(cx, cy, 0.08))
    try {
      const t = o.createComponent("Component.Text") as Text
      if (this.font) t.font = this.font
      t.text = s
      // Size picked here to fit the box (no Shrink, which dropped lines); top-aligned in a box as tall as the lines,
      // centred on the slot, so short labels still sit in the middle of their space.
      const fit = fitText(s, w, h, size)
      const bh = Math.min(h, fit.h * 1.08)
      t.size = Math.max(4, Math.round(fit.size))
      t.horizontalAlignment = align
      t.verticalAlignment = VerticalAlignment.Top
      t.worldSpaceRect = Rect.create(-w / 2, w / 2, -bh / 2, bh / 2)
      t.horizontalOverflow = HorizontalOverflow.Wrap
      t.verticalOverflow = VerticalOverflow.Overflow
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
    this.buttons = []
    this.hitTarget = null
    this.hovered = ""
    if (this.root) this.root.destroy()
    this.root = null
    this.parts = []
    this.t = 0
  }
}

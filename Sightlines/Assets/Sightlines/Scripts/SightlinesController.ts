/**
 * Sightlines main controller: a Stanford tour guide on a 3D campus map at your feet.
 *
 * Flow
 *  1. CALIBRATE  Face a wall of known direction and pinch a point on its LEFT, then its RIGHT. The wall's compass
 *                bearing comes from the building's OSM footprint (Huang's walls run at 15/105/195/285 deg), and
 *                `facingHint` picks which face you're looking at. Two-hand twist nudges the yaw afterwards.
 *  2. TOUR       The map unfolds on the floor, centred on you. Right pinch = "tell me about what I'm looking at"
 *                (real building or one on the map). Left pinch = ask by voice. Say "lift" / "floor".
 *  3. GUESS      After each building: "Point to where you think X is, then pinch." Scored in degrees; the true
 *                direction arcs out on the map and a sightline pillar appears in the room; a new fact unlocks.
 *
 * Editor Preview: tap = calibrate (camera forward as the wall facing), then tap = right pinch.
 */
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {tidyLabel} from "./LabelStyle"
import {ASRController} from "../../Scripts/ASRController"
import {WorldLabel} from "../../Scripts/WorldLabel"
import {LANDMARKS} from "../Data/CampusData"
import {CARDS, cardById, factById} from "../Core/Cards"
import {EN, V3, angleDiff, facingFromWallPinches, latLonToEN, mapYawFor, snapFacingBearing, worldDirToBearing} from "../Core/Geo"
import {ValidatedAnswer, founderConstellation, guessPrompt, nextFact, nextGuessTarget, scoreGuess, themesFromProfile, yourStanford} from "../Core/Guide"
import {SightlinesGuide} from "./SightlinesGuide"
import {SightlinesMap} from "./SightlinesMap"
import {buildDisc, buildRing, buildTube} from "../Core/MapMesh"
import {LocateResult, SightlinesLocator} from "./SightlinesLocator"
import {SightlinesOverlay} from "./SightlinesOverlay"
import {SightlinesMoney} from "./SightlinesMoney"
import {SightlinesShowcase} from "./SightlinesShowcase"
import {SightlinesInfoPanel} from "./SightlinesInfoPanel"
import {Fact} from "../Core/Cards"
import {FocusLayout, focusLayout, idleExpired} from "../Core/Focus"

type Mode = "calibrate" | "tour" | "guess"

const STORE_KEY = "sightlines.v1"
const THINKING_LINE = "Let me check my notes."

@component
export class SightlinesController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Sightlines Controller</span>')
  @input camera: SceneObject
  @input map: SightlinesMap
  @input guide: SightlinesGuide
  @input @allowUndefined asr: ASRController

  @ui.group_start("Start point (one-pinch calibration)")
  @input @hint("ON: stand on the known start point, face down the street, pinch once. OFF: the wall-pinch calibration at the survey spot below.") useStartPoint: boolean = true
  @input @hint("Default: where the North-South Axis (OSM: Via Crespi) crosses the East-West Axis, just east of Huang (OSM).") startLat: number = 37.4281869
  @input startLon: number = -122.1735285
  @input @hint("Compass bearing you face when you pinch. 104.8 = east down the East-West Axis, between Physics and Moore (OSM).") startFacingDeg: number = 104.8
  @input @hint("Spoken/written instruction for the start point") startInstruction: string = "Stand where the North-South and East-West axes cross. Face east down the walkway, between Physics and Moore, then pinch."
  @ui.group_end

  @ui.group_start("Where you stand (survey)")
  @input @hint("Latitude of the spot the wearer stands on. Default: Huang Engineering Center.") surveyLat: number = 37.427884
  @input surveyLon: number = -122.17433
  @input @hint("Compass bearing of the calibration wall's direction (mod 90). Huang = 15.") wallBearing: number = 15
  @input @hint("Roughly which way you face when looking at the calibration wall (deg). Snapped to the nearest wall face. Measure once at the venue.") facingHint: number = 105
  @ui.group_end

  @ui.group_start("Placement")
  @input @hint("Head height above the floor when standing (cm)") eyeHeightCm: number = 160
  @input @hint("How far in front of you the floor map's centre sits (cm)") floorForwardCm: number = 140
  @input @hint("Map height above the floor in table mode (cm)") tableHeightCm: number = 85
  @input @hint("How far in front of you the table-mode map sits (cm)") tableForwardCm: number = 55
  @input startLifted: boolean = false
  @input @hint("Height of the floating \"You are here\" tag above your pin on the map (map cm)") youAreHereHeightCm: number = 16
  @input youAreHereScale: number = 1.8
  @input @hint("Move/resize handle on the map rim: size and how close a pinch must be to grab it (cm)") handleRadiusCm: number = 4
  @input handleGrabCm: number = 10
  @input @hint("Map size when it first unfolds (1 = 2.3 m across). Resize later with two hands or \"bigger\"/\"smaller\".") startMapScale: number = 0.65
  @ui.group_end

  @ui.group_start("Optional")
  @input @allowUndefined statusText: Text
  @input showStatusLabel: boolean = true
  @input autoQuiz: boolean = true
  @input @hint("Keep heard facts across launches. Leave OFF for judging so every relaunch starts fresh.") persistProgress: boolean = false
  @ui.group_end

  @ui.group_start("Real-world visuals")
  @input @allowUndefined @hint("GPS + Gemini: which real building am I looking at? Long right pinch or say \"what's that\".") locator: SightlinesLocator
  @input @allowUndefined @hint("Nametag + roofline outline on the real building") overlay: SightlinesOverlay
  @input @allowUndefined @hint("Life-size pile of $1 bills for the building's gift") money: SightlinesMoney
  @input @hint("Indoor demo: put the money pile on the map instead of life-size in the room") moneyOnMap: boolean = true
  @input @hint("Extra scale for the on-map pile (1 = true map scale)") moneyMapExaggeration: number = 3
  @input @allowUndefined @hint("Exploded product models shown while a fact is spoken") showcase: SightlinesShowcase
  @input @hint("Exploded model size (cm) and distance in front of you (cm)") showcaseScaleCm: number = 40
  @input showcaseForwardCm: number = 75
  @input @hint("Hold a right pinch this long (s) to identify the real building instead") longPinchSec: number = 0.6
  @ui.group_end

  @ui.group_start("Focus mode (selected building)")
  @input @allowUndefined @hint("Floating card above the selected building: name, namesake, the fact, a number graphic") infoPanel: SightlinesInfoPanel
  // HOOK for the per-building 3D experiences (Scripts/SightlinesExperiences.ts, another session's class). Typed as a
  // plain script component and called through `any`: show(id, anchorWorldPos: vec3, faceToward: vec3, scaleCm) and
  // hide(), if present.
  @input @allowUndefined @hint("Per-building 3D experience (SightlinesExperiences). Shown to the wearer's left of the card.") experiences: ScriptComponent
  @input @hint("Experience size (world cm)") experienceScaleCm: number = 30
  @input @hint("Leave focus this many seconds after the guide stops talking (0 = never)") focusIdleSec: number = 25
  @input @hint("ON: exploded model floats beside the focused building, right of the card. OFF: in front of you as before.") showcaseNearBuilding: boolean = true
  @input @hint("Gap between the card and the side objects (world cm)") focusSideGapCm: number = 4
  @ui.group_end

  private mode: Mode = "calibrate"
  private me: EN = {e: 0, n: 0}
  private mapYaw = 0
  private floorY = 0
  private lifted = false
  private wallPoints: V3[] = []
  private focus = ""
  private guessTarget = ""
  private unfoldT = -1
  private twist: {lastYaw: number; lastDist: number} = null
  private positions: Record<string, EN> = {}
  private isEditor = global.deviceInfoSystem.isEditor()
  private statusHolder: SceneObject = null
  private statusLabel: Text = null
  private state = {heard: [] as string[], seen: [] as string[], guessed: [] as string[], profile: "", bestErr: 999}
  /** Focus mode: the selected building ("" = none) and when the guide last spoke during it. */
  private focusMode = ""
  private focusActiveAt = 0

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart() {
    this.me = this.useStartPoint ? latLonToEN(this.startLat, this.startLon) : latLonToEN(this.surveyLat, this.surveyLon)
    for (const l of LANDMARKS) this.positions[l.id] = {e: l.east, n: l.north}
    for (const c of CARDS) if (c.offMap) this.positions[c.id] = latLonToEN(c.offMap.lat, c.offMap.lon)
    if (this.locator) this.locator.setSurvey(this.me)
    this.load()
    this.bindHands()
    if (this.asr) {
      this.asr.onFinalVoiceEvent.add((t) => this.handleUtterance(t))
      this.asr.onPartialVoiceEvent.add((t) => this.setStatus("“" + t + "”"))
      // onErrorEvent exists only in the patched ASRController; the stock 5.15.4 one doesn't have it.
      const errEvent = (this.asr as any).onErrorEvent
      if (errEvent && errEvent.add) errEvent.add((e: string) => this.setStatus("Voice error: " + e))
    }
    if (this.isEditor) this.createEvent("TapEvent").bind(() => this.onEditorTap())
    this.makeStatusLabel()
    this.setupInfoPanel()
    this.prefetchStartup()
    this.setStatus(this.calibrateInstruction())
  }

  // -------------------------------------------------------------------------
  // Input

  private bindHands() {
    try {
      const right = SIK.HandInputData.getHand("right")
      const left = SIK.HandInputData.getHand("left")
      right.onPinchDown.add(() => this.onPinch("right"))
      left.onPinchDown.add(() => this.onPinch("left"))
      right.onPinchUp.add(() => this.onRightPinchUp())
    } catch (e) {
      print("[Sightlines] hand input unavailable: " + e)
    }
  }

  private rightDownAt = -1

  private onPinch(which: "left" | "right") {
    const hand = SIK.HandInputData.getHand(which)
    if (!hand || !hand.isTracked()) return
    const other = SIK.HandInputData.getHand(which === "left" ? "right" : "left")
    if (other && other.isTracked() && other.isPinching()) return // two-hand twist, handled in update
    if (this.mode === "calibrate") {
      if (this.useStartPoint) return this.finishCalibration(this.viewHorizontal())
      return this.addWallPoint(toV3(hand.indexTip.position))
    }
    if (this.tryGrabHandle(which, hand.indexTip.position)) return
    // Left pinch always means "listen", so a question is never blocked by a pending quiz.
    if (which === "left" && this.asr) return this.listen()
    if (this.mode === "guess") return this.lockGuess(toV3(hand.indexKnuckle.position))
    // Tour, right hand: decide on release. Short = tell about gaze, long = identify the real building.
    if (which === "right" && this.locator) {
      this.rightDownAt = getTime()
      return
    }
    this.tellAboutGaze()
  }

  private onRightPinchUp() {
    if (this.rightDownAt < 0) return
    const held = getTime() - this.rightDownAt
    this.rightDownAt = -1
    if (this.mode !== "tour") return
    if (this.twist) return // it was a two-hand twist
    if (held >= this.longPinchSec) this.identifyReal()
    else this.tellAboutGaze()
  }

  private onEditorTap() {
    if (this.mode === "calibrate") {
      this.finishCalibration(this.viewHorizontal())
      return
    }
    if (this.mode === "guess") {
      // Preview: "point" where the camera looks.
      const cam = this.camera.getTransform().getWorldPosition()
      const f = this.viewHorizontal()
      return this.lockGuess({x: cam.x + f.x * 60, y: cam.y, z: cam.z + f.z * 60})
    }
    this.tellAboutGaze()
  }

  listen() {
    if (!this.asr) return
    this.guide.stopSpeaking()
    this.setStatus("Listening…")
    this.asr.startListening()
  }

  // -------------------------------------------------------------------------
  // Calibration

  private addWallPoint(p: V3) {
    this.wallPoints.push(p)
    if (this.wallPoints.length === 1) {
      this.setStatus("Now pinch a point on the wall's RIGHT side.")
      return
    }
    const facing = facingFromWallPinches(this.wallPoints[0], this.wallPoints[1])
    this.wallPoints = []
    if (!facing) {
      this.setStatus("Those were too close together. Pinch LEFT, then RIGHT, at least 30 cm apart.")
      return
    }
    // Sanity check: the facing should roughly agree with where the wearer is looking.
    const view = this.viewHorizontal()
    const agree = facing.x * view.x + facing.z * view.z
    this.finishCalibration(agree < 0 ? {x: -facing.x, y: 0, z: -facing.z} : facing)
  }

  private finishCalibration(facingWorld: V3) {
    const bearing = this.useStartPoint ? this.startFacingDeg : snapFacingBearing(this.wallBearing, this.facingHint)
    this.mapYaw = mapYawFor(facingWorld, bearing)
    const cam = this.camera.getTransform().getWorldPosition()
    this.floorY = cam.y - this.eyeHeightCm
    if (this.useStartPoint) {
      // A surveyed point beats phone GPS (±20 m), so don't let GPS move the map.
      this.me = latLonToEN(this.startLat, this.startLon)
      if (this.locator) this.locator.setSurvey(this.me)
    } else if (this.locator) {
      // Outdoors with a good GPS fix (or a saved standing spot), centre the map on it; otherwise keep the survey spot.
      const w = this.locator.wearer()
      print(`[Sightlines] wearer position: ${w.source}${w.spotId ? " " + w.spotId : ""} (${w.reason})`)
      if (w.source !== "survey") this.me = w.en
    }
    this.hideExtras()
    this.map.build(this.me, this.camera)
    if (this.overlay) this.overlay.setCenter(this.map.center)
    this.makeYouAreHere()
    this.makeHandle()
    this.mapScale = this.startMapScale
    this.lifted = this.startLifted
    this.placeMap(true)
    this.mode = "tour"
    this.unfoldT = 0
    const here = this.nearestLandmark(this.me)
    print(`[Sightlines] calibrated: facing bearing ${bearing}, map yaw ${(this.mapYaw * 180 / Math.PI).toFixed(1)}°`)
    this.resetLights()
    if (here) this.map.setState(here, "focus")
    const hereName = here ? cardById(here).name : "Stanford"
    this.say(`Welcome to Stanford. You're at ${hereName}. Look at any building and pinch to hear about it.`, `You're at ${hereName}. Look at a building and pinch. Left pinch to ask.`)
  }

  /** Puts the map on the floor centred on the wearer, or at table height in front of them. */
  private placeMap(resetCenter: boolean) {
    if (!this.map.root) return
    const camT = this.camera.getTransform()
    const cam = camT.getWorldPosition()
    const rot = quat.angleAxis(this.mapYaw, vec3.up())
    let pos: vec3
    if (this.lifted) {
      const f = this.viewHorizontal()
      pos = new vec3(cam.x + f.x * this.tableForwardCm, this.floorY + this.tableHeightCm, cam.z + f.z * this.tableForwardCm)
    } else {
      const f = this.viewHorizontal()
      pos = new vec3(cam.x + f.x * this.floorForwardCm, this.floorY + 1, cam.z + f.z * this.floorForwardCm)
    }
    const t = this.map.root.getTransform()
    if (resetCenter || this.lifted) t.setWorldPosition(pos)
    else t.setWorldPosition(new vec3(t.getWorldPosition().x, pos.y, t.getWorldPosition().z))
    t.setWorldRotation(rot)
    // World-space sightlines stay anchored at the wearer's floor position.
    const w = this.map.worldRoot.getTransform()
    w.setWorldPosition(new vec3(cam.x, this.floorY, cam.z))
    w.setWorldRotation(rot)
  }

  private setLifted(on: boolean) {
    this.lifted = on
    this.placeMap(true)
    this.setStatus(on ? "Map lifted. Say “floor” to put it back." : "Map on the floor around you.")
  }

  // -------------------------------------------------------------------------
  // Tour

  /** Which landmark is the wearer looking at? Looking down = on the map; looking out = the real direction. */
  private gazedLandmark(): string {
    const camT = this.camera.getTransform()
    const cam = camT.getWorldPosition()
    const dir = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const mapY = this.map.root.getTransform().getWorldPosition().y
    if (dir.y < -0.3) {
      const t = (mapY - cam.y) / dir.y
      if (t > 0) {
        const hit = cam.add(dir.uniformScale(t))
        const local = this.map.root.getTransform().getInvertedWorldTransform().multiplyPoint(hit)
        const id = this.map.pickAtMapPoint(local, 5)
        if (id) return id
      }
    }
    const bearing = worldDirToBearing(toV3(dir), this.mapYaw)
    let best = ""
    let bestScore = 1e9
    for (const id of Object.keys(this.map.landmarks)) {
      const d = this.map.distanceTo(id)
      if (d < 25) continue // you're standing in it
      const err = Math.abs(angleDiff(this.map.bearingTo(id), bearing))
      const score = err + d / 200 // prefer nearer when angles are close
      if (err < 14 && score < bestScore) {
        bestScore = score
        best = id
      }
    }
    return best
  }

  tellAboutGaze() {
    const id = this.gazedLandmark() || this.focus || this.nearestLandmark(this.me)
    if (!id) return this.setStatus("Look at a building, on the map or out there, and pinch.")
    this.tellAbout(id)
  }

  private tellAbout(id: string) {
    const fact = nextFact(id, this.state.heard, themesFromProfile(this.state.profile))
    const card = cardById(id)
    this.focusOn(id)
    this.enterFocus(id, fact)
    if (!fact) {
      if (this.showcase) this.showcase.hide()
      this.say(`That's all my notes on ${card.name}. Let's try another one.`, `${card.label}: all facts heard`, this.quizAfterSpeech(id))
      return
    }
    this.markHeard(fact.id)
    this.showModelFor(fact.id)
    this.say([`${card.name}.`, fact.text], `${card.label}\n${fact.text}`, this.quizAfterSpeech(id))
    this.prefetchAround(id)
  }

  private focusOn(id: string, withMoney = true) {
    this.resetLights()
    this.focus = id
    this.map.setState(id, "focus")
    if (this.state.seen.indexOf(id) < 0) this.state.seen.push(id)
    this.map.drawSightline(id)
    if (withMoney && this.money) this.money.showForLandmark(id, this.map, this.moneyOnMap, {mapExaggeration: this.moneyMapExaggeration, mapOffsetCm: this.moneyClearanceCm(id)})
    this.save()
  }

  /** On-map money pile offset: just outside the focused building's grown footprint, on the wearer's side. */
  private moneyClearanceCm(id: string): number {
    return Math.max(4, this.map.focusClearanceCm(id) + 2.5)
  }

  /** Exploded product model for the fact being spoken: beside the focused building, or in front of the wearer. */
  private showModelFor(factId: string) {
    if (!this.showcase) return
    const mid = this.showcase.modelForFact(factId)
    if (!mid) return this.showcase.hide()
    const cam = this.camera.getTransform().getWorldPosition()
    const layout = this.showcaseNearBuilding && this.focusMode ? this.focusLayoutFor(this.focusMode) : null
    if (layout) {
      this.showcase.show(mid, new vec3(layout.showcase.x, layout.showcase.y, layout.showcase.z), cam, this.showcaseScaleCm)
      return
    }
    const f = this.viewHorizontal()
    this.showcase.show(mid, new vec3(cam.x + f.x * this.showcaseForwardCm, cam.y - 10, cam.z + f.z * this.showcaseForwardCm), cam, this.showcaseScaleCm)
  }

  // -------------------------------------------------------------------------
  // Focus mode: the selected building grows, everything else shrinks back, and a card rises out of it.

  /** Focus card: uses the wired `infoPanel`, or adds one to this object so no scene wiring is needed. */
  private setupInfoPanel() {
    try {
      if (!this.infoPanel) this.infoPanel = this.getSceneObject().createComponent(SightlinesInfoPanel.getTypeName()) as SightlinesInfoPanel
      if (!this.infoPanel) return
      if (!this.infoPanel.material && this.map) this.infoPanel.material = this.map.material
      if (!this.infoPanel.camera) this.infoPanel.camera = this.camera
    } catch (e) {
      print("[Sightlines] info panel unavailable: " + e)
    }
  }

  /** Enters (or moves) focus to `id`, with `fact` on the card (null: name and namesake only). */
  private enterFocus(id: string, fact: Fact | null) {
    const card = cardById(id)
    if (!card || !this.map.root || !this.map.landmarks[id]) return
    this.focusMode = id
    this.focusActiveAt = getTime()
    this.map.setFocus(id)
    const frame = this.map.focusFrame(id)
    const cam = this.camera.getTransform().getWorldPosition()
    if (this.infoPanel && frame) this.infoPanel.show(card, fact, frame.top, cam)
    const exp = this.experiences as any
    if (exp) {
      const layout = this.focusLayoutFor(id)
      try {
        if (exp.hide) exp.hide()
        // Experiences treat the anchor as their base and rise ~1.1x scale above it; the layout gives a centre.
        if (layout && exp.show) exp.show(id, new vec3(layout.experience.x, layout.experience.y - this.experienceScaleCm * 0.55, layout.experience.z), cam, this.experienceScaleCm)
      } catch (e) {
        print("[Sightlines] experiences hook failed: " + e)
      }
    }
  }

  /** Smoothly restores the whole map and puts the card away. Extras (money, model) are left to the caller. */
  private exitFocus() {
    if (!this.focusMode) return
    this.focusMode = ""
    this.map.setFocus(null)
    if (this.infoPanel) this.infoPanel.hide()
    const exp = this.experiences as any
    if (exp && exp.hide) {
      try {
        exp.hide()
      } catch (e) {
        print("[Sightlines] experiences hide failed: " + e)
      }
    }
  }

  /** Card above the building; exploded model to the wearer's right of it; the experience to the left. */
  private focusLayoutFor(id: string): FocusLayout | null {
    const frame = this.map.focusFrame(id)
    if (!frame) return null
    const cam = this.camera.getTransform().getWorldPosition()
    const p = this.infoPanel
    return focusLayout(frame.base, frame.top, cam, {
      panelWidthCm: p ? p.panelWidthCm : 30,
      panelHeightCm: p ? p.panelHeightCm : 24,
      panelGapCm: p ? p.panelGapCm : 6,
      sideObjectCm: Math.max(this.showcaseScaleCm, this.experienceScaleCm),
      sideGapCm: this.focusSideGapCm
    })
  }

  /** Keeps the card on its building while the map moves, and leaves focus after the idle time. */
  private updateFocusMode() {
    if (!this.focusMode) return
    if (this.mode === "calibrate" || !this.map.root) return this.exitFocus()
    const now = getTime()
    if (this.guide.isSpeaking()) this.focusActiveAt = now
    if (idleExpired(now, this.focusActiveAt, this.focusIdleSec)) {
      print("[Sightlines] focus idle, restoring the map")
      this.hideExtras()
      return
    }
    const frame = this.map.focusFrame(this.focusMode)
    if (frame && this.infoPanel) this.infoPanel.setAnchor(frame.top)
  }

  /** Long right pinch / "what's that": GPS + Gemini picks the real building in view, then tag it and stack its gift beside it. */
  private identifyReal() {
    if (!this.locator) return this.setStatus("Building finder not wired (controller → locator).")
    if (this.mode === "calibrate") return this.setStatus("Calibrate first: pinch the wall's left, then right.")
    this.setStatus("Looking…")
    this.locator
      .identify()
      .then((r: LocateResult | null) => {
        if (!r) return this.setStatus("I can't tell which building that is. Face it squarely and try again.")
        print(`[Sightlines] identified ${r.id} (${r.source}, conf ${r.confidence.toFixed(2)}, ${Math.round(r.distanceM)} m)`)
        const tag = this.overlay ? this.overlay.showBuilding(r, this.map.worldRoot, this.map.center) : null
        const card = r.landmark ? cardById(r.id) : null
        if (card) {
          this.focusOn(r.id, false)
          if (this.money && this.money.hasGift(r.id)) {
            if (this.moneyOnMap) this.money.showForLandmark(r.id, this.map, true, {mapExaggeration: this.moneyMapExaggeration, mapOffsetCm: this.moneyClearanceCm(r.id)})
            else this.money.show(r.id, this.pileSpot(r), this.camera.getTransform().getWorldPosition())
          }
          const fact = nextFact(r.id, this.state.heard, themesFromProfile(this.state.profile))
          this.enterFocus(r.id, fact)
          const lead = `That's ${card.name}${r.estimated ? ", I think" : ""}, ${Math.round(r.distanceM)} metres away.`
          if (fact) {
            this.markHeard(fact.id)
            this.showModelFor(fact.id)
            this.say([lead, fact.text], `${card.label}${r.estimated ? " (estimated)" : ""} · ${Math.round(r.distanceM)} m`, this.quizAfterSpeech(r.id))
          } else this.say(lead, `${card.label} · ${Math.round(r.distanceM)} m`)
        } else {
          this.setStatus(`${r.name}${r.estimated ? " (estimated)" : ""} · ${Math.round(r.distanceM)} m`)
        }
        void tag
      })
      .catch((e) => {
        print("[Sightlines] identify failed: " + e)
        this.setStatus("Couldn't identify that building. Try again.")
      })
  }

  /** Floor point for a life-size pile: toward the building, 8° to the right, 6–15 m out and 3 m short of it. */
  private pileSpot(r: LocateResult): vec3 {
    const cam = this.camera.getTransform().getWorldPosition()
    const to = r.worldPos.sub(cam)
    const yaw = Math.atan2(to.x, to.z) - (8 * Math.PI) / 180
    const dist = Math.max(600, Math.min(1500, r.distanceM * 100 - 300))
    return new vec3(cam.x + Math.sin(yaw) * dist, this.floorY, cam.z + Math.cos(yaw) * dist)
  }

  /** Warms the TTS cache with what is most likely to be said first, so pinches answer instantly. */
  private prefetchStartup() {
    const here = this.nearestLandmark(this.me)
    const hereName = here ? cardById(here).name : "Stanford"
    const lines = [`Welcome to Stanford. You're at ${hereName}. Look at any building and pinch to hear about it.`, THINKING_LINE, "Here's something new."]
    const themes = themesFromProfile(this.state.profile)
    for (const c of CARDS) {
      const f = nextFact(c.id, this.state.heard, themes)
      if (f) lines.push(`${c.name}.`, f.text)
    }
    for (const c of CARDS) lines.push(guessPrompt(c.id))
    this.guide.prefetch(lines)
  }

  /** After a fact about `id`: warm its next fact and the likely quiz prompt. */
  private prefetchAround(id: string) {
    const themes = themesFromProfile(this.state.profile)
    const lines: string[] = []
    const f = nextFact(id, this.state.heard, themes)
    if (f) lines.push(f.text)
    const target = nextGuessTarget(this.me, this.positions, this.state.guessed, id)
    if (target) {
      lines.push(guessPrompt(target))
      const tf = nextFact(target, this.state.heard, themes)
      if (tf) lines.push(tf.text)
    }
    this.guide.prefetch(lines)
  }

  private youAreHere: SceneObject = null
  private youT = 0

  /** Floating, bobbing "You are here" tag over the wearer's pin on the map (map root is rebuilt on calibration). */
  private makeYouAreHere() {
    if (!this.map.root || !this.map.labelPrefab) return
    const holder = global.scene.createSceneObject("you_are_here")
    holder.setParent(this.map.root)
    holder.getTransform().setLocalPosition(new vec3(0, this.youAreHereHeightCm, 0))
    holder.getTransform().setLocalScale(vec3.one().uniformScale(this.youAreHereScale))
    const t = tidyLabel(this.map.labelPrefab.instantiate(holder), "You are here")
    if (t) {
      try {
        t.textFill.color = new vec4(1, 0.55, 0.75, 1)
      } catch (e) {
        // keep white
      }
    }
    this.youAreHere = holder
  }

  private updateYouAreHere() {
    if (!this.youAreHere || !this.map.root) return
    this.youT += getDeltaTime()
    const t = this.youAreHere.getTransform()
    t.setLocalPosition(new vec3(0, this.youAreHereHeightCm + Math.sin(this.youT * 2.2) * 1.5, 0))
    const cam = this.camera.getTransform().getWorldPosition()
    const p = t.getWorldPosition()
    t.setWorldRotation(quat.angleAxis(Math.atan2(cam.x - p.x, cam.z - p.z), vec3.up()))
  }

  private calibrateInstruction(): string {
    if (this.isEditor) return this.useStartPoint ? "Preview: tap to calibrate (camera facing = start-point direction)." : "Preview: tap to calibrate (uses the camera's facing)."
    return this.useStartPoint ? this.startInstruction : "Face the wall. Pinch a point on its LEFT, then its RIGHT."
  }

  /** Clears the money pile, model and tags, and leaves focus mode. */
  private hideExtras() {
    this.exitFocus()
    if (this.money) this.money.hide()
    if (this.showcase) this.showcase.hide()
    if (this.overlay) this.overlay.hide()
  }

  /** Starts the next quiz 1.5 s after the current narration finishes (if nothing else happened meanwhile). */
  private quizAfterSpeech(fromId: string): () => void {
    return () => {
      if (!this.autoQuiz) return
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => {
        if (this.mode === "tour" && this.focus === fromId && !this.guide.isSpeaking()) this.startGuess(fromId)
      })
      ev.reset(1.5)
    }
  }

  startGuess(exclude: string) {
    const target = nextGuessTarget(this.me, this.positions, this.state.guessed, exclude)
    if (!target) {
      this.say("You've found every building on my list. Nice work!", "Tour complete")
      return
    }
    this.guessTarget = target
    this.mode = "guess"
    this.exitFocus() // the whole map comes back so you can think about where it is
    if (this.showcase) this.showcase.hide() // keep the pointing arm clear
    this.say(guessPrompt(target), `Point to ${cardById(target).label}, then pinch`)
  }

  private lockGuess(pointAt: V3) {
    const cam = this.camera.getTransform().getWorldPosition()
    const dir = {x: pointAt.x - cam.x, y: 0, z: pointAt.z - cam.z}
    if (Math.hypot(dir.x, dir.z) < 5) return this.setStatus("Stretch your arm out toward it, then pinch.")
    const pointed = worldDirToBearing(dir, this.mapYaw)
    const target = this.guessTarget
    const r = scoreGuess(target, this.me, this.positions[target], pointed)
    this.mode = "tour"
    this.state.guessed.push(target)
    this.state.bestErr = Math.min(this.state.bestErr, r.errorDeg)
    this.focusOn(target)
    // Your guess (orange) vs the truth (green), on the map and in the room.
    const radiusCm = this.map.radiusM * this.map.cmPerM
    this.map.drawBearingArc(pointed, radiusCm * 0.8, this.map.colors.guess)
    this.map.drawArcToLandmark(target, this.map.colors.truth)
    this.map.drawWorldBearing(pointed, this.map.colors.guess)
    this.map.drawWorldBearing(r.trueBearing, this.map.colors.truth)
    const fact = nextFact(target, this.state.heard, themesFromProfile(this.state.profile))
    if (fact) this.markHeard(fact.id)
    this.enterFocus(target, fact)
    const line = fact ? [r.verdict, "Here's something new.", fact.text] : [r.verdict]
    this.say(line, `${Math.round(r.errorDeg)}° off · best ${Math.round(this.state.bestErr)}°`, this.quizAfterSpeech(target))
  }

  // -------------------------------------------------------------------------
  // Voice

  handleUtterance(raw: string) {
    const t = (raw || "").toLowerCase().trim()
    if (!t) return
    if (this.mode === "calibrate") {
      if (/\b(skip|ready|done)\b/.test(t)) this.finishCalibration(this.viewHorizontal())
      return
    }
    if (/\b(lift|raise|table)\b/.test(t)) return this.setLifted(true)
    if (/\b(floor|lower|put it down)\b/.test(t)) return this.setLifted(false)
    if (/\b(recalibrate|calibrate)\b/.test(t)) return this.recalibrate()
    if (/\b(bigger|larger|zoom in|grow)\b/.test(t)) return this.setMapScale(this.mapScale * 1.4, true)
    if (/\b(smaller|zoom out|shrink)\b/.test(t)) return this.setMapScale(this.mapScale / 1.4, true)
    if (/\b(normal|reset) size\b/.test(t)) return this.setMapScale(this.startMapScale, true)
    if (/\bwhat('?s| is) (that|this)\b|\bwhat am i looking at\b/.test(t)) return this.identifyReal()
    if (/\b(explode|take it apart|show me again)\b/.test(t) && this.showcase && this.showcase.isShowing()) return this.showcase.toggle()
    if (/^(close|hide|clear)( it| that| the model| everything)?\.?$/.test(t)) return this.hideExtras()
    // Leave focus mode: "back", "go back", "close", "exit", "zoom out of it"...
    if (/^(go |take me )?back( out)?\.?$|^(close|exit)( focus| the (card|panel)| this)?\.?$/.test(t)) {
      if (this.focusMode) this.setStatus("Back to the whole map.")
      return this.hideExtras()
    }
    if (/\breset (the )?tour\b/.test(t)) return this.resetTour()
    if (/\b(quiz|guess|test me)\b/.test(t)) return this.startGuess(this.focus)
    if (/\b(something new|tell me more|another (one|fact))\b/.test(t) && this.focus) return this.tellAbout(this.focus)
    if (/^(i'?m|i am|i like|i love|i want|i study|my )/.test(t)) return this.setProfile(raw)
    this.askGuide(raw)
  }

  private askGuide(question: string) {
    const focus = this.gazedLandmark() || this.focus
    this.setStatus("Thinking…")
    this.guide.speak(THINKING_LINE) // cached at startup; the real answer interrupts it
    if (focus) this.map.setState(focus, "focus")
    this.guide
      .ask(question, focus, this.state.profile, this.state.heard)
      .then((a) => this.applyAnswer(a))
      .catch((e) => {
        print("[Sightlines] guide failed (" + e + "), using local answer")
        if (/\b(founder|founders|tech|companies|named after)\b/.test(question.toLowerCase())) return this.showFounders()
        if (focus) return this.tellAbout(focus)
        this.setStatus("Couldn't reach the guide. Pinch a building instead.")
      })
  }

  private applyAnswer(a: ValidatedAnswer) {
    this.exitFocus() // answers light several buildings at once, so the whole map comes back
    this.resetLights()
    for (const id of a.lights) this.map.setState(id, "lit")
    for (const th of a.threads) this.map.drawThread(th.from, th.to)
    if (a.focus) {
      this.focus = a.focus
      this.map.setState(a.focus, "focus")
      this.map.drawSightline(a.focus)
    }
    for (const id of a.fact_ids) this.markHeard(id)
    for (const id of a.lights) if (this.state.seen.indexOf(id) < 0) this.state.seen.push(id)
    this.save()
    const caption = a.fact_ids.length ? a.fact_ids.map((id) => factById(id).card.label).join(" · ") : "Not in my notes"
    const parts = a.declined || !a.fact_ids.length ? [a.speech] : [a.connective, ...a.fact_ids.map((id) => factById(id).fact.text)]
    this.say(parts, caption + (a.rejected.length ? `  (dropped ${a.rejected.length})` : ""))
  }

  private showFounders() {
    const c = founderConstellation()
    this.exitFocus()
    this.resetLights()
    for (const id of c.lights) this.map.setState(id, "lit")
    for (const th of c.threads) this.map.drawThread(th.from, th.to)
    this.say("These buildings are named for tech founders: NVIDIA, Microsoft, HP, Yahoo, and the GPS pioneer behind Spilker.", "Named for tech founders")
  }

  private setProfile(sentence: string) {
    this.state.profile = sentence
    this.save()
    const ids = yourStanford(sentence)
    this.exitFocus()
    this.resetLights()
    for (const id of ids) this.map.setState(id, "lit")
    for (let i = 0; i + 1 < ids.length; i++) this.map.drawThread(ids[i], ids[i + 1])
    const names = ids.map((id) => cardById(id).label)
    this.say(names.length ? `Got it. Here's your Stanford: ${names.join(", ")}. Look at one and pinch.` : "Got it. I'll keep that in mind.", "Your Stanford: " + names.join(" · "))
  }

  // -------------------------------------------------------------------------
  // Frame

  private onUpdate() {
    if (this.unfoldT >= 0 && this.map.root) {
      this.unfoldT += getDeltaTime()
      const k = Math.min(1, this.unfoldT / 1.4)
      const e = 1 - Math.pow(1 - k, 3)
      this.map.root.getTransform().setLocalScale(new vec3(e, Math.max(0.05, e * e), e).uniformScale(this.mapScale))
      if (k >= 1) this.unfoldT = -1
    }
    this.followStatusLabel()
    this.updateFocusMode()
    this.updateYouAreHere()
    this.updateHandle()
    if (this.mode !== "calibrate") this.updateTwist()
  }

  /** Two-hand pinch and twist nudges the map yaw (calibration correction). */
  private updateTwist() {
    let left, right
    try {
      left = SIK.HandInputData.getHand("left")
      right = SIK.HandInputData.getHand("right")
    } catch (e) {
      return
    }
    const both = left && right && left.isTracked() && right.isTracked() && left.isPinching() && right.isPinching()
    if (!both) {
      if (this.twist) this.setStatus(`Map turned. Yaw ${(this.mapYaw * 180 / Math.PI).toFixed(0)}°`)
      this.twist = null
      return
    }
    this.rightDownAt = -1 // a two-hand twist is not a long pinch
    this.drag = null
    const d = right.indexTip.position.sub(left.indexTip.position)
    const yaw = Math.atan2(d.x, d.z)
    const dist = Math.max(1, Math.hypot(d.x, d.z))
    if (!this.twist) {
      this.twist = {lastYaw: yaw, lastDist: dist}
      return
    }
    let dy = yaw - this.twist.lastYaw
    if (dy > Math.PI) dy -= 2 * Math.PI
    if (dy < -Math.PI) dy += 2 * Math.PI
    if (Math.abs(dy) < 0.3) {
      this.mapYaw += dy * 0.5 // half-rate for fine control
      this.placeMap(false)
    }
    // Spread / close both pinches to resize.
    const ratio = dist / this.twist.lastDist
    if (Math.abs(ratio - 1) < 0.2) this.setMapScale(this.mapScale * ratio, false)
    this.twist.lastYaw = yaw
    this.twist.lastDist = dist
  }

  // -------------------------------------------------------------------------
  // Map handle: pinch-and-drag to move; both hands spread to resize

  private mapScale = 1
  private handle: SceneObject = null
  private drag: {hand: "left" | "right"; last: vec3} = null

  private setMapScale(s: number, announce: boolean) {
    this.mapScale = Math.max(0.3, Math.min(2.5, s))
    if (this.map.root && this.unfoldT < 0) this.map.root.getTransform().setLocalScale(vec3.one().uniformScale(this.mapScale))
    if (announce) this.setStatus(`Map size ${Math.round(this.mapScale * 100)}%`)
  }

  private makeHandle() {
    if (this.handle) this.handle.destroy()
    this.handle = global.scene.createSceneObject("map_handle")
    const c = this.map.colors.edge
    this.map.meshObject(this.handle, "handle_ring", buildRing(this.handleRadiusCm, 0.8, 40, 0), c)
    this.map.meshObject(this.handle, "handle_dot", buildDisc(this.handleRadiusCm * 0.35, 24, 0), c)
    // Four short arrows: "drag me".
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      const s = Math.sin(a), co = Math.cos(a)
      const r0 = this.handleRadiusCm + 0.8, r1 = this.handleRadiusCm + 2.4
      this.map.meshObject(this.handle, "handle_arrow", buildTube([{x: s * r0, y: 0, z: co * r0}, {x: s * r1, y: 0, z: co * r1}], 0.5), c)
    }
    if (this.map.labelPrefab) {
      const lab = global.scene.createSceneObject("handle_label")
      lab.setParent(this.handle)
      lab.getTransform().setLocalPosition(new vec3(0, 5, 0))
      lab.getTransform().setLocalScale(vec3.one().uniformScale(0.9))
      tidyLabel(this.map.labelPrefab.instantiate(lab), "pinch to move · two hands to resize")
    }
  }

  /** World position of the handle: on the map's rim, on the side nearest the wearer. */
  private handlePos(): vec3 {
    const t = this.map.root.getTransform()
    const c = t.getWorldPosition()
    const cam = this.camera.getTransform().getWorldPosition()
    let dx = cam.x - c.x, dz = cam.z - c.z
    const l = Math.hypot(dx, dz) || 1
    dx /= l
    dz /= l
    const r = this.map.radiusM * this.map.cmPerM * this.mapScale + this.handleRadiusCm + 4
    return new vec3(c.x + dx * r, c.y + 0.5, c.z + dz * r)
  }

  /** Starts a drag if this pinch is on the handle. */
  private tryGrabHandle(which: "left" | "right", tip: vec3): boolean {
    if (!this.handle || !this.map.root || this.mode === "calibrate") return false
    const h = this.handle.getTransform().getWorldPosition()
    if (tip.distance(h) > this.handleGrabCm) return false
    this.drag = {hand: which, last: tip}
    this.rightDownAt = -1
    this.setStatus("Moving the map…")
    return true
  }

  private updateHandle() {
    if (!this.handle || !this.map.root) return
    this.handle.enabled = this.mode !== "calibrate"
    if (this.drag) {
      let hand
      try {
        hand = SIK.HandInputData.getHand(this.drag.hand)
      } catch (e) {
        hand = null
      }
      if (!hand || !hand.isTracked() || !hand.isPinching()) {
        this.drag = null
        this.setStatus("Map moved. Say “floor” to put it back.")
      } else {
        const tip = hand.indexTip.position
        const dlt = tip.sub(this.drag.last)
        const t = this.map.root.getTransform()
        const p = t.getWorldPosition()
        // Floor map slides on the floor; a lifted map can also go up and down.
        t.setWorldPosition(new vec3(p.x + dlt.x, this.lifted ? p.y + dlt.y : p.y, p.z + dlt.z))
        this.drag.last = tip
      }
    }
    const ht = this.handle.getTransform()
    ht.setWorldPosition(this.handlePos())
    const cam = this.camera.getTransform().getWorldPosition()
    const hp = ht.getWorldPosition()
    ht.setWorldRotation(quat.angleAxis(Math.atan2(cam.x - hp.x, cam.z - hp.z), vec3.up()))
  }

  // -------------------------------------------------------------------------
  // Helpers

  private recalibrate() {
    this.mode = "calibrate"
    this.wallPoints = []
    this.hideExtras()
    this.setStatus(this.calibrateInstruction())
  }

  private resetTour() {
    this.state = {heard: [], seen: [], guessed: [], profile: "", bestErr: 999}
    this.save()
    this.hideExtras()
    this.resetLights()
    this.say("Tour reset. Look at a building and pinch.", "Tour reset")
  }

  private resetLights() {
    this.map.resetLights(this.state.seen)
    if (this.money) this.money.hide()
    if (this.showcase) this.showcase.hide()
  }

  private markHeard(id: string) {
    if (this.state.heard.indexOf(id) < 0) this.state.heard.push(id)
    this.save()
  }

  private nearestLandmark(p: EN): string {
    let best = ""
    let bestD = 1e9
    for (const id of Object.keys(this.positions)) {
      const q = this.positions[id]
      const d = Math.hypot(q.e - p.e, q.n - p.n)
      if (d < bestD) {
        bestD = d
        best = id
      }
    }
    return bestD < 80 ? best : ""
  }

  private viewHorizontal(): V3 {
    const camT = this.camera.getTransform()
    const v = vec3.up().cross(camT.right).normalize()
    return {x: v.x, y: 0, z: v.z}
  }

  private say(speech: string | string[], caption: string, onDone?: () => void) {
    this.setStatus(caption)
    this.guide.speakParts(typeof speech === "string" ? [speech] : speech, onDone)
  }

  private setStatus(s: string) {
    if (this.statusText) this.statusText.text = s
    if (this.statusLabel) this.statusLabel.text = s
    print("[Sightlines] " + s)
  }

  private makeStatusLabel() {
    if (!this.showStatusLabel || !this.map.labelPrefab) return
    this.statusHolder = global.scene.createSceneObject("SightlinesStatus")
    this.statusHolder.getTransform().setLocalScale(vec3.one().uniformScale(0.6))
    const inner = this.map.labelPrefab.instantiate(this.statusHolder)
    this.statusLabel = tidyLabel(inner, "")
  }

  /** Keeps the caption low in the field of view, lagging slightly so it doesn't feel glued to the head. */
  private followStatusLabel() {
    if (!this.statusHolder) return
    const camT = this.camera.getTransform()
    const cam = camT.getWorldPosition()
    const f = this.viewHorizontal()
    const target = new vec3(cam.x + f.x * 70, cam.y - 22, cam.z + f.z * 70)
    const t = this.statusHolder.getTransform()
    t.setWorldPosition(vec3.lerp(t.getWorldPosition(), target, Math.min(1, getDeltaTime() * 4)))
    t.setWorldRotation(quat.angleAxis(Math.atan2(-f.x, -f.z), vec3.up()))
  }

  private load() {
    if (!this.persistProgress) return
    try {
      const s = global.persistentStorageSystem.store.getString(STORE_KEY)
      if (s) {
        const o = JSON.parse(s)
        this.state = {heard: o.heard || [], seen: o.seen || [], guessed: [], profile: o.profile || "", bestErr: o.bestErr || 999}
      }
    } catch (e) {
      print("[Sightlines] could not load progress: " + e)
    }
  }

  private save() {
    if (!this.persistProgress) return
    try {
      global.persistentStorageSystem.store.putString(STORE_KEY, JSON.stringify(this.state))
    } catch (e) {
      // Storage unavailable in some previews.
    }
  }
}

function toV3(v: vec3): V3 {
  return {x: v.x, y: v.y, z: v.z}
}

/**
 * Retrospecs main controller: a Stanford tour guide on a 3D campus map at your feet.
 *
 * Flow
 *  1. CALIBRATE  Face a wall of known direction and pinch a point on its LEFT, then its RIGHT. The wall's compass
 *                bearing comes from the building's OSM footprint (Huang's walls run at 15/105/195/285 deg), and
 *                `facingHint` picks which face you're looking at.
 *  2. TOUR       The fixed map unfolds on the floor with the wearer inside its back half. Right pinch =
 *                "tell me about what I'm looking at" (real building or one on the map). Ask (the button on the card) = ask by voice or tap a suggested question.
 *  3. GUESS      (disabled: QUIZ_ENABLED) After each building: "Point to where you think X is, then pinch." Scored in
 *                degrees; the true direction arcs out on the map and a sightline pillar appears in the room.
 *
 * Editor Preview: tap = calibrate (camera forward as the wall facing), then tap = right pinch.
 */
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {tidyLabel} from "./LabelStyle"
import {ASRController} from "../../Scripts/ASRController"
import {WorldLabel} from "../../Scripts/WorldLabel"
import {LANDMARKS} from "../Data/CampusData"
import {CARDS, cardById, factById} from "../Core/Cards"
import {EN, V3, angleDiff, facingFromWallPinches, latLonToEN, mapYawFor, snapFacingBearing, worldDirToBearing} from "../Core/Geo"
import {ValidatedAnswer, founderConstellation, guessPrompt, nextFact, nextGuessTarget, scoreGuess, themesFromProfile, yourStanford} from "../Core/Guide"
import {RetrospecsGuide} from "./RetrospecsGuide"
import {RetrospecsMap} from "./RetrospecsMap"
import {buildDisc, buildRing, buildTube} from "../Core/MapMesh"
import {LocateResult, RetrospecsLocator} from "./RetrospecsLocator"
import {RetrospecsOverlay} from "./RetrospecsOverlay"
import {RetrospecsMoney} from "./RetrospecsMoney"
import {RetrospecsShowcase} from "./RetrospecsShowcase"
import {RetrospecsInfoPanel} from "./RetrospecsInfoPanel"
import {Fact} from "../Core/Cards"
import {FocusLayout, focusLayout} from "../Core/Focus"
import {pickByBearing} from "../Core/Pick"
import {HoverState, SWITCH_DWELL_SEC, SelectionAction, SelectionInput, decideSelection, focusIdleExpired, hoverHeldSec, isLocked, newHoverState, selectionTarget, stepHover} from "../Core/Selection"
import {narrationFor} from "../Data/NarrationData"
import {STORY_CARD_COUNTS, storyCardFactId} from "./StoryDeck"
import {PanelButton} from "./RetrospecsInfoPanel"
import {isNextSpotIntent, nextSpot, spotTier} from "../Core/NextSpot"
import {CENTERPIECES, isCenterpiece} from "../Core/Centerpieces"
import {COACH_FIRST, CoachAim, CoachEvent, CoachStep, DONE_HOLD_SEC, coachAim, coachAllowsPick, coachHint, coachLine, coachNext, coachWrongPickLine, suggestedBuilding} from "../Core/Coach"
import {DEMO_ASK_LATER_LINE, DEMO_ASK_TIMEOUT_SEC, DEMO_SKIP_HOLD_SEC, DEMO_SUGGESTED_QUESTION, demoSkipHint, isRestartDemoIntent, DemoEvent, DemoState, demoHasNextStop, demoHint, demoIsLastCard, demoLine, demoNext, demoNudgeLine, demoPickTarget, demoSegment, demoStart, demoStopId} from "../Core/DemoScript"
import {flankHeadings, halfWidthDeg} from "../Core/CardLayout"
import {isSimpleFocus} from "../Core/CardTheme"
import {TV_WALL, sharedWall} from "../Core/Focus"
import {NudgeOutput, NudgeTarget, mapNudge, newNudgeState, offsetsFromLocal, stepNudge} from "../Core/LookNudge"
import {RespawnRules, farFromMap, newRespawnState, stepRespawn} from "../Core/Respawn"
import {LiveTurn, isAskFurtherIntent, presentLive, stripAskFurtherCommand} from "../Core/AskLive"
import {SuggestedQuestion, buildingMentioned, chatHeading, isTourCommand, locateOnlyTarget, suggestedQuestions} from "../Core/AskBubble"
import {AskChat} from "./AskChat"
import {setBubbleTarget} from "./AskBridge"
import {playSfx} from "../Core/Sfx"

type Mode = "calibrate" | "tour" | "guess"

const STORE_KEY = "sightlines.v1" // pre-rename key, kept so saved calibration survives
/** "Point to X, then pinch" quiz. Off for now (content first); the code stays for a later interactive pass.
 *  This overrides the scene's autoQuiz input and the "quiz / guess / test me" voice command. */
const QUIZ_ENABLED = false

@component
export class RetrospecsController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Retrospecs Controller</span>')
  @input camera: SceneObject
  @input map: RetrospecsMap
  @input guide: RetrospecsGuide
  @input @allowUndefined asr: ASRController

  @ui.group_start("Indoor demo")
  @input @hint("ON (judging indoors): no calibration, any pinch opens the map, then a short coach shows how to pick a building and use the card. OFF (filming outdoors): the start-point calibration below.") indoorDemo: boolean = true
  @input @hint("GUIDED JUDGE DEMO (Core/DemoScript): Main Quad, then Huang, then Hoover Tower, then one voice question, in that order only, with a spoken direction at every step. When it's done, everything unlocks. Hold BOTH pinches 5 s to skip it (filming); say \"restart demo\" to set it up again for the next judge. OFF = straight to free roam.") demoMode: boolean = true
  @ui.group_end
  @ui.group_start("Declutter")
  @input @hint("Money piles beside a selected building (the gift in $1 bills). OFF = card, animation, person hologram and diagram only.") showMoneyPiles: boolean = false
  @input @hint("Exploded product models while a fact is spoken. OFF = card, animation, person hologram and diagram only.") showExplodedModels: boolean = false
  @ui.group_end
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
  @input @hint("Map centre ahead, so the wearer stands near its back edge (cm)") floorForwardCm: number = 116
  @input @hint("Table mode: how far below your eyes the map sits (cm), measured from your head each time it's placed or brought over, so it always lands well below eye level. 105 = about 55 cm off the floor for a 160 cm eye height: you look steeply down onto it and the cursor reaches the far side. (Replaces the old floor-based tableHeightCm, whose saved 100 put it only 60 cm below the eyes.)") tableBelowEyesCm: number = 105
  @input @hint("How far in front of you the table-mode map's centre sits (cm). Keep it above the map radius (58 cm at size 0.5) so the near edge is in front of you.") tableForwardCm: number = 105
  @input @hint("ON: start with the map floating at table height in front of you. OFF: on the floor around you.") startLifted: boolean = true
  @input @hint("Height of the floating \"You are here\" tag above your pin on the map (map cm)") youAreHereHeightCm: number = 16
  @input youAreHereScale: number = 1.8
  @input @hint("Move/resize handle on the map rim: size and how close a pinch must be to grab it (cm)") handleRadiusCm: number = 4
  @input handleGrabCm: number = 10
  @input @hint("Starting map size (1 = about 2.3 m across, 0.5 = about 1.2 m, a tabletop).") startMapScale: number = 0.357
  @ui.group_end

  @ui.group_start("Optional")
  @input @allowUndefined statusText: Text
  @input showStatusLabel: boolean = true
  @input autoQuiz: boolean = true
  @input @hint("Keep heard facts across launches. Leave OFF for judging so every relaunch starts fresh.") persistProgress: boolean = false
  @ui.group_end

  @ui.group_start("Real-world visuals")
  @input @allowUndefined @hint("GPS + Gemini: which real building am I looking at? Long right pinch or say \"what's that\".") locator: RetrospecsLocator
  @input @allowUndefined @hint("Nametag + roofline outline on the real building") overlay: RetrospecsOverlay
  @input @allowUndefined @hint("Life-size pile of $1 bills for the building's gift") money: RetrospecsMoney
  @input @hint("Indoor demo: put the money pile on the map instead of life-size in the room") moneyOnMap: boolean = true
  @input @hint("Extra scale for the on-map pile (1 = true map scale)") moneyMapExaggeration: number = 3
  @input @allowUndefined @hint("Exploded product models shown while a fact is spoken") showcase: RetrospecsShowcase
  @input @hint("Exploded model size (cm) and distance in front of you (cm)") showcaseScaleCm: number = 40
  @input showcaseForwardCm: number = 75
  @input @hint("Hold a right pinch this long (s) to identify the real building instead") longPinchSec: number = 0.6
  @ui.group_end

  @ui.group_start("Focus mode (selected building)")
  @input @allowUndefined @hint("Floating card above the selected building: name, namesake, the fact, a number graphic") infoPanel: RetrospecsInfoPanel
  @input @hint("Ask further: when the checked notes don't cover a question about the building in focus, answer from the live web (Gemini + Google Search). Say \"look it up\" to go there directly.") askFurther: boolean = true
  @input @hint("Ask further: seconds after a live answer during which questions about the same building stay on the web path (follow-ups)") liveFollowUpSec: number = 45
  // HOOK for the per-building 3D experiences (Scripts/RetrospecsExperiences.ts, another session's class). Typed as a
  // plain script component and called through `any`: show(id, anchorWorldPos: vec3, faceToward: vec3, scaleCm) and
  // hide(), if present.
  @input @allowUndefined @hint("Per-building 3D experience (RetrospecsExperiences). Shown to the wearer's left of the card.") experiences: ScriptComponent
  @input @hint("Experience size (world cm)") experienceScaleCm: number = 30
  @input @hint("Leave focus this many seconds after the guide stops talking (0 = never)") focusIdleSec: number = 25
  @input @hint("ON: exploded model floats beside the focused building, right of the card. OFF: in front of you as before.") showcaseNearBuilding: boolean = true
  @input @hint("Gap between the card and the side objects (world cm)") focusSideGapCm: number = 4
  // New inputs (not saved in the scene yet, so these defaults apply).
  @input @hint("ON: the 3D experience and exploded model sit off to the sides, out of the way: look around to find them. OFF: flanking the card.") ambientExtras: boolean = true
  // Pushed well behind the card (which floats ~130 cm away) so the animations read as background, not competition.
  @input @hint("Ambient extras: degrees to the left / right of the card") ambientSideDeg: number = 28
  @input @hint("Ambient extras: distance from the eyes (cm) and size (cm)") ambientDistanceCm: number = 300
  @input ambientScaleCm: number = 34
  @input @hint("Ambient extras: how far below eye level (cm)") ambientDropCm: number = 105
  @input @hint("Side pieces sit at the card's height: the 3D experience this many degrees left of the card's centre (the card spans about 12 each side)") experienceSideDeg: number = 17
  @input @hint("Each key building's hologram loop: degrees left of the card's centre (farther out than the experience)") hologramSideDeg: number = 34
  @input @hint("Side pieces: distance from the eyes (cm), experience / exploded model size (cm), hologram width (cm)") sideDistanceCm: number = 150
  @input sideScaleCm: number = 30
  @input hologramWidthCm: number = 56
  @input @hint("People screen: degrees right of the card when a building also has a diagram") peopleHologramSideDeg: number = 23
  @input @hint("People screen width (cm)") peopleHologramWidthCm: number = 56
  @input @hint("Main Quad / Huang / Hoover (Core/CardTheme SIMPLE_FOCUS_IDS): the same gap (degrees) between the card and the 3D animation on its left and the founder screen on its right") flankGapDeg: number = 4
  @input @hint("Look-around nudge: a pulsing arrow at the edge of the view points at side pieces you haven't looked at yet (and back down at the map after a while looking away)") lookNudge: boolean = true
  @input @hint("Map cursor forgiveness: a pinch this close to a building (map cm) still picks it") pickSlackCm: number = 6
  @ui.group_end

  @ui.group_start("Bring the map here (walked away from it)")
  @input @hint("Offer to respawn the map when you've walked far from it, look down, and pinch with both hands") respawnEnabled: boolean = true
  @input @hint("Only when you're at least this far (m) from the map's centre") respawnMinMapDistM: number = 6
  @input @hint("...and have walked at least this far (m) since the map was placed") respawnMinWalkedM: number = 8
  @input @hint("...and are looking at least this far below the horizon (degrees)") respawnLookDownDeg: number = 35
  @input @hint("Hold both pinches this long (s) to respawn") respawnHoldSec: number = 0.8
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
  /** Bring-the-map-here gesture (Core/Respawn), and where the wearer stood when the map was last placed. */
  private respawn = newRespawnState()
  private respawnShown = ""
  private mapPlacedFrom: vec3 = null
  private positions: Record<string, EN> = {}
  private isEditor = global.deviceInfoSystem.isEditor()
  private statusHolder: SceneObject = null
  private statusLabel: Text = null
  private state = {heard: [] as string[], seen: [] as string[], guessed: [] as string[], profile: "", bestErr: 999}
  /** Focus mode: the selected building ("" = none) and when the guide last spoke during it. */
  private focusMode = ""
  private focusActiveAt = 0
  /** Selection lock-in (Core/Selection): when the focused building was selected, when the guide last spoke, when a
   * selection pinch was last acted on, and the hysteresis-filtered hover. */
  private selectedAt = -1
  private lastSpokeAt = -1
  private lastSelectAt = -1
  private hover: HoverState = newHoverState()
  /** Indoor demo coach (Core/Coach): the step, the building it points people at, when "done" began, whether the
   * cursor is on a building (the pick tip changes), and the last caption (the tip is appended under it). */
  private coachStep: CoachStep = "off"
  private coachSuggest = ""
  private coachDoneAt = -1
  private coachAimNow: CoachAim = "none"
  private coachAimOther = ""
  private caption = ""
  /** Locked judge demo (Core/DemoScript). "off" unless demoMode is on. */
  private demo: DemoState = {step: "off", stop: 0, card: 0}
  private demoAimOn = false
  private demoAskedAt = -1
  private demoHeardAnswer = false
  /** Both-pinch hold that skips the guided demo: when it started (-1 = not holding), and the countdown tip. */
  private demoSkipFrom = -1
  private demoSkipTip = ""

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
      // The card's Ask button is the only thing that opens the mic; what it hears goes to the chat window.
      this.asr.onFinalVoiceEvent.add((t) => (this.bubbleListening ? this.askFromBubble(t) : this.handleUtterance(t)))
      this.asr.onPartialVoiceEvent.add((t) => {
        if (this.bubbleListening && this.chat) this.chat.showListening(this.chatTitle(), t === "Listening..." ? "" : t, this.chipLabels())
        else this.setStatus("“" + t + "”")
      })
      // onErrorEvent exists only in the patched ASRController; the stock 5.15.4 one doesn't have it.
      const errEvent = (this.asr as any).onErrorEvent
      if (errEvent && errEvent.add) errEvent.add((e: string) => {
        if (this.bubbleListening && this.chat) this.chat.showError(this.chatTitle(), "", "I couldn't hear that. Tap a question, or pinch Ask and try again.", this.chipLabels())
        this.bubbleListening = false
        this.setStatus("Voice error: " + e)
      })
    }
    setBubbleTarget(this)
    if (this.isEditor) this.createEvent("TapEvent").bind(() => this.onEditorTap())
    this.makeStatusLabel()
    this.setupInfoPanel()
    this.setupChat()
    this.prefetchStartup()
    if (this.demoMode) {
      this.demo = demoStart()
      this.setStatus(this.calibrateInstruction())
      this.guide.speakParts([demoLine(this.demo, "")])
      return
    }
    if (this.indoorDemo) this.coachStep = "start"
    this.setStatus(this.calibrateInstruction())
    if (this.indoorDemo) this.guide.speakParts([coachLine("start")])
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
      print("[Retrospecs] hand input unavailable: " + e)
    }
  }

  private hoverT = 0
  private worldHover = ""

  /** Keeps map.hoverId equal to what a right pinch would pick. The map cursor is checked every frame; the
   * real-world aim (a bit more work) ten times a second. */
  private updateHover() {
    if (this.mode !== "tour") {
      this.hover = newHoverState()
      return this.map.setHover("")
    }
    if (this.demoActive()) return this.updateDemoAim()
    // Aiming at the focus card or the ask chat: nothing on the map lights up (a pinch there acts on the window).
    if ((this.infoPanel && this.infoPanel.rayOnCard()) || (this.chat && this.chat.rayOnWindow())) {
      this.hover = newHoverState()
      return this.map.setHover("")
    }
    let raw = this.cursorLandmark()
    if (!raw) {
      this.hoverT -= getDeltaTime()
      if (this.hoverT <= 0) {
        this.hoverT = 0.1
        this.worldHover = this.gazedLandmark()
      }
      raw = this.worldHover
    }
    // Hysteresis: a neighbour (or nothing) must hold ~0.2 s before it replaces the current hover, so the
    // highlight doesn't flicker between adjacent buildings as the ray wobbles.
    const now = getTime()
    stepHover(this.hover, raw, now)
    if (this.coachStep === "pick") return this.updateCoachAim()
    this.map.setHover(this.shownHover(now))
  }

  /** Coach pick step: only the target lights blue (blue = "a pinch picks this"), and the tip says where the cursor is. */
  private updateCoachAim() {
    const id = this.hover.id
    this.map.setHover(id === this.coachSuggest ? id : "")
    const aim = coachAim(id, this.coachSuggest)
    const other = aim === "other" && cardById(id) ? cardById(id).label : ""
    if (aim === this.coachAimNow && other === this.coachAimOther) return
    this.coachAimNow = aim
    this.coachAimOther = other
    this.setStatus(this.caption)
  }

  /** Coach pick step: a pinch / tap selects only the target; anything else gets a nudge back toward it. */
  private coachPick() {
    const now = getTime()
    if (this.lastSelectAt >= 0 && now - this.lastSelectAt < 0.3) return // bounce
    this.lastSelectAt = now
    const pickId = this.hover.id || this.cursorLandmark() || this.gazedLandmark()
    if (coachAllowsPick(this.coachStep, pickId, this.coachSuggest)) return this.tellAbout(this.coachSuggest)
    const target = cardById(this.coachSuggest)
    const other = pickId && cardById(pickId) ? cardById(pickId).label : ""
    this.say(coachWrongPickLine(target ? target.label : "the gold building", other), other ? `Not ${other}` : "Nothing aimed at yet")
  }

  /** Cyan = what a pinch would pick. While a selection is locked, another building only lights once it has been
   * held long enough to switch to it. */
  private shownHover(now: number): string {
    const id = this.hover.id
    if (!id || id === this.focusMode || !this.selectionLocked(now)) return id
    return hoverHeldSec(this.hover, now) >= SWITCH_DWELL_SEC ? id : ""
  }

  /** The focused building is protected from accidental switches (Core/Selection). */
  private selectionLocked(now: number): boolean {
    return !!this.focusMode && isLocked(now, this.selectedAt, this.lastSpokeAt, this.guide.isSpeaking())
  }

  /** What a selection pinch (or Preview tap) would do right now: the hovered building (with how long it was held),
   * else whatever the cursor / hand ray / head points at (held 0: never enough to switch while locked). */
  private selectionNow(): {action: SelectionAction; input: SelectionInput} {
    const now = getTime()
    const pickId = this.hover.id || this.cursorLandmark() || this.gazedLandmark()
    const pickHeldSec = this.hover.id && pickId === this.hover.id ? hoverHeldSec(this.hover, now) : 0
    const input: SelectionInput = {now, focusId: this.focus, lastActionAt: this.lastSelectAt, locked: this.selectionLocked(now), pickId, pickHeldSec}
    return {action: decideSelection(input), input}
  }

  /** Acts on a selection decision: "more" = next segment of the focused building, "switch" = select the pick,
   * "none" = nothing focused or aimed at (nearest building). Never re-gazes, so it can't jump elsewhere. */
  private runSelection(action: SelectionAction, target: string) {
    if (action === "ignore") return
    this.lastSelectAt = getTime()
    if (action === "none" || !target) return this.tellAboutGaze("")
    this.tellAbout(target)
  }

  private rightDownAt = -1
  /** Selection decided when the right pinch went down (the ray drifts as the fingers close), run on release. */
  private pendingSel: SelectionAction = "none"

  private onPinch(which: "left" | "right") {
    const hand = SIK.HandInputData.getHand(which)
    if (!hand || !hand.isTracked()) return
    const other = SIK.HandInputData.getHand(which === "left" ? "right" : "left")
    if (other && other.isTracked() && other.isPinching()) return
    // Walked away and looking down: a pinch is the start of the two-hand "bring the map here", not a pick or listen.
    if (this.respawnOffered()) return
    // The ask chat's X (and the window itself) come before everything else, coach steps included.
    if (which === "right" && this.chatPinch()) return
    // A pinch on another scene button is that button's: it must not also page the card, talk, or pick a building
    // behind it.
    if (this.rayOnOtherButton(which === "left" ? InteractorInputType.LeftHand : InteractorInputType.RightHand)) return
    if (this.mode === "calibrate") {
      if (this.useStartPoint || this.indoorDemo || this.demoMode) return this.finishCalibration(this.viewHorizontal())
      return this.addWallPoint(toV3(hand.indexTip.position))
    }
    // Locked judge demo: every pinch goes through the script.
    if (this.demoActive()) return this.demoPinch(which)
    // Coach pick step: the right hand must select the target; the left hand does nothing yet.
    if (this.coachStep === "pick") {
      if (which === "right") this.coachPick()
      return
    }
    // The card's own buttons come first: X closes, "Next spot" moves on, Ask opens the mic. Elsewhere on it is "more".
    if (which === "right" && this.cardPinch()) return
    // The left hand does nothing on its own: asking is the card's Ask button (one way to ask, and you can see it).
    if (which === "left") return
    if (this.mode === "guess") return this.lockGuess(toV3(hand.indexKnuckle.position))
    // Decide what was aimed at the moment the fingers touch (the ray drifts as they close): the hovered building,
    // else the map building under the cursor, else the real building the hand ray (or head) points at. Once a
    // building is selected it is locked in (Core/Selection): stray pinches mean "more", never a jump elsewhere.
    const sel = this.selectionNow()
    if (sel.action === "ignore") return // double-fire / bounce
    // Only when nothing is aimed at (and nothing is locked in) does a long hold ask GPS + Gemini to identify the
    // real building; a short one does the decided action on release.
    if (which === "right" && this.locator && !sel.input.pickId && !sel.input.locked) {
      this.pendingSel = sel.action
      this.rightDownAt = sel.input.now
      return
    }
    this.runSelection(sel.action, selectionTarget(sel.action, sel.input))
  }

  private onRightPinchUp() {
    if (this.rightDownAt < 0) return
    const held = getTime() - this.rightDownAt
    this.rightDownAt = -1
    if (this.mode !== "tour") return
    if (this.twist) return // it was a two-hand twist
    if (held >= this.longPinchSec) return this.identifyReal()
    // Nothing was aimed at: "more" on the building in focus, else the nearest one. Never re-gazes at release.
    this.runSelection(this.pendingSel, this.pendingSel === "more" ? this.focus : "")
  }

  private onEditorTap() {
    if (this.chatPinch()) return
    if (this.rayOnOtherButton(InteractorInputType.Mouse)) return
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
    if (this.demoActive()) return this.demoPinch("right")
    if (this.coachStep === "pick") return this.coachPick()
    if (this.cardPinch()) return
    // Same lock-in rules as a pinch on device.
    const sel = this.selectionNow()
    this.runSelection(sel.action, selectionTarget(sel.action, sel.input))
  }

  /** Handles a pinch / tap aimed at the focus card. True if it was on the card (so it selects nothing behind it). */
  private cardPinch(): boolean {
    if (!this.infoPanel || this.mode !== "tour") return false
    const btn: PanelButton = this.infoPanel.buttonUnderRay()
    const onCard = !!btn || this.infoPanel.rayOnCard()
    if (!onCard) return false
    const now = getTime()
    if (this.lastSelectAt >= 0 && now - this.lastSelectAt < 0.3) return true // bounce
    this.lastSelectAt = now
    this.rightDownAt = -1 // the release must not run a selection or the locator
    playSfx("click")
    if (btn === "close") this.closeCard()
    else if (btn === "next") this.showNextSpot()
    else if (btn === "ask") this.startAsk()
    else if (this.focusMode) this.tellAbout(this.focusMode)
    return true
  }

  /** X on the card: stop talking, put the card and the extras away, whole map back. */
  private closeCard() {
    this.guide.stopSpeaking()
    this.hideExtras()
    this.resetLights()
    this.focus = "" // closed means closed: a stray pinch must not reopen it as "more"
    this.coachEvent("closed")
    this.setStatus("Closed. Point at a building and pinch, or say “next spot”.")
  }

  /** Buildings shown this round of "next spot" (and pinched ones), so it keeps finding somewhere new. */
  private tourShown: string[] = []

  /** "Show me somewhere else": the next stop without aiming. Richest stops first, nearest within each tier. */
  private showNextSpot() {
    if (this.mode !== "tour" || !this.map.root) return
    const positions: Record<string, EN> = {}
    for (const id of Object.keys(this.map.landmarks)) if (cardById(id) && this.positions[id]) positions[id] = this.positions[id]
    const current = this.focusMode || this.focus
    // Only this round's list: state.seen never clears, so using it made a full round bounce between two buildings.
    let shown = this.tourShown
    if (Object.keys(positions).every((id) => id === current || shown.indexOf(id) >= 0)) {
      this.tourShown = [] // been everywhere: start a new round
      shown = []
    }
    const tierOf = (id: string) => spotTier(isCenterpiece(id), narrationFor(id).length > 0 || id === "huang" || id === "hpgarage")
    const id = nextSpot({currentId: current, from: this.me, positions, shown, tierOf})
    if (!id) return this.setStatus("That's every stop on the tour.")
    if (this.tourShown.indexOf(id) < 0) this.tourShown.push(id)
    this.guide.stopSpeaking()
    this.segAt[id] = 0 // a new stop starts with its overview
    this.lastSelectAt = getTime()
    this.tellAbout(id)
  }

  /** Opens the mic (for voice commands the tour itself asks for); a question normally goes through startAsk(). */
  listen() {
    this.startAsk()
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
      print(`[Retrospecs] wearer position: ${w.source}${w.spotId ? " " + w.spotId : ""} (${w.reason})`)
      if (w.source !== "survey") this.me = w.en
    }
    this.hideExtras()
    this.worldAnchor = null // re-pin the real-world frame where the wearer stands now
    // The rebuild destroys the old map's children: forget them first.
    this.youAreHere = null
    this.facingArrow = null
    this.youOffset = vec3.zero()
    this.map.build(this.me, this.camera)
    if (this.overlay) this.overlay.setCenter(this.map.center)
    this.makeYouAreHere()
    this.mapScale = this.startMapScale
    this.lifted = this.startLifted
    this.placeMap(true)
    this.mapPlacedFrom = cam
    if (this.infoPanel) {
      this.infoPanel.hideSideHologram()
      this.infoPanel.hidePeopleHologram()
    }
    this.mode = "tour"
    this.unfoldT = 0
    const here = this.nearestLandmark(this.me)
    print(`[Retrospecs] calibrated: facing bearing ${bearing}, map yaw ${(this.mapYaw * 180 / Math.PI).toFixed(1)}°`)
    this.resetLights()
    if (this.demo.step !== "off") return this.demoEvent("mapOpened")
    if (this.indoorDemo) return this.coachEvent("mapOpened")
    if (here) this.map.setState(here, "focus")
    const hereName = here ? cardById(here).name : "Stanford"
    this.say(`Welcome to Stanford. You're at ${hereName}. Look at any building and pinch to hear about it.`, `You're at ${hereName}. Look at a building and pinch. Pinch Ask on its card to ask.`)
  }

  /** Puts the map on the floor centred on the wearer, or at table height in front of them. */
  private placeMap(resetCenter: boolean) {
    if (!this.map.root) return
    const camT = this.camera.getTransform()
    const cam = camT.getWorldPosition()
    const rot = quat.angleAxis(this.mapYaw, vec3.up())
    let pos: vec3
    // Heading from up x camera-right: stays defined when looking steeply down (the respawn gesture needs 35°+ down).
    const f = this.headingHorizontal()
    if (this.lifted) {
      // Always a fixed drop below the eyes, never above a sensible table height.
      const drop = Math.max(60, this.tableBelowEyesCm)
      pos = new vec3(cam.x + f.x * this.tableForwardCm, cam.y - drop, cam.z + f.z * this.tableForwardCm)
    } else {
      pos = new vec3(cam.x + f.x * this.floorForwardCm, this.floorY + 1, cam.z + f.z * this.floorForwardCm)
    }
    const t = this.map.root.getTransform()
    // A twist (resetCenter false) only turns the map: a table map stays where it was dragged, a floor map stays on the floor.
    if (resetCenter) t.setWorldPosition(pos)
    else if (!this.lifted) t.setWorldPosition(new vec3(t.getWorldPosition().x, pos.y, t.getWorldPosition().z))
    t.setWorldRotation(rot)
    // The real-world frame is pinned where the wearer stood at calibration (map.center), set once and never moved,
    // so name tags and pinch targets stay on their buildings as the wearer walks. Lift/floor/twist only turn it.
    if (!this.worldAnchor) this.worldAnchor = new vec3(cam.x, this.floorY, cam.z)
    const w = this.map.worldRoot.getTransform()
    w.setWorldPosition(this.worldAnchor)
    w.setWorldRotation(rot)
  }

  /** Horizontal heading of the head, robust to looking straight down (up x right, like the info panel's viewYaw). */
  private headingHorizontal(): V3 {
    const r = this.camera.getTransform().right
    const v = vec3.up().cross(r)
    const l = Math.hypot(v.x, v.z)
    if (l < 1e-4) return this.viewHorizontal()
    return {x: v.x / l, y: 0, z: v.z / l}
  }

  /** World origin of map.center (set at calibration). */
  private worldAnchor: vec3 = null

  /** Where the wearer is now, in campus EN metres: map.center plus how far they've walked since calibrating. */
  private hereEN(): EN {
    if (!this.map.worldRoot || !this.worldAnchor) return this.map.center
    const cam = this.camera.getTransform().getWorldPosition()
    const local = this.map.worldRoot.getTransform().getInvertedWorldTransform().multiplyPoint(cam)
    return {e: this.map.center.e + local.x / 100, n: this.map.center.n - local.z / 100}
  }

  private setLifted(on: boolean) {
    this.lifted = on
    this.placeMap(true)
    this.mapPlacedFrom = this.camera.getTransform().getWorldPosition()
    this.setStatus(on ? "Map lifted. Say “floor” to put it back." : "Map on the floor around you.")
  }

  // -------------------------------------------------------------------------
  // Tour

  /**
   * Landmark under the SIK cursor on the map ("" = none). Right-hand ray on device, the mouse in Editor Preview;
   * the left hand doesn't steer selection.
   */
  private cursorLandmark(only = "", slackCm = this.pickSlackCm): string {
    const target = this.map.cursorTarget
    if (!this.map.root || this.mode === "calibrate") return ""
    let interactors
    try {
      interactors = SIK.InteractionManager.getTargetingInteractors()
    } catch (e) {
      return ""
    }
    const inv = this.map.root.getTransform().getInvertedWorldTransform()
    for (const it of interactors) {
      if (!(it.inputType & (InteractorInputType.RightHand | InteractorInputType.Mouse))) continue
      const info = it.targetHitInfo
      // Ray start (hand or mouse; the camera as a fallback), so aiming at a tall tower's shaft picks the tower.
      let start: vec3 = null
      try {
        start = (it as any).startPoint as vec3
      } catch (e) {
        // No start point on this interactor.
      }
      if (!start) start = this.camera.getTransform().getWorldPosition()
      const eye = inv.multiplyPoint(start)
      let hit: vec3 = null
      if (info && info.interactable === target && info.hit) hit = inv.multiplyPoint(info.hit.position)
      else {
        // SIK may hit a building collider before the disc. Intersect its aim ray with the map plane directly.
        const dir = (it as any).direction as vec3
        if (!dir) continue
        const localDir = inv.multiplyDirection(dir)
        if (localDir.y >= -0.001 || eye.y <= 0) continue
        const t = -eye.y / localDir.y
        hit = eye.add(localDir.uniformScale(t))
      }
      // A ray aimed at a tall building near the rim (Hoover, ~108 cm out on a 117 cm disc, 58 cm tall) meets the floor
      // well past the edge, so the floor hit alone can't be the test: walk the ray through the buildings' heights. Past
      // the rim there's no slack, so only a ray that really passes through a building (or an edge pin) picks it.
      const r = this.map.radiusM * this.map.cmPerM
      const outside = hit.x * hit.x + hit.z * hit.z > r * r
      if (outside && hit.x * hit.x + hit.z * hit.z > 9 * r * r) continue
      const id = this.map.pickUnderCursor(hit, outside ? 0 : slackCm, eye, only)
      if (id) return id
    }
    return ""
  }

  /** Right-hand targeting ray direction (world), or null when the hand isn't tracked. */
  private handRayDir(): vec3 | null {
    try {
      for (const it of SIK.InteractionManager.getTargetingInteractors()) {
        if (!(it.inputType & InteractorInputType.RightHand)) continue
        const d = it.direction
        if (d && d.length > 0.5) return d.normalize()
      }
    } catch (e) {
      // SIK not ready
    }
    return null
  }

  /** Which landmark is the cursor aimed at? The map cursor first, then the right-hand ray out into the real world.
   * Head gaze never selects: without a tracked hand ray, nothing is aimed at. */
  private gazedLandmark(): string {
    const pointed = this.cursorLandmark()
    if (pointed) return pointed
    const dir = this.handRayDir()
    if (!dir) return ""
    // Hand pointing down at the floor but off the map's buildings: nothing out in the world is meant.
    if (dir.y < -0.45) return ""
    // Out in the world: the building whose real footprint covers the view direction, nearest first, but looking
    // up over a low roof (the Quad) finds the tall one behind it (Hoover). Instant and local: no network.
    const bearing = worldDirToBearing(toV3(dir), this.mapYaw)
    const pitch = (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI
    return pickByBearing(this.hereEN(), bearing, this.map.worldPickCandidates(), pitch) || ""
  }

  tellAboutGaze(picked = "") {
    const id = picked || this.gazedLandmark() || this.focus || this.nearestLandmark(this.me)
    if (!id) return this.setStatus("Point the cursor at a building, on the map or out there, and pinch.")
    this.tellAbout(id)
  }

  /** Next narration segment per building (0 = overview). */
  private segAt: Record<string, number> = {}

  /**
   * Narrated tour: the first pinch on a building plays its overview, each further pinch on the SAME building plays
   * the next "more" segment (each ends with "pinch again" or a pointer to a nearby building). After the last one,
   * it starts over from the overview. Buildings without narration fall back to single facts.
   */
  private tellAbout(id: string) {
    const segs = narrationFor(id)
    if (!segs.length) return this.tellFact(id)
    const card = cardById(id)
    const again = id === this.focus && this.focusMode === id
    this.coachEvent(again ? "more" : "picked")
    let i = this.segAt[id] || 0
    if (i >= segs.length) i = 0 // heard it all: start over from the overview
    const seg = segs[i]
    this.segAt[id] = i + 1
    // Centerpiece cards follow the baked narration segment exactly; other buildings keep the fact rotation.
    const storyFact = storyCardFactId(id, i)
    const fact = STORY_CARD_COUNTS[id]
      ? (storyFact ? (factById(storyFact)?.fact || null) : null)
      : nextFact(id, this.state.heard, themesFromProfile(this.state.profile)) || (card && card.facts.length ? card.facts[i % card.facts.length] : null)
    if (!again) {
      this.focusOn(id)
      this.enterFocus(id, fact, i)
    } else {
      this.focusActiveAt = getTime()
      if (this.infoPanel && fact) {
        const frame = this.map.focusFrame(id)
        if (frame) this.infoPanel.show(card, fact, frame.top, this.camera.getTransform().getWorldPosition(), undefined, i)
      }
    }
    if (fact) {
      this.markHeard(fact.id)
      this.showModelFor(fact.id)
    } else if (this.showcase) this.showcase.hide()
    const more = i + 1 < segs.length ? `  ·  pinch again for more (${i + 1}/${segs.length})` : ""
    this.sayClip(seg.clip, seg.text, `${card ? card.label : id}${more}`)
    // Warm the next segment so "pinch again" starts instantly.
    if (i + 1 < segs.length) this.guide.prefetchClip(segs[i + 1].clip, segs[i + 1].text)
  }

  private tellFact(id: string) {
    const storyIndex = this.segAt[id] || 0
    const deckFact = storyCardFactId(id, storyIndex)
    const fact = deckFact ? (factById(deckFact)?.fact || null) : nextFact(id, this.state.heard, themesFromProfile(this.state.profile))
    if (deckFact) this.segAt[id] = storyIndex + 1
    const card = cardById(id)
    this.coachEvent(id === this.focus && this.focusMode === id ? "more" : "picked")
    // "More" on the building already in focus: keep its lights, money and experience; enterFocus just updates the card.
    if (!(id === this.focus && this.focusMode === id)) this.focusOn(id)
    this.enterFocus(id, fact, storyIndex)
    if (!fact) {
      if (this.showcase) this.showcase.hide()
      this.say(`That's all my notes on ${card.name}. Look at another building and pinch.`, `${card.label}: all facts heard`, this.quizAfterSpeech(id))
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
    if (this.tourShown.indexOf(id) < 0) this.tourShown.push(id) // pinched stops count for "next spot" too
    this.map.drawSightline(id)
    if (withMoney && this.money && this.showMoneyPiles) this.money.showForLandmark(id, this.map, this.moneyOnMap, {mapExaggeration: this.moneyMapExaggeration, mapOffsetCm: this.moneyClearanceCm(id)})
    this.save()
  }

  /** On-map money pile offset: just outside the focused building's grown footprint, on the wearer's side. */
  private moneyClearanceCm(id: string): number {
    return Math.max(4, this.map.focusClearanceCm(id) + 2.5)
  }

  /** Exploded product model for the fact being spoken: beside the focused building, or in front of the wearer. */
  private showModelFor(factId: string) {
    if (!this.showcase) return
    if (!this.showExplodedModels) return this.showcase.hide()
    const mid = this.showcase.modelForFact(factId)
    if (!mid) return this.showcase.hide()
    const cam = this.camera.getTransform().getWorldPosition()
    const ambient = this.focusMode ? this.sideSpot(this.experienceSideDeg, this.sideDistanceCm) : null
    if (ambient) {
      this.showcase.show(mid, ambient, cam, this.sideScaleCm)
      return
    }
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
      if (!this.infoPanel) this.infoPanel = this.getSceneObject().createComponent(RetrospecsInfoPanel.getTypeName()) as RetrospecsInfoPanel
      if (!this.infoPanel) return
      if (!this.infoPanel.material && this.map) this.infoPanel.material = this.map.material
      if (!this.infoPanel.camera) this.infoPanel.camera = this.camera
    } catch (e) {
      print("[Retrospecs] info panel unavailable: " + e)
    }
  }

  /** Enters (or moves) focus to `id`, with `fact` on the card (null: name and namesake only). */
  private enterFocus(id: string, fact: Fact | null, storyIndex = 0) {
    const card = cardById(id)
    if (!card || !this.map.root || !this.map.landmarks[id]) return
    // Already in focus on this building: only refresh the card, no re-grow or experience re-animation.
    const same = this.focusMode === id
    this.focusMode = id
    this.focusActiveAt = getTime()
    if (!same) {
      this.selectedAt = this.focusActiveAt
      this.map.setFocus(id)
      this.nudge = newNudgeState()
      this.experienceSpot = null
    }
    const frame = this.map.focusFrame(id)
    const cam = this.camera.getTransform().getWorldPosition()
    if (this.infoPanel && frame) {
      this.infoPanel.show(card, fact, frame.top, cam, undefined, storyIndex)
      // Diagram loops retain their original position. HP Garage has no diagram: its people
      // clip uses that position, preserving the existing view without showing it twice.
      // Simple-focus buildings (Core/CardTheme): one 3D animation left, one founder screen right, equal gaps, no diagram.
      const simple = isSimpleFocus(id)
      const holo = simple ? null : this.sideSpot(-this.hologramSideDeg, this.sideDistanceCm + 15)
      if (holo) this.infoPanel.showSideHologram(id, holo, cam, this.hologramWidthCm)
      else this.infoPanel.hideSideHologram()
      const peopleDeg = simple ? this.flank().right : id === "hpgarage" ? -this.hologramSideDeg : this.peopleHologramSideDeg
      const people = this.sideSpot(peopleDeg, this.sideDistanceCm + 15)
      if (people) this.infoPanel.showPeopleHologram(id, people, cam, this.peopleHologramWidthCm)
      else this.infoPanel.hidePeopleHologram()
    }
    const exp = this.experiences as any
    if (exp && !same) {
      const layout = this.focusLayoutFor(id)
      try {
        if (exp.hide) exp.hide()
        // Experiences treat the anchor as their base and rise ~1.1x scale above it; the layout gives a centre.
        // Just off the card's left edge, at the card's height.
        const amb = this.sideSpot(isSimpleFocus(id) ? this.flank().left : -this.experienceSideDeg, this.sideDistanceCm)
        if (amb && exp.show) {
          if (exp.show(id, new vec3(amb.x, amb.y - this.sideScaleCm * 0.55, amb.z), cam, this.sideScaleCm) !== false) this.experienceSpot = amb
        }
        else if (layout && exp.show) exp.show(id, new vec3(layout.experience.x, layout.experience.y - this.experienceScaleCm * 0.55, layout.experience.z), cam, this.experienceScaleCm)
      } catch (e) {
        print("[Retrospecs] experiences hook failed: " + e)
      }
    }
  }

  /** Smoothly restores the whole map and puts the card away. Extras (money, model) are left to the caller. */
  private exitFocus() {
    if (!this.focusMode) return
    this.focusMode = ""
    this.experienceSpot = null
    this.map.setFocus(null)
    if (this.infoPanel) this.infoPanel.hide()
    if (this.infoPanel) this.infoPanel.hideSideHologram()
    if (this.infoPanel) this.infoPanel.hidePeopleHologram()
    const exp = this.experiences as any
    if (exp && exp.hide) {
      try {
        exp.hide()
      } catch (e) {
        print("[Retrospecs] experiences hide failed: " + e)
      }
    }
  }

  /**
   * A spot on the card's wall `deg` degrees from the card's centre line (negative = the wearer's left), `distCm` from
   * where the eyes were when the card was placed, at the card's own height.
   */
  /** Headings of the 3D animation (left) and founder screen (right) with equal gaps to the story card. */
  private flank(): {left: number; right: number} {
    const cardDeg = this.infoPanel && this.infoPanel.storyCardWidthDeg > 0 ? this.infoPanel.storyCardWidthDeg : 20.3
    return flankHeadings(cardDeg, this.flankGapDeg,
      halfWidthDeg(this.sideScaleCm, this.sideDistanceCm), halfWidthDeg(this.peopleHologramWidthCm, this.sideDistanceCm + 15))
  }

  private sideSpot(deg: number, distCm: number): vec3 | null {
    if (!this.ambientExtras || !sharedWall.active) return null
    const a = (Math.max(-110, Math.min(110, deg)) * Math.PI) / 180
    const d = Math.max(80, distCm)
    const w = sharedWall.toWorld({x: d * Math.sin(a), y: -TV_WALL.dropCm, z: d * Math.cos(a)})
    return new vec3(w.x, w.y, w.z)
  }

  // -------------------------------------------------------------------------
  // Look-around nudge: the glasses' view is narrow, so a head-locked arrow at its edge points at side pieces the
  // wearer hasn't looked at yet, and back down at the map after a while looking away from it.

  private nudge = newNudgeState()
  /** Where the 3D experience was put for the building in focus (null: none shown). */
  private experienceSpot: vec3 = null
  private mapAwaySec = 0
  private nudgeRoot: SceneObject = null
  private nudgeArrow: SceneObject = null
  private nudgeT = 0
  private nudgeAlpha = 0
  private nudgeAngle = 0

  private nudgeTarget(id: string, world: vec3): NudgeTarget {
    const l = this.camera.getTransform().getInvertedWorldTransform().multiplyPoint(world)
    return offsetsFromLocal(id, l.x, l.y, l.z)
  }

  private updateLookNudge() {
    const dt = getDeltaTime()
    let out: NudgeOutput = {show: false, targetId: null, angleRad: 0}
    const busy = !this.lookNudge || this.mode === "calibrate" || !this.map.root || this.unfoldT >= 0 || (this.chat && this.chat.isOpen())
    if (!busy && this.focusMode) {
      const targets: NudgeTarget[] = []
      if (this.experienceSpot) targets.push(this.nudgeTarget("experience", this.experienceSpot))
      if (this.infoPanel) {
        for (const s of this.infoPanel.sideScreens()) {
          try {
            targets.push(this.nudgeTarget(s.id, s.object.getTransform().getWorldPosition()))
          } catch (e) {
            // destroyed this frame
          }
        }
      }
      out = stepNudge(this.nudge, targets, dt)
      this.mapAwaySec = 0
    } else if (!busy) {
      const m = this.nudgeTarget("map", this.map.root.getTransform().getWorldPosition())
      this.mapAwaySec = Math.abs(m.yawDeg) <= 20 && Math.abs(m.pitchDeg) <= 16 ? 0 : this.mapAwaySec + dt
      out = mapNudge(m, this.mapAwaySec)
    }
    this.drawNudge(out, dt)
  }

  private makeNudgeArrow() {
    if (this.nudgeRoot || !this.map.root) return
    const root = global.scene.createSceneObject("look_nudge")
    root.setParent(this.camera)
    const arrow = global.scene.createSceneObject("look_nudge_arrow")
    arrow.setParent(root)
    // Chevron in the x-y plane pointing +x, facing the eye (+z toward the camera).
    const v = (x: number, y: number) => [x, y, 0, 0, 0, 1, 0, 0]
    const T = 0.9 // stroke
    const chunk = {
      verts: [
        // upper stroke: from (-1.6, 2.4) to tip (1.6, 0)
        ...v(-1.6, 2.4 + T), ...v(-1.6, 2.4 - T * 0.2), ...v(1.6 - T, 0), ...v(1.6 + T * 0.4, 0),
        // lower stroke
        ...v(-1.6, -2.4 - T), ...v(-1.6, -2.4 + T * 0.2), ...v(1.6 - T, 0), ...v(1.6 + T * 0.4, 0)
      ],
      idx: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 2, 1, 0, 3, 2, 0, 5, 6, 4, 6, 7, 4]
    }
    try {
      const a = this.map.meshObject(arrow, "look_nudge_mesh", chunk, [0.45, 0.95, 1, 1])
      a.obj.getTransform().setLocalPosition(new vec3(-2.2, 0, 0))
      const b = this.map.meshObject(arrow, "look_nudge_mesh2", chunk, [0.45, 0.95, 1, 1])
      b.obj.getTransform().setLocalPosition(new vec3(1.4, 0, 0))
    } catch (e) {
      print("[Retrospecs] look nudge arrow failed: " + e)
    }
    root.enabled = false
    this.nudgeRoot = root
    this.nudgeArrow = arrow
  }

  /** Eases the arrow in and out at the edge of the view, on the side of the target, bobbing toward it. */
  private drawNudge(out: NudgeOutput, dt: number) {
    if (out.show && !this.nudgeRoot) this.makeNudgeArrow()
    if (!this.nudgeRoot) return
    const k = 1 - Math.exp(-dt * 6)
    this.nudgeAlpha += ((out.show ? 1 : 0) - this.nudgeAlpha) * k
    if (out.show) {
      // Ease the direction so it swings rather than jumps when the head turns.
      let d = out.angleRad - this.nudgeAngle
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      this.nudgeAngle += d * Math.min(1, dt * 8)
    }
    const visible = this.nudgeAlpha > 0.03
    if (this.nudgeRoot.enabled !== visible) this.nudgeRoot.enabled = visible
    if (!visible) return
    this.nudgeT += dt
    const D = 70
    const a = this.nudgeAngle
    const c = Math.cos(a), s = Math.sin(a)
    // On an ellipse just inside the view edge (wider than tall, like the display).
    const bob = 0.5 + 0.5 * Math.sin(this.nudgeT * 7)
    const rx = D * Math.tan((11 * Math.PI) / 180) + bob * 1.6
    const ry = D * Math.tan((8 * Math.PI) / 180) + bob * 1.2
    const t = this.nudgeArrow.getTransform()
    t.setLocalPosition(new vec3(c * rx, s * ry, -D))
    t.setLocalRotation(quat.angleAxis(a, vec3.forward()))
    t.setLocalScale(vec3.one().uniformScale((0.85 + 0.25 * bob) * this.nudgeAlpha))
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
    const speaking = this.guide.isSpeaking()
    if (speaking) this.focusActiveAt = this.lastSpokeAt = now
    // The card stays up while its ask chat is open.
    if (this.chat && this.chat.isOpen()) this.focusActiveAt = now
    // Never while the guide talks, and at least 30 s after it stops (Core/Selection), whatever the scene says.
    // The locked demo never drops a card on its own: the judge may still be reading it.
    if (!this.demoActive() && focusIdleExpired(now, this.focusActiveAt, this.focusIdleSec, speaking)) {
      print("[Retrospecs] focus idle, restoring the map")
      this.hideExtras()
      this.coachEvent("closed") // the card's gone, so its tip must go too
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
        print(`[Retrospecs] identified ${r.id} (${r.source}, conf ${r.confidence.toFixed(2)}, ${Math.round(r.distanceM)} m)`)
        const tag = this.overlay ? this.overlay.showBuilding(r, this.map.worldRoot, this.map.center) : null
        const card = r.landmark ? cardById(r.id) : null
        if (card) {
          if (r.id !== this.focusMode) this.focusOn(r.id, false) // same building: don't reset its lights/money
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
        print("[Retrospecs] identify failed: " + e)
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
    const lines = [`Welcome to Stanford. You're at ${hereName}. Look at any building and pinch to hear about it.`]
    // Buildings with narration play their baked clips, so only warm the ones that would fall back to live speech.
    // (Warming every building's fact used to queue ~68 requests per start and trip the gateway's rate limit.)
    const themes = themesFromProfile(this.state.profile)
    for (const c of CARDS) {
      const segs = narrationFor(c.id)
      if (segs.length) {
        this.guide.prefetchClip(segs[0].clip, segs[0].text)
        continue
      }
      const f = nextFact(c.id, this.state.heard, themes)
      if (f) lines.push(`${c.name}.`, f.text)
    }
    if (QUIZ_ENABLED) lines.push("Here's something new.")
    if (QUIZ_ENABLED) for (const c of CARDS) lines.push(guessPrompt(c.id))
    this.guide.prefetch(lines)
  }

  /** After a fact about `id`: warm its next fact and the likely quiz prompt. */
  private prefetchAround(id: string) {
    const themes = themesFromProfile(this.state.profile)
    const lines: string[] = []
    const f = nextFact(id, this.state.heard, themes)
    if (f) lines.push(f.text)
    const target = QUIZ_ENABLED ? nextGuessTarget(this.me, this.positions, this.state.guessed, id) : null
    if (target) {
      lines.push(guessPrompt(target))
      const tf = nextFact(target, this.state.heard, themes)
      if (tf) lines.push(tf.text)
    }
    this.guide.prefetch(lines)
  }

  private youAreHere: SceneObject = null
  private facingArrow: SceneObject = null
  /** Where the "You are here" pin sits on the map (map-local cm): the centre until the map is brought over. */
  private youOffset = vec3.zero()
  private youT = 0

  /** Floating tag and heading arrow over the map's "You are here" pin. */
  private makeYouAreHere() {
    if (!this.map.root) return
    const arrow = global.scene.createSceneObject("you_facing_arrow")
    arrow.setParent(this.map.root)
    const y = 7
    const point = (x: number, z: number) => [x, y, z, 0, 1, 0, 0, 0]
    this.map.meshObject(arrow, "facing_arrow", {
      verts: [
        ...point(-0.6, -1.5), ...point(0.6, -1.5), ...point(0.6, -7), ...point(-0.6, -7),
        ...point(-2.8, -7), ...point(2.8, -7), ...point(0, -12)
      ],
      idx: [0, 1, 2, 0, 2, 3, 4, 5, 6, 2, 1, 0, 3, 2, 0, 6, 5, 4]
    }, this.map.colors.you)
    this.facingArrow = arrow
    if (!this.map.labelPrefab) return
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
    if (!this.map.root) return
    if (this.facingArrow) {
      this.facingArrow.getTransform().setLocalPosition(this.youOffset)
      const bearing = worldDirToBearing(this.viewHorizontal(), this.mapYaw)
      this.facingArrow.getTransform().setLocalRotation(quat.angleAxis(-bearing * Math.PI / 180, vec3.up()))
    }
    if (!this.youAreHere) return
    this.youT += getDeltaTime()
    const t = this.youAreHere.getTransform()
    t.setLocalPosition(new vec3(this.youOffset.x, this.youAreHereHeightCm + Math.sin(this.youT * 2.2) * 1.5, this.youOffset.z))
    const cam = this.camera.getTransform().getWorldPosition()
    const p = t.getWorldPosition()
    t.setWorldRotation(quat.angleAxis(Math.atan2(cam.x - p.x, cam.z - p.z), vec3.up()))
  }

  private calibrateInstruction(): string {
    if (this.indoorDemo || this.demoMode) return "Welcome to Retrospecs"
    if (this.isEditor) return this.useStartPoint ? "Preview: tap to calibrate (camera facing = start-point direction)." : "Preview: tap to calibrate (uses the camera's facing)."
    return this.useStartPoint ? this.startInstruction : "Face the wall. Pinch a point on its LEFT, then its RIGHT."
  }

  /** Clears the money pile, model and tags, and leaves focus mode. */
  private hideExtras() {
    this.liveFor = "" // leaving the building ends the live follow-up window
    this.exitFocus()
    if (this.money) this.money.hide()
    if (this.showcase) this.showcase.hide()
    if (this.overlay) this.overlay.hide()
  }

  /** Starts the next quiz 1.5 s after the current narration finishes (if nothing else happened meanwhile). */
  private quizAfterSpeech(fromId: string): () => void {
    return () => {
      if (!QUIZ_ENABLED || !this.autoQuiz) return
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
      if (/\b(skip|ready|done|start|open)\b/.test(t)) this.finishCalibration(this.viewHorizontal())
      return
    }
    if (this.demoMode && isRestartDemoIntent(t)) return this.restartDemo()
    if (this.demoActive()) return this.demoUtterance(raw, t)
    if (/\b(demo|tutorial|how does this work|show me how)\b/.test(t)) return this.restartCoach()
    // Coach pick step: no shortcuts ("next spot" etc.) until the visitor has selected the target with the cursor.
    if (this.coachStep === "pick") return this.setStatus(this.caption)
    if (/\b(recalibrate|calibrate)\b/.test(t)) return this.recalibrate()
    if (/\bwhat('?s| is) (that|this)\b|\bwhat am i looking at\b/.test(t)) return this.identifyReal()
    if (/\b(explode|take it apart|show me again)\b/.test(t) && this.showcase && this.showcase.isShowing()) return this.showcase.toggle()
    if (/^(close|hide|clear)( it| that| the model| everything)?\.?$/.test(t)) return this.hideExtras()
    // Leave focus mode: "back", "go back", "close", "exit", "zoom out of it"...
    if (/^(go |take me )?back( out)?\.?$|^(close|exit)( focus| the (card|panel)| this)?\.?$/.test(t)) {
      if (this.focusMode) this.setStatus("Back to the whole map.")
      return this.hideExtras()
    }
    if (/\breset (the )?tour\b/.test(t)) return this.resetTour()
    if (QUIZ_ENABLED && /\b(quiz|guess|test me)\b/.test(t)) return this.startGuess(this.focus)
    if (isNextSpotIntent(t)) return this.showNextSpot()
    if (/\b(something new|tell me more|another (one|fact))\b/.test(t) && this.focus) return this.tellAbout(this.focus)
    if (/^(i'?m|i am|i like|i love|i want|i study|my )/.test(t)) return this.setProfile(raw)
    // Ask further: "look it up", "search …", "what else …" go to the live web for the building in focus.
    if (isAskFurtherIntent(t)) return this.askLive(stripAskFurtherCommand(raw))
    // Mid-conversation follow-ups ("when was that?") stay with the live answer that prompted them.
    if (this.inLiveConversation()) return this.askLive(raw)
    this.askGuide(raw)
  }

  // -------------------------------------------------------------------------
  // Ask further: live, web-grounded answers beyond the baked narration and the checked cards.

  /** Recent live Q/A per building, for follow-ups. */
  private liveTurns: Record<string, LiveTurn[]> = {}
  private liveAt = -1
  private liveFor = ""
  private liveToken = 0

  /** Which building a voice question is about: the one in focus while the card is up (looking around while asking
   * must not retarget it), else the one looked at, else the last focused one. */
  private voiceTarget(): string {
    return this.focusMode || this.gazedLandmark() || this.focus
  }

  /** True shortly after a live answer about the building still in focus. */
  private inLiveConversation(): boolean {
    if (!this.liveFor || this.liveAt < 0) return false
    const target = this.voiceTarget()
    return target === this.liveFor && getTime() - this.liveAt < this.liveFollowUpSec
  }

  /** Everything the visitor has heard about `id`: narration segments played so far, plus card facts heard. */
  private toldAbout(id: string): string[] {
    const told: string[] = []
    const segs = narrationFor(id)
    const n = Math.min(segs.length, this.segAt[id] || 0)
    for (let i = 0; i < n; i++) told.push(segs[i].text)
    const card = cardById(id)
    if (card) for (const f of card.facts) if (this.state.heard.indexOf(f.id) >= 0) told.push(f.text)
    return told
  }

  private askLive(question: string) {
    this.lookupLive(question, this.voiceTarget(), false)
  }

  /**
   * One live, web-grounded answer about building `id` ("" = a general Stanford question). `toChat`: the Ask
   * path, which answers in the chat window and leaves the building's normal card alone; otherwise the answer replaces
   * the focus card (the left-pinch "look it up" path). Both speak it and share the follow-up history.
   */
  private lookupLive(question: string, id: string, toChat: boolean) {
    const card = id ? cardById(id) : undefined
    const token = ++this.liveToken
    this.setStatus(card ? `Looking up ${card.label}…` : "Looking it up…")
    // No "let me look that up" filler: quiet until the answer, which the screen labels with its source.
    this.guide.stopSpeaking()
    if (id && !toChat) this.map.setState(id, "focus")
    const turns = id ? this.liveTurns[id] || [] : []
    this.guide
      .askLive(question, card, id ? this.toldAbout(id) : [], turns, this.state.profile)
      .then((a) => {
        if (token !== this.liveToken) return // a newer question (or the chat's X) superseded this one
        const label = card ? card.label : ""
        const shown = presentLive(a, label)
        if (id) {
          this.liveTurns[id] = turns.concat([{q: question || "(tell me more)", a: a.speech}]).slice(-3)
          this.liveFor = id
          this.liveAt = getTime()
          this.focusActiveAt = getTime()
        }
        if (toChat) {
          if (this.chat) this.chat.showAnswer(chatHeading(label), question, a.speech, this.chatSource(a), this.chipLabels())
        } else if (id) {
          // Show the answer on the focus card, with where it came from. Never marked heard or lit: no validator here.
          if (this.focusMode !== id && card && this.map.landmarks[id]) {
            this.focusOn(id, false)
            this.enterFocus(id, null)
          }
          const frame = this.map.focusFrame(id)
          if (this.infoPanel && frame && card) {
            const live = {id: "live_" + id, theme: "fun" as const, text: a.speech, source: a.sources.length ? a.sources[0].uri : ""}
            this.infoPanel.show(card, live, frame.top, this.camera.getTransform().getWorldPosition(), shown.caption)
          }
        }
        // Just the answer: no spoken "From what I found online" lead-in. Where it came from is on screen.
        this.say(a.speech, shown.caption)
      })
      .catch((e) => {
        if (token !== this.liveToken) return
        print("[Retrospecs] live lookup failed (" + e + ")")
        if (toChat) {
          if (this.chat) this.chat.showError(chatHeading(card ? card.label : ""), question, "I couldn't reach the web just now. These ones I can answer:", this.chipLabels())
          this.say("I couldn't reach the web just now.", "Web lookup failed")
          return
        }
        if (id) {
          this.say("I couldn't reach the web just now. Here's what my notes say.", "Web lookup failed", () => this.tellAbout(id))
          return
        }
        this.setStatus("Couldn't reach the web. Look at a building and pinch.")
        this.guide.speak("I couldn't reach the web just now. Look at a building and pinch to hear about it.")
      })
  }

  // -------------------------------------------------------------------------
  // Ask: the card's Ask button opens the chat with the mic on and suggested questions; X to close

  private chat: AskChat = null
  /** True from an Ask press until its transcript arrives, so that transcript goes to the chat. */
  private bubbleListening = false
  /** The chips showing in the chat, and the questions already asked about each building (so follow-ups are new). */
  private chips: SuggestedQuestion[] = []
  private askedChips: Record<string, string[]> = {}

  private setupChat() {
    try {
      const mat = (this.infoPanel && this.infoPanel.material) || (this.map && this.map.material)
      if (mat && this.camera) this.chat = new AskChat(mat, this.camera, this.infoPanel ? this.infoPanel.font : null)
    } catch (e) {
      print("[Retrospecs] ask chat unavailable: " + e)
    }
  }

  /** Legacy mic bubble (AskBridge): the same as pressing Ask. The bubble is hidden while Retrospecs runs. */
  bubbleListenStart() {
    this.openAsk()
  }

  /** Ask pressed: stop all talking and any pending lookup, open the chat listening with chips, and start the mic. */
  startAsk() {
    this.openAsk()
    if (this.asr) this.asr.startListening()
  }

  private openAsk() {
    this.bubbleListening = !!this.asr
    this.liveToken++
    this.guide.stopSpeaking()
    if (this.infoPanel) this.infoPanel.setPulse("")
    this.refreshChips()
    if (this.chat) {
      if (this.asr) this.chat.showListening(this.chatTitle(), "", this.chipLabels())
      else this.chat.showError(this.chatTitle(), "", "The mic isn't available. Tap a question:", this.chipLabels())
      this.chat.setPulseChip(this.demoActive() ? this.demoChip() : -1)
    }
    this.setStatus(this.asr ? "Listening… say anything, or tap a question." : "Tap a question.")
  }

  /** Chips for the building in focus, leaving out the ones already asked about it. */
  private refreshChips() {
    const id = this.focusMode || ""
    this.chips = suggestedQuestions(id ? cardById(id) : null, this.state.heard, this.askedChips[id] || [])
  }

  private chipLabels(): string[] {
    return this.chips.map((c) => c.label)
  }

  /** Locked demo: the suggested question's chip (it blinks), else the first. */
  private demoChip(): number {
    const i = this.chips.findIndex((c) => c.label === DEMO_SUGGESTED_QUESTION)
    return this.chips.length ? Math.max(0, i) : -1
  }

  /**
   * A chip tapped: answered from the checked card fact, instantly and offline. Closes the mic first, so a late
   * transcript can't replace this answer.
   */
  private answerChip(i: number) {
    const q = this.chips[i]
    const f = q ? factById(q.factId) : null
    if (!q || !f) return
    if (this.bubbleListening && this.asr) this.asr.stopListening()
    this.bubbleListening = false
    this.liveToken++
    if (this.demoActive()) {
      if (this.demo.step !== "ask") return this.demoNudge()
      this.demoMarkAsked()
    }
    const id = f.card.id
    if (this.mode === "tour") this.selectQuietly(id)
    this.askedChips[id] = (this.askedChips[id] || []).concat([q.label])
    this.markHeard(f.fact.id)
    this.save()
    this.refreshChips()
    if (this.chat) {
      this.chat.showAnswer(chatHeading(f.card.label), q.label, f.fact.text, "From my checked notes", this.chipLabels())
      this.chat.setPulseChip(-1)
    }
    this.say([f.fact.text], f.card.label)
  }

  private chatTitle(): string {
    const c = this.focusMode ? cardById(this.focusMode) : null
    return chatHeading(c ? c.label : "")
  }

  /** "From the web: stanford.edu, …" or the general-knowledge note, for the chat's last line. */
  private chatSource(a: {grounded: boolean; sources: {title: string}[]}): string {
    if (a.grounded && a.sources.length) return "From the web: " + a.sources.slice(0, 3).map((s) => s.title).join(", ")
    return a.grounded ? "From the web" : "General knowledge, not from my checked notes"
  }

  /**
   * A spoken question after Ask: tour commands ("next spot", "what's that") go to the tour; anything else selects
   * the building it names (or keeps the one in focus) exactly as a pinch would, without the narration, then is
   * answered live in the chat window.
   */
  private askFromBubble(raw: string) {
    this.bubbleListening = false
    const question = (raw || "").trim()
    // Presenter: "restart demo" works at any step, free roam included (the mic only opens from Ask now).
    if (this.demoMode && isRestartDemoIntent(question)) {
      if (this.chat) this.chat.hide()
      return this.handleUtterance(question)
    }
    if (this.demoActive()) {
      if (this.demo.step !== "ask") return this.demoNudge()
      if (question) this.demoMarkAsked()
    }
    if (!question) {
      if (this.chat) this.chat.showError(this.chatTitle(), "", "I didn't catch that. Tap a question, or pinch Ask and try again.", this.chipLabels())
      return
    }
    if (!this.demoActive() && isTourCommand(question)) {
      if (this.chat) this.chat.hide()
      return this.handleUtterance(question)
    }
    // "Show me where Hoover Tower is": select it on the map and close the chat; they're done asking.
    // (Not in the locked demo, whose ask step moves on only after a spoken answer.)
    const locateId = !this.demoActive() && this.mode === "tour" ? locateOnlyTarget(question, CARDS) : ""
    if (locateId) {
      this.selectQuietly(locateId)
      this.closeChat()
      const lc = cardById(locateId)
      if (lc) this.setStatus(lc.label)
      return
    }
    const named = buildingMentioned(question, CARDS)
    const id = named || this.focusMode || ""
    if (id && this.mode === "tour") this.selectQuietly(id)
    const card = id ? cardById(id) : null
    if (this.chat) this.chat.showThinking(chatHeading(card ? card.label : ""), question)
    this.lookupLive(question, id, true)
  }

  /** Map highlight, card, 3D pieces and holograms for `id`, as a pinch shows them, but silent. */
  private selectQuietly(id: string) {
    if (this.focusMode === id) {
      this.focusActiveAt = getTime()
      return
    }
    const card = cardById(id)
    if (!card) return
    // The card the next pinch would show first (the overview's story card), without advancing the narration.
    const i = 0
    const storyFact = storyCardFactId(id, i)
    const fact = STORY_CARD_COUNTS[id]
      ? (storyFact ? (factById(storyFact)?.fact || null) : null)
      : nextFact(id, this.state.heard, themesFromProfile(this.state.profile)) || (card.facts.length ? card.facts[0] : null)
    this.lastSelectAt = getTime()
    this.focusOn(id)
    this.enterFocus(id, fact, i)
    if (fact) this.showModelFor(fact.id)
    else if (this.showcase) this.showcase.hide()
  }

  /**
   * True if the hand's ray (or the Preview mouse) is on an interactable that isn't ours: not the map, the focus card
   * or the ask chat (the hidden mic bubble included).
   */
  private rayOnOtherButton(mask: number): boolean {
    let interactors
    try {
      interactors = SIK.InteractionManager.getTargetingInteractors()
    } catch (e) {
      return false
    }
    for (const it of interactors) {
      if (!(it.inputType & mask)) continue
      const info = it.targetHitInfo
      if (!info || !info.interactable || info.interactable === this.map.cursorTarget) continue
      if (this.infoPanel && this.infoPanel.rayOnCard()) continue
      if (this.chat && this.chat.rayOnWindow()) continue
      return true
    }
    return false
  }

  /** Right pinch / Preview tap on the chat: X closes it; anywhere else on it is swallowed. */
  private chatPinch(): boolean {
    if (!this.chat || !this.chat.isOpen() || !this.chat.rayOnWindow()) return false
    this.rightDownAt = -1 // the release must not run a selection or the locator
    const now = getTime()
    if (this.lastSelectAt >= 0 && now - this.lastSelectAt < 0.3) return true // bounce
    this.lastSelectAt = now
    if (this.chat.closeUnderRay()) {
      playSfx("click")
      this.closeChat()
    } else {
      const i = this.chat.chipUnderRay()
      if (i >= 0) {
        playSfx("click")
        this.answerChip(i)
      }
    }
    return true
  }

  /** X on the chat: stop the answer, cancel any lookup, back to the tour as it was (the building's card stays). */
  private closeChat() {
    if (this.chat) this.chat.hide()
    this.guide.stopSpeaking()
    this.liveToken++
    this.liveFor = ""
    this.liveAt = -1
    if (this.bubbleListening && this.asr) this.asr.stopListening()
    this.bubbleListening = false
    const c = this.focusMode ? cardById(this.focusMode) : null
    this.setStatus(c ? c.label : "Point at a building and pinch. Pinch Ask on its card to ask.")
  }

  private askGuide(question: string) {
    const focus = this.voiceTarget()
    this.setStatus("Thinking…")
    if (focus) this.map.setState(focus, "focus")
    this.guide
      .ask(question, focus, this.state.profile, this.state.heard)
      .then((a) => {
        if (this.askFurther && focus && (a.declined || !a.fact_ids.length)) return this.askLive(question)
        this.applyAnswer(a)
      })
      .catch((e) => {
        print("[Retrospecs] guide failed (" + e + "), using local answer")
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
    if (this.chat) {
      this.chat.setTheme(this.focusMode || "")
      this.chat.update(getDeltaTime())
    }
    this.updateCoach()
    this.updateDemo()
    this.updateDemoSkip()
    this.updateFocusMode()
    this.updateYouAreHere()
    this.updateRespawn()
    this.updateLookNudge()
    // Cyan highlight on whatever a pinch would pick right now (map cursor first, else the real building the hand
    // ray or head points at). Never in guess mode: it would give the answer away.
    this.updateHover()
    this.debugCursor() // DEBUG-CURSOR (temporary)
  }

  // DEBUG-CURSOR (temporary): auto-calibrates in Preview and logs what the cursor rays hit.
  private dbgT = 0
  private dbgNext = 3
  private debugCursor() {
    if (!this.isEditor) return
    this.dbgT += getDeltaTime()
    if (this.mode === "calibrate" && this.dbgT > 2) return this.finishCalibration(this.viewHorizontal())
    if (this.dbgT < this.dbgNext || !this.map.root) return
    this.dbgNext = this.dbgT + 1
    const all = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All)
    const desc = all.map((i: any) => `${i.inputType}${i.isTargeting() ? "T" : "-"}${i.isActive() ? "A" : "-"}:${i.targetHitInfo ? i.targetHitInfo.interactable.sceneObject.name : "none"}`).join(", ")
    const t: any = this.map.cursorTarget
    print(`[dbg] interactors ${desc} | target ${t ? "yes" : "no"} colliders ${t && t.colliders ? t.colliders.length : -1} mode ${t ? t.targetingMode : -1} enabled ${t ? t.enabled : "-"}`)
    const cam = this.camera.getTransform().getWorldPosition()
    const rt = this.map.root.getTransform()
    const end = cam.add(rt.getWorldPosition().sub(cam).uniformScale(1.5))
    Physics.createGlobalProbe().rayCast(cam, end, (hit) => print(`[dbg] probe cam->map: ${hit ? hit.collider.getSceneObject().name + " at " + hit.position.toString() + " registered=" + (SIK.InteractionManager.getInteractableByCollider(hit.collider) === t) : "nothing"} | map at ${rt.getWorldPosition().toString()} scale ${rt.getWorldScale().toString()} cam ${cam.toString()}`))
  }

  // -------------------------------------------------------------------------
  // Bring the map here: walked far from the map, look down, pinch with both hands

  private respawnRules(): RespawnRules {
    return {minMapDistM: this.respawnMinMapDistM, minWalkedM: this.respawnMinWalkedM, minLookDownDeg: this.respawnLookDownDeg, holdSec: this.respawnHoldSec}
  }

  /** Horizontal distances (m) from the wearer to the map's centre and to where the map was last placed. */
  private respawnDistances(): {mapDistM: number; walkedM: number} {
    const cam = this.camera.getTransform().getWorldPosition()
    const flat = (p: vec3) => Math.hypot(cam.x - p.x, cam.z - p.z) / 100
    const mapDistM = this.map.root ? flat(this.map.root.getTransform().getWorldPosition()) : 0
    return {mapDistM, walkedM: this.mapPlacedFrom ? flat(this.mapPlacedFrom) : 0}
  }

  /** Degrees the head is pitched below the horizon (the camera looks along its local -Z, `back`). */
  private lookDownDeg(): number {
    const v = this.camera.getTransform().back
    return (Math.asin(Math.max(-1, Math.min(1, -v.y))) * 180) / Math.PI
  }

  private respawnActive(): boolean {
    return this.respawnEnabled && this.mode === "tour" && !!this.map.root && this.coachStep !== "pick" && !this.demoActive()
  }

  /** True while the "pinch both hands" offer is showing (far from the map and looking down). */
  private respawnOffered(): boolean {
    if (!this.respawnActive()) return false
    const d = this.respawnDistances()
    return farFromMap({...d, active: true}, this.respawnRules()) && this.lookDownDeg() >= this.respawnLookDownDeg
  }

  private updateRespawn() {
    let both = false
    try {
      const l = SIK.HandInputData.getHand("left")
      const r = SIK.HandInputData.getHand("right")
      both = !!(l && r && l.isTracked() && r.isTracked() && l.isPinching() && r.isPinching())
    } catch (e) {
      both = false
    }
    const d = this.respawnDistances()
    const step = stepRespawn(this.respawn, {now: getTime(), ...d, lookDownDeg: this.lookDownDeg(), bothPinching: both, active: this.respawnActive()}, this.respawnRules())
    if (step.phase === "fire") {
      this.respawnShown = ""
      this.respawnMap()
      return
    }
    // Only touch the caption when the hint changes, so normal captions come back once the offer goes away.
    const hint = step.phase === "offer" ? "Map's back there. Pinch with both hands to bring it here."
      : step.phase === "holding" ? `Bringing the map here… ${Math.round(step.progress * 100)}%` : ""
    if (hint === this.respawnShown) return
    if (hint) {
      this.rightDownAt = -1 // a pinch while the offer is up is never a long "identify" pinch
      this.setStatus(hint)
    } else this.setStatus("")
    this.respawnShown = hint
  }

  /**
   * Brings the existing map over and puts it in front of the wearer, at table height below the eyes. It used to
   * rebuild the whole campus mesh here, inside the frame update and while both hands were pinching: a multi-second
   * hitch that also destroyed the cursor's interactable under SIK and objects the map still referenced (it crashed
   * or left picking broken). Moving it keeps everything alive. The real-world frame (worldAnchor) is untouched, so
   * name tags stay on their buildings; the "You are here" pin moves to where the wearer now stands on the map.
   */
  private respawnMap() {
    if (!this.map.root) return
    const here = this.hereEN() // the wearer's campus position, from the real-world frame
    const cam = this.camera.getTransform().getWorldPosition()
    const movedM = Math.round(Math.hypot(here.e - this.map.center.e, here.n - this.map.center.n))
    this.hideExtras()
    this.me = here
    if (this.locator) this.locator.setSurvey(this.me)
    this.floorY = cam.y - this.eyeHeightCm
    this.lifted = true // "bring the map here" always means a table in front of you
    this.placeMap(true)
    this.mapPlacedFrom = cam
    this.youOffset = this.mapLocalFor(here)
    this.map.setYouAt(this.youOffset)
    this.resetLights()
    print(`[Retrospecs] map brought over, ${movedM} m from the calibration spot`)
    const near = this.nearestLandmark(this.me)
    const nearName = near ? cardById(near).name : ""
    this.say(nearName ? `Map's here. You're near ${nearName}.` : "Map's here.", nearName ? `Map moved here · near ${nearName}` : "Map moved here")
  }

  /** Map-local cm for a campus position, kept just inside the disc's rim. */
  private mapLocalFor(p: EN): vec3 {
    let x = (p.e - this.map.center.e) * this.map.cmPerM
    let z = -(p.n - this.map.center.n) * this.map.cmPerM
    const r = Math.hypot(x, z)
    const max = this.map.radiusM * this.map.cmPerM * 0.95
    if (r > max) {
      x *= max / r
      z *= max / r
    }
    return new vec3(x, 0, z)
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
    if (this.demoMode) this.demo = demoStart()
    else if (this.indoorDemo) this.coachStep = "start"
    this.setStatus(this.calibrateInstruction())
  }

  private resetTour() {
    this.liveTurns = {}
    this.liveFor = ""
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

  /** Plays a pre-baked narration clip (ElevenLabs), falling back to live TTS of `text` if it isn't bundled. */
  private sayClip(clip: string, text: string, caption: string, onDone?: () => void) {
    this.setStatus(caption)
    this.guide.speakClip(clip, text, onDone)
  }

  private setStatus(s: string) {
    this.caption = s
    const suggest = this.coachSuggest ? cardById(this.coachSuggest) : null
    const hint = this.demoSkipTip ? this.demoSkipTip : this.demo.step !== "off"
      ? demoHint(this.demo, this.demoLabel(), this.demoAimOn)
      : coachHint(this.coachStep, this.coachAimNow, suggest ? suggest.label : "", this.coachAimOther)
    const shown = hint ? (s ? s + "\n" + hint : hint) : s
    if (this.statusText) this.statusText.text = shown
    if (this.statusLabel) this.statusLabel.text = shown
    print("[Retrospecs] " + shown)
  }

  // -------------------------------------------------------------------------
  // Indoor demo coach (Core/Coach): open the map, pick a building, use the card. Then it gets out of the way.

  private coachEvent(ev: CoachEvent) {
    if (this.coachStep === "off") return
    const next = coachNext(this.coachStep, ev)
    if (next === this.coachStep) return
    this.coachStep = next
    print(`[Retrospecs] coach: ${next}`)
    if (next === "pick") {
      this.coachSuggest = suggestedBuilding(Object.keys(this.map.landmarks).filter((id) => !!cardById(id)), COACH_FIRST)
      if (this.coachSuggest) {
        this.map.setState(this.coachSuggest, "lit")
        this.map.drawArcToLandmark(this.coachSuggest, this.map.colors.lit) // cleared by resetLights on the first pick
        this.map.setPointer(this.coachSuggest) // bouncing arrow, also cleared by resetLights
      }
      this.coachAimNow = "none"
      this.coachAimOther = ""
      const target = cardById(this.coachSuggest)
      this.say(coachLine("pick", target ? target.label : ""), `Step 1: select ${target ? target.label : "the gold building"}`)
      return
    }
    if (next === "done") this.coachDoneAt = getTime()
    this.setStatus(this.caption)
  }

  /** "demo" / "show me how": run the coach again (from the pick step once the map is open). */
  private restartCoach() {
    this.coachStep = "start"
    if (this.mode === "calibrate") return this.setStatus(this.calibrateInstruction())
    this.guide.stopSpeaking()
    this.hideExtras()
    this.resetLights()
    this.focus = ""
    this.coachEvent("mapOpened")
  }

  /** The closing tip fades after a few seconds. */
  private updateCoach() {
    if (this.coachStep !== "done" || getTime() - this.coachDoneAt < DONE_HOLD_SEC) return
    this.coachStep = "off"
    this.setStatus(this.caption)
  }

  // -------------------------------------------------------------------------
  // Locked judge demo (Core/DemoScript): Main Quad, Huang, one question. Only the scripted action works at each step.

  /** True once the demo is running and the map is open (calibrate still takes any pinch to open it). */
  private demoActive(): boolean {
    return this.demo.step !== "off" && this.mode === "tour"
  }

  private demoLabel(): string {
    const id = demoStopId(this.demo)
    const c = id ? cardById(id) : null
    return c ? c.label : ""
  }

  /** Aim step: only the stop's building can light up, tested against its footprint alone (so the Quad's neighbours,
   * like Memorial Church on its south side, can never steal the pick). Other steps: nothing on the map lights. */
  private updateDemoAim() {
    this.hover = newHoverState()
    const target = demoPickTarget(this.demo)
    const onTarget = !!target && !this.rayOnDemoUi() && this.cursorLandmark(target, this.pickSlackCm * 1.5) === target
    this.map.setHover(onTarget ? target : "")
    if (onTarget === this.demoAimOn) return
    this.demoAimOn = onTarget
    this.setStatus(this.caption)
  }

  private rayOnDemoUi(): boolean {
    return (!!this.infoPanel && this.infoPanel.rayOnCard()) || (!!this.chat && this.chat.rayOnWindow())
  }

  private demoPinch(which: "left" | "right") {
    const now = getTime()
    if (this.lastSelectAt >= 0 && now - this.lastSelectAt < 0.35) return // bounce
    this.lastSelectAt = now
    this.rightDownAt = -1
    const step = this.demo.step
    if (which !== "right") return this.demoNudge()
    const btn: PanelButton = this.infoPanel ? this.infoPanel.buttonUnderRay() : ""
    if (btn) playSfx("click")
    else if (step === "cards" && this.infoPanel && this.infoPanel.rayOnCard()) playSfx("click")
    if (step === "ask") {
      if (btn === "ask") return this.startAsk()
      return this.demoNudge()
    }
    if (btn === "ask") {
      // Ask is on every card, but in the demo it comes last.
      if (!this.guide.isSpeaking()) this.guide.speakParts([DEMO_ASK_LATER_LINE])
      return this.setStatus(this.caption)
    }
    if (step === "aim") {
      const target = demoPickTarget(this.demo)
      if (target && this.cursorLandmark(target, this.pickSlackCm * 1.5) === target) return this.demoEvent("picked")
      return this.demoNudge()
    }
    if (step === "cards") {
      if (this.infoPanel && this.infoPanel.rayOnCard()) return this.demoEvent("cardPinch")
      return this.demoNudge()
    }
  }

  private demoNudge() {
    const line = demoNudgeLine(this.demo, this.demoLabel())
    if (line && !this.guide.isSpeaking()) this.guide.speakParts([line])
    this.setStatus(this.caption)
  }

  private demoEvent(ev: DemoEvent) {
    const before = this.demo
    const next = demoNext(before, ev)
    if (next === before) return
    this.demo = next
    print(`[Retrospecs] demo: ${next.step} stop ${next.stop} card ${next.card}`)
    this.enterDemoStep()
  }

  private enterDemoStep() {
    const s = this.demo
    const id = demoStopId(s)
    const card = id ? cardById(id) : null
    const label = card ? card.label : ""
    if (this.infoPanel) this.infoPanel.setPulse("")
    if (s.step === "aim") {
      this.guide.stopSpeaking()
      if (this.chat && this.chat.isOpen()) this.chat.hide()
      this.hideExtras()
      this.resetLights()
      this.focus = ""
      this.demoAimOn = false
      if (id) {
        this.map.setState(id, "lit")
        this.map.drawArcToLandmark(id, this.map.colors.lit) // cleared by resetLights on the pick
        this.map.setPointer(id) // bouncing arrow, also cleared by resetLights
      }
      this.say(demoLine(s, label), label)
      return
    }
    if (s.step === "cards") {
      const seg = demoSegment(s)
      if (!id || seg < 0) return
      this.guide.stopSpeaking()
      this.segAt[id] = seg
      this.tellAbout(id)
      this.setStatus(label)
      if (this.infoPanel) this.infoPanel.setPulse(demoIsLastCard(s) && demoHasNextStop(s) ? "next" : "more")
      return
    }
    if (s.step === "ask") {
      this.demoAskedAt = -1
      this.demoHeardAnswer = false
      this.say(demoLine(s, label), label)
      if (this.infoPanel) this.infoPanel.setPulse("ask")
      return
    }
    if (s.step === "end") this.endDemo(demoLine(s, label), demoHint(s, label))
  }

  /** The guided part is over (finished or skipped): everything unlocks. */
  private endDemo(line: string, caption: string) {
    this.demo = {step: "off", stop: 0, card: 0}
    this.demoSkipTip = ""
    this.demoAimOn = false
    if (this.infoPanel) this.infoPanel.setPulse("")
    print("[Retrospecs] demo: free roam")
    this.say(line, caption)
  }

  /** Both pinches held DEMO_SKIP_HOLD_SEC: skip the guided demo (opening the map first if needed). */
  private skipDemo() {
    this.guide.stopSpeaking()
    if (this.chat && this.chat.isOpen()) this.chat.hide()
    this.demo = {step: "off", stop: 0, card: 0}
    if (this.mode === "calibrate") this.finishCalibration(this.viewHorizontal())
    else {
      this.hideExtras()
      this.resetLights()
      this.focus = ""
    }
    this.endDemo("Guided demo skipped. Point at any building and pinch.", "Free roam  ·  Point at a building and pinch  ·  Pinch Ask on a card to ask")
  }

  /** "restart demo": the guided path again from the Main Quad, for the next judge. */
  private restartDemo() {
    this.demoSkipFrom = -1
    this.demoSkipTip = ""
    for (const id of Object.keys(this.segAt)) this.segAt[id] = 0
    this.tourShown = []
    if (this.mode === "calibrate") {
      this.demo = demoStart()
      this.setStatus(this.calibrateInstruction())
      this.guide.speakParts([demoLine(this.demo, "")])
      return
    }
    this.demo = {step: "aim", stop: 0, card: 0}
    print("[Retrospecs] demo: restarted")
    this.enterDemoStep()
  }

  /** Watches for the both-pinch hold that skips the guided demo, with a countdown tip once it's clearly deliberate. */
  private updateDemoSkip() {
    if (this.demo.step === "off") {
      this.demoSkipFrom = -1
      return
    }
    let both = false
    try {
      const l = SIK.HandInputData.getHand("left")
      const r = SIK.HandInputData.getHand("right")
      both = !!l && !!r && l.isTracked() && r.isTracked() && l.isPinching() && r.isPinching()
    } catch (e) {
      both = false
    }
    const now = getTime()
    if (!both) {
      this.demoSkipFrom = -1
      if (this.demoSkipTip) {
        this.demoSkipTip = ""
        this.setStatus(this.caption)
      }
      return
    }
    if (this.demoSkipFrom < 0) this.demoSkipFrom = now
    const held = now - this.demoSkipFrom
    if (held >= DEMO_SKIP_HOLD_SEC) {
      this.demoSkipFrom = -1
      this.demoSkipTip = ""
      return this.skipDemo()
    }
    const tip = demoSkipHint(held)
    if (tip !== this.demoSkipTip) {
      this.demoSkipTip = tip
      this.setStatus(this.caption)
    }
  }

  /** Demo voice: only "restart demo" / "start over" (presenter) and, in the ask step, the judge's question. */
  private demoUtterance(raw: string, t: string) {
    if (this.demo.step !== "ask") return this.demoNudge()
    this.demoMarkAsked()
    if (isAskFurtherIntent(t)) return this.askLive(stripAskFurtherCommand(raw))
    this.askGuide(raw)
  }

  private demoMarkAsked() {
    this.demoAskedAt = getTime()
    this.demoHeardAnswer = false
  }

  /** Ask step: move on once the answer has been spoken, or after the timeout (venue Wi-Fi fails sometimes). */
  private updateDemo() {
    if (this.demo.step !== "ask" || this.demoAskedAt < 0) return
    const speaking = this.guide.isSpeaking()
    if (speaking) this.demoHeardAnswer = true
    const since = getTime() - this.demoAskedAt
    if ((this.demoHeardAnswer && !speaking && since > 1) || since > DEMO_ASK_TIMEOUT_SEC) {
      this.demoAskedAt = -1
      this.demoEvent("answered")
    }
  }

  private makeStatusLabel() {
    if (!this.showStatusLabel || !this.map.labelPrefab) return
    this.statusHolder = global.scene.createSceneObject("RetrospecsStatus")
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
    const target = new vec3(cam.x + f.x * 95, cam.y - 42, cam.z + f.z * 95)
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
      print("[Retrospecs] could not load progress: " + e)
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

/**
 * Retrospecs building locator: "which real building am I looking at, and where is it in world space?"
 *
 *  - Position: Spectacles GPS (LocationService, Navigation accuracy, polled about once a second), snapped to a
 *    surveyed spot when close (Core/Locate.ts SPOTS). Poor accuracy (indoor / table mode), a stale fix or a forced
 *    indoor spot keeps the fixed survey position, and the log says so.
 *  - Heading: the camera's gaze, converted to a compass bearing through the calibrated `map.worldRoot` frame.
 *    Before calibration, the north-aligned compass is used instead, if it is available.
 *  - identify(): camera frame + view-cone candidates -> Gemini (enum-constrained schema) -> validated id.
 *    World position = GPS bearing/distance to the building's footprint, laid out in the worldRoot frame from the
 *    capture-time camera position; refined by the Depth Cache point at Gemini's pixel when that agrees with GPS.
 *    After `timeoutSec` (or a "none" / invalid reply) it falls back to the top-ranked candidate if it is within
 *    `fallbackMaxOffsetDeg` of the gaze ("gps-cone", estimated).
 *
 * Results: identify() resolves with a LocateResult (or null) and `onLocated` fires for every non-null result.
 * Log lines start with [Retrospecs].
 */
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {GeminiTypes} from "RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DepthCache} from "../../Scripts/DepthCache"
import {EN, bearingDeg, bearingToMapDir, distanceM, latLonToEN, mapYawFor, norm360} from "../Core/Geo"
import {
  Candidate, GpsFix, IDENTIFY_SYSTEM_PROMPT, WearerPosition, acceptDepth, aimAlongBearing, buildIdentifyPrompt,
  chooseWearerPosition, fallbackCandidate, identifySchema, parseIdentifyReply, viewConeCandidates
} from "../Core/Locate"
import {RetrospecsMap} from "./RetrospecsMap"

export type LocateSource = "gemini" | "gemini+depth" | "gps-cone"

export interface LocateResult {
  /** LANDMARKS / Cards id for landmarks (use with map.setState, cardById), else "b<BUILDINGS index>". */
  id: string
  name: string
  landmark: boolean
  /** Lens world position (cm) of the anchor point on the real building, at floor height. */
  worldPos: vec3
  /** Same ray as worldPos, clamped to `displayMaxCm` from the wearer (for content that must stay in the far clip). */
  displayPos: vec3
  /** Metres from the wearer to the anchor point (depth distance when source is gemini+depth). */
  distanceM: number
  /** Compass bearing from the wearer to the anchor point. */
  bearingDeg: number
  /** Anchor point in local metres (east, north): map frame via map.mapPosOf(en). */
  en: EN
  heightM: number
  source: LocateSource
  confidence: number
  /** True for the gps-cone fallback. */
  estimated: boolean
  wearer: WearerPosition
}

@component
export class RetrospecsLocator extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Retrospecs Locator</span><br/><span style="color: #94A3B8; font-size: 11px;">GPS + Gemini vision: which real building is in view, and where.</span>')
  @input camera: SceneObject
  @input @allowUndefined @hint("Its worldRoot (set at calibration) defines the compass frame") map: RetrospecsMap
  @input @allowUndefined @hint("The sample's DepthCache: camera frames + depth refinement") depthCache: DepthCache
  @input @allowUndefined @hint("Only used when no DepthCache is set: requests the left color camera itself") camModule: CameraModule

  @ui.group_start("Position")
  @input @hint("Fallback position (indoor / table mode / no fix). Default: Huang.") surveyLat: number = 37.427884
  @input surveyLon: number = -122.17433
  @input @hint("Force a spot id from Core/Locate.ts SPOTS (e.g. huang-table). Empty = auto from GPS.") spotId: string = ""
  @input @hint("Worse GPS accuracy than this (m) = indoor/table mode") maxAccuracyM: number = 25
  @input @hint("Ignore fixes older than this (s)") maxFixAgeS: number = 15
  @input gpsPollSec: number = 1
  @input enableGps: boolean = true
  @ui.group_end

  @ui.group_start("Identify")
  @input model: string = "gemini-2.5-flash"
  @input @hint("Gemini thinking budget; 0 = off (fastest). -1 = don't send the field.") thinkingBudget: number = 0
  @input timeoutSec: number = 6
  @input halfAngleDeg: number = 30
  @input maxDistM: number = 700
  @input @hint("Max candidates sent to Gemini (in-cone landmarks are always kept)") maxCandidates: number = 8
  @input @hint("Skip footprints nearer than this (m); the building you stand in is always skipped") minDistM: number = 5
  @input fallbackMaxOffsetDeg: number = 10
  @input @hint("Clamp for displayPos (cm)") displayMaxCm: number = 900
  @input @hint("Depth points nearer than this (m) count as 'no depth'") depthMinM: number = 2
  @ui.group_end

  onLocated = new Event<LocateResult>()

  /** Latest GPS fix (null until the first one). */
  latestFix: GpsFix | null = null
  latestFixSource = ""
  /** North-aligned heading in degrees from LocationService, or null if never reported. */
  compassHeadingDeg: number | null = null
  busy = false

  private survey: EN = {e: 0, n: 0}
  private locationService: LocationService = null
  private gpsPending = false
  private gpsPendingSince = 0
  private lastWearerSource = ""
  private ownCamTexture: Texture = null
  private colorCam: DeviceCamera = null

  onAwake() {
    this.survey = latLonToEN(this.surveyLat, this.surveyLon)
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart() {
    try {
      this.colorCam = global.deviceInfoSystem.getTrackingCameraForId(CameraModule.CameraId.Left_Color)
    } catch (e) {
      this.colorCam = null
    }
    if (!this.depthCache && this.camModule) this.startOwnCamera()
    if (this.enableGps) this.startGps()
  }

  // -------------------------------------------------------------------------
  // GPS and compass

  private startGps() {
    try {
      // Spectacles location docs: the Lens must declare RawLocationModule (not in the local d.ts; guarded).
      require("LensStudio:RawLocationModule")
    } catch (e) {
      print("[Retrospecs] locator: RawLocationModule require failed (" + e + "); trying LocationService anyway")
    }
    try {
      this.locationService = GeoLocation.createLocationService()
      this.locationService.accuracy = GeoLocationAccuracy.Navigation
      this.locationService.onNorthAlignedOrientationUpdate.add((q: quat) => {
        this.compassHeadingDeg = norm360(GeoLocation.getNorthAlignedHeading(q))
      })
    } catch (e) {
      print("[Retrospecs] locator: location service unavailable (" + e + "); using survey position")
      this.locationService = null
      return
    }
    const poll = this.createEvent("DelayedCallbackEvent")
    poll.bind(() => {
      this.pollGps()
      poll.reset(Math.max(0.2, this.gpsPollSec))
    })
    poll.reset(0)
  }

  private pollGps() {
    if (!this.locationService) return
    if (this.gpsPending && getTime() - this.gpsPendingSince < 10) return
    this.gpsPending = true
    this.gpsPendingSince = getTime()
    this.locationService.getCurrentPosition(
      (p: GeoPosition) => {
        this.gpsPending = false
        const t = p.timestamp ? p.timestamp.getTime() : NaN
        this.latestFix = {lat: p.latitude, lon: p.longitude, accuracyM: p.horizontalAccuracy, timestampMs: isFinite(t) ? t : Date.now(), receivedMs: Date.now()}
        this.latestFixSource = p.locationSource
        this.logWearerChange()
      },
      (err: string) => {
        this.gpsPending = false
        print("[Retrospecs] locator: GPS error: " + err)
      }
    )
  }

  private logWearerChange() {
    const w = this.wearer()
    const key = w.source + ":" + w.spotId
    if (key === this.lastWearerSource) return
    this.lastWearerSource = key
    print("[Retrospecs] locator position: " + w.reason + (this.latestFixSource ? ` [${this.latestFixSource}]` : ""))
  }

  /** Where the wearer is, per GPS / spot / survey rules. */
  wearer(): WearerPosition {
    return chooseWearerPosition(this.latestFix, this.survey, {
      maxAccuracyM: this.maxAccuracyM, maxAgeS: this.maxFixAgeS, nowMs: Date.now(), forcedSpotId: this.spotId
    })
  }

  /** The controller's survey position (local metres), used whenever GPS isn't trusted. */
  setSurvey(en: EN) {
    this.survey = {e: en.e, n: en.n}
  }

  /** Compass bearing of the current gaze, from the calibrated frame (or the compass if uncalibrated). */
  gazeBearing(): number | null {
    const q = this.frameRotation()
    return q ? this.bearingOfWorldDir(q, this.forward()) : null
  }

  /**
   * Compass heading minus calibrated gaze bearing (deg, signed). A coarse cross-check of the wall calibration;
   * null if either is missing. Note: whether the compass is true or magnetic north is unverified (~13° at Stanford).
   */
  compassCheck(): number | null {
    if (this.compassHeadingDeg == null || !this.map || !this.map.worldRoot) return null
    const cal = this.bearingOfWorldDir(this.map.worldRoot.getTransform().getWorldRotation(), this.forward())
    let d = norm360(this.compassHeadingDeg - cal)
    if (d > 180) d -= 360
    return d
  }

  // -------------------------------------------------------------------------
  // Identify

  identify(): Promise<LocateResult | null> {
    if (this.busy) {
      print("[Retrospecs] locator: identify already running")
      return Promise.resolve(null)
    }
    const wearer = this.wearer()
    print("[Retrospecs] locator position: " + wearer.reason)
    const q = this.frameRotation()
    if (!q) {
      print("[Retrospecs] locator: not calibrated and no compass heading yet; calibrate first")
      return Promise.resolve(null)
    }
    if (!this.map || !this.map.worldRoot) print("[Retrospecs] locator: not calibrated, using the compass as the frame (coarse)")
    const camT = this.camera.getTransform()
    const capture = {pos: camT.getWorldPosition(), xf: camT.getWorldTransform(), rot: q, floorY: this.floorY()}
    const heading = this.bearingOfWorldDir(q, this.forward())
    const cands = viewConeCandidates(wearer.en, heading, {halfAngleDeg: this.halfAngleDeg, maxDistM: this.maxDistM, minDistM: this.minDistM, limit: this.maxCandidates})
    if (!cands.length) {
      print(`[Retrospecs] locator: no buildings within ${this.halfAngleDeg}° of bearing ${Math.round(heading)}°`)
      return Promise.resolve(null)
    }
    print(`[Retrospecs] locator: gaze ${Math.round(heading)}°, candidates: ` + cands.map((c) => `${c.id} ${Math.round(c.offsetDeg)}°/${Math.round(c.distanceM)}m`).join(", "))

    this.busy = true
    const started = getTime()
    let depthId = -1
    let frame: Texture = null
    try {
      if (this.depthCache) {
        depthId = this.depthCache.saveDepthFrame()
        frame = this.depthCache.getCamImageWithID(depthId)
      } else if (this.ownCamTexture) {
        frame = this.ownCamTexture.copyFrame()
      }
    } catch (e) {
      print("[Retrospecs] locator: no camera frame yet (" + e + ")")
      frame = null
    }

    return new Promise<LocateResult | null>((resolve) => {
      let settled = false
      const settle = (r: LocateResult | null) => {
        if (settled) return
        settled = true
        this.busy = false
        if (depthId >= 0 && this.depthCache) this.depthCache.disposeDepthFrame(depthId)
        if (r) {
          print(`[Retrospecs] located ${r.name} (${r.id}) via ${r.source}${r.estimated ? " (estimated)" : ""}: ${Math.round(r.distanceM)} m at ${Math.round(r.bearingDeg)}°, confidence ${r.confidence.toFixed(2)}, ${(getTime() - started).toFixed(2)} s`)
          this.onLocated.invoke(r)
        }
        resolve(r)
      }
      const fallback = (why: string) => {
        if (settled) return
        const fb = fallbackCandidate(cands, this.fallbackMaxOffsetDeg)
        if (!fb) {
          print(`[Retrospecs] locator: ${why}; nothing within ${this.fallbackMaxOffsetDeg}° of gaze`)
          return settle(null)
        }
        print(`[Retrospecs] locator: ${why}; estimating from the GPS cone`)
        const conf = Math.max(0.05, 0.5 * (1 - fb.offsetDeg / Math.max(1, this.fallbackMaxOffsetDeg)))
        settle(this.resultFor(fb, fb.aim, wearer, capture, "gps-cone", conf, true))
      }

      const timer = this.createEvent("DelayedCallbackEvent")
      timer.bind(() => fallback(`Gemini timed out after ${this.timeoutSec} s`))
      timer.reset(this.timeoutSec)

      if (!frame) return fallback("no camera frame")
      Base64.encodeTextureAsync(
        frame,
        (b64: string) => {
          if (settled) return
          this.askGemini(b64, cands, heading)
            .then((reply) => {
              if (settled) return print("[Retrospecs] locator: late Gemini reply ignored")
              const v = parseIdentifyReply(reply, cands.map((c) => c.id))
              if (v.ok === false) return fallback("Gemini reply rejected: " + (v as {reason: string}).reason)
              if (v.buildingId === "none") return fallback(`Gemini saw none of the candidates (confidence ${v.confidence})`)
              const c = cands.find((x) => x.id === v.buildingId)
              settle(this.resolveGemini(c, v.confidence, v.pixel, frame, depthId, wearer, capture))
            })
            .catch((e) => fallback("Gemini failed: " + e))
        },
        () => fallback("image encoding failed"),
        CompressionQuality.IntermediateQuality,
        EncodingType.Jpg
      )
    })
  }

  private askGemini(b64: string, cands: Candidate[], heading: number): Promise<any> {
    const generationConfig: any = {
      temperature: 0.1,
      responseMimeType: "application/json",
      response_schema: identifySchema(cands.map((c) => c.id))
    }
    // Unverified through the gateway: Gemini 2.5's thinking budget. Set thinkingBudget = -1 to omit.
    if (this.thinkingBudget >= 0) generationConfig.thinkingConfig = {thinkingBudget: this.thinkingBudget}
    const req: GeminiTypes.Models.GenerateContentRequest = {
      model: this.model,
      type: "generateContent",
      body: {
        contents: [{role: "user", parts: [{inlineData: {mimeType: "image/jpeg", data: b64}}, {text: buildIdentifyPrompt(cands, heading)}]}],
        systemInstruction: {parts: [{text: IDENTIFY_SYSTEM_PROMPT}]},
        generationConfig
      }
    }
    return Gemini.models(req).then((response: any) => response.candidates[0].content.parts[0].text as string)
  }

  private resolveGemini(
    c: Candidate, confidence: number, pixel: {x: number; y: number} | null, frame: Texture, depthId: number,
    wearer: WearerPosition, capture: Capture
  ): LocateResult {
    let aim = c.aim
    if (pixel && this.colorCam) {
      try {
        // Pixel -> device-reference point (DeviceCamera.unproject) -> world via the capture-time camera transform.
        const devRef = this.colorCam.unproject(new vec2(pixel.x / 1000, pixel.y / 1000), 100)
        const w = capture.xf.multiplyPoint(devRef)
        const pixBearing = this.bearingOfWorldDir(capture.rot, w.sub(capture.pos))
        aim = aimAlongBearing(wearer.en, c, pixBearing)
      } catch (e) {
        print("[Retrospecs] locator: pixel ray failed (" + e + ")")
      }
    }
    const base = this.resultFor(c, aim, wearer, capture, "gemini", confidence, false)
    if (!pixel || !this.depthCache || depthId < 0) return base
    try {
      const px = new vec2((pixel.x / 1000) * frame.getWidth(), (pixel.y / 1000) * frame.getHeight())
      const p = this.depthCache.getWorldPositionWithID(px, depthId)
      if (!p) return base
      const horizM = Math.hypot(p.x - capture.pos.x, p.z - capture.pos.z) / 100
      const check = acceptDepth(horizM, base.distanceM, this.depthMinM)
      print("[Retrospecs] locator depth: " + check.reason)
      if (!check.ok) return base
      const worldPos = new vec3(p.x, capture.floorY, p.z)
      return {...base, worldPos, displayPos: this.clampDisplay(capture, worldPos), distanceM: horizM, source: "gemini+depth"}
    } catch (e) {
      print("[Retrospecs] locator: depth lookup failed (" + e + ")")
      return base
    }
  }

  private resultFor(c: Candidate, aim: EN, wearer: WearerPosition, capture: Capture, source: LocateSource, confidence: number, estimated: boolean): LocateResult {
    const b = bearingDeg(wearer.en, aim)
    const d = distanceM(wearer.en, aim)
    const md = bearingToMapDir(b)
    const dir = capture.rot.multiplyVec3(new vec3(md.x, 0, md.z))
    const worldPos = new vec3(capture.pos.x, capture.floorY, capture.pos.z).add(dir.uniformScale(d * 100))
    return {
      id: c.id, name: c.name, landmark: c.landmark, worldPos, displayPos: this.clampDisplay(capture, worldPos),
      distanceM: d, bearingDeg: b, en: aim, heightM: c.heightM, source, confidence, estimated, wearer
    }
  }

  private clampDisplay(capture: Capture, worldPos: vec3): vec3 {
    const base = new vec3(capture.pos.x, capture.floorY, capture.pos.z)
    const off = worldPos.sub(base)
    const len = Math.hypot(off.x, off.z)
    if (len <= this.displayMaxCm || len === 0) return worldPos
    const k = this.displayMaxCm / len
    return new vec3(base.x + off.x * k, capture.floorY, base.z + off.z * k)
  }

  // -------------------------------------------------------------------------
  // Frames

  /** Rotation q such that q * bearingToMapDir(b) is the world direction of compass bearing b. */
  private frameRotation(): quat | null {
    if (this.map && this.map.worldRoot) return this.map.worldRoot.getTransform().getWorldRotation()
    if (this.compassHeadingDeg == null) return null
    const f = this.forward()
    return quat.angleAxis(mapYawFor({x: f.x, y: 0, z: f.z}, this.compassHeadingDeg), vec3.up())
  }

  private bearingOfWorldDir(q: quat, dir: vec3): number {
    const local = q.invert().multiplyVec3(dir)
    return norm360((Math.atan2(local.x, -local.z) * 180) / Math.PI)
  }

  /** Horizontal camera forward (world). */
  private forward(): vec3 {
    const v = vec3.up().cross(this.camera.getTransform().right).normalize()
    return new vec3(v.x, 0, v.z)
  }

  private floorY(): number {
    if (this.map && this.map.worldRoot) return this.map.worldRoot.getTransform().getWorldPosition().y
    return this.camera.getTransform().getWorldPosition().y - 160
  }

  private startOwnCamera() {
    try {
      const req = CameraModule.createCameraRequest()
      req.cameraId = CameraModule.CameraId.Left_Color
      this.ownCamTexture = this.camModule.requestCamera(req)
    } catch (e) {
      print("[Retrospecs] locator: camera unavailable (" + e + ")")
    }
  }
}

interface Capture {
  pos: vec3
  xf: mat4
  rot: quat
  floorY: number
}


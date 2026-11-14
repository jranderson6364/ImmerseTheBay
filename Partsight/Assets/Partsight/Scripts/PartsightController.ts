/**
 * Partsight main controller.
 *
 * scan():  camera frame + depth -> Gemini parts spec -> validate -> (Verified hero swap) -> measure real size
 *          from the object's bounding box + depth -> place the diagram on the real object.
 * Two-hand pinch: pull hands apart to explode, twist to rotate. Pinch a part to hear what it does.
 * Voice: "explode", "collapse", "explode more", "zoom in/out", "rotate", "how does it work", "scan",
 *        or any question (answered only from the spec).
 *
 * In the Lens Studio Preview there is no camera/depth on most setups: scan() falls back to cycling the
 * Verified hero specs 45 cm in front of the camera so the renderer can be developed without a device.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {DepthCache} from "../../Scripts/DepthCache"
import {ASRController} from "../../Scripts/ASRController"
import {PartsightGemini} from "./PartsightGemini"
import {PartsightRenderer} from "./PartsightRenderer"
import {PartSpecPart, PartsSpec, applyMeasuredLength, badgeText, scaleLabel, validateSpec} from "../Core/PartSpec"
import {findHeroSpec, heroCount, heroSpecByIndex} from "../Core/HeroSpecs"

/** Fraction of the bbox trimmed from each end when sampling depth, so samples land on the object, not behind it. */
const INSET = 0.15

@component
export class PartsightController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Partsight Controller</span>')
  @input camera: SceneObject
  @input depthCache: DepthCache
  @input gemini: PartsightGemini
  @input renderer: PartsightRenderer
  @input @allowUndefined asr: ASRController

  @ui.group_start("UI (optional)")
  @input @allowUndefined statusText: Text
  @input @allowUndefined badgeLabel: Text
  @input @allowUndefined infoText: Text
  @input @allowUndefined scanButton: Interactable
  @input @allowUndefined askButton: Interactable
  @input @allowUndefined explodeButton: Interactable
  @input @allowUndefined stepButton: Interactable
  @input @allowUndefined heroButton: Interactable
  @ui.group_end

  @ui.group_start("Behaviour")
  @input twoHandExplode: boolean = true
  @input @hint("Hand separation change (cm) that goes from assembled to fully exploded") explodeRangeCm: number = 25
  @input autoExplodeAfterScan: boolean = false
  @input speakResponses: boolean = true
  @input ttsVoice: string = "coral"
  @input @hint("Optional hint sent with each scan, e.g. 'Focus on the object in my hand.'") scanHint: string = ""
  @ui.group_end

  private busy = false
  private heroIndex = 0
  private stepIndex = 0
  private selectedPart: PartSpecPart = null
  private audio: AudioComponent = null
  private twoHand: {startDist: number; startT: number; lastYaw: number} = null
  private isEditor = global.deviceInfoSystem.isEditor()

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart() {
    this.renderer.onPartSelected = (p) => this.onPartSelected(p)
    this.bindButton(this.scanButton, () => this.scan())
    this.bindButton(this.askButton, () => this.listen())
    this.bindButton(this.explodeButton, () => this.toggleExplode())
    this.bindButton(this.stepButton, () => this.nextStep())
    this.bindButton(this.heroButton, () => this.loadNextHero())
    if (this.asr) {
      this.asr.onFinalVoiceEvent.add((t) => this.handleUtterance(t))
      this.asr.onPartialVoiceEvent.add((t) => this.setStatus("“" + t + "”"))
      this.asr.onErrorEvent.add((e) => this.setStatus("Voice error: " + e))
    }
    if (this.isEditor) {
      // Tap in Preview = scan (falls back to hero specs when there is no camera image).
      this.createEvent("TapEvent").bind(() => this.scan())
    }
    this.setStatus("Hold an object and press Scan.")
  }

  // -------------------------------------------------------------------------
  // Scan

  scan() {
    if (this.busy) return
    const depthId = this.depthCache.saveDepthFrame()
    let image = depthId >= 0 ? this.depthCache.getCamImageWithID(depthId) : null
    if (image == null) image = this.depthCache.getLatestCamImage()
    if (image == null) {
      if (this.isEditor) {
        this.setStatus("Preview: no camera image, showing a Verified example.")
        this.loadNextHero()
      } else {
        this.setStatus("Camera not ready yet, try again in a moment.")
      }
      return
    }
    this.busy = true
    this.renderer.clear()
    this.setStatus("Scanning…")
    this.setInfo("")
    const w = image.getWidth()
    const h = image.getHeight()
    this.gemini
      .requestSpec(image, this.scanHint)
      .then((raw) => {
        const {spec, warnings} = validateSpec(raw)
        if (warnings.length) print("[Partsight] validator: " + warnings.join("; "))
        let finalSpec = spec
        if (spec.design_label !== "exterior_only") {
          const hero = findHeroSpec(spec.object_name)
          if (hero) {
            hero.bbox_2d = spec.bbox_2d
            finalSpec = hero
          }
        }
        const m = depthId >= 0 ? this.measure(finalSpec.bbox_2d, w, h, depthId) : null
        if (m && m.lengthMm > 0) {
          const r = applyMeasuredLength(finalSpec, m.lengthMm)
          if (r.applied) finalSpec = r.spec
          else print(`[Partsight] measurement ${m.lengthMm.toFixed(0)} mm rejected (x${r.factor.toFixed(2)})`)
        }
        this.show(finalSpec, m ? m.center : null, m ? m.longDir : null)
      })
      .catch((err) => {
        print("[Partsight] scan failed: " + err)
        this.setStatus("Couldn't read that. Try again, or say 'show example'.")
      })
      .then(() => {
        this.busy = false
        if (depthId >= 0) this.depthCache.disposeDepthFrame(depthId)
      })
  }

  /** Real length from bbox + depth: sample points inset from each end so they hit the object's surface. */
  private measure(bbox: number[], w: number, h: number, depthId: number): {center: vec3; longDir: vec3; lengthMm: number} {
    const [ymin, xmin, ymax, xmax] = bbox
    const px = (x: number, y: number) => new vec2((x / 1000) * w, (y / 1000) * h)
    const cx = (xmin + xmax) / 2
    const cy = (ymin + ymax) / 2
    const spanX = xmax - xmin
    const spanY = ymax - ymin
    const world = (p: vec2) => this.depthCache.getWorldPositionWithID(p, depthId)
    const center = world(px(cx, cy))
    const horizontal = spanX * w >= spanY * h
    const a = horizontal ? world(px(xmin + spanX * INSET, cy)) : world(px(cx, ymin + spanY * INSET))
    const b = horizontal ? world(px(xmax - spanX * INSET, cy)) : world(px(cx, ymax - spanY * INSET))
    if (!center && !(a && b)) return null
    const mid = center || a.add(b).uniformScale(0.5)
    if (!a || !b) return {center: mid, longDir: null, lengthMm: 0}
    const d = b.sub(a)
    const lengthCm = d.length / (1 - 2 * INSET)
    return {center: mid, longDir: d.length > 0.01 ? d.normalize() : null, lengthMm: lengthCm * 10}
  }

  private show(spec: PartsSpec, center: vec3, longDir: vec3) {
    const camT = this.camera.getTransform()
    const camPos = camT.getWorldPosition()
    const view = vec3.up().cross(camT.right).normalize() // horizontal view direction
    const pos = center || camPos.add(view.uniformScale(45)).add(new vec3(0, -8, 0))
    const rot = this.orientation(spec, pos, longDir)
    this.renderer.build(spec, pos, rot)
    this.stepIndex = 0
    this.selectedPart = null
    if (this.autoExplodeAfterScan) this.renderer.setExplode(1)
    this.setBadge(`${badgeText(spec)}\n${scaleLabel(spec)}`)
    this.setStatus(spec.object_name)
    const hint = spec.design_label === "exterior_only" ? spec.safety_note : spec.summary
    this.setInfo(hint + (spec.parts.length > 1 ? "\nPull your hands apart to explode it." : ""))
    this.speak(spec.design_label === "exterior_only" ? spec.safety_note : `${spec.object_name}. ${spec.summary}`)
  }

  /** Aligns the spec's long axis with the measured object direction, then turns its +Z toward the wearer. */
  private orientation(spec: PartsSpec, pos: vec3, longDir: vec3): quat {
    const camT = this.camera.getTransform()
    const toCam = camT.getWorldPosition().sub(pos).normalize()
    const o = spec.overall_mm
    const localLong = o.x >= o.y && o.x >= o.z ? new vec3(1, 0, 0) : o.y >= o.z ? new vec3(0, 1, 0) : new vec3(0, 0, 1)
    let target: vec3
    if (longDir) {
      target = longDir
      const vertical = Math.abs(longDir.dot(vec3.up())) > 0.7
      if ((vertical && longDir.dot(vec3.up()) < 0) || (!vertical && longDir.dot(camT.right) < 0)) target = longDir.uniformScale(-1)
    } else {
      target = localLong.y > 0.5 ? vec3.up() : localLong.z > 0.5 ? toCam : camT.right
    }
    const q1 = quat.rotationFromTo(localLong, target)
    // Twist about the long axis so local +Z faces the camera as much as possible.
    const axis = target.normalize()
    const z1 = q1.multiplyVec3(localLong.z > 0.5 ? new vec3(0, 1, 0) : new vec3(0, 0, 1))
    const zWant = toCam.sub(axis.uniformScale(toCam.dot(axis)))
    if (zWant.length < 0.01) return q1
    const zw = zWant.normalize()
    const angle = Math.atan2(axis.dot(z1.cross(zw)), z1.dot(zw))
    return quat.angleAxis(angle, axis).multiply(q1)
  }

  loadNextHero() {
    const spec = heroSpecByIndex(this.heroIndex++ % heroCount())
    this.renderer.clear()
    this.show(spec, null, null)
  }

  // -------------------------------------------------------------------------
  // Interaction

  toggleExplode() {
    this.renderer.setExplode(this.renderer.explodeAmount > 0.5 ? 0 : 1)
  }

  nextStep() {
    const spec = this.renderer.currentSpec
    if (!spec || spec.how_it_works.length === 0) {
      this.setInfo("No how-it-works steps for this one.")
      return
    }
    const step = spec.how_it_works[this.stepIndex % spec.how_it_works.length]
    this.stepIndex++
    if (this.renderer.explodeAmount < 0.3) this.renderer.setExplode(0.6)
    this.renderer.playStep(step)
    this.setInfo(`Step ${((this.stepIndex - 1) % spec.how_it_works.length) + 1}: ${step.text}`)
    this.speak(step.text)
  }

  private onPartSelected(part: PartSpecPart) {
    this.selectedPart = part
    const spec = this.renderer.currentSpec
    const likely = spec && spec.design_label !== "verified" && part.hidden ? " (likely; not visible)" : ""
    this.setInfo(`${part.name}${likely}\n${part.function}`)
    this.speak(`${part.name}. ${part.function}`)
  }

  listen() {
    if (!this.asr) return
    this.setStatus("Listening…")
    this.asr.startListening()
  }

  handleUtterance(raw: string) {
    const t = (raw || "").toLowerCase().trim()
    if (!t) return
    const spec = this.renderer.currentSpec
    if (/\b(scan|what is this|new object|look at this)\b/.test(t)) return this.scan()
    if (/\bshow (me )?(an )?example\b/.test(t)) return this.loadNextHero()
    if (!spec) return this.setStatus("Scan an object first.")
    if (/\bexplode more\b|\bfurther\b/.test(t)) return this.renderer.setExplode(Math.min(2, this.renderer.explodeAmount + 0.5))
    if (/\b(collapse|put it back|assemble|close it)\b/.test(t)) return this.renderer.setExplode(0)
    if (/\b(explode|take it apart|open it up)\b/.test(t)) return this.renderer.setExplode(1)
    if (/\bzoom in\b|\bbigger\b/.test(t)) return this.renderer.setZoom(this.renderer.getZoom() * 1.6)
    if (/\bzoom out\b|\bsmaller\b|\breal size\b/.test(t)) return this.renderer.setZoom(/real size/.test(t) ? 1 : this.renderer.getZoom() / 1.6)
    if (/\b(rotate|turn it)\b/.test(t)) return this.renderer.rotateBy(/\bleft\b/.test(t) ? -45 : 45)
    if (/\b(next step|how does it work|show me how|how it works)\b/.test(t)) return this.nextStep()
    this.askQuestion(raw)
  }

  private askQuestion(question: string) {
    const spec = this.renderer.currentSpec
    this.setStatus("Thinking…")
    this.gemini
      .ask(spec, question, this.selectedPart ? this.selectedPart.id : undefined)
      .then((r) => {
        this.setStatus(spec.object_name)
        this.setInfo(r.answer)
        if (r.part_ids.length) this.renderer.pulse(r.part_ids)
        this.speak(r.answer)
      })
      .catch((e) => {
        print("[Partsight] ask failed: " + e)
        this.setStatus("Couldn't answer that right now.")
      })
  }

  private onUpdate() {
    if (!this.twoHandExplode || !this.renderer.currentSpec) return
    let left, right
    try {
      left = SIK.HandInputData.getHand("left")
      right = SIK.HandInputData.getHand("right")
    } catch (e) {
      return
    }
    const both = left && right && left.isTracked() && right.isTracked() && left.isPinching() && right.isPinching()
    if (!both) {
      this.twoHand = null
      return
    }
    const a = left.indexTip.position
    const b = right.indexTip.position
    const d = b.sub(a)
    const dist = d.length
    const yaw = Math.atan2(d.x, d.z)
    if (!this.twoHand) {
      this.twoHand = {startDist: dist, startT: this.renderer.explodeAmount, lastYaw: yaw}
      return
    }
    this.renderer.setExplode(this.twoHand.startT + (dist - this.twoHand.startDist) / this.explodeRangeCm)
    let dy = yaw - this.twoHand.lastYaw
    if (dy > Math.PI) dy -= 2 * Math.PI
    if (dy < -Math.PI) dy += 2 * Math.PI
    if (Math.abs(dy) < 0.5) this.renderer.rotateBy((-dy * 180) / Math.PI)
    this.twoHand.lastYaw = yaw
  }

  // -------------------------------------------------------------------------
  // Output

  private speak(text: string) {
    if (!this.speakResponses || !text) return
    OpenAI.speech({model: "gpt-4o-mini-tts", input: text, voice: this.ttsVoice as any, instructions: "Friendly, clear, quick museum-guide tone."})
      .then((track) => {
        if (!this.audio) this.audio = this.getSceneObject().createComponent("AudioComponent") as AudioComponent
        if (this.audio.isPlaying()) this.audio.stop(false)
        this.audio.audioTrack = track
        this.audio.play(1)
      })
      .catch((e) => print("[Partsight] TTS failed: " + e))
  }

  private bindButton(i: Interactable, fn: () => void) {
    if (i) i.onTriggerEnd.add(() => fn())
  }

  private setStatus(s: string) {
    if (this.statusText) this.statusText.text = s
    print("[Partsight] " + s)
  }

  private setBadge(s: string) {
    if (this.badgeLabel) this.badgeLabel.text = s
  }

  private setInfo(s: string) {
    if (this.infoText) this.infoText.text = s
  }
}

/**
 * Pocket KO main controller.
 *
 * Round: a Glorp lands on your table -> hold up any object -> Gemini turns it into a move (with an
 * "analyzing your weapon" cooldown) -> physically slam / swing / poke / toss it -> FINAL BLOW triggers a
 * live Orbis KO cinematic (via the laptop relay) seeded from a camera still of your real table.
 *
 * Lens Studio Preview has no hands/camera on most setups: click the Preview to scan (canned moves) and to attack.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {GeminiTypes} from "RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes"
import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {DepthCache} from "../../Scripts/DepthCache"
import {ASRController} from "../../Scripts/ASRController"
import {DEMO_MOVES, GEMINI_MOVE_SCHEMA, GESTURE_HINT, MOVE_SYSTEM_PROMPT, Move, validateMove} from "../Core/Moves"
import {GestureDetector} from "../Core/Gesture"
import {GameEvent, PocketKOGame} from "../Core/Game"
import {Monster} from "./Monster"
import {Fx} from "./Fx"
import {RelayClient} from "./RelayClient"
import {PALETTE, ToonKit, setColor} from "./Toon"

@component
export class PocketKOController extends BaseScriptComponent {
  @ui.label('<span style="color:#FFCC00;">POCKET KO</span><br/><span style="color:#94A3B8;font-size:11px;">Disable the sample SceneController; keep DepthCache, ASRController, SpeechUI.</span>')
  @input camera: SceneObject
  @input depthCache: DepthCache
  @input @allowUndefined asr: ASRController
  @input internetModule: InternetModule
  @input @hint("ws://<laptop-ip>:8765/ws on the same Wi-Fi/hotspot (needs Experimental APIs), or a wss:// tunnel") relayUrl: string = "ws://10.31.163.6:8765/ws"

  @ui.group_start("Look")
  @input meshSphere: RenderMesh
  @input meshBox: RenderMesh
  @input meshCylinder: RenderMesh
  @input @hint("A mesh with UVs for the jumbotron screen (Assets/Mesh/Unit Plane.mesh)") meshPlane: RenderMesh
  @input @hint("Solid material with Base Color (Assets/Materials/White.mat)") toonMaterial: Material
  @input @hint("Unlit texture material with baseTex (Assets/Materials/CaptureTexture.mat)") screenMaterial: Material
  @input textScale: number = 0.5
  @input monsterRadiusCm: number = 7
  @ui.group_end

  @ui.group_start("Behaviour")
  @input geminiModel: string = "gemini-2.5-flash"
  @input speak: boolean = true
  @input ttsVoice: string = "ash"
  @input cinematicSeconds: number = 18
  @input autoScanDelay: number = 2.5
  @ui.group_end

  private kit: ToonKit
  private game: PocketKOGame
  private monster: Monster = null
  private fx: Fx
  private relay: RelayClient
  private detectors = {left: new GestureDetector(), right: new GestureDetector()}
  private world: SceneObject
  private banner: {obj: SceneObject; text: Text}
  private card: {obj: SceneObject; text: Text}
  private hpBg: SceneObject
  private hpFg: {obj: SceneObject; mat: Material}
  private screen: {root: SceneObject; mat: Material; label: {obj: SceneObject; text: Text}}
  private scanBtn: SceneObject
  private audio: AudioComponent = null
  private isEditor = global.deviceInfoSystem.isEditor()
  private tablePoint: vec3 = null
  private scanBusy = false
  private autoScanAt = -1
  private koStartedAt = -1
  private demoIndex = 0
  private editorTaps = 0
  private bannerUntil = 0

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ---------------------------------------------------------------------------
  // Setup

  private onStart() {
    this.kit = new ToonKit({sphere: this.meshSphere, box: this.meshBox, cylinder: this.meshCylinder}, this.toonMaterial)
    this.world = this.kit.empty(this.getSceneObject(), "PocketKOWorld")
    this.fx = new Fx(this.kit, this.world, this.camera, this.textScale)
    this.banner = this.fx.makeText(this.world, "POCKET KO", 56, PALETTE.gold)
    this.card = this.fx.makeText(this.world, "", 36, PALETTE.white)
    this.buildHud()
    this.buildScreen()
    this.relay = new RelayClient(this.internetModule, this.relayUrl)
    this.relay.onFrame = (tex) => this.showFrame(tex)
    this.relay.onState = (s, d) => print(`[PocketKO] relay ${s} ${d}`)
    this.relay.connect()
    if (this.asr) {
      this.asr.onFinalVoiceEvent.add((t) => this.onVoice(t))
      this.asr.onErrorEvent.add(() => this.listenSoon(1.5))
      this.listenSoon(1.0)
    }
    if (this.isEditor) this.createEvent("TapEvent").bind(() => this.onEditorTap())
    // Give depth a moment to start, then drop the monster on the table.
    const d = this.createEvent("DelayedCallbackEvent")
    d.bind(() => this.newRound())
    d.reset(1.2)
  }

  private newRound() {
    if (this.monster) this.monster.root.destroy()
    this.tablePoint = this.findTable()
    this.monster = new Monster(this.kit, this.world, this.tablePoint, this.camera, this.monsterRadiusCm)
    this.game = new PocketKOGame()
    this.game.start(getTime())
    this.koStartedAt = -1
    this.screen.root.enabled = false
    this.placeScanButton()
  }

  /** Table point = depth at the lower-middle of the camera view; fallback 50 cm ahead, 30 cm down. */
  private findTable(): vec3 {
    const id = this.depthCache.saveDepthFrame()
    if (id >= 0) {
      const img = this.depthCache.getCamImageWithID(id)
      if (img) {
        const p = this.depthCache.getWorldPositionWithID(new vec2(img.getWidth() * 0.5, img.getHeight() * 0.7), id)
        this.depthCache.disposeDepthFrame(id)
        const cam = this.camera.getTransform().getWorldPosition()
        if (p && p.distance(cam) > 25 && p.distance(cam) < 150) return p
      }
    }
    const ct = this.camera.getTransform()
    const view = vec3.up().cross(ct.right).normalize()
    return ct.getWorldPosition().add(view.uniformScale(50)).add(new vec3(0, -30, 0))
  }

  private buildHud() {
    this.hpBg = this.kit.part(this.world, "box", PALETTE.black, vec3.zero(), new vec3(20, 1.6, 0.4), "hpBg").obj
    this.hpFg = this.kit.part(this.hpBg, "box", PALETTE.green, vec3.zero(), new vec3(1, 0.7, 1.2), "hpFg")
  }

  private buildScreen() {
    const root = this.kit.empty(this.world, "Jumbotron")
    const w = 48,
      h = 27
    const plane = global.scene.createSceneObject("screen")
    plane.setParent(root)
    plane.getTransform().setLocalScale(new vec3(w, h, 1))
    const v = plane.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    v.mesh = this.meshPlane
    const mat = this.screenMaterial.clone()
    v.mainMaterial = mat
    const b = 1.4
    for (const [x, y, sx, sy] of [
      [0, h / 2 + b / 2, w + 2 * b, b],
      [0, -h / 2 - b / 2, w + 2 * b, b],
      [w / 2 + b / 2, 0, b, h],
      [-w / 2 - b / 2, 0, b, h]
    ]) {
      this.kit.part(root, "box", PALETTE.gold, new vec3(x, y, -0.2), new vec3(sx, sy, 1.2), "frame")
    }
    const label = this.fx.makeText(root, "KO CAM: WARMING UP…", 32, PALETTE.pink)
    label.obj.getTransform().setLocalPosition(new vec3(0, h / 2 + 4, 0))
    this.screen = {root, mat, label}
    root.enabled = false
  }

  private placeScanButton() {
    if (this.scanBtn) this.scanBtn.destroy()
    const btn = this.kit.empty(this.world, "ScanButton")
    const ct = this.camera.getTransform()
    btn.getTransform().setWorldPosition(this.tablePoint.add(ct.right.uniformScale(-24)).add(new vec3(0, 14, 0)))
    this.kit.part(btn, "sphere", PALETTE.blue, vec3.zero(), new vec3(6, 6, 6), "orb")
    const lbl = this.fx.makeText(btn, "SCAN", 30, PALETTE.white)
    lbl.obj.getTransform().setLocalPosition(new vec3(0, 6, 0))
    const col = btn.createComponent("Physics.ColliderComponent") as ColliderComponent
    const s = Shape.createSphereShape()
    s.radius = 4.5
    col.shape = s
    col.fitVisual = false
    const it = btn.createComponent(Interactable.getTypeName()) as Interactable
    it.onTriggerEnd.add(() => this.scan())
    this.scanBtn = btn
  }

  // ---------------------------------------------------------------------------
  // Per frame

  private onUpdate() {
    if (!this.game || !this.monster) return
    const now = getTime()
    const dt = getDeltaTime()
    this.relay.update()
    this.game.tick(now, dt)
    for (const e of this.game.drain()) this.onGameEvent(e, now)

    if (this.game.phase === "need_weapon" && this.autoScanAt < 0) this.autoScanAt = now + this.autoScanDelay
    if (this.autoScanAt > 0 && now >= this.autoScanAt) {
      this.autoScanAt = -1
      if (this.game.phase === "need_weapon") this.scan()
    }

    this.detectGestures(now)
    this.monster.update(dt)
    this.fx.update(dt)
    this.updateHud(now)

    if (this.game.phase === "ko" && this.koStartedAt > 0) {
      const relayLive = this.relay.connected && this.relay.framesReceived > 0
      const limit = this.relay.connected ? this.cinematicSeconds : 5
      if (now - this.koStartedAt > limit || (relayLive && now - this.relay.lastFrameAt > 4 && now - this.koStartedAt > 8)) {
        this.game.koDone(now)
      }
    }
  }

  private detectGestures(now: number) {
    if (this.game.phase !== "armed" && this.game.phase !== "finisher") return
    const ct = this.camera.getTransform()
    const toMonster = this.monster.centerPosition.sub(ct.getWorldPosition())
    const forward = new vec3(toMonster.x, 0, toMonster.z).normalize()
    const right = ct.right
    for (const side of ["left", "right"] as const) {
      let hand
      try {
        hand = SIK.HandInputData.getHand(side)
      } catch (e) {
        return
      }
      if (!hand || !hand.isTracked()) {
        this.detectors[side].reset()
        continue
      }
      const p = hand.wrist.position
      const det = this.detectors[side].push(now, {x: p.x, y: p.y, z: p.z}, forward, right)
      if (det) this.game.gesture(det, now)
    }
  }

  private updateHud(now: number) {
    const ct = this.camera.getTransform()
    const camPos = ct.getWorldPosition()
    const view = vec3.up().cross(ct.right).normalize()
    const look = this.fx.facing()
    // Banner: head-locked, upper middle. Card: lower left.
    this.banner.obj.getTransform().setWorldPosition(camPos.add(view.uniformScale(70)).add(new vec3(0, 16, 0)))
    this.card.obj.getTransform().setWorldPosition(camPos.add(view.uniformScale(70)).add(ct.right.uniformScale(-14)).add(new vec3(0, -16, 0)))
    if (look) {
      this.banner.obj.getTransform().setWorldRotation(look)
      this.card.obj.getTransform().setWorldRotation(look)
    }
    if (now > this.bannerUntil && this.game.phase !== "results") this.banner.text.text = ""

    const g = this.game
    if (g.phase === "analyzing") {
      this.card.text.text = "ANALYZING YOUR WEAPON…"
    } else if (g.move && (g.phase === "armed" || g.phase === "finisher")) {
      const m = g.move
      this.card.text.text = `${m.move_name}\n${GESTURE_HINT[m.gesture]}  ·  ${m.damage} dmg${m.effect !== "none" ? "  ·  " + m.effect : ""}`
    } else if (g.phase === "need_weapon") {
      this.card.text.text = "HOLD SOMETHING UP TO SCAN IT"
    } else if (g.phase !== "results") {
      this.card.text.text = ""
    }

    // HP bar over the monster.
    const head = this.monster.headPosition.add(new vec3(0, 5, 0))
    this.hpBg.getTransform().setWorldPosition(head)
    if (look) this.hpBg.getTransform().setWorldRotation(look)
    const f = Math.max(0, g.hpFraction)
    const ft = this.hpFg.obj.getTransform()
    ft.setLocalScale(new vec3(Math.max(0.001, f), 0.7, 1.2))
    ft.setLocalPosition(new vec3(-(1 - f) / 2, 0, 0.1))
    setColor(this.hpFg.mat, f > 0.5 ? PALETTE.green : f > 0.2 ? PALETTE.yellow : PALETTE.red)
    this.hpBg.enabled = g.phase !== "ko" && g.phase !== "results"

    // Jumbotron above the monster.
    if (this.screen.root.enabled) {
      this.screen.root.getTransform().setWorldPosition(this.tablePoint.add(new vec3(0, 42, 0)))
      if (look) this.screen.root.getTransform().setWorldRotation(look)
    }
    if (this.scanBtn && look) this.scanBtn.getTransform().setWorldRotation(look)
  }

  // ---------------------------------------------------------------------------
  // Game events -> visuals and sound

  private onGameEvent(e: GameEvent, now: number) {
    const camPos = this.camera.getTransform().getWorldPosition()
    switch (e.type) {
      case "announce":
        this.banner.text.text = e.text
        this.bannerUntil = now + 3.2
        if (e.speak) this.say(e.text)
        break
      case "hit": {
        const at = this.monster.centerPosition.add(new vec3((e.index - 1) * 3, 4 + e.index * 2, 4))
        this.monster.hit(e.damage, camPos)
        this.fx.sparks(at, e.color, e.crit ? 24 : 14)
        this.fx.popup(at.add(new vec3(0, 6, 0)), `${e.crit ? "CRIT " : ""}-${e.damage}${e.sloppy ? " (sloppy)" : "!"}`, e.sloppy ? "white" : e.crit ? "pink" : "yellow", e.crit)
        break
      }
      case "effect":
        if (e.effect === "stun") this.monster.stun(2.5)
        if (e.effect === "slip") this.monster.slip()
        if (e.effect === "burn") this.monster.burnFor(4)
        if (e.effect === "knockback") this.monster.knockback(camPos)
        this.fx.popup(this.monster.headPosition, e.effect.toUpperCase() + "!", "orange")
        break
      case "burn_tick":
        this.fx.popup(this.monster.headPosition, `-${e.damage}`, "orange")
        break
      case "prewarm":
        this.relay.prewarm()
        break
      case "finisher_ready":
        this.fx.popup(this.monster.headPosition.add(new vec3(0, 6, 0)), "FINAL BLOW!", "red", true)
        break
      case "ko":
        this.startKO(e.move, now)
        break
      case "results": {
        const s = e.summary
        this.screen.label.text.text = s.won ? "K.O.!" : "IT GOT AWAY"
        this.banner.text.text = s.won ? `K.O. in ${s.seconds}s!` : "TIME UP!"
        this.card.text.text = `MVP: ${s.mvp}\n${s.objects.map((o) => `${o.name}: ${o.damage}`).join("  ·  ")}\nbest combo x${s.bestCombo}  ·  say "rematch"`
        break
      }
    }
  }

  private startKO(move: Move, now: number) {
    this.koStartedAt = now
    this.monster.ko()
    this.fx.confetti(this.monster.centerPosition.add(new vec3(0, 6, 0)))
    this.fx.popup(this.monster.headPosition.add(new vec3(0, 8, 0)), "K.O.!", "pink", true)
    if (this.relay.connected) {
      this.screen.root.enabled = true
      this.screen.label.text.text = "KO CAM: ROLLING…"
      this.grabFrameJpeg((b64) => this.relay.finisher(b64, move.object_name, move.move_name, move.ko_action))
    }
  }

  private showFrame(tex: Texture) {
    this.screen.mat.mainPass.baseTex = tex
    if (this.game && this.game.phase === "ko") {
      this.screen.root.enabled = true
      this.screen.label.text.text = 'LIVE KO CAM · say "slow-mo"!'
    }
  }

  // ---------------------------------------------------------------------------
  // Scanning (camera -> Gemini move)

  scan() {
    if (!this.game || this.scanBusy) return
    const now = getTime()
    if (!this.game.beginScan(now)) return
    this.scanBusy = true
    const image = this.depthCache.getLatestCamImage()
    if (!image) {
      // Preview without a camera: canned moves.
      const m = DEMO_MOVES[this.demoIndex++ % DEMO_MOVES.length]
      this.game.moveReady(m)
      this.scanBusy = false
      return
    }
    Base64.encodeTextureAsync(
      image,
      (b64) => this.askGemini(b64),
      () => this.scanFailed("couldn't read the camera"),
      CompressionQuality.IntermediateQuality,
      EncodingType.Jpg
    )
  }

  private askGemini(b64: string) {
    const req: GeminiTypes.Models.GenerateContentRequest = {
      model: this.geminiModel,
      type: "generateContent",
      body: {
        contents: [{role: "user", parts: [{inlineData: {mimeType: "image/jpeg", data: b64}}, {text: "What am I holding up? Make it a move."}]}],
        systemInstruction: {parts: [{text: MOVE_SYSTEM_PROMPT}]},
        generationConfig: {temperature: 0.9, responseMimeType: "application/json", response_schema: GEMINI_MOVE_SCHEMA as any}
      }
    }
    Gemini.models(req)
      .then((r) => {
        let raw = null
        try {
          raw = JSON.parse(r.candidates[0].content.parts[0].text)
        } catch (e) {
          print("[PocketKO] bad Gemini JSON: " + e)
        }
        const {move, warnings} = validateMove(raw)
        if (warnings.length) print("[PocketKO] move fixes: " + warnings.join("; "))
        this.game.moveReady(move)
        this.scanBusy = false
      })
      .catch((e) => this.scanFailed("" + e))
  }

  private scanFailed(why: string) {
    print("[PocketKO] scan failed: " + why)
    this.game.moveReady(validateMove(null).move)
    this.scanBusy = false
  }

  private grabFrameJpeg(cb: (b64: string) => void) {
    const image = this.depthCache.getLatestCamImage()
    if (!image) {
      cb("")
      return
    }
    Base64.encodeTextureAsync(image, cb, () => cb(""), CompressionQuality.IntermediateQuality, EncodingType.Jpg)
  }

  // ---------------------------------------------------------------------------
  // Voice + editor input

  private listenSoon(seconds: number) {
    if (!this.asr) return
    const d = this.createEvent("DelayedCallbackEvent")
    d.bind(() => this.asr.startListening())
    d.reset(seconds)
  }

  private onVoice(raw: string) {
    const t = (raw || "").toLowerCase()
    this.listenSoon(0.3)
    if (!this.game) return
    if (this.game.phase === "ko") {
      this.relay.steer(raw)
      this.fx.popup(this.monster.headPosition.add(new vec3(0, 14, 0)), raw.toUpperCase(), "blue")
      return
    }
    if (/\b(rematch|again|new round|play again)\b/.test(t) && this.game.phase === "results") return this.newRound()
    if (/\b(scan|weapon|switch|new one|try this|this one)\b/.test(t)) return this.scan()
  }

  private onEditorTap() {
    if (!this.game) return
    const p = this.game.phase
    if (p === "results") return this.newRound()
    if (p === "need_weapon") return this.scan()
    if (p === "armed" || p === "finisher") {
      this.editorTaps++
      if (this.editorTaps % 4 === 0 && p === "armed") return this.scan()
      this.game.gesture({gesture: this.game.move.gesture, speed: 200}, getTime())
    }
  }

  private say(text: string) {
    if (!this.speak || !text) return
    OpenAI.speech({model: "gpt-4o-mini-tts", input: text, voice: this.ttsVoice as any, instructions: "Over-the-top arcade fighting game announcer. Loud, fast, hyped, funny."})
      .then((track) => {
        if (!this.audio) this.audio = this.getSceneObject().createComponent("AudioComponent") as AudioComponent
        if (this.audio.isPlaying()) this.audio.stop(false)
        this.audio.audioTrack = track
        this.audio.play(1)
      })
      .catch((e) => print("[PocketKO] TTS failed: " + e))
  }
}

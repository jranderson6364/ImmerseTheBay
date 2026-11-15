/**
 * The Glorp: a goofy green blob built from spheres, animated with squash & stretch.
 * Not a component: the controller owns it and calls update(dt) every frame.
 */
import {PALETTE, Spring, ToonKit, faceYaw, lerpColor, randRange, setColor} from "./Toon"

type Mood = "landing" | "idle" | "stunned" | "slipped" | "ko"

export class Monster {
  root: SceneObject
  private body: SceneObject
  private bodyMat: Material
  private pupils: SceneObject[] = []
  private mouth: SceneObject
  private stars: SceneObject[] = []
  private flames: {obj: SceneObject; life: number}[] = []
  private squash = new Spring(1, 300, 12)
  private home: vec3
  private pos: vec3
  private hopFrom: vec3
  private hopTo: vec3
  private hopT = 1
  private hopWait = 1.5
  private flash = 0
  private burn = 0
  private mood: Mood = "landing"
  private moodT = 0
  private dropY = 60
  private spin = 0
  private tilt = 0
  private recoil = vec3.zero()

  constructor(
    private kit: ToonKit,
    parent: SceneObject,
    tablePoint: vec3,
    private camera: SceneObject,
    private radius = 7
  ) {
    this.home = tablePoint
    this.pos = tablePoint
    this.hopFrom = tablePoint
    this.hopTo = tablePoint
    this.root = kit.empty(parent, "Glorp")
    const r = radius
    this.body = kit.empty(this.root, "body")
    const b = kit.part(this.body, "sphere", PALETTE.glorp, new vec3(0, r, 0), new vec3(2 * r, 2 * r * 0.92, 2 * r), "blob")
    this.bodyMat = b.mat
    kit.part(this.body, "sphere", PALETTE.belly, new vec3(0, r * 0.75, r * 0.55), new vec3(r * 1.1, r * 1.0, r * 0.7), "belly")
    for (const s of [-1, 1]) {
      kit.part(this.body, "sphere", PALETTE.white, new vec3(s * r * 0.38, r * 1.35, r * 0.78), new vec3(r * 0.62, r * 0.7, r * 0.5), "eye")
      this.pupils.push(kit.part(this.body, "sphere", PALETTE.black, new vec3(s * r * 0.36, r * 1.32, r * 1.0), new vec3(r * 0.28, r * 0.32, r * 0.2), "pupil").obj)
      kit.part(this.body, "sphere", PALETTE.glorpDark, new vec3(s * r * 0.55, r * 0.12, r * 0.2), new vec3(r * 0.55, r * 0.3, r * 0.7), "foot")
    }
    this.mouth = kit.part(this.body, "sphere", PALETTE.black, new vec3(0, r * 0.85, r * 0.98), new vec3(r * 0.55, r * 0.22, r * 0.15), "mouth").obj
    kit.part(this.body, "cylinder", PALETTE.glorpDark, new vec3(0, r * 2.15, 0), new vec3(r * 0.08, r * 0.6, r * 0.08), "antenna")
    kit.part(this.body, "sphere", PALETTE.yellow, new vec3(0, r * 2.5, 0), new vec3(r * 0.3, r * 0.3, r * 0.3), "bulb")
    for (let i = 0; i < 3; i++) {
      const st = kit.part(this.root, "sphere", PALETTE.yellow, vec3.zero(), new vec3(1.2, 1.2, 1.2), "star").obj
      st.enabled = false
      this.stars.push(st)
    }
    this.place()
  }

  get headPosition(): vec3 {
    return this.root.getTransform().getWorldPosition().add(new vec3(0, this.radius * 2.6, 0))
  }

  get centerPosition(): vec3 {
    return this.root.getTransform().getWorldPosition().add(new vec3(0, this.radius, 0))
  }

  get isKO(): boolean {
    return this.mood === "ko"
  }

  // -- reactions -------------------------------------------------------------

  hit(strength: number, fromPlayer: vec3) {
    if (this.mood === "ko") return
    this.squash.kick(-6 - strength * 0.25)
    this.flash = 1
    const away = this.pos.sub(fromPlayer)
    const flat = new vec3(away.x, 0, away.z)
    if (flat.length > 0.01) this.recoil = this.recoil.add(flat.normalize().uniformScale(2 + strength * 0.12))
    this.wobbleMouth()
  }

  stun(seconds: number) {
    this.setMood("stunned", seconds)
  }

  slip() {
    this.setMood("slipped", 1.4)
  }

  burnFor(seconds: number) {
    this.burn = seconds
  }

  knockback(fromPlayer: vec3) {
    const away = this.pos.sub(fromPlayer)
    const flat = new vec3(away.x, 0, away.z)
    if (flat.length < 0.01) return
    this.startHop(this.pos.add(flat.normalize().uniformScale(12)), 0.35)
  }

  ko() {
    this.setMood("ko", 999)
    this.squash.target = 0.18
    this.squash.kick(-10)
  }

  // -- per frame -------------------------------------------------------------

  update(dt: number) {
    this.moodT -= dt
    if ((this.mood === "stunned" || this.mood === "slipped") && this.moodT <= 0) this.setMood("idle", 0)

    if (this.mood === "landing") {
      this.dropY = Math.max(0, this.dropY - dt * 160)
      if (this.dropY === 0) {
        this.squash.kick(-9)
        this.setMood("idle", 0)
      }
    } else if (this.mood === "idle") {
      this.hopWait -= dt
      if (this.hopWait <= 0 && this.hopT >= 1) {
        const a = randRange(0, Math.PI * 2)
        const d = randRange(4, 14)
        this.startHop(this.home.add(new vec3(Math.cos(a) * d, 0, Math.sin(a) * d)), 0.45)
        this.hopWait = randRange(1.2, 2.8)
      }
    }

    // Hop arc.
    let hopLift = 0
    if (this.hopT < 1) {
      this.hopT = Math.min(1, this.hopT + dt / this.hopDuration)
      const k = this.hopT
      this.pos = vec3.lerp(this.hopFrom, this.hopTo, k)
      hopLift = Math.sin(k * Math.PI) * 6
      if (this.hopT >= 1) this.squash.kick(-5)
    }
    this.recoil = this.recoil.uniformScale(Math.max(0, 1 - dt * 6))

    // Squash & stretch with a breathing idle.
    const breathe = this.mood === "ko" ? 0 : Math.sin(getTime() * 3.2) * 0.04
    const s = this.squash.step(dt) + breathe
    const sy = Math.max(0.1, s)
    const sxz = Math.min(1.7, 1 / Math.sqrt(sy))
    this.body.getTransform().setLocalScale(new vec3(sxz, sy, sxz))

    // Tilt (slip falls over), spin (stunned wobble).
    const tiltTarget = this.mood === "slipped" ? 80 : 0
    this.tilt += (tiltTarget - this.tilt) * Math.min(1, dt * 10)
    this.spin = this.mood === "stunned" ? this.spin + dt * 360 : 0

    const t = this.root.getTransform()
    t.setWorldPosition(this.pos.add(this.recoil).add(new vec3(0, this.dropY + hopLift, 0)))
    const face = faceYaw(this.pos, this.camera.getTransform().getWorldPosition())
    const wobble = this.mood === "stunned" ? quat.angleAxis(Math.sin(this.spin * 0.05) * 0.25, new vec3(0, 0, 1)) : quat.quatIdentity()
    t.setWorldRotation(face.multiply(quat.angleAxis((this.tilt * Math.PI) / 180, new vec3(0, 0, 1))).multiply(wobble))

    // Colour: hit flash to white, burn tint to red.
    this.flash = Math.max(0, this.flash - dt * 6)
    this.burn = Math.max(0, this.burn - dt)
    let c = PALETTE.glorp
    if (this.burn > 0) c = lerpColor(c, PALETTE.red, 0.55 + 0.25 * Math.sin(getTime() * 12))
    if (this.mood === "ko") c = lerpColor(PALETTE.glorp, PALETTE.glorpDark, 0.4)
    setColor(this.bodyMat, lerpColor(c, PALETTE.white, this.flash))

    this.updateStars(dt)
    this.updateFlames(dt)
    this.updateEyes()
  }

  // -- internals -------------------------------------------------------------

  private hopDuration = 0.45

  private startHop(to: vec3, duration: number) {
    this.hopFrom = this.pos
    this.hopTo = to
    this.hopT = 0
    this.hopDuration = duration
    this.squash.kick(4)
  }

  private setMood(m: Mood, seconds: number) {
    this.mood = m
    this.moodT = seconds
    this.stars.forEach((s) => (s.enabled = m === "stunned" || m === "ko"))
  }

  private wobbleMouth() {
    const mt = this.mouth.getTransform()
    const r = this.radius
    mt.setLocalScale(new vec3(r * 0.5, r * 0.55, r * 0.15)) // "O" of surprise; relaxes in updateEyes
    this.mouthOpen = 0.6
  }

  private mouthOpen = 0

  private updateEyes() {
    const r = this.radius
    // Pupils look at the camera a bit and spin when KO.
    const t = getTime()
    this.pupils.forEach((p, i) => {
      const s = i === 0 ? -1 : 1
      const base = new vec3(s * r * 0.36, r * 1.32, r * 1.0)
      if (this.mood === "ko" || this.mood === "stunned") {
        const a = t * 9 + i * Math.PI
        p.getTransform().setLocalPosition(base.add(new vec3(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12, 0)))
      } else {
        p.getTransform().setLocalPosition(base)
      }
    })
    this.mouthOpen = Math.max(0, this.mouthOpen - getDeltaTime())
    if (this.mouthOpen <= 0 && this.mood !== "ko") this.mouth.getTransform().setLocalScale(new vec3(r * 0.55, r * 0.22, r * 0.15))
    if (this.mood === "ko") this.mouth.getTransform().setLocalScale(new vec3(r * 0.7, r * 0.12, r * 0.15))
  }

  private updateStars(dt: number) {
    if (!this.stars[0].enabled) return
    const head = this.headPosition.sub(this.root.getTransform().getWorldPosition())
    const t = getTime() * 4
    this.stars.forEach((s, i) => {
      const a = t + (i * Math.PI * 2) / 3
      s.getTransform().setLocalPosition(head.add(new vec3(Math.cos(a) * this.radius * 0.9, Math.sin(t * 2 + i) * 1.2, Math.sin(a) * this.radius * 0.9)))
    })
    void dt
  }

  private updateFlames(dt: number) {
    if (this.burn > 0 && Math.random() < dt * 14) {
      const f = this.kit.part(this.root, "sphere", Math.random() < 0.5 ? PALETTE.orange : PALETTE.yellow, new vec3(randRange(-4, 4), this.radius * 1.4, randRange(-4, 4)), new vec3(1.6, 1.6, 1.6), "flame")
      this.flames.push({obj: f.obj, life: 0.6})
    }
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]
      f.life -= dt
      const tr = f.obj.getTransform()
      tr.setLocalPosition(tr.getLocalPosition().add(new vec3(0, dt * 18, 0)))
      tr.setLocalScale(vec3.one().uniformScale(Math.max(0.01, f.life * 3)))
      if (f.life <= 0) {
        f.obj.destroy()
        this.flames.splice(i, 1)
      }
    }
  }

  private place() {
    this.root.getTransform().setWorldPosition(this.pos.add(new vec3(0, this.dropY, 0)))
  }
}

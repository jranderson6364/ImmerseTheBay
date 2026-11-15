/**
 * Browser play-preview of Pocket KO, using the SAME Core (Moves, Game, Gesture) as the Lens.
 * The "passthrough" is a desk photo; keys stand in for real gestures; the KO is the real Orbis relay.
 * Build: bun build unneeded/PocketKO/tools/preview/main.ts --outfile unneeded/PocketKO/relay/static/play.js --external three
 * Then open http://localhost:8765/play while the relay runs.
 *
 * Keys: E = scan next item · S slam · A/D swing · W poke · Q toss · K skip to finisher
 */
import * as THREE from "three"
import {DEMO_MOVES, GESTURE_HINT, Gesture, Move} from "../../Assets/PocketKO/Core/Moves"
import {GameEvent, PocketKOGame} from "../../Assets/PocketKO/Core/Game"

const $ = (id: string) => document.getElementById(id)!
const canvas = $("stage") as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true})
renderer.setPixelRatio(Math.min(2, devicePixelRatio))
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(46, 16 / 9, 1, 2000)
camera.position.set(0, 42, 62)
camera.lookAt(0, 14, 0)
scene.add(new THREE.HemisphereLight(0xffffff, 0x664422, 2.2))
const sun = new THREE.DirectionalLight(0xffffff, 1.6)
sun.position.set(20, 60, 40)
scene.add(sun)
// Shadow-catcher disc so the blob sits on the "real" desk photo.
const shadow = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.35}))
shadow.rotation.x = -Math.PI / 2
scene.add(shadow)

function resize() {
  const w = canvas.clientWidth,
    h = canvas.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
addEventListener("resize", resize)
resize()

// ---------------------------------------------------------------------------
// The Glorp (mirrors PocketKO/Assets/PocketKO/Scripts/Monster.ts)

const mat = (c: number) => new THREE.MeshStandardMaterial({color: c, roughness: 0.45})
const sphere = new THREE.SphereGeometry(0.5, 32, 24)
const R = 7
const glorp = new THREE.Group()
const body = new THREE.Group()
glorp.add(body)
const bodyMat = mat(0x73f24d)
function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, p: number[], s: number[]) {
  const o = new THREE.Mesh(geo, m)
  o.position.set(p[0], p[1], p[2])
  o.scale.set(s[0], s[1], s[2])
  parent.add(o)
  return o
}
add(body, sphere, bodyMat, [0, R, 0], [2 * R, 2 * R * 0.92, 2 * R])
add(body, sphere, mat(0xbfff8c), [0, R * 0.75, R * 0.55], [R * 1.1, R, R * 0.7])
const pupils: THREE.Mesh[] = []
for (const s of [-1, 1]) {
  add(body, sphere, mat(0xffffff), [s * R * 0.38, R * 1.35, R * 0.78], [R * 0.62, R * 0.7, R * 0.5])
  pupils.push(add(body, sphere, mat(0x0a0a10), [s * R * 0.36, R * 1.32, R * 1.0], [R * 0.28, R * 0.32, R * 0.2]))
  add(body, sphere, mat(0x389926), [s * R * 0.55, R * 0.12, R * 0.2], [R * 0.55, R * 0.3, R * 0.7])
}
const mouth = add(body, sphere, mat(0x0a0a10), [0, R * 0.85, R * 0.98], [R * 0.55, R * 0.22, R * 0.15])
add(body, new THREE.CylinderGeometry(0.5, 0.5, 1, 12), mat(0x389926), [0, R * 2.15, 0], [R * 0.08, R * 0.6, R * 0.08])
add(body, sphere, mat(0xffe126), [0, R * 2.5, 0], [R * 0.3, R * 0.3, R * 0.3])
const stars = [0, 1, 2].map(() => add(glorp, sphere, mat(0xffe126), [0, 0, 0], [1.4, 1.4, 1.4]))
scene.add(glorp)

const st = {
  squash: 1, vel: 0, drop: 70, flash: 0, burn: 0, tilt: 0, stun: 0, slip: 0, ko: false,
  pos: new THREE.Vector3(), hopFrom: new THREE.Vector3(), hopTo: new THREE.Vector3(), hopT: 1, hopWait: 1.5, recoil: new THREE.Vector3()
}
function kick(v: number) {
  st.vel += v
}

// ---------------------------------------------------------------------------
// Effects

interface P {
  o: THREE.Mesh
  v: THREE.Vector3
  spin: THREE.Vector3
  life: number
  max: number
  g: number
  size: number
}
const parts: P[] = []
const COLORS: Record<string, number> = {yellow: 0xffe126, red: 0xff4040, orange: 0xff8c1a, blue: 0x40a6ff, purple: 0xb366ff, green: 0x59ff66, pink: 0xff73bf, white: 0xffffff}
const CONF = [0xffe126, 0xff4040, 0x40a6ff, 0xb366ff, 0x59ff66, 0xff73bf, 0xff8c1a]
const box = new THREE.BoxGeometry(1, 0.15, 0.6)
function burst(at: THREE.Vector3, color: number, n: number, speed: number, flat = false, g = 160, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const dir = new THREE.Vector3(Math.random() * 2 - 1, 0.2 + Math.random() * (flat ? 1.6 : 1), Math.random() * 2 - 1).normalize()
    const size = flat ? 1 + Math.random() * 0.6 : 0.8 + Math.random() * 0.9
    const o = new THREE.Mesh(flat ? box : sphere, new THREE.MeshStandardMaterial({color: flat ? CONF[i % CONF.length] : i % 3 === 0 ? 0xffffff : color, emissive: flat ? 0x000000 : color, emissiveIntensity: 0.4}))
    o.position.copy(at)
    o.scale.setScalar(size)
    scene.add(o)
    parts.push({o, v: dir.multiplyScalar(speed * (0.5 + Math.random() * 0.5)), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life, max: life, g, size})
  }
}
function popup(text: string, color: string, big = false) {
  const head = glorp.position.clone().add(new THREE.Vector3(0, R * 2.6, 0)).project(camera)
  const el = document.createElement("div")
  el.className = "pop" + (big ? " big" : "")
  el.textContent = text
  el.style.color = "#" + (COLORS[color] || 0xffe126).toString(16).padStart(6, "0")
  el.style.left = `${((head.x + 1) / 2) * 100 + (Math.random() * 8 - 4)}%`
  el.style.top = `${((1 - head.y) / 2) * 100}%`
  $("hud").appendChild(el)
  setTimeout(() => el.remove(), big ? 1700 : 1100)
}

// ---------------------------------------------------------------------------
// Announcer + relay

function announce(text: string) {
  const b = $("banner")
  b.textContent = text
  b.classList.remove("show")
  void b.offsetWidth
  b.classList.add("show")
}
let ws: WebSocket | null = null
function connectRelay() {
  ws = new WebSocket(`ws://${location.host}/ws`)
  ws.onopen = () => ws!.send(JSON.stringify({type: "hello", role: "page"}))
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.type === "status" && m.state === "generating") {
      ;($("ko-img") as HTMLImageElement).src = "/stream.mjpg?" + Date.now()
      $("jumbo").classList.add("live")
    }
  }
  ws.onclose = () => setTimeout(connectRelay, 1500)
}
connectRelay()

// ---------------------------------------------------------------------------
// Game wiring (same Core as the Lens)

let game = new PocketKOGame()
let demo = 0
const t0 = performance.now() / 1000
const now = () => performance.now() / 1000 - t0
game.start(now())

function scan() {
  if (!game.beginScan(now())) return
  const m: Move = DEMO_MOVES[demo++ % DEMO_MOVES.length]
  setTimeout(() => game.moveReady(m), 1200) // pretend Gemini latency
}
function gesture(g: Gesture) {
  game.gesture({gesture: g, speed: 200}, now())
}
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase()
  if (k === "e") scan()
  if (k === "s") gesture("slam")
  if (k === "a" || k === "d") gesture("swing")
  if (k === "w") gesture("poke")
  if (k === "q") gesture("toss")
  if (k === "k") game.debugSetHp(15, now())
  if (k === "r" && game.phase === "results") restart()
  if (k === "1" && ws) ws.send(JSON.stringify({type: "steer", text: "slow mo"}))
  if (k === "2" && ws) ws.send(JSON.stringify({type: "steer", text: "explosion"}))
})
;(window as any).pk = {scan, gesture, setHp: (h: number) => game.debugSetHp(h, now()), get phase() { return game.phase }, get hp() { return game.hp }}

function restart() {
  game = new PocketKOGame()
  game.start(now())
  st.ko = false
  st.drop = 70
  $("jumbo").classList.remove("live")
}

function onEvent(e: GameEvent) {
  const center = glorp.position.clone().add(new THREE.Vector3(0, R, 4))
  switch (e.type) {
    case "announce":
      announce(e.text)
      break
    case "hit":
      kick(-6 - e.damage * 0.25)
      st.flash = 1
      st.recoil.add(new THREE.Vector3(0, 0, -1).multiplyScalar(2 + e.damage * 0.12))
      burst(center.clone().add(new THREE.Vector3((e.index - 1) * 3, e.index * 2, 0)), COLORS[e.color] || 0xffe126, e.crit ? 24 : 14, 70)
      popup(`${e.crit ? "CRIT " : ""}-${e.damage}${e.sloppy ? " (sloppy)" : "!"}`, e.sloppy ? "white" : e.crit ? "pink" : "yellow", e.crit)
      break
    case "effect":
      if (e.effect === "stun") st.stun = 2.5
      if (e.effect === "slip") st.slip = 1.4
      if (e.effect === "burn") st.burn = 4
      if (e.effect === "knockback") st.recoil.add(new THREE.Vector3(0, 0, -12))
      popup(e.effect.toUpperCase() + "!", "orange")
      break
    case "burn_tick":
      popup(`-${e.damage}`, "orange")
      break
    case "prewarm":
      ws?.send(JSON.stringify({type: "prewarm"}))
      break
    case "finisher_ready":
      popup("FINAL BLOW!", "red", true)
      break
    case "ko":
      st.ko = true
      kick(-10)
      burst(center.clone().add(new THREE.Vector3(0, 6, 0)), 0xffffff, 80, 120, true, 90, 2.2)
      popup("K.O.!", "pink", true)
      $("jumbo").classList.add("rolling")
      ws?.send(JSON.stringify({type: "finisher", image: "", object: e.move.object_name, move: e.move.move_name, ko_action: e.move.ko_action}))
      setTimeout(() => game.koDone(now()), 19000)
      break
    case "results": {
      const s = e.summary
      $("card").innerHTML = `<b>${s.won ? `K.O. in ${s.seconds}s!` : "IT GOT AWAY"}</b><br>MVP: ${s.mvp}<br>${s.objects.map((o) => `${o.name}: ${o.damage}`).join(" · ")}<br>best combo x${s.bestCombo} · press R for a rematch`
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Loop

let last = performance.now()
function frame() {
  const t = performance.now()
  const dt = Math.min(0.05, (t - last) / 1000)
  last = t
  const n = now()
  game.tick(n, dt)
  for (const e of game.drain()) onEvent(e)

  // Monster motion
  if (st.drop > 0) {
    st.drop = Math.max(0, st.drop - dt * 160)
    if (st.drop === 0) kick(-9)
  } else if (!st.ko && st.stun <= 0 && st.slip <= 0) {
    st.hopWait -= dt
    if (st.hopWait <= 0 && st.hopT >= 1) {
      const a = Math.random() * Math.PI * 2,
        d = 4 + Math.random() * 10
      st.hopFrom.copy(st.pos)
      st.hopTo.set(Math.cos(a) * d, 0, Math.sin(a) * d * 0.5)
      st.hopT = 0
      st.hopWait = 1.2 + Math.random() * 1.6
      kick(4)
    }
  }
  let lift = 0
  if (st.hopT < 1) {
    st.hopT = Math.min(1, st.hopT + dt / 0.45)
    st.pos.lerpVectors(st.hopFrom, st.hopTo, st.hopT)
    lift = Math.sin(st.hopT * Math.PI) * 6
    if (st.hopT >= 1) kick(-5)
  }
  st.recoil.multiplyScalar(Math.max(0, 1 - dt * 6))
  const target = st.ko ? 0.18 : 1
  st.vel += ((target - st.squash) * 300 - st.vel * 12) * dt
  st.squash += st.vel * dt
  const breathe = st.ko ? 0 : Math.sin(n * 3.2) * 0.04
  const sy = Math.max(0.1, st.squash + breathe)
  const sxz = Math.min(1.7, 1 / Math.sqrt(sy))
  body.scale.set(sxz, sy, sxz)
  st.stun = Math.max(0, st.stun - dt)
  st.slip = Math.max(0, st.slip - dt)
  st.tilt += ((st.slip > 0 ? 80 : 0) - st.tilt) * Math.min(1, dt * 10)
  glorp.position.set(st.pos.x + st.recoil.x, st.drop + lift, st.pos.z + st.recoil.z)
  glorp.rotation.set(0, 0, (st.tilt * Math.PI) / 180 + (st.stun > 0 ? Math.sin(n * 10) * 0.25 : 0))
  shadow.position.set(glorp.position.x, 0.05, glorp.position.z)
  shadow.scale.setScalar(st.ko ? 1.6 : 1 - Math.min(0.6, glorp.position.y / 80))
  st.flash = Math.max(0, st.flash - dt * 6)
  st.burn = Math.max(0, st.burn - dt)
  const base = new THREE.Color(0x73f24d)
  if (st.burn > 0) base.lerp(new THREE.Color(0xff4040), 0.55 + 0.25 * Math.sin(n * 12))
  if (st.ko) base.lerp(new THREE.Color(0x389926), 0.4)
  bodyMat.color.copy(base.lerp(new THREE.Color(0xffffff), st.flash))
  pupils.forEach((p, i) => {
    const s = i === 0 ? -1 : 1
    const spinning = st.ko || st.stun > 0
    const a = n * 9 + i * Math.PI
    p.position.set(s * R * 0.36 + (spinning ? Math.cos(a) * R * 0.12 : 0), R * 1.32 + (spinning ? Math.sin(a) * R * 0.12 : 0), R)
  })
  mouth.scale.set(R * (st.ko ? 0.7 : st.flash > 0.3 ? 0.5 : 0.55), R * (st.ko ? 0.12 : st.flash > 0.3 ? 0.55 : 0.22), R * 0.15)
  stars.forEach((s, i) => {
    s.visible = st.stun > 0 || st.ko
    const a = n * 4 + (i * Math.PI * 2) / 3
    s.position.set(Math.cos(a) * R * 0.9, R * 2.6 + Math.sin(n * 8 + i) * 1.2, Math.sin(a) * R * 0.9)
  })
  if (st.burn > 0 && Math.random() < dt * 14) burst(glorp.position.clone().add(new THREE.Vector3(0, R * 1.4, 0)), Math.random() < 0.5 ? 0xff8c1a : 0xffe126, 1, 25, false, -20, 0.6)

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.life -= dt
    p.v.y -= p.g * dt
    p.v.multiplyScalar(Math.max(0, 1 - dt * 1.5))
    p.o.position.addScaledVector(p.v, dt)
    p.o.rotation.x += p.spin.x * dt
    p.o.rotation.y += p.spin.y * dt
    p.o.scale.setScalar(p.size * Math.min(1, (p.life / p.max) * 2))
    if (p.life <= 0) {
      scene.remove(p.o)
      parts.splice(i, 1)
    }
  }

  // HUD
  const f = Math.max(0, game.hpFraction)
  const hp = $("hpfill")
  hp.style.width = `${f * 100}%`
  hp.style.background = f > 0.5 ? "#59ff66" : f > 0.2 ? "#ffe126" : "#ff4040"
  $("hp").style.opacity = game.phase === "ko" || game.phase === "results" ? "0" : "1"
  const head = glorp.position.clone().add(new THREE.Vector3(0, R * 2.9 + 4, 0)).project(camera)
  $("hp").style.left = `${((head.x + 1) / 2) * 100}%`
  $("hp").style.top = `${((1 - head.y) / 2) * 100}%`
  if (game.phase !== "results") {
    const m = game.move
    $("card").innerHTML =
      game.phase === "analyzing"
        ? "<b>ANALYZING YOUR WEAPON…</b><br><span class='spin'>●</span> cooldown"
        : m && (game.phase === "armed" || game.phase === "finisher")
          ? `<b>${m.move_name}</b><br>${GESTURE_HINT[m.gesture]} · ${m.damage} dmg${m.effect !== "none" ? " · " + m.effect : ""}<br><small>${m.object_name}</small>`
          : game.phase === "need_weapon"
            ? "<b>HOLD SOMETHING UP TO SCAN IT</b><br><small>press E</small>"
            : ""
  }
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
frame()

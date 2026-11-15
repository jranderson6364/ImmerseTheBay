// PocketKO/tools/preview/main.ts
import * as THREE from "three";

// PocketKO/Assets/PocketKO/Core/Moves.ts
var GESTURES = ["slam", "swing", "poke", "toss"];
var EFFECTS = ["none", "stun", "burn", "slip", "multi", "knockback"];
var COLORS = ["yellow", "red", "orange", "blue", "purple", "green", "pink", "white"];
var GESTURE_HINT = {
  slam: "SLAM it down!",
  swing: "SWING it sideways!",
  poke: "POKE forward!",
  toss: "TOSS it up!"
};
var GEMINI_MOVE_SCHEMA = {
  type: "object",
  properties: {
    object_name: { type: "string" },
    move_name: { type: "string" },
    damage: { type: "number" },
    effect: { type: "string", enum: [...EFFECTS] },
    gesture: { type: "string", enum: [...GESTURES] },
    hype: { type: "string" },
    color: { type: "string", enum: [...COLORS] },
    ko_action: { type: "string" },
    fragile: { type: "boolean" },
    unsafe: { type: "boolean" }
  },
  required: ["object_name", "move_name", "damage", "effect", "gesture", "hype", "color", "ko_action", "fragile", "unsafe"]
};
var DEMO_MOVES = [
  {
    object_name: "banana",
    move_name: "POTASSIUM SLAM",
    damage: 24,
    effect: "slip",
    gesture: "slam",
    hype: "Peel out! It's the POTASSIUM SLAM!",
    color: "yellow",
    ko_action: "A huge banana drops from the sky and squashes the green blob monster flat like a pancake.",
    fragile: false,
    unsafe: false
  },
  {
    object_name: "car keys",
    move_name: "KEY JAB",
    damage: 14,
    effect: "multi",
    gesture: "poke",
    hype: "Jingle jingle, KEY JAB COMBO!",
    color: "white",
    ko_action: "A giant jangling key ring spins like a buzzsaw and bonks the green blob monster into a daze.",
    fragile: false,
    unsafe: false
  },
  {
    object_name: "water bottle",
    move_name: "HYDRO HAMMER",
    damage: 20,
    effect: "knockback",
    gesture: "swing",
    hype: "Stay hydrated, monster! HYDRO HAMMER!",
    color: "blue",
    ko_action: "A colossal water bottle swings like a baseball bat and launches the green blob monster into orbit.",
    fragile: false,
    unsafe: false
  },
  {
    object_name: "hot sauce",
    move_name: "SCOVILLE SURPRISE",
    damage: 18,
    effect: "burn",
    gesture: "toss",
    hype: "Too spicy! The SCOVILLE SURPRISE!",
    color: "red",
    ko_action: "A giant hot sauce bottle sprays flames and the green blob monster turns red and pops like a balloon.",
    fragile: false,
    unsafe: false
  }
];

// PocketKO/Assets/PocketKO/Core/Game.ts
var DEFAULT_GAME_CONFIG = {
  monsterHp: 100,
  analyzeCooldown: 3.5,
  introSeconds: 2.5,
  finisherAt: 0.2,
  prewarmAt: 0.5,
  roundSeconds: 120,
  sloppy: 0.35,
  hitCooldown: 0.5
};
var STALE = [1, 0.75, 0.55, 0.4, 0.3];

class PocketKOGame {
  phase = "intro";
  hp;
  maxHp;
  move = null;
  pendingMove = null;
  combo = 0;
  bestCombo = 0;
  events = [];
  cfg;
  t0 = 0;
  phaseAt = 0;
  analyzeAt = 0;
  lastHitAt = -1e9;
  usesOfCurrent = 0;
  lastObject = "";
  seen = {};
  damageBy = {};
  stunUntil = 0;
  slipped = false;
  burnUntil = 0;
  burnAcc = 0;
  prewarmed = false;
  constructor(cfg = {}) {
    this.cfg = { ...DEFAULT_GAME_CONFIG, ...cfg };
    this.hp = this.maxHp = this.cfg.monsterHp;
  }
  get hpFraction() {
    return this.hp / this.maxHp;
  }
  get stunned() {
    return this.stunUntil > 0;
  }
  start(now) {
    this.t0 = now;
    this.setPhase("intro", now);
    this.announce("Incoming! A wild GLORP lands on your table!", true);
  }
  beginScan(now) {
    if (this.phase !== "need_weapon" && this.phase !== "armed" && this.phase !== "finisher")
      return false;
    this.pendingMove = null;
    this.analyzeAt = now;
    this.setPhase("analyzing", now);
    this.announce("Analyzing your weapon…", true);
    return true;
  }
  moveReady(move) {
    if (this.phase === "analyzing")
      this.pendingMove = move;
  }
  tick(now, dt) {
    if (this.phase === "intro" && now - this.phaseAt >= this.cfg.introSeconds) {
      this.setPhase("need_weapon", now);
      this.announce("Grab ANYTHING and hold it up to scan!", true);
    }
    if (this.phase === "analyzing" && this.pendingMove && now - this.analyzeAt >= this.cfg.analyzeCooldown) {
      this.arm(this.pendingMove, now);
    }
    if (this.stunUntil > 0 && now >= this.stunUntil)
      this.stunUntil = 0;
    if (this.burnUntil > 0) {
      if (now >= this.burnUntil)
        this.burnUntil = 0;
      else if (this.hp > this.finisherHp() + 1) {
        this.burnAcc += 2.5 * dt;
        if (this.burnAcc >= 1) {
          const d = Math.floor(this.burnAcc);
          this.burnAcc -= d;
          this.hp = Math.max(this.finisherHp() + 1, this.hp - d);
          this.events.push({ type: "burn_tick", damage: d });
        }
      }
    }
    const fighting = this.phase !== "ko" && this.phase !== "results" && this.phase !== "intro";
    if (fighting && now - this.t0 >= this.cfg.roundSeconds) {
      this.events.push({ type: "timeout" });
      this.announce("Time! The GLORP escapes…", true);
      this.finish(now, false);
    }
  }
  gesture(det, now) {
    if (!this.move || this.phase !== "armed" && this.phase !== "finisher")
      return 0;
    if (now - this.lastHitAt < this.cfg.hitCooldown)
      return 0;
    this.lastHitAt = now;
    const m = this.move;
    const sloppy = det.gesture !== m.gesture;
    if (this.phase === "finisher") {
      if (sloppy) {
        this.announce(`So close! ${GESTURE_HINT[m.gesture]}`, true);
        return 0;
      }
      const dmg = this.hp;
      this.hp = 0;
      this.credit(m, dmg);
      this.events.push({ type: "hit", damage: dmg, total: dmg, sloppy: false, crit: true, color: m.color, index: 0, of: 1 });
      this.events.push({ type: "ko", move: m });
      this.setPhase("ko", now);
      this.announce(`K.O.! ${m.move_name} FINISHES IT!`, true);
      return dmg;
    }
    let mult = (sloppy ? this.cfg.sloppy : 1) * STALE[Math.min(this.usesOfCurrent, STALE.length - 1)];
    mult *= 1 + Math.min(this.combo, 5) * 0.2;
    let crit = false;
    if (this.slipped) {
      mult *= 1.5;
      crit = true;
      this.slipped = false;
    }
    if (this.stunned)
      mult *= 1.25;
    this.usesOfCurrent++;
    const hits = m.effect === "multi" && !sloppy ? 3 : 1;
    const per = Math.max(1, Math.round(m.damage * mult * (hits === 3 ? 0.45 : 1)));
    let total = 0;
    for (let i = 0;i < hits; i++) {
      const before = this.hp;
      this.hp = Math.max(this.finisherHp(), this.hp - per);
      const d = before - this.hp;
      total += d;
      this.events.push({ type: "hit", damage: d, total, sloppy, crit, color: m.color, index: i, of: hits });
    }
    this.credit(m, total);
    if (!sloppy)
      this.applyEffect(m, now);
    else
      this.announce(`Sloppy! ${GESTURE_HINT[m.gesture]}`, false);
    if (!this.prewarmed && this.hpFraction <= this.cfg.prewarmAt) {
      this.prewarmed = true;
      this.events.push({ type: "prewarm" });
    }
    if (this.hp <= this.finisherHp()) {
      this.setPhase("finisher", now);
      this.events.push({ type: "finisher_ready" });
      this.announce(`FINAL BLOW! ${GESTURE_HINT[m.gesture]}`, true);
    }
    return total;
  }
  koDone(now) {
    if (this.phase === "ko")
      this.finish(now, true);
  }
  debugSetHp(hp, now) {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    if (this.hp <= this.finisherHp() && this.move) {
      this.setPhase("finisher", now);
      this.events.push({ type: "finisher_ready" });
    }
  }
  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }
  finisherHp() {
    return Math.ceil(this.maxHp * this.cfg.finisherAt);
  }
  arm(move, now) {
    const isNew = !this.seen[move.object_name];
    if (move.object_name !== this.lastObject) {
      this.usesOfCurrent = 0;
      if (isNew && this.lastObject) {
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
      }
    }
    this.seen[move.object_name] = true;
    this.lastObject = move.object_name;
    this.move = move;
    this.pendingMove = null;
    this.setPhase(this.hp <= this.finisherHp() ? "finisher" : "armed", now);
    const combo = this.combo > 0 ? ` New weapon combo x${(1 + Math.min(this.combo, 5) * 0.2).toFixed(1)}!` : "";
    const safety = move.unsafe ? " Careful, that one's dangerous. Grab something softer!" : move.fragile ? " Gently, it's fragile!" : "";
    this.announce(`${move.hype} ${GESTURE_HINT[move.gesture]}${combo}${safety}`, true);
  }
  applyEffect(m, now) {
    if (m.effect === "none" || m.effect === "multi")
      return;
    this.events.push({ type: "effect", effect: m.effect });
    if (m.effect === "stun")
      this.stunUntil = now + 2.5;
    if (m.effect === "slip")
      this.slipped = true;
    if (m.effect === "burn")
      this.burnUntil = now + 4;
  }
  credit(m, dmg) {
    const cur = this.damageBy[m.object_name] || { move: m.move_name, damage: 0 };
    cur.damage += dmg;
    cur.move = m.move_name;
    this.damageBy[m.object_name] = cur;
  }
  finish(now, won) {
    const objects = Object.keys(this.damageBy).map((name) => ({ name, move: this.damageBy[name].move, damage: this.damageBy[name].damage }));
    objects.sort((a, b) => b.damage - a.damage);
    this.setPhase("results", now);
    this.events.push({
      type: "results",
      summary: { won, seconds: Math.round(now - this.t0), mvp: objects.length ? objects[0].name : "nothing", objects, bestCombo: this.bestCombo }
    });
  }
  setPhase(p, now) {
    this.phase = p;
    this.phaseAt = now;
    this.events.push({ type: "phase", phase: p });
  }
  announce(text, speak) {
    this.events.push({ type: "announce", text, speak });
  }
}

// PocketKO/tools/preview/main.ts
var $ = (id) => document.getElementById(id);
var canvas = $("stage");
var renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
var scene = new THREE.Scene;
var camera = new THREE.PerspectiveCamera(46, 16 / 9, 1, 2000);
camera.position.set(0, 42, 62);
camera.lookAt(0, 14, 0);
scene.add(new THREE.HemisphereLight(16777215, 6702114, 2.2));
var sun = new THREE.DirectionalLight(16777215, 1.6);
sun.position.set(20, 60, 40);
scene.add(sun);
var shadow = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35 }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);
function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
var mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 });
var sphere = new THREE.SphereGeometry(0.5, 32, 24);
var R = 7;
var glorp = new THREE.Group;
var body = new THREE.Group;
glorp.add(body);
var bodyMat = mat(7598669);
function add(parent, geo, m, p, s) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(p[0], p[1], p[2]);
  o.scale.set(s[0], s[1], s[2]);
  parent.add(o);
  return o;
}
add(body, sphere, bodyMat, [0, R, 0], [2 * R, 2 * R * 0.92, 2 * R]);
add(body, sphere, mat(12582796), [0, R * 0.75, R * 0.55], [R * 1.1, R, R * 0.7]);
var pupils = [];
for (const s of [-1, 1]) {
  add(body, sphere, mat(16777215), [s * R * 0.38, R * 1.35, R * 0.78], [R * 0.62, R * 0.7, R * 0.5]);
  pupils.push(add(body, sphere, mat(657936), [s * R * 0.36, R * 1.32, R * 1], [R * 0.28, R * 0.32, R * 0.2]));
  add(body, sphere, mat(3709222), [s * R * 0.55, R * 0.12, R * 0.2], [R * 0.55, R * 0.3, R * 0.7]);
}
var mouth = add(body, sphere, mat(657936), [0, R * 0.85, R * 0.98], [R * 0.55, R * 0.22, R * 0.15]);
add(body, new THREE.CylinderGeometry(0.5, 0.5, 1, 12), mat(3709222), [0, R * 2.15, 0], [R * 0.08, R * 0.6, R * 0.08]);
add(body, sphere, mat(16769318), [0, R * 2.5, 0], [R * 0.3, R * 0.3, R * 0.3]);
var stars = [0, 1, 2].map(() => add(glorp, sphere, mat(16769318), [0, 0, 0], [1.4, 1.4, 1.4]));
scene.add(glorp);
var st = {
  squash: 1,
  vel: 0,
  drop: 70,
  flash: 0,
  burn: 0,
  tilt: 0,
  stun: 0,
  slip: 0,
  ko: false,
  pos: new THREE.Vector3,
  hopFrom: new THREE.Vector3,
  hopTo: new THREE.Vector3,
  hopT: 1,
  hopWait: 1.5,
  recoil: new THREE.Vector3
};
function kick(v) {
  st.vel += v;
}
var parts = [];
var COLORS2 = { yellow: 16769318, red: 16728128, orange: 16747546, blue: 4237055, purple: 11757311, green: 5898086, pink: 16741311, white: 16777215 };
var CONF = [16769318, 16728128, 4237055, 11757311, 5898086, 16741311, 16747546];
var box = new THREE.BoxGeometry(1, 0.15, 0.6);
function burst(at, color, n, speed, flat = false, g = 160, life = 0.6) {
  for (let i = 0;i < n; i++) {
    const dir = new THREE.Vector3(Math.random() * 2 - 1, 0.2 + Math.random() * (flat ? 1.6 : 1), Math.random() * 2 - 1).normalize();
    const size = flat ? 1 + Math.random() * 0.6 : 0.8 + Math.random() * 0.9;
    const o = new THREE.Mesh(flat ? box : sphere, new THREE.MeshStandardMaterial({ color: flat ? CONF[i % CONF.length] : i % 3 === 0 ? 16777215 : color, emissive: flat ? 0 : color, emissiveIntensity: 0.4 }));
    o.position.copy(at);
    o.scale.setScalar(size);
    scene.add(o);
    parts.push({ o, v: dir.multiplyScalar(speed * (0.5 + Math.random() * 0.5)), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life, max: life, g, size });
  }
}
function popup(text, color, big = false) {
  const head = glorp.position.clone().add(new THREE.Vector3(0, R * 2.6, 0)).project(camera);
  const el = document.createElement("div");
  el.className = "pop" + (big ? " big" : "");
  el.textContent = text;
  el.style.color = "#" + (COLORS2[color] || 16769318).toString(16).padStart(6, "0");
  el.style.left = `${(head.x + 1) / 2 * 100 + (Math.random() * 8 - 4)}%`;
  el.style.top = `${(1 - head.y) / 2 * 100}%`;
  $("hud").appendChild(el);
  setTimeout(() => el.remove(), big ? 1700 : 1100);
}
function announce(text) {
  const b = $("banner");
  b.textContent = text;
  b.classList.remove("show");
  b.offsetWidth;
  b.classList.add("show");
}
var ws = null;
function connectRelay() {
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ type: "hello", role: "page" }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "status" && m.state === "generating") {
      $("ko-img").src = "/stream.mjpg?" + Date.now();
      $("jumbo").classList.add("live");
    }
  };
  ws.onclose = () => setTimeout(connectRelay, 1500);
}
connectRelay();
var game = new PocketKOGame;
var demo = 0;
var t0 = performance.now() / 1000;
var now = () => performance.now() / 1000 - t0;
game.start(now());
function scan() {
  if (!game.beginScan(now()))
    return;
  const m = DEMO_MOVES[demo++ % DEMO_MOVES.length];
  setTimeout(() => game.moveReady(m), 1200);
}
function gesture(g) {
  game.gesture({ gesture: g, speed: 200 }, now());
}
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "e")
    scan();
  if (k === "s")
    gesture("slam");
  if (k === "a" || k === "d")
    gesture("swing");
  if (k === "w")
    gesture("poke");
  if (k === "q")
    gesture("toss");
  if (k === "k")
    game.debugSetHp(15, now());
  if (k === "r" && game.phase === "results")
    restart();
  if (k === "1" && ws)
    ws.send(JSON.stringify({ type: "steer", text: "slow mo" }));
  if (k === "2" && ws)
    ws.send(JSON.stringify({ type: "steer", text: "explosion" }));
});
window.pk = { scan, gesture, setHp: (h) => game.debugSetHp(h, now()), get phase() {
  return game.phase;
}, get hp() {
  return game.hp;
} };
function restart() {
  game = new PocketKOGame;
  game.start(now());
  st.ko = false;
  st.drop = 70;
  $("jumbo").classList.remove("live");
}
function onEvent(e) {
  const center = glorp.position.clone().add(new THREE.Vector3(0, R, 4));
  switch (e.type) {
    case "announce":
      announce(e.text);
      break;
    case "hit":
      kick(-6 - e.damage * 0.25);
      st.flash = 1;
      st.recoil.add(new THREE.Vector3(0, 0, -1).multiplyScalar(2 + e.damage * 0.12));
      burst(center.clone().add(new THREE.Vector3((e.index - 1) * 3, e.index * 2, 0)), COLORS2[e.color] || 16769318, e.crit ? 24 : 14, 70);
      popup(`${e.crit ? "CRIT " : ""}-${e.damage}${e.sloppy ? " (sloppy)" : "!"}`, e.sloppy ? "white" : e.crit ? "pink" : "yellow", e.crit);
      break;
    case "effect":
      if (e.effect === "stun")
        st.stun = 2.5;
      if (e.effect === "slip")
        st.slip = 1.4;
      if (e.effect === "burn")
        st.burn = 4;
      if (e.effect === "knockback")
        st.recoil.add(new THREE.Vector3(0, 0, -12));
      popup(e.effect.toUpperCase() + "!", "orange");
      break;
    case "burn_tick":
      popup(`-${e.damage}`, "orange");
      break;
    case "prewarm":
      ws?.send(JSON.stringify({ type: "prewarm" }));
      break;
    case "finisher_ready":
      popup("FINAL BLOW!", "red", true);
      break;
    case "ko":
      st.ko = true;
      kick(-10);
      burst(center.clone().add(new THREE.Vector3(0, 6, 0)), 16777215, 80, 120, true, 90, 2.2);
      popup("K.O.!", "pink", true);
      $("jumbo").classList.add("rolling");
      ws?.send(JSON.stringify({ type: "finisher", image: "", object: e.move.object_name, move: e.move.move_name, ko_action: e.move.ko_action }));
      setTimeout(() => game.koDone(now()), 19000);
      break;
    case "results": {
      const s = e.summary;
      $("card").innerHTML = `<b>${s.won ? `K.O. in ${s.seconds}s!` : "IT GOT AWAY"}</b><br>MVP: ${s.mvp}<br>${s.objects.map((o) => `${o.name}: ${o.damage}`).join(" · ")}<br>best combo x${s.bestCombo} · press R for a rematch`;
      break;
    }
  }
}
var last = performance.now();
function frame() {
  const t = performance.now();
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const n = now();
  game.tick(n, dt);
  for (const e of game.drain())
    onEvent(e);
  if (st.drop > 0) {
    st.drop = Math.max(0, st.drop - dt * 160);
    if (st.drop === 0)
      kick(-9);
  } else if (!st.ko && st.stun <= 0 && st.slip <= 0) {
    st.hopWait -= dt;
    if (st.hopWait <= 0 && st.hopT >= 1) {
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 10;
      st.hopFrom.copy(st.pos);
      st.hopTo.set(Math.cos(a) * d, 0, Math.sin(a) * d * 0.5);
      st.hopT = 0;
      st.hopWait = 1.2 + Math.random() * 1.6;
      kick(4);
    }
  }
  let lift = 0;
  if (st.hopT < 1) {
    st.hopT = Math.min(1, st.hopT + dt / 0.45);
    st.pos.lerpVectors(st.hopFrom, st.hopTo, st.hopT);
    lift = Math.sin(st.hopT * Math.PI) * 6;
    if (st.hopT >= 1)
      kick(-5);
  }
  st.recoil.multiplyScalar(Math.max(0, 1 - dt * 6));
  const target = st.ko ? 0.18 : 1;
  st.vel += ((target - st.squash) * 300 - st.vel * 12) * dt;
  st.squash += st.vel * dt;
  const breathe = st.ko ? 0 : Math.sin(n * 3.2) * 0.04;
  const sy = Math.max(0.1, st.squash + breathe);
  const sxz = Math.min(1.7, 1 / Math.sqrt(sy));
  body.scale.set(sxz, sy, sxz);
  st.stun = Math.max(0, st.stun - dt);
  st.slip = Math.max(0, st.slip - dt);
  st.tilt += ((st.slip > 0 ? 80 : 0) - st.tilt) * Math.min(1, dt * 10);
  glorp.position.set(st.pos.x + st.recoil.x, st.drop + lift, st.pos.z + st.recoil.z);
  glorp.rotation.set(0, 0, st.tilt * Math.PI / 180 + (st.stun > 0 ? Math.sin(n * 10) * 0.25 : 0));
  shadow.position.set(glorp.position.x, 0.05, glorp.position.z);
  shadow.scale.setScalar(st.ko ? 1.6 : 1 - Math.min(0.6, glorp.position.y / 80));
  st.flash = Math.max(0, st.flash - dt * 6);
  st.burn = Math.max(0, st.burn - dt);
  const base = new THREE.Color(7598669);
  if (st.burn > 0)
    base.lerp(new THREE.Color(16728128), 0.55 + 0.25 * Math.sin(n * 12));
  if (st.ko)
    base.lerp(new THREE.Color(3709222), 0.4);
  bodyMat.color.copy(base.lerp(new THREE.Color(16777215), st.flash));
  pupils.forEach((p, i) => {
    const s = i === 0 ? -1 : 1;
    const spinning = st.ko || st.stun > 0;
    const a = n * 9 + i * Math.PI;
    p.position.set(s * R * 0.36 + (spinning ? Math.cos(a) * R * 0.12 : 0), R * 1.32 + (spinning ? Math.sin(a) * R * 0.12 : 0), R);
  });
  mouth.scale.set(R * (st.ko ? 0.7 : st.flash > 0.3 ? 0.5 : 0.55), R * (st.ko ? 0.12 : st.flash > 0.3 ? 0.55 : 0.22), R * 0.15);
  stars.forEach((s, i) => {
    s.visible = st.stun > 0 || st.ko;
    const a = n * 4 + i * Math.PI * 2 / 3;
    s.position.set(Math.cos(a) * R * 0.9, R * 2.6 + Math.sin(n * 8 + i) * 1.2, Math.sin(a) * R * 0.9);
  });
  if (st.burn > 0 && Math.random() < dt * 14)
    burst(glorp.position.clone().add(new THREE.Vector3(0, R * 1.4, 0)), Math.random() < 0.5 ? 16747546 : 16769318, 1, 25, false, -20, 0.6);
  for (let i = parts.length - 1;i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.v.y -= p.g * dt;
    p.v.multiplyScalar(Math.max(0, 1 - dt * 1.5));
    p.o.position.addScaledVector(p.v, dt);
    p.o.rotation.x += p.spin.x * dt;
    p.o.rotation.y += p.spin.y * dt;
    p.o.scale.setScalar(p.size * Math.min(1, p.life / p.max * 2));
    if (p.life <= 0) {
      scene.remove(p.o);
      parts.splice(i, 1);
    }
  }
  const f = Math.max(0, game.hpFraction);
  const hp = $("hpfill");
  hp.style.width = `${f * 100}%`;
  hp.style.background = f > 0.5 ? "#59ff66" : f > 0.2 ? "#ffe126" : "#ff4040";
  $("hp").style.opacity = game.phase === "ko" || game.phase === "results" ? "0" : "1";
  const head = glorp.position.clone().add(new THREE.Vector3(0, R * 2.9 + 4, 0)).project(camera);
  $("hp").style.left = `${(head.x + 1) / 2 * 100}%`;
  $("hp").style.top = `${(1 - head.y) / 2 * 100}%`;
  if (game.phase !== "results") {
    const m = game.move;
    $("card").innerHTML = game.phase === "analyzing" ? "<b>ANALYZING YOUR WEAPON…</b><br><span class='spin'>●</span> cooldown" : m && (game.phase === "armed" || game.phase === "finisher") ? `<b>${m.move_name}</b><br>${GESTURE_HINT[m.gesture]} · ${m.damage} dmg${m.effect !== "none" ? " · " + m.effect : ""}<br><small>${m.object_name}</small>` : game.phase === "need_weapon" ? "<b>HOLD SOMETHING UP TO SCAN IT</b><br><small>press E</small>" : "";
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

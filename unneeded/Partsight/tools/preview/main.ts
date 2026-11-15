/**
 * Browser preview of Partsight diagrams using the SAME PartSpec + HeroSpecs code as the Lens.
 * Build + serve: bun Partsight/tools/preview/serve.ts  (then open http://localhost:5317)
 */
import * as THREE from "three"
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js"
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js"
import {
  PALETTE_RGBA,
  PartsSpec,
  explodeOrder,
  explodedPosition,
  partCallout,
  partStyle,
  badgeText,
  scaleLabel,
  validateSpec
} from "../../Assets/Partsight/Core/PartSpec"
import {heroCount, heroSpecByIndex} from "../../Assets/Partsight/Core/HeroSpecs"

const SHAPE_MESH: Record<string, string> = {
  box: "box", plate: "box", rbox: "rbox", ghost_shell: "rbox", cylinder: "cylinder", tube: "tube",
  capsule: "capsule", cone: "cone", sphere: "sphere", torus: "torus", u_shape: "u_shape", spring: "spring", gear: "gear"
}

// A deliberately messy "AI output" to show what the validator repairs.
const MESSY_AI = {
  object_name: "Desk stapler", archetype: "lever_spring",
  summary: "Pressing the top drives a blade that pushes one staple through paper onto the anvil.",
  bbox_2d: [300, 120, 700, 880], overall_mm: {x: 180, y: 55, z: 30},
  parts: [
    {id: "base", name: "Base", shape: "rbox", dims_mm: {x: 180, y: 8, z: 30}, pos_mm: {x: 0, y: -23, z: 0}, explode_mm: {x: 0, y: -30, z: 0}, color: "grey", function: "Holds the anvil and sits on the desk.", confidence: 0.95, hidden: false},
    {id: "anvil", name: "Anvil", shape: "plate", dims_mm: {x: 25, y: 2, z: 12}, pos_mm: {x: 70, y: -18, z: 0}, explode_mm: {x: 0, y: -15, z: 0}, color: "white", function: "Bends staple legs inward.", confidence: 0.9, hidden: false},
    {id: "magazine", name: "Staple magazine", shape: "box", dims_mm: {x: 140, y: 10, z: 14}, pos_mm: {x: 10, y: 2, z: 0}, explode_mm: {x: 0, y: 12, z: 0}, color: "blue", function: "Channel that holds the staple strip.", confidence: 0.9, hidden: false},
    {id: "spring", name: "Pusher spring", shape: "spring", dims_mm: {x: 80, y: 8, z: 8}, pos_mm: {x: 0, y: 2, z: 0}, explode_mm: {x: 0, y: 0, z: 0}, color: "yellow", function: "Pushes staples toward the front.", confidence: 0.95, hidden: true},
    {id: "spring", name: "Return spring", shape: "spring", dims_mm: {x: 20, y: 6, z: 6}, pos_mm: {x: -70, y: 5, z: 0}, rot_deg: {x: 0, y: 0, z: 90}, explode_mm: {x: -20, y: 30, z: 0}, color: "yellow", function: "Lifts the top lever back up.", confidence: 0.6, hidden: true},
    {id: "driver", name: "Driver blade", shape: "plate", dims_mm: {x: 13, y: 30, z: 1}, pos_mm: {x: 500, y: 0, z: 0}, explode_mm: {x: 30, y: 40, z: 0}, color: "teal", function: "Pushes one staple down.", confidence: 0.8, hidden: false},
    {id: "top_lever", name: "Top lever", shape: "rbox", dims_mm: {x: 175, y: 14, z: 28}, pos_mm: {x: 2, y: 20, z: 0}, explode_mm: {x: 0, y: 60, z: 0}, color: "red", function: "The part you press.", confidence: 0.95, hidden: false}
  ],
  how_it_works: [
    {text: "Press the top lever: the driver blade slides down.", part_ids: ["top_lever", "driver"], action: "press", axis: "y", amount: -5},
    {text: "This step points at a part that doesn't exist.", part_ids: ["ghost_part"], action: "slide"}
  ]
}

const loader = new OBJLoader()
const geoCache: Record<string, Promise<THREE.BufferGeometry>> = {}
function geometry(name: string): Promise<THREE.BufferGeometry> {
  if (!geoCache[name]) {
    geoCache[name] = loader.loadAsync(`/meshes/ps_${name}.obj`).then((g) => (g.children[0] as THREE.Mesh).geometry)
  }
  return geoCache[name]
}

interface View {
  spec: PartsSpec
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  pivots: {obj: THREE.Object3D; label: HTMLDivElement; i: number}[]
  order: number[]
  t: number
  el: HTMLElement
}

async function makeView(spec: PartsSpec, container: HTMLElement, extraNote = ""): Promise<View> {
  const card = document.createElement("section")
  card.className = "card"
  card.innerHTML = `
    <header>
      <h2>${spec.object_name}</h2>
      <span class="badge ${spec.design_label}">${badgeText(spec)}</span>
      <span class="scale">${scaleLabel(spec)}</span>
    </header>
    <div class="stage"></div>
    <div class="controls">
      <label>Explode <input type="range" min="0" max="2" step="0.01" value="1"></label>
      <button data-a="0">Assembled</button><button data-a="1">Exploded</button><button data-a="2">Explode more</button>
    </div>
    <p class="summary">${spec.summary}</p>
    ${extraNote}
    <ol class="parts"></ol>`
  container.appendChild(card)
  const stage = card.querySelector(".stage") as HTMLElement
  const w = stage.clientWidth || 420
  const h = 300
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true})
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  stage.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6))
  const dl = new THREE.DirectionalLight(0xffffff, 1.4)
  dl.position.set(1, 2, 3)
  scene.add(dl)
  const maxDim = Math.max(spec.overall_mm.x, spec.overall_mm.y, spec.overall_mm.z)
  // Frame the fully exploded layout, not just the assembled object.
  let extent = maxDim / 2
  for (const p of spec.parts) {
    const e = Math.max(Math.abs(p.pos_mm.x + p.explode_mm.x), Math.abs(p.pos_mm.y + p.explode_mm.y), Math.abs(p.pos_mm.z + p.explode_mm.z))
    extent = Math.max(extent, e + Math.max(p.dims_mm.x, p.dims_mm.y, p.dims_mm.z) / 2)
  }
  const camera = new THREE.PerspectiveCamera(35, w / h, 1, 5000)
  const dist = extent * 3.3
  camera.position.set(dist * 0.3, dist * 0.32, dist * 0.9)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.update()

  // Real-object outline at true size (what the ghost overlays on the glasses).
  const o = spec.overall_mm
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(o.x, o.y, o.z)),
    new THREE.LineBasicMaterial({color: 0x8899aa, transparent: true, opacity: 0.5})
  )
  scene.add(outline)

  const list = card.querySelector(".parts") as HTMLOListElement
  const pivots: View["pivots"] = []
  for (let i = 0; i < spec.parts.length; i++) {
    const p = spec.parts[i]
    const style = partStyle(p, spec)
    const rgba = PALETTE_RGBA[p.color]
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(rgba[0], rgba[1], rgba[2]),
      roughness: 0.55,
      metalness: p.material === "metal" ? 0.35 : 0.05,
      transparent: style !== "solid",
      opacity: style === "ghost" ? 0.15 : style === "dashed" ? 0.45 : 1,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(await geometry(SHAPE_MESH[p.shape] || "box"), mat)
    mesh.scale.set(p.dims_mm.x, p.dims_mm.y, p.dims_mm.z)
    const r = p.rot_deg
    mesh.rotation.set((r.x * Math.PI) / 180, (r.y * Math.PI) / 180, (r.z * Math.PI) / 180, "XYZ")
    if (style === "solid") {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 35), new THREE.LineBasicMaterial({color: 0x111418}))
      mesh.add(edges)
    }
    const pivot = new THREE.Object3D()
    pivot.add(mesh)
    scene.add(pivot)
    const label = document.createElement("div")
    label.className = "label" + (style === "dashed" ? " likely" : "")
    label.textContent = partCallout(p, i, spec)
    stage.appendChild(label)
    pivots.push({obj: pivot, label, i})
    const li = document.createElement("li")
    li.innerHTML = `<b>${p.name}</b>${style === "dashed" ? ' <em>(likely)</em>' : ""} — ${p.function} <span class="conf">${Math.round(p.confidence * 100)}%</span>`
    list.appendChild(li)
  }

  const view: View = {spec, scene, camera, renderer, controls, pivots, order: explodeOrder(spec.parts), t: 1, el: card}
  const slider = card.querySelector("input") as HTMLInputElement
  slider.oninput = () => (view.t = parseFloat(slider.value))
  card.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      view.t = parseFloat((b as HTMLElement).dataset.a!)
      slider.value = String(view.t)
    })
  )
  return view
}

function renderView(v: View) {
  const count = v.spec.parts.length
  const stage = v.renderer.domElement
  const w = stage.clientWidth,
    h = stage.clientHeight
  for (const pv of v.pivots) {
    const p = v.spec.parts[pv.i]
    const pos = explodedPosition(p, v.order[pv.i], count, v.t)
    pv.obj.position.set(pos.x, pos.y, pos.z)
    const s = new THREE.Vector3(pos.x, pos.y, pos.z).project(v.camera)
    pv.label.style.left = `${((s.x + 1) / 2) * w}px`
    pv.label.style.top = `${((1 - s.y) / 2) * h}px`
    pv.label.style.opacity = v.t > 0.15 && p.shape !== "ghost_shell" ? "1" : "0"
  }
  v.controls.update()
  v.renderer.render(v.scene, v.camera)
}

async function main() {
  const grid = document.getElementById("grid")!
  const views: View[] = []
  for (let i = 0; i < heroCount(); i++) views.push(await makeView(heroSpecByIndex(i), grid))
  const {spec, warnings} = validateSpec(MESSY_AI)
  const note = `<div class="fixes"><b>Validator repaired the AI output:</b><ul>${warnings.map((w) => `<li>${w}</li>`).join("")}</ul></div>`
  views.push(await makeView(spec, grid, note))
  const loop = () => {
    views.forEach(renderView)
    requestAnimationFrame(loop)
  }
  loop()
  ;(window as any).partsightReady = true
}

main()

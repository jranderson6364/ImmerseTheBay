/**
 * Hand-written "Verified" specs for the three hero objects.
 *
 * TODO before the demo: tape-measure the team's actual pen, flashlight, and padlock and
 * update overall_mm (and part sizes if they differ a lot). Until then these are
 * representative dimensions of common models: a click ballpoint pen, a 2xAA flashlight,
 * and a 40 mm pin-tumbler padlock.
 *
 * Same frame as PartSpec.ts: mm, origin at bbox centre, +X long axis, +Y up, +Z toward viewer.
 */
import {PartsSpec, validateSpec} from "./PartSpec"

interface HeroEntry {
  keywords: string[]
  raw: any
}

const PEN = {
  object_name: "Retractable ballpoint pen",
  archetype: "lever_spring",
  summary: "Each click pushes a rotating cam one notch, so it alternately locks the refill out or lets the spring pull it back.",
  safety_note: "",
  overall_mm: {x: 140, y: 11, z: 11},
  bbox_2d: [400, 100, 600, 900],
  parts: [
    {id: "lower_barrel", name: "Lower barrel + tip", shape: "tube", dims_mm: {x: 58, y: 11, z: 11}, pos_mm: {x: -41, y: 0, z: 0}, explode_mm: {x: -45, y: 0, z: 0}, color: "blue", material: "plastic", function: "Holds the refill straight and guides the tip out.", confidence: 0.95, hidden: false},
    {id: "spring", name: "Return spring", shape: "spring", dims_mm: {x: 16, y: 4.5, z: 4.5}, pos_mm: {x: -54, y: 0, z: 0}, explode_mm: {x: -20, y: -24, z: 0}, color: "yellow", material: "metal", function: "Pushes the refill back in when the cam releases it.", confidence: 0.95, hidden: true},
    {id: "refill", name: "Ink refill", shape: "cylinder", dims_mm: {x: 106, y: 3, z: 3}, pos_mm: {x: -10, y: 0, z: 0}, explode_mm: {x: 0, y: -40, z: 0}, color: "white", material: "plastic", function: "Ink tube with a rolling ball at the tip.", confidence: 0.95, hidden: true},
    {id: "upper_barrel", name: "Upper barrel (cam track)", shape: "tube", dims_mm: {x: 66, y: 11, z: 11}, pos_mm: {x: 21, y: 0, z: 0}, explode_mm: {x: 10, y: 0, z: 0}, color: "grey", material: "plastic", function: "Inside ridges stop the cam in the 'out' or 'in' position.", confidence: 0.9, hidden: false},
    {id: "rotating_cam", name: "Rotating cam", shape: "gear", dims_mm: {x: 10, y: 7, z: 7}, pos_mm: {x: 40, y: 0, z: 0}, explode_mm: {x: 22, y: 20, z: 0}, color: "orange", material: "plastic", function: "Turns one notch per click, alternating locked and released.", confidence: 0.9, hidden: true},
    {id: "plunger", name: "Plunger + thrust tube", shape: "cylinder", dims_mm: {x: 24, y: 6, z: 6}, pos_mm: {x: 58, y: 0, z: 0}, explode_mm: {x: 45, y: 0, z: 0}, color: "red", material: "plastic", function: "The button you press; its teeth push and twist the cam.", confidence: 0.95, hidden: false},
    {id: "clip", name: "Pocket clip", shape: "plate", dims_mm: {x: 42, y: 1.5, z: 4}, pos_mm: {x: 36, y: 0, z: 6.5}, explode_mm: {x: 0, y: 0, z: 26}, color: "green", material: "metal", function: "Clips the pen to a pocket.", confidence: 0.9, hidden: false}
  ],
  how_it_works: [
    {text: "Press the plunger: its teeth push the cam forward.", part_ids: ["plunger", "rotating_cam"], action: "press", axis: "x", amount: -5},
    {text: "The cam's angled teeth slide along the ridges and twist it one notch.", part_ids: ["rotating_cam", "upper_barrel"], action: "rotate", axis: "x", amount: 45},
    {text: "Now the cam catches on a short ridge, holding the refill tip out.", part_ids: ["rotating_cam", "refill"], action: "slide", axis: "x", amount: -6},
    {text: "The spring is compressed, ready to pull the tip back on the next click.", part_ids: ["spring"], action: "compress", axis: "x", amount: 6}
  ]
}

const FLASHLIGHT = {
  object_name: "2xAA LED flashlight",
  archetype: "electrical_circuit",
  summary: "The tail switch closes a loop: batteries, spring, body tube, LED. The reflector turns the LED's light into a beam.",
  safety_note: "",
  overall_mm: {x: 150, y: 34, z: 34},
  bbox_2d: [350, 100, 650, 900],
  parts: [
    {id: "tail_cap", name: "Tail cap", shape: "tube", dims_mm: {x: 16, y: 28, z: 28}, pos_mm: {x: -67, y: 0, z: 0}, explode_mm: {x: -60, y: 0, z: 0}, color: "grey", material: "metal", function: "Screws onto the body and holds the switch and spring.", confidence: 0.95, hidden: false},
    {id: "tail_switch", name: "Click switch", shape: "cylinder", dims_mm: {x: 8, y: 14, z: 14}, pos_mm: {x: -70, y: 0, z: 0}, explode_mm: {x: -40, y: -22, z: 0}, color: "red", material: "electronics", function: "Opens or closes the circuit each time you click it.", confidence: 0.9, hidden: true},
    {id: "tail_spring", name: "Contact spring", shape: "spring", dims_mm: {x: 9, y: 11, z: 11}, pos_mm: {x: -57, y: 0, z: 0}, explode_mm: {x: -30, y: 0, z: 0}, color: "yellow", material: "metal", function: "Presses the batteries together and conducts current.", confidence: 0.95, hidden: true},
    {id: "battery_1", name: "AA cell (1.5 V)", shape: "cylinder", dims_mm: {x: 50, y: 14.5, z: 14.5}, pos_mm: {x: -27, y: 0, z: 0}, explode_mm: {x: -10, y: -30, z: 0}, color: "green", material: "electronics", function: "Stores energy; 2 cells in series give about 3 V.", confidence: 0.95, hidden: true},
    {id: "battery_2", name: "AA cell (1.5 V)", shape: "cylinder", dims_mm: {x: 50, y: 14.5, z: 14.5}, pos_mm: {x: 23, y: 0, z: 0}, explode_mm: {x: 10, y: -30, z: 0}, color: "green", material: "electronics", function: "Second cell; its + end touches the LED module.", confidence: 0.95, hidden: true},
    {id: "body_tube", name: "Body tube", shape: "tube", dims_mm: {x: 104, y: 26, z: 26}, pos_mm: {x: -7, y: 0, z: 0}, explode_mm: {x: 0, y: 26, z: 0}, color: "blue", material: "metal", function: "Holds the batteries and carries current back to the head.", confidence: 0.95, hidden: false},
    {id: "led_module", name: "LED + driver board", shape: "cylinder", dims_mm: {x: 6, y: 16, z: 16}, pos_mm: {x: 50, y: 0, z: 0}, explode_mm: {x: 22, y: 0, z: 0}, color: "purple", material: "electronics", function: "Turns current into light (driver shown at block level).", confidence: 0.85, hidden: true},
    {id: "reflector", name: "Reflector", shape: "cone", dims_mm: {x: 16, y: 30, z: 30}, pos_mm: {x: 61, y: 0, z: 0}, explode_mm: {x: 38, y: 0, z: 0}, color: "white", material: "metal", function: "Mirror cone that focuses the light into a beam.", confidence: 0.9, hidden: true},
    {id: "lens", name: "Lens", shape: "cylinder", dims_mm: {x: 2, y: 30, z: 30}, pos_mm: {x: 70, y: 0, z: 0}, explode_mm: {x: 52, y: 0, z: 0}, color: "white", material: "glass", function: "Clear window that protects the reflector.", confidence: 0.9, hidden: false},
    {id: "bezel", name: "Head bezel", shape: "tube", dims_mm: {x: 30, y: 34, z: 34}, pos_mm: {x: 60, y: 0, z: 0}, explode_mm: {x: 66, y: 0, z: 0}, color: "orange", material: "metal", function: "Screws on and clamps the lens and reflector.", confidence: 0.95, hidden: false}
  ],
  how_it_works: [
    {text: "Click the switch: the circuit closes.", part_ids: ["tail_switch"], action: "press", axis: "x", amount: 2},
    {text: "Current flows from the cells through the spring and body tube.", part_ids: ["battery_1", "battery_2", "tail_spring", "body_tube"], action: "flow", axis: "x", amount: 0},
    {text: "The LED lights up.", part_ids: ["led_module"], action: "glow", axis: "x", amount: 0},
    {text: "The reflector bounces the light forward into a beam.", part_ids: ["reflector", "lens"], action: "glow", axis: "x", amount: 0}
  ]
}

const PADLOCK = {
  object_name: "Pin-tumbler padlock",
  archetype: "latch_lock",
  summary: "The right key lifts every pin split to the plug's edge, so the plug turns and frees the shackle.",
  safety_note: "",
  overall_mm: {x: 40, y: 66, z: 20},
  bbox_2d: [200, 300, 800, 700],
  parts: [
    {id: "body", name: "Lock body", shape: "rbox", dims_mm: {x: 40, y: 38, z: 20}, pos_mm: {x: 0, y: -14, z: 0}, explode_mm: {x: 0, y: -22, z: -18}, color: "grey", material: "metal", function: "Hard steel case that holds the cylinder and latch.", confidence: 0.95, hidden: false},
    {id: "shackle", name: "Shackle", shape: "u_shape", dims_mm: {x: 28, y: 40, z: 6}, pos_mm: {x: 0, y: 13, z: 0}, explode_mm: {x: 0, y: 34, z: 0}, color: "blue", material: "metal", function: "The U-bar that loops through what you are locking.", confidence: 0.95, hidden: false},
    {id: "locking_balls", name: "Locking balls", shape: "sphere", dims_mm: {x: 20, y: 6, z: 6}, pos_mm: {x: 0, y: -2, z: 0}, explode_mm: {x: 26, y: 8, z: 0}, color: "yellow", material: "metal", function: "Pushed into notches on the shackle to hold it shut.", confidence: 0.8, hidden: true},
    {id: "plug", name: "Plug (key cylinder)", shape: "cylinder", dims_mm: {x: 16, y: 12, z: 12}, pos_mm: {x: 0, y: -20, z: 2}, rot_deg: {x: 0, y: 90, z: 0}, explode_mm: {x: 0, y: -10, z: 34}, color: "orange", material: "metal", function: "Turns only when every pin split lines up with its edge.", confidence: 0.95, hidden: true},
    {id: "key_pins", name: "Key pins (5)", shape: "plate", dims_mm: {x: 14, y: 5, z: 3}, pos_mm: {x: 0, y: -12, z: 2}, explode_mm: {x: -26, y: 4, z: 16}, color: "red", material: "metal", function: "Different lengths; the key's cuts lift each to the right height.", confidence: 0.95, hidden: true},
    {id: "driver_pins", name: "Driver pins (5)", shape: "plate", dims_mm: {x: 14, y: 5, z: 3}, pos_mm: {x: 0, y: -6, z: 2}, explode_mm: {x: -26, y: 14, z: 16}, color: "purple", material: "metal", function: "Block the plug from turning until the key pushes them up.", confidence: 0.95, hidden: true},
    {id: "pin_springs", name: "Pin springs (5)", shape: "spring", dims_mm: {x: 6, y: 4, z: 4}, pos_mm: {x: 0, y: -1, z: 2}, rot_deg: {x: 0, y: 0, z: 90}, explode_mm: {x: -26, y: 24, z: 16}, color: "yellow", material: "metal", function: "Push the pins down into the plug.", confidence: 0.95, hidden: true},
    {id: "keyway", name: "Keyway", shape: "plate", dims_mm: {x: 2, y: 10, z: 1}, pos_mm: {x: 0, y: -20, z: 9.5}, explode_mm: {x: 0, y: -10, z: 46}, color: "white", material: "metal", function: "Slot shaped so only the matching key profile enters.", confidence: 0.9, hidden: false}
  ],
  how_it_works: [
    {text: "Insert the key: its cuts lift each key pin.", part_ids: ["keyway", "key_pins"], action: "slide", axis: "y", amount: 3},
    {text: "Every split between key pin and driver pin meets the plug's edge.", part_ids: ["key_pins", "driver_pins", "pin_springs"], action: "compress", axis: "y", amount: 2},
    {text: "Nothing blocks the plug now, so it turns.", part_ids: ["plug"], action: "rotate", axis: "z", amount: 90},
    {text: "The balls drop free and the spring pops the shackle open.", part_ids: ["locking_balls", "shackle"], action: "slide", axis: "y", amount: 8}
  ]
}

const HEROES: HeroEntry[] = [
  {keywords: ["pen", "ballpoint", "click pen", "retractable"], raw: PEN},
  {keywords: ["flashlight", "torch"], raw: FLASHLIGHT},
  {keywords: ["padlock", "lock"], raw: PADLOCK}
]

export const HERO_NAMES = HEROES.map((h) => h.raw.object_name as string)

/** Returns a Verified spec if the identified object name matches a hero, else null. */
export function findHeroSpec(objectName: string): PartsSpec | null {
  const n = (objectName || "").toLowerCase()
  for (const h of HEROES) {
    // Avoid "pencil", "open", "pendant" etc. matching "pen": whole word only.
    if (h.keywords.some((k) => new RegExp("\\b" + k + "s?\\b").test(n))) {
      return validateSpec(h.raw, {designLabel: "verified", scaleSource: "authored"}).spec
    }
  }
  return null
}

export function heroSpecByIndex(i: number): PartsSpec {
  const h = HEROES[((i % HEROES.length) + HEROES.length) % HEROES.length]
  return validateSpec(h.raw, {designLabel: "verified", scaleSource: "authored"}).spec
}

export function heroCount(): number {
  return HEROES.length
}

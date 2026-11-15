/**
 * Pocket KO moves: Gemini prompt + schema, and a validator that keeps AI-invented moves fun and fair.
 * Pure TypeScript (no Lens globals): runs in Lens Studio and in `bun test parked/PocketKO/tests`.
 */

export const GESTURES = ["slam", "swing", "poke", "toss"] as const
export type Gesture = (typeof GESTURES)[number]

export const EFFECTS = ["none", "stun", "burn", "slip", "multi", "knockback"] as const
export type Effect = (typeof EFFECTS)[number]

export const COLORS = ["yellow", "red", "orange", "blue", "purple", "green", "pink", "white"] as const
export type FxColor = (typeof COLORS)[number]

export const MIN_DAMAGE = 10
export const MAX_DAMAGE = 30

export interface Move {
  object_name: string
  move_name: string
  damage: number
  effect: Effect
  gesture: Gesture
  /** What the announcer yells. */
  hype: string
  /** Colour of hit sparks. */
  color: FxColor
  /** One sentence for the Orbis KO cinematic: what this object does to the monster. */
  ko_action: string
  /** True for phones, glasses, laptops, glass, etc.: forces a gentle poke. */
  fragile: boolean
  /** True for knives, scissors, heavy or hot things: the player is told to pick something else. */
  unsafe: boolean
}

export const GESTURE_HINT: Record<Gesture, string> = {
  slam: "SLAM it down!",
  swing: "SWING it sideways!",
  poke: "POKE forward!",
  toss: "TOSS it up!"
}

export const MOVE_SYSTEM_PROMPT = `You are the hype announcer and game designer for Pocket KO, an AR game where a goofy green blob monster lands on the player's table and the player fights it with whatever real object they are holding up to the camera.

Look at the image. Find the ONE object the player is holding up or presenting (closest, most central, in a hand if visible). Invent a ridiculous, funny cartoon attack for it.

Rules:
- object_name: plain name, 1-3 words ("banana", "car keys", "water bottle").
- move_name: punny, 2-4 words, ALL CAPS allowed ("POTASSIUM SLAM", "KEY JAB", "HYDRO SPLASH").
- damage: 10-30. Soft or small things lower, big satisfying things higher. Keep it fair.
- gesture: the physical motion the player makes with the real object: slam (down), swing (sideways), poke (forward jab), toss (upward flick). Pick what fits the object.
- effect: one of none, stun, burn, slip, multi, knockback. Bananas slip, spicy or hot-looking things burn, keys or many small parts multi-hit, heavy things knockback, loud things stun.
- hype: what the announcer yells, max 80 characters, funny, family friendly.
- color: spark colour that matches the object.
- ko_action: one vivid sentence (max 160 characters) describing a GIANT cartoon version of this object knocking out a green blob monster, e.g. "A huge banana drops from the sky and squashes the green blob monster flat like a pancake."
- fragile: true for phones, glasses, laptops, tablets, glass or ceramic items, cameras, jewelry. Fragile items must use gesture "poke".
- unsafe: true for knives, scissors, blades, needles, lighters, hot drinks, heavy tools, or anything dangerous to swing. If unsafe, still fill the fields but keep damage 10.
- If no object is clearly held up, use object_name "bare hands", move "JAZZ HANDS", gesture "poke", effect "none", damage 10.`

export const GEMINI_MOVE_SCHEMA = {
  type: "object",
  properties: {
    object_name: {type: "string"},
    move_name: {type: "string"},
    damage: {type: "number"},
    effect: {type: "string", enum: [...EFFECTS]},
    gesture: {type: "string", enum: [...GESTURES]},
    hype: {type: "string"},
    color: {type: "string", enum: [...COLORS]},
    ko_action: {type: "string"},
    fragile: {type: "boolean"},
    unsafe: {type: "boolean"}
  },
  required: ["object_name", "move_name", "damage", "effect", "gesture", "hype", "color", "ko_action", "fragile", "unsafe"]
}

const FRAGILE_WORDS = ["phone", "iphone", "glasses", "laptop", "tablet", "ipad", "camera", "glass", "mug", "watch", "airpods", "earbuds", "spectacles"]
const UNSAFE_WORDS = ["knife", "scissors", "blade", "razor", "needle", "lighter", "hammer", "box cutter", "screwdriver", "hot coffee", "candle"]

function words(name: string, list: string[]): boolean {
  const n = name.toLowerCase()
  return list.some((w) => new RegExp("\\b" + w + "(s|es)?\\b").test(n))
}

function str(v: any, max: number, fallback: string): string {
  if (typeof v !== "string") return fallback
  const s = v.replace(/\s+/g, " ").trim()
  if (!s) return fallback
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s
}

function oneOf<T extends string>(v: any, allowed: readonly T[], fallback: T): T {
  if (typeof v !== "string") return fallback
  const s = v.trim().toLowerCase()
  return (allowed as readonly string[]).indexOf(s) >= 0 ? (s as T) : fallback
}

export const FALLBACK_MOVE: Move = {
  object_name: "mystery object",
  move_name: "MYSTERY BONK",
  damage: 15,
  effect: "none",
  gesture: "slam",
  hype: "Nobody knows what that is, but it's going to HURT!",
  color: "purple",
  ko_action: "A giant mystery object falls from the sky and bonks the green blob monster flat.",
  fragile: false,
  unsafe: false
}

/** Turns whatever Gemini returned into a safe, playable Move. Never throws. */
export function validateMove(raw: any): {move: Move; warnings: string[]} {
  const warnings: string[] = []
  if (raw == null || typeof raw !== "object") {
    return {move: {...FALLBACK_MOVE}, warnings: ["move was not an object; using fallback"]}
  }
  const object_name = str(raw.object_name, 30, FALLBACK_MOVE.object_name).toLowerCase()
  let damage = typeof raw.damage === "number" && isFinite(raw.damage) ? Math.round(raw.damage) : 15
  if (damage < MIN_DAMAGE || damage > MAX_DAMAGE) warnings.push(`damage ${damage} clamped`)
  damage = Math.max(MIN_DAMAGE, Math.min(MAX_DAMAGE, damage))

  let gesture = oneOf(raw.gesture, GESTURES, "slam")
  const fragile = raw.fragile === true || words(object_name, FRAGILE_WORDS)
  const unsafe = raw.unsafe === true || words(object_name, UNSAFE_WORDS)
  if (fragile && gesture !== "poke") {
    warnings.push(`fragile ${object_name}: gesture forced to poke`)
    gesture = "poke"
  }
  if (unsafe) damage = MIN_DAMAGE

  return {
    move: {
      object_name,
      move_name: str(raw.move_name, 28, FALLBACK_MOVE.move_name).toUpperCase(),
      damage,
      effect: oneOf(raw.effect, EFFECTS, "none"),
      gesture,
      hype: str(raw.hype, 80, "Here it comes!"),
      color: oneOf(raw.color, COLORS, "yellow"),
      ko_action: str(raw.ko_action, 160, `A giant ${object_name} knocks out the green blob monster.`),
      fragile,
      unsafe
    },
    warnings
  }
}

/** Canned moves for Preview/offline play and the browser preview. */
export const DEMO_MOVES: Move[] = [
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
]

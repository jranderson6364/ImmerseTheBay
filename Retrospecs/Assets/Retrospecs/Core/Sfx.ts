/**
 * UI sound effects: a click for every button press and a whoosh when a card or the chat pops up.
 * Own AudioComponents (a small pool per sound), so effects overlap each other and never cut off narration.
 * The clips are synthesised by tools/build-sfx.py.
 */

type SfxName = "click" | "whoosh"

const CLIPS: Record<SfxName, () => AudioTrackAsset> = {
  click: () => requireAsset("../Audio/sfx/click.wav") as AudioTrackAsset,
  whoosh: () => requireAsset("../Audio/sfx/whoosh.wav") as AudioTrackAsset
}

const VOLUME: Record<SfxName, number> = {click: 0.55, whoosh: 0.6}
const POOL = 3
/** The same effect twice inside this window plays once (a bounce, or two calls for one pop-up). */
const MIN_GAP_SEC: Record<SfxName, number> = {click: 0.06, whoosh: 0.2}

let holder: SceneObject = null
const pools: Partial<Record<SfxName, AudioComponent[]>> = {}
const lastAt: Partial<Record<SfxName, number>> = {}
let enabled = true

export function setSfxEnabled(on: boolean) {
  enabled = on
}

function pool(name: SfxName): AudioComponent[] {
  if (pools[name]) return pools[name]
  if (!holder || isNull(holder)) holder = global.scene.createSceneObject("RetrospecsSfx")
  const track = CLIPS[name]()
  const list: AudioComponent[] = []
  for (let i = 0; i < POOL; i++) {
    const a = holder.createComponent("AudioComponent") as AudioComponent
    a.audioTrack = track
    list.push(a)
  }
  pools[name] = list
  return list
}

/** Plays `name` at `volume` x its base level. Never throws: a missing clip just stays silent. */
export function playSfx(name: SfxName, volume = 1) {
  if (!enabled) return
  try {
    const now = getTime()
    const last = lastAt[name]
    if (last !== undefined && now - last < MIN_GAP_SEC[name]) return
    lastAt[name] = now
    const list = pool(name)
    const a = list.filter((c) => !c.isPlaying())[0] || list[0]
    if (a.isPlaying()) a.stop(false)
    a.volume = VOLUME[name] * volume
    a.play(1)
  } catch (e) {
    print(`[Retrospecs] sfx ${name} unavailable: ${e}`)
  }
}

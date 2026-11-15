/**
 * Bakes every narration segment to an MP3 with ElevenLabs, for the Lens to play instantly and offline.
 *
 *   bun Retrospecs/tools/bake-voice.ts --dry-run     # count characters (the billing unit), call nothing
 *   bun Retrospecs/tools/bake-voice.ts               # bake missing clips (existing files are skipped)
 *   bun Retrospecs/tools/bake-voice.ts --only hoover # one building
 *   bun Retrospecs/tools/bake-voice.ts --force       # re-bake everything
 *
 * Reads ELEVENLABS_API_KEY (and optional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL) from Retrospecs/tools/.env, which
 * is gitignored. Writes Assets/Retrospecs/Audio/narration/<building>_<n>.mp3 (22.05 kHz, 32 kbps mono, small).
 * Then in Lens Studio: select every clip in that folder and drag them into RetrospecsGuide > Narration Clips.
 */
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from "fs"
import {join} from "path"

const here = import.meta.dir
loadEnv(join(here, ".env"))
loadEnv(join(here, "..", "..", ".env")) // repo-root .env works too (also gitignored)

const args = process.argv.slice(2)
const dry = args.includes("--dry-run")
const force = args.includes("--force")
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : ""

const KEY = (process.env.ELEVENLABS_API_KEY || "").trim()
// Default: "Rachel", a premade ElevenLabs voice every account has. Override with ELEVENLABS_VOICE_ID.
const VOICE = (process.env.ELEVENLABS_VOICE_ID || "").trim() || "21m00Tcm4TlvDq8ikWAM"
const MODEL = (process.env.ELEVENLABS_MODEL || "").trim() || "eleven_multilingual_v2"
const FORMAT = "mp3_22050_32"
const OUT = join(here, "..", "Assets", "Retrospecs", "Audio", "narration")

const src = JSON.parse(readFileSync(join(here, "narration", "narration.json"), "utf8"))
const jobs: {clip: string; text: string}[] = []
for (const l of src.landmarks) {
  if (only && l.id !== only) continue
  l.segments.forEach((s: any, i: number) => jobs.push({clip: `${l.id}_${i}`, text: s.text}))
}
const todo = jobs.filter((j) => force || !existsSync(join(OUT, j.clip + ".mp3")))
const chars = todo.reduce((n, j) => n + j.text.length, 0)
const allChars = jobs.reduce((n, j) => n + j.text.length, 0)
console.log(`${jobs.length} clips (${allChars} chars); to bake now: ${todo.length} clips, ${chars} chars. Voice ${VOICE}, model ${MODEL}.`)
console.log(`Estimated audio: ~${Math.round(allChars / 900)} min, ~${((allChars / 900) * 60 * 4) / 1024 | 0} MB at 32 kbps.`)
if (dry) process.exit(0)
if (!KEY) {
  console.error("No ELEVENLABS_API_KEY. Put it in Retrospecs/tools/.env and re-run.")
  process.exit(1)
}
mkdirSync(OUT, {recursive: true})

let done = 0
let failed = 0
async function bake(j: {clip: string; text: string}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`, {
      method: "POST",
      headers: {"xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg"},
      body: JSON.stringify({text: j.text, model_id: MODEL, voice_settings: {stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true}})
    })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(join(OUT, j.clip + ".mp3"), buf)
      done++
      console.log(`ok  ${j.clip}  ${(buf.length / 1024).toFixed(0)} KB  (${done}/${todo.length})`)
      return
    }
    const body = await res.text()
    // Auth / quota problems won't fix themselves: stop instead of burning retries.
    if (res.status === 401 || res.status === 402 || /quota|credits/i.test(body)) {
      console.error(`FATAL ${res.status} on ${j.clip}: ${body.slice(0, 300)}`)
      process.exit(2)
    }
    console.error(`retry ${attempt} ${j.clip}: ${res.status} ${body.slice(0, 200)}`)
    await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
  failed++
}

// Three at a time (ElevenLabs' concurrency limit on most plans).
const queue = [...todo]
await Promise.all([0, 1, 2].map(async () => {
  while (queue.length) await bake(queue.shift()!)
}))
let total = 0
for (const j of jobs) if (existsSync(join(OUT, j.clip + ".mp3"))) total += statSync(join(OUT, j.clip + ".mp3")).size
console.log(`done: ${done} baked, ${failed} failed. Folder total ${(total / 1024 / 1024).toFixed(1)} MB in ${OUT}`)

function loadEnv(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

/**
 * The guide's voice and brain, over the Remote Service Gateway (same request shapes as Partsight).
 *  - ask(): one Gemini call with a response schema -> validated answer (lights, threads, fact ids, connective)
 *  - speak(): OpenAI TTS through the gateway, one clip at a time
 * If the network fails, the controller falls back to local facts (Core/Guide.ts), so the demo keeps going.
 */
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {GeminiTypes} from "RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes"
import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {NARRATION_CLIPS} from "../Data/NarrationClips"
import {GUIDE_SCHEMA, GUIDE_SYSTEM_PROMPT, ValidatedAnswer, buildGuidePrompt, validateGuide} from "../Core/Guide"
import {LIVE_SYSTEM_PROMPT, LiveAnswer, LiveTurn, buildLivePrompt, parseLiveReply, parseOpenAILiveReply} from "../Core/AskLive"
import {Card} from "../Core/Cards"
import {PRI_PREFETCH, PRI_SPEAK, TTS_MAX_IN_FLIGHT, pickNext, retryDelaySec, shouldRetry, startWaitSec} from "../Core/Throttle"

@component
export class RetrospecsGuide extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Retrospecs Guide</span><br/><span style="color: #94A3B8; font-size: 11px;">Needs a Remote Service Gateway token on the scene\'s credentials object.</span>')
  @input model: string = "gemini-2.5-flash"
  @input speakResponses: boolean = true
  @input ttsVoice: string = "coral"
  @input @hint("Seconds before an unanswered question falls back to a local fact") timeoutSec: number = 8
  @input logTimings: boolean = true
  @input @hint("Ask further: model for live, Google-Search-grounded answers") liveModel: string = "gemini-2.5-flash"
  @input @hint("Ask further: seconds before a live web answer gives up (search takes longer than the card guide)") liveTimeoutSec: number = 18
  @input @hint("Ask further: if Gemini grounding fails, retry with OpenAI's web-search model") liveFallbackOpenAI: boolean = true
  @input liveFallbackModel: string = "gpt-4o-mini-search-preview"
  @input @hint("Pre-baked ElevenLabs narration (Audio/narration/*.mp3, named <building>_<n>). Drag the whole folder in. Missing clips fall back to live TTS.") narrationClips: AudioTrackAsset[] = []

  private audio: AudioComponent = null
  private speechToken = 0

  ask(question: string, focusId: string, profile: string, heard: string[]): Promise<ValidatedAnswer> {
    const started = getTime()
    const req: GeminiTypes.Models.GenerateContentRequest = {
      model: this.model,
      type: "generateContent",
      body: {
        contents: [{role: "user", parts: [{text: buildGuidePrompt(question, focusId, profile, heard)}]}],
        systemInstruction: {parts: [{text: GUIDE_SYSTEM_PROMPT}]},
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          response_schema: GUIDE_SCHEMA as any
        }
      }
    }
    const call = Gemini.models(req).then((response) => {
      if (this.logTimings) print(`[Retrospecs] guide answer after ${(getTime() - started).toFixed(2)} s`)
      const v = validateGuide(parseJson(response), heard)
      if (v.rejected.length) print("[Retrospecs] validator dropped: " + v.rejected.join(", "))
      return v
    })
    return withTimeout(call, this.timeoutSec, this)
  }

  /**
   * "Ask further": a live, web-grounded answer about one building (Gemini + Google Search). If Gemini errors or
   * comes back without grounding, tries OpenAI's web-search model once. Resolves with the best answer it got
   * (check `grounded` before calling it "from the web"); rejects only when neither produced any text.
   */
  askLive(question: string, card: Card | undefined, told: string[], recent: LiveTurn[], profile: string): Promise<LiveAnswer> {
    const started = getTime()
    const prompt = buildLivePrompt(question, card, told, recent, profile)
    const req: GeminiTypes.Models.GenerateContentRequest = {
      model: this.liveModel,
      type: "generateContent",
      body: {
        contents: [{role: "user", parts: [{text: prompt}]}],
        systemInstruction: {parts: [{text: LIVE_SYSTEM_PROMPT}]},
        // Grounding can't be combined with a JSON response schema on 2.5, so this call returns plain text.
        tools: [{google_search: {}} as any],
        // No thinking: it counts against maxOutputTokens (answers came back cut off) and adds latency.
        generationConfig: {temperature: 0.4, maxOutputTokens: 800, thinkingConfig: {thinkingBudget: 0}} as any
      }
    }
    const gemini = withTimeout(Gemini.models(req), this.liveTimeoutSec, this).then((response) => {
      const a = parseLiveReply(response)
      const cand = response && (response as any).candidates && (response as any).candidates[0]
      print(`[Retrospecs] live answer after ${(getTime() - started).toFixed(2)} s, groundingMetadata: ${cand && cand.groundingMetadata ? "yes" : "NO"}` + (a && a.queries.length ? `, searched: ${a.queries.join(" | ")}` : ""))
      if (!a) throw "empty live answer"
      return a
    })
    if (!this.liveFallbackOpenAI) return gemini
    return gemini
      .then((a) => (a.grounded ? a : this.askLiveOpenAI(prompt, started).then((b) => (b.grounded ? b : a), () => a)))
      .catch((e) => {
        print("[Retrospecs] Gemini live failed (" + e + "), trying OpenAI web search")
        return this.askLiveOpenAI(prompt, started)
      })
  }

  private askLiveOpenAI(prompt: string, started: number): Promise<LiveAnswer> {
    const call = OpenAI.chatCompletions({
      model: this.liveFallbackModel,
      messages: [
        {role: "system", content: LIVE_SYSTEM_PROMPT},
        {role: "user", content: prompt}
      ],
      web_search_options: {}
    } as any).then((response) => {
      const a = parseOpenAILiveReply(response)
      print(`[Retrospecs] OpenAI live answer after ${(getTime() - started).toFixed(2)} s, citations: ${a ? a.sources.length : 0}`)
      if (!a) throw "empty OpenAI live answer"
      return a
    })
    return withTimeout(call, this.liveTimeoutSec, this)
  }

  /**
   * Speaks text; a newer call interrupts an older one. `onDone` runs once when this clip finishes playing (or,
   * if speech is off or TTS fails, after a reading-time delay), and never if a newer clip interrupted it.
   */
  speak(text: string, onDone?: () => void): Promise<void> {
    return this.speakParts([text], onDone)
  }

  /**
   * Speaks several clips back to back (e.g. Gemini's connective, then each sourced fact). All clips are requested
   * at once and cached by text, so prefetched facts start instantly and only new text waits on the network.
   */
  speakParts(parts: string[], onDone?: () => void): Promise<void> {
    const token = ++this.speechToken
    const texts = parts.map((p) => (p || "").trim()).filter(Boolean)
    const finish = () => {
      if (token === this.speechToken && onDone) onDone()
    }
    if (!texts.length) return Promise.resolve()
    print("[Retrospecs] say: " + texts.join(" "))
    const readingTime = (t: string) => Math.max(1.5, t.split(/\s+/).length / 3)
    if (!this.speakResponses) {
      this.after(texts.reduce((s, t) => s + readingTime(t), 0), finish)
      return Promise.resolve()
    }
    if (this.audio && this.audio.isPlaying()) this.audio.stop(false)
    const started = getTime()
    const clips = texts.map((t) => this.tts(t))
    const playAt = (i: number) => {
      if (token !== this.speechToken) return
      if (i >= texts.length) return finish()
      clips[i]
        .then((track) => {
          if (token !== this.speechToken) return
          if (i === 0 && this.logTimings) print(`[Retrospecs] first audio after ${(getTime() - started).toFixed(2)} s${this.lastCachedFlags[0] ? " (cached)" : ""}`)
          if (!this.audio) this.audio = this.getSceneObject().createComponent("AudioComponent") as AudioComponent
          if (this.audio.isPlaying()) this.audio.stop(false)
          this.audio.audioTrack = track
          this.audio.setOnFinish(() => playAt(i + 1))
          this.audio.play(1)
        })
        .catch((e) => {
          print("[Retrospecs] TTS failed: " + e)
          this.after(readingTime(texts[i]), () => playAt(i + 1))
        })
    }
    this.lastCachedFlags = texts.map((t) => !!this.ready[t])
    playAt(0)
    return Promise.resolve()
  }

  private clipIndex: Record<string, AudioTrackAsset> = null

  /** Bundled narration clip by name (`hoover_0`), or null. */
  bakedClip(name: string): AudioTrackAsset | null {
    if (!this.clipIndex) {
      this.clipIndex = {}
      for (const a of this.narrationClips || []) {
        if (!a) continue
        const n = (a.name || "").replace(/\.(mp3|wav|ogg|m4a)$/i, "")
        this.clipIndex[n] = a
      }
      print(`[Retrospecs] ${Object.keys(this.clipIndex).length} dragged-in + ${Object.keys(NARRATION_CLIPS).length} bundled narration clips`)
    }
    if (this.clipIndex[name]) return this.clipIndex[name]
    // Not dragged in: load the bundled clip by path (Data/NarrationClips.ts, generated from Audio/narration).
    const load = NARRATION_CLIPS[name]
    if (!load) return null
    try {
      this.clipIndex[name] = load()
    } catch (e) {
      print(`[Retrospecs] baked clip ${name} failed to load: ${e}`)
      return null
    }
    return this.clipIndex[name]
  }

  /**
   * Plays a baked narration clip instantly (no network). A newer speak/speakClip interrupts it. Without the clip,
   * speaks `text` with live TTS instead.
   */
  speakClip(name: string, text: string, onDone?: () => void): Promise<void> {
    const track = this.speakResponses ? this.bakedClip(name) : null
    if (!track) return this.speakParts([text], onDone)
    const token = ++this.speechToken
    print("[Retrospecs] say (baked " + name + "): " + text)
    if (!this.audio) this.audio = this.getSceneObject().createComponent("AudioComponent") as AudioComponent
    if (this.audio.isPlaying()) this.audio.stop(false)
    this.audio.audioTrack = track
    this.audio.setOnFinish(() => {
      if (token === this.speechToken && onDone) onDone()
    })
    this.audio.play(1)
    return Promise.resolve()
  }

  /** True when a baked clip exists (dragged in or bundled), without loading the audio. */
  hasBakedClip(name: string): boolean {
    if (!this.speakResponses) return false
    if (!this.clipIndex) this.bakedClip("") // builds the index of dragged-in clips
    return !!this.clipIndex[name] || !!NARRATION_CLIPS[name]
  }

  /** Makes the next clip start instantly: nothing to do if it is baked, else warm the live TTS cache. */
  prefetchClip(name: string, text: string) {
    if (!this.hasBakedClip(name)) this.prefetch([text])
  }

  /** Warms the clip cache in the background, at low priority behind anything being spoken. Safe to call repeatedly. */
  prefetch(texts: string[]) {
    if (!this.speakResponses) return
    for (const t of texts) {
      const k = (t || "").trim()
      if (k && !this.cache[k]) this.tts(k, PRI_PREFETCH)
    }
  }

  private cache: Record<string, Promise<AudioTrackAsset>> = {}
  private ready: Record<string, boolean> = {}
  private ttsQueue: TtsJob[] = []
  private ttsActive = 0
  private ttsLastStart = -1
  private ttsCooldownUntil = 0
  private ttsPumpPending = false
  private ttsRateLimits = 0
  private lastCachedFlags: boolean[] = []

  /**
   * Text-to-speech through one paced queue (Core/Throttle.ts): at most TTS_MAX_IN_FLIGHT requests, a short gap
   * between starts, spoken lines ahead of warming, and a pause-then-retry when the gateway says "Rate limited".
   * Cached by text, so a line that is already warming is reused (and moved up if it is now being spoken).
   */
  private tts(text: string, pri: number = PRI_SPEAK): Promise<AudioTrackAsset> {
    const k = text.trim()
    if (this.cache[k]) {
      if (pri > PRI_PREFETCH) for (const j of this.ttsQueue) if (j.k === k && j.pri < pri) j.pri = pri
      return this.cache[k]
    }
    const p = new Promise<AudioTrackAsset>((resolve, reject) => this.ttsQueue.push({k, pri, attempts: 0, resolve, reject}))
    this.cache[k] = p
    p.then(
      () => (this.ready[k] = true),
      () => {
        delete this.cache[k] // let a later call retry
      }
    )
    this.pumpTts()
    return p
  }

  private pumpTts() {
    while (this.ttsActive < TTS_MAX_IN_FLIGHT && this.ttsQueue.length) {
      const wait = startWaitSec(getTime(), this.ttsCooldownUntil, this.ttsLastStart)
      if (wait > 0) {
        if (!this.ttsPumpPending) {
          this.ttsPumpPending = true
          this.after(wait, () => {
            this.ttsPumpPending = false
            this.pumpTts()
          })
        }
        return
      }
      const job = this.ttsQueue.splice(pickNext(this.ttsQueue), 1)[0]
      this.ttsActive++
      this.ttsLastStart = getTime()
      OpenAI.speech({model: "gpt-4o-mini-tts", input: job.k, voice: this.ttsVoice as any, instructions: "Warm, upbeat Stanford campus tour guide. Clear and quick."}).then(
        (track) => {
          this.ttsActive--
          job.resolve(track)
          this.pumpTts()
        },
        (e) => {
          this.ttsActive--
          if (shouldRetry(e, job.pri, job.attempts)) {
            job.attempts++
            this.ttsRateLimits++
            const pause = retryDelaySec(job.attempts)
            this.ttsCooldownUntil = Math.max(this.ttsCooldownUntil, getTime() + pause)
            print(`[Retrospecs] TTS rate limited (${this.ttsRateLimits} so far); pausing ${pause}s, retry ${job.attempts} for "${job.k.slice(0, 40)}"`)
            this.ttsQueue.unshift(job)
          } else {
            job.reject(e)
          }
          this.pumpTts()
        }
      )
    }
  }

  isSpeaking(): boolean {
    return !!this.audio && this.audio.isPlaying()
  }

  private after(seconds: number, fn: () => void) {
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(fn)
    ev.reset(seconds)
  }

  stopSpeaking() {
    this.speechToken++
    if (this.audio && this.audio.isPlaying()) this.audio.stop(false)
  }
}

function parseJson(response: any): any {
  try {
    const text: string = response.candidates[0].content.parts[0].text
    return JSON.parse(text.replace(/^```(json)?/i, "").replace(/```$/, "").trim())
  } catch (e) {
    print("[Retrospecs] could not parse guide response: " + e)
    return null
  }
}

function withTimeout<T>(p: Promise<T>, seconds: number, owner: BaseScriptComponent): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false
    const ev = owner.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      if (!done) {
        done = true
        reject("timeout")
      }
    })
    ev.reset(seconds)
    p.then(
      (v) => {
        if (done) return
        done = true
        resolve(v)
      },
      (e) => {
        if (done) return
        done = true
        reject(e)
      }
    )
  })
}

interface TtsJob {
  k: string
  pri: number
  attempts: number
  resolve: (t: AudioTrackAsset) => void
  reject: (e: any) => void
}

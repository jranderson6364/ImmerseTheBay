/**
 * The guide's voice and brain, over the Remote Service Gateway (same request shapes as Partsight).
 *  - ask(): one Gemini call with a response schema -> validated answer (lights, threads, fact ids, connective)
 *  - speak(): OpenAI TTS through the gateway, one clip at a time
 * If the network fails, the controller falls back to local facts (Core/Guide.ts), so the demo keeps going.
 */
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {GeminiTypes} from "RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes"
import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {GUIDE_SCHEMA, GUIDE_SYSTEM_PROMPT, ValidatedAnswer, buildGuidePrompt, validateGuide} from "../Core/Guide"

@component
export class SightlinesGuide extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Sightlines Guide</span><br/><span style="color: #94A3B8; font-size: 11px;">Needs a Remote Service Gateway token on the scene\'s credentials object.</span>')
  @input model: string = "gemini-2.5-flash"
  @input speakResponses: boolean = true
  @input ttsVoice: string = "coral"
  @input @hint("Seconds before an unanswered question falls back to a local fact") timeoutSec: number = 8
  @input logTimings: boolean = true

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
      if (this.logTimings) print(`[Sightlines] guide answer after ${(getTime() - started).toFixed(2)} s`)
      const v = validateGuide(parseJson(response), heard)
      if (v.rejected.length) print("[Sightlines] validator dropped: " + v.rejected.join(", "))
      return v
    })
    return withTimeout(call, this.timeoutSec, this)
  }

  /**
   * Speaks text; a newer call interrupts an older one. `onDone` runs once when this clip finishes playing (or,
   * if speech is off or TTS fails, after a reading-time delay), and never if a newer clip interrupted it.
   */
  speak(text: string, onDone?: () => void): Promise<void> {
    const token = ++this.speechToken
    const finish = () => {
      if (token === this.speechToken && onDone) onDone()
    }
    const fallback = () => this.after(Math.max(2, text.split(/\s+/).length / 3), finish)
    if (!text) return Promise.resolve()
    print("[Sightlines] say: " + text)
    if (!this.speakResponses) {
      fallback()
      return Promise.resolve()
    }
    return OpenAI.speech({model: "gpt-4o-mini-tts", input: text, voice: this.ttsVoice as any, instructions: "Warm, upbeat Stanford campus tour guide. Clear and quick."})
      .then((track) => {
        if (token !== this.speechToken) return
        if (!this.audio) this.audio = this.getSceneObject().createComponent("AudioComponent") as AudioComponent
        if (this.audio.isPlaying()) this.audio.stop(false)
        this.audio.audioTrack = track
        this.audio.setOnFinish(() => finish())
        this.audio.play(1)
      })
      .catch((e) => {
        print("[Sightlines] TTS failed: " + e)
        fallback()
      })
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
    print("[Sightlines] could not parse guide response: " + e)
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

/**
 * Partsight Gemini client (Remote Service Gateway): image -> parts spec, and grounded Q&A.
 * Mirrors the request shape used by the Depth Cache sample's GeminiAPI.ts.
 */
import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {GeminiTypes} from "RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes"
import {
  GEMINI_QA_SCHEMA,
  GEMINI_SPEC_SCHEMA,
  PartsSpec,
  QA_SYSTEM_PROMPT,
  SPEC_SYSTEM_PROMPT,
  buildQuestionPrompt
} from "../Core/PartSpec"

export interface QAResult {
  answer: string
  part_ids: string[]
}

@component
export class PartsightGemini extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Partsight Gemini</span><br/><span style="color: #94A3B8; font-size: 11px;">Needs a Remote Service Gateway token (Window > Remote Service Gateway Token) and device testing.</span>')
  @input
  @hint("gemini-2.5-flash is faster; gemini-2.5-pro (the sample's default) is more careful.")
  specModel: string = "gemini-2.5-flash"
  @input qaModel: string = "gemini-2.5-flash"
  @input logTimings: boolean = true

  /** Sends the camera frame and returns the model's raw JSON (validate it with validateSpec). */
  requestSpec(texture: Texture, userHint: string): Promise<any> {
    const started = getTime()
    return new Promise((resolve, reject) => {
      Base64.encodeTextureAsync(
        texture,
        (b64) => {
          if (this.logTimings) print(`[Partsight] encoded ${texture.getWidth()}x${texture.getHeight()} in ${(getTime() - started).toFixed(2)} s`)
          const req: GeminiTypes.Models.GenerateContentRequest = {
            model: this.specModel,
            type: "generateContent",
            body: {
              contents: [
                {
                  role: "user",
                  parts: [
                    {inlineData: {mimeType: "image/jpeg", data: b64}},
                    {text: userHint && userHint.length > 0 ? userHint : "Explain the object I'm holding or looking at."}
                  ]
                }
              ],
              systemInstruction: {parts: [{text: SPEC_SYSTEM_PROMPT}]},
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
                response_schema: GEMINI_SPEC_SCHEMA as any
              }
            }
          }
          Gemini.models(req)
            .then((response) => {
              if (this.logTimings) print(`[Partsight] spec response after ${(getTime() - started).toFixed(2)} s`)
              resolve(parseJsonResponse(response))
            })
            .catch((err) => reject(err))
        },
        () => reject("image encoding failed"),
        CompressionQuality.IntermediateQuality,
        EncodingType.Jpg
      )
    })
  }

  ask(spec: PartsSpec, question: string, selectedPartId?: string): Promise<QAResult> {
    const started = getTime()
    const req: GeminiTypes.Models.GenerateContentRequest = {
      model: this.qaModel,
      type: "generateContent",
      body: {
        contents: [{role: "user", parts: [{text: buildQuestionPrompt(spec, question, selectedPartId)}]}],
        systemInstruction: {parts: [{text: QA_SYSTEM_PROMPT}]},
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          response_schema: GEMINI_QA_SCHEMA as any
        }
      }
    }
    return Gemini.models(req).then((response) => {
      if (this.logTimings) print(`[Partsight] answer after ${(getTime() - started).toFixed(2)} s`)
      const r = parseJsonResponse(response) || {}
      const ids = Array.isArray(r.part_ids) ? r.part_ids.filter((id: any) => spec.parts.some((p) => p.id === id)) : []
      return {answer: typeof r.answer === "string" ? r.answer : "Sorry, I didn't catch that.", part_ids: ids}
    })
  }
}

function parseJsonResponse(response: any): any {
  try {
    const text: string = response.candidates[0].content.parts[0].text
    // Strip accidental code fences.
    const cleaned = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim()
    return JSON.parse(cleaned)
  } catch (e) {
    print("[Partsight] could not parse Gemini response: " + e)
    return null
  }
}

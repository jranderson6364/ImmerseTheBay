import {describe, expect, test} from "bun:test"
import {cardById} from "../Assets/Retrospecs/Core/Cards"
import {
  LIVE_PREFIX_GENERAL, LIVE_PREFIX_WEB, buildLivePrompt, cleanForSpeech, isAskFurtherIntent, parseLiveReply, parseOpenAILiveReply, presentLive, stripAskFurtherCommand
} from "../Assets/Retrospecs/Core/AskLive"

const grounded = {
  candidates: [
    {
      content: {parts: [{text: "**Hoover Tower** reopened its deck in 2024 [1]. It is 285 feet tall [2, 3]. See https://example.com.\n- Tours run daily."}]},
      groundingMetadata: {
        webSearchQueries: ["hoover tower observation deck hours"],
        groundingChunks: [
          {web: {uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "hoover.org"}},
          {web: {uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def", title: "stanford.edu"}},
          {web: {uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ghi", title: "hoover.org"}}
        ]
      }
    }
  ]
}

describe("ask further intent", () => {
  test("explicit look-up phrases trigger it", () => {
    for (const s of ["look it up", "Can you look up when it opened?", "search the web for the architect", "what else is in here", "dig deeper", "ask more about this building"]) {
      expect(isAskFurtherIntent(s)).toBe(true)
    }
  })
  test("narration and map commands do not", () => {
    for (const s of ["tell me more", "something new", "lift", "who is it named after", "research labs inside?"]) {
      expect(isAskFurtherIntent(s)).toBe(false)
    }
  })
  test("strips the command, keeps the question", () => {
    expect(stripAskFurtherCommand("look it up")).toBe("")
    expect(stripAskFurtherCommand("Look up when it opened")).toBe("when it opened")
    expect(stripAskFurtherCommand("search the web for the architect")).toBe("the architect")
    expect(stripAskFurtherCommand("who designed it")).toBe("who designed it")
  })
})

describe("live prompt", () => {
  test("names the building, lists what was told, and carries recent turns", () => {
    const p = buildLivePrompt("is the deck open?", cardById("hoover"), ["Hoover Tower rises 285 feet.", "Hoover Tower rises 285 feet."], [{q: "who built it", a: "Arthur Brown Jr."}])
    expect(p).toContain("BUILDING: Hoover Tower, Stanford University")
    expect(p.match(/285 feet/g)!.length).toBe(1) // deduped
    expect(p).toContain("Visitor: who built it")
    expect(p).toContain("QUESTION: is the deck open?")
  })
  test("an empty question asks for something beyond the tour", () => {
    expect(buildLivePrompt("", cardById("gates"), [])).toContain("isn't in the tour")
  })
})

describe("parse live replies", () => {
  test("Gemini grounded reply: clean speech, distinct source domains, grounded", () => {
    const a = parseLiveReply(grounded)!
    expect(a.grounded).toBe(true)
    expect(a.sources.map((s) => s.title)).toEqual(["hoover.org", "stanford.edu"])
    expect(a.queries).toEqual(["hoover tower observation deck hours"])
    expect(a.speech).not.toMatch(/\[|\*|https?:/)
    expect(a.speech.startsWith("Hoover Tower reopened its deck in 2024.")).toBe(true)
  })
  test("no grounding metadata means not grounded", () => {
    const a = parseLiveReply({candidates: [{content: {parts: [{text: "It is tall."}]}}]})!
    expect(a.grounded).toBe(false)
    expect(a.sources).toEqual([])
  })
  test("empty or malformed responses give null", () => {
    expect(parseLiveReply(null)).toBeNull()
    expect(parseLiveReply({candidates: []})).toBeNull()
    expect(parseLiveReply({candidates: [{content: {parts: [{text: "  "}]}}]})).toBeNull()
  })
  test("thought parts are skipped", () => {
    const a = parseLiveReply({candidates: [{content: {parts: [{text: "planning…", thought: true}, {text: "Answer."}]}}]})!
    expect(a.speech).toBe("Answer.")
  })
  test("OpenAI search reply: inline citations dropped, annotation domains kept", () => {
    const a = parseOpenAILiveReply({
      choices: [{message: {content: "Gates opened in 1996 ([stanford.edu](https://cs.stanford.edu/x)). More soon.", annotations: [{type: "url_citation", url_citation: {url: "https://www.cs.stanford.edu/x", title: "Gates"}}]}}]
    })!
    expect(a.speech).toBe("Gates opened in 1996. More soon.")
    expect(a.sources[0].title).toBe("cs.stanford.edu")
    expect(a.grounded).toBe(true)
  })
})

describe("speech cleanup and labelling", () => {
  test("caps at three sentences", () => {
    expect(cleanForSpeech("One. Two. Three. Four. Five.")).toBe("One. Two. Three.")
  })
  test("cuts a runaway sentence at the word cap", () => {
    const long = Array.from({length: 120}, (_, i) => "w" + i).join(" ")
    const out = cleanForSpeech(long)
    expect(out.split(/\s+/).length).toBeLessThanOrEqual(71)
    expect(out.endsWith("…")).toBe(true)
  })
  test("grounded answers say 'from the web' with domains; ungrounded ones say so", () => {
    const g = presentLive(parseLiveReply(grounded)!, "Hoover")
    expect(g.parts[0]).toBe(LIVE_PREFIX_WEB)
    expect(g.caption).toBe("Hoover · From the web: hoover.org, stanford.edu")
    const u = presentLive({speech: "It is tall.", sources: [], grounded: false, queries: []}, "Hoover")
    expect(u.parts[0]).toBe(LIVE_PREFIX_GENERAL)
    expect(u.caption).toContain("Not from a web search")
  })
})

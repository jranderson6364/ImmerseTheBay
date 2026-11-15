/**
 * Hands the floating mic bubble (Assets/Scripts SpeechUI / SceneController, from the Depth Cache sample) to
 * Retrospecs without scene wiring or a direct import of the controller.
 *
 * The bubble and Retrospecs share one ASRController, so without this every question ran two pipelines at once: the
 * sample's Gemini depth labels + response bubble, and the Retrospecs guide. When Retrospecs registers here, the
 * sample scripts step aside: the bubble only starts listening, and Retrospecs answers in its own chat window.
 */
export interface BubbleTarget {
  /** The bubble was pressed: stop talking, show "listening" (the bubble starts the ASR itself). */
  bubbleListenStart(): void
}

let target: BubbleTarget = null

export function setBubbleTarget(t: BubbleTarget) {
  target = t
}

/** The registered target, or null when Retrospecs isn't in the scene (the sample then behaves as before). */
export function bubbleTarget(): BubbleTarget {
  return target
}

/**
 * Pacing for Remote Service Gateway requests (text-to-speech in particular). Pure, unit-tested.
 *
 * The gateway answers "Proxy error: Rate limited" when a token sends too many requests too quickly. Retrospecs used
 * to warm ~68 TTS clips on every Lens start (two per building), which used up the quota and made the welcome line
 * and the first answers fail. Now every request goes through one queue: a couple at a time, a short gap between
 * starts, spoken lines ahead of background warming, and a pause-then-retry when the gateway pushes back.
 */

/** Spoken now (the visitor is waiting). */
export const PRI_SPEAK = 2
/** Background warming; dropped after one failed retry. */
export const PRI_PREFETCH = 1

export const TTS_MAX_IN_FLIGHT = 2
/** Minimum seconds between request starts. */
export const TTS_MIN_GAP_SEC = 0.35
/** Retries after a rate-limit response, by priority. */
export const TTS_MAX_RETRIES: Record<number, number> = {[PRI_SPEAK]: 3, [PRI_PREFETCH]: 1}

/** True when a gateway error means "slow down" rather than a real failure. */
export function isRateLimitError(e: any): boolean {
  const s = typeof e === "string" ? e : e && (e.message || e.error || (e.toString && e.toString())) || ""
  let text = String(s)
  try {
    if (typeof e === "object" && e) text += " " + JSON.stringify(e)
  } catch (err) {
    // ignore circular errors
  }
  return /rate.?limit|too many requests|\b429\b|quota|resource.?exhausted/i.test(text)
}

/** Seconds to pause before retry number `attempt` (1-based): 1.5, 3, 6, then capped at 8. */
export function retryDelaySec(attempt: number): number {
  return Math.min(8, 1.5 * Math.pow(2, Math.max(0, attempt - 1)))
}

/** Seconds until the next request may start (0 = now). */
export function startWaitSec(now: number, cooldownUntil: number, lastStart: number, minGap = TTS_MIN_GAP_SEC): number {
  const gapReady = lastStart < 0 ? now : lastStart + minGap
  return Math.max(0, cooldownUntil - now, gapReady - now)
}

/** Index of the next job: highest priority first, oldest first within a priority. -1 if empty. */
export function pickNext(queue: {pri: number}[]): number {
  let best = -1
  for (let i = 0; i < queue.length; i++) if (best < 0 || queue[i].pri > queue[best].pri) best = i
  return best
}

/** Whether a job that just failed should be retried. */
export function shouldRetry(e: any, pri: number, attempts: number): boolean {
  return isRateLimitError(e) && attempts < (TTS_MAX_RETRIES[pri] || 0)
}

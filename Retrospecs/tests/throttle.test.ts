import {describe, expect, test} from "bun:test"
import {PRI_PREFETCH, PRI_SPEAK, isRateLimitError, pickNext, retryDelaySec, shouldRetry, startWaitSec} from "../Assets/Retrospecs/Core/Throttle"

describe("throttle", () => {
  test("recognises the gateway's rate-limit errors", () => {
    expect(isRateLimitError("Proxy error: Rate limited")).toBe(true)
    expect(isRateLimitError({error: {code: 429, message: "Too Many Requests"}})).toBe(true)
    expect(isRateLimitError("RESOURCE_EXHAUSTED")).toBe(true)
    expect(isRateLimitError("Proxy error: invalid token")).toBe(false)
    expect(isRateLimitError(null)).toBe(false)
  })

  test("backoff doubles and caps", () => {
    expect([1, 2, 3, 4, 5].map(retryDelaySec)).toEqual([1.5, 3, 6, 8, 8])
  })

  test("start wait honours both the gap and a cooldown", () => {
    expect(startWaitSec(10, 0, -1)).toBe(0)
    expect(startWaitSec(10, 0, 9.9, 0.35)).toBeCloseTo(0.25)
    expect(startWaitSec(10, 13, 9.9, 0.35)).toBe(3)
    expect(startWaitSec(10, 0, 5)).toBe(0)
  })

  test("spoken lines jump ahead of warming, FIFO within a priority", () => {
    expect(pickNext([])).toBe(-1)
    expect(pickNext([{pri: PRI_PREFETCH}, {pri: PRI_SPEAK}, {pri: PRI_SPEAK}])).toBe(1)
    expect(pickNext([{pri: PRI_PREFETCH}, {pri: PRI_PREFETCH}])).toBe(0)
  })

  test("retries only rate limits, and fewer for warming", () => {
    expect(shouldRetry("Rate limited", PRI_SPEAK, 2)).toBe(true)
    expect(shouldRetry("Rate limited", PRI_SPEAK, 3)).toBe(false)
    expect(shouldRetry("Rate limited", PRI_PREFETCH, 1)).toBe(false)
    expect(shouldRetry("bad voice", PRI_SPEAK, 0)).toBe(false)
  })
})

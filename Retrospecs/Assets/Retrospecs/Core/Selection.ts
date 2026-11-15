/**
 * Selection lock-in: once a building is selected it stays selected for a while, so a drifting hand ray, a
 * flickering hover or a stray pinch can't deselect it or jump to a neighbour. Pure: callers pass the clock.
 */

/** Minimum time a fresh selection stays locked (s). */
export const LOCK_MIN_SEC = 4
/** The lock also holds while the guide speaks, and this long after it stops (s). */
export const POST_SPEECH_LOCK_SEC = 1.5
/** While locked, a different building must have been hovered this long before the pinch to switch to it (s). */
export const SWITCH_DWELL_SEC = 0.45
/** A second selection pinch within this time of the last one is ignored (double-fire, bounce) (s). */
export const DEBOUNCE_SEC = 0.3
/** Hover hysteresis: a new hover candidate (or losing the hover) must persist this long to take over (s). */
export const HOVER_HOLD_SEC = 0.2
/** Focus never times out sooner than this after the guide stops talking (s), whatever the scene says. */
export const MIN_FOCUS_IDLE_SEC = 30
/** Float slack for the threshold comparisons (frame times are floats). */
const EPS = 1e-6

/** True while a selection is protected from accidental switches. */
export function isLocked(now: number, focusAt: number, lastSpokeAt: number, speaking: boolean): boolean {
  if (speaking) return true
  if (now - focusAt < LOCK_MIN_SEC) return true
  return lastSpokeAt >= 0 && now - lastSpokeAt < POST_SPEECH_LOCK_SEC
}

export type SelectionAction = "ignore" | "more" | "switch" | "none"

export interface SelectionInput {
  now: number
  /** Selected building ("" = none). */
  focusId: string
  /** When the last selection pinch was acted on (-1 = never). */
  lastActionAt: number
  locked: boolean
  /** Building the pinch aims at ("" = nothing). */
  pickId: string
  /** How long `pickId` had been hovered continuously before the pinch (0 for fallbacks that weren't hovered). */
  pickHeldSec: number
}

/**
 * What a selection pinch does: "ignore" (debounced), "more" (next segment of the focused building),
 * "switch" (select pickId), or "none" (nothing focused, nothing aimed at: caller's fallback).
 */
export function decideSelection(s: SelectionInput): SelectionAction {
  if (s.lastActionAt >= 0 && s.now - s.lastActionAt < DEBOUNCE_SEC - EPS) return "ignore"
  if (!s.focusId) return s.pickId ? "switch" : "none"
  if (!s.pickId || s.pickId === s.focusId) return "more"
  if (s.locked && s.pickHeldSec < SWITCH_DWELL_SEC - EPS) return "more"
  return "switch"
}

/** The id a decision acts on ("" for ignore / none). */
export function selectionTarget(action: SelectionAction, s: SelectionInput): string {
  if (action === "more") return s.focusId
  if (action === "switch") return s.pickId
  return ""
}

// ---------------------------------------------------------------------------
// Hover hysteresis

export interface HoverState {
  /** Hover shown (what a pinch picks). */
  id: string
  /** When the shown hover's run of raw samples first appeared. */
  since: number
  /** Latest raw candidate that differs from `id`, and when it first appeared ("" with pendingAt >= 0 = losing it). */
  pending: string
  pendingAt: number
}

export function newHoverState(): HoverState {
  return {id: "", since: 0, pending: "", pendingAt: -1}
}

/**
 * One frame of hover hysteresis. From nothing, a building is adopted at once; switching to a neighbour, or
 * dropping to nothing, needs the new raw value held for HOVER_HOLD_SEC. Mutates and returns `h`.
 */
export function stepHover(h: HoverState, raw: string, now: number): HoverState {
  if (raw === h.id) {
    h.pending = ""
    h.pendingAt = -1
    return h
  }
  if (!h.id) {
    h.id = raw
    h.since = now
    h.pending = ""
    h.pendingAt = -1
    return h
  }
  if (h.pendingAt < 0 || h.pending !== raw) {
    h.pending = raw
    h.pendingAt = now
  }
  if (now - h.pendingAt >= HOVER_HOLD_SEC - EPS) {
    h.id = raw
    h.since = h.pendingAt
    h.pending = ""
    h.pendingAt = -1
  }
  return h
}

/** Seconds the shown hover has been held. */
export function hoverHeldSec(h: HoverState, now: number): number {
  return h.id ? Math.max(0, now - h.since) : 0
}

// ---------------------------------------------------------------------------
// Idle

/** Focus idle timeout: never while speaking, and never sooner than MIN_FOCUS_IDLE_SEC (0 = never). */
export function focusIdleExpired(now: number, lastActiveAt: number, idleSec: number, speaking: boolean): boolean {
  if (speaking || !(idleSec > 0)) return false
  return now - lastActiveAt >= Math.max(idleSec, MIN_FOCUS_IDLE_SEC)
}

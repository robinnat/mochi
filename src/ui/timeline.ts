/**
 * Settings and formatting of the montage track. Everything is pure: the track needs no DOM to know where to land,
 * which makes its ticks testable (the same discipline as `src/bot/`, applied to display).
 */

/**
 * Width of a card, in pixels per second: the duration reads directly on the track. Zoom multiplies this scale: it
 * never changes the montage, only the lens put on it.
 */
export const BASE_SCALE = 44

/**
 * Zoom bounds: at the smallest, the montage measured on the video fits whole in the track; at the largest, a card
 * stays easy to handle without becoming a wall.
 */
export const MIN_ZOOM = 0.45
export const MAX_ZOOM = 2.4

/** Minimum gap between two numbered marks of the ruler, in pixels. */
const TICK_SPACING = 52

/** Possible ruler steps, from finest to widest. */
const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60]

export function clampZoom(v: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v))
}

/** `0:04`: tenths would change too fast to be readable. */
export function mmss(t: number) {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/*
 * Durations in seconds are NOT formatted here: the decimal separator changes with the language (comma in French,
 * point in English) and the unit is translated. They go through `seconds` / `secondsShort` of `@/i18n`, which knows
 * the current language; this module stays pure.
 *
 * `mmss` stays: the mm:ss format has no unit and no decimal separator.
 */

/**
 * Ruler marks for a given duration and scale. The numbered step is the first of `STEPS` that leaves `TICK_SPACING`
 * between two numbers: zooming out goes from 1 s to 5 s then 10 s instead of piling up unreadable figures. In-between
 * marks only appear when they do not stick to each other.
 */
export function ticksFor(total: number, scale: number): Array<{ t: number; major: boolean }> {
  const major = STEPS.find((s) => s * scale >= TICK_SPACING) ?? STEPS[STEPS.length - 1]!
  const step = (major / 5) * scale >= 7 ? major / 5 : major
  const out: Array<{ t: number; major: boolean }> = []
  for (let i = 0; i * step <= total + 1e-6 && out.length < MAX_TICKS; i++) {
    const t = i * step
    out.push({ t, major: Math.abs(t / major - Math.round(t / major)) < 1e-6 })
  }
  return out
}

/**
 * Cap on the number of ticks. A guard, not a setting.
 *
 * `parseCycles` already bounds the size of a montage read back, but this function must not rely on that guard to stay
 * bounded: it returns one object per tick and the component one `<span>` per object, so an absurd duration (a
 * hand-edited montage, an extreme zoom) costs hundreds of thousands of nodes and the tab freezes.
 *
 * Two thousand covers thirty minutes of montage at the finest zoom, far more than `MAX_BLOCKS` allows to read back.
 * The ruler is wider than the screen anyway: the track scrolls, it never shows everything.
 */
const MAX_TICKS = 2000

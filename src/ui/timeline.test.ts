import { describe, expect, it } from 'vitest'
import { BASE_SCALE, clampZoom, MAX_ZOOM, MIN_ZOOM, mmss, ticksFor } from './timeline'
import * as timeline from './timeline'

describe('mise en shape', () => {
  it('writes time in minutes and seconds', () => {
    expect(mmss(0)).toBe('0:00')
    expect(mmss(4.9)).toBe('0:04')
    expect(mmss(65)).toBe('1:05')
    // a negative time does not exist in a montage
    expect(mmss(-3)).toBe('0:00')
  })

  /*
   * This test used to be EMPTY: it checked nothing and still counted in the total. It was left from when localized
   * formatting lived here. So we make it say what it claimed: that this module stays PURE, with no language.
   *
   * The decimal separator changes with the language and the unit is translated, so durations in seconds go through
   * `seconds` / `secondsShort` of `@/i18n`. `mmss` stays here: the mm:ss format has no unit and no decimal separator.
   */
  it('formats no localized duration: that belongs to i18n', () => {
    expect(Object.keys(timeline).filter((n) => /^secondes/.test(n))).toEqual([])
    expect(mmss(65)).toBe('1:05')
  })

})

describe('ruler ticks', () => {
  it('spaces numbers at least 52 px apart', () => {
    for (const zoom of [MIN_ZOOM, 1, MAX_ZOOM]) {
      const scale = BASE_SCALE * zoom
      const majeurs = ticksFor(60, scale).filter((t) => t.major)
      const gap = (majeurs[1]!.t - majeurs[0]!.t) * scale
      expect(gap).toBeGreaterThanOrEqual(52)
    }
  })

  it('widens the step when zooming out', () => {
    const step = (scale: number) => {
      const majeurs = ticksFor(60, scale).filter((t) => t.major)
      return majeurs[1]!.t - majeurs[0]!.t
    }
    expect(step(BASE_SCALE * MIN_ZOOM)).toBeGreaterThan(step(BASE_SCALE * MAX_ZOOM))
  })

  it('starts at zero and does not go past the duration', () => {
    const landmarks = ticksFor(10, BASE_SCALE)
    expect(landmarks[0]).toEqual({ t: 0, major: true })
    expect(landmarks[landmarks.length - 1]!.t).toBeLessThanOrEqual(10)
  })

  it('only sets in-between marks when they are readable', () => {
    // whatever the scale, two neighboring marks stay 7 px apart
    for (const scale of [0.5, 8, 20, BASE_SCALE, 106]) {
      const landmarks = ticksFor(60, scale)
      const gap = (landmarks[1]!.t - landmarks[0]!.t) * scale
      expect(gap).toBeGreaterThanOrEqual(7)
    }
    // at the normal scale, there are some
    expect(ticksFor(10, BASE_SCALE).some((t) => !t.major)).toBe(true)
    // zoomed far out, there are none left
    expect(ticksFor(600, 0.5).every((t) => t.major)).toBe(true)
  })

  it('does not leave the track empty on a tiny montage', () => {
    expect(ticksFor(0.6, BASE_SCALE).length).toBeGreaterThan(0)
  })

  /*
   * A guard independent of `parseCycles`: this function returns one object per tick and the component one `<span>`
   * per object, so an absurd duration costs hundreds of thousands of nodes. It must not depend on a guard located
   * elsewhere.
   */
  it('never returns an absurd number of ticks', () => {
    for (const total of [1e5, 1e7, 1.5e6]) {
      const ticks = ticksFor(total, BASE_SCALE)
      expect(ticks.length, `total=${total}`).toBeLessThanOrEqual(2000)
      // and they stay increasing and well formed
      expect(ticks[0]!.t).toBe(0)
      expect(ticks.every((x, i) => i === 0 || x.t > ticks[i - 1]!.t)).toBe(true)
    }
  })
})

describe('zoom bounds', () => {
  it('brings the zoom back within its bounds', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(1)).toBe(1)
  })
})

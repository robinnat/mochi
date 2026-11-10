import { describe, expect, it } from 'vitest'
import { TAU } from './math'
import { PROFILE_SAMPLES } from './profiles'
import { radiusAtAngle, silhouette } from './shape'
import { SHAPES } from './skins'

/**
 * `radiusAtAngle`, the function that sticks back onto the real outline whatever sits "on" the body: the eyes and the
 * notification dot.
 *
 * It had no test, while the engine calls it as `atan2(y, x) - pose.sil.rot` and `orbit` pushes `rot` to about -30
 * rad: its argument goes far outside `[0, 2*PI)`. Any simplification of its double modulo would detach the eyes from
 * the silhouette during the orbit, exactly the failure this function exists to prevent.
 */

/** A clearly non circular profile: on a circle, every angle would give 1. */
const TRIANGLE = silhouette('triangle').radii

describe('radiusAtAngle', () => {
  it('returns the profile\'s radius, not a constant', () => {
    const seen = new Set(Array.from({ length: 16 }, (_, i) => radiusAtAngle(TRIANGLE, (i / 16) * TAU)))
    expect(seen.size).toBeGreaterThan(8)
  })

  it('wraps negative angles', () => {
    expect(radiusAtAngle(TRIANGLE, -0.1)).toBeCloseTo(radiusAtAngle(TRIANGLE, TAU - 0.1), 12)
    expect(radiusAtAngle(TRIANGLE, -1)).toBeCloseTo(radiusAtAngle(TRIANGLE, TAU - 1), 12)
  })

  /**
   * The `orbit` case: several turns into the negative. That is what the double modulo of `((x % 1) + 1) % 1` handles
   * and a simple modulo breaks.
   */
  it('wraps over several turns, both ways', () => {
    for (const base of [-30, -12.5, 7.3]) {
      for (const turns of [-3, -1, 1, 5]) {
        expect(
          radiusAtAngle(TRIANGLE, base),
          `base=${base} turns=${turns}`
        ).toBeCloseTo(radiusAtAngle(TRIANGLE, base + turns * TAU), 10)
      }
    }
  })

  /**
   * Continuous across zero, where wrapping makes the index jump from 63 to 0. A simplification that returned a
   * fallback value (1, typically) would show here as a 0.22 step on this profile.
   *
   * Eight decimals and not nine: the measured gap is 7e-10, floating point noise on indices computed by modulo. That
   * is three orders of magnitude below what a real discontinuity would give.
   */
  it('is continuous across zero', () => {
    expect(radiusAtAngle(TRIANGLE, -1e-9)).toBeCloseTo(radiusAtAngle(TRIANGLE, 1e-9), 8)
    // and the value there is the profile's, not a fallback
    expect(radiusAtAngle(TRIANGLE, 0)).toBeCloseTo(TRIANGLE[0]!, 12)
  })
})

/**
 * The customizer shapes are built analytically, without the generator that produces `profiles.ts`. Nothing checked
 * their sampling.
 *
 * That makes the check necessary: `blend` interpolates by INDEX and falls back on `?? 1` when the index is missing,
 * so a shape built with another sample count silently morphs towards a unit circle instead of failing. It would be
 * right at rest and wrong in all its transitions: the worst of both worlds, because nobody would think of looking at
 * a morph.
 */
describe('customizer shape profiles', () => {
  it('all share the same angular sampling, finite and positive', () => {
    for (const shape of SHAPES) {
      expect(shape.radii, shape.id).toHaveLength(PROFILE_SAMPLES)
      for (const [i, r] of shape.radii.entries()) {
        expect(Number.isFinite(r), `${shape.id}[${i}] = ${r}`).toBe(true)
        expect(r, `${shape.id}[${i}]`).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Wide bounds, only there to catch an absurd shape: a radius under 0.3 would push the eyes out, a radius over 1.6
   * would leave the viewBox. These are not measurements, it is the domain in which the rest of the folder makes
   * sense.
   */
  it('stay in a domain where the rest of the engine holds', () => {
    for (const shape of SHAPES) {
      const min = Math.min(...shape.radii)
      const max = Math.max(...shape.radii)
      expect(min, `${shape.id} min`).toBeGreaterThan(0.3)
      expect(max, `${shape.id} max`).toBeLessThan(1.6)
    }
  })
})

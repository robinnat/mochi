import { describe, expect, it } from 'vitest'
import { PROFILE_SAMPLES } from './profiles'
import { radiusAtAngle } from './shape'
import { SHAPE_BY_ID, SHAPES } from './skins'

/**
 * The shapes added on 03/11/2026 (star, flower, egg; the heart removed on 03/11 came back on 06/11/2026 as a new
 * shape). What is locked: their silhouette reads (branches, notch, petals), they go through the same angular sampling
 * as the others, and they have the same visual weight. Eyes overflowing are already covered by `skins.test.ts`, which
 * sweeps every shape of the catalog.
 */

const radiiOf = (id: string) => SHAPE_BY_ID.get(id)!.radii
/** Screen angle in degrees (0 = right, 90 = down, -90 = up). */
const r = (id: string, deg: number) => radiusAtAngle(radiiOf(id), (deg * Math.PI) / 180)

/** Number of strict local maxima of the profile, over the full turn. */
function bumps(radii: number[]) {
  const n = radii.length
  let k = 0
  for (let i = 0; i < n; i++) {
    const a = radii[(i - 1 + n) % n]!
    const b = radii[i]!
    const c = radii[(i + 1) % n]!
    if (b > a && b >= c) k++
  }
  return k
}

describe('nouvelles shapes', () => {
  const freshOnes = ['star', 'flower', 'egg', 'heart']

  it('are in the catalog, sampled like the others, with no zero radius', () => {
    for (const id of freshOnes) {
      const radii = radiiOf(id)
      expect(radii).toHaveLength(PROFILE_SAMPLES)
      expect(Math.min(...radii)).toBeGreaterThan(0.45)
      expect(Math.max(...radii)).toBeGreaterThan(1)
      expect(Math.max(...radii)).toBeLessThan(1.15)
    }
    expect(SHAPES.map((s) => s.id).slice(-4)).toEqual(freshOnes)
  })

  it("the star has five branches, one up", () => {
    expect(bumps(radiiOf('star'))).toBe(5)
    expect(r('star', -90)).toBeGreaterThan(r('star', -54) + 0.1)
    // soft star (hollow at 0.6 of the tip, nicely round ends, 04/11/2026): the hollow stays readable
    expect(Math.min(...radiiOf('star'))).toBeLessThan(0.85)
    expect(Math.min(...radiiOf('star'))).toBeGreaterThan(0.45)
  })

  it('the flower has five petals, one up', () => {
    expect(bumps(radiiOf('flower'))).toBe(5)
    expect(r('flower', -90)).toBeGreaterThan(r('flower', -54))
  })

  it('the heart has a dip at the top, two lobes and a tip at the bottom', () => {
    const c = radiiOf('heart')
    expect(bumps(c)).toBe(3)
    // dip: the radius up is shorter than towards the lobes (-60 and -120 deg)
    expect(r('heart', -90)).toBeLessThan(r('heart', -55) - 0.15)
    expect(r('heart', -90)).toBeLessThan(r('heart', -125) - 0.15)
    // tip pointing down, soft, and symmetric left to right
    expect(r('heart', 90)).toBeGreaterThan(0.7)
    expect(r('heart', 90)).toBeGreaterThan(r('heart', 0) - 0.1)
    expect(r('heart', 90)).toBeLessThan(1.06)
    expect(Math.abs(r('heart', -55) - r('heart', -125))).toBeLessThan(0.02)
  })

  it("the egg stands up and is wider at the bottom than at the top", () => {
    expect(r('egg', 90) + r('egg', -90)).toBeGreaterThan(r('egg', 0) + r('egg', 180))
    expect(r('egg', 45)).toBeGreaterThan(r('egg', -45))
  })
})

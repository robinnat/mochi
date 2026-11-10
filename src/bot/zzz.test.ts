import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sleepZ } from './gestures'
import { HALF_VIEWBOX } from './frame'

describe('the "z" of the asleep mood', () => {
  it('rise, stay in the frame and fade', () => {
    for (let t = 0; t < 7; t += 0.25) {
      for (const z of sleepZ(t)) {
        // in radii: x 100 = edge of the body; the stroke must stay in the viewBox
        expect(Math.abs(z.x * 100) + (z.size * 100) / 2 + 5).toBeLessThan(HALF_VIEWBOX)
        expect(Math.abs(z.y * 100) + (z.size * 100) / 2 + 5).toBeLessThan(HALF_VIEWBOX)
        expect(z.opacity).toBeGreaterThanOrEqual(0)
        expect(z.opacity).toBeLessThanOrEqual(0.8)
      }
    }
    const y0 = sleepZ(0.1)[0]!.y
    expect(sleepZ(0.9)[0]!.y).toBeLessThan(y0) // they rise (y down)
  })

  it('<mochi-bot> draws them over every style when the mood is asleep, a still image with reduced motion', () => {
    const src = readFileSync(new URL('../components/mochi-bot.ts', import.meta.url), 'utf8')
    expect(src).toContain("'data-zzz': '1'")
    expect(src).toContain("resolveMood(props.mood) !== 'asleep'")
    expect(src).toMatch(/reduced\.value \|\| props\.frozenAt !== undefined \? 1\.2/)
  })
})

// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CADENCE_FULL_MS, CADENCE_HALF_MS, CADENCE_LATE_MS, cadence, cadenceFrame } from './mochi-bot'

/** Plays `n` browser frames, `step` ms apart, where drawing every Mochi costs `cost` ms. */
function frames(n: number, cost: number, step = 16) {
  const start = cadence.ms + step
  for (let i = 0; i < n; i++) {
    cadenceFrame(start + i * step)
    // in half cadence, only half of the Mochiz draw in a frame
    cadence.cost += cadence.half ? cost / 2 : cost
  }
}

describe('adaptive cadence (v13)', () => {
  it('a frame number per browser frame, shared by every Mochi', () => {
    const a = cadenceFrame(100000)
    expect(cadenceFrame(100000)).toBe(a)
    expect(cadenceFrame(100016)).toBe(a + 1)
  })

  it('light pages draw every Mochi at every frame', () => {
    cadence.half = false
    cadence.average = 0
    frames(120, 3)
    expect(cadence.half).toBe(false)
  })

  it('a costly drawing on a computer that keeps up: still every frame', () => {
    frames(200, 12, 16)
    expect(cadence.half).toBe(false)
  })

  it('late frames because of the Mochiz: every other frame (each at 30 per second), then back when it gets light', () => {
    frames(120, 20, CADENCE_LATE_MS + 13)
    expect(cadence.half).toBe(true)
    // between the two thresholds: no flapping, even once the frames are on time again
    frames(200, (CADENCE_HALF_MS + CADENCE_FULL_MS) / 2, 16)
    expect(cadence.half).toBe(true)
    frames(200, 2, 16)
    expect(cadence.half).toBe(false)
  })

  it('late frames that the Mochiz do not cause (a busy page): no change', () => {
    frames(200, 1, 40)
    expect(cadence.half).toBe(false)
    frames(200, 1, 16)
  })

  it('the loop skips the off frames, unless the Mochi has its own fps', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/mochi-bot.ts'), 'utf8')
    expect(src).toContain('if (cadence.half && !props.fps && frameNo % 2 !== parity) return')
    expect(src).toContain('cadence.cost += performance.now() - t0')
  })

  it('an animated Mochi draws at most once per browser frame, except when driven frame by frame (exports)', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/mochi-bot.ts'), 'utf8')
    expect(src).toContain('if (props.frozenAt === undefined && !driven && readyEmitted && drawnFrame === cadence.frame) return')
    expect(src).toMatch(/function renderAt\(t: number\) \{\s*driven = true/)
  })
})

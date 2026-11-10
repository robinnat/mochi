import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { EXPRESSION_BY_ID } from './expressions'
import {
  ACTIVITIES,
  NEUTRAL_GESTURE,
  IDLE_GESTURES,
  compose,
  gestureOfWindow,
  gestureFailure,
  idleGesture,
  sleepGesture,
  personality,
  bounce,
  BOUNCE_DURATION,
  timeActivity,
  sleepZ
} from './gestures'
import { STATE_BY_ID } from './states'

const gap = (g: typeof NEUTRAL_GESTURE) =>
  Math.max(Math.abs(g.dx), Math.abs(g.dy), Math.abs(g.sx - 1), Math.abs(g.sy - 1))

describe('gestures', () => {
  it('without a gesture or with the neutral gesture, rendering is identical to the byte', () => {
    const a = new BotEngine(100, 'idle')
    const b = new BotEngine(100, 'idle')
    for (const t of [0, 0.37, 1.9, 4.2, 12.5]) {
      const ref = JSON.stringify(a.sample(t))
      expect(JSON.stringify(b.sample(t, { ...NEUTRAL_GESTURE }))).toBe(ref)
    }
  })

  it('a gesture does change the frame, without mutating the engine', () => {
    const e = new BotEngine(100, 'idle')
    const before = JSON.stringify(e.sample(2))
    const moves = JSON.stringify(e.sample(2, { ...NEUTRAL_GESTURE, dy: -0.1, sy: 1.05, yaw: 20 }))
    expect(moves).not.toBe(before)
    expect(JSON.stringify(e.sample(2))).toBe(before)
  })

  it('the gesture\'s eyelid closes the eyes', () => {
    const e = new BotEngine(100, 'idle')
    const open = e.sample(0.5).eyes[0]!.matrix
    const closed = e.sample(0.5, { ...NEUTRAL_GESTURE, lid: 0 }).eyes[0]!.matrix
    expect(closed).not.toBe(open)
  })

  it('waiting schedule: deterministic, 4 to 12 s between two gestures, never before 4 s', () => {
    for (const seed of [1, 42, 0xdead, 987654]) {
      const debuts = Array.from({ length: 40 }, (_, k) => gestureOfWindow(seed, k).start)
      for (let k = 1; k < debuts.length; k++) {
        const d = debuts[k]! - debuts[k - 1]!
        expect(d).toBeGreaterThanOrEqual(4)
        expect(d).toBeLessThanOrEqual(12)
      }
      expect(gestureOfWindow(seed, 7)).toEqual(gestureOfWindow(seed, 7))
      for (let t = 0; t < 4; t += 0.1) expect(idleGesture(t, seed)).toEqual({ ...NEUTRAL_GESTURE })
    }
  })

  it('two different seeds do not move at the same time (offset)', () => {
    const active = (seed: number, t: number) => gap(idleGesture(t, seed)) > 1e-4 || idleGesture(t, seed).yaw !== 0 || idleGesture(t, seed).lid < 1
    let ensemble = 0
    let total = 0
    for (let t = 0; t < 300; t += 0.25) {
      const a = active(11, t)
      const b = active(97, t)
      if (a || b) total++
      if (a && b) ensemble++
    }
    expect(total).toBeGreaterThan(0)
    expect(ensemble / total).toBeLessThan(0.35)
  })

  it('each seed has its personality (favorite gestures)', () => {
    const p = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => personality(s).join(',')))
    expect(p.size).toBeGreaterThan(4)
    for (const s of [1, 2, 3]) expect(new Set(personality(s)).size).toBe(4)
  })

  it('sober amplitudes and back to neutral at the end of the gesture', () => {
    for (const def of IDLE_GESTURES) {
      for (let u = 0; u <= def.duration; u += def.duration / 40) {
        const g = def.pose(u)
        expect(Math.abs(g.dx)).toBeLessThanOrEqual(0.05)
        expect(Math.abs(g.dy)).toBeLessThanOrEqual(0.13)
        expect(Math.abs(g.sx - 1)).toBeLessThanOrEqual(0.06)
        expect(Math.abs(g.sy - 1)).toBeLessThanOrEqual(0.08)
        expect(Math.abs(g.yaw)).toBeLessThanOrEqual(25)
      }
      expect(gap(def.pose(def.duration))).toBeLessThan(0.01)
    }
  })

  it('touch bounce: damped, neutral after its duration', () => {
    expect(gap(bounce(0.05))).toBeGreaterThan(0.02)
    expect(bounce(BOUNCE_DURATION + 0.01)).toEqual({ ...NEUTRAL_GESTURE })
    expect(bounce(-1)).toEqual({ ...NEUTRAL_GESTURE })
  })

  it('sleep: eyes closed, slow breathing; failure: slumped', () => {
    expect(sleepGesture(0).lid).toBeLessThan(0.1)
    expect(sleepGesture(0).sy).not.toBe(sleepGesture(2.3).sy)
    expect(gestureFailure(1).sy).toBeLessThan(1)
    expect(gestureFailure(1).dy).toBeGreaterThan(0)
    const z = sleepZ(1.2)
    expect(z).toHaveLength(2)
    for (const p of z) expect(p.opacity).toBeGreaterThanOrEqual(0)
  })

  it('compose adds, multiplies and keeps the most closed eyelid', () => {
    const c = compose({ ...NEUTRAL_GESTURE, dx: 0.1, sy: 1.1, lid: 0.5 }, { ...NEUTRAL_GESTURE, dx: 0.05, sy: 1.1, lid: 0.8 })
    expect(c.dx).toBeCloseTo(0.15)
    expect(c.sy).toBeCloseTo(1.21)
    expect(c.lid).toBe(0.5)
  })

  it('activities: known engine states, bounded loops, all different', () => {
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length)
    const e = new BotEngine(100, 'idle', null, EXPRESSION_BY_ID.get('attentive') ?? null)
    for (const a of ACTIVITIES) {
      expect(STATE_BY_ID.has(a.state)).toBe(true)
      for (const t of [0, 1.7, 33.3]) {
        const tt = timeActivity(a, t)
        expect(tt).toBeGreaterThanOrEqual(0.6)
        expect(tt).toBeLessThan(0.6 + a.loop)
        const f = new BotEngine(100, a.state).sample(tt, a.gesture(t))
        expect(f.bodyPath.startsWith('M')).toBe(true)
      }
    }
    expect(e.sample(1).eyes.length).toBeGreaterThan(0)
  })
})

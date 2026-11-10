import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { EXPRESSION_BY_ID } from './expressions'
import {
  ACTIVITIES,
  NEUTRAL_GESTURE,
  IDLE_GESTURES,
  composer,
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
  it('sans geste ou avec le geste neutre, le rendu est identique a l octet pres', () => {
    const a = new BotEngine(100, 'idle')
    const b = new BotEngine(100, 'idle')
    for (const t of [0, 0.37, 1.9, 4.2, 12.5]) {
      const ref = JSON.stringify(a.sample(t))
      expect(JSON.stringify(b.sample(t, { ...NEUTRAL_GESTURE }))).toBe(ref)
    }
  })

  it('un geste change bien l image, sans muter le moteur', () => {
    const e = new BotEngine(100, 'idle')
    const before = JSON.stringify(e.sample(2))
    const moves = JSON.stringify(e.sample(2, { ...NEUTRAL_GESTURE, dy: -0.1, sy: 1.05, yaw: 20 }))
    expect(moves).not.toBe(before)
    expect(JSON.stringify(e.sample(2))).toBe(before)
  })

  it('la paupiere du geste ferme les yeux', () => {
    const e = new BotEngine(100, 'idle')
    const open = e.sample(0.5).eyes[0]!.matrix
    const closed = e.sample(0.5, { ...NEUTRAL_GESTURE, lid: 0 }).eyes[0]!.matrix
    expect(closed).not.toBe(open)
  })

  it('calendrier d attente : deterministe, 4 a 12 s entre deux gestes, jamais avant 4 s', () => {
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

  it('deux graines differentes ne gesticulent pas en meme temps (decalage)', () => {
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

  it('chaque graine a sa personnalite (gestes preferes)', () => {
    const p = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => personality(s).join(',')))
    expect(p.size).toBeGreaterThan(4)
    for (const s of [1, 2, 3]) expect(new Set(personality(s)).size).toBe(4)
  })

  it('amplitudes sobres et retour au neutre en fin de geste', () => {
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

  it('rebond au toucher : amorti, neutre apres sa duree', () => {
    expect(gap(bounce(0.05))).toBeGreaterThan(0.02)
    expect(bounce(BOUNCE_DURATION + 0.01)).toEqual({ ...NEUTRAL_GESTURE })
    expect(bounce(-1)).toEqual({ ...NEUTRAL_GESTURE })
  })

  it('sommeil : yeux fermes, respiration lente ; echec : affaisse', () => {
    expect(sleepGesture(0).lid).toBeLessThan(0.1)
    expect(sleepGesture(0).sy).not.toBe(sleepGesture(2.3).sy)
    expect(gestureFailure(1).sy).toBeLessThan(1)
    expect(gestureFailure(1).dy).toBeGreaterThan(0)
    const z = sleepZ(1.2)
    expect(z).toHaveLength(2)
    for (const p of z) expect(p.opacite).toBeGreaterThanOrEqual(0)
  })

  it('composer additionne, multiplie et garde la paupiere la plus fermee', () => {
    const c = composer({ ...NEUTRAL_GESTURE, dx: 0.1, sy: 1.1, lid: 0.5 }, { ...NEUTRAL_GESTURE, dx: 0.05, sy: 1.1, lid: 0.8 })
    expect(c.dx).toBeCloseTo(0.15)
    expect(c.sy).toBeCloseTo(1.21)
    expect(c.lid).toBe(0.5)
  })

  it('activites : etats connus du moteur, boucles bornees, toutes differentes', () => {
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

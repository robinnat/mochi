import { describe, expect, it } from 'vitest'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE, eyePoses, type HeadGaze } from './face'

/**
 * Valeurs relevees image par image sur la video de reference (unites : rayon de
 * la boule au repos = 1, y vers le bas). Le modele de sphere doit les
 * reproduire : c'est lui qui garantit que l'oeil proche du bord se comprime
 * exactement comme dans l'original.
 */
const MEASURES: Array<{
  name: string
  gaze: HeadGaze
  split: number
  w: number
  h: number
  eyes: Array<{ x: number; y: number; short: number; long: number }>
}> = [
  {
    name: 'idle',
    gaze: REST_GAZE,
    split: EYE_SPLIT,
    w: EYE_W,
    h: EYE_H,
    eyes: [
      { x: 0.189, y: -0.412, short: 0.178, long: 0.39 },
      { x: 0.614, y: -0.51, short: 0.12, long: 0.395 }
    ]
  },
  {
    name: 'yeux ecarquilles',
    gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
    split: 18.43,
    w: 0.356,
    h: 0.875,
    eyes: [
      { x: -0.198, y: 0.295, short: 0.353, long: 0.82 },
      { x: 0.412, y: 0.415, short: 0.315, long: 0.826 }
    ]
  },
  {
    name: 'notification',
    gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 },
    split: 18.89,
    w: 0.505,
    h: 0.498,
    eyes: [
      { x: -0.675, y: 0.172, short: 0.39, long: 0.495 },
      { x: -0.059, y: 0.027, short: 0.495, long: 0.5 }
    ]
  }
]

const short = (e: ReturnType<typeof eyePoses>[number], w: number) => Math.hypot(e.a, e.b) * w
const long = (e: ReturnType<typeof eyePoses>[number], h: number) => Math.hypot(e.c, e.d) * h

describe('yeux poses sur une sphere', () => {
  for (const m of MEASURES) {
    it(`reproduit la pose "${m.name}" mesuree sur la video`, () => {
      const poses = eyePoses(m.gaze, 1, m.split)
      for (let i = 0; i < 2; i++) {
        const p = poses[i]!
        const expected = m.eyes[i]!
        // 0.04 rayon = ~7 px sur la boule de 190 px de la video
        expect(p.x).toBeCloseTo(expected.x, 1)
        expect(p.y).toBeCloseTo(expected.y, 1)
        expect(Math.abs(short(p, m.w) - expected.short)).toBeLessThan(0.04)
        expect(Math.abs(long(p, m.h) - expected.long)).toBeLessThan(0.04)
      }
    })
  }

  it('comprime l oeil exactement du facteur de profondeur de la sphere', () => {
    // Invariant exact : le determinant du repere tangent projete vaut z. C'est
    // lui qui fait que l'aire de l'oeil suit la courbure (mesure : 0.663).
    for (const e of eyePoses(REST_GAZE, 1)) {
      expect(e.a * e.d - e.b * e.c).toBeCloseTo(e.depth, 6)
    }
    const [near, far] = eyePoses(REST_GAZE, 1)
    expect(far.depth / near.depth).toBeCloseTo(0.663, 1)
    // mesure video de la largeur : 0.120 / 0.178 = 0.674
    expect(short(far, EYE_W) / short(near, EYE_W)).toBeCloseTo(0.674, 1)
  })

  it('garde la meme longueur pour les deux yeux (axe tangentiel non deforme)', () => {
    const [a, b] = eyePoses(REST_GAZE, 1)
    expect(long(a, EYE_H)).toBeCloseTo(long(b, EYE_H), 3)
  })

  it('conserve la separation angulaire de 31 degres quel que soit le regard', () => {
    for (const gaze of [REST_GAZE, { yaw: -40, pitch: 10, roll: 5 }, { yaw: 0, pitch: 0, roll: 0 }]) {
      const [a, b] = eyePoses(gaze, 1)
      const dot = a.x * b.x + a.y * b.y + a.depth * b.depth
      expect((Math.acos(dot) * 180) / Math.PI).toBeCloseTo(EYE_SPLIT * 2, 4)
    }
  })

  it('fait passer un oeil derriere la sphere quand la tete tourne fort', () => {
    const [, far] = eyePoses({ yaw: 80, pitch: 0, roll: 0 }, 1)
    expect(far.depth).toBeLessThan(0)
  })
})

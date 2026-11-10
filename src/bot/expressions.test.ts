import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { EXPRESSIONS, EXPRESSION_BY_ID, blendExpression } from './expressions'
import { radiusAtAngle } from './shape'
import { SHAPE_BY_ID } from './skins'

const circle = () => SHAPE_BY_ID.get('circle')!.radii

/** Matrice de l'oeil rendu -> position, dimensions ecran et angle du grand axe. */
function renderStyle(matrix: string, w: number, h: number) {
  const [a, b, c, d, e, f] = /matrix\(([^)]+)\)/.exec(matrix)![1]!.split(',').map(Number) as number[]
  return {
    x: e!,
    y: f!,
    width: Math.hypot(a!, b!) * w,
    height: Math.hypot(c!, d!) * h,
    axis: (Math.atan2(d!, c!) * 180) / Math.PI - 90
  }
}

describe('catalogue des expressions', () => {
  it('expose 16 expressions aux identifiants uniques', () => {
    expect(EXPRESSIONS).toHaveLength(16)
    expect(new Set(EXPRESSIONS.map((e) => e.id)).size).toBe(16)
    expect(EXPRESSION_BY_ID.size).toBe(16)
  })

  /**
   * Le piege sur lequel on est tombe : un oeil dont le rapport largeur/hauteur
   * approche 1 est un cercle, il a la meme allure a tout angle et son
   * inclinaison est invisible. Toute expression qui compte sur une inclinaison
   * doit donc avoir des yeux franchement allonges.
   */
  it('n incline que des yeux assez allonges pour que ca se voie', () => {
    for (const e of EXPRESSIONS) {
      for (const eye of e.eyes) {
        const tilt = Math.abs(eye.tilt ?? 0)
        if (tilt < 1) continue
        const rapport = eye.w / eye.h
        const threshold = tilt >= 20 ? [0.6, 1.7] : [0.8, 1.25]
        expect(
          rapport < threshold[0]! || rapport > threshold[1]!,
          `${e.id}: rapport ${rapport.toFixed(2)} trop near de 1 pour une inclinaison de ${tilt}deg`
        ).toBe(true)
      }
    }
  })

  it('incline la colere et la tristesse en miroir, et dans des sens opposes', () => {
    const angles = (id: string) => {
      const f = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get(id)!).sample(1)
      const e = EXPRESSION_BY_ID.get(id)!
      return f.eyes.map((eye, i) => renderStyle(eye.matrix, e.eyes[i]!.w, e.eyes[i]!.h).axis)
    }
    const angry = angles('angry')
    const sad = angles('sad')
    // en miroir : les deux yeux penchent a l'oppose l'un de l'autre
    expect(Math.sign(angry[0]!)).toBe(-Math.sign(angry[1]!))
    expect(Math.sign(sad[0]!)).toBe(-Math.sign(sad[1]!))
    // et les deux emotions sont inversees l'une par rapport a l'autre
    expect(Math.sign(angry[0]!)).toBe(-Math.sign(sad[0]!))
  })

  it('garde les deux yeux dans la silhouette, sur les 16 expressions', () => {
    for (const e of EXPRESSIONS) {
      const f = new BotEngine(100, 'idle', circle(), e).sample(1)
      expect(f.eyes, e.id).toHaveLength(2)
      for (let i = 0; i < 2; i++) {
        const r = renderStyle(f.eyes[i]!.matrix, e.eyes[i]!.w, e.eyes[i]!.h)
        // demi-diagonale de l'oeil : le coin le plus lointain doit rester dedans
        const half = Math.hypot(r.width, r.height) / 2
        const edge = radiusAtAngle(circle(), Math.atan2(r.y, r.x)) * 100
        expect(Math.hypot(r.x, r.y) + half, `${e.id} eye ${i}`).toBeLessThan(edge * 1.02)
      }
    }
  })
})

describe('changement d expression', () => {
  it('interpole la geometrie de facon monotone', () => {
    // On mesure sur blendExpression, pas sur le rendu : la derive du regard au
    // repos fait varier la projection, donc la hauteur a l'ecran n'est pas
    // monotone meme quand l'interpolation, elle, l'est.
    const from = EXPRESSION_BY_ID.get('neutral')!
    const to = EXPRESSION_BY_ID.get('scared')!
    const heights = [0, 0.25, 0.5, 0.75, 1].map((t) => blendExpression(from, to, t).eyes[0]!.h)
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]!).toBeGreaterThan(heights[i - 1]!)
    }
    expect(heights[0]!).toBeCloseTo(from.eyes[0]!.h, 5)
    expect(heights[4]!).toBeCloseTo(to.eyes[0]!.h, 5)
  })

  it('glisse vers la nouvelle expression au lieu de sauter', () => {
    const target = EXPRESSION_BY_ID.get('scared')!
    const e = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get('neutral')!)
    e.setExpression(target, 1)

    // juste apres le changement, l'oeil n'a pas encore la forme de la cible...
    const tot = e.sample(1.02).eyes[0]!.d
    const arrive = new BotEngine(100, 'idle', circle(), target).sample(1).eyes[0]!.d
    expect(tot).not.toBe(arrive)
    // ...et il l'a une fois le morph termine
    expect(e.sample(1 + BotEngine.SHAPE_MORPH + 0.05).eyes[0]!.d).toBe(arrive)
  })

  it('reste une fonction pure du temps pendant le morph', () => {
    const e = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get('neutral')!)
    e.setExpression(EXPRESSION_BY_ID.get('angry')!, 1)
    const middle = e.sample(1.12).eyes[0]!.matrix
    e.sample(3)
    expect(e.sample(1.12).eyes[0]!.matrix).toBe(middle)
  })

  it('n applique l expression qu a l etat de repos', () => {
    const expr = EXPRESSION_BY_ID.get('scared')!
    // wink a son expression propre, relevee sur la video : elle doit survivre
    const bare = new BotEngine(100, 'wink', circle()).sample(1)
    const dressed = new BotEngine(100, 'wink', circle(), expr).sample(1)
    expect(dressed.eyes[0]!.d).toBe(bare.eyes[0]!.d)

    const idle = new BotEngine(100, 'idle', circle(), expr).sample(1)
    const idleBare = new BotEngine(100, 'idle', circle()).sample(1)
    expect(idle.eyes[0]!.d).not.toBe(idleBare.eyes[0]!.d)
  })

  it('interpole toutes les composantes, inclinaison comprise', () => {
    const a = EXPRESSION_BY_ID.get('angry')!
    const b = EXPRESSION_BY_ID.get('sad')!
    const m = blendExpression(a, b, 0.5)
    expect(m.eyes[0]!.tilt).toBeCloseTo(((a.eyes[0]!.tilt ?? 0) + (b.eyes[0]!.tilt ?? 0)) / 2, 5)
    expect(m.split).toBeCloseTo((a.split + b.split) / 2, 5)
    expect(m.gaze.pitch).toBeCloseTo((a.gaze.pitch + b.gaze.pitch) / 2, 5)
  })
})

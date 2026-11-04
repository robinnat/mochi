import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { PORTE_IDS, dessinPorte, lunettesDe, mesuresPorte, partiesPorte, porteSvg } from './portes'
import { SHAPE_BY_ID } from './skins'
import { POSES, type StateId } from './states'

const image = (etat: StateId, forme = 'cercle', t = POSES[etat]) =>
  new BotEngine(100, etat, SHAPE_BY_ID.get(forme)!.radii, null).sample(t)

describe('accessoires portes', () => {
  it('chaque accessoire dessine quelque chose sur une image au repos', () => {
    for (const id of PORTE_IDS) {
      const prims = dessinPorte(id, image('idle'))
      expect(prims.length, id).toBeGreaterThan(0)
      for (const p of prims) expect(p.d.startsWith('M'), id).toBe(true)
      expect(porteSvg(id, image('idle'))).toContain('<path')
    }
  })

  it('un chapeau suit le sommet du corps, pas une position fixe', () => {
    const haut = (f: ReturnType<typeof image>) => mesuresPorte(f)!.haut
    const rond = image('idle')
    const pointe = image('idle', 'triangle')
    expect(haut(rond)).not.toBeCloseTo(haut(pointe), 0)
    // le chapeau est centre sur l'axe du corps de cette image
    const g = mesuresPorte(pointe)!
    for (const p of partiesPorte('haut-de-forme', g)) if ('x' in p) expect(p.x).toBeCloseTo(g.cx, 3)
  })

  it('un chapeau suit le corps quand il s ecrase (geste), au bit pres', () => {
    const e = new BotEngine(100, 'idle')
    const plat = mesuresPorte(e.sample(1))!
    const ecrase = mesuresPorte(e.sample(1, { dx: 0, dy: 0.1, sx: 1.1, sy: 0.8, yaw: 0, pitch: 0, roll: 0, lid: 0 }))!
    expect(ecrase.haut).toBeGreaterThan(plat.haut)
  })

  it('les lunettes suivent les yeux : elles bougent avec le regard et le clin d oeil', () => {
    const idle = lunettesDe('lunettes', image('idle'))
    const wink = lunettesDe('lunettes', image('wink'))
    expect(idle.length).toBeGreaterThan(0)
    expect(wink.length).toBeGreaterThan(0)
    expect(idle.map((p) => p.d).join()).not.toBe(wink.map((p) => p.d).join())
  })

  it('les verres ne sont jamais opaques : l oeil se lit au travers (clin d oeil, yeux ecarquilles)', () => {
    for (const etat of ['idle', 'wink', 'wide'] as const) {
      for (const id of ['lunettes', 'soleil'] as const) {
        const verres = lunettesDe(id, image(etat)).filter((p) => p.fill)
        expect(verres.length).toBeGreaterThan(0)
        for (const v of verres) expect(v.alpha!).toBeLessThanOrEqual(0.56)
      }
    }
  })

  it('sans visage (thinking, sleep) les lunettes disparaissent, le chapeau reste', () => {
    for (const etat of ['thinking', 'sleep'] as const) {
      expect(lunettesDe('soleil', image(etat))).toEqual([])
      expect(dessinPorte('bonnet', image(etat)).length).toBeGreaterThan(0)
    }
  })

  it('le moteur ne change pas : la meme image avec ou sans accessoire', () => {
    const a = new BotEngine(100, 'wink').sample(0.8)
    dessinPorte('couronne', a)
    expect(new BotEngine(100, 'wink').sample(0.8)).toEqual(a)
  })
})

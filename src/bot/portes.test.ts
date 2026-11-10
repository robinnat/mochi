import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { PORTE_IDS, mesuresPorte, partiesPorte, yeuxDe } from './portes'
import { SHAPE_BY_ID } from './skins'
import { POSES, type StateId } from './states'

const image = (etat: StateId, forme = 'cercle', t = POSES[etat]) =>
  new BotEngine(100, etat, SHAPE_BY_ID.get(forme)!.radii, null).sample(t)

describe('accessoires portes (geometrie commune a la 3D)', () => {
  it('chaque chapeau a des parties sur une image au repos', () => {
    const g = mesuresPorte(image('idle'))!
    for (const id of PORTE_IDS) {
      if (id === 'lunettes' || id === 'soleil') continue
      expect(partiesPorte(id, g).length, id).toBeGreaterThan(0)
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

  it('les yeux lus pour les lunettes suivent le regard et le clin d oeil', () => {
    const idle = yeuxDe(image('idle'))
    const wink = yeuxDe(image('wink'))
    expect(idle.length).toBe(2)
    expect(wink.length).toBe(2)
    expect(JSON.stringify(idle)).not.toBe(JSON.stringify(wink))
  })

  it('le moteur ne change pas : la meme image avec ou sans accessoire', () => {
    const a = new BotEngine(100, 'wink').sample(0.8)
    partiesPorte('couronne', mesuresPorte(a)!)
    expect(new BotEngine(100, 'wink').sample(0.8)).toEqual(a)
  })
})

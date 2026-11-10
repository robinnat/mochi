import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { WORN_IDS, measuresWorn, partsWorn, eyesOf } from './worn'
import { SHAPE_BY_ID } from './skins'
import { POSES, type StateId } from './states'

const image = (state: StateId, shape = 'circle', t = POSES[state]) =>
  new BotEngine(100, state, SHAPE_BY_ID.get(shape)!.radii, null).sample(t)

describe('accessoires portes (geometrie commune a la 3D)', () => {
  it('chaque chapeau a des parties sur une image au repos', () => {
    const g = measuresWorn(image('idle'))!
    for (const id of WORN_IDS) {
      if (id === 'glasses' || id === 'sunglasses') continue
      expect(partsWorn(id, g).length, id).toBeGreaterThan(0)
    }
  })

  it('un chapeau suit le sommet du corps, pas une position fixe', () => {
    const top = (f: ReturnType<typeof image>) => measuresWorn(f)!.top
    const round = image('idle')
    const tip = image('idle', 'triangle')
    expect(top(round)).not.toBeCloseTo(top(tip), 0)
    // le chapeau est centre sur l'axe du corps de cette image
    const g = measuresWorn(tip)!
    for (const p of partsWorn('top-hat', g)) if ('x' in p) expect(p.x).toBeCloseTo(g.cx, 3)
  })

  it('un chapeau suit le corps quand il s ecrase (geste), au bit pres', () => {
    const e = new BotEngine(100, 'idle')
    const flat = measuresWorn(e.sample(1))!
    const squashed = measuresWorn(e.sample(1, { dx: 0, dy: 0.1, sx: 1.1, sy: 0.8, yaw: 0, pitch: 0, roll: 0, lid: 0 }))!
    expect(squashed.top).toBeGreaterThan(flat.top)
  })

  it('les yeux lus pour les lunettes suivent le regard et le clin d oeil', () => {
    const idle = eyesOf(image('idle'))
    const wink = eyesOf(image('wink'))
    expect(idle.length).toBe(2)
    expect(wink.length).toBe(2)
    expect(JSON.stringify(idle)).not.toBe(JSON.stringify(wink))
  })

  it('le moteur ne change pas : la meme image avec ou sans accessoire', () => {
    const a = new BotEngine(100, 'wink').sample(0.8)
    partsWorn('crown', measuresWorn(a)!)
    expect(new BotEngine(100, 'wink').sample(0.8)).toEqual(a)
  })
})

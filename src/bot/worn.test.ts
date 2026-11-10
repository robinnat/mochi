import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { WORN_IDS, measuresWorn, partsWorn, eyesOf } from './worn'
import { SHAPE_BY_ID } from './skins'
import { POSES, type StateId } from './states'

const image = (state: StateId, shape = 'circle', t = POSES[state]) =>
  new BotEngine(100, state, SHAPE_BY_ID.get(shape)!.radii, null).sample(t)

describe('worn accessories (geometry shared with the 3D)', () => {
  it('each hat has parts on a resting frame', () => {
    const g = measuresWorn(image('idle'))!
    for (const id of WORN_IDS) {
      if (id === 'glasses' || id === 'sunglasses') continue
      expect(partsWorn(id, g).length, id).toBeGreaterThan(0)
    }
  })

  it('a hat follows the top of the body, not a fixed position', () => {
    const top = (f: ReturnType<typeof image>) => measuresWorn(f)!.top
    const round = image('idle')
    const tip = image('idle', 'triangle')
    expect(top(round)).not.toBeCloseTo(top(tip), 0)
    // the hat is centered on the body axis of this frame
    const g = measuresWorn(tip)!
    for (const p of partsWorn('top-hat', g)) if ('x' in p) expect(p.x).toBeCloseTo(g.cx, 3)
  })

  it('a hat follows the body when it squashes (gesture), to the bit', () => {
    const e = new BotEngine(100, 'idle')
    const flat = measuresWorn(e.sample(1))!
    const squashed = measuresWorn(e.sample(1, { dx: 0, dy: 0.1, sx: 1.1, sy: 0.8, yaw: 0, pitch: 0, roll: 0, lid: 0 }))!
    expect(squashed.top).toBeGreaterThan(flat.top)
  })

  it('the eyes read for the glasses follow the gaze and the wink', () => {
    const idle = eyesOf(image('idle'))
    const wink = eyesOf(image('wink'))
    expect(idle.length).toBe(2)
    expect(wink.length).toBe(2)
    expect(JSON.stringify(idle)).not.toBe(JSON.stringify(wink))
  })

  it('the engine does not change: the same frame with or without an accessory', () => {
    const a = new BotEngine(100, 'wink').sample(0.8)
    partsWorn('crown', measuresWorn(a)!)
    expect(new BotEngine(100, 'wink').sample(0.8)).toEqual(a)
  })
})

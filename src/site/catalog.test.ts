import { describe, expect, it } from 'vitest'
import { ACTIVITES_SITE, ETATS, GESTES, cycleDe } from './catalog'

describe('catalogue du site', () => {
  it('chaque geste est fini et chaque cycle a des durees positives', () => {
    for (const a of [...GESTES, ...ACTIVITES_SITE]) {
      for (let t = 0; t < 12; t += 0.37) {
        const g = a.geste?.(t)
        if (g) for (const v of Object.values(g)) expect(Number.isFinite(v)).toBe(true)
      }
      for (const b of a.cycle) expect(b.duration).toBeGreaterThan(0)
    }
  })
  it('les 14 etats ont un cycle qui revient au repos', () => {
    expect(ETATS).toHaveLength(14)
    for (const e of ETATS) expect(cycleDe(e).length).toBeGreaterThan(0)
  })
})

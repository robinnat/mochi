import { describe, expect, it } from 'vitest'
import { ACC_EN_IDS, ACTIVITES_SITE, ETATS, GESTES, HUMEURS_SITE, INTERACTIONS_SITE, cycleDe } from './catalog'
import { CATALOGUE } from '@/bot/emplacements'
import { MOOD_IDS } from '@/bot/humeurs'

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
  it('les 5 etats ont un cycle qui revient au repos', () => {
    expect(ETATS).toHaveLength(5)
    for (const e of ETATS) expect(cycleDe(e).length).toBeGreaterThan(0)
  })

  it('les 7 humeurs du moteur sont toutes sur le site, dans l ordre', () => {
    expect(HUMEURS_SITE.map((h) => h.id)).toEqual(MOOD_IDS)
    expect(HUMEURS_SITE).toHaveLength(7)
  })

  it('chaque accessoire du catalogue a un libelle anglais', () => {
    for (const a of CATALOGUE) expect(ACC_EN_IDS, a.id).toContain(a.id)
  })

  it('les textes du site n ont ni tiret cadratin ni accent (anglais)', () => {
    const textes = [...HUMEURS_SITE.flatMap((h) => [h.label, h.texte]), ...INTERACTIONS_SITE.flatMap((i) => [i.geste, i.nom, i.texte])]
    for (const t of textes) {
      expect(t).not.toMatch(/[\u2014\u2013]/)
      expect(t).not.toMatch(/[\u00e0-\u00ff]/)
    }
  })
})

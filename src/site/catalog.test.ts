import { describe, expect, it } from 'vitest'
import { ACC_EN_IDS, FORMES_3D, FORME_IDS, HUMEURS_SITE, INTERACTIONS_SITE, PALETTE_SITE } from './catalog'
import { contraste } from '@/ui/trois/theme'
import { CATALOGUE } from '@/bot/emplacements'
import { MOOD_IDS } from '@/bot/humeurs'

describe('catalogue du site', () => {
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

  it('le site montre les 12 formes, coeur compris, chacune avec sa couleur', () => {
    expect(FORMES_3D).toHaveLength(12)
    expect(FORMES_3D.map((f) => f.id).sort()).toEqual([...FORME_IDS].sort())
    expect(FORME_IDS).toContain('coeur')
    const couleurs = FORMES_3D.map((f) => f.couleur.toLowerCase())
    expect(new Set(couleurs).size).toBe(12)
    for (const c of couleurs) expect(PALETTE_SITE.map((p) => p.hex)).toContain(c)
  })

  it('la palette des exemples : au moins 12 teintes distinctes, lisibles sur fond clair ET sombre', () => {
    expect(PALETTE_SITE.length).toBeGreaterThanOrEqual(12)
    expect(new Set(PALETTE_SITE.map((p) => p.hex)).size).toBe(PALETTE_SITE.length)
    for (const { nom, hex } of PALETTE_SITE) {
      expect(hex, nom).toMatch(/^#[0-9a-f]{6}$/)
      expect(contraste(hex, '#fffdf9'), `${nom} sur clair`).toBeGreaterThan(1.3)
      expect(contraste(hex, '#15141b'), `${nom} sur sombre`).toBeGreaterThan(3)
    }
  })
})

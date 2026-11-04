import { describe, expect, it } from 'vitest'
import { PROFILE_SAMPLES } from './profiles'
import { radiusAtAngle } from './shape'
import { SHAPE_BY_ID, SHAPES } from './skins'

/**
 * Les formes ajoutees le 03/11/2026 (etoile, fleur, oeuf ; le coeur a ete retire le 03/11/2026). Ce qui est verrouille :
 * leur silhouette se lit (branches, echancrure, petales), elles passent par le meme
 * echantillonnage angulaire que les autres, et elles pesent pareil a l'oeil. Le
 * debordement des yeux, lui, est deja couvert par `skins.test.ts`, qui balaye toutes les
 * formes du catalogue.
 */

const rayons = (id: string) => SHAPE_BY_ID.get(id)!.radii
/** Angle ecran en degres (0 = droite, 90 = bas, -90 = haut). */
const r = (id: string, deg: number) => radiusAtAngle(rayons(id), (deg * Math.PI) / 180)

/** Nombre de maximums locaux stricts du profil, sur le tour complet. */
function bosses(radii: number[]) {
  const n = radii.length
  let k = 0
  for (let i = 0; i < n; i++) {
    const a = radii[(i - 1 + n) % n]!
    const b = radii[i]!
    const c = radii[(i + 1) % n]!
    if (b > a && b >= c) k++
  }
  return k
}

describe('nouvelles formes', () => {
  const nouvelles = ['etoile', 'fleur', 'oeuf']

  it('sont au catalogue, echantillonnees comme les autres, sans rayon nul', () => {
    for (const id of nouvelles) {
      const radii = rayons(id)
      expect(radii).toHaveLength(PROFILE_SAMPLES)
      expect(Math.min(...radii)).toBeGreaterThan(0.45)
      expect(Math.max(...radii)).toBeGreaterThan(1)
      expect(Math.max(...radii)).toBeLessThan(1.15)
    }
    expect(SHAPES.map((s) => s.id).slice(-3)).toEqual(nouvelles)
  })

  it("l'etoile a cinq branches, une vers le haut", () => {
    expect(bosses(rayons('etoile'))).toBe(5)
    expect(r('etoile', -90)).toBeGreaterThan(r('etoile', -54) + 0.1)
    // etoile douce (creux a 0,6 du sommet, bouts bien ronds, 04/11/2026) : le creux reste lisible
    expect(Math.min(...rayons('etoile'))).toBeLessThan(0.85)
    expect(Math.min(...rayons('etoile'))).toBeGreaterThan(0.45)
  })

  it('la fleur a cinq petales, un vers le haut', () => {
    expect(bosses(rayons('fleur'))).toBe(5)
    expect(r('fleur', -90)).toBeGreaterThan(r('fleur', -54))
  })

  it("l'oeuf est debout et plus large en bas qu'en haut", () => {
    expect(r('oeuf', 90) + r('oeuf', -90)).toBeGreaterThan(r('oeuf', 0) + r('oeuf', 180))
    expect(r('oeuf', 45)).toBeGreaterThan(r('oeuf', -45))
  })
})

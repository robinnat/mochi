import { describe, expect, it } from 'vitest'
import { PROFILE_SAMPLES } from './profiles'
import { radiusAtAngle } from './shape'
import { SHAPE_BY_ID, SHAPES } from './skins'

/**
 * Les formes ajoutees le 03/11/2026 (etoile, fleur, oeuf ; le coeur retire le 03/11 est revenu le 06/11/2026, forme neuve). Ce qui est verrouille :
 * leur silhouette se lit (branches, echancrure, petales), elles passent par le meme
 * echantillonnage angulaire que les autres, et elles pesent pareil a l'oeil. Le
 * debordement des yeux, lui, est deja couvert par `skins.test.ts`, qui balaye toutes les
 * formes du catalogue.
 */

const radiiOf = (id: string) => SHAPE_BY_ID.get(id)!.radii
/** Angle ecran en degres (0 = droite, 90 = bas, -90 = haut). */
const r = (id: string, deg: number) => radiusAtAngle(radiiOf(id), (deg * Math.PI) / 180)

/** Nombre de maximums locaux stricts du profil, sur le tour complet. */
function bumps(radii: number[]) {
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

describe('nouvelles shapes', () => {
  const freshOnes = ['star', 'flower', 'egg', 'heart']

  it('sont au catalogue, echantillonnees comme les autres, sans rayon nul', () => {
    for (const id of freshOnes) {
      const radii = radiiOf(id)
      expect(radii).toHaveLength(PROFILE_SAMPLES)
      expect(Math.min(...radii)).toBeGreaterThan(0.45)
      expect(Math.max(...radii)).toBeGreaterThan(1)
      expect(Math.max(...radii)).toBeLessThan(1.15)
    }
    expect(SHAPES.map((s) => s.id).slice(-4)).toEqual(freshOnes)
  })

  it("l'etoile a cinq branches, une vers le haut", () => {
    expect(bumps(radiiOf('star'))).toBe(5)
    expect(r('star', -90)).toBeGreaterThan(r('star', -54) + 0.1)
    // etoile douce (creux a 0,6 du sommet, bouts bien ronds, 04/11/2026) : le creux reste lisible
    expect(Math.min(...radiiOf('star'))).toBeLessThan(0.85)
    expect(Math.min(...radiiOf('star'))).toBeGreaterThan(0.45)
  })

  it('la fleur a cinq petales, un vers le haut', () => {
    expect(bumps(radiiOf('flower'))).toBe(5)
    expect(r('flower', -90)).toBeGreaterThan(r('flower', -54))
  })

  it('le coeur a un creux en haut, deux lobes et une pointe en bas', () => {
    const c = radiiOf('heart')
    expect(bumps(c)).toBe(3)
    // creux : le rayon vers le haut est plus court que vers les lobes (-60 et -120 deg)
    expect(r('heart', -90)).toBeLessThan(r('heart', -55) - 0.15)
    expect(r('heart', -90)).toBeLessThan(r('heart', -125) - 0.15)
    // pointe vers le bas, douce, et symetrique gauche droite
    expect(r('heart', 90)).toBeGreaterThan(0.7)
    expect(r('heart', 90)).toBeGreaterThan(r('heart', 0) - 0.1)
    expect(r('heart', 90)).toBeLessThan(1.06)
    expect(Math.abs(r('heart', -55) - r('heart', -125))).toBeLessThan(0.02)
  })

  it("l'oeuf est debout et plus large en bas qu'en haut", () => {
    expect(r('egg', 90) + r('egg', -90)).toBeGreaterThan(r('egg', 0) + r('egg', 180))
    expect(r('egg', 45)).toBeGreaterThan(r('egg', -45))
  })
})

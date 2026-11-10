import { describe, expect, it } from 'vitest'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import {
  estRendu,
  estTaillePixel,
  grillePixel,
  PIXEL_DEFAUT,
  RENDU_DEFAUT,
  RENDUS,
  renduEffectif,
  renduCourant,
  suffixeRendu,
  TAILLES_PIXEL
} from './rendu'

/**
 * Le choix du style de rendu. Le moteur et ses cinq etats ne bougent pas : seul le
 * dessin change, donc ce qui est verrouille ici, c'est le catalogue, sa valeur par defaut
 * et la facon dont une valeur relue du stockage est acceptee ou refusee.
 */
describe('catalogue des styles', () => {
  it('garde la 3D douce (Soft) par defaut', () => {
    expect(RENDU_DEFAUT).toBe('3d')
    expect(RENDUS[0]).toBe('3d')
  })

  it('ne propose que trois styles, tous en vraie 3D : Soft, Flat, Pixel', () => {
    expect(RENDUS).toEqual(['3d', 'flat3d', 'pixel3d'])
  })

  it("refuse les anciens styles 2D relus du stockage : l'application retombe sur Soft", () => {
    for (const ancien of ['original', 'pixel', 'argile', 'bulle']) expect(estRendu(ancien)).toBe(false)
  })

  it('refuse une valeur inconnue relue du stockage', () => {
    for (const id of RENDUS) expect(estRendu(id)).toBe(true)
    expect(estRendu('4d')).toBe(false)
    expect(estRendu('')).toBe(false)
    expect(estRendu('constructor')).toBe(false)
  })

  it('suit le reglage courant quand le composant ne recoit pas de style', () => {
    renduCourant.value = 'flat3d'
    expect(renduEffectif(undefined)).toBe('flat3d')
    expect(renduEffectif('pixel3d')).toBe('pixel3d')
    renduCourant.value = RENDU_DEFAUT
    expect(renduEffectif(undefined)).toBe('3d')
  })

  it('ignore un style inconnu passe au composant (ancien style 2D compris)', () => {
    expect(renduEffectif('argile')).toBe('3d')
    expect(renduEffectif('original')).toBe('3d')
  })

  it('nomme le fichier exporte avec le style reel', () => {
    expect(suffixeRendu('3d')).toBe('3d')
    expect(suffixeRendu('pixel3d')).toBe('pixel3d')
  })
})

describe('taille des pixels', () => {
  it('a trois tailles, la plus fine par defaut', () => {
    expect(TAILLES_PIXEL.map((p) => p.id)).toEqual(['gros', 'moyen', 'fin'])
    expect(PIXEL_DEFAUT).toBe('fin')
    expect(estTaillePixel('moyen')).toBe(true)
    expect(estTaillePixel('enorme')).toBe(false)
  })

  it('donne une boule de 16 a 32 pixels de diametre', () => {
    for (const p of TAILLES_PIXEL) {
      const g = grillePixel(p.id)
      // la grille couvre tout le viewBox, la boule n'en occupe que RAYON / DEMI_VIEWBOX
      const diametre = (g * RAYON) / DEMI_VIEWBOX
      expect(diametre).toBeGreaterThanOrEqual(15.5)
      expect(diametre).toBeLessThanOrEqual(32.5)
    }
    expect(grillePixel('gros')).toBeLessThan(grillePixel('moyen'))
    expect(grillePixel('moyen')).toBeLessThan(grillePixel('fin'))
  })
})

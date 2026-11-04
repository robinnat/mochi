import { describe, expect, it } from 'vitest'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { COLORS } from '@/bot/skins'
import {
  estRendu,
  estVraie3d,
  renduExportable,
  estTaillePixel,
  grillePixel,
  PIXEL_DEFAUT,
  RENDU_DEFAUT,
  RENDUS,
  renduEffectif,
  renduCourant,
  suffixeRendu,
  TAILLES_PIXEL,
  teintes3d
} from './rendu'

/**
 * Le choix du style de rendu. Le moteur et ses cinq etats ne bougent pas : seul le
 * dessin change, donc ce qui est verrouille ici, c'est le catalogue, sa valeur par defaut
 * et la facon dont une valeur relue du stockage est acceptee ou refusee.
 */
describe('catalogue des styles', () => {
  it("garde l'original par defaut, pour ne rien changer a qui n'a rien choisi", () => {
    expect(RENDU_DEFAUT).toBe('original')
    expect(RENDUS[0]).toBe('original')
  })

  it('propose le pixel art, les deux 3D douces et la vraie 3D', () => {
    expect(RENDUS).toEqual(['original', 'pixel', 'argile', 'bulle', '3d'])
  })

  it("exporte la vraie 3D en argile, sa version SVG", () => {
    expect(renduExportable('3d')).toBe('argile')
    expect(renduExportable('pixel')).toBe('pixel')
    expect(estVraie3d('3d')).toBe(true)
    expect(estVraie3d('argile')).toBe(false)
  })

  it('refuse une valeur inconnue relue du stockage', () => {
    for (const id of RENDUS) expect(estRendu(id)).toBe(true)
    expect(estRendu('4d')).toBe(false)
    expect(estRendu('')).toBe(false)
    expect(estRendu('constructor')).toBe(false)
  })

  it('suit le reglage courant quand le composant ne recoit pas de style', () => {
    renduCourant.value = 'bulle'
    expect(renduEffectif(undefined)).toBe('bulle')
    expect(renduEffectif('pixel')).toBe('pixel')
    renduCourant.value = RENDU_DEFAUT
    expect(renduEffectif(undefined)).toBe('original')
  })

  it("n'ajoute rien au nom de fichier pour l'original", () => {
    expect(suffixeRendu('original')).toBe('')
    expect(suffixeRendu('pixel')).toBe('pixel')
    expect(suffixeRendu('argile')).toBe('argile')
  })
})

describe('taille des pixels', () => {
  it('a trois tailles, la moyenne par defaut', () => {
    expect(TAILLES_PIXEL.map((p) => p.id)).toEqual(['gros', 'moyen', 'fin'])
    expect(PIXEL_DEFAUT).toBe('moyen')
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

describe('teintes de la 3D douce', () => {
  it('eclaire et assombrit la couleur choisie, pour chaque couleur', () => {
    const lum = (h: string) => {
      const v = parseInt(h.slice(1), 16)
      return ((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255)
    }
    for (const c of COLORS) {
      for (const r of ['argile', 'bulle'] as const) {
        const t = teintes3d(c.hex, r)
        // la bulle garde la couleur telle quelle, l'argile la passe au pastel
        if (r === 'bulle') expect(t.base).toBe(c.hex)
        else expect(lum(t.base)).toBeGreaterThanOrEqual(lum(c.hex))
        expect(lum(t.clair)).toBeGreaterThan(lum(t.base))
        expect(lum(t.ombre)).toBeLessThanOrEqual(lum(c.hex))
        expect(t.clair).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('rend la bulle plus lumineuse que l\'argile', () => {
    const lum = (h: string) => parseInt(h.slice(1, 3), 16)
    expect(lum(teintes3d('#e8483f', 'bulle').clair)).toBeGreaterThan(
      lum(teintes3d('#e8483f', 'argile').clair)
    )
  })
})

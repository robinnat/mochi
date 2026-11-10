import { describe, expect, it } from 'vitest'
import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'
import {
  isRenderStyle,
  isPixelSize,
  pixelGrid,
  DEFAULT_PIXEL,
  DEFAULT_RENDER_STYLE,
  RENDER_STYLES,
  effectiveRenderStyle,
  currentRenderStyle,
  renderStyleSuffix,
  PIXEL_SIZES
} from './renderStyle'

/**
 * Le choix du style de rendu. Le moteur et ses cinq etats ne bougent pas : seul le
 * dessin change, donc ce qui est verrouille ici, c'est le catalogue, sa valeur par defaut
 * et la facon dont une valeur relue du stockage est acceptee ou refusee.
 */
describe('catalogue des styles', () => {
  it('garde la 3D douce (Soft) par defaut', () => {
    expect(DEFAULT_RENDER_STYLE).toBe('3d')
    expect(RENDER_STYLES[0]).toBe('3d')
  })

  it('ne propose que trois styles, tous en vraie 3D : Soft, Flat, Pixel', () => {
    expect(RENDER_STYLES).toEqual(['3d', 'flat3d', 'pixel3d'])
  })

  it("refuse les anciens styles 2D relus du stockage : l'application retombe sur Soft", () => {
    for (const old of ['original', 'pixel', 'argile', 'bubble']) expect(isRenderStyle(old)).toBe(false)
  })

  it('refuse une value inconnue relue du stockage', () => {
    for (const id of RENDER_STYLES) expect(isRenderStyle(id)).toBe(true)
    expect(isRenderStyle('4d')).toBe(false)
    expect(isRenderStyle('')).toBe(false)
    expect(isRenderStyle('constructor')).toBe(false)
  })

  it('suit le reglage courant quand le composant ne recoit pas de style', () => {
    currentRenderStyle.value = 'flat3d'
    expect(effectiveRenderStyle(undefined)).toBe('flat3d')
    expect(effectiveRenderStyle('pixel3d')).toBe('pixel3d')
    currentRenderStyle.value = DEFAULT_RENDER_STYLE
    expect(effectiveRenderStyle(undefined)).toBe('3d')
  })

  it('ignore un style inconnu passe au composant (ancien style 2D compris)', () => {
    expect(effectiveRenderStyle('argile')).toBe('3d')
    expect(effectiveRenderStyle('original')).toBe('3d')
  })

  it('nomme le fichier exporte avec le style reel', () => {
    expect(renderStyleSuffix('3d')).toBe('3d')
    expect(renderStyleSuffix('pixel3d')).toBe('pixel3d')
  })
})

describe('taille des pixels', () => {
  it('a trois tailles, la plus fine par defaut', () => {
    expect(PIXEL_SIZES.map((p) => p.id)).toEqual(['large', 'medium', 'fine'])
    expect(DEFAULT_PIXEL).toBe('fine')
    expect(isPixelSize('medium')).toBe(true)
    expect(isPixelSize('enorme')).toBe(false)
  })

  it('donne une boule de 16 a 32 pixels de diametre', () => {
    for (const p of PIXEL_SIZES) {
      const g = pixelGrid(p.id)
      // la grille couvre tout le viewBox, la boule n'en occupe que RAYON / DEMI_VIEWBOX
      const diameter = (g * RADIUS) / HALF_VIEWBOX
      expect(diameter).toBeGreaterThanOrEqual(15.5)
      expect(diameter).toBeLessThanOrEqual(32.5)
    }
    expect(pixelGrid('large')).toBeLessThan(pixelGrid('medium'))
    expect(pixelGrid('medium')).toBeLessThan(pixelGrid('fine'))
  })
})

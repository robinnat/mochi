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
  effectivePixel,
  currentRenderStyle,
  renderStyleSuffix,
  PIXEL_SIZES
} from './renderStyle'

/**
 * The render style choice. The engine and its five states do not move: only the drawing changes, so what is locked
 * here is the catalog, its default value and how a value read back from storage is accepted or refused.
 */
describe('style catalog', () => {
  it('keeps the soft 3D (Soft) as default', () => {
    expect(DEFAULT_RENDER_STYLE).toBe('3d')
    expect(RENDER_STYLES[0]).toBe('3d')
  })

  it('only offers three styles, all real 3D: Soft, Flat, Pixel', () => {
    expect(RENDER_STYLES).toEqual(['3d', 'flat3d', 'pixel3d'])
  })

  it("refuses old 2D styles from an old page: they fall back to Soft", () => {
    for (const old of ['original', 'pixel', 'argile', 'bubble']) expect(isRenderStyle(old)).toBe(false)
  })

  it('refuses an unknown value read back from storage', () => {
    for (const id of RENDER_STYLES) expect(isRenderStyle(id)).toBe(true)
    expect(isRenderStyle('4d')).toBe(false)
    expect(isRenderStyle('')).toBe(false)
    expect(isRenderStyle('constructor')).toBe(false)
  })

  it('follows the current setting when the component gets no style', () => {
    currentRenderStyle.value = 'flat3d'
    expect(effectiveRenderStyle(undefined)).toBe('flat3d')
    expect(effectiveRenderStyle('pixel3d')).toBe('pixel3d')
    currentRenderStyle.value = DEFAULT_RENDER_STYLE
    expect(effectiveRenderStyle(undefined)).toBe('3d')
  })

  it('ignores an unknown style given to the component (old 2D style included)', () => {
    expect(effectiveRenderStyle('argile')).toBe('3d')
    expect(effectiveRenderStyle('original')).toBe('3d')
  })

  it('names the exported file with the real style', () => {
    expect(renderStyleSuffix('3d')).toBe('3d')
    expect(renderStyleSuffix('pixel3d')).toBe('pixel3d')
  })
})

describe('pixel size', () => {
  it('has two sizes, the finest by default (large removed on 11/11/2026)', () => {
    expect(PIXEL_SIZES.map((p) => p.id)).toEqual(['medium', 'fine'])
    expect(DEFAULT_PIXEL).toBe('fine')
    expect(isPixelSize('medium')).toBe(true)
    expect(isPixelSize('enorme')).toBe(false)
    expect(isPixelSize('large')).toBe(false)
  })

  it('an old pixel size falls back to the closest one left, an unknown one to the current setting', () => {
    expect(effectivePixel('large')).toBe('medium')
    expect(effectivePixel('gros')).toBe('medium')
    expect(effectivePixel('medium')).toBe('medium')
    expect(effectivePixel('fine')).toBe('fine')
    expect(effectivePixel('huge')).toBe(DEFAULT_PIXEL)
    expect(effectivePixel(undefined)).toBe(DEFAULT_PIXEL)
  })

  it('gives a ball 24 to 32 pixels wide', () => {
    for (const p of PIXEL_SIZES) {
      const g = pixelGrid(p.id)
      // the grid covers the whole viewBox, the ball only takes RADIUS / HALF_VIEWBOX of it
      const diameter = (g * RADIUS) / HALF_VIEWBOX
      expect(diameter).toBeGreaterThanOrEqual(23.5)
      expect(diameter).toBeLessThanOrEqual(32.5)
    }
    expect(pixelGrid('medium')).toBeLessThan(pixelGrid('fine'))
  })
})

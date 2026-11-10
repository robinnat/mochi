import { describe, expect, it } from 'vitest'
import { leverDark, luminance, palettePixel, quantifier, tonesOf } from './pixel3d'

describe('pixel 3D style', () => {
  it('the body palette has three tones from darkest to lightest, plus the white of the eyes', () => {
    const t = tonesOf('#7b6cd9')
    expect(t).toHaveLength(3)
    expect(t[0]![0]).toBeLessThan(t[1]![0])
    expect(t[1]![0]).toBeLessThan(t[2]![0] + 1)
    const p = palettePixel('#7b6cd9', ['#26222f'])
    expect(p).toHaveLength(3 + 3 + 1)
    expect(p[p.length - 1]!.slice(0, 3)).toEqual([255, 255, 255])
  })

  it('brings each pixel to the palette, hardens alpha and draws a 1 px outline', () => {
    const w = 5
    const h = 5
    const data = new Uint8ClampedArray(w * h * 4)
    // a 3x3 square almost the base color, medium alpha, in the center
    const base = tonesOf('#7b6cd9')[1]!
    for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) data.set([base[0]! + 3, base[1]! - 2, base[2]! + 1, 200], (y * w + x) * 4)
    quantifier(data, w, h, palettePixel('#7b6cd9'))
    // the center is exactly a palette tone, opaque
    const c = (2 * w + 2) * 4
    expect([data[c], data[c + 1], data[c + 2]]).toEqual(base.slice(0, 3))
    expect(data[c + 3]).toBe(255)
    // the cells around the square are darker (outline), the empty stays empty
    const edge = (1 * w + 1) * 4
    expect(data[edge]!).toBeLessThan(base[0]!)
    expect(data[3]).toBe(0)
  })

  it('lightens an almost black color so the three tones differ, without touching the others', () => {
    const black = leverDark('#0a0a0c')
    expect(luminance(black)).toBeGreaterThan(0.2)
    const [shadow, , light] = tonesOf(black)
    expect(light![0]! - shadow![0]!).toBeGreaterThan(20)
    expect(leverDark('#7b6cd9')).toBe('#7b6cd9')
  })

  it('the white of the eyes wins over body and accessory tones', () => {
    const w = 3
    const data = new Uint8ClampedArray(w * 3 * 4)
    for (let i = 0; i < w * 3; i++) data.set([225, 215, 200, 255], i * 4)
    quantifier(data, w, 3, palettePixel('#7b6cd9', ['#f49ab0']))
    expect(Array.from(data.slice(16, 19))).toEqual([255, 255, 255])
  })

  it('a staircase eye becomes a clean block, an isolated white pixel disappears', () => {
    const w = 8
    const h = 8
    const data = new Uint8ClampedArray(w * h * 4)
    const base = tonesOf('#7b6cd9')[1]!
    for (let i = 0; i < w * h; i++) data.set([base[0]!, base[1]!, base[2]!, 255], i * 4)
    // a 2x4 pixel eye missing a corner, and a lone white pixel elsewhere
    for (let y = 2; y < 6; y++) for (let x = 2; x < 4; x++) if (!(x === 3 && y === 5)) data.set([255, 255, 255, 255], (y * w + x) * 4)
    data.set([255, 255, 255, 255], (0 * w + 7) * 4)
    quantifier(data, w, h, palettePixel('#7b6cd9'))
    const px = (x: number, y: number) => data[(y * w + x) * 4]
    expect(px(3, 5)).toBe(255) // the missing corner is filled
    expect(px(7, 0)).not.toBe(255) // the lone pixel is no longer white
  })
})

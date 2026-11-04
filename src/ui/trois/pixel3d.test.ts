import { describe, expect, it } from 'vitest'
import { palettePixel, quantifier, tonsDe } from './pixel3d'

describe('style pixel 3D', () => {
  it('la palette du corps a trois tons du plus sombre au plus clair, plus le blanc des yeux', () => {
    const t = tonsDe('#7b6cd9')
    expect(t).toHaveLength(3)
    expect(t[0]![0]).toBeLessThan(t[1]![0])
    expect(t[1]![0]).toBeLessThan(t[2]![0] + 1)
    const p = palettePixel('#7b6cd9', ['#26222f'])
    expect(p).toHaveLength(3 + 3 + 1)
    expect(p[p.length - 1]!.slice(0, 3)).toEqual([255, 255, 255])
  })

  it('ramene chaque pixel a la palette, durcit l alpha et trace un contour de 1 px', () => {
    const w = 5
    const h = 5
    const data = new Uint8ClampedArray(w * h * 4)
    // un carre 3x3 presque de la couleur de base, alpha moyen, au centre
    const base = tonsDe('#7b6cd9')[1]!
    for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) data.set([base[0]! + 3, base[1]! - 2, base[2]! + 1, 200], (y * w + x) * 4)
    quantifier(data, w, h, palettePixel('#7b6cd9'))
    // le centre est exactement un ton de la palette, opaque
    const c = (2 * w + 2) * 4
    expect([data[c], data[c + 1], data[c + 2]]).toEqual(base.slice(0, 3))
    expect(data[c + 3]).toBe(255)
    // les cases du pourtour du carre sont plus sombres (contour), le vide reste vide
    const bord = (1 * w + 1) * 4
    expect(data[bord]!).toBeLessThan(base[0]!)
    expect(data[3]).toBe(0)
  })
})

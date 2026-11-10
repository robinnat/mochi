import { describe, expect, it } from 'vitest'
import { gifAnimate } from './animate'

/** SVG minimal ayant la structure de celui de MochiBot : corps + deux yeux. */
function image(side: number, color: [number, number, number], offset = 0) {
  const px = new Uint8ClampedArray(side * side * 4)
  for (let y = 2; y < side - 2; y++) {
    for (let x = 2 + offset; x < side - 2; x++) {
      const p = (y * side + x) * 4
      px[p] = color[0]
      px[p + 1] = color[1]
      px[p + 2] = color[2]
      px[p + 3] = 255
    }
  }
  return px
}

/** Relit la structure d'un GIF : en-tete, extensions, nombre d'images. */
function litGif(f: Uint8Array) {
  const txt = (o: number, n: number) => String.fromCharCode(...f.subarray(o, o + n))
  const bits = (f[10]! & 0x07) + 1
  let o = 13 + 3 * (1 << bits)
  let images = 0
  let loop: number | null = null
  let delay: number | null = null
  let transparent: number | null = null
  let elimination: number | null = null
  while (o < f.length && f[o] !== 0x3b) {
    if (f[o] === 0x21 && f[o + 1] === 0xff) {
      loop = f[o + 16]! + f[o + 17]! * 256
      o += 19
    } else if (f[o] === 0x21 && f[o + 1] === 0xf9) {
      elimination = (f[o + 3]! >> 2) & 0x07
      transparent = f[o + 3]! & 0x01 ? f[o + 6]! : null
      delay = f[o + 4]! + f[o + 5]! * 256
      o += 8
    } else if (f[o] === 0x2c) {
      images++
      // 10 octets de descripteur, separateur inclus, puis la taille de code
      o += 11
      // borne explicite : un flux mal forme ferait tourner ce saut a l'infini
      while (o < f.length && f[o] !== 0) o += 1 + f[o]!
      o++
    } else break
  }
  return {
    header: txt(0, 6),
    width: f[6]! + f[7]! * 256,
    height: f[8]! + f[9]! * 256,
    tablePresente: !!(f[10]! & 0x80),
    colorsTable: 1 << bits,
    images,
    loop,
    delay,
    transparent,
    elimination,
    endFound: f[f.length - 1] === 0x3b
  }
}

describe('gif anime', () => {
  const suite = [image(16, [10, 10, 12]), image(16, [10, 10, 12], 2), image(16, [249, 249, 249])]

  it('produit un GIF89a bien shape et termine', () => {
    const g = litGif(gifAnimate(suite, 16, 16, 50))
    expect(g.header).toBe('GIF89a')
    expect(g.width).toBe(16)
    expect(g.height).toBe(16)
    expect(g.images).toBe(3)
    expect(g.endFound).toBe(true)
  })

  it('porte une palette globale', () => {
    const g = litGif(gifAnimate(suite, 16, 16, 50))
    expect(g.tablePresente).toBe(true)
    // deux teintes + le transparent tiennent dans quatre entrees
    expect(g.colorsTable).toBe(4)
  })

  /* Sans index transparent, le fond serait peint. */
  it('declare l index 0 transparent', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 50)).transparent).toBe(0)
  })

  /*
   * Sans « retour au fond », les zones transparentes laissent voir l'image
   * precedente et la boule traine derriere elle.
   */
  it('elimine chaque image en retour au fond', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 50)).elimination).toBe(2)
  })

  it('boucle sans fin', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 50)).loop).toBe(0)
  })

  /* Le delai du GIF se compte en centiemes de seconde, pas en millisecondes. */
  it('convertit le delai en centiemes', () => {
    expect(litGif(suite.length ? gifAnimate(suite, 16, 16, 50) : new Uint8Array()).delay).toBe(5)
    expect(litGif(gifAnimate(suite, 16, 16, 100)).delay).toBe(10)
  })

  /* Un delai de 0 ou 1 centieme n'est pas traite pareil par tous les lecteurs. */
  it('ne descend pas sous deux centiemes', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 5)).delay).toBe(2)
  })

  it('refuse une animation vide', () => {
    expect(() => gifAnimate([], 16, 16, 50)).toThrow()
  })

  /**
   * La transparence est DEDUITE des pixels. Des images deja aplaties sur un fond
   * ne doivent pas declarer d'index transparent, et surtout pas etre eliminees
   * « retour au fond » entre deux — ce qui ferait clignoter le fond.
   */
  it('n annonce pas de transparence sur des images opaques', () => {
    const side = 8
    const opaque = new Uint8ClampedArray(side * side * 4).fill(255)
    const g = litGif(gifAnimate([opaque, opaque], side, side, 50))
    expect(g.transparent).toBeNull()
    expect(g.elimination).toBe(1) // « laisser en place »
  })

  it('annonce la transparence des qu une image en a', () => {
    const g = litGif(gifAnimate(suite, 16, 16, 50))
    expect(g.transparent).toBe(0)
    expect(g.elimination).toBe(2) // « retour au fond »
  })

  it('reste sous la limite de 256 couleurs meme sur du degrade', () => {
    const degrade = new Uint8ClampedArray(64 * 64 * 4)
    for (let i = 0; i < 64 * 64; i++) {
      degrade[i * 4] = i % 256
      degrade[i * 4 + 1] = (i * 7) % 256
      degrade[i * 4 + 2] = (i * 13) % 256
      degrade[i * 4 + 3] = 255
    }
    const g = litGif(gifAnimate([degrade], 64, 64, 50))
    expect(g.colorsTable).toBeLessThanOrEqual(256)
    expect(g.images).toBe(1)
  })
})

/**
 * Decodeur LZW minimal, pour verifier par ALLER-RETOUR que le flux produit est
 * relisable. Un encodeur LZW subtilement faux sort un fichier que les lecteurs
 * refusent, et rien dans la structure ne le montre.
 */
function decodeGif(f: Uint8Array) {
  const bits = (f[10]! & 0x07) + 1
  let o = 13 + 3 * (1 << bits)
  const images: number[][] = []
  while (o < f.length && f[o] !== 0x3b) {
    if (f[o] === 0x21) {
      o += 2
      while (o < f.length && f[o] !== 0) o += 1 + f[o]!
      o++
    } else if (f[o] === 0x2c) {
      o += 10
      const min = f[o]!
      o++
      const data: number[] = []
      while (o < f.length && f[o] !== 0) {
        const n = f[o]!
        for (let k = 1; k <= n; k++) data.push(f[o + k]!)
        o += 1 + n
      }
      o++

      const clear = 1 << min
      const eoi = clear + 1
      let size = min + 1
      let dict: number[][] = []
      const reset = () => {
        dict = []
        for (let i = 0; i < clear; i++) dict[i] = [i]
        dict[clear] = []
        dict[eoi] = []
        size = min + 1
      }
      reset()
      const exit: number[] = []
      let reserve = 0
      let nBits = 0
      let previous: number[] | null = null
      for (let i = 0; i <= data.length; i++) {
        if (i < data.length) {
          reserve |= data[i]! << nBits
          nBits += 8
        }
        while (nBits >= size) {
          const code = reserve & ((1 << size) - 1)
          reserve >>= size
          nBits -= size
          if (code === eoi) { nBits = 0; break }
          if (code === clear) { reset(); previous = null; continue }
          let entry = dict[code]
          if (!entry) {
            if (!previous) throw new Error('code inconnu sans precedent')
            entry = [...previous, previous[0]!]
          }
          exit.push(...entry)
          if (previous) dict.push([...previous, entry[0]!])
          if (dict.length === 1 << size && size < 12) size++
          previous = entry
        }
      }
      images.push(exit)
    } else break
  }
  return images
}

describe('aller-retour du LZW', () => {
  it('retrouve exactement les pixels d une image simple', () => {
    const px = image(16, [10, 10, 12])
    const gif = gifAnimate([px], 16, 16, 50)
    const [decode] = decodeGif(gif)
    expect(decode).toHaveLength(16 * 16)
    // reconstruit les index attendus : 0 dehors, 1 dedans
    const expected: number[] = []
    for (let i = 0; i < 16 * 16; i++) expected.push(px[i * 4 + 3]! < 128 ? 0 : 1)
    expect(decode).toEqual(expected)
  })

  it('retrouve les pixels sur une image a beaucoup de couleurs', () => {
    const side = 40
    const px = new Uint8ClampedArray(side * side * 4)
    for (let i = 0; i < side * side; i++) {
      px[i * 4] = (i * 5) % 200
      px[i * 4 + 1] = (i * 11) % 200
      px[i * 4 + 2] = (i * 17) % 200
      px[i * 4 + 3] = 255
    }
    const [decode] = decodeGif(gifAnimate([px], side, side, 50))
    expect(decode).toHaveLength(side * side)
    // aucun index transparent : tout est opaque
    expect(decode!.every((v) => v > 0)).toBe(true)
  })
})

/** SVG minimal du rendu pixel : un seul calque de cases, sans masque. */

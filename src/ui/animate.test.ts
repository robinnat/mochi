import { describe, expect, it } from 'vitest'
import { gifAnimate } from './animate'

/** Minimal SVG with the structure of MochiBot's: body + two eyes. */
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

/** Reads back the structure of a GIF: header, extensions, number of frames. */
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
      // 10 bytes of descriptor, separator included, then the code size
      o += 11
      // explicit bound: a malformed stream would loop this jump forever
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

  it('produces a well formed and terminated GIF89a', () => {
    const g = litGif(gifAnimate(suite, 16, 16, 50))
    expect(g.header).toBe('GIF89a')
    expect(g.width).toBe(16)
    expect(g.height).toBe(16)
    expect(g.images).toBe(3)
    expect(g.endFound).toBe(true)
  })

  it('carries a global palette', () => {
    const g = litGif(gifAnimate(suite, 16, 16, 50))
    expect(g.tablePresente).toBe(true)
    // two tints + transparent fit in four entries
    expect(g.colorsTable).toBe(4)
  })

  /* Without a transparent index, the background would be painted. */
  it('declares index 0 transparent', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 50)).transparent).toBe(0)
  })

  /*
   * Without "restore to background", transparent areas show the previous frame and the ball trails behind itself.
   */
  it('disposes each frame by restoring to background', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 50)).elimination).toBe(2)
  })

  it('loops forever', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 50)).loop).toBe(0)
  })

  /* The GIF delay counts in hundredths of a second, not milliseconds. */
  it('convertit le delai en centiemes', () => {
    expect(litGif(suite.length ? gifAnimate(suite, 16, 16, 50) : new Uint8Array()).delay).toBe(5)
    expect(litGif(gifAnimate(suite, 16, 16, 100)).delay).toBe(10)
  })

  /* A delay of 0 or 1 hundredth is not handled the same by every player. */
  it('never goes below two hundredths', () => {
    expect(litGif(gifAnimate(suite, 16, 16, 5)).delay).toBe(2)
  })

  it('refuses an empty animation', () => {
    expect(() => gifAnimate([], 16, 16, 50)).toThrow()
  })

  /**
   * Transparency is INFERRED from the pixels. Frames already flattened on a background must not declare a transparent
   * index, and above all not be disposed "restore to background" in between, which would make the background flicker.
   */
  it('announces no transparency on opaque frames', () => {
    const side = 8
    const opaque = new Uint8ClampedArray(side * side * 4).fill(255)
    const g = litGif(gifAnimate([opaque, opaque], side, side, 50))
    expect(g.transparent).toBeNull()
    expect(g.elimination).toBe(1) // « laisser en place »
  })

  it('announces transparency as soon as a frame has some', () => {
    const g = litGif(gifAnimate(suite, 16, 16, 50))
    expect(g.transparent).toBe(0)
    expect(g.elimination).toBe(2) // "restore to background"
  })

  it('stays under the 256 color limit even on gradients', () => {
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
 * Minimal LZW decoder, to check by ROUND TRIP that the produced stream can be read. A subtly wrong LZW encoder
 * outputs a file players refuse, and nothing in the structure shows it.
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
            if (!previous) throw new Error('unknown code with no previous one')
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

describe('LZW round trip', () => {
  it('finds exactly the pixels of a simple frame', () => {
    const px = image(16, [10, 10, 12])
    const gif = gifAnimate([px], 16, 16, 50)
    const [decode] = decodeGif(gif)
    expect(decode).toHaveLength(16 * 16)
    // reconstruit les index attendus : 0 dehors, 1 dedans
    const expected: number[] = []
    for (let i = 0; i < 16 * 16; i++) expected.push(px[i * 4 + 3]! < 128 ? 0 : 1)
    expect(decode).toEqual(expected)
  })

  it('finds the pixels of a frame with many colors', () => {
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
    // no transparent index: everything is opaque
    expect(decode!.every((v) => v > 0)).toBe(true)
  })
})

/** Minimal SVG of the pixel rendering: a single layer of cells, no mask. */

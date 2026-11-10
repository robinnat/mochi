/**
 * Encoding of the exported animated GIF, frame by frame from the 3D scene.
 *
 * Everything is pure (pixels to bytes), so testable under Node. Capturing frames needs the DOM and the 3D canvas: it
 * lives in `capture.ts`.
 *
 * There is no animated SVG any more: it animated the eyes of the 2D drawing in CSS, and the 3D has no vector drawing
 * to animate.
 */

/** Writes an unsigned integer on `n` bytes, little-endian. */
function le(value: number, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push((value / 2 ** (8 * i)) & 0xff)
  return out
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0))

/* ------------------------------------------------------------------- gif */

/**
 * GIF LZW compression: VARIABLE length codes, written bit by bit starting from the least significant bit, and grouped
 * in sub-blocks of at most 255 bytes.
 */
function lzw(indices: Uint8Array, bitsByPixel: number): number[] {
  const clear = 1 << bitsByPixel
  const end = clear + 1
  let size = bitsByPixel + 1
  let next = end + 1
  let dict = new Map<string, number>()

  const bytes: number[] = []
  let reserve = 0
  let bits = 0
  const write = (code: number) => {
    reserve |= code << bits
    bits += size
    while (bits >= 8) {
      bytes.push(reserve & 0xff)
      reserve >>= 8
      bits -= 8
    }
  }

  write(clear)
  let prefix = String(indices[0])
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i]!
    const key = `${prefix},${c}`
    const known = dict.get(key)
    if (known !== undefined) {
      prefix = String(known)
      continue
    }
    write(Number(prefix))
    if (next < 4096) {
      dict.set(key, next++)
      // The code width grows one notch AFTER the dictionary has
      // gone past what it addresses, and that lag is the format's trap:
      // the encoder adds its entry right after emitting a code, while
      // the decoder only adds its own when reading the NEXT code. So it is
      // always one entry behind, and the encoder must widen late
      // too. Writing `=== (1 << size)` desynchronizes both and the stream
      // becomes unreadable (checked by a round trip test).
      if (next > 1 << size && size < 12) size++
    } else {
      // Full dictionary: start it over, the decoder does the same when
      // it sees the clear code.
      write(clear)
      dict = new Map()
      size = bitsByPixel + 1
      next = end + 1
    }
    prefix = String(c)
  }
  write(Number(prefix))
  write(end)
  if (bits > 0) bytes.push(reserve & 0xff)

  // Split into sub-blocks: each is preceded by its length, and a zero byte
  // ends the series.
  const exit: number[] = [bitsByPixel]
  for (let i = 0; i < bytes.length; i += 255) {
    const block = bytes.slice(i, i + 255)
    exit.push(block.length, ...block)
  }
  exit.push(0)
  return exit
}

/**
 * Palette shared by all frames, index 0 reserved for transparent.
 *
 * Built in TWO steps (count the colors, then index the frames) because a GIF needs a shared palette: every frame must
 * be seen before encoding a single one. On a thirty-second cycle, keeping raw pixels would cost 255 MB; counted then
 * indexed, they weigh only one byte per pixel.
 */
export interface PaletteGif {
  /** How many pixels per tint, while counting. */
  counts: Map<number, number>
  /** RGB packed on 24 bits -> index, once the palette is set. */
  index: Map<number, number>
  /** Resolution of missing tints to the nearest kept one. */
  near: Map<number, number>
  /** At least one transparent pixel was seen. */
  transparence: boolean
}

export const newPalette = (): PaletteGif => ({
  counts: new Map(),
  index: new Map(),
  near: new Map(),
  transparence: false
})

/**
 * Counts the colors of a frame, COUNTING the pixels.
 *
 * Counting is not a detail: a first-come palette would fill up with the antialiasing shades of the first frames, and
 * the ring tints (which only show in the middle of the cycle) would all land on the same slot. Measured: a cycle goes
 * past 255 colors, so we MUST choose which ones to keep.
 */
export function listed(palette: PaletteGif, px: Uint8ClampedArray) {
  for (let p = 0; p < px.length; p += 4) {
    if (px[p + 3]! < 128) {
      palette.transparence = true
      continue
    }
    const key = (px[p]! << 16) | (px[p + 1]! << 8) | px[p + 2]!
    palette.counts.set(key, (palette.counts.get(key) ?? 0) + 1)
  }
}

/** Sets the palette to the 255 most used tints. */
function stops(palette: PaletteGif) {
  if (palette.index.size) return
  const sorted = [...palette.counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255)
  for (const [key] of sorted) palette.index.set(key, palette.index.size + 1)
}

/** Index of the nearest kept tint, cached. */
function nearest(palette: PaletteGif, key: number) {
  const known = palette.near.get(key)
  if (known !== undefined) return known
  const r = (key >> 16) & 0xff
  const v = (key >> 8) & 0xff
  const b = key & 0xff
  let best = 1
  let gap = Infinity
  for (const [other, i] of palette.index) {
    const dr = r - ((other >> 16) & 0xff)
    const dv = v - ((other >> 8) & 0xff)
    const db = b - (other & 0xff)
    const d = dr * dr + dv * dv + db * db
    if (d < gap) {
      gap = d
      best = i
    }
  }
  // The cache bounds the cost: each missing tint is resolved only once,
  // even if it comes back on hundreds of frames.
  palette.near.set(key, best)
  return best
}

/** Turns a frame into palette indices, one byte per pixel. */
export function indexed(palette: PaletteGif, px: Uint8ClampedArray): Uint8Array {
  stops(palette)
  const out = new Uint8Array(px.length / 4)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    // 0 = transparent, already the array's default value
    if (px[p + 3]! < 128) continue
    const key = (px[p]! << 16) | (px[p + 1]! << 8) | px[p + 2]!
    out[i] = palette.index.get(key) ?? nearest(palette, key)
  }
  return out
}

/**
 * Assembles frames into an animated GIF.
 *
 * GIF transparency is ONE bit: a pixel is opaque or invisible, nothing in between. On a transparent background, the
 * antialiased edge of the ball is cut at 50 % opacity and shows as stair steps. That is not a bug to fix, it is the
 * format: hence the user's choice between this hard edge and a full background, where the edge stays smooth because
 * it has something to blend into.
 *
 * Transparency is INFERRED from the frames, not requested: frames already flattened on a background do not declare a
 * transparent index, and above all are not disposed "restore to background" in between, which would make the
 * background flicker.
 *
 * The GIF serves animated avatars (Discord, Slack); the whole montage also comes out as MP4.
 */
export function gifAnimate(
  images: Uint8ClampedArray[],
  width: number,
  height: number,
  delayMs: number
): Uint8Array<ArrayBuffer> {
  if (!images.length) throw new Error('no frame to pack')
  const palette = newPalette()
  for (const px of images) listed(palette, px)
  return gifIndexed(
    palette,
    images.map((px) => indexed(palette, px)),
    width,
    height,
    delayMs
  )
}

/**
 * Same, but on frames ALREADY indexed: the bounded memory path, for long sequences. See `PaletteGif`.
 */
export function gifIndexed(
  palette: PaletteGif,
  images: Uint8Array[],
  width: number,
  height: number,
  delayMs: number
): Uint8Array<ArrayBuffer> {
  if (!images.length) throw new Error('no frame to pack')

  stops(palette)
  const transparence = palette.transparence
  const colors = palette.index
  // A GIF palette has a power of two size, and at least two
  // bits per pixel are needed for the clear code to fit.
  const bits = Math.max(2, Math.ceil(Math.log2(colors.size + 1)))
  const sizeTable = 1 << bits

  const table: number[] = [0, 0, 0] // index 0: transparent, the color does not matter
  for (const key of colors.keys()) table.push((key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff)
  while (table.length < sizeTable * 3) table.push(0)

  const out: number[] = [
    ...ascii('GIF89a'),
    ...le(width, 2),
    ...le(height, 2),
    0x80 | (bits - 1), // global table present, and its size
    0, // background index: transparent
    0, // no aspect ratio
    ...table,
    // Endless loop, through the Netscape extension: nothing else can say it.
    0x21,
    0xff,
    0x0b,
    ...ascii('NETSCAPE2.0'),
    0x03,
    0x01,
    ...le(0, 2),
    0x00
  ]

  // The GIF delay counts in HUNDREDTHS of a second: that limits its
  // frame rate, a delay of 0 or 1 being handled differently by players.
  const delay = Math.max(2, Math.round(delayMs / 10))

  for (const indices of images) {
    out.push(
      0x21,
      0xf9,
      0x04,
      // On a transparent background: "restore to background" disposal (2) and
      // a declared transparent index, otherwise empty areas show the
      // previous frame and the ball trails behind itself.
      //
      // On a full background: "leave in place" (1), and above all NO restore
      // to background: each frame covers the whole canvas, so clearing in between
      // only makes the background flicker.
      transparence ? (2 << 2) | 0x01 : 1 << 2,
      ...le(delay, 2),
      0, // index transparent
      0x00,
      0x2c,
      ...le(0, 2),
      ...le(0, 2),
      ...le(width, 2),
      ...le(height, 2),
      0, // no local table, no interlacing
      ...lzw(indices, bits)
    )
  }

  out.push(0x3b)
  return new Uint8Array(out)
}

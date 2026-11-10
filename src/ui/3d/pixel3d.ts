/**
 * PIXEL style of the 3D: the same volume as the other styles, rendered at low resolution (a grid cell = a canvas
 * pixel, scaled up without smoothing by `image-rendering: pixelated`), shaded in three tones, then reduced to a SHORT
 * PALETTE derived from the body color (3 tones) and the accessories' colors, plus the white of the eyes. A 1 px
 * outline, one tone darker than the pixel it borders, closes the silhouette.
 *
 * Pure module (no Three.js, no DOM): testable under Node.
 */

export type Rgb = [number, number, number] | [number, number, number, number]

const hexToRgb = (hex: string): Rgb => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

const toLinear = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toSrgb = (l: number) => {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

/** Approximate relative luminance (0 = black, 1 = white), on sRGB values. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * Styles with clean tones (Flat, Pixel) lose all relief on an almost black color (the app's default ink): three tones
 * of black are three blacks. So dark colors are lightened towards a readable blue gray before setting the tones; the
 * others do not move.
 */
export function leverDark(hex: string): string {
  const l = luminance(hex)
  if (l >= 0.28) return hex
  const k = Math.min(0.5, ((0.28 - l) / 0.28) * 0.5)
  const [r, g, b] = hexToRgb(hex)
  const m = (c: number) => Math.round(c + (255 - c) * k)
  return '#' + [m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, '0')).join('')
}

/**
 * The three shading tones (shadow, base, light): the same multiple of the color, in linear light, as the toon shader.
 */
export const TONES_PIXEL = [0.7, 1, 1.12]

export function tonesOf(hex: string, weight = 1): Rgb[] {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number]
  return TONES_PIXEL.map((t) => [toSrgb(r * t), toSrgb(g * t), toSrgb(b * t), weight] as Rgb)
}

/** Palette of a frame: body tones, tones of each accessory, white of the eyes. */
export function palettePixel(body: string, accessories: string[] = [], eye: [number, number, number] = [255, 255, 255]): Rgb[] {
  // accessory colors weigh more: an edge pixel (body + eye white blended) must not turn into an accessory tint
  return [...tonesOf(body), ...accessories.flatMap((a) => tonesOf(a, 1.9)), [...eye, 1]]
}

/** At most this channel: a pixel is "black" (eye of the dark theme). */
const THRESHOLD_BLACK = 44

const dist = (a: Rgb, r: number, g: number, b: number) => ((a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2) * (a[3] ?? 1)

/**
 * The eyes are small white blocks: after reduction, their ends stay staircased (a missing corner, an isolated pixel).
 * Each cluster of white pixels becomes its bounding rectangle (if the cluster fills at least half of it); an isolated
 * white pixel is erased, it takes the body's base tone back.
 */
function cleanEyes(data: Uint8ClampedArray, w: number, h: number, full: Uint8Array, palette: Rgb[], eye: [number, number, number] = [255, 255, 255]) {
  const white = (i: number) => full[i] === 1 && data[i * 4] === eye[0] && data[i * 4 + 1] === eye[1] && data[i * 4 + 2] === eye[2]
  const seen = new Uint8Array(w * h)
  const base = palette[1] ?? palette[0]!
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !white(s)) continue
    const pile = [s]
    seen[s] = 1
    const amas: number[] = []
    while (pile.length) {
      const i = pile.pop()!
      amas.push(i)
      const x = i % w
      const y = (i - x) / w
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (!seen[j] && white(j)) {
          seen[j] = 1
          pile.push(j)
        }
      }
    }
    let x0 = w, x1 = -1, y0 = h, y1 = -1
    for (const i of amas) {
      const x = i % w
      const y = (i - x) / w
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const aire = (x1 - x0 + 1) * (y1 - y0 + 1)
    if (amas.length <= 1) {
      for (const i of amas) {
        data[i * 4] = base[0]
        data[i * 4 + 1] = base[1]
        data[i * 4 + 2] = base[2]
      }
    } else if (amas.length >= aire / 2 && aire <= 40) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * w + x
          if (!full[i]) continue
          seen[i] = 1
          data[i * 4] = eye[0]
          data[i * 4 + 1] = eye[1]
          data[i * 4 + 2] = eye[2]
          data[i * 4 + 3] = 255
        }
      }
    }
  }
}

/**
 * Brings each pixel to the nearest palette color, hardens the alpha channel (a cell is full or empty), then draws a 1
 * px outline around the shape. Changes `data` in place.
 */
export function quantifier(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  palette: Rgb[],
  whitePriority = true,
  /** dark theme: (black) eye color; an almost black pixel gets it back, instead of white */
  eye?: [number, number, number]
) {
  const full = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3]! < 128) {
      data[i * 4 + 3] = 0
      continue
    }
    full[i] = 1
    // the white of the eyes wins: an eye edge half blended into the body stays white, the eyes
    // keep clean blocks instead of pixels of the body tint
    if (whitePriority && Math.min(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!) >= 180) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255
      data[i * 4 + 3] = 255
      continue
    }
    if (eye && Math.max(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!) <= THRESHOLD_BLACK) {
      data[i * 4] = eye[0]
      data[i * 4 + 1] = eye[1]
      data[i * 4 + 2] = eye[2]
      data[i * 4 + 3] = 255
      continue
    }
    let best = palette[0]!
    let d = Infinity
    for (const p of palette) {
      const e = dist(p, data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)
      if (e < d) {
        d = e
        best = p
      }
    }
    data[i * 4] = best[0]
    data[i * 4 + 1] = best[1]
    data[i * 4 + 2] = best[2]
    data[i * 4 + 3] = 255
  }
  cleanEyes(data, w, h, full, palette, eye)
  // outline: a full cell touching the empty (or the edge) takes a darker tone of itself
  const edge: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!full[i]) continue
      const empty = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= w || yy >= h || !full[yy * w + xx]
      if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) edge.push(i)
    }
  }
  for (const i of edge) {
    data[i * 4] = Math.round(data[i * 4]! * 0.42)
    data[i * 4 + 1] = Math.round(data[i * 4 + 1]! * 0.42)
    data[i * 4 + 2] = Math.round(data[i * 4 + 2]! * 0.42)
  }
}

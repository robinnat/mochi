/**
 * Style PIXEL de la 3D : le meme volume que les autres styles, rendu a basse resolution (une case
 * de la grille = un pixel du canvas, agrandi sans lissage par `image-rendering: pixelated`), a
 * l'ombrage en trois tons, puis ramene a une PALETTE COURTE derivee de la couleur du corps
 * (3 tons) et de celles des accessoires, plus le blanc des yeux. Un contour de 1 px, d'un ton
 * plus sombre que le pixel qu'il borde, ferme la silhouette.
 *
 * Module pur (pas de Three.js, pas de DOM) : testable sous `node`.
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

/** Luminance relative approchee (0 = noir, 1 = blanc), sur les valeurs sRGB. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * Les styles a tons nets (Flat, Pixel) n'ont plus de relief sur une couleur quasi noire (l'encre
 * par defaut de l'application) : trois tons de noir sont trois noirs. On eclaircit donc les
 * couleurs sombres vers un gris-bleu lisible avant de poser les tons ; les autres ne bougent pas.
 */
export function leverDark(hex: string): string {
  const l = luminance(hex)
  if (l >= 0.28) return hex
  const k = Math.min(0.5, ((0.28 - l) / 0.28) * 0.5)
  const [r, g, b] = hexToRgb(hex)
  const m = (c: number) => Math.round(c + (255 - c) * k)
  return '#' + [m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, '0')).join('')
}

/** Les trois tons de l'ombrage (ombre, base, clair) : le meme multiple de la couleur, en lineaire, que le shader toon. */
export const TONES_PIXEL = [0.7, 1, 1.12]

export function tonesOf(hex: string, weight = 1): Rgb[] {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number]
  return TONES_PIXEL.map((t) => [toSrgb(r * t), toSrgb(g * t), toSrgb(b * t), weight] as Rgb)
}

/** Palette d'une image : tons du corps, tons de chaque accessoire, blanc des yeux. */
export function palettePixel(body: string, accessories: string[] = [], eye: [number, number, number] = [255, 255, 255]): Rgb[] {
  // les couleurs des accessoires pesent plus lourd : un pixel de bord (corps + blanc des yeux fondus) ne doit pas se changer en une teinte d'accessoire
  return [...tonesOf(body), ...accessories.flatMap((a) => tonesOf(a, 1.9)), [...eye, 1]]
}

/** Au plus ce canal : un pixel est « noir » (oeil du theme sombre). */
const THRESHOLD_BLACK = 44

const dist = (a: Rgb, r: number, g: number, b: number) => ((a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2) * (a[3] ?? 1)

/**
 * Les yeux sont de petits blocs blancs : apres reduction, leurs bouts restent en escalier (un coin
 * manquant, un pixel isole). Chaque amas de pixels blancs devient son rectangle englobant (si l'amas
 * en remplit au moins la moitie) ; un pixel blanc isole est efface, il reprend le ton de base du corps.
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
 * Ramene chaque pixel a la couleur la plus proche de la palette, durcit le canal alpha (une case
 * est pleine ou vide), puis trace un contour de 1 px autour de la forme. Modifie `data` en place.
 */
export function quantifier(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  palette: Rgb[],
  whitePriority = true,
  /** theme sombre : couleur (noire) des yeux ; un pixel presque noir lui est rendu, a la place du blanc */
  eye?: [number, number, number]
) {
  const full = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3]! < 128) {
      data[i * 4 + 3] = 0
      continue
    }
    full[i] = 1
    // le blanc des yeux est prioritaire : un bord d'oeil a moitie fondu dans le corps reste blanc, les yeux
    // gardent des blocs nets au lieu de pixels de la teinte du corps
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
  // contour : une case pleine qui touche le vide (ou le bord) prend un ton plus sombre d'elle-meme
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

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

const hexVersRgb = (hex: string): Rgb => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

const versLineaire = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const versSrgb = (l: number) => {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

/** Les trois tons de l'ombrage (ombre, base, clair) : le meme multiple de la couleur, en lineaire, que le shader toon. */
export const TONS_PIXEL = [0.7, 1, 1.12]

export function tonsDe(hex: string, poids = 1): Rgb[] {
  const [r, g, b] = hexVersRgb(hex).map(versLineaire) as [number, number, number]
  return TONS_PIXEL.map((t) => [versSrgb(r * t), versSrgb(g * t), versSrgb(b * t), poids] as Rgb)
}

/** Palette d'une image : tons du corps, tons de chaque accessoire, blanc des yeux. */
export function palettePixel(corps: string, accessoires: string[] = []): Rgb[] {
  // les couleurs des accessoires pesent plus lourd : un pixel de bord (corps + blanc des yeux fondus) ne doit pas se changer en une teinte d'accessoire
  return [...tonsDe(corps), ...accessoires.flatMap((a) => tonsDe(a, 1.9)), [255, 255, 255, 1]]
}

const dist = (a: Rgb, r: number, g: number, b: number) => ((a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2) * (a[3] ?? 1)

/**
 * Ramene chaque pixel a la couleur la plus proche de la palette, durcit le canal alpha (une case
 * est pleine ou vide), puis trace un contour de 1 px autour de la forme. Modifie `data` en place.
 */
export function quantifier(data: Uint8ClampedArray, w: number, h: number, palette: Rgb[]) {
  const plein = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3]! < 128) {
      data[i * 4 + 3] = 0
      continue
    }
    plein[i] = 1
    let meilleur = palette[0]!
    let d = Infinity
    for (const p of palette) {
      const e = dist(p, data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)
      if (e < d) {
        d = e
        meilleur = p
      }
    }
    data[i * 4] = meilleur[0]
    data[i * 4 + 1] = meilleur[1]
    data[i * 4 + 2] = meilleur[2]
    data[i * 4 + 3] = 255
  }
  // contour : une case pleine qui touche le vide (ou le bord) prend un ton plus sombre d'elle-meme
  const bord: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!plein[i]) continue
      const vide = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= w || yy >= h || !plein[yy * w + xx]
      if (vide(x - 1, y) || vide(x + 1, y) || vide(x, y - 1) || vide(x, y + 1)) bord.push(i)
    }
  }
  for (const i of bord) {
    data[i * 4] = Math.round(data[i * 4]! * 0.42)
    data[i * 4 + 1] = Math.round(data[i * 4 + 1]! * 0.42)
    data[i * 4 + 2] = Math.round(data[i * 4 + 2]! * 0.42)
  }
}

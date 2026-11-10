/**
 * Rendu PIXEL ART du bot.
 *
 * Le moteur ne change pas : chaque image qu'il rend (`BotFrame`) est rasterisee sur une
 * petite grille (de 25 a 51 cases sur tout le viewBox, soit une boule de 16 a 32 pixels),
 * puis chaque case recoit une couleur d'une palette courte. Le morphing reste fluide parce
 * qu'il est re-pixellise a CHAQUE image : on ne fige pas un sprite, on echantillonne le
 * meme dessin vectoriel a basse resolution.
 *
 * Deux moities :
 * - `rasterise` a besoin d'un canvas (DOM). Elle peint l'image dans trois couches de la
 *   taille de la grille : le rendu complet, la silhouette, et le corps sans ses yeux ;
 * - `aplatsPixel` et `cheminDesCases` sont PURES et testees en `node` : elles decident de
 *   la couleur de chaque case et en tirent des chemins SVG.
 *
 * Le resultat reste un SVG ordinaire (des `<path>` a bords nets) : les exports SVG, PNG,
 * GIF et MP4 le serialisent et le rasterisent comme l'original, sans code a part.
 */

import type { BotFrame } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { mixHex } from '@/bot/skins'

/** Les trois couches RGBA d'une image, de `g` x `g` cases. */
export interface CouchesPixel {
  g: number
  /** l'image complete, en couleurs, fond transparent */
  rendu: Uint8ClampedArray
  /** la silhouette du corps, yeux compris (alpha seulement) */
  silhouette: Uint8ClampedArray
  /** le corps perce de ses yeux (alpha seulement) */
  corps: Uint8ClampedArray
}

export interface TeintesPixel {
  clair: string
  base: string
  ombre: string
  contour: string
}

/** Contour sombre et ombrage en deux tons, tires de la couleur choisie. */
export function teintesPixel(encre: string): TeintesPixel {
  return {
    clair: mixHex(encre, '#ffffff', 0.32),
    base: encre,
    ombre: mixHex(encre, '#000000', 0.34),
    contour: mixHex(encre, '#000000', 0.68)
  }
}

/**
 * Palette des couleurs ETRANGERES au corps (anneaux, particules colorees, pastille) : les
 * seize couleurs de la PICO-8, une palette de pixel art connue. La couleur du corps, elle,
 * reste celle que l'utilisateur a choisie, avec ses deux tons.
 */
export const PALETTE = [
  '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'
]
const PALETTE_RGB = PALETTE.map((h) => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const
})

/** La couleur de la palette la plus proche (distance ponderee a l'oeil). */
export function versPalette(r: number, g: number, b: number): string {
  let mieux = 0
  let min = Infinity
  PALETTE_RGB.forEach(([pr, pg, pb], i) => {
    const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2
    if (d < min) {
      min = d
      mieux = i
    }
  })
  return PALETTE[mieux]!
}

const enRgb = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

/**
 * Distance d'une couleur au SEGMENT encre-papier. Une case du corps prise dans
 * l'antialiasing d'un oeil est un melange des deux : elle doit rester au corps ou a
 * l'oeil, pas devenir un gris de la palette. Seule une couleur loin de ce segment (une
 * pastille bleue, un anneau colore) est etrangere au corps.
 */
function horsDuSegment(c: [number, number, number], a: number[], b: number[]) {
  const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
  const ac = [c[0] - a[0]!, c[1] - a[1]!, c[2] - a[2]!]
  const l2 = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2
  const t = l2 ? Math.max(0, Math.min(1, (ac[0]! * ab[0]! + ac[1]! * ab[1]! + ac[2]! * ab[2]!) / l2)) : 0
  return Math.hypot(ac[0]! - ab[0]! * t, ac[1]! - ab[1]! * t, ac[2]! - ab[2]! * t)
}

/** Au-dela, une couleur n'est plus un melange encre-papier. */
const ETRANGERE = 48
/** Une case est pleine quand plus de la moitie de sa surface est couverte. */
const PLEIN = 128
/**
 * Seuil plus bas pour les traits etrangers au corps : un anneau fait un demi-pixel de
 * large a cette resolution, et au seuil de moitie il se casse en pointilles.
 */
const TRAIT = 64

/** Un aplat : toutes les cases d'une meme couleur. */
export interface AplatPixel {
  fill: string
  cases: number[]
}

/**
 * Couleur de chaque case.
 *
 * - le corps prend la couleur choisie, en deux tons plus un reflet : ombre sur le bord bas
 *   droit, clair sur le bord haut gauche (lumiere en haut a gauche) ;
 * - les yeux prennent le papier, comme l'original les remplit du fond de la page ;
 * - les points de la couleur du corps hors de lui (le point du « ! », les points de la
 *   reflexion) prennent son ton de base, ou son ton clair s'ils sont fondus dans le fond ;
 * - une case vide qui touche le corps ou ces points devient le contour sombre d'un pixel ;
 * - le reste (anneaux, particules colorees, pastille) est ramene a la palette PICO-8.
 */
export function aplatsPixel(c: CouchesPixel, encre: string, papier: string): AplatPixel[] {
  const { g, rendu, silhouette, corps } = c
  const t = teintesPixel(encre)
  const e = enRgb(encre)
  const p = enRgb(papier)
  // epaisseur du bord ombre ou eclaire : une case, deux sur la grille fine
  const s = Math.max(1, Math.round(g / 26))

  const brut = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < g && y < g && silhouette[(y * g + x) * 4 + 3]! >= PLEIN
  /*
   * Une case de silhouette qui ne tient au reste que par un cote est une excroissance de
   * l'echantillonnage (le haut d'un cercle tombe pile sur une ligne) : avec son contour,
   * elle fait une pointe d'un pixel au sommet de la boule. On l'enleve.
   */
  const sil = new Uint8Array(g * g)
  for (let y = 0; y < g; y++)
    for (let x = 0; x < g; x++)
      if (brut(x, y)) {
        const voisins = +brut(x - 1, y) + +brut(x + 1, y) + +brut(x, y - 1) + +brut(x, y + 1)
        if (voisins >= 2) sil[y * g + x] = 1
      }
  const dansSil = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < g && y < g && sil[y * g + x] === 1

  // premiere passe : ce qui est « a l'encre » (corps et points de sa couleur), pour le contour
  const encrees = new Uint8Array(g * g)
  const etrangeres = new Uint8Array(g * g)
  for (let i = 0; i < g * g; i++) {
    const k = i * 4
    const a = rendu[k + 3]!
    if (a < TRAIT) continue
    const col: [number, number, number] = [rendu[k]!, rendu[k + 1]!, rendu[k + 2]!]
    const etr = horsDuSegment(col, e, p) > ETRANGERE
    if (etr) etrangeres[i] = 1
    else if (sil[i] || (a >= PLEIN && silhouette[k + 3]! < PLEIN)) encrees[i] = 1
  }
  const encree = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < g && y < g && encrees[y * g + x] === 1

  const aplats = new Map<string, number[]>()
  const pose = (fill: string, i: number) => {
    const l = aplats.get(fill)
    if (l) l.push(i)
    else aplats.set(fill, [i])
  }

  for (let y = 0; y < g; y++) {
    for (let x = 0; x < g; x++) {
      const i = y * g + x
      const k = i * 4
      if (etrangeres[i]) {
        pose(versPalette(rendu[k]!, rendu[k + 1]!, rendu[k + 2]!), i)
        continue
      }
      if (!encrees[i]) {
        if (encree(x - 1, y) || encree(x + 1, y) || encree(x, y - 1) || encree(x, y + 1))
          pose(t.contour, i)
        continue
      }
      if (dansSil(x, y)) {
        if (corps[k + 3]! >= PLEIN) {
          if (!dansSil(x + s, y + s)) pose(t.ombre, i)
          else if (!dansSil(x - s, y - s)) pose(t.clair, i)
          else pose(t.base, i)
        } else pose(papier, i)
        continue
      }
      // point de la couleur du corps, hors de lui : plus il est fondu, plus il est clair
      const versPapier =
        Math.hypot(rendu[k]! - p[0], rendu[k + 1]! - p[1], rendu[k + 2]! - p[2]) <
        Math.hypot(rendu[k]! - e[0], rendu[k + 1]! - e[1], rendu[k + 2]! - e[2])
      pose(versPapier ? t.clair : t.base, i)
    }
  }
  return [...aplats].map(([fill, cases]) => ({ fill, cases }))
}

const arrondi = (v: number) => Math.round(v * 1000) / 1000

/**
 * Chemin SVG d'un ensemble de cases, dans le repere du viewBox. Les cases voisines d'une
 * meme ligne sont fusionnees en un rectangle : une boule de 24 pixels tient en une
 * cinquantaine de segments au lieu de quatre cents carres.
 */
export function cheminDesCases(cases: number[], g: number): string {
  const cote = (DEMI_VIEWBOX * 2) / g
  const tries = [...cases].sort((a, b) => a - b)
  let d = ''
  for (let n = 0; n < tries.length; ) {
    const debut = tries[n]!
    const y = Math.floor(debut / g)
    let fin = debut
    while (n + 1 < tries.length && tries[n + 1] === fin + 1 && Math.floor(tries[n + 1]! / g) === y) {
      n++
      fin++
    }
    n++
    const x0 = arrondi(-DEMI_VIEWBOX + (debut % g) * cote)
    const y0 = arrondi(-DEMI_VIEWBOX + y * cote)
    const w = arrondi((fin - debut + 1) * cote)
    d += `M${x0} ${y0}h${w}v${arrondi(cote)}h${-w}z`
  }
  return d
}

/* --------------------------------------------------------------- rasterisation */

let toile: HTMLCanvasElement | null = null
let calque: HTMLCanvasElement | null = null

/** Le canvas partage, ou null hors navigateur (tests en `node`, DOM sans canvas). */
function contexte(c: HTMLCanvasElement | null, g: number) {
  if (!c) return null
  if (c.width !== g) c.width = g
  if (c.height !== g) c.height = g
  try {
    return c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null
  } catch {
    return null
  }
}

function canvasNeuf() {
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return null
  return document.createElement('canvas')
}

/** `matrix(a,b,c,d,e,f)` -> ses six nombres. */
function matrice(m: string): number[] {
  return (m.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number)
}

/** Peint une image du moteur comme le gabarit de `mochi-bot.ts`, dans le meme ordre. */
function peins(
  ctx: CanvasRenderingContext2D,
  lay: CanvasRenderingContext2D,
  f: BotFrame,
  encre: string,
  papier: string,
  g: number
) {
  const s = g / (DEMI_VIEWBOX * 2)
  const repere = (c: CanvasRenderingContext2D) =>
    c.setTransform(s, 0, 0, s, DEMI_VIEWBOX * s, DEMI_VIEWBOX * s)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, g, g)
  ctx.globalCompositeOperation = 'source-over'
  repere(ctx)

  const arcs = (cote: 'back' | 'front') => {
    for (const a of f.arcs) {
      const grad = ctx.createLinearGradient(a.grad.x1, a.grad.y1, a.grad.x2, a.grad.y2)
      a.grad.stops.forEach((c, i) => grad.addColorStop(i / (a.grad.stops.length - 1), c))
      ctx.globalAlpha = a.opacity
      ctx.strokeStyle = grad
      ctx.lineWidth = a.width
      ctx.lineCap = 'round'
      ctx.stroke(new Path2D(a[cote]))
    }
  }
  const points = () => {
    for (const p of f.dots) {
      ctx.globalAlpha = p.opacity
      ctx.fillStyle =
        p.color ?? (p.depth === undefined ? encre : mixHex(papier, encre, p.depth))
      if (p.d) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(((p.rot ?? 0) * Math.PI) / 180)
        ctx.scale(RAYON, RAYON)
        ctx.fill(new Path2D(p.d))
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  const trous = (c: CanvasRenderingContext2D) => {
    for (const e of f.eyes) {
      const m = matrice(e.matrix)
      if (m.length !== 6) continue
      c.save()
      c.globalAlpha = e.alpha
      c.transform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!)
      c.fill(new Path2D(e.d))
      c.restore()
    }
  }

  arcs('back')

  // le corps et ses yeux dans un calque, pour lui appliquer `bodyAlpha` d'un bloc
  lay.setTransform(1, 0, 0, 1, 0, 0)
  lay.clearRect(0, 0, g, g)
  lay.globalCompositeOperation = 'source-over'
  lay.globalAlpha = 1
  repere(lay)
  lay.fillStyle = encre
  lay.fill(new Path2D(f.bodyPath))
  lay.globalCompositeOperation = 'source-atop'
  lay.fillStyle = papier
  trous(lay)
  lay.globalCompositeOperation = 'source-over'

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = f.bodyAlpha
  ctx.drawImage(lay.canvas, 0, 0)
  ctx.restore()

  points()
  arcs('front')
  ctx.globalAlpha = 1
}

/** La silhouette (yeux compris), puis le corps perce de ses yeux, sur le calque. */
function masques(lay: CanvasRenderingContext2D, f: BotFrame, g: number) {
  const s = g / (DEMI_VIEWBOX * 2)
  lay.setTransform(1, 0, 0, 1, 0, 0)
  lay.clearRect(0, 0, g, g)
  lay.globalCompositeOperation = 'source-over'
  lay.globalAlpha = f.bodyAlpha
  lay.setTransform(s, 0, 0, s, DEMI_VIEWBOX * s, DEMI_VIEWBOX * s)
  lay.fillStyle = '#000'
  lay.fill(new Path2D(f.bodyPath))
  lay.setTransform(1, 0, 0, 1, 0, 0)
  const silhouette = lay.getImageData(0, 0, g, g).data

  lay.globalAlpha = 1
  lay.globalCompositeOperation = 'destination-out'
  lay.setTransform(s, 0, 0, s, DEMI_VIEWBOX * s, DEMI_VIEWBOX * s)
  for (const e of f.eyes) {
    const m = matrice(e.matrix)
    if (m.length !== 6) continue
    lay.save()
    lay.globalAlpha = e.alpha
    lay.transform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!)
    lay.fill(new Path2D(e.d))
    lay.restore()
  }
  lay.setTransform(1, 0, 0, 1, 0, 0)
  lay.globalCompositeOperation = 'source-over'
  const corps = lay.getImageData(0, 0, g, g).data
  return { silhouette, corps }
}

/**
 * Rasterise une image du moteur sur la grille. `null` quand il n'y a pas de canvas : le
 * composant retombe alors sur le rendu original plutot que de ne rien afficher.
 */
export function rasterise(
  f: BotFrame,
  encre: string,
  papier: string,
  g: number
): CouchesPixel | null {
  toile ??= canvasNeuf()
  calque ??= canvasNeuf()
  const ctx = contexte(toile, g)
  const lay = contexte(calque, g)
  if (!ctx || !lay) return null
  try {
    peins(ctx, lay, f, encre, papier, g)
    const rendu = ctx.getImageData(0, 0, g, g).data
    const { silhouette, corps } = masques(lay, f, g)
    return { g, rendu, silhouette, corps }
  } catch {
    return null
  }
}

/** Ce que le gabarit dessine : un chemin par couleur. */
export interface CouchePixel {
  fill: string
  d: string
}

/** L'image du moteur en pixel art, ou null si le navigateur ne sait pas la rasteriser. */
export function pixellise(
  f: BotFrame,
  encre: string,
  papier: string,
  g: number
): CouchePixel[] | null {
  const couches = rasterise(f, encre, papier, g)
  if (!couches) return null
  return aplatsPixel(couches, encre, papier).map((a) => ({
    fill: a.fill,
    d: cheminDesCases(a.cases, g)
  }))
}

/**
 * Chemins (repere du moteur) en cases de la grille : chaque chemin est rasterise SEUL, une case
 * est gardee quand plus de la moitie est couverte, et le dernier chemin peint gagne. Sert aux
 * accessoires portes, qui se re-pixellisent a chaque image comme le corps.
 */
export function pixellisePrims(
  prims: Array<{ d: string; fill?: string; stroke?: string; sw?: number; alpha?: number }>,
  g: number
): CouchePixel[] | null {
  if (!prims.length) return []
  toile ??= canvasNeuf()
  const ctx = contexte(toile, g)
  if (!ctx) return null
  try {
    const s = g / (DEMI_VIEWBOX * 2)
    const cases = new Map<number, string>()
    for (const p of prims) {
      if ((p.alpha ?? 1) < 0.3) continue
      const chemin = new Path2D(p.d)
      for (const mode of ['fill', 'stroke'] as const) {
        const couleur = mode === 'fill' ? p.fill : p.stroke
        if (!couleur) continue
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, g, g)
        ctx.setTransform(s, 0, 0, s, DEMI_VIEWBOX * s, DEMI_VIEWBOX * s)
        ctx.fillStyle = ctx.strokeStyle = '#000'
        ctx.lineWidth = Math.max(p.sw ?? 2, 1 / s)
        ctx.lineCap = ctx.lineJoin = 'round'
        if (mode === 'fill') ctx.fill(chemin)
        else ctx.stroke(chemin)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        const px = ctx.getImageData(0, 0, g, g).data
        for (let i = 0; i < g * g; i++) if (px[i * 4 + 3]! >= 128) cases.set(i, couleur)
      }
    }
    const parCouleur = new Map<string, number[]>()
    for (const [i, c] of cases) (parCouleur.get(c) ?? parCouleur.set(c, []).get(c)!).push(i)
    return [...parCouleur].map(([fill, liste]) => ({ fill, d: cheminDesCases(liste, g) }))
  } catch {
    return null
  }
}

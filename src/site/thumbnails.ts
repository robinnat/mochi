/**
 * Vignettes des bandes : chaque PIECE (chapeau, lunettes, etc., sans corps) est rendue UNE SEULE FOIS par le rendu 3D
 * partage (`renderAvatar`, corps invisible mais qui ancre la piece), cadree serre et centree, puis gardee sous forme
 * d'image. Les bandes defilent ensuite en CSS pur sur des images : aucun rendu 3D pendant le defilement, fluide meme
 * sur iPhone. La 3D arrive par `load3d` (entree publique) : chargement dynamique seulement. Sert a `tools/rendus.ts`.
 */
import { BotEngine, load3d, contrast, HALF_VIEWBOX, mixHex, RADIUS, SHAPE_BY_ID } from 'mochis'
import type { ItemStrip } from './strips'

/** Cote d'une vignette en pixels (affichee a la moitie : ecrans denses). */
export const SIZE_THUMBNAIL = 256
/** Passe de mesure : plus petite, elle sert seulement a trouver la boite de la piece. */
const SIZE_MEASURE = 320
const PAPER = '#f9f9f9'
const T_IMAGE = 1.2
/** Part de la case occupee par la plus grande dimension de la piece : toutes les pieces ont la meme taille apparente. */
const FILL = 0.78
/** Part du demi-cadre que la piece entiere (branches comprises) ne depasse jamais. */
const EDGE = 0.96
/**
 * Dimension minimale de la boite (unites du moteur), par emplacement : une piece minuscule (un grain de beaute) n'est pas
 * agrandie sans fin, elle reste une petite piece dans sa case.
 */
const MIN_BOX: Record<ItemStrip['slot'], number> = { head: 40, eyes: 40, face: 78, neck: 40, back: 40 }
/** Fond sombre du site : une couleur trop proche (noir de la plupart des lunettes) est eclaircie pour rester lisible. */
const BACKGROUND_DARK = '#1b1922'

type Scene3d = Awaited<ReturnType<typeof load3d>>
let scene: Promise<Scene3d> | null = null
let engine: BotEngine | null = null

/** Couleur de la piece selon le theme : en sombre, ce qui se confond avec le fond est eclairci. */
export function colorForTheme(hex: string, theme: 'light' | 'dark'): string {
  if (theme === 'light' || contrast(hex, BACKGROUND_DARK) >= 3) return hex
  return mixHex(hex, '#ffffff', 0.62)
}

export interface Box {
  cx: number
  cy: number
  w: number
  h: number
}

/**
 * Boites (en unites du moteur, y vers le haut) des pixels non transparents d'un canvas rendu avec le cadre `frame` centre en 0 :
 * `full` (tout ce qui est dessine) et `heart` (sans les parties fines : branches de lunettes, tiges, fils, qui ne
 * doivent pas decider de la taille apparente). Une colonne ou une ligne compte dans le coeur si elle porte au moins
 * `threshold` (part du maximum) de pixels opaques.
 */
export function boxesOpaque(data: Uint8ClampedArray, px: number, frame: number, threshold = 0.4): { full: Box; heart: Box } | null {
  const col = new Uint32Array(px)
  const lig = new Uint32Array(px)
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      if (data[(y * px + x) * 4 + 3]! > 24) {
        col[x]!++
        lig[y]!++
      }
    }
  }
  const extent = (n: Uint32Array, min: number): [number, number] | null => {
    let a = -1
    let z = -1
    for (let i = 0; i < px; i++) {
      if (n[i]! > min) {
        if (a < 0) a = i
        z = i
      }
    }
    return a < 0 ? null : [a, z]
  }
  const fullX = extent(col, 0)
  const fullY = extent(lig, 0)
  if (!fullX || !fullY) return null
  const heartX = extent(col, threshold * Math.max(...col)) ?? fullX
  const heartY = extent(lig, threshold * Math.max(...lig)) ?? fullY
  const k = (2 * frame) / px
  const box = ([x0, x1]: [number, number], [y0, y1]: [number, number]): Box => ({
    cx: ((x0 + x1 + 1) / 2 - px / 2) * k,
    cy: -((y0 + y1 + 1) / 2 - px / 2) * k,
    w: (x1 - x0 + 1) * k,
    h: (y1 - y0 + 1) * k
  })
  return { full: box(fullX, fullY), heart: box(heartX, heartY) }
}

/** Compat : la boite pleine seule. */
export const boxOpaque = (data: Uint8ClampedArray, px: number, frame: number): Box | null => boxesOpaque(data, px, frame)?.full ?? null

/**
 * Rend une piece seule en image (URL d'objet, a liberer avec `URL.revokeObjectURL`) ; `null` si le rendu 3D n'est pas disponible.
 * Deux passes : une passe large mesure la boite de la piece, la seconde la cadre serre, centree, a taille homogene.
 */
export async function renderThumbnail(item: ItemStrip, theme: 'light' | 'dark'): Promise<string | null> {
  try {
    scene ??= load3d()
    const m = await scene
    engine ??= new BotEngine(RADIUS, 'idle', SHAPE_BY_ID.get('circle')!.radii, null)
    const frame = engine.sample(T_IMAGE)
    const sel = { [item.slot]: { id: item.accessory, c1: colorForTheme(item.c1, theme), c2: colorForTheme(item.c2, theme) } }
    const render = (cv: HTMLCanvasElement, viewFrame: number, center: { x: number; y: number }) =>
      m.renderAvatar(cv, frame, '#8b3dff', PAPER, 'soft', false, 'strong', true, 'circle', item.yaw, null, sel, viewFrame, theme, undefined, 0, false, true, undefined, true, center)
    // passe 1 : mesure
    const measure = document.createElement('canvas')
    measure.width = measure.height = SIZE_MEASURE
    const frame1 = HALF_VIEWBOX * 1.1
    render(measure, frame1, { x: 0, y: 0 })
    const data = measure.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, SIZE_MEASURE, SIZE_MEASURE).data
    const boxes = boxesOpaque(data, SIZE_MEASURE, frame1)
    if (!boxes) return null
    const { full, heart } = boxes
    // passe 2 : cadre carre centre sur le coeur de la piece, pour que sa plus grande dimension occupe `FILL` de la case ;
    // les parties fines (branches, tiges) peuvent depasser un peu, mais jamais sortir de l'image
    const most = Math.max(heart.w, heart.h, MIN_BOX[item.slot])
    const dehors = Math.max(Math.abs(full.cx - heart.cx) + full.w / 2, Math.abs(full.cy - heart.cy) + full.h / 2)
    const frame2 = Math.max(most / 2 / FILL, dehors / EDGE)
    const box = heart
    const cv = document.createElement('canvas')
    cv.width = cv.height = SIZE_THUMBNAIL
    render(cv, frame2, { x: box.cx, y: box.cy })
    const blob: Blob | null = await new Promise((r) => cv.toBlob((b) => r(b), 'image/png'))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

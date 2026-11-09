/**
 * Vignettes des bandes : chaque PIECE (chapeau, lunettes, etc., sans corps) est rendue UNE SEULE FOIS par le rendu 3D
 * partage (`rendreAvatar`, corps invisible mais qui ancre la piece), cadree serre et centree, puis gardee sous forme
 * d'image. Les bandes defilent ensuite en CSS pur sur des images : aucun rendu 3D pendant le defilement, fluide meme
 * sur iPhone. Importe `three` via `scene3d` : chargement dynamique seulement.
 */
import { BotEngine } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPE_BY_ID, mixHex } from '@/bot/skins'
import { contraste } from '@/ui/trois/theme'
import type { ItemBande } from './bandes'

/** Cote d'une vignette en pixels (affichee a la moitie : ecrans denses). */
export const TAILLE_VIGNETTE = 256
/** Passe de mesure : plus petite, elle sert seulement a trouver la boite de la piece. */
const TAILLE_MESURE = 320
const PAPIER = '#f9f9f9'
const T_IMAGE = 1.2
/** Part de la case occupee par la plus grande dimension de la piece : toutes les pieces ont la meme taille apparente. */
const REMPLISSAGE = 0.78
/** Part du demi-cadre que la piece entiere (branches comprises) ne depasse jamais. */
const BORD = 0.96
/**
 * Dimension minimale de la boite (unites du moteur), par emplacement : une piece minuscule (un grain de beaute) n'est pas
 * agrandie sans fin, elle reste une petite piece dans sa case.
 */
const MIN_BOITE: Record<ItemBande['emplacement'], number> = { tete: 40, yeux: 40, visage: 78, bas: 40, dos: 40 }
/** Fond sombre du site : une couleur trop proche (noir de la plupart des lunettes) est eclaircie pour rester lisible. */
const FOND_SOMBRE = '#1b1922'

type Scene3d = typeof import('@/ui/trois/scene3d')
let scene: Promise<Scene3d> | null = null
let moteur: BotEngine | null = null

/** Couleur de la piece selon le theme : en sombre, ce qui se confond avec le fond est eclairci. */
export function couleurPourTheme(hex: string, theme: 'light' | 'dark'): string {
  if (theme === 'light' || contraste(hex, FOND_SOMBRE) >= 3) return hex
  return mixHex(hex, '#ffffff', 0.62)
}

export interface Boite {
  cx: number
  cy: number
  w: number
  h: number
}

/**
 * Boites (en unites du moteur, y vers le haut) des pixels non transparents d'un canvas rendu avec le cadre `cadre` centre en 0 :
 * `pleine` (tout ce qui est dessine) et `coeur` (sans les parties fines : branches de lunettes, tiges, fils, qui ne
 * doivent pas decider de la taille apparente). Une colonne ou une ligne compte dans le coeur si elle porte au moins
 * `seuil` (part du maximum) de pixels opaques.
 */
export function boitesOpaques(data: Uint8ClampedArray, px: number, cadre: number, seuil = 0.4): { pleine: Boite; coeur: Boite } | null {
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
  const etendue = (n: Uint32Array, min: number): [number, number] | null => {
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
  const pleineX = etendue(col, 0)
  const pleineY = etendue(lig, 0)
  if (!pleineX || !pleineY) return null
  const coeurX = etendue(col, seuil * Math.max(...col)) ?? pleineX
  const coeurY = etendue(lig, seuil * Math.max(...lig)) ?? pleineY
  const k = (2 * cadre) / px
  const boite = ([x0, x1]: [number, number], [y0, y1]: [number, number]): Boite => ({
    cx: ((x0 + x1 + 1) / 2 - px / 2) * k,
    cy: -((y0 + y1 + 1) / 2 - px / 2) * k,
    w: (x1 - x0 + 1) * k,
    h: (y1 - y0 + 1) * k
  })
  return { pleine: boite(pleineX, pleineY), coeur: boite(coeurX, coeurY) }
}

/** Compat : la boite pleine seule. */
export const boiteOpaque = (data: Uint8ClampedArray, px: number, cadre: number): Boite | null => boitesOpaques(data, px, cadre)?.pleine ?? null

/**
 * Rend une piece seule en image (URL d'objet, a liberer avec `URL.revokeObjectURL`) ; `null` si le rendu 3D n'est pas disponible.
 * Deux passes : une passe large mesure la boite de la piece, la seconde la cadre serre, centree, a taille homogene.
 */
export async function rendreVignette(item: ItemBande, theme: 'light' | 'dark'): Promise<string | null> {
  try {
    scene ??= import('@/ui/trois/scene3d')
    const m = await scene
    moteur ??= new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('cercle')!.radii, null)
    const frame = moteur.sample(T_IMAGE)
    const sel = { [item.emplacement]: { id: item.accessoire, c1: couleurPourTheme(item.c1, theme), c2: couleurPourTheme(item.c2, theme) } }
    const rendre = (cv: HTMLCanvasElement, cadre: number, centre: { x: number; y: number }) =>
      m.rendreAvatar(cv, frame, '#7a3cff', PAPIER, 'doux', false, 'marque', true, 'cercle', item.yaw, null, sel, cadre, theme, undefined, 0, false, true, undefined, true, centre)
    // passe 1 : mesure
    const mesure = document.createElement('canvas')
    mesure.width = mesure.height = TAILLE_MESURE
    const cadre1 = DEMI_VIEWBOX * 1.1
    rendre(mesure, cadre1, { x: 0, y: 0 })
    const data = mesure.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, TAILLE_MESURE, TAILLE_MESURE).data
    const boites = boitesOpaques(data, TAILLE_MESURE, cadre1)
    if (!boites) return null
    const { pleine, coeur } = boites
    // passe 2 : cadre carre centre sur le coeur de la piece, pour que sa plus grande dimension occupe `REMPLISSAGE` de la case ;
    // les parties fines (branches, tiges) peuvent depasser un peu, mais jamais sortir de l'image
    const plus = Math.max(coeur.w, coeur.h, MIN_BOITE[item.emplacement])
    const dehors = Math.max(Math.abs(pleine.cx - coeur.cx) + pleine.w / 2, Math.abs(pleine.cy - coeur.cy) + pleine.h / 2)
    const cadre2 = Math.max(plus / 2 / REMPLISSAGE, dehors / BORD)
    const boite = coeur
    const cv = document.createElement('canvas')
    cv.width = cv.height = TAILLE_VIGNETTE
    rendre(cv, cadre2, { x: boite.cx, y: boite.cy })
    const blob: Blob | null = await new Promise((r) => cv.toBlob((b) => r(b), 'image/png'))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

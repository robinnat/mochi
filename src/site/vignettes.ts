/**
 * Vignettes des bandes : chaque Mochi est rendu UNE SEULE FOIS (rendu 3D partage, `rendreAvatar`) puis garde sous
 * forme d'image. Les bandes defilent ensuite en CSS pur (transform) sur des images : aucun rendu 3D pendant le
 * defilement, fluide meme sur iPhone. Importe `three` via `scene3d` : chargement dynamique seulement.
 */
import { BotEngine } from '@/bot/engine'
import { Humeurs } from '@/bot/humeurs'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPE_BY_ID } from '@/bot/skins'
import type { ItemBande } from './bandes'

/** Cote d'une vignette en pixels (affichee a la moitie (128) : ecrans denses). */
export const TAILLE_VIGNETTE = 256
const PAPIER = '#f9f9f9'
/** Instant fige : un repos bien ouvert */
const T_IMAGE = 1.2
/**
 * Demi-largeur du cadre selon l'emplacement (en part du viewBox) : plus petit = Mochi plus grand dans la vignette.
 * Les petits accessoires (lunettes, joues, noeuds) se lisent de pres ; les chapeaux et les ailes ont besoin de place.
 */
const CADRE: Record<ItemBande['emplacement'], number> = { tete: 1.04, yeux: 0.78, visage: 0.8, bas: 0.84, dos: 1 }

type Scene3d = typeof import('@/ui/trois/scene3d')
let scene: Promise<Scene3d> | null = null
const moteurs = new Map<string, BotEngine>()

function moteur(forme: string): BotEngine {
  let m = moteurs.get(forme)
  if (!m) {
    m = new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get(forme)!.radii, null)
    moteurs.set(forme, m)
  }
  return m
}

/** Rend un item en image (URL d'objet, a liberer avec `URL.revokeObjectURL`) ; `null` si le rendu 3D n'est pas disponible. */
export async function rendreVignette(item: ItemBande, theme: 'light' | 'dark'): Promise<string | null> {
  try {
    scene ??= import('@/ui/trois/scene3d')
    const m = await scene
    const cv = document.createElement('canvas')
    cv.width = cv.height = TAILLE_VIGNETTE
    const geste = new Humeurs(item.mood).sample(T_IMAGE)
    const frame = moteur(item.forme).sample(T_IMAGE, geste)
    m.rendreAvatar(cv, frame, item.corps, PAPIER, 'doux', false, 'marque', true, item.forme, item.yaw, null, {
      [item.emplacement]: { id: item.accessoire, c1: item.c1, c2: item.c2 }
    }, DEMI_VIEWBOX * CADRE[item.emplacement], theme)
    const blob: Blob | null = await new Promise((r) => cv.toBlob((b) => r(b), 'image/png'))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

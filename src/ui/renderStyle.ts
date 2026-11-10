/**
 * Style de RENDU du bot : Soft, Flat ou Pixel, tous en vraie 3D (WebGL, `src/ui/trois/`).
 *
 * Seul le dessin change. Le moteur (`src/bot/`), ses cinq etats et toutes ses
 * mesures restent identiques : `engine.sample(t)` rend la meme image, c'est `mochi-bot.ts`
 * qui la peint autrement. D'ou ce module dans `src/ui/` et pas dans `src/bot/`.
 *
 * Le catalogue ne porte que des ids, comme les formes et les couleurs : les libelles sont
 * resolus par `t('styles.<id>')`, et l'union litterale fait verifier a la compilation que
 * chacun a sa traduction dans les trois langues.
 */

import { ref } from '@/ui/dom/reactive'
import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'

/** Les trois styles, tous en vraie 3D (WebGL) : `3d` (Soft), `flat3d` (Flat) et `pixel3d` (Pixel). */
export type RenderStyleId = '3d' | 'flat3d' | 'pixel3d'

/** Les styles proposes dans l'interface. */
export const RENDER_STYLES: RenderStyleId[] = ['3d', 'flat3d', 'pixel3d']

/** Soft par defaut : la 3D douce validee. */
export const DEFAULT_RENDER_STYLE: RenderStyleId = '3d'

export const isRenderStyle = (v: string): v is RenderStyleId => (RENDER_STYLES as string[]).includes(v)

/** Matiere 3D d'un style : Soft = celle choisie (`soft` par defaut), Flat = trois tons, Pixel = basse resolution + palette. */
export const materialFor = <T extends string>(r: RenderStyleId, soft: T): T | 'toon' | 'pixel' =>
  r === 'flat3d' ? 'toon' : r === 'pixel3d' ? 'pixel' : soft

/* ----------------------------------------------------------------- pixel art */

/** Taille des pixels du style Pixel (`pixel3d`) : elle fixe la resolution de sa toile. */
export type PixelSizeId = 'large' | 'medium' | 'fine'

/**
 * Taille des pixels, exprimee par le DIAMETRE de la boule en pixels : c'est ce qu'on voit,
 * « une boule de 24 pixels », et pas une taille de grille qui inclut la marge des anneaux.
 */
export const PIXEL_SIZES: { id: PixelSizeId; diameter: number }[] = [
  { id: 'large', diameter: 16 },
  { id: 'medium', diameter: 24 },
  { id: 'fine', diameter: 32 }
]

/** Pixel (3D) : taille de la toile basse resolution. La densite la plus fine (32 pixels de diametre) est le defaut ; les autres restent acceptees par la prop `pixel`, sans choix dans l'interface. */
export const DEFAULT_PIXEL: PixelSizeId = 'fine'

export const isPixelSize = (v: string): v is PixelSizeId =>
  PIXEL_SIZES.some((p) => p.id === v)

/**
 * Cote de la grille, en cases, sur TOUT le viewBox (±DEMI_VIEWBOX) : les anneaux et les
 * particules des etats animes vivent dans la marge et doivent etre pixellises eux aussi.
 */
export function pixelGrid(size: PixelSizeId): number {
  const d = PIXEL_SIZES.find((p) => p.id === size)?.diameter ?? 24
  return Math.round((d * HALF_VIEWBOX) / RADIUS)
}

/* ----------------------------------------------------------- reglage courant */

/**
 * Le style choisi, partage par tous les bots AFFICHES : vignettes, timeline, planche.
 * `MochiBot` le prend quand on ne lui passe pas de style explicite, ce qui evite de
 * descendre la prop a travers chaque composant qui monte une vignette.
 *
 * Les exports, eux, passent le style EXPLICITEMENT (`SettingsBot`) : une instance hors
 * ecran doit rendre exactement ce qu'on lui demande, pas ce que l'ecran affiche a cet
 * instant.
 */
export const currentRenderStyle = ref<RenderStyleId>(DEFAULT_RENDER_STYLE)
/** Contour cartoon de la vraie 3D (option du style 3D) ; suivi comme `currentRenderStyle`. */
export const currentOutline = ref(false)
export const currentPixel = ref<PixelSizeId>(DEFAULT_PIXEL)

/** Le style a rendre : celui donne s'il est connu, sinon le reglage courant. */
export const effectiveRenderStyle = (r: string | undefined): RenderStyleId => (r && isRenderStyle(r) ? r : currentRenderStyle.value)
export const effectivePixel = (p: PixelSizeId | undefined): PixelSizeId =>
  p ?? currentPixel.value

/** Ajoute au nom du fichier exporte : le style reel (`3d`, `flat3d`, `pixel3d`). */
export const renderStyleSuffix = (r: RenderStyleId) => r

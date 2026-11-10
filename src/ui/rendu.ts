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

import { ref } from '@/ui/dom/reactif'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'

/** Les trois styles, tous en vraie 3D (WebGL) : `3d` (Soft), `flat3d` (Flat) et `pixel3d` (Pixel). */
export type RenduId = '3d' | 'flat3d' | 'pixel3d'

/** Les styles proposes dans l'interface. */
export const RENDUS: RenduId[] = ['3d', 'flat3d', 'pixel3d']

/** Soft par defaut : la 3D douce validee. */
export const RENDU_DEFAUT: RenduId = '3d'

export const estRendu = (v: string): v is RenduId => (RENDUS as string[]).includes(v)

/** Matiere 3D d'un style : Soft = celle choisie (`doux` par defaut), Flat = trois tons, Pixel = basse resolution + palette. */
export const matiere3dDe = <T extends string>(r: RenduId, soft: T): T | 'toon' | 'pixel' =>
  r === 'flat3d' ? 'toon' : r === 'pixel3d' ? 'pixel' : soft

/* ----------------------------------------------------------------- pixel art */

/** Taille des pixels du style Pixel (`pixel3d`) : elle fixe la resolution de sa toile. */
export type TaillePixelId = 'gros' | 'moyen' | 'fin'

/**
 * Taille des pixels, exprimee par le DIAMETRE de la boule en pixels : c'est ce qu'on voit,
 * « une boule de 24 pixels », et pas une taille de grille qui inclut la marge des anneaux.
 */
export const TAILLES_PIXEL: { id: TaillePixelId; diametre: number }[] = [
  { id: 'gros', diametre: 16 },
  { id: 'moyen', diametre: 24 },
  { id: 'fin', diametre: 32 }
]

/** Pixel (3D) : taille de la toile basse resolution. La densite la plus fine (32 pixels de diametre) est le defaut ; les autres restent acceptees par la prop `pixel`, sans choix dans l'interface. */
export const PIXEL_DEFAUT: TaillePixelId = 'fin'

export const estTaillePixel = (v: string): v is TaillePixelId =>
  TAILLES_PIXEL.some((p) => p.id === v)

/**
 * Cote de la grille, en cases, sur TOUT le viewBox (±DEMI_VIEWBOX) : les anneaux et les
 * particules des etats animes vivent dans la marge et doivent etre pixellises eux aussi.
 */
export function grillePixel(taille: TaillePixelId): number {
  const d = TAILLES_PIXEL.find((p) => p.id === taille)?.diametre ?? 24
  return Math.round((d * DEMI_VIEWBOX) / RAYON)
}

/* ----------------------------------------------------------- reglage courant */

/**
 * Le style choisi, partage par tous les bots AFFICHES : vignettes, timeline, planche.
 * `MochiBot` le prend quand on ne lui passe pas de style explicite, ce qui evite de
 * descendre la prop a travers chaque composant qui monte une vignette.
 *
 * Les exports, eux, passent le style EXPLICITEMENT (`ReglagesBot`) : une instance hors
 * ecran doit rendre exactement ce qu'on lui demande, pas ce que l'ecran affiche a cet
 * instant.
 */
export const renduCourant = ref<RenduId>(RENDU_DEFAUT)
/** Contour cartoon de la vraie 3D (option du style 3D) ; suivi comme `renduCourant`. */
export const contourCourant = ref(false)
export const pixelCourant = ref<TaillePixelId>(PIXEL_DEFAUT)

/** Le style a rendre : celui donne s'il est connu, sinon le reglage courant. */
export const renduEffectif = (r: string | undefined): RenduId => (r && estRendu(r) ? r : renduCourant.value)
export const pixelEffectif = (p: TaillePixelId | undefined): TaillePixelId =>
  p ?? pixelCourant.value

/** Ajoute au nom du fichier exporte : le style reel (`3d`, `flat3d`, `pixel3d`). */
export const suffixeRendu = (r: RenduId) => r

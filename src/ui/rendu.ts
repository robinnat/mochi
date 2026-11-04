/**
 * Style de RENDU du bot : original, pixel art, ou 3D douce (argile, bulle).
 *
 * Seul le dessin change. Le moteur (`src/bot/`), ses cinq etats et toutes ses
 * mesures restent identiques : `engine.sample(t)` rend la meme image, c'est `MochiBot.vue`
 * qui la peint autrement. D'ou ce module dans `src/ui/` et pas dans `src/bot/`.
 *
 * Le catalogue ne porte que des ids, comme les formes et les couleurs : les libelles sont
 * resolus par `t('styles.<id>')`, et l'union litterale fait verifier a la compilation que
 * chacun a sa traduction dans les trois langues.
 */

import { ref } from 'vue'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { mixHex } from '@/bot/skins'

/**
 * `3d` (Soft), `flat3d` (Flat) et `pixel3d` (Pixel) sont les trois styles proposes : tous en vraie
 * 3D. `original`, `pixel`, `argile` et `bulle` sont les anciens dessins SVG ; ils ne sont plus
 * proposes (ni stockes) et ne servent plus que de REPLI quand WebGL manque et pour les exports.
 */
export type RenduId = 'original' | 'pixel' | 'argile' | 'bulle' | '3d' | 'flat3d' | 'pixel3d'

/** Les styles proposes dans l'interface. */
export const RENDUS: RenduId[] = ['3d', 'flat3d', 'pixel3d']

/** Soft par defaut : la 3D douce validee. */
export const RENDU_DEFAUT: RenduId = '3d'

export const estRendu = (v: string): v is RenduId => (RENDUS as string[]).includes(v)

/** Les deux 3D douces partagent le meme gabarit, seules leurs teintes different. */
export const est3d = (r: RenduId): r is 'argile' | 'bulle' => r === 'argile' || r === 'bulle'

/**
 * La vraie 3D (WebGL, `src/ui/trois/`). Chargee a la demande ; tant qu'elle n'est pas la,
 * ou si le navigateur n'a pas de WebGL, le bot est dessine en argile, sa version SVG.
 */
export const estVraie3d = (r: RenduId): r is '3d' | 'flat3d' | 'pixel3d' => r === '3d' || r === 'flat3d' || r === 'pixel3d'

/** Matiere 3D d'un style : Soft = celle choisie (`doux` par defaut), Flat = trois tons, Pixel = basse resolution + palette. */
export const matiere3dDe = <T extends string>(r: RenduId, soft: T): T | 'toon' | 'pixel' =>
  r === 'flat3d' ? 'toon' : r === 'pixel3d' ? 'pixel' : soft

/**
 * Style d'un EXPORT. Les exports serialisent le SVG ; le canvas WebGL n'y passe pas, donc
 * un export en 3D sort en argile (et son nom de fichier le dit).
 */
export const renduExportable = (r: RenduId): Exclude<RenduId, '3d' | 'flat3d' | 'pixel3d'> => (estVraie3d(r) ? 'argile' : r)

/* ----------------------------------------------------------------- pixel art */

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

export const PIXEL_DEFAUT: TaillePixelId = 'moyen'

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

/* ------------------------------------------------------------------- 3D douce */

export interface Teintes3d {
  /** reflet de la lumiere, en haut a gauche */
  clair: string
  /** la couleur choisie, telle quelle */
  base: string
  /** cote a l'ombre, en bas a droite */
  ombre: string
  /** ombre portee sous la forme : coloree, pas grise */
  portee: string
}

/**
 * Teintes du volume. La couleur choisie reste au milieu du degrade : on l'eclaire et on
 * l'assombrit. L'argile est mate et pastel (la couleur blanchie d'un sixieme, peu de
 * contraste), la bulle est lisse, saturee et lumineuse (la couleur telle quelle, reflet
 * franc).
 */
export function teintes3d(hex: string, rendu: 'argile' | 'bulle'): Teintes3d {
  if (rendu === 'bulle') {
    return {
      clair: mixHex(hex, '#ffffff', 0.62),
      base: hex,
      ombre: mixHex(hex, '#000000', 0.32),
      portee: mixHex(hex, '#000000', 0.35)
    }
  }
  // l'argile est une pate : la couleur passe au pastel, et son ombre reste douce
  const pastel = mixHex(hex, '#ffffff', 0.16)
  return {
    clair: mixHex(hex, '#ffffff', 0.42),
    base: pastel,
    ombre: mixHex(hex, '#000000', 0.18),
    portee: mixHex(hex, '#000000', 0.3)
  }
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

export const renduEffectif = (r: RenduId | undefined): RenduId => r ?? renduCourant.value
export const pixelEffectif = (p: TaillePixelId | undefined): TaillePixelId =>
  p ?? pixelCourant.value

/** Ajoute au nom du fichier exporte ; rien pour l'original, dont le nom ne change pas. */
export const suffixeRendu = (r: RenduId) => (r === 'original' ? '' : r)

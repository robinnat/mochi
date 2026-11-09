/**
 * Images PRE-RENDUES du site : chaque Mochi fige de la page (petits Mochi du hero, formes, cartes, icones des
 * accessoires) et l'affiche de chaque Mochi vivant (montree tout de suite, avant que la 3D ne soit prete) est une
 * image de la VRAIE 3D, rendue une fois par le vrai composant (`tools/rendus.html`, Chrome headless) dans
 * `public/rendus/`, en clair et en sombre. Au chargement, la page n'a donc ni Three.js a telecharger ni rendu 3D a
 * faire pour ces images, et jamais de repli 2D a l'ecran.
 *
 * Les props ecrites ici sont celles que la page passe au Mochi vivant : l'affiche et la 3D vivante sont la meme image.
 */
import type { Selection } from '@/bot/emplacements'
import { CATALOGUE, type Emplacement } from '@/bot/emplacements'
import type { RenduId } from '@/ui/rendu'
import { FORMES_3D } from './catalog'
import { STYLES_SITE } from './style'

export type ThemeSite = 'light' | 'dark'

/** Props d'un Mochi du site (sous-ensemble de celles de `MochiBot`). */
export interface PropsMochi {
  shape: string
  color: string
  rendu?: RenduId
  mood?: string
  yaw?: number
  accessoires?: Selection
  contour?: boolean
  theme?: ThemeSite
}

export interface Affiche {
  nom: string
  /** cote affiche, en pixels CSS (l'image fait le double) */
  taille: number
  props: PropsMochi
  /** instant fige : 0 pour l'affiche d'un Mochi vivant (sa premiere image), 1,2 pour une vignette */
  t: number
}

/* ------------------------------------------------------------------ les Mochi vivants (et leur affiche) */
export const MOODS_BOT: PropsMochi = { shape: 'squircle', color: '#00c7be', rendu: '3d', mood: 'repos' }
export const INTER_BOT: PropsMochi = { shape: 'etoile', color: '#ffd60a', rendu: '3d', mood: 'repos' }
export const DOCS_BOT: PropsMochi = { shape: 'etoile', color: '#ff3b30', rendu: '3d', mood: 'repos' }
export const STYLE_BOT = (rendu: RenduId): PropsMochi => ({ shape: 'cercle', color: '#2d5bff', rendu, mood: 'repos' })
/** Le Mochi de « Make it yours » tel qu'il arrive (casquette rouge du catalogue). */
export const PERSO_DEPART: PropsMochi = {
  shape: 'etoile',
  color: '#21b0ff',
  rendu: '3d',
  mood: 'repos',
  contour: false,
  accessoires: { tete: { id: 'casquette', c1: '#ff3b30', c2: '#ff3b30' } }
}

/* ------------------------------------------------------------------ les vignettes figees */
export const BENTO_THEME: PropsMochi = { shape: 'etoile', color: '#ffd60a', rendu: '3d' }
/**
 * Carte « accessoires » : une liste FIXE et soignee de variantes (corps, couleurs d'accessoires, une piece par
 * emplacement), une image pre-rendue par variante (`defile-NN`). Chaque accessoire du catalogue y figure au moins
 * une fois (teste). Les variantes avec une piece du dos sont vues de trois quarts arriere (pas de lunettes alors).
 */
export interface Variante {
  forme: string
  corps: string
  acc: Selection
  dos?: boolean
}
const R = '#ff3b30', J = '#ffd60a', T = '#00c7be', M = '#2b3a67', P = '#ff4d94', C = '#f6f1e7', N = '#26222f', O = '#ffc933', V = '#8b3dff', B = '#2d5bff'
const c = (id: string, c1: string, c2?: string) => ({ id, c1, c2: c2 ?? c1 })
export const VARIANTES: Variante[] = [
  { forme: 'cercle', corps: '#ff3b30', acc: { tete: c('casquette', B), yeux: 'rondes' } },
  { forme: 'etoile', corps: '#21b0ff', acc: { tete: 'couronne', yeux: 'coeur', bas: 'papillon' } },
  { forme: 'cercle', corps: '#ffd60a', acc: { tete: 'haut-de-forme', yeux: 'monocle', bas: c('echarpe', T) } },
  { forme: 'nuage', corps: '#00c46a', acc: { tete: 'paille', yeux: 'soleil', bas: 'fleurs' } },
  { forme: 'fleur', corps: '#d81bbd', acc: { tete: c('beret', R), yeux: 'carrees', bas: 'perles' } },
  { forme: 'goutte', corps: '#ff9500', acc: { tete: c('ruban', J), visage: 'joues', bas: c('papillon', R) } },
  { forme: 'squircle', corps: '#2d5bff', acc: { tete: c('casque', V), yeux: 'etoile', bas: c('echarpe', P) } },
  { forme: 'cercle', corps: '#b6e800', acc: { tete: 'toque', yeux: c('rondes', R), bas: 'papillon' } },
  { forme: 'etoile', corps: '#ff4d94', acc: { tete: c('antenne', N, J), visage: 'joues', bas: 'perles' } },
  { forme: 'cercle', corps: '#00c7be', acc: { tete: c('fleur', V, J), yeux: c('soleil', M, M) } },
  { forme: 'cercle', corps: '#8b3dff', acc: { tete: c('casquette', J), yeux: c('coeur', R), bas: c('echarpe', C) } },
  { forme: 'nuage', corps: '#6fd400', acc: { tete: 'couronne', yeux: c('carrees', T), bas: 'fleurs' } },
  { forme: 'squircle', corps: '#e6194b', acc: { tete: c('haut-de-forme', C, O), yeux: 'monocle', bas: c('papillon', O) } },
  { forme: 'fleur', corps: '#ff6a3d', acc: { tete: c('beret', T), yeux: 'rondes', bas: c('echarpe', R) } },
  { forme: 'goutte', corps: '#ff3b30', acc: { tete: 'paille', visage: 'joues', bas: 'perles' } },
  { forme: 'cercle', corps: '#21b0ff', acc: { tete: c('casque', M), yeux: 'soleil', bas: c('papillon', V) } },
  { forme: 'cercle', corps: '#ffd60a', acc: { yeux: c('etoile', V), tete: c('ruban', P), visage: 'joues' } },
  { forme: 'cercle', corps: '#00c46a', acc: { yeux: c('coeur', P), tete: 'toque', bas: 'fleurs' } },
  { forme: 'cercle', corps: '#d81bbd', acc: { tete: c('ruban', V), yeux: 'etoile', bas: 'papillon' } },
  { forme: 'etoile', corps: '#ff9500', acc: { tete: 'couronne', yeux: 'soleil', bas: c('echarpe', J) } },
  { forme: 'cercle', corps: '#2d5bff', acc: { dos: c('sac', R, M), tete: c('casquette', M) }, dos: true },
  { forme: 'nuage', corps: '#b6e800', acc: { dos: c('cape', V), tete: 'haut-de-forme' }, dos: true },
  { forme: 'cercle', corps: '#ff4d94', acc: { tete: 'fleur', visage: 'joues', bas: 'perles' } },
  { forme: 'squircle', corps: '#00c7be', acc: { tete: 'antenne', yeux: 'rondes', bas: 'fleurs' } },
  { forme: 'fleur', corps: '#8b3dff', acc: { dos: c('sac', J, M), tete: 'paille' }, dos: true },
  { forme: 'cercle', corps: '#6fd400', acc: { dos: c('cape', T), tete: c('beret', N) }, dos: true }
]
export const DEFILE = VARIANTES.map((v, i) => ({
  nom: `defile-${String(i + 1).padStart(2, '0')}`,
  variante: v,
  props: { shape: v.forme, color: v.corps, rendu: '3d', yaw: v.dos ? 2.0 : 0.3, accessoires: v.acc } as PropsMochi
}))
export const TAILLE_DEFILE = 166

export const AFFICHES: Affiche[] = [
  { nom: 'moods', taille: 320, props: MOODS_BOT, t: 0 },
  { nom: 'inter', taille: 290, props: INTER_BOT, t: 0 },
  { nom: 'docs', taille: 180, props: DOCS_BOT, t: 0 },
  { nom: 'perso', taille: 320, props: PERSO_DEPART, t: 0 },
  ...STYLES_SITE.map((s) => ({ nom: `style-${s.id}`, taille: 360, props: STYLE_BOT(s.id), t: 0 })),
  ...STYLES_SITE.map((s) => ({ nom: `style-mini-${s.id}`, taille: 180, props: { shape: 'cercle', color: '#2d5bff', rendu: s.id, yaw: 0.35 }, t: 1.2 })),
  ...STYLES_SITE.flatMap((s) => FORMES_3D.map((f) => ({ nom: `forme-${f.id}-${s.id}`, taille: 128, props: { shape: f.id, color: f.couleur, rendu: s.id }, t: 1.2 }))),
  { nom: 'bento-clair', taille: 146, props: { ...BENTO_THEME, theme: 'light' }, t: 1.2 },
  { nom: 'bento-sombre', taille: 146, props: { ...BENTO_THEME, theme: 'dark' }, t: 1.2 },
  ...DEFILE.map((d) => ({ nom: d.nom, taille: TAILLE_DEFILE, props: d.props, t: 1.2 }))
]

const suffixe = (theme: ThemeSite) => (theme === 'dark' ? 'sombre' : 'clair')
/** Adresse d'une image pre-rendue (une par theme). */
export const urlAffiche = (nom: string, theme: ThemeSite) => `/rendus/${nom}-${suffixe(theme)}.webp`

/** Icone d'un accessoire seul (la piece, sans corps), dans les couleurs du catalogue. */
export const PIECES = CATALOGUE.map((a) => ({ emplacement: a.emplacement, id: a.id }))
export const urlPiece = (e: Emplacement, id: string, theme: ThemeSite) => `/rendus/piece-${e}-${id}-${suffixe(theme)}.webp`
/** Cote de l'image d'une piece, en pixels. */
export const TAILLE_PIECE = 160

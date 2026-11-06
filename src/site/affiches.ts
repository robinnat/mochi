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
export const HERO: PropsMochi = { shape: 'cercle', color: '#8b5cf6', rendu: '3d', mood: 'repos' }
export const MOODS_BOT: PropsMochi = { shape: 'squircle', color: '#2dd4bf', rendu: '3d', mood: 'repos' }
export const INTER_BOT: PropsMochi = { shape: 'etoile', color: '#f5b53d', rendu: '3d', mood: 'repos' }
export const DOCS_BOT: PropsMochi = { shape: 'etoile', color: '#8b5cf6', rendu: '3d', mood: 'repos' }
export const STYLE_BOT = (rendu: RenduId): PropsMochi => ({ shape: 'cercle', color: '#8b5cf6', rendu, mood: 'repos' })
/** Le Mochi de « Make it yours » tel qu'il arrive (casquette rouge du catalogue). */
export const PERSO_DEPART: PropsMochi = {
  shape: 'etoile',
  color: '#8b5cf6',
  rendu: '3d',
  mood: 'repos',
  contour: false,
  accessoires: { tete: { id: 'casquette', c1: '#e8505b', c2: '#e8505b' } }
}

/* ------------------------------------------------------------------ les vignettes figees */
export const SATELLITES = [
  { forme: 'etoile', couleur: '#f5b53d', taille: 92 },
  { forme: 'nuage', couleur: '#f472b6', taille: 78 },
  { forme: 'fleur', couleur: '#2dd4bf', taille: 70 },
  { forme: 'goutte', couleur: '#4f9cf5', taille: 64 }
]
export const BENTO_THEME: PropsMochi = { shape: 'etoile', color: '#f5b53d', rendu: '3d' }
export const BENTO_ACC: PropsMochi = { shape: 'cercle', color: '#f472b6', rendu: '3d', yaw: 0.3, accessoires: { tete: 'casquette', yeux: 'rondes', bas: 'papillon' } }

export const AFFICHES: Affiche[] = [
  { nom: 'hero', taille: 400, props: HERO, t: 0 },
  { nom: 'moods', taille: 320, props: MOODS_BOT, t: 0 },
  { nom: 'inter', taille: 290, props: INTER_BOT, t: 0 },
  { nom: 'docs', taille: 180, props: DOCS_BOT, t: 0 },
  { nom: 'perso', taille: 320, props: PERSO_DEPART, t: 0 },
  ...STYLES_SITE.map((s) => ({ nom: `style-${s.id}`, taille: 360, props: STYLE_BOT(s.id), t: 0 })),
  ...STYLES_SITE.map((s) => ({ nom: `style-mini-${s.id}`, taille: 180, props: { shape: 'cercle', color: '#8b5cf6', rendu: s.id, yaw: 0.35 }, t: 1.2 })),
  ...SATELLITES.map((s) => ({ nom: `sat-${s.forme}`, taille: s.taille, props: { shape: s.forme, color: s.couleur, rendu: '3d' as RenduId }, t: 1.2 })),
  ...STYLES_SITE.flatMap((s) => FORMES_3D.map((f) => ({ nom: `forme-${f.id}-${s.id}`, taille: 128, props: { shape: f.id, color: f.couleur, rendu: s.id }, t: 1.2 }))),
  { nom: 'bento-clair', taille: 146, props: { ...BENTO_THEME, theme: 'light' }, t: 1.2 },
  { nom: 'bento-sombre', taille: 146, props: { ...BENTO_THEME, theme: 'dark' }, t: 1.2 },
  { nom: 'bento-acc', taille: 166, props: BENTO_ACC, t: 1.2 }
]

const suffixe = (theme: ThemeSite) => (theme === 'dark' ? 'sombre' : 'clair')
/** Adresse d'une image pre-rendue (une par theme). */
export const urlAffiche = (nom: string, theme: ThemeSite) => `/rendus/${nom}-${suffixe(theme)}.webp`

/** Icone d'un accessoire seul (la piece, sans corps), dans les couleurs du catalogue. */
export const PIECES = CATALOGUE.map((a) => ({ emplacement: a.emplacement, id: a.id }))
export const urlPiece = (e: Emplacement, id: string, theme: ThemeSite) => `/rendus/piece-${e}-${id}-${suffixe(theme)}.webp`
/** Cote de l'image d'une piece, en pixels. */
export const TAILLE_PIECE = 160

/**
 * Images PRE-RENDUES du site : chaque Mochi fige de la page (petits Mochi du hero, formes, cartes, icones des
 * accessoires) et l'affiche de chaque Mochi vivant (montree tout de suite, avant que la 3D ne soit prete) est une
 * image de la VRAIE 3D, rendue une fois par le vrai composant (`tools/rendus.html`, Chrome headless) dans
 * `public/rendus/`, en clair et en sombre. Au chargement, la page n'a donc ni Three.js a telecharger ni rendu 3D a
 * faire pour ces images, et jamais de repli 2D a l'ecran.
 *
 * Les props ecrites ici sont celles que la page passe au Mochi vivant : l'affiche et la 3D vivante sont la meme image.
 */
import { ACCESSORIES, type Slot, type RenderStyleId, type AccessorySelection } from 'mochi-world/catalogue'
import { SHAPES_3D } from './catalog'
import { STYLES_SITE } from './style'

export type ThemeSite = 'light' | 'dark'

/** Props d'un Mochi du site (sous-ensemble de celles de `<mochi-bot>`). */
export interface PropsMochi {
  shape: string
  color: string
  renderStyle?: RenderStyleId
  mood?: string
  yaw?: number
  accessories?: AccessorySelection
  outline?: boolean
  theme?: ThemeSite
}

export interface Poster {
  name: string
  /** cote affiche, en pixels CSS (l'image fait le double) */
  size: number
  props: PropsMochi
  /** instant fige : 0 pour l'affiche d'un Mochi vivant (sa premiere image), 1,2 pour une vignette */
  t: number
}

/* ------------------------------------------------------------------ les Mochi vivants (et leur affiche) */
export const MOODS_BOT: PropsMochi = { shape: 'squircle', color: '#00c7be', renderStyle: '3d', mood: 'idle' }
export const INTER_BOT: PropsMochi = { shape: 'star', color: '#ffd60a', renderStyle: '3d', mood: 'idle' }
export const STYLE_BOT = (renderStyle: RenderStyleId): PropsMochi => ({ shape: 'circle', color: '#2d5bff', renderStyle, mood: 'idle' })
/** Le Mochi de « Make it yours » tel qu'il arrive (casquette rouge du catalogue). */
export const CUSTOM_START: PropsMochi = {
  shape: 'star',
  color: '#21b0ff',
  renderStyle: '3d',
  mood: 'idle',
  outline: false,
  accessories: { head: { id: 'cap', c1: '#ff3b30', c2: '#ff3b30' } }
}

/* ------------------------------------------------------------------ les vignettes figees */
export const BENTO_THEME: PropsMochi = { shape: 'star', color: '#ffd60a', renderStyle: '3d' }
/**
 * Carte « accessoires » : une liste FIXE et soignee de variantes (corps, couleurs d'accessoires, une piece par
 * emplacement), une image pre-rendue par variante (`scroll-NN`). Chaque accessoire du catalogue y figure au moins
 * une fois (teste). Les variantes avec une piece du dos sont vus de trois quarts arriere (pas de lunettes alors).
 */
export interface Variant {
  shape: string
  body: string
  acc: AccessorySelection
  back?: boolean
}
const R = '#ff3b30', J = '#ffd60a', T = '#00c7be', M = '#2b3a67', P = '#ff4d94', C = '#f6f1e7', N = '#26222f', O = '#ffc933', V = '#8b3dff', B = '#2d5bff'
const c = (id: string, c1: string, c2?: string) => ({ id, c1, c2: c2 ?? c1 })
export const VARIANTS: Variant[] = [
  { shape: 'circle', body: '#ff3b30', acc: { head: c('cap', B), eyes: 'round' } },
  { shape: 'star', body: '#21b0ff', acc: { head: 'crown', eyes: 'heart', neck: 'bowtie' } },
  { shape: 'circle', body: '#ffd60a', acc: { head: 'top-hat', eyes: 'monocle', neck: c('scarf', T) } },
  { shape: 'cloud', body: '#00c46a', acc: { head: 'straw', eyes: 'sunglasses', neck: 'lei' } },
  { shape: 'flower', body: '#d81bbd', acc: { head: c('beret', R), eyes: 'square', neck: 'pearls' } },
  { shape: 'drop', body: '#ff9500', acc: { head: c('ribbon', J), eyes: 'round', neck: c('bowtie', R) } },
  { shape: 'squircle', body: '#2d5bff', acc: { head: c('headphones', V), eyes: 'star', neck: c('scarf', P) } },
  { shape: 'circle', body: '#b6e800', acc: { head: 'toque', eyes: c('round', R), neck: 'bowtie' } },
  { shape: 'star', body: '#ff4d94', acc: { head: c('antenna', N, J), eyes: c('square', N), neck: 'pearls' } },
  { shape: 'circle', body: '#00c7be', acc: { head: c('flower', V, J), eyes: c('sunglasses', M, M) } },
  { shape: 'circle', body: '#8b3dff', acc: { head: c('cap', J), eyes: c('heart', R), neck: c('scarf', C) } },
  { shape: 'cloud', body: '#6fd400', acc: { head: 'crown', eyes: c('square', T), neck: 'lei' } },
  { shape: 'squircle', body: '#e6194b', acc: { head: c('top-hat', C, O), eyes: 'monocle', neck: c('bowtie', O) } },
  { shape: 'flower', body: '#ff6a3d', acc: { head: c('beret', T), eyes: 'round', neck: c('scarf', R) } },
  { shape: 'drop', body: '#ff3b30', acc: { head: 'straw', eyes: 'monocle', neck: 'pearls' } },
  { shape: 'circle', body: '#21b0ff', acc: { head: c('headphones', M), eyes: 'sunglasses', neck: c('bowtie', V) } },
  { shape: 'circle', body: '#ffd60a', acc: { eyes: c('star', V), head: c('ribbon', P), neck: 'bowtie' } },
  { shape: 'circle', body: '#00c46a', acc: { eyes: c('heart', P), head: 'toque', neck: 'lei' } },
  { shape: 'circle', body: '#d81bbd', acc: { head: c('ribbon', V), eyes: 'star', neck: 'bowtie' } },
  { shape: 'star', body: '#ff9500', acc: { head: 'crown', eyes: 'sunglasses', neck: c('scarf', J) } },
  { shape: 'circle', body: '#2d5bff', acc: { back: c('backpack', R, M), head: c('cap', M) }, back: true },
  { shape: 'cloud', body: '#b6e800', acc: { back: c('cape', V), head: 'top-hat' }, back: true },
  { shape: 'circle', body: '#ff4d94', acc: { head: 'flower', eyes: c('star', O), neck: 'pearls' } },
  { shape: 'squircle', body: '#00c7be', acc: { head: 'antenna', eyes: 'round', neck: 'lei' } },
  { shape: 'flower', body: '#8b3dff', acc: { back: c('backpack', J, M), head: 'straw' }, back: true },
  { shape: 'circle', body: '#6fd400', acc: { back: c('cape', T), head: c('beret', N) }, back: true }
]
export const SCROLL = VARIANTS.map((v, i) => ({
  name: `defile-${String(i + 1).padStart(2, '0')}`,
  variant: v,
  props: { shape: v.shape, color: v.body, renderStyle: '3d', yaw: v.back ? 2.0 : 0.3, accessories: v.acc } as PropsMochi
}))
export const SIZE_SCROLL = 166

export const POSTERS: Poster[] = [
  { name: 'moods', size: 320, props: MOODS_BOT, t: 0 },
  { name: 'inter', size: 290, props: INTER_BOT, t: 0 },
  { name: 'custom', size: 320, props: CUSTOM_START, t: 0 },
  ...STYLES_SITE.map((s) => ({ name: `style-${s.id}`, size: 360, props: STYLE_BOT(s.id), t: 0 })),
  ...STYLES_SITE.map((s) => ({ name: `style-mini-${s.id}`, size: 180, props: { shape: 'circle', color: '#2d5bff', renderStyle: s.id, yaw: 0.35 }, t: 1.2 })),
  ...STYLES_SITE.flatMap((s) => SHAPES_3D.map((f) => ({ name: `forme-${f.id}-${s.id}`, size: 128, props: { shape: f.id, color: f.color, renderStyle: s.id }, t: 1.2 }))),
  { name: 'bento-light', size: 146, props: { ...BENTO_THEME, theme: 'light' }, t: 1.2 },
  { name: 'bento-dark', size: 146, props: { ...BENTO_THEME, theme: 'dark' }, t: 1.2 },
  ...SCROLL.map((d) => ({ name: d.name, size: SIZE_SCROLL, props: d.props, t: 1.2 }))
]

const suffix = (theme: ThemeSite) => (theme === 'dark' ? 'dark' : 'light')
/** Adresse d'une image pre-rendue (une par theme). */
export const urlPoster = (name: string, theme: ThemeSite) => `/rendus/${name}-${suffix(theme)}.webp`

/** Icone d'un accessoire seul (la piece, sans corps), dans les couleurs du catalogue. */
export const PIECES = ACCESSORIES.map((a) => ({ slot: a.slot, id: a.id }))
export const urlPiece = (e: Slot, id: string, theme: ThemeSite) => `/rendus/piece-${e}-${id}-${suffix(theme)}.webp`
/** Cote de l'image d'une piece, en pixels. */
export const SIZE_PIECE = 160

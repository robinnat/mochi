/**
 * PRE-RENDERED images of the site: each frozen Mochi of the page (small hero Mochis, shapes, cards, accessory icons)
 * and the poster of each live Mochi (shown at once, before the 3D is ready) is an image of the REAL 3D, rendered once
 * by the real component (`tools/renders.html`, headless Chrome) into `public/renders/`, in light and dark. On load,
 * the page has neither Three.js to download nor 3D rendering to do for these images, and never a 2D fallback on
 * screen.
 *
 * The props written here are those the page passes to the live Mochi: the poster and the live 3D are the same image.
 */
import { ACCESSORIES, type Slot, type RenderStyleId, type AccessorySelection } from 'mochis/catalog'
import { SHAPES_3D } from './catalog'
import { STYLES_SITE } from './style'

export type ThemeSite = 'light' | 'dark'

/** Props of a site Mochi (a subset of those of `<mochi-bot>`). */
export interface PropsMochi {
  shape: string
  color: string
  renderStyle?: RenderStyleId
  mood?: string
  yaw?: number
  accessories?: AccessorySelection
  theme?: ThemeSite
}

export interface Poster {
  name: string
  /** displayed side, in CSS pixels (the image is twice that) */
  size: number
  props: PropsMochi
  /** frozen instant: 0 for a live Mochi's poster (its first frame), 1.2 for a thumbnail */
  t: number
}

/*
 * ------------------------------------------------------------------ the live Mochis (and their poster)
 */
export const MOODS_BOT: PropsMochi = { shape: 'squircle', color: '#00c7be', renderStyle: '3d', mood: 'idle' }
export const INTER_BOT: PropsMochi = { shape: 'star', color: '#ffd60a', renderStyle: '3d', mood: 'idle' }
export const STYLE_BOT = (renderStyle: RenderStyleId): PropsMochi => ({ shape: 'circle', color: '#2d5bff', renderStyle, mood: 'idle' })
/** The "Make it yours" Mochi as it arrives (red catalog cap). */
export const CUSTOM_START: PropsMochi = {
  shape: 'star',
  color: '#21b0ff',
  renderStyle: '3d',
  mood: 'idle',
  accessories: { head: { id: 'cap', c1: '#ff3b30', c2: '#ff3b30' } }
}

/* ------------------------------------------------------------------ the frozen thumbnails */
export const BENTO_THEME: PropsMochi = { shape: 'star', color: '#ffd60a', renderStyle: '3d' }
/**
 * "Accessories" card: a FIXED, curated list of variants (body, accessory colors, one piece per slot), one
 * pre-rendered image per variant (`scroll-NN`). Each catalog accessory appears at least once (tested). Variants with
 * a back piece are seen from three quarters behind (no glasses then).
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
  name: `scroll-${String(i + 1).padStart(2, '0')}`,
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
  ...STYLES_SITE.flatMap((s) => SHAPES_3D.map((f) => ({ name: `shape-${f.id}-${s.id}`, size: 128, props: { shape: f.id, color: f.color, renderStyle: s.id }, t: 1.2 }))),
  { name: 'bento-light', size: 146, props: { ...BENTO_THEME, theme: 'light' }, t: 1.2 },
  { name: 'bento-dark', size: 146, props: { ...BENTO_THEME, theme: 'dark' }, t: 1.2 },
  ...SCROLL.map((d) => ({ name: d.name, size: SIZE_SCROLL, props: d.props, t: 1.2 }))
]

const suffix = (theme: ThemeSite) => (theme === 'dark' ? 'dark' : 'light')
/** Address of a pre-rendered image (one per theme). */
export const urlPoster = (name: string, theme: ThemeSite) => `/renders/${name}-${suffix(theme)}.webp`

/** Icon of an accessory alone (the piece, without a body), in the catalog colors. */
export const PIECES = ACCESSORIES.map((a) => ({ slot: a.slot, id: a.id }))
export const urlPiece = (e: Slot, id: string, theme: ThemeSite) => `/renders/piece-${e}-${id}-${suffix(theme)}.webp`
/** Side of a piece's image, in pixels. */
export const SIZE_PIECE = 160

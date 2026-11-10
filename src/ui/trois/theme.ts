/**
 * Theme de la 3D : « clair » (defaut, le rendu d'avant, yeux blancs) ou « sombre » (les yeux
 * deviennent NOIRS). Module pur (pas de Three.js, pas de DOM) : testable sous `node`.
 *
 * Seuls les yeux, le blanc de leur masque d'emission et, si besoin, la couleur du corps
 * changent. Les lumieres, les liseres, le reflet et l'ombre au sol du shader restent ceux du
 * mode clair.
 */

import type { Selection } from '@/bot/emplacements'

export type Theme = 'light' | 'dark'

export const THEMES: Theme[] = ['light', 'dark']
export const THEME_DEFAUT: Theme = 'light'
export const estTheme = (v: string): v is Theme => (THEMES as string[]).includes(v)

/** Le noir des yeux en mode sombre : l'encre du moteur (`encre` dans `skins.ts`). */
export const OEIL_SOMBRE = '#0a0a0c'

/** Le meme noir en RVB (palette du pixel art). */
export const OEIL_RGB: [number, number, number] = [10, 10, 12]

/** Couleur d'un oeil peint selon le theme : le papier (blanc) en clair, l'encre en sombre. */
export const couleurOeil = (theme: Theme, papier: string): string => (theme === 'dark' ? OEIL_SOMBRE : papier)

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminanceWcag(hex: string): number {
  const [r, g, b] = rgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Rapport de contraste WCAG entre deux couleurs (1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminanceWcag(a)
  const lb = luminanceWcag(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Contraste minimal oeil noir / corps (seuil WCAG 1.4.11 des composants graphiques). */
export const CONTRASTE_OEIL_MIN = 3

const vers = (c: [number, number, number], k: number): string => {
  const m = (x: number) => Math.round(x + (255 - x) * k)
  return '#' + c.map((x) => m(x).toString(16).padStart(2, '0')).join('')
}

/**
 * Corps pour un theme. En clair : tel quel. En sombre : si l'oeil noir contraste moins de
 * `min` (3 par defaut ; 0 = ne jamais eclaircir) avec le corps, le corps est eclairci vers le blanc, juste ce qu'il
 * faut (dichotomie) pour atteindre le seuil ; les autres couleurs ne bougent pas.
 */
export function corpsPourTheme(hex: string, theme: Theme, min = CONTRASTE_OEIL_MIN): string {
  if (theme !== 'dark' || min <= 1 || contraste(hex, OEIL_SOMBRE) >= min) return hex
  const c = rgb(hex)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2
    if (contraste(vers(c, mid), OEIL_SOMBRE) >= min) hi = mid
    else lo = mid
  }
  return vers(c, hi)
}

/**
 * Contour des yeux sur corps tres clair (jaune, citron vert). Un oeil blanc sur un corps dont le contraste avec
 * le blanc est inferieur a `CONTRASTE_CORPS_CLAIR` se perd : on le cerne d'un trait de la teinte du corps, foncee.
 * `null` pour les autres couleurs, qui ne changent pas. Seulement en clair (en sombre l'oeil est noir).
 */
export const CONTRASTE_CORPS_CLAIR = 1.6
export function contourOeil(corps: string, theme: Theme, papier = '#ffffff'): string | null {
  if (theme !== 'light' || contraste(corps, papier) >= CONTRASTE_CORPS_CLAIR) return null
  const a = rgb(corps)
  // une couleur claire mais presque neutre (creme, gris pale) garde son rendu d'origine : seul le franc, jaune ou citron, est cerne
  if (Math.max(...a) - Math.min(...a) < 128) return null
  const b = rgb('#1c1600')
  const k = 0.68
  return '#' + a.map((x, i) => Math.round(x + (b[i]! - x) * k).toString(16).padStart(2, '0')).join('')
}

/** Verre des lunettes de soleil en mode sombre : ardoise, pour se lire devant des yeux noirs (noir sur noir, plus rien ne se voit). */
export const VERRE_SOLEIL_SOMBRE = '#4e4a63'

/**
 * Selection d'accessoires pour le theme sombre. Seul conflit avec des yeux noirs : les lunettes de
 * soleil au verre noir, qui ne se distinguent plus des yeux. Leur verre passe a l'ardoise ; les
 * couleurs choisies a la main (c2) sont respectees, les autres accessoires ne changent pas.
 */
export function accessoiresSombres(sel: Selection): Selection {
  const y = sel.yeux
  if (!y) return sel
  const id = typeof y === 'string' ? y : y.id
  if (id !== 'soleil') return sel
  const c2 = typeof y === 'string' ? undefined : y.c2
  return { ...sel, yeux: { ...(typeof y === 'string' ? {} : y), id, c2: c2 ?? VERRE_SOLEIL_SOMBRE } }
}

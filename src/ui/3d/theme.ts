/**
 * Theme de la 3D : « clair » (defaut, le rendu d'avant, yeux blancs) ou « sombre » (les yeux
 * deviennent NOIRS). Module pur (pas de Three.js, pas de DOM) : testable sous `node`.
 *
 * Seuls les yeux, le blanc de leur masque d'emission et, si besoin, la couleur du corps
 * changent. Les lumieres, les liseres, le reflet et l'ombre au sol du shader restent ceux du
 * mode clair.
 */

import type { AccessorySelection } from '@/bot/slots'

export type Theme = 'light' | 'dark'

export const THEMES: Theme[] = ['light', 'dark']
export const DEFAULT_THEME: Theme = 'light'
export const isTheme = (v: string): v is Theme => (THEMES as string[]).includes(v)

/** Le noir des yeux en mode sombre : l'encre du moteur (`ink` dans `skins.ts`). */
export const DARK_EYE = '#0a0a0c'

/** Le meme noir en RVB (palette du pixel art). */
export const EYE_RGB: [number, number, number] = [10, 10, 12]

/** Couleur d'un oeil peint selon le theme : le papier (blanc) en clair, l'encre en sombre. */
export const eyeColor = (theme: Theme, paper: string): string => (theme === 'dark' ? DARK_EYE : paper)

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
export function contrast(a: string, b: string): number {
  const la = luminanceWcag(a)
  const lb = luminanceWcag(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Contraste minimal oeil noir / corps (seuil WCAG 1.4.11 des composants graphiques). */
export const MIN_EYE_CONTRAST = 3

const to = (c: [number, number, number], k: number): string => {
  const m = (x: number) => Math.round(x + (255 - x) * k)
  return '#' + c.map((x) => m(x).toString(16).padStart(2, '0')).join('')
}

/**
 * Corps pour un theme. En clair : tel quel. En sombre : si l'oeil noir contraste moins de
 * `min` (3 par defaut ; 0 = ne jamais eclaircir) avec le corps, le corps est eclairci vers le blanc, juste ce qu'il
 * faut (dichotomie) pour atteindre le seuil ; les autres couleurs ne bougent pas.
 */
export function bodyForTheme(hex: string, theme: Theme, min = MIN_EYE_CONTRAST): string {
  if (theme !== 'dark' || min <= 1 || contrast(hex, DARK_EYE) >= min) return hex
  const c = rgb(hex)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2
    if (contrast(to(c, mid), DARK_EYE) >= min) hi = mid
    else lo = mid
  }
  return to(c, hi)
}

/** Verre des lunettes de soleil en mode sombre : ardoise, pour se lire devant des yeux noirs (noir sur noir, plus rien ne se voit). */
export const LENS_SUN_DARK = '#4e4a63'

/**
 * Selection d'accessoires pour le theme sombre. Seul conflit avec des yeux noirs : les lunettes de
 * soleil au verre noir, qui ne se distinguent plus des yeux. Leur verre passe a l'ardoise ; les
 * couleurs choisies a la main (c2) sont respectees, les autres accessoires ne changent pas.
 */
export function accessoriesDark(sel: AccessorySelection): AccessorySelection {
  const y = sel.eyes
  if (!y) return sel
  const id = typeof y === 'string' ? y : y.id
  if (id !== 'sunglasses') return sel
  const c2 = typeof y === 'string' ? undefined : y.c2
  return { ...sel, eyes: { ...(typeof y === 'string' ? {} : y), id, c2: c2 ?? LENS_SUN_DARK } }
}

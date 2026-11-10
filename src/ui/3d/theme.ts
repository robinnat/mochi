/**
 * 3D theme: "light" (default, white eyes) or "dark" (the eyes turn BLACK). Pure module (no Three.js, no DOM):
 * testable under Node.
 *
 * Only the eyes, the white of their emission mask and, if needed, the body color change. The shader's lights, rims,
 * highlight and ground shadow stay those of the light mode.
 */

import type { AccessorySelection } from '@/bot/slots'

export type Theme = 'light' | 'dark'

export const THEMES: Theme[] = ['light', 'dark']
export const DEFAULT_THEME: Theme = 'light'
export const isTheme = (v: string): v is Theme => (THEMES as string[]).includes(v)

/** The black of the eyes in dark mode: the engine's ink (`ink` in `skins.ts`). */
export const DARK_EYE = '#0a0a0c'

/** The same black in RGB (pixel art palette). */
export const EYE_RGB: [number, number, number] = [10, 10, 12]

/** Color of a painted eye by theme: the paper (white) in light, the ink in dark. */
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

/** WCAG contrast ratio between two colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const la = luminanceWcag(a)
  const lb = luminanceWcag(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Minimum contrast black eye / body (WCAG 1.4.11 threshold for graphical objects). */
export const MIN_EYE_CONTRAST = 3

const to = (c: [number, number, number], k: number): string => {
  const m = (x: number) => Math.round(x + (255 - x) * k)
  return '#' + c.map((x) => m(x).toString(16).padStart(2, '0')).join('')
}

/**
 * Body for a theme. In light: as is. In dark: if the black eye contrasts less than `min` (3 by default; 0 = never
 * lighten) with the body, the body is lightened towards white, just enough (bisection) to reach the threshold; the
 * other colors do not move.
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

/**
 * Lens of the sunglasses in dark mode: slate, to read in front of black eyes (black on black, nothing shows any
 * more).
 */
export const LENS_SUN_DARK = '#4e4a63'

/**
 * Accessory selection for the dark theme. The only conflict with black eyes: sunglasses with a black lens, which can
 * no longer be told from the eyes. Their lens turns slate; colors chosen by hand (c2) are respected, other
 * accessories do not change.
 */
export function accessoriesDark(sel: AccessorySelection): AccessorySelection {
  const y = sel.eyes
  if (!y) return sel
  const id = typeof y === 'string' ? y : y.id
  if (id !== 'sunglasses') return sel
  const c2 = typeof y === 'string' ? undefined : y.c2
  return { ...sel, eyes: { ...(typeof y === 'string' ? {} : y), id, c2: c2 ?? LENS_SUN_DARK } }
}

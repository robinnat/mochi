/**
 * Material of the real 3D: "realistic" (matte material, light gradients, soft shadows) or one of the "flat 3D"
 * variants: a REAL volume (same engine: `volume.ts`, `scene3d.ts`), but rendered with flat tones.
 *
 *   toon          2 to 3 clean tones (cel shading), no highlight, flat ground shadow
 *   toon-outline  like toon, with a thin dark outline (inverted shell)
 *   lowpoly       coarse geometry, facets (flatShading), each facet flat
 *   flat          only two tones: the flat color and ONE shadow tint
 *
 * This module is PURE (no Three.js dependency): it sets tones, thresholds and finesse, which `scene3d.ts` turns into
 * materials. So it can be imported statically (component types, tests under Node) without pulling in Three.js.
 *
 * The default is `soft` with `strong` softness (choice of 03/11/2026, after flat was judged a big block of shadow);
 * `flat` stays in the code, out of the interface; `realistic` stays available internally only. There is no public
 * outline option any more (removed on 11/11/2026); `toon-outline` stays an internal material, `toon` with a shell.
 *
 * `toon` and `lowpoly` stay in the code (they cost nothing: one table row each) but are no longer offered in the
 * interface or the lab.
 */

import { DEFAULT_FINESSE, type Finesse } from './volume'

export type Material = 'realistic' | 'toon' | 'toon-outline' | 'lowpoly' | 'flat' | 'soft' | 'pixel'

export const MATERIALS: Material[] = ['realistic', 'toon', 'toon-outline', 'lowpoly', 'flat', 'soft', 'pixel']

/**
 * Setting of the `soft` material (smooth, matte shading): `light` or `strong`. Only concerns `soft`; ignored by the
 * other materials.
 */
export type Softness = 'light' | 'strong'
export const SOFTNESSES: Softness[] = ['light', 'strong']
export const DEFAULT_SOFTNESS: Softness = 'strong'
export const isSoftness = (v: string): v is Softness => (SOFTNESSES as string[]).includes(v)

export const DEFAULT_MATERIAL: Material = 'soft'

export const isMaterial = (v: string): v is Material => (MATERIALS as string[]).includes(v)

/** The flat variants: all but realistic. */
export const isFlat = (r: Material) => r !== 'realistic'

export interface SettingFlat {
  /**
   * Thresholds on dot(normal, light), increasing: below the first, tone 0 (shadow); between two thresholds, the next
   * tone; above the last, the lightest.
   */
  thresholds: number[]
  /**
   * One tone per step (thresholds.length + 1), as a multiple of the flat color: 1 = the flat color as is (the tone
   * covering most of the surface), less = shadow.
   */
  tones: number[]
  /** facets: each triangle carries its own normal (flatShading) */
  facets: boolean
  /** dark outline around the silhouette (inverted shell) */
  outline: boolean
  /**
   * the shadow boundary waves instead of being a straight line: the normal is slightly disturbed by a low frequency
   * noise anchored on the body (`scene3d.ts`)
   */
  organic: boolean
  /** mesh finesse; `null` = the realistic one */
  finesse: Finesse | null
  /** keeps 1 outline point out of `reduction` (lowpoly: a coarser outline) */
  reduction: number
  /**
   * SMOOTH shading (`soft` material): no steps, the ramp is a continuous curve of dot(normal, light) between
   * `smooth.from` (shadow tone) and `smooth.a` (base color), read with linear filtering. `tones` = [shadow, 1].
   * Absent: steps (the other materials).
   */
  smooth?: { from: number; a: number }
}

/**
 * `soft`: the flat color dominates (tone 1 over the whole top left and the center), the shadow is only a veil that
 * slowly settles towards the bottom right. Tones in linear light (Three): 0.70 linear = about 16 % darker on screen
 * (sRGB), 0.56 = about 24 %.
 */
const SOFT: Record<Softness, SettingFlat> = {
  light: {
    thresholds: [],
    tones: [0.7, 1],
    facets: false,
    outline: false,
    organic: false,
    finesse: null,
    reduction: 1,
    smooth: { from: -0.75, a: 0.7 }
  },
  strong: {
    thresholds: [],
    tones: [0.56, 1],
    facets: false,
    outline: false,
    organic: false,
    finesse: null,
    reduction: 1,
    smooth: { from: -0.75, a: 0.7 }
  }
}

/** The settings: a single table, tuned by eye in `#shapes3d`. */
const FLAT: Record<Exclude<Material, 'realistic' | 'soft'>, SettingFlat> = {
  toon: {
    thresholds: [0.2, 0.86],
    tones: [0.7, 1, 1.12],
    facets: false,
    outline: false,
    organic: false,
    finesse: null,
    reduction: 1
  },
  'toon-outline': {
    thresholds: [0.2, 0.86],
    tones: [0.7, 1, 1.12],
    facets: false,
    outline: true,
    organic: false,
    finesse: null,
    reduction: 1
  },
  // pixel: three clean tones like `toon`, then reduced to a short palette (`pixel3d.ts`)
  pixel: {
    thresholds: [0.2, 0.86],
    tones: [0.7, 1, 1.12],
    facets: false,
    outline: false,
    organic: false,
    finesse: null,
    reduction: 1
  },
  lowpoly: {
    thresholds: [0.05, 0.5, 0.82],
    tones: [0.68, 0.86, 1, 1.12],
    facets: true,
    outline: false,
    organic: false,
    finesse: { rings: 3, smoothing: 2 },
    reduction: 2
  },
  flat: {
    thresholds: [0.3],
    tones: [0.78, 1],
    facets: false,
    outline: false,
    organic: true,
    finesse: null,
    reduction: 1
  }
}

/** Setting of a flat variant, `null` for realistic. `softness` only applies to `soft`. */
export function settingFlat(r: Material, softness: Softness = DEFAULT_SOFTNESS): SettingFlat | null {
  if (r === 'realistic') return null
  return r === 'soft' ? SOFT[softness] : FLAT[r]
}

/** Mesh in use: `full` (realistic finesse) or `coarse` (lowpoly). */
export const meshOf = (r: Material): 'full' | 'grossier' =>
  settingFlat(r)?.finesse ? 'grossier' : 'full'

export const finesseOf = (r: Material): Finesse => settingFlat(r)?.finesse ?? DEFAULT_FINESSE

/**
 * Lighting of a flat variant. An ambient light `A` and a directional `D` give each step `i` the tone `A + D * g[i]`:
 * A = the darkest tone and D = the gap to the lightest, `g` is the gradientMap ramp (0 to 1). A body's shadow on the
 * ground falls back on A: it is the shadow tone, the same as the body's. Intensities are multiples of pi (Three's
 * physical light convention).
 */
export function lightingFlat(p: SettingFlat) {
  const neck = Math.min(...p.tones)
  const top = Math.max(...p.tones)
  const gap = Math.max(1e-6, top - neck)
  return {
    ambient: neck * Math.PI,
    directe: gap * Math.PI,
    ramp: p.tones.map((t) => (t - neck) / gap)
  }
}

/**
 * Sampled ramp (values 0..255) for a gradientMap of `n` texels: texel `i` matches dot = 2 * (i + 0.5) / n - 1.
 */
export function gradientMap(p: SettingFlat, n = p.smooth ? 128 : 32): Uint8Array {
  const { ramp } = lightingFlat(p)
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const dot = (2 * (i + 0.5)) / n - 1
    if (p.smooth) {
      const t = Math.min(1, Math.max(0, (dot - p.smooth.from) / (p.smooth.a - p.smooth.from)))
      out[i] = Math.round(t * t * (3 - 2 * t) * 255)
      continue
    }
    let step = 0
    for (const s of p.thresholds) if (dot >= s) step++
    out[i] = Math.round(ramp[step]! * 255)
  }
  return out
}

/**
 * Outline color: the body hue, much darker and a little more saturated, computed in HSL. A mix with black or violet
 * turned brown on amber; here the hue stays the body's (amber -> dark amber, violet -> dark violet).
 */
export function colorOutline(hex: string): string {
  const v = parseInt(hex.slice(1), 16)
  const r = ((v >> 16) & 255) / 255
  const g = ((v >> 8) & 255) / 255
  const b = (v & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  if (d > 1e-9) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const s0 = d < 1e-9 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const s = Math.min(1, s0 * 1.1)
  const l2 = Math.min(0.26, l * 0.4)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a2 = s * Math.min(l2, 1 - l2)
    const c = l2 - a2 * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Outline thickness, in PIXELS, for a Mochi `diameterPx` pixels wide. It gets lighter at small sizes (2 % of the
 * diameter) but stays visible (floor), and does not grow forever in close-up (ceiling).
 */
export const outlineWidthPx = (diameterPx: number) => Math.min(3.4, Math.max(1.3, diameterPx * 0.02))

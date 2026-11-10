/**
 * Matiere de la vraie 3D : « realiste » (l'existant : matiere mate pastel, degrades de
 * lumiere, ombres douces) ou une des quatre variantes « 3D flat » : un VRAI volume (meme
 * moteur : `volume.ts`, `scene3d.ts`, `iso.ts`), mais rendu a aplats, sans degrade.
 *
 *   toon          2 a 3 tons nets (cel shading), sans reflet, ombre au sol en aplat
 *   toon-contour  comme toon, avec un contour fin et fonce (coque inversee)
 *   lowpoly       geometrie grossiere, facettes (flatShading), chaque facette en aplat
 *   aplat         deux tons seulement : la couleur du flat 2D et UNE teinte d'ombre
 *
 * Ce module est PUR (aucune dependance a Three.js) : il fixe les tons, les seuils et la
 * finesse, que `scene3d.ts` traduit en materiaux. Il peut donc etre importe statiquement
 * (types du composant, tests sous `node`) sans apporter Three.js.
 *
 * Le defaut est `soft` en douceur `strong` (choix du 03/11/2026, apres l'aplat jugé a gros bloc d'ombre) ; `flat` reste dans le code, hors interface ; `realistic` reste disponible en
 * interne seulement. Le contour cartoon est une OPTION (`outline`), applicable a `flat`
 * comme a `toon` : `toon-outline` n'est que `toon` avec contour.
 *
 * `toon` et `lowpoly` restent dans le code (ils ne gênent pas : une ligne de table chacun)
 * mais ne sont plus proposes dans l'interface ni dans le labo.
 */

import { DEFAULT_FINESSE, type Finesse } from './volume'

export type Material = 'realistic' | 'toon' | 'toon-outline' | 'lowpoly' | 'flat' | 'soft' | 'pixel'

export const MATERIALS: Material[] = ['realistic', 'toon', 'toon-outline', 'lowpoly', 'flat', 'soft', 'pixel']

/**
 * Reglage de la matiere `soft` (ombrage lisse et mat) : `light` ou `strong`. Ne concerne
 * que `soft` ; ignore par les autres matieres.
 */
export type Softness = 'light' | 'strong'
export const SOFTNESSES: Softness[] = ['light', 'strong']
export const DEFAULT_SOFTNESS: Softness = 'strong'
export const isSoftness = (v: string): v is Softness => (SOFTNESSES as string[]).includes(v)

export const DEFAULT_MATERIAL: Material = 'soft'

export const isMaterial = (v: string): v is Material => (MATERIALS as string[]).includes(v)

/** Les variantes plates : toutes sauf le realiste. */
export const isFlat = (r: Material) => r !== 'realistic'

export interface SettingFlat {
  /**
   * Seuils sur dot(normale, lumiere), croissants : sous le premier, le ton 0 (ombre) ;
   * entre deux seuils, le ton suivant ; au-dessus du dernier, le plus clair.
   */
  thresholds: number[]
  /**
   * Un ton par palier (seuils.length + 1), en multiple de la couleur du flat 2D : 1 = la
   * couleur du flat telle quelle (le ton qui occupe le gros de la surface), moins = ombre.
   */
  tones: number[]
  /** facettes : chaque triangle porte sa propre normale (flatShading) */
  facets: boolean
  /** contour fonce autour de la silhouette (coque inversee) */
  outline: boolean
  /**
   * la limite d'ombre ondule au lieu d'etre une ligne droite : la normale est legerement
   * perturbee par un bruit de basse frequence ancre sur le corps (`scene3d.ts`)
   */
  organic: boolean
  /** finesse du maillage ; `null` = celle du realiste */
  finesse: Finesse | null
  /** garde 1 point du contour sur `reduction` (lowpoly : un contour plus grossier) */
  reduction: number
  /**
   * Ombrage LISSE (matiere `soft`) : pas de palier, la rampe est une courbe continue de
   * dot(normale, lumiere) entre `smooth.from` (ton d'ombre) et `smooth.a` (couleur de base),
   * lue en filtrage lineaire. `tones` = [ombre, 1]. Absent : paliers (les autres matieres).
   */
  smooth?: { from: number; a: number }
}

/**
 * `soft` : la couleur du flat domine (ton 1 sur tout le haut gauche et le centre), l'ombre
 * n'est qu'un voile qui s'installe lentement vers le bas droite. Tons en lineaire (lumiere
 * Three) : 0,70 lineaire = environ 16 % plus sombre a l'ecran (sRGB), 0,56 = environ 24 %.
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

/** Les reglages : une seule table, a regler a l'oeil dans `#shapes3d`. */
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
  // pixel : trois tons nets comme `toon`, puis ramene a une palette courte (`pixel3d.ts`)
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

/** Reglage d'une variante plate, `null` pour le realiste. `softness` ne sert qu'a `soft`. */
export function settingFlat(r: Material, softness: Softness = DEFAULT_SOFTNESS): SettingFlat | null {
  if (r === 'realistic') return null
  return r === 'soft' ? SOFT[softness] : FLAT[r]
}

/** Maillage utilise : `full` (finesse du realiste) ou `grossier` (lowpoly). */
export const meshOf = (r: Material): 'full' | 'grossier' =>
  settingFlat(r)?.finesse ? 'grossier' : 'full'

export const finesseOf = (r: Material): Finesse => settingFlat(r)?.finesse ?? DEFAULT_FINESSE

/**
 * Eclairage d'une variante plate. Une lumiere ambiante `A` et une directionnelle `D`
 * donnent a chaque palier `i` le ton `A + D * g[i]` : on prend A = ton le plus sombre et
 * D = l'ecart au plus clair, `g` est la rampe du gradientMap (0 a 1). L'ombre portee d'un
 * corps sur le sol retombe sur A : c'est le ton d'ombre, le meme que celui du corps.
 * Les intensites sont en multiples de pi (convention des lumieres physiques de Three).
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
 * Rampe echantillonnee (valeurs 0..255) pour un gradientMap de `n` texels : le texel `i`
 * correspond a dot = 2 * (i + 0,5) / n - 1.
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
 * Couleur du contour : la teinte du corps, tres assombrie et un peu plus saturee, calculee en
 * HSL. Un melange avec un noir ou un violet virait au brun sur l'ambre ; ici la teinte
 * reste celle du corps (ambre -> ambre fonce, violet -> violet fonce).
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
 * Epaisseur du contour, en PIXELS, pour un mochi dont le diametre fait `diameterPx` pixels.
 * Elle s'allege en petite taille (2 % du diametre) mais reste visible (plancher), et ne
 * s'epaissit pas sans fin en gros plan (plafond).
 */
export const outlineWidthPx = (diameterPx: number) => Math.min(3.4, Math.max(1.3, diameterPx * 0.02))

/** Facteur d'epaisseur du contour : 1 = l'epaisseur de base (`outlineWidthPx`), borne pour rester propre. */
export const DEFAULT_OUTLINE_WIDTH = 1
export const MIN_OUTLINE_WIDTH = 0.4
export const MAX_OUTLINE_WIDTH = 4

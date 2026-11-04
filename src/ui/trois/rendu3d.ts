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
 * Le defaut est `doux` en douceur `marque` (choix du 03/11/2026, apres l'aplat jugé a gros bloc d'ombre) ; `aplat` reste dans le code, hors interface ; `realiste` reste disponible en
 * interne seulement. Le contour cartoon est une OPTION (`contour`), applicable a `aplat`
 * comme a `toon` : `toon-contour` n'est que `toon` avec contour.
 *
 * `toon` et `lowpoly` restent dans le code (ils ne gênent pas : une ligne de table chacun)
 * mais ne sont plus proposes dans l'interface ni dans le labo.
 */

import { FINESSE_DEFAUT, type Finesse } from './volume'

export type Rendu3d = 'realiste' | 'toon' | 'toon-contour' | 'lowpoly' | 'aplat' | 'doux' | 'pixel'

export const RENDUS_3D: Rendu3d[] = ['realiste', 'toon', 'toon-contour', 'lowpoly', 'aplat', 'doux', 'pixel']

/**
 * Reglage de la matiere `doux` (ombrage lisse et mat) : `leger` ou `marque`. Ne concerne
 * que `doux` ; ignore par les autres matieres.
 */
export type Douceur = 'leger' | 'marque'
export const DOUCEURS: Douceur[] = ['leger', 'marque']
export const DOUCEUR_DEFAUT: Douceur = 'marque'
export const estDouceur = (v: string): v is Douceur => (DOUCEURS as string[]).includes(v)

export const RENDU_3D_DEFAUT: Rendu3d = 'doux'

export const estRendu3d = (v: string): v is Rendu3d => (RENDUS_3D as string[]).includes(v)

/** Les variantes plates : toutes sauf le realiste. */
export const estPlat = (r: Rendu3d) => r !== 'realiste'

export interface ReglagePlat {
  /**
   * Seuils sur dot(normale, lumiere), croissants : sous le premier, le ton 0 (ombre) ;
   * entre deux seuils, le ton suivant ; au-dessus du dernier, le plus clair.
   */
  seuils: number[]
  /**
   * Un ton par palier (seuils.length + 1), en multiple de la couleur du flat 2D : 1 = la
   * couleur du flat telle quelle (le ton qui occupe le gros de la surface), moins = ombre.
   */
  tons: number[]
  /** facettes : chaque triangle porte sa propre normale (flatShading) */
  facettes: boolean
  /** contour fonce autour de la silhouette (coque inversee) */
  contour: boolean
  /**
   * la limite d'ombre ondule au lieu d'etre une ligne droite : la normale est legerement
   * perturbee par un bruit de basse frequence ancre sur le corps (`scene3d.ts`)
   */
  organique: boolean
  /** finesse du maillage ; `null` = celle du realiste */
  finesse: Finesse | null
  /** garde 1 point du contour sur `reduction` (lowpoly : un contour plus grossier) */
  reduction: number
  /**
   * Ombrage LISSE (matiere `doux`) : pas de palier, la rampe est une courbe continue de
   * dot(normale, lumiere) entre `lisse.de` (ton d'ombre) et `lisse.a` (couleur de base),
   * lue en filtrage lineaire. `tons` = [ombre, 1]. Absent : paliers (les autres matieres).
   */
  lisse?: { de: number; a: number }
}

/**
 * `doux` : la couleur du flat domine (ton 1 sur tout le haut gauche et le centre), l'ombre
 * n'est qu'un voile qui s'installe lentement vers le bas droite. Tons en lineaire (lumiere
 * Three) : 0,70 lineaire = environ 16 % plus sombre a l'ecran (sRGB), 0,56 = environ 24 %.
 */
const DOUX: Record<Douceur, ReglagePlat> = {
  leger: {
    seuils: [],
    tons: [0.7, 1],
    facettes: false,
    contour: false,
    organique: false,
    finesse: null,
    reduction: 1,
    lisse: { de: -0.75, a: 0.7 }
  },
  marque: {
    seuils: [],
    tons: [0.56, 1],
    facettes: false,
    contour: false,
    organique: false,
    finesse: null,
    reduction: 1,
    lisse: { de: -0.75, a: 0.7 }
  }
}

/** Les reglages : une seule table, a regler a l'oeil dans `#formes3d`. */
const PLATS: Record<Exclude<Rendu3d, 'realiste' | 'doux'>, ReglagePlat> = {
  toon: {
    seuils: [0.2, 0.86],
    tons: [0.7, 1, 1.12],
    facettes: false,
    contour: false,
    organique: false,
    finesse: null,
    reduction: 1
  },
  'toon-contour': {
    seuils: [0.2, 0.86],
    tons: [0.7, 1, 1.12],
    facettes: false,
    contour: true,
    organique: false,
    finesse: null,
    reduction: 1
  },
  // pixel : trois tons nets comme `toon`, puis ramene a une palette courte (`pixel3d.ts`)
  pixel: {
    seuils: [0.2, 0.86],
    tons: [0.7, 1, 1.12],
    facettes: false,
    contour: false,
    organique: false,
    finesse: null,
    reduction: 1
  },
  lowpoly: {
    seuils: [0.05, 0.5, 0.82],
    tons: [0.68, 0.86, 1, 1.12],
    facettes: true,
    contour: false,
    organique: false,
    finesse: { anneaux: 3, lissage: 2 },
    reduction: 2
  },
  aplat: {
    seuils: [0.3],
    tons: [0.78, 1],
    facettes: false,
    contour: false,
    organique: true,
    finesse: null,
    reduction: 1
  }
}

/** Reglage d'une variante plate, `null` pour le realiste. `douceur` ne sert qu'a `doux`. */
export function reglagePlat(r: Rendu3d, douceur: Douceur = DOUCEUR_DEFAUT): ReglagePlat | null {
  if (r === 'realiste') return null
  return r === 'doux' ? DOUX[douceur] : PLATS[r]
}

/** Maillage utilise : `plein` (finesse du realiste) ou `grossier` (lowpoly). */
export const maillageDe = (r: Rendu3d): 'plein' | 'grossier' =>
  reglagePlat(r)?.finesse ? 'grossier' : 'plein'

export const finesseDe = (r: Rendu3d): Finesse => reglagePlat(r)?.finesse ?? FINESSE_DEFAUT

/**
 * Eclairage d'une variante plate. Une lumiere ambiante `A` et une directionnelle `D`
 * donnent a chaque palier `i` le ton `A + D * g[i]` : on prend A = ton le plus sombre et
 * D = l'ecart au plus clair, `g` est la rampe du gradientMap (0 a 1). L'ombre portee d'un
 * corps sur le sol retombe sur A : c'est le ton d'ombre, le meme que celui du corps.
 * Les intensites sont en multiples de pi (convention des lumieres physiques de Three).
 */
export function eclairagePlat(p: ReglagePlat) {
  const bas = Math.min(...p.tons)
  const haut = Math.max(...p.tons)
  const ecart = Math.max(1e-6, haut - bas)
  return {
    ambiante: bas * Math.PI,
    directe: ecart * Math.PI,
    rampe: p.tons.map((t) => (t - bas) / ecart)
  }
}

/**
 * Rampe echantillonnee (valeurs 0..255) pour un gradientMap de `n` texels : le texel `i`
 * correspond a dot = 2 * (i + 0,5) / n - 1.
 */
export function gradientMap(p: ReglagePlat, n = p.lisse ? 128 : 32): Uint8Array {
  const { rampe } = eclairagePlat(p)
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const dot = (2 * (i + 0.5)) / n - 1
    if (p.lisse) {
      const t = Math.min(1, Math.max(0, (dot - p.lisse.de) / (p.lisse.a - p.lisse.de)))
      out[i] = Math.round(t * t * (3 - 2 * t) * 255)
      continue
    }
    let palier = 0
    for (const s of p.seuils) if (dot >= s) palier++
    out[i] = Math.round(rampe[palier]! * 255)
  }
  return out
}

/**
 * Couleur du contour : la teinte du corps, tres assombrie et un peu plus saturee, calculee en
 * HSL. Un melange avec un noir ou un violet virait au brun sur l'ambre ; ici la teinte
 * reste celle du corps (ambre -> ambre fonce, violet -> violet fonce).
 */
export function couleurContour(hex: string): string {
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
 * Epaisseur du contour, en PIXELS, pour un mochi dont le diametre fait `diametrePx` pixels.
 * Elle s'allege en petite taille (2 % du diametre) mais reste visible (plancher), et ne
 * s'epaissit pas sans fin en gros plan (plafond).
 */
export const epaisseurContourPx = (diametrePx: number) => Math.min(3.4, Math.max(1.3, diametrePx * 0.02))

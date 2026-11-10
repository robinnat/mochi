/**
 * Accessoires PORTES : lunettes rondes, lunettes de soleil, mini haut-de-forme, chapeau de
 * paille, bonnet, noeud, couronne et casque audio, en 3D. Ils sont poses SUR le corps et le
 * suivent : ils sont recalcules a chaque image du moteur, depuis le contour (`bodyPath`) et les
 * yeux de cette image. Un saut, un ecrasement, un changement de forme ou d'humeur les deplace
 * donc avec le corps, sans reglage a part.
 *
 * Meme principe que les gestes : un reglage choisi, pas une mesure, et une couche facultative.
 * Rien ne change dans `engine.sample(t)`.
 *
 * Les COUPES (`Partie`) sont donnees en unites du moteur (rayon 100, y vers le bas) ;
 * `trois/porte3d.ts` en fait des volumes (cylindres, calottes, tores) fixes au maillage, donc ils
 * tournent avec lui. Les lunettes, elles, sont PEINTES sur le visage 3D, a la place exacte des
 * yeux 3D (qui sont toujours de face).
 *
 * Style commun : aplats pastel mats, meme trait fonce de la meme teinte, aucun reflet franc.
 *
 * Coherence avec l'humeur : les verres sont transparents (lunettes) ou teintes a 55 % (soleil),
 * jamais opaques, donc un clin d'oeil ou des yeux ecarquilles se lisent a travers. Quand le
 * visage disparait (`thinking`, `sleep`), les lunettes disparaissent avec lui ; le chapeau, lui,
 * reste sur le corps, aussi petit soit-il.
 */
import { contourDuCorps } from '@/ui/trois/volume'
import type { BotFrame } from './engine'
import { mixHex } from './skins'

export type PorteId = 'lunettes' | 'soleil' | 'haut-de-forme' | 'paille' | 'bonnet' | 'noeud' | 'couronne' | 'casque'

export const PORTE_IDS: PorteId[] = ['lunettes', 'soleil', 'haut-de-forme', 'paille', 'bonnet', 'noeud', 'couronne', 'casque']

/** Teintes pastel des accessoires portes (aplat) ; le trait est la meme teinte, foncee. */
export const TEINTES_PORTES: Record<PorteId, { fond: string; accent: string }> = {
  lunettes: { fond: '#ffffff', accent: '#4b5368' },
  soleil: { fond: '#2c3040', accent: '#2c3040' },
  'haut-de-forme': { fond: '#4a4f66', accent: '#e9a0b4' },
  paille: { fond: '#f1d79a', accent: '#e58f8f' },
  bonnet: { fond: '#8fd3c4', accent: '#f4a8b8' },
  noeud: { fond: '#f49ab0', accent: '#f49ab0' },
  couronne: { fond: '#f4cf6a', accent: '#e58f8f' },
  casque: { fond: '#f2eef8', accent: '#8d7be0' }
}

export const trait = (hex: string) => mixHex(hex, '#000000', 0.42)

export interface Geo {
  /** axe et sommet du corps */
  cx: number
  haut: number
  bas: number
  /** ligne ou le chapeau s'appuie, et sa largeur de corps (chord) */
  by: number
  rb: number
  /** hauteur de la calotte entre la ligne d'appui et le sommet */
  cap: number
  /** hauteur et demi-largeur du corps au milieu (oreilles) */
  mid: number
  hw: number
  /** hauteur (y) du dessus du corps a l'abscisse x ; le bas du corps si la verticale le manque */
  hautA: (x: number) => number
}

/** Largeur du corps a la hauteur `y` : [xmin, xmax] ou null si la ligne ne coupe pas le corps. */
function corde(pts: Array<{ x: number; y: number }>, y: number): [number, number] | null {
  let a = Infinity
  let b = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    if (p.y > y !== q.y > y) {
      const x = p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x)
      a = Math.min(a, x)
      b = Math.max(b, x)
    }
  }
  return a === Infinity ? null : [a, b]
}

/** Mesures du corps de CETTE image ; null si le corps n'est pas la (fondu, vide). */
export function mesuresPorte(frame: BotFrame): Geo | null {
  if (frame.bodyPath.length < 10 || frame.bodyAlpha < 0.05) return null
  const pts = contourDuCorps(frame.bodyPath, 2)
  if (pts.length < 8) return null
  let y0 = Infinity
  let y1 = -Infinity
  let x0 = Infinity
  let x1 = -Infinity
  for (const p of pts) {
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
  }
  const H = y1 - y0
  if (H < 4) return null
  const by = y0 + 0.17 * H
  const c = corde(pts, by)
  const m = corde(pts, y0 + 0.5 * H)
  if (!c || !m) return null
  return {
    cx: (c[0] + c[1]) / 2,
    haut: y0,
    bas: y1,
    by,
    // plancher : au sommet d'une pointe (etoile) la corde est etroite, le chapeau reste lisible
    rb: Math.max(2, (c[1] - c[0]) / 2, 0.17 * (x1 - x0)),
    cap: by - y0,
    mid: y0 + 0.5 * H,
    hw: (m[1] - m[0]) / 2,
    hautA: (x) => {
      let best = Infinity
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!
        const q = pts[(i + 1) % pts.length]!
        if (p.x > x !== q.x > x) best = Math.min(best, p.y + ((x - p.x) / (q.x - p.x)) * (q.y - p.y))
      }
      return best === Infinity ? y0 : best
    }
  }
}

/* ------------------------------------------------------------ parties (chapeaux) */

export type Partie =
  | { t: 'cyl'; x: number; yb: number; yh: number; rb: number; rh: number; fond: string }
  | { t: 'calotte'; x: number; y: number; r: number; h: number; fond: string }
  | { t: 'bord'; x: number; y: number; r: number; ry: number; fond: string }
  | { t: 'boule'; x: number; y: number; r: number; fond: string }
  | { t: 'pointes'; x: number; y: number; r: number; h: number; n: number; fond: string }
  | { t: 'noeud'; x: number; y: number; s: number; fond: string }
  | { t: 'arc'; x: number; y: number; rx: number; ry: number; w: number; fond: string }
  | { t: 'oreille'; x: number; y: number; rx: number; ry: number; fond: string }

/**
 * Les parties d'un chapeau, du dessous au dessus. Tout est proportionnel au corps : `rb` (sa
 * largeur a la ligne d'appui) et `cap` (la hauteur entre cette ligne et le sommet), si bien
 * qu'une etoile, un cube ou une petite boule de sommeil portent le meme chapeau a leur echelle.
 */
export function partiesPorte(id: PorteId, g: Geo): Partie[] {
  const { cx, by, rb, cap, haut } = g
  const { fond, accent } = TEINTES_PORTES[id]
  switch (id) {
    case 'bonnet': {
      const h = cap * 1.18 + 0.14 * rb
      return [
        { t: 'calotte', x: cx, y: by + 0.05 * rb, r: rb * 1.06, h: h + 0.05 * rb, fond },
        { t: 'cyl', x: cx, yb: by + 0.1 * rb, yh: by - 0.2 * rb, rb: rb * 1.1, rh: rb * 1.1, fond: accent },
        { t: 'boule', x: cx, y: by - h - 0.1 * rb, r: 0.17 * rb, fond: accent }
      ]
    }
    case 'haut-de-forme':
      return [
        { t: 'cyl', x: cx, yb: haut + 0.08 * rb, yh: haut - 0.92 * rb, rb: 0.56 * rb, rh: 0.52 * rb, fond },
        { t: 'cyl', x: cx, yb: haut + 0.08 * rb, yh: haut - 0.14 * rb, rb: 0.565 * rb, rh: 0.565 * rb, fond: accent },
        { t: 'bord', x: cx, y: haut + 0.08 * rb, r: 0.88 * rb, ry: 0.17 * rb, fond }
      ]
    case 'paille': {
      const yb = haut + 0.14 * rb
      return [
        { t: 'bord', x: cx, y: yb, r: 1.32 * rb, ry: 0.27 * rb, fond },
        { t: 'calotte', x: cx, y: yb, r: 0.64 * rb, h: 0.58 * rb, fond },
        { t: 'cyl', x: cx, yb: yb, yh: yb - 0.2 * rb, rb: 0.645 * rb, rh: 0.645 * rb, fond: accent }
      ]
    }
    case 'couronne':
      return [
        { t: 'pointes', x: cx, y: haut + 0.08 * rb, r: 0.75 * rb, h: 0.85 * rb, n: 3, fond },
        { t: 'cyl', x: cx, yb: haut + 0.14 * rb, yh: haut - 0.12 * rb, rb: 0.77 * rb, rh: 0.77 * rb, fond },
        { t: 'boule', x: cx, y: haut + 0.01 * rb, r: 0.11 * rb, fond: accent }
      ]
    case 'noeud':
      return [{ t: 'noeud', x: cx + 0.5 * rb, y: g.hautA(cx + 0.5 * rb) - 0.08 * rb, s: 0.5 * rb, fond }]
    case 'casque':
      return [
        { t: 'arc', x: cx, y: g.mid, rx: g.hw * 1.06, ry: g.mid - haut + 0.07 * g.hw, w: 0.15 * g.hw, fond },
        { t: 'oreille', x: cx - g.hw * 1.04, y: g.mid, rx: 0.17 * g.hw, ry: 0.36 * g.hw, fond: accent },
        { t: 'oreille', x: cx + g.hw * 1.04, y: g.mid, rx: 0.17 * g.hw, ry: 0.36 * g.hw, fond: accent }
      ]
    default:
      return []
  }
}

/** Une ombre douce posee sur le corps (ellipse, repere du moteur) : rx, ry, intensite 0..1. */
export interface Ombre {
  x: number
  y: number
  rx: number
  ry: number
  a: number
}

/** Rayon d'un verre rond d'apres les deux yeux (3D : yeux de face, centres, de meme taille). */
export function rayonVerre(a: Oeil, b: Oeil): number {
  const ecart = b.x - a.x
  return Math.max(Math.min(ecart * 0.5 * 0.98, Math.max(a.r, b.r) * 1.3 + 6), 10)
}

/**
 * Ombres que l'accessoire projette sur le corps (lumiere en haut a gauche : l'ombre tombe vers
 * le bas et la droite). Douces, sans bord : elles ne servent qu'a poser l'objet sur la peau.
 */
export function ombresPorte(id: PorteId, frame: BotFrame, g: Geo | null): Ombre[] {
  if (id === 'lunettes' || id === 'soleil') {
    const ye = yeuxDe(frame)
    if (ye.length !== 2) return []
    const r = rayonVerre(ye[0]!, ye[1]!)
    return ye.map((o) => ({ x: o.x + 0.2 * r, y: o.y + 0.42 * r, rx: 1.15 * r, ry: 1.1 * r, a: 0.26 }))
  }
  if (!g) return []
  if (id === 'noeud') return [{ x: g.cx + 0.55 * g.rb, y: g.hautA(g.cx + 0.5 * g.rb) + 0.55 * g.rb, rx: 0.8 * g.rb, ry: 0.45 * g.rb, a: 0.22 }]
  return [{ x: g.cx + 0.1 * g.rb, y: g.by + 0.14 * g.rb, rx: 1.0 * g.rb, ry: 0.32 * g.rb, a: 0.26 }]
}

/* ------------------------------------------------------------------ lunettes */

export interface Oeil {
  x: number
  y: number
  /** demi-etendue maximale de l'oeil a l'ecran */
  r: number
  alpha: number
}

export function yeuxDe(frame: BotFrame): Oeil[] {
  const out: Oeil[] = []
  for (const e of frame.eyes) {
    const n = e.matrix.match(/-?\d+\.?\d*(?:e-?\d+)?/g)?.map(Number)
    if (!n || n.length < 6) continue
    let mx = 0
    let my = 0
    for (const seg of e.d.matchAll(/([MLACQ])([^A-Za-z]*)/g)) {
      const v = seg[2]!.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? []
      const pr = seg[1] === 'A' ? v.slice(5) : v
      for (let i = 0; i + 1 < pr.length; i += seg[1] === 'A' ? 7 : 2) {
        mx = Math.max(mx, Math.abs(pr[i]!))
        my = Math.max(my, Math.abs(pr[i + 1]!))
      }
    }
    const [a, b, c, d, tx, ty] = n as [number, number, number, number, number, number]
    out.push({ x: tx, y: ty, r: Math.max(Math.abs(a) * mx + Math.abs(c) * my, Math.abs(b) * mx + Math.abs(d) * my), alpha: e.alpha })
  }
  return out.sort((p, q) => p.x - q.x)
}

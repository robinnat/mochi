/**
 * Accessoires PORTES : lunettes rondes, lunettes de soleil, mini haut-de-forme, chapeau de
 * paille, bonnet, noeud, couronne et casque audio. Contrairement aux accessoires de metier
 * (`accessoires.ts`, un objet tenu avec son geste), ceux-ci sont poses SUR le corps et le
 * suivent : ils sont recalcules a chaque image du moteur, depuis le contour (`bodyPath`) et les
 * yeux de cette image. Un saut, un ecrasement, un changement de forme ou d'humeur les deplace
 * donc avec le corps, sans reglage a part.
 *
 * Meme principe que les gestes : un reglage choisi, pas une mesure, et une couche facultative.
 * Rien ne change dans `engine.sample(t)`.
 *
 * Une seule description sert tous les rendus. Les COUPES (`Partie`) sont donnees en unites du
 * moteur (rayon 100, y vers le bas) :
 *   - 2D (original, argile, bulle) : `dessinPorte` les traduit en chemins SVG (`Prim`) ;
 *   - pixel art : les memes chemins sont rasterises sur la grille (`pixellisePrims`) ;
 *   - 3D : `trois/porte3d.ts` en fait des volumes (cylindres, calottes, tores) fixes au maillage,
 *     donc ils tournent avec lui. Les lunettes, elles, sont PEINTES sur le visage 3D, a la
 *     place exacte des yeux 3D (qui sont toujours de face).
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

/** Un chemin a dessiner (repere du moteur) : meme liste pour le SVG et pour le pixel art. */
export interface Prim {
  d: string
  fill?: string
  stroke?: string
  sw?: number
  alpha?: number
}

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

const f1 = (v: number) => String(Math.round(v * 10) / 10)

function ellipseD(x: number, y: number, rx: number, ry: number): string {
  return `M${f1(x - rx)} ${f1(y)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0z`
}

function prim(d: string, fond: string, sw: number): Prim {
  return { d, fill: fond, stroke: trait(fond), sw }
}

/** Une partie, en chemins SVG. L'epaisseur du trait suit l'echelle du chapeau. */
function partieEnPrims(p: Partie, sw: number): Prim[] {
  switch (p.t) {
    case 'cyl': {
      const d = `M${f1(p.x - p.rb)} ${f1(p.yb)}L${f1(p.x - p.rh)} ${f1(p.yh)}L${f1(p.x + p.rh)} ${f1(p.yh)}L${f1(p.x + p.rb)} ${f1(p.yb)}z`
      return [prim(d, p.fond, sw)]
    }
    case 'calotte': {
      const d = `M${f1(p.x - p.r)} ${f1(p.y)}A${f1(p.r)} ${f1(p.h)} 0 0 1 ${f1(p.x + p.r)} ${f1(p.y)}z`
      return [prim(d, p.fond, sw)]
    }
    case 'bord':
      return [prim(ellipseD(p.x, p.y, p.r, p.ry), p.fond, sw)]
    case 'boule':
      return [prim(ellipseD(p.x, p.y, p.r, p.r), p.fond, sw)]
    case 'pointes': {
      const w = (2 * p.r) / p.n
      let d = `M${f1(p.x - p.r)} ${f1(p.y)}`
      for (let i = 0; i < p.n; i++) {
        const x0 = p.x - p.r + i * w
        d += `L${f1(x0 + w * 0.15)} ${f1(p.y - p.h)}L${f1(x0 + w * 0.5)} ${f1(p.y - p.h * 0.45)}L${f1(x0 + w * 0.85)} ${f1(p.y - p.h)}L${f1(x0 + w)} ${f1(p.y)}`
      }
      return [prim(d + 'z', p.fond, sw)]
    }
    case 'noeud': {
      const s = p.s
      const aile = (sg: number) =>
        `M${f1(p.x)} ${f1(p.y)}L${f1(p.x + sg * 1.5 * s)} ${f1(p.y - 0.8 * s)}Q${f1(p.x + sg * 1.75 * s)} ${f1(p.y)} ${f1(p.x + sg * 1.5 * s)} ${f1(p.y + 0.8 * s)}z`
      return [prim(aile(-1), p.fond, sw), prim(aile(1), p.fond, sw), prim(ellipseD(p.x, p.y, 0.42 * s, 0.42 * s), mixHex(p.fond, '#000000', 0.1), sw)]
    }
    case 'arc': {
      // bande : un arc d'ellipse epais, de l'oreille gauche a l'oreille droite par le dessus
      const a = `M${f1(p.x - p.rx)} ${f1(p.y)}A${f1(p.rx)} ${f1(p.ry)} 0 0 1 ${f1(p.x + p.rx)} ${f1(p.y)}`
      return [
        { d: a, stroke: trait(p.fond), sw: p.w + 2 * sw },
        { d: a, stroke: p.fond, sw: p.w }
      ]
    }
    case 'oreille':
      return [prim(ellipseD(p.x, p.y, p.rx, p.ry), p.fond, sw)]
  }
}

/* ------------------------------------------------------------------ lunettes */

interface Oeil {
  x: number
  y: number
  /** demi-etendue maximale de l'oeil a l'ecran */
  r: number
  alpha: number
}

function yeuxDe(frame: BotFrame): Oeil[] {
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

/**
 * Lunettes posees sur les yeux de CETTE image : elles suivent le regard (les yeux glissent sur
 * le corps, la monture glisse avec eux), le clin d'oeil et les yeux ecarquilles (la monture
 * s'agrandit pour entourer l'oeil le plus grand), et s'effacent avec le visage.
 */
export function lunettesDe(id: 'lunettes' | 'soleil', frame: BotFrame): Prim[] {
  const yeux = yeuxDe(frame)
  if (yeux.length !== 2) return []
  const [a, b] = yeux as [Oeil, Oeil]
  const alpha = Math.min(a.alpha, b.alpha) * frame.bodyAlpha
  if (alpha < 0.02) return []
  const ecart = b.x - a.x
  // un verre entoure l'oeil, sans que les deux ne se chevauchent
  const r = Math.max(Math.min(ecart * 0.5 * 0.96, Math.max(a.r, b.r) * 1.25 + 4), 6)
  // les yeux ecarquilles sont plus hauts que larges : le verre s'allonge pour les entourer
  const ry = Math.min(Math.max(r, Math.max(a.r, b.r) * 1.15), r * 1.7)
  const sw = Math.max(1.6, r * 0.16)
  const { fond, accent } = TEINTES_PORTES[id]
  const out: Prim[] = []
  const monture = trait(id === 'soleil' ? accent : accent)
  const verre = (o: Oeil): string =>
    id === 'soleil'
      ? `M${f1(o.x - r)} ${f1(o.y - ry * 0.55)}Q${f1(o.x - r)} ${f1(o.y - ry * 0.8)} ${f1(o.x - r * 0.7)} ${f1(o.y - ry * 0.8)}L${f1(o.x + r * 0.7)} ${f1(o.y - ry * 0.8)}Q${f1(o.x + r)} ${f1(o.y - ry * 0.8)} ${f1(o.x + r)} ${f1(o.y - ry * 0.55)}L${f1(o.x + r)} ${f1(o.y + ry * 0.2)}Q${f1(o.x + r)} ${f1(o.y + ry * 0.95)} ${f1(o.x)} ${f1(o.y + ry * 0.95)}Q${f1(o.x - r)} ${f1(o.y + ry * 0.95)} ${f1(o.x - r)} ${f1(o.y + ry * 0.2)}z`
      : ellipseD(o.x, o.y, r, ry)
  // pont et branches, sous les verres
  const pont = `M${f1(a.x + r * 0.9)} ${f1(a.y - r * 0.1)}Q${f1((a.x + b.x) / 2)} ${f1(a.y - r * 0.55)} ${f1(b.x - r * 0.9)} ${f1(b.y - r * 0.1)}`
  const brancheG = `M${f1(a.x - r)} ${f1(a.y - r * 0.1)}L${f1(a.x - r - r * 0.55)} ${f1(a.y - r * 0.2)}`
  const brancheD = `M${f1(b.x + r)} ${f1(b.y - r * 0.1)}L${f1(b.x + r + r * 0.55)} ${f1(b.y - r * 0.2)}`
  for (const d of [pont, brancheG, brancheD]) out.push({ d, stroke: monture, sw, alpha })
  for (const o of [a, b]) {
    // verre : transparent (lunettes) ou teinte a 55 % (soleil), l'oeil se lit au travers
    out.push({
      d: verre(o),
      fill: id === 'soleil' ? fond : '#ffffff',
      alpha: alpha * (id === 'soleil' ? 0.55 : 0.12)
    })
    out.push({ d: verre(o), stroke: monture, sw, alpha })
  }
  return out
}

/** Tous les chemins 2D d'un accessoire porte, pour l'image `frame`. */
export function dessinPorte(id: PorteId, frame: BotFrame): Prim[] {
  if (id === 'lunettes' || id === 'soleil') return lunettesDe(id, frame)
  const g = mesuresPorte(frame)
  if (!g) return []
  const sw = Math.max(1.4, Math.min(3.2, g.rb * 0.045))
  const out: Prim[] = []
  for (const p of partiesPorte(id, g)) out.push(...partieEnPrims(p, sw))
  return out
}

/** Les memes chemins en texte SVG, pour les rendus 2D. */
export function porteSvg(id: PorteId, frame: BotFrame): string {
  return dessinPorte(id, frame)
    .map((p) => {
      const a = [`d="${p.d}"`, `fill="${p.fill ?? 'none'}"`]
      if (p.stroke) a.push(`stroke="${p.stroke}" stroke-width="${f1(p.sw ?? 2)}" stroke-linecap="round" stroke-linejoin="round"`)
      if (p.alpha !== undefined && p.alpha < 1) a.push(`opacity="${Math.round(p.alpha * 100) / 100}"`)
      return `<path ${a.join(' ')}/>`
    })
    .join('')
}

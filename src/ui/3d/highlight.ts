/**
 * Petit reflet doux de la matiere 3D `soft`, en haut a gauche du corps.
 *
 * Meme esprit que le reflet des Mochi en pate (argile) : une tache blanche semi-transparente,
 * allongee dans le sens de la lumiere, au bord fondu. Ce n'est PAS un reflet speculaire
 * brillant : rien de net, rien de reel, juste une tache claire mate. Il est peint dans la
 * texture du corps (avant les yeux, qui restent donc intacts et blancs), il suit donc la
 * forme et le morphing.
 *
 * Ce module est PUR (aucune dependance a Three.js) : il choisit OU poser la tache.
 * La regle est la meme pour toutes les formes : le point du corps le plus « en haut a
 * gauche » qui reste assez a l'interieur pour que la tache tienne dans la forme (etoile,
 * fleur, goutte...) et loin des yeux.
 */

import type { Point } from '@/bot/shape'

export interface Highlight {
  /** centre de la tache, repere du moteur (y vers le bas) */
  x: number
  y: number
  /** demi-axes : rx le long de la lumiere, ry en travers */
  rx: number
  ry: number
  /** inclinaison (radians) : la tache suit la diagonale de la lumiere */
  angle: number
  /** opacity au centre (la tache s'estompe jusqu'a 0 au bord) */
  opacity: number
}

/** Le reflet est actif par defaut ; `highlight: false` le coupe (option de MochiBot et de la 3D). */
export const DEFAULT_HIGHLIGHT = true

/** Direction de la lumiere : en haut (y negatif) a gauche, devant. */
const LIGHT = { x: -0.59, y: -0.81 }
const ANGLE = (-32 * Math.PI) / 180
const OPACITE = 0.3

const inPoly = (p: Point, poly: Point[]) => {
  let dedans = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dedans = !dedans
  }
  return dedans
}

const distSeg = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

const distEdge = (p: Point, poly: Point[]) => {
  let m = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) m = Math.min(m, distSeg(p, poly[j]!, poly[i]!))
  return m
}

/** Garde au plus `n` points du contour, regulierement espaces. */
const alleger = (pts: Point[], n: number) => {
  if (pts.length <= n) return pts
  const step = pts.length / n
  return Array.from({ length: n }, (_, i) => pts[Math.floor(i * step)]!)
}

/**
 * Position du reflet pour un contour `pts` (repere du moteur) et les centres des yeux
 * `eyes` a eviter. `null` si le contour est trop petit pour porter une tache.
 */
export function positionHighlight(pts: Point[], eyes: Point[] = []): Highlight | null {
  if (pts.length < 3) return null
  const poly = alleger(pts, 72)
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of poly) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  // grille grossiere (lisible par le morphing), puis un affinage local
  const step = Math.max(2, Math.min(x1 - x0, y1 - y0) / 24)
  const interieurs: Array<{ p: Point; r: number }> = []
  let rin = 0
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      const p = { x, y }
      if (!inPoly(p, poly)) continue
      const r = distEdge(p, poly)
      interieurs.push({ p, r })
      if (r > rin) rin = r
    }
  }
  if (rin < 4) return null
  const margin = 0.4 * rin
  const rx = 0.52 * rin
  const ry = 0.33 * rin
  const far = (p: Point) => eyes.every((e) => Math.hypot(e.x - p.x, e.y - p.y) >= 0.45 * rx + 0.08 * rin)
  const score = (p: Point) => p.x * LIGHT.x + p.y * LIGHT.y
  const best = (cands: Array<{ p: Point; r: number }>, requiresEyes: boolean) => {
    let top: Point | null = null
    for (const c of cands) {
      if (c.r < margin) continue
      if (requiresEyes && !far(c.p)) continue
      if (!top || score(c.p) > score(top)) top = c.p
    }
    return top
  }
  let c = best(interieurs, true) ?? best(interieurs, false)
  if (!c) return null
  // affinage : on cherche dans un voisinage fin autour du meilleur point de la grille
  const end: Array<{ p: Point; r: number }> = []
  for (let dy = -step; dy <= step; dy += step / 4) {
    for (let dx = -step; dx <= step; dx += step / 4) {
      const p = { x: c.x + dx, y: c.y + dy }
      if (inPoly(p, poly)) end.push({ p, r: distEdge(p, poly) })
    }
  }
  c = best(end, true) ?? c
  return { x: c.x, y: c.y, rx, ry, angle: ANGLE, opacity: OPACITE }
}

/** Le reflet d'une image, ou `null` s'il est coupe (`active` = false) ou s'il n'y a pas de place. */
export function bodyHighlight(pts: Point[], eyes: Point[], active: boolean): Highlight | null {
  return active ? positionHighlight(pts, eyes) : null
}

/**
 * Peint le reflet dans `c` (contexte 2D de la texture du corps) : degrade radial blanc
 * semi-transparent, etire en ellipse. `k` = pixels par unite du moteur, `vb` = demi-viewBox.
 * Pas de `filter` canvas (Safari ne l'a pas) : le fondu est dans le degrade.
 */
export function paintHighlight(c: CanvasRenderingContext2D, r: Highlight, k: number, vb: number) {
  c.save()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalAlpha = 1
  c.translate(k * (r.x + vb), k * (r.y + vb))
  c.rotate(r.angle)
  c.scale(k * r.rx, k * r.ry)
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, `rgba(255,255,255,${r.opacity})`)
  g.addColorStop(0.45, `rgba(255,255,255,${(r.opacity * 0.62).toFixed(3)})`)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(-1, -1, 2, 2)
  c.restore()
}

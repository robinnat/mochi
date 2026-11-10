/**
 * Small soft highlight of the `soft` 3D material, at the top left of the body.
 *
 * A semi-transparent white spot, stretched along the light, with a faded edge. It is NOT a shiny specular highlight:
 * nothing sharp, nothing realistic, just a light matte spot. It is painted in the body texture (before the eyes,
 * which stay intact and white), so it follows the shape and the morph.
 *
 * This module is PURE (no Three.js dependency): it chooses WHERE to put the spot. The rule is the same for every
 * shape: the body point most "top left" that stays far enough inside for the spot to fit in the shape (star, flower,
 * drop...) and away from the eyes.
 */

import type { Point } from '@/bot/shape'

export interface Highlight {
  /** spot center, engine space (y down) */
  x: number
  y: number
  /** half axes: rx along the light, ry across */
  rx: number
  ry: number
  /** tilt (radians): the spot follows the light's diagonal */
  angle: number
  /** opacity at the center (the spot fades to 0 at the edge) */
  opacity: number
}

/** The highlight is on by default; `highlight: false` turns it off (option of MochiBot and of the 3D). */
export const DEFAULT_HIGHLIGHT = true

/** Light direction: at the top (negative y) left, in front. */
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

/** Keeps at most `n` points of the outline, evenly spaced. */
const alleger = (pts: Point[], n: number) => {
  if (pts.length <= n) return pts
  const step = pts.length / n
  return Array.from({ length: n }, (_, i) => pts[Math.floor(i * step)]!)
}

/**
 * Highlight position for an outline `pts` (engine space) and the eye centers `eyes` to avoid. `null` if the outline
 * is too small to carry a spot.
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
  // coarse grid (stable under morphing), then a local refinement
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
  // refinement: search a fine neighborhood around the best grid point
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

/** The highlight of a frame, or `null` if it is off (`active` = false) or there is no room. */
export function bodyHighlight(pts: Point[], eyes: Point[], active: boolean): Highlight | null {
  return active ? positionHighlight(pts, eyes) : null
}

/**
 * Paints the highlight in `c` (2D context of the body texture): a semi-transparent white radial gradient, stretched
 * into an ellipse. `k` = pixels per engine unit, `vb` = half viewBox. No canvas `filter` (Safari lacks it): the fade
 * is in the gradient.
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

/**
 * WORN accessories: round glasses, sunglasses, a mini top hat, a straw hat, a beanie, a bow, a crown and headphones,
 * in 3D. They sit ON the body and follow it: they are computed again at every engine frame, from the outline
 * (`bodyPath`) and the eyes of that frame. A jump, a squash, a change of shape or mood moves them with the body, with
 * no extra setting.
 *
 * Same principle as gestures: a chosen setting, not a measurement, and an optional layer. Nothing changes in
 * `engine.sample(t)`.
 *
 * The PARTS (`Part`) are given in engine units (radius 100, y down); `3d/worn3d.ts` turns them into volumes
 * (cylinders, domes, tori) attached to the mesh, so they turn with it. Glasses are PAINTED on the 3D face, exactly
 * where the 3D eyes are (always facing front).
 *
 * Shared style: flat matte tints, the same dark stroke of the same hue, no sharp highlight.
 *
 * Consistent with the mood: lenses are clear (glasses) or 55 % tinted (sunglasses), never opaque, so a wink or wide
 * eyes read through them. When the face disappears (`thinking`, `sleep`), the glasses disappear with it; the hat
 * stays on the body, however small.
 */
import { bodyOutline } from '@/ui/3d/volume'
import type { BotFrame } from './engine'
import { mixHex } from './skins'

export type WornId = 'glasses' | 'sunglasses' | 'top-hat' | 'straw' | 'beanie' | 'bow' | 'crown' | 'headphones'

export const WORN_IDS: WornId[] = ['glasses', 'sunglasses', 'top-hat', 'straw', 'beanie', 'bow', 'crown', 'headphones']

/** Tints of the worn accessories (flat); the stroke is the same hue, darker. */
export const WORN_TINTS: Record<WornId, { background: string; accent: string }> = {
  glasses: { background: '#ffffff', accent: '#4b5368' },
  sunglasses: { background: '#2c3040', accent: '#2c3040' },
  'top-hat': { background: '#4a4f66', accent: '#e9a0b4' },
  straw: { background: '#f1d79a', accent: '#e58f8f' },
  beanie: { background: '#8fd3c4', accent: '#f4a8b8' },
  bow: { background: '#f49ab0', accent: '#f49ab0' },
  crown: { background: '#f4cf6a', accent: '#e58f8f' },
  headphones: { background: '#f2eef8', accent: '#8d7be0' }
}

export const stroke = (hex: string) => mixHex(hex, '#000000', 0.42)

export interface Geo {
  /** axis and top of the body */
  cx: number
  top: number
  neck: number
  /** line where the hat rests, and the body width there (chord) */
  by: number
  rb: number
  /** height of the dome between the resting line and the top */
  cap: number
  /** height and half width of the body in the middle (ears) */
  mid: number
  hw: number
  /** height (y) of the top of the body at abscissa x; the bottom of the body if the vertical misses it */
  topA: (x: number) => number
}

/** Width of the body at height `y`: [xmin, xmax], or null if the line does not cross the body. */
function chord(pts: Array<{ x: number; y: number }>, y: number): [number, number] | null {
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

/** Measurements of the body of THIS frame; null if the body is not there (fade, empty). */
export function measuresWorn(frame: BotFrame): Geo | null {
  if (frame.bodyPath.length < 10 || frame.bodyAlpha < 0.05) return null
  const pts = bodyOutline(frame.bodyPath, 2)
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
  const c = chord(pts, by)
  const m = chord(pts, y0 + 0.5 * H)
  if (!c || !m) return null
  return {
    cx: (c[0] + c[1]) / 2,
    top: y0,
    neck: y1,
    by,
    // floor: at the top of a tip (star) the chord is narrow, the hat stays readable
    rb: Math.max(2, (c[1] - c[0]) / 2, 0.17 * (x1 - x0)),
    cap: by - y0,
    mid: y0 + 0.5 * H,
    hw: (m[1] - m[0]) / 2,
    topA: (x) => {
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

export type Part =
  | { t: 'cyl'; x: number; yb: number; yh: number; rb: number; rh: number; background: string }
  | { t: 'crown'; x: number; y: number; r: number; h: number; background: string }
  | { t: 'edge'; x: number; y: number; r: number; ry: number; background: string }
  | { t: 'ball'; x: number; y: number; r: number; background: string }
  | { t: 'tips'; x: number; y: number; r: number; h: number; n: number; background: string }
  | { t: 'bow'; x: number; y: number; s: number; background: string }
  | { t: 'arc'; x: number; y: number; rx: number; ry: number; w: number; background: string }
  | { t: 'ear'; x: number; y: number; rx: number; ry: number; background: string }

/**
 * The parts of a hat, from bottom to top. Everything is proportional to the body: `rb` (its width at the resting
 * line) and `cap` (the height between that line and the top), so a star, a cube or a small sleeping ball wear the
 * same hat at their own scale.
 */
export function partsWorn(id: WornId, g: Geo): Part[] {
  const { cx, by, rb, cap, top } = g
  const { background, accent } = WORN_TINTS[id]
  switch (id) {
    case 'beanie': {
      const h = cap * 1.18 + 0.14 * rb
      return [
        { t: 'crown', x: cx, y: by + 0.05 * rb, r: rb * 1.06, h: h + 0.05 * rb, background },
        { t: 'cyl', x: cx, yb: by + 0.1 * rb, yh: by - 0.2 * rb, rb: rb * 1.1, rh: rb * 1.1, background: accent },
        { t: 'ball', x: cx, y: by - h - 0.1 * rb, r: 0.17 * rb, background: accent }
      ]
    }
    case 'top-hat':
      return [
        { t: 'cyl', x: cx, yb: top + 0.08 * rb, yh: top - 0.92 * rb, rb: 0.56 * rb, rh: 0.52 * rb, background },
        { t: 'cyl', x: cx, yb: top + 0.08 * rb, yh: top - 0.14 * rb, rb: 0.565 * rb, rh: 0.565 * rb, background: accent },
        { t: 'edge', x: cx, y: top + 0.08 * rb, r: 0.88 * rb, ry: 0.17 * rb, background }
      ]
    case 'straw': {
      const yb = top + 0.14 * rb
      return [
        { t: 'edge', x: cx, y: yb, r: 1.32 * rb, ry: 0.27 * rb, background },
        { t: 'crown', x: cx, y: yb, r: 0.64 * rb, h: 0.58 * rb, background },
        { t: 'cyl', x: cx, yb: yb, yh: yb - 0.2 * rb, rb: 0.645 * rb, rh: 0.645 * rb, background: accent }
      ]
    }
    case 'crown':
      return [
        { t: 'tips', x: cx, y: top + 0.08 * rb, r: 0.75 * rb, h: 0.85 * rb, n: 3, background },
        { t: 'cyl', x: cx, yb: top + 0.14 * rb, yh: top - 0.12 * rb, rb: 0.77 * rb, rh: 0.77 * rb, background },
        { t: 'ball', x: cx, y: top + 0.01 * rb, r: 0.11 * rb, background: accent }
      ]
    case 'bow':
      return [{ t: 'bow', x: cx + 0.5 * rb, y: g.topA(cx + 0.5 * rb) - 0.08 * rb, s: 0.5 * rb, background }]
    case 'headphones':
      return [
        { t: 'arc', x: cx, y: g.mid, rx: g.hw * 1.06, ry: g.mid - top + 0.07 * g.hw, w: 0.15 * g.hw, background },
        { t: 'ear', x: cx - g.hw * 1.04, y: g.mid, rx: 0.17 * g.hw, ry: 0.36 * g.hw, background: accent },
        { t: 'ear', x: cx + g.hw * 1.04, y: g.mid, rx: 0.17 * g.hw, ry: 0.36 * g.hw, background: accent }
      ]
    default:
      return []
  }
}

/** A soft shadow on the body (ellipse, engine space): rx, ry, intensity 0..1. */
export interface Shadow {
  x: number
  y: number
  rx: number
  ry: number
  a: number
}

/** Radius of a round lens from both eyes (3D: eyes facing front, centered, same size). */
export function radiusLens(a: Eye, b: Eye): number {
  const gap = b.x - a.x
  return Math.max(Math.min(gap * 0.5 * 0.98, Math.max(a.r, b.r) * 1.3 + 6), 10)
}

/**
 * Shadows the accessory casts on the body (light at the top left: the shadow falls down and right). Soft, with no
 * edge: they only set the object on the skin.
 */
export function shadowsWorn(id: WornId, frame: BotFrame, g: Geo | null): Shadow[] {
  if (id === 'glasses' || id === 'sunglasses') {
    const ye = eyesOf(frame)
    if (ye.length !== 2) return []
    const r = radiusLens(ye[0]!, ye[1]!)
    return ye.map((o) => ({ x: o.x + 0.2 * r, y: o.y + 0.42 * r, rx: 1.15 * r, ry: 1.1 * r, a: 0.26 }))
  }
  if (!g) return []
  if (id === 'bow') return [{ x: g.cx + 0.55 * g.rb, y: g.topA(g.cx + 0.5 * g.rb) + 0.55 * g.rb, rx: 0.8 * g.rb, ry: 0.45 * g.rb, a: 0.22 }]
  return [{ x: g.cx + 0.1 * g.rb, y: g.by + 0.14 * g.rb, rx: 1.0 * g.rb, ry: 0.32 * g.rb, a: 0.26 }]
}

/* ------------------------------------------------------------------ lunettes */

export interface Eye {
  x: number
  y: number
  /** maximum half extent of the eye on screen */
  r: number
  alpha: number
}

export function eyesOf(frame: BotFrame): Eye[] {
  const out: Eye[] = []
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

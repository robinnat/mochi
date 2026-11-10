/**
 * Where the eyes of a frame are, on screen, and the soft shadows accessories cast on the body. Shared by the 3D
 * accessories (`ui/3d/accessories3d.ts`) and the 3D body (`ui/3d/scene3d.ts`). Pure: no Three.js, no DOM.
 */
import type { BotFrame } from './engine'

/** A soft shadow on the body (ellipse, engine space): rx, ry, intensity 0..1. */
export interface Shadow {
  x: number
  y: number
  rx: number
  ry: number
  a: number
}

/** Radius of a round lens (glasses, monocle) from both eyes (3D: eyes facing front, centered, same size). */
export function radiusLens(a: Eye, b: Eye): number {
  const gap = b.x - a.x
  return Math.max(Math.min(gap * 0.5 * 0.98, Math.max(a.r, b.r) * 1.3 + 6), 10)
}

/** An eye of a frame: its center, its size on screen and its opacity. */
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

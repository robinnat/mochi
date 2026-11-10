import { describe, expect, it } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { RADIUS } from '@/bot/frame'
import { SHAPES } from '@/bot/skins'
import { bodyOutline, readMatrix } from './volume'
import { paintHighlight, positionHighlight, DEFAULT_HIGHLIGHT, bodyHighlight } from './highlight'

const image = (id: string, t = 1.2) =>
  new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === id)!.radii, null).sample(t)
const eyesOf = (f: ReturnType<typeof image>) =>
  f.eyes.map((e) => {
    const m = readMatrix(e.matrix)
    return { x: m[4], y: m[5] }
  })

const SHAPE_LIST = ['circle', 'star', 'cloud', 'flower', 'drop', 'heart']

describe('soft highlight', () => {
  it('is on by default', () => {
    expect(DEFAULT_HIGHLIGHT).toBe(true)
  })

  it.each(SHAPE_LIST)('%s: present, inside the body, at the top left, away from the eyes', (id) => {
    const f = image(id)
    const pts = bodyOutline(f.bodyPath, 3)
    const eyes = eyesOf(f)
    const r = bodyHighlight(pts, eyes, true)
    expect(r).not.toBeNull()
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    // on the left and above the shape's center
    expect(r!.x).toBeLessThan(cx + 5)
    expect(r!.y).toBeLessThan(cy)
    // the spot is small, soft and semi-transparent
    expect(r!.opacity).toBeGreaterThan(0.1)
    expect(r!.opacity).toBeLessThan(0.6)
    // does not touch the eyes
    for (const e of eyes) expect(Math.hypot(e.x - r!.x, e.y - r!.y)).toBeGreaterThan(0.2 * r!.rx)
  })

  it('stays at the top left when the shape deforms', () => {
    const e = new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === 'star')!.radii, null)
    for (const t of [0.2, 0.7, 1.3, 2.1]) {
      const f = e.sample(t)
      const r = positionHighlight(bodyOutline(f.bodyPath, 3), eyesOf(f))!
      expect(r.x).toBeLessThan(10)
      expect(r.y).toBeLessThan(0)
    }
  })

  it('can be turned off: null with highlight = false', () => {
    const f = image('circle')
    expect(bodyHighlight(bodyOutline(f.bodyPath, 3), eyesOf(f), false)).toBeNull()
  })

  it('paints a semi-transparent white gradient, and nothing without highlight', () => {
    const calls: string[] = []
    const stops: string[] = []
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      setTransform: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      fillRect: () => calls.push('fillRect'),
      createRadialGradient: () => ({ addColorStop: (_o: number, c: string) => stops.push(c) }),
      globalAlpha: 1,
      fillStyle: ''
    } as unknown as CanvasRenderingContext2D
    const f = image('circle')
    const r = bodyHighlight(bodyOutline(f.bodyPath, 3), eyesOf(f), true)!
    paintHighlight(ctx, r, 2.5, 150)
    expect(calls).toContain('fillRect')
    expect(stops[0]).toMatch(/^rgba\(255,255,255,0\.\d+\)$/)
    expect(stops.at(-1)).toBe('rgba(255,255,255,0)')
  })
})

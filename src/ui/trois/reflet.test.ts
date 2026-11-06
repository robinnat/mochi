import { describe, expect, it } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { RAYON } from '@/bot/repere'
import { SHAPES } from '@/bot/skins'
import { contourDuCorps, lireMatrice } from './volume'
import { peindreReflet, positionReflet, REFLET_DEFAUT, refletDuCorps } from './reflet'

const image = (id: string, t = 1.2) =>
  new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === id)!.radii, null).sample(t)
const yeuxDe = (f: ReturnType<typeof image>) =>
  f.eyes.map((e) => {
    const m = lireMatrice(e.matrix)
    return { x: m[4], y: m[5] }
  })

const FORMES = ['cercle', 'etoile', 'nuage', 'fleur', 'goutte', 'coeur']

describe('reflet doux', () => {
  it('est actif par defaut', () => {
    expect(REFLET_DEFAUT).toBe(true)
  })

  it.each(FORMES)('%s : present, dans le corps, en haut a gauche, loin des yeux', (id) => {
    const f = image(id)
    const pts = contourDuCorps(f.bodyPath, 3)
    const yeux = yeuxDe(f)
    const r = refletDuCorps(pts, yeux, true)
    expect(r).not.toBeNull()
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    // du cote gauche et haut du centre de la forme
    expect(r!.x).toBeLessThan(cx + 5)
    expect(r!.y).toBeLessThan(cy)
    // la tache est petite, douce et semi-transparente
    expect(r!.opacite).toBeGreaterThan(0.1)
    expect(r!.opacite).toBeLessThan(0.6)
    // ne touche pas les yeux
    for (const e of yeux) expect(Math.hypot(e.x - r!.x, e.y - r!.y)).toBeGreaterThan(0.2 * r!.rx)
  })

  it('reste en haut a gauche quand la forme se deforme', () => {
    const e = new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === 'etoile')!.radii, null)
    for (const t of [0.2, 0.7, 1.3, 2.1]) {
      const f = e.sample(t)
      const r = positionReflet(contourDuCorps(f.bodyPath, 3), yeuxDe(f))!
      expect(r.x).toBeLessThan(10)
      expect(r.y).toBeLessThan(0)
    }
  })

  it('desactivable : null avec reflet = false', () => {
    const f = image('cercle')
    expect(refletDuCorps(contourDuCorps(f.bodyPath, 3), yeuxDe(f), false)).toBeNull()
  })

  it('peint un degrade blanc semi-transparent, et rien sans reflet', () => {
    const appels: string[] = []
    const stops: string[] = []
    const ctx = {
      save: () => appels.push('save'),
      restore: () => appels.push('restore'),
      setTransform: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      fillRect: () => appels.push('fillRect'),
      createRadialGradient: () => ({ addColorStop: (_o: number, c: string) => stops.push(c) }),
      globalAlpha: 1,
      fillStyle: ''
    } as unknown as CanvasRenderingContext2D
    const f = image('cercle')
    const r = refletDuCorps(contourDuCorps(f.bodyPath, 3), yeuxDe(f), true)!
    peindreReflet(ctx, r, 2.5, 150)
    expect(appels).toContain('fillRect')
    expect(stops[0]).toMatch(/^rgba\(255,255,255,0\.\d+\)$/)
    expect(stops.at(-1)).toBe('rgba(255,255,255,0)')
  })
})

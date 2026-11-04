import { describe, expect, it } from 'vitest'
import {
  cheminEnBoucle,
  dureeSaut,
  poseSaut,
  poseSurChemin,
  SAUT_DEFAUT as P
} from './sauts'

const A = { x: 1, y: 2 }
const B = { x: 2, y: 2 }

describe('poseSaut', () => {
  it('avant le saut : sur la case de depart, au repos', () => {
    expect(poseSaut(-1, A, B)).toMatchObject({ x: 1, y: 2, hauteur: 0, sy: 1, sxz: 1 })
  })

  it('suit les quatre phases dans l ordre', () => {
    const ts = [0.01, P.anticipation + 0.01, P.anticipation + P.vol + 0.01, dureeSaut() - 0.01]
    expect(ts.map((t) => poseSaut(t, A, B).phase)).toEqual([
      'anticipation',
      'vol',
      'atterrissage',
      'pause'
    ])
  })

  it('anticipation : le corps s ecrase, ne bouge pas, ne decolle pas', () => {
    const s = poseSaut(P.anticipation - 1e-6, A, B)
    expect(s.sy).toBeCloseTo(1 - P.ecrasement, 3)
    expect(s.x).toBe(A.x)
    expect(s.hauteur).toBe(0)
  })

  it('vol : parabole, sommet au milieu, retour au sol a l arrivee', () => {
    const t0 = P.anticipation
    expect(poseSaut(t0 + 1e-9, A, B).hauteur).toBeCloseTo(0, 5)
    expect(poseSaut(t0 + P.vol / 2, A, B).hauteur).toBeCloseTo(P.hauteur, 5)
    expect(poseSaut(t0 + P.vol - 1e-9, A, B).hauteur).toBeCloseTo(0, 5)
  })

  it('vol : la position avance regulierement de depart a arrivee', () => {
    expect(poseSaut(P.anticipation + P.vol / 2, A, B).x).toBeCloseTo(1.5, 6)
    expect(poseSaut(P.anticipation + P.vol - 1e-9, A, B).x).toBeCloseTo(2, 6)
  })

  it('vol : etire a la vitesse maximale, rond au sommet', () => {
    expect(poseSaut(P.anticipation + 1e-6, A, B).sy).toBeCloseTo(1 + P.etirement, 3)
    expect(poseSaut(P.anticipation + P.vol / 2, A, B).sy).toBeCloseTo(1, 6)
  })

  it('le volume est conserve a tout instant (sy * sxz^2 = 1)', () => {
    for (let t = 0; t < dureeSaut(); t += 0.01) {
      const s = poseSaut(t, A, B)
      expect(s.sy * s.sxz * s.sxz).toBeCloseTo(1, 9)
    }
  })

  it('atterrissage : ecrase a l impact puis amorti jusqu au repos', () => {
    const t0 = P.anticipation + P.vol
    expect(poseSaut(t0 + 1e-6, A, B).sy).toBeCloseTo(1 - P.impact, 2)
    const amplitude = (t: number) => Math.abs(1 - poseSaut(t, A, B).sy)
    let premiere = 0
    let seconde = 0
    for (let u = 0; u < 1; u += 0.01) {
      const a = amplitude(t0 + u * P.atterrissage)
      if (u < 0.5) premiere = Math.max(premiere, a)
      else seconde = Math.max(seconde, a)
    }
    expect(seconde).toBeLessThan(premiere / 2)
    expect(amplitude(t0 + P.atterrissage - 1e-6)).toBeLessThan(0.02)
  })

  it('apres la fin : sur l arrivee, au repos', () => {
    expect(poseSaut(dureeSaut() + 5, A, B)).toMatchObject({ x: 2, hauteur: 0, sy: 1, sxz: 1 })
  })

  it('est pure : meme temps, meme pose', () => {
    expect(poseSaut(0.4, A, B)).toEqual(poseSaut(0.4, A, B))
  })
})

describe('poseSurChemin', () => {
  const chemin = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]
  it('enchaine les sauts case par case', () => {
    const d = dureeSaut()
    expect(poseSurChemin(0.01, chemin).saut).toBe(0)
    expect(poseSurChemin(d + 0.01, chemin).saut).toBe(1)
    expect(poseSurChemin(10 * d, chemin)).toMatchObject({ x: 1, y: 1, hauteur: 0 })
  })
  it('un chemin d une case ne bouge pas', () => {
    expect(poseSurChemin(3, [{ x: 4, y: 4 }])).toMatchObject({ x: 4, y: 4, hauteur: 0 })
  })
})

describe('cheminEnBoucle', () => {
  it('fait le tour du rectangle et revient au depart', () => {
    const c = cheminEnBoucle({ x: 0, y: 0 }, 3, 3)
    expect(c).toHaveLength(9)
    expect(c[c.length - 1]).toEqual({ x: 0, y: 0 })
    for (let i = 1; i < c.length; i++) {
      expect(Math.abs(c[i]!.x - c[i - 1]!.x) + Math.abs(c[i]!.y - c[i - 1]!.y)).toBe(1)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { EXPRESSION_BY_ID } from './expressions'
import {
  ACTIVITES,
  GESTE_NEUTRE,
  GESTES_REPOS,
  composer,
  gesteDeFenetre,
  gesteEchec,
  gesteRepos,
  gesteSommeil,
  personnalite,
  rebond,
  REBOND_DUREE,
  tempsActivite,
  zSommeil
} from './gestes'
import { STATE_BY_ID } from './states'

const ecart = (g: typeof GESTE_NEUTRE) =>
  Math.max(Math.abs(g.dx), Math.abs(g.dy), Math.abs(g.sx - 1), Math.abs(g.sy - 1))

describe('gestes', () => {
  it('sans geste ou avec le geste neutre, le rendu est identique a l octet pres', () => {
    const a = new BotEngine(100, 'idle')
    const b = new BotEngine(100, 'idle')
    for (const t of [0, 0.37, 1.9, 4.2, 12.5]) {
      const ref = JSON.stringify(a.sample(t))
      expect(JSON.stringify(b.sample(t, { ...GESTE_NEUTRE }))).toBe(ref)
    }
  })

  it('un geste change bien l image, sans muter le moteur', () => {
    const e = new BotEngine(100, 'idle')
    const avant = JSON.stringify(e.sample(2))
    const bouge = JSON.stringify(e.sample(2, { ...GESTE_NEUTRE, dy: -0.1, sy: 1.05, yaw: 20 }))
    expect(bouge).not.toBe(avant)
    expect(JSON.stringify(e.sample(2))).toBe(avant)
  })

  it('la paupiere du geste ferme les yeux', () => {
    const e = new BotEngine(100, 'idle')
    const ouvert = e.sample(0.5).eyes[0]!.matrix
    const ferme = e.sample(0.5, { ...GESTE_NEUTRE, lid: 0 }).eyes[0]!.matrix
    expect(ferme).not.toBe(ouvert)
  })

  it('calendrier d attente : deterministe, 4 a 12 s entre deux gestes, jamais avant 4 s', () => {
    for (const graine of [1, 42, 0xdead, 987654]) {
      const debuts = Array.from({ length: 40 }, (_, k) => gesteDeFenetre(graine, k).debut)
      for (let k = 1; k < debuts.length; k++) {
        const d = debuts[k]! - debuts[k - 1]!
        expect(d).toBeGreaterThanOrEqual(4)
        expect(d).toBeLessThanOrEqual(12)
      }
      expect(gesteDeFenetre(graine, 7)).toEqual(gesteDeFenetre(graine, 7))
      for (let t = 0; t < 4; t += 0.1) expect(gesteRepos(t, graine)).toEqual({ ...GESTE_NEUTRE })
    }
  })

  it('deux graines differentes ne gesticulent pas en meme temps (decalage)', () => {
    const actif = (graine: number, t: number) => ecart(gesteRepos(t, graine)) > 1e-4 || gesteRepos(t, graine).yaw !== 0 || gesteRepos(t, graine).lid < 1
    let ensemble = 0
    let total = 0
    for (let t = 0; t < 300; t += 0.25) {
      const a = actif(11, t)
      const b = actif(97, t)
      if (a || b) total++
      if (a && b) ensemble++
    }
    expect(total).toBeGreaterThan(0)
    expect(ensemble / total).toBeLessThan(0.35)
  })

  it('chaque graine a sa personnalite (gestes preferes)', () => {
    const p = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => personnalite(s).join(',')))
    expect(p.size).toBeGreaterThan(4)
    for (const s of [1, 2, 3]) expect(new Set(personnalite(s)).size).toBe(4)
  })

  it('amplitudes sobres et retour au neutre en fin de geste', () => {
    for (const def of GESTES_REPOS) {
      for (let u = 0; u <= def.duree; u += def.duree / 40) {
        const g = def.pose(u)
        expect(Math.abs(g.dx)).toBeLessThanOrEqual(0.05)
        expect(Math.abs(g.dy)).toBeLessThanOrEqual(0.13)
        expect(Math.abs(g.sx - 1)).toBeLessThanOrEqual(0.06)
        expect(Math.abs(g.sy - 1)).toBeLessThanOrEqual(0.08)
        expect(Math.abs(g.yaw)).toBeLessThanOrEqual(25)
      }
      expect(ecart(def.pose(def.duree))).toBeLessThan(0.01)
    }
  })

  it('rebond au toucher : amorti, neutre apres sa duree', () => {
    expect(ecart(rebond(0.05))).toBeGreaterThan(0.02)
    expect(rebond(REBOND_DUREE + 0.01)).toEqual({ ...GESTE_NEUTRE })
    expect(rebond(-1)).toEqual({ ...GESTE_NEUTRE })
  })

  it('sommeil : yeux fermes, respiration lente ; echec : affaisse', () => {
    expect(gesteSommeil(0).lid).toBeLessThan(0.1)
    expect(gesteSommeil(0).sy).not.toBe(gesteSommeil(2.3).sy)
    expect(gesteEchec(1).sy).toBeLessThan(1)
    expect(gesteEchec(1).dy).toBeGreaterThan(0)
    const z = zSommeil(1.2)
    expect(z).toHaveLength(2)
    for (const p of z) expect(p.opacite).toBeGreaterThanOrEqual(0)
  })

  it('composer additionne, multiplie et garde la paupiere la plus fermee', () => {
    const c = composer({ ...GESTE_NEUTRE, dx: 0.1, sy: 1.1, lid: 0.5 }, { ...GESTE_NEUTRE, dx: 0.05, sy: 1.1, lid: 0.8 })
    expect(c.dx).toBeCloseTo(0.15)
    expect(c.sy).toBeCloseTo(1.21)
    expect(c.lid).toBe(0.5)
  })

  it('activites : etats connus du moteur, boucles bornees, toutes differentes', () => {
    expect(new Set(ACTIVITES.map((a) => a.id)).size).toBe(ACTIVITES.length)
    const e = new BotEngine(100, 'idle', null, EXPRESSION_BY_ID.get('attentif') ?? null)
    for (const a of ACTIVITES) {
      expect(STATE_BY_ID.has(a.etat)).toBe(true)
      for (const t of [0, 1.7, 33.3]) {
        const tt = tempsActivite(a, t)
        expect(tt).toBeGreaterThanOrEqual(0.6)
        expect(tt).toBeLessThan(0.6 + a.boucle)
        const f = new BotEngine(100, a.etat).sample(tt, a.geste(t))
        expect(f.bodyPath.startsWith('M')).toBe(true)
      }
    }
    expect(e.sample(1).eyes.length).toBeGreaterThan(0)
  })
})

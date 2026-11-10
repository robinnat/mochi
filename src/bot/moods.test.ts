import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { NEUTRAL_GESTURE, hasFace, composer, type Gesture } from './gestures'
import {
  Moods,
  MOODS,
  MOOD_BY_ID,
  MOOD_IDS,
  REACTIONS,
  REACTION_FOR_EVENT,
  REACTION_IDS,
  GAZE_X,
  WAVE_PUSH,
  waveScale,
  mustRedraw,
  mix,
  resolveMood
} from './moods'
import { arcPath, capsulePath } from './shape'
import { SHAPES } from './skins'
import { halfExtentEye } from '../ui/3d/volume'

const NUM: Array<keyof Gesture> = ['dx', 'dy', 'sx', 'sy', 'lid', 'ew', 'eh', 'tilt', 'arc', 'ex', 'ey', 'cheeks', 'rot']
const NEUTRAL: Partial<Record<keyof Gesture, number>> = { sx: 1, sy: 1, lid: 1, ew: 1, eh: 1 }
const vals = (g: Gesture | undefined) => NUM.map((k) => (g?.[k] as number | undefined) ?? NEUTRAL[k] ?? 0)
// l'inclinaison est en degres : on la ramene a l'echelle des rayons (20 degres = 1)
const gap = (a: Gesture | undefined, b: Gesture | undefined) => Math.max(...vals(a).map((v, i) => Math.abs(v - vals(b)[i]!) / (NUM[i] === 'rot' || NUM[i] === 'tilt' ? 20 : 1)))

describe('humeurs : catalogue', () => {
  it('les sept humeurs de la demande existent, avec le nom de l etat existant qu elles prolongent', () => {
    expect(MOOD_IDS).toEqual(['idle', 'thinking', 'working', 'waiting', 'done', 'blocked', 'asleep'])
    expect(MOOD_BY_ID.get('idle')!.state).toBe('idle')
    expect(MOOD_BY_ID.get('thinking')!.state).toBe('thinking')
    expect(MOOD_BY_ID.get('asleep')!.state).toBe('sleep')
  })

  it('les noms d etats et les alias anglais sont acceptes, le reste est refuse', () => {
    expect(resolveMood('idle')).toBe('idle')
    expect(resolveMood('thinking')).toBe('thinking')
    expect(resolveMood('sleep')).toBe('asleep')
    expect(resolveMood('blocked')).toBe('blocked')
    expect(resolveMood('nimporte')).toBeNull()
    expect(resolveMood(null)).toBeNull()
  })

  it('les cinq reactions et leurs declencheurs', () => {
    expect(REACTION_IDS).toEqual(['startle', 'laugh', 'blush', 'dizzy', 'wave'])
    expect(REACTION_FOR_EVENT).toEqual({ tap: 'startle', double: 'laugh', long: 'blush', shaken: 'dizzy', arrival: 'wave' })
  })

  it('chaque humeur boucle sans couture (la fin retombe sur le debut)', () => {
    for (const m of MOODS) {
      const a = m.pose(0)
      const b = m.pose(m.period - 1e-6)
      // les rafales et sauts sont lisses : un ecart de quelques millièmes au plus
      expect(gap(a, b)).toBeLessThan(0.03)
    }
  })

  it('chaque humeur a un visage et un mouvement qui la distinguent', () => {
    const traces = MOODS.map((m) => JSON.stringify([m.expression.eyes, [0, 0.4, 0.8, 1.3].map((u) => vals(m.pose(u)))]))
    expect(new Set(traces).size).toBe(MOODS.length)
  })

  it('le visage reste dans l enveloppe : aucun champ non fini, paupiere bornee, echelles positives', () => {
    for (const m of MOODS) {
      for (let u = 0; u < m.period; u += 0.05) {
        const g = m.pose(u)
        for (const v of vals(g)) expect(Number.isFinite(v)).toBe(true)
        expect(g.sx).toBeGreaterThan(0.6)
        expect(g.sy).toBeGreaterThan(0.6)
        expect(g.lid).toBeGreaterThanOrEqual(0)
        expect(g.lid).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('humeurs : pilote', () => {
  it('sans humeur, reaction ni suivi, la couche est inactive (rien a redessiner de plus)', () => {
    const h = new Moods()
    for (const t of [0, 0.3, 5, 120]) expect(h.sample(t)).toBeUndefined()
  })

  it('une humeur active rend un geste, et le moteur applique son visage', () => {
    const h = new Moods('blocked')
    const g = h.sample(0.8)!
    expect(hasFace(g)).toBe(true)
    const f = new BotEngine(100, 'idle', null, null).sample(0.8, g)
    expect(f.face).toBeDefined()
    expect(f.eyes).toHaveLength(2)
    // colere : les inclinaisons sont en miroir
    expect(Math.sign(f.eyes[0]!.tilt!)).toBe(-Math.sign(f.eyes[1]!.tilt!))
  })

  it('setMood change d humeur en fondu, sans saut a la date du changement', () => {
    const h = new Moods('idle')
    const before = h.sample(2.9999)
    h.setMood('done', 3)
    // le fondu part en ease-out (comme le moteur) : on regarde l'instant meme du changement
    expect(gap(before, h.sample(3.0001))).toBeLessThan(0.01)
    expect(h.mood).toBe('done')
    // une fois le fondu passe, c est la boucle de la nouvelle humeur
    const most = h.sample(5)!
    expect(most.arc).toBe(1)
    h.setMood('unknown', 6)
    expect(h.mood).toBeNull()
    expect(h.sample(7)).toBeUndefined()
  })

  it('apres chaque reaction, l humeur reprend sans saut et retrouve exactement sa boucle', () => {
    for (const m of MOOD_IDS) {
      for (const r of REACTIONS) {
        const h = new Moods(m)
        const alone = new Moods(m)
        const t0 = 2.1
        h.react(r.id, t0)
        if (r.held) h.release(t0 + 1)
        const end = r.held ? t0 + 1 + (r.exit ?? 0.5) : t0 + r.duration
        // pendant : la reaction change quelque chose
        const during = h.sample(t0 + Math.min(0.35, r.duration / 3))!
        expect(h.reaction(t0 + 0.2)).toBe(r.id)
        expect(JSON.stringify(during)).not.toBe(JSON.stringify(alone.sample(t0 + Math.min(0.35, r.duration / 3))))
        // juste avant la fin / juste apres : pas de saut
        expect(gap(h.sample(end - 1e-3), h.sample(end + 1e-3))).toBeLessThan(0.03)
        // apres : identique a l humeur seule
        expect(h.reaction(end + 0.01)).toBeNull()
        expect(JSON.stringify(h.sample(end + 0.5))).toBe(JSON.stringify(alone.sample(end + 0.5)))
      }
    }
  })

  it('sans humeur, une reaction part du visage de repos et le rend a la fin', () => {
    const h = new Moods(null)
    expect(h.sample(1)).toBeUndefined()
    h.react('startle', 1)
    expect(h.sample(1.2)).toBeDefined()
    expect(h.sample(1 + 0.8 + 0.01)).toBeUndefined()
  })

  it('l appui long tient tant qu on garde le doigt, puis redescend', () => {
    const h = new Moods('idle')
    h.react('blush', 1)
    expect(h.sample(1.6)!.cheeks).toBeCloseTo(1, 5)
    // dix secondes plus tard, toujours rouge
    expect(h.sample(11)!.cheeks).toBeCloseTo(1, 5)
    expect(h.reaction(11)).toBe('blush')
    h.release(11)
    expect(h.sample(11.3)!.cheeks!).toBeLessThan(1)
    expect(h.sample(11.3)!.cheeks!).toBeGreaterThan(0)
    expect(h.reaction(11.8)).toBeNull()
    expect(h.sample(12)!.cheeks ?? 0).toBe(0)
  })

  it('rougit ferme les yeux en croissant ; rigole aussi ; etourdi les fait tourner', () => {
    const h = new Moods('idle')
    h.react('blush', 0)
    expect(h.sample(0.6)!.arc).toBeCloseTo(1, 5)
    const e = new Moods('idle')
    e.react('dizzy', 0)
    const pts = [0.2, 0.35, 0.5, 0.65].map((t) => e.sample(t)!)
    // le regard decrit un cercle : ni fixe, ni sur une droite
    const radii = pts.map((g) => Math.hypot(g.ex!, g.ey!))
    expect(Math.min(...radii)).toBeGreaterThan(0.06)
    expect(new Set(pts.map((g) => Math.round(Math.atan2(g.ey!, g.ex!) * 10))).size).toBeGreaterThan(2)
  })

  it('le survol suit le pointeur, et lacher rend le regard a l humeur', () => {
    const h = new Moods('idle')
    h.lookAt({ nx: 1, ny: 0 }, 1)
    expect(h.sample(2)!.ex!).toBeCloseTo(GAZE_X, 1)
    expect(h.sample(2)!.ex!).toBeGreaterThan(GAZE_X * 0.9)
    expect(h.sample(2)!.dx!).toBeGreaterThan(0)
    h.lookAt(null, 3)
    const alone = new Moods('idle')
    expect(Math.abs(h.sample(4)!.ex! - alone.sample(4)!.ex!)).toBeLessThan(0.01)
    // sans humeur, le suivi seul reste inactif des qu on lache
    const n = new Moods(null)
    n.lookAt({ nx: -1, ny: 1 }, 0)
    expect(n.sample(1)).toBeDefined()
    n.lookAt(null, 2)
    expect(n.sample(3)).toBeUndefined()
    // une cible non finie est refusee
    n.lookAt({ nx: NaN, ny: 0 }, 4)
    expect(n.sample(5)).toBeUndefined()
  })

  it('prefers-reduced-motion : image fixe, le corps ne bouge plus, seul le visage reste', () => {
    const h = new Moods('working', { reduced: true })
    const a = h.sample(0)!
    const b = h.sample(1.7)!
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect([a.dx, a.dy, a.sx, a.sy, a.rot]).toEqual([0, 0, 1, 1, 0])
    expect(a.exp).toBeDefined()
    // pas de saut, de rire ni de tournis ; l appui long (visage seul) reste permis
    expect(h.react('startle', 1)).toBe(false)
    expect(h.react('dizzy', 1)).toBe(false)
    expect(h.react('blush', 1)).toBe(true)
    const mute = new Moods('working', { reduced: true })
    mute.lookAt({ nx: 1, ny: 1 }, 2)
    expect(mute.sample(3)!.ex).toBe(a.ex)
  })

  it('une reaction inconnue est refusee', () => {
    expect(new Moods('idle').react('explose', 0)).toBe(false)
  })
})

describe('humeurs : moteur', () => {
  it('sans couche visage, l image est identique a l octet pres', () => {
    const e = new BotEngine(100, 'idle', null, null)
    expect(JSON.stringify(e.sample(2))).toBe(JSON.stringify(e.sample(2, { ...NEUTRAL_GESTURE })))
    expect(e.sample(2).face).toBeUndefined()
    expect(e.sample(2, { ...NEUTRAL_GESTURE }).eyes[0]!.k).toBeUndefined()
  })

  it('arc, tilt, regard, tete penchee et paupiere se retrouvent dans l image', () => {
    const e = new BotEngine(100, 'idle', null, null)
    const base = e.sample(2, { ...NEUTRAL_GESTURE, ew: 1 })
    const f = e.sample(2, { ...NEUTRAL_GESTURE, arc: 1, tilt: 20, ex: 0.1, ey: -0.05, rot: 10, cheeks: 0.5, lid: 0.5 })
    expect(f.eyes[0]!.d).not.toBe(base.eyes[0]!.d)
    expect(f.eyes[0]!.d.startsWith('M')).toBe(true)
    expect(f.face).toEqual({ rot: 10, cheeks: 0.5 })
    expect(f.bodyPath).not.toBe(base.bodyPath)
    expect(f.eyes[0]!.gx).toBeCloseTo(10, 5)
    expect(f.eyes[0]!.gy).toBeCloseTo(-5, 5)
    expect(f.eyes[0]!.k!).toBeLessThan(1)
    expect(f.eyes[0]!.tilt! - f.eyes[1]!.tilt!).toBeCloseTo(40, 5)
  })

  it('la couche reste pure : meme date, meme image', () => {
    const e = new BotEngine(100, 'idle', null, null)
    const h = new Moods('working')
    const a = e.sample(1.3, h.sample(1.3))
    e.sample(2.5, h.sample(2.5))
    expect(JSON.stringify(e.sample(1.3, h.sample(1.3)))).toBe(JSON.stringify(a))
  })

  it('sur les 11 formes, toutes les humeurs et reactions rendent un corps et deux yeux valides', () => {
    for (const s of SHAPES) {
      const e = new BotEngine(100, 'idle', s.radii, null)
      for (const m of MOOD_IDS) {
        const h = new Moods(m)
        for (const r of REACTIONS) h.react(r.id, 0.5)
        const h2 = new Moods(m)
        for (let t = 0; t < 4; t += 0.2) {
          for (const hh of [h, h2]) {
            const f = e.sample(t, hh.sample(t))
            expect(f.bodyPath).not.toMatch(/NaN|Infinity/)
            expect(f.eyes).toHaveLength(2)
            for (const y of f.eyes) expect(y.matrix + y.d).not.toMatch(/NaN|Infinity/)
          }
        }
      }
    }
  })

  it('un accessoire qui lit le corps rendu suit les deformations : le corps change avec l humeur', () => {
    const e = new BotEngine(100, 'idle', null, null)
    const idle = e.sample(1, undefined).bodyPath
    const jump = new Moods('done').sample(0.8)!
    expect(jump.sy).not.toBe(1)
    expect(e.sample(1.0, jump).bodyPath).not.toBe(idle)
    // la tete penchee tourne le corps lui-meme (le contour change), pas seulement les yeux
    expect(composer(NEUTRAL_GESTURE, { ...NEUTRAL_GESTURE, rot: 12 }).rot).toBe(12)
    const star = new BotEngine(100, 'idle', SHAPES.find((s) => s.id === 'star')!.radii, null)
    expect(star.sample(1, { ...NEUTRAL_GESTURE, rot: 12 }).bodyPath).not.toBe(star.sample(1).bodyPath)
  })
})

describe('humeurs : melange et formes d yeux', () => {
  it('melanger interpole champ par champ, neutre pour les champs absents', () => {
    const m = mix({ ...NEUTRAL_GESTURE, ex: 0.1 }, { ...NEUTRAL_GESTURE, ex: -0.1, arc: 1 }, 0.5)
    expect(m.ex).toBeCloseTo(0, 6)
    expect(m.arc).toBeCloseTo(0.5, 6)
    expect(m.sy).toBe(1)
  })

  it('l oeil croissant a la meme boite que la gelule a arc nul, et reste proche a arc 1', () => {
    for (const [w, h] of [[24, 46], [42, 17], [36, 14]] as const) {
      const cap = halfExtentEye(capsulePath(w, h), 'matrix(1 0 0 1 0 0)')
      const a0 = halfExtentEye(arcPath(w, h, 0), 'matrix(1 0 0 1 0 0)')
      expect(a0).toBeCloseTo(cap, 0)
      const a1 = halfExtentEye(arcPath(w, h, 1), 'matrix(1 0 0 1 0 0)')
      expect(a1).toBeGreaterThan(0)
      expect(a1).toBeLessThan(cap * 1.4)
      expect(arcPath(w, h, 1)).not.toMatch(/NaN/)
    }
  })
})

describe('humeurs : cadence', () => {
  it('plafonne les redessins a fps images par seconde, sans rien changer sans plafond', () => {
    const count = (fps?: number) => {
      let n = 0
      let last = 0
      for (let ms = 16; ms <= 1000; ms += 1000 / 60) {
        if (mustRedraw(ms, last, fps)) {
          n++
          last = ms
        }
      }
      return n
    }
    expect(count()).toBeGreaterThanOrEqual(58)
    expect(count(12)).toBeGreaterThanOrEqual(11)
    expect(count(12)).toBeLessThanOrEqual(13)
    expect(count(0)).toBe(count())
  })
})

describe('coucou : le Mochi pousse depuis le sol', () => {
  it('part de presque rien, depasse un peu (105 a 108 %) puis revient a 100 % en 0,4 a 0,6 s', () => {
    expect(WAVE_PUSH).toBeGreaterThanOrEqual(0.4)
    expect(WAVE_PUSH).toBeLessThanOrEqual(0.6)
    expect(waveScale(0)).toBeLessThan(0.05)
    let max = 0
    for (let i = 0; i <= 100; i++) max = Math.max(max, waveScale((i / 100) * WAVE_PUSH))
    expect(max).toBeGreaterThan(1.05)
    expect(max).toBeLessThan(1.09)
    expect(waveScale(WAVE_PUSH)).toBeCloseTo(1, 6)
  })

  it('le bas du corps reste pose sur le sol pendant la pousse, et le geste habituel suit', () => {
    const h = new Moods('idle')
    h.react('wave', 0)
    for (const t of [0.05, 0.15, 0.3, 0.45]) {
      const g = h.sample(t)!
      expect(g.sy, String(t)).toBeCloseTo(waveScale(t), 2)
      expect(g.sx).toBeCloseTo(waveScale(t), 2)
      // dy = (1 - sy) * 0.92 : le centre descend autant que le corps raccourcit
      expect(g.dy).toBeCloseTo((1 - g.sy) * 0.92, 1)
    }
    // apres la pousse, le saut d'avant (ecrasement) est bien la
    const jump = h.sample(WAVE_PUSH + 0.14)!
    expect(jump.sy).toBeLessThan(0.95)
  })

  it('en mouvement reduit : pas de pousse (le composant fait un simple fondu)', () => {
    const h = new Moods('idle', { reduced: true })
    expect(h.react('wave', 0)).toBe(false)
    expect(h.sample(0.1)?.sx ?? 1).toBe(1)
  })
})

describe('travaille : l animation du corps est celle validee avec les moods', () => {
  it('rebond regulier toutes les 0,5 s, regard qui balaie une ligne par seconde, boucle sans saut', () => {
    const h = new Moods('working')
    const a = h.sample(0)!
    const b = h.sample(3.999)!
    expect(Math.abs(a.sy - b.sy)).toBeLessThan(0.01)
    // periode de 0,5 s : meme pose a t et t + 0,5
    for (const t of [0.13, 0.31, 0.77]) expect(h.sample(t)!.sy).toBeCloseTo(h.sample(t + 0.5)!.sy, 2)
    // balayage : le regard va de gauche a droite en une seconde
    expect(h.sample(0.05)!.ex ?? 0).toBeLessThan(h.sample(0.8)!.ex ?? 0)
    expect(h.sample(0.55)!.sx).toBeGreaterThan(0.98)
  })
})

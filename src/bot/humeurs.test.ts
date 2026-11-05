import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { GESTE_NEUTRE, aUnVisage, composer, type Geste } from './gestes'
import {
  Humeurs,
  MOODS,
  MOOD_BY_ID,
  MOOD_IDS,
  REACTIONS,
  REACTION_DE_EVENEMENT,
  REACTION_IDS,
  REGARD_X,
  COUCOU_POUSSE,
  coucouEchelle,
  doitRedessiner,
  melanger,
  moodDe
} from './humeurs'
import { arcPath, capsulePath } from './shape'
import { SHAPES } from './skins'
import { demiEtendueOeil } from '../ui/trois/volume'

const NUM: Array<keyof Geste> = ['dx', 'dy', 'sx', 'sy', 'lid', 'ew', 'eh', 'tilt', 'arc', 'ex', 'ey', 'joues', 'rot']
const NEUTRE: Partial<Record<keyof Geste, number>> = { sx: 1, sy: 1, lid: 1, ew: 1, eh: 1 }
const vals = (g: Geste | undefined) => NUM.map((k) => (g?.[k] as number | undefined) ?? NEUTRE[k] ?? 0)
// l'inclinaison est en degres : on la ramene a l'echelle des rayons (20 degres = 1)
const ecart = (a: Geste | undefined, b: Geste | undefined) => Math.max(...vals(a).map((v, i) => Math.abs(v - vals(b)[i]!) / (NUM[i] === 'rot' || NUM[i] === 'tilt' ? 20 : 1)))

describe('humeurs : catalogue', () => {
  it('les sept humeurs de la demande existent, avec le nom de l etat existant qu elles prolongent', () => {
    expect(MOOD_IDS).toEqual(['repos', 'reflechit', 'travaille', 'attend', 'termine', 'bloque', 'dort'])
    expect(MOOD_BY_ID.get('repos')!.etat).toBe('idle')
    expect(MOOD_BY_ID.get('reflechit')!.etat).toBe('thinking')
    expect(MOOD_BY_ID.get('dort')!.etat).toBe('sleep')
  })

  it('les noms d etats et les alias anglais sont acceptes, le reste est refuse', () => {
    expect(moodDe('idle')).toBe('repos')
    expect(moodDe('thinking')).toBe('reflechit')
    expect(moodDe('sleep')).toBe('dort')
    expect(moodDe('bloque')).toBe('bloque')
    expect(moodDe('nimporte')).toBeNull()
    expect(moodDe(null)).toBeNull()
  })

  it('les cinq reactions et leurs declencheurs', () => {
    expect(REACTION_IDS).toEqual(['sursaut', 'rigole', 'rougit', 'etourdi', 'coucou'])
    expect(REACTION_DE_EVENEMENT).toEqual({ tap: 'sursaut', double: 'rigole', longue: 'rougit', secoue: 'etourdi', arrivee: 'coucou' })
  })

  it('chaque humeur boucle sans couture (la fin retombe sur le debut)', () => {
    for (const m of MOODS) {
      const a = m.pose(0)
      const b = m.pose(m.periode - 1e-6)
      // les rafales et sauts sont lisses : un ecart de quelques millièmes au plus
      expect(ecart(a, b)).toBeLessThan(0.03)
    }
  })

  it('chaque humeur a un visage et un mouvement qui la distinguent', () => {
    const traces = MOODS.map((m) => JSON.stringify([m.expression.eyes, [0, 0.4, 0.8, 1.3].map((u) => vals(m.pose(u)))]))
    expect(new Set(traces).size).toBe(MOODS.length)
  })

  it('le visage reste dans l enveloppe : aucun champ non fini, paupiere bornee, echelles positives', () => {
    for (const m of MOODS) {
      for (let u = 0; u < m.periode; u += 0.05) {
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
    const h = new Humeurs()
    for (const t of [0, 0.3, 5, 120]) expect(h.sample(t)).toBeUndefined()
  })

  it('une humeur active rend un geste, et le moteur applique son visage', () => {
    const h = new Humeurs('bloque')
    const g = h.sample(0.8)!
    expect(aUnVisage(g)).toBe(true)
    const f = new BotEngine(100, 'idle', null, null).sample(0.8, g)
    expect(f.visage).toBeDefined()
    expect(f.eyes).toHaveLength(2)
    // colere : les inclinaisons sont en miroir
    expect(Math.sign(f.eyes[0]!.tilt!)).toBe(-Math.sign(f.eyes[1]!.tilt!))
  })

  it('setMood change d humeur en fondu, sans saut a la date du changement', () => {
    const h = new Humeurs('repos')
    const avant = h.sample(2.9999)
    h.setMood('termine', 3)
    // le fondu part en ease-out (comme le moteur) : on regarde l'instant meme du changement
    expect(ecart(avant, h.sample(3.0001))).toBeLessThan(0.01)
    expect(h.mood).toBe('termine')
    // une fois le fondu passe, c est la boucle de la nouvelle humeur
    const plus = h.sample(5)!
    expect(plus.arc).toBe(1)
    h.setMood('inconnue', 6)
    expect(h.mood).toBeNull()
    expect(h.sample(7)).toBeUndefined()
  })

  it('apres chaque reaction, l humeur reprend sans saut et retrouve exactement sa boucle', () => {
    for (const m of MOOD_IDS) {
      for (const r of REACTIONS) {
        const h = new Humeurs(m)
        const seul = new Humeurs(m)
        const t0 = 2.1
        h.react(r.id, t0)
        if (r.tenue) h.relacher(t0 + 1)
        const fin = r.tenue ? t0 + 1 + (r.sortie ?? 0.5) : t0 + r.duree
        // pendant : la reaction change quelque chose
        const pendant = h.sample(t0 + Math.min(0.35, r.duree / 3))!
        expect(h.reaction(t0 + 0.2)).toBe(r.id)
        expect(JSON.stringify(pendant)).not.toBe(JSON.stringify(seul.sample(t0 + Math.min(0.35, r.duree / 3))))
        // juste avant la fin / juste apres : pas de saut
        expect(ecart(h.sample(fin - 1e-3), h.sample(fin + 1e-3))).toBeLessThan(0.03)
        // apres : identique a l humeur seule
        expect(h.reaction(fin + 0.01)).toBeNull()
        expect(JSON.stringify(h.sample(fin + 0.5))).toBe(JSON.stringify(seul.sample(fin + 0.5)))
      }
    }
  })

  it('sans humeur, une reaction part du visage de repos et le rend a la fin', () => {
    const h = new Humeurs(null)
    expect(h.sample(1)).toBeUndefined()
    h.react('sursaut', 1)
    expect(h.sample(1.2)).toBeDefined()
    expect(h.sample(1 + 0.8 + 0.01)).toBeUndefined()
  })

  it('l appui long tient tant qu on garde le doigt, puis redescend', () => {
    const h = new Humeurs('repos')
    h.react('rougit', 1)
    expect(h.sample(1.6)!.joues).toBeCloseTo(1, 5)
    // dix secondes plus tard, toujours rouge
    expect(h.sample(11)!.joues).toBeCloseTo(1, 5)
    expect(h.reaction(11)).toBe('rougit')
    h.relacher(11)
    expect(h.sample(11.3)!.joues!).toBeLessThan(1)
    expect(h.sample(11.3)!.joues!).toBeGreaterThan(0)
    expect(h.reaction(11.8)).toBeNull()
    expect(h.sample(12)!.joues ?? 0).toBe(0)
  })

  it('rougit ferme les yeux en croissant ; rigole aussi ; etourdi les fait tourner', () => {
    const h = new Humeurs('repos')
    h.react('rougit', 0)
    expect(h.sample(0.6)!.arc).toBeCloseTo(1, 5)
    const e = new Humeurs('repos')
    e.react('etourdi', 0)
    const pts = [0.2, 0.35, 0.5, 0.65].map((t) => e.sample(t)!)
    // le regard decrit un cercle : ni fixe, ni sur une droite
    const rayons = pts.map((g) => Math.hypot(g.ex!, g.ey!))
    expect(Math.min(...rayons)).toBeGreaterThan(0.06)
    expect(new Set(pts.map((g) => Math.round(Math.atan2(g.ey!, g.ex!) * 10))).size).toBeGreaterThan(2)
  })

  it('le survol suit le pointeur, et lacher rend le regard a l humeur', () => {
    const h = new Humeurs('repos')
    h.regarder({ nx: 1, ny: 0 }, 1)
    expect(h.sample(2)!.ex!).toBeCloseTo(REGARD_X, 1)
    expect(h.sample(2)!.ex!).toBeGreaterThan(REGARD_X * 0.9)
    expect(h.sample(2)!.dx!).toBeGreaterThan(0)
    h.regarder(null, 3)
    const seul = new Humeurs('repos')
    expect(Math.abs(h.sample(4)!.ex! - seul.sample(4)!.ex!)).toBeLessThan(0.01)
    // sans humeur, le suivi seul reste inactif des qu on lache
    const n = new Humeurs(null)
    n.regarder({ nx: -1, ny: 1 }, 0)
    expect(n.sample(1)).toBeDefined()
    n.regarder(null, 2)
    expect(n.sample(3)).toBeUndefined()
    // une cible non finie est refusee
    n.regarder({ nx: NaN, ny: 0 }, 4)
    expect(n.sample(5)).toBeUndefined()
  })

  it('prefers-reduced-motion : image fixe, le corps ne bouge plus, seul le visage reste', () => {
    const h = new Humeurs('travaille', { reduit: true })
    const a = h.sample(0)!
    const b = h.sample(1.7)!
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect([a.dx, a.dy, a.sx, a.sy, a.rot]).toEqual([0, 0, 1, 1, 0])
    expect(a.exp).toBeDefined()
    // pas de saut, de rire ni de tournis ; l appui long (visage seul) reste permis
    expect(h.react('sursaut', 1)).toBe(false)
    expect(h.react('etourdi', 1)).toBe(false)
    expect(h.react('rougit', 1)).toBe(true)
    const muet = new Humeurs('travaille', { reduit: true })
    muet.regarder({ nx: 1, ny: 1 }, 2)
    expect(muet.sample(3)!.ex).toBe(a.ex)
  })

  it('une reaction inconnue est refusee', () => {
    expect(new Humeurs('repos').react('explose', 0)).toBe(false)
  })
})

describe('humeurs : moteur', () => {
  it('sans couche visage, l image est identique a l octet pres', () => {
    const e = new BotEngine(100, 'idle', null, null)
    expect(JSON.stringify(e.sample(2))).toBe(JSON.stringify(e.sample(2, { ...GESTE_NEUTRE })))
    expect(e.sample(2).visage).toBeUndefined()
    expect(e.sample(2, { ...GESTE_NEUTRE }).eyes[0]!.k).toBeUndefined()
  })

  it('arc, tilt, regard, tete penchee et paupiere se retrouvent dans l image', () => {
    const e = new BotEngine(100, 'idle', null, null)
    const base = e.sample(2, { ...GESTE_NEUTRE, ew: 1 })
    const f = e.sample(2, { ...GESTE_NEUTRE, arc: 1, tilt: 20, ex: 0.1, ey: -0.05, rot: 10, joues: 0.5, lid: 0.5 })
    expect(f.eyes[0]!.d).not.toBe(base.eyes[0]!.d)
    expect(f.eyes[0]!.d.startsWith('M')).toBe(true)
    expect(f.visage).toEqual({ rot: 10, joues: 0.5 })
    expect(f.bodyPath).not.toBe(base.bodyPath)
    expect(f.eyes[0]!.gx).toBeCloseTo(10, 5)
    expect(f.eyes[0]!.gy).toBeCloseTo(-5, 5)
    expect(f.eyes[0]!.k!).toBeLessThan(1)
    expect(f.eyes[0]!.tilt! - f.eyes[1]!.tilt!).toBeCloseTo(40, 5)
  })

  it('la couche reste pure : meme date, meme image', () => {
    const e = new BotEngine(100, 'idle', null, null)
    const h = new Humeurs('travaille')
    const a = e.sample(1.3, h.sample(1.3))
    e.sample(2.5, h.sample(2.5))
    expect(JSON.stringify(e.sample(1.3, h.sample(1.3)))).toBe(JSON.stringify(a))
  })

  it('sur les 11 formes, toutes les humeurs et reactions rendent un corps et deux yeux valides', () => {
    for (const s of SHAPES) {
      const e = new BotEngine(100, 'idle', s.radii, null)
      for (const m of MOOD_IDS) {
        const h = new Humeurs(m)
        for (const r of REACTIONS) h.react(r.id, 0.5)
        const h2 = new Humeurs(m)
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
    const repos = e.sample(1, undefined).bodyPath
    const saut = new Humeurs('termine').sample(0.8)!
    expect(saut.sy).not.toBe(1)
    expect(e.sample(1.0, saut).bodyPath).not.toBe(repos)
    // la tete penchee tourne le corps lui-meme (le contour change), pas seulement les yeux
    expect(composer(GESTE_NEUTRE, { ...GESTE_NEUTRE, rot: 12 }).rot).toBe(12)
    const etoile = new BotEngine(100, 'idle', SHAPES.find((s) => s.id === 'etoile')!.radii, null)
    expect(etoile.sample(1, { ...GESTE_NEUTRE, rot: 12 }).bodyPath).not.toBe(etoile.sample(1).bodyPath)
  })
})

describe('humeurs : melange et formes d yeux', () => {
  it('melanger interpole champ par champ, neutre pour les champs absents', () => {
    const m = melanger({ ...GESTE_NEUTRE, ex: 0.1 }, { ...GESTE_NEUTRE, ex: -0.1, arc: 1 }, 0.5)
    expect(m.ex).toBeCloseTo(0, 6)
    expect(m.arc).toBeCloseTo(0.5, 6)
    expect(m.sy).toBe(1)
  })

  it('l oeil croissant a la meme boite que la gelule a arc nul, et reste proche a arc 1', () => {
    for (const [w, h] of [[24, 46], [42, 17], [36, 14]] as const) {
      const cap = demiEtendueOeil(capsulePath(w, h), 'matrix(1 0 0 1 0 0)')
      const a0 = demiEtendueOeil(arcPath(w, h, 0), 'matrix(1 0 0 1 0 0)')
      expect(a0).toBeCloseTo(cap, 0)
      const a1 = demiEtendueOeil(arcPath(w, h, 1), 'matrix(1 0 0 1 0 0)')
      expect(a1).toBeGreaterThan(0)
      expect(a1).toBeLessThan(cap * 1.4)
      expect(arcPath(w, h, 1)).not.toMatch(/NaN/)
    }
  })
})

describe('humeurs : cadence', () => {
  it('plafonne les redessins a fps images par seconde, sans rien changer sans plafond', () => {
    const compte = (fps?: number) => {
      let n = 0
      let dernier = 0
      for (let ms = 16; ms <= 1000; ms += 1000 / 60) {
        if (doitRedessiner(ms, dernier, fps)) {
          n++
          dernier = ms
        }
      }
      return n
    }
    expect(compte()).toBeGreaterThanOrEqual(58)
    expect(compte(12)).toBeGreaterThanOrEqual(11)
    expect(compte(12)).toBeLessThanOrEqual(13)
    expect(compte(0)).toBe(compte())
  })
})

describe('coucou : le Mochi pousse depuis le sol', () => {
  it('part de presque rien, depasse un peu (105 a 108 %) puis revient a 100 % en 0,4 a 0,6 s', () => {
    expect(COUCOU_POUSSE).toBeGreaterThanOrEqual(0.4)
    expect(COUCOU_POUSSE).toBeLessThanOrEqual(0.6)
    expect(coucouEchelle(0)).toBeLessThan(0.05)
    let max = 0
    for (let i = 0; i <= 100; i++) max = Math.max(max, coucouEchelle((i / 100) * COUCOU_POUSSE))
    expect(max).toBeGreaterThan(1.05)
    expect(max).toBeLessThan(1.09)
    expect(coucouEchelle(COUCOU_POUSSE)).toBeCloseTo(1, 6)
  })

  it('le bas du corps reste pose sur le sol pendant la pousse, et le geste habituel suit', () => {
    const h = new Humeurs('repos')
    h.react('coucou', 0)
    for (const t of [0.05, 0.15, 0.3, 0.45]) {
      const g = h.sample(t)!
      expect(g.sy, String(t)).toBeCloseTo(coucouEchelle(t), 2)
      expect(g.sx).toBeCloseTo(coucouEchelle(t), 2)
      // dy = (1 - sy) * 0.92 : le centre descend autant que le corps raccourcit
      expect(g.dy).toBeCloseTo((1 - g.sy) * 0.92, 1)
    }
    // apres la pousse, le saut d'avant (ecrasement) est bien la
    const saut = h.sample(COUCOU_POUSSE + 0.14)!
    expect(saut.sy).toBeLessThan(0.95)
  })

  it('en mouvement reduit : pas de pousse (le composant fait un simple fondu)', () => {
    const h = new Humeurs('repos', { reduit: true })
    expect(h.react('coucou', 0)).toBe(false)
    expect(h.sample(0.1)?.sx ?? 1).toBe(1)
  })
})

describe('travaille : il tape sur son ordinateur', () => {
  it('rebonds irreguliers, regard baisse pendant la frappe, pause sans rebond, boucle sans saut', () => {
    const h = new Humeurs('travaille')
    const t0 = h.sample(0)!
    const fin = h.sample(3.999)!
    expect(Math.abs(t0.sy - fin.sy)).toBeLessThan(0.01)
    expect(Math.abs((t0.rot ?? 0) - (fin.rot ?? 0))).toBeLessThan(0.3)
    // pendant la frappe le regard est plus bas qu'en pause
    const frappe = h.sample(0.9)!
    const pause = h.sample(1.75)!
    expect((frappe.ey ?? 0)).toBeGreaterThan((pause.ey ?? 0) + 0.08)
    // les ecrasements ne sont pas regulieres : au moins 5 instants distincts a moins de 0,2 s d'ecart
    let creux = 0
    let prev = 1
    for (let t = 0.2; t < 1.5; t += 0.01) {
      const sy = h.sample(t)!.sy
      if (sy < 0.99 && prev >= 0.99) creux++
      prev = sy
    }
    expect(creux).toBeGreaterThanOrEqual(5)
    // il penche des deux cotes
    let min = 0
    let max = 0
    for (let t = 0.2; t < 3.6; t += 0.01) {
      const r = h.sample(t)!.rot ?? 0
      min = Math.min(min, r)
      max = Math.max(max, r)
    }
    expect(min).toBeLessThan(-0.5)
    expect(max).toBeGreaterThan(0.5)
  })
})

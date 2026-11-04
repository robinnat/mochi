import { describe, expect, it } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPES } from '@/bot/skins'
import {
  aireSignee,
  ANNEAUX,
  centreDe,
  contourDuCorps,
  yeuxDeFace,
  demiEtendueOeil,
  distanceAuBord,
  hauteur,
  indicesVolume,
  PROFILS,
  profilDe,
  souderNormales,
  gonfler,
  lireMatrice,
  sommets,
  SOUS_PAS
} from './volume'

/**
 * Le volume 3D est une fonction pure de l'image du moteur. Ce qui est verrouille : la
 * boule reste une sphere, toutes les formes donnent un corps ferme et oriente vers le
 * spectateur, et le moteur n'est pas touche (le rendu lit sa sortie, rien de plus).
 */

const image = (forme = 'cercle', t = 0.5) =>
  new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === forme)!.radii, null).sample(t)

describe('contour relu sur le bodyPath', () => {
  it('suit la courbe : 64 cubiques, SOUS_PAS points chacune, sur le cercle de rayon 100', () => {
    const pts = contourDuCorps(image().bodyPath)
    expect(pts).toHaveLength(64 * SOUS_PAS)
    const c = centreDe(pts)
    for (const p of pts) expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeCloseTo(RAYON, -0.5)
    expect(aireSignee(pts)).toBeGreaterThan(0)
  })

  it('rend un contour vide pour un chemin vide', () => {
    expect(contourDuCorps('')).toEqual([])
  })
})

describe('gonflage', () => {
  it('donne exactement une sphere sur le cercle', () => {
    const H = 100
    // arrondi = H : la hauteur a la distance d du bord est celle d'une sphere de rayon H
    expect(hauteur(0, H, H)).toBeCloseTo(0, 6)
    expect(hauteur(H, H, H)).toBe(H)
    const d = 40
    expect(Math.hypot(H - d, hauteur(d, H, H))).toBeCloseTo(H, 6)
    // sur un vrai contour de cercle, chaque sommet est sur la sphere de rayon 100
    const pts = contourDuCorps(image().bodyPath)
    const v = gonfler(pts, DEMI_VIEWBOX, undefined, undefined, PROFILS.cercle)
    const c = centreDe(pts)
    for (let i = 1; i <= ANNEAUX * pts.length; i += 7) {
      const r = Math.hypot(v.positions[i * 3]! - c.x, v.positions[i * 3 + 1]! - c.y, v.positions[i * 3 + 2]!)
      expect(r).toBeGreaterThan(95)
      expect(r).toBeLessThan(105)
    }
  })

  it('ferme le corps (aux soudures de texture pres) et oriente les faces vers le spectateur', () => {
    for (const forme of SHAPES) {
      const pts = contourDuCorps(image(forme.id).bodyPath)
      const v = gonfler(pts, DEMI_VIEWBOX, undefined, undefined, profilDe(forme.id))
      expect(v.positions.length).toBe(sommets(pts.length) * 3)
      // le bord avant et le mur sont dedoubles (texture) : on les soude par position,
      // puis chaque arete d'un corps ferme appartient a exactement deux triangles
      const P = v.positions
      const soude = new Map<string, number>()
      const rang = (i: number) => {
        const k = `${P[i * 3]!.toFixed(3)},${P[i * 3 + 1]!.toFixed(3)},${P[i * 3 + 2]!.toFixed(3)}`
        if (!soude.has(k)) soude.set(k, soude.size)
        return soude.get(k)!
      }
      const aretes = new Map<string, number>()
      for (let i = 0; i < v.index.length; i += 3) {
        const t = [rang(v.index[i]!), rang(v.index[i + 1]!), rang(v.index[i + 2]!)]
        if (new Set(t).size < 3) continue // triangle degenere (mur de hauteur nulle)
        for (let j = 0; j < 3; j++) {
          const a = t[j]!
          const b = t[(j + 1) % 3]!
          const k = a < b ? `${a}-${b}` : `${b}-${a}`
          aretes.set(k, (aretes.get(k) ?? 0) + 1)
        }
      }
      for (const n of aretes.values()) expect(n, forme.id).toBe(2)
      // eventail avant (premier triangle de chaque rayon) : la normale, repere Three
      // (y retourne), pointe vers le spectateur
      const parRayon = 3 * (2 + 4 * (ANNEAUX - 1) + 2)
      for (let i = 0; i < v.index.length; i += parRayon) {
        const [a, b, c] = [v.index[i]!, v.index[i + 1]!, v.index[i + 2]!]
        const ax = P[b * 3]! - P[a * 3]!
        const ay = -(P[b * 3 + 1]! - P[a * 3 + 1]!)
        const bx = P[c * 3]! - P[a * 3]!
        const by = -(P[c * 3 + 1]! - P[a * 3 + 1]!)
        expect(ax * by - ay * bx, forme.id).toBeGreaterThan(0)
      }
    }
  })

  it('le mur regarde vers l exterieur (normale horizontale, vers le large)', () => {
    const pts = contourDuCorps(image('squircle').bodyPath)
    const v = gonfler(pts, DEMI_VIEWBOX, undefined, undefined, PROFILS.squircle)
    const P = v.positions
    const { mur, arriere } = indicesVolume(pts.length)
    const c = centreDe(pts)
    let sortant = 0
    for (let k = 0; k < pts.length; k++) {
      // triangle du mur : (mur k, mur k+1, pied k+1), repere moteur (y vers le bas)
      const a = mur(k)
      const b = mur(k + 1)
      const d = arriere(ANNEAUX, k + 1)
      const u = [P[b * 3]! - P[a * 3]!, -(P[b * 3 + 1]! - P[a * 3 + 1]!), P[b * 3 + 2]! - P[a * 3 + 2]!]
      const w = [P[d * 3]! - P[a * 3]!, -(P[d * 3 + 1]! - P[a * 3 + 1]!), P[d * 3 + 2]! - P[a * 3 + 2]!]
      const nx = u[1]! * w[2]! - u[2]! * w[1]!
      const ny = u[2]! * w[0]! - u[0]! * w[2]!
      if (nx * (P[a * 3]! - c.x) + ny * -(P[a * 3 + 1]! - c.y) > 0) sortant++
    }
    expect(sortant).toBe(pts.length)
  })

  it('le carre est un galet-cube : profond comme large, aretes tres arrondies, encore un plateau', () => {
    const pts = contourDuCorps(image('squircle').bodyPath)
    const v = gonfler(pts, DEMI_VIEWBOX, undefined, undefined, profilDe('squircle'))
    let zmin = Infinity
    let zmax = -Infinity
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (let i = 0; i < v.positions.length; i += 3) {
      zmin = Math.min(zmin, v.positions[i + 2]!)
      zmax = Math.max(zmax, v.positions[i + 2]!)
      x0 = Math.min(x0, v.positions[i]!)
      x1 = Math.max(x1, v.positions[i]!)
      y0 = Math.min(y0, v.positions[i + 1]!)
      y1 = Math.max(y1, v.positions[i + 1]!)
    }
    const largeur = Math.min(x1 - x0, y1 - y0)
    expect((zmax - zmin) / largeur).toBeCloseTo(1, 1)
    // arrondi genereux (0,78 de la demi-profondeur) mais pas une boule : il reste un mur et un plateau
    expect(v.mesures.zw).toBeGreaterThan(0.1 * v.mesures.H)
    expect(v.mesures.zw).toBeLessThan(0.4 * v.mesures.H)
    // la face avant est plane : le plateau est a la hauteur maximale
    const sommetsAuMax = Array.from({ length: v.positions.length / 3 }, (_, i) => v.positions[i * 3 + 2]!).filter(
      (z) => Math.abs(z - zmax) < 1e-3
    )
    expect(sommetsAuMax.length).toBeGreaterThan(pts.length)
  })

  it.each(SHAPES.map((s) => s.id))('%s : profondeur d au moins 0,4 fois la largeur (0,6 pour les corps non extrudes)', (id) => {
    const pts = contourDuCorps(image(id).bodyPath)
    const v = gonfler(pts, DEMI_VIEWBOX, undefined, undefined, profilDe(id))
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    let zmin = Infinity
    let zmax = -Infinity
    for (let i = 0; i < v.positions.length; i += 3) {
      x0 = Math.min(x0, v.positions[i]!)
      x1 = Math.max(x1, v.positions[i]!)
      y0 = Math.min(y0, v.positions[i + 1]!)
      y1 = Math.max(y1, v.positions[i + 1]!)
      zmin = Math.min(zmin, v.positions[i + 2]!)
      zmax = Math.max(zmax, v.positions[i + 2]!)
    }
    expect((zmax - zmin) / Math.min(x1 - x0, y1 - y0)).toBeGreaterThanOrEqual(['etoile', 'fleur', 'hexagone'].includes(id) ? 0.4 : 0.6)
  })

  it('la hauteur ne depend que de la distance au bord : raccord au mur, plateau plat', () => {
    expect(hauteur(0, 100, 40)).toBeCloseTo(60, 6)
    expect(hauteur(40, 100, 40)).toBe(100)
    expect(hauteur(400, 100, 40)).toBe(100)
    // tangente verticale au bord : la pente tend vers l'infini
    expect(hauteur(0.01, 100, 40) - hauteur(0, 100, 40)).toBeGreaterThan(0.5)
  })

  it('mesure la distance au bord', () => {
    const pts = contourDuCorps(image().bodyPath)
    expect(distanceAuBord(pts, 0, 0)).toBeCloseTo(100, -0.5)
    expect(distanceAuBord(pts, 90, 0)).toBeCloseTo(10, -0.5)
  })

  it('reutilise ses tampons d une image a l autre', () => {
    const pts = contourDuCorps(image().bodyPath)
    const v = gonfler(pts, DEMI_VIEWBOX)
    const w = gonfler(contourDuCorps(image('cercle', 1.2).bodyPath), DEMI_VIEWBOX, v)
    expect(w.positions).toBe(v.positions)
  })

  it('pose le bas du corps et peint les yeux seulement devant', () => {
    const v = gonfler(contourDuCorps(image().bodyPath), DEMI_VIEWBOX)
    expect(v.bas).toBeGreaterThan(95)
    expect(v.bas).toBeLessThan(105)
    const n = 64 * SOUS_PAS
    const { arriere, mur } = indicesVolume(n)
    expect(v.uvs[arriere(3, 5) * 2]).toBeCloseTo(0.002)
    // le mur n'a pas de visage non plus : aucun oeil ne glisse sur le cote
    expect(v.uvs[mur(5) * 2]).toBeCloseTo(0.002)
    // centre avant : milieu du viewBox
    expect(v.uvs[0]).toBeCloseTo(0.5, 1)
  })
})

describe('matrice des yeux', () => {
  it('lit la matrice du moteur, y compris en notation exponentielle', () => {
    expect(lireMatrice('matrix(1 0 0 1 -5.5 3)')).toEqual([1, 0, 0, 1, -5.5, 3])
    expect(lireMatrice('matrix(1e-7 0 0 1 0 0)')[0]).toBeCloseTo(0)
    expect(lireMatrice('n importe quoi')).toEqual([1, 0, 0, 1, 0, 0])
    for (const eye of image().eyes) expect(lireMatrice(eye.matrix)).toHaveLength(6)
  })
})

describe('normales du bord', () => {
  it('rend horizontales les normales du bord avant, du mur et du pied', () => {
    const n = 6
    const N = new Float32Array(sommets(n) * 3).fill(0.3)
    souderNormales(N, n)
    const { avant, mur, arriere } = indicesVolume(n)
    for (const i of [avant(ANNEAUX, 2), mur(2), arriere(ANNEAUX, 2)]) {
      expect(N[i * 3 + 2]).toBe(0)
      expect(Math.hypot(N[i * 3]!, N[i * 3 + 1]!)).toBeCloseTo(1, 5)
    }
  })
})

describe('yeux pile en face', () => {
  const demi = (id: string) => image(id).eyes.map((e) => demiEtendueOeil(e.d, 'matrix(1 0 0 1 0 0)'))
  const contour = (id: string) => contourDuCorps(image(id).bodyPath)

  it('lit l etendue d un oeil du moteur', () => {
    const e = image().eyes[0]!
    const r = demiEtendueOeil(e.d, e.matrix)
    expect(r).toBeGreaterThan(10)
    expect(r).toBeLessThan(30)
  })

  it.each(SHAPES.map((s) => s.id))('%s : centres, symetriques, meme taille, au-dessus du centre, sur la face', (id) => {
    const pts = contour(id)
    const profil = profilDe(id)
    const ys = yeuxDeFace(pts, demi(id), profil)
    expect(ys).toHaveLength(2)
    const [g, d] = ys as [(typeof ys)[0], (typeof ys)[0]]
    expect(g.s).toBe(d.s)
    expect(g.y).toBe(d.y)
    // symetriques autour de l'axe de la forme
    expect(Math.abs(g.x + d.x)).toBeLessThan(6)
    expect(d.x).toBeGreaterThan(g.x)
    // un peu au-dessus du centre
    expect(g.y).toBeLessThan(centreDe(pts).y)
    // sur la face : dans le contour, a l'abri du bord
    for (const e of ys) expect(distanceAuBord(pts, e.x, e.y)).toBeGreaterThanOrEqual(e.s * 12)
    expect(g.s).toBeGreaterThanOrEqual(0.5)
  })

  it('garde la taille pleine sur le carre et la sphere, et tient sur l etoile pointue', () => {
    expect(yeuxDeFace(contour('cercle'), demi('cercle'), profilDe('cercle'))[0]!.s).toBe(1)
    expect(yeuxDeFace(contour('squircle'), demi('squircle'), profilDe('squircle'))[0]!.s).toBe(1)
    const e = yeuxDeFace(contour('etoile'), demi('etoile'), profilDe('etoile'))
    expect(e[0]!.s).toBeLessThanOrEqual(1)
    expect(e[0]!.s).toBeGreaterThanOrEqual(0.5)
  })
})

describe('pyramide', () => {
  it('la profondeur croit de la pointe a la base, face avant inclinee', () => {
    const pts = contourDuCorps(image('triangle').bodyPath)
    const v = gonfler(pts, DEMI_VIEWBOX, undefined, undefined, profilDe('triangle'))
    const { y0, y1 } = v.mesures
    const zAu = (cible: number) => {
      let m = 0
      for (let i = 0; i < v.positions.length; i += 3)
        if (Math.abs(v.positions[i + 1]! - cible) < 3) m = Math.max(m, v.positions[i + 2]!)
      return m
    }
    const haut = zAu(y0 + 0.15 * (y1 - y0))
    const milieu = zAu(y0 + 0.55 * (y1 - y0))
    const bas = zAu(y1 - 6)
    expect(haut).toBeLessThan(milieu)
    expect(milieu).toBeLessThan(bas)
    expect(bas).toBeGreaterThan(0.35 * (pts.reduce((m, p) => Math.max(m, p.x), 0) * 2))
  })
})

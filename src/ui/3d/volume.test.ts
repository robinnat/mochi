import { describe, expect, it } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'
import { SHAPES } from '@/bot/skins'
import {
  aireSignee,
  RINGS,
  centerOf,
  fieldCushion,
  fieldOfIdle,
  heightNorm,
  heightCushion,
  bodyOutline,
  frontEyes,
  halfExtentEye,
  distanceAtEdge,
  height,
  indicesVolume,
  PROFILES,
  profileOf,
  weldNormals,
  inflate,
  readMatrix,
  vertices,
  SUB_STEP
} from './volume'

/**
 * Le volume 3D est une fonction pure de l'image du moteur. Ce qui est verrouille : la
 * boule reste une sphere, toutes les formes donnent un corps ferme et oriente vers le
 * spectateur, et le moteur n'est pas touche (le rendu lit sa sortie, rien de plus).
 */

const image = (shape = 'circle', t = 0.5) =>
  new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === shape)!.radii, null).sample(t)

describe('contour relu sur le bodyPath', () => {
  it('suit la courbe : 64 cubiques, SOUS_PAS points chacune, sur le cercle de rayon 100', () => {
    const pts = bodyOutline(image().bodyPath)
    expect(pts).toHaveLength(64 * SUB_STEP)
    const c = centerOf(pts)
    for (const p of pts) expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeCloseTo(RADIUS, -0.5)
    expect(aireSignee(pts)).toBeGreaterThan(0)
  })

  it('rend un contour vide pour un chemin vide', () => {
    expect(bodyOutline('')).toEqual([])
  })
})

describe('inflation', () => {
  it('donne exactement une sphere sur le cercle', () => {
    const H = 100
    // arrondi = H : la hauteur a la distance d du bord est celle d'une sphere de rayon H
    expect(height(0, H, H)).toBeCloseTo(0, 6)
    expect(height(H, H, H)).toBe(H)
    const d = 40
    expect(Math.hypot(H - d, height(d, H, H))).toBeCloseTo(H, 6)
    // sur un vrai contour de cercle, chaque sommet est sur la sphere de rayon 100
    const pts = bodyOutline(image().bodyPath)
    const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, PROFILES.circle)
    const c = centerOf(pts)
    for (let i = 1; i <= RINGS * pts.length; i += 7) {
      const r = Math.hypot(v.positions[i * 3]! - c.x, v.positions[i * 3 + 1]! - c.y, v.positions[i * 3 + 2]!)
      expect(r).toBeGreaterThan(95)
      expect(r).toBeLessThan(105)
    }
  })

  it('ferme le corps (aux soudures de texture pres) et oriente les faces vers le spectateur', () => {
    for (const shape of SHAPES) {
      const pts = bodyOutline(image(shape.id).bodyPath)
      const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, profileOf(shape.id))
      expect(v.positions.length).toBe(vertices(pts.length) * 3)
      // le bord avant et le mur sont dedoubles (texture) : on les soude par position,
      // puis chaque arete d'un corps ferme appartient a exactement deux triangles
      const P = v.positions
      const welded = new Map<string, number>()
      const rang = (i: number) => {
        const k = `${P[i * 3]!.toFixed(3)},${P[i * 3 + 1]!.toFixed(3)},${P[i * 3 + 2]!.toFixed(3)}`
        if (!welded.has(k)) welded.set(k, welded.size)
        return welded.get(k)!
      }
      const edges = new Map<string, number>()
      for (let i = 0; i < v.index.length; i += 3) {
        const t = [rang(v.index[i]!), rang(v.index[i + 1]!), rang(v.index[i + 2]!)]
        if (new Set(t).size < 3) continue // triangle degenere (mur de hauteur nulle)
        for (let j = 0; j < 3; j++) {
          const a = t[j]!
          const b = t[(j + 1) % 3]!
          const k = a < b ? `${a}-${b}` : `${b}-${a}`
          edges.set(k, (edges.get(k) ?? 0) + 1)
        }
      }
      for (const n of edges.values()) expect(n, shape.id).toBe(2)
      // eventail avant (premier triangle de chaque rayon) : la normale, repere Three
      // (y retourne), pointe vers le spectateur
      const byRadius = 3 * (2 + 4 * (RINGS - 1) + 2)
      for (let i = 0; i < v.index.length; i += byRadius) {
        const [a, b, c] = [v.index[i]!, v.index[i + 1]!, v.index[i + 2]!]
        const ax = P[b * 3]! - P[a * 3]!
        const ay = -(P[b * 3 + 1]! - P[a * 3 + 1]!)
        const bx = P[c * 3]! - P[a * 3]!
        const by = -(P[c * 3 + 1]! - P[a * 3 + 1]!)
        expect(ax * by - ay * bx, shape.id).toBeGreaterThan(0)
      }
    }
  })

  it('le mur regarde vers l exterieur (normale horizontale, vers le large)', () => {
    const pts = bodyOutline(image('squircle').bodyPath)
    const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, PROFILES.squircle)
    const P = v.positions
    const { wall, back } = indicesVolume(pts.length)
    const c = centerOf(pts)
    let outgoing = 0
    for (let k = 0; k < pts.length; k++) {
      // triangle du mur : (mur k, mur k+1, pied k+1), repere moteur (y vers le bas)
      const a = wall(k)
      const b = wall(k + 1)
      const d = back(RINGS, k + 1)
      const u = [P[b * 3]! - P[a * 3]!, -(P[b * 3 + 1]! - P[a * 3 + 1]!), P[b * 3 + 2]! - P[a * 3 + 2]!]
      const w = [P[d * 3]! - P[a * 3]!, -(P[d * 3 + 1]! - P[a * 3 + 1]!), P[d * 3 + 2]! - P[a * 3 + 2]!]
      const nx = u[1]! * w[2]! - u[2]! * w[1]!
      const ny = u[2]! * w[0]! - u[0]! * w[2]!
      if (nx * (P[a * 3]! - c.x) + ny * -(P[a * 3 + 1]! - c.y) > 0) outgoing++
    }
    expect(outgoing).toBe(pts.length)
  })

  it('le carre est un galet-cube : profond comme large, aretes tres arrondies, encore un plateau', () => {
    const pts = bodyOutline(image('squircle').bodyPath)
    const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, profileOf('squircle'))
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
    const width = Math.min(x1 - x0, y1 - y0)
    expect((zmax - zmin) / width).toBeCloseTo(1, 1)
    // arrondi genereux (0,78 de la demi-profondeur) mais pas une boule : il reste un mur et un plateau
    expect(v.measures.zw).toBeGreaterThan(0.1 * v.measures.H)
    expect(v.measures.zw).toBeLessThan(0.4 * v.measures.H)
    // la face avant est plane : le plateau est a la hauteur maximale
    const verticesAtMax = Array.from({ length: v.positions.length / 3 }, (_, i) => v.positions[i * 3 + 2]!).filter(
      (z) => Math.abs(z - zmax) < 1e-3
    )
    expect(verticesAtMax.length).toBeGreaterThan(pts.length)
  })

  it.each(SHAPES.map((s) => s.id))('%s : profondeur d au moins 0,4 fois la largeur (0,6 pour les corps non extrudes)', (id) => {
    const pts = bodyOutline(image(id).bodyPath)
    const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, profileOf(id))
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
    expect((zmax - zmin) / Math.min(x1 - x0, y1 - y0)).toBeGreaterThanOrEqual(['star', 'flower', 'hexagon', 'heart'].includes(id) ? 0.4 : 0.6)
  })

  it('la hauteur ne depend que de la distance au bord : raccord au mur, plateau plat', () => {
    expect(height(0, 100, 40)).toBeCloseTo(60, 6)
    expect(height(40, 100, 40)).toBe(100)
    expect(height(400, 100, 40)).toBe(100)
    // tangente verticale au bord : la pente tend vers l'infini
    expect(height(0.01, 100, 40) - height(0, 100, 40)).toBeGreaterThan(0.5)
  })

  it('mesure la distance au bord', () => {
    const pts = bodyOutline(image().bodyPath)
    expect(distanceAtEdge(pts, 0, 0)).toBeCloseTo(100, -0.5)
    expect(distanceAtEdge(pts, 90, 0)).toBeCloseTo(10, -0.5)
  })

  it('reutilise ses tampons d une image a l autre', () => {
    const pts = bodyOutline(image().bodyPath)
    const v = inflate(pts, HALF_VIEWBOX)
    const w = inflate(bodyOutline(image('circle', 1.2).bodyPath), HALF_VIEWBOX, v)
    expect(w.positions).toBe(v.positions)
  })

  it('pose le bas du corps et peint les yeux seulement devant', () => {
    const v = inflate(bodyOutline(image().bodyPath), HALF_VIEWBOX)
    expect(v.neck).toBeGreaterThan(95)
    expect(v.neck).toBeLessThan(105)
    const n = 64 * SUB_STEP
    const { back, wall } = indicesVolume(n)
    expect(v.uvs[back(3, 5) * 2]).toBeCloseTo(0.002)
    // le mur n'a pas de visage non plus : aucun oeil ne glisse sur le cote
    expect(v.uvs[wall(5) * 2]).toBeCloseTo(0.002)
    // centre avant : milieu du viewBox
    expect(v.uvs[0]).toBeCloseTo(0.5, 1)
  })
})

describe('matrice des yeux', () => {
  it('lit la matrice du moteur, y compris en notation exponentielle', () => {
    expect(readMatrix('matrix(1 0 0 1 -5.5 3)')).toEqual([1, 0, 0, 1, -5.5, 3])
    expect(readMatrix('matrix(1e-7 0 0 1 0 0)')[0]).toBeCloseTo(0)
    expect(readMatrix('n importe quoi')).toEqual([1, 0, 0, 1, 0, 0])
    for (const eye of image().eyes) expect(readMatrix(eye.matrix)).toHaveLength(6)
  })
})

describe('normales du bord', () => {
  it('rend horizontales les normales du bord avant, du mur et du pied', () => {
    const n = 6
    const N = new Float32Array(vertices(n) * 3).fill(0.3)
    weldNormals(N, n)
    const { before, wall, back } = indicesVolume(n)
    for (const i of [before(RINGS, 2), wall(2), back(RINGS, 2)]) {
      expect(N[i * 3 + 2]).toBe(0)
      expect(Math.hypot(N[i * 3]!, N[i * 3 + 1]!)).toBeCloseTo(1, 5)
    }
  })
})

describe('yeux pile en face', () => {
  const half = (id: string) => image(id).eyes.map((e) => halfExtentEye(e.d, 'matrix(1 0 0 1 0 0)'))
  const outline = (id: string) => bodyOutline(image(id).bodyPath)

  it('lit l etendue d un oeil du moteur', () => {
    const e = image().eyes[0]!
    const r = halfExtentEye(e.d, e.matrix)
    expect(r).toBeGreaterThan(10)
    expect(r).toBeLessThan(30)
  })

  it.each(SHAPES.map((s) => s.id))('%s : centres, symetriques, meme taille, au-dessus du centre, sur la face', (id) => {
    const pts = outline(id)
    const profile = profileOf(id)
    const ys = frontEyes(pts, half(id), profile)
    expect(ys).toHaveLength(2)
    const [g, d] = ys as [(typeof ys)[0], (typeof ys)[0]]
    expect(g.s).toBe(d.s)
    expect(g.y).toBe(d.y)
    // symetriques autour de l'axe de la forme
    expect(Math.abs(g.x + d.x)).toBeLessThan(6)
    expect(d.x).toBeGreaterThan(g.x)
    // un peu au-dessus du centre
    expect(g.y).toBeLessThan(centerOf(pts).y)
    // sur la face : dans le contour, a l'abri du bord
    for (const e of ys) expect(distanceAtEdge(pts, e.x, e.y)).toBeGreaterThanOrEqual(e.s * 12)
    expect(g.s).toBeGreaterThanOrEqual(0.5)
  })

  it('garde la taille pleine sur le carre et la sphere, et tient sur l etoile pointue', () => {
    expect(frontEyes(outline('circle'), half('circle'), profileOf('circle'))[0]!.s).toBe(1)
    expect(frontEyes(outline('squircle'), half('squircle'), profileOf('squircle'))[0]!.s).toBe(1)
    const e = frontEyes(outline('star'), half('star'), profileOf('star'))
    expect(e[0]!.s).toBeLessThanOrEqual(1)
    expect(e[0]!.s).toBeGreaterThanOrEqual(0.5)
  })
})

describe('pyramid', () => {
  it('la profondeur croit de la pointe a la base, face avant inclinee', () => {
    const pts = bodyOutline(image('triangle').bodyPath)
    const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, profileOf('triangle'))
    const { y0, y1 } = v.measures
    const zAt = (target: number) => {
      let m = 0
      for (let i = 0; i < v.positions.length; i += 3)
        if (Math.abs(v.positions[i + 1]! - target) < 3) m = Math.max(m, v.positions[i + 2]!)
      return m
    }
    const top = zAt(y0 + 0.15 * (y1 - y0))
    const middle = zAt(y0 + 0.55 * (y1 - y0))
    const neck = zAt(y1 - 6)
    expect(top).toBeLessThan(middle)
    expect(middle).toBeLessThan(neck)
    expect(neck).toBeGreaterThan(0.35 * (pts.reduce((m, p) => Math.max(m, p.x), 0) * 2))
  })
})

describe('gonflage coussin', () => {
  const outline = (id: string) => bodyOutline(image(id).bodyPath)

  it.each(['star', 'hexagon', 'cloud', 'flower', 'heart'])('%s : champ lisse, nul dehors, maximal a l interieur', (id) => {
    const pts = outline(id)
    const field = fieldCushion(pts, `test:${id}`)
    let cx = 0
    let cy = 0
    for (const p of pts) {
      cx += p.x / pts.length
      cy += p.y / pts.length
    }
    expect(heightCushion(field, cx, cy)).toBeGreaterThan(0.6)
    // loin du contour, la hauteur est nulle
    expect(heightCushion(field, field.x0 + 1, field.y0 + 1)).toBe(0)
    // pas de saut : deux points voisins different peu (surface continue, sans arete)
    const step = field.step
    let worst = 0
    for (let k = 0; k < 40; k++) {
      const p = pts[(k * 7) % pts.length]!
      const x = cx + (p.x - cx) * 0.5
      const y = cy + (p.y - cy) * 0.5
      worst = Math.max(worst, Math.abs(heightCushion(field, x + step, y) - heightCushion(field, x, y)))
    }
    expect(worst).toBeLessThan(0.12)
  })

  it('le champ est calcule une fois sur le contour de repos, puis reutilise pour un contour ecrase ou decale', () => {
    const idle = fieldOfIdle('star')!
    expect(idle).toBe(fieldOfIdle('star'))
    // un contour ecrase (gestes) et decale : aucun nouveau champ, memes valeurs normalisees
    const pts = outline('star').map((p) => ({ x: p.x * 1.15 + 6, y: p.y * 0.8 - 4 }))
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) inflate(pts, HALF_VIEWBOX, undefined, undefined, profileOf('star'))
    expect((performance.now() - t0) / 20).toBeLessThan(15)
    expect(fieldOfIdle('star')).toBe(idle)
    expect(heightNorm(idle, 0.5, 0.55)).toBeGreaterThan(0.6)
  })

  it("le volume d'une forme coussin a le meme nombre de sommets et reste ferme", () => {
    for (const id of ['star', 'hexagon', 'cloud', 'flower', 'heart']) {
      const v = inflate(outline(id), HALF_VIEWBOX, undefined, undefined, profileOf(id))
      expect(v.positions.every(Number.isFinite)).toBe(true)
      let zmax = 0
      for (let i = 2; i < v.positions.length; i += 3) zmax = Math.max(zmax, Math.abs(v.positions[i]!))
      expect(zmax).toBeGreaterThan(20)
    }
  })
})

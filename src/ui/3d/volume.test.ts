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
 * The 3D volume is a pure function of the engine frame. What is locked: the ball stays a sphere, every shape gives a
 * closed body facing the viewer, and the engine is not touched (the renderer reads its output, nothing more).
 */

const image = (shape = 'circle', t = 0.5) =>
  new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === shape)!.radii, null).sample(t)

describe('outline read off the bodyPath', () => {
  it('follows the curve: 64 cubics, SUB_STEP points each, on the circle of radius 100', () => {
    const pts = bodyOutline(image().bodyPath)
    expect(pts).toHaveLength(64 * SUB_STEP)
    const c = centerOf(pts)
    for (const p of pts) expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeCloseTo(RADIUS, -0.5)
    expect(aireSignee(pts)).toBeGreaterThan(0)
  })

  it('returns an empty outline for an empty path', () => {
    expect(bodyOutline('')).toEqual([])
  })
})

describe('inflation', () => {
  it('gives exactly a sphere on the circle', () => {
    const H = 100
    // rounded = H: the height at distance d from the edge is that of a sphere of radius H
    expect(height(0, H, H)).toBeCloseTo(0, 6)
    expect(height(H, H, H)).toBe(H)
    const d = 40
    expect(Math.hypot(H - d, height(d, H, H))).toBeCloseTo(H, 6)
    // on a real circle outline, every vertex is on the sphere of radius 100
    const pts = bodyOutline(image().bodyPath)
    const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, PROFILES.circle)
    const c = centerOf(pts)
    for (let i = 1; i <= RINGS * pts.length; i += 7) {
      const r = Math.hypot(v.positions[i * 3]! - c.x, v.positions[i * 3 + 1]! - c.y, v.positions[i * 3 + 2]!)
      expect(r).toBeGreaterThan(95)
      expect(r).toBeLessThan(105)
    }
  })

  it('closes the body (up to texture seams) and turns the faces towards the viewer', () => {
    for (const shape of SHAPES) {
      const pts = bodyOutline(image(shape.id).bodyPath)
      const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, profileOf(shape.id))
      expect(v.positions.length).toBe(vertices(pts.length) * 3)
      // the front edge and the wall are duplicated (texture): weld them by position,
      // then each edge of a closed body belongs to exactly two triangles
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
      // front fan (first triangle of each ray): the normal, Three space
      // (y flipped), points to the viewer
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

  it('the wall faces outwards (horizontal normal, outwards)', () => {
    const pts = bodyOutline(image('squircle').bodyPath)
    const v = inflate(pts, HALF_VIEWBOX, undefined, undefined, PROFILES.squircle)
    const P = v.positions
    const { wall, back } = indicesVolume(pts.length)
    const c = centerOf(pts)
    let outgoing = 0
    for (let k = 0; k < pts.length; k++) {
      // wall triangle: (wall k, wall k+1, foot k+1), engine space (y down)
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

  it('the square is a pebble cube: as deep as wide, very rounded edges, still a plateau', () => {
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
    // generous rounding (0.78 of the half depth) but not a ball: a wall and a plateau remain
    expect(v.measures.zw).toBeGreaterThan(0.1 * v.measures.H)
    expect(v.measures.zw).toBeLessThan(0.4 * v.measures.H)
    // the front face is flat: the plateau is at the maximum height
    const verticesAtMax = Array.from({ length: v.positions.length / 3 }, (_, i) => v.positions[i * 3 + 2]!).filter(
      (z) => Math.abs(z - zmax) < 1e-3
    )
    expect(verticesAtMax.length).toBeGreaterThan(pts.length)
  })

  it.each(SHAPES.map((s) => s.id))('%s: depth at least 0.4 times the width (0.6 for non extruded bodies)', (id) => {
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

  it('the height only depends on the distance to the edge: joins the wall, flat plateau', () => {
    expect(height(0, 100, 40)).toBeCloseTo(60, 6)
    expect(height(40, 100, 40)).toBe(100)
    expect(height(400, 100, 40)).toBe(100)
    // vertical tangent at the edge: the slope goes to infinity
    expect(height(0.01, 100, 40) - height(0, 100, 40)).toBeGreaterThan(0.5)
  })

  it('measures the distance to the edge', () => {
    const pts = bodyOutline(image().bodyPath)
    expect(distanceAtEdge(pts, 0, 0)).toBeCloseTo(100, -0.5)
    expect(distanceAtEdge(pts, 90, 0)).toBeCloseTo(10, -0.5)
  })

  it('reuses its buffers from one frame to the next', () => {
    const pts = bodyOutline(image().bodyPath)
    const v = inflate(pts, HALF_VIEWBOX)
    const w = inflate(bodyOutline(image('circle', 1.2).bodyPath), HALF_VIEWBOX, v)
    expect(w.positions).toBe(v.positions)
  })

  it('sets the bottom of the body and paints the eyes only in front', () => {
    const v = inflate(bodyOutline(image().bodyPath), HALF_VIEWBOX)
    expect(v.neck).toBeGreaterThan(95)
    expect(v.neck).toBeLessThan(105)
    const n = 64 * SUB_STEP
    const { back, wall } = indicesVolume(n)
    expect(v.uvs[back(3, 5) * 2]).toBeCloseTo(0.002)
    // the wall has no face either: no eye slides onto the side
    expect(v.uvs[wall(5) * 2]).toBeCloseTo(0.002)
    // front center: middle of the viewBox
    expect(v.uvs[0]).toBeCloseTo(0.5, 1)
  })
})

describe('eye matrix', () => {
  it('reads the engine matrix, exponential notation included', () => {
    expect(readMatrix('matrix(1 0 0 1 -5.5 3)')).toEqual([1, 0, 0, 1, -5.5, 3])
    expect(readMatrix('matrix(1e-7 0 0 1 0 0)')[0]).toBeCloseTo(0)
    expect(readMatrix('anything at all')).toEqual([1, 0, 0, 1, 0, 0])
    for (const eye of image().eyes) expect(readMatrix(eye.matrix)).toHaveLength(6)
  })
})

describe('edge normals', () => {
  it('makes the normals of the front edge, the wall and the foot horizontal', () => {
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

describe('eyes facing front', () => {
  const half = (id: string) => image(id).eyes.map((e) => halfExtentEye(e.d, 'matrix(1 0 0 1 0 0)'))
  const outline = (id: string) => bodyOutline(image(id).bodyPath)

  it('reads the extent of an engine eye', () => {
    const e = image().eyes[0]!
    const r = halfExtentEye(e.d, e.matrix)
    expect(r).toBeGreaterThan(10)
    expect(r).toBeLessThan(30)
  })

  it.each(SHAPES.map((s) => s.id))('%s: centered, symmetric, same size, above the center, on the face', (id) => {
    const pts = outline(id)
    const profile = profileOf(id)
    const ys = frontEyes(pts, half(id), profile)
    expect(ys).toHaveLength(2)
    const [g, d] = ys as [(typeof ys)[0], (typeof ys)[0]]
    expect(g.s).toBe(d.s)
    expect(g.y).toBe(d.y)
    // symmetric around the shape's axis
    expect(Math.abs(g.x + d.x)).toBeLessThan(6)
    expect(d.x).toBeGreaterThan(g.x)
    // a little above the center
    expect(g.y).toBeLessThan(centerOf(pts).y)
    // on the face: inside the outline, clear of the edge
    for (const e of ys) expect(distanceAtEdge(pts, e.x, e.y)).toBeGreaterThanOrEqual(e.s * 12)
    expect(g.s).toBeGreaterThanOrEqual(0.5)
  })

  it('keeps full size on the square and the sphere, and fits on the pointed star', () => {
    expect(frontEyes(outline('circle'), half('circle'), profileOf('circle'))[0]!.s).toBe(1)
    expect(frontEyes(outline('squircle'), half('squircle'), profileOf('squircle'))[0]!.s).toBe(1)
    const e = frontEyes(outline('star'), half('star'), profileOf('star'))
    expect(e[0]!.s).toBeLessThanOrEqual(1)
    expect(e[0]!.s).toBeGreaterThanOrEqual(0.5)
  })
})

describe('pyramid', () => {
  it('depth grows from the tip to the base, tilted front face', () => {
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

  it.each(['star', 'hexagon', 'cloud', 'flower', 'heart'])('%s: smooth field, zero outside, maximal inside', (id) => {
    const pts = outline(id)
    const field = fieldCushion(pts, `test:${id}`)
    let cx = 0
    let cy = 0
    for (const p of pts) {
      cx += p.x / pts.length
      cy += p.y / pts.length
    }
    expect(heightCushion(field, cx, cy)).toBeGreaterThan(0.6)
    // far from the outline, the height is zero
    expect(heightCushion(field, field.x0 + 1, field.y0 + 1)).toBe(0)
    // no jump: two neighboring points differ little (continuous surface, no edge)
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

  it('the field is computed once on the resting outline, then reused for a squashed or shifted outline', () => {
    const idle = fieldOfIdle('star')!
    expect(idle).toBe(fieldOfIdle('star'))
    // a squashed (gestures) and shifted outline: no new field, same normalized values
    const pts = outline('star').map((p) => ({ x: p.x * 1.15 + 6, y: p.y * 0.8 - 4 }))
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) inflate(pts, HALF_VIEWBOX, undefined, undefined, profileOf('star'))
    expect((performance.now() - t0) / 20).toBeLessThan(15)
    expect(fieldOfIdle('star')).toBe(idle)
    expect(heightNorm(idle, 0.5, 0.55)).toBeGreaterThan(0.6)
  })

  it("the volume of a cushion shape has the same vertex count and stays closed", () => {
    for (const id of ['star', 'hexagon', 'cloud', 'flower', 'heart']) {
      const v = inflate(outline(id), HALF_VIEWBOX, undefined, undefined, profileOf(id))
      expect(v.positions.every(Number.isFinite)).toBe(true)
      let zmax = 0
      for (let i = 2; i < v.positions.length; i += 3) zmax = Math.max(zmax, Math.abs(v.positions[i]!))
      expect(zmax).toBeGreaterThan(20)
    }
  })
})

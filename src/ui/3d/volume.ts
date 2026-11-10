/**
 * 3D volume of an engine frame: the 2D silhouette "inflated" into a closed body.
 *
 * No Three.js dependency here, and no state: pure functions of the output of `engine.sample(t)`, tested under Node.
 * The Three module (`scene3d.ts`) only copies these arrays into its buffers. The engine knows nothing about 3D: it is
 * just one more renderer.
 *
 * Why inflate the outline rather than model each shape: the engine renders one outline per frame (`bodyPath`), which
 * morphs from one state to another. Inflating it works for ALL shapes, the customizer's as well as the silhouettes
 * measured on the video, and follows the morph with nothing more.
 *
 * Frame: the engine's (viewBox units, y DOWN, z towards the viewer). The switch to Three space (y up) happens when
 * the buffers are filled.
 */

import { BotEngine } from '@/bot/engine'
import { RADIUS } from '@/bot/frame'
import type { Point } from '@/bot/shape'
import { SHAPE_BY_ID } from '@/bot/skins'

/** In-between points evaluated on each cubic of the outline. */
export const SUB_STEP = 3
/** Rings from the center to the edge, on each face. */
export const RINGS = 12
/** Half window (in outline points) of the smoothing of the radii that set the thickness. */
export const SMOOTHING = 6

/**
 * Body outline read off the `bodyPath`: `closedPath` emits `M x y` then one cubic `C` per point. Each cubic is
 * evaluated at `SUB_STEP` points, which follows the curve drawn in 2D and not only its 64 vertices.
 */
export function bodyOutline(d: string, step = SUB_STEP): Point[] {
  const m = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d)
  if (!m) return []
  let x0 = Number(m[1])
  let y0 = Number(m[2])
  const out: Point[] = []
  for (const seg of d.slice(m[0].length).split('C')) {
    const n = seg.match(/-?\d+\.?\d*/g)?.map(Number)
    if (!n || n.length < 6) continue
    const [ax, ay, bx, by, cx, cy] = n as [number, number, number, number, number, number]
    for (let k = 0; k < step; k++) {
      const t = k / step
      const u = 1 - t
      out.push({
        x: u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * cx,
        y: u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * cy
      })
    }
    x0 = cx
    y0 = cy
  }
  return out
}

/** Signed area (engine space, y down): positive for a clockwise outline on screen. */
export function aireSignee(pts: Point[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/** Centroid of the polygon's area (not the average of the vertices). */
export function centerOf(pts: Point[]): Point {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    const c = p.x * q.y - q.x * p.y
    a += c
    cx += (p.x + q.x) * c
    cy += (p.y + q.y) * c
  }
  if (Math.abs(a) < 1e-9) {
    const n = Math.max(1, pts.length)
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n }
  }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

/** Radius fraction of each ring: tighter near the edge, where the slope changes fast. */
export const fractions = (rings: number) =>
  Array.from({ length: rings }, (_, i) => Math.sin(((i + 1) / rings) * (Math.PI / 2)))
export const FRACTIONS = fractions(RINGS)

/**
 * Finesse of a volume. The default is the realistic renderer's; the "low poly" variant (`material.ts`) takes a coarse
 * one, so each facet shows.
 */
export interface Finesse {
  rings: number
  smoothing: number
}
export const DEFAULT_FINESSE: Finesse = { rings: RINGS, smoothing: SMOOTHING }

/** Keeps one outline point out of `k` (at least 3 points remain): a coarser outline. */
export function reduce(pts: Point[], k: number): Point[] {
  if (k <= 1) return pts
  const out = pts.filter((_, i) => i % k === 0)
  return out.length >= 3 ? out : pts
}

/**
 * Volume profile of a shape: what is needed to inflate it, without describing it point by point.
 *
 * - `depth`: total depth, as a fraction of the smallest dimension (width or height) of the silhouette. 1 = as deep as
 *   wide (cube, sphere).
 * - `rounded`: radius of the rounded edge, as a fraction of the half depth. 1 = everything is round (sphere, egg,
 *   pebble); 0.4 = a cube with softened edges, FLAT front face and straight sides; in between, a cushion with a
 *   plateau
 *   (flower, cloud).
 * - `back`: the back face is a little less deep (the body rests, it does not float); 1 = symmetric.
 *
 * The profile only depends on the shape, not on the frame: the volume follows the outline's morph, but a cube stays a
 * cube when it squashes or jumps.
 */
export interface ProfileVolume {
  depth: number
  rounded: number
  back: number
  /**
   * Pyramid: the depth is the base's (the width) and decreases linearly to the tip (at the top); tilted front face,
   * flat base underneath, softened edges.
   */
  pyramid?: boolean
  /** Geometric sphere: rings at regular polar angle, z radius = mean radius of the outline. */
  sphere?: boolean
  /**
   * Solid of revolution: the body is a volume of circular section around the vertical axis (`v`: cone, drop, egg) or
   * the horizontal one (`h`: lying capsule). The depth at each point is the half width of the outline at that height
   * (or abscissa): so the body is believable from every angle, with no wall or flat extrusion.
   */
  revolution?: 'v' | 'h'
  /**
   * "Cushion" inflation: the height comes from solving a Poisson equation inside the outline (u = 0 on the edge),
   * then z = H * (u / umax) ^ 0.45. Smooth EVERYWHERE: no edge along the median axis (star, hexagon), lobes melting
   * into each other (cloud, flower), a rounded edge with a vertical tangent, no groove on the side.
   */
  cushion?: boolean
}

/** A cushion with a plateau: used for shapes with no known profile (measured silhouettes, etc.). */
export const DEFAULT_PROFILE: ProfileVolume = { depth: 0.8, rounded: 0.75, back: 0.9 }

export const PROFILES: Record<string, ProfileVolume> = {
  // balls: everything is round, the circle is a REAL sphere (the video's body)
  circle: { depth: 1, rounded: 1, back: 1, sphere: true },
  egg: { depth: 1, rounded: 1, back: 1, revolution: 'v' },
  pebble: { depth: 0.9, rounded: 1, back: 0.9 },
  drop: { depth: 1, rounded: 1, back: 1, revolution: 'v' },
  // the capsule is a lying tube: as deep as high
  capsule: { depth: 1, rounded: 1, back: 1, revolution: 'h' },
  // the square is a CUBE: as deep as wide, flat face, straight sides, round edges
  squircle: { depth: 1, rounded: 0.78, back: 1 },
  // square-based pyramid seen from one face: the depth grows from the tip to the base
  triangle: { depth: 1, rounded: 1, back: 1, revolution: 'v' },
  // hexagon: soft nut, same beveled extrusion
  hexagon: { depth: 0.8, rounded: 0.82, back: 1, cushion: true },
  // extrusion with a big bevel (reference: thick, soft 3D icons): flat faces, edges
  // FULLY rounded like a candy, thickness about 0.45 x the width
  star: { depth: 0.85, rounded: 0.98, back: 1, cushion: true },
  // flower: five round extruded petals, same bevel
  flower: { depth: 0.85, rounded: 0.98, back: 1, cushion: true },
  // heart: domed cushion, dip at the top and a soft tip at the bottom
  heart: { depth: 0.85, rounded: 0.98, back: 1, cushion: true },
  // cloud: domed cushion, validated as is
  cloud: { depth: 1, rounded: 1, back: 1, cushion: true }
}

export const profileOf = (shape?: string | null): ProfileVolume =>
  (shape ? PROFILES[shape] : undefined) ?? DEFAULT_PROFILE

/** A rounding of 1 would keep a zero-height wall: we leave 2 % of the half depth. */
const ROUNDED_MAX = 0.98

/**
 * Measurements of a volume: half depth `H`, edge radius `b` and wall height `zw` (the body edge is at `+zw` in front
 * and `-zw * back` behind).
 */
export function measuresOf(pts: Point[], profile: ProfileVolume) {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.y < y0) y0 = p.y
    if (p.y > y1) y1 = p.y
  }
  const small = Math.max(1, profile.pyramid ? x1 - x0 : Math.min(x1 - x0, y1 - y0))
  const H = (profile.depth * small) / 2
  const b = H * Math.min(ROUNDED_MAX, Math.max(0, profile.rounded))
  return { H, b, zw: H - b, y0, y1 }
}

/**
 * Share of the half depth at height `y`: 1 everywhere, except the pyramid (0.08 at the tip, 1 at the base).
 */
export function partDepth(y: number, m: { y0: number; y1: number }, profile: ProfileVolume): number {
  if (!profile.pyramid) return 1
  const t = (y - m.y0) / Math.max(1e-6, m.y1 - m.y0)
  return 0.08 + 0.92 * Math.min(1, Math.max(0, t))
}

/**
 * Height of the front surface at distance `d` from the edge: a quarter circle of radius `b` joining the wall
 * (vertical tangent at d = 0) then the flat plateau (d >= b). On a circle with b = H it is EXACTLY the sphere.
 */
export function height(d: number, H: number, b: number): number {
  if (d >= b) return H
  const x = b - Math.max(0, d)
  return H - b + Math.sqrt(Math.max(0, b * b - x * x))
}

/**
 * Distance of a point to the edge (segments `startPos - width` to `startPos + width`, closed outline).
 */
function distanceEdge(pts: Point[], x: number, y: number, startPos: number, width: number): number {
  const n = pts.length
  let m = Infinity
  for (let j = -width; j <= width; j++) {
    const a = pts[(startPos + j + n * 4) % n]!
    const c = pts[(startPos + j + 1 + n * 4) % n]!
    const vx = c.x - a.x
    const vy = c.y - a.y
    const l2 = vx * vx + vy * vy
    let t = l2 > 1e-12 ? ((x - a.x) * vx + (y - a.y) * vy) / l2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const dx = x - (a.x + vx * t)
    const dy = y - (a.y + vy * t)
    const d2 = dx * dx + dy * dy
    if (d2 < m) m = d2
  }
  return Math.sqrt(m)
}

/** Distance of a point (x, y) to the edge, over the whole outline. */
export const distanceAtEdge = (pts: Point[], x: number, y: number) =>
  distanceEdge(pts, x, y, 0, Math.floor(pts.length / 2))

export interface Volume {
  /** x, y, z per vertex, engine space */
  positions: Float32Array
  /** u, v per vertex, front projection on the viewBox (eye texture) */
  uvs: Float32Array
  /** triangles; only depend on the number of outline points */
  index: Uint32Array
  /** lowest point of the body (max y, engine space): where it touches the ground */
  neck: number
  center: Point
  /** half depth, edge radius and wall height (engine units) */
  measures: { H: number; b: number; zw: number; y0: number; y1: number }
}

/** Number of vertices of a volume for an outline of `n` points. */
export const vertices = (n: number, rings = RINGS) => 2 + (2 * rings + 1) * n

/**
 * Vertex layout, for `n` outline points and `A` rings:
 *   0                       front center
 *   1 + (a-1) n + k         front ring a (1..A); A = the edge, with the face texture
 *   1 + A n + k             "top wall" ring: same position as the front edge, without the face
 *   1 + (A+1) n             back center
 *   2 + (A+1) n + (a-1) n + k   back ring a (1..A); A = the foot of the wall
 * The wall is a band between the duplicated front edge and the back edge: the face (eyes, highlight) stops at the
 * edge of the front face, and the sides are the body color.
 */
export const indicesVolume = (n: number, rings = RINGS) => ({
  before: (a: number, k: number) => 1 + (a - 1) * n + (k % n),
  wall: (k: number) => 1 + rings * n + (k % n),
  centerBack: 1 + (rings + 1) * n,
  back: (a: number, k: number) => 2 + (rings + 1) * n + (a - 1) * n + (k % n)
})

const indexCache = new Map<string, Uint32Array>()

/** Triangles of a volume with `n` outline points (shared by all volumes with the same n). */
export function indexOfVolume(n: number, rings = RINGS): Uint32Array {
  const key = `${n}|${rings}`
  const already = indexCache.get(key)
  if (already) return already
  const tri: number[] = []
  const { before, wall, centerBack, back } = indicesVolume(n, rings)
  for (let k = 0; k < n; k++) {
    // front face: counterclockwise seen from +z once y is flipped (Three space)
    tri.push(0, before(1, k + 1), before(1, k))
    tri.push(centerBack, back(1, k), back(1, k + 1))
    for (let a = 1; a < rings; a++) {
      tri.push(before(a, k), before(a, k + 1), before(a + 1, k))
      tri.push(before(a, k + 1), before(a + 1, k + 1), before(a + 1, k))
      // back: the path goes from the edge (a + 1) to the center (a)
      tri.push(back(a + 1, k), back(a + 1, k + 1), back(a, k + 1))
      tri.push(back(a + 1, k), back(a, k + 1), back(a, k))
    }
    // the wall: from the duplicated front edge to the back foot
    tri.push(wall(k), wall(k + 1), back(rings, k + 1))
    tri.push(wall(k), back(rings, k + 1), back(rings, k))
  }
  const out = Uint32Array.from(tri)
  indexCache.set(key, out)
  return out
}

/* --------------------------------------------------------------- cushion inflation */

const GRID = 112

export interface FieldCushion {
  /** normalized solution (0 on the edge, 1 at the maximum), GRID x GRID, rows from top to bottom */
  u: Float32Array
  /** grid corner and cell size, in the space of the outline the field was solved on */
  x0: number
  y0: number
  step: number
  /** box of that outline: used to normalize any outline of the same shape (squashed, shifted) */
  bx0: number
  by0: number
  bw: number
  bh: number
}

const fields = new Map<string, FieldCushion>()

/** Point in polygon (ray casting). */
function dedans(pts: Point[], x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!
    const b = pts[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c
  }
  return c
}

/**
 * Solves ∇²u = -1 inside the outline (u = 0 outside) on a grid, by over-relaxation, and keeps the result under `key`.
 * The field is computed ONCE, on the shape's RESTING outline (see `fieldOfIdle`); then any outline of the same shape,
 * squashed or shifted by a gesture, reuses it by normalizing its coordinates with its own box (`heightNorm`).
 */
export function fieldCushion(pts: Point[], key: string): FieldCushion {
  const already = fields.get(key)
  if (already) return already
  let mx0 = Infinity
  let mx1 = -Infinity
  let my0 = Infinity
  let my1 = -Infinity
  for (const p of pts) {
    mx0 = Math.min(mx0, p.x)
    mx1 = Math.max(mx1, p.x)
    my0 = Math.min(my0, p.y)
    my1 = Math.max(my1, p.y)
  }
  const w = Math.max(1e-6, mx1 - mx0)
  const h = Math.max(1e-6, my1 - my0)
  const step = Math.max(w, h) / (GRID - 4)
  const x0 = mx0 - step * 2
  const y0 = my0 - step * 2
  const N = GRID
  const masque = new Uint8Array(N * N)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) masque[j * N + i] = dedans(pts, x0 + (i + 0.5) * step, y0 + (j + 0.5) * step) ? 1 : 0
  }
  const u = new Float32Array(N * N)
  const omega = 1.9
  for (let it = 0; it < 160; it++) {
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        const k = j * N + i
        if (!masque[k]) continue
        const g = (u[k - 1]! + u[k + 1]! + u[k - N]! + u[k + N]! + step * step) / 4
        u[k] = u[k]! + omega * (g - u[k]!)
      }
    }
  }
  let max = 1e-9
  for (let k = 0; k < N * N; k++) if (u[k]! > max) max = u[k]!
  for (let k = 0; k < N * N; k++) u[k] = u[k]! / max
  const field: FieldCushion = { u, x0, y0, step, bx0: mx0, by0: my0, bw: w, bh: h }
  fields.set(key, field)
  if (fields.size > 16) fields.delete(fields.keys().next().value!)
  return field
}

/** Field of the RESTING outline of a catalog shape (id), solved only once. */
export function fieldOfIdle(shape: string): FieldCushion | null {
  const key = `shape:${shape}`
  const already = fields.get(key)
  if (already) return already
  const f = SHAPE_BY_ID.get(shape)
  if (!f) return null
  const idle = bodyOutline(new BotEngine(RADIUS, 'idle', f.radii, null).sample(1).bodyPath)
  return idle.length > 8 ? fieldCushion(idle, key) : null
}

/** Shape id of a catalog profile (the profile is a shared object), or null if it is custom. */
export function shapeOfProfile(profile: ProfileVolume): string | null {
  for (const [id, p] of Object.entries(PROFILES)) if (p === profile) return id
  return null
}

const EXPONENT = 0.45

function sample(c: FieldCushion, x: number, y: number): number {
  const N = GRID
  const fx = (x - c.x0) / c.step - 0.5
  const fy = (y - c.y0) / c.step - 0.5
  const i = Math.max(0, Math.min(N - 2, Math.floor(fx)))
  const j = Math.max(0, Math.min(N - 2, Math.floor(fy)))
  const tx = Math.max(0, Math.min(1, fx - i))
  const ty = Math.max(0, Math.min(1, fy - j))
  const a = c.u[j * N + i]!
  const b = c.u[j * N + i + 1]!
  const d = c.u[(j + 1) * N + i]!
  const e = c.u[(j + 1) * N + i + 1]!
  const u = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + d * (1 - tx) * ty + e * tx * ty
  return Math.pow(Math.max(0, u), EXPONENT)
}

/** Normalized height (0..1) of the cushion at point (x, y) of the space the field was solved in. */
export const heightCushion = sample

/**
 * Normalized height at NORMALIZED coordinates (a, b) of the box of an outline of the same shape: a gesture that
 * squashes or stretches the body only scales that box, the field does not change and is never recomputed.
 */
export function heightNorm(c: FieldCushion, a: number, b: number): number {
  return sample(c, c.bx0 + a * c.bw, c.by0 + b * c.bh)
}

/** Extent of the outline on the line `y = v` (axis `v`) or `x = v` (axis `h`): [min, max] or null. */
function chord(pts: Point[], v: number, axis: 'v' | 'h'): [number, number] | null {
  let a = Infinity
  let b = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    const pu = axis === 'v' ? p.y : p.x
    const qu = axis === 'v' ? q.y : q.x
    if (pu > v !== qu > v) {
      const t = (v - pu) / (qu - pu)
      const w = axis === 'v' ? p.x + t * (q.x - p.x) : p.y + t * (q.y - p.y)
      if (w < a) a = w
      if (w > b) b = w
    }
  }
  return a === Infinity ? null : [a, b]
}

/** Texture coordinate of a viewBox point: (0,0) at the bottom left, like Three. */
const uvOf = (x: number, y: number, vb: number) => [(x + vb) / (2 * vb), 1 - (y + vb) / (2 * vb)]

/**
 * Inflates the outline `pts` into a closed volume. `target` is reused if it has the right size (one frame per frame:
 * no allocation in the loop).
 *
 * The height of each vertex is a function of its DISTANCE to the edge (`height`), not of its rank in the ring: flat
 * front face, quarter circle edge of constant radius, straight wall. That makes a cube from a square, and stays a
 * sphere on a circle.
 *
 * The back face and the wall take the texture coordinate of a viewBox corner, which only has the body color: the eyes
 * are only painted in front.
 */
export function inflate(
  outline: Point[],
  vb: number,
  target?: Volume,
  finesse: Finesse = DEFAULT_FINESSE,
  profile: ProfileVolume = DEFAULT_PROFILE
): Volume {
  const RINGS_N = finesse.rings
  const FRAC = RINGS_N === RINGS ? FRACTIONS : fractions(RINGS_N)
  // outline direction: that of the radial profiles (clockwise on screen). An outline given
  // the other way would flip every face.
  const pts = aireSignee(outline) < 0 ? [...outline].reverse() : outline
  const n = pts.length
  const total = vertices(n, RINGS_N)
  const v: Volume =
    target && target.positions.length === total * 3
      ? target
      : {
          positions: new Float32Array(total * 3),
          uvs: new Float32Array(total * 2),
          index: indexOfVolume(n, RINGS_N),
          neck: 0,
          center: { x: 0, y: 0 },
          measures: { H: 0, b: 0, zw: 0, y0: 0, y1: 0 }
        }
  const c = centerOf(pts)
  let rc = 0
  let neck = -Infinity
  for (const p of pts) {
    rc += Math.hypot(p.x - c.x, p.y - c.y)
    if (p.y > neck) neck = p.y
  }
  rc /= Math.max(1, n)
  const measures = measuresOf(pts, profile)
  const { H } = measures
  const ARR = Math.min(ROUNDED_MAX, Math.max(0, profile.rounded))
  // the distance to the edge is measured on a coarser outline (one point per cubic) and only on
  // the segments near the ray: accurate enough, and about 50 times cheaper
  const step = Math.max(1, Math.round(n / 64))
  const grossier = pts.filter((_, i) => i % step === 0)
  const m = grossier.length
  const window = Math.max(6, Math.ceil(m / 5))
  const P = v.positions
  const U = v.uvs
  const pose = (i: number, x: number, y: number, z: number, face: boolean) => {
    P[i * 3] = x
    P[i * 3 + 1] = y
    P[i * 3 + 2] = z
    const [a, b2] = face ? uvOf(x, y, vb) : [0.002, 0.002]
    U[i * 2] = a!
    U[i * 2 + 1] = b2!
  }
  const back = profile.back
  const idx = indicesVolume(n, RINGS_N)
  if (profile.sphere) {
    // real sphere: rings at regular polar angle, z = mean radius. On a circle it is
    // exactly the sphere; if the outline squashes, the silhouette still follows the outline.
    pose(0, c.x, c.y, rc, true)
    pose(idx.centerBack, c.x, c.y, -rc, false)
    for (let k = 0; k < n; k++) {
      const p = pts[k]!
      for (let a = 1; a <= RINGS_N; a++) {
        const th = (a / RINGS_N) * (Math.PI / 2)
        const f = a === RINGS_N ? 1 : Math.sin(th)
        const x = c.x + (p.x - c.x) * f
        const y = c.y + (p.y - c.y) * f
        const z = a === RINGS_N ? 0 : rc * Math.cos(th)
        pose(idx.before(a, k), x, y, z, true)
        pose(idx.back(a, k), x, y, -z, false)
      }
      pose(idx.wall(k), p.x, p.y, 0, false)
    }
    v.neck = neck
    v.center = c
    v.measures = { ...measures, H: rc, b: rc, zw: 0 }
    return v
  }
  if (profile.cushion) {
    // "cushion" inflation: same rings as the sphere, height = Poisson field of the resting outline,
    // normalized by the current outline's box (no recomputation during an animation)
    const name = shapeOfProfile(profile)
    let bx0 = Infinity
    let bx1 = -Infinity
    let by0 = Infinity
    let by1 = -Infinity
    for (const p of pts) {
      bx0 = Math.min(bx0, p.x)
      bx1 = Math.max(bx1, p.x)
      by0 = Math.min(by0, p.y)
      by1 = Math.max(by1, p.y)
    }
    const bw = Math.max(1e-6, bx1 - bx0)
    const bh = Math.max(1e-6, by1 - by0)
    const field = (name && fieldOfIdle(name)) || fieldCushion(pts, `outline:${pts.length}:${Math.round(bw)}x${Math.round(bh)}`)
    const Hc = H
    const zOf = (x: number, y: number) => Hc * heightNorm(field, (x - bx0) / bw, (y - by0) / bh)
    const z0 = zOf(c.x, c.y)
    pose(0, c.x, c.y, z0, true)
    pose(idx.centerBack, c.x, c.y, -z0, false)
    for (let k = 0; k < n; k++) {
      const p = pts[k]!
      for (let a = 1; a <= RINGS_N; a++) {
        // rings tight near the edge (the surface curves most there), spaced in the center
        const f = a === RINGS_N ? 1 : 1 - (1 - a / RINGS_N) ** 2
        const x = c.x + (p.x - c.x) * f
        const y = c.y + (p.y - c.y) * f
        const z = a === RINGS_N ? 0 : zOf(x, y)
        pose(idx.before(a, k), x, y, z, true)
        pose(idx.back(a, k), x, y, -z, false)
      }
      pose(idx.wall(k), p.x, p.y, 0, false)
    }
    v.neck = neck
    v.center = c
    v.measures = { ...measures, H: Hc, b: Hc, zw: 0 }
    return v
  }
  if (profile.revolution) {
    // solid of revolution: same rings as the sphere, but the depth of each point is the
    // half width of the outline at its height (vertical axis) or its abscissa (horizontal axis)
    const axis = profile.revolution
    const zOf = (x: number, y: number) => {
      const ch = chord(pts, axis === 'v' ? y : x, axis)
      if (!ch) return 0
      const mid = (ch[0] + ch[1]) / 2
      const hw = (ch[1] - ch[0]) / 2
      const t = ((axis === 'v' ? x : y) - mid) / Math.max(hw, 1e-6)
      return hw * Math.sqrt(Math.max(0, 1 - t * t)) * profile.depth
    }
    const z0 = zOf(c.x, c.y)
    pose(0, c.x, c.y, z0, true)
    pose(idx.centerBack, c.x, c.y, -z0, false)
    for (let k = 0; k < n; k++) {
      const p = pts[k]!
      for (let a = 1; a <= RINGS_N; a++) {
        const th = (a / RINGS_N) * (Math.PI / 2)
        const f = a === RINGS_N ? 1 : Math.sin(th)
        const x = c.x + (p.x - c.x) * f
        const y = c.y + (p.y - c.y) * f
        const z = a === RINGS_N ? 0 : zOf(x, y)
        pose(idx.before(a, k), x, y, z, true)
        pose(idx.back(a, k), x, y, -z, false)
      }
      pose(idx.wall(k), p.x, p.y, 0, false)
    }
    v.neck = neck
    v.center = c
    v.measures = { ...measures, H: rc, b: rc, zw: 0 }
    return v
  }
  // distances to the edge of each vertex (one pass ahead: the inflated body needs the maximum)
  const dist = new Float32Array(RINGS_N * n)
  const place = new Float32Array(RINGS_N * n * 2)
  let dMax = 1e-6
  for (let k = 0; k < n; k++) {
    const p = pts[k]!
    const dx = p.x - c.x
    const dy = p.y - c.y
    const length = Math.hypot(dx, dy)
    const startPos = Math.min(m - 1, Math.round(k / step))
    for (let a = 1; a <= RINGS_N; a++) {
      const u = FRAC[a - 1]!
      // the inner rings are ROUNDED: a copy of the outline at scale `u` would turn its corners
      // (hexagon, square) into folds along each corner ray. The
      // exact outline is only found at the edge (w = 1).
      const w = u * u * Math.sqrt(u)
      const k2 = a === RINGS_N ? 1 : (u * (rc * (1 - w) + length * w)) / Math.max(length, 1e-6)
      const i = (a - 1) * n + k
      place[i * 2] = c.x + dx * k2
      place[i * 2 + 1] = c.y + dy * k2
      const d = a === RINGS_N ? 0 : distanceEdge(grossier, place[i * 2]!, place[i * 2 + 1]!, startPos, window)
      dist[i] = d
      if (d > dMax) dMax = d
    }
  }
  const Hc = H * partDepth(c.y, measures, profile)
  pose(0, c.x, c.y, Hc, true)
  pose(idx.centerBack, c.x, c.y, -Hc * back, false)
  for (let k = 0; k < n; k++) {
    const p = pts[k]!
    for (let a = 1; a <= RINGS_N; a++) {
      const i = (a - 1) * n + k
      const x = place[i * 2]!
      const y = place[i * 2 + 1]!
      const d = dist[i]!
      const Hy = H * partDepth(y, measures, profile)
      const z = height(d, Hy, Hy * ARR)
      pose(idx.before(a, k), x, y, z, true)
      pose(idx.back(a, k), x, y, -z * back, false)
    }
    const Hp = H * partDepth(p.y, measures, profile)
    pose(idx.wall(k), p.x, p.y, Hp * (1 - ARR), false)
  }
  v.neck = neck
  v.center = c
  v.measures = measures
  return v
}

/**
 * Makes the edge normals continuous: on the front edge ring, the top wall and the wall foot, the normal is horizontal
 * (the edge's tangent is vertical there). Front edge and wall vertices are duplicated for the texture, so
 * `computeVertexNormals` does not connect them: they are welded here. `normals` is the x, y, z buffer of the Three
 * mesh.
 */
export function weldNormals(normals: Float32Array, n: number, rings = RINGS) {
  const { before, wall, back } = indicesVolume(n, rings)
  for (let k = 0; k < n; k++) {
    const trio = [before(rings, k), wall(k), back(rings, k)]
    let nx = 0
    let ny = 0
    for (const i of trio) {
      nx += normals[i * 3]!
      ny += normals[i * 3 + 1]!
    }
    const l = Math.hypot(nx, ny) || 1
    for (const i of trio) {
      normals[i * 3] = nx / l
      normals[i * 3 + 1] = ny / l
      normals[i * 3 + 2] = 0
    }
  }
}

/**
 * Half extent of an eye on screen: the box of its path (ends of segments and arcs, control points of curves), passed
 * through the engine matrix.
 */
export function halfExtentEye(d: string, matrix: string): number {
  let mx = 0
  let my = 0
  for (const seg of d.matchAll(/([MLACQ])([^A-Za-z]*)/g)) {
    const n = seg[2]!.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? []
    const taken = seg[1] === 'A' ? n.slice(5) : n
    for (let i = 0; i + 1 < taken.length; i += seg[1] === 'A' ? 7 : 2) {
      mx = Math.max(mx, Math.abs(taken[i]!))
      my = Math.max(my, Math.abs(taken[i + 1]!))
    }
  }
  const [a, b, c, e] = readMatrix(matrix)
  return Math.max(Math.abs(a) * mx + Math.abs(c) * my, Math.abs(b) * mx + Math.abs(e) * my)
}

/**
 * The eyes of a 3D Mochi: STRAIGHT FRONT (design choice, 03/11/2026). Centered on the front face, symmetric, same
 * size, upright (no shifting gaze, no tilt), a little above the center. They stay on the face when the body turns:
 * they are painted on the body, the camera does not "correct" them.
 *
 * `half`: half extent of each eye at scale 1, in order from left to right. If the face is too small (center of a
 * star), the eyes shrink together then move closer until they fit, clear of the rounded edge. A round shape has no
 * edge: only the outline counts.
 */
export function frontEyes(pts: Point[], half: number[], profile: ProfileVolume): Array<{ x: number; y: number; s: number }> {
  const n = half.length
  if (!n || pts.length < 3) return []
  const c = centerOf(pts)
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  const small = Math.min(x1 - x0, y1 - y0)
  const y = c.y - (profile.pyramid ? 0.05 : 0.09) * small
  // face axis: middle of the body width at that height (shapes are symmetric)
  const xs: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
  }
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : c.x
  const { b } = measuresOf(pts, profile)
  const margin = profile.rounded >= 0.99 ? 0 : 0.3 * b
  const gap = 0.13 * small
  const last = 0.5
  const place = (s: number, g: number) =>
    half.map((_, i) => ({ x: cx + (n === 1 ? 0 : (i - (n - 1) / 2) * ((2 * g) / Math.max(1, n - 1))), y, s }))
  trial: for (let s = 1; s >= 0.5; s -= 0.05) {
    for (const g of [gap, gap * 0.85, gap * 0.7]) {
      const ps = place(s, g)
      if (ps.every((p, i) => distanceAtEdge(pts, p.x, p.y) >= s * half[i]! + margin)) {
        return ps
      }
      if (s <= 0.5 + 1e-9 && g === gap * 0.7) break trial
    }
  }
  return place(last, gap * 0.7)
}

/** `matrix(a b c d e f)` of the engine, as six numbers. */
export function readMatrix(m: string): [number, number, number, number, number, number] {
  const n = m.match(/-?\d+\.?\d*(e-?\d+)?/g)?.map(Number) ?? []
  return n.length >= 6
    ? (n.slice(0, 6) as [number, number, number, number, number, number])
    : [1, 0, 0, 1, 0, 0]
}

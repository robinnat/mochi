/**
 * Accessory anchoring: everything is COMPUTED on the body mesh of THIS frame, never hard-coded for a shape. Rays
 * (Raycaster) are cast on the inflated volume: the front surface at (x, y), the top at (x, z), the side edge at a
 * given height, the horizontal body section at a given height (for scarves, necklaces, headbands). Each ray returns a
 * point and a smoothed normal, so an accessory sits on a star, a cube or a cloud with the same logic: it starts from
 * the surface and goes a little into the body.
 *
 * Frame: the mesh's (`Mochi3d.mesh`), y UP, front face towards +z, radius about 100.
 *
 * Imports `three`: only loaded through `scene3d.ts`, itself dynamic.
 */
import { Box3, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Triangle, Vector3 } from './three'

export interface Impact {
  p: Vector3
  /** smoothed, unit normal, pointing outwards */
  n: Vector3
}

export interface EyeScene {
  x: number
  /** y up (mesh frame) */
  y: number
  r: number
}

/** Everything an accessory needs to know about the body. */
export interface Landmarks {
  A: Anchors
  /** top and bottom of the body, maximum half width and half depth, center in z */
  top: number
  neck: number
  hw: number
  zc: number
  /** total height */
  H: number
  /** hat seat: where the body section is wide enough to carry the headwear */
  head: { cx: number; y: number; zc: number; R: number; rz: number }
  /** both eyes (empty if there is no face) and the shared lens radius */
  eyes: EyeScene[]
  /** height of the "neck": the bottom area, under the face */
  yBottom: number
  /** average eye height and the gap between them */
  yEyes: number
  gap: number
  /** lens radius: that of the older glasses (touching, a little bigger than the eye) */
  rLens: number
}

export class Anchors {
  readonly box: Box3
  private readonly proxy: Mesh
  private readonly radius = new Raycaster()
  private readonly pos: BufferGeometry['attributes'][string]
  private readonly nor: BufferGeometry['attributes'][string] | undefined
  private readonly tri = new Triangle()

  constructor(readonly geo: BufferGeometry) {
    geo.computeBoundingBox()
    this.box = geo.boundingBox!.clone()
    this.proxy = new Mesh(geo, new MeshBasicMaterial({ side: DoubleSide }))
    this.proxy.updateMatrixWorld(true)
    this.pos = geo.attributes.position!
    this.nor = geo.attributes.normal
  }

  /** First hit of a ray (origin `o`, direction `d`), with the smoothed normal. */
  shot(o: Vector3, d: Vector3): Impact | null {
    this.radius.set(o, d.clone().normalize())
    const h = this.radius.intersectObject(this.proxy, false)[0]
    if (!h || !h.face) return null
    const n = new Vector3()
    if (this.nor) {
      const { a, b, c } = h.face
      const P = this.pos
      const N = this.nor
      const va = new Vector3().fromBufferAttribute(P, a)
      const vb = new Vector3().fromBufferAttribute(P, b)
      const vc = new Vector3().fromBufferAttribute(P, c)
      this.tri.set(va, vb, vc)
      this.tri.getInterpolation(
        h.point,
        new Vector3().fromBufferAttribute(N, a),
        new Vector3().fromBufferAttribute(N, b),
        new Vector3().fromBufferAttribute(N, c),
        n
      )
    }
    if (n.lengthSq() < 1e-6) n.copy(h.face.normal)
    n.normalize()
    // pointing outwards (the ray comes from outside)
    if (n.dot(d) > 0) n.negate()
    return { p: h.point.clone(), n }
  }

  /** Front surface at (x, y): ray towards -z from the front. */
  before(x: number, y: number): Impact | null {
    return this.shot(new Vector3(x, y, this.box.max.z + 60), new Vector3(0, 0, -1))
  }

  /** Surface arriere en (x, y). */
  back(x: number, y: number): Impact | null {
    return this.shot(new Vector3(x, y, this.box.min.z - 60), new Vector3(0, 0, 1))
  }

  /** Top of the body at (x, z): ray down from the sky. */
  top(x: number, z: number): Impact | null {
    return this.shot(new Vector3(x, this.box.max.y + 60, z), new Vector3(0, -1, 0))
  }

  /** Side edge at height y and depth z (sg = -1 left, 1 right). */
  side(y: number, z: number, sg: number): Impact | null {
    const L = Math.max(Math.abs(this.box.min.x), Math.abs(this.box.max.x)) + 60
    return this.shot(new Vector3(sg * L, y, z), new Vector3(-sg, 0, 0))
  }

  /**
   * Horizontal body section at height y: `n` surface points, evenly spread in angle around the axis (cx, zc), from
   * the first on the right turning towards the front (+z). `incl` tilts the plane (front lower), so a ring reads as a
   * ring and not as a bar. Returns [] if the section is empty (outside the body).
   */
  coupe(y: number, n = 40, cx = 0, zc = (this.box.min.z + this.box.max.z) / 2, incl = 0): Impact[] {
    const L = Math.max(this.box.max.x - this.box.min.x, this.box.max.z - this.box.min.z) + 80
    const out: Impact[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const dx = Math.cos(a)
      const dz = Math.sin(a)
      // tilted plane: the front (dz = 1) is lower by `incl`, like a collar seen from slightly above
      const h = this.shot(new Vector3(cx + dx * L, y - incl * dz, zc + dz * L), new Vector3(-dx, 0, -dz))
      if (!h) return []
      out.push(h)
    }
    return out
  }

  /**
 * Half width in x and half depth in z of the body at height y; null if the height is outside the body.
 */
  section(y: number, z0 = (this.box.min.z + this.box.max.z) / 2): { x0: number; x1: number; zf: number; zb: number } | null {
    const g = this.side(y, z0, -1)
    const d = this.side(y, z0, 1)
    const x = g && d ? (g.p.x + d.p.x) / 2 : 0
    const f = this.before(x, y)
    const b = this.back(x, y)
    if (!g || !d || !f || !b) return null
    return { x0: g.p.x, x1: d.p.x, zf: f.p.z, zb: b.p.z }
  }
}

/**
 * Hat seat: go down from the top to the first height where the body is wide enough to carry the headwear (radius `R`
 * = 0.58 of the maximum half width). On a sphere the headwear sits under the top, on a cube or a pebble it rests flat
 * on top.
 */
function assise(A: Anchors, hw: number, top: number, H: number, zc: number) {
  const R = 0.58 * hw
  let best: { y: number; x0: number; x1: number; zf: number; zb: number } | null = null
  const step = H / 80
  // never lower than 28 % of the height: on a pyramid or a drop, the headwear sits on the tip
  // (smaller) instead of going down in front of the eyes
  for (let y = top - step * 0.5; y > top - 0.28 * H; y -= step) {
    const s = A.section(y)
    if (!s) continue
    if ((s.x1 - s.x0) / 2 >= R) {
      best = { y, ...s }
      break
    }
  }
  if (!best) {
    // very pointed top (triangle, star): take the section at 28 % of the height
    const y = top - 0.28 * H
    const s = A.section(y) ?? { x0: -R, x1: R, zf: zc + R, zb: zc - R }
    best = { y, ...s }
  }
  // Hollow top (the heart: two bumps and a dip): the middle section is empty or lower than the bumps, the
  // headwear would have sat IN the dip, sunk into the bumps. It rests on top of the two bumps.
  const middle = A.top(0, zc)
  if (middle && top - middle.p.y > 0.05 * H) {
    let ymax = -Infinity
    let xPic = 0
    for (let k = -8; k <= 8; k++) {
      const h = A.top((k / 8) * R, zc)
      if (h && h.p.y > ymax) {
        ymax = h.p.y
        xPic = h.p.x
      }
    }
    const yMeasure = ymax - 0.1 * H
    const g = A.side(yMeasure, zc, -1)
    const d = A.side(yMeasure, zc, 1)
    const f = A.before(xPic, yMeasure)
    const b = A.back(xPic, yMeasure)
    const xr = g && d ? (d.p.x - g.p.x) / 2 : hw
    const zr = f && b ? (f.p.z - b.p.z) / 2 : R
    const Rr = Math.min(R, xr * 0.98)
    return { cx: 0, y: ymax + 0.05 * Rr, zc, R: Rr, rz: Math.min(Math.max(zr, Rr * 0.7), Rr * 1.1) }
  }
  const xr = Math.max(1, (best.x1 - best.x0) / 2)
  const zr = Math.max(1, (best.zf - best.zb) / 2)
  // headwear radius: never wider than the body at that height
  const Rr = Math.min(R, xr * 0.98)
  const rz = Math.min(Math.max(Rr * (zr / xr), Rr * 0.7), Rr * 1.3)
  return { cx: (best.x0 + best.x1) / 2, y: best.y, zc: (best.zf + best.zb) / 2, R: Rr, rz }
}

/** Measures everything needed from the body (mesh `geo`) and the eyes (scene positions, y up). */
export function measureLandmarks(geo: BufferGeometry, eyesScene: EyeScene[], rLens: number): Landmarks {
  const A = new Anchors(geo)
  const b = A.box
  const top = b.max.y
  const neck = b.min.y
  const H = top - neck
  const hw = Math.max(b.max.x, -b.min.x)
  const zc = (b.min.z + b.max.z) / 2
  const head = assise(A, hw, top, H, zc)
  const ye = [...eyesScene].sort((p, q) => p.x - q.x)
  const yEyes = ye.length ? ye.reduce((s, o) => s + o.y, 0) / ye.length : top - 0.45 * H
  const gap = ye.length === 2 ? ye[1]!.x - ye[0]!.x : 0.26 * hw * 2
  // "neck": around 76 % of the height; if the bottom of the body is hollow there (notch of a star,
  // of a cloud), go up until there is body on the axis again
  let yBottom = top - 0.76 * H
  for (let k = 0; k < 14 && !A.before(0, yBottom); k++) yBottom += 0.025 * H
  return { A, top, neck, hw, zc, H, head, eyes: ye, yBottom, yEyes, gap, rLens }
}

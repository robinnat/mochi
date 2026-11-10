/**
 * Worn accessories in real 3D: the `Part`s of `bot/worn.ts` become volumes (cylinders, domes, tori), children of the
 * body mesh. So they turn with it, and follow every engine frame (jump, squash, shape) because they are placed again
 * from the outline of THIS frame. Glasses do not go through here: they are painted on the face (see `scene3d.ts`),
 * where the 3D eyes are.
 *
 * Imports `three`: only loaded through `scene3d.ts`, itself dynamic.
 */
import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  type MeshStandardMaterial,
  type MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3
} from 'three'
import { rim } from './rim'
import { measuresWorn, partsWorn, radiusLens, eyesOf, type Part, type WornId } from '@/bot/worn'
import type { BotFrame } from '@/bot/engine'

type MatDef = MeshStandardMaterial | MeshToonMaterial

export class Worn3d {
  readonly group = new Group()
  /** pieces, tilted a hair towards the camera so the top and edges read as volume */
  private readonly inner = new Group()
  private key = ''
  private geos: BufferGeometry[] = []
  /** body material, cloned per tint: the pieces read like the body (same lighting) */
  private readonly materials = new Map<string, MatDef>()
  private source: MatDef | null = null
  /** same lighting as the body (rims, soft shading, highlight): set by `Mochi3d` */
  settings: { force: number; top: number; ao: number; highlight?: { value: number } } | null = null

  constructor() {
    this.group.visible = false
    this.group.add(this.inner)
  }

  private materialKind(base: MatDef, background: string): MatDef {
    if (this.source !== base) {
      for (const m of this.materials.values()) m.dispose()
      this.materials.clear()
      this.source = base
    }
    let m = this.materials.get(background)
    if (!m) {
      m = base.clone() as MatDef
      m.map = null
      m.emissiveMap = null
      m.emissive.set(0x000000)
      m.color.set(background)
      m.transparent = false
      m.opacity = 1
      // the clone does not keep the body's material effects: set them again, the same ones
      const g = this.settings
      if (g) rim(m, g.force, g.top, { ao: g.ao, highlight: g.highlight })
      this.materials.set(background, m)
    }
    return m
  }

  private empty() {
    for (const g of this.geos) g.dispose()
    this.geos = []
    this.inner.clear()
  }

  /** Places the pieces of `id` again on the body of `frame`; `zc` = middle of the body thickness. */
  update(id: WornId | null, frame: BotFrame, base: MatDef, zc: number, eyes?: BotFrame, zFace?: (x: number, y: number) => number, edgeX?: (y: number, sg: number) => number) {
    if (id === 'glasses' || id === 'sunglasses') {
      this.glasses(id, base, eyes ?? frame, zFace, edgeX)
      return
    }
    const g = id ? measuresWorn(frame) : null
    if (!id || !g) {
      this.group.visible = false
      this.key = ''
      return
    }
    const parts = partsWorn(id, g)
    const key = `${id}|${base.uuid}|${Math.round(zc)}|${JSON.stringify(parts, (_, v) => (typeof v === 'number' ? Math.round(v * 2) / 2 : v))}`
    this.group.visible = true
    if (key === this.key) return
    this.key = key
    this.empty()
    for (const p of parts) this.add(p, base, zc)
    // the pivot is the hat's resting point; headphones and bow stay upright
    const tilt = id !== 'headphones' && id !== 'bow'
    const px = g.cx
    const py = -g.by
    this.inner.position.set(px, py, zc)
    this.inner.rotation.x = tilt ? 0.2 : 0
    for (const c of this.inner.children) c.position.set(c.position.x - px, c.position.y - py, c.position.z - zc)
  }

  /**
   * A real frame of thick round tube, soft black, set IN FRONT of the 3D eyes (facing front): bigger than the eye, it
   * overflows, and its arms go back on each side.
   */
  private glasses(id: 'glasses' | 'sunglasses', base: MatDef, frame: BotFrame, zFace?: (x: number, y: number) => number, edgeX?: (y: number, sg: number) => number) {
    const ye = eyesOf(frame)
    if (ye.length !== 2 || !zFace) {
      this.group.visible = false
      this.key = ''
      return
    }
    const [a, b] = ye as [(typeof ye)[0], (typeof ye)[0]]
    // lenses touching each other (as on the reference): frame included, no overlap
    const r = Math.min(radiusLens(a, b) * 1.05, (b.x - a.x) / 2 / 1.17)
    // the front face can be tilted (pyramid): set in front of the most forward point of the rim
    let z = -Infinity
    for (const o of [a, b]) {
      for (let k = 0; k < 8; k++) z = Math.max(z, zFace(o.x + Math.cos((k / 8) * Math.PI * 2) * r, o.y + Math.sin((k / 8) * Math.PI * 2) * r * 1.1))
      z = Math.max(z, zFace(o.x, o.y))
    }
    // set against the body, with a tiny gap: the frame barely stands out in front of the eyes
    z += 0.14 * r
    const key = `${id}|${base.uuid}|${[a.x, a.y, b.x, b.y, r, z].map((v) => Math.round(v * 2)).join(',')}`
    this.group.visible = true
    if (key === this.key) return
    this.key = key
    this.empty()
    this.inner.position.set(0, 0, 0)
    this.inner.rotation.set(0, 0, 0)
    const black = id === 'sunglasses' ? '#15131c' : '#26222f'
    const tube = 0.17 * r
    for (const o of [a, b]) {
      const t = this.mesh(new TorusGeometry(r, tube, 22, 64), black, base)
      // lens a little taller than wide: it surrounds the eye like a pill
      t.scale.set(1, Math.min(1.55, Math.max(1.12, (Math.max(a.r, b.r) * 1.2) / r)), 1)
      t.position.set(o.x, -o.y, z)
      if (id === 'sunglasses') {
        const v = this.mesh(new CylinderGeometry(r, r, tube * 1.2, 40), black, base)
        v.rotation.x = Math.PI / 2
        v.scale.y = 1
        v.position.set(o.x, -o.y, z - tube * 0.4)
      }
    }
    // arms: they start from the hinge (outer edge of the frame) and GO INTO the
    // head from behind; from the front they are hidden by the body, only the hinge shows.
    // They come out on the side of the head (at eye height): you see them when turning.
    for (const [o, sg] of [[a, -1], [b, 1]] as const) {
      const xo = o.x + sg * (r + tube * 0.5)
      const xe = edgeX ? edgeX(o.y, sg) : xo + sg * 0.8 * r
      const y = -o.y + 0.1 * r
      const dedans = (x: number, k: number) => Math.min(z, zFace(x - sg * 2, o.y)) - tube * k - 0.3 * r
      const curve = new CatmullRomCurve3([
        new Vector3(xo, y, z),
        new Vector3(xo + (xe - xo) * 0.06, y, dedans(xo, 1.2)),
        new Vector3(xo + (xe - xo) * 0.5, y, dedans(xo + (xe - xo) * 0.5, 2.5) * 0.6),
        // comes out at the edge of the silhouette, a hair behind the median plane
        new Vector3(xe - sg * tube * 0.3, y, -0.05 * r)
      ])
      this.mesh(new TubeGeometry(curve, 24, tube * 0.7, 10), black, base)
    }
  }

  private mesh(geo: BufferGeometry, background: string, base: MatDef) {
    this.geos.push(geo)
    const m = new Mesh(geo, this.materialKind(base, background))
    m.castShadow = true
    this.inner.add(m)
    return m
  }

  private add(p: Part, base: MatDef, zc: number) {
    switch (p.t) {
      case 'cyl': {
        const m = this.mesh(new CylinderGeometry(p.rh, p.rb, Math.abs(p.yb - p.yh), 32), p.background, base)
        m.position.set(p.x, -(p.yb + p.yh) / 2, zc)
        break
      }
      case 'crown': {
        const m = this.mesh(new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), p.background, base)
        m.scale.set(p.r, p.h, p.r)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'edge': {
        const m = this.mesh(new CylinderGeometry(p.r, p.r, p.ry * 0.9, 40), p.background, base)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'ball': {
        const m = this.mesh(new SphereGeometry(p.r, 20, 14), p.background, base)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'tips': {
        const radius = p.r * 0.82
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.PI / 2
          const m = this.mesh(new ConeGeometry(p.r * 0.2, p.h, 10), p.background, base)
          m.position.set(p.x + Math.cos(a) * radius, -p.y + p.h / 2, zc + Math.sin(a) * radius)
        }
        break
      }
      case 'bow': {
        for (const sg of [-1, 1]) {
          const m = this.mesh(new ConeGeometry(0.8 * p.s, 1.5 * p.s, 20), p.background, base)
          // pointing to the center: the cone lies along x
          m.rotation.z = (sg * Math.PI) / 2
          m.position.set(p.x + sg * 0.75 * p.s, -p.y, zc)
          m.scale.z = 0.55
        }
        const c = this.mesh(new SphereGeometry(0.45 * p.s, 18, 12), p.background, base)
        c.position.set(p.x, -p.y, zc)
        break
      }
      case 'arc': {
        const m = this.mesh(new TorusGeometry(1, p.w / (p.rx + p.ry), 12, 48, Math.PI), p.background, base)
        m.scale.set(p.rx, p.ry, p.rx)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'ear': {
        const m = this.mesh(new SphereGeometry(1, 20, 14), p.background, base)
        m.scale.set(p.rx * 1.4, p.ry, p.ry * 0.85)
        m.position.set(p.x, -p.y, zc)
        break
      }
    }
  }

  liberer() {
    this.empty()
    for (const m of this.materials.values()) m.dispose()
    this.materials.clear()
  }
}

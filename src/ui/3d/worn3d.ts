/**
 * Accessoires portes en vraie 3D : les `Part`s de `bot/portes.ts` deviennent des volumes
 * (cylindres, calottes, tores) enfants du maillage du corps. Ils tournent donc avec lui, et
 * suivent chaque image du moteur (saut, ecrasement, forme) parce qu'ils sont replaces depuis
 * le contour de CETTE image. Les lunettes ne passent pas par ici : elles sont peintes sur le
 * visage (voir `scene3d.ts`), la ou sont les yeux 3D.
 *
 * Importe `three` : ne se charge que par `scene3d.ts`, lui-meme dynamique.
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
  /** pieces, penchees d'un rien vers la camera pour que dessus et bords se lisent en volume */
  private readonly inner = new Group()
  private key = ''
  private geos: BufferGeometry[] = []
  /** matiere du corps, clonee par teinte : les pieces se lisent comme le corps (meme eclairage) */
  private readonly materials = new Map<string, MatDef>()
  private source: MatDef | null = null
  /** memes jeux de lumiere que le corps (liseres, ombrage doux, reflet) : poses par `Mochi3d` */
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
      // le clone ne garde pas les effets de matiere du corps : on les repose, les memes
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

  /** Replace les pieces de `id` sur le corps de `frame` ; `zc` = milieu de l'epaisseur du corps. */
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
    // le pivot est le point d'appui du chapeau ; le casque et le noeud restent droits
    const tilt = id !== 'headphones' && id !== 'bow'
    const px = g.cx
    const py = -g.by
    this.inner.position.set(px, py, zc)
    this.inner.rotation.x = tilt ? 0.2 : 0
    for (const c of this.inner.children) c.position.set(c.position.x - px, c.position.y - py, c.position.z - zc)
  }

  /**
   * Vraie monture en tube rond epais, noir doux, posee DEVANT les yeux 3D (de face) : plus
   * grande que l'oeil, elle deborde, et ses branches partent en arriere de chaque cote.
   */
  private glasses(id: 'glasses' | 'sunglasses', base: MatDef, frame: BotFrame, zFace?: (x: number, y: number) => number, edgeX?: (y: number, sg: number) => number) {
    const ye = eyesOf(frame)
    if (ye.length !== 2 || !zFace) {
      this.group.visible = false
      this.key = ''
      return
    }
    const [a, b] = ye as [(typeof ye)[0], (typeof ye)[0]]
    // verres tangents l'un a l'autre (comme sur la reference) : monture comprise, pas de chevauchement
    const r = Math.min(radiusLens(a, b) * 1.05, (b.x - a.x) / 2 / 1.17)
    // la face avant peut etre penchee (pyramide) : on se pose devant le point le plus avance du pourtour
    let z = -Infinity
    for (const o of [a, b]) {
      for (let k = 0; k < 8; k++) z = Math.max(z, zFace(o.x + Math.cos((k / 8) * Math.PI * 2) * r, o.y + Math.sin((k / 8) * Math.PI * 2) * r * 1.1))
      z = Math.max(z, zFace(o.x, o.y))
    }
    // posees contre le corps, avec un tout petit ecart : la monture ressort a peine devant les yeux
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
      // verre un peu plus haut que large : il entoure l'oeil en pastille
      t.scale.set(1, Math.min(1.55, Math.max(1.12, (Math.max(a.r, b.r) * 1.2) / r)), 1)
      t.position.set(o.x, -o.y, z)
      if (id === 'sunglasses') {
        const v = this.mesh(new CylinderGeometry(r, r, tube * 1.2, 40), black, base)
        v.rotation.x = Math.PI / 2
        v.scale.y = 1
        v.position.set(o.x, -o.y, z - tube * 0.4)
      }
    }
    // branches : elles partent de la charniere (bord exterieur de la monture) et RENTRENT dans la
    // tete par l'arriere ; de face elles sont cachees par le corps, seule la charniere se voit.
    // Elles ressortent sur le cote de la tete (a la hauteur des yeux) : on les voit en tournant.
    for (const [o, sg] of [[a, -1], [b, 1]] as const) {
      const xo = o.x + sg * (r + tube * 0.5)
      const xe = edgeX ? edgeX(o.y, sg) : xo + sg * 0.8 * r
      const y = -o.y + 0.1 * r
      const dedans = (x: number, k: number) => Math.min(z, zFace(x - sg * 2, o.y)) - tube * k - 0.3 * r
      const curve = new CatmullRomCurve3([
        new Vector3(xo, y, z),
        new Vector3(xo + (xe - xo) * 0.06, y, dedans(xo, 1.2)),
        new Vector3(xo + (xe - xo) * 0.5, y, dedans(xo + (xe - xo) * 0.5, 2.5) * 0.6),
        // sort au bord de la silhouette, un rien en arriere du plan median
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
          // pointe vers le centre : le cone se couche le long de x
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

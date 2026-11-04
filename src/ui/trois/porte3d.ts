/**
 * Accessoires portes en vraie 3D : les `Partie`s de `bot/portes.ts` deviennent des volumes
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
import { lisere } from './lisere'
import { mesuresPorte, partiesPorte, rayonVerre, yeuxDe, type Partie, type PorteId } from '@/bot/portes'
import type { BotFrame } from '@/bot/engine'

type Materiau = MeshStandardMaterial | MeshToonMaterial

export class Porte3d {
  readonly groupe = new Group()
  /** pieces, penchees d'un rien vers la camera pour que dessus et bords se lisent en volume */
  private readonly inner = new Group()
  private cle = ''
  private geos: BufferGeometry[] = []
  /** matiere du corps, clonee par teinte : les pieces se lisent comme le corps (meme eclairage) */
  private readonly matieres = new Map<string, Materiau>()
  private source: Materiau | null = null
  /** memes jeux de lumiere que le corps (liseres, ombrage doux, reflet) : poses par `Mochi3d` */
  reglages: { force: number; haut: number; ao: number; reflet?: { value: number } } | null = null

  constructor() {
    this.groupe.visible = false
    this.groupe.add(this.inner)
  }

  private matiere(base: Materiau, fond: string): Materiau {
    if (this.source !== base) {
      for (const m of this.matieres.values()) m.dispose()
      this.matieres.clear()
      this.source = base
    }
    let m = this.matieres.get(fond)
    if (!m) {
      m = base.clone() as Materiau
      m.map = null
      m.emissiveMap = null
      m.emissive.set(0x000000)
      m.color.set(fond)
      m.transparent = false
      m.opacity = 1
      // le clone ne garde pas les effets de matiere du corps : on les repose, les memes
      const g = this.reglages
      if (g) lisere(m, g.force, g.haut, { ao: g.ao, reflet: g.reflet })
      this.matieres.set(fond, m)
    }
    return m
  }

  private vide() {
    for (const g of this.geos) g.dispose()
    this.geos = []
    this.inner.clear()
  }

  /** Replace les pieces de `id` sur le corps de `frame` ; `zc` = milieu de l'epaisseur du corps. */
  maj(id: PorteId | null, frame: BotFrame, base: Materiau, zc: number, yeux?: BotFrame, zFace?: (x: number, y: number) => number, bordX?: (y: number, sg: number) => number) {
    if (id === 'lunettes' || id === 'soleil') {
      this.lunettes(id, base, yeux ?? frame, zFace, bordX)
      return
    }
    const g = id ? mesuresPorte(frame) : null
    if (!id || !g) {
      this.groupe.visible = false
      this.cle = ''
      return
    }
    const parties = partiesPorte(id, g)
    const cle = `${id}|${base.uuid}|${Math.round(zc)}|${JSON.stringify(parties, (_, v) => (typeof v === 'number' ? Math.round(v * 2) / 2 : v))}`
    this.groupe.visible = true
    if (cle === this.cle) return
    this.cle = cle
    this.vide()
    for (const p of parties) this.ajouter(p, base, zc)
    // le pivot est le point d'appui du chapeau ; le casque et le noeud restent droits
    const penche = id !== 'casque' && id !== 'noeud'
    const px = g.cx
    const py = -g.by
    this.inner.position.set(px, py, zc)
    this.inner.rotation.x = penche ? 0.2 : 0
    for (const c of this.inner.children) c.position.set(c.position.x - px, c.position.y - py, c.position.z - zc)
  }

  /**
   * Vraie monture en tube rond epais, noir doux, posee DEVANT les yeux 3D (de face) : plus
   * grande que l'oeil, elle deborde, et ses branches partent en arriere de chaque cote.
   */
  private lunettes(id: 'lunettes' | 'soleil', base: Materiau, frame: BotFrame, zFace?: (x: number, y: number) => number, bordX?: (y: number, sg: number) => number) {
    const ye = yeuxDe(frame)
    if (ye.length !== 2 || !zFace) {
      this.groupe.visible = false
      this.cle = ''
      return
    }
    const [a, b] = ye as [(typeof ye)[0], (typeof ye)[0]]
    // verres tangents l'un a l'autre (comme sur la reference) : monture comprise, pas de chevauchement
    const r = Math.min(rayonVerre(a, b) * 1.05, (b.x - a.x) / 2 / 1.17)
    // la face avant peut etre penchee (pyramide) : on se pose devant le point le plus avance du pourtour
    let z = -Infinity
    for (const o of [a, b]) {
      for (let k = 0; k < 8; k++) z = Math.max(z, zFace(o.x + Math.cos((k / 8) * Math.PI * 2) * r, o.y + Math.sin((k / 8) * Math.PI * 2) * r * 1.1))
      z = Math.max(z, zFace(o.x, o.y))
    }
    // posees DEVANT : un vrai ecart avec le visage, on voit l'espace et l'ombre portee quand on tourne
    z += 0.42 * r
    const cle = `${id}|${base.uuid}|${[a.x, a.y, b.x, b.y, r, z].map((v) => Math.round(v * 2)).join(',')}`
    this.groupe.visible = true
    if (cle === this.cle) return
    this.cle = cle
    this.vide()
    this.inner.position.set(0, 0, 0)
    this.inner.rotation.set(0, 0, 0)
    const noir = id === 'soleil' ? '#15131c' : '#26222f'
    const tube = 0.17 * r
    for (const o of [a, b]) {
      const t = this.mesh(new TorusGeometry(r, tube, 22, 64), noir, base)
      // verre un peu plus haut que large : il entoure l'oeil en pastille
      t.scale.set(1, Math.min(1.55, Math.max(1.12, (Math.max(a.r, b.r) * 1.2) / r)), 1)
      t.position.set(o.x, -o.y, z)
      if (id === 'soleil') {
        const v = this.mesh(new CylinderGeometry(r, r, tube * 1.2, 40), noir, base)
        v.rotation.x = Math.PI / 2
        v.scale.y = 1
        v.position.set(o.x, -o.y, z - tube * 0.4)
      }
    }
    // branches : du bord exterieur de la monture jusqu'aux cotes de la tete, en arriere
    for (const [o, sg] of [[a, -1], [b, 1]] as const) {
      const xo = o.x + sg * (r + tube * 0.5)
      const xe = bordX ? bordX(o.y, sg) : xo + sg * 0.8 * r
      const y = -o.y + 0.1 * r
      // la branche epouse la tete : elle part de la monture (devant) puis suit la surface, juste
      // au-dessus, jusqu'au bord ; elle ne traverse pas le corps et ne flotte pas
      const pts: Vector3[] = []
      for (const t of [0, 0.12, 0.26, 0.42, 0.58, 0.74, 0.88, 1]) {
        const x = xo + (xe - xo) * t
        const surf = zFace(x - sg * 2 * t, o.y) + tube * 1.4
        const m = Math.min(1, t / 0.4)
        const zt = z * (1 - m * m * (3 - 2 * m)) + surf * (m * m * (3 - 2 * m))
        pts.push(new Vector3(x + sg * 1.5 * t, y, Math.max(zt, surf * 0.9)))
      }
      const courbe = new CatmullRomCurve3(pts)
      this.mesh(new TubeGeometry(courbe, 24, tube * 0.7, 10), noir, base)
    }
  }

  private mesh(geo: BufferGeometry, fond: string, base: Materiau) {
    this.geos.push(geo)
    const m = new Mesh(geo, this.matiere(base, fond))
    m.castShadow = true
    this.inner.add(m)
    return m
  }

  private ajouter(p: Partie, base: Materiau, zc: number) {
    switch (p.t) {
      case 'cyl': {
        const m = this.mesh(new CylinderGeometry(p.rh, p.rb, Math.abs(p.yb - p.yh), 32), p.fond, base)
        m.position.set(p.x, -(p.yb + p.yh) / 2, zc)
        break
      }
      case 'calotte': {
        const m = this.mesh(new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), p.fond, base)
        m.scale.set(p.r, p.h, p.r)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'bord': {
        const m = this.mesh(new CylinderGeometry(p.r, p.r, p.ry * 0.9, 40), p.fond, base)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'boule': {
        const m = this.mesh(new SphereGeometry(p.r, 20, 14), p.fond, base)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'pointes': {
        const rayon = p.r * 0.82
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.PI / 2
          const m = this.mesh(new ConeGeometry(p.r * 0.2, p.h, 10), p.fond, base)
          m.position.set(p.x + Math.cos(a) * rayon, -p.y + p.h / 2, zc + Math.sin(a) * rayon)
        }
        break
      }
      case 'noeud': {
        for (const sg of [-1, 1]) {
          const m = this.mesh(new ConeGeometry(0.8 * p.s, 1.5 * p.s, 20), p.fond, base)
          // pointe vers le centre : le cone se couche le long de x
          m.rotation.z = (sg * Math.PI) / 2
          m.position.set(p.x + sg * 0.75 * p.s, -p.y, zc)
          m.scale.z = 0.55
        }
        const c = this.mesh(new SphereGeometry(0.45 * p.s, 18, 12), p.fond, base)
        c.position.set(p.x, -p.y, zc)
        break
      }
      case 'arc': {
        const m = this.mesh(new TorusGeometry(1, p.w / (p.rx + p.ry), 12, 48, Math.PI), p.fond, base)
        m.scale.set(p.rx, p.ry, p.rx)
        m.position.set(p.x, -p.y, zc)
        break
      }
      case 'oreille': {
        const m = this.mesh(new SphereGeometry(1, 20, 14), p.fond, base)
        m.scale.set(p.rx * 1.4, p.ry, p.ry * 0.85)
        m.position.set(p.x, -p.y, zc)
        break
      }
    }
  }

  liberer() {
    this.vide()
    for (const m of this.matieres.values()) m.dispose()
    this.matieres.clear()
  }
}

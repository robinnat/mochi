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
  TorusGeometry
} from 'three'
import { mesuresPorte, partiesPorte, type Partie, type PorteId } from '@/bot/portes'
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
  maj(id: PorteId | null, frame: BotFrame, base: Materiau, zc: number) {
    const g = id && id !== 'lunettes' && id !== 'soleil' ? mesuresPorte(frame) : null
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

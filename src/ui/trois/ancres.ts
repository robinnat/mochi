/**
 * Ancrage des accessoires : tout est CALCULE sur le maillage du corps de CETTE image, jamais
 * en dur pour une forme. On lance des rayons (Raycaster) sur le volume gonfle : la surface
 * avant en (x, y), le dessus en (x, z), le bord lateral a une hauteur, la coupe horizontale du
 * corps a une hauteur (pour les echarpes, colliers, bandeaux). Chaque tir rend un point et une
 * normale lissee, si bien qu'un accessoire se pose sur une etoile, un cube ou un nuage avec
 * la meme logique : il part de la surface et rentre un peu dans le corps.
 *
 * Repere : celui du maillage (`Mochi3d.mesh`), y vers le HAUT, face avant vers +z, rayon ~100.
 *
 * Importe `three` : ne se charge que par `scene3d.ts`, lui-meme dynamique.
 */
import { Box3, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Triangle, Vector3 } from 'three'

export interface Impact {
  p: Vector3
  /** normale lissee, unitaire, tournee vers l'exterieur */
  n: Vector3
}

export interface OeilScene {
  x: number
  /** y vers le haut (repere du maillage) */
  y: number
  r: number
}

/** Tout ce qu'un accessoire a besoin de savoir du corps. */
export interface Reperes {
  A: Ancres
  /** sommet et bas du corps, demi-largeur et demi-profondeur maximales, centre en z */
  haut: number
  bas: number
  hw: number
  zc: number
  /** hauteur totale */
  H: number
  /** assise des chapeaux : la ou la coupe du corps est assez large pour porter la coiffe */
  tete: { cx: number; y: number; zc: number; R: number; rz: number }
  /** les deux yeux (vides si le visage est absent) et le rayon de verre commun */
  yeux: OeilScene[]
  /** hauteur du « cou » : zone du bas, sous le visage */
  yBas: number
  /** hauteur moyenne des yeux et ecart entre eux */
  yYeux: number
  ecart: number
  /** rayon de verre : celui des anciennes lunettes (tangent, un peu plus grand que l'oeil) */
  rVerre: number
}

export class Ancres {
  readonly box: Box3
  private readonly proxy: Mesh
  private readonly rayon = new Raycaster()
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

  /** Premier impact d'un rayon (origine `o`, direction `d`), avec la normale lissee. */
  tir(o: Vector3, d: Vector3): Impact | null {
    this.rayon.set(o, d.clone().normalize())
    const h = this.rayon.intersectObject(this.proxy, false)[0]
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
    // tourne vers l'exterieur (le rayon vient de dehors)
    if (n.dot(d) > 0) n.negate()
    return { p: h.point.clone(), n }
  }

  /** Surface avant en (x, y) : tir vers -z depuis devant. */
  avant(x: number, y: number): Impact | null {
    return this.tir(new Vector3(x, y, this.box.max.z + 60), new Vector3(0, 0, -1))
  }

  /** Surface arriere en (x, y). */
  arriere(x: number, y: number): Impact | null {
    return this.tir(new Vector3(x, y, this.box.min.z - 60), new Vector3(0, 0, 1))
  }

  /** Dessus du corps en (x, z) : tir vers le bas depuis le ciel. */
  dessus(x: number, z: number): Impact | null {
    return this.tir(new Vector3(x, this.box.max.y + 60, z), new Vector3(0, -1, 0))
  }

  /** Bord lateral a la hauteur y et la profondeur z (sg = -1 gauche, 1 droite). */
  cote(y: number, z: number, sg: number): Impact | null {
    const L = Math.max(Math.abs(this.box.min.x), Math.abs(this.box.max.x)) + 60
    return this.tir(new Vector3(sg * L, y, z), new Vector3(-sg, 0, 0))
  }

  /**
   * Coupe horizontale du corps a la hauteur y : `n` points de la surface, regulierement repartis
   * en angle autour de l'axe (cx, zc), du premier a la droite en tournant vers l'avant (+z).
   * `incl` incline le plan (l'avant plus bas), pour qu'un anneau se lise comme un anneau et pas comme une barre.
   * Rend [] si la coupe est vide (hors du corps).
   */
  coupe(y: number, n = 40, cx = 0, zc = (this.box.min.z + this.box.max.z) / 2, incl = 0): Impact[] {
    const L = Math.max(this.box.max.x - this.box.min.x, this.box.max.z - this.box.min.z) + 80
    const out: Impact[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const dx = Math.cos(a)
      const dz = Math.sin(a)
      // plan incline : l'avant (dz = 1) est plus bas de `incl`, comme un col vu d'un peu au-dessus
      const h = this.tir(new Vector3(cx + dx * L, y - incl * dz, zc + dz * L), new Vector3(-dx, 0, -dz))
      if (!h) return []
      out.push(h)
    }
    return out
  }

  /** Demi-largeur en x et demi-profondeur en z du corps a la hauteur y ; null si la hauteur est hors corps. */
  section(y: number, z0 = (this.box.min.z + this.box.max.z) / 2): { x0: number; x1: number; zf: number; zb: number } | null {
    const g = this.cote(y, z0, -1)
    const d = this.cote(y, z0, 1)
    const x = g && d ? (g.p.x + d.p.x) / 2 : 0
    const f = this.avant(x, y)
    const b = this.arriere(x, y)
    if (!g || !d || !f || !b) return null
    return { x0: g.p.x, x1: d.p.x, zf: f.p.z, zb: b.p.z }
  }
}

/**
 * Assise des chapeaux : on descend du sommet jusqu'a la premiere hauteur ou le corps est assez large
 * pour porter la coiffe (rayon `R` = 0,58 de la demi-largeur maximale). Sur une sphere la coiffe
 * s'assoit sous le sommet, sur un cube ou un galet elle se pose a plat sur le dessus.
 */
function assise(A: Ancres, hw: number, haut: number, H: number, zc: number) {
  const R = 0.58 * hw
  let best: { y: number; x0: number; x1: number; zf: number; zb: number } | null = null
  const pas = H / 80
  // jamais plus bas que 28 % de la hauteur : sur une pyramide ou une goutte, la coiffe se pose sur la pointe
  // (plus petite) au lieu de descendre devant les yeux
  for (let y = haut - pas * 0.5; y > haut - 0.28 * H; y -= pas) {
    const s = A.section(y)
    if (!s) continue
    if ((s.x1 - s.x0) / 2 >= R) {
      best = { y, ...s }
      break
    }
  }
  if (!best) {
    // sommet tres pointu (triangle, etoile) : on prend la section a 28 % de la hauteur
    const y = haut - 0.28 * H
    const s = A.section(y) ?? { x0: -R, x1: R, zf: zc + R, zb: zc - R }
    best = { y, ...s }
  }
  // Sommet creuse (le coeur : deux bosses et un creux) : la section du milieu est vide ou plus basse que les bosses, la
  // coiffe se serait assise DANS le creux, enfoncee dans les bosses. Elle repose sur le haut des deux bosses.
  const milieu = A.dessus(0, zc)
  if (milieu && haut - milieu.p.y > 0.05 * H) {
    let ymax = -Infinity
    let xPic = 0
    for (let k = -8; k <= 8; k++) {
      const h = A.dessus((k / 8) * R, zc)
      if (h && h.p.y > ymax) {
        ymax = h.p.y
        xPic = h.p.x
      }
    }
    const yMesure = ymax - 0.1 * H
    const g = A.cote(yMesure, zc, -1)
    const d = A.cote(yMesure, zc, 1)
    const f = A.avant(xPic, yMesure)
    const b = A.arriere(xPic, yMesure)
    const xr = g && d ? (d.p.x - g.p.x) / 2 : hw
    const zr = f && b ? (f.p.z - b.p.z) / 2 : R
    const Rr = Math.min(R, xr * 0.98)
    return { cx: 0, y: ymax + 0.05 * Rr, zc, R: Rr, rz: Math.min(Math.max(zr, Rr * 0.7), Rr * 1.1) }
  }
  const xr = Math.max(1, (best.x1 - best.x0) / 2)
  const zr = Math.max(1, (best.zf - best.zb) / 2)
  // rayon de coiffe : jamais plus large que le corps a cette hauteur
  const Rr = Math.min(R, xr * 0.98)
  const rz = Math.min(Math.max(Rr * (zr / xr), Rr * 0.7), Rr * 1.3)
  return { cx: (best.x0 + best.x1) / 2, y: best.y, zc: (best.zf + best.zb) / 2, R: Rr, rz }
}

/** Mesure tout ce qu'il faut du corps (maillage `geo`) et des yeux (positions de scene, y vers le haut). */
export function mesurerReperes(geo: BufferGeometry, yeuxScene: OeilScene[], rVerre: number): Reperes {
  const A = new Ancres(geo)
  const b = A.box
  const haut = b.max.y
  const bas = b.min.y
  const H = haut - bas
  const hw = Math.max(b.max.x, -b.min.x)
  const zc = (b.min.z + b.max.z) / 2
  const tete = assise(A, hw, haut, H, zc)
  const ye = [...yeuxScene].sort((p, q) => p.x - q.x)
  const yYeux = ye.length ? ye.reduce((s, o) => s + o.y, 0) / ye.length : haut - 0.45 * H
  const ecart = ye.length === 2 ? ye[1]!.x - ye[0]!.x : 0.26 * hw * 2
  // « cou » : vers 76 % de la hauteur ; si le bas du corps est creux a cet endroit (notch d'une etoile,
  // d'un nuage), on remonte jusqu'a retrouver du corps sur l'axe
  let yBas = haut - 0.76 * H
  for (let k = 0; k < 14 && !A.avant(0, yBas); k++) yBas += 0.025 * H
  return { A, haut, bas, hw, zc, H, tete, yeux: ye, yBas, yYeux, ecart, rVerre }
}

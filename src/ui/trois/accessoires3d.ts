/**
 * Accessoires 3D par emplacements (voir `bot/emplacements.ts`) : chaque piece est un vrai volume
 * (spheres, tubes, tores, revolutions, extrusions a biseau) enfant du maillage du corps. Elles
 * tournent donc avec lui et portent le MEME ombrage de matiere que le corps (`lisere.ts` : AO,
 * lueur bas-droite, lueur haut-gauche, repere de la vue). Matieres mates, aucune lumiere propre.
 *
 * Ancrage : `ancres.ts` tire des rayons sur le volume du corps de cette image. Une coiffe s'assoit
 * ou la coupe du corps est assez large, une monture se pose contre la face avant aux yeux,
 * une echarpe suit la coupe horizontale du corps, une moustache suit la surface : rien n'est
 * donne en dur pour une forme. Une piece rentre toujours un peu dans le corps (pas de vide).
 *
 * Collisions : chaque emplacement a sa zone (tete = au-dessus de l'assise, yeux = ligne des
 * yeux, visage = sous les yeux, bas = « cou » vers 79 % de la hauteur, dos = cotes et arriere).
 *
 * Importe `three` : ne se charge que par `scene3d.ts`, lui-meme dynamique.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  type MeshStandardMaterial,
  type MeshToonMaterial,
  type Object3D,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3
} from 'three'
import { lisere } from './lisere'
import type { Ombre } from '@/bot/portes'
import { mixHex } from '@/bot/skins'
import { EMPLACEMENTS, RETIRES, resoudre, couleursDe, type Emplacement, type Selection } from '@/bot/emplacements'
import type { OeilScene, Reperes } from './ancres'

type Materiau = MeshStandardMaterial | MeshToonMaterial

const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z)
const Z = V(0, 0, 1)
const Y = V(0, 1, 0)

/** Ce qu'un generateur recoit : le groupe a remplir, les reperes du corps, les couleurs et les outils. */
interface Ctx {
  g: Group
  R: Reperes
  c1: string
  c2: string
  /** matiere (clonee du corps, meme eclairage) ; `o` = opacite, `d` = double face */
  mat: (hex: string, o?: number, d?: boolean) => Materiau
  geos: BufferGeometry[]
  /** yeux (toujours deux) et rayon de verre */
  a: OeilScene
  b: OeilScene
  rv: number
}

/* ------------------------------------------------------------------ outils */

function add(c: Ctx, geo: BufferGeometry, hex: string, parent: Object3D = c.g, o = 1, d = false): Mesh {
  c.geos.push(geo)
  const m = new Mesh(geo, c.mat(hex, o, d))
  parent.add(m)
  return m
}

function sph(c: Ctx, hex: string, r: number, s: [number, number, number], p: Vector3, parent: Object3D = c.g, o = 1) {
  const m = add(c, new SphereGeometry(r, 24, 16), hex, parent, o)
  m.scale.set(...s)
  m.position.copy(p)
  return m
}

/** Tube qui suit une courbe, rayon de `r0` a `r1` ; bouts arrondis par defaut. */
function tube(c: Ctx, pts: Vector3[], r0: number, r1: number, hex: string, parent: Object3D = c.g, fermee = false, bouts = true, o = 1) {
  const courbe = new CatmullRomCurve3(pts, fermee, 'centripetal')
  const seg = Math.max(12, pts.length * 8)
  const radial = 14
  const geo = new TubeGeometry(courbe, seg, 1, radial, fermee)
  const P = geo.attributes.position!
  for (let i = 0; i <= seg; i++) {
    const u = fermee && i === seg ? 0 : i / seg
    const ctr = courbe.getPointAt(u)
    const k = r0 + (r1 - r0) * u
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j
      P.setXYZ(idx, ctr.x + (P.getX(idx) - ctr.x) * k, ctr.y + (P.getY(idx) - ctr.y) * k, ctr.z + (P.getZ(idx) - ctr.z) * k)
    }
  }
  P.needsUpdate = true
  geo.computeVertexNormals()
  const m = add(c, geo, hex, parent, o)
  if (bouts && !fermee) {
    sph(c, hex, r0, [1, 1, 1], pts[0]!, parent, o)
    sph(c, hex, r1, [1, 1, 1], pts[pts.length - 1]!, parent, o)
  }
  return m
}

/** Revolution autour de y : points [rayon, hauteur] du bas vers le haut, coins arrondis de `rc`. */
function revolution(pts: Array<[number, number]>, rc: number, seg = 48): LatheGeometry {
  const out: Vector2[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const a = pts[i - 1]
    const b = pts[i + 1]
    if (!a || !b || rc <= 0) {
      out.push(new Vector2(p[0], p[1]))
      continue
    }
    const da = Math.hypot(p[0] - a[0], p[1] - a[1])
    const db = Math.hypot(b[0] - p[0], b[1] - p[1])
    const ka = Math.min(rc, da / 2) / da
    const kb = Math.min(rc, db / 2) / db
    const p0: [number, number] = [p[0] + (a[0] - p[0]) * ka, p[1] + (a[1] - p[1]) * ka]
    const p1: [number, number] = [p[0] + (b[0] - p[0]) * kb, p[1] + (b[1] - p[1]) * kb]
    for (let t = 0; t <= 6; t++) {
      const u = t / 6
      const x = (1 - u) * (1 - u) * p0[0] + 2 * u * (1 - u) * p[0] + u * u * p1[0]
      const y = (1 - u) * (1 - u) * p0[1] + 2 * u * (1 - u) * p[1] + u * u * p1[1]
      out.push(new Vector2(x, y))
    }
  }
  return new LatheGeometry(out, seg)
}

/** Oriente `o` pour que son +z local pointe vers `dir`, puis le fait tourner de `roll` autour de cet axe. */
function orienter(o: Object3D, dir: Vector3, roll = 0) {
  const q = new Quaternion().setFromUnitVectors(Z, dir.clone().normalize())
  if (roll) q.multiply(new Quaternion().setFromAxisAngle(Z, roll))
  o.quaternion.copy(q)
}

/** Courbe fermee d'une forme de monture : points unitaires (x dans [-1, 1]). */
type Forme = (t: number) => [number, number]
const FORMES: Record<string, Forme> = {
  ronde: (t) => [Math.cos(t), Math.sin(t) * 1.1],
  carree: (t) => {
    const k = 0.5
    const cx = Math.cos(t)
    const sy = Math.sin(t)
    return [Math.sign(cx) * Math.abs(cx) ** k * 1.0, Math.sign(sy) * Math.abs(sy) ** k * 0.86]
  },
  coeur: (t) => {
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return [x / 16, y / 16 + 0.1]
  },
  etoile: (t) => {
    const f = (Math.cos(5 * (t - Math.PI / 2)) + 1) / 2
    const r = 0.56 + 0.44 * f ** 1.3
    return [Math.cos(t) * r * 1.05, Math.sin(t) * r * 1.05]
  }
}

function courbeForme(f: Forme, r: number, n = 56): Vector3[] {
  const pts: Vector3[] = []
  for (let i = 0; i < n; i++) {
    const [x, y] = f((i / n) * Math.PI * 2)
    pts.push(V(x * r, y * r, 0))
  }
  return pts
}

/** Fonction (x, y) -> z de la surface avant ou arriere, interpolee sur une grille de tirs. */
function grille(c: Ctx, x0: number, x1: number, y0: number, y1: number, nx = 9, ny = 7, arriere = false) {
  const zs: number[][] = []
  const fb = arriere ? c.R.A.box.min.z : c.R.A.box.max.z
  for (let j = 0; j < ny; j++) {
    const row: number[] = []
    for (let i = 0; i < nx; i++) {
      const x = x0 + ((x1 - x0) * i) / (nx - 1)
      const y = y0 + ((y1 - y0) * j) / (ny - 1)
      const h = arriere ? c.R.A.arriere(x, y) : c.R.A.avant(x, y)
      row.push(h ? h.p.z : (row[i - 1] ?? zs[j - 1]?.[i] ?? fb))
    }
    zs.push(row)
  }
  return (x: number, y: number) => {
    const u = Math.min(nx - 1, Math.max(0, ((x - x0) / (x1 - x0)) * (nx - 1)))
    const v = Math.min(ny - 1, Math.max(0, ((y - y0) / (y1 - y0)) * (ny - 1)))
    const i = Math.min(nx - 2, Math.floor(u))
    const j = Math.min(ny - 2, Math.floor(v))
    const fu = u - i
    const fv = v - j
    const a = zs[j]![i]! * (1 - fu) + zs[j]![i + 1]! * fu
    const b = zs[j + 1]![i]! * (1 - fu) + zs[j + 1]![i + 1]! * fu
    return a * (1 - fv) + b * fv
  }
}

/** Epouse la surface : chaque sommet recoit le z de la surface a son (x, y), plus son epaisseur propre. */
function epouser(geo: BufferGeometry, zs: (x: number, y: number) => number, decal: number, arriere = false) {
  const P = geo.attributes.position!
  for (let i = 0; i < P.count; i++) {
    const z0 = P.getZ(i)
    P.setZ(i, zs(P.getX(i), P.getY(i)) + (arriere ? -decal - z0 : decal + z0))
  }
  P.needsUpdate = true
  geo.computeVertexNormals()
}

/** Extrusion douce (biseau rond) d'une forme 2D centree en z. */
function extrusion(forme: Shape, epaisseur: number, biseau: number): ExtrudeGeometry {
  const g = new ExtrudeGeometry(forme, {
    depth: epaisseur,
    bevelEnabled: true,
    bevelThickness: biseau,
    bevelSize: biseau,
    bevelSegments: 4,
    curveSegments: 18
  })
  g.translate(0, 0, -epaisseur / 2)
  return g
}

function formeDePoints(pts: Array<[number, number]>): Shape {
  const s = new Shape()
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])))
  s.closePath()
  return s
}

/** Ellipse rognee en forme de goutte, de triangle, etc. : polygone arrondi par moyennes mobiles. */
function arrondir(pts: Array<[number, number]>, passes = 3): Array<[number, number]> {
  let cur = pts
  for (let p = 0; p < passes; p++) {
    const nxt: Array<[number, number]> = []
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!
      const b = cur[(i + 1) % cur.length]!
      nxt.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]])
    }
    cur = nxt
  }
  return cur
}

/** Noeud papillon / ruban : deux boucles, un noeud, deux pans. Repere local : face vers +z, largeur sur x. */
function noeud(c: Ctx, parent: Object3D, s: number, hex: string, noeudHex = hex, pans = true) {
  for (const sg of [-1, 1]) {
    const boucle = sph(c, hex, 1, [0.62 * s, 0.4 * s, 0.26 * s], V(sg * 0.6 * s, 0, 0), parent)
    boucle.rotation.z = sg * 0.2
    // pli au creux de la boucle : petite pastille plus foncee
    sph(c, mixHex(hex, '#000000', 0.12), 1, [0.34 * s, 0.2 * s, 0.2 * s], V(sg * 0.66 * s, 0, 0.1 * s), parent).rotation.z = sg * 0.2
    if (pans) {
      const p = sph(c, hex, 1, [0.17 * s, 0.5 * s, 0.1 * s], V(sg * 0.22 * s, -0.5 * s, -0.04 * s), parent)
      p.rotation.z = sg * 0.28
    }
  }
  sph(c, noeudHex, 1, [0.26 * s, 0.26 * s, 0.26 * s], V(0, 0, 0.04 * s), parent)
}

/** Fleur : petales sur un plan face a +z, coeur au centre. */
function fleur(c: Ctx, parent: Object3D, s: number, petale: string, coeur: string, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const m = sph(c, petale, 1, [0.3 * s, 0.4 * s, 0.14 * s], V(Math.cos(a) * 0.42 * s, Math.sin(a) * 0.42 * s, 0), parent)
    m.rotation.z = a - Math.PI / 2
  }
  sph(c, coeur, 1, [0.26 * s, 0.26 * s, 0.2 * s], V(0, 0, 0.06 * s), parent)
}

/** Pose un groupe sur la surface : sur le point `p`, face a la normale `n` (un peu enfonce). */
function poser(c: Ctx, p: Vector3, n: Vector3, enfonce: number, melange = 0, roll = 0): Group {
  const g = new Group()
  const dir = n.clone().lerp(Z, melange).normalize()
  g.position.copy(p).addScaledVector(n, -enfonce)
  orienter(g, dir, roll)
  c.g.add(g)
  return g
}

/** Anneau epais qui suit la coupe du corps a la hauteur y (echarpe, collier, bandeau) ; null si la coupe est vide. */
function ceinture(c: Ctx, y: number, r: number, hex: string, sortie = 0.35, n = 44, o = 1, incl = 0): { pts: Vector3[]; m: Mesh } | null {
  const cp = c.R.A.coupe(y + incl, n, 0, c.R.zc, incl)
  if (cp.length < n) return null
  const pts = cp.map((h) => h.p.clone().addScaledVector(h.n, r * sortie))
  const m = tube(c, pts, r, r, hex, c.g, true, false, o)
  return { pts, m }
}

/** Coiffe : groupe pose sur l'assise de la tete ; repere local = rayon de la coiffe 1, y vers le haut, +z devant. */
function coiffe(c: Ctx, k = 1.18): Group {
  const t = c.R.tete
  const g = new Group()
  g.position.set(t.cx, t.y - 0.07 * t.R, t.zc)
  g.scale.set(t.R * k, t.R * k, t.rz * k)
  c.g.add(g)
  return g
}

/* ------------------------------------------------------------------ tete */

type Gen = (c: Ctx) => void

const TETE: Record<string, Gen> = {
  casquette(c) {
    const g = coiffe(c)
    sph(c, c.c1, 1, [1.02, 0.9, 1.02], V(0, 0.04, 0), g)
    // visiere : pastille plate devant, penchee vers le bas
    const v = sph(c, c.c2, 1, [0.8, 0.13, 0.66], V(0, 0.14, 1.0), g)
    v.rotation.x = 0.3
    sph(c, c.c2, 0.11, [1, 1, 1], V(0, 0.93, 0), g)
    // bandeau : tore a la base de la calotte
    const b = add(c, new TorusGeometry(0.98, 0.06, 12, 48), mixHex(c.c1, '#000000', 0.12), g)
    b.rotation.x = Math.PI / 2
    b.position.y = 0.1
  },
  bonnet(c) {
    const g = coiffe(c)
    sph(c, c.c1, 1, [1.02, 1.08, 1.02], V(0, 0.02, 0), g)
    const r = add(c, new TorusGeometry(0.95, 0.27, 18, 48), c.c2, g)
    r.rotation.x = Math.PI / 2
    r.position.y = 0.14
    sph(c, c.c2, 0.32, [1, 1, 1], V(0.04, 1.1, 0), g)
  },
  beret(c) {
    const g = coiffe(c)
    const m = sph(c, c.c1, 1, [1.12, 0.46, 1.12], V(0.1, 0.22, 0), g)
    m.rotation.z = -0.2
    const q = add(c, new CylinderGeometry(0.07, 0.09, 0.2, 14), c.c1, g)
    q.position.set(-0.02, 0.62, 0)
    q.rotation.z = -0.2
    sph(c, mixHex(c.c1, '#000000', 0.1), 0.11, [1, 0.8, 1], V(-0.05, 0.74, 0), g)
  },
  'haut-de-forme'(c) {
    const g = coiffe(c)
    add(c, revolution([[0, -0.04], [1.25, -0.04], [1.25, 0.2], [0.68, 0.2], [0.66, 1.28], [0, 1.28]], 0.1), c.c1, g)
    const band = add(c, new CylinderGeometry(0.69, 0.7, 0.26, 40), c.c2, g)
    band.position.y = 0.36
  },
  couronne(c) {
    const g = coiffe(c)
    add(c, revolution([[0.86, -0.02], [1.04, -0.02], [1.04, 0.44], [0.86, 0.44]], 0.07), c.c1, g)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i / 5) * Math.PI * 2
      const px = Math.cos(a) * 0.95
      const pz = Math.sin(a) * 0.95
      const k = add(c, new ConeGeometry(0.2, 0.46, 20), c.c1, g)
      k.position.set(px, 0.62, pz)
      sph(c, c.c1, 0.1, [1, 1, 1], V(px, 0.86, pz), g)
    }
    for (const a of [Math.PI / 2, Math.PI / 2 + 0.55, Math.PI / 2 - 0.55]) {
      const p = V(Math.cos(a) * 1.0, 0.2, Math.sin(a) * 1.0)
      sph(c, a === Math.PI / 2 ? c.c2 : mixHex(c.c2, '#ffffff', 0.25), 0.1, [1, 1, 0.6], p, g)
    }
  },
  paille(c) {
    const g = coiffe(c)
    add(c, revolution([[0, 0.0], [1.1, 0.0], [1.7, -0.08], [1.95, -0.16], [1.95, 0.04], [1.7, 0.14], [1.1, 0.22], [0, 0.22]], 0.08), c.c1, g)
    sph(c, c.c1, 1, [0.86, 0.84, 0.86], V(0, 0.16, 0), g)
    const r = add(c, new TorusGeometry(0.85, 0.11, 14, 48), c.c2, g)
    r.rotation.x = Math.PI / 2
    r.position.y = 0.32
  },
  bob(c) {
    const g = coiffe(c)
    add(c, revolution([[0, 0.95], [0.8, 0.94], [1.0, 0.0], [1.6, -0.24], [1.6, -0.02], [1.0, 0.2], [0, 0.2]].reverse() as Array<[number, number]>, 0.07), c.c1, g, 1, true)
    const r = add(c, new TorusGeometry(0.92, 0.08, 12, 48), c.c2, g)
    r.rotation.x = Math.PI / 2
    r.position.y = 0.3
  },
  casque(c) {
    // Casque de musique : un arceau par-dessus la tete (tir de rayons dans le plan de face, du cote gauche au cote droit)
    // et deux coques sur les flancs, a hauteur des yeux ; chaque coque rentre un peu dans le corps comme les lunettes.
    const { A, hw, yYeux, zc, H } = c.R
    const yE = yYeux + 0.02 * H
    const L = 2 * hw + 80
    const arc: Vector3[] = []
    const cotes: Array<{ p: Vector3; n: Vector3; sg: number }> = []
    const K = 15
    for (let k = 0; k <= K; k++) {
      const th = 0.02 + (k / K) * (Math.PI - 0.04)
      const d = V(Math.cos(th), Math.sin(th), 0)
      const h = A.tir(V(d.x * L, yE + d.y * L, zc), d.clone().negate())
      if (!h) continue
      arc.push(h.p.clone().addScaledVector(h.n, 0.05 * hw))
      if (k === 0) cotes.push({ p: h.p, n: h.n, sg: 1 })
      if (k === K) cotes.push({ p: h.p, n: h.n, sg: -1 })
    }
    if (arc.length < 5 || cotes.length < 2) return
    tube(c, arc, 0.055 * hw, 0.055 * hw, c.c1)
    for (const { p, n } of cotes) {
      const g = new Group()
      g.position.copy(p).addScaledVector(n, 0.07 * hw)
      orienter(g, n)
      c.g.add(g)
      // coque, coussin et cache exterieur
      sph(c, c.c1, 1, [0.3 * hw, 0.37 * hw, 0.19 * hw], V(0, 0, 0), g)
      sph(c, mixHex(c.c2, '#000000', 0.06), 1, [0.23 * hw, 0.29 * hw, 0.06 * hw], V(0, 0, 0.16 * hw), g)
      sph(c, c.c1, 1, [0.13 * hw, 0.17 * hw, 0.04 * hw], V(0, 0, 0.21 * hw), g)
    }
  },
  oreilles(c) {
    const { A, tete: t, hw } = c.R
    const xs = [-0.62, -0.4, -0.2, 0, 0.2, 0.4, 0.62].map((k) => k * hw)
    const pts: Vector3[] = []
    for (const x of xs) {
      const h = A.dessus(x, t.zc)
      if (h) pts.push(h.p.clone().addScaledVector(h.n, t.R * 0.05))
    }
    if (pts.length >= 3) tube(c, pts, t.R * 0.13, t.R * 0.13, c.c1)
    for (const sg of [-1, 1]) {
      const h = A.dessus(sg * 0.5 * hw, t.zc)
      if (!h) continue
      const dir = h.n.clone().add(V(sg * 0.35, 0.9, 0.25)).normalize()
      const g = new Group()
      g.position.copy(h.p).addScaledVector(h.n, -t.R * 0.04)
      g.quaternion.setFromUnitVectors(Y, dir)
      c.g.add(g)
      const k = add(c, new ConeGeometry(t.R * 0.5, t.R * 1.0, 28), c.c1, g)
      k.scale.z = 0.62
      k.position.y = t.R * 0.4
      sph(c, c.c1, t.R * 0.13, [1, 1, 0.8], V(0, t.R * 0.93, 0), g)
      const i = add(c, new ConeGeometry(t.R * 0.34, t.R * 0.66, 24), c.c2, g)
      i.scale.z = 0.5
      i.position.set(0, t.R * 0.34, t.R * 0.12)
    }
  },
  antenne(c) {
    const { A, tete: t } = c.R
    const h = A.dessus(t.cx, t.zc)
    if (!h) return
    const p = h.p.clone().addScaledVector(h.n, -t.R * 0.08)
    const L = t.R * 1.1
    tube(c, [p, p.clone().add(V(t.R * 0.04, L * 0.4, 0)), p.clone().add(V(t.R * 0.16, L * 0.75, 0)), p.clone().add(V(t.R * 0.12, L, 0))], t.R * 0.11, t.R * 0.085, c.c1)
    sph(c, c.c2, t.R * 0.3, [1, 1, 1], p.clone().add(V(t.R * 0.12, L + t.R * 0.22, 0)))
  },
  ruban(c) {
    const { A, tete: t, hw } = c.R
    const h = A.dessus(0.4 * hw, t.zc)
    if (!h) return
    const g = poser(c, h.p, h.n, -t.R * 0.1, 0.9, -0.35)
    noeud(c, g, t.R * 0.95, c.c1, mixHex(c.c1, '#000000', 0.1))
  },
  fleur(c) {
    const { A, tete: t, hw } = c.R
    const h = A.dessus(-0.4 * hw, t.zc)
    if (!h) return
    const g = poser(c, h.p, h.n, -t.R * 0.12, 0.85)
    fleur(c, g, t.R * 0.95, c.c1, c.c2)
  },
  fete(c) {
    const g = coiffe(c)
    const k = add(c, new ConeGeometry(0.92, 2.0, 44), c.c1, g)
    k.position.y = 1.0
    k.rotation.z = -0.1
    for (const [y, rr] of [[0.5, 0.72], [1.0, 0.5]] as const) {
      const r = add(c, new TorusGeometry(rr, 0.06, 10, 44), c.c2, g)
      r.rotation.x = Math.PI / 2
      r.position.set(-0.1 * y, y, 0)
    }
    sph(c, c.c2, 0.26, [1, 1, 1], V(-0.2, 2.02, 0), g)
  },
  toque(c) {
    const g = coiffe(c)
    add(c, revolution([[0, 0], [0.9, 0], [0.9, 0.5], [0, 0.5]].reverse() as Array<[number, number]>, 0.06), c.c1, g, 1, true)
    sph(c, c.c1, 1, [0.98, 0.62, 0.98], V(0, 0.9, 0), g)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      sph(c, c.c1, 0.4, [1, 1, 1], V(Math.cos(a) * 0.66, 0.86, Math.sin(a) * 0.66), g)
    }
    const r = add(c, new TorusGeometry(0.9, 0.04, 8, 40), mixHex(c.c1, '#000000', 0.12), g)
    r.rotation.x = Math.PI / 2
    r.position.y = 0.28
  }
}

/* ------------------------------------------------------------------ yeux */

/** z de la face avant au droit d'un verre : le point le plus avance du pourtour. */
function zVerre(c: Ctx, o: OeilScene, r: number): number {
  let z = -Infinity
  const A = c.R.A
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    const h = A.avant(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 1.1)
    if (h) z = Math.max(z, h.p.z)
  }
  const m = A.avant(o.x, o.y)
  if (m) z = Math.max(z, m.p.z)
  return z === -Infinity ? A.box.max.z : z
}

/** Rayon commun des verres : tangents, comme les anciennes lunettes. */
function rayonMonture(c: Ctx, k = 1.05): number {
  return Math.min(c.rv * k, (c.b.x - c.a.x) / 2 / 1.17)
}

/** Monture double (deux verres) : tube sur la forme, verre translucide, pont et branches rentrant dans la tete. */
function lunettes(c: Ctx, forme: Forme, o: { verre: string; opacite: number; tube?: number; k?: number; plein?: boolean }) {
  const r = rayonMonture(c, o.k ?? 1.25)
  const tu = (o.tube ?? 0.2) * r
  const z = Math.max(zVerre(c, c.a, r), zVerre(c, c.b, r)) + 0.14 * r
  for (const e of [c.a, c.b]) {
    const pts = courbeForme(forme, r).map((p) => p.add(V(e.x, e.y, z)))
    tube(c, pts, tu, tu, c.c1, c.g, true, false)
    const sh = new Shape(courbeForme(forme, r * 0.98).map((p) => new Vector2(p.x, p.y)))
    const lens = add(c, new ShapeGeometry(sh, 24), o.verre, c.g, o.opacite, true)
    lens.position.set(e.x, e.y, z - tu * 0.3)
  }
  // pont
  const y0 = (c.a.y + c.b.y) / 2 + 0.08 * r
  tube(c, [V(c.a.x + r * 0.9, y0, z), V((c.a.x + c.b.x) / 2, y0 + 0.2 * r, z + tu * 0.2), V(c.b.x - r * 0.9, y0, z)], tu * 0.7, tu * 0.7, c.c1)
  // branches : de la charniere vers l'interieur de la tete, elles ressortent sur le cote
  for (const [e, sg] of [[c.a, -1], [c.b, 1]] as const) {
    const xo = e.x + sg * (r + tu * 0.4)
    const bord = c.R.A.cote(e.y, c.R.zc, sg)
    const xe = bord ? bord.p.x : xo + sg * 0.8 * r
    const dedans = (x: number, k: number) => Math.min(z, c.R.A.avant(x - sg * 2, e.y)?.p.z ?? z) - tu * k - 0.3 * r
    tube(
      c,
      [V(xo, e.y + 0.1 * r, z), V(xo + (xe - xo) * 0.06, e.y + 0.1 * r, dedans(xo, 1.2)), V(xo + (xe - xo) * 0.5, e.y + 0.1 * r, dedans(xo + (xe - xo) * 0.5, 2.5) * 0.6), V(xe - sg * tu * 0.3, e.y + 0.1 * r, -0.05 * r + c.R.zc)],
      tu * 0.7,
      tu * 0.7,
      c.c1,
      c.g,
      false,
      false
    )
  }
}

const YEUX: Record<string, Gen> = {
  rondes: (c) => lunettes(c, FORMES.ronde!, { verre: '#ffffff', opacite: 0.16 }),
  carrees: (c) => lunettes(c, FORMES.carree!, { verre: '#ffffff', opacite: 0.16, tube: 0.19 }),
  soleil: (c) => lunettes(c, FORMES.ronde!, { verre: '#15131c', opacite: 0.9, tube: 0.2 }),
  coeur: (c) => lunettes(c, FORMES.coeur!, { verre: mixHex(c.c1, '#ffffff', 0.35), opacite: 0.5, tube: 0.16, k: 1.15 }),
  etoile: (c) => lunettes(c, FORMES.etoile!, { verre: mixHex(c.c1, '#ffffff', 0.4), opacite: 0.5, tube: 0.16, k: 1.15 }),
  monocle(c) {
    const r = rayonMonture(c, 1.2) * 1.1
    const e = c.b
    const z = zVerre(c, e, r) + 0.14 * r
    const tu = 0.15 * r
    tube(c, courbeForme(FORMES.ronde!, r).map((p) => p.add(V(e.x, e.y, z))), tu, tu, c.c1, c.g, true, false)
    const lens = add(c, new ShapeGeometry(new Shape(courbeForme(FORMES.ronde!, r * 0.98).map((p) => new Vector2(p.x, p.y))), 24), '#ffffff', c.g, 0.16, true)
    lens.position.set(e.x, e.y, z - tu * 0.3)
    // chaine : suit la surface en descendant vers le bas
    const pts: Vector3[] = []
    for (let k = 0; k <= 5; k++) {
      const x = e.x + r * (0.95 + 0.38 * k)
      const y = e.y - r * (0.7 + 1.0 * k)
      const h = c.R.A.avant(x, y)
      if (h) pts.push(h.p.clone().addScaledVector(h.n, tu * 0.2))
    }
    if (pts.length >= 3) tube(c, pts, tu * 0.5, tu * 0.5, c.c2)
  },
  sommeil(c) {
    const r = c.rv
    const y = (c.a.y + c.b.y) / 2
    const z = Math.max(zVerre(c, c.a, r), zVerre(c, c.b, r)) + 0.2 * r
    const tu = 0.22 * r
    ceinture(c, y, tu, c.c1, 0.1)
    const larg = c.b.x - c.a.x
    const pad = add(c, new CapsuleGeometry(1.25 * r, larg, 12, 28), c.c1)
    pad.rotation.z = Math.PI / 2
    pad.scale.z = 0.4
    pad.position.set((c.a.x + c.b.x) / 2, y, z)
    // yeux fermes brodes : deux arcs doux et des cils
    for (const e of [c.a, c.b]) {
      const pts: Vector3[] = []
      for (let k = 0; k <= 8; k++) {
        const u = (k / 8) * 2 - 1
        pts.push(V(e.x + u * 0.62 * r, e.y - 0.12 * r + 0.3 * r * (u * u - 0.5) * -1, z + 0.4 * 1.25 * r))
      }
      tube(c, pts, 0.07 * r, 0.07 * r, c.c2)
      for (const u of [-0.5, 0, 0.5]) {
        const x = e.x + u * 0.62 * r
        const y0 = e.y - 0.12 * r - 0.3 * r * (u * u - 0.5)
        tube(c, [V(x, y0, z + 0.5 * r), V(x + u * 0.2 * r, y0 - 0.26 * r, z + 0.5 * r)], 0.05 * r, 0.04 * r, c.c2)
      }
    }
  },
  ski(c) {
    const r = c.rv
    const y = (c.a.y + c.b.y) / 2
    const z = Math.max(zVerre(c, c.a, r), zVerre(c, c.b, r)) + 0.1 * r
    ceinture(c, y, 0.34 * r, c.c1, 0.1)
    const larg = c.b.x - c.a.x
    const cadre = add(c, new CapsuleGeometry(1.5 * r, larg + 0.1 * r, 16, 48), c.c1)
    cadre.rotation.z = Math.PI / 2
    cadre.scale.z = 0.6
    cadre.position.set((c.a.x + c.b.x) / 2, y, z)
    const verre = add(c, new CapsuleGeometry(1.2 * r, larg + 0.1 * r, 16, 48), c.c2, c.g, 0.72)
    verre.rotation.z = Math.PI / 2
    verre.scale.z = 0.6
    verre.position.set((c.a.x + c.b.x) / 2, y, z + 0.3 * r)
  },
  domino(c) {
    const r = c.rv
    const y = (c.a.y + c.b.y) / 2
    const demi = (c.b.x - c.a.x) / 2 + 2.1 * r
    const s = new Shape()
    // masque de heros : deux ailes pointues vers le haut a l'exterieur, creux au nez
    s.moveTo(-demi, y + 0.9 * r)
    s.bezierCurveTo(-demi * 0.8, y + 1.9 * r, -demi * 0.35, y + 2.0 * r, 0, y + 1.0 * r)
    s.bezierCurveTo(demi * 0.35, y + 2.0 * r, demi * 0.8, y + 1.9 * r, demi, y + 0.9 * r)
    s.bezierCurveTo(demi * 0.95, y - 1.5 * r, demi * 0.45, y - 1.6 * r, 0, y - 1.0 * r)
    s.bezierCurveTo(-demi * 0.45, y - 1.6 * r, -demi * 0.95, y - 1.5 * r, -demi, y + 0.9 * r)
    for (const e of [c.a, c.b]) {
      const h = new Shape()
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * Math.PI * 2
        const px = e.x + Math.cos(a) * 0.7 * r
        const py = e.y + Math.sin(a) * 1.0 * r
        i ? h.lineTo(px, py) : h.moveTo(px, py)
      }
      s.holes.push(h)
    }
    const geo = extrusion(s, 0.16 * r, 0.08 * r)
    const zs = grille(c, -demi - 2, demi + 2, y - 1.4 * r, y + 1.6 * r, 13, 7)
    epouser(geo, zs, 0.08 * r)
    add(c, geo, c.c1)
    // bandeau de maintien derriere la tete, cache de face
    ceinture(c, y, 0.1 * r, c.c1, 0.0)
  }
}

/* ------------------------------------------------------------------ visage */

/** Metriques du visage : ligne des joues et de la bouche, relatives a la taille des yeux. */
function visage(c: Ctx) {
  const y = (c.a.y + c.b.y) / 2
  const rv = c.rv
  // `rv` = taille des pieces (un peu plus grosses que l'oeil), les hauteurs viennent du rayon de verre
  return { y, rv: 1.5 * rv, cx: (c.a.x + c.b.x) / 2, yJoue: y - 1.5 * rv, yBouche: y - 2.1 * rv, demi: (c.b.x - c.a.x) / 2 }
}

/** Point de la surface avant a (x, y) ; null si le corps n'y est pas. */
function surf(c: Ctx, x: number, y: number) {
  return c.R.A.avant(x, y)
}

const VISAGE: Record<string, Gen> = {
  moustache(c) {
    const f = visage(c)
    const s = 0.62 * f.rv
    for (const sg of [-1, 1]) {
      const ctrl: Array<[number, number]> = [[0.15, 0.1], [0.65, -0.18], [1.25, -0.2], [1.8, 0.14], [2.0, 0.5]]
      const pts: Vector3[] = []
      for (const [dx, dy] of ctrl) {
        const h = surf(c, f.cx + sg * dx * s, f.yBouche + dy * s)
        if (h) pts.push(h.p.clone().addScaledVector(h.n, s * 0.06))
      }
      if (pts.length >= 4) tube(c, pts, 0.5 * s, 0.12 * s, c.c1)
    }
    const h = surf(c, f.cx, f.yBouche + 0.05 * s)
    if (h) sph(c, c.c1, 0.4 * s, [1.3, 0.9, 0.8], h.p.clone().addScaledVector(h.n, 0.0))
  },
  chat(c) {
    const f = visage(c)
    const s = f.rv
    for (const sg of [-1, 1]) {
      for (const ang of [0.32, 0, -0.32]) {
        const pts: Vector3[] = []
        for (let k = 0; k <= 4; k++) {
          const d = 0.5 + k * 0.38
          const x = f.cx + sg * (f.demi * 0.45 + Math.cos(ang) * d * s)
          const y = f.yBouche + 0.5 * s + Math.sin(ang) * d * s - 0.04 * k * s
          const h = surf(c, x, y)
          if (h) pts.push(h.p.clone().addScaledVector(h.n, s * 0.06))
        }
        if (pts.length >= 3) tube(c, pts, 0.1 * s, 0.045 * s, c.c1)
      }
    }
    const h = surf(c, f.cx, f.yBouche + 0.7 * s)
    if (h) {
      const g = poser(c, h.p, h.n, 0.06 * s, 0.3)
      const n = sph(c, c.c2, 1, [0.3 * s, 0.22 * s, 0.17 * s], V())
      g.add(n)
    }
  },
  pansement(c) {
    const f = visage(c)
    const s = f.rv
    const h = surf(c, f.cx - f.demi * 1.0 - 0.1 * s, f.yJoue + 0.1 * s)
    if (!h) return
    const g = poser(c, h.p, h.n, 0.16 * s, 0.35, 0.6)
    const pad = add(c, new CapsuleGeometry(0.4 * s, 1.5 * s, 8, 20), c.c1, g)
    pad.rotation.z = Math.PI / 2
    pad.scale.z = 0.38
    const pad2 = add(c, new CapsuleGeometry(0.2 * s, 0.1 * s, 6, 14), c.c2, g)
    pad2.rotation.z = Math.PI / 2
    pad2.scale.set(1.2, 1.4, 0.5)
    pad2.position.z = 0.1 * s
    for (const sx of [-0.45, 0.45]) sph(c, mixHex(c.c1, '#000000', 0.15), 0.04 * s, [1, 1, 1], V(sx * s, 0.15 * s, 0.14 * s), g)
  },
  rousseur(c) {
    const f = visage(c)
    const s = f.rv
    const taches: Array<[number, number, number]> = [[0, 0.05, 0.8], [0.55, -0.15, 0.65], [-0.4, -0.3, 0.7]]
    for (const sg of [-1, 1]) {
      const cx = f.cx + sg * (f.demi + 0.25 * s)
      for (const [dx, dy, k] of taches) {
        const h = surf(c, cx + sg * dx * s * 0.95, f.yJoue + dy * s * 0.6)
        if (!h) continue
        const g = poser(c, h.p, h.n, 0.05 * s, 0.2)
        g.add(sph(c, c.c1, 1, [0.17 * s * k, 0.17 * s * k, 0.1 * s], V()))
      }
    }
  },
  joues(c) {
    const f = visage(c)
    const s = f.rv
    for (const sg of [-1, 1]) {
      const h = surf(c, f.cx + sg * (f.demi + 0.75 * s), f.yJoue - 0.15 * s)
      if (!h) continue
      const g = poser(c, h.p, h.n, 0.1 * s, 0.25)
      g.add(sph(c, c.c1, 1, [0.6 * s, 0.44 * s, 0.24 * s], V()))
    }
  },
  grain(c) {
    const f = visage(c)
    const s = f.rv
    const h = surf(c, f.cx + f.demi * 0.9, f.yBouche + 0.2 * s)
    if (!h) return
    const g = poser(c, h.p, h.n, 0.04 * s, 0.2)
    g.add(sph(c, c.c1, 1, [0.2 * s, 0.2 * s, 0.14 * s], V()))
  },
  larme(c) {
    const f = visage(c)
    const s = f.rv
    const h = surf(c, c.b.x + 0.1 * s, c.b.y - 1.15 * s)
    if (!h) return
    const g = new Group()
    g.position.copy(h.p).addScaledVector(h.n, -0.05 * s)
    c.g.add(g)
    sph(c, c.c1, 1, [0.36 * s, 0.4 * s, 0.26 * s], V(0, 0, 0.06 * s), g)
    const k = add(c, new ConeGeometry(0.29 * s, 0.6 * s, 22), c.c1, g)
    k.scale.z = 0.7
    k.position.set(0, 0.45 * s, 0.06 * s)
    // petit reflet
    sph(c, mixHex(c.c1, '#ffffff', 0.7), 1, [0.08 * s, 0.12 * s, 0.07 * s], V(-0.12 * s, 0.0, 0.26 * s), g)
  }
}

/* ------------------------------------------------------------------ bas */

/** Inclinaison des anneaux du cou : l'avant est plus bas que l'arriere. */
const dip = (c: Ctx) => 0.19 * c.R.hw

/** Point d'attache d'un objet au « cou » : devant, au milieu, a la hauteur du bas. */
function devant(c: Ctx, dy = 0, x = 0) {
  return surf(c, x, c.R.yBas + dy)
}

/** Anneau du cou (tube) incline : l'avant est a la hauteur du cou, l'arriere plus haut. */
const anneau = (c: Ctx, r: number, hex: string, sortie = 0.35, n = 48) => ceinture(c, c.R.yBas, r, hex, sortie, n, 1, dip(c))

/** Pan a plat qui epouse le devant du corps : contour 2D (origine en haut au centre), extrusion douce. */
function pan(c: Ctx, contour: Array<[number, number]>, hex: string, y0: number, ep: number, hauteurMax: number, decal: number) {
  const hw = c.R.hw
  const geo = extrusion(formeDePoints(contour), ep, ep * 0.9)
  geo.translate(0, y0, 0)
  epouser(geo, grille(c, -hw * 0.7, hw * 0.7, y0 - hauteurMax - 4, y0 + 8, 13, 9), decal)
  return add(c, geo, hex)
}

/** Espace libre sous le cou, pour qu'un pan ne depasse pas le bas du corps. */
const libre = (c: Ctx) => Math.max(8, c.R.yBas - c.R.bas - 0.04 * c.R.H)

/**
 * Pan qui TOMBE, en coussin doux : demi-largeur `W(t)` (t = 0 en haut, 1 en bas), deux peaux (face bombee et
 * dos plat) refermees sur les bords. Le haut est colle au corps, puis le pan se decolle (`gap`, courbe en
 * t^1.5) et se balance de `swing` : rien n'est plaque. `t0..t1` limite la piece (rayures).
 */
function pendant(c: Ctx, W: (t: number) => number, hex: string, o: { x0: number; yTop: number; L: number; ep: number; gap: number; swing: number; decal: number; t0?: number; t1?: number; plus?: number; wmax: number }) {
  const { x0, yTop, L, ep, gap, swing, decal, wmax } = o
  const t0 = o.t0 ?? 0
  const t1 = o.t1 ?? 1
  const plus = o.plus ?? 0
  const zs = grille(c, x0 - wmax - 6, x0 + wmax + 6 + Math.abs(swing), yTop - L - 6, yTop + 8, 15, 13)
  const nt = Math.max(3, Math.round(14 * (t1 - t0)))
  const nu = 10
  const pos: number[] = []
  for (const face of [1, 0]) {
    for (let i = 0; i <= nt; i++) {
      const t = t0 + ((t1 - t0) * i) / nt
      const w = W(t)
      // fondu du volume aux deux bouts (le haut se glisse sous le corps, le bas se referme)
      const fin = Math.min(1, t * 7, Math.max(0, (1 - t) * 9)) ** 0.5
      for (let j = 0; j <= nu; j++) {
        const u = (j / nu) * 2 - 1
        const x = x0 + u * w + swing * t * t
        const y = yTop - t * L
        const bomb = face ? (ep + plus) * (1 - u * u) ** 0.55 * fin : 0
        pos.push(x, y, zs(x, y) + decal + gap * t ** 1.5 + bomb)
      }
    }
  }
  const idx: number[] = []
  const nv = (nt + 1) * (nu + 1)
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j < nu; j++) {
        const a = f * nv + i * (nu + 1) + j
        const b = a + nu + 1
        idx.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return add(c, geo, hex, c.g, 1, true)
}

/**
 * Bande large qui epouse le contour du corps (col, echarpe) : plusieurs coupes horizontales du corps, une
 * peau douce qui sort de `e0` a `e0 + eb` au milieu et rentre dans le corps sur ses bords. Rend le fait
 * qu'elle existe (coupe vide : false).
 */
function bande(c: Ctx, y: number, larg: number, hex: string, o: { e0: number; eb: number; n?: number; rows?: number; incl?: number; ronde?: boolean }): boolean {
  const n = o.n ?? 56
  const rows = o.rows ?? 6
  const incl = o.incl ?? 0
  const pos: number[] = []
  const rangs: Vector3[][] = []
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1)
    const cp = c.R.A.coupe(y + (v - 0.5) * larg + incl, n, 0, c.R.zc, incl)
    if (cp.length < n) return false
    const e = o.e0 + o.eb * Math.sin(Math.PI * v) ** 0.7
    const r = cp.map((q) => q.p.clone().addScaledVector(q.n, e))
    rangs.push(r)
    for (const p of r) pos.push(p.x, p.y, p.z)
  }
  const idx: number[] = []
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i
      const b = j * n + ((i + 1) % n)
      idx.push(a, b, a + n, b, b + n, a + n)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  add(c, geo, hex, c.g, 1, true)
  if (o.ronde) {
    // bourrelets arrondis sur les deux bords : la bande n'a plus l'air d'un papier
    for (const j of [0, rows - 1]) tube(c, rangs[j]!, larg * 0.11, larg * 0.11, hex, c.g, true, false)
  }
  return true
}

/** Une aile de noeud papillon : revolution pincee au centre, bombee, a plis doux. Axe x local, `sg` = cote. */
function aileNoeud(c: Ctx, parent: Object3D, s: number, hex: string, sg: number) {
  const nt = 26
  const np = 30
  const pos: number[] = []
  const idx: number[] = []
  const long = 1.0 * s
  for (let i = 0; i <= nt; i++) {
    const t = i / nt
    // profil : pince au centre, s'evase, puis se referme en arrondi
    const fin = t > 0.8 ? Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) : 1
    const r = (0.12 + 0.88 * Math.sin((t * Math.PI) / 2) ** 1.15) * fin
    for (let j = 0; j <= np; j++) {
      const a = (j / np) * Math.PI * 2
      // plis : trois creux doux qui partent du noeud
      const pli = 1 + 0.07 * Math.cos(3 * a + 0.4) * Math.sin(Math.PI * Math.min(1, t * 1.15))
      const ry = 0.62 * s * r * pli
      const rz = 0.46 * s * r * pli
      pos.push(sg * (0.1 * s + t * long), Math.cos(a) * ry, Math.sin(a) * rz)
    }
  }
  for (let i = 0; i < nt; i++) {
    for (let j = 0; j < np; j++) {
      const a = i * (np + 1) + j
      const b = a + np + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const m = add(c, geo, hex, parent, 1, true)
  m.rotation.z = sg * 0.14
  // petite pastille plus foncee au creux de l'aile : le pli central
  const pl = sph(c, mixHex(hex, '#000000', 0.14), 1, [0.34 * s, 0.1 * s, 0.1 * s], V(sg * 0.5 * s, 0, 0.3 * s), parent)
  pl.rotation.z = sg * 0.14
}

/** Vrai noeud papillon : deux ailes bombees pincees au centre, un noeud net, deux petits pans. */
function papillon3d(c: Ctx, parent: Object3D, s: number, hex: string, noeudHex: string) {
  aileNoeud(c, parent, s, hex, -1)
  aileNoeud(c, parent, s, hex, 1)
  // noeud central : sangle serree
  sph(c, noeudHex, 1, [0.2 * s, 0.34 * s, 0.26 * s], V(0, 0, 0.02 * s), parent)
  const bague = add(c, new TorusGeometry(0.2 * s, 0.05 * s, 10, 24), mixHex(noeudHex, '#000000', 0.1), parent)
  bague.rotation.y = Math.PI / 2
  bague.scale.set(1, 1.4, 1)
}

const BAS: Record<string, Gen> = {
  papillon(c) {
    const h = devant(c)
    if (!h) return
    const s = c.R.hw * 0.45
    const g = poser(c, h.p, h.n, -s * 0.12, 0.6)
    papillon3d(c, g, s, c.c1, mixHex(c.c1, '#000000', 0.12))
  },
  cravate(c) {
    const hw = c.R.hw
    const w = hw * 0.25
    const yTop = c.R.yBas + 0.3 * hw
    const h = surf(c, 0, yTop)
    if (!h) return
    const L = Math.min(0.75 * hw, yTop - c.R.bas - 0.03 * c.R.H)
    // lame de cravate : fine au noeud, large en bas, bout en pointe ; elle se decolle du corps
    const W = (t: number) => (t < 0.12 ? w * (0.3 + 0.2 * (t / 0.12)) : t < 0.8 ? w * (0.5 + 0.5 * ((t - 0.12) / 0.68) ** 0.9) : w * Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) * 1.0)
    const o = { x0: 0, yTop, L, ep: 0.2 * w, gap: 0.3 * hw, swing: 0.05 * hw, decal: 0.03 * hw, wmax: w }
    pendant(c, W, c.c1, o)
    for (const [t0, t1] of [[0.42, 0.5], [0.58, 0.66]] as const) pendant(c, W, c.c2, { ...o, t0, t1, plus: 0.05 * w, decal: o.decal + 0.004 * hw })
    // noeud : petit volume serre au sommet de la lame
    const g = poser(c, h.p, h.n, -0.18 * w, 0.4)
    g.add(sph(c, mixHex(c.c1, '#000000', 0.15), 1, [0.58 * w, 0.46 * w, 0.46 * w], V(0, 0, 0)))
  },
  echarpe(c) {
    const hw = c.R.hw
    const larg = hw * 0.36
    // col epais, bombe, qui epouse le contour du corps (aucun anneau libre)
    if (!bande(c, c.R.yBas + 0.2 * hw, larg, c.c1, { e0: -0.03 * hw, eb: 0.15 * hw, incl: dip(c), ronde: true, rows: 7 })) return
    // deux pans qui tombent du nœud, decolles du corps, avec leurs rayures
    const yTop = c.R.yBas + 0.2 * hw - 0.12 * larg
    const mk = (x0: number, L: number, w: number, gap: number, decal: number, swing: number) => {
      const W = (t: number) => w * (t > 0.9 ? Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) * 0.4 + 0.6 : 1)
      const o = { x0, yTop, L, ep: 0.45 * w, gap, swing, decal, wmax: w }
      pendant(c, W, c.c1, o)
      for (const [t0, t1] of [[0.55, 0.64], [0.74, 0.83]] as const) pendant(c, W, c.c2, { ...o, t0, t1, plus: 0.05 * w, decal: decal + 0.004 * hw })
    }
    const Lmax = yTop - c.R.bas - 0.04 * c.R.H
    mk(0.26 * hw, Math.min(0.9 * hw, Lmax), 0.16 * hw, 0.3 * hw, 0.05 * hw, 0.05 * hw)
    mk(0.44 * hw, Math.min(0.62 * hw, Lmax * 0.75), 0.15 * hw, 0.2 * hw, 0.06 * hw, 0.11 * hw)
  },
  perles(c) {
    const r = c.R.hw * 0.075
    const cp = c.R.A.coupe(c.R.yBas + dip(c), 72, 0, c.R.zc, dip(c))
    if (cp.length < 72) return
    const pts = cp.map((q) => q.p.clone().addScaledVector(q.n, r * 0.45))
    const courbe = new CatmullRomCurve3(pts, true, 'centripetal')
    const n = Math.round(courbe.getLength() / (2 * r * 0.97))
    const geo = new SphereGeometry(r, 20, 14)
    c.geos.push(geo)
    const mat = c.mat(c.c1)
    for (let i = 0; i < n; i++) {
      const m = new Mesh(geo, mat)
      m.position.copy(courbe.getPointAt(i / n))
      c.g.add(m)
    }
  },
  bandana(c) {
    const r = c.R.hw * 0.1
    anneau(c, r, c.c1, 0.3)
    const w = c.R.hw * 0.62
    const L = Math.min(0.62 * c.R.hw, libre(c) + 0.2 * c.R.hw)
    const y0 = c.R.yBas - 0.3 * r
    pan(c, arrondir([[-w, 0], [w, 0], [0, -L]], 3), c.c1, y0, 0.06 * w, L + w, 0.12 * w)
    for (const [dx, dy, k] of [[0, 0.3, 1], [-0.42, 0.14, 0.85], [0.42, 0.14, 0.85], [0, 0.62, 0.8]] as const) {
      const h = surf(c, dx * w, y0 - dy * L - 0.05 * w)
      if (!h) continue
      const g = poser(c, h.p, h.n, -0.03 * w, 0.2)
      g.add(sph(c, c.c2, 1, [0.1 * w * k, 0.1 * w * k, 0.06 * w], V()))
    }
  },
  medaille(c) {
    const hw = c.R.hw
    const yH = c.R.yBas + 0.2 * hw
    const yM = c.R.yBas - 0.1 * hw
    const pts: Vector3[] = []
    const r = hw * 0.05
    const half = c.R.A.section(yH)
    const xe = half ? Math.min(half.x1, -half.x0) * 0.82 : hw * 0.6
    for (const [k, y] of [[-1, yH], [-0.55, (yH + yM) / 2 + 0.05 * hw], [0, yM + 0.09 * hw], [0.55, (yH + yM) / 2 + 0.05 * hw], [1, yH]] as const) {
      const h = surf(c, k * xe, y)
      if (h) pts.push(h.p.clone().addScaledVector(h.n, r * 0.3))
    }
    if (pts.length >= 4) tube(c, pts, r, r, c.c2, c.g, false, false)
    const h = surf(c, 0, yM)
    if (!h) return
    const g = poser(c, h.p, h.n, -hw * 0.02, 0.5)
    const R = hw * 0.17
    const o = add(c, new CylinderGeometry(R, R, hw * 0.07, 40), c.c1, g)
    o.rotation.x = Math.PI / 2
    const i = add(c, new CylinderGeometry(R * 0.72, R * 0.72, hw * 0.09, 40), mixHex(c.c1, '#ffffff', 0.3), g)
    i.rotation.x = Math.PI / 2
    const bord = add(c, new TorusGeometry(R, hw * 0.03, 12, 40), c.c1, g)
    bord.position.z = hw * 0.03
    sph(c, c.c1, R * 0.3, [1, 1, 0.5], V(0, 0, hw * 0.05), g)
  },
  clochette(c) {
    const hw = c.R.hw
    anneau(c, hw * 0.065, c.c1, 0.3)
    const h = devant(c, 0)
    if (!h) return
    const g = poser(c, h.p, h.n, -hw * 0.03, 0.4)
    g.position.y -= hw * 0.12
    sph(c, c.c2, hw * 0.14, [1, 1, 1], V(0, 0, 0), g)
    sph(c, mixHex(c.c2, '#000000', 0.5), 1, [hw * 0.1, hw * 0.016, hw * 0.03], V(0, -hw * 0.03, hw * 0.13), g)
    const a = add(c, new TorusGeometry(hw * 0.045, hw * 0.017, 10, 24), c.c2, g)
    a.position.y = hw * 0.15
  },
  fleurs(c) {
    const hw = c.R.hw
    const N = 84
    const cp = c.R.A.coupe(c.R.yBas + dip(c), N, 0, c.R.zc, dip(c))
    if (cp.length < N) return
    tube(c, cp.map((q) => q.p.clone().addScaledVector(q.n, hw * 0.015)), hw * 0.035, hw * 0.035, '#4caf7a', c.g, true, false)
    // beaucoup de fleurs, serrees : une fleur tous les 3 points, alternance de deux tailles et de deux teintes
    const nf = 30
    for (let i = 0; i < nf; i++) {
      const q = cp[Math.round((i / nf) * N) % N]!
      const g = new Group()
      g.position.copy(q.p).addScaledVector(q.n, hw * 0.025)
      orienter(g, q.n.clone().lerp(Z, 0.25), i * 0.7)
      c.g.add(g)
      fleur(c, g, hw * (i % 2 ? 0.15 : 0.18), i % 3 === 0 ? mixHex(c.c1, '#ffffff', 0.35) : c.c1, c.c2, 5)
    }
  }
}

/* ------------------------------------------------------------------ dos */

/** Une aile : contour 2D (unite = envergure 1) extrude en biseau, pose sur le cote du corps. */
function aile(c: Ctx, contour: (s: Shape) => void, hex: string, lisere1?: string) {
  const { A, hw, H, haut, zc } = c.R
  const L = hw * 1.2
  const y = haut - 0.4 * H
  for (const sg of [-1, 1]) {
    const h = A.cote(y, zc - 0.15 * hw, sg)
    if (!h) continue
    const s = new Shape()
    contour(s)
    const geo = extrusion(s, 0.07, 0.04)
    geo.scale(L, L, L)
    const m = new Mesh(geo, c.mat(hex, 1, true))
    c.geos.push(geo)
    const sweep = 0.42
    const X = V(sg * Math.cos(sweep), 0, -Math.sin(sweep))
    const Yv = V(sg * 0.22, 1, 0).normalize()
    const Zv = X.clone().cross(Yv).normalize()
    const Y2 = Zv.clone().cross(X).normalize()
    m.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(X, Y2, Zv))
    m.position.copy(h.p).addScaledVector(h.n, -0.05 * hw)
    c.g.add(m)
    if (lisere1) {
      // ossature : un tube sur le bord d'attaque
      const o = new Group()
      o.quaternion.copy(m.quaternion)
      o.position.copy(m.position)
      c.g.add(o)
      tube(c, [V(0, 0.02 * L, 0), V(0.3 * L, 0.5 * L, 0), V(0.7 * L, 0.8 * L, 0), V(0.98 * L, 0.84 * L, 0)], 0.035 * hw, 0.025 * hw, lisere1, o)
    }
  }
}

const DOS: Record<string, Gen> = {
  ailes(c) {
    aile(
      c,
      (s) => {
        s.moveTo(0, 0)
        s.bezierCurveTo(0.1, 0.55, 0.55, 0.98, 1.0, 0.9)
        s.bezierCurveTo(1.12, 0.88, 1.1, 0.7, 1.0, 0.62)
        s.quadraticCurveTo(1.08, 0.5, 0.88, 0.45)
        s.quadraticCurveTo(0.92, 0.32, 0.7, 0.28)
        s.quadraticCurveTo(0.7, 0.15, 0.45, 0.12)
        s.quadraticCurveTo(0.4, 0.0, 0.2, -0.06)
        s.quadraticCurveTo(0.1, -0.1, 0, 0)
      },
      c.c1
    )
  },
  diable(c) {
    aile(
      c,
      (s) => {
        s.moveTo(0, 0)
        s.bezierCurveTo(0.1, 0.6, 0.5, 1.02, 1.05, 0.95)
        s.quadraticCurveTo(0.78, 0.72, 0.84, 0.42)
        s.quadraticCurveTo(0.62, 0.55, 0.6, 0.2)
        s.quadraticCurveTo(0.4, 0.36, 0.32, 0.0)
        s.quadraticCurveTo(0.15, 0.1, 0, 0)
      },
      c.c1,
      c.c2
    )
  },
  sac(c) {
    const { A, hw, H, haut } = c.R
    const y = haut - 0.52 * H
    const h = A.arriere(0, y)
    if (!h) return
    const w = hw * 0.62
    const hh = hw * 0.78
    const d = hw * 0.4
    const sac = extrusion(formeDePoints(arrondir([[-w / 2, -hh / 2], [w / 2, -hh / 2], [w / 2, hh / 2], [-w / 2, hh / 2]], 3)), d * 0.5, d * 0.25)
    const g = new Group()
    g.position.copy(h.p).addScaledVector(V(0, 0, -1), d * 0.36)
    c.g.add(g)
    add(c, sac, c.c1, g)
    // poche
    const poche = extrusion(formeDePoints(arrondir([[-w * 0.3, -hh * 0.18], [w * 0.3, -hh * 0.18], [w * 0.3, hh * 0.05], [-w * 0.3, hh * 0.05]], 3)), d * 0.1, d * 0.12)
    const pm = add(c, poche, c.c2, g)
    pm.position.set(0, -hh * 0.12, -d * 0.45)
    pm.rotation.y = Math.PI
    // bretelles : chaque point est TIRE sur la surface du corps (rayon horizontal), du haut du sac, autour du flanc
    // (l'epaule), jusqu'au devant du corps : elles epousent le volume, sans traverser ni flotter
    const zc = c.R.zc
    const L = 2 * hw + 120
    const yB = y + 0.08 * hw
    const yF = c.R.yBas + 0.02 * hw
    for (const sg of [-1, 1]) {
      const pts: Vector3[] = []
      const K = 20
      const aB = -Math.PI / 2 + 0.3
      const aF = Math.PI / 2 - 0.78
      for (let k = 0; k <= K; k++) {
        const u = k / K
        const a0 = aB + (aF - aB) * u
        const a = sg > 0 ? a0 : Math.PI - a0
        const yy = yB + (yF - yB) * u ** 2.4 + 0.02 * H * Math.sin(Math.PI * Math.min(1, u * 1.3))
        const dx = Math.cos(a)
        const dz = Math.sin(a)
        const q = A.tir(V(dx * L, yy, zc + dz * L), V(-dx, 0, -dz))
        if (q) pts.push(q.p.clone().addScaledVector(q.n, hw * 0.012))
      }
      if (pts.length >= 8) tube(c, pts, hw * 0.055, hw * 0.055, c.c2)
    }
  },
  cape(c) {
    const { A, hw, H, bas, zc } = c.R
    const yBas = c.R.yBas + 0.22 * hw
    const larg = hw * 0.3
    const incl = dip(c)
    // col : bande bombee qui epouse le cou, bien visible de face, liseré clair en haut
    const col = mixHex(c.c1, '#ffffff', 0.3)
    if (!bande(c, yBas, larg, col, { e0: -0.03 * hw, eb: 0.15 * hw, incl, ronde: true })) return
    const cp = A.coupe(yBas + 0.5 * larg + incl, 56, 0, zc, incl)
    if (cp.length === 56) tube(c, cp.map((q) => q.p.clone().addScaledVector(q.n, 0.115 * hw)), 0.022 * hw, 0.022 * hw, c.c2, c.g, true, false)
    // fermoir : une pierre sur le devant du col
    const f = surf(c, 0, yBas)
    if (f) sph(c, c.c2, hw * 0.075, [1, 1, 0.7], f.p.clone().addScaledVector(f.n, hw * 0.07))
    // tissu : de dos et sur les cotes, il part du col, flotte vers l'exterieur et tombe derriere
    const yHem = Math.max(bas + 0.04 * H, yBas - Math.min(0.95 * hw, yBas - bas - 0.04 * H))
    const nA = 31
    const nR = 9
    const a0 = Math.PI / 2 + 0.78
    const a1 = Math.PI / 2 + Math.PI * 2 - 0.78
    const pos: number[] = []
    const L0 = 2 * hw + 120
    const hem: Vector3[] = []
    const prev: Array<Vector3 | null> = new Array(nA).fill(null)
    for (let j = 0; j < nR; j++) {
      const v = j / (nR - 1)
      for (let i = 0; i < nA; i++) {
        const a = a0 + ((a1 - a0) * i) / (nA - 1)
        const dx = Math.cos(a)
        const dz = Math.sin(a)
        const yTop = yBas + 0.32 * larg + incl * (1 - dz)
        const y = yTop + (yHem - yTop) * v - 0.05 * H * v * Math.sin(a * 3)
        const q = A.tir(V(dx * L0, y, zc + dz * L0), V(-dx, 0, -dz))
        const base = q ? q.p : prev[i] ? V(prev[i]!.x, y, prev[i]!.z) : V(dx * hw * 0.5, y, zc + dz * hw * 0.5)
        prev[i] = base.clone()
        const ext = -0.015 * hw + (0.06 * hw + (0.4 + 0.3 * Math.max(0, -dz)) * hw * v ** 1.2) + 0.035 * hw * Math.sin(a * 6) * v
        const p = V(base.x + dx * ext, y, base.z + dz * ext)
        pos.push(p.x, p.y, p.z)
        if (j === nR - 1) hem.push(p)
      }
    }
    const idx: number[] = []
    for (let j = 0; j < nR - 1; j++) {
      for (let i = 0; i < nA - 1; i++) {
        const k = j * nA + i
        idx.push(k, k + 1, k + nA, k + 1, k + nA + 1, k + nA)
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    add(c, geo, c.c1, c.g, 1, true)
    tube(c, hem, hw * 0.028, hw * 0.028, c.c2)
  },
  queue(c) {
    const { A, hw, H, haut } = c.R
    const y = haut - 0.76 * H
    const h = A.arriere(0, y)
    if (!h) return
    const p = h.p.clone().addScaledVector(h.n, -hw * 0.06)
    const b = V(0, 0, -1)
    const pts = [p, p.clone().addScaledVector(b, hw * 0.28).add(V(hw * 0.12, -hw * 0.08, 0)), p.clone().addScaledVector(b, hw * 0.55).add(V(hw * 0.4, hw * 0.0, 0)), p.clone().addScaledVector(b, hw * 0.5).add(V(hw * 0.66, hw * 0.36, 0))]
    tube(c, pts, hw * 0.1, hw * 0.2, c.c1)
    const e = pts[3]!
    const tip = sph(c, c.c2, hw * 0.26, [1, 1.3, 1], e.clone().add(V(hw * 0.05, hw * 0.12, 0)))
    tip.rotation.z = -0.4
  }
}

/** Table des generateurs par emplacement. */
const GENERATEURS: Record<Emplacement, Record<string, Gen>> = { tete: TETE, yeux: YEUX, visage: VISAGE, bas: BAS, dos: DOS }

/** Ids du catalogue (les generateurs des accessoires RETIRES restent dans le fichier mais ne comptent plus). */
export const IDS_IMPLEMENTES = (e: Emplacement) => Object.keys(GENERATEURS[e]).filter((id) => !RETIRES.some((r) => r.emplacement === e && r.id === id))

/* ------------------------------------------------------------------ classe */

export class Accessoires3d {
  readonly groupe = new Group()
  private cle = ''
  private geos: BufferGeometry[] = []
  private readonly matieres = new Map<string, Materiau>()
  private source: Materiau | null = null
  /** memes jeux de lumiere que le corps (liseres, ombrage doux, reflet) : poses par `Mochi3d` */
  reglages: { force: number; haut: number; ao: number; reflet?: { value: number } } | null = null
  /** ombres douces posees sur le corps (repere du moteur, y vers le bas), valables apres `maj` */
  ombres: Ombre[] = []
  /** couleurs utilisees (palette du pixel art) */
  couleurs: string[] = []

  constructor() {
    this.groupe.visible = false
  }

  private matiere(base: Materiau, hex: string, o: number, d: boolean): Materiau {
    if (this.source !== base) {
      for (const m of this.matieres.values()) m.dispose()
      this.matieres.clear()
      this.source = base
    }
    const cle = `${hex}|${o}|${d ? 1 : 0}`
    let m = this.matieres.get(cle)
    if (!m) {
      m = base.clone() as Materiau
      m.map = null
      m.emissiveMap = null
      m.emissive.set(0x000000)
      m.color.set(hex)
      m.transparent = o < 1
      m.opacity = o
      if (o < 1) m.depthWrite = false
      if (d) m.side = DoubleSide
      const g = this.reglages
      if (g) lisere(m, g.force, g.haut, { ao: g.ao, reflet: g.reflet })
      this.matieres.set(cle, m)
    }
    return m
  }

  private vide() {
    for (const g of this.geos) g.dispose()
    this.geos = []
    for (const ch of [...this.groupe.children]) this.groupe.remove(ch)
  }

  /**
   * Pose la selection sur le corps. `reperes` est appele seulement quand quelque chose change
   * (les tirs de rayons coutent) ; `cleCorps` identifie le corps (contour, forme, yeux).
   */
  maj(sel: Selection, cleCorps: string, base: Materiau, reperes: () => Reperes | null) {
    const actifs = EMPLACEMENTS.filter((e) => resoudre(e, sel[e]))
    if (!actifs.length) {
      this.groupe.visible = false
      this.cle = ''
      this.ombres = []
      this.couleurs = []
      return
    }
    const cle = `${cleCorps}|${base.uuid}|${JSON.stringify(sel)}|${this.reglages ? 'l' : 'p'}`
    this.groupe.visible = true
    if (cle === this.cle) return
    this.cle = cle
    this.vide()
    this.ombres = []
    this.couleurs = couleursDe(sel)
    const R = reperes()
    if (!R) {
      this.groupe.visible = false
      return
    }
    // deux yeux : ceux du corps, sinon deux yeux de remplacement a la hauteur du centre
    const ye: [OeilScene, OeilScene] =
      R.yeux.length === 2
        ? [R.yeux[0]!, R.yeux[1]!]
        : [
            { x: -R.ecart / 2, y: R.yYeux, r: R.rVerre },
            { x: R.ecart / 2, y: R.yYeux, r: R.rVerre }
          ]
    for (const e of actifs) {
      const d = resoudre(e, sel[e])!
      const gen = GENERATEURS[e][d.id]
      if (!gen) continue
      const g = new Group()
      g.name = e
      this.groupe.add(g)
      const ctx: Ctx = {
        g,
        R,
        c1: d.c1,
        c2: d.c2,
        mat: (hex, o = 1, dbl = false) => this.matiere(base, hex, o, dbl),
        geos: this.geos,
        a: ye[0],
        b: ye[1],
        rv: R.rVerre
      }
      gen(ctx)
      this.ombres.push(...ombresDe(e, g, R))
    }
  }

  liberer() {
    this.vide()
    for (const m of this.matieres.values()) m.dispose()
    this.matieres.clear()
  }
}

/** Ombre douce d'un emplacement sur la face avant (repere du moteur : y vers le bas). */
function ombresDe(e: Emplacement, g: Group, R: Reperes): Ombre[] {
  const b = new Box3Lite(g)
  if (!b.ok) return []
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  const cx = (b.x0 + b.x1) / 2
  switch (e) {
    case 'tete':
      return [{ x: R.tete.cx + 0.1 * R.tete.R, y: -R.tete.y + 0.16 * R.tete.R, rx: 1.0 * R.tete.R, ry: 0.32 * R.tete.R, a: 0.26 }]
    case 'yeux':
      return R.yeux.map((o) => ({ x: o.x + 0.2 * R.rVerre, y: -o.y + 0.42 * R.rVerre, rx: 1.15 * R.rVerre, ry: 1.1 * R.rVerre, a: 0.22 }))
    case 'bas':
      return [{ x: cx + 0.04 * w, y: -b.y0 + 0.02 * h, rx: Math.min(0.5 * w, 0.6 * R.hw), ry: 0.1 * R.hw, a: 0.2 }]
    case 'visage':
      return [{ x: cx + 0.05 * w, y: -(b.y0 + b.y1) / 2 + 0.2 * h, rx: 0.62 * w, ry: 0.5 * h + 2, a: 0.14 }]
    default:
      return []
  }
}

/** Boite englobante (x, y) d'un groupe dans SON repere (les parents ne comptent pas : le corps peut tourner). */
class Box3Lite {
  x0 = Infinity
  x1 = -Infinity
  y0 = Infinity
  y1 = -Infinity
  ok = false
  constructor(o: Object3D) {
    this.visite(o, new Matrix4())
  }
  private visite(o: Object3D, parent: Matrix4) {
    o.updateMatrix()
    const M = parent.clone().multiply(o.matrix)
    const mesh = o as Mesh
    const P = mesh.isMesh ? mesh.geometry.attributes.position : null
    if (P) {
      const v = new Vector3()
      for (let i = 0; i < P.count; i += 3) {
        v.fromBufferAttribute(P, i).applyMatrix4(M)
        this.x0 = Math.min(this.x0, v.x)
        this.x1 = Math.max(this.x1, v.x)
        this.y0 = Math.min(this.y0, v.y)
        this.y1 = Math.max(this.y1, v.y)
        this.ok = true
      }
    }
    for (const c of o.children) this.visite(c, M)
  }
}

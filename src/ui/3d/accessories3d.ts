/**
 * Accessoires 3D par emplacements (voir `bot/emplacements.ts`) : chaque piece est un vrai volume
 * (spheres, tubes, tores, revolutions, extrusions a biseau) enfant du maillage du corps. Elles
 * tournent donc avec lui et portent le MEME ombrage de matiere que le corps (`rim.ts` : AO,
 * lueur bas-droite, lueur haut-gauche, repere de la camera). Matieres mates, aucune lumiere propre.
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
  BackSide,
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
  MeshBasicMaterial,
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
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rim } from './rim'
import { colorOutline } from './material'
import type { Shadow } from '@/bot/worn'
import { mixHex } from '@/bot/skins'
import { ACCESSORY_PALETTE, SLOTS, REMOVED, resolveAccessories, colorsOf, type Slot, type AccessorySelection } from '@/bot/slots'
import type { EyeScene, Landmarks } from './anchors'

type MatDef = MeshStandardMaterial | MeshToonMaterial

/** Distance entre deux couleurs hex (RGB). */
const distanceHex = (a: string, b: string) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const x = p(a)
  const y = p(b)
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!)
}

const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z)
const Z = V(0, 0, 1)
const Y = V(0, 1, 0)

/** Ce qu'un generateur recoit : le groupe a remplir, les reperes du corps, les couleurs et les outils. */
interface Ctx {
  g: Group
  R: Landmarks
  c1: string
  c2: string
  /** matiere (clonee du corps, meme eclairage) ; `o` = opacite, `d` = double face */
  mat: (hex: string, o?: number, d?: boolean) => MatDef
  geos: BufferGeometry[]
  /** yeux (toujours deux) et rayon de verre */
  a: EyeScene
  b: EyeScene
  rv: number
  /** couleur du corps (hex), pour choisir une couleur par defaut qui contraste */
  body?: string
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
function tube(c: Ctx, pts: Vector3[], r0: number, r1: number, hex: string, parent: Object3D = c.g, closed = false, bouts = true, o = 1) {
  const curve = new CatmullRomCurve3(pts, closed, 'centripetal')
  const seg = Math.max(12, pts.length * 8)
  const radial = 14
  const geo = new TubeGeometry(curve, seg, 1, radial, closed)
  const P = geo.attributes.position!
  for (let i = 0; i <= seg; i++) {
    const u = closed && i === seg ? 0 : i / seg
    const ctr = curve.getPointAt(u)
    const k = r0 + (r1 - r0) * u
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j
      P.setXYZ(idx, ctr.x + (P.getX(idx) - ctr.x) * k, ctr.y + (P.getY(idx) - ctr.y) * k, ctr.z + (P.getZ(idx) - ctr.z) * k)
    }
  }
  P.needsUpdate = true
  geo.computeVertexNormals()
  const m = add(c, geo, hex, parent, o)
  if (bouts && !closed) {
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
function orient(o: Object3D, dir: Vector3, roll = 0) {
  const q = new Quaternion().setFromUnitVectors(Z, dir.clone().normalize())
  if (roll) q.multiply(new Quaternion().setFromAxisAngle(Z, roll))
  o.quaternion.copy(q)
}

/** Courbe fermee d'une forme de monture : points unitaires (x dans [-1, 1]). */
type ShapeKind = (t: number) => [number, number]
const SHAPE_LIST: Record<string, ShapeKind> = {
  round: (t) => [Math.cos(t), Math.sin(t) * 1.1],
  square: (t) => {
    const k = 0.5
    const cx = Math.cos(t)
    const sy = Math.sin(t)
    return [Math.sign(cx) * Math.abs(cx) ** k * 1.0, Math.sign(sy) * Math.abs(sy) ** k * 0.86]
  },
  heart: (t) => {
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return [x / 16, y / 16 + 0.1]
  },
  star: (t) => {
    const f = (Math.cos(5 * (t - Math.PI / 2)) + 1) / 2
    const r = 0.56 + 0.44 * f ** 1.3
    return [Math.cos(t) * r * 1.05, Math.sin(t) * r * 1.05]
  }
}

function curveShape(f: ShapeKind, r: number, n = 56): Vector3[] {
  const pts: Vector3[] = []
  for (let i = 0; i < n; i++) {
    const [x, y] = f((i / n) * Math.PI * 2)
    pts.push(V(x * r, y * r, 0))
  }
  return pts
}

/** Fonction (x, y) -> z de la surface avant ou arriere, interpolee sur une grille de tirs. */
function grid(c: Ctx, x0: number, x1: number, y0: number, y1: number, nx = 9, ny = 7, back = false) {
  const zs: number[][] = []
  const fb = back ? c.R.A.box.min.z : c.R.A.box.max.z
  for (let j = 0; j < ny; j++) {
    const row: number[] = []
    for (let i = 0; i < nx; i++) {
      const x = x0 + ((x1 - x0) * i) / (nx - 1)
      const y = y0 + ((y1 - y0) * j) / (ny - 1)
      const h = back ? c.R.A.back(x, y) : c.R.A.before(x, y)
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
function epouser(geo: BufferGeometry, zs: (x: number, y: number) => number, decal: number, back = false) {
  const P = geo.attributes.position!
  for (let i = 0; i < P.count; i++) {
    const z0 = P.getZ(i)
    P.setZ(i, zs(P.getX(i), P.getY(i)) + (back ? -decal - z0 : decal + z0))
  }
  P.needsUpdate = true
  geo.computeVertexNormals()
}

/** Extrusion douce (biseau rond) d'une forme 2D centree en z. */
function extrusion(shape: Shape, thickness: number, bevel: number, segBevel = 4, smooth = false): BufferGeometry {
  let g: BufferGeometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segBevel,
    curveSegments: 18
  })
  g.translate(0, 0, -thickness / 2)
  if (smooth) {
    // soude les sommets et recalcule les normales : plus de facettes, le bord se fond dans le biseau
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    g = mergeVertices(g, 1e-4)
    g.computeVertexNormals()
  }
  return g
}

/**
 * Polygone aux coins arrondis : chaque sommet est remplace par un arc (courbe de Bezier quadratique dont le
 * point de controle est le sommet) a `rc` du coin, `n` segments par arc. Rend des triangles qui restent des triangles.
 */
function polygonRounded(pts: Array<[number, number]>, rc: number, n = 12): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i]!
    const Q = pts[(i + pts.length - 1) % pts.length]!
    const N = pts[(i + 1) % pts.length]!
    const l1 = Math.hypot(Q[0] - P[0], Q[1] - P[1])
    const l2 = Math.hypot(N[0] - P[0], N[1] - P[1])
    const t1 = Math.min(rc, l1 * 0.45) / l1
    const t2 = Math.min(rc, l2 * 0.45) / l2
    const A: [number, number] = [P[0] + (Q[0] - P[0]) * t1, P[1] + (Q[1] - P[1]) * t1]
    const B: [number, number] = [P[0] + (N[0] - P[0]) * t2, P[1] + (N[1] - P[1]) * t2]
    for (let k = 0; k <= n; k++) {
      const u = k / n
      out.push([(1 - u) * (1 - u) * A[0] + 2 * u * (1 - u) * P[0] + u * u * B[0], (1 - u) * (1 - u) * A[1] + 2 * u * (1 - u) * P[1] + u * u * B[1]])
    }
  }
  return out
}

function shapeOfPoints(pts: Array<[number, number]>): Shape {
  const s = new Shape()
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])))
  s.closePath()
  return s
}

/** Ellipse rognee en forme de goutte, de triangle, etc. : polygone arrondi par moyennes mobiles. */
function round(pts: Array<[number, number]>, passes = 3): Array<[number, number]> {
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

/** Fleur : petales sur un plan face a +z, coeur au centre. */
function flower(c: Ctx, parent: Object3D, s: number, petal: string, heart: string, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const m = sph(c, petal, 1, [0.3 * s, 0.4 * s, 0.14 * s], V(Math.cos(a) * 0.42 * s, Math.sin(a) * 0.42 * s, 0), parent)
    m.rotation.z = a - Math.PI / 2
  }
  sph(c, heart, 1, [0.26 * s, 0.26 * s, 0.2 * s], V(0, 0, 0.06 * s), parent)
}

/** Pose un groupe sur la surface : sur le point `p`, face a la normale `n` (un peu enfonce). */
function assign(c: Ctx, p: Vector3, n: Vector3, sunk: number, mix = 0, roll = 0): Group {
  const g = new Group()
  const dir = n.clone().lerp(Z, mix).normalize()
  g.position.copy(p).addScaledVector(n, -sunk)
  orient(g, dir, roll)
  c.g.add(g)
  return g
}

/** Anneau epais qui suit la coupe du corps a la hauteur y (echarpe, collier, bandeau) ; null si la coupe est vide. */
function band(c: Ctx, y: number, r: number, hex: string, exit = 0.35, n = 44, o = 1, incl = 0): { pts: Vector3[]; m: Mesh } | null {
  const cp = c.R.A.coupe(y + incl, n, 0, c.R.zc, incl)
  if (cp.length < n) return null
  const pts = cp.map((h) => h.p.clone().addScaledVector(h.n, r * exit))
  const m = tube(c, pts, r, r, hex, c.g, true, false, o)
  return { pts, m }
}

/** Coiffe : groupe pose sur l'assise de la tete ; repere local = rayon de la coiffe 1, y vers le haut, +z devant. */
function headwear(c: Ctx, k = 1.18): Group {
  const t = c.R.head
  const g = new Group()
  g.position.set(t.cx, t.y - 0.07 * t.R, t.zc)
  g.scale.set(t.R * k, t.R * k, t.rz * k)
  c.g.add(g)
  return g
}

/* ------------------------------------------------------------------ tete */

/**
 * Visiere de casquette (repere de la coiffe, +z devant) : un demi-disque allonge, epais et bombe sur le dessus,
 * qui part de l'interieur de la calotte, depasse nettement vers l'avant et un peu sur les cotes, avec une courbure
 * (les bords tombent) et une legere pente vers le bas. Maillage maison : surface fermee, normales lissees.
 */
function visor(): BufferGeometry {
  const NR = 16
  const NT = 56
  const WX = 0.9 // demi-largeur
  const Z0 = -0.1 // pied de la visiere (cache dans la calotte)
  const LZ = 1.35 // longueur vers l'avant
  const Y0 = 0.02
  const pos: number[] = []
  const idx: number[] = []
  const rang = (top: boolean) => {
    const base = pos.length / 3
    for (let i = 0; i <= NR; i++) {
      // r dense pres du bord : le profil s'arrondit
      const r = 1 - (1 - i / NR) ** 1.6
      const th = 0.13 * Math.sqrt(Math.max(0, 1 - r ** 6))
      for (let j = 0; j <= NT; j++) {
        const t = (j / NT) * Math.PI
        const x = WX * r * Math.cos(t)
        const zl = LZ * r * Math.sin(t)
        const u = x / WX
        const y = Y0 - 0.34 * u * u * Math.min(1, 0.3 + zl / LZ) - 0.12 * (zl / LZ) + (top ? th : -th)
        pos.push(x, y, Z0 + zl)
      }
    }
    return base
  }
  const h = rang(true)
  const b = rang(false)
  const W = NT + 1
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NT; j++) {
      const a = i * W + j
      idx.push(h + a, h + a + W, h + a + 1, h + a + 1, h + a + W, h + a + W + 1)
      idx.push(b + a, b + a + 1, b + a + W, b + a + 1, b + a + W + 1, b + a + W)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

type Gen = (c: Ctx) => void

const HEAD: Record<string, Gen> = {
  cap(c) {
    // calotte RIGIDE et RONDE (demi-sphere un peu aplatie), independante de la forme du corps : l'assise de la tete
    // ne donne que la position et l'echelle. Elle est un peu inclinee vers l'arriere, son bord rentre dans le corps,
    // et la visiere (demi-disque allonge, une 2e couleur possible) part du bord avant.
    const { hw, head: t } = c.R
    const Rx = t.R * 1.28
    const Rz = Math.min(t.rz * 1.28, Rx * 1.2)
    const yBase = Math.max(t.y - 0.12 * Rx, Math.max(c.a.y, c.b.y) + c.rv * 1.3 + 0.3 * Rx)
    // hauteur du dome : au moins celle de ce qui depasse de l'assise (pointe de goutte, de pyramide), sans devenir un cone
    const top = Math.min(1.45 * Rx, Math.max(0.78 * Rx, c.R.top - yBase + 0.3 * Rx))
    const jupe = 0.16 * Rx // bord qui descend (cache dans le corps)
    const prof: Vector2[] = [new Vector2(1, -jupe), new Vector2(1, 0)]
    const N = 20
    for (let i = 1; i <= N; i++) {
      const ph = (i / N) * Math.PI * 0.5
      prof.push(new Vector2(Math.max(0, Math.cos(ph)), Math.sin(ph) * top))
    }
    const g = new Group()
    // jamais sur les yeux : le bord avant reste au-dessus du haut des yeux
    g.position.set(t.cx, yBase, t.zc)
    g.rotation.x = -0.14
    c.g.add(g)
    const dome = add(c, new LatheGeometry(prof, 56), c.c1, g, 1, true)
    dome.scale.set(Rx, 1, Rz)
    // petit bouton au sommet (meme couleur)
    sph(c, c.c1, 0.075 * Rx, [1, 0.8, 1], V(0, top * 0.99, 0), g)
    const v = add(c, visor(), c.c2, g, 1, true)
    v.position.set(0, 0.02 * Rx, Rz * 0.82)
    v.rotation.x = 0.3 // la visiere penche vers le bas : visible de face
    v.scale.setScalar(Rx * 0.92)
    void hw
  },
  beanie(c) {
    const g = headwear(c)
    sph(c, c.c1, 1, [1.02, 1.08, 1.02], V(0, 0.02, 0), g)
    sph(c, c.c2, 0.32, [1, 1, 1], V(0.04, 1.1, 0), g)
  },
  beret(c) {
    const g = headwear(c)
    const m = sph(c, c.c1, 1, [1.12, 0.46, 1.12], V(0.1, 0.22, 0), g)
    m.rotation.z = -0.2
    const q = add(c, new CylinderGeometry(0.07, 0.09, 0.2, 14), c.c1, g)
    q.position.set(-0.02, 0.62, 0)
    q.rotation.z = -0.2
  },
  'top-hat'(c) {
    const g = headwear(c)
    add(c, revolution([[0, -0.04], [1.25, -0.04], [1.25, 0.2], [0.68, 0.2], [0.66, 1.28], [0, 1.28]], 0.1), c.c1, g)
    const hatBand = add(c, new CylinderGeometry(0.69, 0.7, 0.26, 40), c.c2, g)
    hatBand.position.y = 0.36
  },
  crown(c) {
    const g = headwear(c)
    add(c, revolution([[0.86, -0.02], [1.04, -0.02], [1.04, 0.44], [0.86, 0.44]], 0.07), c.c1, g)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i / 5) * Math.PI * 2
      const px = Math.cos(a) * 0.95
      const pz = Math.sin(a) * 0.95
      const k = add(c, new ConeGeometry(0.2, 0.46, 20), c.c1, g)
      k.position.set(px, 0.62, pz)
      sph(c, c.c1, 0.1, [1, 1, 1], V(px, 0.86, pz), g)
    }
  },
  straw(c) {
    const g = headwear(c)
    add(c, revolution([[0, 0.0], [1.1, 0.0], [1.7, -0.08], [1.95, -0.16], [1.95, 0.04], [1.7, 0.14], [1.1, 0.22], [0, 0.22]], 0.08), c.c1, g)
    sph(c, c.c1, 1, [0.86, 0.84, 0.86], V(0, 0.16, 0), g)
    const r = add(c, new TorusGeometry(0.85, 0.11, 14, 48), c.c2, g)
    r.rotation.x = Math.PI / 2
    r.position.y = 0.32
  },
  bob(c) {
    const g = headwear(c)
    add(c, revolution([[0, 0.95], [0.8, 0.94], [1.0, 0.0], [1.6, -0.24], [1.6, -0.02], [1.0, 0.2], [0, 0.2]].reverse() as Array<[number, number]>, 0.07), c.c1, g, 1, true)
    const r = add(c, new TorusGeometry(0.92, 0.08, 12, 48), c.c2, g)
    r.rotation.x = Math.PI / 2
    r.position.y = 0.3
  },
  headphones(c) {
    // Casque de musique : un arceau par-dessus la tete (tir de rayons dans le plan de face, du cote gauche au cote droit)
    // et deux coques sur les flancs, a hauteur des yeux ; chaque coque rentre un peu dans le corps comme les lunettes.
    const { A, hw, yEyes, zc, H } = c.R
    const yE = yEyes + 0.02 * H
    const L = 2 * hw + 80
    const arc: Vector3[] = []
    const sides: Array<{ p: Vector3; n: Vector3; sg: number }> = []
    const K = 15
    for (let k = 0; k <= K; k++) {
      const th = 0.02 + (k / K) * (Math.PI - 0.04)
      const d = V(Math.cos(th), Math.sin(th), 0)
      const h = A.shot(V(d.x * L, yE + d.y * L, zc), d.clone().negate())
      if (!h) continue
      arc.push(h.p.clone().addScaledVector(h.n, 0.05 * hw))
      if (k === 0) sides.push({ p: h.p, n: h.n, sg: 1 })
      if (k === K) sides.push({ p: h.p, n: h.n, sg: -1 })
    }
    if (arc.length < 5 || sides.length < 2) return
    tube(c, arc, 0.055 * hw, 0.055 * hw, c.c1)
    for (const { p, n } of sides) {
      const g = new Group()
      g.position.copy(p).addScaledVector(n, 0.07 * hw)
      orient(g, n)
      c.g.add(g)
      // coque, coussin et cache exterieur
      sph(c, c.c1, 1, [0.3 * hw, 0.37 * hw, 0.19 * hw], V(0, 0, 0), g)
    }
  },
  ears(c) {
    const { A, head: t, hw } = c.R
    const xs = [-0.62, -0.4, -0.2, 0, 0.2, 0.4, 0.62].map((k) => k * hw)
    const pts: Vector3[] = []
    for (const x of xs) {
      const h = A.top(x, t.zc)
      if (h) pts.push(h.p.clone().addScaledVector(h.n, t.R * 0.05))
    }
    if (pts.length >= 3) tube(c, pts, t.R * 0.13, t.R * 0.13, c.c1)
    for (const sg of [-1, 1]) {
      const h = A.top(sg * 0.5 * hw, t.zc)
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
  antenna(c) {
    const { A, head: t } = c.R
    const h = A.top(t.cx, t.zc)
    if (!h) return
    const p = h.p.clone().addScaledVector(h.n, -t.R * 0.08)
    const L = t.R * 1.1
    tube(c, [p, p.clone().add(V(t.R * 0.04, L * 0.4, 0)), p.clone().add(V(t.R * 0.16, L * 0.75, 0)), p.clone().add(V(t.R * 0.12, L, 0))], t.R * 0.11, t.R * 0.085, c.c1)
    sph(c, c.c2, t.R * 0.3, [1, 1, 1], p.clone().add(V(t.R * 0.12, L + t.R * 0.22, 0)))
  },
  ribbon(c) {
    const { A, head: t, hw } = c.R
    const h = A.top(0.4 * hw, t.zc)
    if (!h) return
    const g = assign(c, h.p, h.n, -t.R * 0.1, 0.9, -0.35)
    bowtie3d(c, g, t.R * 0.62, c.c1, c.c1)
  },
  flower(c) {
    const { A, head: t, hw } = c.R
    const h = A.top(-0.4 * hw, t.zc)
    if (!h) return
    const g = assign(c, h.p, h.n, -t.R * 0.12, 0.85)
    flower(c, g, t.R * 0.95, c.c1, c.c2)
  },
  party(c) {
    const g = headwear(c)
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
    const g = headwear(c)
    add(c, revolution([[0, 0], [0.9, 0], [0.9, 0.5], [0, 0.5]].reverse() as Array<[number, number]>, 0.06), c.c1, g, 1, true)
    sph(c, c.c1, 1, [0.98, 0.62, 0.98], V(0, 0.9, 0), g)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      sph(c, c.c1, 0.4, [1, 1, 1], V(Math.cos(a) * 0.66, 0.86, Math.sin(a) * 0.66), g)
    }
  }
}

/* ------------------------------------------------------------------ yeux */

/** z de la face avant au droit d'un verre : le point le plus avance du pourtour. */
function zLens(c: Ctx, o: EyeScene, r: number): number {
  let z = -Infinity
  const A = c.R.A
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    const h = A.before(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 1.1)
    if (h) z = Math.max(z, h.p.z)
  }
  const m = A.before(o.x, o.y)
  if (m) z = Math.max(z, m.p.z)
  return z === -Infinity ? A.box.max.z : z
}

/** Rayon commun des verres : tangents, comme les anciennes lunettes. */
function radiusFrame(c: Ctx, k = 1.05): number {
  return Math.min(c.rv * k, (c.b.x - c.a.x) / 2 / 1.17)
}

/** Monture double (deux verres) : tube sur la forme, verre translucide, pont et branches rentrant dans la tete. */
function glasses(c: Ctx, shape: ShapeKind, o: { lens: string; opacite: number; tube?: number; k?: number; full?: boolean }) {
  const r = radiusFrame(c, o.k ?? 1.25)
  const tu = (o.tube ?? 0.2) * r
  const z = Math.max(zLens(c, c.a, r), zLens(c, c.b, r)) + 0.14 * r
  for (const e of [c.a, c.b]) {
    const pts = curveShape(shape, r).map((p) => p.add(V(e.x, e.y, z)))
    tube(c, pts, tu, tu, c.c1, c.g, true, false)
    const sh = new Shape(curveShape(shape, r * 0.98).map((p) => new Vector2(p.x, p.y)))
    const lens = add(c, new ShapeGeometry(sh, 24), o.lens, c.g, o.opacite, true)
    lens.position.set(e.x, e.y, z - tu * 0.3)
  }
  // pont
  const y0 = (c.a.y + c.b.y) / 2 + 0.08 * r
  tube(c, [V(c.a.x + r * 0.9, y0, z), V((c.a.x + c.b.x) / 2, y0 + 0.2 * r, z + tu * 0.2), V(c.b.x - r * 0.9, y0, z)], tu * 0.7, tu * 0.7, c.c1)
  // branches : de la charniere vers l'interieur de la tete, elles ressortent sur le cote
  for (const [e, sg] of [[c.a, -1], [c.b, 1]] as const) {
    const xo = e.x + sg * (r + tu * 0.4)
    const edge = c.R.A.side(e.y, c.R.zc, sg)
    const yb = e.y + 0.1 * r
    // la branche suit la surface du corps, un peu SOUS elle (rayon du tube + marge), de la monture jusqu'au flanc :
    // jamais a l'air libre ; si le corps est plus etroit que la monture, elle est simplement plus courte
    const xe = edge ? edge.p.x - sg * tu * 0.5 : xo
    const prof = Math.max(tu * 1.6, 0.34 * r) // profondeur sous la surface, mesuree le long de la normale
    const pts: Vector3[] = [V(xo, yb, z)]
    const N = 7
    for (let k = 1; k <= N; k++) {
      const u = k / N
      const x = xo + (xe - xo) * u
      const h = c.R.A.before(x - sg * 1, yb)
      // surface a cet endroit (au-dela de la silhouette : le flanc, au milieu du corps)
      const p = h ? h.p.clone().addScaledVector(h.n, -prof) : V(x, yb, c.R.zc)
      p.y = yb
      if (k === N) p.z = Math.min(p.z, c.R.zc)
      pts.push(p)
    }
    // premier point juste derriere la monture, dans le corps
    pts[0] = V(xo, yb, z)
    tube(c, pts, tu * 0.7, tu * 0.7, c.c1, c.g, false, false)
  }
}

const EYES: Record<string, Gen> = {
  round: (c) => glasses(c, SHAPE_LIST.round!, { lens: '#ffffff', opacite: 0.16 }),
  square: (c) => glasses(c, SHAPE_LIST.square!, { lens: '#ffffff', opacite: 0.16, tube: 0.19 }),
  // verre noir par defaut ; une couleur d'appoint differente du catalogue le remplace (theme sombre : ardoise)
  sunglasses: (c) => glasses(c, SHAPE_LIST.round!, { lens: c.c2, opacite: 0.9, tube: 0.2 }),
  heart: (c) => glasses(c, SHAPE_LIST.heart!, { lens: c.c1, opacite: 0.3, tube: 0.16, k: 1.15 }),
  star: (c) => glasses(c, SHAPE_LIST.star!, { lens: c.c1, opacite: 0.3, tube: 0.16, k: 1.15 }),
  monocle(c) {
    const r = radiusFrame(c, 1.2) * 1.1
    const e = c.b
    const z = zLens(c, e, r) + 0.14 * r
    const tu = 0.15 * r
    tube(c, curveShape(SHAPE_LIST.round!, r).map((p) => p.add(V(e.x, e.y, z))), tu, tu, c.c1, c.g, true, false)
    const lens = add(c, new ShapeGeometry(new Shape(curveShape(SHAPE_LIST.round!, r * 0.98).map((p) => new Vector2(p.x, p.y))), 24), '#ffffff', c.g, 0.16, true)
    lens.position.set(e.x, e.y, z - tu * 0.3)
  },
  sleep(c) {
    const r = c.rv
    const y = (c.a.y + c.b.y) / 2
    const z = Math.max(zLens(c, c.a, r), zLens(c, c.b, r)) + 0.2 * r
    const tu = 0.22 * r
    band(c, y, tu, c.c1, 0.1)
    const width = c.b.x - c.a.x
    const pad = add(c, new CapsuleGeometry(1.25 * r, width, 12, 28), c.c1)
    pad.rotation.z = Math.PI / 2
    pad.scale.z = 0.4
    pad.position.set((c.a.x + c.b.x) / 2, y, z)
    // yeux fermes : deux arcs doux, sans cils
    for (const e of [c.a, c.b]) {
      const pts: Vector3[] = []
      for (let k = 0; k <= 8; k++) {
        const u = (k / 8) * 2 - 1
        pts.push(V(e.x + u * 0.62 * r, e.y - 0.12 * r + 0.3 * r * (u * u - 0.5) * -1, z + 0.4 * 1.25 * r))
      }
      tube(c, pts, 0.09 * r, 0.09 * r, c.c2)
    }
  },
  ski(c) {
    const r = c.rv
    const y = (c.a.y + c.b.y) / 2
    const z = Math.max(zLens(c, c.a, r), zLens(c, c.b, r)) + 0.1 * r
    band(c, y, 0.34 * r, c.c1, 0.1)
    const width = c.b.x - c.a.x
    const frame = add(c, new CapsuleGeometry(1.5 * r, width + 0.1 * r, 16, 48), c.c1)
    frame.rotation.z = Math.PI / 2
    frame.scale.z = 0.6
    frame.position.set((c.a.x + c.b.x) / 2, y, z)
    const lens = add(c, new CapsuleGeometry(1.2 * r, width + 0.1 * r, 16, 48), c.c2, c.g, 0.72)
    lens.rotation.z = Math.PI / 2
    lens.scale.z = 0.6
    lens.position.set((c.a.x + c.b.x) / 2, y, z + 0.3 * r)
  },
  domino(c) {
    const r = c.rv
    const y = (c.a.y + c.b.y) / 2
    const half = (c.b.x - c.a.x) / 2 + 2.1 * r
    const s = new Shape()
    // masque de heros : deux ailes pointues vers le haut a l'exterieur, creux au nez
    s.moveTo(-half, y + 0.9 * r)
    s.bezierCurveTo(-half * 0.8, y + 1.9 * r, -half * 0.35, y + 2.0 * r, 0, y + 1.0 * r)
    s.bezierCurveTo(half * 0.35, y + 2.0 * r, half * 0.8, y + 1.9 * r, half, y + 0.9 * r)
    s.bezierCurveTo(half * 0.95, y - 1.5 * r, half * 0.45, y - 1.6 * r, 0, y - 1.0 * r)
    s.bezierCurveTo(-half * 0.45, y - 1.6 * r, -half * 0.95, y - 1.5 * r, -half, y + 0.9 * r)
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
    const zs = grid(c, -half - 2, half + 2, y - 1.4 * r, y + 1.6 * r, 13, 7)
    epouser(geo, zs, 0.08 * r)
    add(c, geo, c.c1)
    // bandeau de maintien derriere la tete, cache de face
    band(c, y, 0.1 * r, c.c1, 0.0)
  }
}

/* ------------------------------------------------------------------ visage */

/** Metriques du visage : ligne des joues et de la bouche, relatives a la taille des yeux. */
function face(c: Ctx) {
  const y = (c.a.y + c.b.y) / 2
  const rv = c.rv
  // `rv` = taille des pieces (un peu plus grosses que l'oeil), les hauteurs viennent du rayon de verre
  return { y, rv: 1.5 * rv, cx: (c.a.x + c.b.x) / 2, yCheek: y - 1.5 * rv, yMouth: y - 2.1 * rv, half: (c.b.x - c.a.x) / 2 }
}

/** Point de la surface avant a (x, y) ; null si le corps n'y est pas. */
function surf(c: Ctx, x: number, y: number) {
  return c.R.A.before(x, y)
}

const FACE: Record<string, Gen> = {
  whiskers(c) {
    const f = face(c)
    const s = f.rv
    for (const sg of [-1, 1]) {
      for (const ang of [0.32, 0, -0.32]) {
        const pts: Vector3[] = []
        for (let k = 0; k <= 4; k++) {
          const d = 0.5 + k * 0.38
          const x = f.cx + sg * (f.half * 0.45 + Math.cos(ang) * d * s)
          const y = f.yMouth + 0.5 * s + Math.sin(ang) * d * s - 0.04 * k * s
          const h = surf(c, x, y)
          if (h) pts.push(h.p.clone().addScaledVector(h.n, s * 0.06))
        }
        if (pts.length >= 3) tube(c, pts, 0.1 * s, 0.045 * s, c.c1)
      }
    }
    const h = surf(c, f.cx, f.yMouth + 0.7 * s)
    if (h) {
      const g = assign(c, h.p, h.n, 0.06 * s, 0.3)
      const n = sph(c, c.c2, 1, [0.3 * s, 0.22 * s, 0.17 * s], V())
      g.add(n)
    }
  },
  bandage(c) {
    const f = face(c)
    const s = f.rv
    const h = surf(c, f.cx - f.half * 1.0 - 0.1 * s, f.yCheek + 0.1 * s)
    if (!h) return
    const g = assign(c, h.p, h.n, 0.16 * s, 0.35, 0.6)
    const pad = add(c, new CapsuleGeometry(0.4 * s, 1.5 * s, 8, 20), c.c1, g)
    pad.rotation.z = Math.PI / 2
    pad.scale.z = 0.38
    const pad2 = add(c, new CapsuleGeometry(0.2 * s, 0.1 * s, 6, 14), c.c2, g)
    pad2.rotation.z = Math.PI / 2
    pad2.scale.set(1.2, 1.4, 0.5)
    pad2.position.z = 0.1 * s
    for (const sx of [-0.45, 0.45]) sph(c, mixHex(c.c1, '#000000', 0.15), 0.04 * s, [1, 1, 1], V(sx * s, 0.15 * s, 0.14 * s), g)
  },
  freckles(c) {
    const f = face(c)
    const s = f.rv
    const tasks: Array<[number, number, number]> = [[0, 0.05, 0.8], [0.55, -0.15, 0.65], [-0.4, -0.3, 0.7]]
    for (const sg of [-1, 1]) {
      const cx = f.cx + sg * (f.half + 0.25 * s)
      for (const [dx, dy, k] of tasks) {
        const h = surf(c, cx + sg * dx * s * 0.95, f.yCheek + dy * s * 0.6)
        if (!h) continue
        const g = assign(c, h.p, h.n, 0.05 * s, 0.2)
        g.add(sph(c, c.c1, 1, [0.17 * s * k, 0.17 * s * k, 0.1 * s], V()))
      }
    }
  },
  cheeks(c) {
    const f = face(c)
    const s = f.rv
    for (const sg of [-1, 1]) {
      const h = surf(c, f.cx + sg * (f.half + 0.75 * s), f.yCheek - 0.15 * s)
      if (!h) continue
      const g = assign(c, h.p, h.n, 0.1 * s, 0.25)
      g.add(sph(c, c.c1, 1, [0.6 * s, 0.44 * s, 0.24 * s], V()))
    }
  },
  mole(c) {
    const f = face(c)
    const s = f.rv
    const h = surf(c, f.cx + f.half * 0.9, f.yMouth + 0.2 * s)
    if (!h) return
    const g = assign(c, h.p, h.n, 0.04 * s, 0.2)
    g.add(sph(c, c.c1, 1, [0.2 * s, 0.2 * s, 0.14 * s], V()))
  },
  tear(c) {
    const f = face(c)
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
function front(c: Ctx, dy = 0, x = 0) {
  return surf(c, x, c.R.yBottom + dy)
}

/** Anneau du cou (tube) incline : l'avant est a la hauteur du cou, l'arriere plus haut. */
const ring = (c: Ctx, r: number, hex: string, exit = 0.35, n = 48) => band(c, c.R.yBottom, r, hex, exit, n, 1, dip(c))

/** Pan a plat qui epouse le devant du corps : contour 2D (origine en haut au centre), extrusion douce. */
function pan(c: Ctx, outline: Array<[number, number]>, hex: string, y0: number, th: number, heightMax: number, decal: number) {
  const hw = c.R.hw
  const geo = extrusion(shapeOfPoints(outline), th, th * 0.9)
  geo.translate(0, y0, 0)
  epouser(geo, grid(c, -hw * 0.7, hw * 0.7, y0 - heightMax - 4, y0 + 8, 13, 9), decal)
  return add(c, geo, hex)
}

/** Espace libre sous le cou, pour qu'un pan ne depasse pas le bas du corps. */
const free = (c: Ctx) => Math.max(8, c.R.yBottom - c.R.neck - 0.04 * c.R.H)

/**
 * Pan qui TOMBE, en coussin doux : demi-largeur `W(t)` (t = 0 en haut, 1 en bas), deux peaux (face bombee et
 * dos plat) refermees sur les bords. Le haut est colle au corps, puis le pan se decolle (`gap`, courbe en
 * t^1.5) et se balance de `swing` : rien n'est plaque. `t0..t1` limite la piece (rayures).
 */
function during(c: Ctx, W: (t: number) => number, hex: string, o: { x0: number; yTop: number; L: number; th: number; gap: number; swing: number; decal: number; t0?: number; t1?: number; most?: number; wmax: number; falls?: boolean }) {
  const { x0, yTop, L, th, gap, swing, decal, wmax } = o
  const t0 = o.t0 ?? 0
  const t1 = o.t1 ?? 1
  const most = o.most ?? 0
  const zs = grid(c, x0 - wmax - 6, x0 + wmax + 6 + Math.abs(swing), yTop - L - 6, yTop + 8, 15, 13)
  // « tombe » : le pan pend droit sous son noeud, il ne suit pas la courbure du corps (le bas se decolle)
  const z0 = o.falls ? zs(x0, yTop) : -Infinity
  const nt = Math.max(3, Math.round(14 * (t1 - t0)))
  const bare = 10
  const pos: number[] = []
  for (const face of [1, 0]) {
    for (let i = 0; i <= nt; i++) {
      const t = t0 + ((t1 - t0) * i) / nt
      const w = W(t)
      // fondu du volume aux deux bouts (le haut se glisse sous le corps, le bas se referme)
      const end = Math.min(1, t * 7, Math.max(0, (1 - t) * 9)) ** 0.5
      for (let j = 0; j <= bare; j++) {
        const u = (j / bare) * 2 - 1
        const x = x0 + u * w + swing * t * t
        const y = yTop - t * L
        const bomb = face ? (th + most) * (1 - u * u) ** 0.55 * end : 0
        pos.push(x, y, Math.max(zs(x, y), z0) + decal + gap * t ** 1.5 + bomb)
      }
    }
  }
  const idx: number[] = []
  const nv = (nt + 1) * (bare + 1)
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j < bare; j++) {
        const a = f * nv + i * (bare + 1) + j
        const b = a + bare + 1
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
function strip(c: Ctx, y: number, width: number, hex: string, o: { e0: number; eb: number; n?: number; rows?: number; incl?: number; round?: boolean }): boolean {
  const n = o.n ?? 56
  const rows = o.rows ?? 6
  const incl = o.incl ?? 0
  const pos: number[] = []
  const rangs: Vector3[][] = []
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1)
    const cp = c.R.A.coupe(y + (v - 0.5) * width + incl, n, 0, c.R.zc, incl)
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
  if (o.round) {
    // bourrelets arrondis sur les deux bords : la bande n'a plus l'air d'un papier
    for (const j of [0, rows - 1]) tube(c, rangs[j]!, width * 0.11, width * 0.11, hex, c.g, true, false)
  }
  return true
}

/**
 * Aile de noeud papillon : VRAI triangle (pointe vers le centre, bord exterieur un peu arrondi), coins arrondis,
 * extrude en volume doux aux normales lissees. `sg` = cote. La pointe passe un peu le centre : les deux ailes se
 * recouvrent, aucun jour entre elles et le noeud.
 */
function bowWing(c: Ctx, parent: Object3D, s: number, hex: string, sg: number) {
  // miroir par les points (pas par un `scale` negatif, qui retournerait les normales)
  const base: Array<[number, number]> = [[-0.1, 0], [1.0, 0.64], [1.07, 0], [1.0, -0.64]]
  const pts = base.map(([x, y]) => [sg * x * s, (sg > 0 ? y : -y) * s] as [number, number])
  const geo = extrusion(shapeOfPoints(polygonRounded(pts, 0.17 * s, 12)), 0.2 * s, 0.07 * s, 12, true)
  const m = add(c, geo, hex, parent, 1, true)
  m.position.z = -0.02 * s
}

/**
 * Noeud papillon d'Alfred : deux triangles aux coins arrondis, un peu bombes, serres sur un tout petit noeud
 * presque invisible, rien qui pende. Une seule couleur (`bowHex` = `hex` par defaut). Largeur totale : ~2,1 `s`.
 */
function bowtie3d(c: Ctx, parent: Object3D, s: number, hex: string, bowHex: string) {
  bowWing(c, parent, s, hex, -1)
  bowWing(c, parent, s, hex, 1)
  const k = polygonRounded([[-0.1 * s, -0.17 * s], [0.1 * s, -0.17 * s], [0.1 * s, 0.17 * s], [-0.1 * s, 0.17 * s]], 0.08 * s, 8)
  const m = add(c, extrusion(shapeOfPoints(k), 0.2 * s, 0.05 * s, 8, true), bowHex, parent)
  m.position.z = 0.03 * s
}

const BOTTOM: Record<string, Gen> = {
  mustache(c) {
    const f = face(c)
    const s = 0.62 * f.rv
    for (const sg of [-1, 1]) {
      const ctrl: Array<[number, number]> = [[0.15, 0.1], [0.65, -0.18], [1.25, -0.2], [1.8, 0.14], [2.0, 0.5]]
      const pts: Vector3[] = []
      for (const [dx, dy] of ctrl) {
        const h = surf(c, f.cx + sg * dx * s, f.yMouth + dy * s)
        if (h) pts.push(h.p.clone().addScaledVector(h.n, s * 0.06))
      }
      if (pts.length >= 4) tube(c, pts, 0.5 * s, 0.12 * s, c.c1)
    }
    const h = surf(c, f.cx, f.yMouth + 0.05 * s)
    if (h) sph(c, c.c1, 0.4 * s, [1.3, 0.9, 0.8], h.p.clone().addScaledVector(h.n, 0.0))
  },
  bowtie(c) {
    // pose TOUT EN BAS du corps (comme sur Alfred), dans le tiers du corps, et il depasse un peu sous la silhouette.
    // Taille : ~38 % de la largeur du corps a la hauteur ou il est pose (largeur totale du noeud = 2,1 s). Sur une
    // forme arrondie, on remonte jusqu'a une coupe assez large (75 % du max) pour qu'il tienne sur le corps.
    const { A, hw, neck, H } = c.R
    let wMax = 0
    for (let k = 0; k <= 20; k++) {
      const sec = A.section(neck + (H * k) / 20)
      if (sec) wMax = Math.max(wMax, sec.x1 - sec.x0)
    }
    const part = 0.38 / 2.1
    let y = neck
    let s = hw * 0.3
    for (let k = 0; k < 60; k++, y += 0.01 * H) {
      const sec = A.section(Math.max(y, neck + 0.004 * H))
      if (!sec) continue
      const w = sec.x1 - sec.x0
      s = (part * w)
      // le centre du noeud est a 0,28 de sa hauteur au-dessus du bas : la moitie basse depasse sous la silhouette
      if (w >= 0.75 * wMax && y - neck >= 0.28 * 1.28 * s) break
    }
    const h = surf(c, 0, y) ?? front(c)
    if (!h) return
    const g = assign(c, h.p, h.n, -s * 0.12, 0.8)
    bowtie3d(c, g, s, c.c1, c.c1)
  },
  tie(c) {
    // Cravate dans l'esprit du noeud papillon d'Alfred : meme technique (triangles aux coins arrondis, extrusion
    // gonflee aux normales lissees, donc BOMBEES), deux volumes rigides dans un plan vertical, droits et symetriques :
    // 1. le NOEUD : un triangle pointe en bas ; 2. la LAME : un losange etire vers le haut (rapport ~2,7), dont la
    // pointe haute part de la pointe du noeud. Rien ne suit la courbure du ventre : le haut est enfonce dans le
    // corps, la piece prend UN seul angle (le plus petit qui evite de traverser le corps), le bas peut se decoller.
    const { hw, A, H } = c.R
    const f = face(c)
    const yTop = Math.min(c.R.yBottom + 0.3 * hw, f.yMouth + 0.25 * f.rv, c.R.yEyes - 1.8 * c.R.rLens)
    const place = yTop - c.R.neck - 0.05 * H
    const L = Math.min(0.5 * H, place) // longueur totale (noeud + lame)
    if (L < 0.2 * hw) return
    const hk = 0.27 * L // hauteur du noeud
    const lame = L - hk // la pointe haute de la lame touche la pointe du noeud
    const wl = Math.min(lame / 2.4 / 2, 0.3 * hw) // demi-largeur de la lame
    const kw = Math.max(0.26 * hw, 1.2 * wl) // demi-largeur du noeud
    const rc = 0.09 * hw
    const bomb = 0.045 * hw
    const th = 0.07 * hw
    const bow = polygonRounded([[-kw, 0], [kw, 0], [0, -hk]], rc, 12)
    const blade = polygonRounded([[0, -hk * 0.92], [wl, -hk - 0.5 * lame], [0, -hk - lame], [-wl, -hk - 0.5 * lame]], rc, 12)
    // contact avec le ventre : plus petite pente (z par unite de descente) pour que la piece ne traverse jamais le corps
    const sunk = 0.05 * hw
    const z0 = (A.before(0, yTop)?.p.z ?? c.R.zc + hw) - sunk
    let slope = -0.5
    for (let k = 4; k <= 10; k++) {
      const d = (L * k) / 10
      for (const x of [-wl, 0, wl]) {
        const h = A.before(x * (d / L > 0.4 ? 1 : 0.4), yTop - d)
        if (h) slope = Math.max(slope, (h.p.z + 0.012 * hw + th * 0.5 + bomb - z0) / d)
      }
    }
    slope = Math.min(slope, 0.9)
    const g = new Group()
    g.position.set(0, yTop, z0)
    g.rotation.x = -Math.atan(slope)
    c.g.add(g)
    // couleur par defaut : rouge, ou bleu si le corps est proche du rouge (elle ne disparait pas sur le corps)
    const RED = ACCESSORY_PALETTE.red
    const BLUE = '#2f6fe0'
    let c1 = c.c1
    let c2 = c.c2
    if (c1 === RED && c2 === RED && c.body && distanceHex(c.body, RED) < distanceHex(c.body, BLUE)) c1 = c2 = BLUE
    for (const [pts, hex, dz] of [
      [blade, c1, 0],
      [bow, c2, 0.02 * hw]
    ] as const) {
      const m = add(c, extrusion(shapeOfPoints(pts as Array<[number, number]>), th, bomb, 12, true), hex, g, 1, true)
      m.position.z = dz
    }
  },
  scarf(c) {
    const hw = c.R.hw
    const width = hw * 0.36
    // col epais, bombe, qui epouse le contour du corps (aucun anneau libre)
    if (!strip(c, c.R.yBottom + 0.2 * hw, width, c.c1, { e0: -0.03 * hw, eb: 0.15 * hw, incl: dip(c), round: true, rows: 7 })) return
    // deux pans qui tombent du nœud, decolles du corps, sans rayures
    const yTop = c.R.yBottom + 0.2 * hw - 0.12 * width
    const mk = (x0: number, L: number, w: number, gap: number, decal: number, swing: number) => {
      const W = (t: number) => w * (t > 0.9 ? Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) * 0.4 + 0.6 : 1)
      during(c, W, c.c1, { x0, yTop, L, th: 0.45 * w, gap, swing, decal, wmax: w })
    }
    const Lmax = yTop - c.R.neck - 0.04 * c.R.H
    mk(0.26 * hw, Math.min(0.9 * hw, Lmax), 0.16 * hw, 0.3 * hw, 0.05 * hw, 0.05 * hw)
    mk(0.44 * hw, Math.min(0.62 * hw, Lmax * 0.75), 0.15 * hw, 0.2 * hw, 0.06 * hw, 0.11 * hw)
  },
  pearls(c) {
    const r = c.R.hw * 0.075
    const cp = c.R.A.coupe(c.R.yBottom + dip(c), 72, 0, c.R.zc, dip(c))
    if (cp.length < 72) return
    const pts = cp.map((q) => q.p.clone().addScaledVector(q.n, r * 0.45))
    const curve = new CatmullRomCurve3(pts, true, 'centripetal')
    const n = Math.round(curve.getLength() / (2 * r * 0.97))
    const geo = new SphereGeometry(r, 20, 14)
    c.geos.push(geo)
    const mat = c.mat(c.c1)
    for (let i = 0; i < n; i++) {
      const m = new Mesh(geo, mat)
      m.position.copy(curve.getPointAt(i / n))
      c.g.add(m)
    }
  },
  bandana(c) {
    const r = c.R.hw * 0.1
    ring(c, r, c.c1, 0.3)
    const w = c.R.hw * 0.62
    const L = Math.min(0.62 * c.R.hw, free(c) + 0.2 * c.R.hw)
    const y0 = c.R.yBottom - 0.3 * r
    pan(c, round([[-w, 0], [w, 0], [0, -L]], 3), c.c1, y0, 0.06 * w, L + w, 0.12 * w)
    for (const [dx, dy, k] of [[0, 0.3, 1], [-0.42, 0.14, 0.85], [0.42, 0.14, 0.85], [0, 0.62, 0.8]] as const) {
      const h = surf(c, dx * w, y0 - dy * L - 0.05 * w)
      if (!h) continue
      const g = assign(c, h.p, h.n, -0.03 * w, 0.2)
      g.add(sph(c, c.c2, 1, [0.1 * w * k, 0.1 * w * k, 0.06 * w], V()))
    }
  },
  medal(c) {
    const hw = c.R.hw
    const yH = c.R.yBottom + 0.2 * hw
    const yM = c.R.yBottom - 0.1 * hw
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
    const g = assign(c, h.p, h.n, -hw * 0.02, 0.5)
    const R = hw * 0.17
    const o = add(c, new CylinderGeometry(R, R, hw * 0.07, 40), c.c1, g)
    o.rotation.x = Math.PI / 2
    const i = add(c, new CylinderGeometry(R * 0.72, R * 0.72, hw * 0.09, 40), mixHex(c.c1, '#ffffff', 0.3), g)
    i.rotation.x = Math.PI / 2
    const edge = add(c, new TorusGeometry(R, hw * 0.03, 12, 40), c.c1, g)
    edge.position.z = hw * 0.03
    sph(c, c.c1, R * 0.3, [1, 1, 0.5], V(0, 0, hw * 0.05), g)
  },
  bell(c) {
    const hw = c.R.hw
    ring(c, hw * 0.065, c.c1, 0.3)
    const h = front(c, 0)
    if (!h) return
    const g = assign(c, h.p, h.n, -hw * 0.03, 0.4)
    g.position.y -= hw * 0.12
    sph(c, c.c2, hw * 0.14, [1, 1, 1], V(0, 0, 0), g)
    sph(c, mixHex(c.c2, '#000000', 0.5), 1, [hw * 0.1, hw * 0.016, hw * 0.03], V(0, -hw * 0.03, hw * 0.13), g)
    const a = add(c, new TorusGeometry(hw * 0.045, hw * 0.017, 10, 24), c.c2, g)
    a.position.y = hw * 0.15
  },
  lei(c) {
    const hw = c.R.hw
    const N = 84
    const cp = c.R.A.coupe(c.R.yBottom + dip(c), N, 0, c.R.zc, dip(c))
    if (cp.length < N) return
    // fleurs serrees (aucune tige) : petales c1, coeur c2, alternance de deux tailles
    const nf = 26
    for (let i = 0; i < nf; i++) {
      const q = cp[Math.round((i / nf) * N) % N]!
      const g = new Group()
      g.position.copy(q.p).addScaledVector(q.n, hw * 0.025)
      orient(g, q.n.clone().lerp(Z, 0.25), i * 0.7)
      c.g.add(g)
      flower(c, g, hw * (i % 2 ? 0.15 : 0.18), c.c1, c.c2, 5)
    }
  }
}

/* ------------------------------------------------------------------ dos */

/** Une aile : contour 2D (unite = envergure 1) extrude en biseau, pose sur le cote du corps. */
function wing(c: Ctx, outline: (s: Shape) => void, hex: string, rim1?: string) {
  const { A, hw, H, top, zc } = c.R
  const L = hw * 1.2
  const y = top - 0.4 * H
  for (const sg of [-1, 1]) {
    const h = A.side(y, zc - 0.15 * hw, sg)
    if (!h) continue
    const s = new Shape()
    outline(s)
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
    if (rim1) {
      // ossature : un tube sur le bord d'attaque
      const o = new Group()
      o.quaternion.copy(m.quaternion)
      o.position.copy(m.position)
      c.g.add(o)
      tube(c, [V(0, 0.02 * L, 0), V(0.3 * L, 0.5 * L, 0), V(0.7 * L, 0.8 * L, 0), V(0.98 * L, 0.84 * L, 0)], 0.035 * hw, 0.025 * hw, rim1, o)
    }
  }
}

const BACK: Record<string, Gen> = {
  wings(c) {
    wing(
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
  batwings(c) {
    wing(
      c,
      (s) => {
        s.moveTo(0, 0)
        s.bezierCurveTo(0.1, 0.6, 0.5, 1.02, 1.05, 0.95)
        s.quadraticCurveTo(0.78, 0.72, 0.84, 0.42)
        s.quadraticCurveTo(0.62, 0.55, 0.6, 0.2)
        s.quadraticCurveTo(0.4, 0.36, 0.32, 0.0)
        s.quadraticCurveTo(0.15, 0.1, 0, 0)
      },
      c.c1
    )
  },
  backpack(c) {
    const { A, hw, H, top } = c.R
    const y = top - 0.52 * H
    const h = A.back(0, y)
    if (!h) return
    const w = hw * 0.62
    const hh = hw * 0.78
    const d = hw * 0.4
    const backpack = extrusion(shapeOfPoints(round([[-w / 2, -hh / 2], [w / 2, -hh / 2], [w / 2, hh / 2], [-w / 2, hh / 2]], 3)), d * 0.5, d * 0.25)
    const g = new Group()
    g.position.copy(h.p).addScaledVector(V(0, 0, -1), d * 0.36)
    c.g.add(g)
    add(c, backpack, c.c1, g)
    // bretelles : chaque point est TIRE sur la surface du corps (rayon horizontal), du haut du sac, autour du flanc
    // (l'epaule). Elles s'arretent sur le cote et ne traversent jamais le devant : pas de trait qui barre le corps
    const zc = c.R.zc
    const L = 2 * hw + 120
    const yB = y + 0.32 * hw
    const yF = y - 0.4 * hw
    for (const sg of [-1, 1]) {
      const pts: Vector3[] = []
      const K = 14
      const aB = -Math.PI / 2 + 0.3
      const aF = -0.1
      for (let k = 0; k <= K; k++) {
        const u = k / K
        const a0 = aB + (aF - aB) * u
        const a = sg > 0 ? a0 : Math.PI - a0
        const yy = yB + (yF - yB) * u + 0.03 * H * Math.sin(Math.PI * Math.min(1, u * 1.3))
        const dx = Math.cos(a)
        const dz = Math.sin(a)
        const q = A.shot(V(dx * L, yy, zc + dz * L), V(-dx, 0, -dz))
        if (q) pts.push(q.p.clone().addScaledVector(q.n, hw * 0.012))
      }
      if (pts.length >= 8) tube(c, pts, hw * 0.075, hw * 0.075, c.c2)
    }
  },
  cape(c) {
    // cape de petit super-heros : UN tissu uni, trapeze accroche haut sur le dos (sous les epaules), qui tombe
    // derriere avec un leger evasement et une ondulation douce en bas. De face : deux petits pans arrondis qui
    // depassent derriere les flancs, rien devant le corps. Coins arrondis, bords epais et lisses.
    const { A, hw, H, neck, top, zc } = c.R
    const yTop = top - 0.27 * H
    const yHem = Math.max(neck + 0.16 * H, yTop - 0.52 * H)
    const nA = 49
    const nR = 17
    const th = 0.05 * hw
    const inner: Vector3[] = []
    const outer: Vector3[] = []
    for (let j = 0; j < nR; j++) {
      const v = j / (nR - 1)
      for (let i = 0; i < nA; i++) {
        const u = (i / (nA - 1)) * 2 - 1
        const at = Math.abs(u)
        // trapeze : plus etroit en haut, plus large en bas ; coins arrondis par un bord haut/bas qui s'incurve
        const half = 0.78 + 0.5 * v
        const top0 = 0.1 * at ** 5
        const bottom0 = 1 - 0.14 * at ** 4
        const vv = top0 + (bottom0 - top0) * v
        const y = yTop + (yHem - yTop) * vv
        const a = -Math.PI / 2 + u * half
        const dx = Math.cos(a)
        const dz = Math.sin(a)
        const L0 = 2 * hw + 120
        const q = A.shot(V(dx * L0, y, zc + dz * L0), V(-dx, 0, -dz))
        const base = q ? q.p : V(dx * hw * 0.5, y, zc + dz * hw * 0.5)
        // evasement + ondulation douce en bas
        const ext = 0.04 * hw + 0.2 * hw * vv ** 1.4 + 0.045 * hw * Math.sin(u * Math.PI * 2.5) * vv ** 2
        inner.push(V(base.x + dx * ext, y, base.z + dz * ext))
        outer.push(V(base.x + dx * (ext + th), y, base.z + dz * (ext + th)))
      }
    }
    const pos: number[] = []
    for (const P of [inner, outer]) for (const p of P) pos.push(p.x, p.y, p.z)
    const N = nA * nR
    const idx: number[] = []
    for (let j = 0; j < nR - 1; j++) {
      for (let i = 0; i < nA - 1; i++) {
        const k = j * nA + i
        idx.push(k, k + 1, k + nA, k + 1, k + nA + 1, k + nA)
        idx.push(N + k, N + k + nA, N + k + 1, N + k + 1, N + k + nA, N + k + nA + 1)
      }
    }
    // chant : on relie le bord de la face interieure a celui de la face exterieure
    const edge: number[] = []
    for (let i = 0; i < nA; i++) edge.push(i)
    for (let j = 1; j < nR; j++) edge.push(j * nA + nA - 1)
    for (let i = nA - 2; i >= 0; i--) edge.push((nR - 1) * nA + i)
    for (let j = nR - 2; j >= 1; j--) edge.push(j * nA)
    for (let t = 0; t < edge.length; t++) {
      const a0 = edge[t]!
      const a1 = edge[(t + 1) % edge.length]!
      idx.push(a0, a1, N + a0, a1, N + a1, N + a0)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    add(c, geo, c.c1, c.g, 1, true)
  },
  tail(c) {
    const { A, hw, H, top, zc } = c.R
    const y = top - 0.76 * H
    // queue COURTE, cote gauche du Mochi vu de face (x negatif) : elle part du bas du dos, sort sur le cote et
    // remonte un peu ; visible de face et de 3/4. Une couleur (le bout peut en prendre une seconde).
    const side = A.side(y, zc - 0.25 * hw, -1)
    const xs = side ? side.p.x : -hw
    const h = A.back(0.4 * xs, y)
    if (!h) return
    const p = h.p.clone().addScaledVector(h.n, -hw * 0.06)
    const pts = [
      p,
      V(xs * 0.62, y + 0.04 * hw, p.z - 0.04 * hw),
      V(xs - 0.2 * hw, y + 0.16 * hw, zc - 0.1 * hw),
      V(xs - 0.4 * hw, y + 0.38 * hw, zc)
    ]
    tube(c, pts, hw * 0.1, hw * 0.17, c.c1)
    const e = pts[3]!
    const tip = sph(c, c.c2, hw * 0.21, [1, 1.2, 1], e.clone().add(V(-0.01 * hw, hw * 0.07, 0)))
    tip.rotation.z = 0.2
  }
}

/** Table des generateurs par emplacement. */
const GENERATEURS: Record<Slot, Record<string, Gen>> = { head: HEAD, eyes: EYES, face: FACE, neck: BOTTOM, back: BACK }

/** Ids du catalogue (les generateurs des accessoires RETIRES restent dans le fichier mais ne comptent plus). */
export const IDS_IMPLEMENTED = (e: Slot) => Object.keys(GENERATEURS[e]).filter((id) => !REMOVED.some((r) => r.slot === e && r.id === id))

/* ------------------------------------------------------------------ classe */

/* ------------------------------------------------------------------ ordinateur portable (mood « travaille ») */

/** Couleurs de l'ordinateur : coque gris clair argent, petit logo rond un peu plus clair. */
export const LAPTOP_COLORS = { shell: '#c7cad4', logo: '#eceef3' } as const

/** Mesures de l'ordinateur (unites du moteur), figees par forme pour qu'il ne bouge pas avec les rebonds du corps. */
interface MeasuresLaptop {
  l: number
  hs: number
  prof: number
  zH: number
  ground: number
  /** abscisse du centre du clavier */
  x: number
}

function measureLaptop(R: Landmarks, ground: number): MeasuresLaptop {
  const { A, hw, H } = R
  // pose en bas a DROITE du corps (a droite de l'image vu de face), tourne vers le Mochi : le visage reste libre
  const x = 0.5 * hw
  // un peu plus grand que le premier essai ; l'ecran reste sous le haut des yeux
  const top = R.yEyes - 1.6 * R.rLens
  const hs0 = Math.min(0.5 * H, Math.max(0.12 * H, R.yEyes - 2.3 * R.rLens - ground))
  const hs = Math.max(hs0, Math.min(1.25 * hs0, top - ground))
  const l = Math.min(1.6 * hs, 1.4 * hw)
  const prof = 0.8 * hs
  // face avant du corps vers le bas, autour de x : le bord arriere du clavier y entre un peu
  let zb = -Infinity
  for (const dx of [-0.3 * hw, -0.15 * hw, 0, 0.15 * hw, 0.3 * hw]) {
    const h = A.before(x + dx, ground + 0.1 * H)
    if (h) zb = Math.max(zb, h.p.z)
  }
  if (zb === -Infinity) zb = A.box.max.z * 0.7
  return { l, hs, prof, zH: zb + prof - 0.05 * hw, ground, x }
}

/**
 * Portable tres simplifie, vu DE DOS : le dos de l'ecran regarde la camera, l'ecran regarde le Mochi, le clavier part de la
 * charniere vers le corps. Memes formes que le noeud papillon d'Alfred : rectangles aux coins arrondis, extrusion bombee a
 * normales lisses. L'ordinateur est pose au sol (l'origine du groupe est le sol, sous le milieu du clavier) : on le met a
 * l'echelle autour de ce point pour le faire pousser.
 */
function buildLaptop(c: Ctx, m: MeasuresLaptop): Group {
  const og = new Group()
  og.name = 'laptop'
  const { l, hs, prof, zH, ground, x } = m
  const zc = zH - prof / 2
  og.position.set(x, ground, zc)
  // l'ecran regarde le Mochi (en haut a gauche de l'ordinateur) : on voit son dos de 3/4
  og.rotation.y = 0.42
  const rc = 0.07 * hs
  const bis = 0.018 * hs
  // clavier : plaque plate posee au sol, bord avant (cote camera) a la charniere
  const tb = 0.06 * hs
  const kbd = add(c, extrusion(shapeOfPoints(polygonRounded([[-l / 2, 0], [l / 2, 0], [l / 2, prof], [-l / 2, prof]], rc, 8)), tb, bis, 8, true), LAPTOP_COLORS.shell, og, 1, true)
  kbd.rotation.x = -Math.PI / 2
  kbd.position.set(0, tb / 2 + bis, prof / 2)
  // ecran : ouvert a ~105 degres, il se penche de 15 degres vers la camera ; son dos regarde la camera
  const slope = (15 * Math.PI) / 180
  const lh = hs / Math.cos(slope)
  const tl = 0.045 * hs
  const lid = new Group()
  lid.position.set(0, tb + 2 * bis, prof / 2)
  lid.rotation.x = slope
  og.add(lid)
  add(c, extrusion(shapeOfPoints(polygonRounded([[-l / 2, 0], [l / 2, 0], [l / 2, lh], [-l / 2, lh]], rc, 8)), tl, bis, 8, true), LAPTOP_COLORS.shell, lid, 1, true)
  // petit logo rond, discret, au dos de l'ecran
  const r = 0.085 * lh
  const logo = add(c, extrusion(shapeOfPoints(polygonRounded(Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * Math.PI * 2) * r, Math.sin((i / 16) * Math.PI * 2) * r] as [number, number]), 0.3 * r, 6)), 0.006 * hs, 0.014 * hs, 6, true), c.c2, lid, 1, true)
  logo.position.set(0, 0.56 * lh, tl / 2 + bis * 0.6)
  return og
}

/** Coque de contour d'une piece : maillage inverse, gonfle le long de normales LISSEES (aucune fente aux aretes vives). */
interface DataShell {
  shell: true
  /** materiau propre a la coque : son epaisseur depend de l'echelle de la piece */
  th: { value: number }
}

/** Geometrie d'une coque : sommets soudes et normales recalculees, pour que le gonflage ne fende pas les aretes. */
function geometryShell(geo: BufferGeometry): BufferGeometry {
  const g = geo.clone()
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const welded = mergeVertices(g, 1e-3)
  welded.computeVertexNormals()
  return welded
}

function materialShell(hex: string, th: { value: number }): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: colorOutline(hex), side: BackSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTh = th
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uEp;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uEp;')
  }
  // programme partage par toutes les coques (le code est identique, seul l'uniform change)
  m.customProgramCacheKey = () => 'mochi-shell-accessory'
  return m
}

export class Accessories3d {
  readonly group = new Group()
  /** augmente a chaque reconstruction des pieces : le corps de reference de `pieces()` change */
  version = 0
  private key = ''
  private geos: BufferGeometry[] = []
  private readonly materials = new Map<string, MatDef>()
  private source: MatDef | null = null
  /** memes jeux de lumiere que le corps (liseres, ombrage doux, reflet) : poses par `Mochi3d` */
  settings: { force: number; top: number; ao: number; highlight?: { value: number } } | null = null
  /** ombres douces posees sur le corps (repere du moteur, y vers le bas), valables apres `update` */
  shadows: Shadow[] = []
  /** couleurs utilisees (palette du pixel art) */
  colors: string[] = []
  /** couleur du corps (hex), posee par `Mochi3d` : sert aux couleurs par defaut qui doivent contraster */
  body?: string
  /** ordinateur du mood `working` : groupe garde d'une reconstruction a l'autre, et ses mesures par forme */
  private laptopG: Group | null = null
  private laptopGeos: BufferGeometry[] = []
  private laptopKey = ''
  private readonly laptopMeasures = new Map<string, MeasuresLaptop>()

  constructor() {
    this.group.visible = false
  }

  /**
   * Les pieces portees (un groupe par emplacement ; pas l'ordinateur, pose au sol) : construites une fois pour un corps,
   * elles suivent ensuite le corps d'une image a l'autre par une simple transformation (voir `Mochi3d.followBody`) au
   * lieu d'etre reconstruites (v12).
   */
  pieces(): Object3D[] {
    return this.group.children.filter((c) => c !== this.laptopG)
  }

  private materialKind(base: MatDef, hex: string, o: number, d: boolean): MatDef {
    if (this.source !== base) {
      for (const m of this.materials.values()) m.dispose()
      this.materials.clear()
      this.source = base
    }
    const key = `${hex}|${o}|${d ? 1 : 0}`
    let m = this.materials.get(key)
    if (!m) {
      m = base.clone() as MatDef
      // le corps peut etre invisible (accessoires seuls) : ses copies, elles, se dessinent toujours
      m.visible = true
      m.map = null
      m.emissiveMap = null
      m.emissive.set(0x000000)
      m.color.set(hex)
      m.transparent = o < 1
      m.opacity = o
      if (o < 1) m.depthWrite = false
      if (d) m.side = DoubleSide
      const g = this.settings
      if (g) rim(m, g.force, g.top, { ao: g.ao, highlight: g.highlight })
      this.materials.set(key, m)
    }
    return m
  }

  private empty() {
    for (const g of this.geos) g.dispose()
    this.geos = []
    // les coques de l'ordinateur restent avec lui (il est garde d'une reconstruction a l'autre)
    for (const ch of [...this.group.children]) {
      if (ch !== this.laptopG) this.liberer3(ch)
      this.group.remove(ch)
    }
  }

  /** Libere les geometries et materiaux des coques sous `o`. */
  private liberer3(o: Object3D) {
    o.traverse((x) => {
      if ((x.userData as Partial<DataShell>).shell) {
        const m = x as Mesh
        m.geometry.dispose()
        ;(m.material as MeshBasicMaterial).dispose()
      }
    })
  }

  /**
   * Contour des accessoires : une coque inversee par piece opaque, de la couleur de la piece tres assombrie,
   * meme epaisseur que celle du corps (`th`, en unites du moteur) ramenee a l'echelle locale de la piece.
   * `visible` faux : coques cachees (elles ne sont creees qu'au premier besoin). Appele a chaque image.
   */
  outline(visible: boolean, th: number) {
    if (!this.group.visible) return
    const todo: Mesh[] = []
    if (visible) {
      this.group.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh || (m.userData as Partial<DataShell>).shell || m.userData.withShell) return
        todo.push(m)
      })
    }
    for (const m of todo) {
      m.userData.withShell = true
      const mat = m.material as MatDef
      // les pieces translucides (verres) n'ont pas de contour
      if (mat.transparent) continue
      const th0 = { value: th }
      const c = new Mesh(geometryShell(m.geometry), materialShell(`#${mat.color.getHexString()}`, th0))
      c.userData = { shell: true, th: th0 } satisfies DataShell
      m.add(c)
    }
    const root = this.group.parent
    this.group.traverse((o) => {
      const d = o.userData as Partial<DataShell>
      if (!d.shell) return
      o.visible = visible
      if (!visible) return
      // echelle locale cumulee de la piece (l'ordinateur gonfle et se replie : le trait ne bouge pas)
      let k = 1
      for (let p = o.parent; p && p !== root; p = p.parent) k *= Math.cbrt(Math.abs(p.scale.x * p.scale.y * p.scale.z)) || 1
      d.th!.value = th / Math.max(1e-4, k)
    })
  }

  /**
   * Pose la selection sur le corps. `landmarks` est appele seulement quand quelque chose change
   * (les tirs de rayons coutent) ; `keyBody` identifie le corps (contour, forme, yeux).
   */
  update(sel: AccessorySelection, keyBody: string, base: MatDef, landmarks: () => Landmarks | null, laptop?: { k: number; ground: number; key: string }) {
    const active = SLOTS.filter((e) => resolveAccessories(e, sel[e]))
    const aff = !!laptop && laptop.k > 0.003
    if (!active.length && !aff) {
      this.group.visible = false
      this.key = ''
      this.shadows = []
      this.colors = []
      return
    }
    const key = `${keyBody}|${base.uuid}|${this.body ?? ''}|${JSON.stringify(sel)}|${this.settings ? 'l' : 'p'}|${aff ? 'o' : ''}`
    this.group.visible = true
    // l'echelle de l'ordinateur change a chaque image sans rien reconstruire
    if (this.laptopG) {
      this.laptopG.visible = aff
      if (laptop) this.laptopG.scale.setScalar(Math.max(laptop.k, 0.001))
    }
    if (key === this.key) return
    this.key = key
    this.version++
    this.empty()
    this.shadows = []
    this.colors = colorsOf(sel)
    if (aff) this.colors.push(LAPTOP_COLORS.shell, LAPTOP_COLORS.logo)
    const R = landmarks()
    if (!R) {
      this.group.visible = false
      return
    }
    // deux yeux : ceux du corps, sinon deux yeux de remplacement a la hauteur du centre
    const ye: [EyeScene, EyeScene] =
      R.eyes.length === 2
        ? [R.eyes[0]!, R.eyes[1]!]
        : [
            { x: -R.gap / 2, y: R.yEyes, r: R.rLens },
            { x: R.gap / 2, y: R.yEyes, r: R.rLens }
          ]
    for (const e of active) {
      const d = resolveAccessories(e, sel[e])!
      const gen = GENERATEURS[e][d.id]
      if (!gen) continue
      const g = new Group()
      g.name = e
      this.group.add(g)
      const ctx: Ctx = {
        g,
        R,
        c1: d.c1,
        c2: d.c2,
        mat: (hex, o = 1, dbl = false) => this.materialKind(base, hex, o, dbl),
        geos: this.geos,
        a: ye[0],
        b: ye[1],
        rv: R.rLens,
        body: this.body
      }
      gen(ctx)
      this.shadows.push(...shadowsOf(e, g, R))
    }
    if (aff && laptop) this.placeLaptop(base, R, ye, laptop)
  }

  /** Ordinateur du mood `working` : construit une fois par forme et par matiere, puis remis dans le groupe. */
  private placeLaptop(base: MatDef, R: Landmarks, ye: [EyeScene, EyeScene], laptop: { k: number; ground: number; key: string }) {
    const keyO = `${laptop.key}|${base.uuid}|${this.body ?? ''}`
    if (!this.laptopG || this.laptopKey !== keyO) {
      for (const g of this.laptopGeos) g.dispose()
      this.laptopGeos = []
      if (this.laptopG) this.liberer3(this.laptopG)
      let m = this.laptopMeasures.get(laptop.key)
      if (!m) {
        m = measureLaptop(R, laptop.ground)
        this.laptopMeasures.set(laptop.key, m)
      }
      const ctx: Ctx = {
        g: new Group(),
        R,
        c1: LAPTOP_COLORS.shell,
        c2: LAPTOP_COLORS.logo,
        mat: (hex, o = 1, dbl = false) => this.materialKind(base, hex, o, dbl),
        geos: this.laptopGeos,
        a: ye[0],
        b: ye[1],
        rv: R.rLens,
        body: this.body
      }
      this.laptopG = buildLaptop(ctx, m)
      this.laptopKey = keyO
    }
    this.laptopG.visible = true
    this.laptopG.scale.setScalar(Math.max(laptop.k, 0.001))
    this.group.add(this.laptopG)
  }

  /**
   * Oublie la pose en cache : le prochain `update` reconstruit les pieces et refait les tirs de rayons sur le corps tel qu'il
   * est a ce moment. Sert quand la forme change : la cle (style|forme) change tout de suite, mais le corps est encore en
   * train de se transformer (morph), donc les reperes calcules a cet instant sont ceux d'une forme a mi-chemin.
   */
  invalidate() {
    this.key = ''
  }

  liberer() {
    this.empty()
    for (const g of this.laptopGeos) g.dispose()
    this.laptopGeos = []
    if (this.laptopG) this.liberer3(this.laptopG)
    this.laptopG = null
    for (const m of this.materials.values()) m.dispose()
    this.materials.clear()
  }
}

/** Ombre douce d'un emplacement sur la face avant (repere du moteur : y vers le bas). */
function shadowsOf(e: Slot, g: Group, R: Landmarks): Shadow[] {
  const b = new Box3Lite(g)
  if (!b.ok) return []
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  const cx = (b.x0 + b.x1) / 2
  switch (e) {
    case 'head':
      return [{ x: R.head.cx + 0.1 * R.head.R, y: -R.head.y + 0.16 * R.head.R, rx: 1.0 * R.head.R, ry: 0.32 * R.head.R, a: 0.26 }]
    case 'eyes':
      return R.eyes.map((o) => ({ x: o.x + 0.2 * R.rLens, y: -o.y + 0.42 * R.rLens, rx: 1.15 * R.rLens, ry: 1.1 * R.rLens, a: 0.22 }))
    case 'neck':
      return [{ x: cx + 0.04 * w, y: -b.y0 + 0.02 * h, rx: Math.min(0.5 * w, 0.6 * R.hw), ry: 0.1 * R.hw, a: 0.2 }]
    case 'face':
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

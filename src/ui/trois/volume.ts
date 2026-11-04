/**
 * Volume 3D d'une image du moteur : la silhouette 2D « gonflee » en un corps ferme.
 *
 * Aucune dependance a Three.js ici, et aucun etat : ce sont des fonctions pures de la
 * sortie de `engine.sample(t)`, testees sous `node`. Le module Three (`scene3d.ts`) ne
 * fait que copier ces tableaux dans ses tampons. Le moteur ne sait rien de la 3D : elle
 * n'est qu'un rendu de plus, comme le pixel art.
 *
 * Pourquoi gonfler le contour plutot que modeler chaque forme : le moteur ne rend qu'un
 * contour par image (`bodyPath`), qui morphe d'un etat a l'autre. Le gonfler marche donc
 * pour TOUTES les formes, celles du personnalisateur comme les silhouettes relevees sur la
 * video, et suit le morphing sans rien de plus.
 *
 * Repere : celui du moteur (unites de viewBox, y vers le BAS, z vers le spectateur). Le
 * passage au repere Three (y vers le haut) se fait au remplissage des tampons.
 */

import type { Point } from '@/bot/shape'

/** Points intermediaires evalues sur chaque cubique du contour. */
export const SOUS_PAS = 3
/** Anneaux du centre au bord, sur chaque face. */
export const ANNEAUX = 12
/** Demi-fenetre (en points du contour) du lissage des rayons qui fixent l'epaisseur. */
export const LISSAGE = 6

/**
 * Contour du corps relu sur le `bodyPath` : `closedPath` emet `M x y` puis une cubique
 * `C` par point. On evalue chaque cubique en `SOUS_PAS` points, ce qui suit la courbe
 * dessinee en 2D et pas seulement ses 64 sommets.
 */
export function contourDuCorps(d: string, pas = SOUS_PAS): Point[] {
  const m = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d)
  if (!m) return []
  let x0 = Number(m[1])
  let y0 = Number(m[2])
  const out: Point[] = []
  for (const seg of d.slice(m[0].length).split('C')) {
    const n = seg.match(/-?\d+\.?\d*/g)?.map(Number)
    if (!n || n.length < 6) continue
    const [ax, ay, bx, by, cx, cy] = n as [number, number, number, number, number, number]
    for (let k = 0; k < pas; k++) {
      const t = k / pas
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

/** Aire signee (repere du moteur, y vers le bas) : positive pour un contour horaire a l'ecran. */
export function aireSignee(pts: Point[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/** Centre de gravite de la surface du polygone (pas la moyenne des sommets). */
export function centreDe(pts: Point[]): Point {
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

/** Fraction du rayon de chaque anneau : plus serres pres du bord, ou la pente change vite. */
export const fractions = (anneaux: number) =>
  Array.from({ length: anneaux }, (_, i) => Math.sin(((i + 1) / anneaux) * (Math.PI / 2)))
export const FRACTIONS = fractions(ANNEAUX)

/**
 * Finesse d'un volume. Le defaut est celui du rendu realiste ; la variante « low poly »
 * (`rendu3d.ts`) en prend une grossiere, pour que chaque facette se voie.
 */
export interface Finesse {
  anneaux: number
  lissage: number
}
export const FINESSE_DEFAUT: Finesse = { anneaux: ANNEAUX, lissage: LISSAGE }

/** Garde un point du contour sur `k` (au moins 3 points restent) : un contour plus grossier. */
export function reduire(pts: Point[], k: number): Point[] {
  if (k <= 1) return pts
  const out = pts.filter((_, i) => i % k === 0)
  return out.length >= 3 ? out : pts
}

/**
 * Profil de volume d'une forme : de quoi la gonfler, sans la renseigner point par point.
 *
 * - `profondeur` : profondeur totale, en fraction de la plus petite dimension (largeur ou
 *   hauteur) de la silhouette. 1 = aussi profond que large (cube, sphere).
 * - `arrondi` : rayon de l'arete arrondie, en fraction de la demi-profondeur. 1 = tout est
 *   arrondi (sphere, oeuf, galet) ; 0,4 = un cube aux aretes adoucies, face avant PLANE et
 *   cotes droits ; entre les deux, un coussin a plateau (fleur, nuage).
 * - `arriere` : la face arriere est un peu moins profonde (le corps se pose, il ne flotte
 *   pas) ; 1 = symetrique.
 *
 * Le profil ne depend que de la forme, pas de l'image : le volume suit le morphing du
 * contour, mais un cube reste un cube quand il s'ecrase ou saute.
 */
export interface ProfilVolume {
  profondeur: number
  arrondi: number
  arriere: number
  /**
   * Pyramide : la profondeur est celle de la base (la largeur) et decroit lineairement jusqu'a
   * la pointe (en haut) ; face avant inclinee, base plate dessous, aretes adoucies.
   */
  pyramide?: boolean
  /** Sphere geometrique : anneaux a angle polaire regulier, rayon z = rayon moyen du contour. */
  sphere?: boolean
  /**
   * Solide de revolution : le corps est un volume de section circulaire autour de l'axe vertical
   * (`v` : cone, goutte, oeuf) ou horizontal (`h` : capsule couchee). La profondeur en chaque point
   * vaut la demi-largeur du contour a cette hauteur (ou a cette abscisse) : le corps est donc
   * credible sous tous les angles, sans mur ni extrusion plate.
   */
  revolution?: 'v' | 'h'
}

/** Un coussin a plateau : sert aux formes sans profil connu (silhouettes relevees, etc.). */
export const PROFIL_DEFAUT: ProfilVolume = { profondeur: 0.8, arrondi: 0.75, arriere: 0.9 }

export const PROFILS: Record<string, ProfilVolume> = {
  // boules : tout est arrondi, le cercle est une VRAIE sphere (le corps de la video)
  cercle: { profondeur: 1, arrondi: 1, arriere: 1, sphere: true },
  oeuf: { profondeur: 1, arrondi: 1, arriere: 1, revolution: 'v' },
  galet: { profondeur: 0.9, arrondi: 1, arriere: 0.9 },
  goutte: { profondeur: 1, arrondi: 1, arriere: 1, revolution: 'v' },
  // la capsule est un tube couche : aussi profond que haut
  capsule: { profondeur: 1, arrondi: 1, arriere: 1, revolution: 'h' },
  // le carre est un CUBE : aussi profond que large, face plane, cotes droits, aretes rondes
  squircle: { profondeur: 1, arrondi: 0.78, arriere: 1 },
  // pyramide a base carree vue par une face : la profondeur croit de la pointe a la base
  triangle: { profondeur: 1, arrondi: 1, arriere: 1, revolution: 'v' },
  // hexagone : ecrou doux, meme extrusion biseautee
  hexagone: { profondeur: 0.8, arrondi: 0.82, arriere: 1 },
  // extrusion a gros biseau (reference : icones 3D epaisses et douces) : faces plates, bords
  // ENTIEREMENT arrondis comme un bonbon, epaisseur ~0,45 x la largeur
  etoile: { profondeur: 0.7, arrondi: 0.97, arriere: 1 },
  // fleur : cinq petales ronds extrudes, meme biseau
  fleur: { profondeur: 0.7, arrondi: 0.97, arriere: 1 },
  // nuage : coussin bombe, valide tel quel
  nuage: { profondeur: 1, arrondi: 1, arriere: 1 }
}

export const profilDe = (forme?: string | null): ProfilVolume =>
  (forme ? PROFILS[forme] : undefined) ?? PROFIL_DEFAUT

/** Un arrondi de 1 garderait un mur de hauteur nulle : on laisse 2 % de la demi-profondeur. */
const ARRONDI_MAX = 0.98

/**
 * Mesures d'un volume : demi-profondeur `H`, rayon d'arete `b` et hauteur du mur `zw`
 * (le bord du corps est a `+zw` devant et `-zw * arriere` derriere).
 */
export function mesuresDe(pts: Point[], profil: ProfilVolume) {
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
  const petit = Math.max(1, profil.pyramide ? x1 - x0 : Math.min(x1 - x0, y1 - y0))
  const H = (profil.profondeur * petit) / 2
  const b = H * Math.min(ARRONDI_MAX, Math.max(0, profil.arrondi))
  return { H, b, zw: H - b, y0, y1 }
}

/** Part de la demi-profondeur a la hauteur `y` : 1 partout, sauf la pyramide (0,08 a la pointe, 1 a la base). */
export function partProfondeur(y: number, m: { y0: number; y1: number }, profil: ProfilVolume): number {
  if (!profil.pyramide) return 1
  const t = (y - m.y0) / Math.max(1e-6, m.y1 - m.y0)
  return 0.08 + 0.92 * Math.min(1, Math.max(0, t))
}

/**
 * Hauteur de la surface avant a la distance `d` du bord : un quart de cercle de rayon `b`
 * qui se raccorde au mur (tangente verticale en d = 0) puis au plateau plat (d >= b). Sur
 * un cercle avec b = H c'est EXACTEMENT la sphere.
 */
export function hauteur(d: number, H: number, b: number): number {
  if (d >= b) return H
  const x = b - Math.max(0, d)
  return H - b + Math.sqrt(Math.max(0, b * b - x * x))
}

/** Distance d'un point au bord (segments `depart - largeur` a `depart + largeur`, contour ferme). */
function distanceBord(pts: Point[], x: number, y: number, depart: number, largeur: number): number {
  const n = pts.length
  let m = Infinity
  for (let j = -largeur; j <= largeur; j++) {
    const a = pts[(depart + j + n * 4) % n]!
    const c = pts[(depart + j + 1 + n * 4) % n]!
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

/** Distance d'un point (x, y) au bord, sur tout le contour. */
export const distanceAuBord = (pts: Point[], x: number, y: number) =>
  distanceBord(pts, x, y, 0, Math.floor(pts.length / 2))

export interface Volume {
  /** x, y, z par sommet, repere du moteur */
  positions: Float32Array
  /** u, v par sommet, projection de face sur le viewBox (texture des yeux) */
  uvs: Float32Array
  /** triangles ; ne depend que du nombre de points du contour */
  index: Uint32Array
  /** point le plus bas du corps (y max, repere du moteur) : la ou il touche le sol */
  bas: number
  centre: Point
  /** demi-profondeur, rayon d'arete et hauteur du mur (unites du moteur) */
  mesures: { H: number; b: number; zw: number; y0: number; y1: number }
}

/** Nombre de sommets d'un volume pour un contour de `n` points. */
export const sommets = (n: number, anneaux = ANNEAUX) => 2 + (2 * anneaux + 1) * n

/**
 * Disposition des sommets, pour `n` points de contour et `A` anneaux :
 *   0                       centre avant
 *   1 + (a-1) n + k         anneau avant a (1..A) ; A = le bord, avec la texture du visage
 *   1 + A n + k             anneau « mur haut » : meme position que le bord avant, sans visage
 *   1 + (A+1) n             centre arriere
 *   2 + (A+1) n + (a-1) n + k   anneau arriere a (1..A) ; A = le pied du mur
 * Le mur est une bande entre le bord avant dedouble et le bord arriere : le visage (yeux,
 * reflet) s'arrete donc au bord de la face avant, et les cotes sont de la couleur du corps.
 */
export const indicesVolume = (n: number, anneaux = ANNEAUX) => ({
  avant: (a: number, k: number) => 1 + (a - 1) * n + (k % n),
  mur: (k: number) => 1 + anneaux * n + (k % n),
  centreArriere: 1 + (anneaux + 1) * n,
  arriere: (a: number, k: number) => 2 + (anneaux + 1) * n + (a - 1) * n + (k % n)
})

const indexCache = new Map<string, Uint32Array>()

/** Triangles d'un volume a `n` points de contour (partages entre tous les volumes de meme n). */
export function indexDuVolume(n: number, anneaux = ANNEAUX): Uint32Array {
  const cle = `${n}|${anneaux}`
  const deja = indexCache.get(cle)
  if (deja) return deja
  const tri: number[] = []
  const { avant, mur, centreArriere, arriere } = indicesVolume(n, anneaux)
  for (let k = 0; k < n; k++) {
    // face avant : anti-horaire vue de +z une fois y retourne (repere Three)
    tri.push(0, avant(1, k + 1), avant(1, k))
    tri.push(centreArriere, arriere(1, k), arriere(1, k + 1))
    for (let a = 1; a < anneaux; a++) {
      tri.push(avant(a, k), avant(a, k + 1), avant(a + 1, k))
      tri.push(avant(a, k + 1), avant(a + 1, k + 1), avant(a + 1, k))
      // arriere : le chemin va du bord (a + 1) vers le centre (a)
      tri.push(arriere(a + 1, k), arriere(a + 1, k + 1), arriere(a, k + 1))
      tri.push(arriere(a + 1, k), arriere(a, k + 1), arriere(a, k))
    }
    // le mur : du bord avant dedouble au pied arriere
    tri.push(mur(k), mur(k + 1), arriere(anneaux, k + 1))
    tri.push(mur(k), arriere(anneaux, k + 1), arriere(anneaux, k))
  }
  const out = Uint32Array.from(tri)
  indexCache.set(cle, out)
  return out
}

/** Etendue du contour sur la droite `y = v` (axe `v`) ou `x = v` (axe `h`) : [min, max] ou null. */
function corde(pts: Point[], v: number, axe: 'v' | 'h'): [number, number] | null {
  let a = Infinity
  let b = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    const pu = axe === 'v' ? p.y : p.x
    const qu = axe === 'v' ? q.y : q.x
    if (pu > v !== qu > v) {
      const t = (v - pu) / (qu - pu)
      const w = axe === 'v' ? p.x + t * (q.x - p.x) : p.y + t * (q.y - p.y)
      if (w < a) a = w
      if (w > b) b = w
    }
  }
  return a === Infinity ? null : [a, b]
}

/** Coordonnee de texture d'un point du viewBox : (0,0) en bas a gauche, comme Three. */
const uvDe = (x: number, y: number, vb: number) => [(x + vb) / (2 * vb), 1 - (y + vb) / (2 * vb)]

/**
 * Gonfle le contour `pts` en un volume ferme. `cible` est reutilisee si elle a la bonne
 * taille (une image par frame : pas d'allocation dans la boucle).
 *
 * La hauteur de chaque sommet est une fonction de sa DISTANCE au bord (`hauteur`), pas de
 * son rang dans l'anneau : face avant plane, arete en quart de cercle de rayon constant,
 * mur droit. C'est ce qui fait un cube d'un carre, et reste une sphere sur un cercle.
 *
 * La face arriere et le mur prennent la coordonnee de texture d'un coin du viewBox, qui n'a
 * que la couleur du corps : les yeux ne sont peints que devant.
 */
export function gonfler(
  contour: Point[],
  vb: number,
  cible?: Volume,
  finesse: Finesse = FINESSE_DEFAUT,
  profil: ProfilVolume = PROFIL_DEFAUT
): Volume {
  const ANNEAUX_N = finesse.anneaux
  const FRAC = ANNEAUX_N === ANNEAUX ? FRACTIONS : fractions(ANNEAUX_N)
  // sens du contour : celui des profils radiaux (horaire a l'ecran). Un contour donne
  // dans l'autre sens retournerait toutes les faces.
  const pts = aireSignee(contour) < 0 ? [...contour].reverse() : contour
  const n = pts.length
  const total = sommets(n, ANNEAUX_N)
  const v: Volume =
    cible && cible.positions.length === total * 3
      ? cible
      : {
          positions: new Float32Array(total * 3),
          uvs: new Float32Array(total * 2),
          index: indexDuVolume(n, ANNEAUX_N),
          bas: 0,
          centre: { x: 0, y: 0 },
          mesures: { H: 0, b: 0, zw: 0, y0: 0, y1: 0 }
        }
  const c = centreDe(pts)
  let rc = 0
  let bas = -Infinity
  for (const p of pts) {
    rc += Math.hypot(p.x - c.x, p.y - c.y)
    if (p.y > bas) bas = p.y
  }
  rc /= Math.max(1, n)
  const mesures = mesuresDe(pts, profil)
  const { H } = mesures
  const ARR = Math.min(ARRONDI_MAX, Math.max(0, profil.arrondi))
  // la distance au bord se mesure sur un contour plus grossier (un point par cubique) et sur
  // les segments voisins du rayon seulement : assez juste, et ~50 fois moins cher
  const pas = Math.max(1, Math.round(n / 64))
  const grossier = pts.filter((_, i) => i % pas === 0)
  const m = grossier.length
  const fenetre = Math.max(6, Math.ceil(m / 5))
  const P = v.positions
  const U = v.uvs
  const pose = (i: number, x: number, y: number, z: number, face: boolean) => {
    P[i * 3] = x
    P[i * 3 + 1] = y
    P[i * 3 + 2] = z
    const [a, b2] = face ? uvDe(x, y, vb) : [0.002, 0.002]
    U[i * 2] = a!
    U[i * 2 + 1] = b2!
  }
  const arriere = profil.arriere
  const idx = indicesVolume(n, ANNEAUX_N)
  if (profil.sphere) {
    // vraie sphere : anneaux a angle polaire regulier, z = rayon moyen. Sur un cercle c'est
    // exactement la sphere ; si le contour s'ecrase, la silhouette suit toujours le contour.
    pose(0, c.x, c.y, rc, true)
    pose(idx.centreArriere, c.x, c.y, -rc, false)
    for (let k = 0; k < n; k++) {
      const p = pts[k]!
      for (let a = 1; a <= ANNEAUX_N; a++) {
        const th = (a / ANNEAUX_N) * (Math.PI / 2)
        const f = a === ANNEAUX_N ? 1 : Math.sin(th)
        const x = c.x + (p.x - c.x) * f
        const y = c.y + (p.y - c.y) * f
        const z = a === ANNEAUX_N ? 0 : rc * Math.cos(th)
        pose(idx.avant(a, k), x, y, z, true)
        pose(idx.arriere(a, k), x, y, -z, false)
      }
      pose(idx.mur(k), p.x, p.y, 0, false)
    }
    v.bas = bas
    v.centre = c
    v.mesures = { ...mesures, H: rc, b: rc, zw: 0 }
    return v
  }
  if (profil.revolution) {
    // solide de revolution : memes anneaux que la sphere, mais la profondeur de chaque point est la
    // demi-largeur du contour a sa hauteur (axe vertical) ou a son abscisse (axe horizontal)
    const axe = profil.revolution
    const zDe = (x: number, y: number) => {
      const ch = corde(pts, axe === 'v' ? y : x, axe)
      if (!ch) return 0
      const mid = (ch[0] + ch[1]) / 2
      const hw = (ch[1] - ch[0]) / 2
      const t = ((axe === 'v' ? x : y) - mid) / Math.max(hw, 1e-6)
      return hw * Math.sqrt(Math.max(0, 1 - t * t)) * profil.profondeur
    }
    const z0 = zDe(c.x, c.y)
    pose(0, c.x, c.y, z0, true)
    pose(idx.centreArriere, c.x, c.y, -z0, false)
    for (let k = 0; k < n; k++) {
      const p = pts[k]!
      for (let a = 1; a <= ANNEAUX_N; a++) {
        const th = (a / ANNEAUX_N) * (Math.PI / 2)
        const f = a === ANNEAUX_N ? 1 : Math.sin(th)
        const x = c.x + (p.x - c.x) * f
        const y = c.y + (p.y - c.y) * f
        const z = a === ANNEAUX_N ? 0 : zDe(x, y)
        pose(idx.avant(a, k), x, y, z, true)
        pose(idx.arriere(a, k), x, y, -z, false)
      }
      pose(idx.mur(k), p.x, p.y, 0, false)
    }
    v.bas = bas
    v.centre = c
    v.mesures = { ...mesures, H: rc, b: rc, zw: 0 }
    return v
  }
  // distances au bord de chaque sommet (une passe d'avance : le corps gonfle a besoin du maximum)
  const dist = new Float32Array(ANNEAUX_N * n)
  const place = new Float32Array(ANNEAUX_N * n * 2)
  let dMax = 1e-6
  for (let k = 0; k < n; k++) {
    const p = pts[k]!
    const dx = p.x - c.x
    const dy = p.y - c.y
    const longueur = Math.hypot(dx, dy)
    const depart = Math.min(m - 1, Math.round(k / pas))
    for (let a = 1; a <= ANNEAUX_N; a++) {
      const u = FRAC[a - 1]!
      // les anneaux internes sont ARRONDIS : copie du contour a l'echelle `u`, ses angles
      // (hexagone, carre) se retrouveraient en plis le long de chaque rayon d'angle. Le
      // contour exact n'est retrouve qu'au bord (w = 1).
      const w = u * u * Math.sqrt(u)
      const k2 = a === ANNEAUX_N ? 1 : (u * (rc * (1 - w) + longueur * w)) / Math.max(longueur, 1e-6)
      const i = (a - 1) * n + k
      place[i * 2] = c.x + dx * k2
      place[i * 2 + 1] = c.y + dy * k2
      const d = a === ANNEAUX_N ? 0 : distanceBord(grossier, place[i * 2]!, place[i * 2 + 1]!, depart, fenetre)
      dist[i] = d
      if (d > dMax) dMax = d
    }
  }
  const Hc = H * partProfondeur(c.y, mesures, profil)
  pose(0, c.x, c.y, Hc, true)
  pose(idx.centreArriere, c.x, c.y, -Hc * arriere, false)
  for (let k = 0; k < n; k++) {
    const p = pts[k]!
    for (let a = 1; a <= ANNEAUX_N; a++) {
      const i = (a - 1) * n + k
      const x = place[i * 2]!
      const y = place[i * 2 + 1]!
      const d = dist[i]!
      const Hy = H * partProfondeur(y, mesures, profil)
      const z = hauteur(d, Hy, Hy * ARR)
      pose(idx.avant(a, k), x, y, z, true)
      pose(idx.arriere(a, k), x, y, -z * arriere, false)
    }
    const Hp = H * partProfondeur(p.y, mesures, profil)
    pose(idx.mur(k), p.x, p.y, Hp * (1 - ARR), false)
  }
  v.bas = bas
  v.centre = c
  v.mesures = mesures
  return v
}

/**
 * Rend les normales du bord continues : sur l'anneau du bord avant, le mur haut et le pied
 * du mur, la normale est horizontale (la tangente de l'arete y est verticale). Les sommets
 * du bord avant et du mur sont dedoubles pour la texture, donc `computeVertexNormals` ne les
 * relie pas : on les soude ici. `normales` est le tampon x, y, z du maillage Three.
 */
export function souderNormales(normales: Float32Array, n: number, anneaux = ANNEAUX) {
  const { avant, mur, arriere } = indicesVolume(n, anneaux)
  for (let k = 0; k < n; k++) {
    const trio = [avant(anneaux, k), mur(k), arriere(anneaux, k)]
    let nx = 0
    let ny = 0
    for (const i of trio) {
      nx += normales[i * 3]!
      ny += normales[i * 3 + 1]!
    }
    const l = Math.hypot(nx, ny) || 1
    for (const i of trio) {
      normales[i * 3] = nx / l
      normales[i * 3 + 1] = ny / l
      normales[i * 3 + 2] = 0
    }
  }
}

/**
 * Demi-etendue d'un oeil a l'ecran : la boite de son chemin (extremites des segments et des
 * arcs, points de controle des courbes), passee dans la matrice du moteur.
 */
export function demiEtendueOeil(d: string, matrice: string): number {
  let mx = 0
  let my = 0
  for (const seg of d.matchAll(/([MLACQ])([^A-Za-z]*)/g)) {
    const n = seg[2]!.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? []
    const prises = seg[1] === 'A' ? n.slice(5) : n
    for (let i = 0; i + 1 < prises.length; i += seg[1] === 'A' ? 7 : 2) {
      mx = Math.max(mx, Math.abs(prises[i]!))
      my = Math.max(my, Math.abs(prises[i + 1]!))
    }
  }
  const [a, b, c, e] = lireMatrice(matrice)
  return Math.max(Math.abs(a) * mx + Math.abs(c) * my, Math.abs(b) * mx + Math.abs(e) * my)
}

/**
 * Les yeux d'un mochi 3D : PILE EN FACE (choix de design, 03/11/2026). Centres sur la face
 * avant, symetriques, de meme taille, droits (ni regard qui decale, ni inclinaison), un peu
 * au-dessus du centre. Ils restent sur la face quand le corps tourne : ils sont peints sur
 * le corps, la camera ne les « corrige » pas. Le 2D ne change pas.
 *
 * `demi` : demi-etendue de chaque oeil a l'echelle 1, dans l'ordre de gauche a droite. Si la
 * face est trop petite (centre d'une etoile), les yeux se reduisent ensemble puis se
 * rapprochent jusqu'a tenir, a l'abri de l'arete arrondie. Une forme ronde n'a pas d'arete :
 * seul le contour compte.
 */
export function yeuxDeFace(pts: Point[], demi: number[], profil: ProfilVolume): Array<{ x: number; y: number; s: number }> {
  const n = demi.length
  if (!n || pts.length < 3) return []
  const c = centreDe(pts)
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
  const petit = Math.min(x1 - x0, y1 - y0)
  const y = c.y - (profil.pyramide ? 0.05 : 0.09) * petit
  // axe de la face : milieu de la largeur du corps a cette hauteur (les formes sont symetriques)
  const xs: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
  }
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : c.x
  const { b } = mesuresDe(pts, profil)
  const marge = profil.arrondi >= 0.99 ? 0 : 0.3 * b
  const ecart = 0.13 * petit
  const dernier = 0.5
  const place = (s: number, g: number) =>
    demi.map((_, i) => ({ x: cx + (n === 1 ? 0 : (i - (n - 1) / 2) * ((2 * g) / Math.max(1, n - 1))), y, s }))
  essai: for (let s = 1; s >= 0.5; s -= 0.05) {
    for (const g of [ecart, ecart * 0.85, ecart * 0.7]) {
      const ps = place(s, g)
      if (ps.every((p, i) => distanceAuBord(pts, p.x, p.y) >= s * demi[i]! + marge)) {
        return ps
      }
      if (s <= 0.5 + 1e-9 && g === ecart * 0.7) break essai
    }
  }
  return place(dernier, ecart * 0.7)
}

/** `matrix(a b c d e f)` du moteur, en six nombres. */
export function lireMatrice(m: string): [number, number, number, number, number, number] {
  const n = m.match(/-?\d+\.?\d*(e-?\d+)?/g)?.map(Number) ?? []
  return n.length >= 6
    ? (n.slice(0, 6) as [number, number, number, number, number, number])
    : [1, 0, 0, 1, 0, 0]
}

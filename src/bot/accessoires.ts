/**
 * Accessoires de metier : un petit objet anime que l'avatar AU TRAVAIL utilise (carnet et crayon,
 * ordinateur portable, clap, graphique et loupe, avion en papier, toile et pinceau, presse-papiers,
 * liste et loupe, engrenage a manivelle), avec le geste qui va avec.
 *
 * Comme les gestes (`gestes.ts`), ce sont des REGLAGES choisis, pas des mesures, et une couche
 * facultative : rien ne change dans `engine.sample(t)` tant qu'on ne s'en sert pas.
 *
 *   const a = accessoireDuMetier('redaction')
 *   const ancre = ancreDuCorps(bot.sample(t).bodyPath)     // une fois, sur une image au repos
 *   const image = bot.sample(t, a.geste(t, { ancre }))     // l'avatar regarde la pointe du crayon
 *   svg = rendu(image) + a.dessin(t, { uid, corps, papier, ancre })   // l'objet, devant le corps
 *
 * `dessin` rend du SVG en texte, dans le repere du moteur (rayon 100, origine au centre de la
 * boule, viewBox de -158 a 158). Tout est pur, fonction du temps : meme image a chaque lecture.
 * Style 3D argile mat : degrades doux, liseres clairs discrets, ombre portee floue ; aucun
 * reflet brillant. `simple: true` retire les details fins pour les tres petites tailles.
 *
 * Bilan d'usage (30/10/2026) : l'avatar doit avoir l'air d'utiliser l'objet, et les accessoires
 * doivent etre proches du corps. Pour chaque objet, une seule ligne de temps pilote l'objet, les
 * mains et le geste : les yeux visent le point d'action (`regard`), un poing de la couleur du
 * corps TIENT l'outil et une paume tient le support, l'objet est colle au corps et le chevauche
 * (`ancreDuCorps`), il suit son rebond, et chaque boucle finit par un resultat lisible (page
 * tournee, voyant, fleche, coche). Le corps garde EXACTEMENT sa taille et sa place de repos ;
 * rien de sombre sous ni a cote des yeux.
 *
 * Les mains detachees de la couleur du corps tiennent l'outil ; leur code est ecrit ici.
 */
import { TAU, clamp, easings, lerp } from './math'
import { GESTE_NEUTRE, type Geste } from './gestes'

export type AccessoireId =
  | 'carnet'
  | 'portable'
  | 'clap'
  | 'graphique'
  | 'avion'
  | 'palette'
  | 'presse-papiers'
  | 'liste'
  | 'engrenage'

/** Teintes du corps (celles de `teintes3d`), pour les mains. */
export interface TeintesCorps {
  clair: string
  base: string
  ombre: string
}

/** Point du contour du corps ou l'objet vient s'appuyer (repere du moteur). */
export interface Ancre {
  x: number
  y: number
}

export interface DessinOptions {
  /** prefixe unique des identifiants SVG (degrades, decoupes) de cet avatar */
  uid: string
  corps: TeintesCorps
  /** couleur du fond sous l'avatar */
  papier: string
  /** tres petite taille : moins de lignes, traits plus epais, pas de mains */
  simple?: boolean
  /**
   * point du contour en bas a droite du corps (`ancreDuCorps(image.bodyPath)`, sur une image au
   * repos). Par defaut celui de la boule. L'objet vient s'y appuyer : le corps ne bouge pas,
   * c'est l'objet qui s'adapte a la forme.
   */
  ancre?: Ancre
}

export interface GesteOptions {
  /**
   * echelle du corps sous accessoire (1 par defaut = taille de repos). Sous 1, le corps rapetisse
   * et se range en haut a gauche pour laisser plus de place a l'objet.
   */
  echelleCorps?: number
  /** meme ancre que pour le dessin, pour que les yeux visent l'objet la ou il est dessine */
  ancre?: Ancre
}

export interface Accessoire {
  id: AccessoireId
  /** duree de la boucle, en secondes */
  boucle: number
  /** geste de l'avatar qui se sert de l'objet ; le corps garde sa taille et sa place de repos */
  geste: (t: number, o?: GesteOptions) => Geste
  /** l'objet, en SVG texte, a dessiner PAR-DESSUS le corps */
  dessin: (t: number, o: DessinOptions) => string
}

// ---------------------------------------------------------------- outils de dessin

const n = (v: number) => String(Math.round(v * 10) / 10)
const mod = (t: number, p: number) => ((t % p) + p) % p
const cloche = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2)
const g = (p: Partial<Geste>): Geste => ({ ...GESTE_NEUTRE, ...p })
const deg = (r: number) => (r * 180) / Math.PI
const ease = easings.easeInOutCubic
type P = { x: number; y: number }
const mix = (a: P, b: P, f: number): P => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) })

/** Couleurs des objets : chaudes, peu saturees, mates. */
export const TEINTES_OBJETS = {
  papier: '#f8f3ea',
  papierOmbre: '#e3d8c6',
  tranche: '#cdbfa8',
  trait: '#8b8f9a',
  ardoise: '#3f4652',
  ardoiseClair: '#566070',
  gris: '#c9c4bc',
  grisOmbre: '#a39e96',
  ecran: '#eef1f5',
  bois: '#c9a27a',
  boisOmbre: '#a8825c',
  crayon: '#f0c36a',
  gomme: '#e8a3a3',
  vert: '#6fbf86',
  rouge: '#f0675c',
  couleurs: ['#8fd3a2', '#f2b880', '#9fb8e8', '#e8a0a8', '#f2d27a']
} as const
const O = TEINTES_OBJETS

const lin = (id: string, c0: string, c1: string, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`

/** Ombre portee douce sous un objet. */
const ombre = (o: DessinOptions, x: number, y: number, rx: number, ry = rx * 0.22) =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="#000" opacity="0.14" filter="url(#${o.uid}af)"/>`

/** Trait revele progressivement (0 -> 1). */
const trait = (d: string, long: number, f: number, couleur: string, epaisseur: number) =>
  f <= 0
    ? ''
    : `<path d="${d}" fill="none" stroke="${couleur}" stroke-width="${n(epaisseur)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${n(long)} ${n(long + 10)}" stroke-dashoffset="${n(long * (1 - clamp(f)))}"/>`

/** Coche : trois points (depart, creux, fin) pour qu'un crayon puisse la suivre. */
const cochePts = (x: number, y: number, k: number): P[] => [
  { x: x - 4 * k, y },
  { x: x - k, y: y + 3 * k },
  { x: x + 5 * k, y: y - 4 * k }
]
/** Point d'une ligne brisee a la fraction f de sa longueur. */
const lePlong = (pts: P[], f: number): P => {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y))
  let reste = clamp(f) * seg.reduce((a, b) => a + b, 0)
  for (let i = 0; i < seg.length; i++) {
    if (reste <= seg[i]! || i === seg.length - 1) return mix(pts[i]!, pts[i + 1]!, seg[i]! ? clamp(reste / seg[i]!) : 1)
    reste -= seg[i]!
  }
  return pts[0]!
}
const coche = (x: number, y: number, k: number, f: number, epaisseur: number) => {
  const p = cochePts(x, y, k)
  return trait(`M${p.map((q) => `${n(q.x)} ${n(q.y)}`).join('L')}`, 12.5 * k, f, O.vert, epaisseur)
}
/** Pastille verte cochee (resultat), qui apparait en grossissant. */
const pastilleOk = (x: number, y: number, k: number, r = 12) =>
  k <= 0.01
    ? ''
    : `<g transform="translate(${n(x)} ${n(y)}) scale(${n(k)})"><circle r="${r}" fill="${O.vert}"/><path d="M${n(-r * 0.45)} 0l${n(r * 0.32)} ${n(r * 0.36)}l${n(r * 0.62)} ${n(-r * 0.72)}" fill="none" stroke="#fff" stroke-width="${n(r * 0.28)}" stroke-linecap="round" stroke-linejoin="round"/></g>`

/** Feuille posee (repere local : x de -w/2 a w/2, y de -h/2 a h/2). */
const feuille = (o: DessinOptions, w: number, h: number) =>
  `<rect x="${n(-w / 2 + 2)}" y="${n(-h / 2 + 4)}" width="${n(w)}" height="${n(h)}" rx="8" fill="${O.tranche}"/>` +
  `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="8" fill="url(#${o.uid}fp)"/>` +
  `<path d="M${n(-w / 2 + 8)} ${n(-h / 2 + 1.2)}h${n(w - 16)}" stroke="#fff" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round"/>`
const defsFeuille = (o: DessinOptions) => lin(`${o.uid}fp`, O.papier, O.papierOmbre, 1, 1)
const defsLoupe = (o: DessinOptions) => lin(`${o.uid}la`, '#8d939c', '#5d636c') + lin(`${o.uid}lm`, O.bois, O.boisOmbre)

/** Reduction facultative du corps (`echelleCorps` < 1) : il rapetisse et se range en haut a gauche. */
const avecEchelle = (geste: Geste, o?: GesteOptions): Geste => {
  const e = clamp(o?.echelleCorps ?? 1, 0.5, 1)
  if (e === 1) return geste
  return { ...geste, sx: geste.sx * e, sy: geste.sy * e, dx: geste.dx - 1.25 * (1 - e), dy: geste.dy - 0.8 * (1 - e) }
}

// ---------------------------------------------------------------- placement et regard

/**
 * Regard vers un point (repere du moteur). Mesure sur le moteur, expression « attentif » : le
 * milieu des deux yeux se place en (7 + 95 sin(yaw) cos(pitch), -3 - 95 sin(pitch)) ; pitch
 * POSITIF = vers le HAUT. On vise DANS LA DIRECTION du point, a une distance bornee (44) : les
 * yeux restent assez hauts pour que l'objet, colle au corps, ne les touche pas.
 */
export const regard = (x: number, y: number) => {
  const vx = x - 7
  const vy = y + 3
  const d = Math.hypot(vx, vy) || 1
  const k = Math.min(44, d * 0.6) / d
  const p = -Math.asin(clamp((vy * k) / 95, -0.9, 0.9))
  const yw = Math.asin(clamp((vx * k) / (95 * Math.cos(p)), -0.9, 0.9))
  return { yaw: deg(yw), pitch: deg(p) }
}

/** Ancre de la boule (point du contour a 50 degres sous l'horizontale, cote droit). */
export const ANCRE_BOULE: Readonly<Ancre> = Object.freeze({ x: 63, y: 78 })

/** Ancre lue sur le contour rendu par le moteur (`BotFrame.bodyPath`) : le point le plus proche de la demi-droite a 50 degres. */
export const ancreDuCorps = (bodyPath: string): Ancre => {
  const v = (bodyPath.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number)
  const cible = (50 * Math.PI) / 180
  let best: Ancre | null = null
  let ecart = Infinity
  for (let i = 0; i + 1 < v.length; i += 2) {
    const x = v[i]!
    const y = v[i + 1]!
    if (Math.hypot(x, y) < 20) continue
    const e = Math.abs(Math.atan2(y, x) - cible)
    if (e < ecart) {
      ecart = e
      best = { x, y }
    }
  }
  return best && ecart < 0.3 ? best : { ...ANCRE_BOULE }
}

/**
 * Les objets sont dessines dans un repere commun (autour de (110, 120)), agrandis de `Z.k`, puis
 * decales pour s'appuyer sur l'ancre du corps en le chevauchant franchement. `k` (< 1) rapproche
 * moins un objet (le clap), pour garder les yeux degages.
 */
const Z = { k: 1.35, x: 72, y: 88 }
const decal = (ancre: Ancre | undefined, k = 1) => {
  const a = ancre ?? ANCRE_BOULE
  return { x: (a.x - ANCRE_BOULE.x) * k - 12, y: (a.y - ANCRE_BOULE.y) * k - 18 }
}
const vers = (p: P, ancre?: Ancre, k = 1) => {
  const d = decal(ancre, k)
  return regard(Z.x + (p.x - Z.x) * Z.k + d.x, Z.y + (p.y - Z.y) * Z.k + d.y)
}

/** Repere local (translation, rotation, cisaillement en degres, echelle) vers le repere des objets. */
const repere = (tx: number, ty: number, rot: number, skew = 0, s = 1) => {
  const c = Math.cos((rot * Math.PI) / 180)
  const si = Math.sin((rot * Math.PI) / 180)
  const k = Math.tan((skew * Math.PI) / 180)
  return {
    transform: `translate(${tx} ${ty}) rotate(${rot})${skew ? ` skewX(${skew})` : ''}${s !== 1 ? ` scale(${s})` : ''}`,
    pt: (x: number, y: number): P => {
      const xs = (x + k * y) * s
      const ys = y * s
      return { x: tx + xs * c - ys * si, y: ty + xs * si + ys * c }
    }
  }
}

/** Definitions communes : flous, degrade des mains. */
const defsCommunes = (o: DessinOptions) =>
  `<filter id="${o.uid}af" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>` +
  `<filter id="${o.uid}ac" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>` +
  lin(`${o.uid}am`, o.corps.clair, o.corps.ombre)

/** Ombre de contact sous une main (petite, nette). */
const contact = (o: DessinOptions, x: number, y: number, rx: number) =>
  `<ellipse cx="${n(x + 2)}" cy="${n(y + 5)}" rx="${n(rx)}" ry="${n(rx * 0.45)}" fill="#000" opacity="0.16" filter="url(#${o.uid}ac)"/>`

/** Poing qui TIENT un outil : boule de la couleur du corps posee par-dessus le manche. */
const poing = (o: DessinOptions, p: P, k = 1) =>
  o.simple || k <= 0.02
    ? ''
    : contact(o, p.x, p.y, 10 * k) +
      `<ellipse cx="${n(p.x)}" cy="${n(p.y)}" rx="${n(12.5 * k)}" ry="${n(10.5 * k)}" fill="url(#${o.uid}am)"/>` +
      `<path d="M${n(p.x - 6.5 * k)} ${n(p.y - 7.6 * k)}q${n(6.5 * k)} ${n(-2.6 * k)} ${n(13 * k)} 0" stroke="#fff" stroke-opacity="0.4" stroke-width="1.7" stroke-linecap="round" fill="none"/>`

/** Paume posee a plat qui TIENT le support (feuille, clap, palette). */
const paume = (o: DessinOptions, p: P, rot: number) =>
  o.simple
    ? ''
    : contact(o, p.x, p.y, 13) +
      `<g transform="translate(${n(p.x)} ${n(p.y)}) rotate(${n(rot)})"><rect x="-15" y="-8" width="30" height="16" rx="8" fill="url(#${o.uid}am)"/>` +
      `<path d="M-9 -6.4h18" stroke="#fff" stroke-opacity="0.38" stroke-width="1.6" stroke-linecap="round"/></g>`

/** Point a `l` le long d'un manche oriente a `a` degres depuis p (la ou le poing serre). */
const surManche = (p: P, a: number, l: number): P => ({ x: p.x + l * Math.cos((a * Math.PI) / 180), y: p.y + l * Math.sin((a * Math.PI) / 180) })

/** Crayon dont la pointe est en p, manche vers le haut a droite, serre par le poing. */
const crayonTenu = (o: DessinOptions, p: P, a = -58) =>
  `<g transform="translate(${n(p.x)} ${n(p.y)}) rotate(${a}) scale(1.2)">` +
  `<path d="M0 0l8 -5v10z" fill="#e9d7b4"/><path d="M0 0l3 -1.9v3.8z" fill="#4a4f5a"/>` +
  `<rect x="8" y="-5" width="40" height="10" rx="2.5" fill="url(#${o.uid}cr)"/>` +
  `<rect x="46" y="-5" width="9" height="10" rx="4" fill="${O.gomme}"/></g>` +
  poing(o, surManche(p, a, 30))
const defsCrayon = (o: DessinOptions) => lin(`${o.uid}cr`, O.crayon, '#d9a64e')

/** Loupe tenue : le verre grossit (x 1,6) ce qu'il couvre (`dessous`, dans le meme repere local). */
const loupeVerre = (o: DessinOptions, lx: number, ly: number, r: number, dessous: string) =>
  `<clipPath id="${o.uid}gv"><circle cx="${n(lx)}" cy="${n(ly)}" r="${r}"/></clipPath>` +
  `<rect x="${n(lx + r * 0.62)}" y="${n(ly + r * 0.62 - r * 0.24)}" width="${n(r * 1.5)}" height="${n(r * 0.48)}" rx="${n(r * 0.24)}" transform="rotate(45 ${n(lx + r * 0.62)} ${n(ly + r * 0.62)})" fill="url(#${o.uid}lm)"/>` +
  `<g clip-path="url(#${o.uid}gv)"><circle cx="${n(lx)}" cy="${n(ly)}" r="${r}" fill="${O.papier}"/>` +
  `<g transform="translate(${n(lx)} ${n(ly)}) scale(1.6) translate(${n(-lx)} ${n(-ly)})">${dessous}</g></g>` +
  `<circle cx="${n(lx)}" cy="${n(ly)}" r="${r}" fill="#dfe8f2" fill-opacity="0.18" stroke="url(#${o.uid}la)" stroke-width="${n(r * 0.3)}"/>`

/** L'objet suit le rebond du corps (meme deplacement vertical que le geste). */
const suivre = (geste: Geste, contenu: string) =>
  geste.dy === 0 ? contenu : `<g transform="translate(0 ${n((geste.dy * 100) / Z.k)})">${contenu}</g>`

const enveloppe = (o: DessinOptions, contenu: string, defs = '', k = 1) => {
  const d = decal(o.ancre, k)
  return (
    `<g class="mochi-accessoire"><defs>${defsCommunes(o)}${defs}</defs>` +
    `<g transform="translate(${n(d.x)} ${n(d.y)}) translate(${Z.x} ${Z.y}) scale(${Z.k}) translate(${-Z.x} ${-Z.y})">${contenu}</g></g>`
  )
}

/** Petit saut content (resultat) : le corps se grandit un peu sans changer de place. */
const saut = (h: number) => ({ dy: -0.02 * h, sy: 1 + 0.026 * h, sx: 1 - 0.012 * h })

// ---------------------------------------------------------------- les accessoires

/**
 * Redaction (6 s) : le poing tient le crayon, la pointe ecrit trois lignes, le crayon se leve a
 * chaque retour a la ligne (petit hochement) ; pause, petit saut content ; la main tourne la page
 * vers le haut ; page blanche, le crayon revient au debut. Les yeux suivent la pointe.
 */
const CARNET = repere(108, 122, -8, -12)
const C_LIGNES = [-14, -1, 12]
const C_FINS = [30, 30, 10]
const C_X0 = -32
const carnetEtat = (t: number) => {
  const u = mod(t, 6)
  const lignes = C_LIGNES.map((_, k) => (u < 4.9 ? clamp((u - k * 1.2) / 0.95) : 0))
  let x = C_X0
  let y = C_LIGNES[0]!
  let leve = 0
  let ecrit = 0
  let hoche = 0
  let hop = 0
  let s = 1
  let opPage = 1
  let vise: P | null = null
  if (u < 3.6) {
    const k = Math.min(2, Math.floor(u / 1.2))
    const v = u - k * 1.2
    if (v < 0.95) {
      x = lerp(C_X0, C_FINS[k]!, v / 0.95)
      y = C_LIGNES[k]!
      ecrit = 1
    } else {
      const w = ease(clamp((v - 0.95) / 0.25))
      const fin = k < 2 ? { x: C_X0, y: C_LIGNES[k + 1]! } : { x: 40, y: 26 }
      x = lerp(C_FINS[k]!, fin.x, w)
      y = lerp(C_LIGNES[k]!, fin.y, w)
      leve = Math.sin(w * Math.PI)
      hoche = cloche((v - 0.95) / 0.25)
    }
  } else if (u < 4.2) {
    x = 40
    y = 26
    hop = cloche((u - 3.65) / 0.45)
    vise = CARNET.pt(0, 0)
  } else if (u < 4.9) {
    s = Math.cos(Math.PI * ease((u - 4.2) / 0.7))
    x = 40
    y = -30 + 56 * s
    leve = 0.4
  } else {
    s = u < 5.2 ? -1 : 1
    opPage = u < 5.2 ? 1 - (u - 4.9) / 0.3 : 1
    const w = ease(clamp((u - 4.9) / 0.9))
    x = lerp(40, C_X0, w)
    y = lerp(-86, C_LIGNES[0]!, w)
    leve = Math.sin(w * Math.PI) * 1.2
  }
  const pointe = CARNET.pt(x, y)
  pointe.y -= 7 * leve
  return { lignes, pointe, ecrit, hoche, hop, s, opPage, vise: vise ?? pointe }
}
const carnet: Accessoire = {
  id: 'carnet',
  boucle: 6,
  geste: (t, go) => {
    const e = carnetEtat(t)
    const h = saut(e.hop)
    return g({
      ...vers(e.vise, go?.ancre),
      roll: 2 + 1.6 * e.ecrit * Math.sin((t / 0.3) * TAU),
      dy: 0.012 * e.hoche + h.dy,
      sy: h.sy - 0.012 * e.hoche,
      sx: h.sx
    })
  },
  dessin: (t, o) => {
    const e = carnetEtat(t)
    const ep = o.simple ? 6 : 3.6
    let lignes = ''
    C_LIGNES.forEach((y, k) => {
      lignes += trait(`M${C_X0} ${y}H${C_FINS[k]}`, C_FINS[k]! - C_X0, e.lignes[k]!, O.trait, ep)
    })
    const page = (contenu: string, fond: string) =>
      `<rect x="-46" y="-30" width="92" height="60" rx="7" fill="${fond}"/>` +
      `<path d="M-38 -28.8h76" stroke="#fff" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round"/>` +
      contenu
    // la page du dessus se retourne vers le haut, autour de la reliure (y = -30)
    const dessus =
      `<g opacity="${n(e.opPage)}" transform="translate(0 -30) scale(1 ${n(Math.abs(e.s) < 0.02 ? 0.02 : e.s)}) translate(0 30)">` +
      page(e.s > 0 ? lignes : '', e.s > 0 ? `url(#${o.uid}fp)` : O.papierOmbre) +
      `</g>`
    const carnetSvg =
      `<g transform="${CARNET.transform}">` +
      `<rect x="-48" y="-30" width="98" height="66" rx="9" fill="${O.boisOmbre}"/>` +
      `<rect x="-50" y="-33" width="98" height="66" rx="9" fill="${O.couleurs[2]}"/>` +
      page('', `url(#${o.uid}fp)`) +
      dessus +
      `<rect x="-44" y="-36" width="88" height="8" rx="4" fill="${O.gris}"/>` +
      `</g>`
    return enveloppe(
      o,
      suivre(carnet.geste(t), ombre(o, 110, 160, 60) + carnetSvg + paume(o, CARNET.pt(-40, 22), -8) + crayonTenu(o, e.pointe)),
      defsFeuille(o) + defsCrayon(o)
    )
  }
}

/**
 * Code (4,8 s) : portable de 3/4, ecran CLAIR (rien de sombre pres des yeux). Les deux poings
 * tapent a tour de role, chaque ligne de code s'ecrit au curseur, les yeux suivent le curseur ;
 * une pastille verte s'allume sur l'ecran (ca marche), petit saut ; l'ecran se vide.
 */
const ECRAN = { a: 1, b: -0.139, c: 0.036, d: 1, e: 62, f: 82 }
const ecranPt = (x: number, y: number): P => ({ x: ECRAN.e + x * ECRAN.a + y * ECRAN.c, y: ECRAN.f + x * ECRAN.b + y * ECRAN.d })
const P_LIGNES = [12, 21, 30, 39]
const P_LONGS = [[22, 14], [10, 26], [30], [16, 12]]
const P_RETRAITS = [0, 6, 6, 0]
const P_COULEURS = ['#6aa7e0', '#e0925a', '#5fb07a', '#c77aa8']
const pTotal = (i: number) => P_LONGS[i]!.reduce((a, b) => a + b + 5, -5)
const portableEtat = (t: number) => {
  const u = mod(t, 4.8)
  const fondu = 1 - clamp((u - 4.2) / 0.4)
  const lignes = P_LIGNES.map((_, k) => clamp((u - k * 0.8) / 0.7))
  const k = Math.min(3, Math.floor(u / 0.8))
  const tape = u < 3.2 && u - k * 0.8 < 0.7 ? 1 : 0
  const curseur = ecranPt(10 + P_RETRAITS[k]! + pTotal(k) * lignes[k]!, P_LIGNES[k]!)
  const ok = u >= 3.5 ? easings.easeOutCubic(clamp((u - 3.5) / 0.2)) * fondu : 0
  const hop = cloche(clamp((u - 3.55) / 0.45))
  return { u, k, fondu, lignes, tape, curseur, ok, hop }
}
const portable: Accessoire = {
  id: 'portable',
  boucle: 4.8,
  geste: (t, go) => {
    const e = portableEtat(t)
    const tap = e.tape * Math.max(0, Math.sin((t / 0.2) * TAU))
    const h = saut(e.hop)
    const vise = e.ok > 0.05 ? ecranPt(52, 26) : e.curseur
    return g({ ...vers(vise, go?.ancre), dy: 0.02 * tap + h.dy, sx: h.sx + 0.01 * tap, sy: h.sy - 0.02 * tap })
  },
  dessin: (t, o) => {
    const e = portableEtat(t)
    let code = ''
    P_LIGNES.forEach((y, k) => {
      let x = 10 + P_RETRAITS[k]!
      let reste = pTotal(k) * e.lignes[k]!
      P_LONGS[k]!.forEach((l, j) => {
        const vu = Math.min(l, reste)
        if (vu > 0.5) code += `<path d="M${x} ${y}h${n(vu)}" stroke="${P_COULEURS[(k + j) % 4]}" stroke-width="${o.simple ? 4.5 : 3.4}" stroke-linecap="round" opacity="${n(e.fondu)}"/>`
        reste -= l + 5
        x += l + 5
      })
    })
    const curseur =
      !o.simple && e.u < 3.3 && mod(e.u, 0.5) < 0.3
        ? `<rect x="${n(10 + P_RETRAITS[e.k]! + pTotal(e.k) * e.lignes[e.k]! + 1.5)}" y="${P_LIGNES[e.k]! - 3.5}" width="2.4" height="7" rx="1" fill="${O.ardoiseClair}"/>`
        : ''
    const ecran =
      `<g transform="matrix(${ECRAN.a},${ECRAN.b},${ECRAN.c},${ECRAN.d},${ECRAN.e},${ECRAN.f})">` +
      `<rect x="2" y="3" width="72" height="54" rx="8" fill="${O.grisOmbre}"/>` +
      `<rect width="72" height="54" rx="8" fill="url(#${o.uid}pc)"/>` +
      `<path d="M8 1.2h56" stroke="#fff" stroke-opacity="0.6" stroke-width="1.6" stroke-linecap="round"/>` +
      `<rect x="5" y="5" width="62" height="44" rx="4" fill="${O.ecran}"/>` +
      code +
      curseur +
      pastilleOk(52, 26, e.ok, 9) +
      `</g>`
    const tapG = e.tape * Math.max(0, Math.sin((t / 0.2) * TAU))
    const tapD = e.tape * Math.max(0, Math.sin((t / 0.2) * TAU + Math.PI))
    return enveloppe(
      o,
      suivre(
        portable.geste(t),
        ombre(o, 106, 152, 56) +
          ecran +
          `<path d="M64 134l70 -9.7l22 21l-78 11.6z" fill="url(#${o.uid}pb)" stroke="url(#${o.uid}pb)" stroke-width="7" stroke-linejoin="round"/>` +
          `<path d="M76 137l54 -7.4l12 11.4l-58 8.2z" fill="${O.gris}" stroke="${O.gris}" stroke-width="3" stroke-linejoin="round" opacity="0.85"/>` +
          poing(o, { x: 88, y: 138 - 5 * tapG }) +
          poing(o, { x: 120, y: 133 - 5 * tapD })
      ),
      lin(`${o.uid}pc`, '#e6e1d9', O.gris, 1, 1) + lin(`${o.uid}pb`, '#eeeae3', '#d3cdc4', 1, 1)
    )
  }
}

/**
 * Video (2,4 s) : une paume tient le clap, le poing tient le bras ; il le leve (le corps se
 * redresse), le claque (le corps se tasse, les yeux se plissent, petit eclat), puis le voyant
 * rouge s'allume : ca tourne. Clap clair (seules de fines rayures sont sombres), un peu moins
 * rapproche du corps : rien de sombre pres des yeux.
 */
const CLAP = repere(124, 120, -8)
const CLAP_K = 0.85
const clapEtat = (t: number) => {
  const u = mod(t, 2.4)
  const angle =
    u < 0.7 ? lerp(-20, -30, ease(u / 0.7)) : u < 0.82 ? -30 * (1 - ((u - 0.7) / 0.12) ** 2) : u < 1.8 ? 0 : -20 * ease((u - 1.8) / 0.6)
  const recul = u < 0.82 ? ease(clamp(u / 0.7)) : 1 - ease(clamp((u - 0.82) / 0.4))
  const choc = cloche(clamp((u - 0.82) / 0.32))
  const plisse = u >= 0.8 && u < 1.02 ? 1 - 0.7 * cloche((u - 0.8) / 0.22) : 1
  const voyant = u >= 1 && u < 1.8 ? clamp((u - 1) / 0.08) * (1 - clamp((u - 1.7) / 0.1)) : 0
  const eclat = u >= 0.82 && u < 1.12 ? 1 - (u - 0.82) / 0.3 : 0
  // le poing tient le bout libre du bras (charniere en -30, -16)
  const ar = (angle * Math.PI) / 180
  const tenue = CLAP.pt(-30 + 48 * Math.cos(ar) + 5 * Math.sin(ar), -16 + 48 * Math.sin(ar) - 5 * Math.cos(ar))
  return { angle, recul, choc, plisse, voyant, eclat, tenue }
}
const clap: Accessoire = {
  id: 'clap',
  boucle: 2.4,
  geste: (t, go) => {
    const e = clapEtat(t)
    return g({
      ...vers({ x: e.tenue.x - 8, y: e.tenue.y + 10 }, go?.ancre, CLAP_K),
      dy: -0.012 * e.recul + 0.016 * e.choc,
      sy: 1 + 0.018 * e.recul - 0.028 * e.choc,
      sx: 1 - 0.008 * e.recul + 0.018 * e.choc,
      lid: e.plisse
    })
  },
  dessin: (t, o) => {
    const e = clapEtat(t)
    const rayures = (y: number) => {
      let s = ''
      for (let i = 0; i < 4; i++) s += `<path d="M${-26 + i * 15} ${y + 10}l8 -10h6l-8 10z" fill="${O.ardoiseClair}"/>`
      return s
    }
    const bras =
      `<g transform="rotate(${n(e.angle)} -30 -16)"><rect x="-30" y="-26" width="60" height="10" rx="4" fill="${O.papier}"/>` +
      (o.simple ? '' : rayures(-26)) +
      `</g>`
    const corps =
      `<rect x="-28" y="-14" width="60" height="42" rx="7" fill="${O.grisOmbre}"/>` +
      `<rect x="-30" y="-16" width="60" height="42" rx="7" fill="url(#${o.uid}ca)"/>` +
      `<rect x="-30" y="-16" width="60" height="10" rx="4" fill="${O.papier}"/>` +
      (o.simple ? '' : rayures(-16)) +
      `<path d="M-21 4h22M-21 15h32" stroke="${O.grisOmbre}" stroke-width="${o.simple ? 5 : 3.4}" stroke-linecap="round"/>` +
      `<circle cx="20" cy="6" r="5" fill="#d9b8b3"/>` +
      (e.voyant > 0 ? `<circle cx="20" cy="6" r="5" fill="${O.rouge}" opacity="${n(e.voyant)}"/><circle cx="20" cy="6" r="9.5" fill="${O.rouge}" opacity="${n(0.25 * e.voyant)}"/>` : '')
    const eclats =
      e.eclat > 0
        ? `<g stroke="${O.couleurs[4]}" stroke-width="4" stroke-linecap="round" opacity="${n(e.eclat)}"><path d="M38 -28l9 -6M40 -16l11 0M36 -39l3 -10"/></g>`
        : ''
    return enveloppe(
      o,
      suivre(clap.geste(t), ombre(o, 116, 160, 46) + `<g transform="${CLAP.transform}">${corps}${bras}${eclats}</g>` + paume(o, CLAP.pt(-33, 10), 82) + poing(o, e.tenue)),
      lin(`${o.uid}ca`, '#ebe6de', O.gris, 1, 1),
      CLAP_K
    )
  }
}

/**
 * Analyse (5 s) : le poing tient la loupe, la paume tient la feuille. La loupe s'arrete sur
 * chaque barre, qui pousse SOUS le verre (le verre grossit ce qu'il couvre) ; puis la loupe se
 * leve, une fleche verte de tendance se trace, petit saut content. Les yeux suivent le verre.
 */
const GRAPHE = repere(110, 122, -6)
const G_H = [14, 24, 19, 34]
const G_X0 = -30
const G_PAS = 15
const G_L = 11
const G_BASE = 22
const graphiqueEtat = (t: number) => {
  const u = mod(t, 5)
  const fondu = 1 - clamp((u - 4.4) / 0.4)
  const barres = G_H.map((_, k) => easings.easeOutCubic(clamp((u - (k * 0.85 + 0.3)) / 0.45)) * fondu)
  const cible = (k: number) => ({ x: G_X0 + k * G_PAS + G_L / 2, y: G_BASE - G_H[k]! * 0.7 })
  let l = cible(0)
  if (u < 3.4) {
    const k = Math.min(3, Math.floor(u / 0.85))
    const v = u - k * 0.85
    l = k > 0 && v < 0.3 ? mix(cible(k - 1), cible(k), ease(v / 0.3)) : cible(k)
  } else {
    const haut = { x: 30, y: -22 }
    const w = u < 4.4 ? ease(clamp((u - 3.4) / 0.4)) : 1 - ease(clamp((u - 4.4) / 0.6))
    l = mix(u < 4.4 ? cible(3) : cible(0), haut, w)
  }
  const fleche = clamp((u - 3.6) / 0.5) * fondu
  const hop = cloche(clamp((u - 3.85) / 0.45))
  return { barres, l, fleche, hop, verre: GRAPHE.pt(l.x, l.y) }
}
const graphique: Accessoire = {
  id: 'graphique',
  boucle: 5,
  geste: (t, go) => {
    const e = graphiqueEtat(t)
    return g({ ...vers(e.verre, go?.ancre), ...saut(e.hop) })
  },
  dessin: (t, o) => {
    const e = graphiqueEtat(t)
    const largeur = o.simple ? 13 : G_L
    let barres = ''
    G_H.forEach((h, k) => {
      const hh = Math.max(0.01, h * e.barres[k]!)
      barres += `<rect x="${G_X0 + k * G_PAS}" y="${n(G_BASE - hh)}" width="${largeur}" height="${n(hh)}" rx="3" fill="${O.couleurs[[2, 0, 1, 3][k]!]}"/>`
    })
    const base = `<path d="M-34 ${G_BASE + 1}H34" stroke="${O.trait}" stroke-opacity="0.5" stroke-width="2.4" stroke-linecap="round"/>`
    const sommets = G_H.map((h, k) => `${G_X0 + k * G_PAS + G_L / 2} ${G_BASE - h - 7}`)
    const fleche =
      e.fleche > 0
        ? trait(`M${sommets.join('L')}`, 80, e.fleche, O.vert, o.simple ? 5 : 3.4) +
          (e.fleche > 0.9 ? `<path d="M${G_X0 + 3 * G_PAS + G_L / 2 - 7} ${G_BASE - 34 - 9}l7 -2l-1 7" fill="none" stroke="${O.vert}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` : '')
        : ''
    const r = o.simple ? 13 : 12
    const { x: lx, y: ly } = e.l
    return enveloppe(
      o,
      suivre(
        graphique.geste(t),
        ombre(o, 112, 160, 54) +
          `<g transform="${GRAPHE.transform}">${feuille(o, 84, 64)}${base}${barres}${fleche}${loupeVerre(o, lx, ly, r, base + barres)}</g>` +
          paume(o, GRAPHE.pt(-43, 12), 80) +
          poing(o, GRAPHE.pt(lx + r * 1.45, ly + r * 1.45))
      ),
      defsFeuille(o) + defsLoupe(o)
    )
  }
}

/**
 * Publication (3,6 s) : le poing tient l'avion ; il recule (le corps se tasse, prend son elan),
 * lance (le corps s'etire), l'avion part a droite, les yeux le suivent ; la main rentre dans le
 * corps ; une coche verte apparait la ou l'avion disparait, petit saut ; la main ressort avec un
 * nouvel avion.
 */
const A_REPOS = { x: 90, y: 98 }
const A_ARRIERE = { x: 78, y: 104 }
const A_AVANT = { x: 118, y: 90 }
const A_RENTRE = { x: 76, y: 88 }
const A_FIN = { x: 142, y: 10 }
const A_COURBE = { x: 144, y: 78 }
const avionEtat = (t: number) => {
  const u = mod(t, 3.6)
  let main: P = A_REPOS
  let km = 1
  let p: P = A_REPOS
  let rot = -20
  let k = 1
  let op = 1
  let tenu = true
  let elan = 0
  let coil = 0
  let vol = 0
  if (u < 0.8) {
    const w = ease(u / 0.8)
    main = mix(A_REPOS, A_ARRIERE, w)
    p = main
    rot = -20 + 8 * w
    coil = w
  } else if (u < 1) {
    const w = ((u - 0.8) / 0.2) ** 2
    main = mix(A_ARRIERE, A_AVANT, w)
    p = main
    rot = -12 - 12 * w
    coil = 1 - w
    elan = w
  } else {
    tenu = false
    const v = clamp(u - 1)
    p = {
      x: (1 - v) ** 2 * A_AVANT.x + 2 * (1 - v) * v * A_COURBE.x + v * v * A_FIN.x,
      y: (1 - v) ** 2 * A_AVANT.y + 2 * (1 - v) * v * A_COURBE.y + v * v * A_FIN.y
    }
    rot = -24 - 46 * v
    k = 1 - 0.45 * v
    op = u < 2 ? 1 - clamp((v - 0.7) / 0.3) : 0
    vol = u < 2 ? 1 : 0
    elan = 1 - clamp((u - 1) / 0.35)
    // la main rentre dans le corps, puis ressort avec un nouvel avion
    if (u < 2.5) {
      const w = ease(clamp((u - 1.15) / 0.5))
      main = mix(A_AVANT, A_RENTRE, w)
      km = 1 - w
    } else {
      const w = ease(clamp((u - 2.5) / 0.6))
      main = mix(A_RENTRE, A_REPOS, w)
      km = w
    }
  }
  const coche = u >= 1.95 && u < 2.9 ? easings.easeOutCubic(clamp((u - 1.95) / 0.18)) * (1 - clamp((u - 2.6) / 0.3)) : 0
  const hop = cloche(clamp((u - 2) / 0.4))
  const neuf = u >= 2.6 ? easings.easeOutCubic(clamp((u - 2.6) / 0.5)) : 0
  const vise = vol ? p : coche > 0.05 ? { x: A_FIN.x - 6, y: A_FIN.y + 6 } : main
  return { main, km, p, rot, k, op, tenu, elan, coil, coche, hop, neuf, vise, vol }
}
const avion: Accessoire = {
  id: 'avion',
  boucle: 3.6,
  geste: (t, go) => {
    const e = avionEtat(t)
    return g({
      ...vers(e.vise, go?.ancre),
      roll: -4 * e.coil + 4 * e.elan,
      dy: 0.012 * e.coil - 0.012 * e.elan - 0.02 * e.hop,
      sy: 1 - 0.022 * e.coil + 0.02 * e.elan + 0.026 * e.hop,
      sx: 1 + 0.014 * e.coil - 0.01 * e.elan - 0.012 * e.hop
    })
  },
  dessin: (t, o) => {
    const e = avionEtat(t)
    const forme =
      `<g stroke="${O.tranche}" stroke-width="1.6" stroke-linejoin="round"><path d="M22 0L-16 -14L-8 0z" fill="url(#${o.uid}av)"/><path d="M22 0L-8 0L-16 12z" fill="${O.papierOmbre}"/></g>` +
      `<path d="M22 0L-8 0L-4 5z" fill="${O.tranche}"/>`
    const s = o.simple ? 1.8 : 1.45
    const plane = (x: number, y: number, rot: number, k: number, op: number) =>
      op <= 0.01 || k <= 0.01 ? '' : `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${n(k * s)})" opacity="${n(op)}">${forme}</g>`
    const sillage =
      !o.simple && e.vol && e.op > 0.2
        ? `<path d="M${A_AVANT.x} ${A_AVANT.y}Q${A_COURBE.x} ${A_COURBE.y} ${n(e.p.x)} ${n(e.p.y)}" fill="none" stroke="${O.trait}" stroke-opacity="${n(0.3 * e.op)}" stroke-width="2.4" stroke-dasharray="4 7" stroke-linecap="round"/>`
        : ''
    const enMain = e.tenu ? plane(e.p.x, e.p.y, e.rot, e.k, 1) : e.neuf > 0 ? plane(e.main.x, e.main.y, -20, e.neuf, 1) : ''
    const enVol = e.tenu ? '' : plane(e.p.x, e.p.y, e.rot, e.k, e.op)
    return enveloppe(
      o,
      suivre(
        avion.geste(t),
        ombre(o, 96, 128, 30) + sillage + enVol + pastilleOk(A_FIN.x - 6, A_FIN.y + 6, e.coche) + enMain + poing(o, { x: e.main.x - 12, y: e.main.y + 7 }, e.km)
      ),
      lin(`${o.uid}av`, '#ffffff', O.papier, 1, 1)
    )
  }
}

/**
 * DA (4 x 3,6 s) : la paume tient la palette, le poing tient le pinceau ; il trempe le pinceau
 * dans une couleur, peint une touche sur la toile (les yeux suivent la pointe), recule, petit
 * saut ; une couleur par passage.
 */
const TOILE = repere(120, 112, 5, 0, 0.85)
const PALETTE = repere(86, 146, -8)
const D_TROUS = [{ x: -2, y: -7 }, { x: 9, y: -6 }, { x: 16, y: 2 }, { x: 4, y: 4 }]
const D_COULEURS = [3, 2, 0, 4]
const touche = (f: number): P => ({ x: -18 + 40 * f, y: 6 - 14 * f + 8 * Math.sin(f * TAU) })
const paletteEtat = (t: number) => {
  const tour = Math.min(3, Math.floor(mod(t, 14.4) / 3.6))
  const u = mod(t, 3.6)
  const trempe = PALETTE.pt(D_TROUS[tour]!.x, D_TROUS[tour]!.y)
  const debut = TOILE.pt(touche(0).x, touche(0).y)
  const fin = TOILE.pt(touche(1).x, touche(1).y)
  const f = u < 0.8 ? 0 : ease(clamp((u - 0.8) / 1.5))
  let pointe: P
  if (u < 0.5) pointe = mix(debut, trempe, ease(u / 0.5))
  else if (u < 0.8) pointe = mix(trempe, debut, ease((u - 0.5) / 0.3))
  else if (u < 2.3) pointe = TOILE.pt(touche(f).x, touche(f).y)
  else {
    const w = ease(clamp((u - 2.3) / 1.3))
    const leve = { x: Math.sin(w * Math.PI) * 10, y: -Math.sin(w * Math.PI) * 12 }
    const q = mix(fin, debut, w)
    pointe = { x: q.x + leve.x, y: q.y + leve.y }
  }
  const fondu = 1 - clamp((u - 3.2) / 0.4)
  const hop = cloche(clamp((u - 2.4) / 0.45))
  return { tour, pointe, f, fondu, hop }
}
const palette: Accessoire = {
  id: 'palette',
  boucle: 14.4,
  geste: (t, go) => {
    const e = paletteEtat(t)
    return g({ ...vers(e.pointe, go?.ancre), ...saut(e.hop), roll: 3 + 2 * Math.sin((t / 1.8) * TAU) })
  },
  dessin: (t, o) => {
    const e = paletteEtat(t)
    const couleur = O.couleurs[D_COULEURS[e.tour]!]!
    const pts: string[] = []
    for (let i = 0; i <= 16; i++) {
      const q = touche((i / 16) * e.f)
      pts.push(`${n(q.x)} ${n(q.y)}`)
    }
    const coup =
      e.f > 0.01
        ? `<path d="M${pts.join('L')}" fill="none" stroke="${couleur}" stroke-width="${o.simple ? 9 : 7}" stroke-linecap="round" stroke-linejoin="round" opacity="${n(e.fondu)}"/>`
        : ''
    const toile =
      `<g transform="${TOILE.transform}">` +
      `<rect x="-30" y="-34" width="64" height="72" rx="6" fill="${O.boisOmbre}"/>` +
      `<rect x="-32" y="-36" width="64" height="72" rx="6" fill="url(#${o.uid}to)"/>` +
      `<rect x="-26" y="-30" width="52" height="60" rx="3" fill="${O.papier}"/>` +
      coup +
      `</g>`
    const pal =
      `<g transform="${PALETTE.transform}">` +
      `<path d="M-26 0c0 -12 14 -16 28 -14s24 6 24 14s-12 12 -26 12s-26 0 -26 -12z" fill="url(#${o.uid}pa)"/>` +
      D_TROUS.map((d, i) => `<circle cx="${d.x}" cy="${d.y}" r="4" fill="${O.couleurs[D_COULEURS[i]!]}"/>`).join('') +
      `</g>`
    const a = -58
    const p = e.pointe
    const pinceau =
      `<g transform="translate(${n(p.x)} ${n(p.y)}) rotate(${a})">` +
      `<path d="M0 0q3 -5 7 -4v8q-4 1 -7 -4z" fill="${couleur}"/><rect x="6" y="-3.5" width="8" height="7" rx="1.5" fill="${O.grisOmbre}"/>` +
      `<rect x="13" y="-3" width="40" height="6" rx="3" fill="url(#${o.uid}pi)"/></g>`
    return enveloppe(
      o,
      suivre(palette.geste(t), ombre(o, 114, 158, 50) + toile + pal + paume(o, PALETTE.pt(-24, 6), -20) + pinceau + poing(o, surManche(p, a, 30))),
      lin(`${o.uid}to`, O.bois, O.boisOmbre, 1, 1) + lin(`${o.uid}pi`, O.bois, O.boisOmbre) + lin(`${o.uid}pa`, '#efe2cb', '#d8c5a6', 1, 1)
    )
  }
}

/**
 * Chef (4,4 s) : la paume tient le presse-papiers, le poing tient le crayon qui coche chaque case
 * (les yeux suivent la pointe, petit hochement a chaque coche) ; toutes cochees : petit saut,
 * puis la liste se vide et le crayon revient a la premiere case.
 */
const PRESSE = repere(116, 120, -6, 0, 0.82)
const PP_Y = [-16, 0, 16]
const PP_CASES = PP_Y.map((y) => cochePts(-15.5, y - 1, 1.1))
const PP_REPOS = { x: 22, y: 30 }
const pressePapiersEtat = (t: number) => {
  const u = mod(t, 4.4)
  const fondu = 1 - clamp((u - 3.9) / 0.35)
  const coches = PP_Y.map((_, k) => clamp((u - (k * 1.1 + 0.35)) / 0.4) * fondu)
  let pointe: P = PP_CASES[0]![0]!
  let hoche = 0
  if (u < 3.3) {
    const k = Math.min(2, Math.floor(u / 1.1))
    const v = u - k * 1.1
    if (v < 0.35) pointe = k > 0 ? mix(PP_CASES[k - 1]![2]!, PP_CASES[k]![0]!, ease(v / 0.35)) : PP_CASES[0]![0]!
    else if (v < 0.75) pointe = lePlong(PP_CASES[k]!, (v - 0.35) / 0.4)
    else {
      pointe = PP_CASES[k]![2]!
      hoche = cloche((v - 0.75) / 0.35)
    }
  } else if (u < 3.9) pointe = mix(PP_CASES[2]![2]!, PP_REPOS, ease(clamp((u - 3.3) / 0.4)))
  else pointe = mix(PP_REPOS, PP_CASES[0]![0]!, ease(clamp((u - 3.9) / 0.5)))
  const hop = cloche(clamp((u - 3.4) / 0.45))
  return { coches, pointe: PRESSE.pt(pointe.x, pointe.y), hoche, hop }
}
const pressePapiers: Accessoire = {
  id: 'presse-papiers',
  boucle: 4.4,
  geste: (t, go) => {
    const e = pressePapiersEtat(t)
    const h = saut(e.hop)
    return g({ ...vers(e.pointe, go?.ancre), dy: 0.01 * e.hoche + h.dy, sy: h.sy - 0.01 * e.hoche, sx: h.sx })
  },
  dessin: (t, o) => {
    const e = pressePapiersEtat(t)
    let lignes = ''
    PP_Y.forEach((y, k) => {
      lignes +=
        `<rect x="-21" y="${y - 5}" width="10" height="10" rx="2.5" fill="none" stroke="${O.grisOmbre}" stroke-width="${o.simple ? 3 : 2.2}"/>` +
        `<path d="M-4 ${y}H${k === 2 ? 12 : 20}" stroke="${O.tranche}" stroke-width="${o.simple ? 5 : 3.4}" stroke-linecap="round"/>` +
        coche(-15.5, y - 1, 1.1, e.coches[k]!, o.simple ? 4 : 3.2)
    })
    const fond =
      `<g transform="${PRESSE.transform}">` +
      `<rect x="-31" y="-41" width="64" height="84" rx="8" fill="${O.boisOmbre}"/>` +
      `<rect x="-33" y="-43" width="64" height="84" rx="8" fill="url(#${o.uid}pp)"/>` +
      `<rect x="-26" y="-32" width="50" height="68" rx="4" fill="${O.papier}"/>` +
      `<rect x="-12" y="-48" width="22" height="13" rx="4.5" fill="url(#${o.uid}pq)"/>` +
      lignes +
      `</g>`
    return enveloppe(
      o,
      suivre(pressePapiers.geste(t), ombre(o, 116, 160, 46) + fond + paume(o, PRESSE.pt(-36, 14), 84) + crayonTenu(o, e.pointe)),
      lin(`${o.uid}pp`, '#dcb98f', O.boisOmbre, 1, 1) + lin(`${o.uid}pq`, '#c4c8ce', '#9aa0a8') + defsCrayon(o)
    )
  }
}

/**
 * Recherche, SEO, sourcing, verification (4,4 s) : la paume tient la feuille, le poing tient la
 * loupe qui descend la liste ; la ligne sous le verre est grossie, chaque ligne lue se coche ;
 * tout est coche : la loupe se leve, petit saut ; la liste se vide.
 */
const LISTE = repere(114, 120, 6)
const L_Y = [-18, -6, 6, 18]
const L_FINS = [22, 14, 18, 10]
const listeEtat = (t: number) => {
  const u = mod(t, 4.4)
  const fondu = 1 - clamp((u - 3.9) / 0.4)
  const coches = L_Y.map((_, k) => clamp((u - (k * 0.85 + 0.6)) / 0.25) * fondu)
  const cible = (k: number) => ({ x: 4, y: L_Y[k]! - 1 })
  let l: P = cible(0)
  if (u < 3.4) {
    const k = Math.min(3, Math.floor(u / 0.85))
    const v = u - k * 0.85
    l = k > 0 && v < 0.25 ? mix(cible(k - 1), cible(k), ease(v / 0.25)) : { x: cible(k).x + 8 * Math.sin(((v - 0.25) / 0.6) * Math.PI), y: cible(k).y }
  } else {
    const haut = { x: 26, y: -30 }
    const w = u < 3.9 ? ease(clamp((u - 3.4) / 0.35)) : 1 - ease(clamp((u - 3.9) / 0.5))
    l = mix(u < 3.9 ? cible(3) : cible(0), haut, w)
  }
  const hop = cloche(clamp((u - 3.45) / 0.45))
  return { coches, l, hop, verre: LISTE.pt(l.x, l.y) }
}
const liste: Accessoire = {
  id: 'liste',
  boucle: 4.4,
  geste: (t, go) => {
    const e = listeEtat(t)
    return g({ ...vers(e.verre, go?.ancre), ...saut(e.hop) })
  },
  dessin: (t, o) => {
    const e = listeEtat(t)
    let lignes = ''
    L_Y.forEach((y, k) => {
      lignes += `<path d="M-12 ${y}H${L_FINS[k]}" stroke="${O.trait}" stroke-opacity="0.55" stroke-width="${o.simple ? 5 : 3.2}" stroke-linecap="round"/>`
    })
    let coches = ''
    L_Y.forEach((y, k) => {
      coches += coche(-21, y - 1, 0.8, e.coches[k]!, o.simple ? 4 : 3)
    })
    const r = o.simple ? 13 : 12
    return enveloppe(
      o,
      suivre(
        liste.geste(t),
        ombre(o, 114, 160, 46) +
          `<g transform="${LISTE.transform}">${feuille(o, 66, 72)}${lignes}${coches}${loupeVerre(o, e.l.x, e.l.y, r, lignes)}</g>` +
          paume(o, LISTE.pt(-34, 14), 96) +
          poing(o, LISTE.pt(e.l.x + r * 1.45, e.l.y + r * 1.45))
      ),
      defsFeuille(o) + defsLoupe(o)
    )
  }
}

const roue = (dents: number, rext: number, rint: number) => {
  const pts: string[] = []
  for (let i = 0; i < dents * 4; i++) {
    const a = (i / (dents * 4)) * TAU
    const r = i % 4 < 2 ? rext : rint
    pts.push(`${n(Math.cos(a) * r)} ${n(Math.sin(a) * r)}`)
  }
  return `M${pts.join('L')}z`
}

/**
 * Autre (4 s) : le poing tourne la manivelle du grand engrenage, qui entraine le petit (les yeux
 * suivent la poignee) ; un tour complet, puis une pastille verte s'allume, petit saut.
 */
const E_CENTRE = { x: 106, y: 114 }
const E_PETIT = { x: 140, y: 92 }
const E_MANIVELLE = 17
const engrenageEtat = (t: number) => {
  const u = mod(t, 4)
  const a = 360 * ease(clamp(u / 2.8))
  const ar = ((a - 90) * Math.PI) / 180
  const poignee = { x: E_CENTRE.x + E_MANIVELLE * Math.cos(ar), y: E_CENTRE.y + E_MANIVELLE * Math.sin(ar) }
  const ok = u >= 2.9 ? easings.easeOutCubic(clamp((u - 2.9) / 0.2)) * (1 - clamp((u - 3.6) / 0.3)) : 0
  const hop = cloche(clamp((u - 2.95) / 0.45))
  const effort = u < 2.8 ? Math.sin((a * Math.PI) / 180) : 0
  return { a, poignee, ok, hop, effort }
}
const engrenage: Accessoire = {
  id: 'engrenage',
  boucle: 4,
  geste: (t, go) => {
    const e = engrenageEtat(t)
    const vise = e.ok > 0.05 ? { x: E_PETIT.x, y: E_PETIT.y } : e.poignee
    return g({ ...vers(vise, go?.ancre), ...saut(e.hop), roll: 2 + 2 * e.effort })
  },
  dessin: (t, o) => {
    const e = engrenageEtat(t)
    const grand =
      `<g transform="translate(${E_CENTRE.x} ${E_CENTRE.y}) rotate(${n(e.a)})"><path d="${roue(8, 30, 23)}" fill="url(#${o.uid}eg)" stroke="url(#${o.uid}eg)" stroke-width="4" stroke-linejoin="round"/>` +
      `<circle r="9" fill="${O.papier}"/><circle r="9" fill="none" stroke="${O.grisOmbre}" stroke-width="2"/>` +
      `<rect x="-3" y="${-E_MANIVELLE}" width="6" height="${E_MANIVELLE}" rx="3" fill="${O.boisOmbre}"/></g>`
    const petit = o.simple
      ? ''
      : `<g transform="translate(${E_PETIT.x} ${E_PETIT.y}) rotate(${n(-e.a * 1.6 + 11)})"><path d="${roue(6, 17, 12)}" fill="url(#${o.uid}ep)" stroke="url(#${o.uid}ep)" stroke-width="3" stroke-linejoin="round"/>` +
        `<circle r="5" fill="${O.papier}"/></g>`
    return enveloppe(
      o,
      suivre(engrenage.geste(t), ombre(o, 110, 152, 46) + petit + grand + pastilleOk(E_PETIT.x, E_PETIT.y, e.ok, 10) + poing(o, e.poignee)),
      lin(`${o.uid}eg`, '#dcd7cf', O.grisOmbre, 1, 1) + lin(`${o.uid}ep`, '#e8c99e', O.boisOmbre, 1, 1)
    )
  }
}

export const ACCESSOIRES: Accessoire[] = [carnet, portable, clap, graphique, avion, palette, pressePapiers, liste, engrenage].map(
  (a): Accessoire => ({ ...a, geste: (t, o) => avecEchelle(a.geste(t, o), o) })
)

export const ACCESSOIRE_BY_ID = new Map(ACCESSOIRES.map((a) => [a.id, a]))

/**
 * Accessoire par metier (noms de metier usuels, en francais). L'application peut en passer
 * d'autres ; un metier inconnu prend l'engrenage.
 */
export const ACCESSOIRE_DE_METIER: Readonly<Record<string, AccessoireId>> = Object.freeze({
  redaction: 'carnet',
  guides: 'carnet',
  code: 'portable',
  dashboard: 'portable',
  scripts: 'portable',
  video: 'clap',
  analyse: 'graphique',
  publication: 'avion',
  da: 'palette',
  chef: 'presse-papiers',
  recherche: 'liste',
  seo: 'liste',
  sourcing: 'liste',
  qa: 'liste',
  verification: 'liste'
})

export const accessoireDuMetier = (metier: string | undefined | null): Accessoire =>
  ACCESSOIRE_BY_ID.get(ACCESSOIRE_DE_METIER[metier ?? ''] ?? 'engrenage')!

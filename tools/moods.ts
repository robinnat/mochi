import { BotEngine } from '../src/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '../src/bot/repere'
import { COLORS, SHAPES } from '../src/bot/skins'
import { Humeurs, MOODS, REACTIONS, type MoodId } from '../src/bot/humeurs'
import type { Selection } from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'
import type { Theme } from '../src/ui/trois/theme'
import { grillePixel } from '../src/ui/rendu'

/**
 * Rend une animation d'humeur ou d'interaction : trois Mochi cote a cote (formes, couleurs, styles
 * et accessoires varies, un en theme sombre). Meme chaine que le composant : `Humeurs.sample` ->
 * `BotEngine.sample(t, geste)` -> `rendreAvatar`. Chaque image est une fonction pure de `t` : les
 * evenements (tap, appui...) sont rejoues avec leurs dates, donc n'importe quelle image se rend seule.
 */
const q = new URLSearchParams(location.search)
const W = 1080
const H = 720
const FOND = '#f4f1ea'
const ENCRE = '#26222f'
const GRIS = '#8a8794'
const PAPIER = '#f9f9f9'
const CARTE = '#fffdf9'
const CARTE_SOMBRE = '#1b1922'

const hexDe = (id: string) => COLORS.find((c) => c.id === id)!.hex
const FORMES = ['etoile', 'cercle', 'squircle', 'goutte', 'hexagone', 'nuage', 'oeuf', 'triangle', 'fleur', 'capsule', 'galet']
const NOMS_FORMES: Record<string, string> = {
  cercle: 'rond', etoile: 'étoile', squircle: 'cube', nuage: 'nuage', triangle: 'pyramide', hexagone: 'hexagone',
  goutte: 'goutte', oeuf: 'œuf', fleur: 'fleur', capsule: 'capsule', galet: 'galet'
}
const COULEURS = ['turquoise', 'ambre', 'rose', 'bleu', 'violet', 'orange', 'vert', 'rouge', 'encre', 'turquoise', 'rose']
const STYLES: Array<{ nom: string; rendu: Rendu3d }> = [
  { nom: 'Soft', rendu: 'doux' },
  { nom: 'Flat', rendu: 'toon' },
  { nom: 'Pixel', rendu: 'pixel' }
]
const ACCESSOIRES: Selection[] = [
  { tete: 'casquette' },
  { yeux: 'rondes', bas: 'papillon' },
  {},
  { tete: 'toque' },
  { bas: 'echarpe' },
  { yeux: 'carrees' },
  { tete: 'bonnet', bas: 'papillon' },
  {},
  { dos: 'cape' },
  { tete: 'beret' },
  {}
]

interface Perso {
  forme: string
  couleur: string
  style: (typeof STYLES)[number]
  theme: Theme
  sel: Selection
}

/** La distribution d'une animation : 3 Mochi, tous differents, un en sombre ; couvre les 11 formes d'une animation a l'autre. */
function distribution(a: number): Perso[] {
  return [0, 1, 2].map((i) => {
    const n = a * 3 + i
    const forme = FORMES[n % FORMES.length]!
    return {
      forme,
      couleur: hexDe(COULEURS[(n * 3 + a) % COULEURS.length]!),
      style: STYLES[(i + a) % 3]!,
      theme: (i + a) % 3 === 1 ? 'dark' : 'light',
      sel: ACCESSOIRES[(n + 2) % ACCESSOIRES.length]!
    }
  })
}

/* ------------------------------------------------------------- scenario */

type Evt =
  | { t: number; i: number; type: 'react'; id: string }
  | { t: number; i: number; type: 'relacher' }
  | { t: number; i: number; type: 'regarder'; nx: number; ny: number }
  | { t: number; i: number; type: 'lacher' }

interface Anim {
  id: string
  groupe: 'humeur' | 'interaction'
  nom: string
  code: string
  duree: number
  /** date de l'image cle (planche) */
  cle: number
  mood: MoodId
  /** decalage de phase par Mochi (humeurs : ils ne bougent pas en bloc) */
  phase: number[]
  evts?: Evt[]
  /** angle de la vue 3D de chaque Mochi a la date t */
  yaw?: (i: number, t: number) => number
  visible?: (i: number, t: number) => boolean
  /** demi-largeur du cadre (grandes courses : sauts, chapeaux) ; defaut 150 */
  cadre?: number
  /** surimpression : curseur, doigts */
  incruste?: (c: CanvasRenderingContext2D, t: number, centres: Array<{ x: number; y: number }>) => void
}

const NOMS_HUMEURS: Record<string, string> = {
  repos: 'Repos', reflechit: 'Réfléchit', travaille: 'Travaille', attend: 'Attend Robin', termine: 'Terminé', bloque: 'Bloqué', dort: 'Dort'
}
const DUREES_HUMEURS: Record<string, number> = { repos: 4, reflechit: 4, travaille: 4, attend: 4, termine: 3, bloque: 3, dort: 4.6 }
const CLES_HUMEURS: Record<string, number> = { repos: 0.6, reflechit: 1.2, travaille: 0.55, attend: 0.9, termine: 0.95, bloque: 0.8, dort: 1.4 }

const ANIMS: Anim[] = []
for (const m of MOODS) {
  ANIMS.push({
    id: m.id, groupe: 'humeur', nom: NOMS_HUMEURS[m.id]!, code: `setMood('${m.id}')`,
    duree: DUREES_HUMEURS[m.id]!, cle: CLES_HUMEURS[m.id]!, mood: m.id, phase: [0, 0.37, 0.71], cadre: m.id === 'termine' ? 175 : undefined
  })
}

/* centres des trois cellules, pour les doigts et le curseur */
const COL = W / 3
const CY = 412
const centreDe = (i: number) => ({ x: COL * i + COL / 2, y: CY })

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lisse = (u: number) => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k) }
/** Trajet par cles [t, x, y] : lineaire adouci. */
function trajet(K: number[][], t: number): { x: number; y: number } | null {
  if (t < K[0]![0]! || t > K[K.length - 1]![0]!) return null
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i]![0]!) {
      const a = K[i - 1]!
      const b = K[i]!
      const k = lisse((t - a[0]!) / (b[0]! - a[0]!))
      return { x: lerp(a[1]!, b[1]!, k), y: lerp(a[2]!, b[2]!, k) }
    }
  }
  return null
}

function curseur(c: CanvasRenderingContext2D, x: number, y: number, appuye = false) {
  c.save()
  c.translate(x, y)
  c.scale(appuye ? 0.92 : 1, appuye ? 0.92 : 1)
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(0, 30)
  c.lineTo(8, 23)
  c.lineTo(13, 35)
  c.lineTo(19, 32)
  c.lineTo(14, 21)
  c.lineTo(24, 21)
  c.closePath()
  c.fillStyle = '#fff'
  c.strokeStyle = '#1b1922'
  c.lineWidth = 2.5
  c.lineJoin = 'round'
  c.fill()
  c.stroke()
  c.restore()
}

const R = RAYON
// la boule fait RAYON unites sur un cadre de DEMI_VIEWBOX : en pixels, avec une cellule de 340 px
const PX = 340
let CADRE = 150
const rayonPx = (R / CADRE) * (PX / 2)

/* --- survol : un curseur qui traverse les trois cellules */
const CURSEUR: number[][] = [
  [0.0, 90, 640], [0.7, 250, 470], [1.2, 400, 330], [1.6, 330, 300], [2.0, 480, 480],
  [2.6, 720, 330], [3.0, 780, 250], [3.5, 960, 470], [4.0, 1010, 600], [4.4, 1070, 700]
]
const evtsSurvol: Evt[] = []
for (let k = 0; k <= 4.4 * 24; k++) {
  const t = k / 24
  const p = trajet(CURSEUR, t)
  for (let i = 0; i < 3; i++) {
    const c = centreDe(i)
    const sur = p && Math.abs(p.x - c.x) < COL / 2 && Math.abs(p.y - c.y) < 300
    if (sur && p) evtsSurvol.push({ t, i, type: 'regarder', nx: Math.max(-1, Math.min(1, (p.x - c.x) / (PX * 0.6))), ny: Math.max(-1, Math.min(1, (p.y - c.y) / (PX * 0.6))) })
    else evtsSurvol.push({ t, i, type: 'lacher' })
  }
}
ANIMS.push({
  id: 'survol', groupe: 'interaction', nom: 'Survol', code: 'pointer over : le regard suit', duree: 4.4, cle: 1.4, mood: 'repos',
  phase: [0, 0.4, 0.8], evts: evtsSurvol,
  incruste: (c, t) => { const p = trajet(CURSEUR, t); if (p) curseur(c, p.x, p.y) }
})

/* --- tap : un doigt par Mochi, a tour de role */
const TAPS = [0.7, 1.7, 2.7]
/** Le curseur arrive en bas a droite du corps, appuie, repart : un clic, ou un doigt tenu pour l'appui long. */
const doigtsTaps = (decal: number[], longs?: number[][]) => (c: CanvasRenderingContext2D, t: number) => {
  for (let i = 0; i < 3; i++) {
    const ct = centreDe(i)
    const x = ct.x + 38
    const y = ct.y + 52
    if (longs) {
      const [a, b] = longs[i]!
      if (t >= a - 0.25 && t < a) curseur(c, x + (a - t) * 160, y + (a - t) * 160)
      else if (t >= a && t <= b) curseur(c, x, y, true)
      else if (t > b && t < b + 0.25) curseur(c, x + (t - b) * 160, y + (t - b) * 160)
    } else {
      const a = decal[i]!
      if (t >= a - 0.2 && t < a) curseur(c, x + (a - t) * 160, y + (a - t) * 160)
      else if (t >= a && t < a + 0.12) curseur(c, x, y, true)
      else if (t >= a + 0.12 && t < a + 0.3) curseur(c, x + (t - a - 0.12) * 160, y + (t - a - 0.12) * 160)
    }
  }
}
ANIMS.push({
  id: 'tap', groupe: 'interaction', nom: 'Tap ou clic', code: 'tap : sursaut, écrasement, rebond', duree: 3.6, cle: TAPS[1]! + 0.1, mood: 'repos', cadre: 165,
  phase: [0, 0.4, 0.8],
  evts: TAPS.map((t, i) => ({ t, i, type: 'react', id: 'sursaut' }) as Evt),
  incruste: doigtsTaps(TAPS)
})

/* --- double tap */
const DOUBLES = [0.6, 1.75, 2.9]
ANIMS.push({
  id: 'double', groupe: 'interaction', nom: 'Double tap', code: 'double tap : il rigole', duree: 4.7, cle: DOUBLES[1]! + 0.7, mood: 'repos', cadre: 165,
  phase: [0, 0.4, 0.8],
  evts: DOUBLES.flatMap((t, i): Evt[] => [
    { t, i, type: 'react', id: 'sursaut' },
    { t: t + 0.25, i, type: 'react', id: 'rigole' }
  ]),
  incruste: (c, t) => {
    doigtsTaps(DOUBLES)(c, t)
    doigtsTaps(DOUBLES.map((d) => d + 0.25))(c, t)
  }
})

/* --- longue pression */
const APPUIS = [[0.3, 2.5], [0.55, 2.75], [0.8, 3.0]]
ANIMS.push({
  id: 'longue', groupe: 'interaction', nom: 'Longue pression', code: 'long press : il rougit, content', duree: 4.4, cle: 2.0, mood: 'repos',
  phase: [0, 0.4, 0.8],
  evts: APPUIS.flatMap(([a, b], i): Evt[] => [
    { t: a! + 0.45, i, type: 'react', id: 'rougit' },
    { t: b!, i, type: 'relacher' }
  ]),
  incruste: doigtsTaps([], APPUIS)
})

/* --- secoue : la vue 3D tourne tres vite, puis il est etourdi */
const TOURS = [0.5, 0.68, 0.86]
ANIMS.push({
  id: 'secoue', groupe: 'interaction', nom: 'Secoué ou tourné vite', code: 'drag rapide : étourdi', duree: 4.2, cle: 2.1, mood: 'repos',
  phase: [0, 0.4, 0.8],
  evts: TOURS.map((s, i) => ({ t: s + 0.62, i, type: 'react', id: 'etourdi' }) as Evt),
  yaw: (i, t) => {
    const u = (t - TOURS[i]!) / 1.0
    return Math.PI * 4 * (1 - (1 - Math.max(0, Math.min(1, u))) ** 3)
  }
})

/* --- coucou : ils apparaissent l'un apres l'autre */
const ARRIVEES = [0.25, 0.65, 1.05]
ANIMS.push({
  id: 'coucou', groupe: 'interaction', nom: 'Coucou', code: 'à l’apparition : petit salut', duree: 3.4, cle: 1.45, mood: 'repos', cadre: 175,
  phase: [0, 0.4, 0.8],
  evts: ARRIVEES.map((t, i) => ({ t, i, type: 'react', id: 'coucou' }) as Evt),
  visible: (i, t) => t >= ARRIVEES[i]!
})

const REACTION_NOMS = REACTIONS.map((r) => r.id)
void REACTION_NOMS

/* ------------------------------------------------------------- rendu */

let rendreAvatar: typeof import('../src/ui/trois/scene3d').rendreAvatar
const moteurs = new Map<string, BotEngine>()
function moteur(forme: string) {
  let e = moteurs.get(forme)
  if (!e) {
    e = new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === forme)!.radii, null)
    moteurs.set(forme, e)
  }
  return e
}

function humeursDe(a: Anim, i: number): Humeurs {
  const h = new Humeurs(a.mood)
  return h
}

/** Les evenements de Mochi `i` jusqu'a la date `t` (decalee de la phase), rejoues dans l'ordre. */
function appliquer(a: Anim, i: number, h: Humeurs, t: number) {
  for (const e of a.evts ?? []) {
    if (e.i !== i || e.t > t + 1e-9) continue
    const d = e.t + a.phase[i]!
    if (e.type === 'react') h.react(e.id, d)
    else if (e.type === 'relacher') h.relacher(d)
    else if (e.type === 'regarder') h.regarder({ nx: e.nx, ny: e.ny }, d)
    else h.regarder(null, d)
  }
}

function dessinerCarte(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sombre: boolean) {
  c.beginPath()
  c.roundRect(x, y, w, h, 28)
  c.fillStyle = sombre ? CARTE_SOMBRE : CARTE
  c.fill()
}

function texte(c: CanvasRenderingContext2D, s: string, x: number, y: number, taille: number, couleur = ENCRE, gras = false, align: CanvasTextAlign = 'left', mono = false) {
  c.font = `${gras ? '700' : '500'} ${taille}px ${mono ? 'ui-monospace, Menlo, monospace' : '-apple-system, Helvetica, Arial, sans-serif'}`
  c.fillStyle = couleur
  c.textAlign = align
  c.textBaseline = 'alphabetic'
  c.fillText(s, x, y)
}

const tuile = document.createElement('canvas')

/** Un Mochi a la date `t`, dans la cellule `i` du canevas `c`. */
function mochi(c: CanvasRenderingContext2D, a: Anim, i: number, p: Perso, t: number, x0: number, y0: number, taille: number) {
  const h = humeursDe(a, i)
  appliquer(a, i, h, t)
  const ts = t + a.phase[i]!
  const geste = h.sample(ts)
  const frame = moteur(p.forme).sample(ts, geste)
  const pixel = p.style.rendu === 'pixel'
  tuile.width = tuile.height = pixel ? Math.round((grillePixel('fin') * CADRE) / DEMI_VIEWBOX) : taille
  const yaw = a.yaw ? a.yaw(i, t) : 0
  rendreAvatar(tuile, frame, p.couleur, PAPIER, p.style.rendu, false, 'marque', true, p.forme, yaw, null, p.sel, CADRE, p.theme)
  c.imageSmoothingEnabled = !pixel
  c.drawImage(tuile, x0, y0, taille, taille)
  c.imageSmoothingEnabled = true
}

/** Une image de l'animation, a la date `t`. */
function image(a: Anim, t: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = FOND
  c.fillRect(0, 0, W, H)
  CADRE = a.cadre ?? 150
  const casting = distribution(ANIMS.indexOf(a))
  texte(c, a.groupe === 'humeur' ? 'HUMEUR' : 'INTERACTION', 44, 58, 22, GRIS, true)
  texte(c, a.nom, 44, 112, 54, ENCRE, true)
  texte(c, a.code, W - 44, 112, 26, GRIS, false, 'right', true)
  casting.forEach((p, i) => {
    const cx = COL * i
    dessinerCarte(c, cx + 14, 150, COL - 28, 524, p.theme === 'dark')
    if (!a.visible || a.visible(i, t)) mochi(c, a, i, p, t, cx + (COL - PX) / 2, CY - PX / 2 - 12, PX)
    texte(c, `${NOMS_FORMES[p.forme]} · ${p.style.nom} · ${p.theme === 'dark' ? 'sombre' : 'clair'}`, cx + COL / 2, 650, 21, p.theme === 'dark' ? '#cfcad8' : GRIS, false, 'center')
  })
  a.incruste?.(c, t, [0, 1, 2].map(centreDe))
  return cv
}

/** Planche : une image cle par animation, un Mochi chacune. */
function planche(): HTMLCanvasElement {
  const colonnes = 4
  const cell = 400
  const lignes = Math.ceil(ANIMS.length / colonnes)
  const cv = document.createElement('canvas')
  cv.width = colonnes * cell
  cv.height = 150 + lignes * (cell + 30) + 10
  const c = cv.getContext('2d')!
  c.fillStyle = FOND
  c.fillRect(0, 0, cv.width, cv.height)
  texte(c, 'Mochi : humeurs et interactions', 40, 76, 52, ENCRE, true)
  texte(c, '7 humeurs jouées en boucle, 6 interactions déclenchées par l’utilisateur. Une image clé chacune ; les vidéos montrent le mouvement.', 40, 118, 24, GRIS)
  ANIMS.forEach((a, k) => {
    const x = (k % colonnes) * cell
    const y = 150 + Math.floor(k / colonnes) * (cell + 30)
    const casting = distribution(k)
    // le Mochi du milieu, sauf en Pixel (ses yeux de 3 cases ne montrent ni croissant ni inclinaison) :
    // l'image cle montre alors le Soft ou le Flat du meme tirage ; les videos gardent les trois styles
    const i = [1, 0, 2].find((n) => casting[n]!.style.nom !== 'Pixel') ?? 1
    const p = casting[i]!
    const ch = cell - 40
    dessinerCarte(c, x + 14, y, cell - 28, ch, p.theme === 'dark')
    // le Mochi est rendu sur 360 px, centre dans sa carte (le clip garde les grands chapeaux dans la carte)
    const px = 360
    c.save()
    c.beginPath()
    c.roundRect(x + 14, y, cell - 28, ch, 28)
    c.clip()
    mochi(c, a, i, p, a.cle, x + (cell - px) / 2, y + (ch - px) / 2 + 6, px)
    c.restore()
    texte(c, a.nom, x + cell / 2, y + ch + 34, 28, ENCRE, true, 'center')
  })
  return cv
}

async function envoyer(nom: string, c: HTMLCanvasElement, type = 'image/jpeg') {
  const dest = q.get('save')
  if (!dest) return
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), type, 0.95))
  await fetch(`${dest}?name=${encodeURIComponent(nom)}`, { method: 'POST', body: blob })
}

async function main() {
  ;({ rendreAvatar } = await import('../src/ui/trois/scene3d'))
  if (q.get('planche')) {
    const c = planche()
    await envoyer('moods.png', c, 'image/png')
    const dest = q.get('save')
    if (dest) await fetch(`${dest}?name=DONE-planche`, { method: 'POST', body: 'ok' })
    if (!q.get('save')) document.body.appendChild(c)
    document.title = 'fini'
    return
  }
  const a = ANIMS.find((x) => x.id === q.get('anim'))
  if (!a) throw new Error('anim inconnue : ' + q.get('anim'))
  const fps = Number(q.get('fps') ?? 24)
  const n = Math.round(a.duree * fps)
  const seul = q.get('t')
  if (seul) {
    const c = image(a, Number(seul))
    await envoyer(`${a.id}/t.png`, c, 'image/png')
    const dest = q.get('save')
    if (dest) await fetch(`${dest}?name=${encodeURIComponent(a.id + '/DONE')}`, { method: 'POST', body: 'ok' })
    if (!q.get('save')) document.body.appendChild(c)
    document.title = 'fini'
    return
  }
  for (let k = 0; k < n; k++) {
    const c = image(a, k / fps)
    await envoyer(`${a.id}/f${String(k).padStart(4, '0')}.jpg`, c)
    if (!q.get('save') && k === 0) document.body.appendChild(c)
  }
  const dest = q.get('save')
  if (dest) await fetch(`${dest}?name=${encodeURIComponent(a.id + '/DONE')}`, { method: 'POST', body: 'ok' })
  document.title = 'fini'
}

main().catch((e) => {
  document.title = 'erreur ' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})

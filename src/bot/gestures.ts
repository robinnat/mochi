/**
 * Couche de gestes : de petites animations AJOUTEES par-dessus la pose du moteur.
 *
 * Le moteur reproduit la video de reference : ses constantes sont des mesures. Les gestes,
 * eux, sont des REGLAGES choisis (pas des mesures), facultatifs, et rangés a part pour ne
 * rien changer au rendu d'origine : `engine.sample(t)` sans geste reste identique a l'octet
 * pres (un test le verrouille). Usage : `engine.sample(t, idleGesture(t, seed))`.
 *
 * Tout est pur, fonction du temps et d'une graine : meme image a chaque lecture, aucun etat,
 * aucune horloge. Les amplitudes sont faibles (quelques pour cent du rayon) : un avatar qui
 * attend reste calme ; c'est la variete et le decalage dans le temps qui font la personnalite.
 */
import { TAU, clamp, createRng, easings, loopNoise } from './math'
import type { BotExpression } from './expressions'
import type { StateId } from './states'

/** Ecarts appliques par `sample()` : deplacements en rayons de boule, echelles, angles en degres. */
export interface Gesture {
  /** deplacement du corps et des yeux, en rayons */
  dx: number
  dy: number
  /** echelles du corps (1 = inchange) */
  sx: number
  sy: number
  /** ecarts de visee, en degres */
  yaw: number
  pitch: number
  roll: number
  /** paupiere maximale : 1 = laisse faire le moteur, 0 = fermee */
  lid: number
  /*
   * Couche VISAGE (humeurs, `moods.ts`). Tout est facultatif et ABSENT du geste neutre : un geste
   * qui n'y touche pas rend la meme image qu'avant, a l'octet pres.
   */
  /** visage absolu : remplace les yeux et leur ecart (la visee reste celle du moteur) */
  exp?: BotExpression
  /** multiplicateurs de largeur et de hauteur des yeux (1 = inchange) */
  ew?: number
  eh?: number
  /** inclinaison ajoutee, en degres, EN MIROIR entre les deux yeux (positif = les hauts convergent) */
  tilt?: number
  /** 0 = gelule, 1 = croissant ouvert vers le bas (oeil content) */
  arc?: number
  /** decalage des yeux dans le plan du visage, en rayons (regard) */
  ex?: number
  ey?: number
  /** teinte des joues, 0 a 1 */
  cheeks?: number
  /** inclinaison du corps ET du visage, en degres, positif = vers la droite (tete penchee) */
  rot?: number
}

export const NEUTRAL_GESTURE: Readonly<Gesture> = Object.freeze({ dx: 0, dy: 0, sx: 1, sy: 1, yaw: 0, pitch: 0, roll: 0, lid: 1 })

const g = (p: Partial<Gesture>): Gesture => ({ ...NEUTRAL_GESTURE, ...p })

/** Compose deux gestes : deplacements et angles s'ajoutent, echelles se multiplient, paupiere au plus fermee. */
export function composer(a: Gesture, b: Gesture): Gesture {
  const out: Gesture = {
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    sx: a.sx * b.sx,
    sy: a.sy * b.sy,
    yaw: a.yaw + b.yaw,
    pitch: a.pitch + b.pitch,
    roll: a.roll + b.roll,
    lid: Math.min(a.lid, b.lid)
  }
  // couche visage : seulement si l'un des deux la porte
  const exp = b.exp ?? a.exp
  if (exp) out.exp = exp
  for (const k of ['ew', 'eh'] as const) if (a[k] !== undefined || b[k] !== undefined) out[k] = (a[k] ?? 1) * (b[k] ?? 1)
  for (const k of ['tilt', 'ex', 'ey', 'rot'] as const) if (a[k] !== undefined || b[k] !== undefined) out[k] = (a[k] ?? 0) + (b[k] ?? 0)
  for (const k of ['arc', 'cheeks'] as const) if (a[k] !== undefined || b[k] !== undefined) out[k] = Math.max(a[k] ?? 0, b[k] ?? 0)
  return out
}

/** true si le geste porte une part de la couche visage. */
export const hasFace = (g: Gesture) =>
  g.exp !== undefined || g.ew !== undefined || g.eh !== undefined || g.tilt !== undefined || g.arc !== undefined ||
  g.ex !== undefined || g.ey !== undefined || g.cheeks !== undefined || g.rot !== undefined

/** Cloche 0 -> 1 -> 0 sur [0, 1], douce aux deux bouts. */
const cloche = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2)

// ---------------------------------------------------------------- gestes d'attente

export type IdleGestureId = 'blinks' | 'breathe' | 'jump' | 'balance' | 'gaze' | 'nod' | 'stretched'

interface GestureDef {
  id: IdleGestureId
  /** duree en secondes */
  duration: number
  /** pose a l'instant local u (secondes depuis le debut du geste) */
  pose: (u: number) => Gesture
}

export const IDLE_GESTURES: GestureDef[] = [
  // double clignement appuye
  {
    id: 'blinks',
    duration: 0.55,
    pose: (u) => {
      const k = (v: number) => (v < 0 || v > 0.18 ? 1 : Math.abs((v / 0.18) * 2 - 1))
      return g({ lid: Math.min(k(u), k(u - 0.3)) })
    }
  },
  // grande inspiration : le corps gonfle un peu puis se relache
  { id: 'breathe', duration: 2.2, pose: (u) => { const c = cloche(u / 2.2); return g({ sx: 1 + 0.025 * c, sy: 1 + 0.04 * c, dy: -0.015 * c, pitch: -3 * c }) } },
  // petit saut : tassement, envol, reception
  {
    id: 'jump',
    duration: 0.9,
    pose: (u) => {
      const v = u / 0.9
      const tasse = v < 0.2 ? cloche(v / 0.4) : v > 0.8 ? cloche((v - 0.8) / 0.4 + 0.5) : 0
      const flight = v >= 0.15 && v <= 0.85 ? Math.sin(Math.PI * ((v - 0.15) / 0.7)) : 0
      return g({ dy: -0.12 * flight, sx: 1 + 0.05 * tasse, sy: 1 - 0.07 * tasse + 0.03 * flight })
    }
  },
  // balancement lateral, deux allers-retours
  { id: 'balance', duration: 2.4, pose: (u) => { const e = cloche(u / 2.4); const s = Math.sin((u / 1.2) * TAU); return g({ dx: 0.035 * s * e, roll: 6 * s * e }) } },
  // regard a gauche puis a droite
  {
    id: 'gaze',
    duration: 2.6,
    pose: (u) => {
      const v = u / 2.6
      const yaw = v < 0.5 ? -22 * cloche(v / 0.5) : 22 * cloche((v - 0.5) / 0.5)
      return g({ yaw, dx: yaw * 0.0006 })
    }
  },
  // hochement de tete
  { id: 'nod', duration: 1.2, pose: (u) => { const e = cloche(u / 1.2); return g({ pitch: 9 * Math.sin((u / 0.4) * TAU) * e, dy: 0.01 * e }) } },
  // etirement vers le haut
  { id: 'stretched', duration: 1.6, pose: (u) => { const c = cloche(u / 1.6); return g({ sx: 1 - 0.035 * c, sy: 1 + 0.06 * c, dy: -0.03 * c, lid: 1 - 0.5 * c }) } }
]

export const IDLE_GESTURE_BY_ID = new Map(IDLE_GESTURES.map((d) => [d.id, d]))

/** Calendrier : un geste par fenetre de `WINDOW` s, a un decalage tire dans [0, JEU[ -> 4 a 12 s d'ecart. */
const WINDOW = 8
const SET = 4

/** Trois gestes preferes par graine (la personnalite), un quatrieme plus rare. */
export function personality(seed: number): IdleGestureId[] {
  const rng = createRng(seed ^ 0x9e3779b9)
  const ids = IDLE_GESTURES.map((d) => d.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  }
  return ids.slice(0, 4)
}

/** Geste de la fenetre `k` pour une graine : date de debut et identifiant. O(1), sans etat. */
export function gestureOfWindow(seed: number, k: number): { start: number; id: IdleGestureId } {
  const rng = createRng(Math.imul(seed | 0, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35))
  const prefs = personality(seed)
  const r = rng()
  // poids 0,35 / 0,3 / 0,25 / 0,1 : les gestes preferes reviennent plus souvent
  const id = r < 0.35 ? prefs[0]! : r < 0.65 ? prefs[1]! : r < 0.9 ? prefs[2]! : prefs[3]!
  return { start: k * WINDOW + rng() * SET, id }
}

/** Geste d'attente a l'instant t : neutre entre deux gestes. Le premier geste arrive apres 4 s au moins. */
export function idleGesture(t: number, seed: number): Gesture {
  if (!(t >= 0)) return { ...NEUTRAL_GESTURE }
  const k = Math.floor(t / WINDOW)
  for (const kk of [k, k - 1]) {
    if (kk < 0) continue
    const { start, id } = gestureOfWindow(seed, kk)
    if (kk === 0 && start < 4) continue
    const def = IDLE_GESTURE_BY_ID.get(id)!
    const u = t - start
    if (u >= 0 && u <= def.duration) return def.pose(u)
  }
  return { ...NEUTRAL_GESTURE }
}

// ---------------------------------------------------------------- rebond au toucher

/** Duree du rebond au toucher. */
export const BOUNCE_DURATION = 0.7

/** Rebond quand on touche l'avatar : ecrasement puis petit ressort amorti (u : secondes depuis le toucher). */
export function bounce(u: number): Gesture {
  if (!(u >= 0) || u > BOUNCE_DURATION) return { ...NEUTRAL_GESTURE }
  const v = u / BOUNCE_DURATION
  const damped = Math.exp(-4.5 * v) * Math.cos(v * TAU * 1.6)
  return g({ sx: 1 + 0.07 * damped, sy: 1 - 0.09 * damped, dy: 0.02 * Math.max(0, damped) - 0.05 * cloche(v / 0.6) })
}

// ---------------------------------------------------------------- sommeil et echec

/** Sommeil : respiration lente et profonde, yeux fermes, corps un peu tasse. */
export function sleepGesture(t: number): Gesture {
  const breath = 0.5 - 0.5 * Math.cos((t / 4.6) * TAU)
  return g({ sx: 1 + 0.012 * breath, sy: 0.97 + 0.03 * breath, dy: 0.02 - 0.012 * breath, pitch: -6, roll: -4, lid: 0.04 })
}

/** Petits « z » du sommeil : positions en rayons (a dessiner par le client), qui montent et s'effacent. */
export function sleepZ(t: number, n = 2): Array<{ x: number; y: number; size: number; opacite: number }> {
  const out = []
  const period = 3.2
  for (let i = 0; i < n; i++) {
    const v = (((t / period + i / n) % 1) + 1) % 1
    out.push({
      x: 0.62 + 0.18 * v + 0.04 * Math.sin(v * TAU),
      y: -0.55 - 0.45 * v,
      size: 0.16 + 0.1 * v,
      opacite: clamp(v / 0.2) * clamp((1 - v) / 0.35) * 0.8
    })
  }
  return out
}

/** Echec : affaissement, tete basse, soupir lent. */
export function gestureFailure(t: number): Gesture {
  const sigh = 0.5 - 0.5 * Math.cos((t / 5.2) * TAU)
  return g({ sx: 1.03 + 0.01 * sigh, sy: 0.94 - 0.015 * sigh, dy: 0.04 + 0.01 * sigh, pitch: -8 - 3 * sigh, roll: 3 })
}

// ---------------------------------------------------------------- activites (au travail)

export type ActivityId = 'reflection' | 'frappe' | 'sweep'

export interface Activity {
  id: ActivityId
  /** etat du moteur joue en boucle */
  state: StateId
  /** duree de la boucle en secondes : on lit `sample(startPos + t % loop)` */
  loop: number
  /** geste ajoute, fonction du temps global */
  gesture: (t: number) => Gesture
}

/**
 * Activites « au travail » : chacune reste lisible comme un travail en cours (un etat du moteur
 * ou un regard occupe), mais se distingue des autres. L'application choisit laquelle
 * correspond a quel role.
 */
export const ACTIVITIES: Activity[] = [
  // trois points qui pulsent, avec un leger hochement : il ecrit ou il reflechit
  { id: 'reflection', state: 'thinking', loop: 2.6, gesture: (t) => g({ dy: 0.012 * Math.sin((t / 1.3) * TAU) }) },
  // petites frappes rapides, regard baisse vers le clavier
  {
    id: 'frappe',
    state: 'idle',
    loop: 2.4,
    gesture: (t) => {
      const tap = Math.max(0, Math.sin((t / 0.22) * TAU)) * (0.6 + 0.4 * Math.sin((t / 1.7) * TAU) ** 2)
      // amplitude choisie pour rester visible a 48 px (une frappe = 3 % du rayon)
      return g({ pitch: 16, yaw: 7 * loopNoise(t, 3.1, 0.5), dy: 0.03 * tap, sx: 1 + 0.015 * tap, sy: 1 - 0.03 * tap })
    }
  },
  // lecture : le regard balaie de gauche a droite, ligne apres ligne
  {
    id: 'sweep',
    state: 'idle',
    loop: 2.4,
    gesture: (t) => {
      const v = (t / 1.6) % 1
      const yaw = v < 0.8 ? -18 + 36 * easings.easeInOutCubic(v / 0.8) : 18 - 36 * easings.easeOutCubic((v - 0.8) / 0.2)
      const row = Math.floor(t / 1.6) % 3
      return g({ yaw, pitch: 4 + row * 4, dx: yaw * 0.0005 })
    }
  }
]

export const ACTIVITY_BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]))

/** Instant a lire dans le moteur pour une activite : boucle sans couture, decalee par une graine. */
export function timeActivity(a: Activity, t: number, startPos = 0.6): number {
  return startPos + (((t % a.loop) + a.loop) % a.loop)
}

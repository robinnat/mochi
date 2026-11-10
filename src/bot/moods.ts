/**
 * Humeurs et interactions : une couche d'animation du VISAGE et du CORPS, ajoutee par-dessus le
 * moteur (comme `gestures.ts`, dont elle reprend le type `Gesture`).
 *
 * - une HUMEUR est un etat de travail joue en boucle : repos, reflechit, travaille, attend,
 *   termine, bloque, dort. Elle fixe un visage (une des expressions de `expressions.ts`, ou une
 *   variante proche) et des ecarts de corps et de regard qui bougent dans le temps ;
 * - une REACTION est declenchee par l'utilisateur (tap, double tap, appui long, secousse,
 *   arrivee), joue une fois par-dessus l'humeur, puis rend la main : l'humeur reprend sans saut ;
 * - le SURVOL n'est pas un evenement mais un suivi : les yeux regardent le pointeur.
 *
 * Seulement le visage et le corps : aucune etoile, point d'exclamation, orbite ou particule.
 *
 * Ce module n'a ni framework ni horloge : toutes les dates entrent en parametre, et `sample(now)`
 * est une fonction de cet etat date, comme `BotEngine.setLook`. Les ecarts rendus (`Gesture`) sont
 * appliques par `engine.sample(t, gesture)`, donc les accessoires, qui lisent le corps rendu, suivent
 * toutes les deformations.
 */
import { EXPRESSION_BY_ID, blendExpression, type BotExpression } from './expressions'
import { composer, NEUTRAL_GESTURE, sleepGesture, type Gesture } from './gestures'
import { TAU, clamp, easings, lerp, loopNoise } from './math'
import type { EyeCfg } from './states'

/* ------------------------------------------------------------------ outils */

const smooth = (u: number) => {
  const k = clamp(u)
  return k * k * (3 - 2 * k)
}

/** Interpolation douce entre des cles `[date, ...values]` triees par date. */
function keys(u: number, K: number[][]): number[] {
  if (u <= K[0]![0]!) return K[0]!.slice(1)
  for (let i = 1; i < K.length; i++) {
    const b = K[i]!
    if (u <= b[0]!) {
      const a = K[i - 1]!
      const k = smooth((u - a[0]!) / (b[0]! - a[0]!))
      return b.slice(1).map((v, j) => lerp(a[j + 1]!, v, k))
    }
  }
  return K[K.length - 1]!.slice(1)
}

const g = (p: Partial<Gesture>): Gesture => ({ ...NEUTRAL_GESTURE, ...p })

/** Le corps repose sur le sol : quand il s'ecrase, son centre descend d'autant. */
const ground = (sy: number) => (1 - sy) * 0.92

/** Duree de la pousse du coucou, en secondes (le Mochi grandit depuis le sol avant de saluer). */
export const WAVE_PUSH = 0.5
/** Echelle de la pousse a la date `t` (secondes depuis le debut du coucou) : ~3 % -> ~107 % -> 100 %, ease-out avec rebond. */
export function waveScale(t: number): number {
  const x = clamp(t / WAVE_PUSH)
  const c1 = 1.4
  const c3 = c1 + 1
  const back = 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2 // easeOutBack : 0 -> ~1,07 -> 1
  return 0.03 + 0.97 * back
}

const eye = (w: number, h: number, tilt = 0, open = 1): EyeCfg => ({ w, h, tilt, open })
const pair = (w: number, h: number, tilt = 0): [EyeCfg, EyeCfg] => [eye(w, h, tilt), eye(w, h, -tilt)]
const face = (id: BotExpression['id'], yaw: number, pitch: number, roll: number, split: number, eyes: [EyeCfg, EyeCfg]): BotExpression => ({
  id,
  gaze: { yaw, pitch, roll },
  split,
  eyes
})
const expr = (id: BotExpression['id']) => EXPRESSION_BY_ID.get(id)!

/** Un clignement net a la date `d` (deux images a 12 i/s), 1 = ouvert. */
const blinks = (u: number, d: number, duration = 0.2) => {
  const k = (u - d) / duration
  return k < 0 || k > 1 ? 1 : k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
}

/* ------------------------------------------------------------------ humeurs */

export type MoodId = 'idle' | 'thinking' | 'working' | 'waiting' | 'done' | 'blocked' | 'asleep'

export interface MoodDef {
  id: MoodId
  /** nom des etats existants dont elle prolonge le sens (`states.ts`) */
  state: string
  /** duree de la boucle, en secondes : la fin retombe sur le debut */
  period: number
  /** visage de base (une expression de `expressions.ts` ou une variante) */
  expression: BotExpression
  /** ecarts a la date locale `u` (secondes depuis le debut de la boucle) */
  pose: (u: number) => Gesture
  /** date ou la pose est la plus lisible : image fixe sous `prefers-reduced-motion`, vignettes */
  signature: number
}

/** Les yeux horizontaux d'un oeil content : le croissant vient de `arc`, pas de la forme. */
const CRESCENT = face('happy', 5, 9, 0, 17, pair(0.42, 0.17, 0))

export const MOODS: MoodDef[] = [
  {
    // respiration douce, clignements, regard qui se promene
    id: 'idle',
    state: 'idle',
    period: 4,
    expression: expr('neutral'),
    signature: 0.6,
    pose: (u) => {
      const breath = 0.5 - 0.5 * Math.cos((u / 4) * TAU)
      return g({
        sx: 1 - 0.012 * breath,
        sy: 1 + 0.026 * breath,
        dy: -0.02 * breath,
        lid: Math.min(blinks(u, 1.15), blinks(u, 2.9), blinks(u, 3.15)),
        ex: 0.075 * loopNoise(u, 4, 0.4),
        ey: 0.035 * loopNoise(u, 4, 2.2)
      })
    }
  },
  {
    // regard en l'air, yeux plisses, un oeil plus ferme que l'autre
    id: 'thinking',
    state: 'thinking',
    period: 4,
    expression: face('suspicious', 6, 6, 0, 16, [eye(0.27, 0.27, 10), eye(0.27, 0.19, -10)]),
    signature: 1.2,
    pose: (u) => {
      const v = (u / 4) * TAU
      const [rot, ex] = keys(u, [
        [0, 2, -0.09],
        [1.1, 5, 0.09],
        [2.3, 2, 0.1],
        [3.2, 5, -0.05],
        [4, 2, -0.09]
      ]) as [number, number]
      return g({
        ex,
        ey: -0.115 + 0.012 * Math.sin(v),
        rot,
        dy: -0.012 * (0.5 - 0.5 * Math.cos(v)),
        sy: 1 + 0.012 * Math.sin(v),
        lid: blinks(u, 3.3)
      })
    }
  },
  {
    // concentre : le regard lit ligne apres ligne, petits rebonds reguliers
    id: 'working',
    state: 'idle',
    period: 4,
    expression: face('attentive', 4, 5, 0, 16, [eye(0.22, 0.34, 5), eye(0.22, 0.34, -5)]),
    signature: 0.55,
    pose: (u) => {
      // une ligne par seconde : balayage de gauche a droite, retour vif
      const v = u % 1
      const bal = v < 0.82 ? smooth(v / 0.82) : 1 - smooth((v - 0.82) / 0.18)
      // la ligne descend puis remonte (0, 1, 2, 1) : la boucle se raccorde, sans retour brusque
      const rang = [0, 1, 2, 1]
      const k = Math.floor(u) % 4
      const row = lerp(rang[k]!, rang[(k + 1) % 4]!, smooth((v - 0.82) / 0.18))
      // rebond toutes les 0,5 s : ecrasement bref puis petit saut
      const p = (u % 0.5) / 0.5
      const jump = Math.sin(Math.PI * p)
      // l'impact tombe pile sur la jointure : le creux monte avant et redescend apres, sans marche
      const hollow = p < 0.12 ? 1 - p / 0.12 : p > 0.88 ? (p - 0.88) / 0.12 : 0
      const sy = 1 + 0.03 * jump - 0.045 * hollow
      return g({
        ex: -0.095 + 0.19 * bal,
        ey: 0.05 + 0.018 * row,
        dy: -0.04 * jump + ground(sy) * 0.6,
        sy,
        sx: 1 / Math.sqrt(sy),
        lid: blinks(u, 2.4)
      })
    }
  },
  {
    // attend Robin : regard droit devant, tete penchee, un peu impatient
    id: 'waiting',
    state: 'wide',
    period: 4,
    expression: face('attentive', 0, 0, 0, 16.5, [eye(0.25, 0.5, 0), eye(0.25, 0.5, 0)]),
    signature: 0.9,
    pose: (u) => {
      // deux petits tapotements de pied, puis un coup d'oeil sur le cote et retour
      const tap = (d: number) => (u >= d && u < d + 0.3 ? Math.sin(Math.PI * ((u - d) / 0.3)) : 0)
      const t = Math.max(tap(1.2), tap(1.6))
      const [ex] = keys(u, [
        [0, 0],
        [2.2, 0],
        [2.5, 0.1],
        [3.05, 0.1],
        [3.35, 0],
        [4, 0]
      ]) as [number]
      const breath = 0.5 - 0.5 * Math.cos((u / 4) * TAU)
      return g({
        rot: 10 + 1.4 * Math.sin((u / 4) * TAU),
        ex,
        ey: -0.02,
        dy: -0.03 * t,
        sy: 1 - 0.02 * t + 0.014 * breath,
        sx: 1 + 0.01 * t - 0.006 * breath,
        eh: 1 + 0.06 * breath,
        lid: blinks(u, 3.6)
      })
    }
  },
  {
    // termine : yeux en croissant, deux petits sauts de joie
    id: 'done',
    state: 'wink',
    period: 3,
    expression: CRESCENT,
    signature: 0.95,
    pose: (u) => {
      const jump = (start: number) => {
        const v = (u - start) / 1.0
        if (v < 0 || v > 1) return { dy: 0, sx: 1, sy: 1 }
        const [sy, sx] = keys(v, [
          [0, 1, 1],
          [0.18, 0.84, 1.1],
          [0.32, 1.1, 0.95],
          [0.5, 1.03, 0.99],
          [0.68, 1.1, 0.95],
          [0.82, 0.8, 1.14],
          [0.93, 1.05, 0.98],
          [1, 1, 1]
        ]) as [number, number]
        const w = clamp((v - 0.2) / 0.62)
        return { dy: -0.36 * 4 * w * (1 - w) + ground(sy), sx, sy }
      }
      const a = jump(0.25)
      const b = jump(1.55)
      const s = a.sy !== 1 ? a : b
      return g({ dy: s.dy, sx: s.sx, sy: s.sy, arc: 1, ey: -0.03, ex: 0.01 * Math.sin((u / 3) * TAU * 2) })
    }
  },
  {
    // bloque : enerve, yeux fronces en miroir, tremblement par rafales
    id: 'blocked',
    state: 'wide',
    period: 3,
    expression: expr('angry'),
    signature: 0.8,
    pose: (u) => {
      const burst = Math.max(
        Math.sin(Math.PI * clamp((u - 0.2) / 0.9)),
        Math.sin(Math.PI * clamp((u - 1.7) / 0.9))
      )
      const env = 0.22 + 0.78 * burst
      const tremble = Math.sin(u * TAU * 17)
      return g({
        dx: 0.018 * tremble * env,
        dy: 0.007 * Math.sin(u * TAU * 23 + 1) * env + 0.012,
        sx: 1 + 0.025 * burst,
        sy: 1 - 0.04 + 0.02 * burst,
        ew: 1.08,
        eh: 1.45,
        tilt: 5,
        rot: 1.8 * Math.sin(u * TAU * 13) * env,
        ex: 0.006 * tremble * env,
        ey: 0.03
      })
    }
  },
  {
    // dort : yeux fermes, respiration lente
    id: 'asleep',
    state: 'sleep',
    period: 4.6,
    expression: expr('sleepy'),
    signature: 1.4,
    pose: (u) => ({ ...sleepGesture(u), rot: -5, pitch: 0, roll: 0, ey: 0.02, arc: 0.0 })
  }
]

export const MOOD_BY_ID = new Map<MoodId, MoodDef>(MOODS.map((m) => [m.id, m]))
export const MOOD_IDS: MoodId[] = MOODS.map((m) => m.id)

/** Noms des etats existants et noms anglais courants, acceptes par `resolveMood`. */
const ALIAS: Record<string, MoodId> = {
  idle: 'idle',
  thinking: 'thinking',
  working: 'working',
  waiting: 'waiting',
  done: 'done',
  blocked: 'blocked',
  sleep: 'asleep',
  sleeping: 'asleep'
}

/** Resout un identifiant d'humeur (francais ou alias) ; `null` si inconnu. */
export function resolveMood(id: string | null | undefined): MoodId | null {
  if (!id) return null
  if (MOOD_BY_ID.has(id as MoodId)) return id as MoodId
  return ALIAS[id] ?? null
}

/* ------------------------------------------------------------------ reactions */

export type ReactionId = 'startle' | 'laugh' | 'blush' | 'dizzy' | 'wave'

/** Ce que rend une reaction a la date locale `u` : des ecarts, et eventuellement un visage. */
export interface PoseReaction {
  gesture: Gesture
  /** visage vers lequel glisser, et a quel point (0 a 1) */
  exp?: BotExpression
  mix?: number
  /** part du regard et du rire de l'humeur qu'elle masque (0 a 1) ; par defaut `mix` */
  masque?: number
}

export interface ReactionDef {
  id: ReactionId
  /** evenement utilisateur qui la declenche */
  trigger: 'tap' | 'double' | 'long' | 'shaken' | 'arrival'
  /** duree totale, ou duree de la montee pour une reaction tenue */
  duration: number
  /** true = reste a son maximum tant qu'on tient (appui long), puis redescend en `exit` s */
  held?: boolean
  exit?: number
  /** `u` : secondes depuis le declenchement ; `end` : secondes depuis le relachement (tenue), sinon -1 */
  pose: (u: number, end: number) => PoseReaction
}

const LAUGH = face('laughing', 4, 14, 0, 18, pair(0.42, 0.17, 0))

export const REACTIONS: ReactionDef[] = [
  {
    // tap ou clic : sursaut, ecrasement, rebond amorti
    id: 'startle',
    trigger: 'tap',
    duration: 0.8,
    pose: (u) => {
      const [sy, sx, dy] = keys(u, [
        [0, 1, 1, 0],
        [0.1, 1.12, 0.94, -0.13],
        [0.26, 0.8, 1.14, 0.05],
        [0.42, 1.07, 0.96, -0.04],
        [0.56, 0.96, 1.03, 0.01],
        [0.7, 1, 1, 0],
        [0.8, 1, 1, 0]
      ]) as [number, number, number]
      // les yeux s'ecarquillent d'un coup, puis se reposent
      const large = clamp(u / 0.04) * (1 - smooth((u - 0.3) / 0.4))
      return { gesture: g({ sy, sx, dy: dy + ground(sy), ew: 1 + 0.32 * large, eh: 1 + 0.26 * large }) }
    }
  },
  {
    // double tap : il rigole, les yeux en croissant, le corps secoue
    id: 'laugh',
    trigger: 'double',
    duration: 1.6,
    pose: (u) => {
      const env = smooth(u / 0.14) * (1 - smooth((u - 1.15) / 0.45))
      const s = Math.abs(Math.sin(u * TAU * 2.8))
      const sy = 1 - 0.03 * env + 0.035 * s * env
      return {
        gesture: g({
          arc: env,
          dy: -0.045 * s * env + ground(sy) * 0.5,
          sy,
          sx: 1 / Math.sqrt(sy),
          rot: 3.5 * Math.sin(u * TAU * 2.8 * 0.5) * env,
          ey: -0.02 * env
        }),
        exp: LAUGH,
        mix: env
      }
    }
  },
  {
    // appui long : il rougit et ferme les yeux, content (tient tant qu'on appuie)
    id: 'blush',
    trigger: 'long',
    duration: 0.5,
    held: true,
    exit: 0.7,
    pose: (u, end) => {
      const env = smooth(u / 0.5) * (end < 0 ? 1 : 1 - smooth(end / 0.7))
      const sy = 1 - 0.03 * env
      return {
        gesture: g({
          arc: env,
          cheeks: env,
          sy,
          sx: 1 + 0.015 * env,
          dy: ground(sy),
          rot: 2.2 * Math.sin(u * TAU * 0.5) * env,
          ey: 0.01 * env
        }),
        exp: CRESCENT,
        mix: env
      }
    }
  },
  {
    // secoue ou tourne vite : etourdi, les yeux tournent, le corps tangue
    id: 'dizzy',
    trigger: 'shaken',
    duration: 2.3,
    pose: (u) => {
      const env = 1 - smooth((u - 1.1) / 1.2)
      const att = smooth(u / 0.12)
      // vitesse angulaire qui retombe a zero a la fin
      const theta = TAU * 2.7 * (u - (u * u) / (2 * 2.3))
      // le tournis s'apaise puis s'eteint pile a la fin : le regard rend la main sans saut
      const amp = 0.115 * att * (1 - 0.55 * smooth(u / 2.3)) * (1 - smooth((u - 1.5) / 0.8))
      const bal = Math.sin(u * TAU * 1.25)
      return {
        gesture: g({
          ex: amp * Math.cos(theta),
          ey: amp * Math.sin(theta),
          dx: 0.06 * bal * env * att,
          rot: 9 * Math.sin(u * TAU * 1.25 + 0.6) * env * att,
          sy: 1 - 0.015 * Math.abs(bal) * env,
          lid: 1
        }),
        masque: 1 - smooth((u - 1.7) / 0.6)
      }
    }
  },
  {
    // coucou : le Mochi pousse depuis le sol (presque rien -> 100 %, ease-out avec un leger rebond a ~107 %),
    // puis petit saut et salut de la tete
    id: 'wave',
    trigger: 'arrival',
    duration: 1.8 + WAVE_PUSH,
    pose: (t) => {
      const push = waveScale(t)
      const u = t - WAVE_PUSH
      const v = u / 0.7
      let sy = 1
      let sx = 1
      let dy = 0
      if (v >= 0 && v <= 1) {
        ;[sy, sx] = keys(v, [
          [0, 1, 1],
          [0.2, 0.86, 1.09],
          [0.4, 1.1, 0.95],
          [0.6, 1.03, 0.99],
          [0.82, 0.88, 1.08],
          [1, 1, 1]
        ]) as [number, number]
        const w = clamp((v - 0.22) / 0.58)
        dy = -0.22 * 4 * w * (1 - w)
      }
      // le salut : la tete part de cote deux fois, comme on salue de la main
      const fen = smooth((u - 0.7) / 0.15) * (1 - smooth((u - 1.45) / 0.3))
      const hello = Math.sin((u - 0.7) * TAU * 1.9) * fen
      const env = smooth(u / 0.2) * (1 - smooth((u - 1.3) / 0.45))
      // l'echelle de pousse multiplie le corps entier ; le corps reste pose sur le sol (le bas ne bouge pas)
      sx *= push
      sy *= push
      dy += ground(sy)
      return { gesture: g({ sy, sx, dy, rot: 12 * hello }), exp: expr('happy'), mix: 0.75 * env, masque: 0.5 * env }
    }
  }
]

export const REACTION_BY_ID = new Map<ReactionId, ReactionDef>(REACTIONS.map((r) => [r.id, r]))
export const REACTION_IDS: ReactionId[] = REACTIONS.map((r) => r.id)

/** Evenement utilisateur -> reaction. */
export const REACTION_FOR_EVENT: Record<ReactionDef['trigger'], ReactionId> = {
  tap: 'startle',
  double: 'laugh',
  long: 'blush',
  shaken: 'dizzy',
  arrival: 'wave'
}

/* ------------------------------------------------------------------ melange */

const NEUTRAL_NUM = { dx: 0, dy: 0, sx: 1, sy: 1, yaw: 0, pitch: 0, roll: 0, lid: 1, ew: 1, eh: 1, tilt: 0, arc: 0, ex: 0, ey: 0, cheeks: 0, rot: 0 }
const FIELDS = Object.keys(NEUTRAL_NUM) as Array<keyof typeof NEUTRAL_NUM>

/** Interpolation de deux gestes champ par champ (les champs absents valent leur neutre). */
export function mix(a: Gesture, b: Gesture, k: number): Gesture {
  const out = { ...NEUTRAL_GESTURE } as Record<string, unknown>
  for (const c of FIELDS) {
    const va = (a[c] as number | undefined) ?? NEUTRAL_NUM[c]
    const vb = (b[c] as number | undefined) ?? NEUTRAL_NUM[c]
    if (va !== NEUTRAL_NUM[c] || vb !== NEUTRAL_NUM[c]) out[c] = lerp(va, vb, k)
  }
  if (a.exp && b.exp) out.exp = blendExpression(a.exp, b.exp, k)
  else if (a.exp || b.exp) out.exp = k < 0.5 ? a.exp : b.exp
  return out as unknown as Gesture
}

/* ------------------------------------------------------------------ pilote */

/** Duree du fondu d'une humeur a l'autre. */
export const MOOD_FADE = 0.45
/** Duree du rattrapage du regard vers le pointeur (court : il doit paraitre attentif). */
export const GAZE_CATCH_UP = 0.2
/** Debattement du regard sur le visage, en rayons. */
export const GAZE_X = 0.15
export const GAZE_Y = 0.125

interface Active {
  def: ReactionDef
  start: number
  /** date du relachement d'une reaction tenue */
  released: number | null
}

/**
 * Etat d'un avatar : son humeur, la reaction en cours, le regard qui suit. Chaque setter prend la
 * date, `sample(now)` rend les ecarts a appliquer a cet instant (ou `undefined` quand il n'y a rien
 * a ajouter : sans humeur, reaction ni suivi, le moteur tourne comme avant, a l'octet pres).
 */
export class Moods {
  private cur: MoodId | null
  private prev: MoodId | null = null
  private startPos = 0
  private startPrev = 0
  private background = -10
  private active: Active | null = null
  /** visage de repos de l'application (expression choisie), pour que la fin d'une reaction ne saute pas */
  private base: BotExpression | null = null
  /** regard : valeur a la date du dernier changement, cible, et date */
  private gazeOf = { x: 0, y: 0, w: 0 }
  private gazeA = { x: 0, y: 0, w: 0 }
  private gazeAt = -10
  /** true = `prefers-reduced-motion` : image fixe, sans mouvement du corps */
  reduced: boolean
  /** 0 a 1 : le regard de `working` se tourne vers l'ordinateur pose en bas a droite (le composant le pose) */
  gazeLaptop = 0

  constructor(mood: MoodId | null = null, opts: { reduced?: boolean; base?: BotExpression | null } = {}) {
    this.cur = mood
    this.reduced = opts.reduced ?? false
    this.base = opts.base ?? null
  }

  get mood(): MoodId | null {
    return this.cur
  }

  /** Reaction en cours (ou `null`), pour l'interface et les tests. */
  reaction(now: number): ReactionId | null {
    const a = this.active
    return a && !this.finished(a, now) ? a.def.id : null
  }

  setBase(base: BotExpression | null) {
    this.base = base
  }

  /** Change d'humeur ; `null` coupe la couche. Le visage et le corps glissent sur `MOOD_FADE`. */
  setMood(id: MoodId | string | null, now: number) {
    const m = typeof id === 'string' ? resolveMood(id) : id
    if (m === this.cur) return
    this.prev = this.cur
    this.startPrev = this.startPos
    this.cur = m
    this.startPos = now
    this.background = now
  }

  /** Declenche une reaction. Une reaction qui arrive sur une autre la remplace. `tenir` : attend `release`. */
  react(id: ReactionId | string, now: number): boolean {
    const def = REACTION_BY_ID.get(id as ReactionId)
    if (!def) return false
    // en mouvement reduit, seul l'etat de visage reste : pas de saut, de secousse ni de tournis
    if (this.reduced && def.id !== 'blush') return false
    this.active = { def, start: now, released: null }
    return true
  }

  /** Relache une reaction tenue (fin de l'appui long). */
  release(now: number) {
    const a = this.active
    if (a?.def.held && a.released === null) a.released = now
  }

  /** Pointeur au-dessus de l'avatar : `nx`, `ny` entre -1 et 1 (droite et bas positifs) ; `null` pour lacher. */
  lookAt(target: { nx: number; ny: number } | null, now: number) {
    if (target && !Number.isFinite(target.nx + target.ny)) return
    this.gazeOf = this.gazeAtTime(now)
    this.gazeA = target ? { x: clamp(target.nx, -1, 1), y: clamp(target.ny, -1, 1), w: 1 } : { x: this.gazeOf.x, y: this.gazeOf.y, w: 0 }
    this.gazeAt = now
  }

  private gazeAtTime(now: number) {
    const k = easings.easeOutQuint(clamp((now - this.gazeAt) / GAZE_CATCH_UP))
    return {
      x: lerp(this.gazeOf.x, this.gazeA.x, k),
      y: lerp(this.gazeOf.y, this.gazeA.y, k),
      w: lerp(this.gazeOf.w, this.gazeA.w, k)
    }
  }

  private finished(a: Active, now: number): boolean {
    const u = now - a.start
    if (a.def.held) return a.released !== null && now - a.released >= (a.def.exit ?? 0.5)
    return u >= a.def.duration
  }

  private pose(id: MoodId, startPos: number, now: number): Gesture {
    const def = MOOD_BY_ID.get(id)!
    const u = this.reduced ? def.signature : (((now - startPos) % def.period) + def.period) % def.period
    const p = def.pose(u)
    // image fixe : le visage reste, le corps ne bouge plus
    const fixed = this.reduced ? { ...p, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, ex: p.ex ? p.ex * 0.5 : p.ex } : p
    return { ...fixed, exp: def.expression }
  }

  /** Geste de l'humeur a la date `now`, fondu depuis la precedente ; `null` sans humeur. */
  private moodGesture(now: number): Gesture | null {
    if (!this.cur) return null
    const a = this.pose(this.cur, this.startPos, now)
    const k = (now - this.background) / MOOD_FADE
    if (this.prev && k < 1 && !this.reduced) return mix(this.pose(this.prev, this.startPrev, now), a, easings.easeOutQuint(clamp(k)))
    // une couche qui s'ouvre (venue de `null`) entre en fondu depuis le visage de base
    if (!this.prev && k < 1 && !this.reduced && this.background > -5) {
      const since = g({ exp: this.base ?? expr('neutral') })
      return mix(since, a, easings.easeOutQuint(clamp(k)))
    }
    return a
  }

  /**
   * Ecarts a la date `now`, a passer a `engine.sample(now, gesture)`. `undefined` = couche inactive :
   * ne rien ajouter (et donc ne rien redessiner de plus qu'avant).
   */
  sample(now: number): Gesture | undefined {
    let base = this.moodGesture(now)
    const a = this.active && !this.finished(this.active, now) ? this.active : null
    const w = this.reduced ? { x: 0, y: 0, w: 0 } : this.gazeAtTime(now)
    if (!base && !a && w.w < 0.002) return undefined
    // sans humeur, une reaction part du visage de repos de l'application, sans ecart de corps
    base ??= g({ exp: this.base ?? expr('neutral') })
    // l'ordinateur est en bas a droite : le regard y va un peu, sans toucher a l'animation du corps
    if (this.gazeLaptop > 0 && this.cur === 'working') base = { ...base, ex: (base.ex ?? 0) + 0.075 * this.gazeLaptop, ey: (base.ey ?? 0) + 0.04 * this.gazeLaptop }
    let out: Gesture = base
    if (a) {
      const u = now - a.start
      const end = a.released === null ? -1 : now - a.released
      const r = a.def.pose(u, end)
      const masque = clamp(r.masque ?? r.mix ?? 0)
      // la reaction masque le regard et le rire de l'humeur : un seul visage a la fois
      const calm: Gesture = { ...base, ex: (base.ex ?? 0) * (1 - masque), ey: (base.ey ?? 0) * (1 - masque), arc: (base.arc ?? 0) * (1 - masque) }
      out = composer(calm, r.gesture)
      const target = r.exp
      if (target && base.exp) out.exp = blendExpression(base.exp, target, clamp(r.mix ?? 1))
      else out.exp = base.exp
    }
    if (w.w > 0.002) {
      // le regard suit le pointeur et remplace la derive de l'humeur
      const fol = easings.easeOutQuint(w.w)
      out = composer(
        { ...out, ex: (out.ex ?? 0) * (1 - 0.9 * fol), ey: (out.ey ?? 0) * (1 - 0.9 * fol) },
        g({ ex: GAZE_X * w.x * w.w, ey: GAZE_Y * w.y * w.w, dx: 0.018 * w.x * w.w, rot: 2.2 * w.x * w.w })
      )
    }
    return out
  }
}

/**
 * Cadence : faut-il redessiner a `ms` ? Plafonne la boucle d'un avatar a `fps` images par seconde
 * (le tableau de bord en affiche jusqu'a 70 dans un seul contexte WebGL a 12 i/s). `fps` nul ou
 * absent = a chaque image du navigateur.
 */
export function mustRedraw(ms: number, last: number, fps?: number): boolean {
  if (!fps || fps <= 0 || last <= 0) return true
  // une demi-image de marge : rAF tombe rarement pile sur la periode
  return ms - last >= 1000 / fps - 1000 / 120
}

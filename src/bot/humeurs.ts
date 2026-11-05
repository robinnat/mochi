/**
 * Humeurs et interactions : une couche d'animation du VISAGE et du CORPS, ajoutee par-dessus le
 * moteur (comme `gestes.ts`, dont elle reprend le type `Geste`).
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
 * est une fonction de cet etat date, comme `BotEngine.setLook`. Les ecarts rendus (`Geste`) sont
 * appliques par `engine.sample(t, geste)`, donc les accessoires, qui lisent le corps rendu, suivent
 * toutes les deformations.
 */
import { EXPRESSION_BY_ID, blendExpression, type BotExpression } from './expressions'
import { composer, GESTE_NEUTRE, gesteSommeil, type Geste } from './gestes'
import { TAU, clamp, easings, lerp, loopNoise } from './math'
import type { EyeCfg } from './states'

/* ------------------------------------------------------------------ outils */

const lisse = (u: number) => {
  const k = clamp(u)
  return k * k * (3 - 2 * k)
}

/** Interpolation douce entre des cles `[date, ...valeurs]` triees par date. */
function cles(u: number, K: number[][]): number[] {
  if (u <= K[0]![0]!) return K[0]!.slice(1)
  for (let i = 1; i < K.length; i++) {
    const b = K[i]!
    if (u <= b[0]!) {
      const a = K[i - 1]!
      const k = lisse((u - a[0]!) / (b[0]! - a[0]!))
      return b.slice(1).map((v, j) => lerp(a[j + 1]!, v, k))
    }
  }
  return K[K.length - 1]!.slice(1)
}

const g = (p: Partial<Geste>): Geste => ({ ...GESTE_NEUTRE, ...p })

/** Le corps repose sur le sol : quand il s'ecrase, son centre descend d'autant. */
const sol = (sy: number) => (1 - sy) * 0.92

const eye = (w: number, h: number, tilt = 0, open = 1): EyeCfg => ({ w, h, tilt, open })
const paire = (w: number, h: number, tilt = 0): [EyeCfg, EyeCfg] => [eye(w, h, tilt), eye(w, h, -tilt)]
const visage = (id: BotExpression['id'], yaw: number, pitch: number, roll: number, split: number, eyes: [EyeCfg, EyeCfg]): BotExpression => ({
  id,
  gaze: { yaw, pitch, roll },
  split,
  eyes
})
const expr = (id: BotExpression['id']) => EXPRESSION_BY_ID.get(id)!

/** Un clignement net a la date `d` (deux images a 12 i/s), 1 = ouvert. */
const cligne = (u: number, d: number, duree = 0.2) => {
  const k = (u - d) / duree
  return k < 0 || k > 1 ? 1 : k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
}

/* ------------------------------------------------------------------ humeurs */

export type MoodId = 'repos' | 'reflechit' | 'travaille' | 'attend' | 'termine' | 'bloque' | 'dort'

export interface MoodDef {
  id: MoodId
  /** nom des etats existants dont elle prolonge le sens (`states.ts`) */
  etat: string
  /** duree de la boucle, en secondes : la fin retombe sur le debut */
  periode: number
  /** visage de base (une expression de `expressions.ts` ou une variante) */
  expression: BotExpression
  /** ecarts a la date locale `u` (secondes depuis le debut de la boucle) */
  pose: (u: number) => Geste
  /** date ou la pose est la plus lisible : image fixe sous `prefers-reduced-motion`, vignettes */
  signature: number
}

/** Les yeux horizontaux d'un oeil content : le croissant vient de `arc`, pas de la forme. */
const CROISSANT = visage('heureux', 5, 9, 0, 17, paire(0.42, 0.17, 0))

export const MOODS: MoodDef[] = [
  {
    // respiration douce, clignements, regard qui se promene
    id: 'repos',
    etat: 'idle',
    periode: 4,
    expression: expr('neutre'),
    signature: 0.6,
    pose: (u) => {
      const souffle = 0.5 - 0.5 * Math.cos((u / 4) * TAU)
      return g({
        sx: 1 - 0.012 * souffle,
        sy: 1 + 0.026 * souffle,
        dy: -0.02 * souffle,
        lid: Math.min(cligne(u, 1.15), cligne(u, 2.9), cligne(u, 3.15)),
        ex: 0.075 * loopNoise(u, 4, 0.4),
        ey: 0.035 * loopNoise(u, 4, 2.2)
      })
    }
  },
  {
    // regard en l'air, yeux plisses, un oeil plus ferme que l'autre
    id: 'reflechit',
    etat: 'thinking',
    periode: 4,
    expression: visage('mefiant', 6, 6, 0, 16, [eye(0.27, 0.27, 10), eye(0.27, 0.19, -10)]),
    signature: 1.2,
    pose: (u) => {
      const v = (u / 4) * TAU
      const [rot, ex] = cles(u, [
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
        lid: cligne(u, 3.3)
      })
    }
  },
  {
    // concentre : le regard lit ligne apres ligne, petits rebonds reguliers
    id: 'travaille',
    etat: 'idle',
    periode: 4,
    expression: visage('attentif', 4, 5, 0, 16, [eye(0.22, 0.34, 5), eye(0.22, 0.34, -5)]),
    signature: 0.55,
    pose: (u) => {
      // une ligne par seconde : balayage de gauche a droite, retour vif
      const v = u % 1
      const bal = v < 0.82 ? lisse(v / 0.82) : 1 - lisse((v - 0.82) / 0.18)
      // la ligne descend puis remonte (0, 1, 2, 1) : la boucle se raccorde, sans retour brusque
      const rang = [0, 1, 2, 1]
      const k = Math.floor(u) % 4
      const ligne = lerp(rang[k]!, rang[(k + 1) % 4]!, lisse((v - 0.82) / 0.18))
      // rebond toutes les 0,5 s : ecrasement bref puis petit saut
      const p = (u % 0.5) / 0.5
      const saut = Math.sin(Math.PI * p)
      // l'impact tombe pile sur la jointure : le creux monte avant et redescend apres, sans marche
      const creux = p < 0.12 ? 1 - p / 0.12 : p > 0.88 ? (p - 0.88) / 0.12 : 0
      const sy = 1 + 0.03 * saut - 0.045 * creux
      return g({
        ex: -0.095 + 0.19 * bal,
        ey: 0.05 + 0.018 * ligne,
        dy: -0.04 * saut + sol(sy) * 0.6,
        sy,
        sx: 1 / Math.sqrt(sy),
        lid: cligne(u, 2.4)
      })
    }
  },
  {
    // attend Robin : regard droit devant, tete penchee, un peu impatient
    id: 'attend',
    etat: 'wide',
    periode: 4,
    expression: visage('attentif', 0, 0, 0, 16.5, [eye(0.25, 0.5, 0), eye(0.25, 0.5, 0)]),
    signature: 0.9,
    pose: (u) => {
      // deux petits tapotements de pied, puis un coup d'oeil sur le cote et retour
      const tap = (d: number) => (u >= d && u < d + 0.3 ? Math.sin(Math.PI * ((u - d) / 0.3)) : 0)
      const t = Math.max(tap(1.2), tap(1.6))
      const [ex] = cles(u, [
        [0, 0],
        [2.2, 0],
        [2.5, 0.1],
        [3.05, 0.1],
        [3.35, 0],
        [4, 0]
      ]) as [number]
      const souffle = 0.5 - 0.5 * Math.cos((u / 4) * TAU)
      return g({
        rot: 10 + 1.4 * Math.sin((u / 4) * TAU),
        ex,
        ey: -0.02,
        dy: -0.03 * t,
        sy: 1 - 0.02 * t + 0.014 * souffle,
        sx: 1 + 0.01 * t - 0.006 * souffle,
        eh: 1 + 0.06 * souffle,
        lid: cligne(u, 3.6)
      })
    }
  },
  {
    // termine : yeux en croissant, deux petits sauts de joie
    id: 'termine',
    etat: 'wink',
    periode: 3,
    expression: CROISSANT,
    signature: 0.95,
    pose: (u) => {
      const saut = (debut: number) => {
        const v = (u - debut) / 1.0
        if (v < 0 || v > 1) return { dy: 0, sx: 1, sy: 1 }
        const [sy, sx] = cles(v, [
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
        return { dy: -0.36 * 4 * w * (1 - w) + sol(sy), sx, sy }
      }
      const a = saut(0.25)
      const b = saut(1.55)
      const s = a.sy !== 1 ? a : b
      return g({ dy: s.dy, sx: s.sx, sy: s.sy, arc: 1, ey: -0.03, ex: 0.01 * Math.sin((u / 3) * TAU * 2) })
    }
  },
  {
    // bloque : enerve, yeux fronces en miroir, tremblement par rafales
    id: 'bloque',
    etat: 'wide',
    periode: 3,
    expression: expr('colere'),
    signature: 0.8,
    pose: (u) => {
      const rafale = Math.max(
        Math.sin(Math.PI * clamp((u - 0.2) / 0.9)),
        Math.sin(Math.PI * clamp((u - 1.7) / 0.9))
      )
      const env = 0.22 + 0.78 * rafale
      const tremble = Math.sin(u * TAU * 17)
      return g({
        dx: 0.018 * tremble * env,
        dy: 0.007 * Math.sin(u * TAU * 23 + 1) * env + 0.012,
        sx: 1 + 0.025 * rafale,
        sy: 1 - 0.04 + 0.02 * rafale,
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
    id: 'dort',
    etat: 'sleep',
    periode: 4.6,
    expression: expr('somnolent'),
    signature: 1.4,
    pose: (u) => ({ ...gesteSommeil(u), rot: -5, pitch: 0, roll: 0, ey: 0.02, arc: 0.0 })
  }
]

export const MOOD_BY_ID = new Map<MoodId, MoodDef>(MOODS.map((m) => [m.id, m]))
export const MOOD_IDS: MoodId[] = MOODS.map((m) => m.id)

/** Noms des etats existants et noms anglais courants, acceptes par `moodDe`. */
const ALIAS: Record<string, MoodId> = {
  idle: 'repos',
  thinking: 'reflechit',
  working: 'travaille',
  waiting: 'attend',
  done: 'termine',
  blocked: 'bloque',
  sleep: 'dort',
  sleeping: 'dort'
}

/** Resout un identifiant d'humeur (francais ou alias) ; `null` si inconnu. */
export function moodDe(id: string | null | undefined): MoodId | null {
  if (!id) return null
  if (MOOD_BY_ID.has(id as MoodId)) return id as MoodId
  return ALIAS[id] ?? null
}

/* ------------------------------------------------------------------ reactions */

export type ReactionId = 'sursaut' | 'rigole' | 'rougit' | 'etourdi' | 'coucou'

/** Ce que rend une reaction a la date locale `u` : des ecarts, et eventuellement un visage. */
export interface PoseReaction {
  geste: Geste
  /** visage vers lequel glisser, et a quel point (0 a 1) */
  exp?: BotExpression
  mix?: number
  /** part du regard et du rire de l'humeur qu'elle masque (0 a 1) ; par defaut `mix` */
  masque?: number
}

export interface ReactionDef {
  id: ReactionId
  /** evenement utilisateur qui la declenche */
  declencheur: 'tap' | 'double' | 'longue' | 'secoue' | 'arrivee'
  /** duree totale, ou duree de la montee pour une reaction tenue */
  duree: number
  /** true = reste a son maximum tant qu'on tient (appui long), puis redescend en `sortie` s */
  tenue?: boolean
  sortie?: number
  /** `u` : secondes depuis le declenchement ; `fin` : secondes depuis le relachement (tenue), sinon -1 */
  pose: (u: number, fin: number) => PoseReaction
}

const RIRE = visage('hilare', 4, 14, 0, 18, paire(0.42, 0.17, 0))

export const REACTIONS: ReactionDef[] = [
  {
    // tap ou clic : sursaut, ecrasement, rebond amorti
    id: 'sursaut',
    declencheur: 'tap',
    duree: 0.8,
    pose: (u) => {
      const [sy, sx, dy] = cles(u, [
        [0, 1, 1, 0],
        [0.1, 1.12, 0.94, -0.13],
        [0.26, 0.8, 1.14, 0.05],
        [0.42, 1.07, 0.96, -0.04],
        [0.56, 0.96, 1.03, 0.01],
        [0.7, 1, 1, 0],
        [0.8, 1, 1, 0]
      ]) as [number, number, number]
      // les yeux s'ecarquillent d'un coup, puis se reposent
      const large = clamp(u / 0.04) * (1 - lisse((u - 0.3) / 0.4))
      return { geste: g({ sy, sx, dy: dy + sol(sy), ew: 1 + 0.32 * large, eh: 1 + 0.26 * large }) }
    }
  },
  {
    // double tap : il rigole, les yeux en croissant, le corps secoue
    id: 'rigole',
    declencheur: 'double',
    duree: 1.6,
    pose: (u) => {
      const env = lisse(u / 0.14) * (1 - lisse((u - 1.15) / 0.45))
      const s = Math.abs(Math.sin(u * TAU * 2.8))
      const sy = 1 - 0.03 * env + 0.035 * s * env
      return {
        geste: g({
          arc: env,
          dy: -0.045 * s * env + sol(sy) * 0.5,
          sy,
          sx: 1 / Math.sqrt(sy),
          rot: 3.5 * Math.sin(u * TAU * 2.8 * 0.5) * env,
          ey: -0.02 * env
        }),
        exp: RIRE,
        mix: env
      }
    }
  },
  {
    // appui long : il rougit et ferme les yeux, content (tient tant qu'on appuie)
    id: 'rougit',
    declencheur: 'longue',
    duree: 0.5,
    tenue: true,
    sortie: 0.7,
    pose: (u, fin) => {
      const env = lisse(u / 0.5) * (fin < 0 ? 1 : 1 - lisse(fin / 0.7))
      const sy = 1 - 0.03 * env
      return {
        geste: g({
          arc: env,
          joues: env,
          sy,
          sx: 1 + 0.015 * env,
          dy: sol(sy),
          rot: 2.2 * Math.sin(u * TAU * 0.5) * env,
          ey: 0.01 * env
        }),
        exp: CROISSANT,
        mix: env
      }
    }
  },
  {
    // secoue ou tourne vite : etourdi, les yeux tournent, le corps tangue
    id: 'etourdi',
    declencheur: 'secoue',
    duree: 2.3,
    pose: (u) => {
      const env = 1 - lisse((u - 1.1) / 1.2)
      const att = lisse(u / 0.12)
      // vitesse angulaire qui retombe a zero a la fin
      const theta = TAU * 2.7 * (u - (u * u) / (2 * 2.3))
      // le tournis s'apaise puis s'eteint pile a la fin : le regard rend la main sans saut
      const amp = 0.115 * att * (1 - 0.55 * lisse(u / 2.3)) * (1 - lisse((u - 1.5) / 0.8))
      const bal = Math.sin(u * TAU * 1.25)
      return {
        geste: g({
          ex: amp * Math.cos(theta),
          ey: amp * Math.sin(theta),
          dx: 0.06 * bal * env * att,
          rot: 9 * Math.sin(u * TAU * 1.25 + 0.6) * env * att,
          sy: 1 - 0.015 * Math.abs(bal) * env,
          lid: 1
        }),
        masque: 1 - lisse((u - 1.7) / 0.6)
      }
    }
  },
  {
    // coucou : petit saut a l'apparition, puis un salut de la tete
    id: 'coucou',
    declencheur: 'arrivee',
    duree: 1.8,
    pose: (u) => {
      const v = u / 0.7
      let sy = 1
      let sx = 1
      let dy = 0
      if (v >= 0 && v <= 1) {
        ;[sy, sx] = cles(v, [
          [0, 1, 1],
          [0.2, 0.86, 1.09],
          [0.4, 1.1, 0.95],
          [0.6, 1.03, 0.99],
          [0.82, 0.88, 1.08],
          [1, 1, 1]
        ]) as [number, number]
        const w = clamp((v - 0.22) / 0.58)
        dy = -0.22 * 4 * w * (1 - w) + sol(sy)
      }
      // le salut : la tete part de cote deux fois, comme on salue de la main
      const fen = lisse((u - 0.7) / 0.15) * (1 - lisse((u - 1.45) / 0.3))
      const salut = Math.sin((u - 0.7) * TAU * 1.9) * fen
      const env = lisse(u / 0.2) * (1 - lisse((u - 1.3) / 0.45))
      return { geste: g({ sy, sx, dy, rot: 12 * salut }), exp: expr('heureux'), mix: 0.75 * env, masque: 0.5 * env }
    }
  }
]

export const REACTION_BY_ID = new Map<ReactionId, ReactionDef>(REACTIONS.map((r) => [r.id, r]))
export const REACTION_IDS: ReactionId[] = REACTIONS.map((r) => r.id)

/** Evenement utilisateur -> reaction. */
export const REACTION_DE_EVENEMENT: Record<ReactionDef['declencheur'], ReactionId> = {
  tap: 'sursaut',
  double: 'rigole',
  longue: 'rougit',
  secoue: 'etourdi',
  arrivee: 'coucou'
}

/* ------------------------------------------------------------------ melange */

const NEUTRE_NUM = { dx: 0, dy: 0, sx: 1, sy: 1, yaw: 0, pitch: 0, roll: 0, lid: 1, ew: 1, eh: 1, tilt: 0, arc: 0, ex: 0, ey: 0, joues: 0, rot: 0 }
const CHAMPS = Object.keys(NEUTRE_NUM) as Array<keyof typeof NEUTRE_NUM>

/** Interpolation de deux gestes champ par champ (les champs absents valent leur neutre). */
export function melanger(a: Geste, b: Geste, k: number): Geste {
  const out = { ...GESTE_NEUTRE } as Record<string, unknown>
  for (const c of CHAMPS) {
    const va = (a[c] as number | undefined) ?? NEUTRE_NUM[c]
    const vb = (b[c] as number | undefined) ?? NEUTRE_NUM[c]
    if (va !== NEUTRE_NUM[c] || vb !== NEUTRE_NUM[c]) out[c] = lerp(va, vb, k)
  }
  if (a.exp && b.exp) out.exp = blendExpression(a.exp, b.exp, k)
  else if (a.exp || b.exp) out.exp = k < 0.5 ? a.exp : b.exp
  return out as unknown as Geste
}

/* ------------------------------------------------------------------ pilote */

/** Duree du fondu d'une humeur a l'autre. */
export const FONDU_HUMEUR = 0.45
/** Duree du rattrapage du regard vers le pointeur (court : il doit paraitre attentif). */
export const RATTRAPAGE_REGARD = 0.2
/** Debattement du regard sur le visage, en rayons. */
export const REGARD_X = 0.15
export const REGARD_Y = 0.125

interface Active {
  def: ReactionDef
  debut: number
  /** date du relachement d'une reaction tenue */
  relache: number | null
}

/**
 * Etat d'un avatar : son humeur, la reaction en cours, le regard qui suit. Chaque setter prend la
 * date, `sample(now)` rend les ecarts a appliquer a cet instant (ou `undefined` quand il n'y a rien
 * a ajouter : sans humeur, reaction ni suivi, le moteur tourne comme avant, a l'octet pres).
 */
export class Humeurs {
  private cur: MoodId | null
  private prev: MoodId | null = null
  private depart = 0
  private departPrev = 0
  private fond = -10
  private active: Active | null = null
  /** visage de repos de l'application (expression choisie), pour que la fin d'une reaction ne saute pas */
  private base: BotExpression | null = null
  /** regard : valeur a la date du dernier changement, cible, et date */
  private regardDe = { x: 0, y: 0, w: 0 }
  private regardA = { x: 0, y: 0, w: 0 }
  private regardAt = -10
  /** true = `prefers-reduced-motion` : image fixe, sans mouvement du corps */
  reduit: boolean

  constructor(mood: MoodId | null = null, opts: { reduit?: boolean; base?: BotExpression | null } = {}) {
    this.cur = mood
    this.reduit = opts.reduit ?? false
    this.base = opts.base ?? null
  }

  get mood(): MoodId | null {
    return this.cur
  }

  /** Reaction en cours (ou `null`), pour l'interface et les tests. */
  reaction(now: number): ReactionId | null {
    const a = this.active
    return a && !this.finie(a, now) ? a.def.id : null
  }

  setBase(base: BotExpression | null) {
    this.base = base
  }

  /** Change d'humeur ; `null` coupe la couche. Le visage et le corps glissent sur `FONDU_HUMEUR`. */
  setMood(id: MoodId | string | null, now: number) {
    const m = typeof id === 'string' ? moodDe(id) : id
    if (m === this.cur) return
    this.prev = this.cur
    this.departPrev = this.depart
    this.cur = m
    this.depart = now
    this.fond = now
  }

  /** Declenche une reaction. Une reaction qui arrive sur une autre la remplace. `tenir` : attend `relacher`. */
  react(id: ReactionId | string, now: number): boolean {
    const def = REACTION_BY_ID.get(id as ReactionId)
    if (!def) return false
    // en mouvement reduit, seul l'etat de visage reste : pas de saut, de secousse ni de tournis
    if (this.reduit && def.id !== 'rougit') return false
    this.active = { def, debut: now, relache: null }
    return true
  }

  /** Relache une reaction tenue (fin de l'appui long). */
  relacher(now: number) {
    const a = this.active
    if (a?.def.tenue && a.relache === null) a.relache = now
  }

  /** Pointeur au-dessus de l'avatar : `nx`, `ny` entre -1 et 1 (droite et bas positifs) ; `null` pour lacher. */
  regarder(cible: { nx: number; ny: number } | null, now: number) {
    if (cible && !Number.isFinite(cible.nx + cible.ny)) return
    this.regardDe = this.regardAtTime(now)
    this.regardA = cible ? { x: clamp(cible.nx, -1, 1), y: clamp(cible.ny, -1, 1), w: 1 } : { x: this.regardDe.x, y: this.regardDe.y, w: 0 }
    this.regardAt = now
  }

  private regardAtTime(now: number) {
    const k = easings.easeOutQuint(clamp((now - this.regardAt) / RATTRAPAGE_REGARD))
    return {
      x: lerp(this.regardDe.x, this.regardA.x, k),
      y: lerp(this.regardDe.y, this.regardA.y, k),
      w: lerp(this.regardDe.w, this.regardA.w, k)
    }
  }

  private finie(a: Active, now: number): boolean {
    const u = now - a.debut
    if (a.def.tenue) return a.relache !== null && now - a.relache >= (a.def.sortie ?? 0.5)
    return u >= a.def.duree
  }

  private pose(id: MoodId, depart: number, now: number): Geste {
    const def = MOOD_BY_ID.get(id)!
    const u = this.reduit ? def.signature : (((now - depart) % def.periode) + def.periode) % def.periode
    const p = def.pose(u)
    // image fixe : le visage reste, le corps ne bouge plus
    const fixe = this.reduit ? { ...p, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, ex: p.ex ? p.ex * 0.5 : p.ex } : p
    return { ...fixe, exp: def.expression }
  }

  /** Geste de l'humeur a la date `now`, fondu depuis la precedente ; `null` sans humeur. */
  private humeur(now: number): Geste | null {
    if (!this.cur) return null
    const a = this.pose(this.cur, this.depart, now)
    const k = (now - this.fond) / FONDU_HUMEUR
    if (this.prev && k < 1 && !this.reduit) return melanger(this.pose(this.prev, this.departPrev, now), a, easings.easeOutQuint(clamp(k)))
    // une couche qui s'ouvre (venue de `null`) entre en fondu depuis le visage de base
    if (!this.prev && k < 1 && !this.reduit && this.fond > -5) {
      const depuis = g({ exp: this.base ?? expr('neutre') })
      return melanger(depuis, a, easings.easeOutQuint(clamp(k)))
    }
    return a
  }

  /**
   * Ecarts a la date `now`, a passer a `engine.sample(now, geste)`. `undefined` = couche inactive :
   * ne rien ajouter (et donc ne rien redessiner de plus qu'avant).
   */
  sample(now: number): Geste | undefined {
    let base = this.humeur(now)
    const a = this.active && !this.finie(this.active, now) ? this.active : null
    const w = this.reduit ? { x: 0, y: 0, w: 0 } : this.regardAtTime(now)
    if (!base && !a && w.w < 0.002) return undefined
    // sans humeur, une reaction part du visage de repos de l'application, sans ecart de corps
    base ??= g({ exp: this.base ?? expr('neutre') })
    let out: Geste = base
    if (a) {
      const u = now - a.debut
      const fin = a.relache === null ? -1 : now - a.relache
      const r = a.def.pose(u, fin)
      const masque = clamp(r.masque ?? r.mix ?? 0)
      // la reaction masque le regard et le rire de l'humeur : un seul visage a la fois
      const calme: Geste = { ...base, ex: (base.ex ?? 0) * (1 - masque), ey: (base.ey ?? 0) * (1 - masque), arc: (base.arc ?? 0) * (1 - masque) }
      out = composer(calme, r.geste)
      const cible = r.exp
      if (cible && base.exp) out.exp = blendExpression(base.exp, cible, clamp(r.mix ?? 1))
      else out.exp = base.exp
    }
    if (w.w > 0.002) {
      // le regard suit le pointeur et remplace la derive de l'humeur
      const fol = easings.easeOutQuint(w.w)
      out = composer(
        { ...out, ex: (out.ex ?? 0) * (1 - 0.9 * fol), ey: (out.ey ?? 0) * (1 - 0.9 * fol) },
        g({ ex: REGARD_X * w.x * w.w, ey: REGARD_Y * w.y * w.w, dx: 0.018 * w.x * w.w, rot: 2.2 * w.x * w.w })
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
export function doitRedessiner(ms: number, dernier: number, fps?: number): boolean {
  if (!fps || fps <= 0 || dernier <= 0) return true
  // une demi-image de marge : rAF tombe rarement pile sur la periode
  return ms - dernier >= 1000 / fps - 1000 / 120
}

/**
 * Moods and interactions: an animation layer for the FACE and the BODY, added on top of the engine (like
 * `gestures.ts`, whose `Gesture` type it reuses).
 *
 * - a MOOD is a work state played on a loop: idle, thinking, working, waiting, done, blocked, asleep. It sets a face
 *   (one
 *   of the expressions of `expressions.ts`, or a close variant) and body and gaze offsets that move over time;
 * - a REACTION is triggered by the user (tap, double tap, long press, shake, arrival), plays once over the mood, then
 *   hands back: the mood resumes without a jump;
 * - HOVER is not an event but tracking: the eyes look at the pointer.
 *
 * Only the face and the body: no star, exclamation mark, orbit or particle.
 *
 * This module has no framework and no clock: every time comes in as a parameter, and `sample(now)` is a function of
 * this timed state, like `BotEngine.setLook`. The offsets it returns (`Gesture`) are applied by `engine.sample(t,
 * gesture)`, so accessories, which read the rendered body, follow every deformation.
 */
import { EXPRESSION_BY_ID, blendExpression, type BotExpression } from './expressions'
import { compose, NEUTRAL_GESTURE, sleepGesture, type Gesture } from './gestures'
import { TAU, clamp, easings, lerp, loopNoise } from './math'
import type { EyeCfg } from './states'

/* ------------------------------------------------------------------ outils */

const smooth = (u: number) => {
  const k = clamp(u)
  return k * k * (3 - 2 * k)
}

/** Smooth interpolation between keys `[time, ...values]` sorted by time. */
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

/** The body rests on the ground: when it squashes, its center goes down by as much. */
const ground = (sy: number) => (1 - sy) * 0.92

/** Duration of the wave's growth, in seconds (the Mochi grows from the ground before saying hello). */
export const WAVE_PUSH = 0.5
/**
 * Growth scale at time `t` (seconds since the wave started): about 3 % -> 107 % -> 100 %, ease-out with a bounce.
 */
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

/** A sharp blink at time `d` (two frames at 12 fps), 1 = open. */
const blinks = (u: number, d: number, duration = 0.2) => {
  const k = (u - d) / duration
  return k < 0 || k > 1 ? 1 : k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
}

/* ------------------------------------------------------------------ moods */

export type MoodId = 'idle' | 'thinking' | 'working' | 'waiting' | 'done' | 'blocked' | 'asleep'

export interface MoodDef {
  id: MoodId
  /** names of the existing states whose meaning it extends (`states.ts`) */
  state: string
  /** loop duration, in seconds: the end falls back on the start */
  period: number
  /** base face (an expression of `expressions.ts` or a variant) */
  expression: BotExpression
  /** offsets at local time `u` (seconds since the start of the loop) */
  pose: (u: number) => Gesture
  /** time at which the pose reads best: still image under `prefers-reduced-motion`, thumbnails */
  signature: number
}

/** The horizontal eyes of a happy eye: the crescent comes from `arc`, not from the shape. */
const CRESCENT = face('happy', 5, 9, 0, 17, pair(0.42, 0.17, 0))

export const MOODS: MoodDef[] = [
  {
    // soft breathing, blinks, a wandering gaze
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
    // looking up, squinting, one eye more closed than the other
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
    // focused: the gaze reads line after line, small regular bounces
    id: 'working',
    state: 'idle',
    period: 4,
    expression: face('attentive', 4, 5, 0, 16, [eye(0.22, 0.34, 5), eye(0.22, 0.34, -5)]),
    signature: 0.55,
    pose: (u) => {
      // one line per second: sweep from left to right, quick return
      const v = u % 1
      const bal = v < 0.82 ? smooth(v / 0.82) : 1 - smooth((v - 0.82) / 0.18)
      // the line goes down then up (0, 1, 2, 1): the loop joins with no sudden return
      const rang = [0, 1, 2, 1]
      const k = Math.floor(u) % 4
      const row = lerp(rang[k]!, rang[(k + 1) % 4]!, smooth((v - 0.82) / 0.18))
      // a bounce every 0.5 s: a short squash, then a small jump
      const p = (u % 0.5) / 0.5
      const jump = Math.sin(Math.PI * p)
      // the impact lands right on the joint: the dip rises before and falls after, with no step
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
    // waiting: looking straight ahead, head tilted, a little impatient
    id: 'waiting',
    state: 'wide',
    period: 4,
    expression: face('attentive', 0, 0, 0, 16.5, [eye(0.25, 0.5, 0), eye(0.25, 0.5, 0)]),
    signature: 0.9,
    pose: (u) => {
      // two small foot taps, then a glance to the side and back
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
    // done: crescent eyes, two small jumps of joy
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

/** Names of existing states and common synonyms, accepted by `resolveMood`. */
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

/** Resolves a mood id (or one of its aliases); `null` if unknown. */
export function resolveMood(id: string | null | undefined): MoodId | null {
  if (!id) return null
  if (MOOD_BY_ID.has(id as MoodId)) return id as MoodId
  return ALIAS[id] ?? null
}

/* ------------------------------------------------------------------ reactions */

export type ReactionId = 'startle' | 'laugh' | 'blush' | 'dizzy' | 'wave'

/** What a reaction gives at local time `u`: offsets, and maybe a face. */
export interface PoseReaction {
  gesture: Gesture
  /** face to glide towards, and how much (0 to 1) */
  exp?: BotExpression
  mix?: number
  /** share of the mood's gaze and laugh that it hides (0 to 1); `mix` by default */
  masque?: number
}

export interface ReactionDef {
  id: ReactionId
  /** user event that triggers it */
  trigger: 'tap' | 'double' | 'long' | 'shaken' | 'arrival'
  /** total duration, or rise duration for a held reaction */
  duration: number
  /** true = stays at its peak while held (long press), then goes down in `exit` s */
  held?: boolean
  exit?: number
  /** `u`: seconds since the trigger; `end`: seconds since the release (held), else -1 */
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
      // the eyes go wide at once, then settle
      const large = clamp(u / 0.04) * (1 - smooth((u - 0.3) / 0.4))
      return { gesture: g({ sy, sx, dy: dy + ground(sy), ew: 1 + 0.32 * large, eh: 1 + 0.26 * large }) }
    }
  },
  {
    // double tap: it laughs, crescent eyes, the body shakes
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
    // long press: it blushes and closes its eyes, happy (held while you press)
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
    // shaken or spun fast: dizzy, the eyes spin, the body sways
    id: 'dizzy',
    trigger: 'shaken',
    duration: 2.3,
    pose: (u) => {
      const env = 1 - smooth((u - 1.1) / 1.2)
      const att = smooth(u / 0.12)
      // angular speed that drops to zero at the end
      const theta = TAU * 2.7 * (u - (u * u) / (2 * 2.3))
      // the spin calms down and stops right at the end: the gaze hands back without a jump
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
    // wave: the Mochi grows from the ground (almost nothing -> 100 %, ease-out with a slight bounce at about 107 %),
    // then a small jump and a hello with the head
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
      // the hello: the head goes to the side twice, like waving a hand
      const fen = smooth((u - 0.7) / 0.15) * (1 - smooth((u - 1.45) / 0.3))
      const hello = Math.sin((u - 0.7) * TAU * 1.9) * fen
      const env = smooth(u / 0.2) * (1 - smooth((u - 1.3) / 0.45))
      // the growth scale multiplies the whole body; the body stays on the ground (the bottom does not move)
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

/** Field by field interpolation of two gestures (missing fields count as neutral). */
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

/** Duration of the fade from one mood to another. */
export const MOOD_FADE = 0.45
/** Duration of the gaze catching up with the pointer (short: it must look attentive). */
export const GAZE_CATCH_UP = 0.2
/** Range of the gaze on the face, in radii. */
export const GAZE_X = 0.15
export const GAZE_Y = 0.125

interface Active {
  def: ReactionDef
  start: number
  /** release time of a held reaction */
  released: number | null
}

/**
 * State of an avatar: its mood, the current reaction, the tracking gaze. Each setter takes the time, `sample(now)`
 * returns the offsets to apply at that instant (or `undefined` when there is nothing to add: with no mood, reaction
 * or tracking, the engine runs as before, to the byte).
 */
export class Moods {
  private cur: MoodId | null
  private prev: MoodId | null = null
  private startPos = 0
  private startPrev = 0
  private background = -10
  private active: Active | null = null
  /** the app's resting face (chosen expression), so the end of a reaction does not jump */
  private base: BotExpression | null = null
  /** gaze: value at the last change, target, and time */
  private gazeOf = { x: 0, y: 0, w: 0 }
  private gazeA = { x: 0, y: 0, w: 0 }
  private gazeAt = -10
  /** true = `prefers-reduced-motion`: still image, no body motion */
  reduced: boolean
  /** 0 to 1: the gaze of `working` turns to the laptop at the bottom right (set by the component) */
  gazeLaptop = 0

  constructor(mood: MoodId | null = null, opts: { reduced?: boolean; base?: BotExpression | null } = {}) {
    this.cur = mood
    this.reduced = opts.reduced ?? false
    this.base = opts.base ?? null
  }

  get mood(): MoodId | null {
    return this.cur
  }

  /** Current reaction (or `null`), for the interface and tests. */
  reaction(now: number): ReactionId | null {
    const a = this.active
    return a && !this.finished(a, now) ? a.def.id : null
  }

  setBase(base: BotExpression | null) {
    this.base = base
  }

  /** Changes the mood; `null` turns the layer off. Face and body glide over `MOOD_FADE`. */
  setMood(id: MoodId | string | null, now: number) {
    const m = typeof id === 'string' ? resolveMood(id) : id
    if (m === this.cur) return
    this.prev = this.cur
    this.startPrev = this.startPos
    this.cur = m
    this.startPos = now
    this.background = now
  }

  /** Triggers a reaction. A reaction that comes over another replaces it. `hold`: waits for `release`. */
  react(id: ReactionId | string, now: number): boolean {
    const def = REACTION_BY_ID.get(id as ReactionId)
    if (!def) return false
    // with reduced motion, only the face state remains: no jump, shake or spin
    if (this.reduced && def.id !== 'blush') return false
    this.active = { def, start: now, released: null }
    return true
  }

  /** Releases a held reaction (end of the long press). */
  release(now: number) {
    const a = this.active
    if (a?.def.held && a.released === null) a.released = now
  }

  /** Pointer over the avatar: `nx`, `ny` between -1 and 1 (right and down positive); `null` to let go. */
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
    // still image: the face stays, the body no longer moves
    const fixed = this.reduced ? { ...p, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, ex: p.ex ? p.ex * 0.5 : p.ex } : p
    return { ...fixed, exp: def.expression }
  }

  /** Gesture of the mood at time `now`, faded from the previous one; `null` without a mood. */
  private moodGesture(now: number): Gesture | null {
    if (!this.cur) return null
    const a = this.pose(this.cur, this.startPos, now)
    const k = (now - this.background) / MOOD_FADE
    if (this.prev && k < 1 && !this.reduced) return mix(this.pose(this.prev, this.startPrev, now), a, easings.easeOutQuint(clamp(k)))
    // a layer that opens (coming from `null`) fades in from the base face
    if (!this.prev && k < 1 && !this.reduced && this.background > -5) {
      const since = g({ exp: this.base ?? expr('neutral') })
      return mix(since, a, easings.easeOutQuint(clamp(k)))
    }
    return a
  }

  /**
   * Offsets at time `now`, to pass to `engine.sample(now, gesture)`. `undefined` = inactive layer: add nothing (and
   * so redraw nothing more than before).
   */
  sample(now: number): Gesture | undefined {
    let base = this.moodGesture(now)
    const a = this.active && !this.finished(this.active, now) ? this.active : null
    const w = this.reduced ? { x: 0, y: 0, w: 0 } : this.gazeAtTime(now)
    if (!base && !a && w.w < 0.002) return undefined
    // without a mood, a reaction starts from the app's resting face, with no body offset
    base ??= g({ exp: this.base ?? expr('neutral') })
    // the laptop is at the bottom right: the gaze goes there a little, without touching the body animation
    if (this.gazeLaptop > 0 && this.cur === 'working') base = { ...base, ex: (base.ex ?? 0) + 0.075 * this.gazeLaptop, ey: (base.ey ?? 0) + 0.04 * this.gazeLaptop }
    let out: Gesture = base
    if (a) {
      const u = now - a.start
      const end = a.released === null ? -1 : now - a.released
      const r = a.def.pose(u, end)
      const masque = clamp(r.masque ?? r.mix ?? 0)
      // the reaction hides the mood's gaze and laugh: one face at a time
      const calm: Gesture = { ...base, ex: (base.ex ?? 0) * (1 - masque), ey: (base.ey ?? 0) * (1 - masque), arc: (base.arc ?? 0) * (1 - masque) }
      out = compose(calm, r.gesture)
      const target = r.exp
      if (target && base.exp) out.exp = blendExpression(base.exp, target, clamp(r.mix ?? 1))
      else out.exp = base.exp
    }
    if (w.w > 0.002) {
      // the gaze follows the pointer and replaces the mood's drift
      const fol = easings.easeOutQuint(w.w)
      out = compose(
        { ...out, ex: (out.ex ?? 0) * (1 - 0.9 * fol), ey: (out.ey ?? 0) * (1 - 0.9 * fol) },
        g({ ex: GAZE_X * w.x * w.w, ey: GAZE_Y * w.y * w.w, dx: 0.018 * w.x * w.w, rot: 2.2 * w.x * w.w })
      )
    }
    return out
  }
}

/**
 * Cadence: should we redraw at `ms`? Caps an avatar's loop at `fps` frames per second (the dashboard shows up to 70
 * in a single WebGL context at 12 fps). `fps` zero or absent = every browser frame.
 */
export function mustRedraw(ms: number, last: number, fps?: number): boolean {
  if (!fps || fps <= 0 || last <= 0) return true
  // half a frame of margin: rAF rarely lands exactly on the period
  return ms - last >= 1000 / fps - 1000 / 120
}

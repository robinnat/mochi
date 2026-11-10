/**
 * Gesture layer: small animations ADDED on top of the engine's pose.
 *
 * The engine reproduces the reference video: its constants are measurements. Gestures are chosen SETTINGS (not
 * measurements), optional, and kept apart so they change nothing in the original rendering: `engine.sample(t)`
 * without a gesture stays identical to the byte (a test locks it). Usage: `engine.sample(t, idleGesture(t, seed))`.
 *
 * Everything is pure, a function of time and a seed: same frame on every playback, no state, no clock. Amplitudes are
 * small (a few percent of the radius): a waiting avatar stays calm; variety and timing offsets make the personality.
 */
import { TAU, clamp, createRng, easings, loopNoise } from './math'
import type { BotExpression } from './expressions'
import type { StateId } from './states'

/** Offsets applied by `sample()`: moves in ball radii, scales, angles in degrees. */
export interface Gesture {
  /** body and eye offset, in radii */
  dx: number
  dy: number
  /** body scales (1 = unchanged) */
  sx: number
  sy: number
  /** aim offsets, in degrees */
  yaw: number
  pitch: number
  roll: number
  /** maximum eyelid: 1 = leave it to the engine, 0 = closed */
  lid: number
  /*
   * FACE layer (moods, `moods.ts`). Everything is optional and ABSENT from the neutral gesture: a gesture that does
   * not touch it gives the same frame as before, to the byte.
   */
  /** absolute face: replaces the eyes and their gap (the aim stays the engine's) */
  exp?: BotExpression
  /** eye width and height multipliers (1 = unchanged) */
  ew?: number
  eh?: number
  /** added tilt, in degrees, MIRRORED between both eyes (positive = the tops converge) */
  tilt?: number
  /** 0 = capsule, 1 = crescent open downwards (happy eye) */
  arc?: number
  /** eye offset in the face plane, in radii (gaze) */
  ex?: number
  ey?: number
  /** cheek tint, 0 to 1 */
  cheeks?: number
  /** tilt of the body AND the face, in degrees, positive = to the right (head tilted) */
  rot?: number
}

export const NEUTRAL_GESTURE: Readonly<Gesture> = Object.freeze({ dx: 0, dy: 0, sx: 1, sy: 1, yaw: 0, pitch: 0, roll: 0, lid: 1 })

const g = (p: Partial<Gesture>): Gesture => ({ ...NEUTRAL_GESTURE, ...p })

/** Composes two gestures: offsets and angles add up, scales multiply, eyelid at its most closed. */
export function compose(a: Gesture, b: Gesture): Gesture {
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
  // face layer: only if one of the two carries it
  const exp = b.exp ?? a.exp
  if (exp) out.exp = exp
  for (const k of ['ew', 'eh'] as const) if (a[k] !== undefined || b[k] !== undefined) out[k] = (a[k] ?? 1) * (b[k] ?? 1)
  for (const k of ['tilt', 'ex', 'ey', 'rot'] as const) if (a[k] !== undefined || b[k] !== undefined) out[k] = (a[k] ?? 0) + (b[k] ?? 0)
  for (const k of ['arc', 'cheeks'] as const) if (a[k] !== undefined || b[k] !== undefined) out[k] = Math.max(a[k] ?? 0, b[k] ?? 0)
  return out
}

/** true if the gesture carries part of the face layer. */
export const hasFace = (g: Gesture) =>
  g.exp !== undefined || g.ew !== undefined || g.eh !== undefined || g.tilt !== undefined || g.arc !== undefined ||
  g.ex !== undefined || g.ey !== undefined || g.cheeks !== undefined || g.rot !== undefined

/** Bell 0 -> 1 -> 0 on [0, 1], soft at both ends. */
const cloche = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2)

// ---------------------------------------------------------------- waiting gestures

export type IdleGestureId = 'blink' | 'breathe' | 'jump' | 'balance' | 'gaze' | 'nod' | 'stretch'

interface GestureDef {
  id: IdleGestureId
  /** duration in seconds */
  duration: number
  /** pose at local time u (seconds since the start of the gesture) */
  pose: (u: number) => Gesture
}

export const IDLE_GESTURES: GestureDef[] = [
  // double clignement appuye
  {
    id: 'blink',
    duration: 0.55,
    pose: (u) => {
      const k = (v: number) => (v < 0 || v > 0.18 ? 1 : Math.abs((v / 0.18) * 2 - 1))
      return g({ lid: Math.min(k(u), k(u - 0.3)) })
    }
  },
  // deep breath: the body inflates a little, then relaxes
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
  // head nod
  { id: 'nod', duration: 1.2, pose: (u) => { const e = cloche(u / 1.2); return g({ pitch: 9 * Math.sin((u / 0.4) * TAU) * e, dy: 0.01 * e }) } },
  // upward stretch
  { id: 'stretch', duration: 1.6, pose: (u) => { const c = cloche(u / 1.6); return g({ sx: 1 - 0.035 * c, sy: 1 + 0.06 * c, dy: -0.03 * c, lid: 1 - 0.5 * c }) } }
]

export const IDLE_GESTURE_BY_ID = new Map(IDLE_GESTURES.map((d) => [d.id, d]))

/** Schedule: one gesture per `WINDOW` s window, at an offset drawn in [0, SET[ -> 4 to 12 s apart. */
const WINDOW = 8
const SET = 4

/** Three favorite gestures per seed (the personality), a fourth, rarer one. */
export function personality(seed: number): IdleGestureId[] {
  const rng = createRng(seed ^ 0x9e3779b9)
  const ids = IDLE_GESTURES.map((d) => d.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  }
  return ids.slice(0, 4)
}

/** Gesture of window `k` for a seed: start time and id. O(1), stateless. */
export function gestureOfWindow(seed: number, k: number): { start: number; id: IdleGestureId } {
  const rng = createRng(Math.imul(seed | 0, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35))
  const prefs = personality(seed)
  const r = rng()
  // weights 0.35 / 0.3 / 0.25 / 0.1: favorite gestures come back more often
  const id = r < 0.35 ? prefs[0]! : r < 0.65 ? prefs[1]! : r < 0.9 ? prefs[2]! : prefs[3]!
  return { start: k * WINDOW + rng() * SET, id }
}

/**
 * Waiting gesture at time t: neutral between two gestures. The first gesture comes after 4 s at least.
 */
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

// ---------------------------------------------------------------- touch bounce

/** Duration of the touch bounce. */
export const BOUNCE_DURATION = 0.7

/**
 * Bounce when the avatar is touched: a squash, then a small damped spring (u: seconds since the touch).
 */
export function bounce(u: number): Gesture {
  if (!(u >= 0) || u > BOUNCE_DURATION) return { ...NEUTRAL_GESTURE }
  const v = u / BOUNCE_DURATION
  const damped = Math.exp(-4.5 * v) * Math.cos(v * TAU * 1.6)
  return g({ sx: 1 + 0.07 * damped, sy: 1 - 0.09 * damped, dy: 0.02 * Math.max(0, damped) - 0.05 * cloche(v / 0.6) })
}

// ---------------------------------------------------------------- sleep and failure

/** Sleep: slow, deep breathing, eyes closed, body a little squashed. */
export function sleepGesture(t: number): Gesture {
  const breath = 0.5 - 0.5 * Math.cos((t / 4.6) * TAU)
  return g({ sx: 1 + 0.012 * breath, sy: 0.97 + 0.03 * breath, dy: 0.02 - 0.012 * breath, pitch: -6, roll: -4, lid: 0.04 })
}

/** Small sleep "z": positions in radii (drawn by the client), rising and fading. */
export function sleepZ(t: number, n = 2): Array<{ x: number; y: number; size: number; opacity: number }> {
  const out = []
  const period = 3.2
  for (let i = 0; i < n; i++) {
    const v = (((t / period + i / n) % 1) + 1) % 1
    out.push({
      x: 0.62 + 0.18 * v + 0.04 * Math.sin(v * TAU),
      y: -0.55 - 0.45 * v,
      size: 0.16 + 0.1 * v,
      opacity: clamp(v / 0.2) * clamp((1 - v) / 0.35) * 0.8
    })
  }
  return out
}

/** Failure: slumped, head down, slow sigh. */
export function gestureFailure(t: number): Gesture {
  const sigh = 0.5 - 0.5 * Math.cos((t / 5.2) * TAU)
  return g({ sx: 1.03 + 0.01 * sigh, sy: 0.94 - 0.015 * sigh, dy: 0.04 + 0.01 * sigh, pitch: -8 - 3 * sigh, roll: 3 })
}

// ---------------------------------------------------------------- activities (at work)

export type ActivityId = 'reflection' | 'typing' | 'sweep'

export interface Activity {
  id: ActivityId
  /** engine state played on a loop */
  state: StateId
  /** loop duration in seconds: we read `sample(startPos + t % loop)` */
  loop: number
  /** added gesture, a function of global time */
  gesture: (t: number) => Gesture
}

/**
 * "At work" activities: each one reads as work in progress (an engine state or a busy gaze), but differs from the
 * others. The app picks which one goes with which role.
 */
export const ACTIVITIES: Activity[] = [
  // three pulsing dots, with a slight nod: writing or thinking
  { id: 'reflection', state: 'thinking', loop: 2.6, gesture: (t) => g({ dy: 0.012 * Math.sin((t / 1.3) * TAU) }) },
  // small quick taps, gaze down to the keyboard
  {
    id: 'typing',
    state: 'idle',
    loop: 2.4,
    gesture: (t) => {
      const tap = Math.max(0, Math.sin((t / 0.22) * TAU)) * (0.6 + 0.4 * Math.sin((t / 1.7) * TAU) ** 2)
      // amplitude chosen to stay visible at 48 px (a tap = 3 % of the radius)
      return g({ pitch: 16, yaw: 7 * loopNoise(t, 3.1, 0.5), dy: 0.03 * tap, sx: 1 + 0.015 * tap, sy: 1 - 0.03 * tap })
    }
  },
  // reading: the gaze sweeps from left to right, line after line
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

/** Time to read in the engine for an activity: a seamless loop, offset by a seed. */
export function timeActivity(a: Activity, t: number, startPos = 0.6): number {
  return startPos + (((t % a.loop) + a.loop) % a.loop)
}

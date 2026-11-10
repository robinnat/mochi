import { clampDuration, makeBlock, type Block } from '@/bot/cycles'
import { SPIN_TIME, turnLook } from './gaze'

/**
 * The arrival on the site: the ball appears alone in the center of the page, the eyes go a full turn around it and
 * settle in the middle (it seems to spin on itself), then it slides to its place while the interface appears around
 * it.
 *
 * Pure, like `gaze.ts` and `timeline.ts`: the montage and the trigger rule are decided here and tested with no DOM or
 * component. `App.ts` only plugs them in, the staging itself being CSS (`.scene--alone`, `.avatar--intro` in
 * `styles.css`).
 */

/**
 * The montage. Two IDLE blocks and nothing else: the whole entry lives in the gaze script, not in a chain of states.
 *
 * It comes from a comparison (four entries were tried side by side) and the lesson is worth keeping: **any state
 * other than idle brings its own gaze pose, so an eye jump at the change**. The blink meant to hide it lasts only 0.2
 * s while the entry fade lasts 0.3: the eyes open again mid-way and it reads as a teleport, 15 px between two frames.
 * A wink was tried here at length; it was ruled out for that reason.
 *
 * Both blocks therefore carry the same state, with three wanted effects: no silhouette morph (the chosen shape shows
 * from start to end), no gaze jump, and since `idle` is the only `baseFace` state, the ball already appears with the
 * expression the user set.
 *
 * The first block lasts a little longer than the turn, so it has time to end before the ball leaves for its place.
 */
export const INTRO: Block[] = [
  { state: 'idle', duration: clampDuration('idle', SPIN_TIME + 0.3) },
  makeBlock('idle')
]

/**
 * Index of the block from which the ball joins its place and the interface appears. Zero = it is still alone on
 * stage.
 */
export const POSE_AT = 1

/** What the eyes do during the arrival. See `turnLook` in `./gaze`. */
export const INTRO_GAZE = turnLook

/** What the app knows about the arrival when it decides. */
export interface Arrival {
  /** the URL names a state (`#state=`) */
  named: boolean
  /** the URL asks for the sheet (`#sheet`) */
  gallery: boolean
  /** coming back to a page already open: reload, or back/forward */
  reload: boolean
  /** the user asked for less animation */
  calm: boolean
}

/**
 * Does the arrival play? Four refusals, each for a different reason:
 *
 * - `named`: a `#state=` link aims at the PLAYER and already describes its playback. Forcing a home staging on it
 *   means
 *   not opening what it asks for.
 * - `gallery`: the sheet is a visual check tool, it must stay the safe path that depends on nothing.
 * - `reload`: that is the request itself: an introduction, not a loading animation. So it plays on every COMING to
 *   the
 *   site (typed URL, followed link, new tab) but never when landing again on a page already open: reload, back,
 *   forward.
 *   Nothing is written to storage: the distinction is the browser's, not a memory of ours, which avoids a single
 *   visit
 *   turning the arrival off forever.
 * - `calm`: `prefers-reduced-motion` explicitly asks not to play a decorative animation.
 *
 * `#arrival` bypasses it all: it is the link used to see it again.
 */
export function introDue({ named, gallery, reload, calm }: Arrival): boolean {
  return !named && !gallery && !reload && !calm
}

import { DOT_PEAK, DOT_R, DOT_X, RINGS, type ArcSpec, type DotRender } from './decor'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE, type HeadGaze } from './face'
import { TAU, clamp, easings } from './math'
import { circle, type Silhouette } from './shape'

export interface EyeCfg {
  /** local width (short axis of the capsule), in ball radius units */
  w: number
  /** hauteur locale (axe long) */
  h: number
  /** 1 = ouvert, 0 = ferme */
  open: number
  /**
   * Own tilt of the capsule, in degrees, positive = the top leans right. Applied AFTER the sphere's tangent frame.
   * Without it, both eyes always lean the same way (head roll), and anger and sadness, which need mirrored tilts, are
   * out of reach.
   */
  tilt?: number
}

export interface Pose {
  /** body silhouette, in ball radius units */
  sil: Silhouette
  /** global offset of the body AND the eyes */
  offX: number
  offY: number
  gaze: HeadGaze
  /** half gap of the eyes on the sphere, in degrees */
  split: number
  /** [inner eye, outer eye] */
  eyes: [EyeCfg, EyeCfg]
  /** eye opacity: used by states without a face */
  eyeAlpha: number
  bodyAlpha: number
  dots: DotRender[]
  arcs: ArcSpec[]
}

const pair = (w: number, h: number): [EyeCfg, EyeCfg] => [
  { w, h, open: 1 },
  { w, h, open: 1 }
]

function base(over: Partial<Pose> = {}): Pose {
  return {
    sil: circle(1),
    offX: 0,
    offY: 0,
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: pair(EYE_W, EYE_H),
    eyeAlpha: 1,
    bodyAlpha: 1,
    dots: [],
    arcs: [],
    ...over
  }
}

/* ------------------------------------------------------------------ states */

export type StateId =
  | 'idle'
  | 'thinking'
  | 'wink'
  | 'wide'
  | 'sleep'
  /** interface transition, not a catalog animation: outside `SEQUENCE` */
  | 'swirl'

export interface StateDef {
  id: StateId
  /** hold duration when the full sequence plays */
  duration: number
  /**
   * duration below which the animation is cut before it completes: the "!" does not come back, the body stays burst.
   * It is read off the `pose` constants below, it is not chosen. Absent = the state ignores time or loops, any
   * duration fits (see `MIN_BLOCK`).
   */
  minDuration?: number
  /** duration of the entry morph */
  morph: number
  /** true = the entry is hidden by a blink, as in the video */
  blinkIn: boolean
  /**
   * true = the body is the "resting" silhouette, so it can be replaced by the shape chosen in the customizer. States
   * that draw their own shape (the three dots of `thinking`, the small ball of `sleep`) are false: that shape IS the
   * animation.
   */
  baseBody: boolean
  /**
   * true = the state carries the "resting" face, so it can be replaced by the chosen expression. Only `idle`: the
   * other states with a face have an expression measured on the video, which is exactly what we reproduce.
   */
  baseFace: boolean
  pose(local: number): Pose
}

/** Pulse wave running through the three dots from left to right. */
function dotPulse(t: number, index: number): number {
  const p = ((((t - index * 0.5) / 1.5) % 1) + 1) % 1
  const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0
  return clamp(k * 2)
}

export const STATES: StateDef[] = [
  {
    id: 'idle',
    duration: 2.4,
    morph: 0.45,
    blinkIn: false,
    baseFace: true,
    baseBody: true,
    pose: () => base()
  },

  {
    id: 'thinking',
    duration: 2.6,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: (t) => {
      const mid = dotPulse(t, 1)
      // The side dots come out of the ball's flanks: in the video they
      // stay merged with it for 1-2 frames before they detach.
      const emerge = 0.3 + 0.7 * easings.easeOutCubic(clamp(t / 0.3))
      return base({
        // the ball BECOMES the middle dot: the morph stays continuous
        sil: circle(DOT_R * (1 + (DOT_PEAK - 1) * mid), { cx: DOT_X[1]! }),
        eyeAlpha: 0,
        dots: [0, 2].map((i) => {
          const k = dotPulse(t, i)
          return {
            x: DOT_X[i]! * emerge,
            y: 0,
            r: DOT_R * (1 + (DOT_PEAK - 1) * k),
            opacity: 0.55 + 0.45 * k
          }
        })
      })
    }
  },

  {
    id: 'wink',
    duration: 1.6,
    morph: 0.3,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: () =>
      base({
        gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 },
        split: 16.25,
        // The closed eye is not the open eye squashed: it is a horizontal dash
        // WIDER than the open eye (0.447 against 0.236).
        eyes: [
          { w: 0.236, h: 0.464, open: 1 },
          { w: 0.447, h: 0.089, open: 1 }
        ]
      })
  },

  {
    id: 'wide',
    duration: 1.8,
    morph: 0.55,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: () =>
      base({
        gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
        split: 18.43,
        eyes: pair(0.356, 0.875)
      })
  },




  {
    id: 'sleep',
    duration: 2.4,
    morph: 0.5,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) =>
      base({
        // Measured vertical bounce: +-0.19 around +0.11, period 0.6 s.
        sil: circle(0.1585, { cy: 0.11 + Math.sin(t * (TAU / 0.6)) * 0.19 }),
        eyeAlpha: 0
      })
  },





  {
    /**
     * Entry into the settings tab.
     *
     * The ONLY state not measured on the video: it is CHOSEN, like the `--ink` color. It uses rings whose parameters
     * come from the old orbit animation (removed from the catalog): 1 s, six rings of which three are kept, and no
     * triangle.
     *
     * Both flags set to `true` are the whole point of this state:
     *
     * - `baseBody` lets the chosen shape replace the body, so the tab can force the circle, and the pebble or the
     *   drop MORPH
     *   into it instead of jumping;
     * - `baseFace` carries the resting face, so cursor tracking applies from this entry on. A state with its own gaze
     *   pose
     *   (like `thinking`) would hand over to the next state mid-course, and the eyes would jump on resume.
     *
     * It is NOT in `SEQUENCE` on purpose: it is not a catalog animation, it is an interface transition.
     */
    id: 'swirl',
    // a little longer than the gaze turn (`TURN_TIME`, 1.1 s): the eyes must
    // be set on the left before the rings fade
    duration: 1.3,
    minDuration: 1.3,
    morph: 0.3,
    baseFace: true,
    baseBody: true,
    // the shape morph is hidden by a blink, like everywhere else
    blinkIn: true,
    pose: (t) =>
      base({
        // three rings out of the six of `RINGS`: half the bunch is enough to
        // recognize it, and that is fewer arcs to rasterize per frame
        arcs: RINGS.slice(0, 3).map((s, i) => ({
          id: `sw${i}`,
          seed: s,
          t,
          // they come in one after the other, then fade before the end of the block,
          // so idle resumes on a frame that is already clean
          opacity: clamp((t - i * 0.06) / 0.14) * clamp((1.22 - t) / 0.34)
        }))
      })
  },


]

export const STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]))

/** Playback order of the full sequence, copied from the reference video. */
/**
 * Local time at which each state reads best: the pose shown by thumbnails and sheets. Deterministic rendering, so
 * comparable from run to run. The type forces every new state to be covered.
 */
export const POSES: Record<StateId, number> = {
  idle: 1,
  thinking: 1.1,
  wink: 0.8,
  wide: 0.8,
  sleep: 0.45,
  swirl: 0.5
}

export const SEQUENCE: StateId[] = ['idle', 'thinking', 'wink', 'wide', 'sleep']

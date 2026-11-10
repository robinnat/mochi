import type { Look } from '@/bot/engine'
import type { ExpressionId } from '@/bot/expressions'
import { clamp, easings } from '@/bot/math'

/**
 * Where the bot looks when it follows the cursor. Pure, like `src/ui/timeline.ts`: the pointer position comes in
 * already normalized, so the rule is tested without a DOM (and it needs to be, because two signs are easy to get
 * wrong).
 */

/**
 * Head orientation angles in degrees. CHOSEN, not measured: the reference video shows no cursor tracking. Wide enough
 * to stand out from the resting drift (±7deg yaw, ±5.5 pitch), restrained enough that no eye goes behind the sphere's
 * limb.
 */
export const YAW_MAX = 16
export const PITCH_MAX = 13

/**
 * Height at which the gaze stays, cursor in the center. CHOSEN: slightly above the equator, which gives an attentive
 * bot rather than an absent one.
 *
 * It is an ABSOLUTE value, and that is the point: relative, the eye height followed each expression's, and since
 * "neutral" looks at +28.6deg while moods are between -9 and +9, the eyes dropped at once on the first mood change.
 */
export const PITCH = 10

/**
 * Direction the head settles to in the settings tab: the bot stops looking at the top right (its resting pose) to
 * look LEFT, towards the panel.
 *
 * It is not a mirror of the image: the eyes really go around the sphere, so they keep their `\\` tilt and their depth
 * compression. Flipping the image would have laid them as `//`.
 */
export const TURN = 26

/**
 * Full turn travelled ON THE WAY: the eyes do not slide across the face, they go around the ball before arriving.
 *
 * It comes for free because the eyes live on a sphere: past 90deg of yaw they cross the limb, the engine removes them
 * from the frame, then they reappear on the other side. The swirl is not an effect laid on top, it is the same
 * orthographic projection pushed by a turn.
 *
 * And above all: it LANDS RIGHT by construction, `-360deg` being the same angle as `0`. That sets it apart from a
 * gaze pose written in a state, which leaves the eyes wherever its curve ends.
 */
export const SPIN = 360

/**
 * Duration of the turn. A little shorter than the entry block (`swirl`): the eyes must be set on the left before the
 * rings fade.
 */
export const TURN_TIME = 1.1

/**
 * Moods the bot goes through while it follows the cursor.
 *
 * They all have ZERO ROLL, and that is the selection criterion. Yaw and pitch are neutralized by tracking (they are
 * absolute), but not roll: it tilts the head, so it moves the eyes vertically, and a mood at -15deg followed by one
 * at +8 makes them jump. What remains to tell moods apart is the SHAPE of the eyes: round, squinted, wide, flattened.
 * That is plenty, and it is what reads.
 *
 * So it is not a list of tastes: adding "curious" (roll -15deg) would bring the jump back.
 */
export const MOODS: readonly ExpressionId[] = [
  'surprised',
  'happy',
  'laughing',
  'excited',
  'proud',
  'unimpressed'
]

/* ------------------------------------------------ arrival gazes */

/**
 * A SCRIPTED gaze: evaluated every frame with the time elapsed since the start of the arrival, in seconds. The script
 * carries its own clock and can chain several moves: the component only evaluates it and has no duration to know.
 *
 * RULE, and it is what makes a script maintenance-free: it must END at `mix: 0`, where the state's pose drives alone.
 * Then there is never anything to release, and that release (which would show as a last slide of the eyes, right when
 * everything should be settled) does not exist.
 *
 * The type stays general though there is only one script today: four were written and compared side by side before
 * keeping one, and this form let us try them without touching the engine.
 */
export type GazeScript = (t: number) => Look

/**
 * "The turn": the ball seems to spin on itself.
 *
 * `mix` stays at ZERO from start to end: no direction is forced, only `spin` fades, which takes the eyes BEHIND the
 * ball before bringing them back exactly where the chosen expression puts them.
 *
 * Ease-in-OUT and not the exponential ease-out of the rest of the project: it is not a value that settles, it is an
 * object that turns. With an ease-out, two thirds of the turn were swallowed in 0.3 s: a jolt, not a rotation.
 *
 * It is FAST when crossing the limb (20 px between two frames on a ball of radius 100) and that is not a tuning flaw:
 * near the edge, a small angle becomes a big move on screen, and the eye disappears then reappears on the other side.
 * Slowing down changes nothing, the path wants it, and that is exactly what makes the effect. Do not try to soften
 * it.
 *
 * Essential consequence: this turn only plays on a CIRCLE. The eyes are stuck back onto the real outline
 * (`radiusAtAngle`), so on a non circular shape they follow the profile while turning and jitter. See `shape` in
 * `App.ts`.
 */
export const SPIN_TIME = 1.5

export const turnLook: GazeScript = (t) => ({
  yaw: 0,
  pitch: 0,
  mix: 0,
  spin: SPIN * (1 - easings.easeInOutCubic(clamp(t / SPIN_TIME))),
  wander: 1
})

export interface Aim {
  /** horizontal offset of the pointer from the bot's center, -1 to 1 (right positive) */
  nx: number
  /** vertical offset, -1 to 1, in screen direction (down positive) */
  ny: number
  /** progress of the arrival, 0 to 1 */
  turn: number
  /** false = no known pointer: the head stays turned, but it lives again */
  pointer: boolean
}

/**
 * Gaze target.
 *
 * `turn` drives everything: it raises the hold on the pose (`mix`) and fades the travelled turn (`spin`) at the same
 * time. At 0 the state's pose drives alone; at 1 the head is set to the left and follows the cursor.
 *
 * Nothing here compensates for the displayed expression: the engine mixes, because only it knows the pose at time t.
 * Doing it here would mean reading the expression's FINAL yaw while the engine is still morphing, and the eyes jumped
 * at every mood change.
 */
export function lookTarget({ nx, ny, turn, pointer }: Aim): Look {
  return {
    yaw: -TURN + nx * YAW_MAX,
    // positive pitch = looking up, while screen y goes down
    pitch: PITCH - ny * PITCH_MAX,
    mix: turn,
    spin: SPIN * (1 - turn),
    // Without a pointer the head stays turned towards the panel, but its drift
    // comes back: otherwise the bot stares at a dead point, and arriving by keyboard or
    // touch gave a fully still avatar.
    wander: pointer ? 0 : 1
  }
}

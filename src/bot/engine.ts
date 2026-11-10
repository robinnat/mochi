import { arcRender, type ArcRender, type DotRender } from './decor'
import { blendExpression, type BotExpression } from './expressions'
import { eyeOffset } from './eyefit'
import { blinkScale, eyePoses, liveliness } from './face'
import { clamp, easings, lerp, r2 } from './math'
import {
  arcPath,
  blend,
  capsulePath,
  closedPath,
  radiusAtAngle,
  toPoints,
  type Point,
  type Silhouette
} from './shape'
import { STATE_BY_ID, type Pose, type StateDef, type StateId } from './states'
import { hasFace, type Gesture } from './gestures'

export interface RenderedEye {
  d: string
  matrix: string
  alpha: number
  /**
   * For the 3D (eyes facing front, `scene3d.ts`), only when a gesture carries the face layer: eyelid squash (1 =
   * open), own tilt in degrees, gaze offset in the face plane (viewBox units). Absent otherwise: the previous
   * rendering is untouched.
   */
  k?: number
  tilt?: number
  gx?: number
  gy?: number
}

export interface BotFrame {
  bodyPath: string
  bodyAlpha: number
  eyes: RenderedEye[]
  dots: DotRender[]
  arcs: ArcRender[]
  /** face layer of the moods, present only if the gesture carries it */
  face?: {
    /** head tilt, in degrees */
    rot: number
    /** cheek tint, 0 to 1 */
    cheeks: number
  }
}

/**
 * Where the bot looks when something outside drives it (the mouse pointer, today).
 *
 * `yaw` and `pitch` are ABSOLUTE directions, which replace those of the pose as `mix` rises. Two reasons, each a trap
 * we already fell into:
 *
 * - the ENGINE must do this mix, not the caller, because only the engine knows the pose AT THIS INSTANT. A caller
 *   that
 *   compensated for the expression's orientation would read its end value while the morph is still running, and the
 *   eyes jumped at every mood change;
 * - it must be absolute on BOTH axes. Relative, the eye height followed each expression's ("neutral" looks at
 *   +28.6deg
 *   while the others are between -9 and +9), so the eyes dropped at once on the first mood change. What gives an
 *   expression its character during tracking is the SHAPE of its eyes (squinted, round, uneven), not where it looks:
 *   the cursor decides that.
 *
 * `mix` says how much the outside drives the DIRECTION (0 = not at all).
 *
 * `wander` says, separately, how much automatic drift remains. The two are not the same: when the pointer moves, the
 * drift must stop (both together, the bot would seem to look for the cursor without ever holding it). But when there
 * is NO pointer (arrival by keyboard, touch, or mouse out of the window), the head must stay turned AND keep living.
 * Mixing them up froze the gaze as soon as the tab opened.
 *
 * `spin` is a turn to travel ON THE WAY, in degrees, faded to 0 as it arrives. Since the eyes live on a sphere, a
 * turn takes them behind the ball and back on the other side; and as `-360deg` is the same angle as `0`, it does not
 * change where they land.
 */
export interface Look {
  yaw: number
  pitch: number
  mix: number
  spin: number
  wander: number
}

const NO_LOOK: Look = { yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 }

const lerpLook = (a: Look, b: Look, t: number): Look => ({
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  mix: lerp(a.mix, b.mix, t),
  spin: lerp(a.spin, b.spin, t),
  wander: lerp(a.wander, b.wander, t)
})

const lerpEye = (a: Pose['eyes'][number], b: Pose['eyes'][number], t: number) => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  open: lerp(a.open, b.open, t),
  tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t)
})

/** Interpolation of two poses. Decor crossfades in opacity, not in geometry. */
function blendPose(a: Pose, b: Pose, t: number): Pose {
  const out = 1 - t
  return {
    sil: blend(a.sil, b.sil, t),
    offX: lerp(a.offX, b.offX, t),
    offY: lerp(a.offY, b.offY, t),
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
    eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
    bodyAlpha: lerp(a.bodyAlpha, b.bodyAlpha, t),
    dots: [
      ...a.dots.map((d) => ({ ...d, opacity: d.opacity * out })),
      ...b.dots.map((d) => ({ ...d, opacity: d.opacity * t }))
    ],
    arcs: [
      ...a.arcs.map((r) => ({ ...r, id: `a${r.id}`, opacity: r.opacity * out })),
      ...b.arcs.map((r) => ({ ...r, id: `b${r.id}`, opacity: r.opacity * t }))
    ]
  }
}

/**
 * Engine without a clock: `sample(t)` is a pure function of time.
 *
 * In practice: pause, resume, slow motion and jumping to any time give exactly the same frame, and rendering can be
 * tested without a DOM.
 */
export class BotEngine {
  /** radius of the ball at rest, in viewBox units */
  readonly scale: number

  private cur: StateId
  private prev: StateId | null = null
  /**
   * FROZEN start pose, set only when a state change arrives while a fade is already running. See `setState`.
   */
  private startFrozen: Pose | null = null
  private tCur = 0
  private tPrev = 0
  private blinkAt = -10
  private pts: Point[] = []
  private shape: number[] | null = null
  private shapePrev: number[] | null = null
  private shapeAt = -10
  private expr: BotExpression | null = null
  private exprPrev: BotExpression | null = null
  private exprAt = -10
  private look: Look = NO_LOOK
  private lookPrev: Look = NO_LOOK
  private lookAt = -10
  /** current catch-up duration; see `LOOK_MORPH`, its default */
  private lookMorph = 0.24

  /** morph duration when the body shape changes */
  static readonly SHAPE_MORPH = 0.45

  /**
   * Catch-up duration of the gaze towards its target. Shorter than `SHAPE_MORPH`: a tracking gaze must look
   * attentive, not sluggish. Since the target is set again at each mouse move, this duration gives tracking its
   * inertia: the gaze never quite reaches a moving cursor.
   */
  static readonly LOOK_MORPH = 0.24

  constructor(
    scale = 100,
    initial: StateId = 'idle',
    shape: number[] | null = null,
    expression: BotExpression | null = null
  ) {
    this.scale = scale
    this.cur = initial
    this.shape = shape
    this.expr = expression
  }

  /**
   * Resting expression chosen in the customizer. Like the shape, it glides to the new value instead of jumping.
   */
  setExpression(expression: BotExpression | null, now = 0) {
    if (expression === this.expr) return
    this.exprPrev = this.expr
    this.expr = expression
    this.exprAt = now
  }

  /** Expression effective a l'instant `now`, morph en cours compris. */
  private exprAtTime(now: number): BotExpression | null {
    const to = this.expr
    const from = this.exprPrev
    if (!to || !from) return to
    const k = (now - this.exprAt) / BotEngine.SHAPE_MORPH
    if (k >= 1) return to
    return blendExpression(from, to, easings.easeOutQuint(clamp(k)))
  }

  /**
   * Shape chosen in the customizer. It only replaces the body on resting states (`baseBody`): on the others, the
   * silhouette IS the animation and must not be overwritten.
   *
   * The change is a morph, not a jump: since every shape is sampled at the same angles, interpolating the radii is
   * enough.
   */
  setShape(radii: number[] | null, now = 0) {
    if (radii === this.shape) return
    this.shapePrev = this.shape
    this.shape = radii
    this.shapeAt = now
  }

  /**
   * Effective shape at time `now`, including a running morph.
   *
   * Does NOT reset `shapePrev` to null at the end of the morph: `sample` must stay a pure function of time, so
   * reading a past time again must give the in-between frame. We just keep one more reference.
   */
  private shapeAtTime(now: number): number[] | null {
    const to = this.shape
    const from = this.shapePrev
    if (!to || !from) return to
    const k = (now - this.shapeAt) / BotEngine.SHAPE_MORPH
    if (k >= 1) return to
    const t = easings.easeOutQuint(clamp(k))
    // allocated only during the morph; outside it we return the array as is
    return to.map((r, i) => lerp(from[i] ?? r, r, t))
  }

  /**
   * New gaze target, `null` to go back to the state's own.
   *
   * It starts from the CURRENT value, not from the previous target like `setShape`: this method is called on every
   * pointer move, and starting from the old target would pull the gaze back one notch before each catch-up: tracking
   * would shake instead of gliding.
   *
   * Same contract as `setShape` otherwise: outside state comes in through a timed setter, never through a variable
   * read during `sample`, or the engine stops being a pure function of time.
   */
  setLook(look: Look | null, now: number, morph = BotEngine.LOOK_MORPH) {
    /*
     * A non-finite target is refused. The engine KEEPS the last one: a `NaN` set once would spread to every frame and
     * the bot would never rest again. It really happened (a `getBoundingClientRect` on a zero-size box gives `0 / 0`
     * in the caller). That caller is fixed, but the engine must not rely on its callers' care to stay replayable.
     */
    if (look && !Number.isFinite(look.yaw + look.pitch + look.mix + look.spin + look.wander)) {
      return
    }
    this.lookPrev = this.lookAtTime(now)
    this.look = look ?? NO_LOOK
    this.lookAt = now
    this.lookMorph = morph
  }

  /** Regard effectif a l'instant `now`, rattrapage en cours compris. */
  private lookAtTime(now: number): Look {
    const k = (now - this.lookAt) / this.lookMorph
    if (k >= 1) return this.look
    return lerpLook(this.lookPrev, this.look, easings.easeOutQuint(clamp(k)))
  }

  private posed(
    def: StateDef,
    t: number,
    shape: number[] | null,
    expr: BotExpression | null
  ): Pose {
    let pose = def.pose(t)
    if (def.baseBody && shape) {
      // we keep the pose (rotation, offset, squash) and only swap the profile
      pose = { ...pose, sil: { ...pose.sil, radii: shape } }
    }
    if (def.baseFace && expr) {
      pose = { ...pose, gaze: expr.gaze, split: expr.split, eyes: expr.eyes }
    }
    return pose
  }

  /**
   * Eye offset at time `now` for a given state, in ball radius units.
   *
   * It is READ from a table and interpolated, never recomputed: `eyefit.ts` explains why that distinction is the
   * whole fix. Here we only interpolate it on the shape axis, with exactly the curve and duration of the silhouette
   * morph: same cause, so same motion.
   *
   * We query the table on the BOUNDS of the morph (`shapePrev` and `shape`) and not on the profile returned by
   * `shapeAtTime`: that one is a new array allocated every frame, with no identity, and it exists in no table.
   */
  private offsetAtTime(now: number, state: StateId): { x: number; y: number } {
    /**
     * One morph axis: read the table on its two BOUNDS and interpolate with its curve. Never on the interpolated
     * value: it has no identity and exists in no table, and feeding it in is what made the previous versions shake.
     */
    const onAxis = (
      start: number,
      duration: number,
      a: { x: number; y: number },
      b: { x: number; y: number }
    ) => {
      if (a === b) return b
      const k = (now - start) / duration
      if (k >= 1) return b
      const t = easings.easeOutQuint(clamp(k))
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
    }

    // expression axis, for each of the two shapes involved
    const byShape = (radii: number[] | null) =>
      onAxis(
        this.exprAt,
        BotEngine.SHAPE_MORPH,
        eyeOffset(radii, state, this.exprPrev?.id ?? null),
        eyeOffset(radii, state, this.expr?.id ?? null)
      )

    // then the shape axis
    return onAxis(
      this.shapeAt,
      BotEngine.SHAPE_MORPH,
      byShape(this.shapePrev),
      byShape(this.shape)
    )
  }

  get state(): StateId {
    return this.cur
  }

  /**
   * Starts again on `id` WITHOUT a previous state, like a new engine set on that state.
   *
   * That is what "rewind" means for this engine. `setState` alone cannot do it: it keeps the state it leaves to fade
   * it, which is exactly its job during playback, and exactly what we do not want when going back to the start of a
   * sequence. Replaying frame 0 after a full pass mixed the first state with the LAST one, and the GIF export opened
   * on a ball with no eyes (`sleep` has a zero `eyeAlpha`).
   *
   * `sample` stays a pure function of time: like `setState`, this is a TIMED setter, called by the sequence driver,
   * never during sampling.
   */
  reset(id: StateId, now: number) {
    this.cur = id
    this.prev = null
    this.startFrozen = null
    this.tCur = now
    this.tPrev = now
    this.blinkAt = -10
  }

  /**
   * Origin of the running fade: the frozen pose if there is one, else the state being left, evaluated at its own
   * elapsed time (so still animating, on purpose).
   */
  private origin(
    now: number,
    shape: number[] | null,
    expr: BotExpression | null
  ): Pose | null {
    if (this.startFrozen) return this.startFrozen
    if (!this.prev) return null
    const prevDef = STATE_BY_ID.get(this.prev)!
    return this.posed(prevDef, Math.max(0, now - this.tPrev), shape, expr)
  }

  /**
   * Composite pose at time `now`, including a running fade: exactly what `sample` mixes, before the resting life and
   * gaze layer. Extracted so `setState` can freeze it.
   */
  private poseComposee(now: number): Pose {
    const def = STATE_BY_ID.get(this.cur)!
    const shape = this.shapeAtTime(now)
    const expr = this.exprAtTime(now)
    const pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr)
    const since = now - this.tCur
    if (since >= def.morph) return pose
    const origin = this.origin(now, shape, expr)
    if (!origin) return pose
    return blendPose(origin, pose, easings.easeOutQuint(clamp(since / def.morph)))
  }

  /**
   * Timed state change.
   *
   * The engine keeps ONE history slot, so a change arriving during a fade used to replace the origin of the mix with
   * the FULL pose of the state being left, instead of the half-mixed frame on screen. Measured on `idle -> wide ->
   * idle` at 100 ms: a 35.9 px jump against 8.0 px of normal motion.
   *
   * So we freeze the current composite pose and mix from it. Continuous by construction, however many changes follow.
   *
   * And ONLY in that case. Freezing on every change would stop the animation of the state being left during the whole
   * fade (the gaze of `thinking` or the bounce of `sleep` would freeze mid-course), while outside a morph there is
   * nothing to fix: the state being left is already exactly the frame shown. Playing a montage, whose blocks last at
   * least the longest fade (`MIN_BLOCK`), therefore never freezes anything and renders bit for bit what it did.
   */
  setState(id: StateId, now: number) {
    if (id === this.cur) return
    const morph = STATE_BY_ID.get(this.cur)!.morph
    const midFade = this.prev !== null && now - this.tCur < morph
    this.startFrozen = midFade ? this.poseComposee(now) : null
    this.prev = this.cur
    this.tPrev = this.tCur
    this.cur = id
    this.tCur = now
    // In the video, every shape change is hidden by a blink.
    if (STATE_BY_ID.get(id)?.blinkIn) this.blinkAt = now
  }

  /**
   * `gesture` (optional, `gestures.ts`): small offsets ADDED after the measured pose (move, scales, aim, eyelid).
   * Without a gesture, the frame is identical to the byte to the previous one.
   */
  sample(now: number, gesture?: Gesture): BotFrame {
    const R = this.scale
    const def = STATE_BY_ID.get(this.cur)!
    const shape = this.shapeAtTime(now)
    const expr = this.exprAtTime(now)
    let pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr)
    let offset = this.offsetAtTime(now, this.cur)

    // --- transition -------------------------------------------------------
    const since = now - this.tCur
    // The previous state is never purged: `since < def.morph` is enough to
    // ignore it once the fade is over, and forgetting it would make the engine
    // not replayable: reading a time before the end of the fade would no longer
    // find it. The optimization that looks harmless and breaks everything.
    const origin = since < def.morph ? this.origin(now, shape, expr) : null
    if (origin) {
      // Exponential ease-out: the curve measured on the video. The body
      // has no overshoot (only the dot and the eyes opening do).
      // The ratio is clamped: reading a time BEFORE the state change
      // would give a negative ratio, which the ease-out extrapolates: the silhouette
      // then goes thirty times too far.
      const ratio = easings.easeOutQuint(clamp(since / def.morph))
      pose = blendPose(origin, pose, ratio)
      // The eye offset follows the SAME curve as the silhouette behind it. It comes
      // from the state being left, which `setState` always sets along with the origin:
      // the check is there for typing, not for a real case.
      const leaves = this.prev
      if (leaves) {
        const before = this.offsetAtTime(now, leaves)
        offset = {
          x: lerp(before.x, offset.x, ratio),
          y: lerp(before.y, offset.y, ratio)
        }
      }
    }

    // --- resting life ------------------------------------------------------
    const alive = pose.eyeAlpha > 0.01
    const look = this.lookAtTime(now)
    const life = liveliness(now, { wander: alive ? look.wander : 0, blink: alive })

    const vis = gesture && hasFace(gesture) ? gesture : null
    // a mood also forces the head of its face (in 3D the eyes face front, with no gaze)
    const g0 = vis?.exp ? vis.exp.gaze : pose.gaze
    const gaze = {
      // Both aims REPLACE those of the pose instead of adding to them (see
      // `Look`), and the turn is subtracted on the way. The drift is added AFTER the
      // mix, otherwise the target would cancel it along with the pose, and it
      // must survive a turned head with no pointer.
      yaw: lerp(g0.yaw, look.yaw, look.mix) + life.dYaw - look.spin + (gesture ? gesture.yaw : 0),
      pitch: lerp(g0.pitch, look.pitch, look.mix) + life.dPitch + (gesture ? gesture.pitch : 0),
      // the roll follows nothing: the bot's head is tilted by -13deg in
      // the video, and rolling it with the cursor breaks that signature
      roll: g0.roll + life.dRoll + (gesture ? gesture.roll : 0)
    }

    // blink triggered by the state change, on top of the schedule
    const forced = clamp((now - this.blinkAt) / 0.2)
    const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1
    const lid = gesture ? Math.min(life.lid, forcedLid, gesture.lid) : Math.min(life.lid, forcedLid)

    const offX = pose.offX + life.driftX + (gesture ? gesture.dx : 0)
    const offY = pose.offY + life.driftY + (gesture ? gesture.dy : 0)

    // --- body --------------------------------------------------------------
    const sil: Silhouette = {
      ...pose.sil,
      cx: pose.sil.cx + offX,
      cy: pose.sil.cy + offY,
      rot: vis?.rot ? pose.sil.rot + (vis.rot * Math.PI) / 180 : pose.sil.rot,
      sx: gesture ? pose.sil.sx * gesture.sx : pose.sil.sx,
      sy: gesture ? pose.sil.sy * life.breath * gesture.sy : pose.sil.sy * life.breath
    }
    const bodyPath = closedPath(toPoints(sil, R, this.pts))

    // --- eyes --------------------------------------------------------------
    // The eyes live on a sphere of radius 1; as soon as the silhouette is
    // no longer a circle, we scale them to the real radius in their
    // direction, otherwise they overflow and the mask cuts them.
    const bodyRadius = (x: number, y: number) =>
      radiusAtAngle(pose.sil.radii, Math.atan2(y, x) - pose.sil.rot)

    const eyes: RenderedEye[] = []
    if (pose.eyeAlpha > 0.01) {
      // the face layer can force its eyes (mood): same format as an expression's
      const cfgs = vis?.exp ? vis.exp.eyes : pose.eyes
      const poses = eyePoses(gaze, R, vis?.exp ? vis.exp.split : pose.split)
      for (let i = 0; i < 2; i++) {
        const e = poses[i]!
        if (e.depth <= 0.02) continue
        const base = cfgs[i]!
        const cfg = vis
          ? {
              ...base,
              w: base.w * (vis.ew ?? 1),
              h: base.h * (vis.eh ?? 1),
              // mirrored: the first eye tilts one way, the second the other way, like `pair()`
              tilt: (base.tilt ?? 0) + (i === 0 ? 1 : -1) * (vis.tilt ?? 0)
            }
          : base
        const fit = bodyRadius(e.x, e.y)
        // Own tilt of the eye: the tangent frame is composed with a
        // rotation in the eye plane (Basis x Rot). That allows mirrored
        // tilts between the two eyes.
        const phi = ((cfg.tilt ?? 0) * Math.PI) / 180
        const cp = Math.cos(phi)
        const sp = Math.sin(phi)
        const ax = e.a * cp + e.c * sp
        const ay = e.b * cp + e.d * sp
        const cx2 = -e.a * sp + e.c * cp
        const cy2 = -e.b * sp + e.d * cp
        // The blink applies AFTER all that: it is a vertical squash
        // on screen, not along the capsule's axis.
        const k = blinkScale(Math.min(lid, cfg.open))
        let mx = e.x * fit + (offX + offset.x) * R
        let my = e.y * fit + (offY + offset.y) * R
        let [ma, mb, mc, md] = [ax, ay * k, cx2, cy2 * k]
        if (vis) {
          mx += (vis.ex ?? 0) * R
          my += (vis.ey ?? 0) * R
          if (vis.rot) {
            // the head tilts: eyes and tilts turn with the body, around its center
            const q = (vis.rot * Math.PI) / 180
            const cq = Math.cos(q)
            const sq = Math.sin(q)
            const ox = offX * R
            const oy = offY * R
            ;[ma, mb, mc, md] = [cq * ma - sq * mb, sq * ma + cq * mb, cq * mc - sq * md, sq * mc + cq * md]
            ;[mx, my] = [ox + cq * (mx - ox) - sq * (my - oy), oy + sq * (mx - ox) + cq * (my - oy)]
          }
        }
        eyes.push({
          d: vis?.arc ? arcPath(cfg.w * R, cfg.h * R, vis.arc) : capsulePath(cfg.w * R, cfg.h * R),
          matrix: `matrix(${r2(ma)},${r2(mb)},${r2(mc)},${r2(md)},${r2(mx)},${r2(my)})`,
          alpha: pose.eyeAlpha * clamp(e.depth / 0.12),
          ...(vis ? { k, tilt: (cfg.tilt ?? 0) + (vis.rot ?? 0), gx: (vis.ex ?? 0) * R, gy: (vis.ey ?? 0) * R } : null)
        })
      }
    }

    // --- decor ------------------------------------------------------------
    const dots = pose.dots
      .filter((p) => p.opacity > 0.01 && p.r > 0.0005)
      .map((p) => ({ ...p, x: (p.x + offX) * R, y: (p.y + offY) * R, r: p.r * R }))

    return {
      bodyPath,
      bodyAlpha: pose.bodyAlpha,
      eyes,
      ...(vis ? { face: { rot: vis.rot ?? 0, cheeks: vis.cheeks ?? 0 } } : null),
      dots,
      // States declare arcs in ball radius units; the engine
      // is the only one that knows the viewBox scale, so it draws them.
      arcs: pose.arcs
        .filter((a) => a.opacity > 0.01)
        .map((a) => arcRender(a.seed, a.t, R, a.id, a.opacity))
    }
  }
}


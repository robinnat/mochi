import { describe, expect, it } from 'vitest'
import { blockAt, minDurationOf, offsetOf } from '@/bot/cycles'
import { BotEngine } from '@/bot/engine'
import { EXPRESSION_BY_ID } from '@/bot/expressions'
import { SHAPE_BY_ID } from '@/bot/skins'
import { STATE_BY_ID } from '@/bot/states'
import { SPIN_TIME, type GazeScript } from './gaze'
import { INTRO, INTRO_GAZE, POSE_AT, introDue, type Arrival } from './intro'

/** Ordinary arrival: bare URL, direct visit, no calm preference. */
const arrive = (o: Partial<Arrival> = {}): Arrival => ({
  named: false,
  gallery: false,
  reload: false,
  calm: false,
  ...o
})

describe('arrival trigger', () => {
  it('plays when coming to the site', () => {
    expect(introDue(arrive())).toBe(true)
  })

  it('does not replay on a page already open', () => {
    // reload, back, forward: we do not COME, we come back
    expect(introDue(arrive({ reload: true }))).toBe(false)
  })

  it('gives way to links aimed at the player or the sheet', () => {
    // `#state=` already describes a playback: the home staging must not
    // cover it, otherwise the link does not open what it asks for
    expect(introDue(arrive({ named: true }))).toBe(false)
    // `#sheet` is the visual check path: it depends on nothing
    expect(introDue(arrive({ gallery: true }))).toBe(false)
  })

  it('stays quiet when less animation is asked for', () => {
    expect(introDue(arrive({ calm: true }))).toBe(false)
  })
})

describe('arrival montage', () => {
  it('lets each animation complete', () => {
    for (const b of INTRO) {
      expect(b.duration, b.state).toBeGreaterThanOrEqual(minDurationOf(b.state))
    }
  })

  /*
   * The engine keeps a single history slot: a block shorter than the entry fade of the next one jumps instead of
   * fading. The general floor (`MIN_BLOCK`) is enough for catalog states, but the arrival writes its durations by
   * hand.
   */
  it('cuts no block shorter than the next one\'s fade', () => {
    for (let i = 0; i < INTRO.length - 1; i++) {
      const next = STATE_BY_ID.get(INTRO[i + 1]!.state)!
      expect(INTRO[i]!.duration, INTRO[i]!.state).toBeGreaterThanOrEqual(next.morph)
    }
  })

  /*
   * THE lesson of the variant comparison, and what slipping in a "nice looking" state would break: any state other
   * than idle brings its OWN gaze pose, so an eye jump at the change. The blink meant to hide it only lasts 0.2 s
   * while the fade lasts 0.3: the eyes open again mid-way and it reads as a teleport.
   */
  it('only plays idle, from start to end', () => {
    for (const b of INTRO) {
      expect(b.state, 'another state brings its gaze pose, so a jump').toBe('idle')
    }
  })

  it('keeps the chosen shape AND expression', () => {
    // follows from the previous one, but it is what we SEE: the ball that appears is
    // indeed the user's avatar, with no silhouette or face morph
    for (const b of INTRO) {
      const def = STATE_BY_ID.get(b.state)!
      expect(def.baseBody, b.state).toBe(true)
      expect(def.baseFace, b.state).toBe(true)
    }
  })

  it('sets the interface on a block that exists', () => {
    expect(POSE_AT).toBeGreaterThan(0)
    expect(POSE_AT).toBeLessThan(INTRO.length)
  })

  it('lets the gaze turn end before setting the interface', () => {
    // otherwise the ball leaves for its place while its eyes are still
    // going around: two moves at once, and the turn cut short
    expect(offsetOf(INTRO, POSE_AT)).toBeGreaterThanOrEqual(SPIN_TIME)
  })

  it('hands back quickly', () => {
    // What matters is not the total duration but the time the interface arrives:
    // after it, the page is usable. So THAT time is bounded.
    expect(offsetOf(INTRO, POSE_AT)).toBeLessThanOrEqual(2)
  })
})

/**
 * The test that locks the original complaint: "all at once, bam, it teleports".
 *
 * We replay the arrival frame by frame as the player does (same chain of blocks, same gaze script) and measure how
 * the eyes move from one frame to the next. A jump is exactly that: a single frame where they travel a long way.
 *
 * The playback logic is reproduced here rather than imported because it lives in the `<mochi-bot>` component, out of
 * reach of these DOM-less tests. It fits in a few lines and follows `MochiBot.apply`.
 */
describe('smoothness of the arrival', () => {
  const circle = SHAPE_BY_ID.get('circle')!.radii
  const neutral = EXPRESSION_BY_ID.get('neutral')!
  const IMAGE = 1 / 60

  /**
   * Largest move of the inner eye between two frames, in px.
   *
   * `duringMorph` limits the measure to frames that follow a state change. That is WHERE the teleport happened, and
   * the only window where a big move is necessarily a flaw: elsewhere it can be the wanted path (the gaze turn makes
   * 20 px per frame when crossing the limb, because a small angle becomes a big move on screen there).
   */
  function worstJump(gaze: GazeScript | null = INTRO_GAZE, duringMorph = false): number {
    const engine = new BotEngine(100, INTRO[0]!.state, circle, neutral)
    const end = offsetOf(INTRO, INTRO.length - 1) + 1
    let current = 0
    let before: { x: number; y: number } | null = null
    let worst = 0
    /** End time of the running fade, or -1 if no recent state change. */
    let morphUntil = -1

    // seed timed for an earlier catch-up, like the component: otherwise the
    // first frame comes out idle and the second on the script
    if (gaze) engine.setLook(gaze(0), -IMAGE, IMAGE)

    for (let t = 0; t < end; t += IMAGE) {
      const { index } = blockAt(INTRO, t)
      if (index !== current) {
        const incoming = INTRO[index]!.state
        // `setState` ignores an unchanged state: no fade, so no window
        if (incoming !== engine.state) morphUntil = t + STATE_BY_ID.get(incoming)!.morph
        engine.setState(incoming, t)
        current = index
      }
      if (gaze) engine.setLook(gaze(t), t, IMAGE)

      const eye = engine.sample(t).eyes[0]
      if (!eye) {
        // eyes gone behind the ball: nothing to compare, start over cleanly
        before = null
        continue
      }
      const p = /matrix\(([^)]+)\)/.exec(eye.matrix)![1]!.split(',').map(Number)
      const here = { x: p[4]!, y: p[5]! }
      if (before && (!duringMorph || t <= morphUntil)) {
        worst = Math.max(worst, Math.hypot(here.x - before.x, here.y - before.y))
      }
      before = here
    }
    return worst
  }

  it('makes the eyes jump at no state change', () => {
    const jump = worstJump(INTRO_GAZE, true)
    expect(jump, `${jump.toFixed(1)} px during a fade`).toBeLessThan(4)
  })

  /*
   * And the counter-test, without which the previous one would pass on its own: since the montage only has idle
   * blocks, there is NO entry fade to watch. That is exactly what makes the arrival smooth, and it must stay true.
   */
  it('and there is indeed no state fade to go through', () => {
    expect(new Set(INTRO.map((b) => b.state)).size).toBe(1)
  })

  /*
   * Why the ball is ROUND during the turn, whatever the chosen shape (see `shape` in `App.ts`).
   *
   * The eyes are stuck back onto the real outline so they do not overflow the silhouette (`radiusAtAngle`). On a
   * circle that radius is constant, so the turn is smooth. On a non circular shape, they follow the profile and
   * jitter: that is what this test measures, and it is a finding, not a flaw to fix: `radiusAtAngle` does exactly
   * what it is there for.
   */
  it('a turn on a non circular shape would make the eyes jitter', () => {
    /** Ordinate of the inner eye frame by frame, `NaN` when it is hidden. */
    const path = (shape: string) => {
      const m = new BotEngine(100, 'idle', SHAPE_BY_ID.get(shape)!.radii, neutral)
      const ys: number[] = []
      for (let t = 0; t < SPIN_TIME; t += IMAGE) {
        m.setLook(INTRO_GAZE(t), t, IMAGE)
        const e = m.sample(t).eyes[0]
        if (!e) {
          ys.push(NaN)
          continue
        }
        ys.push(Number(/matrix\(([^)]+)\)/.exec(e.matrix)![1]!.split(',')[5]))
      }
      return ys
    }

    const round = path('circle')
    const drop = path('drop')
    let gap = 0
    for (let i = 0; i < round.length; i++) {
      if (Number.isNaN(round[i]!) || Number.isNaN(drop[i]!)) continue
      gap = Math.max(gap, Math.abs(drop[i]! - round[i]!))
    }
    // on a ball of radius 100: dozens of px, not one or two
    expect(gap, `${gap.toFixed(1)} px of vertical gap with the circle`).toBeGreaterThan(15)
  })

  it('does make the eyes travel a turn', () => {
    // the turn is the arrival's only move: if it disappeared, only
    // a fade would remain and nobody would notice it here any more
    const withIt = worstJump(INTRO_GAZE)
    const without = worstJump(null)
    expect(without, 'without a script, only the resting drift moves').toBeLessThan(1)
    expect(withIt, 'the turn crosses the limb, so it goes fast at that instant').toBeGreaterThan(5)
  })
})

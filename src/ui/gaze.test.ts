import { describe, expect, it } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { EXPRESSIONS, EXPRESSION_BY_ID, type ExpressionId } from '@/bot/expressions'
import { SHAPE_BY_ID } from '@/bot/skins'
import { STATE_BY_ID } from '@/bot/states'
import {
  MOODS,
  lookTarget,
  PITCH,
  SPIN,
  SPIN_TIME,
  turnLook,
  TURN,
  YAW_MAX,
  type Aim
} from './gaze'

const circle = () => SHAPE_BY_ID.get('circle')!.radii

/** Aim at rest: pointer at the bot's center, half turn done. */
const aims = (o: Partial<Aim> = {}): Aim => ({ nx: 0, ny: 0, turn: 1, pointer: true, ...o })

describe('gaze target', () => {
  it('lets the pose drive before the arrival starts', () => {
    // no pointer: nothing is driven at all, neither the direction nor the drift
    const target = lookTarget(aims({ turn: 0, pointer: false }))
    // zero hold: whatever the aimed direction, the pose drives alone...
    expect(target.mix).toBe(0)
    // ...and a full turn is left to travel, which is the same angle as zero
    expect(target.spin).toBe(SPIN)

    // what matters is not the field values but the rendered frame:
    // at the start, it must be that of a bot nobody drives at all
    const bare = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get('neutral')!)
    const start = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get('neutral')!)
    start.setLook(target, 0)
    expect(start.sample(1).eyes[0]!.matrix).toBe(bare.sample(1).eyes[0]!.matrix)
  })

  it('turns the head to the left, towards the panel', () => {
    // lacet negatif = le bot regarde a gauche
    expect(lookTarget(aims()).yaw).toBe(-TURN)
  })

  it('follows the cursor the right way on both axes', () => {
    const left = lookTarget(aims({ nx: -1 }))
    const right = lookTarget(aims({ nx: 1 }))
    expect(right.yaw).toBeGreaterThan(left.yaw)

    // positive pitch = looking up, while screen y goes down:
    // that is the sign one gets wrong
    expect(lookTarget(aims({ ny: -1 })).pitch).toBeGreaterThan(0)
    expect(lookTarget(aims({ ny: 1 })).pitch).toBeLessThan(0)
  })

  it('fades the turn as the arrival goes', () => {
    expect(lookTarget(aims({ turn: 0.5 })).spin).toBe(SPIN / 2)
    expect(lookTarget(aims({ turn: 1 })).spin).toBe(0)
  })
})

describe('both eyes stay visible', () => {
  /**
   * The invariant that protects the feature: past a certain yaw, the outer eye goes behind the sphere's limb and the
   * engine REMOVES it from the frame: the bot ends up one-eyed. So we sweep the 16 expressions at the four corners of
   * the screen, half turn included.
   */
  it('on the 16 expressions, at the four corners of the screen', () => {
    for (const e of EXPRESSIONS) {
      for (const nx of [-1, 0, 1]) {
        for (const ny of [-1, 0, 1]) {
          const engine = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get(e.id)!)
          engine.setLook(lookTarget(aims({ nx, ny })), 0)
          const image = engine.sample(1)
          expect(image.eyes, `${e.id} nx=${nx} ny=${ny}`).toHaveLength(2)
          // ...and not only present: still clearly opaque
          for (const eye of image.eyes) {
            expect(eye.alpha, `${e.id} nx=${nx} ny=${ny}`).toBeGreaterThan(0.5)
          }
        }
      }
    }
  })

  it('keeps a margin: tracking does not go to the breaking point', () => {
    // if this margin disappears, YAW_MAX or TURN was pushed too far
    const engine = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get('neutral')!)
    engine.setLook({ yaw: -(TURN + YAW_MAX) - 25, pitch: 0, mix: 1, spin: 0, wander: 0 }, 0)
    expect(engine.sample(1).eyes).toHaveLength(2)
  })
})

describe('the spin on itself', () => {
  it('takes the eyes behind the ball, then brings them back to the left', () => {
    /**
     * It is on purpose, and it makes the swirl: in the middle of the turn the eyes are on the other side of the
     * sphere, so the engine removes them from the frame. This test is here so nobody "fixes" this disappearance
     * thinking it is a bug, and to check that they do come back, at the right place.
     */
    const image = (turn: number) => {
      const engine = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get('neutral')!)
      engine.setLook(lookTarget(aims({ turn })), 0)
      return engine.sample(1)
    }
    expect(image(0).eyes).toHaveLength(2)
    // halfway, the face points away from the viewer
    expect(image(0.5).eyes).toHaveLength(0)
    expect(image(1).eyes).toHaveLength(2)

    // ...et un tour complet repose les yeux exactement ou un simple demi-tour
    // would have put them: that makes the landing right with no tuning
    const complet = image(1).eyes[0]!.matrix
    const withoutTurn = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get('neutral')!)
    withoutTurn.setLook({ yaw: -TURN, pitch: PITCH, mix: 1, spin: 0, wander: 0 }, 0)
    expect(complet).toBe(withoutTurn.sample(1).eyes[0]!.matrix)
  })
})

describe('arrival turn on the site', () => {
  const bot = (id: ExpressionId) => new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get(id)!)

  /**
   * THE rule of a gaze script, and what makes it maintenance-free: it ends at `mix: 0`, where the state's pose drives
   * alone. So there is nothing to release, and a release would show as a last slide of the eyes, right when
   * everything should be settled.
   */
  it('hands back to the pose when it ends', () => {
    expect(turnLook(SPIN_TIME).mix).toBe(0)
    expect(turnLook(SPIN_TIME + 5).spin).toBe(0)
  })

  it('sets the eyes on the chosen expression, whatever it is', () => {
    for (const id of EXPRESSIONS.map((e) => e.id)) {
      const cheek = bot(id)
      cheek.setLook(turnLook(SPIN_TIME), 0)
      expect(cheek.sample(1).eyes[0]!.matrix, id).toBe(bot(id).sample(1).eyes[0]!.matrix)
    }
  })

  it('lets the bot live during the turn', () => {
    // the drift is not turned off: there is no pointer to follow, so nothing
    // justifies freezing the gaze like `lookTarget` does
    expect(turnLook(SPIN_TIME / 2).wander).toBe(1)
  })

  it('n impose aucune direction, a none moment', () => {
    // `mix` at zero all along: only `spin` works, which takes
    // the eyes behind the ball instead of sliding them across
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      expect(turnLook(k * SPIN_TIME).mix, `turn ${k}`).toBe(0)
    }
  })

  it('the turn starts from a FULL turn, which is already the right angle', () => {
    // -360deg is the same angle as 0: the first frame is already right,
    // and that makes the turn land with no tuning
    expect(turnLook(0).spin).toBe(SPIN)
    const startPos = bot('neutral')
    startPos.setLook(turnLook(0), 0)
    expect(startPos.sample(1).eyes[0]!.matrix).toBe(bot('neutral').sample(1).eyes[0]!.matrix)
  })

  it('the turn takes the eyes BEHIND the ball', () => {
    // halfway they have crossed the limb, so the engine no longer draws them
    // at all: proof that the turn is a real path ON THE SPHERE and
    // not a slide across the face
    const middle = bot('neutral')
    middle.setLook(turnLook(SPIN_TIME / 2), 0)
    expect(middle.sample(1).eyes).toHaveLength(0)
  })

  /**
   * Why the arrival ONLY plays idle, and what slipping one more state in would break.
   *
   * A gaze script can take the eyes anywhere, except on one axis: `Look` deliberately does not touch the ROLL (the
   * tilted head is the bot's signature and follows neither the cursor nor a script). And each state has its own roll
   * (the wink tilts at +6.7deg where idle tilts at -13). Those degrees cannot be anticipated: they jump at the state
   * change, under a 0.2 s blink that does not cover a 0.3 s fade.
   */
  it('cannot anticipate the roll, hence an arrival with no state change', () => {
    expect(STATE_BY_ID.get('wink')!.pose(0).gaze.roll).not.toBe(
      EXPRESSION_BY_ID.get('neutral')!.gaze.roll
    )
    expect(turnLook(0)).not.toHaveProperty('roll')
  })
})

describe('gaze stability between expressions', () => {
  /** Ordinate of the inner eye, in viewBox px (y goes down on screen). */
  const eyeY = (m: BotEngine) =>
    +/matrix\([^,]+,[^,]+,[^,]+,[^,]+,-?[\d.]+,(-?[\d.]+)/.exec(m.sample(1).eyes[0]!.matrix)![1]!

  it('keeps the eyes at the same height, whatever the displayed mood', () => {
    /**
     * The bug locked here: when pitch was an OFFSET, the eye height followed the expression's. "Neutral" looks at
     * +28.6deg and the moods between -9 and +9, so the eyes dropped at once on the first mood change, which reads as
     * a flaw, not as an expression.
     */
    const heights = MOODS.map((id) => {
      const m = new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get(id)!)
      m.setLook(lookTarget(aims()), 0)
      return eyeY(m)
    })
    const gap = Math.max(...heights) - Math.min(...heights)
    // on a ball of radius 100: a few pixels, not thirty
    expect(gap, `height gap of ${gap.toFixed(1)} px`).toBeLessThan(4)
  })

  it('without driving, the expressions do keep different heights', () => {
    // the counter-test: TRACKING stabilizes, not the expressions that
    // auraient perdu leur caractere vertical
    const heights = EXPRESSIONS.map((e) =>
      eyeY(new BotEngine(100, 'idle', circle(), EXPRESSION_BY_ID.get(e.id)!))
    )
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(30)
  })

  it('only keeps moods with zero roll, otherwise the head tilts', () => {
    // it is the list's criterion, and it cannot be guessed: roll is not
    // neutralized by tracking, unlike yaw and pitch
    for (const id of MOODS) {
      expect(EXPRESSION_BY_ID.get(id)!.gaze.roll, id).toBe(0)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { BotEngine, type RenderedEye } from './engine'
import { eyeOffset, FOR_TESTS } from './eyefit'
import { EXPRESSIONS } from './expressions'
import { DEFAULT_SHAPE, SHAPES, SHAPE_BY_ID, colorOf, isValidHex } from './skins'
import { STATES, type StateId } from './states'

/**
 * The customizer shapes, measured against the body they replace.
 *
 * This file locks two things, and the second cost far more than the first:
 *
 * 1. **The capsule does not leave the silhouette.** The eyes live on a sphere, and `radiusAtAngle` sticks them to the
 *    outline in proportion to the local radius, which divides their margin by the same ratio. A shape narrow in the
 *    eye's direction pushed it against the edge until the mask opened it: the capsule showed as a notch in the body.
 * 2. **The correction is not seen moving.** Seven versions computed it in the render loop and all of them shook. The
 *    oscillation tests below are what ruled them out, and they compare against the CIRCLE, the shape the correction
 *    does not touch.
 *
 * Everything is about the RENDERED GEOMETRY, not the computation: we take the body outline and each capsule outline
 * as the component draws them. That is the only way to check what the eye sees, and it assumes nothing about the
 * method used.
 */

const R = 100

/**
 * Body outline, read off the `bodyPath`. `closedPath` emits `M x y` then one `C` per point, so the curve points are
 * the 3rd pair of each `C`.
 */
function bodyOutline(d: string) {
  const pts: Array<{ x: number; y: number }> = []
  for (const seg of d.slice(1).split('C')) {
    const n = seg.match(/-?\d+\.?\d*/g)?.map(Number) ?? []
    if (n.length >= 6) pts.push({ x: n[4]!, y: n[5]! })
    else if (n.length === 2) pts.push({ x: n[0]!, y: n[1]! })
  }
  return pts
}

/** Is the point inside the polygon? Ray casting. */
function dedans(poly: Array<{ x: number; y: number }>, x: number, y: number) {
  let on = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) on = !on
  }
  return on
}

/**
 * Outline of a capsule in screen coordinates: a stadium, sampled then passed through the rendered matrix. The
 * dimensions are read back from the `d` that `capsulePath` produced (`M-hw -hh+r A r r ...`), so it only depends on
 * the output.
 *
 * Thirty-two points are enough: on a 40-unit capsule they are less than three units apart, while the smallest
 * overflow ever measured is three.
 */
function eyeOutline(eye: RenderedEye, N = 32) {
  const g = eye.d.match(/-?\d+\.?\d*/g)!.map(Number)
  const hw = Math.abs(g[0]!)
  const r = Math.abs(g[2]!)
  const droit = Math.abs(g[1]!)
  const m = eye.matrix.match(/-?\d+\.?\d*/g)!.map(Number)
  const [a, b, c, d, e, f] = m as [number, number, number, number, number, number]
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i < N; i++) {
    const u = (i / N) * 4
    let x: number
    let y: number
    if (u < 1) {
      const t = Math.PI * (u - 0.5)
      x = Math.cos(t) * r
      y = -droit + Math.sin(t) * r
    } else if (u < 2) {
      x = hw
      y = -droit + (u - 1) * 2 * droit
    } else if (u < 3) {
      const t = Math.PI * (u - 2 + 0.5)
      x = Math.cos(t) * r
      y = droit + Math.sin(t) * r
    } else {
      x = -hw
      y = droit - (u - 3) * 2 * droit
    }
    out.push({ x: a * x + c * y + e, y: b * x + d * y + f })
  }
  return out
}

/** Three seconds at twenty frames per second: enough for several blinks. */
const INSTANTS = 60
const STEP = 1 / 20

/**
 * How far the most overflowing capsule sticks out of the body, in viewBox units.
 *
 * Sweeps TIME and not only the combination. The gaze drift moves the eye by a dozen units, so a single frame proves
 * nothing: by measuring only at `POSES[state]`, `capsule` + `scared` went unnoticed, while it stuck out by 4.4 units
 * a second later.
 */
function overflow(state: StateId, radii: number[], expr: (typeof EXPRESSIONS)[number] | null) {
  const e = new BotEngine(R, state, radii, expr)
  let worst = 0
  for (let i = 0; i < INSTANTS; i++) {
    const f = e.sample(i * STEP)
    const body = bodyOutline(f.bodyPath)
    for (const eye of f.eyes) {
      for (const p of eyeOutline(eye)) {
        if (dedans(body, p.x, p.y)) continue
        worst = Math.max(worst, Math.min(...body.map((q) => Math.hypot(q.x - p.x, q.y - p.y))))
      }
    }
  }
  return worst
}

/** The states whose body can be replaced by a customizer shape. */
const BODY_OF_BASE = STATES.filter((s) => s.baseBody).map((s) => s.id)
/** The others: their silhouette IS the animation, measured on the video. */
const SILHOUETTE_MEASURED = STATES.filter((s) => !s.baseBody).map((s) => s.id)

describe('customizer shapes', () => {
  // 680 combinations x 60 instants x two outlines: the heaviest test of the repository, and the
  // only one that proves what the eye sees.
  it("no shape lets an eye leave the silhouette", () => {
    const faulty: string[] = []
    for (const state of BODY_OF_BASE) {
      for (const shape of SHAPES) {
        for (const expr of [null, ...EXPRESSIONS]) {
          const exit = overflow(state, shape.radii, expr)
          if (exit > 0.05) {
            faulty.push(`${state}/${shape.id}/${expr?.id ?? 'pose'} ${exit.toFixed(1)}`)
          }
        }
      }
    }
    // Five state x shape pairs overflowed: `wide`+`capsule` by 14.5 units on a ball
    // of radius 100, `wide`+`triangle` by 11.9, `idle`+`capsule` and `swirl`+`capsule` by 5.3,
    // `notify`+`drop` by 3.3.
    expect(faulty).toEqual([])
  }, 30_000)

  /**
   * The circle is the shape measured on the video, and the default body: choosing it in the customizer must change
   * NOTHING compared to choosing nothing. That guarantees the correction is neutral on the reference, including its
   * outer eye, which already brushes the edge and must keep brushing it.
   */
  it('choosing the circle renders exactly the same as choosing nothing', () => {
    expect(DEFAULT_SHAPE).toBe('circle')
    const circle = SHAPE_BY_ID.get('circle')!.radii
    for (const state of BODY_OF_BASE) {
      for (const expr of [null, ...EXPRESSIONS]) {
        const withIt = new BotEngine(R, state, circle, expr).sample(1)
        const without = new BotEngine(R, state, null, expr).sample(1)
        expect(withIt.eyes, `${state}/${expr?.id ?? 'pose'}`).toEqual(without.eyes)
      }
      expect(eyeOffset(circle, state, null)).toEqual({ x: 0, y: 0 })
    }
  })

  /**
   * The silhouettes measured on the video cannot be replaced, so the chosen shape must not reach them: neither their
   * body nor their eyes. `orbit` is the case that matters: its eye margin is tighter than the circle's and still
   * right, since it was measured that way. A margin rule applied without distinction would move it.
   */
  it("the chosen shape does not touch the states with a measured silhouette", () => {
    for (const state of SILHOUETTE_MEASURED) {
      const bare = new BotEngine(R, state, null, null).sample(1)
      for (const shape of SHAPES) {
        const dressed = new BotEngine(R, state, shape.radii, null).sample(1)
        expect(dressed.eyes, `${state}/${shape.id}`).toEqual(bare.eyes)
        expect(dressed.bodyPath).toBe(bare.bodyPath)
      }
    }
  })

  /**
   * The correction must change NOTHING in the eye size.
   *
   * One version scaled it along with the position: that kept every ratio of the face and stayed stable, but the eyes
   * became visibly smaller on a flat body, and changing expression then animated that growth. It read as a flaw.
   */
  it('the eye size does not depend on the shape', () => {
    const sizes = new Set(
      SHAPES.map((f) =>
        new BotEngine(R, 'idle', f.radii, null)
          .sample(1)
          .eyes.map((y) => y.d)
          .join('|')
      )
    )
    expect(sizes.size).toBe(1)
  })

  /**
   * The real trap: the correction must be INVISIBLE in motion.
   *
   * What we measure is OSCILLATION, not speed. A morph moves the eyes fast anyway (expressions do not look at the
   * same place), and that is wanted motion. Shaking is going and COMING BACK. So we count direction changes frame by
   * frame, and compare them with the circle, which the correction does not touch.
   *
   * The measure tells them apart very well: 0 to 1 back and forth on the original engine, 4 to 14 with backtracks up
   * to 26 units on the versions that shook.
   */
  it('the correction does not make the eyes oscillate', () => {
    const step = 1 / 60

    const path = (bâti: () => BotEngine, duration = BotEngine.SHAPE_MORPH) => {
      const e = bâti()
      const out: Array<Array<{ x: number; y: number }>> = []
      for (let t = 0; t <= duration + step; t += step) {
        out.push(
          e.sample(t).eyes.map((eye) => {
            const n = eye.matrix.match(/-?\d+\.?\d*/g)!.map(Number)
            return { x: n[4]!, y: n[5]! }
          })
        )
      }
      return out
    }

    /** How many times an eye goes back, and by how much at most. */
    const roundReturns = (suite: Array<Array<{ x: number; y: number }>>) => {
      let n = 0
      let amplitude = 0
      const eyes = Math.min(...suite.map((f) => f.length))
      for (let j = 0; j < eyes; j++) {
        let px = 0
        let py = 0
        for (let i = 1; i < suite.length; i++) {
          const dx = suite[i]![j]!.x - suite[i - 1]![j]!.x
          const dy = suite[i]![j]!.y - suite[i - 1]![j]!.y
          const len = Math.hypot(dx, dy)
          if (len <= 0.05) continue
          if ((px || py) && dx * px + dy * py < 0) {
            n++
            amplitude = Math.max(amplitude, len)
          }
          px = dx
          py = dy
        }
      }
      return { n, amplitude }
    }

    const circle = SHAPE_BY_ID.get('circle')!.radii
    const morphOfShape = (radii: number[]) =>
      roundReturns(
        path(() => {
          const e = new BotEngine(R, 'idle', circle, null)
          e.setShape(radii, 0)
          return e
        })
      )
    const atIdle = (radii: number[]) =>
      roundReturns(path(() => new BotEngine(R, 'idle', radii, null), 3))
    const morphsDExpression = (radii: number[]) =>
      EXPRESSIONS.map((expr) =>
        roundReturns(
          path(() => {
            const e = new BotEngine(R, 'idle', radii, EXPRESSIONS[0]!)
            e.setExpression(expr, 0)
            return e
          })
        )
      ).reduce((a, b) => ({ n: a.n + b.n, amplitude: Math.max(a.amplitude, b.amplitude) }), {
        n: 0,
        amplitude: 0
      })

    /*
     * On the CIRCLE, nothing at all: the correction is zero there, so it cannot add any motion, and it is the
     * reference of the three comparisons.
     */
    expect(morphsDExpression(circle).n, 'circle: expression morphs').toBe(0)

    for (const shape of SHAPES) {
      // At rest, the only thing that moves is the gaze drift. A correction that
      // followed it would make the eyes shake all the time: the most visible flaw
      // of all, and the first we had.
      expect(atIdle(shape.radii).n, `${shape.id}: idle drift`).toBeLessThanOrEqual(
        atIdle(circle).n + 1
      )
      // A shape change moves the offset, but on the same curve as the
      // silhouette: no more back and forth than the circle.
      expect(morphOfShape(shape.radii).n, `shape morph to ${shape.id}`).toBeLessThanOrEqual(
        morphOfShape(circle).n + 1
      )
      /*
       * An expression change moves the offset from one table entry to the other. Seven shapes out of eight gain no
       * back and forth; the `drop` goes from one 6.3-unit backtrack (already there without correction) to two of
       * 11.1. The bound lets that through and nothing more: the faulty versions were at 26.
       */
      expect(
        morphsDExpression(shape.radii).amplitude,
        `${shape.id}: expression morphs`
      ).toBeLessThan(14)
    }
  })

  /**
   * The table is a module constant. It must stay quick enough to build not to weigh on the first display: it is the
   * only cost this fix adds to the engine, which then only reads two entries and interpolates them.
   */
  it('the table builds in a few milliseconds', () => {
    const t = performance.now()
    FOR_TESTS.batir()
    expect(performance.now() - t).toBeLessThan(200)
  })
})

describe('free body color (hex)', () => {
  it('isValidHex accepts #rgb and #rrggbb, with or without a hash, and normalizes to lowercase', () => {
    expect(isValidHex('#FF8800')).toBe('#ff8800')
    expect(isValidHex('f80')).toBe('#ff8800')
    expect(isValidHex(' #AbC ')).toBe('#aabbcc')
    for (const bad of ['', '#12', '#12345', '#1234567', 'red', '#ggg', null, undefined]) expect(isValidHex(bad as string)).toBeNull()
  })
  it('colorOf: a catalog id, else a free hex, else ink', () => {
    expect(colorOf('violet')).toBe('#8b3dff')
    expect(colorOf('#ff8800')).toBe('#ff8800')
    expect(colorOf('#f80')).toBe('#ff8800')
    expect(colorOf('nimporte')).toBe('#0a0a0c')
  })
})

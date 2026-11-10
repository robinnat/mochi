// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { BotEngine, type BotFrame } from '@/bot/engine'
import { blockAt, defaultCycle, offsetOf, type Block } from '@/bot/cycles'
import { RADIUS } from '@/bot/frame'
import { SHAPE_BY_ID } from '@/bot/skins'
import { EXPRESSION_BY_ID } from '@/bot/expressions'
import { opensCycle } from './capture'
import { HALF_SCREEN, viewBoxExport } from './export'

/**
 * The off-screen player, the one that renders the frames of a montage export.
 *
 * It needs a DOM, hence the `happy-dom` environment at the top of the file.
 *
 * What it catches is visible in no other way than watching an MP4 frame by frame, which is exactly how it slipped
 * through: three flaws silently damaged every exported video.
 */

/**
 * happy-dom has no WebGL: the 3D scene is replaced by a double that keeps the engine frame it is asked to render.
 * That is exactly what the real 3D would get, so what the export captures.
 */
const scene = vi.hoisted(() => ({ webgl: true, last: null as null | { bodyPath: string; eyes: { matrix: string }[] } }))
vi.mock('@/ui/3d/scene3d', () => ({
  webglAvailable: () => scene.webgl,
  renderAvatar: (_target: unknown, frame: BotFrame) => {
    scene.last = frame
  },
  invalidateAccessories3d: () => {},
  avatarSlot: () => ({ mochi: null, texture: 0 }),
  releaseSlot: () => {},
  warmUp: () => {}
}))

const SETTINGS = { shape: 'circle', color: 'ink', expression: 'neutral' }
const SIZE = 128

/** The body `d` of the last frame sent to the 3D. */
function bodyOf(_svg: SVGSVGElement) {
  return scene.last!.bodyPath
}

/** The eye matrices of the last frame sent to the 3D. */
function eyesOf(_svg: SVGSVGElement) {
  return scene.last!.eyes.map((e) => e.matrix)
}

/** The engine alone, set up as `renderAt` does: each state timed at its absolute offset. */
function engineAtSameInstant(blocks: Block[], t: number) {
  const e = new BotEngine(
    RADIUS,
    blocks[0]!.state,
    SHAPE_BY_ID.get(SETTINGS.shape)!.radii,
    EXPRESSION_BY_ID.get(SETTINGS.expression)!
  )
  const { index } = blockAt(blocks, t)
  for (let i = 1; i <= index; i++) e.setState(blocks[i]!.state, offsetOf(blocks, i))
  return e.sample(t)
}

/**
 * The frame of a CYCLE export must be the one the component DRAWS, not a number that looks like it.
 *
 * `HALF_SCREEN` was a hard-coded 158 next to a hand-written `VB = 158` in the component, and nothing linked them. The
 * regression guarded against: someone widens the viewBox for a new state with bigger rings, the export keeps the old
 * frame and adds empty bands to every video, all tests green.
 *
 * Compared here to the `viewBox` actually emitted, not to the constant: both now come from the same module, so an
 * assertion between them would be a tautology. What can still drift is the TEMPLATE.
 */
describe('export frame', () => {
  it('exports the cycle on the viewBox the component draws', async () => {
    const player = await opensCycle(SETTINGS, defaultCycle().blocks, SIZE)
    try {
      const svg = await player.render(0)
      expect(svg.getAttribute('viewBox')).toBe(viewBoxExport(HALF_SCREEN))
    } finally {
      player.closed()
    }
  })
})

describe('off-screen player', () => {
  /**
   * Replaying the sequence must give exactly the same frames.
   *
   * The GIF export depends on it: it makes TWO passes, one to count the palette and one to index, and the first
   * pass's palette only holds if the second renders the same frames. A single player served both, and it keeps the
   * last block set while the engine keeps the previous state: replaying frame 0 after a full pass timed the first
   * state at 0 with the LAST as previous state, and so rendered that one's pose. The default GIF opened on a ball
   * WITHOUT EYES (the comet has a zero `eyeAlpha`).
   */
  it('replays the sequence identically', async () => {
    const blocks = defaultCycle().blocks
    const fresh = await opensCycle(SETTINGS, blocks, SIZE)
    const reference = { body: bodyOf(await fresh.render(0)), eyes: eyesOf(await fresh.render(0)) }
    fresh.closed()

    const replays = await opensCycle(SETTINGS, blocks, SIZE)
    try {
      // a full pass, coarsely sampled: what matters is having
      // gone through every block before coming back to the start
      for (let t = 0; t < 30; t += 1.5) await replays.render(t)
      const after = await replays.render(0)
      expect(bodyOf(after)).toBe(reference.body)
      expect(eyesOf(after)).toEqual(reference.eyes)
      expect(eyesOf(after)).toHaveLength(2)
    } finally {
      replays.closed()
    }
  })

  /**
   * The rendered frame must be the engine's, including ON a block joint.
   *
   * At joints, the component did set the state at its absolute offset, then sampled at the right time, but the
   * `state` watcher, whose queue is flushed by the export's `nextTick`, came back with a non-inert `redrawFrozen()`
   * (the player is mounted with `frozenAt: 0`). And `sample(0)` right after a change timed later gives a zero mix
   * ratio, so the PREVIOUS state's pose: a wrong frame at each joint, thirteen times in the default montage.
   */
  it('renders exactly what the engine renders, joints included', async () => {
    const blocks = defaultCycle().blocks
    const player = await opensCycle(SETTINGS, blocks, SIZE)
    try {
      // the joint times themselves, plus one point in the middle of each block
      const dates = blocks.flatMap((b, i) => {
        const start = offsetOf(blocks, i)
        return i === 0 ? [start + b.duration / 2] : [start, start + b.duration / 2]
      })
      for (const t of dates) {
        const svg = await player.render(t)
        const expected = engineAtSameInstant(blocks, t)
        expect(bodyOf(svg), `t=${t.toFixed(2)}`).toBe(expected.bodyPath)
        expect(eyesOf(svg), `t=${t.toFixed(2)}`).toEqual(expected.eyes.map((e) => e.matrix))
      }
    } finally {
      player.closed()
    }
  })

  /**
   * Frame 0 is the FIRST state of the montage, not an idle morphing into it.
   *
   * The player was mounted without a `state` prop, so the model took its `idle` default and the engine was built on
   * it: a montage starting with sleep opened on an idle ball morphing into the small ball for 0.5 s. On-screen
   * playback does not do that, it seeds the state on the current block.
   */
  it('opens on the first state of the montage, without morphing from idle', async () => {
    for (const start of ['sleep', 'thinking'] as const) {
      const blocks = [
        { state: start, duration: 2 },
        { state: 'idle' as const, duration: 2 }
      ]
      const player = await opensCycle(SETTINGS, blocks, SIZE)
      try {
        const svg = await player.render(0)
        expect(bodyOf(svg), start).toBe(engineAtSameInstant(blocks, 0).bodyPath)
      } finally {
        player.closed()
      }
    }
  })
})

/** Without WebGL, no 2D fallback drawing: the export fails cleanly instead of producing another image. */
describe('export without WebGL', () => {
  it('the off-screen player refuses to start', async () => {
    scene.webgl = false
    try {
      await expect(opensCycle(SETTINGS, defaultCycle().blocks, SIZE)).rejects.toThrow('3D unavailable')
    } finally {
      scene.webgl = true
    }
  })
})

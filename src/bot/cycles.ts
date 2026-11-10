import { SEQUENCE, STATES, STATE_BY_ID, type StateId } from './states'

/**
 * A cycle is a montage: a list of blocks, each a state held for a chosen duration. It is the "editor" part of the
 * folder, and it keeps the folder's rules: pure data, no clock, no interface import. The same cycle must be readable
 * by the tests, the player and the timeline.
 *
 * A block has no id: it is a position in a list, the render key is the index. That keeps the localStorage JSON
 * readable and the tests deterministic.
 */
export interface Block {
  state: StateId
  duration: number
}

export interface Cycle {
  id: string
  name: string
  blocks: Block[]
}

/**
 * Floor shared by all blocks. The engine keeps a single history slot (`BotEngine.setState` overwrites `prev`), so a
 * block shorter than the entry fade of the next block jumps instead of fading.
 *
 * DERIVED from the catalog, not hand-written. The value used to be 0.6, which only worked because 0.6 was the longest
 * `morph` of the catalog at the time (the orbit, since removed). Nothing guaranteed it: adding a state that morphs in
 * 0.8 s would have made the editor shake with no test failing. Now the floor follows.
 */
export const MIN_BLOCK = Math.max(...STATES.map((s) => s.morph))

/**
 * Editor guard, not a measurement: making a block longer is safe (states saturate their ramps and hold their final
 * pose), but a track of one-minute blocks is no longer readable.
 */
export const MAX_BLOCK = 10

/**
 * How many blocks and montages we accept, when editing and when reading back.
 *
 * Not product limits but bounds against a hostile storage, which can be edited and holds a few megabytes while
 * nothing downstream is sized for it: a single cycle of 150,000 blocks (about 4 MB of JSON) gives 1,500,000 s of
 * duration, as many ticks to allocate and a track 29,700,000 px wide. The tab froze when opening Animations.
 *
 * 200 blocks make half an hour of montage, far beyond any use.
 */
export const MAX_BLOCKS = 200
export const MAX_CYCLES = 50

/** Step of the wheel and of resizing, in seconds. */
export const STEP = 0.1

const DEFAULT_CYCLE_ID = 'initial'

/** Minimum duration of a block: the engine floor, or the state's measurement. */
export function minDurationOf(state: StateId): number {
  return Math.max(MIN_BLOCK, STATE_BY_ID.get(state)?.minDuration ?? MIN_BLOCK)
}

/** Brings a duration back within its bounds and onto the step, with no floating point residue. */
export function clampDuration(state: StateId, seconds: number): number {
  const snapped = Math.round(seconds / STEP) * STEP
  const bounded = Math.min(MAX_BLOCK, Math.max(minDurationOf(state), snapped))
  return Math.round(bounded * 100) / 100
}

export function makeBlock(state: StateId): Block {
  // the reference duration is the one measured on the video for this state
  return { state, duration: clampDuration(state, STATE_BY_ID.get(state)?.duration ?? 2) }
}

/**
 * The montage measured on the video: the order of `SEQUENCE`, each state held for its measured duration. It seeds the
 * first launch, then belongs to the user: it is edited and saved like the others. The reference stays in the code:
 * clearing the storage brings it back.
 */
export function defaultCycle(): Cycle {
  return {
    /**
     * Empty name = "never named by the user", so shown in the current language. Writing "Default cycle" here would
     * have frozen it: the name goes to localStorage on the first visit and becomes user data, which changing language
     * would no longer translate.
     */
    name: '',
    id: DEFAULT_CYCLE_ID,
    blocks: SEQUENCE.map(makeBlock)
  }
}

export function totalDuration(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + b.duration, 0)
}

/** Start time of a block in the montage. */
export function offsetOf(blocks: Block[], index: number): number {
  let acc = 0
  for (let i = 0; i < index && i < blocks.length; i++) acc += blocks[i]!.duration
  return acc
}

/**
 * Block played at time `t` and the time elapsed in it. Past the last block we go back to the start: playback loops.
 * The caller checks that the montage is not empty.
 */
export function blockAt(blocks: Block[], t: number): { index: number; elapsed: number } {
  const total = totalDuration(blocks)
  if (!blocks.length || total <= 0) return { index: 0, elapsed: 0 }
  // the modulo is only applied when needed: on a time already in the cycle it
  // would only add floating point residue to the elapsed time
  const wrapped = t >= 0 && t < total ? t : ((t % total) + total) % total
  let acc = 0
  for (let i = 0; i < blocks.length; i++) {
    const end = acc + blocks[i]!.duration
    if (wrapped < end) return { index: i, elapsed: wrapped - acc }
    acc = end
  }
  return { index: blocks.length - 1, elapsed: 0 }
}

/**
 * Adds an animation at the end of the montage (right palette or "+" card).
 *
 * Capped at `MAX_BLOCKS`, like reading back. Without it the editor let you build a montage bigger than what the
 * storage returns on reload, and the work vanished silently: a read-back bound that is not also an edit bound is a
 * trap, not a protection.
 */
export function blocksWith(blocks: Block[], state: StateId): Block[] {
  if (blocks.length >= MAX_BLOCKS) return blocks
  return [...blocks, makeBlock(state)]
}

/** Moves a block, returning a new list (reactive state is replaced). */
export function moveBlock(blocks: Block[], from: number, to: number): Block[] {
  const next = blocks.slice()
  const [moved] = next.splice(from, 1)
  if (!moved) return blocks
  next.splice(Math.min(Math.max(to, 0), next.length), 0, moved)
  return next
}

/** `My cycle`, `My cycle 2`, `My cycle 3`... never the same name twice. */
export function uniqueName(base: string, cycles: Cycle[]): string {
  const taken = new Set(cycles.map((c) => c.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Collision-free id, even against a hand-edited localStorage. */
export function nextCycleId(cycles: Cycle[]): string {
  const taken = new Set(cycles.map((c) => c.id))
  let n = 1
  while (taken.has(`c${n}`)) n++
  return `c${n}`
}

/* ------------------------------------------------------- reading the storage */

function parseBlock(raw: unknown): Block | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { state, duration } = raw as { state?: unknown; duration?: unknown }
  /*
   * Validated against SEQUENCE and not `STATE_BY_ID`: the latter holds `swirl`, which is deliberately outside the
   * catalog (it is the entry transition of the settings, and a test keeps it out of the palette and the sheet). A
   * user montage is only built from the palette, so a `swirl` can only come from a hand-edited storage, and there is
   * no reason to accept it when it is excluded everywhere else.
   */
  if (typeof state !== 'string' || !SEQUENCE.includes(state as StateId)) return null
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return null
  return { state: state as StateId, duration: clampDuration(state as StateId, duration) }
}

function parseCycle(raw: unknown, seen: Cycle[]): Cycle | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { id, name, blocks } = raw as { id?: unknown; name?: unknown; blocks?: unknown }
  if (typeof id !== 'string' || !id) return null
  // the name can be empty: it is the seed montage, which follows the language
  if (typeof name !== 'string') return null
  if (!Array.isArray(blocks)) return null
  // we truncate BEFORE reading back: validating 150,000 blocks to keep 200 would
  // do exactly the work we want to avoid
  const kept = blocks
    .slice(0, MAX_BLOCKS)
    .map(parseBlock)
    .filter((b): b is Block => b !== null)
  if (!kept.length) return null
  if (seen.some((c) => c.id === id)) return null
  return { id, name, blocks: kept }
}

/**
 * localStorage can be edited by hand: we do not trust it, same rule as for the URL hash. Whatever cannot be read back
 * is dropped silently rather than breaking the app at startup.
 */
export function parseCycles(raw: string | null): Cycle[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: Cycle[] = []
  for (const item of data.slice(0, MAX_CYCLES)) {
    const cycle = parseCycle(item, out)
    if (cycle) out.push(cycle)
  }
  return out
}

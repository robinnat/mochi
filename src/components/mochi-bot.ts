/**
 * `<mochi-bot>`: the Mochi as a native Web Component, with no dependency and no framework.
 *
 * It works wherever there is a DOM: plain HTML and every framework (React, Svelte, Angular...). Import it once
 * (`import './components/mochi-bot'`), which declares the tag, then write it like any element:
 *
 *   <mochi-bot shape="star" color="#2d5bff" mood="idle" size="200" wave></mochi-bot>
 *
 * - Every option exists as an ATTRIBUTE (kebab-case, text: `frozen-at="1.2"`, `shading="false"`,
 *   `accessories='{"head":"cap"}'`) and as a JavaScript PROPERTY (camelCase, any value:
 *   `el.accessories = { head: 'cap' }`, `el.gesture = (t) => ...`).
 * - Events (`CustomEvent`, no bubbling): `ready` on the first painted 3D frame (or `no3d` if the browser has no
 *   WebGL),
 *   then `statechange`, `blockchange`, `playingchange`, `elapsedchange` as the player moves (`event.detail` holds the
 *   new
 *   value).
 * - Methods: `seek`, `renderAt`, `setMood`, `react`, `release`, `lookAt`.
 * - The Mochi is ALWAYS rendered in real 3D (WebGL): a `<canvas>` placed in an `<svg>` of the regular DOM (no shadow
 *   DOM), which also holds the small effects of the states (dots, rings, "z"). `el.svg` gives it directly; exports
 *   freeze
 *   it into an image (`freezeCanvases`). Without WebGL, a short message replaces the Mochi: there is no 2D fallback.
 * - Removed from the page, it stops its animation loop, its listeners and its timers. Moved within the page (same
 *   task),
 *   it keeps its state.
 * - The real 3D (Three.js) only loads with the first 3D Mochi, and they all share ONE WebGL context (see
 *   `src/ui/3d/scene3d.ts`).
 *
 * The engine (`src/bot/`) renders a frame for a given time; this component holds the clock, the montage, the moods,
 * the gaze and the reactions, and paints the frame in 3D.
 */

import { BotEngine, type BotFrame } from '@/bot/engine'
import { clamp, easings } from '@/bot/math'
import { lookTarget, TURN_TIME, type GazeScript } from '@/ui/gaze'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { colorOf, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID, mixHex } from '@/bot/skins'
import { blockAt, defaultCycle, offsetOf, type Block } from '@/bot/cycles'
import { HALF_VIEWBOX, RADIUS } from '@/bot/frame'
import { STATE_BY_ID, type StateId } from '@/bot/states'
import { compose, sleepZ, type Gesture } from '@/bot/gestures'
import { Moods, REACTION_FOR_EVENT, mustRedraw, resolveMood, type ReactionId } from '@/bot/moods'
import { DEFAULT_MATERIAL, type Material } from '@/ui/3d/material'
import { type Theme } from '@/ui/3d/theme'
import { resolveTheme } from '@/ui/3d/currentTheme'
import type { AccessorySelection } from '@/bot/slots'
import { materialFor, pixelGrid, effectivePixel, effectiveRenderStyle, type RenderStyleId, type PixelSizeId } from '@/ui/renderStyle'
import { computed, within, Scope, ref, untracked, shallowRef, onCleanup, triggerRef, watch, type Ref } from '@/ui/dom/reactive'
import { h, render, type Child, type VNode } from '@/ui/dom/h'

/* ------------------------------------------------------------------ options */

/** The component's options (JavaScript properties). */
export interface MochiBotProps {
  /** Width and height, in pixels. */
  size: number
  /** customizer shape id */
  shape: string
  /** customizer color id, or any hex color (`#ff8800`, `#f80`) */
  color: string
  /** customizer resting expression id */
  expression: string
  /** background color, used for the depth haze of particles */
  paper: string
  /**
 * 3D theme: `light` or `dark` (the eyes turn black); absent, the page's `currentTheme`, which follows the device
 * (`prefers-color-scheme`) unless the page sets it
 */
  theme: Theme | undefined
  /** accessories by slot (head, eyes, face, neck, back), 3D only; see `src/bot/slots.ts` */
  accessories: AccessorySelection | null
  /**
   * Freezes the rendering at this time (in seconds since the start of the state). Since the engine is a pure function
   * of time, you get an image reproducible to the pixel, with no animation loop.
   */
  frozenAt: number | undefined
  /**
 * Montage played by the player: a list of states, each held for its block's duration. By default, the cycle measured
 * on the video.
 */
  cycle: Block[]
  /** The gaze follows the pointer anywhere in the window (turns the reactions off). */
  follow: boolean
  /** Scripted arrival gaze: evaluated every frame with the time elapsed since it was set. */
  gaze: GazeScript | null
  /**
 * Render style (`3d` Soft, `flat3d` Flat, `pixel3d` Pixel); absent or unknown, the current setting
 * (`currentRenderStyle`).
 */
  renderStyle: RenderStyleId | undefined
  /**
 * Pixel size of the Pixel style (`medium`, `fine`): resolution of its canvas; absent or unknown, the current
 * setting. The old `large` falls back to `medium`.
 */
  pixel: PixelSizeId | undefined
  /** Ground shadow under the body, in all three styles (default: yes). */
  shadow: boolean
  /**
   * Shading of the body volume, Flat and Pixel styles (default: yes): the relief. `false`: one flat body color, eyes
   * unchanged. The Soft style is always shaded: `false` is ignored there.
   */
  shading: boolean
  /** Angle of the body around the vertical axis, in radians (real 3D only). 0 = facing front. */
  yaw: number
  /** Gesture (`src/bot/gestures.ts`): small offsets added to the pose, a function of the scene time. */
  gesture: ((t: number) => Gesture) | null
  /**
 * Work mood played on a loop (`idle`, `thinking`, `working`, `waiting`, `done`, `blocked`, `asleep`, or their
 * aliases).
 */
  mood: string | null
  /** Reactions to the user (hover, tap, double tap, long press, shake). `false` turns them off. */
  interactions: boolean
  /** Hello on appearing (`wave`), played once when mounted. */
  wave: boolean
  /** 3D laptop of the `working` mood. `false` hides it. */
  laptop: boolean
  /** Cap on the loop's frames per second. Absent: one frame per browser frame. */
  fps: number | undefined
  /** Alternative text read by screen readers; absent, `DEFAULT_LABEL` (English, whatever the browser language). */
  label: string | undefined
  /** Cap on the 3D canvas density (device pixels per CSS pixel). */
  maxPixelRatio: number
  /** Player: index of the current block of the montage. */
  block: number
  /** Player: state of the current block (output). */
  state: StateId
  /** Player: is the montage moving forward. */
  playing: boolean
  /** Player: time elapsed in the current block (output). */
  elapsed: number
}

type Kind = 'number' | 'text' | 'boolean' | 'json' | 'function'

interface DefProp {
  name: keyof MochiBotProps
  kind: Kind
  /** default value (a factory for an array) */
  initial: () => unknown
  /** no attribute (function) */
  withoutAttribute?: boolean
}

const d = <T>(v: T) => () => v

/**
 * Default alternative text, in English whatever the browser language: the tag never translates itself. A page in
 * another language passes its own `label` (the app does).
 */
export const DEFAULT_LABEL = 'Animated Mochi avatar'
/** Shown instead of the Mochi when the browser cannot draw 3D (no WebGL). */
const NO_3D_MESSAGE = '3D needs WebGL'

/** Every option, its attribute type and its default value. */
export const PROPERTIES: DefProp[] = [
  { name: 'size', kind: 'number', initial: d(320) },
  { name: 'shape', kind: 'text', initial: d(DEFAULT_SHAPE) },
  { name: 'color', kind: 'text', initial: d(DEFAULT_COLOR) },
  { name: 'expression', kind: 'text', initial: d(DEFAULT_EXPRESSION) },
  { name: 'paper', kind: 'text', initial: d('#f9f9f9') },
  { name: 'theme', kind: 'text', initial: d(undefined) },
  { name: 'accessories', kind: 'json', initial: d(null) },
  { name: 'frozenAt', kind: 'number', initial: d(undefined) },
  { name: 'cycle', kind: 'json', initial: () => defaultCycle().blocks },
  { name: 'follow', kind: 'boolean', initial: d(false) },
  { name: 'gaze', kind: 'function', initial: d(null), withoutAttribute: true },
  { name: 'renderStyle', kind: 'text', initial: d(undefined) },
  { name: 'pixel', kind: 'text', initial: d(undefined) },
  { name: 'shadow', kind: 'boolean', initial: d(true) },
  { name: 'shading', kind: 'boolean', initial: d(true) },
  { name: 'yaw', kind: 'number', initial: d(0) },
  { name: 'gesture', kind: 'function', initial: d(null), withoutAttribute: true },
  { name: 'mood', kind: 'text', initial: d(null) },
  { name: 'interactions', kind: 'boolean', initial: d(true) },
  { name: 'wave', kind: 'boolean', initial: d(false) },
  { name: 'laptop', kind: 'boolean', initial: d(true) },
  { name: 'fps', kind: 'number', initial: d(undefined) },
  { name: 'label', kind: 'text', initial: d(undefined) },
  { name: 'maxPixelRatio', kind: 'number', initial: d(2) },
  { name: 'block', kind: 'number', initial: d(0) },
  { name: 'state', kind: 'text', initial: d('idle') },
  { name: 'playing', kind: 'boolean', initial: d(false) },
  { name: 'elapsed', kind: 'number', initial: d(0) }
]

/** `frozenAt` -> `frozen-at` */
export const attributeOf = (name: string) => name.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())

const BY_ATTRIBUTE = new Map(PROPERTIES.filter((p) => !p.withoutAttribute).map((p) => [attributeOf(p.name), p]))

/**
 * Reads an attribute according to the option's type. Removed attribute: `undefined`, so the default value.
 */
export function readAttribute(kind: Kind, v: string | null): unknown {
  if (v === null) return undefined
  switch (kind) {
    case 'number': {
      const n = Number(v)
      return v.trim() === '' || !Number.isFinite(n) ? undefined : n
    }
    case 'boolean':
      return v !== 'false' && v !== '0'
    case 'json':
      try {
        return JSON.parse(v)
      } catch {
        return undefined
      }
    default:
      return v
  }
}

/** Player events, by option. */
const EVENT_FOR_PROP: Partial<Record<keyof MochiBotProps, string>> = {
  block: 'blockchange',
  state: 'statechange',
  playing: 'playingchange',
  elapsed: 'elapsedchange'
}

/* ------------------------------------------------------------------ cadence */

/**
 * Adaptive cadence shared by every Mochi of the page (v13). Each browser frame, the 3D drawing time of all the Mochiz
 * is added up. When frames come late (more than `CADENCE_LATE_MS` apart on average) AND drawing every Mochi at every
 * frame costs more than `CADENCE_HALF_MS` (a slow phone, many Mochiz on screen), each one draws every other frame, half
 * of them on even frames and half on odd ones: every Mochi still moves at 30 frames per second, steadily, and the page
 * gets its time back. Back to every frame when drawing them all costs less than `CADENCE_FULL_MS`. A fast computer
 * that keeps up never halves. A Mochi with its own `fps` keeps it.
 *
 * Declared before the tag: declaring it upgrades the `<mochi-bot>` already in the page at once, and they read this.
 */
export const CADENCE_LATE_MS = 20
export const CADENCE_HALF_MS = 8
export const CADENCE_FULL_MS = 6
export const cadence = { ms: -1, frame: 0, cost: 0, average: 0, interval: 1000 / 60, half: false, count: 0 }

/** Called at the start of each Mochi's frame: a new browser frame closes the cost of the previous one. */
export function cadenceFrame(ms: number): number {
  if (ms === cadence.ms) return cadence.frame
  if (cadence.ms >= 0) {
    // cost of drawing EVERY Mochi in one frame: in half cadence, a frame only drew half of them
    // one slow frame (a shader compiling, a Mochi mounting) weighs at most 50 ms: only a lasting load changes the cadence
    const full = Math.min(50, cadence.half ? cadence.cost * 2 : cadence.cost)
    cadence.average = cadence.average * 0.95 + full * 0.05
    // a gap of more than 200 ms is a pause (hidden tab, debugger), not a slow frame
    const gap = ms - cadence.ms
    if (gap > 0 && gap < 200) cadence.interval = cadence.interval * 0.95 + Math.min(50, gap) * 0.05
    if (!cadence.half && cadence.interval > CADENCE_LATE_MS && cadence.average > CADENCE_HALF_MS) cadence.half = true
    else if (cadence.half && cadence.average < CADENCE_FULL_MS) cadence.half = false
  }
  cadence.ms = ms
  cadence.frame++
  cadence.cost = 0
  return cadence.frame
}

/* ------------------------------------------------------------------ style */

let styleAdds = false
/**
 * A single rule, with no specificity (`:where`): a class set by the page always wins. The Mochi behaves like an
 * image: inline, its box is its drawing's, and it shrinks with its container.
 */
function addStyle() {
  if (styleAdds || typeof document === 'undefined') return
  styleAdds = true
  const s = document.createElement('style')
  s.dataset.mochiBot = ''
  s.textContent =
    ':where(mochi-bot){display:inline-block}:where(mochi-bot)>svg{display:block;max-width:100%;height:auto}'
  document.head.prepend(s)
}

/* ------------------------------------------------------------------ element */

const BaseElement: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement

interface Internal {
  seek: (index: number, offset?: number) => void
  renderAt: (t: number) => void
  setMood: (id: string | null) => void
  react: (id: ReactionId | string) => boolean
  release: () => void
  lookAt: (target: { nx: number; ny: number } | null) => void
}

export class MochiBotElement extends BaseElement {
  static get observedAttributes() {
    return [...BY_ATTRIBUTE.keys()]
  }

  /** one ref per option: the drawing follows each one */
  private _refs = new Map<string, Ref<unknown>>()
  /** value explicitly given (property or attribute); absent, the default */
  private _poses = new Map<string, unknown>()
  private _scope: Scope | null = null
  private _internal: Internal | null = null
  private _svg: SVGSVGElement | null = null

  constructor() {
    super()
    for (const p of PROPERTIES) this._refs.set(p.name, ref(p.initial()))
  }

  /** The drawn `<svg>` (to export or measure it). */
  get svg(): SVGSVGElement | null {
    return this._svg
  }

  /** Sets an option. `undefined` restores the default value. */
  _set(name: string, v: unknown) {
    const def = PROPERTIES.find((p) => p.name === name)!
    if (v === undefined) this._poses.delete(name)
    else this._poses.set(name, v)
    this._refs.get(name)!.value = v === undefined ? def.initial() : v
  }

  _read(name: string): unknown {
    return this._refs.get(name)!.value
  }

  /** Writes a player output and signals it. */
  _emit(name: keyof MochiBotProps, v: unknown) {
    const r = this._refs.get(name)!
    if (Object.is(r.value, v)) return
    this._poses.set(name, v)
    r.value = v
    this.dispatchEvent(new CustomEvent(EVENT_FOR_PROP[name]!, { detail: v }))
  }

  attributeChangedCallback(name: string, _before: string | null, v: string | null) {
    const p = BY_ATTRIBUTE.get(name)
    if (p) this._set(p.name, readAttribute(p.kind, v))
  }

  connectedCallback() {
    // a property set before the tag was declared is an own property: take it over
    for (const p of PROPERTIES) {
      if (Object.prototype.hasOwnProperty.call(this, p.name)) {
        const v = (this as unknown as Record<string, unknown>)[p.name]
        delete (this as unknown as Record<string, unknown>)[p.name]
        this._set(p.name, v)
      }
    }
    if (this._scope) return
    addStyle()
    const scope = new Scope()
    this._scope = scope
    // untracked: the element can be inserted while a page is drawing, and that page must not depend on it
    this._internal = within(scope, () => untracked(() => mountBot(this)))
  }

  disconnectedCallback() {
    // a move within the page (removed then put back in the same task) must lose nothing
    queueMicrotask(() => {
      if (this.isConnected || !this._scope) return
      this._scope.stop()
      this._scope = null
      this._internal = null
      render(null, this)
      this._svg = null
    })
  }

  /** Moves the playhead: block `index`, `offset` seconds into it. */
  seek(index: number, offset = 0) {
    this._internal?.seek(index, offset)
  }
  /** Renders the MONTAGE at absolute time `t`, without a clock (frame by frame exports). */
  renderAt(t: number) {
    this._internal?.renderAt(t)
  }
  /** Changes the mood (`null` turns the layer off). Glides from one to the other without a jump. */
  setMood(id: string | null) {
    this._internal?.setMood(id)
  }
  /** Plays a reaction (`startle`, `laugh`, `blush`, `dizzy`, `wave`), then hands back to the mood. */
  react(id: ReactionId | string): boolean {
    return this._internal?.react(id) ?? false
  }
  /** End of a held reaction (long press). */
  release() {
    this._internal?.release()
  }
  /** Hover gaze, outside events: `nx`, `ny` from -1 to 1 (right and down positive), `null` to let go. */
  lookAt(target: { nx: number; ny: number } | null) {
    this._internal?.lookAt(target)
  }

  /** @internal the drawing has just been set */
  _updateSvg(s: SVGSVGElement | null) {
    this._svg = s
  }
}

// one JavaScript property per option
for (const p of PROPERTIES) {
  Object.defineProperty(MochiBotElement.prototype, p.name, {
    get(this: MochiBotElement) {
      return this._read(p.name)
    },
    set(this: MochiBotElement, v: unknown) {
      this._set(p.name, v)
    },
    configurable: true,
    enumerable: true
  })
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface MochiBotElement extends MochiBotProps {}

declare global {
  interface HTMLElementTagNameMap {
    'mochi-bot': MochiBotElement
  }
}

export const TAG_NAME = 'mochi-bot'

/** Declares the tag (no effect if it already is). Called when this module is imported. */
export function defineMochiBot() {
  if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) customElements.define(TAG_NAME, MochiBotElement)
}
defineMochiBot()

/* ------------------------------------------------------------------ logique */

/**
 * Sets up a Mochi on the element: clock, engine, moods, gaze, reactions and drawing. Everything created here stops
 * with the element's scope.
 */
function mountBot(host: MochiBotElement): Internal {
  const r = <K extends keyof MochiBotProps>(k: K) => (host as unknown as { _refs: Map<string, Ref<MochiBotProps[K]>> })._refs.get(k)!
  // tracked read of the options: `props.x` in a computation or a drawing reruns when `x` changes
  const props = new Proxy({} as MochiBotProps, {
    get: (_, k: string) => r(k as keyof MochiBotProps).value
  })
  // player outputs: read like refs, written with a signal
  const model = <K extends 'block' | 'state' | 'playing' | 'elapsed'>(k: K): Ref<MochiBotProps[K]> => ({
    get value() {
      return r(k).value
    },
    set value(v) {
      host._emit(k, v)
    }
  })
  const block = model('block')
  const state = model('state')
  const playing = model('playing')
  const elapsed = model('elapsed')

  let readyEmitted = false
  const R = RADIUS
  const VB = HALF_VIEWBOX

  const shapeRadii = computed(() => SHAPE_BY_ID.get(props.shape)?.radii ?? null)
  const ink = computed(() => colorOf(props.color))
  const expression = computed(() => EXPRESSION_BY_ID.get(props.expression) ?? null)

  /* --------------------------------------------------------- render style */

  const renderStyle = computed(() => effectiveRenderStyle(props.renderStyle))
  const grid = computed(() => pixelGrid(effectivePixel(props.pixel)))

  const engine = new BotEngine(R, state.value, shapeRadii.value, expression.value)
  const frame = shallowRef<BotFrame>(engine.sample(props.frozenAt ?? 0))
  const uid = Math.random().toString(36).slice(2, 8)

  const time = ref(props.frozenAt ?? 0)

  /* ------------------------------------------------- moods and reactions */

  const reduced = ref(false)
  const moods = new Moods(resolveMood(props.mood), { base: expression.value })
  /** Small "z" of the `asleep` mood, drawn in SVG over every style. */
  const zMarques = computed(() => {
    if (resolveMood(props.mood) !== 'asleep') return []
    return sleepZ(reduced.value || props.frozenAt !== undefined ? 1.2 : time.value).map((z, i) => {
      const x = z.x * 100 + 18
      const y = z.y * 100 - 10
      const k = z.size * 100
      return {
        i,
        d: `M${(x - k / 2).toFixed(1)} ${(y - k / 2).toFixed(1)}h${k.toFixed(1)}l${(-k).toFixed(1)} ${k.toFixed(1)}h${k.toFixed(1)}`,
        op: reduced.value || props.frozenAt !== undefined ? 0.8 - 0.3 * i : z.opacity
      }
    })
  })
  const colorZ = computed(() => mixHex(ink.value, '#1a1630', 0.5))
  const moodActive = computed(() => resolveMood(props.mood) !== null)


  const gestureA = (t: number): Gesture | undefined => {
    const b = props.gesture ? props.gesture(t) : undefined
    const x = moods.sample(t)
    return x ? (b ? compose(b, x) : x) : b
  }

  let raf = 0
  let nextAt = Infinity
  let last = 0
  let clock = 0
  let blockStart = 0

  /** Sets block `i`: state, engine, and end time. */
  function apply(i: number, from = 0) {
    const b = props.cycle[i]
    if (!b) {
      nextAt = Infinity
      return
    }
    blockStart = clock - from
    elapsed.value = from
    const next = moodActive.value ? 'idle' : b.state
    state.value = next
    engine.setState(next, clock)
    nextAt = playing.value && !moodActive.value ? blockStart + b.duration : Infinity
  }

  function goToBlock(i: number) {
    block.value = i
    apply(i)
  }

  let pendingOffset = 0
  function seek(index: number, offset = 0) {
    if (block.value === index) {
      apply(index, offset)
      return
    }
    pendingOffset = offset
    block.value = index
  }

  /**
   * Renders the MONTAGE at absolute time `t`, without a clock: off-screen capture of a whole cycle, frame by frame.
   * Each state change is timed at the ABSOLUTE offset of its block; going back starts again without history.
   */
  let lastBlock = -1
  /** driven frame by frame (`renderAt`, exports): every requested frame is drawn, several per browser frame if asked */
  let driven = false
  function renderAt(t: number) {
    driven = true
    const blocks = props.cycle
    if (!blocks.length) return
    const { index } = blockAt(blocks, t)
    if (index !== lastBlock) {
      const b = blocks[index]!
      state.value = b.state
      if (index < lastBlock) engine.reset(b.state, offsetOf(blocks, index))
      else engine.setState(b.state, offsetOf(blocks, index))
      lastBlock = index
    }
    time.value = t
    frame.value = engine.sample(t, gestureA(t))
    triggerRef(frame)
  }

  function setMood(id: string | null) {
    moods.setMood(id, clock)
    apply(block.value, elapsed.value)
    redrawFrozen()
  }
  function react(id: ReactionId | string) {
    if (!moods.react(id, clock)) return false
    redrawFrozen()
    return true
  }
  function release() {
    moods.release(clock)
  }
  function lookAt(target: { nx: number; ny: number } | null) {
    moods.lookAt(target, clock)
  }

  /* -------------------------------------------------------------- real 3D */

  type Module3d = typeof import('@/ui/3d/scene3d')
  const m3d = shallowRef<Module3d | null>(null)
  /** The browser has no WebGL (or the 3D module could not load): a message replaces the Mochi. */
  const no3d = ref(false)
  let canvas: HTMLCanvasElement | null = null
  const canvasRef = ref(0)
  const real3d = computed(() => m3d.value !== null)
  /** this Mochi's own 3D body (mesh cache, face textures, accessories), freed with the element */
  let slot: import('@/ui/3d/scene3d').AvatarSlot | null = null
  const pxCanvas = computed(() =>
    renderStyle.value === 'pixel3d'
      ? grid.value
      : Math.round(props.size * Math.min(props.maxPixelRatio, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  )

  // the 3D (Three.js) loads on mount, once for every Mochi of the page
  import('@/ui/3d/scene3d')
    .then((m) => {
      if (!m.webglAvailable()) return signalNo3d()
      slot = m.avatarSlot()
      m3d.value = m
    })
    // module not found: same fallback as without WebGL
    .catch(signalNo3d)
  function signalNo3d() {
    no3d.value = true
    host.dispatchEvent(new CustomEvent('no3d'))
  }

  const decorAlpha = computed(() => (real3d.value && props.yaw ? Math.max(0, Math.cos(props.yaw)) ** 3 : 1))

  /* ------------------------------------------------- laptop of the "working" mood */

  let laptopK = 0
  let laptopTo = 0
  const laptopWanted = () => props.laptop !== false && moods.mood === 'working'
  function advanceLaptop(dt: number, net = false) {
    const target = laptopWanted() ? 1 : 0
    if (target !== laptopTo) laptopTo = target
    laptopK = net ? target : Math.min(1, Math.max(0, laptopK + Math.sign(target - laptopK) * Math.min(Math.abs(target - laptopK), dt / 0.45)))
    moods.gazeLaptop = turnLaptop()
  }
  function turnLaptop(): number {
    return laptopTo >= 1 ? Math.min(1, laptopK * 1.2) : laptopK * laptopK * (3 - 2 * laptopK)
  }
  function laptopScale(): number {
    const k = laptopK
    if (k <= 0) return 0
    if (laptopTo >= 1 || k >= 1) {
      const c1 = 1.2
      return 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2
    }
    return k * k * (3 - 2 * k)
  }

  const themeEff = computed<Theme>(() => resolveTheme(props.theme))
  const render3dEff = computed<Material>(() => materialFor(renderStyle.value, DEFAULT_MATERIAL))

  /** browser frame of the last drawing (cadence numbering) */
  let drawnFrame = -1
  function draw3d() {
    const m = m3d.value
    if (!real3d.value || !m || !canvas) return
    // an animated Mochi draws at most once per browser frame: a page that turns it (yaw) in its own
    // requestAnimationFrame used to make it draw twice. Its next frame draws the latest state anyway.
    if (props.frozenAt === undefined && !driven && readyEmitted && drawnFrame === cadence.frame) return
    drawnFrame = cadence.frame
    const t0 = performance.now()
    m.renderAvatar(canvas, frame.value, ink.value, props.paper, render3dEff.value, props.shape, props.yaw + 0.3 * turnLaptop(), props.accessories ?? {}, undefined, themeEff.value, undefined, laptopScale(), props.shadow, props.shading, false, undefined, slot ?? undefined)
    cadence.cost += performance.now() - t0
    if (!readyEmitted) {
      readyEmitted = true
      host.dataset.ready = '1'
      host.dispatchEvent(new CustomEvent('ready'))
    }
  }

  /** Shape change: once the morph is over, the 3D accessories fit the final shape again. */
  let timerShape = 0
  watch(
    () => props.shape,
    () => {
      clearTimeout(timerShape)
      timerShape = window.setTimeout(() => {
        if (!real3d.value || !m3d.value) return
        m3d.value.invalidateAccessories3d(slot ?? undefined)
        draw3d()
      }, BotEngine.SHAPE_MORPH * 1000 + 120)
    }
  )
  onCleanup(() => {
    clearTimeout(timerShape)
    if (slot) m3d.value?.releaseSlot(slot)
  })

  watch(
    [frame, real3d, canvasRef, ink, pxCanvas, render3dEff, () => props.yaw, themeEff, () => props.accessories, () => props.shadow, () => props.shading],
    draw3d,
    { flush: 'post' }
  )

  /* ------------------------------------------------------- tracking gaze */

  let svg: SVGSVGElement | null = null
  let pointer: { x: number; y: number } | null = null
  let aiming = false
  let turnSince = 0

  function onPointerMove(event: PointerEvent) {
    // touch has no lingering cursor
    if (event.pointerType === 'touch') return
    pointer = { x: event.clientX, y: event.clientY }
  }
  function onPointerLeave() {
    pointer = null
  }
  function endAim() {
    if (!aiming) return
    engine.setLook(null, clock, TURN_TIME)
    aiming = false
  }
  /** Aims at the pointer; the rectangle is read again every frame (the avatar can move). */
  function aim() {
    if (!STATE_BY_ID.get(state.value)?.baseFace) {
      endAim()
      return
    }
    const box = svg?.getBoundingClientRect()
    // box with no area (hidden panel): nothing to aim at, and above all no NaN in the engine
    if (!box || box.width === 0 || box.height === 0) return
    if (!aiming) turnSince = clock
    const halfWidth = Math.max(1, window.innerWidth / 2)
    const halfHeight = Math.max(1, window.innerHeight / 2)
    engine.setLook(
      lookTarget({
        nx: pointer ? clamp((pointer.x - (box.left + box.width / 2)) / halfWidth, -1, 1) : 0,
        ny: pointer ? clamp((pointer.y - (box.top + box.height / 2)) / halfHeight, -1, 1) : 0,
        turn: easings.easeOutQuint(clamp((clock - turnSince) / TURN_TIME)),
        pointer: pointer !== null
      }),
      clock
    )
    aiming = true
  }

  /* ------------------------------------------------- arrival gaze */

  let gazeSince = 0
  let scripted = false
  /** Short but non-zero catch-up (at zero, the engine divides zero by zero). */
  const SCRIPT_MORPH = 1 / 60
  function scriptedGaze(run: GazeScript) {
    engine.setLook(run(clock - gazeSince), clock, SCRIPT_MORPH)
  }
  watch(
    () => props.gaze,
    (run) => {
      if (run) {
        gazeSince = clock
        scripted = true
        // start value already fully applied on the first frame
        engine.setLook(run(0), clock - SCRIPT_MORPH, SCRIPT_MORPH)
        return
      }
      if (!scripted) return
      engine.setLook(null, clock)
      scripted = false
    },
    { immediate: true }
  )

  /* ------------------------------------------------- reactions to the user */

  const TAP_MAX = 320
  const DOUBLE_MAX = 380
  const LONG_PRESS = 450
  const MOVE_MAX = 10

  const interactive = computed(() => props.interactions && props.frozenAt === undefined && !props.follow)
  let press: { x: number; y: number; t: number; timer: number; long: boolean } | null = null
  let lastTap = -1e9
  let shake: { direction: number; t: number }[] = []
  let lastDx = 0
  let turns: { t: number; d: number }[] = []
  let yawPrev = props.yaw

  function normalized(e: PointerEvent): { nx: number; ny: number } | null {
    const box = svg?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return null
    return {
      nx: clamp((e.clientX - (box.left + box.width / 2)) / (box.width * 0.6), -1, 1),
      ny: clamp((e.clientY - (box.top + box.height / 2)) / (box.height * 0.6), -1, 1)
    }
  }
  function onHover(e: PointerEvent) {
    if (!interactive.value || reduced.value) return
    const c = normalized(e)
    if (c) moods.lookAt(c, clock)
  }
  function onLeaves() {
    if (!interactive.value) return
    moods.lookAt(null, clock)
  }
  function onPress(e: PointerEvent) {
    if (!interactive.value || (e.button !== undefined && e.button > 0)) return
    onHover(e)
    clearTimeout(press?.timer)
    press = {
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      long: false,
      timer: window.setTimeout(() => {
        if (!press) return
        press.long = true
        moods.react(REACTION_FOR_EVENT.long, clock)
      }, LONG_PRESS)
    }
    shake = []
    lastDx = 0
    // the parent can capture the pointer (drag to turn): we follow the end on the window
    window.addEventListener('pointermove', onDrag)
    window.addEventListener('pointerup', onReleased)
    window.addEventListener('pointercancel', onReleased)
  }
  function onDrag(e: PointerEvent) {
    if (!press) return
    const dx = e.clientX - press.x
    const dy = e.clientY - press.y
    if (!press.long && Math.hypot(dx, dy) > MOVE_MAX) {
      clearTimeout(press.timer)
      press.t = -1e9
    }
    // shake: at least four sharp direction changes in less than half a second
    const step = e.movementX || e.clientX - lastDx
    if (Math.abs(step) > 6) {
      const direction = Math.sign(step)
      const lastShake = shake[shake.length - 1]
      if (!lastShake || lastShake.direction !== direction) {
        shake.push({ direction, t: e.timeStamp })
        shake = shake.filter((s) => e.timeStamp - s.t < 600)
        if (shake.length >= 5 && interactive.value) {
          shake = []
          moods.react(REACTION_FOR_EVENT.shaken, clock)
        }
      }
    }
    lastDx = e.clientX
  }
  function onReleased(e: PointerEvent) {
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', onReleased)
    window.removeEventListener('pointercancel', onReleased)
    const a = press
    press = null
    if (!a) return
    clearTimeout(a.timer)
    if (e.pointerType === 'touch') moods.lookAt(null, clock)
    if (a.long) {
      moods.release(clock)
      return
    }
    if (e.type === 'pointercancel' || e.timeStamp - a.t > TAP_MAX) return
    if (e.timeStamp - lastTap < DOUBLE_MAX) {
      lastTap = -1e9
      moods.react(REACTION_FOR_EVENT.double, clock)
    } else {
      lastTap = e.timeStamp
      moods.react(REACTION_FOR_EVENT.tap, clock)
    }
  }

  /** Fast spin: the 3D model (`yaw`) does more than a turn in less than a second. */
  watch(
    () => props.yaw,
    (v) => {
      const now = typeof performance === 'undefined' ? 0 : performance.now()
      if (!interactive.value) {
        yawPrev = v
        return
      }
      turns.push({ t: now, d: Math.abs(v - yawPrev) })
      yawPrev = v
      turns = turns.filter((x) => now - x.t < 900)
      if (turns.reduce((n, x) => n + x.d, 0) >= Math.PI * 2 && moods.reaction(clock) !== 'dizzy') {
        turns = []
        moods.react(REACTION_FOR_EVENT.shaken, clock)
      }
    }
  )

  watch(
    () => props.mood,
    (id) => setMood(resolveMood(id))
  )

  /**
   * On screen: off screen (scrolled away, hidden panel), the loop keeps the clock and the montage going but neither
   * samples nor draws anything; the Mochi is up to date as soon as it comes back. Visible until told otherwise.
   */
  let onScreen = true
  let io: IntersectionObserver | null = null
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => {
      const was = onScreen
      onScreen = !!entries[entries.length - 1]?.isIntersecting
      // back on screen: the next frame draws at once, whatever the `fps` cap
      if (onScreen && !was) lastDrawing = 0
    })
    io.observe(host)
  }

  /** even or odd frames, when the cadence is halved */
  const parity = cadence.count++ % 2

  let lastDrawing = 0
  function tick(ms: number) {
    raf = requestAnimationFrame(tick)
    // scene clock with a bounded delta: a tab hidden then shown again resumes without a jump
    const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0
    last = ms
    clock += dt
    // stopping does not freeze the clock: only the chaining and the playhead are suspended
    if (playing.value) {
      if (clock >= nextAt && props.cycle.length) goToBlock((block.value + 1) % props.cycle.length)
      else elapsed.value = clock - blockStart
    }
    if (props.follow) aim()
    else if (props.gaze) scriptedGaze(props.gaze)
    const frameNo = cadenceFrame(ms)
    if (!onScreen || !mustRedraw(ms, lastDrawing, props.fps)) return
    if (cadence.half && !props.fps && frameNo % 2 !== parity) return
    lastDrawing = ms
    time.value = clock
    advanceLaptop(dt)
    frame.value = engine.sample(clock, gestureA(clock))
    triggerRef(frame)
  }

  /** Redraws without the loop: used by still images when an option changes. */
  function redrawFrozen() {
    if (props.frozenAt === undefined) return
    time.value = props.frozenAt
    advanceLaptop(0, true)
    frame.value = engine.sample(props.frozenAt, gestureA(props.frozenAt))
    triggerRef(frame)
  }

  watch(
    () => block.value,
    (i) => {
      apply(i, pendingOffset)
      pendingOffset = 0
    }
  )
  // state change coming from outside (still images); otherwise already applied by `renderAt` or `apply`
  watch(
    () => state.value,
    (id) => {
      if (engine.state === id) return
      engine.setState(id, clock)
      redrawFrozen()
    }
  )
  watch(
    () => playing.value,
    (on) => {
      if (on) apply(block.value, elapsed.value)
      else nextAt = Infinity
    }
  )
  watch(
    () => props.cycle,
    (blocks) => {
      if (!blocks.length) {
        nextAt = Infinity
        return
      }
      const i = Math.min(block.value, blocks.length - 1)
      if (i !== block.value) {
        goToBlock(i)
        return
      }
      nextAt = playing.value ? blockStart + blocks[i]!.duration : Infinity
    }
  )
  watch(shapeRadii, (radii) => {
    // the clock has passed: the engine morphs to the new shape
    engine.setShape(radii, clock)
    redrawFrozen()
  })
  watch(expression, (expr) => {
    moods.setBase(expr)
    engine.setExpression(expr, clock)
    redrawFrozen()
  })
  watch(() => props.frozenAt, redrawFrozen)

  function detach() {
    window.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerleave', onPointerLeave)
  }
  watch(
    () => props.follow && props.frozenAt === undefined,
    (on) => {
      if (on) {
        window.addEventListener('pointermove', onPointerMove)
        document.addEventListener('pointerleave', onPointerLeave)
        return
      }
      detach()
      endAim()
    },
    { immediate: true }
  )
  watch(() => props.gesture, redrawFrozen)

  /* ------------------------------------------------------------------ drawing */

  function dotAttrs(dot: BotFrame['dots'][number]) {
    const fill = dot.color ?? (dot.depth === undefined ? ink.value : mixHex(props.paper, ink.value, dot.depth))
    const common = { fill, opacity: dot.opacity }
    return dot.d
      ? { ...common, d: dot.d, transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})` }
      : { ...common, cx: dot.x, cy: dot.y, r: dot.r }
  }

  function drawing(): VNode {
    const f = frame.value
    const children: Child[] = []
    children.push(
      h(
        'defs',
        null,
        f.arcs.map((arc) =>
          h(
            'linearGradient',
            { key: arc.id, id: `${uid}-${arc.id}`, gradientUnits: 'userSpaceOnUse', x1: arc.grad.x1, y1: arc.grad.y1, x2: arc.grad.x2, y2: arc.grad.y2 },
            arc.grad.stops.map((c, i) => h('stop', { key: i, offset: i / (arc.grad.stops.length - 1), 'stop-color': c }))
          )
        )
      )
    )
    // back half of the orbits: placed before the 3D body, so hidden by it
    children.push(
      h(
        'g',
        { fill: 'none', 'stroke-linecap': 'round' },
        f.arcs.map((arc) => h('path', { key: `b${arc.id}`, d: arc.back, stroke: `url(#${uid}-${arc.id})`, 'stroke-width': arc.width, opacity: arc.opacity }))
      )
    )
    if (real3d.value) {
      // the body, eyes and accessories are rendered by WebGL in this canvas, fitted to the viewBox
      children.push(
        h(
          'foreignObject',
          { key: 'fo', x: -VB, y: -VB, width: VB * 2, height: VB * 2 },
          h('canvas', {
            width: pxCanvas.value,
            height: pxCanvas.value,
            'data-real3d': '1',
            style: renderStyle.value === 'pixel3d' ? 'image-rendering: pixelated; display: block; width: 100%; height: 100%' : 'display: block; width: 100%; height: 100%',
            ref: (el: Element | null) => {
              canvas = el as HTMLCanvasElement | null
              canvasRef.value++
            }
          })
        )
      )
    } else if (no3d.value) {
      // no WebGL: no 2D fallback drawing, a short message instead of the Mochi
      children.push(
        h(
          'text',
          { key: 'no3d', 'data-no3d': '1', x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 18, 'font-family': 'system-ui, sans-serif', fill: '#8a8a8a' },
          NO_3D_MESSAGE
        )
      )
    }
    children.push(h('g', { opacity: decorAlpha.value }, f.dots.map((dot, i) => h(dot.d ? 'path' : 'circle', { key: `pf${i}`, ...dotAttrs(dot) }))))
    // front half of the orbits
    children.push(
      h(
        'g',
        { fill: 'none', 'stroke-linecap': 'round' },
        f.arcs.map((arc) => h('path', { key: `f${arc.id}`, d: arc.front, stroke: `url(#${uid}-${arc.id})`, 'stroke-width': arc.width, opacity: arc.opacity }))
      )
    )
    const z = zMarques.value
    if (z.length)
      children.push(
        h(
          'g',
          { key: 'zzz', 'data-zzz': '1', fill: 'none', stroke: colorZ.value, 'stroke-width': '10', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
          z.map((m) => h('path', { key: m.i, d: m.d, opacity: m.op }))
        )
      )
    return h(
      'svg',
      {
        width: props.size,
        height: props.size,
        viewBox: `${-VB} ${-VB} ${VB * 2} ${VB * 2}`,
        role: 'img',
        'aria-label': props.label ?? DEFAULT_LABEL,
        style: z.length ? 'overflow: visible' : undefined,
        onPointerenter: onHover,
        onPointermove: onHover,
        onPointerleave: onLeaves,
        onPointerdown: onPress,
        ref: (el: Element | null) => {
          svg = el as SVGSVGElement | null
          host._updateSvg(svg)
        }
      },
      children
    )
  }

  // drawing is an effect: it reruns (queued, once per task, before the 3D drawing) when what it reads changes
  watch(drawing, (v) => render(v, host))

  /* ------------------------------------------------------------------ montage */

  let mqReduced: MediaQueryList | null = null
  const updateReduced = () => {
    reduced.value = !!mqReduced?.matches
    moods.reduced = reduced.value
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    updateReduced()
    mqReduced.addEventListener?.('change', updateReduced)
  }
  render(drawing(), host)

  if (props.frozenAt !== undefined) redrawFrozen()
  else {
    if (props.wave) {
      // reduced motion: a simple fade; otherwise the reaction makes the Mochi grow
      if (reduced.value) (svg as SVGSVGElement | null)?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' })
      else moods.react(REACTION_FOR_EVENT.arrival, clock)
    }
    // the cursor can arrive already in place
    apply(block.value, elapsed.value)
    raf = requestAnimationFrame(tick)
  }

  onCleanup(() => {
    cancelAnimationFrame(raf)
    io?.disconnect()
    detach()
    clearTimeout(press?.timer)
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', onReleased)
    window.removeEventListener('pointercancel', onReleased)
    mqReduced?.removeEventListener?.('change', updateReduced)
  })

  return { seek, renderAt, setMood, react, release, lookAt }
}

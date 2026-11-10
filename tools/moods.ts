import { BotEngine } from '../src/bot/engine'
import { HALF_VIEWBOX, RADIUS } from '../src/bot/frame'
import { COLORS, SHAPES } from '../src/bot/skins'
import { Moods, MOODS, REACTIONS, type MoodId } from '../src/bot/moods'
import type { AccessorySelection } from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'
import type { Theme } from '../src/ui/3d/theme'
import { pixelGrid } from '../src/ui/renderStyle'

/**
 * Renders a mood or interaction animation: three Mochis side by side (varied shapes, colors, styles and accessories,
 * one in the dark theme). Same chain as the component: `Moods.sample` -> `BotEngine.sample(t, gesture)` ->
 * `renderAvatar`. Each frame is a pure function of `t`: events (tap, press...) are replayed with their times, so any
 * frame renders alone.
 */
const q = new URLSearchParams(location.search)
const W = 1080
const H = 720
const BACKGROUND = '#f4f1ea'
const INK = '#26222f'
const GRAY = '#8a8794'
const PAPER = '#f9f9f9'
const CARD = '#fffdf9'
const CARD_DARK = '#1b1922'

const hexOf = (id: string) => COLORS.find((c) => c.id === id)!.hex
const SHAPE_LIST = ['star', 'circle', 'squircle', 'drop', 'hexagon', 'cloud', 'egg', 'triangle', 'flower', 'capsule', 'pebble']
const SHAPE_NAMES: Record<string, string> = {
  circle: 'round', star: 'star', squircle: 'cube', cloud: 'cloud', triangle: 'pyramid', hexagon: 'hexagon',
  drop: 'drop', egg: 'egg', flower: 'flower', capsule: 'capsule', pebble: 'pebble'
}
const ACCESSORY_PALETTE = ['turquoise', 'amber', 'pink', 'blue', 'violet', 'orange', 'green', 'red', 'ink', 'turquoise', 'pink']
const STYLES: Array<{ name: string; renderStyle: Material }> = [
  { name: 'Soft', renderStyle: 'soft' },
  { name: 'Flat', renderStyle: 'toon' },
  { name: 'Pixel', renderStyle: 'pixel' }
]
const SELECTIONS: AccessorySelection[] = [
  { head: 'cap' },
  { eyes: 'round', neck: 'bowtie' },
  {},
  { head: 'toque' },
  { neck: 'scarf' },
  { eyes: 'square' },
  { head: 'cap', neck: 'bowtie' },
  {},
  { back: 'cape' },
  { head: 'beret' },
  {}
]

interface Custom {
  shape: string
  color: string
  style: (typeof STYLES)[number]
  theme: Theme
  sel: AccessorySelection
}

/**
 * The cast of an animation: 3 Mochis, all different, one in dark; covers the 11 shapes from one animation to the
 * next.
 */
function distribution(a: number): Custom[] {
  return [0, 1, 2].map((i) => {
    const n = a * 3 + i
    const shape = SHAPE_LIST[n % SHAPE_LIST.length]!
    return {
      shape,
      color: hexOf(ACCESSORY_PALETTE[(n * 3 + a) % ACCESSORY_PALETTE.length]!),
      style: STYLES[(i + a) % 3]!,
      theme: (i + a) % 3 === 1 ? 'dark' : 'light',
      sel: SELECTIONS[(n + 2) % SELECTIONS.length]!
    }
  })
}

/* ------------------------------------------------------------- scenario */

type Evt =
  | { t: number; i: number; type: 'react'; id: string }
  | { t: number; i: number; type: 'release' }
  | { t: number; i: number; type: 'lookAt'; nx: number; ny: number }
  | { t: number; i: number; type: 'letGo' }
  | { t: number; i: number; type: 'mood'; id: string }

interface Anim {
  id: string
  group: 'mood' | 'interaction'
  name: string
  code: string
  duration: number
  /** time of the key frame (sheet) */
  key: number
  mood: MoodId
  /** phase offset per Mochi (moods: they do not move as one block) */
  phase: number[]
  evts?: Evt[]
  /** angle of each Mochi's 3D scene at time t */
  yaw?: (i: number, t: number) => number
  visible?: (i: number, t: number) => boolean
  /** laptop scale (0 to about 1) at time t */
  laptop?: (i: number, t: number) => number
  /** forced cast index (shapes, colors, themes); default: the animation's rank */
  cast?: number
  /** half width of the frame (big moves: jumps, hats); default 150 */
  frame?: number
  /** surimpression : curseur, doigts */
  inset?: (c: CanvasRenderingContext2D, t: number, centers: Array<{ x: number; y: number }>) => void
}

const MOOD_NAMES: Record<string, string> = {
  idle: 'Idle', thinking: 'Thinking', working: 'Working', waiting: 'Waiting', done: 'Done', blocked: 'Blocked', asleep: 'Asleep'
}
const MOOD_DURATIONS: Record<string, number> = { idle: 4, thinking: 4, working: 4, waiting: 4, done: 3, blocked: 3, asleep: 4.6 }
const MOOD_KEYS: Record<string, number> = { idle: 0.6, thinking: 1.2, working: 0.55, waiting: 0.9, done: 0.95, blocked: 0.8, asleep: 1.4 }

const ANIMS: Anim[] = []
for (const m of MOODS) {
  ANIMS.push({
    id: m.id, group: 'mood', name: MOOD_NAMES[m.id]!, code: `setMood('${m.id}')`,
    duration: MOOD_DURATIONS[m.id]!, key: MOOD_KEYS[m.id]!, mood: m.id, phase: [0, 0.37, 0.71], frame: m.id === 'done' ? 175 : undefined
  })
}

/* centers of the three cells, for the fingers and the cursor */
const COL = W / 3
const CY = 412
const centerOf = (i: number) => ({ x: COL * i + COL / 2, y: CY })

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const smooth = (u: number) => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k) }
/** Path by keys [t, x, y]: smoothed linear. */
function path(K: number[][], t: number): { x: number; y: number } | null {
  if (t < K[0]![0]! || t > K[K.length - 1]![0]!) return null
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i]![0]!) {
      const a = K[i - 1]!
      const b = K[i]!
      const k = smooth((t - a[0]!) / (b[0]! - a[0]!))
      return { x: lerp(a[1]!, b[1]!, k), y: lerp(a[2]!, b[2]!, k) }
    }
  }
  return null
}

function slider(c: CanvasRenderingContext2D, x: number, y: number, pressed = false) {
  c.save()
  c.translate(x, y)
  c.scale(pressed ? 0.92 : 1, pressed ? 0.92 : 1)
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(0, 30)
  c.lineTo(8, 23)
  c.lineTo(13, 35)
  c.lineTo(19, 32)
  c.lineTo(14, 21)
  c.lineTo(24, 21)
  c.closePath()
  c.fillStyle = '#fff'
  c.strokeStyle = '#1b1922'
  c.lineWidth = 2.5
  c.lineJoin = 'round'
  c.fill()
  c.stroke()
  c.restore()
}

const R = RADIUS
// the ball is RADIUS units on a frame of HALF_VIEWBOX: in pixels, with a 340 px cell
const PX = 340
let FRAME = 150
const radiusPx = (R / FRAME) * (PX / 2)

/* --- hover: a cursor crossing the three cells */
const SLIDER: number[][] = [
  [0.0, 90, 640], [0.7, 250, 470], [1.2, 400, 330], [1.6, 330, 300], [2.0, 480, 480],
  [2.6, 720, 330], [3.0, 780, 250], [3.5, 960, 470], [4.0, 1010, 600], [4.4, 1070, 700]
]
const evtsHover: Evt[] = []
for (let k = 0; k <= 4.4 * 24; k++) {
  const t = k / 24
  const p = path(SLIDER, t)
  for (let i = 0; i < 3; i++) {
    const c = centerOf(i)
    const on = p && Math.abs(p.x - c.x) < COL / 2 && Math.abs(p.y - c.y) < 300
    if (on && p) evtsHover.push({ t, i, type: 'lookAt', nx: Math.max(-1, Math.min(1, (p.x - c.x) / (PX * 0.6))), ny: Math.max(-1, Math.min(1, (p.y - c.y) / (PX * 0.6))) })
    else evtsHover.push({ t, i, type: 'letGo' })
  }
}
ANIMS.push({
  id: 'hover', group: 'interaction', name: 'Hover', code: 'pointer over: the gaze follows', duration: 4.4, key: 1.4, mood: 'idle',
  phase: [0, 0.4, 0.8], evts: evtsHover,
  inset: (c, t) => { const p = path(SLIDER, t); if (p) slider(c, p.x, p.y) }
})

/* --- tap: one finger per Mochi, in turn */
const TAPS = [0.7, 1.7, 2.7]
/**
 * The cursor arrives at the bottom right of the body, presses, leaves: a click, or a finger held for the long press.
 */
const fingersTaps = (decal: number[], longs?: number[][]) => (c: CanvasRenderingContext2D, t: number) => {
  for (let i = 0; i < 3; i++) {
    const ct = centerOf(i)
    const x = ct.x + 38
    const y = ct.y + 52
    if (longs) {
      const [a, b] = longs[i]!
      if (t >= a - 0.25 && t < a) slider(c, x + (a - t) * 160, y + (a - t) * 160)
      else if (t >= a && t <= b) slider(c, x, y, true)
      else if (t > b && t < b + 0.25) slider(c, x + (t - b) * 160, y + (t - b) * 160)
    } else {
      const a = decal[i]!
      if (t >= a - 0.2 && t < a) slider(c, x + (a - t) * 160, y + (a - t) * 160)
      else if (t >= a && t < a + 0.12) slider(c, x, y, true)
      else if (t >= a + 0.12 && t < a + 0.3) slider(c, x + (t - a - 0.12) * 160, y + (t - a - 0.12) * 160)
    }
  }
}
ANIMS.push({
  id: 'tap', group: 'interaction', name: 'Tap or click', code: 'tap: startle, squash, bounce', duration: 3.6, key: TAPS[1]! + 0.1, mood: 'idle', frame: 165,
  phase: [0, 0.4, 0.8],
  evts: TAPS.map((t, i) => ({ t, i, type: 'react', id: 'startle' }) as Evt),
  inset: fingersTaps(TAPS)
})

/* --- double tap */
const DOUBLES = [0.6, 1.75, 2.9]
ANIMS.push({
  id: 'double', group: 'interaction', name: 'Double tap', code: 'double tap: it laughs', duration: 4.7, key: DOUBLES[1]! + 0.7, mood: 'idle', frame: 165,
  phase: [0, 0.4, 0.8],
  evts: DOUBLES.flatMap((t, i): Evt[] => [
    { t, i, type: 'react', id: 'startle' },
    { t: t + 0.25, i, type: 'react', id: 'laugh' }
  ]),
  inset: (c, t) => {
    fingersTaps(DOUBLES)(c, t)
    fingersTaps(DOUBLES.map((d) => d + 0.25))(c, t)
  }
})

/* --- longue pression */
const PRESSES = [[0.3, 2.5], [0.55, 2.75], [0.8, 3.0]]
ANIMS.push({
  id: 'long', group: 'interaction', name: 'Longue pression', code: 'long press: it blushes, happy', duration: 4.4, key: 2.0, mood: 'idle',
  phase: [0, 0.4, 0.8],
  evts: PRESSES.flatMap(([a, b], i): Evt[] => [
    { t: a! + 0.45, i, type: 'react', id: 'blush' },
    { t: b!, i, type: 'release' }
  ]),
  inset: fingersTaps([], PRESSES)
})

/* --- shake: the 3D scene turns very fast, then it is dizzy */
const TURNS = [0.5, 0.68, 0.86]
ANIMS.push({
  id: 'shaken', group: 'interaction', name: 'Shaken or spun fast', code: 'fast drag: dizzy', duration: 4.2, key: 2.1, mood: 'idle',
  phase: [0, 0.4, 0.8],
  evts: TURNS.map((s, i) => ({ t: s + 0.62, i, type: 'react', id: 'dizzy' }) as Evt),
  yaw: (i, t) => {
    const u = (t - TURNS[i]!) / 1.0
    return Math.PI * 4 * (1 - (1 - Math.max(0, Math.min(1, u))) ** 3)
  }
})

/* --- wave: they appear one after the other */
const ARRIVALS = [0.25, 0.65, 1.05]
ANIMS.push({
  id: 'wave', group: 'interaction', name: 'Wave', code: 'on appearing: it grows, then waves', duration: 3.8, key: 1.45, mood: 'idle', frame: 175,
  phase: [0, 0.4, 0.8],
  evts: ARRIVALS.map((t, i) => ({ t, i, type: 'react', id: 'wave' }) as Evt),
  visible: (i, t) => t >= ARRIVALS[i]!
})

/* --- work: the laptop grows when the mood starts, it shrinks when it ends */
const ENTRY = [0.3, 0.5, 0.7]
const EXIT = 5.4
const progression = (t: number, i: number) => {
  const k = Math.min(1, Math.max(0, (t - ENTRY[i]!) / 0.45))
  if (t < EXIT + 0.2 * i) return k
  return Math.max(0, 1 - (t - EXIT - 0.2 * i) / 0.45)
}
ANIMS.push({
  id: 'working', group: 'mood', name: 'Working (laptop)', code: "setMood('working')", duration: 7, key: 1.0, mood: 'idle', frame: 150, cast: 2,
  phase: [0, 0.31, 0.62],
  evts: ENTRY.flatMap((t, i) => [{ t, i, type: 'mood', id: 'working' }, { t: EXIT + 0.2 * i, i, type: 'mood', id: 'idle' }] as Evt[]),
  yaw: (i, t) => [0.12, -0.08, 0][i]! + 0.05 * Math.sin(t * 0.8 + i),
  laptop: (i, t) => {
    const k = progression(t, i)
    if (k <= 0) return 0
    const rise = t < EXIT + 0.2 * i
    if (rise && k >= 1) return 1
    if (rise) return 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2
    return k * k * (3 - 2 * k)
  }
})

const REACTION_NAMES = REACTIONS.map((r) => r.id)
void REACTION_NAMES

/* ------------------------------------------------------------- rendering */

let renderAvatar: typeof import('../src/ui/3d/scene3d').renderAvatar
const engines = new Map<string, BotEngine>()
function engine(shape: string) {
  let e = engines.get(shape)
  if (!e) {
    e = new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === shape)!.radii, null)
    engines.set(shape, e)
  }
  return e
}

function moodsOf(a: Anim, i: number): Moods {
  const h = new Moods(a.mood)
  return h
}

/** The events of Mochi `i` up to time `t` (shifted by the phase), replayed in order. */
function apply(a: Anim, i: number, h: Moods, t: number) {
  for (const e of a.evts ?? []) {
    if (e.i !== i || e.t > t + 1e-9) continue
    const d = e.t + a.phase[i]!
    if (e.type === 'react') h.react(e.id, d)
    else if (e.type === 'release') h.release(d)
    else if (e.type === 'mood') h.setMood(e.id, d)
    else if (e.type === 'lookAt') h.lookAt({ nx: e.nx, ny: e.ny }, d)
    else h.lookAt(null, d)
  }
}

function drawCard(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: boolean) {
  c.beginPath()
  c.roundRect(x, y, w, h, 28)
  c.fillStyle = dark ? CARD_DARK : CARD
  c.fill()
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK, bold = false, align: CanvasTextAlign = 'left', mono = false) {
  c.font = `${bold ? '700' : '500'} ${size}px ${mono ? 'ui-monospace, Menlo, monospace' : '-apple-system, Helvetica, Arial, sans-serif'}`
  c.fillStyle = color
  c.textAlign = align
  c.textBaseline = 'alphabetic'
  c.fillText(s, x, y)
}

const tile = document.createElement('canvas')

/** A Mochi at time `t`, in cell `i` of the canvas `c`. */
function mochi(c: CanvasRenderingContext2D, a: Anim, i: number, p: Custom, t: number, x0: number, y0: number, size: number) {
  const h = moodsOf(a, i)
  apply(a, i, h, t)
  const ts = t + a.phase[i]!
  const kLaptop = a.laptop ? Math.min(1, a.laptop(i, t)) : 0
  h.gazeLaptop = kLaptop
  const gesture = h.sample(ts)
  const frame = engine(p.shape).sample(ts, gesture)
  const pixel = p.style.renderStyle === 'pixel'
  tile.width = tile.height = pixel ? Math.round((pixelGrid('fine') * FRAME) / HALF_VIEWBOX) : size
  const yaw = (a.yaw ? a.yaw(i, t) : 0) + 0.3 * kLaptop
  renderAvatar(tile, frame, p.color, PAPER, p.style.renderStyle, false, 'strong', true, p.shape, yaw, null, p.sel, FRAME, p.theme, undefined, a.laptop ? a.laptop(i, t) : 0)
  c.imageSmoothingEnabled = !pixel
  c.drawImage(tile, x0, y0, size, size)
  c.imageSmoothingEnabled = true
}

/** One frame of the animation, at time `t`. */
function image(a: Anim, t: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = BACKGROUND
  c.fillRect(0, 0, W, H)
  FRAME = a.frame ?? 150
  const casting = distribution(a.cast ?? ANIMS.indexOf(a))
  text(c, a.group === 'mood' ? 'MOOD' : 'INTERACTION', 44, 58, 22, GRAY, true)
  text(c, a.name, 44, 112, 54, INK, true)
  text(c, a.code, W - 44, 112, 26, GRAY, false, 'right', true)
  casting.forEach((p, i) => {
    const cx = COL * i
    drawCard(c, cx + 14, 150, COL - 28, 524, p.theme === 'dark')
    if (!a.visible || a.visible(i, t)) mochi(c, a, i, p, t, cx + (COL - PX) / 2, CY - PX / 2 - 12, PX)
    text(c, `${SHAPE_NAMES[p.shape]} · ${p.style.name} · ${p.theme === 'dark' ? 'dark' : 'light'}`, cx + COL / 2, 650, 21, p.theme === 'dark' ? '#cfcad8' : GRAY, false, 'center')
  })
  a.inset?.(c, t, [0, 1, 2].map(centerOf))
  return cv
}

/** Sheet: one key frame per animation, one Mochi each. */
function sheet(): HTMLCanvasElement {
  const columns = 4
  const cell = 400
  const rows = Math.ceil(ANIMS.length / columns)
  const cv = document.createElement('canvas')
  cv.width = columns * cell
  cv.height = 150 + rows * (cell + 30) + 10
  const c = cv.getContext('2d')!
  c.fillStyle = BACKGROUND
  c.fillRect(0, 0, cv.width, cv.height)
  text(c, 'Mochi: moods and interactions', 40, 76, 52, INK, true)
  text(c, '7 moods played on a loop, 6 interactions triggered by the user. One key frame each; the videos show the motion.', 40, 118, 24, GRAY)
  ANIMS.forEach((a, k) => {
    const x = (k % columns) * cell
    const y = 150 + Math.floor(k / columns) * (cell + 30)
    const casting = distribution(k)
    // the middle Mochi, except in Pixel (its 3-cell eyes show neither crescent nor tilt):
    // the key frame then shows the Soft or Flat of the same cast; the videos keep the three styles
    const i = [1, 0, 2].find((n) => casting[n]!.style.name !== 'Pixel') ?? 1
    const p = casting[i]!
    const ch = cell - 40
    drawCard(c, x + 14, y, cell - 28, ch, p.theme === 'dark')
    // the Mochi is rendered on 360 px, centered in its card (the clip keeps big hats inside the card)
    const px = 360
    c.save()
    c.beginPath()
    c.roundRect(x + 14, y, cell - 28, ch, 28)
    c.clip()
    mochi(c, a, i, p, a.key, x + (cell - px) / 2, y + (ch - px) / 2 + 6, px)
    c.restore()
    text(c, a.name, x + cell / 2, y + ch + 34, 28, INK, true, 'center')
  })
  return cv
}

/** Laptop sheet: the 11 shapes (3/4 then front, light) and 3 shapes in dark, writing. */
function planLaptop(): HTMLCanvasElement {
  FRAME = 200
  const cell = 300
  const cols = 4
  const header = 120
  const rowsLight = Math.ceil(SHAPE_LIST.length / 2)
  const dark: string[] = []
  const rowsDark = Math.ceil(dark.length / 2)
  const cv = document.createElement('canvas')
  cv.width = cols * cell
  cv.height = header + rowsLight * (cell + 8) + 20
  const c = cv.getContext('2d')!
  c.fillStyle = BACKGROUND
  c.fillRect(0, 0, cv.width, cv.height)
  text(c, 'A working Mochi: 3D laptop', 40, 62, 44, INK, true)
  text(c, "Seen from behind, in front of the body · 3/4 then front", 40, 100, 20, GRAY)
  const draw = (shape: string, k: number, x: number, y: number, theme: Theme) => {
    const color = hexOf(ACCESSORY_PALETTE[SHAPE_LIST.indexOf(shape) % ACCESSORY_PALETTE.length]!)
    if (theme === 'dark') {
      c.fillStyle = '#15141b'
      c.fillRect(x, y, cell * 2, cell + 8)
    }
    ;[0.55, 0].forEach((yaw, v) => {
      const h = new Moods('working')
      h.gazeLaptop = 1
      const t = 0.85 + (k % 5) * 0.11
      const frame = engine(shape).sample(t, h.sample(t))
      tile.width = tile.height = cell
      renderAvatar(tile, frame, color, PAPER, 'soft', false, 'strong', true, shape, yaw + 0.3, null, k % 3 === 1 ? { head: 'cap', eyes: 'round' } : {}, FRAME, theme, undefined, 1)
      c.drawImage(tile, x + v * cell, y, cell, cell)
    })
    text(c, SHAPE_NAMES[shape] ?? shape, x + 10, y + 26, 20, theme === 'dark' ? '#cfcbd6' : GRAY, true)
  }
  SHAPE_LIST.forEach((f, k) => draw(f, k, (k % 2) * 2 * cell, header + Math.floor(k / 2) * (cell + 8), 'light'))
  const y0 = header + rowsLight * (cell + 8)
  dark.forEach((f, k) => draw(f, k + 3, (k % 2) * 2 * cell, y0 + 70 + Math.floor(k / 2) * (cell + 8), 'dark'))
  return cv
}

async function send(name: string, c: HTMLCanvasElement, type = 'image/jpeg') {
  const dest = q.get('save')
  if (!dest) return
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), type, 0.95))
  await fetch(`${dest}?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
}

async function main() {
  ;({ renderAvatar } = await import('../src/ui/3d/scene3d'))
  if (q.get('sheet')) {
    const c = sheet()
    await send('moods.png', c, 'image/png')
    const dest = q.get('save')
    if (dest) await fetch(`${dest}?name=DONE-planche`, { method: 'POST', body: 'ok' })
    if (!q.get('save')) document.body.appendChild(c)
    document.title = 'finished'
    return
  }
  if (q.get('laptop')) {
    const c = planLaptop()
    await send('laptop.png', c, 'image/png')
    const dest = q.get('save')
    if (dest) await fetch(`${dest}?name=DONE-ordinateur`, { method: 'POST', body: 'ok' })
    if (!q.get('save')) document.body.appendChild(c)
    document.title = 'finished'
    return
  }
  const a = ANIMS.find((x) => x.id === q.get('anim'))
  if (!a) throw new Error('anim inconnue : ' + q.get('anim'))
  const fps = Number(q.get('fps') ?? 24)
  const n = Math.round(a.duration * fps)
  const alone = q.get('t')
  if (alone) {
    const c = image(a, Number(alone))
    await send(`${a.id}/t.png`, c, 'image/png')
    const dest = q.get('save')
    if (dest) await fetch(`${dest}?name=${encodeURIComponent(a.id + '/DONE')}`, { method: 'POST', body: 'ok' })
    if (!q.get('save')) document.body.appendChild(c)
    document.title = 'finished'
    return
  }
  for (let k = 0; k < n; k++) {
    const c = image(a, k / fps)
    await send(`${a.id}/f${String(k).padStart(4, '0')}.jpg`, c)
    if (!q.get('save') && k === 0) document.body.appendChild(c)
  }
  const dest = q.get('save')
  if (dest) await fetch(`${dest}?name=${encodeURIComponent(a.id + '/DONE')}`, { method: 'POST', body: 'ok' })
  document.title = 'finished'
}

main().catch((e) => {
  document.title = 'erreur ' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})

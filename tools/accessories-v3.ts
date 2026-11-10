import { BotEngine } from '../src/bot/engine'
import { RADIUS } from '../src/bot/frame'
import { COLORS, SHAPES } from '../src/bot/skins'
import {
  ACCESSORIES,
  SLOTS,
  SLOT_NAMES,
  accessoriesInSlot,
  resolveAccessories,
  type Slot,
  type AccessorySelection
} from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'

/** Renders the proposal sheets: a single WebGL context, cells copied into a 2D canvas. */
const q = new URLSearchParams(location.search)
const BACKGROUND = '#faf8f3'
const INK = '#26222f'
const GREY = '#8a8794'
const PAPER = '#f9f9f9'

const hexOf = (id: string) => COLORS.find((c) => c.id === id)!.hex
const distance = (a: string, b: string) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const x = p(a)
  const y = p(b)
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!)
}

/** Body colors that stand out against the accessory colors. */
function bodyFor(colors: string[], n: number, offset: number): string[] {
  const candidats = ['turquoise', 'amber', 'pink', 'blue', 'green', 'orange', 'violet'].map(hexOf)
  const good = candidats.filter((h) => colors.every((c) => distance(h, c) > 110))
  const list = good.length >= n ? good : candidats
  return Array.from({ length: n }, (_, i) => list[(i + offset) % list.length]!)
}

const SHAPE_NAMES: Record<string, string> = {
  circle: 'round',
  star: 'star',
  squircle: 'cube',
  cloud: 'cloud',
  triangle: 'pyramid',
  hexagon: 'hexagon',
  drop: 'drop',
  egg: 'egg',
  flower: 'flower',
  capsule: 'capsule',
  pebble: 'pebble'
}

let renderAvatar: typeof import('../src/ui/3d/scene3d').renderAvatar
const images = new Map<string, ReturnType<BotEngine['sample']>>()
function image(shape: string) {
  let f = images.get(shape)
  if (!f) {
    f = new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === shape)!.radii, null).sample(1.2)
    images.set(shape, f)
  }
  return f
}

interface Cell {
  shape: string
  color: string
  sel: AccessorySelection
  yaw?: number
  renderStyle?: Material
  frame?: number
}

/** Draws a Mochi (real-time 3D) in the sheet's canvas, a `px` square at (x, y). */
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, c: Cell) {
  const t = document.createElement('canvas')
  t.width = t.height = px
  renderAvatar(t, image(c.shape), c.color, PAPER, c.renderStyle ?? 'soft', false, 'strong', true, c.shape, c.yaw ?? 0, null, c.sel, c.frame ?? 175)
  ctx.drawImage(t, x, y)
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK, bold = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${bold ? '700' : '500'} ${size}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(s, x, y)
}

function fresh(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, w, h)
  return { c, ctx }
}

const W = 1080
const SHAPES_SHEET = ['circle', 'star', 'squircle']

/** Sheet of a slot: one accessory per row, three shapes. */
const FRAMES_HEAD: Record<string, number> = { toque: 200, antenna: 215, 'top-hat': 195, crown: 190 }

function sheetSlot(e: Slot, frame: number, yaw: number | number[] = 0, angles?: string[]) {
  const list = accessoriesInSlot(e)
  const cell = 360
  const header = 150
  const row = cell + 60
  const { c, ctx } = fresh(W, header + list.length * row + 30)
  text(ctx, SLOT_NAMES[e], 40, 78, 58, INK, true)
  text(ctx, `${list.length} proposals · real 3D, same lighting as the body`, 40, 122, 28, GREY)
  list.forEach((a, i) => {
    const y0 = header + i * row
    text(ctx, `${i + 1}. ${a.name}`, 40, y0 + 44, 38, INK, true)
    const body = bodyFor([a.c1, a.c2], 3, i)
    SHAPES_SHEET.forEach((f, k) => {
      const x = k * cell
      drawCell(ctx, x, y0 + 42, cell, { shape: f, color: body[k]!, sel: { [e]: a.id }, frame: (e === 'head' && FRAMES_HEAD[a.id]) || (a.id === 'antenna' ? 195 : frame), yaw: Array.isArray(yaw) ? yaw[k]! : yaw })
      text(ctx, SHAPE_NAMES[f]! + (angles ? ` · ${angles[k]}` : ''), x + cell / 2, y0 + row - 14, 22, GREY, false, 'center')
    })
  })
  return c
}

const combo = (shape: string, color: string, sel: AccessorySelection, yaw = 0.3): Cell & { sel: AccessorySelection } => ({ shape, color, sel, yaw, frame: 205 })

function namesOf(sel: AccessorySelection) {
  return SLOTS.map((e) => resolveAccessories(e, sel[e])?.name).filter(Boolean) as string[]
}

function sheetCombos() {
  const defs = [
    combo('circle', hexOf('turquoise'), { head: 'headphones', eyes: 'round', face: 'cheeks', neck: 'bowtie', back: 'cape' }),
    combo('star', hexOf('amber'), { head: 'flower', eyes: 'sunglasses', face: 'freckles', neck: 'tie', back: 'backpack' }),
    combo('squircle', hexOf('pink'), { head: 'headphones', eyes: 'heart', face: 'whiskers', neck: 'scarf', back: 'backpack' }),
    combo('cloud', hexOf('blue'), { head: 'top-hat', eyes: 'monocle', face: 'mustache', neck: 'bowtie', back: 'wings' }),
    combo('drop', hexOf('green'), { head: 'crown', eyes: 'square', face: 'freckles', neck: 'lei', back: 'tail' }, 0.5),
    combo('hexagon', hexOf('orange'), { head: 'headphones', eyes: 'sunglasses', face: 'mole', neck: 'bowtie', back: 'backpack' }),
    combo('triangle', hexOf('violet'), { head: 'straw', eyes: 'star', face: 'cheeks', neck: 'pearls', back: 'batwings' }),
    combo('egg', hexOf('cream'), { head: 'antenna', eyes: 'sleep', face: 'mustache', neck: 'tie', back: 'cape' })
  ]
  const cell = 540
  const lh = 215
  const rows = defs.length / 2
  const { c, ctx } = fresh(W, 150 + rows * (cell + lh - 60) + 20)
  text(ctx, 'Combos', 40, 78, 58, INK, true)
  text(ctx, 'All slots stack, without collision', 40, 122, 28, GREY)
  defs.forEach((d, i) => {
    const x = (i % 2) * cell
    const y = 150 + Math.floor(i / 2) * (cell + lh - 60)
    drawCell(ctx, x, y, cell, d)
    // names on as many lines as needed (cell width)
    ctx.font = '700 24px -apple-system, Helvetica, Arial, sans-serif'
    const rowsTxt: string[] = []
    let cur = ''
    for (const n of namesOf(d.sel)) {
      const trial = cur ? `${cur} + ${n}` : n
      if (cur && ctx.measureText(trial).width > cell - 40) {
        rowsTxt.push(cur + ' +')
        cur = n
      } else cur = trial
    }
    if (cur) rowsTxt.push(cur)
    rowsTxt.forEach((l, k) => text(ctx, l, x + cell / 2, y + cell + 34 + k * 30, 24, INK, true, 'center'))
  })
  return c
}

function sheetAngles() {
  const rows: Array<{ name: string; sel: AccessorySelection; shape: string; color: string; frame: number }> = [
    { name: 'Bow tie', sel: { neck: 'bowtie' }, shape: 'circle', color: hexOf('turquoise'), frame: 150 },
    { name: 'Cape', sel: { back: 'cape' }, shape: 'egg', color: hexOf('blue'), frame: 215 },
    { name: 'Tail', sel: { back: 'tail' }, shape: 'squircle', color: hexOf('green'), frame: 225 },
    { name: 'Tie (with glasses)', sel: { neck: 'tie', eyes: 'star' }, shape: 'star', color: hexOf('orange'), frame: 165 },
    { name: 'Backpack', sel: { back: 'backpack' }, shape: 'circle', color: hexOf('turquoise'), frame: 215 }
  ]
  const angles = [
    { yaw: 0, name: 'face' },
    { yaw: 0.62, name: '3/4' },
    { yaw: 1.5708, name: 'profile' },
    { yaw: 3.1416, name: 'back' }
  ]
  const cell = 270
  const row = cell + 70
  const { c, ctx } = fresh(W, 150 + rows.length * row + 20)
  text(ctx, 'Real 3D: front, 3/4, profile, back', 40, 78, 52, INK, true)
  text(ctx, 'The body turns, the light stays at the top left', 40, 122, 28, GREY)
  rows.forEach((t, i) => {
    const y0 = 150 + i * row
    text(ctx, t.name, 40, y0 + 30, 32, INK, true)
    angles.forEach((v, k) => {
      drawCell(ctx, k * cell, y0 + 34, cell, { shape: t.shape, color: t.color, sel: t.sel, yaw: v.yaw, frame: t.frame })
      text(ctx, v.name, k * cell + cell / 2, y0 + row - 14, 20, GREY, false, 'center')
    })
  })
  return c
}

/** Close-up of the bow tie: three shapes, from the front then at 3/4. */
function sheetBowtie() {
  const shapes = [
    { shape: 'circle', color: hexOf('turquoise') },
    { shape: 'star', color: hexOf('amber') },
    { shape: 'squircle', color: hexOf('pink') }
  ]
  const cell = 360
  const { c, ctx } = fresh(W, 150 + 2 * (cell + 50) + 20)
  text(ctx, 'Bow tie', 40, 78, 58, INK, true)
  text(ctx, 'Two rounded triangles, a small central knot, soft matte volume', 40, 122, 28, GREY)
  ;[
    { name: 'face', yaw: 0 },
    { name: '3/4', yaw: 0.62 }
  ].forEach((v, r) => {
    const y0 = 150 + r * (cell + 50)
    shapes.forEach((f, k) => {
      drawCell(ctx, k * cell, y0, cell, { shape: f.shape, color: f.color, sel: { neck: 'bowtie' }, yaw: v.yaw, frame: 120 })
      text(ctx, `${SHAPE_NAMES[f.shape]} · ${v.name}`, k * cell + cell / 2, y0 + cell + 30, 22, GREY, false, 'center')
    })
  })
  return c
}

function planchestyles() {
  const combos: Array<{ sel: AccessorySelection; shape: string; color: string }> = [
    { shape: 'circle', color: hexOf('turquoise'), sel: { head: 'cap', eyes: 'round', face: 'cheeks', neck: 'bowtie' } },
    { shape: 'star', color: hexOf('amber'), sel: { head: 'crown', eyes: 'sunglasses', neck: 'scarf' } },
    { shape: 'squircle', color: hexOf('pink'), sel: { head: 'beanie', eyes: 'heart', face: 'mustache', neck: 'pearls' } }
  ]
  const styles: Array<{ name: string; renderStyle: Material }> = [
    { name: 'Soft', renderStyle: 'soft' },
    { name: 'Flat', renderStyle: 'toon' },
    { name: 'Pixel', renderStyle: 'pixel' }
  ]
  const cell = 360
  const row = cell + 20
  const { c, ctx } = fresh(W, 190 + combos.length * row + 30)
  text(ctx, 'Soft, Flat, Pixel', 40, 78, 54, INK, true)
  text(ctx, 'The same accessories in the three styles', 40, 122, 28, GREY)
  styles.forEach((s, k) => text(ctx, s.name, k * cell + cell / 2, 176, 30, INK, true, 'center'))
  combos.forEach((cb, i) => {
    styles.forEach((s, k) => drawCell(ctx, k * cell, 190 + i * row, cell, { ...cb, renderStyle: s.renderStyle, frame: 190 }))
  })
  return c
}

async function send(name: string, c: HTMLCanvasElement) {
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
  const dest = q.get('save')
  if (!dest) return
  await fetch(`${dest}?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
}

async function main() {
  ;({ renderAvatar } = await import('../src/ui/3d/scene3d'))
  const who = (q.get('sheet') ?? 'all').split(',')
  const everything = who.includes('all')
  const todo: Array<[string, () => HTMLCanvasElement]> = [
    ['head', () => sheetSlot('head', 180, 0.35)],
    ['eyes', () => sheetSlot('eyes', 165, 0.25)],
    ['face', () => sheetSlot('face', 150, 0.25)],
    ['neck', () => sheetSlot('neck', 160, 0.25)],
    ['back', () => sheetSlot('back', 245, [0.55, 2.55, 3.4], ['front 3/4', '3/4 dos', 'from behind'])],
    ['combos', sheetCombos],
    ['angles', sheetAngles],
    ['bowtie', sheetBowtie],
    ['styles', planchestyles]
  ]
  for (const [name, f] of todo) {
    if (!everything && !who.includes(name)) continue
    const c = f()
    await send(`${name}.png`, c)
    if (!q.get('save')) document.body.appendChild(c)
  }
  document.title = 'finished'
}

main().catch((e) => {
  document.title = 'erreur' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})
void ACCESSORIES

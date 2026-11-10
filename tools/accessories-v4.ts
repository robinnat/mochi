import { BotEngine } from '../src/bot/engine'
import { RADIUS } from '../src/bot/frame'
import { COLORS, SHAPES } from '../src/bot/skins'
import {
  ACCESSORIES,
  ACCESSORY_PALETTE,
  SLOTS,
  SLOT_NAMES,
  resolveAccessories,
  type Slot,
  type AccessorySelection
} from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'

/**
 * Sheets of v4 (simplified accessories, one or two colors, customizable). Renders the sheets: a single WebGL context,
 * cells copied into a 2D canvas.
 */
const q = new URLSearchParams(location.search)
const BACKGROUND = '#faf8f3'
const INK = '#26222f'
const GRAY = '#8a8794'
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

const W = 1080
const BODY = hexOf('blue')

/** Half width of the frame per accessory: tall headwear needs more so it is never cut at the top. */
const FRAMES: Record<string, number> = {
  toque: 235,
  antenna: 250,
  'top-hat': 240,
  crown: 215,
  beanie: 220,
  beret: 205,
  cap: 205,
  straw: 250,
  headphones: 215,
  ribbon: 205,
  flower: 205,
  wings: 280,
  batwings: 280,
  tail: 235,
  cape: 235,
  backpack: 215
}
const frameOf = (e: Slot, id: string) => Math.round((FRAMES[id] ?? (e === 'head' ? 215 : 185)) * (e === 'back' ? 0.95 : 0.86))
const YAW: Record<Slot, number> = { head: 0.3, eyes: 0.25, face: 0.25, neck: 0.25, back: 0.75 }

function fresh(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, w, h)
  return { c, ctx }
}

/** Catalog sheet: every accessory, one per cell, same shape (round) and same body color. */
function planCatalog() {
  const cols = 4
  const cell = W / cols
  const row = cell + 56
  const rows = Math.ceil(ACCESSORIES.length / cols)
  const { c, ctx } = fresh(W, 150 + rows * row + 20)
  text(ctx, 'Catalog v4', 40, 78, 58, INK, true)
  text(ctx, `${ACCESSORIES.length} accessories · one color, two at most · same shape, same body`, 40, 122, 26, GRAY)
  ACCESSORIES.forEach((a, i) => {
    const x = (i % cols) * cell
    const y = 150 + Math.floor(i / cols) * row
    drawCell(ctx, x, y, cell, { shape: 'circle', color: BODY, sel: { [a.slot]: a.id }, frame: frameOf(a.slot, a.id), yaw: YAW[a.slot] })
    text(ctx, a.name, x + cell / 2, y + cell + 24, 22, INK, true, 'center')
    text(ctx, SLOT_NAMES[a.slot], x + cell / 2, y + cell + 46, 17, GRAY, false, 'center')
  })
  return c
}

/** Customization: five accessories, each in four colors (c1, and c2 for the flower). */
function planColors() {
  const P = ACCESSORY_PALETTE
  const rows: Array<{ name: string; e: Slot; id: string; choice: Array<{ c1: string; c2?: string }> }> = [
    { name: 'Bow tie (one color)', e: 'neck', id: 'bowtie', choice: [{ c1: P.black }, { c1: P.red }, { c1: P.blue }, { c1: P.pink }] },
    { name: 'Headphones (one color)', e: 'head', id: 'headphones', choice: [{ c1: P.red }, { c1: P.black }, { c1: P.turquoise }, { c1: P.violet }] },
    { name: 'Flower (petals + center)', e: 'head', id: 'flower', choice: [{ c1: P.pink, c2: P.yellow }, { c1: P.cream, c2: P.orange }, { c1: P.violet, c2: P.yellow }, { c1: P.red, c2: P.cream }] },
    { name: 'Tie (one color)', e: 'neck', id: 'tie', choice: [{ c1: P.navy }, { c1: P.red }, { c1: P.green }, { c1: P.yellow }] },
    { name: 'Cape (one color)', e: 'back', id: 'cape', choice: [{ c1: P.red }, { c1: P.violet }, { c1: P.green }, { c1: P.black }] }
  ]
  const cell = W / 4
  const row = cell + 70
  const { c, ctx } = fresh(W, 150 + rows.length * row + 20)
  text(ctx, 'Customization', 40, 78, 58, INK, true)
  text(ctx, 'Same accessory, four colors: c1 and, if needed, c2 set through the API', 40, 122, 26, GRAY)
  rows.forEach((l, i) => {
    const y0 = 150 + i * row
    text(ctx, l.name, 40, y0 + 30, 30, INK, true)
    l.choice.forEach((ch, k) => {
      drawCell(ctx, k * cell, y0 + 34, cell, { shape: 'circle', color: l.id === 'cape' || l.id === 'tie' ? hexOf('amber') : hexOf('turquoise'), sel: { [l.e]: { id: l.id, ...ch } }, frame: frameOf(l.e, l.id), yaw: YAW[l.e] })
      text(ctx, ch.c2 ? `${ch.c1} + ${ch.c2}` : ch.c1, k * cell + cell / 2, y0 + row - 8, 18, GRAY, false, 'center')
    })
  })
  return c
}

/** Angles: front, 3/4, profile, back for the bow tie, the tail, the cape and the tie. */
function planAngles() {
  const rows: Array<{ name: string; sel: AccessorySelection; shape: string; color: string; frame: number }> = [
    { name: 'Bow tie', sel: { neck: 'bowtie' }, shape: 'circle', color: hexOf('amber'), frame: 170 },
    { name: 'Tail', sel: { back: 'tail' }, shape: 'squircle', color: hexOf('turquoise'), frame: 235 },
    { name: 'Cape', sel: { back: 'cape' }, shape: 'egg', color: hexOf('blue'), frame: 235 },
    { name: 'Tie', sel: { neck: 'tie' }, shape: 'squircle', color: hexOf('orange'), frame: 185 }
  ]
  const angles = [
    { yaw: 0, name: 'face' },
    { yaw: 0.62, name: '3/4' },
    { yaw: 1.5708, name: 'profile' },
    { yaw: 3.1416, name: 'back' }
  ]
  const cell = W / 4
  const row = cell + 70
  const { c, ctx } = fresh(W, 150 + rows.length * row + 20)
  text(ctx, 'Angles : face, 3/4, profil, dos', 40, 78, 52, INK, true)
  text(ctx, 'The body turns, the light stays at the top left', 40, 122, 26, GRAY)
  rows.forEach((t, i) => {
    const y0 = 150 + i * row
    text(ctx, t.name, 40, y0 + 30, 32, INK, true)
    angles.forEach((v, k) => {
      drawCell(ctx, k * cell, y0 + 34, cell, { shape: t.shape, color: t.color, sel: t.sel, yaw: v.yaw, frame: t.frame })
      text(ctx, v.name, k * cell + cell / 2, y0 + row - 8, 20, GRAY, false, 'center')
    })
  })
  return c
}

/** Alfred: the yellow pyramid Mochi, black round glasses and black bow tie, next to the reference. */
async function planAlfred() {
  const ref = new Image()
  ref.crossOrigin = 'anonymous'
  await new Promise<void>((ok, ko) => {
    ref.onload = () => ok()
    ref.onerror = () => ko(new Error('reference introuvable'))
    ref.src = `${new URL(q.get('save')!).origin}/ref/alfred.png`
  })
  const cell = 520
  const { c, ctx } = fresh(W, 150 + cell + 120)
  text(ctx, 'Comparison with Alfred', 40, 78, 54, INK, true)
  text(ctx, 'Same black round glasses, same black bow tie at the very bottom', 40, 122, 26, GRAY)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 150, cell, cell)
  ctx.drawImage(ref, 0, 150 + (cell - ref.height * (cell / ref.width)) / 2, cell, ref.height * (cell / ref.width))
  text(ctx, 'Reference (Alfred)', cell / 2, 150 + cell + 40, 28, INK, true, 'center')
  drawCell(ctx, cell + 40, 150, cell, { shape: 'triangle', color: hexOf('amber'), sel: { eyes: 'round', neck: 'bowtie' }, frame: 150, yaw: 0 })
  text(ctx, 'Mochi pyramide', cell + 40 + cell / 2, 150 + cell + 40, 28, INK, true, 'center')
  return c
}

/** Six combinaisons. */
function planCombos() {
  const defs: Cell[] = [
    combo('circle', hexOf('turquoise'), { head: 'cap', eyes: 'round', face: 'cheeks', neck: 'bowtie' }),
    combo('triangle', hexOf('amber'), { eyes: 'round', neck: 'bowtie' }, 0),
    combo('squircle', hexOf('pink'), { head: 'flower', eyes: 'sunglasses', back: 'cape' }),
    combo('egg', hexOf('violet'), { head: 'toque', face: 'mustache', neck: 'tie', back: 'tail' }),
    combo('star', hexOf('orange'), { head: 'crown', eyes: 'square', neck: 'scarf' }, 0.35),
    combo('cloud', hexOf('blue'), { head: 'top-hat', eyes: 'monocle', face: 'mustache', neck: 'lei' })
  ]
  const cell = 540
  const lh = 100
  const { c, ctx } = fresh(W, 150 + (defs.length / 2) * (cell + lh) + 20)
  text(ctx, 'Combos', 40, 78, 58, INK, true)
  text(ctx, 'Slots stack, each accessory stays simple', 40, 122, 26, GRAY)
  defs.forEach((d, i) => {
    const x = (i % 2) * cell
    const y = 150 + Math.floor(i / 2) * (cell + lh)
    drawCell(ctx, x, y, cell, d)
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

const combo = (shape: string, color: string, sel: AccessorySelection, yaw = 0.3): Cell => ({ shape, color, sel, yaw, frame: 215 })

function namesOf(sel: AccessorySelection) {
  return SLOTS.map((e) => resolveAccessories(e, sel[e])?.name).filter(Boolean) as string[]
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
  const todo: Array<[string, () => HTMLCanvasElement | Promise<HTMLCanvasElement>]> = [
    ['catalog', planCatalog],
    ['colors', planColors],
    ['angles', planAngles],
    ['alfred', planAlfred],
    ['combos', planCombos]
  ]
  for (const [name, f] of todo) {
    if (!everything && !who.includes(name)) continue
    const c = await f()
    await send(`${name}.png`, c)
    if (!q.get('save')) document.body.appendChild(c)
  }
  document.title = 'finished'
}

main().catch((e) => {
  document.title = 'erreur' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})

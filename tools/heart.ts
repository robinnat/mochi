import { BotEngine } from '../src/bot/engine'
import { COLORS, SHAPES } from '../src/bot/skins'
import { HALF_VIEWBOX, RADIUS } from '../src/bot/frame'
import { pixelGrid } from '../src/ui/renderStyle'
import { Moods, type MoodId } from '../src/bot/moods'
import type { AccessorySelection } from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'

/**
 * Heart sheet: 3 styles, front and three quarters, without and with a hat, plus glasses and a few moods.
 */
const q = new URLSearchParams(location.search)
const BACKGROUND = '#faf8f3'
const INK = '#26222f'
const GRAY = '#8a8794'
const PAPER = '#f9f9f9'
const hexOf = (id: string) => COLORS.find((c) => c.id === id)!.hex
const SHAPE = SHAPES.find((s) => s.id === 'heart')!

let renderAvatar: typeof import('../src/ui/3d/scene3d').renderAvatar
const STYLES: Array<{ name: string; renderStyle: Material }> = [
  { name: '3D Soft', renderStyle: 'soft' },
  { name: 'Pixel', renderStyle: 'pixel' },
  { name: 'Flat', renderStyle: 'toon' }
]

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, o: { renderStyle: Material; color: string; sel?: AccessorySelection; yaw?: number; mood?: MoodId; t?: number }) {
  const pixel = o.renderStyle === 'pixel'
  const frame = 175
  const t = document.createElement('canvas')
  t.width = t.height = pixel ? Math.round((pixelGrid('fine') * frame) / HALF_VIEWBOX) : px * 2
  const ts = o.t ?? 1.2
  const gesture = o.mood ? new Moods(o.mood).sample(ts) : undefined
  const frame = new BotEngine(RADIUS, 'idle', SHAPE.radii, null).sample(ts, gesture)
  renderAvatar(t, frame, o.color, PAPER, o.renderStyle, false, 'strong', true, 'heart', o.yaw ?? 0, null, o.sel ?? {}, frame)
  ctx.imageSmoothingEnabled = !pixel
  ctx.drawImage(t, x, y, px, px)
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK, bold = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${bold ? '700' : '500'} ${size}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(s, x, y)
}

function sheet() {
  const cell = 230
  const angles = [
    { name: 'face', yaw: 0, sel: {} as AccessorySelection },
    { name: '3/4', yaw: 0.6, sel: {} as AccessorySelection },
    { name: 'front, cap', yaw: 0, sel: { head: 'cap' } as AccessorySelection },
    { name: '3/4, top hat', yaw: 0.6, sel: { head: 'top-hat' } as AccessorySelection },
    { name: 'glasses, bow', yaw: 0, sel: { eyes: 'round', neck: 'bowtie' } as AccessorySelection },
    { name: 'couronne, soleil', yaw: 0.4, sel: { head: 'crown', eyes: 'sunglasses' } as AccessorySelection }
  ]
  const moods: Array<{ name: string; mood: MoodId; t: number }> = [
    { name: 'idle', mood: 'idle', t: 0.6 },
    { name: 'thinking', mood: 'thinking', t: 1.2 },
    { name: 'done', mood: 'done', t: 0.95 },
    { name: 'blocked', mood: 'blocked', t: 0.8 },
    { name: 'asleep', mood: 'asleep', t: 1.4 },
    { name: 'working', mood: 'working', t: 0.55 }
  ]
  const cols = angles.length
  const rows = STYLES.length * 2
  const c = document.createElement('canvas')
  c.width = cols * cell
  c.height = 90 + rows * (cell + 36) + 30
  const ctx = c.getContext('2d')!
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, c.width, c.height)
  text(ctx, 'Heart shape: 3 styles, front and 3/4, accessories, moods', 30, 56, 34, INK, true)
  const colors = [hexOf('pink'), hexOf('violet'), hexOf('red')]
  STYLES.forEach((s, si) => {
    const y1 = 90 + si * 2 * (cell + 36)
    text(ctx, s.name, 30, y1 + 22, 24, INK, true)
    angles.forEach((v, i) => {
      drawCell(ctx, i * cell, y1 + 30, cell, { renderStyle: s.renderStyle, color: colors[si]!, sel: v.sel, yaw: v.yaw })
      text(ctx, v.name, i * cell + cell / 2, y1 + 30 + cell + 4, 16, GRAY, false, 'center')
    })
    const y2 = y1 + cell + 36
    moods.forEach((m, i) => {
      drawCell(ctx, i * cell, y2 + 30, cell, { renderStyle: s.renderStyle, color: colors[si]!, mood: m.mood, t: m.t, yaw: 0.15 })
      text(ctx, m.name, i * cell + cell / 2, y2 + 30 + cell + 4, 16, GRAY, false, 'center')
    })
  })
  return c
}

async function main() {
  ;({ renderAvatar } = await import('../src/ui/3d/scene3d'))
  const c = sheet()
  const dest = q.get('save')
  if (dest) {
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
    await fetch(`${dest}?name=heart.png`, { method: 'POST', body: blob })
  } else document.body.appendChild(c)
  document.title = 'finished'
}
main().catch((e) => {
  document.title = 'erreur' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})

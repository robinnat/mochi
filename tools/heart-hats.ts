import { BotEngine } from '../src/bot/engine'
import { HALF_VIEWBOX, RADIUS } from '../src/bot/frame'
import { pixelGrid } from '../src/ui/renderStyle'
import { COLORS, SHAPES } from '../src/bot/skins'
import { accessoriesInSlot } from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'

/**
 * Sheet: every hat on the heart, three styles, from the front and at three quarters. `?f=<shape>` for another shape.
 */
const q = new URLSearchParams(location.search)
const SHAPE = SHAPES.find((s) => s.id === (q.get('f') ?? 'heart'))!
const BACKGROUND = '#faf8f3'
const INK = '#26222f'
const GREY = '#8a8794'
const hexOf = (id: string) => COLORS.find((c) => c.id === id)!.hex
let renderAvatar: typeof import('../src/ui/3d/scene3d').renderAvatar

const STYLES: Array<{ name: string; renderStyle: Material; color: string }> = [
  { name: '3D Soft', renderStyle: 'soft', color: hexOf('pink') },
  { name: 'Pixel', renderStyle: 'pixel', color: hexOf('violet') },
  { name: 'Flat', renderStyle: 'toon', color: hexOf('red') }
]

function sheet() {
  const kept = q.get('h')?.split(',')
  const hats = accessoriesInSlot('head').filter((h) => !kept || kept.includes(h.id))
  const cell = Number(q.get('s')) || 170
  const frame = 175
  const frame = new BotEngine(RADIUS, 'idle', SHAPE.radii, null).sample(1.2)
  const cols = STYLES.length * 2
  const c = document.createElement('canvas')
  c.width = cols * cell
  c.height = 110 + hats.length * (cell - 10)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.font = '700 28px -apple-system, Helvetica, Arial, sans-serif'
  ctx.fillStyle = INK
  ctx.fillText(`Hats on the shape ${SHAPE.id}: front and 3/4, three styles`, 20, 40)
  ctx.font = '600 16px -apple-system, Helvetica, Arial, sans-serif'
  STYLES.forEach((s, si) => {
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.fillText(s.name + 'face', (si * 2 + 0.5) * cell, 76)
    ctx.fillText(s.name + ' 3/4', (si * 2 + 1.5) * cell, 76)
  })
  hats.forEach((h, r) => {
    const y = 90 + r * (cell - 10)
    STYLES.forEach((s, si) => {
      for (const [k, yaw] of [[0, 0], [1, 0.6]] as const) {
        const pixel = s.renderStyle === 'pixel'
        const t = document.createElement('canvas')
        t.width = t.height = pixel ? Math.round((pixelGrid('fine') * frame) / HALF_VIEWBOX) : cell * 2
        renderAvatar(t, frame, s.color, '#f9f9f9', s.renderStyle, false, 'strong', true, SHAPE.id, yaw, null, { head: h.id }, frame)
        ctx.imageSmoothingEnabled = !pixel
        ctx.drawImage(t, (si * 2 + k) * cell, y, cell, cell)
      }
    })
    ctx.fillStyle = GREY
    ctx.font = '500 14px -apple-system, Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(h.id, 6, y + 16)
  })
  return c
}

async function main() {
  ;({ renderAvatar } = await import('../src/ui/3d/scene3d'))
  document.body.appendChild(sheet())
  document.title = 'finished'
}
main().catch((e) => {
  document.title = 'erreur' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})

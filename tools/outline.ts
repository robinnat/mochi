import { BotEngine } from '../src/bot/engine'
import { RADIUS } from '../src/bot/frame'
import { COLORS, SHAPES } from '../src/bot/skins'
import type { AccessorySelection } from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'

/** Planche du contour : trois styles, trois epaisseurs (fin, moyen, epais), avec accessoires. Un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
const q = new URLSearchParams(location.search)
const BACKGROUND = '#faf8f3'
const INK = '#26222f'
const GREY = '#8a8794'
const PAPER = '#f9f9f9'
const hexOf = (id: string) => COLORS.find((c) => c.id === id)!.hex

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

/** Un Mochi dans le canvas `ctx`. Pixel : grille de 32 pixels de diametre (le defaut), agrandie sans lissage. */
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, o: { shape: string; color: string; renderStyle: Material; sel: AccessorySelection; outline: boolean; th: number; frame: number; yaw?: number }) {
  const pixel = o.renderStyle === 'pixel'
  const t = document.createElement('canvas')
  t.width = t.height = pixel ? Math.round((32 * o.frame) / 100) : px * 2
  renderAvatar(t, image(o.shape), o.color, PAPER, o.renderStyle, o.outline, 'strong', true, o.shape, o.yaw ?? 0.3, null, o.sel, o.frame, 'light', undefined, 0, true, true, o.th)
  ctx.imageSmoothingEnabled = !pixel
  ctx.drawImage(t, x, y, px, px)
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK, bold = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${bold ? '700' : '500'} ${size}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
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

function sheet() {
  const styles: Array<{ name: string; renderStyle: Material }> = [{ name: '3D Soft', renderStyle: 'soft' }, { name: 'Pixel', renderStyle: 'pixel' }, { name: 'Flat', renderStyle: 'toon' }]
  const thicknesses = [{ name: 'fin (0,6x)', th: 0.6 }, { name: 'moyen (1x)', th: 1 }, { name: 'epais (2,2x)', th: 2.2 }]
  const rows = [
    { shape: 'circle', color: hexOf('turquoise'), sel: { head: 'top-hat', eyes: 'round' } as AccessorySelection },
    { shape: 'star', color: hexOf('amber'), sel: { head: 'cap', neck: 'bowtie' } as AccessorySelection }
  ]
  const cell = 300
  const cols = styles.length * thicknesses.length
  const { c, ctx } = fresh(cols * cell, 150 + rows.length * (cell + 20) + 20)
  text(ctx, 'Contour : fin, moyen, épais, dans les trois styles', 40, 70, 46, INK, true)
  text(ctx, 'Le contour suit le corps ET les accessoires (haut-de-forme, lunettes, casquette, nœud)', 40, 108, 24, GREY)
  styles.forEach((s, i) => {
    text(ctx, s.name, (i * thicknesses.length + 1.5) * cell, 142, 28, INK, true, 'center')
    thicknesses.forEach((e, k) => {
      const x = (i * thicknesses.length + k) * cell
      rows.forEach((l, r) => {
        drawCell(ctx, x, 150 + r * (cell + 20), cell, { ...l, renderStyle: s.renderStyle, outline: true, th: e.th, frame: 225 })
      })
      text(ctx, e.name, x + cell / 2, 150 + rows.length * (cell + 20) + 4, 18, GREY, false, 'center')
    })
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
  const c = sheet()
  await send('planche-contour.png', c)
  if (!q.get('save')) document.body.appendChild(c)
  document.title = 'finished'
}

main().catch((e) => {
  document.title = 'erreur' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})

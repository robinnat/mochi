import { BotEngine } from '../src/bot/engine'
import { RADIUS } from '../src/bot/frame'
import { COLORS, SHAPES } from '../src/bot/skins'
import {
  ACCESSORIES,
  ACCESSORY_PALETTE,
  SLOT_NAMES,
  type Slot,
  type AccessorySelection
} from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'

/** Planches de la v5 (accessoires simplifies, une ou deux couleurs, personnalisables). Rend les planches : un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
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

/** Couleurs de corps qui ressortent contre les couleurs de l'accessoire. */
function bodyFor(colors: string[], n: number, offset: number): string[] {
  const candidats = ['turquoise', 'amber', 'pink', 'blue', 'green', 'orange', 'violet'].map(hexOf)
  const good = candidats.filter((h) => colors.every((c) => distance(h, c) > 110))
  const list = good.length >= n ? good : candidats
  return Array.from({ length: n }, (_, i) => list[(i + offset) % list.length]!)
}

const SHAPE_NAMES: Record<string, string> = {
  circle: 'round',
  star: 'étoile',
  squircle: 'cube',
  cloud: 'cloud',
  triangle: 'pyramid',
  hexagon: 'hexagon',
  drop: 'drop',
  egg: 'œuf',
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
  theme?: 'light' | 'dark'
  shading?: boolean
}

/** Dessine un Mochi (3D temps reel) dans le canvas de la planche, carre de `px` en (x, y). */
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, c: Cell) {
  const t = document.createElement('canvas')
  t.width = t.height = px
  renderAvatar(t, image(c.shape), c.color, PAPER, c.renderStyle ?? 'soft', false, 'strong', true, c.shape, c.yaw ?? 0, null, c.sel, c.frame ?? 175, c.theme ?? 'light', undefined, 0, true, c.shading ?? true)
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

/** Demi-largeur du cadre par accessoire : les coiffes hautes en demandent plus pour ne jamais etre coupees en haut. */
const FRAMES: Record<string, number> = {
  toque: 235,
  antenna: 250,
  'top-hat': 240,
  crown: 215,
  beret: 205,
  cap: 205,
  straw: 250,
  headphones: 215,
  ribbon: 205,
  flower: 205,
  wings: 280,
  batwings: 280,
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

/** Planche du catalogue : tous les accessoires, un par case, meme forme (rond) et meme couleur de corps. */
function planCatalogue() {
  const cols = 4
  const cell = W / cols
  const row = cell + 56
  const rows = Math.ceil(ACCESSORIES.length / cols)
  const { c, ctx } = fresh(W, 150 + rows * row + 20)
  text(ctx, 'Catalogue v5', 40, 78, 58, INK, true)
  text(ctx, `${ACCESSORIES.length} accessories · une color, two au maximum · même shape, même body`, 40, 122, 26, GREY)
  ACCESSORIES.forEach((a, i) => {
    const x = (i % cols) * cell
    const y = 150 + Math.floor(i / cols) * row
    drawCell(ctx, x, y, cell, { shape: 'circle', color: BODY, sel: { [a.slot]: a.id }, frame: frameOf(a.slot, a.id), yaw: YAW[a.slot] })
    text(ctx, a.name, x + cell / 2, y + cell + 24, 22, INK, true, 'center')
    text(ctx, SLOT_NAMES[a.slot], x + cell / 2, y + cell + 46, 17, GREY, false, 'center')
  })
  return c
}

/** Casquette : les 11 formes, de face, de 3/4 et de profil, en clair puis en sombre. */
function planCap() {
  const shapes = SHAPES.map((s) => s.id)
  const angles = [{ yaw: 0, name: 'face' }, { yaw: 0.62, name: '3/4' }, { yaw: 1.5708, name: 'profile' }]
  const themes: Array<'light' | 'dark'> = ['light', 'dark']
  const cell = 240
  const W2 = cell * 6
  const row = cell + 8
  const { c, ctx } = fresh(W2, 150 + shapes.length * row + 20)
  text(ctx, 'Casquette v6', 40, 78, 58, INK, true)
  text(ctx, 'Calotte ronde et rigide, indépendante du corps · 11 formes · face, 3/4, profil · clair à gauche, sombre à droite', 40, 122, 26, GREY)
  const colors = ['turquoise', 'amber', 'pink', 'green', 'violet', 'orange', 'blue', 'turquoise', 'amber', 'pink', 'green']
  shapes.forEach((f, i) => {
    const y0 = 150 + i * row
    themes.forEach((th, ti) =>
      angles.forEach((v, k) => {
        const x = (ti * 3 + k) * cell
        if (th === 'dark') {
          ctx.fillStyle = '#121212'
          ctx.fillRect(x, y0, cell, row)
        }
        drawCell(ctx, x, y0, cell, { shape: f, color: hexOf(colors[i]!), theme: th, sel: { head: { id: 'cap', c1: ACCESSORY_PALETTE.blue, c2: i % 3 === 1 ? ACCESSORY_PALETTE.black : ACCESSORY_PALETTE.blue } }, yaw: v.yaw, frame: 215 })
      })
    )
    text(ctx, SHAPE_NAMES[f] ?? f, 14, y0 + 26, 22, GREY, true)
  })
  return c
}

/** Casquette cumulee avec les autres accessoires (yeux, visage, bas, dos). */
function planCapCombos() {
  const defs: Array<{ shape: string; color: string; sel: AccessorySelection }> = [
    { shape: 'circle', color: hexOf('turquoise'), sel: { eyes: 'round', face: 'cheeks', neck: 'bowtie', back: 'cape' } },
    { shape: 'squircle', color: hexOf('amber'), sel: { eyes: 'sunglasses', face: 'whiskers', neck: 'tie', back: 'backpack' } },
    { shape: 'star', color: hexOf('pink'), sel: { eyes: 'square', face: 'freckles', neck: 'scarf', back: 'wings' } },
    { shape: 'triangle', color: hexOf('amber'), sel: { eyes: 'round', neck: 'bowtie' } },
    { shape: 'cloud', color: hexOf('green'), sel: { eyes: 'monocle', face: 'cheeks', neck: 'tie' } },
    { shape: 'drop', color: hexOf('orange'), sel: { eyes: 'heart', back: 'cape' } }
  ]
  const cell = 360
  const { c, ctx } = fresh(W, 150 + Math.ceil(defs.length / 3) * (cell + 50) * 2)
  text(ctx, 'Casquette cumulée', 40, 78, 54, INK, true)
  text(ctx, 'Avec lunettes, visage, bas et dos · clair puis sombre', 40, 122, 26, GREY)
  defs.forEach((d, i) => {
    const x = (i % 3) * cell
    const y = 150 + Math.floor(i / 3) * (cell + 50) * 2
    ;(['light', 'dark'] as const).forEach((th, ti) => {
      const yy = y + ti * (cell + 50)
      if (th === 'dark') {
        ctx.fillStyle = '#121212'
        ctx.fillRect(x, yy, cell, cell + 50)
      }
      drawCell(ctx, x, yy, cell, { shape: d.shape, color: d.color, theme: th, sel: { ...d.sel, head: { id: 'cap', c1: ACCESSORY_PALETTE.red, c2: ACCESSORY_PALETTE.red } }, yaw: 0.3, frame: 215 })
      text(ctx, `${SHAPE_NAMES[d.shape]} · ${Object.values(d.sel).join(', ')}`, x + cell / 2, yy + cell + 28, 17, th === 'dark' ? '#cfcbd6' : GREY, false, 'center')
    })
  })
  return c
}

/** Lunettes : chaque modele sur les 11 formes, en 3/4 et de profil (les branches doivent rentrer dans le corps). */
function planGlasses() {
  const models = ['round', 'square', 'sunglasses', 'heart', 'star', 'monocle']
  const shapes = SHAPES.map((s) => s.id)
  const angles = [0.62, 1.5708]
  const cell = 150
  const { c, ctx } = fresh(cell * models.length * 2, 150 + shapes.length * cell + 20)
  text(ctx, 'Lunettes v7 : branches ancrées dans le corps', 40, 78, 52, INK, true)
  text(ctx, '6 modèles × 11 formes · 3/4 puis profil pour chaque modèle', 40, 122, 24, GREY)
  const colors = ['turquoise', 'amber', 'pink', 'green', 'violet', 'orange', 'blue', 'turquoise', 'amber', 'pink', 'green']
  shapes.forEach((f, i) => {
    models.forEach((m, mi) =>
      angles.forEach((yaw, vi) => {
        const x = (mi * 2 + vi) * cell
        const y = 150 + i * cell
        drawCell(ctx, x, y, cell, { shape: f, color: hexOf(colors[i]!), sel: { eyes: { id: m, c1: ACCESSORY_PALETTE.black, c2: ACCESSORY_PALETTE.black } }, yaw, frame: 150 })
      })
    )
    text(ctx, SHAPE_NAMES[f] ?? f, 6, 150 + i * cell + 16, 14, GREY, true)
  })
  models.forEach((m, mi) => text(ctx, m, mi * 2 * cell + cell, 144, 18, INK, true, 'center'))
  return c
}

/** Cape puis cravate, seules, sur 6 formes : grandes vignettes (cape : face, 3/4, profil, dos ; cravate : face, 3/4, profil). */
function planCapeTie() {
  const shapes = ['circle', 'squircle', 'star', 'triangle', 'drop', 'cloud']
  const colors = ['turquoise', 'amber', 'pink', 'violet', 'orange', 'blue']
  const angles = [{ yaw: 0, name: 'face' }, { yaw: 0.62, name: '3/4' }, { yaw: 1.5708, name: 'profile' }, { yaw: 3.1416, name: 'back' }]
  const cell = 300
  const W2 = cell * 4
  const block = 70 + shapes.length * (cell + 8)
  const { c, ctx } = fresh(W2, 130 + block * 2 + 20)
  text(ctx, 'Cape et cravate (état actuel)', 40, 70, 54, INK, true)
  const section = (title: string, id: Slot, acc: string, nv: number, frame: number, y0: number) => {
    text(ctx, title, 40, y0 + 40, 40, INK, true)
    shapes.forEach((f, i) => {
      const y = y0 + 60 + i * (cell + 8)
      angles.slice(0, nv).forEach((v, k) => {
        drawCell(ctx, k * cell, y, cell, { shape: f, color: hexOf(colors[i]!), sel: { [id]: acc }, yaw: v.yaw, frame })
        text(ctx, `${SHAPE_NAMES[f]} · ${v.name}`, k * cell + cell / 2, y + cell - 4, 19, GREY, false, 'center')
      })
    })
  }
  section('Cape', 'back', 'cape', 4, 235, 110)
  section('Tie', 'neck', 'tie', 3, 185, 110 + block)
  return c
}

/** Cravate : les 11 formes en clair (face, 3/4, profil), puis une rangee de 4 formes en 64 px (lisibilite). */
function planTie() {
  const shapes = SHAPES.map((s) => s.id)
  const colors = ['turquoise', 'amber', 'pink', 'green', 'violet', 'orange', 'blue', 'turquoise', 'amber', 'pink', 'green']
  const angles = [{ yaw: 0, name: 'face' }, { yaw: 0.62, name: '3/4' }, { yaw: 1.5708, name: 'profile' }]
  const cell = 300
  const { c, ctx } = fresh(cell * 3, 170 + shapes.length * (cell + 8) + 200)
  text(ctx, 'Cravate v11', 40, 70, 54, INK, true)
  text(ctx, 'Triangle + losange bombés, même technique que le nœud papillon', 40, 108, 22, GREY)
  drawCell(ctx, cell * 3 - 190, 0, 190, { shape: 'circle', color: hexOf('turquoise'), sel: { neck: 'bowtie' }, yaw: 0, frame: 150 })
  text(ctx, 'papillon (référence)', cell * 3 - 95, 150, 16, GREY, false, 'center')
  shapes.forEach((f, i) => {
    const y = 170 + i * (cell + 8)
    angles.forEach((v, k) => {
      drawCell(ctx, k * cell, y, cell, { shape: f, color: hexOf(colors[i]!), sel: { neck: 'tie' }, yaw: v.yaw, frame: 185 })
      text(ctx, `${SHAPE_NAMES[f]} · ${v.name}`, k * cell + cell / 2, y + cell - 4, 19, GREY, false, 'center')
    })
  })
  const y0 = 170 + shapes.length * (cell + 8)
  text(ctx, 'Lisibilité en 64 px (taille réelle)', 40, y0 + 40, 30, INK, true)
  const small = ['circle', 'squircle', 'triangle', 'star', 'drop', 'cloud']
  small.forEach((f, j) => drawCell(ctx, 40 + j * 110, y0 + 70, 64, { shape: f, color: hexOf(colors[shapes.indexOf(f)]!), sel: { neck: 'tie' }, yaw: 0, frame: 150 }))
  return c
}

/** Ombrage du corps : les trois styles, avec et sans, sur trois formes. */
function planShading() {
  const styles: Array<{ name: string; renderStyle: Material }> = [{ name: 'Soft', renderStyle: 'soft' }, { name: 'Flat', renderStyle: 'toon' }, { name: 'Pixel', renderStyle: 'pixel' }]
  const shapes = [{ f: 'circle', c: 'violet' }, { f: 'star', c: 'amber' }, { f: 'squircle', c: 'turquoise' }]
  const cell = 240
  const { c, ctx } = fresh(cell * 6, 140 + styles.length * (cell + 40))
  text(ctx, 'Body shading : avec et sans, dans les trois styles', 40, 66, 44, INK, true)
  text(ctx, 'Pour chaque forme : avec ombrage à gauche, sans à droite (corps en aplat, yeux inchangés)', 40, 104, 22, GREY)
  styles.forEach((s, i) => {
    const y = 130 + i * (cell + 40)
    text(ctx, s.name, 12, y + 24, 26, INK, true)
    shapes.forEach((f, k) => {
      ;[true, false].forEach((om, v) => {
        const x = (k * 2 + v) * cell
        drawCell(ctx, x, y + 20, cell, { shape: f.f, color: hexOf(f.c), renderStyle: s.renderStyle, sel: {}, shading: om, frame: 150, yaw: 0.3 })
        text(ctx, om ? 'withIt' : 'without', x + cell / 2, y + cell + 30, 18, GREY, false, 'center')
      })
    })
  })
  return c
}

/** Angles : face, 3/4, profil, dos pour la cape et la cravate. */
function planAngles() {
  const rows: Array<{ name: string; sel: AccessorySelection; shape: string; color: string; frame: number }> = [
    { name: 'Cape (rond)', sel: { back: 'cape' }, shape: 'circle', color: hexOf('turquoise'), frame: 235 },
    { name: 'Cape (cube)', sel: { back: 'cape' }, shape: 'squircle', color: hexOf('amber'), frame: 235 },
    { name: 'Cravate (rond)', sel: { neck: 'tie' }, shape: 'circle', color: hexOf('amber'), frame: 185 },
    { name: 'Cravate (cube)', sel: { neck: 'tie' }, shape: 'squircle', color: hexOf('orange'), frame: 185 }
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
  text(ctx, 'Le corps tourne, la lumière reste en haut à gauche', 40, 122, 26, GREY)
  rows.forEach((t, i) => {
    const y0 = 150 + i * row
    text(ctx, t.name, 40, y0 + 30, 32, INK, true)
    angles.forEach((v, k) => {
      drawCell(ctx, k * cell, y0 + 34, cell, { shape: t.shape, color: t.color, sel: t.sel, yaw: v.yaw, frame: t.frame })
      text(ctx, v.name, k * cell + cell / 2, y0 + row - 8, 20, GREY, false, 'center')
    })
  })
  return c
}

/** Alfred : le Mochi pyramide jaune, lunettes rondes noires et noeud papillon noir, a cote de la reference. */
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
  text(ctx, 'Comparaison avec Alfred', 40, 78, 54, INK, true)
  text(ctx, 'Mêmes lunettes rondes noires, même nœud papillon noir tout en bas', 40, 122, 26, GREY)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 150, cell, cell)
  ctx.drawImage(ref, 0, 150 + (cell - ref.height * (cell / ref.width)) / 2, cell, ref.height * (cell / ref.width))
  text(ctx, 'Référence (Alfred)', cell / 2, 150 + cell + 40, 28, INK, true, 'center')
  drawCell(ctx, cell + 40, 150, cell, { shape: 'triangle', color: hexOf('amber'), sel: { eyes: 'round', neck: 'bowtie' }, frame: 150, yaw: 0 })
  text(ctx, 'Mochi pyramide', cell + 40 + cell / 2, 150 + cell + 40, 28, INK, true, 'center')
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
  const todo: Array<[string, () => HTMLCanvasElement | Promise<HTMLCanvasElement>]> = [
    ['cap', planCap],
    ['cap-combos', planCapCombos],
    ['glasses', planGlasses],
    ['cape-tie', planCapeTie],
    ['tie', planTie],
    ['shading', planShading],
    ['catalogue', planCatalogue],
    ['angles', planAngles],
    ['alfred', planAlfred]
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

import { BotEngine } from '../src/bot/engine'
import { EXPRESSION_BY_ID } from '../src/bot/expressions'
import { HALF_VIEWBOX, RADIUS } from '../src/bot/frame'
import { pixelGrid } from '../src/ui/renderStyle'
import { COLORS, SHAPES } from '../src/bot/skins'
import { resolveAccessories, SLOTS, type AccessorySelection } from '../src/bot/slots'
import type { Material } from '../src/ui/3d/material'
import { contrast, bodyForTheme, DARK_EYE, type Theme } from '../src/ui/3d/theme'

/** Rend les planches du mode sombre : un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
const q = new URLSearchParams(location.search)
const BACKGROUND = '#faf8f3'
const BACKGROUND_DARK = '#121212'
const INK = '#26222f'
const GREY = '#8a8794'
const PAPER = '#f9f9f9'
const W = 1080

const hexOf = (id: string) => COLORS.find((c) => c.id === id)!.hex

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
const SHAPE_LIST = SHAPES.map((s) => s.id)
// couleurs variées, dont une encre (corps éclairci en sombre) ; décalées d'un style à l'autre
const ACCESSORY_PALETTE = ['turquoise', 'amber', 'pink', 'blue', 'violet', 'orange', 'green', 'red', 'grey', 'cream', 'ink']

let renderAvatar: typeof import('../src/ui/3d/scene3d').renderAvatar
const images = new Map<string, ReturnType<BotEngine['sample']>>()
function image(shape: string, mood?: string, state: 'idle' | 'wink' = 'idle', t = 1.2) {
  const key = `${shape}|${mood ?? ''}|${state}|${t}`
  let f = images.get(key)
  if (!f) {
    f = new BotEngine(RADIUS, state, SHAPES.find((s) => s.id === shape)!.radii, mood ? EXPRESSION_BY_ID.get(mood)! : null).sample(t)
    images.set(key, f)
  }
  return f
}

interface Cell {
  shape: string
  color: string
  theme: Theme
  renderStyle?: Material
  sel?: AccessorySelection
  mood?: string
  state?: 'idle' | 'wink'
  yaw?: number
  frame?: number
  /** contraste oeil/corps minimal en sombre ; 0 = corps jamais eclairci */
  min?: number
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, c: Cell) {
  const t = document.createElement('canvas')
  const frame = c.frame ?? 140
  // pixel : la vraie grille de l'application (taille « moyen »), agrandie sans lissage
  const pixel = c.renderStyle === 'pixel'
  t.width = t.height = pixel ? Math.round((pixelGrid('medium') * frame) / HALF_VIEWBOX) : px
  renderAvatar(t, image(c.shape, c.mood, c.state), c.color, PAPER, c.renderStyle ?? 'soft', false, 'strong', true, c.shape, c.yaw ?? 0, null, c.sel ?? {}, frame, c.theme, c.min)
  ctx.imageSmoothingEnabled = !pixel
  ctx.drawImage(t, x, y, px, px)
  ctx.imageSmoothingEnabled = true
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK, bold = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${bold ? '700' : '500'} ${size}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(s, x, y)
}

function fresh(w: number, h: number, background = BACKGROUND) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)
  return { c, ctx }
}

const STYLES: Record<string, { name: string; renderStyle: Material }> = {
  soft: { name: 'Soft', renderStyle: 'soft' },
  flat: { name: 'Flat', renderStyle: 'toon' },
  pixel: { name: 'Pixel', renderStyle: 'pixel' }
}

/** Clair | sombre côte à côte, deux formes par ligne, les 11 formes, dans un style. */
function sheetShapes(style: keyof typeof STYLES, offset: number) {
  const s = STYLES[style]!
  const cell = 270
  const row = cell + 46
  const rows = Math.ceil(SHAPE_LIST.length / 2)
  const { c, ctx } = fresh(W, 170 + rows * row + 20)
  text(ctx, `${s.name} : light et dark`, 40, 78, 56, INK, true)
  text(ctx, 'Les 11 formes. À gauche clair, à droite sombre (yeux noirs).', 40, 122, 26, GREY)
  SHAPE_LIST.forEach((f, i) => {
    const x0 = (i % 2) * 540
    const y0 = 150 + Math.floor(i / 2) * row
    const color = hexOf(ACCESSORY_PALETTE[(i + offset) % ACCESSORY_PALETTE.length]!)
    drawCell(ctx, x0, y0, cell, { shape: f, color, theme: 'light', renderStyle: s.renderStyle })
    drawCell(ctx, x0 + cell, y0, cell, { shape: f, color, theme: 'dark', renderStyle: s.renderStyle })
    text(ctx, `${SHAPE_NAMES[f]}  ·  ${ACCESSORY_PALETTE[(i + offset) % ACCESSORY_PALETTE.length]}`, x0 + cell, y0 + cell + 26, 22, GREY, false, 'center')
  })
  return c
}

/** Les mêmes Mochi en sombre, sur un fond sombre (dashboard) puis sur un fond clair. */
function planchefonds() {
  const cell = 270
  const cols = 4
  const rows = Math.ceil(SHAPE_LIST.length / cols)
  const block = 90 + rows * cell + 20
  const { c, ctx } = fresh(W, 2 * block)
  const backgrounds: Array<[string, string, string]> = [
    ['Sur fond sombre (#121212)', BACKGROUND_DARK, '#f2f0f5'],
    ['Sur fond light', '#ffffff', INK]
  ]
  backgrounds.forEach(([title, background, ink], b) => {
    ctx.fillStyle = background
    ctx.fillRect(0, b * block, W, block)
    text(ctx, title, 40, b * block + 62, 40, ink, true)
    SHAPE_LIST.forEach((f, i) => {
      const x = (i % cols) * cell
      const y = b * block + 90 + Math.floor(i / cols) * cell
      drawCell(ctx, x, y, cell, { shape: f, color: hexOf(ACCESSORY_PALETTE[i % ACCESSORY_PALETTE.length]!), theme: 'dark' })
    })
  })
  return c
}

/** Palette : agents du dashboard (PROJ_PALETTE de core.js) puis palette de la librairie. */
const PALETTE: Array<[string, string]> = [
  ...COLORS.map((c) => [c.id, c.hex] as [string, string]),
  ['flash', '#ffc21a'],
  ['ninou', '#4db8ff'],
  ['et-si', '#2a4dbf'],
  ['dmcheap', '#1f2126'],
  ['magicon', '#c77700'],
  ['robin', '#8b4dff'],
  ['tools', '#ff6b5a'],
  ['jean-claude', '#ff7a1a']
]

/** Palette complète en sombre, avec le rapport de contraste de chaque couleur. */
function planchepalette() {
  const cols = 4
  const cell = 270
  const row = cell + 74
  const rows = Math.ceil(PALETTE.length / cols)
  const { c, ctx } = fresh(W, 170 + rows * row + 20)
  text(ctx, 'Palette en dark', 40, 78, 56, INK, true)
  text(ctx, 'Rapport de contraste œil noir / corps (seuil 3:1). Rouge = éclairci.', 40, 122, 26, GREY)
  PALETTE.forEach(([name, hex], i) => {
    const x = (i % cols) * cell
    const y = 150 + Math.floor(i / cols) * row
    const after = bodyForTheme(hex, 'dark')
    drawCell(ctx, x, y, cell, { shape: SHAPE_LIST[i % SHAPE_LIST.length]!, color: hex, theme: 'dark' })
    const r = contrast(hex, DARK_EYE)
    const lift = after !== hex
    text(ctx, `${name}  ${r.toFixed(1)}:1`, x + cell / 2, y + cell + 24, 23, lift ? '#d23b3b' : INK, true, 'center')
    text(ctx, lift ? `éclairci : ${contrast(after, DARK_EYE).toFixed(1)}:1` : 'inchangé', x + cell / 2, y + cell + 50, 21, GREY, false, 'center')
  })
  return c
}

/** Les couleurs à éclaircir : sans correctif / avec, côte à côte (et le clair pour mémoire). */
function planchecontraste() {
  const scenario = PALETTE.filter(([, h]) => bodyForTheme(h, 'dark') !== h)
  const cell = 340
  const row = cell + 74
  const { c, ctx } = fresh(W, 200 + scenario.length * row + 20)
  text(ctx, 'Corps éclairci en sombre', 40, 78, 52, INK, true)
  text(ctx, 'Seulement les couleurs sous 3:1, juste assez pour atteindre 3:1.', 40, 122, 26, GREY)
  const x1 = 120
  const x2 = 120 + cell + 20
  text(ctx, 'sans correctif', x1 + cell / 2 - 60, 180, 26, INK, true, 'center')
  text(ctx, 'corps éclairci', x2 + cell / 2 - 60, 180, 26, INK, true, 'center')
  scenario.forEach(([name, hex], i) => {
    const y0 = 200 + i * row
    const after = bodyForTheme(hex, 'dark')
    drawCell(ctx, x1 - 80, y0, cell, { shape: 'circle', color: hex, theme: 'dark', min: 0, frame: 130 })
    drawCell(ctx, x2 - 80, y0, cell, { shape: 'circle', color: hex, theme: 'dark', frame: 130 })
    text(ctx, `${name} : ${hex}  (${contrast(hex, DARK_EYE).toFixed(1)}:1)  >  ${after}  (${contrast(after, DARK_EYE).toFixed(1)}:1)`, 40, y0 + cell + 34, 26, INK, true)
  })
  return c
}

/** Cinq humeurs du visage (+ un clin d'œil) en sombre. */
function planchehumeurs() {
  const defs: Array<{ name: string; mood?: string; state?: 'idle' | 'wink'; shape: string; color: string }> = [
    { name: 'neutral', mood: 'neutral', shape: 'circle', color: hexOf('turquoise') },
    { name: 'surprised', mood: 'surprised', shape: 'star', color: hexOf('amber') },
    { name: 'happy', mood: 'happy', shape: 'squircle', color: hexOf('pink') },
    { name: 'colère', mood: 'angry', shape: 'cloud', color: hexOf('red') },
    { name: 'sleepy', mood: 'sleepy', shape: 'drop', color: hexOf('blue') },
    { name: 'clin d’œil (geste)', state: 'wink', shape: 'egg', color: hexOf('violet') }
  ]
  const cell = 360
  const row = cell + 56
  const { c, ctx } = fresh(W, 160 + 2 * row + 10)
  text(ctx, 'Humeurs du visage en dark', 40, 78, 50, INK, true)
  text(ctx, 'Paupières et formes d’yeux inchangées, seule la couleur change.', 40, 122, 26, GREY)
  defs.forEach((d, i) => {
    const x = (i % 3) * cell
    const y = 140 + Math.floor(i / 3) * row
    drawCell(ctx, x, y, cell, { shape: d.shape, color: d.color, theme: 'dark', mood: d.mood, state: d.state, frame: 130 })
    text(ctx, d.name, x + cell / 2, y + cell + 30, 28, INK, true, 'center')
  })
  return c
}

const namesOf = (sel: AccessorySelection) => SLOTS.map((e) => resolveAccessories(e, sel[e])?.name).filter(Boolean) as string[]

/** Combinaisons d'accessoires en sombre (clair en vignette pour comparer). */
function sheetcombos() {
  const defs: Array<{ shape: string; color: string; sel: AccessorySelection }> = [
    { shape: 'circle', color: hexOf('turquoise'), sel: { head: 'headphones', eyes: 'round', face: 'cheeks', neck: 'bowtie', back: 'cape' } },
    { shape: 'star', color: hexOf('amber'), sel: { head: 'flower', eyes: 'sunglasses', face: 'freckles', neck: 'tie', back: 'backpack' } },
    { shape: 'squircle', color: hexOf('pink'), sel: { head: 'crown', eyes: 'heart', face: 'whiskers', neck: 'scarf', back: 'wings' } }
  ]
  const cell = 520
  const row = cell + 90
  const { c, ctx } = fresh(W, 150 + defs.length * row)
  text(ctx, 'Accessoires en dark', 40, 78, 52, INK, true)
  text(ctx, 'À gauche clair, à droite sombre : les accessoires ne changent pas.', 40, 122, 26, GREY)
  defs.forEach((d, i) => {
    const y = 140 + i * row
    drawCell(ctx, 20, y, cell, { shape: d.shape, color: d.color, theme: 'light', sel: d.sel, frame: 205 })
    drawCell(ctx, 540, y, cell, { shape: d.shape, color: d.color, theme: 'dark', sel: d.sel, frame: 205 })
    text(ctx, namesOf(d.sel).join(' + '), W / 2, y + cell + 30, 24, INK, true, 'center')
  })
  return c
}

/** Conflits possibles entre yeux noirs et accessoires de l'emplacement yeux : avant / après la solution. */
function planchecconflits() {
  const SUN_BLACK = { id: 'sunglasses', c2: '#26222f' } // verre noir du catalogue, sans la solution
  const rows: Array<{ name: string; light: AccessorySelection; without: AccessorySelection; withIt: AccessorySelection; shape: string; color: string }> = [
    { name: 'Lunettes de soleil (verre noir)', shape: 'circle', color: hexOf('amber'), light: { eyes: 'sunglasses' }, without: { eyes: SUN_BLACK }, withIt: { eyes: 'sunglasses' } },
    { name: 'Lunettes rondes (monture noire)', shape: 'squircle', color: hexOf('turquoise'), light: { eyes: 'round' }, without: { eyes: 'round' }, withIt: { eyes: 'round' } },
    { name: 'Lunettes carrées (monture marine)', shape: 'cloud', color: hexOf('pink'), light: { eyes: 'square' }, without: { eyes: 'square' }, withIt: { eyes: 'square' } },
    { name: 'Monocle', shape: 'drop', color: hexOf('green'), light: { eyes: 'monocle' }, without: { eyes: 'monocle' }, withIt: { eyes: 'monocle' } },
    { name: 'Masque de sommeil', shape: 'egg', color: hexOf('blue'), light: { eyes: 'sleep' }, without: { eyes: 'sleep' }, withIt: { eyes: 'sleep' } }
  ]
  const cell = 340
  const row = cell + 60
  const { c, ctx } = fresh(W, 210 + rows.length * row)
  text(ctx, 'Yeux noirs et lunettes', 40, 78, 52, INK, true)
  text(ctx, 'Seul vrai conflit : le verre noir des lunettes de soleil.', 40, 122, 26, GREY)
  ;['light', 'sombre, sans solution', 'sombre, verre ardoise'].forEach((t, k) => text(ctx, t, 20 + k * 357 + 170, 190, 22, INK, true, 'center'))
  rows.forEach((l, i) => {
    const y = 210 + i * row
    drawCell(ctx, 0, y, 357, { shape: l.shape, color: l.color, theme: 'light', sel: l.light, frame: 150 })
    drawCell(ctx, 357, y, 357, { shape: l.shape, color: l.color, theme: 'dark', sel: l.without, frame: 150 })
    drawCell(ctx, 714, y, 357, { shape: l.shape, color: l.color, theme: 'dark', sel: l.withIt, frame: 150 })
    text(ctx, l.name, 40, y + cell + 32, 26, INK, true)
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
    ['01-formes-soft', () => sheetShapes('soft', 0)],
    ['02-formes-flat', () => sheetShapes('flat', 3)],
    ['03-formes-pixel', () => sheetShapes('pixel', 6)],
    ['04-fonds', planchefonds],
    ['05-contraste-palette', planchepalette],
    ['06-corps-eclairci', planchecontraste],
    ['07-humeurs', planchehumeurs],
    ['08-accessoires', sheetcombos],
    ['09-conflits-lunettes', planchecconflits]
  ]
  for (const [name, f] of todo) {
    if (!everything && !who.some((x) => name.includes(x))) continue
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

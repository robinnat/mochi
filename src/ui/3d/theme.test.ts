import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { EXPRESSION_BY_ID, EXPRESSIONS } from '@/bot/expressions'
import { RADIUS } from '@/bot/frame'
import { COLORS, SHAPES } from '@/bot/skins'
import { palettePixel, quantifier } from './pixel3d'
import { Mochi3d } from './scene3d'
import {
  accessoriesDark,
  contrast,
  MIN_EYE_CONTRAST,
  bodyForTheme,
  eyeColor,
  isTheme,
  EYE_RGB,
  DARK_EYE,
  DEFAULT_THEME,
  THEMES,
  LENS_SUN_DARK
} from './theme'

describe('theme : valeurs pures', () => {
  it('light by default, two themes, a type guard', () => {
    expect(DEFAULT_THEME).toBe('light')
    expect(THEMES).toEqual(['light', 'dark'])
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('black')).toBe(false)
  })

  it('light: nothing changes (eye = paper, body as is, accessories as is)', () => {
    expect(eyeColor('light', '#f9f9f9')).toBe('#f9f9f9')
    for (const c of COLORS) expect(bodyForTheme(c.hex, 'light')).toBe(c.hex)
    const sel = { eyes: 'sunglasses', head: 'cap' }
    expect(accessoriesDark(sel) === sel).toBe(false)
  })

  it('dark: the eye is the ink', () => {
    expect(eyeColor('dark', '#f9f9f9')).toBe(DARK_EYE)
    expect(DARK_EYE).toBe(COLORS.find((c) => c.id === 'ink')!.hex)
    expect(EYE_RGB).toEqual([10, 10, 12])
  })

  it('dark: only colors that do not contrast enough with the eye are lightened, and just enough', () => {
    for (const c of COLORS) {
      const l = bodyForTheme(c.hex, 'dark')
      expect(contrast(l, DARK_EYE)).toBeGreaterThanOrEqual(MIN_EYE_CONTRAST - 0.01)
      if (contrast(c.hex, DARK_EYE) >= MIN_EYE_CONTRAST) expect(l).toBe(c.hex)
      else expect(l).not.toBe(c.hex)
    }
    // the ink and the dashboard's navy are lightened, violet and bright blue are not
    expect(bodyForTheme('#0a0a0c', 'dark')).not.toBe('#0a0a0c')
    expect(bodyForTheme('#1f2126', 'dark')).not.toBe('#1f2126')
    expect(bodyForTheme('#8b3dff', 'dark')).toBe('#8b3dff')
    expect(bodyForTheme('#3b93f0', 'dark')).toBe('#3b93f0')
    // idempotent: rendering it twice does not lighten it more
    const other = bodyForTheme('#0a0a0c', 'dark')
    expect(bodyForTheme(other, 'dark')).toBe(other)
  })

  it('dark: the only accessory conflict is the black lens of the sunglasses, which turns slate', () => {
    expect(accessoriesDark({ eyes: 'sunglasses' })).toEqual({ eyes: { id: 'sunglasses', c2: LENS_SUN_DARK } })
    // a color chosen by hand is respected
    expect(accessoriesDark({ eyes: { id: 'sunglasses', c2: '#ff0000' } })).toEqual({ eyes: { id: 'sunglasses', c2: '#ff0000' } })
    const other = { eyes: 'round', head: 'cap', neck: 'bowtie' }
    expect(accessoriesDark(other)).toBe(other)
    expect(accessoriesDark({})).toEqual({})
  })
})

describe('theme : pixel', () => {
  it('dark: almost black pixels become the black eye, the body keeps its tones', () => {
    const w = 6
    const h = 5
    const data = new Uint8ClampedArray(w * h * 4)
    const body = '#3b93f0'
    const base = palettePixel(body)[1]!
    for (let i = 0; i < w * h; i++) data.set([base[0]!, base[1]!, base[2]!, 255], i * 4)
    // a 2x2 eye a little above pure black (lighting)
    for (const [x, y] of [[2, 2], [3, 2], [2, 1], [3, 1]] as const) data.set([18, 18, 22, 255], (y * w + x) * 4)
    quantifier(data, w, h, palettePixel(body, [], EYE_RGB), false, EYE_RGB)
    const px = (x: number, y: number) => [data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]]
    expect(px(2, 2)).toEqual([...EYE_RGB])
    expect(px(3, 1)).toEqual([...EYE_RGB])
  })

  it('light: the previous behavior (white eyes) is unchanged', () => {
    const p = palettePixel('#7b6cd9')
    expect(p[p.length - 1]!.slice(0, 3)).toEqual([255, 255, 255])
  })
})

/* ------------------------------------------------------------------ 3D body, without WebGL */

/** Fake 2D canvas that records the color of each fill, and on which canvas. */
function fakeDom() {
  const journal: Array<{ canvas: number; fill: string }> = []
  let n = 0
  const create = () => {
    const id = n++
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      setTransform() {},
      fillRect() {
        journal.push({ canvas: id, fill: String(ctx.fillStyle) })
      },
      fill() {
        journal.push({ canvas: id, fill: String(ctx.fillStyle) })
      },
      save() {},
      restore() {},
      clip() {},
      createRadialGradient: () => ({ addColorStop() {} })
    }
    return { width: 0, height: 0, getContext: () => ctx }
  }
  vi.stubGlobal('document', { createElement: create })
  vi.stubGlobal('Path2D', class { rect() {} addPath() {} })
  return Object.assign(journal, { reset: () => { n = 0; journal.length = 0 } })
}

const image = (shape: string) => new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === shape)!.radii, null).sample(1.2)

describe('theme: painting the face (Mochi3d)', () => {
  let journal: ReturnType<typeof fakeDom>
  beforeEach(() => {
    journal = fakeDom()
  })
  afterEach(() => vi.unstubAllGlobals())

  /** Fill colors: [body (canvas 0), eye emission mask (canvas 1)] */
  const paint = (renderStyle: 'soft' | 'toon' | 'realistic', theme: 'light' | 'dark' | undefined, shape = 'circle') => {
    journal.reset()
    const m = new Mochi3d(32)
    m.setRenderStyle(renderStyle)
    if (theme) m.setTheme(theme)
    m.setShape(shape)
    m.update(image(shape), '#3b93f0', '#f9f9f9')
    const read = (c: number) => journal.filter((j) => j.canvas === c).map((j) => j.fill)
    return { body: read(0), masque: read(1) }
  }

  it.each(['soft', 'toon', 'realistic'] as const)('%s: no theme = light = the previous rendering (paper eyes, white mask)', (renderStyle) => {
    const initial = paint(renderStyle, undefined)
    const light = paint(renderStyle, 'light')
    expect(light).toEqual(initial)
    expect(light.body).toContain('#f9f9f9')
    expect(light.masque).toContain('#fff')
    expect(light.body).not.toContain(DARK_EYE)
  })

  it.each(['soft', 'toon', 'realistic'] as const)('%s: in dark the eyes are black and no longer glow', (renderStyle) => {
    const s = paint(renderStyle, 'dark')
    expect(s.body).toContain(DARK_EYE)
    expect(s.body).not.toContain('#f9f9f9')
    expect(s.masque).toContain('#fff')
  })

  it.each(['toon', 'pixel'] as const)('%s: without shading, the body is flat (material without light); with it, the previous material', (renderStyle) => {
    const m = new Mochi3d(32)
    m.setShading(false)
    m.setRenderStyle(renderStyle)
    expect(m.mesh.material.type).toBe('MeshBasicMaterial')
    m.setShading(true)
    m.setRenderStyle(renderStyle)
    expect(m.mesh.material.type).not.toBe('MeshBasicMaterial')
  })

  it('soft: always shaded, shading false is ignored (11/11/2026)', () => {
    const m = new Mochi3d(32)
    m.setShading(false)
    m.setRenderStyle('soft')
    expect(m.mesh.material.type).toBe('MeshToonMaterial')
    m.setShading(true)
    m.setRenderStyle('soft')
    expect(m.mesh.material.type).toBe('MeshToonMaterial')
  })

  it.each(['soft', 'toon', 'realistic'] as const)('%s: the dark eye does not glow (zero emission), the light eye does', (renderStyle) => {
    const m = new Mochi3d(32)
    m.setRenderStyle(renderStyle)
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBeGreaterThan(0)
    m.setTheme('dark')
    m.setRenderStyle(renderStyle)
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBe(0)
    m.setTheme('light')
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBeGreaterThan(0)
  })

  it.each(SHAPES.map((x) => x.id))('shape %s: black eyes in dark', (shape) => {
    const s = paint('soft', 'dark', shape)
    expect(s.body).toContain(DARK_EYE)
  })

  it.each(EXPRESSIONS.map((e) => e.id))('mood %s: black eyes (lids included, they are part of the eye shape)', (id) => {
    journal.reset()
    const m = new Mochi3d(32)
    m.setRenderStyle('soft')
    m.setTheme('dark')
    m.setShape('circle')
    const f = new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === 'circle')!.radii, EXPRESSION_BY_ID.get(id)!).sample(1.2)
    m.update(f, '#e152b0', '#f9f9f9')
    expect(journal.filter((j) => j.canvas === 0).map((j) => j.fill)).toContain(DARK_EYE)
  })
})

describe('no outline option any more (11/11/2026)', () => {
  beforeEach(() => {
    fakeDom()
  })
  afterEach(() => vi.unstubAllGlobals())

  const shell = (m: Mochi3d) => (m as unknown as { shell: { visible: boolean } }).shell.visible

  it.each(['soft', 'toon', 'pixel'] as const)('%s: the public styles never show the outline shell', (renderStyle) => {
    const m = new Mochi3d(32)
    m.setRenderStyle(renderStyle)
    expect(shell(m)).toBe(false)
    expect('setOutlineWidth' in m).toBe(false)
  })
})

describe('theme: in light, white eyes for every color, no outline (10/11/2026)', () => {
  it('the light theme paints the eyes with the paper (white), yellow and lime included; the dark one in black', () => {
    for (const c of COLORS) expect(eyeColor('light', '#ffffff'), c.id).toBe('#ffffff')
    expect(eyeColor('dark', '#ffffff')).toBe(DARK_EYE)
  })
  it('no more outline exception or forced theme for light bodies', async () => {
    const theme = await import('./theme')
    expect('eyeOutline' in theme).toBe(false)
    expect('eyeTheme' in theme).toBe(false)
    expect('bodyVeryLight' in theme).toBe(false)
  })
})

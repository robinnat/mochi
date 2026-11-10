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
  it('clair par defaut, deux themes, un garde de type', () => {
    expect(DEFAULT_THEME).toBe('light')
    expect(THEMES).toEqual(['light', 'dark'])
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('black')).toBe(false)
  })

  it('clair : rien ne change (oeil = papier, corps tel quel, accessoires tels quels)', () => {
    expect(eyeColor('light', '#f9f9f9')).toBe('#f9f9f9')
    for (const c of COLORS) expect(bodyForTheme(c.hex, 'light')).toBe(c.hex)
    const sel = { eyes: 'sunglasses', head: 'cap' }
    expect(accessoriesDark(sel) === sel).toBe(false)
  })

  it('sombre : l oeil est l encre', () => {
    expect(eyeColor('dark', '#f9f9f9')).toBe(DARK_EYE)
    expect(DARK_EYE).toBe(COLORS.find((c) => c.id === 'ink')!.hex)
    expect(EYE_RGB).toEqual([10, 10, 12])
  })

  it('sombre : seules les couleurs qui ne contrastent pas assez avec l oeil sont eclaircies, et juste assez', () => {
    for (const c of COLORS) {
      const l = bodyForTheme(c.hex, 'dark')
      expect(contrast(l, DARK_EYE)).toBeGreaterThanOrEqual(MIN_EYE_CONTRAST - 0.01)
      if (contrast(c.hex, DARK_EYE) >= MIN_EYE_CONTRAST) expect(l).toBe(c.hex)
      else expect(l).not.toBe(c.hex)
    }
    // l encre et le bleu marine du dashboard sont eclaircis, le violet et le bleu vif non
    expect(bodyForTheme('#0a0a0c', 'dark')).not.toBe('#0a0a0c')
    expect(bodyForTheme('#1f2126', 'dark')).not.toBe('#1f2126')
    expect(bodyForTheme('#8b3dff', 'dark')).toBe('#8b3dff')
    expect(bodyForTheme('#3b93f0', 'dark')).toBe('#3b93f0')
    // idempotent : le rendre deux fois ne l eclaircit pas davantage
    const other = bodyForTheme('#0a0a0c', 'dark')
    expect(bodyForTheme(other, 'dark')).toBe(other)
  })

  it('sombre : le seul conflit d accessoire est le verre noir des lunettes de soleil, qui passe a l ardoise', () => {
    expect(accessoriesDark({ eyes: 'sunglasses' })).toEqual({ eyes: { id: 'sunglasses', c2: LENS_SUN_DARK } })
    // une couleur choisie a la main est respectee
    expect(accessoriesDark({ eyes: { id: 'sunglasses', c2: '#ff0000' } })).toEqual({ eyes: { id: 'sunglasses', c2: '#ff0000' } })
    const other = { eyes: 'round', head: 'cap', neck: 'bowtie' }
    expect(accessoriesDark(other)).toBe(other)
    expect(accessoriesDark({})).toEqual({})
  })
})

describe('theme : pixel', () => {
  it('sombre : les pixels presque noirs deviennent l oeil noir, le corps garde ses tons', () => {
    const w = 6
    const h = 5
    const data = new Uint8ClampedArray(w * h * 4)
    const body = '#3b93f0'
    const base = palettePixel(body)[1]!
    for (let i = 0; i < w * h; i++) data.set([base[0]!, base[1]!, base[2]!, 255], i * 4)
    // un oeil 2x2 un peu au-dessus du noir pur (eclairage)
    for (const [x, y] of [[2, 2], [3, 2], [2, 1], [3, 1]] as const) data.set([18, 18, 22, 255], (y * w + x) * 4)
    quantifier(data, w, h, palettePixel(body, [], EYE_RGB), false, EYE_RGB)
    const px = (x: number, y: number) => [data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]]
    expect(px(2, 2)).toEqual([...EYE_RGB])
    expect(px(3, 1)).toEqual([...EYE_RGB])
  })

  it('clair : le comportement d avant (le blanc des yeux) est inchange', () => {
    const p = palettePixel('#7b6cd9')
    expect(p[p.length - 1]!.slice(0, 3)).toEqual([255, 255, 255])
  })
})

/* ------------------------------------------------------------------ corps 3D, sans WebGL */

/** Faux canvas 2D qui note la couleur de chaque remplissage, et sur quel canvas. */
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

describe('theme : peinture du visage (Mochi3d)', () => {
  let journal: ReturnType<typeof fakeDom>
  beforeEach(() => {
    journal = fakeDom()
  })
  afterEach(() => vi.unstubAllGlobals())

  /** Couleurs de remplissage : [corps (canvas 0), masque d emission des yeux (canvas 1)] */
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

  it.each(['soft', 'toon', 'realistic'] as const)('%s : sans theme = clair = le rendu d avant (yeux papier, masque blanc)', (renderStyle) => {
    const initial = paint(renderStyle, undefined)
    const light = paint(renderStyle, 'light')
    expect(light).toEqual(initial)
    expect(light.body).toContain('#f9f9f9')
    expect(light.masque).toContain('#fff')
    expect(light.body).not.toContain(DARK_EYE)
  })

  it.each(['soft', 'toon', 'realistic'] as const)('%s : en sombre les yeux sont noirs et ne s allument plus', (renderStyle) => {
    const s = paint(renderStyle, 'dark')
    expect(s.body).toContain(DARK_EYE)
    expect(s.body).not.toContain('#f9f9f9')
    expect(s.masque).toContain('#fff')
  })

  it.each(['soft', 'toon', 'pixel'] as const)('%s : sans ombrage, le corps est un aplat (matiere sans lumiere) ; avec, la matiere d avant', (renderStyle) => {
    const m = new Mochi3d(32)
    m.setShading(false)
    m.setRenderStyle(renderStyle)
    expect(m.mesh.material.type).toBe('MeshBasicMaterial')
    m.setShading(true)
    m.setRenderStyle(renderStyle)
    expect(m.mesh.material.type).not.toBe('MeshBasicMaterial')
  })

  it.each(['soft', 'toon', 'realistic'] as const)('%s : l oeil sombre ne s allume pas (emission nulle), l oeil clair oui', (renderStyle) => {
    const m = new Mochi3d(32)
    m.setRenderStyle(renderStyle)
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBeGreaterThan(0)
    m.setTheme('dark')
    m.setRenderStyle(renderStyle)
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBe(0)
    m.setTheme('light')
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBeGreaterThan(0)
  })

  it.each(SHAPES.map((x) => x.id))('forme %s : yeux noirs en sombre', (shape) => {
    const s = paint('soft', 'dark', shape)
    expect(s.body).toContain(DARK_EYE)
  })

  it.each(EXPRESSIONS.map((e) => e.id))('humeur %s : des yeux noirs (paupieres comprises, elles font partie de la forme de l oeil)', (id) => {
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

describe('epaisseur du contour (Mochi3d)', () => {
  beforeEach(() => {
    fakeDom()
  })
  afterEach(() => vi.unstubAllGlobals())

  const halfThickness = (m: Mochi3d) => (m as unknown as { thickness: { value: number } }).thickness.value

  it.each(['soft', 'toon', 'pixel'] as const)('%s : le contour est disponible, et son epaisseur suit le facteur (1 = valeur de base)', (renderStyle) => {
    const m = new Mochi3d(32)
    m.setRenderStyle(renderStyle, true)
    expect((m as unknown as { shell: { visible: boolean } }).shell.visible).toBe(true)
    m.fitOutline(1)
    const base = halfThickness(m)
    m.setOutlineWidth(2)
    m.fitOutline(1)
    expect(halfThickness(m)).toBeCloseTo(2 * base, 6)
    m.setOutlineWidth(0.5)
    m.fitOutline(1)
    expect(halfThickness(m)).toBeCloseTo(0.5 * base, 6)
    m.setOutlineWidth(1)
    m.fitOutline(1)
    expect(halfThickness(m)).toBeCloseTo(base, 6)
  })

  it('le facteur est borne et une value absurde revient au defaut', () => {
    const m = new Mochi3d(32)
    m.fitOutline(1)
    const base = halfThickness(m)
    m.setOutlineWidth(1000)
    m.fitOutline(1)
    expect(halfThickness(m)).toBeCloseTo(base * 4, 6)
    m.setOutlineWidth(Number.NaN)
    m.fitOutline(1)
    expect(halfThickness(m)).toBeCloseTo(base, 6)
  })

  it('sans contour demande, Soft n a pas de coque', () => {
    const m = new Mochi3d(32)
    m.setRenderStyle('soft', false)
    expect((m as unknown as { shell: { visible: boolean } }).shell.visible).toBe(false)
  })
})

describe('theme : en clair, yeux blancs pour toutes les couleurs, sans contour (Robin, 10/11/2026)', () => {
  it('le theme clair peint les yeux avec le papier (blanc), jaune et citron vert compris ; le sombre en noir', () => {
    for (const c of COLORS) expect(eyeColor('light', '#ffffff'), c.id).toBe('#ffffff')
    expect(eyeColor('dark', '#ffffff')).toBe(DARK_EYE)
  })
  it('plus aucune exception de contour ni de theme force pour les corps clairs', async () => {
    const theme = await import('./theme')
    expect('eyeOutline' in theme).toBe(false)
    expect('eyeTheme' in theme).toBe(false)
    expect('bodyVeryLight' in theme).toBe(false)
  })
})

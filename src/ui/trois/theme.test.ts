import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { EXPRESSION_BY_ID, EXPRESSIONS } from '@/bot/expressions'
import { RAYON } from '@/bot/repere'
import { COLORS, SHAPES } from '@/bot/skins'
import { palettePixel, quantifier } from './pixel3d'
import { Mochi3d } from './scene3d'
import {
  accessoiresSombres,
  contraste,
  CONTRASTE_OEIL_MIN,
  corpsPourTheme,
  couleurOeil,
  estTheme,
  OEIL_RGB,
  OEIL_SOMBRE,
  THEME_DEFAUT,
  THEMES,
  VERRE_SOLEIL_SOMBRE
} from './theme'

describe('theme : valeurs pures', () => {
  it('clair par defaut, deux themes, un garde de type', () => {
    expect(THEME_DEFAUT).toBe('light')
    expect(THEMES).toEqual(['light', 'dark'])
    expect(estTheme('dark')).toBe(true)
    expect(estTheme('noir')).toBe(false)
  })

  it('clair : rien ne change (oeil = papier, corps tel quel, accessoires tels quels)', () => {
    expect(couleurOeil('light', '#f9f9f9')).toBe('#f9f9f9')
    for (const c of COLORS) expect(corpsPourTheme(c.hex, 'light')).toBe(c.hex)
    const sel = { yeux: 'soleil', tete: 'casquette' }
    expect(accessoiresSombres(sel) === sel).toBe(false)
  })

  it('sombre : l oeil est l encre', () => {
    expect(couleurOeil('dark', '#f9f9f9')).toBe(OEIL_SOMBRE)
    expect(OEIL_SOMBRE).toBe(COLORS.find((c) => c.id === 'encre')!.hex)
    expect(OEIL_RGB).toEqual([10, 10, 12])
  })

  it('sombre : seules les couleurs qui ne contrastent pas assez avec l oeil sont eclaircies, et juste assez', () => {
    for (const c of COLORS) {
      const l = corpsPourTheme(c.hex, 'dark')
      expect(contraste(l, OEIL_SOMBRE)).toBeGreaterThanOrEqual(CONTRASTE_OEIL_MIN - 0.01)
      if (contraste(c.hex, OEIL_SOMBRE) >= CONTRASTE_OEIL_MIN) expect(l).toBe(c.hex)
      else expect(l).not.toBe(c.hex)
    }
    // l encre et le bleu marine du dashboard sont eclaircis, le violet et le bleu vif non
    expect(corpsPourTheme('#0a0a0c', 'dark')).not.toBe('#0a0a0c')
    expect(corpsPourTheme('#1f2126', 'dark')).not.toBe('#1f2126')
    expect(corpsPourTheme('#8b5cf6', 'dark')).toBe('#8b5cf6')
    expect(corpsPourTheme('#3b93f0', 'dark')).toBe('#3b93f0')
    // idempotent : le rendre deux fois ne l eclaircit pas davantage
    const une = corpsPourTheme('#0a0a0c', 'dark')
    expect(corpsPourTheme(une, 'dark')).toBe(une)
  })

  it('sombre : le seul conflit d accessoire est le verre noir des lunettes de soleil, qui passe a l ardoise', () => {
    expect(accessoiresSombres({ yeux: 'soleil' })).toEqual({ yeux: { id: 'soleil', c2: VERRE_SOLEIL_SOMBRE } })
    // une couleur choisie a la main est respectee
    expect(accessoiresSombres({ yeux: { id: 'soleil', c2: '#ff0000' } })).toEqual({ yeux: { id: 'soleil', c2: '#ff0000' } })
    const autre = { yeux: 'rondes', tete: 'casquette', bas: 'papillon' }
    expect(accessoiresSombres(autre)).toBe(autre)
    expect(accessoiresSombres({})).toEqual({})
  })
})

describe('theme : pixel', () => {
  it('sombre : les pixels presque noirs deviennent l oeil noir, le corps garde ses tons', () => {
    const w = 6
    const h = 5
    const data = new Uint8ClampedArray(w * h * 4)
    const corps = '#3b93f0'
    const base = palettePixel(corps)[1]!
    for (let i = 0; i < w * h; i++) data.set([base[0]!, base[1]!, base[2]!, 255], i * 4)
    // un oeil 2x2 un peu au-dessus du noir pur (eclairage)
    for (const [x, y] of [[2, 2], [3, 2], [2, 1], [3, 1]] as const) data.set([18, 18, 22, 255], (y * w + x) * 4)
    quantifier(data, w, h, palettePixel(corps, [], OEIL_RGB), false, OEIL_RGB)
    const px = (x: number, y: number) => [data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]]
    expect(px(2, 2)).toEqual([...OEIL_RGB])
    expect(px(3, 1)).toEqual([...OEIL_RGB])
  })

  it('clair : le comportement d avant (le blanc des yeux) est inchange', () => {
    const p = palettePixel('#7b6cd9')
    expect(p[p.length - 1]!.slice(0, 3)).toEqual([255, 255, 255])
  })
})

/* ------------------------------------------------------------------ corps 3D, sans WebGL */

/** Faux canvas 2D qui note la couleur de chaque remplissage, et sur quel canvas. */
function fauxDom() {
  const journal: Array<{ canvas: number; fill: string }> = []
  let n = 0
  const creer = () => {
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
  vi.stubGlobal('document', { createElement: creer })
  vi.stubGlobal('Path2D', class { rect() {} addPath() {} })
  return Object.assign(journal, { remettre: () => { n = 0; journal.length = 0 } })
}

const image = (forme: string) => new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === forme)!.radii, null).sample(1.2)

describe('theme : peinture du visage (Mochi3d)', () => {
  let journal: ReturnType<typeof fauxDom>
  beforeEach(() => {
    journal = fauxDom()
  })
  afterEach(() => vi.unstubAllGlobals())

  /** Couleurs de remplissage : [corps (canvas 0), masque d emission des yeux (canvas 1)] */
  const peindre = (rendu: 'doux' | 'toon' | 'realiste', theme: 'light' | 'dark' | undefined, forme = 'cercle') => {
    journal.remettre()
    const m = new Mochi3d(32)
    m.setRendu(rendu)
    if (theme) m.setTheme(theme)
    m.setForme(forme)
    m.maj(image(forme), '#3b93f0', '#f9f9f9')
    const lire = (c: number) => journal.filter((j) => j.canvas === c).map((j) => j.fill)
    return { corps: lire(0), masque: lire(1) }
  }

  it.each(['doux', 'toon', 'realiste'] as const)('%s : sans theme = clair = le rendu d avant (yeux papier, masque blanc)', (rendu) => {
    const defaut = peindre(rendu, undefined)
    const clair = peindre(rendu, 'light')
    expect(clair).toEqual(defaut)
    expect(clair.corps).toContain('#f9f9f9')
    expect(clair.masque).toContain('#fff')
    expect(clair.corps).not.toContain(OEIL_SOMBRE)
  })

  it.each(['doux', 'toon', 'realiste'] as const)('%s : en sombre les yeux sont noirs et ne s allument plus', (rendu) => {
    const s = peindre(rendu, 'dark')
    expect(s.corps).toContain(OEIL_SOMBRE)
    expect(s.corps).not.toContain('#f9f9f9')
    expect(s.masque).toContain('#fff')
  })

  it.each(['doux', 'toon', 'pixel'] as const)('%s : sans ombrage, le corps est un aplat (matiere sans lumiere) ; avec, la matiere d avant', (rendu) => {
    const m = new Mochi3d(32)
    m.setOmbrage(false)
    m.setRendu(rendu)
    expect(m.mesh.material.type).toBe('MeshBasicMaterial')
    m.setOmbrage(true)
    m.setRendu(rendu)
    expect(m.mesh.material.type).not.toBe('MeshBasicMaterial')
  })

  it.each(['doux', 'toon', 'realiste'] as const)('%s : l oeil sombre ne s allume pas (emission nulle), l oeil clair oui', (rendu) => {
    const m = new Mochi3d(32)
    m.setRendu(rendu)
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBeGreaterThan(0)
    m.setTheme('dark')
    m.setRendu(rendu)
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBe(0)
    m.setTheme('light')
    expect((m.mesh.material as { emissiveIntensity: number }).emissiveIntensity).toBeGreaterThan(0)
  })

  it.each(SHAPES.map((x) => x.id))('forme %s : yeux noirs en sombre', (forme) => {
    const s = peindre('doux', 'dark', forme)
    expect(s.corps).toContain(OEIL_SOMBRE)
  })

  it.each(EXPRESSIONS.map((e) => e.id))('humeur %s : des yeux noirs (paupieres comprises, elles font partie de la forme de l oeil)', (id) => {
    journal.remettre()
    const m = new Mochi3d(32)
    m.setRendu('doux')
    m.setTheme('dark')
    m.setForme('cercle')
    const f = new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === 'cercle')!.radii, EXPRESSION_BY_ID.get(id)!).sample(1.2)
    m.maj(f, '#e152b0', '#f9f9f9')
    expect(journal.filter((j) => j.canvas === 0).map((j) => j.fill)).toContain(OEIL_SOMBRE)
  })
})

describe('epaisseur du contour (Mochi3d)', () => {
  beforeEach(() => {
    fauxDom()
  })
  afterEach(() => vi.unstubAllGlobals())

  const demiEpaisseur = (m: Mochi3d) => (m as unknown as { epaisseur: { value: number } }).epaisseur.value

  it.each(['doux', 'toon', 'pixel'] as const)('%s : le contour est disponible, et son epaisseur suit le facteur (1 = valeur de base)', (rendu) => {
    const m = new Mochi3d(32)
    m.setRendu(rendu, true)
    expect((m as unknown as { coque: { visible: boolean } }).coque.visible).toBe(true)
    m.calerContour(1)
    const base = demiEpaisseur(m)
    m.setEpaisseurContour(2)
    m.calerContour(1)
    expect(demiEpaisseur(m)).toBeCloseTo(2 * base, 6)
    m.setEpaisseurContour(0.5)
    m.calerContour(1)
    expect(demiEpaisseur(m)).toBeCloseTo(0.5 * base, 6)
    m.setEpaisseurContour(1)
    m.calerContour(1)
    expect(demiEpaisseur(m)).toBeCloseTo(base, 6)
  })

  it('le facteur est borne et une valeur absurde revient au defaut', () => {
    const m = new Mochi3d(32)
    m.calerContour(1)
    const base = demiEpaisseur(m)
    m.setEpaisseurContour(1000)
    m.calerContour(1)
    expect(demiEpaisseur(m)).toBeCloseTo(base * 4, 6)
    m.setEpaisseurContour(Number.NaN)
    m.calerContour(1)
    expect(demiEpaisseur(m)).toBeCloseTo(base, 6)
  })

  it('sans contour demande, Soft n a pas de coque', () => {
    const m = new Mochi3d(32)
    m.setRendu('doux', false)
    expect((m as unknown as { coque: { visible: boolean } }).coque.visible).toBe(false)
  })
})

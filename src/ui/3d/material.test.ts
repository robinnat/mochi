import { describe, expect, it } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { RADIUS } from '@/bot/frame'
import { SHAPES } from '@/bot/skins'
import {
  colorOutline,
  outlineWidthPx,
  lightingFlat,
  isFlat,
  isMaterial,
  finesseOf,
  gradientMap,
  meshOf,
  DEFAULT_MATERIAL,
  MATERIALS,
  settingFlat,
  shadedFor
} from './material'
import { HALF_VIEWBOX } from '@/bot/frame'
import { bodyOutline, inflate, reduce, vertices } from './volume'

const VB_TEST = HALF_VIEWBOX

/**
 * The "flat 3D" variants: pure settings (tones, thresholds, finesse). The WebGL rendering is viewed in
 * `lab.html#shapes3d`; here we lock what can be computed under Node.
 */

describe('material list', () => {
  it('the default is soft (design choice, 03/11), flat stays in the code, realistic stays available', () => {
    expect(DEFAULT_MATERIAL).toBe('soft')
    expect(MATERIALS).toEqual(['realistic', 'toon', 'toon-outline', 'lowpoly', 'flat', 'soft', 'pixel'])
    expect(MATERIALS.every(isMaterial)).toBe(true)
    expect(isMaterial('plastic')).toBe(false)
    expect(isFlat('realistic')).toBe(false)
    expect(MATERIALS.filter(isFlat)).toHaveLength(6)
    expect(settingFlat('realistic')).toBeNull()
  })

  it('only toon-outline has its own outline, only lowpoly has facets', () => {
    expect(MATERIALS.filter((r) => settingFlat(r)?.outline)).toEqual(['toon-outline'])
    expect(MATERIALS.filter((r) => settingFlat(r)?.facets)).toEqual(['lowpoly'])
    expect(MATERIALS.filter((r) => meshOf(r) === 'grossier')).toEqual(['lowpoly'])
  })
})

describe('steps and lighting', () => {
  it.each(MATERIALS.filter((x) => isFlat(x) && x !== 'soft'))('%s: one tone more than thresholds, increasing thresholds', (r) => {
    const p = settingFlat(r)!
    expect(p.tones).toHaveLength(p.thresholds.length + 1)
    expect(p.thresholds).toEqual([...p.thresholds].sort((a, b) => a - b))
    // the tone covering most of the surface is the flat color, as is
    expect(p.tones).toContain(1)
  })

  it.each(MATERIALS.filter(isFlat))('%s: ambient + direct * ramp gives back each tone', (r) => {
    const p = settingFlat(r)!
    const e = lightingFlat(p)
    p.tones.forEach((ton, i) => {
      expect((e.ambient + e.directe * e.ramp[i]!) / Math.PI).toBeCloseTo(ton, 6)
    })
  })

  it('the sampled ramp rises in steps, from 0 to the lightest tone (255)', () => {
    for (const r of MATERIALS.filter((x) => isFlat(x) && x !== 'soft')) {
      const g = gradientMap(settingFlat(r)!)
      expect(g).toHaveLength(32)
      expect(g[0]).toBe(0)
      expect(g[31]).toBe(255)
      for (let i = 1; i < g.length; i++) expect(g[i]!).toBeGreaterThanOrEqual(g[i - 1]!)
      // steps, not a gradient: at most one level per tone
      expect(new Set(g).size).toBeLessThanOrEqual(settingFlat(r)!.tones.length)
    }
  })

  it("flat has only two tones; toon has three", () => {
    expect(new Set(gradientMap(settingFlat('flat')!)).size).toBe(2)
    expect(new Set(gradientMap(settingFlat('toon')!)).size).toBe(3)
  })
})

describe('cartoon outline', () => {
  const lum = (c: string) => {
    const v = parseInt(c.slice(1), 16)
    return Math.max((v >> 16) & 255, (v >> 8) & 255, v & 255)
  }
  const tint = (c: string) => {
    const v = parseInt(c.slice(1), 16)
    const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    const max = Math.max(r, g, b)
    const d = max - Math.min(r, g, b)
    if (!d) return 0
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return h * 60
  }
  it.each(['#f0b429', '#8b5cf6', '#e152b0', '#2fbfa0', '#3b93f0'])('%s: darker, same hue, not black', (hex) => {
    const c = colorOutline(hex)
    expect(lum(c)).toBeLessThan(lum(hex) * 0.6)
    expect(lum(c)).toBeGreaterThan(20)
    expect(Math.abs(tint(c) - tint(hex))).toBeLessThan(8)
  })
  it("the thickness gets lighter at small sizes, with a floor and a ceiling", () => {
    expect(outlineWidthPx(40)).toBe(1.3)
    expect(outlineWidthPx(100)).toBeLessThan(outlineWidthPx(150))
    expect(outlineWidthPx(5000)).toBe(3.4)
  })
  it("only flat has an organic shadow boundary", () => {
    expect(MATERIALS.filter((r) => settingFlat(r)?.organic)).toEqual(['flat'])
  })
})

describe('maillage grossier (lowpoly)', () => {
  const pts = (id: string) =>
    bodyOutline(
      new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === id)!.radii, null).sample(0.5).bodyPath,
      1
    )

  it.each(['circle', 'star', 'cloud', 'flower', 'drop', 'heart'])('%s: closed volume, far fewer vertices', (id) => {
    const p = reduce(pts(id), settingFlat('lowpoly')!.reduction)
    const end = inflate(pts(id), VB_TEST)
    const large = inflate(p, VB_TEST, undefined, finesseOf('lowpoly'))
    expect(large.positions.length / 3).toBe(vertices(p.length, finesseOf('lowpoly').rings))
    expect(large.positions.length).toBeLessThan(end.positions.length / 3)
    // each triangle points to an existing vertex
    expect(Math.max(...large.index)).toBeLessThan(large.positions.length / 3)
    expect(large.index.length % 3).toBe(0)
  })

  it('reduce keeps at least three points and changes nothing for k = 1', () => {
    const p = pts('circle')
    expect(reduce(p, 1)).toBe(p)
    expect(reduce(p, 2)).toHaveLength(p.length / 2)
    expect(reduce(p.slice(0, 4), 8).length).toBeGreaterThanOrEqual(3)
  })
})

describe('soft: smooth, matte shading', () => {
  const ramp = () => Array.from(gradientMap(settingFlat('soft')!))

  it('no step: the ramp is continuous, increasing, with no jump', () => {
    const g = ramp()
    expect(g.length).toBeGreaterThanOrEqual(128)
    for (let i = 1; i < g.length; i++) {
      expect(g[i]!).toBeGreaterThanOrEqual(g[i - 1]!)
      expect(g[i]! - g[i - 1]!).toBeLessThanOrEqual(8)
    }
    expect(g[0]).toBe(0)
    expect(g[g.length - 1]).toBe(255)
  })

  it('the base color dominates: full tone from the center to the top left', () => {
    const g = ramp()
    const dot = (d: number) => g[Math.floor(((d + 1) / 2) * g.length)]!
    expect(dot(0.65)).toBeGreaterThan(240) // facing the camera: light at the top left, in front
    expect(dot(0.9)).toBe(255)
  })

  it('a single look, the former strong one: low contrast, no tone lighter than the base (11/11/2026)', () => {
    const p = settingFlat('soft')!
    expect(p.tones).toEqual([0.56, 1])
    expect(Math.max(...p.tones)).toBe(1)
    expect(Math.min(...p.tones)).toBeGreaterThan(0.5)
    expect(lightingFlat(p).ramp[0]).toBe(0)
  })

  it('a single material: no facets, no own outline, no boundary noise', () => {
    const p = settingFlat('soft')!
    expect(p.facets || p.outline || p.organic).toBe(false)
    expect(meshOf('soft')).toBe('full')
    expect(isFlat('soft')).toBe(true)
    expect(DEFAULT_MATERIAL).toBe('soft')
  })

  it('Soft is always shaded: shading false only turns the relief off for the other materials (11/11/2026)', () => {
    expect(shadedFor('soft', false)).toBe(true)
    expect(shadedFor('soft', true)).toBe(true)
    expect(shadedFor('toon', false)).toBe(false)
    expect(shadedFor('pixel', false)).toBe(false)
    expect(shadedFor('toon', true)).toBe(true)
  })
})

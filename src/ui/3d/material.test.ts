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
  SOFTNESSES,
  DEFAULT_SOFTNESS,
  isSoftness
} from './material'
import { HALF_VIEWBOX } from '@/bot/frame'
import { bodyOutline, inflate, reduce, vertices } from './volume'

const VB_TEST = HALF_VIEWBOX

/**
 * Les variantes « 3D flat » : reglages purs (tons, seuils, finesse). Le rendu WebGL se
 * regarde dans `lab.html#shapes3d` ; ici on verrouille ce qui est calculable sous `node`.
 */

describe('liste des matieres', () => {
  it('le defaut est doux marque (choix de design, 03/11), aplat reste dans le code, le realiste reste disponible', () => {
    expect(DEFAULT_MATERIAL).toBe('soft')
    expect(DEFAULT_SOFTNESS).toBe('strong')
    expect(MATERIALS).toEqual(['realistic', 'toon', 'toon-outline', 'lowpoly', 'flat', 'soft', 'pixel'])
    expect(MATERIALS.every(isMaterial)).toBe(true)
    expect(isMaterial('plastic')).toBe(false)
    expect(isFlat('realistic')).toBe(false)
    expect(MATERIALS.filter(isFlat)).toHaveLength(6)
    expect(settingFlat('realistic')).toBeNull()
  })

  it('seul le contour est propre a toon-contour, seul lowpoly a des facettes', () => {
    expect(MATERIALS.filter((r) => settingFlat(r)?.outline)).toEqual(['toon-outline'])
    expect(MATERIALS.filter((r) => settingFlat(r)?.facets)).toEqual(['lowpoly'])
    expect(MATERIALS.filter((r) => meshOf(r) === 'grossier')).toEqual(['lowpoly'])
  })
})

describe('paliers et eclairage', () => {
  it.each(MATERIALS.filter((x) => isFlat(x) && x !== 'soft'))('%s : un ton de plus que de seuils, seuils croissants', (r) => {
    const p = settingFlat(r)!
    expect(p.tones).toHaveLength(p.thresholds.length + 1)
    expect(p.thresholds).toEqual([...p.thresholds].sort((a, b) => a - b))
    // le ton qui occupe le gros de la surface est la couleur du flat, telle quelle
    expect(p.tones).toContain(1)
  })

  it.each(MATERIALS.filter(isFlat))('%s : ambiante + directe * rampe redonne chaque ton', (r) => {
    const p = settingFlat(r)!
    const e = lightingFlat(p)
    p.tones.forEach((ton, i) => {
      expect((e.ambient + e.directe * e.ramp[i]!) / Math.PI).toBeCloseTo(ton, 6)
    })
  })

  it('la rampe echantillonnee monte par marches, de 0 au ton le plus clair (255)', () => {
    for (const r of MATERIALS.filter((x) => isFlat(x) && x !== 'soft')) {
      const g = gradientMap(settingFlat(r)!)
      expect(g).toHaveLength(32)
      expect(g[0]).toBe(0)
      expect(g[31]).toBe(255)
      for (let i = 1; i < g.length; i++) expect(g[i]!).toBeGreaterThanOrEqual(g[i - 1]!)
      // des marches, pas un degrade : au plus un niveau par ton
      expect(new Set(g).size).toBeLessThanOrEqual(settingFlat(r)!.tones.length)
    }
  })

  it("aplat n'a que deux tons ; toon en a trois", () => {
    expect(new Set(gradientMap(settingFlat('flat')!)).size).toBe(2)
    expect(new Set(gradientMap(settingFlat('toon')!)).size).toBe(3)
  })
})

describe('contour cartoon', () => {
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
  it.each(['#f0b429', '#8b5cf6', '#e152b0', '#2fbfa0', '#3b93f0'])('%s : plus fonce, meme teinte, pas noir', (hex) => {
    const c = colorOutline(hex)
    expect(lum(c)).toBeLessThan(lum(hex) * 0.6)
    expect(lum(c)).toBeGreaterThan(20)
    expect(Math.abs(tint(c) - tint(hex))).toBeLessThan(8)
  })
  it("l'epaisseur s'allege en petite taille, avec un plancher et un plafond", () => {
    expect(outlineWidthPx(40)).toBe(1.3)
    expect(outlineWidthPx(100)).toBeLessThan(outlineWidthPx(150))
    expect(outlineWidthPx(5000)).toBe(3.4)
  })
  it("seul aplat a une limite d'ombre organique", () => {
    expect(MATERIALS.filter((r) => settingFlat(r)?.organic)).toEqual(['flat'])
  })
})

describe('maillage grossier (lowpoly)', () => {
  const pts = (id: string) =>
    bodyOutline(
      new BotEngine(RADIUS, 'idle', SHAPES.find((s) => s.id === id)!.radii, null).sample(0.5).bodyPath,
      1
    )

  it.each(['circle', 'star', 'cloud', 'flower', 'drop', 'heart'])('%s : volume ferme, bien moins de sommets', (id) => {
    const p = reduce(pts(id), settingFlat('lowpoly')!.reduction)
    const end = inflate(pts(id), VB_TEST)
    const large = inflate(p, VB_TEST, undefined, finesseOf('lowpoly'))
    expect(large.positions.length / 3).toBe(vertices(p.length, finesseOf('lowpoly').rings))
    expect(large.positions.length).toBeLessThan(end.positions.length / 3)
    // chaque triangle pointe sur un sommet existant
    expect(Math.max(...large.index)).toBeLessThan(large.positions.length / 3)
    expect(large.index.length % 3).toBe(0)
  })

  it('reduire garde au moins trois points et ne change rien pour k = 1', () => {
    const p = pts('circle')
    expect(reduce(p, 1)).toBe(p)
    expect(reduce(p, 2)).toHaveLength(p.length / 2)
    expect(reduce(p.slice(0, 4), 8).length).toBeGreaterThanOrEqual(3)
  })
})

describe('doux : ombrage lisse et mat', () => {
  const ramp = (d: 'light' | 'strong') => Array.from(gradientMap(settingFlat('soft', d)!))

  it('aucun palier : la rampe est continue, croissante, sans saut', () => {
    for (const d of SOFTNESSES) {
      const g = ramp(d)
      expect(g.length).toBeGreaterThanOrEqual(128)
      for (let i = 1; i < g.length; i++) {
        expect(g[i]!).toBeGreaterThanOrEqual(g[i - 1]!)
        expect(g[i]! - g[i - 1]!).toBeLessThanOrEqual(8)
      }
      expect(g[0]).toBe(0)
      expect(g[g.length - 1]).toBe(255)
    }
  })

  it('la couleur de base domine : ton plein du centre jusqu\'au haut gauche', () => {
    const g = ramp('light')
    const dot = (d: number) => g[Math.floor(((d + 1) / 2) * g.length)]!
    expect(dot(0.65)).toBeGreaterThan(240) // face a la camera : lumiere en haut a gauche, devant
    expect(dot(0.9)).toBe(255)
  })

  it('contraste faible, et marque plus sombre que leger ; aucun ton plus clair que la base', () => {
    const l = settingFlat('soft', 'light')!
    const m = settingFlat('soft', 'strong')!
    expect(Math.max(...l.tones)).toBe(1)
    expect(Math.max(...m.tones)).toBe(1)
    expect(Math.min(...m.tones)).toBeLessThan(Math.min(...l.tones))
    expect(Math.min(...m.tones)).toBeGreaterThan(0.5)
    expect(lightingFlat(l).ramp[0]).toBe(0)
  })

  it('une seule matiere : ni facettes, ni contour propre, ni bruit de limite', () => {
    for (const d of SOFTNESSES) {
      const p = settingFlat('soft', d)!
      expect(p.facets || p.outline || p.organic).toBe(false)
      expect(meshOf('soft')).toBe('full')
      expect(isFlat('soft')).toBe(true)
    }
    expect(SOFTNESSES.every(isSoftness)).toBe(true)
    expect(isSoftness('mou')).toBe(false)
    expect(DEFAULT_MATERIAL).toBe('soft')
    expect(DEFAULT_SOFTNESS).toBe('strong')
  })
})

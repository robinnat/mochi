import { describe, expect, it } from 'vitest'
import { BotEngine } from '@/bot/engine'
import { RAYON } from '@/bot/repere'
import { SHAPES } from '@/bot/skins'
import {
  couleurContour,
  epaisseurContourPx,
  eclairagePlat,
  estPlat,
  estRendu3d,
  finesseDe,
  gradientMap,
  maillageDe,
  RENDU_3D_DEFAUT,
  RENDUS_3D,
  reglagePlat,
  DOUCEURS,
  DOUCEUR_DEFAUT,
  estDouceur
} from './rendu3d'
import { DEMI_VIEWBOX } from '@/bot/repere'
import { contourDuCorps, gonfler, reduire, sommets } from './volume'

const VB_TEST = DEMI_VIEWBOX

/**
 * Les variantes « 3D flat » : reglages purs (tons, seuils, finesse). Le rendu WebGL se
 * regarde dans `labo.html#formes3d` ; ici on verrouille ce qui est calculable sous `node`.
 */

describe('liste des matieres', () => {
  it('le defaut est doux marque (choix de design, 03/11), aplat reste dans le code, le realiste reste disponible', () => {
    expect(RENDU_3D_DEFAUT).toBe('doux')
    expect(DOUCEUR_DEFAUT).toBe('marque')
    expect(RENDUS_3D).toEqual(['realiste', 'toon', 'toon-contour', 'lowpoly', 'aplat', 'doux', 'pixel'])
    expect(RENDUS_3D.every(estRendu3d)).toBe(true)
    expect(estRendu3d('plastique')).toBe(false)
    expect(estPlat('realiste')).toBe(false)
    expect(RENDUS_3D.filter(estPlat)).toHaveLength(6)
    expect(reglagePlat('realiste')).toBeNull()
  })

  it('seul le contour est propre a toon-contour, seul lowpoly a des facettes', () => {
    expect(RENDUS_3D.filter((r) => reglagePlat(r)?.contour)).toEqual(['toon-contour'])
    expect(RENDUS_3D.filter((r) => reglagePlat(r)?.facettes)).toEqual(['lowpoly'])
    expect(RENDUS_3D.filter((r) => maillageDe(r) === 'grossier')).toEqual(['lowpoly'])
  })
})

describe('paliers et eclairage', () => {
  it.each(RENDUS_3D.filter((x) => estPlat(x) && x !== 'doux'))('%s : un ton de plus que de seuils, seuils croissants', (r) => {
    const p = reglagePlat(r)!
    expect(p.tons).toHaveLength(p.seuils.length + 1)
    expect(p.seuils).toEqual([...p.seuils].sort((a, b) => a - b))
    // le ton qui occupe le gros de la surface est la couleur du flat, telle quelle
    expect(p.tons).toContain(1)
  })

  it.each(RENDUS_3D.filter(estPlat))('%s : ambiante + directe * rampe redonne chaque ton', (r) => {
    const p = reglagePlat(r)!
    const e = eclairagePlat(p)
    p.tons.forEach((ton, i) => {
      expect((e.ambiante + e.directe * e.rampe[i]!) / Math.PI).toBeCloseTo(ton, 6)
    })
  })

  it('la rampe echantillonnee monte par marches, de 0 au ton le plus clair (255)', () => {
    for (const r of RENDUS_3D.filter((x) => estPlat(x) && x !== 'doux')) {
      const g = gradientMap(reglagePlat(r)!)
      expect(g).toHaveLength(32)
      expect(g[0]).toBe(0)
      expect(g[31]).toBe(255)
      for (let i = 1; i < g.length; i++) expect(g[i]!).toBeGreaterThanOrEqual(g[i - 1]!)
      // des marches, pas un degrade : au plus un niveau par ton
      expect(new Set(g).size).toBeLessThanOrEqual(reglagePlat(r)!.tons.length)
    }
  })

  it("aplat n'a que deux tons ; toon en a trois", () => {
    expect(new Set(gradientMap(reglagePlat('aplat')!)).size).toBe(2)
    expect(new Set(gradientMap(reglagePlat('toon')!)).size).toBe(3)
  })
})

describe('contour cartoon', () => {
  const lum = (c: string) => {
    const v = parseInt(c.slice(1), 16)
    return Math.max((v >> 16) & 255, (v >> 8) & 255, v & 255)
  }
  const teinte = (c: string) => {
    const v = parseInt(c.slice(1), 16)
    const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    const max = Math.max(r, g, b)
    const d = max - Math.min(r, g, b)
    if (!d) return 0
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return h * 60
  }
  it.each(['#f0b429', '#8b5cf6', '#e152b0', '#2fbfa0', '#3b93f0'])('%s : plus fonce, meme teinte, pas noir', (hex) => {
    const c = couleurContour(hex)
    expect(lum(c)).toBeLessThan(lum(hex) * 0.6)
    expect(lum(c)).toBeGreaterThan(20)
    expect(Math.abs(teinte(c) - teinte(hex))).toBeLessThan(8)
  })
  it("l'epaisseur s'allege en petite taille, avec un plancher et un plafond", () => {
    expect(epaisseurContourPx(40)).toBe(1.3)
    expect(epaisseurContourPx(100)).toBeLessThan(epaisseurContourPx(150))
    expect(epaisseurContourPx(5000)).toBe(3.4)
  })
  it("seul aplat a une limite d'ombre organique", () => {
    expect(RENDUS_3D.filter((r) => reglagePlat(r)?.organique)).toEqual(['aplat'])
  })
})

describe('maillage grossier (lowpoly)', () => {
  const pts = (id: string) =>
    contourDuCorps(
      new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === id)!.radii, null).sample(0.5).bodyPath,
      1
    )

  it.each(['cercle', 'etoile', 'nuage', 'fleur', 'goutte', 'coeur'])('%s : volume ferme, bien moins de sommets', (id) => {
    const p = reduire(pts(id), reglagePlat('lowpoly')!.reduction)
    const fin = gonfler(pts(id), VB_TEST)
    const gros = gonfler(p, VB_TEST, undefined, finesseDe('lowpoly'))
    expect(gros.positions.length / 3).toBe(sommets(p.length, finesseDe('lowpoly').anneaux))
    expect(gros.positions.length).toBeLessThan(fin.positions.length / 3)
    // chaque triangle pointe sur un sommet existant
    expect(Math.max(...gros.index)).toBeLessThan(gros.positions.length / 3)
    expect(gros.index.length % 3).toBe(0)
  })

  it('reduire garde au moins trois points et ne change rien pour k = 1', () => {
    const p = pts('cercle')
    expect(reduire(p, 1)).toBe(p)
    expect(reduire(p, 2)).toHaveLength(p.length / 2)
    expect(reduire(p.slice(0, 4), 8).length).toBeGreaterThanOrEqual(3)
  })
})

describe('doux : ombrage lisse et mat', () => {
  const rampe = (d: 'leger' | 'marque') => Array.from(gradientMap(reglagePlat('doux', d)!))

  it('aucun palier : la rampe est continue, croissante, sans saut', () => {
    for (const d of DOUCEURS) {
      const g = rampe(d)
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
    const g = rampe('leger')
    const dot = (d: number) => g[Math.floor(((d + 1) / 2) * g.length)]!
    expect(dot(0.65)).toBeGreaterThan(240) // face a la camera : lumiere en haut a gauche, devant
    expect(dot(0.9)).toBe(255)
  })

  it('contraste faible, et marque plus sombre que leger ; aucun ton plus clair que la base', () => {
    const l = reglagePlat('doux', 'leger')!
    const m = reglagePlat('doux', 'marque')!
    expect(Math.max(...l.tons)).toBe(1)
    expect(Math.max(...m.tons)).toBe(1)
    expect(Math.min(...m.tons)).toBeLessThan(Math.min(...l.tons))
    expect(Math.min(...m.tons)).toBeGreaterThan(0.5)
    expect(eclairagePlat(l).rampe[0]).toBe(0)
  })

  it('une seule matiere : ni facettes, ni contour propre, ni bruit de limite', () => {
    for (const d of DOUCEURS) {
      const p = reglagePlat('doux', d)!
      expect(p.facettes || p.contour || p.organique).toBe(false)
      expect(maillageDe('doux')).toBe('plein')
      expect(estPlat('doux')).toBe(true)
    }
    expect(DOUCEURS.every(estDouceur)).toBe(true)
    expect(estDouceur('mou')).toBe(false)
    expect(RENDU_3D_DEFAUT).toBe('doux')
    expect(DOUCEUR_DEFAUT).toBe('marque')
  })
})

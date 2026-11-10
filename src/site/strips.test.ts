import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACCESSORIES, SLOTS, ACCESSORY_BY_KEY } from '@/bot/slots'
import { contrast } from '@/ui/3d/theme'
import { STRIPS, GAP_MIN, distanceColor, itemPiece, itemsStrip } from './strips'
import { boxOpaque, boxesOpaque, colorForTheme } from './thumbnails'

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')

describe('bandes d accessoires (pieces seules)', () => {
  it('une bande par emplacement du paquet, dans l ordre, et le sens alterne', () => {
    expect(STRIPS.map((b) => b.slot)).toEqual(SLOTS)
    STRIPS.forEach((b, i) => expect(b.direction).toBe(i % 2 === 0 ? 'left' : 'right'))
    for (const b of STRIPS) {
      expect(b.duration).toBeGreaterThan(40)
      expect(b.title.length).toBeGreaterThan(2)
    }
  })

  it.each(SLOTS)('%s : beaucoup de pieces, toutes valides, toutes differentes', (e) => {
    const items = itemsStrip(e)
    expect(items.length).toBeGreaterThanOrEqual(20)
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
    // peu de doublons exacts (accessoire + couleurs) ; un emplacement a un seul accessoire (visage : joues) boucle sur la palette
    expect(new Set(items.map((i) => [i.accessory, i.c1, i.c2].join('|'))).size).toBeGreaterThanOrEqual(8)
    for (const it of items) {
      expect(ACCESSORY_BY_KEY.has(`${e}:${it.accessory}`), it.accessory).toBe(true)
      for (const c of [it.c1, it.c2]) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      expect(Number.isFinite(it.yaw)).toBe(true)
      expect(it.label).not.toMatch(/[—–à-ÿ]/)
      // une piece a deux couleurs a deux couleurs bien distinctes ; sinon une seule
      if (it.c1 !== it.c2) expect(distanceColor(it.c1, it.c2), it.key).toBeGreaterThanOrEqual(GAP_MIN - 1e-9)
    }
  })

  it('beaucoup de variantes de couleurs : chaque accessoire revient dans plusieurs teintes', () => {
    for (const e of SLOTS) {
      const items = itemsStrip(e)
      const byAcc = new Map<string, Set<string>>()
      for (const i of items) byAcc.set(i.accessory, (byAcc.get(i.accessory) ?? new Set()).add(i.c1))
      for (const [acc, c] of byAcc) expect(c.size, `${e}:${acc}`).toBeGreaterThanOrEqual(2)
      expect(new Set(items.map((i) => i.c1)).size, e).toBeGreaterThanOrEqual(8)
    }
  })

  it('les pieces se voient de trois quarts, celles du dos de dos ou de trois quarts arriere', () => {
    for (const e of SLOTS) {
      for (const it of itemsStrip(e)) {
        const a = Math.abs(it.yaw)
        if (e === 'back') expect(a).toBeGreaterThan(Math.PI / 2)
        else expect(a).toBeLessThan(Math.PI / 2)
        if (e === 'head' || e === 'eyes' || e === 'neck') expect(a).toBeGreaterThanOrEqual(0.2)
      }
    }
  })

  it('c est deterministe : memes bandes a chaque visite', () => {
    expect(itemsStrip('neck')).toEqual(itemsStrip('neck'))
  })

  it('aucun corps dans les bandes : le rendu des pieces est demande sans corps, cadre serre et centre', () => {
    const v = source('./thumbnails.ts')
    // rendreAvatar(..., sansCorps = true, centre)
    expect(v).toMatch(/undefined, true, centre\)/)
    expect(v).toContain('boxOpaque')
  })

  it('les bandes defilantes ne sont plus sur la page (06/11/2026) : les pieces sont des images pre-rendues dans le selecteur', () => {
    const site = source('./Site.ts')
    expect(site).not.toMatch(/Habillage|BandeAccessoires/)
    const custom = source('./BodyCustomizer.ts')
    // icones : images pre-rendues (public/rendus), jamais un rendu 3D au chargement ni au changement de theme
    expect(custom).toContain('urlPiece')
    expect(custom).not.toContain('renderThumbnail')
    expect(custom.match(/c\(Vivant/g)).toHaveLength(1)
    // les images sont faites par tools/rendus.ts avec rendreVignette et itemPiece
    const tool = readFileSync(new URL('../../tools/renders.ts', import.meta.url), 'utf8')
    expect(tool).toContain('renderThumbnail')
    expect(tool).toContain('itemPiece')
  })

  it('itemPiece : chaque accessoire du catalogue a son icone, dans ses couleurs, vu de trois quarts', () => {
    for (const a of ACCESSORIES) {
      const it = itemPiece(a.slot, a.id)!
      expect(it, a.id).not.toBeNull()
      expect(it.key).toBe(`${a.slot}:${a.id}`)
      expect([it.c1, it.c2]).toEqual([a.c1, a.c2])
      if (a.slot === 'back') expect(Math.abs(it.yaw)).toBeGreaterThan(Math.PI / 2)
      else expect(Math.abs(it.yaw)).toBeLessThan(Math.PI / 2)
    }
    expect(itemPiece('head', 'unknown')).toBeNull()
  })
})

describe('vignettes : cadrage et couleurs', () => {
  it('boiteOpaque trouve la boite des pixels non transparents, en unites du moteur (y vers le haut)', () => {
    const px = 100
    const d = new Uint8ClampedArray(px * px * 4)
    // un rectangle opaque : x 20..39, y 10..29 (haut de l image)
    for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) d[(y * px + x) * 4 + 3] = 255
    const b = boxOpaque(d, px, 50)!
    expect(b.w).toBeCloseTo(20, 5)
    expect(b.h).toBeCloseTo(20, 5)
    expect(b.cx).toBeCloseTo(30 - 50, 5)
    // le haut de l image est vers y > 0
    expect(b.cy).toBeCloseTo(-(20 - 50), 5)
    expect(boxOpaque(new Uint8ClampedArray(px * px * 4), px, 50)).toBeNull()
  })

  it('boitesOpaques : une branche fine ne decide pas de la taille du coeur de la piece', () => {
    const px = 200
    const d = new Uint8ClampedArray(px * px * 4)
    // une monture 40x40 centree en (100, 100) et une branche d un pixel d epaisseur qui part vers la droite jusqu a x = 190
    for (let y = 80; y < 120; y++) for (let x = 80; x < 120; x++) d[(y * px + x) * 4 + 3] = 255
    for (let x = 120; x < 190; x++) d[(100 * px + x) * 4 + 3] = 255
    const b = boxesOpaque(d, px, 100)!
    expect(b.full.w).toBeCloseTo(110, 5)
    expect(b.heart.w).toBeCloseTo(40, 5)
    expect(b.heart.h).toBeLessThanOrEqual(b.full.h)
    expect(b.heart.cx).toBeCloseTo(0, 5)
  })

  it('en sombre, une piece noire est eclaircie ; en clair, rien ne change', () => {
    expect(colorForTheme('#26222f', 'light')).toBe('#26222f')
    const c = colorForTheme('#26222f', 'dark')
    expect(c).not.toBe('#26222f')
    expect(contrast(c, '#1b1922')).toBeGreaterThan(3)
    expect(colorForTheme('#ffc21a', 'dark')).toBe('#ffc21a')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE, EMPLACEMENTS, PAR_ID } from '@/bot/emplacements'
import { contraste } from '@/ui/trois/theme'
import { BANDES, ECART_MIN, distanceCouleur, itemPiece, itemsBande } from './bandes'
import { boiteOpaque, boitesOpaques, couleurPourTheme } from './vignettes'

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')

describe('bandes d accessoires (pieces seules)', () => {
  it('une bande par emplacement du paquet, dans l ordre, et le sens alterne', () => {
    expect(BANDES.map((b) => b.emplacement)).toEqual(EMPLACEMENTS)
    BANDES.forEach((b, i) => expect(b.sens).toBe(i % 2 === 0 ? 'gauche' : 'droite'))
    for (const b of BANDES) {
      expect(b.duree).toBeGreaterThan(40)
      expect(b.titre.length).toBeGreaterThan(2)
    }
  })

  it.each(EMPLACEMENTS)('%s : beaucoup de pieces, toutes valides, toutes differentes', (e) => {
    const items = itemsBande(e)
    expect(items.length).toBeGreaterThanOrEqual(20)
    expect(new Set(items.map((i) => i.cle)).size).toBe(items.length)
    // aucune piece n est un doublon exact (accessoire + couleurs)
    expect(new Set(items.map((i) => [i.accessoire, i.c1, i.c2].join('|'))).size).toBe(items.length)
    for (const it of items) {
      expect(PAR_ID.has(`${e}:${it.accessoire}`), it.accessoire).toBe(true)
      for (const c of [it.c1, it.c2]) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      expect(Number.isFinite(it.yaw)).toBe(true)
      expect(it.label).not.toMatch(/[—–à-ÿ]/)
      // une piece a deux couleurs a deux couleurs bien distinctes ; sinon une seule
      if (it.c1 !== it.c2) expect(distanceCouleur(it.c1, it.c2), it.cle).toBeGreaterThanOrEqual(ECART_MIN - 1e-9)
    }
  })

  it('beaucoup de variantes de couleurs : chaque accessoire revient dans plusieurs teintes', () => {
    for (const e of EMPLACEMENTS) {
      const items = itemsBande(e)
      const parAcc = new Map<string, Set<string>>()
      for (const i of items) parAcc.set(i.accessoire, (parAcc.get(i.accessoire) ?? new Set()).add(i.c1))
      for (const [acc, c] of parAcc) expect(c.size, `${e}:${acc}`).toBeGreaterThanOrEqual(2)
      expect(new Set(items.map((i) => i.c1)).size, e).toBeGreaterThanOrEqual(8)
    }
  })

  it('les pieces se voient de trois quarts, celles du dos de dos ou de trois quarts arriere', () => {
    for (const e of EMPLACEMENTS) {
      for (const it of itemsBande(e)) {
        const a = Math.abs(it.yaw)
        if (e === 'dos') expect(a).toBeGreaterThan(Math.PI / 2)
        else expect(a).toBeLessThan(Math.PI / 2)
        if (e === 'tete' || e === 'bas') expect(a).toBeGreaterThanOrEqual(0.2)
      }
    }
  })

  it('c est deterministe : memes bandes a chaque visite', () => {
    expect(itemsBande('bas')).toEqual(itemsBande('bas'))
  })

  it('aucun corps dans les bandes : le rendu des pieces est demande sans corps, cadre serre et centre', () => {
    const v = source('./vignettes.ts')
    // rendreAvatar(..., sansCorps = true, centre)
    expect(v).toMatch(/undefined, true, centre\)/)
    expect(v).toContain('boiteOpaque')
  })

  it('les bandes defilantes ne sont plus sur la page (06/11/2026) : les pieces sont des images pre-rendues dans le selecteur', () => {
    const site = source('./Site.vue')
    expect(site).not.toMatch(/Habillage|BandeAccessoires/)
    const perso = source('./PersoCorps.vue')
    // icones : images pre-rendues (public/rendus), jamais un rendu 3D au chargement ni au changement de theme
    expect(perso).toContain('urlPiece')
    expect(perso).not.toContain('rendreVignette')
    expect(perso.match(/<Vivant/g)).toHaveLength(1)
    // les images sont faites par tools/rendus.ts avec rendreVignette et itemPiece
    const outil = readFileSync(new URL('../../tools/rendus.ts', import.meta.url), 'utf8')
    expect(outil).toContain('rendreVignette')
    expect(outil).toContain('itemPiece')
  })

  it('itemPiece : chaque accessoire du catalogue a son icone, dans ses couleurs, vue de trois quarts', () => {
    for (const a of CATALOGUE) {
      const it = itemPiece(a.emplacement, a.id)!
      expect(it, a.id).not.toBeNull()
      expect(it.cle).toBe(`${a.emplacement}:${a.id}`)
      expect([it.c1, it.c2]).toEqual([a.c1, a.c2])
      if (a.emplacement === 'dos') expect(Math.abs(it.yaw)).toBeGreaterThan(Math.PI / 2)
      else expect(Math.abs(it.yaw)).toBeLessThan(Math.PI / 2)
    }
    expect(itemPiece('tete', 'inconnu')).toBeNull()
  })
})

describe('vignettes : cadrage et couleurs', () => {
  it('boiteOpaque trouve la boite des pixels non transparents, en unites du moteur (y vers le haut)', () => {
    const px = 100
    const d = new Uint8ClampedArray(px * px * 4)
    // un rectangle opaque : x 20..39, y 10..29 (haut de l image)
    for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) d[(y * px + x) * 4 + 3] = 255
    const b = boiteOpaque(d, px, 50)!
    expect(b.w).toBeCloseTo(20, 5)
    expect(b.h).toBeCloseTo(20, 5)
    expect(b.cx).toBeCloseTo(30 - 50, 5)
    // le haut de l image est vers y > 0
    expect(b.cy).toBeCloseTo(-(20 - 50), 5)
    expect(boiteOpaque(new Uint8ClampedArray(px * px * 4), px, 50)).toBeNull()
  })

  it('boitesOpaques : une branche fine ne decide pas de la taille du coeur de la piece', () => {
    const px = 200
    const d = new Uint8ClampedArray(px * px * 4)
    // une monture 40x40 centree en (100, 100) et une branche d un pixel d epaisseur qui part vers la droite jusqu a x = 190
    for (let y = 80; y < 120; y++) for (let x = 80; x < 120; x++) d[(y * px + x) * 4 + 3] = 255
    for (let x = 120; x < 190; x++) d[(100 * px + x) * 4 + 3] = 255
    const b = boitesOpaques(d, px, 100)!
    expect(b.pleine.w).toBeCloseTo(110, 5)
    expect(b.coeur.w).toBeCloseTo(40, 5)
    expect(b.coeur.h).toBeLessThanOrEqual(b.pleine.h)
    expect(b.coeur.cx).toBeCloseTo(0, 5)
  })

  it('en sombre, une piece noire est eclaircie ; en clair, rien ne change', () => {
    expect(couleurPourTheme('#26222f', 'light')).toBe('#26222f')
    const c = couleurPourTheme('#26222f', 'dark')
    expect(c).not.toBe('#26222f')
    expect(contraste(c, '#1b1922')).toBeGreaterThan(3)
    expect(couleurPourTheme('#f2b83d', 'dark')).toBe('#f2b83d')
  })
})

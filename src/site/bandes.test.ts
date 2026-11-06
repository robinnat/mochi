import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EMPLACEMENTS, PAR_ID } from '@/bot/emplacements'
import { MOOD_IDS } from '@/bot/humeurs'
import { SHAPE_BY_ID } from '@/bot/skins'
import { BANDES, ECART_MIN, distanceCouleur, itemsBande } from './bandes'

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')

describe('bandes d accessoires', () => {
  it('une bande par emplacement du paquet, dans l ordre, et le sens alterne', () => {
    expect(BANDES.map((b) => b.emplacement)).toEqual(EMPLACEMENTS)
    BANDES.forEach((b, i) => expect(b.sens).toBe(i % 2 === 0 ? 'gauche' : 'droite'))
    for (const b of BANDES) {
      expect(b.duree).toBeGreaterThan(20)
      expect(b.titre.length).toBeGreaterThan(2)
    }
  })

  it.each(EMPLACEMENTS)('%s : beaucoup de variantes, toutes valides et toutes differentes', (e) => {
    const items = itemsBande(e)
    expect(items.length).toBeGreaterThanOrEqual(12)
    expect(new Set(items.map((i) => i.cle)).size).toBe(items.length)
    // aucune variante n est un doublon exact (accessoire, couleurs, forme)
    expect(new Set(items.map((i) => [i.accessoire, i.forme, i.corps, i.c1, i.c2].join('|'))).size).toBe(items.length)
    for (const it of items) {
      expect(PAR_ID.has(`${e}:${it.accessoire}`), it.accessoire).toBe(true)
      expect(SHAPE_BY_ID.has(it.forme), it.forme).toBe(true)
      expect(MOOD_IDS).toContain(it.mood)
      for (const c of [it.corps, it.c1, it.c2]) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      // l accessoire tranche toujours sur le corps
      expect(distanceCouleur(it.c1, it.corps), it.cle).toBeGreaterThanOrEqual(ECART_MIN)
      expect(distanceCouleur(it.c2, it.corps), it.cle).toBeGreaterThanOrEqual(ECART_MIN)
      expect(it.label).not.toMatch(/[—–à-ÿ]/)
    }
  })

  it('formes, couleurs de corps et accessoires varient d une bande a l autre', () => {
    for (const e of EMPLACEMENTS) {
      const items = itemsBande(e)
      expect(new Set(items.map((i) => i.forme)).size, e).toBeGreaterThanOrEqual(10)
      expect(new Set(items.map((i) => i.corps)).size, e).toBeGreaterThanOrEqual(12)
    }
    expect(new Set(itemsBande('tete').map((i) => i.accessoire)).size).toBe(10)
    expect(JSON.stringify(itemsBande('tete'))).not.toBe(JSON.stringify(itemsBande('yeux')))
  })

  it('c est deterministe : memes bandes a chaque visite', () => {
    expect(itemsBande('bas')).toEqual(itemsBande('bas'))
  })

  it('le defilement est du CSS pur : transform, pause au survol, figee avec prefers-reduced-motion', () => {
    const vue = source('./BandeAccessoires.vue')
    expect(vue).toContain('translate3d(-50%')
    expect(vue).toMatch(/animation:\s*defile/)
    expect(vue).toContain('animation-direction: reverse')
    expect(vue).toContain('animation-play-state: paused')
    expect(vue).toContain('prefers-reduced-motion: reduce')
    // pas de rendu 3D en direct ni de boucle JS pendant le defilement : des images pre-rendues
    expect(vue).not.toContain('MochiBot')
    expect(vue).not.toMatch(/setInterval|setTimeout/)
    expect(vue).not.toMatch(/\b(left|margin-left):\s*-?\d+px[^;]*;\s*\n[^}]*transition/)
  })
})

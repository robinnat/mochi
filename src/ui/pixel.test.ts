import { describe, expect, it } from 'vitest'
import { DEMI_VIEWBOX } from '@/bot/repere'
import {
  aplatsPixel,
  cheminDesCases,
  PALETTE,
  teintesPixel,
  versPalette,
  type CouchesPixel
} from './pixel'

/**
 * Le pixel art : la partie PURE, celle qui decide de la couleur de chaque case a partir
 * des couches rasterisees. La rasterisation elle-meme a besoin d'un canvas et vit a cote ;
 * ici on lui substitue des couches fabriquees a la main, ce qui permet de verifier le
 * contour, l'ombrage et les yeux sans navigateur.
 */

const ENCRE = '#e8483f'
const PAPIER = '#f9f9f9'

const rgb = (h: string) => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const
}

/**
 * Une boule de rayon `r` cases au centre d'une grille `g`, avec un oeil carre de 2x2 cases
 * au-dessus du centre. Les trois couches sont coherentes entre elles, comme celles que
 * produit le canvas.
 */
function boule(g: number, r: number, avecOeil = true): CouchesPixel {
  const rendu = new Uint8ClampedArray(g * g * 4)
  const silhouette = new Uint8ClampedArray(g * g * 4)
  const corps = new Uint8ClampedArray(g * g * 4)
  const c = (g - 1) / 2
  const [er, eg, eb] = rgb(ENCRE)
  const [pr, pg, pb] = rgb(PAPIER)
  for (let y = 0; y < g; y++) {
    for (let x = 0; x < g; x++) {
      const i = (y * g + x) * 4
      if (Math.hypot(x - c, y - c) > r) continue
      silhouette[i + 3] = 255
      const oeil = avecOeil && x >= c - 1 && x <= c && y >= c - 3 && y <= c - 2
      rendu.set(oeil ? [pr, pg, pb, 255] : [er, eg, eb, 255], i)
      if (!oeil) corps[i + 3] = 255
    }
  }
  return { g, rendu, silhouette, corps }
}

/** Couleur de la case (x, y) dans les aplats, ou null si elle est vide. */
function caseA(aplats: { fill: string; cases: number[] }[], g: number, x: number, y: number) {
  return aplats.find((a) => a.cases.includes(y * g + x))?.fill ?? null
}

describe('palette', () => {
  it('ramene une couleur etrangere a la palette PICO-8', () => {
    expect(PALETTE).toHaveLength(16)
    expect(versPalette(36, 150, 232)).toBe('#29adff')
    expect(versPalette(250, 10, 70)).toBe('#ff004d')
    expect(PALETTE).toContain(versPalette(123, 200, 17))
  })

  it("derive le contour et les deux tons de l'ombrage de la couleur choisie", () => {
    const t = teintesPixel(ENCRE)
    expect(t.base).toBe(ENCRE)
    expect(new Set([t.clair, t.base, t.ombre, t.contour]).size).toBe(4)
  })
})

describe('classement des cases', () => {
  const g = 21
  const couches = boule(g, 7)
  const aplats = aplatsPixel(couches, ENCRE, PAPIER)
  const t = teintesPixel(ENCRE)

  it('peint le corps de la couleur choisie', () => {
    expect(caseA(aplats, g, 10, 10)).toBe(t.base)
  })

  it("laisse les yeux en papier, comme l'original qui les remplit du fond", () => {
    expect(caseA(aplats, g, 9, 7)).toBe(PAPIER)
    expect(caseA(aplats, g, 10, 8)).toBe(PAPIER)
  })

  it("entoure la silhouette d'un contour d'une case, et rien au-dela", () => {
    // juste a droite du bord, sur l'horizontale du centre ; (17, 10) est le point le plus a
    // droite du disque, une excroissance d'une case, donc retire au profit du contour
    expect(caseA(aplats, g, 16, 10)).toBe(t.ombre)
    expect(caseA(aplats, g, 17, 10)).toBe(t.contour)
    expect(caseA(aplats, g, 18, 10)).toBe(null)
    expect(caseA(aplats, g, 0, 0)).toBe(null)
  })

  it("ombre le bas a droite et eclaire le haut a gauche (lumiere en haut a gauche)", () => {
    expect(caseA(aplats, g, 14, 14)).toBe(t.ombre)
    expect(caseA(aplats, g, 6, 6)).toBe(t.clair)
  })

  it('garde a part une couleur etrangere au corps (anneau, pastille)', () => {
    const c = boule(g, 7, false)
    // une case bleue posee sur le corps : la pastille de notification
    c.rendu.set([36, 150, 232, 255], (10 * g + 12) * 4)
    const a = aplatsPixel(c, ENCRE, PAPIER)
    expect(caseA(a, g, 12, 10)).toBe('#29adff')
  })

  it('ne dessine rien quand le corps a disparu', () => {
    const vide: CouchesPixel = {
      g,
      rendu: new Uint8ClampedArray(g * g * 4),
      silhouette: new Uint8ClampedArray(g * g * 4),
      corps: new Uint8ClampedArray(g * g * 4)
    }
    expect(aplatsPixel(vide, ENCRE, PAPIER)).toEqual([])
  })

  it("donne le ton du corps et un contour a un point de sa couleur pose a cote", () => {
    const c = boule(g, 5, false)
    // le point du « ! » : une case a l'encre, hors de la silhouette
    c.rendu.set([...rgb(ENCRE), 255], (2 * g + 2) * 4)
    const a = aplatsPixel(c, ENCRE, PAPIER)
    expect(caseA(a, g, 2, 2)).toBe(t.base)
    expect(caseA(a, g, 1, 2)).toBe(t.contour)
  })

  it("garde un trait fin etranger meme a moitie couvert (anneau)", () => {
    const c = boule(g, 5, false)
    c.rendu.set([200, 80, 160, 90], (1 * g + 15) * 4)
    expect(caseA(aplatsPixel(c, ENCRE, PAPIER), g, 15, 1)).not.toBe(null)
  })

  it("retire une excroissance d'une case, qui ferait une pointe au sommet", () => {
    const c = boule(g, 5, false)
    // une case isolee collee au haut de la boule (10, 4) : silhouette et rendu
    const k = (4 * g + 10) * 4
    c.silhouette[k + 3] = 255
    c.corps[k + 3] = 255
    c.rendu.set([...rgb(ENCRE), 255], k)
    const a = aplatsPixel(c, ENCRE, PAPIER)
    expect(caseA(a, g, 10, 4)).toBe(t.contour)
    expect(caseA(a, g, 10, 3)).toBe(null)
  })

  it('couvre chaque case une fois au plus', () => {
    const toutes = aplats.flatMap((a) => a.cases)
    expect(new Set(toutes).size).toBe(toutes.length)
  })
})

describe('trace des cases', () => {
  it('fusionne les cases voisines d\'une ligne en un seul rectangle', () => {
    const g = 10
    const d = cheminDesCases([22, 23, 24, 27], g)
    // deux segments sur la ligne 2 : colonnes 2 a 4, puis 7
    expect(d.match(/M/g)!.length).toBe(2)
  })

  it('pose les cases dans le repere du viewBox', () => {
    const g = 4
    const cote = (DEMI_VIEWBOX * 2) / g
    const d = cheminDesCases([0], g)
    expect(d).toBe(`M${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX}h${cote}v${cote}h${-cote}z`)
  })
})

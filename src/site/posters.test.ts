import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACCESSORIES, ACCESSORY_BY_KEY } from 'mochis/catalogue'
import { POSTERS, SCROLL, PIECES, urlPoster, urlPiece } from './posters'

const publicDir = new URL('../../public', import.meta.url)
const exists = (url: string) => existsSync(new URL('.' + url, publicDir + '/'))
const folder = new URL('./', import.meta.url)
// les composants du site : un fichier .ts par section, nomme en majuscule
const pages = readdirSync(folder).filter((f) => /^[A-Z].*\.ts$/.test(f))
const read = (f: string) => readFileSync(new URL(f, folder), 'utf8')

describe('images pre-rendues (v11)', () => {
  it('chaque affiche et chaque piece a son image, en clair et en sombre', () => {
    for (const t of ['light', 'dark'] as const) {
      for (const a of POSTERS) expect(exists(urlPoster(a.name, t)), urlPoster(a.name, t)).toBe(true)
      for (const p of PIECES) expect(exists(urlPiece(p.slot, p.id, t)), urlPiece(p.slot, p.id, t)).toBe(true)
    }
  })

  it('les anciennes sections ne sont plus dans la page', () => {
    expect(read('Site.ts')).not.toMatch(/Faces|Gestes|Metiers/)
  })

  it('les noms sont uniques', () => {
    expect(new Set(POSTERS.map((a) => a.name)).size).toBe(POSTERS.length)
  })

  it('aucune section du site ne monte <mochi-bot> directement : images ou Vivant (affiche puis 3D en fondu, jamais de 2D)', () => {
    for (const f of pages) {
      if (f === 'Vivant.ts') continue
      expect(read(f), f).not.toMatch(/'mochi-bot'/)
      expect(read(f), f).not.toMatch(/^import [^\n]*components\/mochi-bot/m)
    }
    const v = read('Vivant.ts')
    // le composant arrive par l'entree publique du paquet, comme chez un utilisateur
    expect(v).toContain("import('mochis')")
    expect(v).toContain('onPret: surPret')
    expect(v).toContain('IntersectionObserver')
  })

  it('les affiches utilisees par les pages existent dans le manifeste', () => {
    const names = new Set(POSTERS.map((a) => a.name))
    const everything = pages.map(read).join('\n') + readFileSync(new URL('../docs/Docs.ts', import.meta.url), 'utf8')
    let seen = 0
    for (const m of everything.matchAll(/affiche: (?:[^,\n]*\? )?'([a-z-]+)'/g)) {
      seen++
      const n = m[1]!
      expect(names.has(n), n).toBe(true)
    }
    expect(seen).toBeGreaterThanOrEqual(2)
  })

  it('la carte des accessoires defile sur tout le catalogue (sans les quatre retires), compteur lu dans le catalogue, immobile si mouvement reduit', () => {
    const seen = new Set<string>()
    for (const d of SCROLL) {
      for (const [e, ch] of Object.entries(d.variant.acc)) {
        const id = typeof ch === 'string' ? ch : ch!.id
        expect(ACCESSORY_BY_KEY.has(`${e}:${id}`), `${e}:${id}`).toBe(true)
        seen.add(`${e}:${id}`)
      }
    }
    expect(seen.size).toBe(ACCESSORIES.length)
    expect(SCROLL.length).toBeGreaterThanOrEqual(20)
    expect(SCROLL.length).toBeLessThanOrEqual(30)
    expect(new Set(POSTERS.map((a) => a.name))).toContain(SCROLL[0]!.name)
    const bento = read('Bento.ts')
    expect(bento).toContain('CATALOGUE.length')
    expect(bento).toContain('c(AccDefile')
    const d = read('AccDefile.ts')
    expect(d).toContain('useReduced')
    expect(d).toMatch(/reduit\.value \? 0/)
    expect(d).not.toMatch(/import .*three|mochi-bot/)
  })
})

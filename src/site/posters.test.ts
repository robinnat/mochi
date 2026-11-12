import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACCESSORIES, ACCESSORY_BY_KEY } from 'mochiz-world/catalog'
import { POSTERS, SCROLL, PIECES, urlPoster, urlPiece } from './posters'

const publicDir = new URL('../../public', import.meta.url)
const exists = (url: string) => existsSync(new URL('.' + url, publicDir + '/'))
const folder = new URL('./', import.meta.url)
// the site components: one .ts file per section, named with a capital
const pages = readdirSync(folder).filter((f) => /^[A-Z].*\.ts$/.test(f))
const read = (f: string) => readFileSync(new URL(f, folder), 'utf8')

describe('images pre-rendues (v11)', () => {
  it('each poster and each piece has its image, in light and in dark', () => {
    for (const t of ['light', 'dark'] as const) {
      for (const a of POSTERS) expect(exists(urlPoster(a.name, t)), urlPoster(a.name, t)).toBe(true)
      for (const p of PIECES) expect(exists(urlPiece(p.slot, p.id, t)), urlPiece(p.slot, p.id, t)).toBe(true)
    }
  })

  it('the old sections are no longer in the page', () => {
    expect(read('Site.ts')).not.toMatch(/Faces|Gestes|Metiers/)
  })

  it('names are unique', () => {
    expect(new Set(POSTERS.map((a) => a.name)).size).toBe(POSTERS.length)
  })

  it('no site section mounts <mochi-bot> directly: images or Alive (poster then 3D fading in, never 2D)', () => {
    for (const f of pages) {
      if (f === 'Alive.ts') continue
      expect(read(f), f).not.toMatch(/'mochi-bot'/)
      expect(read(f), f).not.toMatch(/^import [^\n]*components\/mochi-bot/m)
    }
    const v = read('Alive.ts')
    // the component arrives through the package's public entry, as for a user
    expect(v).toContain("import('mochiz-world')")
    expect(v).toContain('onReady: whenReady')
    expect(v).toContain('IntersectionObserver')
  })

  it('the posters used by the pages exist in the manifest', () => {
    const names = new Set(POSTERS.map((a) => a.name))
    const everything = pages.map(read).join('\n') + readFileSync(new URL('../docs/Docs.ts', import.meta.url), 'utf8')
    let seen = 0
    for (const m of everything.matchAll(/poster: (?:[^,\n]*\? )?'([a-z-]+)'/g)) {
      seen++
      const n = m[1]!
      expect(names.has(n), n).toBe(true)
    }
    expect(seen).toBeGreaterThanOrEqual(2)
  })

  it('the accessories card scrolls through the whole catalog (without the four removed), counter read from the catalog, still with reduced motion', () => {
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
    expect(bento).toContain('ACCESSORIES.length')
    expect(bento).toContain('c(AccessoryScroller')
    const d = read('AccessoryScroller.ts')
    expect(d).toContain('useReduced')
    expect(d).toMatch(/reduced\.value \? 0/)
    expect(d).not.toMatch(/import .*three|mochi-bot/)
  })
})

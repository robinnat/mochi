import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FIGURES } from './catalog'
import { ACCESSORIES } from '@/bot/slots'
import { MOOD_IDS } from '@/bot/moods'
import { SHAPES } from '@/bot/skins'

const folder = new URL('./', import.meta.url)
const pages = readdirSync(folder).filter((f) => /^[A-Z].*\.ts$/.test(f))
const read = (f: string) => readFileSync(new URL(f, folder), 'utf8')

describe('site v10', () => {
  it('no em dash or en dash in the pages', () => {
    for (const f of [...pages, 'catalog.ts']) expect(read(f), f).not.toMatch(/[\u2014\u2013]/)
  })

  it('the hero figures come from the catalogs', () => {
    const v = Object.fromEntries(FIGURES.map((c) => [c.label, c.value]))
    expect(v.shapes).toBe(SHAPES.length)
    expect(v.moods).toBe(MOOD_IDS.length)
    expect(v.accessories).toBe(ACCESSORIES.length)
    expect(v['3D styles']).toBe(3)
  })

  it('motion goes through transform/opacity and respects prefers-reduced-motion', () => {
    const css = read('site.css')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    // no animation of properties that force layout
    for (const k of css.matchAll(/@keyframes [a-z]+ \{([\s\S]*?)\n\}/g)) expect(k[1]!, k[0].slice(0, 30)).not.toMatch(/\b(top|left|width|height|margin|padding):/)
    const motion = read('motion.ts')
    expect(motion).toContain('IntersectionObserver')
    expect(motion).toContain('prefers-reduced-motion')
  })

  it('three and the 3D stay dynamic imports in the site', () => {
    for (const f of readdirSync(folder).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
      expect(read(f), f).not.toMatch(/^import (?!type )[^\n]*from '(three|@\/ui\/trois\/(scene3d|iso))'/m)
    }
  })

  it('npm install is never presented as available on the site', () => {
    for (const f of pages) {
      const t = read(f)
      if (t.includes('npm install mochiz')) expect(t, f).toMatch(/coming soon/i)
    }
    expect(read('DocsTeaser.ts')).toMatch(/coming\s+soon/)
  })
})

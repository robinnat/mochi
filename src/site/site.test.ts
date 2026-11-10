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
  it('none tiret cadratin ni demi-cadratin dans les pages', () => {
    for (const f of [...pages, 'catalog.ts']) expect(read(f), f).not.toMatch(/[\u2014\u2013]/)
  })

  it('les figures du hero viennent des catalogues', () => {
    const v = Object.fromEntries(FIGURES.map((c) => [c.label, c.value]))
    expect(v.shapes).toBe(SHAPES.length)
    expect(v.moods).toBe(MOOD_IDS.length)
    expect(v.accessories).toBe(ACCESSORIES.length)
    expect(v['3D styles']).toBe(3)
  })

  it('les mouvements passent par transform/opacity et respectent prefers-reduced-motion', () => {
    const css = read('site.css')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    // aucune animation de proprietes qui forcent la mise en page
    for (const k of css.matchAll(/@keyframes [a-z]+ \{([\s\S]*?)\n\}/g)) expect(k[1]!, k[0].slice(0, 30)).not.toMatch(/\b(top|left|width|height|margin|padding):/)
    const motion = read('motion.ts')
    expect(motion).toContain('IntersectionObserver')
    expect(motion).toContain('prefers-reduced-motion')
  })

  it('three et la 3D restent des imports dynamiques dans le site', () => {
    for (const f of readdirSync(folder).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
      expect(read(f), f).not.toMatch(/^import (?!type )[^\n]*from '(three|@\/ui\/trois\/(scene3d|iso))'/m)
    }
  })

  it('le npm install n est jamais presente comme disponible sur le site', () => {
    for (const f of pages) {
      const t = read(f)
      if (t.includes('npm install mochis')) expect(t, f).toMatch(/coming soon/i)
    }
    expect(read('DocsTeaser.ts')).toMatch(/coming\s+soon/)
  })
})

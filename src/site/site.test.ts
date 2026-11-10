import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CHIFFRES } from './catalog'
import { CATALOGUE } from '@/bot/emplacements'
import { MOOD_IDS } from '@/bot/humeurs'
import { SHAPES } from '@/bot/skins'

const dossier = new URL('./', import.meta.url)
const vues = readdirSync(dossier).filter((f) => f.endsWith('.vue'))
const lire = (f: string) => readFileSync(new URL(f, dossier), 'utf8')

describe('site v10', () => {
  it('aucun tiret cadratin ni demi-cadratin dans les pages', () => {
    for (const f of [...vues, 'catalog.ts']) expect(lire(f), f).not.toMatch(/[\u2014\u2013]/)
  })

  it('les chiffres du hero viennent des catalogues', () => {
    const v = Object.fromEntries(CHIFFRES.map((c) => [c.label, c.valeur]))
    expect(v.shapes).toBe(SHAPES.length)
    expect(v.moods).toBe(MOOD_IDS.length)
    expect(v.accessories).toBe(CATALOGUE.length)
    expect(v['3D styles']).toBe(3)
  })

  it('les mouvements passent par transform/opacity et respectent prefers-reduced-motion', () => {
    const css = lire('site.css')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    // aucune animation de proprietes qui forcent la mise en page
    for (const k of css.matchAll(/@keyframes [a-z]+ \{([\s\S]*?)\n\}/g)) expect(k[1]!, k[0].slice(0, 30)).not.toMatch(/\b(top|left|width|height|margin|padding):/)
    const motion = lire('motion.ts')
    expect(motion).toContain('IntersectionObserver')
    expect(motion).toContain('prefers-reduced-motion')
  })

  it('three et la 3D restent des imports dynamiques dans le site', () => {
    for (const f of [...vues, ...readdirSync(dossier).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))]) {
      expect(lire(f), f).not.toMatch(/^import (?!type )[^\n]*from '(three|@\/ui\/trois\/(scene3d|iso))'/m)
    }
  })

  it('le npm install n est jamais presente comme disponible sur le site', () => {
    for (const f of vues) {
      const t = lire(f)
      if (t.includes('npm install mochi-bots')) expect(t, f).toMatch(/coming soon/i)
    }
    expect(lire('DocsTeaser.vue')).toMatch(/coming\s+soon/)
  })
})

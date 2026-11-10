import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACCESSORIES, SLOTS, ACCESSORY_BY_KEY, type Slot } from '@/bot/slots'
import { MOOD_IDS, REACTION_IDS, resolveMood } from '@/bot/moods'
import { COLOR_BY_ID, SHAPE_BY_ID, isValidHex } from '@/bot/skins'
import { RENDER_STYLES, PIXEL_SIZES } from '@/ui/renderStyle'
import { MochiBotElement, PROPERTIES, attributeOf } from '@/components/mochi-bot'
import * as EX from './examples'
import { MOOD_ALIASES, REACTIONS_DOC } from './catalogs'

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
const component = source('../components/mochi-bot.ts')
const NAMES = new Set(PROPERTIES.map((p) => p.name))
const ATTRIBUTES = new Set(PROPERTIES.filter((p) => !p.withoutAttribute).map((p) => attributeOf(p.name)))
const allExamples = Object.entries(EX)
  .filter(([, v]) => typeof v === 'string')
  .map(([k, v]) => [k, v as string] as const)

describe('docs : tout vient de la vraie API', () => {
  it('chaque option du tableau est declaree par <mochi-bot>, avec son nom d attribut', () => {
    for (const p of EX.PROPS) {
      expect(NAMES.has(p.name as never), p.name).toBe(true)
      expect(p.attr).toBe(attributeOf(p.name))
      expect(ATTRIBUTES.has(p.attr), p.attr).toBe(true)
    }
    expect(new Set(EX.PROPS.map((p) => p.name)).size).toBe(EX.PROPS.length)
  })

  it('chaque methode documentee existe sur l element', () => {
    for (const m of EX.METHODS) {
      expect(typeof (MochiBotElement.prototype as unknown as Record<string, unknown>)[m.name], m.name).toBe('function')
      expect(m.signature.startsWith(m.name + '(')).toBe(true)
    }
  })

  it('chaque evenement documente est bien emis par le composant', () => {
    for (const e of EX.EVENTS) expect(component, e.name).toMatch(new RegExp(`'${e.name}'`))
  })

  it('les attributs ecrits dans les exemples HTML sont des options reelles', () => {
    const seen = new Set<string>()
    for (const [, code] of allExamples) {
      for (const tag of code.matchAll(/<mochi-bot\b([^>]*)>/g)) {
        for (const m of tag[1]!.matchAll(/(?:^|\s)([a-z][a-z-]*)(?==|\s|$)/g)) seen.add(m[1]!)
      }
    }
    expect(seen.size).toBeGreaterThan(10)
    for (const a of seen) {
      // `id` et les gestionnaires d'evenement (`onpret` en React) ne sont pas des options
      if (a === 'id' || a.startsWith('on')) continue
      expect(ATTRIBUTES.has(a), a).toBe(true)
    }
  })

  it('les ids des exemples existent : formes, couleurs, styles, humeurs, pixels', () => {
    for (const [name, code] of allExamples) {
      for (const m of code.matchAll(/(?<![\w-])shape="([^"]+)"/g)) expect(SHAPE_BY_ID.has(m[1]!), `${name}: ${m[1]}`).toBe(true)
      for (const m of code.matchAll(/(?<![\w-])color="([^"]+)"/g)) expect(COLOR_BY_ID.has(m[1]!) || isValidHex(m[1]!) !== null, `${name}: ${m[1]}`).toBe(true)
      for (const m of code.matchAll(/(?<![\w-])rendu="([^"]+)"/g)) expect(RENDER_STYLES as string[], `${name}: ${m[1]}`).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![\w-])mood="([^"]+)"/g)) expect(resolveMood(m[1]!), `${name}: ${m[1]}`).not.toBeNull()
      for (const m of code.matchAll(/setMood\('([^']+)'\)/g)) expect(resolveMood(m[1]!)).not.toBeNull()
      for (const m of code.matchAll(/'mood', '([^']+)'/g)) expect(resolveMood(m[1]!)).not.toBeNull()
      for (const m of code.matchAll(/react\('([^']+)'\)/g)) expect(REACTION_IDS as string[]).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![\w-])pixel="([^"]+)"/g)) expect(PIXEL_SIZES.map((p) => p.id) as string[]).toContain(m[1]!)
    }
  })

  it('les accessoires des exemples sont au catalogue, dans le bon emplacement, et les couleurs sont des hex', () => {
    let seen = 0
    for (const [, code] of allExamples) {
      for (const m of code.matchAll(/\b"?(tete|yeux|visage|bas|dos)"?:\s*(?:"([a-z-]+)"|'([a-z-]+)'|\{\s*id:\s*'([a-z-]+)'([^}]*)\})/g)) {
        const e = m[1] as Slot
        const id = m[2] ?? m[3] ?? m[4]!
        expect(ACCESSORY_BY_KEY.has(`${e}:${id}`), `${e}:${id}`).toBe(true)
        for (const c of (m[5] ?? '').matchAll(/c[12]:\s*'([^']+)'/g)) expect(isValidHex(c[1]!), c[1]).not.toBeNull()
        seen++
      }
    }
    expect(seen).toBeGreaterThanOrEqual(5)
  })

  it('l attribut accessoires de l exemple est du JSON valide', () => {
    const m = EX.EX_ACCESSORIES.match(/accessoires='([^']+)'/)!
    expect(() => JSON.parse(m[1]!)).not.toThrow()
  })

  it('les alias anglais des humeurs sont bien acceptes par le moteur', () => {
    expect(Object.keys(MOOD_ALIASES).sort()).toEqual([...MOOD_IDS].sort())
    for (const [id, alias] of Object.entries(MOOD_ALIASES)) for (const a of alias) expect(resolveMood(a), a).toBe(id)
    expect(Object.keys(REACTIONS_DOC).sort()).toEqual([...REACTION_IDS].sort())
  })

  it('aucun npm install presente comme disponible : le paquet n est pas publie', () => {
    const docs = source('./Docs.ts')
    expect(docs).toContain('coming soon')
    expect(docs).toMatch(/does not work today/)
    expect(EX.INSTALL_REPO).not.toContain('mochi-world')
    expect(EX.INSTALL_NPM).toBe('npm install mochi-world')
    expect(EX.INSTALL_REPO).toContain('git clone https://github.com/robinnat/mochi.git')
    expect(EX.INSTALL_REPO).toContain('build:lib')
    // le script et sa configuration existent bien dans le depot
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    expect(pkg.scripts['build:lib']).toContain('vite.lib.config.ts')
    expect(() => readFileSync(new URL('../../vite.lib.config.ts', import.meta.url))).not.toThrow()
    expect(() => readFileSync(new URL('../index.ts', import.meta.url))).not.toThrow()
  })

  it('le sommaire pointe vers des sections qui existent, et les textes n ont pas de tiret cadratin', () => {
    const docs = source('./Docs.ts')
    for (const s of EX.TOC) expect(docs, s.id).toMatch(new RegExp(`section\\(\\s*'${s.id}'`))
    const everything = [docs, ...allExamples.map(([, v]) => v), ...EX.PROPS.map((p) => p.text), ...EX.METHODS.map((m) => m.text)].join('\n')
    expect(everything).not.toMatch(/[—–]/)
  })

  it('les emplacements et le nombre d accessoires du catalogue sont ceux du moteur', () => {
    expect(SLOTS).toHaveLength(4)
    expect(ACCESSORIES.length).toBeGreaterThan(20)
  })
})

describe('docs : le code montre est celui qui tourne', () => {
  it('chaque resultat alive de la page insere les balises de l exemple poster juste au-dessus', async () => {
    const { tagsOf } = await import('./preview')
    const docs = source('./Docs.ts')
    const previews = [...docs.matchAll(/c\(Apercu, \{ exemple: (\w+)/g)].map((m) => m[1]!)
    expect(previews.length).toBeGreaterThanOrEqual(5)
    for (const name of previews) {
      expect(docs, name).toContain(`block(${name},`)
      const ex = (EX as Record<string, unknown>)[name] as string
      const tags = tagsOf(ex)
      expect(tags.length, name).toBeGreaterThan(0)
      for (const b of tags) expect(ex, name).toContain(b)
    }
  })

  it('les noms importes dans les exemples existent dans les entrees publiques', async () => {
    const complet = (await import('mochi-world')) as Record<string, unknown>
    const catalogue = (await import('mochi-world/catalogue')) as Record<string, unknown>
    const all = (Object.values(EX) as unknown[]).filter((v): v is string => typeof v === 'string').join('\n')
    const names = (file: string) =>
      [...all.matchAll(new RegExp(`import \\{([^}]+)\\} from '/mochi/${file.replace('.', '\\.')}'`, 'g'))].flatMap((m) =>
        m[1]!.split(',').map((x) => x.trim()).filter(Boolean)
      )
    expect(names('catalogue.js').length).toBeGreaterThan(0)
    for (const n of names('mochi-world.js')) expect(complet[n], n).toBeDefined()
    for (const n of names('catalogue.js')) expect(catalogue[n], n).toBeDefined()
  })
})

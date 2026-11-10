import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACCESSORIES, ACCESSORY_BY_KEY, SLOTS, type Slot } from '@/bot/slots'
import { MOOD_IDS, REACTION_IDS, resolveMood } from '@/bot/moods'
import { COLORS, COLOR_BY_ID, SHAPES, SHAPE_BY_ID, isValidHex } from '@/bot/skins'
import { EXPRESSIONS } from '@/bot/expressions'
import { SEQUENCE } from '@/bot/states'
import { RENDER_STYLES, PIXEL_SIZES } from '@/ui/renderStyle'
import { MochiBotElement, PROPERTIES, attributeOf } from '@/components/mochi-bot'
import { pagesOf, parseMarkdown, type Block } from './markdown'
import { PAGES } from './Docs'
import { tagsOf } from './preview'

/**
 * ONE documentation: the website's /docs page is built from README.md and docs/*.md. These tests fail when the site
 * and the repository could say different things, or when the docs and the code disagree.
 */

const root = new URL('../../', import.meta.url)
const read = (f: string) => readFileSync(new URL(f, root), 'utf8')
const DOC_FILES = readdirSync(new URL('docs/', root)).filter((f) => f.endsWith('.md'))
const INDEX = read('docs/README.md')
const README = read('README.md')
const GUIDE = read('docs/getting-started.md')
const REFERENCE = read('docs/reference.md')

/** Every fenced code block of every documentation file. */
const ALL_CODE = [README, ...DOC_FILES.map((f) => read('docs/' + f))].flatMap((src) =>
  parseMarkdown(src).filter((b): b is Extract<Block, { t: 'code' }> => b.t === 'code')
)
/** Example code shown to users (not the contributor pages, which quote internal code). */
const USER_CODE = [README, GUIDE, REFERENCE].flatMap((src) => parseMarkdown(src).filter((b): b is Extract<Block, { t: 'code' }> => b.t === 'code'))

/** The rows of the table that follows the `## <title>` heading of a page. */
function tableAfter(src: string, title: string): string[][] {
  const blocks = parseMarkdown(src)
  const i = blocks.findIndex((b) => b.t === 'heading' && b.text === title)
  expect(i, title).toBeGreaterThanOrEqual(0)
  const t = blocks.slice(i + 1).find((b) => b.t === 'table') as Extract<Block, { t: 'table' }>
  return t.rows
}
const id = (cell: string) => cell.replace(/`/g, '').trim()

describe('one documentation for the site and the repository', () => {
  it('docs/README.md lists every page of docs/, and every listed page exists', () => {
    const listed = pagesOf(INDEX).map((p) => p.file).sort()
    const files = DOC_FILES.filter((f) => f !== 'README.md').sort()
    expect(listed).toEqual(files)
  })

  it('the site shows exactly the Markdown files of the repository, nothing else', () => {
    expect(PAGES.map((p) => p.file).sort()).toEqual(['README.md', ...DOC_FILES.filter((f) => f !== 'README.md').map((f) => 'docs/' + f)].sort())
    for (const p of PAGES) expect(p.source, p.file).toBe(read(p.file))
    // the docs page has no text of its own: it only renders those files
    const docsPage = readFileSync(new URL('./Docs.ts', import.meta.url), 'utf8')
    expect(docsPage).not.toMatch(/'[A-Z][a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+[^']*\.'/)
  })

  it('every usage example of the README is also in Getting started, word for word', () => {
    // the README only shows usage in its live examples; its other blocks are commands for contributors
    const readmeCode = parseMarkdown(README).filter((b): b is Extract<Block, { t: 'code' }> => b.t === 'code' && b.live)
    expect(readmeCode.length).toBeGreaterThan(0)
    for (const b of readmeCode) expect(GUIDE, b.code).toContain(b.code)
  })

  it('links between doc pages point to pages that exist', () => {
    for (const f of ['README.md', ...DOC_FILES.map((x) => 'docs/' + x)]) {
      for (const m of read(f).matchAll(/\]\(([\w./-]+\.md)(#[\w-]+)?\)/g)) {
        const target = new URL(m[1]!, new URL(f, root))
        expect(() => readFileSync(target), `${f} -> ${m[1]}`).not.toThrow()
      }
    }
  })

  it('no em dash and no French in the English documentation', () => {
    for (const f of ['README.md', ...DOC_FILES.map((x) => 'docs/' + x)]) {
      const text = read(f)
      expect(text, f).not.toMatch(/[—–]/)
      expect(text, f).not.toMatch(/\b(les|une|avec|dans|pour|sont|cette|humeur|couleur|forme)\b/i)
    }
  })
})

describe('the documentation says what the code does', () => {
  it('the options tables list every attribute of <mochi-bot>', () => {
    const documented = [...tableAfter(REFERENCE, 'Options'), ...tableAfter(REFERENCE, 'Advanced options')].map((r) => id(r[0]!))
    const internal = new Set(['block', 'state', 'playing', 'elapsed'])
    const attributes = PROPERTIES.filter((p) => !p.withoutAttribute && !internal.has(p.name)).map((p) => attributeOf(p.name))
    expect(documented.sort()).toEqual(attributes.sort())
    for (const p of PROPERTIES.filter((x) => x.withoutAttribute)) expect(REFERENCE, p.name).toContain('`' + p.name + '`')
  })

  it('every documented method exists on the element, and every public method is documented', () => {
    const methods = tableAfter(REFERENCE, 'Methods').map((r) => id(r[0]!).replace(/\(.*$/, ''))
    for (const m of methods) expect(typeof (MochiBotElement.prototype as unknown as Record<string, unknown>)[m], m).toBe('function')
    expect(methods.sort()).toEqual(['lookAt', 'react', 'release', 'renderAt', 'seek', 'setMood'])
  })

  it('every documented event is emitted by the component, and the reverse', () => {
    const component = readFileSync(new URL('../components/mochi-bot.ts', import.meta.url), 'utf8')
    const events = tableAfter(REFERENCE, 'Events').map((r) => id(r[0]!))
    for (const e of events) expect(component, e).toMatch(new RegExp(`'${e}'`))
    expect(events.sort()).toEqual(['blockchange', 'elapsedchange', 'no3d', 'playingchange', 'ready', 'statechange'])
  })

  it('the id tables are the catalogs of the engine', () => {
    expect(tableAfter(REFERENCE, 'Shapes').map((r) => id(r[0]!))).toEqual(SHAPES.map((s) => s.id))
    expect(tableAfter(REFERENCE, 'Colors').map((r) => [id(r[0]!), id(r[2]!)])).toEqual(COLORS.map((c) => [c.id, c.hex]))
    expect(tableAfter(REFERENCE, 'Moods').map((r) => id(r[0]!))).toEqual(MOOD_IDS)
    for (const r of tableAfter(REFERENCE, 'Moods')) for (const a of r[1]!.match(/`[^`]+`/g) ?? []) expect(resolveMood(id(a))).toBe(id(r[0]!))
    expect(tableAfter(REFERENCE, 'Reactions').map((r) => id(r[0]!))).toEqual(REACTION_IDS)
    expect(tableAfter(REFERENCE, 'Accessories').map((r) => `${id(r[0]!)}:${id(r[1]!)}:${r[2]}`)).toEqual(ACCESSORIES.map((a) => `${a.slot}:${a.id}:${a.name}`))
    const expressions = REFERENCE.match(/## Expressions\n\n[^\n]*\n/)![0]
    expect([...expressions.matchAll(/`([a-z]+)`/g)].map((m) => m[1]).filter((x) => x !== 'expression')).toEqual(EXPRESSIONS.map((e) => e.id))
    expect(SLOTS).toEqual(['head', 'eyes', 'neck', 'back'])
  })

  it('the cycle player has its own section, with the real states and the player properties', () => {
    const i = REFERENCE.indexOf('## Cycle player')
    expect(i).toBeGreaterThan(0)
    const section = REFERENCE.slice(i, REFERENCE.indexOf('\n## ', i + 1))
    expect(section).toContain(SEQUENCE.map((x) => '`' + x + '`').slice(0, -1).join(', ') + ' and `' + SEQUENCE.at(-1) + '`')
    for (const p of ['cycle', 'playing', 'block', 'state', 'elapsed', 'seek(index, offset)', 'renderAt(t)']) expect(section, p).toContain('`' + p + '`')
  })

  it('the attributes written in the examples are real options, with ids that exist', () => {
    const attributes = new Set(PROPERTIES.filter((p) => !p.withoutAttribute).map((p) => attributeOf(p.name)))
    let seen = 0
    for (const { code } of USER_CODE) {
      for (const tag of code.matchAll(/<mochi-bot\b([^>]*)>/g)) {
        for (const m of tag[1]!.matchAll(/(?:^|\s)([a-z][a-z-]*)(?==|\s|$)/g)) {
          if (m[1] === 'id' || m[1]!.startsWith('on')) continue
          expect(attributes.has(m[1]!), m[1]).toBe(true)
          seen++
        }
      }
      for (const m of code.matchAll(/(?<![\w-])shape="([^"]+)"/g)) expect(SHAPE_BY_ID.has(m[1]!), m[1]).toBe(true)
      for (const m of code.matchAll(/(?<![\w-])color="([^"]+)"/g)) expect(COLOR_BY_ID.has(m[1]!) || isValidHex(m[1]!) !== null, m[1]).toBe(true)
      for (const m of code.matchAll(/render-style="([^"]+)"/g)) expect(RENDER_STYLES as string[]).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![\w-])mood="([^"]+)"/g)) expect(resolveMood(m[1]!), m[1]).not.toBeNull()
      for (const m of code.matchAll(/(?:setMood\(|'mood', |\$state\()'([^']+)'/g)) expect(resolveMood(m[1]!), m[1]).not.toBeNull()
      for (const m of code.matchAll(/react\('([^']+)'\)/g)) expect(REACTION_IDS as string[]).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![\w-])pixel="([^"]+)"/g)) expect(PIXEL_SIZES.map((p) => p.id) as string[]).toContain(m[1]!)
      for (const m of code.matchAll(/accessories='([^']+)'/g)) expect(() => JSON.parse(m[1]!)).not.toThrow()
      for (const m of code.matchAll(/"?(head|eyes|face|neck|back)"?:\s*(?:"([a-z-]+)"|'([a-z-]+)'|\{\s*id:\s*'([a-z-]+)'([^}]*)\})/g)) {
        const slot = m[1] as Slot
        const acc = m[2] ?? m[3] ?? m[4]!
        expect(ACCESSORY_BY_KEY.has(`${slot}:${acc}`), `${slot}:${acc}`).toBe(true)
        for (const c of (m[5] ?? '').matchAll(/c[12]:\s*'([^']+)'/g)) expect(isValidHex(c[1]!), c[1]).not.toBeNull()
      }
    }
    expect(seen).toBeGreaterThan(20)
  })

  it('every live example shows its own <mochi-bot> tags, word for word', () => {
    const live = ALL_CODE.filter((b) => b.live)
    expect(live.length).toBeGreaterThanOrEqual(6)
    for (const b of live) {
      const tags = tagsOf(b.code)
      expect(tags.length, b.code).toBeGreaterThan(0)
      for (const t of tags) expect(b.code).toContain(t)
    }
  })

  it('the names imported in the examples exist in the public entry points', async () => {
    const full = (await import('mochis')) as Record<string, unknown>
    const catalog = (await import('mochis/catalog')) as Record<string, unknown>
    const all = USER_CODE.map((b) => b.code).join('\n')
    const names = (file: string) =>
      [...all.matchAll(new RegExp(`import \\{([^}]+)\\} from '\\./vendor/mochis/${file.replace('.', '\\.')}'`, 'g'))].flatMap((m) => m[1]!.split(',').map((x) => x.trim()).filter(Boolean))
    expect(names('catalog.js').length).toBeGreaterThan(0)
    for (const n of names('mochis.js')) expect(full[n], n).toBeDefined()
    for (const n of names('catalog.js')) expect(catalog[n], n).toBeDefined()
  })

  it('npm is never presented as available: the package is not published yet', () => {
    expect(GUIDE).toContain('coming soon')
    expect(GUIDE).toContain('does not work today')
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts['build:lib']).toContain('vite.lib.config.ts')
  })

  it('library paths: /mochis/ in plain HTML, ./vendor/mochis/ with a bundler, never imported from public/', () => {
    const all = [README, ...DOC_FILES.map((f) => read('docs/' + f))].join('\n')
    // the folder name of the old docs; a bundler cannot import from public/ (Vite fails to resolve it)
    expect(all).not.toMatch(/['"]\/mochi\/(mochis|catalog)\.js/)
    expect(all).not.toMatch(/public\/mochis?\b(?!\/\*)/)
    for (const { code } of USER_CODE) {
      for (const m of code.matchAll(/\bimport\s+(?:[^'"]+from\s+)?'([^']+)'/g)) expect(m[1], code).toMatch(/^\.\/vendor\/mochis\/(mochis|catalog)\.js$/)
      for (const m of code.matchAll(/<script type="module" src="([^"]+)"/g)) expect(m[1], code).toMatch(/^\/mochis\/mochis\.js$/)
    }
    expect(GUIDE).toContain('cp -r dist-lib ../my-app/src/vendor/mochis')
    expect(GUIDE).toContain("import './vendor/mochis/mochis.js'")
  })

  it('the Node version is the same in package.json and the READMEs', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.engines.node).toBe('>=22.12.0')
    for (const f of [README, read('README.fr.md'), GUIDE]) expect(f).toContain('22.12')
    expect(read('.github/workflows/ci.yml')).toContain('node-version: 24')
  })
})

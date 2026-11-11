import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
    const full = (await import('mochiz')) as Record<string, unknown>
    const catalog = (await import('mochiz/catalog')) as Record<string, unknown>
    const all = USER_CODE.map((b) => b.code).join('\n')
    const names = (entry: string) =>
      [...all.matchAll(new RegExp(`import \\{([^}]+)\\} from '${entry}'`, 'g'))].flatMap((m) => m[1]!.split(',').map((x) => x.trim()).filter(Boolean))
    expect(names('mochiz').length).toBeGreaterThan(0)
    expect(names('mochiz/catalog').length).toBeGreaterThan(0)
    for (const n of names('mochiz')) expect(full[n], n).toBeDefined()
    for (const n of names('mochiz/catalog')) expect(catalog[n], n).toBeDefined()
  })

  it('the package is ready for npm (name, peer three) but the published docs never present npm as available', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.name).toBe('mochiz')
    expect(pkg.private).toBeUndefined()
    expect(pkg.peerDependencies.three).toBeDefined()
    expect(pkg.dependencies?.three).toBeUndefined()
    expect(pkg.scripts['build:lib']).toContain('vite.lib.config.ts')
    // `docs/drafts/PUBLISHED` is created on the day `mochiz` is published (see docs/drafts/npm-install.md)
    if (!existsSync(new URL('docs/drafts/PUBLISHED', root))) {
      expect(GUIDE).toContain('coming soon')
      expect(GUIDE).toContain('not on npm yet')
      const published = [README, read('README.fr.md'), ...DOC_FILES.map((f) => read('docs/' + f))]
      for (const src of published) {
        expect(src).not.toContain('cdn.jsdelivr.net/npm/mochiz')
        // no npm command for the package at all, not even one marked as not working: a reader copies commands
        expect(src).not.toMatch(/\b(npm|pnpm|yarn|bun)\s+(install|i|add)\b[^\n]*\bmochiz\b/)
      }
      expect(read('docs/drafts/npm-install.md')).toContain('npm install mochiz three')
      return
    }
    // published: the docs install with npm, and every CDN link names the version of package.json
    expect(GUIDE).not.toMatch(/coming soon|not on npm yet/)
    for (const src of [README, read('README.fr.md'), GUIDE]) expect(src).toContain('npm install mochiz three')
    const all = [README, read('README.fr.md'), ...DOC_FILES.map((f) => read('docs/' + f))].join('\n')
    const cdn = [...all.matchAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/mochiz@([^/\s]+)\/([^"\s`)]+)/g)]
    expect(cdn.length).toBeGreaterThan(2)
    for (const m of cdn) {
      expect(m[1], m[0]).toBe(pkg.version)
      // the file the CDN serves is the one the package exports as `mochiz/standalone`
      expect('./' + m[2], m[0]).toBe(pkg.exports['./standalone'].import)
    }
  })

  it('library paths: npm entries and the CDN in the examples, /mochiz/ or ./vendor/mochiz/ for a copied build, never public/', () => {
    const all = [README, read('README.fr.md'), ...DOC_FILES.map((f) => read('docs/' + f))].join('\n')
    // the folder name of the old docs; a bundler cannot import from public/ (Vite fails to resolve it)
    expect(all).not.toMatch(/['"]\/mochi\/(mochiz|catalog)\.js/)
    expect(all).not.toMatch(/public\/mochiz?\b(?!\/\*)/)
    const pkg = JSON.parse(read('package.json'))
    const CDN = `https://cdn.jsdelivr.net/npm/mochiz@${pkg.version}/dist-lib/standalone/mochiz.js`
    for (const { code } of USER_CODE) {
      for (const m of code.matchAll(/\bimport\s+(?:[^'"]+from\s+)?'([^']+)'/g)) expect(m[1], code).toMatch(/^mochiz(\/catalog)?$/)
      for (const m of code.matchAll(/<script type="module" src="([^"]+)"/g)) expect(m[1], code).toBe(CDN)
    }
    // building it yourself: the root of dist-lib/ needs the project's three (npm build), so the copied folder is the standalone one
    expect(GUIDE).toContain('cp -r dist-lib/standalone ../my-site/mochiz')
    expect(GUIDE).toContain('cp -r dist-lib/standalone ../my-app/src/vendor/mochiz')
    expect(GUIDE).toContain('<script type="module" src="/mochiz/mochiz.js"></script>')
    expect(GUIDE).toContain("import './vendor/mochiz/mochiz.js'")
  })

  it('every public entry of the docs is an export of package.json, with its types', () => {
    const pkg = JSON.parse(read('package.json'))
    for (const entry of ['.', './catalog', './standalone', './standalone/catalog']) {
      expect(pkg.exports[entry], entry).toBeDefined()
      expect(pkg.exports[entry].types, entry).toMatch(/^\.\/dist-lib\/types\/(index|catalog)\.d\.ts$/)
    }
    expect(pkg.files).toEqual(['dist-lib', 'CHANGELOG.md'])
    expect(pkg.sideEffects).toContain('./dist-lib/mochiz.js')
  })

  it('every built file of the library carries the MIT notice (the docs tell users to ship it)', async () => {
    const { licenseNotice } = await import('../../vite.lib.config')
    const pkg = JSON.parse(read('package.json'))
    const license = read('LICENSE')
    for (const standalone of [false, true]) {
      const notice = licenseNotice(standalone)
      expect(notice).toMatch(/^\/\*! [^\n]* \*\/$/)
      expect(notice).toContain(`Mochiz ${pkg.version}`)
      for (const line of license.match(/^Copyright \(c\) .+$/gm)!) expect(notice).toContain(line)
    }
    expect(licenseNotice(true)).toContain('three.js authors')
    expect(licenseNotice(false)).not.toContain('three.js')
    // added after minification, which removes comments
    expect(read('vite.lib.config.ts')).toContain('postBanner: licenseNotice(standalone)')
  })

  it('the cadence thresholds written in the docs are the ones of the code', async () => {
    const { CADENCE_LATE_MS, CADENCE_HALF_MS, CADENCE_FULL_MS } = await import('@/components/mochi-bot')
    const styles = read('docs/styles.md')
    expect(styles).toContain(`more than ${CADENCE_LATE_MS} ms apart`)
    expect(styles).toContain(`costs more than ${CADENCE_HALF_MS} ms`)
    expect(styles).toContain(`below ${CADENCE_FULL_MS} ms`)
  })

  it('the Node version is the same in package.json and the READMEs', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.engines.node).toBe('>=22.12.0')
    for (const f of [README, read('README.fr.md'), GUIDE]) expect(f).toContain('22.12')
    expect(read('.github/workflows/ci.yml')).toContain('node-version: 24')
  })
})

describe('docs side menu (/docs)', () => {
  it('lights the section whose heading was just reached, not the next one', async () => {
    const { activeSection, readingLine } = await import('./Docs')
    const line = readingLine(800)
    // a jump to the 2nd heading puts it at the top of the window; the 3rd heading is a little lower
    expect(activeSection([-900, 0, 260, 1200], line)).toBe(1)
    // before any heading reaches the line: the first section
    expect(activeSection([300, 900], line)).toBe(0)
    // at the bottom of the page, the last section (too short to reach the line)
    expect(activeSection([-900, -300, 500], line, true)).toBe(2)
    expect(activeSection([], line)).toBe(0)
  })
})

describe('site address', () => {
  const SITE = 'https://mochiz.vercel.app'
  it('every public file names the current address, never the old one', () => {
    const files = ['README.md', 'README.fr.md', 'package.json', 'index.html', 'docs.html', '.github/ISSUE_TEMPLATE/config.yml', ...DOC_FILES.map((f) => 'docs/' + f)]
    for (const f of files) expect(read(f), f).not.toContain('mochi-red-phi')
    expect(JSON.parse(read('package.json')).homepage).toBe(SITE)
    expect(README).toContain(SITE)
  })
  it('the public pages declare their canonical address and og:url', () => {
    for (const [file, path] of [['index.html', '/'], ['docs.html', '/docs']] as const) {
      const html = read(file)
      expect(html, file).toContain(`<link rel="canonical" href="${SITE}${path}" />`)
      expect(html, file).toContain(`<meta property="og:url" content="${SITE}${path}" />`)
      expect(html, file).toContain(`<meta property="og:image" content="${SITE}/og.png" />`)
      expect(html, file).toContain('<meta name="twitter:card" content="summary_large_image" />')
    }
  })
  it('the home page description gives the real counts of the catalog', async () => {
    const { SHAPES, MOOD_IDS, ACCESSORIES } = await import('../catalog')
    const html = read('index.html')
    const description = html.match(/name="description"\s+content="([^"]+)"/)![1]!
    expect(description).toContain(`${SHAPES.length} shapes`)
    expect(description).toContain(`${MOOD_IDS.length} moods`)
    expect(description).toContain(`${ACCESSORIES.length} accessories`)
    expect(description).not.toMatch(/one soft shape/i)
  })
  it('robots.txt points to the sitemap of the site, and the 404 page exists', () => {
    expect(read('public/robots.txt')).toContain(`Sitemap: ${SITE}/sitemap.xml`)
    expect(read('public/404.html')).toContain('This page does not exist')
  })
})

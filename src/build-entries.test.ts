// Builds the site for real and checks that every page that shows Mochiz loads the code that defines <mochi-bot>.
// Why: on 11/11/2026 the `sideEffects` field of package.json made the bundler drop `import '@/components/mochi-bot'`
// (an import kept only for what it does, not for a value). The pages of that time went live empty, and every other test
// was green.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
let out = ''

// Every JS file a page loads before it runs: its module scripts, then their static imports, recursively.
// Dynamic imports (`import('./x.js')`) are followed too: the home page loads the tag that way.
function loadedFiles(page: string): Set<string> {
  const html = readFileSync(join(out, page), 'utf8')
  const todo = [...html.matchAll(/<script[^>]*type="module"[^>]*src="\/([^"]+)"/g)].map((m) => m[1]!)
  const seen = new Set<string>()
  while (todo.length) {
    const file = todo.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const code = readFileSync(join(out, file), 'utf8')
    const dir = file.slice(0, file.lastIndexOf('/') + 1)
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*["'`](\.{1,2}\/[^"'`]+\.js)["'`]/g)) {
      // code samples shown on the page also contain `from './x.js'`: only real files of the build count
      const target = resolve('/' + dir, m[1]!).slice(1)
      if (existsSync(join(out, target))) todo.push(target)
    }
  }
  return seen
}

function definesMochiBot(page: string): boolean {
  return [...loadedFiles(page)].some((f) => /customElements\.define\(/.test(readFileSync(join(out, f), 'utf8')))
}

describe('production build', () => {
  beforeAll(async () => {
    out = mkdtempSync(join(tmpdir(), 'mochiz-build-'))
    await build({
      root: ROOT,
      configFile: join(ROOT, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir: out, emptyOutDir: true }
    })
  }, 120_000)

  afterAll(() => {
    if (out) rmSync(out, { recursive: true, force: true })
  })

  it('has the two pages, the 404 page, robots.txt and the sitemap', () => {
    const pages = readdirSync(out).filter((f) => f.endsWith('.html'))
    // no /app nor /lab any more (removed on 11/11/2026, redirected to the home page by vercel.json)
    expect(pages.sort()).toEqual(['404.html', 'docs.html', 'index.html'])
    expect(readFileSync(join(out, 'robots.txt'), 'utf8')).toContain('Sitemap: https://mochiz.vercel.app/sitemap.xml')
    const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8')
    for (const url of ['/', '/docs', '/docs?page=getting-started', '/docs?page=reference']) {
      expect(sitemap).toContain(`<loc>https://mochiz.vercel.app${url}</loc>`)
    }
    expect(sitemap).not.toContain('/app')
    expect(sitemap).not.toContain('/lab')
  })

  // the home page and the docs both show Mochiz: each must register the tag
  for (const page of ['index.html', 'docs.html']) {
    it(`${page} defines <mochi-bot>`, () => {
      expect(definesMochiBot(page)).toBe(true)
    })
  }

  it('keeps the CSS of every page', () => {
    for (const page of ['index.html', 'docs.html']) {
      expect(readFileSync(join(out, page), 'utf8')).toMatch(/<link rel="stylesheet"[^>]+\.css"/)
    }
  })
})

// /app (the old editor) and /lab were removed on 11/11/2026. Links to them exist outside the site (old README, shared
// links): Vercel sends them to the home page with a permanent redirect instead of a 404.
describe('removed pages', () => {
  it('vercel.json redirects /app, /lab and /labo to the home page, permanently', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
      redirects: { source: string; destination: string; permanent: boolean }[]
    }
    for (const source of ['/app', '/lab', '/labo']) {
      expect(vercel.redirects, source).toContainEqual({ source, destination: '/', permanent: true })
    }
  })

  it('no page of the site links to /app or /lab any more', () => {
    const files = ['index.html', 'docs.html', 'public/404.html', 'README.md', 'CONTRIBUTING.md']
    const site = readdirSync(join(ROOT, 'src/site')).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    for (const f of [...files, ...site.map((f) => 'src/site/' + f)]) {
      expect(readFileSync(join(ROOT, f), 'utf8'), f).not.toMatch(/["'(]\/(app|lab)\b/)
    }
  })
})

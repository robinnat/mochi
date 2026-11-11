// Builds the site for real and checks that every page that shows Mochiz loads the code that defines <mochi-bot>.
// Why: on 11/11/2026 the `sideEffects` field of package.json made the bundler drop `import '@/components/mochi-bot'`
// (an import kept only for what it does, not for a value). /app and /lab went live empty, and every other test was green.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
let out = ''

// Every JS file a page loads before it runs: its module scripts, then their static imports, recursively.
// Dynamic imports (`import('./x.js')`) are followed too: the lab loads its sheets that way.
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

  it('has the four pages, the 404 page, robots.txt and the sitemap', () => {
    const pages = readdirSync(out).filter((f) => f.endsWith('.html'))
    expect(pages.sort()).toEqual(['404.html', 'app.html', 'docs.html', 'index.html', 'lab.html'])
    expect(readFileSync(join(out, 'robots.txt'), 'utf8')).toContain('Sitemap: https://mochiz.vercel.app/sitemap.xml')
    const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8')
    for (const url of ['/', '/app', '/docs', '/docs?page=getting-started', '/docs?page=reference']) {
      expect(sitemap).toContain(`<loc>https://mochiz.vercel.app${url}</loc>`)
    }
    // the lab says noindex: it stays out of the sitemap
    expect(sitemap).not.toContain('/lab')
  })

  // the home page, the docs, the app and the lab all show Mochiz: each must register the tag
  for (const page of ['index.html', 'docs.html', 'app.html', 'lab.html']) {
    it(`${page} defines <mochi-bot>`, () => {
      expect(definesMochiBot(page)).toBe(true)
    })
  }

  it('keeps the CSS of every page', () => {
    for (const page of ['index.html', 'docs.html', 'app.html', 'lab.html']) {
      expect(readFileSync(join(out, page), 'utf8')).toMatch(/<link rel="stylesheet"[^>]+\.css"/)
    }
  })
})

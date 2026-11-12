import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The site (home, docs) is a SHOWCASE: it uses Mochiz exactly like a user of the package, through its public entries
 * (`mochiz-world`, `mochiz-world/catalog`) and the `<mochi-bot>` tag. No import of an internal engine file (`src/bot`,
 * `src/ui/3d`, `src/components`...). Still allowed: its own code, the repository's small interface library
 * (`@/ui/dom`, which is not Mochiz) and the Markdown docs (`docs/*.md?raw`).
 */
const SRC = fileURLToPath(new URL('..', import.meta.url))
const FOLDERS = ['site', 'docs']
const ALLOWED = [/^mochiz-world(\/catalog)?$/, /^\/mochiz\/(mochiz|catalog)\.js$/, /^@\/ui\/dom\//, /^@\/(site|docs)\//, /^(\.\.\/)+docs\/[\w-]+\.md\?raw$/, /^\.\//, /^three$/, /^vitest$/, /^node:/]

const sources = FOLDERS.flatMap((d) =>
  readdirSync(join(SRC, d))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => ({ file: `${d}/${f}`, text: readFileSync(join(SRC, d, f), 'utf8') }))
)

/** Every import target of a file: static, `import type`, side effects and dynamic `import()`. */
export function targetsImport(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/(?:^|\n)\s*import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g)) out.push(m[1]!)
  for (const m of text.matchAll(/(?:^|\n)\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g)) out.push(m[1]!)
  for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!)
  return out
}

describe('the site uses Mochiz through its public entry', () => {
  it('finds the files of the site and the docs', () => {
    expect(sources.length).toBeGreaterThan(20)
  })

  it.each(sources)('$file imports no internal engine file', ({ file, text }) => {
    const forbidden = targetsImport(text).filter((c) => !ALLOWED.some((p) => p.test(c)))
    expect(forbidden, file).toEqual([])
  })

  it("home and docs only load the tag on demand: as a static import, only the catalog", () => {
    for (const { file, text } of sources) {
      // thumbnails.ts only serves the tools/renders.ts tool
      if (file === 'site/thumbnails.ts') continue
      expect(text, file).not.toMatch(/(?:^|\n)\s*import\s+(?!type\b)[^'";]*['"]mochiz-world['"]/)
    }
  })

  it('recognizes an internal import (the guard bites)', () => {
    const fake = "import { SHAPES } from '@/bot/skins'\nconst m = await import('@/ui/3d/scene3d')"
    expect(targetsImport(fake).filter((c) => !ALLOWED.some((p) => p.test(c)))).toEqual(['@/bot/skins', '@/ui/3d/scene3d'])
  })
})

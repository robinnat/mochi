import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The project is called Mochiz (renamed on 11/11/2026, it was "Mochi" + "s"). One character is still "a Mochi" and the
 * tag is still `<mochi-bot>`. This test fails when the old name comes back in a file of the repository: the README,
 * the docs, the site, the package, the code or the tests.
 *
 * Allowed on purpose: `CHANGELOG.md`, whose older entries keep the name they were written with.
 */

const root = new URL('../', import.meta.url)
// built from two pieces so that this file does not match itself
const OLD_NAME = new RegExp(`\\b${'mochi'}s\\b`, 'i')
const ALLOWED_FILES = new Set(['CHANGELOG.md'])
const TEXT = /\.(md|ts|mjs|js|json|html|css|yml|yaml|svg|webmanifest|txt)$|^LICENSE$/

function trackedTextFiles(): string[] {
  return execSync('git ls-files', { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && TEXT.test(f.split('/').pop()!) && !ALLOWED_FILES.has(f))
}

describe('the project name is Mochiz', () => {
  it('the old name does not come back in the files of the repository', () => {
    const files = trackedTextFiles()
    expect(files.length).toBeGreaterThan(50)
    const hits: string[] = []
    for (const f of files) {
      readFileSync(new URL(f, root), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (OLD_NAME.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`)
        })
    }
    expect(hits).toEqual([])
  })

  it('the package is mochiz and the site names itself Mochiz', () => {
    const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { name: string; description: string }
    expect(pkg.name).toBe('mochiz')
    expect(pkg.description).toMatch(/^Mochiz:/)
    for (const page of ['index.html', 'app.html', 'docs.html']) {
      const html = readFileSync(new URL(page, root), 'utf8')
      expect(html, page).toContain('<meta property="og:site_name" content="Mochiz" />')
    }
    expect(JSON.parse(readFileSync(new URL('public/site.webmanifest', root), 'utf8')).name).toBe('Mochiz')
  })
})

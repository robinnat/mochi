/**
 * Type declarations of the npm package (`pnpm build:lib`, after the two bundles).
 *
 * `tsc -p tsconfig.lib.json` writes one `.d.ts` per source file reachable from the two public entries
 * (`src/index.ts`, `src/catalog.ts`) into `dist-lib/types/`. The sources import with the `@/` alias, which only the
 * repository knows: this script rewrites every `@/...` specifier into a relative path, so the declarations work in any
 * project. Node standard library only.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-lib', 'types')

execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.lib.json')], { stdio: 'inherit' })

const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]))

let rewritten = 0
for (const file of files(out).filter((f) => f.endsWith('.d.ts'))) {
  const src = readFileSync(file, 'utf8')
  const next = src.replace(/(['"])@\/([^'"]+)\1/g, (_m, q, path) => {
    let rel = relative(dirname(file), join(out, path)).split(sep).join('/')
    if (!rel.startsWith('.')) rel = './' + rel
    rewritten++
    return q + rel + q
  })
  if (next !== src) writeFileSync(file, next)
  if (/['"]@\//.test(next)) throw new Error(`alias left in ${file}`)
}
console.log(`types: ${files(out).length} files in dist-lib/types, ${rewritten} alias imports rewritten`)

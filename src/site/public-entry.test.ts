import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Le site (accueil, docs) et le labo sont des VITRINES : ils utilisent Mochi exactement comme un utilisateur du
 * paquet, par ses entrees publiques (`mochi-world`, `mochi-world/catalogue`) et la balise `<mochi-bot>`. Aucun import
 * d'un fichier interne du moteur (`src/bot`, `src/ui/trois`, `src/components`...). Restent permis : leur propre code,
 * la petite bibliotheque d'interface du depot (`@/ui/dom`, ce n'est pas Mochi), les textes (`@/i18n`) et les styles.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url))
const FOLDERS = ['site', 'docs', 'lab']
const ALLOWED = [/^mochi-world(\/catalogue)?$/, /^\/mochi\/(mochi-world|catalogue)\.js$/, /^@\/ui\/dom\//, /^@\/i18n(\/|$)/, /^@\/(site|docs|labo)\//, /^@\/styles\.css$/, /^\.\//, /^three$/, /^vitest$/, /^node:/]

const sources = FOLDERS.flatMap((d) =>
  readdirSync(join(SRC, d))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => ({ file: `${d}/${f}`, text: readFileSync(join(SRC, d, f), 'utf8') }))
)

/** Toutes les cibles d'import d'un fichier : statiques, `import type`, effets de bord et `import()` dynamiques. */
export function targetsImport(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/(?:^|\n)\s*import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g)) out.push(m[1]!)
  for (const m of text.matchAll(/(?:^|\n)\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g)) out.push(m[1]!)
  for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!)
  return out
}

describe('le site consomme Mochi par son entree publique', () => {
  it('trouve bien les fichiers du site, de la doc et du labo', () => {
    expect(sources.length).toBeGreaterThan(20)
  })

  it.each(sources)('$fichier n importe aucun fichier interne du moteur', ({ file, text }) => {
    const forbidden = targetsImport(text).filter((c) => !ALLOWED.some((p) => p.test(c)))
    expect(forbidden, file).toEqual([])
  })

  it("l'accueil et la doc ne chargent la balise qu'a la demande : en import statique, seulement le catalogue", () => {
    for (const { file, text } of sources) {
      // le labo monte des Mochi des le chargement ; vignettes.ts ne sert qu'a l'outil tools/rendus.ts
      if (file.startsWith('labo/') || file === 'site/vignettes.ts') continue
      expect(text, file).not.toMatch(/(?:^|\n)\s*import\s+(?!type\b)[^'";]*['"]mochi-world['"]/)
    }
  })

  it('reconnait un import interne (le garde-fou mord)', () => {
    const fake = "import { SHAPES } from '@/bot/skins'\nconst m = await import('@/ui/trois/scene3d')"
    expect(targetsImport(fake).filter((c) => !ALLOWED.some((p) => p.test(c)))).toEqual(['@/bot/skins', '@/ui/3d/scene3d'])
  })
})

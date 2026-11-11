import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The code is in English: identifiers, comments, tests, labels. This test fails when common French words come back in
 * the source. It is a net, not a translator: it lists frequent words that have no English homonym in this code base.
 *
 * Allowed on purpose:
 * - `src/ui/legacy.ts`: it still accepts the old French pixel sizes of the `pixel` attribute;
 * - quoted test data that exercises accents (an accented montage name in `export.test.ts`).
 */

const root = new URL('../', import.meta.url)

/** Frequent French words (accents removed, as the code used to write them). */
const FRENCH = [
  'les', 'des', 'une', 'avec', 'dans', 'pour', 'sont', 'cette', 'mais', 'donc', 'aussi', 'sans', 'tout', 'tous',
  'toutes', 'chaque', 'quand', 'comme', 'meme', 'deja', 'jamais', 'rien', 'apres', 'avant', 'sous', 'vers', 'entre',
  'cercle', 'couleur', 'couleurs', 'forme', 'formes', 'humeur', 'humeurs', 'yeux', 'oeil', 'retire', 'retires',
  'rendu', 'rendus', 'toile', 'etoile', 'ambre', 'brun', 'hexagone', 'nuage', 'goutte', 'fleur', 'oeuf', 'coeur',
  'galet', 'tete', 'corps', 'visage', 'accessoire', 'accessoires', 'emplacement', 'emplacements', 'reflet', 'ombre',
  'ombrage', 'moteur', 'etat', 'etats', 'dessin', 'cadre', 'lecteur', 'reglage', 'reglages',
  'libelle', 'labo', 'planche', 'vignette', 'vignettes', 'affiche', 'repos', 'travaille', 'reflechit', 'termine',
  'bloque', 'dort', 'coucou', 'sursaut', 'rigole', 'rougit', 'etourdi', 'ordinateur', 'casquette', 'lunettes',
  'largeur', 'hauteur', 'epaisseur', 'profondeur', 'rayon', 'rayons', 'echelle', 'taille', 'duree', 'fichier'
]
const WORD = new RegExp(`(?<![\\w-])(${FRENCH.join('|')})(?![\\w-])`, 'i')

const ALLOWED_FILES = new Set([
  'src/ui/legacy.ts',
  'src/english.test.ts',
  // the docs test holds its own list of French words to catch
  'src/docs/docs-source.test.ts'
])
/** Lines allowed in a file: test data, not code. */
const ALLOWED_LINES: Record<string, RegExp> = {
  'src/ui/export.test.ts': /Cycle par d[eé]faut|cycle-par-defaut|cyclepardfaut/,
  // the GitHub API path
  'src/site/stars.ts': /api\.github\.com\/repos\//
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(new URL(dir, root))) {
    const path = dir + name
    if (statSync(new URL(path, root)).isDirectory()) walk(path + '/', out)
    else if (/\.(ts|css|html)$/.test(name)) out.push(path)
  }
  return out
}

const FILES = [...walk('src/'), ...walk('tools/'), ...readdirSync(new URL('./', root)).filter((f) => f.endsWith('.html'))].filter((f) => !ALLOWED_FILES.has(f))

/** Every line holding a French word, as `file:line: text`. */
export function frenchLines(): string[] {
  const hits: string[] = []
  for (const f of FILES) {
    const lines = readFileSync(new URL(f, root), 'utf8').split('\n')
    lines.forEach((l, i) => {
      if (ALLOWED_LINES[f]?.test(l)) return
      if (WORD.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`)
    })
  }
  return hits
}

describe('the code is in English', () => {
  it('finds the files to check', () => {
    expect(FILES.length).toBeGreaterThan(100)
  })

  it('no common French word in identifiers, comments, tests or labels', () => {
    expect(frenchLines()).toEqual([])
  })
})

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE, PAR_ID } from 'mochi-world/catalogue'
import { AFFICHES, DEFILE, PIECES, urlAffiche, urlPiece } from './affiches'

const publicDir = new URL('../../public', import.meta.url)
const existe = (url: string) => existsSync(new URL('.' + url, publicDir + '/'))
const dossier = new URL('./', import.meta.url)
// les composants du site : un fichier .ts par section, nomme en majuscule
const pages = readdirSync(dossier).filter((f) => /^[A-Z].*\.ts$/.test(f))
const lire = (f: string) => readFileSync(new URL(f, dossier), 'utf8')

describe('images pre-rendues (v11)', () => {
  it('chaque affiche et chaque piece a son image, en clair et en sombre', () => {
    for (const t of ['light', 'dark'] as const) {
      for (const a of AFFICHES) expect(existe(urlAffiche(a.nom, t)), urlAffiche(a.nom, t)).toBe(true)
      for (const p of PIECES) expect(existe(urlPiece(p.emplacement, p.id, t)), urlPiece(p.emplacement, p.id, t)).toBe(true)
    }
  })

  it('les anciennes sections ne sont plus dans la page', () => {
    expect(lire('Site.ts')).not.toMatch(/Faces|Gestes|Metiers/)
  })

  it('les noms sont uniques', () => {
    expect(new Set(AFFICHES.map((a) => a.nom)).size).toBe(AFFICHES.length)
  })

  it('aucune section du site ne monte <mochi-bot> directement : images ou Vivant (affiche puis 3D en fondu, jamais de 2D)', () => {
    for (const f of pages) {
      if (f === 'Vivant.ts') continue
      expect(lire(f), f).not.toMatch(/'mochi-bot'/)
      expect(lire(f), f).not.toMatch(/^import [^\n]*components\/mochi-bot/m)
    }
    const v = lire('Vivant.ts')
    // le composant arrive par l'entree publique du paquet, comme chez un utilisateur
    expect(v).toContain("import('mochi-world')")
    expect(v).toContain('onPret: surPret')
    expect(v).toContain('IntersectionObserver')
  })

  it('les affiches utilisees par les pages existent dans le manifeste', () => {
    const noms = new Set(AFFICHES.map((a) => a.nom))
    const tout = pages.map(lire).join('\n') + readFileSync(new URL('../docs/Docs.ts', import.meta.url), 'utf8')
    let vus = 0
    for (const m of tout.matchAll(/affiche: (?:[^,\n]*\? )?'([a-z-]+)'/g)) {
      vus++
      const n = m[1]!
      expect(noms.has(n), n).toBe(true)
    }
    expect(vus).toBeGreaterThanOrEqual(2)
  })

  it('la carte des accessoires defile sur tout le catalogue (sans les quatre retires), compteur lu dans le catalogue, immobile si mouvement reduit', () => {
    const vus = new Set<string>()
    for (const d of DEFILE) {
      for (const [e, ch] of Object.entries(d.variante.acc)) {
        const id = typeof ch === 'string' ? ch : ch!.id
        expect(PAR_ID.has(`${e}:${id}`), `${e}:${id}`).toBe(true)
        vus.add(`${e}:${id}`)
      }
    }
    expect(vus.size).toBe(CATALOGUE.length)
    expect(DEFILE.length).toBeGreaterThanOrEqual(20)
    expect(DEFILE.length).toBeLessThanOrEqual(30)
    expect(new Set(AFFICHES.map((a) => a.nom))).toContain(DEFILE[0]!.nom)
    const bento = lire('Bento.ts')
    expect(bento).toContain('CATALOGUE.length')
    expect(bento).toContain('c(AccDefile')
    const d = lire('AccDefile.ts')
    expect(d).toContain('useReduit')
    expect(d).toMatch(/reduit\.value \? 0/)
    expect(d).not.toMatch(/import .*three|mochi-bot/)
  })
})

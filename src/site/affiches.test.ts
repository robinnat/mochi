import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE, PAR_ID } from '@/bot/emplacements'
import { AFFICHES, DEFILE, PIECES, urlAffiche, urlPiece } from './affiches'

const publicDir = new URL('../../public', import.meta.url)
const existe = (url: string) => existsSync(new URL('.' + url, publicDir + '/'))
const dossier = new URL('./', import.meta.url)
const vues = readdirSync(dossier).filter((f) => f.endsWith('.vue'))
const lire = (f: string) => readFileSync(new URL(f, dossier), 'utf8')

describe('images pre-rendues (v11)', () => {
  it('chaque affiche et chaque piece a son image, en clair et en sombre', () => {
    for (const t of ['light', 'dark'] as const) {
      for (const a of AFFICHES) expect(existe(urlAffiche(a.nom, t)), urlAffiche(a.nom, t)).toBe(true)
      for (const p of PIECES) expect(existe(urlPiece(p.emplacement, p.id, t)), urlPiece(p.emplacement, p.id, t)).toBe(true)
    }
  })

  it('les anciennes sections ne sont plus dans la page', () => {
    expect(lire('Site.vue')).not.toMatch(/Faces|Gestes|Metiers/)
  })

  it('les noms sont uniques', () => {
    expect(new Set(AFFICHES.map((a) => a.nom)).size).toBe(AFFICHES.length)
  })

  it('aucune section du site ne monte MochiBot directement : images ou Vivant (affiche puis 3D en fondu, jamais de 2D)', () => {
    for (const f of vues) {
      // Faces, Gestes, Metiers : anciennes sections, plus montees par la page (Site.vue)
      if (['Vivant.vue', 'Faces.vue', 'Gestes.vue', 'Metiers.vue'].includes(f)) continue
      expect(lire(f), f).not.toMatch(/<MochiBot\b/)
      expect(lire(f), f).not.toMatch(/^import MochiBot/m)
    }
    const v = lire('Vivant.vue')
    expect(v).toContain("defineAsyncComponent(() => import('@/components/MochiBot.vue'))")
    expect(v).toContain('@pret=')
    expect(v).toContain('IntersectionObserver')
  })

  it('les affiches utilisees par les pages existent dans le manifeste', () => {
    const noms = new Set(AFFICHES.map((a) => a.nom))
    const tout = vues.map(lire).join('\n') + readFileSync(new URL('../docs/Docs.vue', import.meta.url), 'utf8')
    for (const m of tout.matchAll(/affiche="([a-z-]+)"|affiche=\{?"?'([a-z-]+)'/g)) {
      const n = m[1] ?? m[2]!
      expect(noms.has(n), n).toBe(true)
    }
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
    const bento = lire('Bento.vue')
    expect(bento).toContain('CATALOGUE.length')
    expect(bento).toContain('<AccDefile')
    const d = lire('AccDefile.vue')
    expect(d).toContain('useReduit')
    expect(d).toMatch(/reduit\.value \? 0/)
    expect(d).not.toMatch(/import .*three|MochiBot/)
  })
})

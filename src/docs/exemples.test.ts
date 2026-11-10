import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE, EMPLACEMENTS, PAR_ID, type Emplacement } from '@/bot/emplacements'
import { MOOD_IDS, REACTION_IDS, moodDe } from '@/bot/humeurs'
import { COLOR_BY_ID, SHAPE_BY_ID, hexValide } from '@/bot/skins'
import { RENDUS, TAILLES_PIXEL } from '@/ui/rendu'
import { MochiBotElement, PROPRIETES, attributDe } from '@/components/mochi-bot'
import * as EX from './exemples'
import { ALIAS_HUMEURS, REACTIONS_DOC } from './catalogues'

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
const composant = source('../components/mochi-bot.ts')
const NOMS = new Set(PROPRIETES.map((p) => p.nom))
const ATTRIBUTS = new Set(PROPRIETES.filter((p) => !p.sansAttribut).map((p) => attributDe(p.nom)))
const tousLesExemples = Object.entries(EX)
  .filter(([, v]) => typeof v === 'string')
  .map(([k, v]) => [k, v as string] as const)

describe('docs : tout vient de la vraie API', () => {
  it('chaque option du tableau est declaree par <mochi-bot>, avec son nom d attribut', () => {
    for (const p of EX.PROPS) {
      expect(NOMS.has(p.nom as never), p.nom).toBe(true)
      expect(p.attr).toBe(attributDe(p.nom))
      expect(ATTRIBUTS.has(p.attr), p.attr).toBe(true)
    }
    expect(new Set(EX.PROPS.map((p) => p.nom)).size).toBe(EX.PROPS.length)
  })

  it('chaque methode documentee existe sur l element', () => {
    for (const m of EX.METHODES) {
      expect(typeof (MochiBotElement.prototype as unknown as Record<string, unknown>)[m.nom], m.nom).toBe('function')
      expect(m.signature.startsWith(m.nom + '(')).toBe(true)
    }
  })

  it('chaque evenement documente est bien emis par le composant', () => {
    for (const e of EX.EVENEMENTS) expect(composant, e.nom).toMatch(new RegExp(`'${e.nom}'`))
  })

  it('les attributs ecrits dans les exemples HTML sont des options reelles', () => {
    const vus = new Set<string>()
    for (const [, code] of tousLesExemples) {
      for (const balise of code.matchAll(/<mochi-bot\b([^>]*)>/g)) {
        for (const m of balise[1]!.matchAll(/(?:^|\s)([a-z][a-z-]*)(?==|\s|$)/g)) vus.add(m[1]!)
      }
    }
    expect(vus.size).toBeGreaterThan(10)
    for (const a of vus) {
      // `id` et les gestionnaires d'evenement (`onpret` en React) ne sont pas des options
      if (a === 'id' || a.startsWith('on')) continue
      expect(ATTRIBUTS.has(a), a).toBe(true)
    }
  })

  it('les ids des exemples existent : formes, couleurs, styles, humeurs, pixels', () => {
    for (const [nom, code] of tousLesExemples) {
      for (const m of code.matchAll(/(?<![\w-])shape="([^"]+)"/g)) expect(SHAPE_BY_ID.has(m[1]!), `${nom}: ${m[1]}`).toBe(true)
      for (const m of code.matchAll(/(?<![\w-])color="([^"]+)"/g)) expect(COLOR_BY_ID.has(m[1]!) || hexValide(m[1]!) !== null, `${nom}: ${m[1]}`).toBe(true)
      for (const m of code.matchAll(/(?<![\w-])rendu="([^"]+)"/g)) expect(RENDUS as string[], `${nom}: ${m[1]}`).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![\w-])mood="([^"]+)"/g)) expect(moodDe(m[1]!), `${nom}: ${m[1]}`).not.toBeNull()
      for (const m of code.matchAll(/setMood\('([^']+)'\)/g)) expect(moodDe(m[1]!)).not.toBeNull()
      for (const m of code.matchAll(/'mood', '([^']+)'/g)) expect(moodDe(m[1]!)).not.toBeNull()
      for (const m of code.matchAll(/react\('([^']+)'\)/g)) expect(REACTION_IDS as string[]).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![\w-])pixel="([^"]+)"/g)) expect(TAILLES_PIXEL.map((p) => p.id) as string[]).toContain(m[1]!)
    }
  })

  it('les accessoires des exemples sont au catalogue, dans le bon emplacement, et les couleurs sont des hex', () => {
    let vus = 0
    for (const [, code] of tousLesExemples) {
      for (const m of code.matchAll(/\b"?(tete|yeux|visage|bas|dos)"?:\s*(?:"([a-z-]+)"|'([a-z-]+)'|\{\s*id:\s*'([a-z-]+)'([^}]*)\})/g)) {
        const e = m[1] as Emplacement
        const id = m[2] ?? m[3] ?? m[4]!
        expect(PAR_ID.has(`${e}:${id}`), `${e}:${id}`).toBe(true)
        for (const c of (m[5] ?? '').matchAll(/c[12]:\s*'([^']+)'/g)) expect(hexValide(c[1]!), c[1]).not.toBeNull()
        vus++
      }
    }
    expect(vus).toBeGreaterThanOrEqual(5)
  })

  it('l attribut accessoires de l exemple est du JSON valide', () => {
    const m = EX.EX_ACCESSOIRES.match(/accessoires='([^']+)'/)!
    expect(() => JSON.parse(m[1]!)).not.toThrow()
  })

  it('les alias anglais des humeurs sont bien acceptes par le moteur', () => {
    expect(Object.keys(ALIAS_HUMEURS).sort()).toEqual([...MOOD_IDS].sort())
    for (const [id, alias] of Object.entries(ALIAS_HUMEURS)) for (const a of alias) expect(moodDe(a), a).toBe(id)
    expect(Object.keys(REACTIONS_DOC).sort()).toEqual([...REACTION_IDS].sort())
  })

  it('aucun npm install presente comme disponible : le paquet n est pas publie', () => {
    const docs = source('./Docs.ts')
    expect(docs).toContain('coming soon')
    expect(docs).toMatch(/does not work today/)
    expect(EX.INSTALL_DEPOT).not.toContain('mochi-world')
    expect(EX.INSTALL_NPM).toBe('npm install mochi-world')
    expect(EX.INSTALL_DEPOT).toContain('git clone https://github.com/robinnat/mochi.git')
    expect(EX.INSTALL_DEPOT).toContain('build:lib')
    // le script et sa configuration existent bien dans le depot
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    expect(pkg.scripts['build:lib']).toContain('vite.lib.config.ts')
    expect(() => readFileSync(new URL('../../vite.lib.config.ts', import.meta.url))).not.toThrow()
    expect(() => readFileSync(new URL('../index.ts', import.meta.url))).not.toThrow()
  })

  it('le sommaire pointe vers des sections qui existent, et les textes n ont pas de tiret cadratin', () => {
    const docs = source('./Docs.ts')
    for (const s of EX.SOMMAIRE) expect(docs, s.id).toMatch(new RegExp(`section\\(\\s*'${s.id}'`))
    const tout = [docs, ...tousLesExemples.map(([, v]) => v), ...EX.PROPS.map((p) => p.texte), ...EX.METHODES.map((m) => m.texte)].join('\n')
    expect(tout).not.toMatch(/[—–]/)
  })

  it('les emplacements et le nombre d accessoires du catalogue sont ceux du moteur', () => {
    expect(EMPLACEMENTS).toHaveLength(5)
    expect(CATALOGUE.length).toBeGreaterThan(20)
  })
})

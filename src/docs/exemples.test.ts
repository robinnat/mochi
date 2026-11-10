import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE, EMPLACEMENTS, PAR_ID, type Emplacement } from '@/bot/emplacements'
import { MOOD_IDS, REACTION_IDS, moodDe } from '@/bot/humeurs'
import { COLOR_BY_ID, SHAPE_BY_ID, hexValide } from '@/bot/skins'
import { RENDUS, TAILLES_PIXEL } from '@/ui/rendu'
import * as EX from './exemples'
import { ALIAS_HUMEURS, REACTIONS_DOC } from './catalogues'

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
const mochiBot = source('../components/MochiBot.vue')
const blocProps = mochiBot.slice(mochiBot.indexOf('defineProps<{'), mochiBot.indexOf('}>(),'))
const expose = mochiBot.match(/defineExpose\(\{([^}]*)\}\)/)![1]!
const tousLesExemples = Object.entries(EX)
  .filter(([, v]) => typeof v === 'string')
  .map(([k, v]) => [k, v as string] as const)
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())

describe('docs : tout vient de la vraie API', () => {
  it('chaque prop du tableau existe dans MochiBot.vue, avec son nom de template', () => {
    for (const p of EX.PROPS) {
      expect(blocProps, p.nom).toMatch(new RegExp(`\\n\\s+${p.nom}\\?:`))
      expect(p.attr).toBe(kebab(p.nom))
    }
    expect(new Set(EX.PROPS.map((p) => p.nom)).size).toBe(EX.PROPS.length)
  })

  it('chaque methode documentee est exposee par defineExpose', () => {
    for (const m of EX.METHODES) {
      expect(expose, m.nom).toMatch(new RegExp(`\\b${m.nom}\\b`))
      expect(m.signature.startsWith(m.nom + '(')).toBe(true)
    }
  })

  it('les attributs ecrits dans les exemples sont des props reelles', () => {
    const attrs = new Set<string>()
    for (const [, code] of tousLesExemples) {
      for (const balise of code.matchAll(/<MochiBot\b([\s\S]*?)\/>/g)) {
        for (const m of balise[1]!.matchAll(/(?:^|\s)([:@]?)([a-z][a-z-]*)(?==|\s|$)/g)) {
          // un evenement (@pret) doit etre declare par defineEmits, pas par defineProps
          if (m[1] === '@') expect(mochiBot, m[2]).toMatch(new RegExp(`defineEmits<\\{[^}]*\\b${m[2]}:`))
          else attrs.add(m[2]!)
        }
      }
    }
    expect(attrs.size).toBeGreaterThan(10)
    const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    for (const a of attrs) {
      if (a === 'ref') continue
      expect(blocProps, a).toMatch(new RegExp(`\\n\\s+${camel(a)}\\?:`))
    }
  })

  it('les ids des exemples existent : formes, couleurs, styles, humeurs, pixels', () => {
    for (const [nom, code] of tousLesExemples) {
      for (const m of code.matchAll(/(?<![:\w-])shape="([^"]+)"/g)) expect(SHAPE_BY_ID.has(m[1]!), `${nom}: ${m[1]}`).toBe(true)
      for (const m of code.matchAll(/(?<![:\w-])color="([^"]+)"/g)) expect(COLOR_BY_ID.has(m[1]!) || hexValide(m[1]!) !== null, `${nom}: ${m[1]}`).toBe(true)
      for (const m of code.matchAll(/(?<![:\w-])rendu="([^"]+)"/g)) expect(RENDUS as string[], `${nom}: ${m[1]}`).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![:\w-])mood="([^"]+)"/g)) expect(moodDe(m[1]!), `${nom}: ${m[1]}`).not.toBeNull()
      for (const m of code.matchAll(/ref\('([a-z]+)'\)/g)) if (nom === 'EX_MOODS') expect(moodDe(m[1]!)).not.toBeNull()
      for (const m of code.matchAll(/setMood\('([^']+)'\)/g)) expect(moodDe(m[1]!)).not.toBeNull()
      for (const m of code.matchAll(/react\('([^']+)'\)/g)) expect(REACTION_IDS as string[]).toContain(m[1]!)
      for (const m of code.matchAll(/(?<![:\w-])pixel="([^"]+)"/g)) expect(TAILLES_PIXEL.map((p) => p.id) as string[]).toContain(m[1]!)
    }
  })

  it('les accessoires des exemples sont au catalogue, dans le bon emplacement, et les couleurs sont des hex', () => {
    let vus = 0
    for (const [, code] of tousLesExemples) {
      for (const m of code.matchAll(/\b(tete|yeux|visage|bas|dos):\s*(?:'([a-z-]+)'|\{\s*id:\s*'([a-z-]+)'([^}]*)\})/g)) {
        const e = m[1] as Emplacement
        const id = m[2] ?? m[3]!
        expect(PAR_ID.has(`${e}:${id}`), `${e}:${id}`).toBe(true)
        for (const c of (m[4] ?? '').matchAll(/c[12]:\s*'([^']+)'/g)) expect(hexValide(c[1]!), c[1]).not.toBeNull()
        vus++
      }
    }
    expect(vus).toBeGreaterThanOrEqual(5)
  })

  it('les alias anglais des humeurs sont bien acceptes par le moteur', () => {
    expect(Object.keys(ALIAS_HUMEURS).sort()).toEqual([...MOOD_IDS].sort())
    for (const [id, alias] of Object.entries(ALIAS_HUMEURS)) for (const a of alias) expect(moodDe(a), a).toBe(id)
    expect(Object.keys(REACTIONS_DOC).sort()).toEqual([...REACTION_IDS].sort())
  })

  it('aucun npm install presente comme disponible : le paquet n est pas publie', () => {
    const docs = source('./Docs.vue')
    expect(docs).toContain('coming soon')
    expect(docs).toMatch(/does not work today/)
    expect(EX.INSTALL_DEPOT).not.toContain('mochi-bots')
    expect(EX.INSTALL_DEPOT).toContain('git clone https://github.com/robinnat/mochi.git')
    // les fichiers copies existent bien dans le depot
    for (const d of ['bot/engine.ts', 'ui/rendu.ts', 'i18n/index.ts', 'components/MochiBot.vue', 'ui/trois/themeCourant.ts']) {
      expect(() => readFileSync(new URL('../' + d, import.meta.url))).not.toThrow()
    }
    expect(() => readFileSync(new URL('../../tools/moteur.ts', import.meta.url))).not.toThrow()
    expect(() => readFileSync(new URL('../../tools/vue-stub.ts', import.meta.url))).not.toThrow()
  })

  it('le sommaire pointe vers des sections qui existent, et les textes n ont pas de tiret cadratin', () => {
    const docs = source('./Docs.vue')
    for (const s of EX.SOMMAIRE) expect(docs, s.id).toContain(`<section id="${s.id}"`)
    const tout = [docs, ...tousLesExemples.map(([, v]) => v), ...EX.PROPS.map((p) => p.texte), ...EX.METHODES.map((m) => m.texte)].join('\n')
    expect(tout).not.toMatch(/[\u2014\u2013]/)
  })

  it('les emplacements et le nombre d accessoires du catalogue sont ceux du moteur', () => {
    expect(EMPLACEMENTS).toHaveLength(5)
    expect(CATALOGUE.length).toBeGreaterThan(20)
  })
})

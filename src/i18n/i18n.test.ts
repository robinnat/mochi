import { describe, expect, it } from 'vitest'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import { STATES } from '@/bot/states'
import { pluralForm, interpolate } from './format'
import { pickLanguage, LANGUAGES, tagOf } from './languages'
import fr from './locales/fr'
import en from './locales/en'
import zh from './locales/zh'

/**
 * On importe les dictionnaires et les modules purs, jamais `./index` : celui-ci
 * lit `localStorage`, `navigator` et `document` a l'import, donc il exige un
 * navigateur. C'est precisement pour ca que la regle de choix de langue et la
 * mecanique de texte vivent dans des fichiers separes.
 */
const DICTIONARIES = { fr, en, zh }

describe('choix de la langue au demarrage', () => {
  it('respecte le choix memorise, quelles que soient les preferences du navigateur', () => {
    expect(pickLanguage('en', ['fr-FR', 'fr'])).toBe('en')
    expect(pickLanguage('zh', ['fr-FR'])).toBe('zh')
  })

  it('ignore un choix memorise qui n est pas une langue connue', () => {
    // le localStorage se modifie a la main : on ne lui fait pas confiance
    expect(pickLanguage('of', ['en-GB'])).toBe('en')
    expect(pickLanguage('', ['en-GB'])).toBe('en')
  })

  it('suit l ordre des preferences du navigateur, pas leur simple presence', () => {
    expect(pickLanguage(null, ['zh-CN', 'en-US', 'fr'])).toBe('zh')
    expect(pickLanguage(null, ['en-US', 'zh-CN', 'fr'])).toBe('en')
  })

  it('reduit une etiquette complete a sa langue', () => {
    // le piege : `zh-Hans-CN` ne se coupe pas au premier tiret par hasard
    expect(pickLanguage(null, ['zh-Hans-CN'])).toBe('zh')
    expect(pickLanguage(null, ['en-GB-oxendict'])).toBe('en')
  })

  it('saute les langues qu on ne parle pas et les etiquettes invalides', () => {
    expect(pickLanguage(null, ['de-DE', 'ja', 'en'])).toBe('en')
    expect(pickLanguage(null, ['pas une etiquette', 'zh'])).toBe('zh')
  })

  it('retombe sur le francais quand rien ne correspond', () => {
    expect(pickLanguage(null, ['de-DE', 'ja-JP'])).toBe('fr')
    expect(pickLanguage(null, [])).toBe('fr')
  })
})

describe('completude des dictionnaires', () => {
  /**
   * La presence des cles est deja garantie a la compilation (`en` et `zh` sont
   * types `typeof fr`). Ce qu'on verifie ici, c'est ce que le type ne voit pas :
   * une valeur vide, ou une traduction restee en francais par oubli.
   */
  function leaves(object: object, prefix = ''): Array<[string, string]> {
    return Object.entries(object).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [[`${prefix}${key}`, value] as [string, string]]
        : leaves(value as object, `${prefix}${key}.`)
    )
  }

  it('n a aucune valeur vide, dans aucune langue', () => {
    for (const [language, dict] of Object.entries(DICTIONARIES)) {
      for (const [key, value] of leaves(dict)) {
        expect(value.trim(), `${language}.${key}`).not.toBe('')
      }
    }
  })

  it('traduit vraiment les libelles des catalogues, sans les recopier du francais', () => {
    // Les noms de marque et les gabarits purs (« {state}, {duration} ») sont
    // identiques d'une langue a l'autre, c'est normal — on ne regarde donc que
    // les catalogues, ou chaque entree est un vrai mot a traduire.
    for (const family of ['states', 'shapes', 'colors', 'expressions'] as const) {
      for (const [key, value] of leaves(fr[family])) {
        expect(leaves(zh[family]).find(([k]) => k === key)![1], `zh ${family}.${key}`).not.toBe(
          value
        )
      }
    }
  })

  it('couvre les quatre catalogues du bot, entree par entree', () => {
    const keys = (family: object) => leaves(family).map(([k]) => k)
    expect(keys(fr.states).sort()).toEqual(STATES.map((s) => s.id).sort())
    expect(keys(fr.shapes).sort()).toEqual(SHAPES.map((s) => s.id).sort())
    expect(keys(fr.colors).sort()).toEqual(COLORS.map((c) => c.id).sort())
    expect(keys(fr.expressions).sort()).toEqual(EXPRESSIONS.map((e) => e.id).sort())
  })
})

describe('substitution', () => {
  it('remplace toutes les occurrences d un parametre', () => {
    expect(interpolate('{a} et {a}', { a: 'x' })).toBe('x et x')
  })

  it('accepte les nombres et plusieurs parametres', () => {
    expect(interpolate('{etat}, {duree}', { state: 'Idle', duration: 2 })).toBe('Repos, 2')
  })

  it('laisse visible un parametre sans valeur, plutot que de le vider', () => {
    // un « {name} » a l'ecran se remarque ; une chaine vide passe inapercue
    expect(interpolate('Supprimer {name} ?', {})).toBe('Supprimer {name} ?')
  })
})

describe('plural', () => {
  it('range zero avec le singulier en francais, avec le pluriel en anglais', () => {
    const template = 'un | plusieurs'
    expect(pluralForm(template, 0, 'fr')).toBe('one')
    expect(pluralForm(template, 0, 'en')).toBe('several')
  })

  it('distingue un de deux dans les deux langues', () => {
    const template = 'un | plusieurs'
    for (const tag of ['fr', 'en']) {
      expect(pluralForm(template, 1, tag)).toBe('one')
      expect(pluralForm(template, 2, tag)).toBe('several')
    }
  })

  it('rend la shape unique quand la langue n a pas de pluriel', () => {
    // le chinois : une seule forme ecrite dans le dictionnaire, sans separateur
    for (const n of [0, 1, 2, 17]) {
      expect(pluralForm('{n} 个动画', n, 'zh-Hans')).toBe('{n} 个动画')
    }
  })

  it('donne au chinois une seule forme, au francais et a l anglais deux', () => {
    expect(zh.dialog.removeDetail.includes(' | ')).toBe(false)
    expect(fr.dialog.removeDetail.split(' | ')).toHaveLength(2)
    expect(en.dialog.removeDetail.split(' | ')).toHaveLength(2)
  })
})

describe('catalogue des langues', () => {
  it('propose les trois langues, avec un drapeau et un endonyme', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(['fr', 'en', 'zh'])
    for (const l of LANGUAGES) {
      expect(l.emoji.length, l.id).toBeGreaterThan(0)
      expect(l.name.trim(), l.id).not.toBe('')
    }
  })

  it('donne une etiquette BCP 47 que `Intl` sait lire', () => {
    for (const l of LANGUAGES) {
      const tag = tagOf(l.id)
      expect(new Intl.Locale(tag).language, l.id).toBe(l.id)
      // c'est cette etiquette qui formate les nombres : elle doit etre utilisable
      expect(new Intl.NumberFormat(tag).format(2.4), l.id).toMatch(/2[.,]4/)
    }
  })

  it('precise l ecriture du chinois, que `zh` seul laisse indeterminee', () => {
    expect(tagOf('zh')).toBe('zh-Hans')
  })
})

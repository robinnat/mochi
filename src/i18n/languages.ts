/**
 * Langues proposees et regle de choix. Volontairement sans DOM ni interface : le
 * navigateur ne rentre que par les arguments, donc la regle se teste sans
 * simuler `navigator` ni `localStorage`.
 */

/**
 * `tag` est l'etiquette BCP 47, pas l'identifiant : elle sert a `Intl` et a
 * l'attribut `lang` du document. `zh` seul ne dit pas si l'ecriture est
 * simplifiee ou traditionnelle, d'ou `zh-Hans`.
 *
 * `name` est l'endonyme — le nom de la langue DANS cette langue. Une liste de
 * langues traduite serait absurde : on la lit justement quand on ne comprend
 * pas la langue affichee.
 */
export const LANGUAGES = [
  { id: 'fr', tag: 'fr', emoji: '🇫🇷', name: 'Français' },
  { id: 'en', tag: 'en', emoji: '🇬🇧', name: 'English' },
  { id: 'zh', tag: 'zh-Hans', emoji: '🇨🇳', name: '简体中文' }
] as const

export type Language = (typeof LANGUAGES)[number]['id']

export const DEFAULT_LANGUAGE: Language = 'fr'

export function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGES.some((l) => l.id === value)
}

export function tagOf(language: Language): string {
  return LANGUAGES.find((l) => l.id === language)!.tag
}

/**
 * Langue a afficher au demarrage.
 *
 * Un choix explicite gagne toujours : quelqu'un qui a mis l'interface en
 * anglais ne veut pas la retrouver en francais parce qu'il a change de reseau.
 * Sinon on parcourt les preferences du navigateur DANS L'ORDRE — c'est un
 * classement, pas un ensemble — et on retient la premiere qu'on sait parler.
 *
 * Le decoupage passe par `Intl.Locale` plutot que par `tag.split('-')[0]` :
 * `zh-Hans-CN` doit donner `zh`, et les etiquettes exotiques ne se coupent pas
 * toutes au premier tiret.
 */
export function pickLanguage(remembered: string | null, preferences: readonly string[]): Language {
  if (isLanguage(remembered)) return remembered
  for (const tag of preferences) {
    let base: string
    try {
      base = new Intl.Locale(tag).language
    } catch {
      // une etiquette invalide dans navigator.languages n'a pas a tout casser
      continue
    }
    if (isLanguage(base)) return base
  }
  return DEFAULT_LANGUAGE
}

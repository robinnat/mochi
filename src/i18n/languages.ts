/**
 * Offered languages and the choice rule. Deliberately without DOM or interface: the browser only comes in through the
 * arguments, so the rule is tested without simulating `navigator` or `localStorage`.
 */

/**
 * `tag` is the BCP 47 tag, not the id: it serves `Intl` and the document's `lang` attribute. `zh` alone does not say
 * whether the script is simplified or traditional, hence `zh-Hans`.
 *
 * `name` is the endonym: the language's name IN that language. A translated language list would be absurd: you read
 * it precisely when you do not understand the displayed language.
 */
export const LANGUAGES = [
  { id: 'fr', tag: 'fr', emoji: '🇫🇷', name: 'Français' },
  { id: 'en', tag: 'en', emoji: '🇬🇧', name: 'English' },
  { id: 'zh', tag: 'zh-Hans', emoji: '🇨🇳', name: '简体中文' }
] as const

export type Language = (typeof LANGUAGES)[number]['id']

export const DEFAULT_LANGUAGE: Language = 'en'

export function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGES.some((l) => l.id === value)
}

export function tagOf(language: Language): string {
  return LANGUAGES.find((l) => l.id === language)!.tag
}

/**
 * Language to show at startup.
 *
 * An explicit choice always wins: someone who set the interface to English does not want it back in French because
 * they changed network. Otherwise we walk the browser preferences IN ORDER (a ranking, not a set) and keep the first
 * one we speak. Nothing matches: English.
 *
 * Splitting goes through `Intl.Locale` rather than `tag.split('-')[0]`: `zh-Hans-CN` must give `zh`, and exotic tags
 * do not all split at the first dash.
 */
export function pickLanguage(remembered: string | null, preferences: readonly string[]): Language {
  if (isLanguage(remembered)) return remembered
  for (const tag of preferences) {
    let base: string
    try {
      base = new Intl.Locale(tag).language
    } catch {
      // an invalid tag in navigator.languages must not break everything
      continue
    }
    if (isLanguage(base)) return base
  }
  return DEFAULT_LANGUAGE
}

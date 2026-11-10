import { computed, ref, watchEffect } from '@/ui/dom/reactive'
import { write, read } from '@/ui/storage'
import { pluralForm, interpolate } from './format'
import { pickLanguage, isLanguage, type Language, tagOf } from './languages'
import fr from './locales/fr'
import en from './locales/en'
import zh from './locales/zh'

export { LANGUAGES, type Language } from './languages'

/**
 * `Record<Language, typeof fr>` and not a free object: adding a language to `LANGUAGES` without writing its
 * dictionary becomes a compile error.
 */
const dictionaries: Record<Language, typeof fr> = { fr, en, zh }

/**
 * Dotted paths of the dictionary. This type is what makes `t('setting.x')` fail to compile: the signature of `t` only
 * accepts a key that really exists in `fr.ts`.
 */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]

export type Key = Paths<typeof fr>

const current = ref<Language>(
  pickLanguage(read('language'), navigator.languages ?? [navigator.language])
)

/**
 * Current language, read and written through `.value`.
 *
 * Only writing saves to storage: the DETECTED language is not saved. Without that distinction, a first visit from
 * England would freeze English forever, while detection must stay a guess made again on every visit until the user
 * decides.
 */
export const language = computed<Language>({
  get: () => current.value,
  set: (value) => {
    if (!isLanguage(value)) return
    current.value = value
    write('language', value)
  }
})

const dictionary = computed(() => dictionaries[current.value])

/** BCP 47 tag of the current language, for `Intl` and the `lang` attribute. */
const tag = computed(() => tagOf(current.value))

/**
 * The document's `lang` attribute follows the language: it makes the screen reader pick the right voice and the right
 * hyphenation rules. The tab title follows too (`index.html` can only hold one, static).
 */
let documentTracking = false
/**
 * The APP (and only the app) follows its language on the page: `lang` attribute and title. It is not done on import:
 * the `<mochi-bot>` component imports this module for its alternative text, and a host page (the site, the docs, a
 * user's app) must never see its language or title rewritten by it.
 */
export function followLanguageDocument() {
  if (documentTracking) return
  documentTracking = true
  watchEffect(() => {
    document.documentElement.lang = tag.value
    document.title = t('app.title')
  })
}

/** Formatters are costly to build and read again on every frame of the track. */
const formatters = new Map<string, Intl.NumberFormat>()

function formatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const memo = `${tag.value}:${key}`
  let f = formatters.get(memo)
  if (!f) {
    f = new Intl.NumberFormat(tag.value, options)
    formatters.set(memo, f)
  }
  return f
}

/**
 * Number in the language's convention. Essential for durations: the decimal separator is a comma in French and a
 * point in English, so the `.replace('.', ',')` that served as formatting was wrong as soon as we left French.
 */
export function number(value: number, decimals = 0): string {
  return formatter(`n${decimals}`, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

/**
 * Percentage, from a fraction. French inserts a non-breaking space before the sign, English and Chinese stick it:
 * `Intl` knows the rule, concatenation does not.
 */
export function percentage(fraction: number): string {
  return formatter('%', { style: 'percent', maximumFractionDigits: 0 }).format(fraction)
}

function raw(key: Key): string {
  const bow = key
    .split('.')
    .reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], dictionary.value)
  return bow as string
}

/** `t('panel.shape')`, `t('cycles.menuRenameAria', { name })`. */
export function t(key: Key, values?: Record<string, string | number>): string {
  return interpolate(raw(key), values)
}

/** Plural: `n` is always available as `{n}` in the template. */
export function plural(key: Key, n: number, values?: Record<string, string | number>): string {
  return interpolate(pluralForm(raw(key), n, tag.value), { n, ...values })
}

/**
 * Name of a montage. An empty name is the seed montage's, which the user never named: so it follows the language.
 * Structural type rather than an imported `Cycle`, so the i18n layer does not depend on `src/bot/`.
 */
export function nameOfCycle(cycle: { name: string }): string {
  return cycle.name || t('cycles.defaultName')
}

/** Readable duration: `2,4 s`, `2.4 s`, `2.4 秒`. */
export function seconds(value: number): string {
  return t('units.seconds', { n: number(value, 1) })
}

/**
 * Same duration, tight, for the ruler ticks: it is numbered every 52 px and one more space would make labels overlap.
 */
export function secondsShort(value: number, decimals: number): string {
  return t('units.secondsShort', { n: number(value, decimals) })
}

import { computed, ref, watchEffect } from '@/ui/dom/reactive'
import { write, read } from '@/ui/storage'
import { pluralForm, interpolate } from './format'
import { pickLanguage, isLanguage, type Language, tagOf } from './languages'
import fr from './locales/fr'
import en from './locales/en'
import zh from './locales/zh'

export { LANGUAGES, type Language } from './languages'

/**
 * `Record<Language, typeof fr>` et pas un objet libre : ajouter une langue a
 * `LANGUAGES` sans ecrire son dictionnaire devient une erreur de compilation.
 */
const dictionaries: Record<Language, typeof fr> = { fr, en, zh }

/**
 * Chemins pointes du dictionnaire. C'est ce type qui fait que `t('reglage.x')`
 * ne compile pas : la signature de `t` n'accepte rien d'autre qu'une cle qui
 * existe vraiment dans `fr.ts`.
 */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]

export type Key = Paths<typeof fr>

const current = ref<Language>(
  pickLanguage(read('language'), navigator.languages ?? [navigator.language])
)

/**
 * Langue courante, en lecture et en ecriture (lecture et ecriture par `.value`).
 *
 * L'ecriture seule ecrit dans le stockage : la langue DETECTEE ne s'y inscrit
 * pas. Sans cette distinction, un premier passage depuis l'Angleterre figerait
 * l'anglais pour toujours, alors que la detection doit rester une hypothese
 * qu'on refait a chaque visite tant que l'utilisateur n'a pas tranche.
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

/** Etiquette BCP 47 de la langue courante, pour `Intl` et l'attribut `lang`. */
const tag = computed(() => tagOf(current.value))

/**
 * L'attribut `lang` du document suit la langue : c'est lui qui fait choisir la
 * bonne voix au lecteur d'ecran et les bonnes regles de cesure. Le titre de
 * l'onglet suit aussi — `index.html` ne peut en porter qu'un, statique.
 */
let documentTracking = false
/**
 * L'APPLICATION (et elle seule) suit sa langue sur la page : attribut `lang` et titre. Ce n'est pas fait a
 * l'import : le composant `<mochi-bot>` importe ce module pour son texte alternatif, et une page hote (le site,
 * les docs, l'app d'un utilisateur) ne doit jamais voir sa langue ni son titre reecrits par lui.
 */
export function followLanguageDocument() {
  if (documentTracking) return
  documentTracking = true
  watchEffect(() => {
    document.documentElement.lang = tag.value
    document.title = t('app.title')
  })
}

/** Les formateurs sont chers a construire et relus a chaque image de la piste. */
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
 * Nombre dans la convention de la langue. Indispensable pour les durees : le
 * separateur decimal est une virgule en francais et un point en anglais, et le
 * `.replace('.', ',')` qui tenait lieu de formatage etait donc faux des qu'on
 * quittait le francais.
 */
export function number(value: number, decimals = 0): string {
  return formatter(`n${decimals}`, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

/**
 * Pourcentage, depuis une fraction. Le francais insere une espace insecable
 * avant le signe, l'anglais et le chinois le collent — `Intl` connait la regle,
 * la concatenation non.
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

/** Pluriel : `n` est toujours disponible comme `{n}` dans le gabarit. */
export function plural(key: Key, n: number, values?: Record<string, string | number>): string {
  return interpolate(pluralForm(raw(key), n, tag.value), { n, ...values })
}

/**
 * Nom d'un montage. Un nom vide est celui du montage d'amorce, que l'utilisateur
 * n'a jamais nomme : il suit donc la langue. Type structurel plutot que `Cycle`
 * importe, pour que la couche i18n ne depende pas de `src/bot/`.
 */
export function nameOfCycle(cycle: { name: string }): string {
  return cycle.name || t('cycles.defaultName')
}

/** Duree lisible : `2,4 s`, `2.4 s`, `2.4 秒`. */
export function seconds(value: number): string {
  return t('units.seconds', { n: number(value, 1) })
}

/**
 * Meme duree, serree, pour la graduation de la regle : elle est chiffree tous
 * les 52 px et une espace de plus y ferait chevaucher les etiquettes.
 */
export function secondsShort(value: number, decimals: number): string {
  return t('units.secondsShort', { n: number(value, decimals) })
}

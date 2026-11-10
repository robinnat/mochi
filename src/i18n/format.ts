/**
 * Mecanique de texte de la couche i18n : substitution et choix de forme.
 *
 * Separee de `index.ts` parce qu'elle est pure — ni dictionnaire, ni langue
 * courante, ni DOM. C'est la partie ou les regles sont subtiles (le francais
 * compte zero comme un singulier, le chinois n'a qu'une forme), donc celle qui
 * merite d'etre testee sans avoir a simuler un navigateur.
 */

/** Separateur des formes de pluriel dans les dictionnaires. */
const SEPARATOR = ' | '

/**
 * Remplace les `{name}` par leur valeur. Un `{name}` sans valeur fournie reste
 * tel quel : visible a l'ecran, donc reperable, la ou une chaine vide se
 * confondrait avec un texte simplement mal ecrit.
 */
export function interpolate(text: string, values?: Record<string, string | number>): string {
  if (!values) return text
  let exit = text
  for (const [name, value] of Object.entries(values)) {
    exit = exit.replaceAll(`{${name}}`, String(value))
  }
  return exit
}

/**
 * Choisit la forme qui convient a `n` parmi celles du gabarit, separees par
 * ` | ` dans l'ordre singulier puis pluriel.
 *
 * C'est `Intl.PluralRules` qui tranche, et pas un `n === 1` : le francais range
 * zero avec le singulier (« 0 animation »), l'anglais avec le pluriel
 * (« 0 animations »). Un gabarit d'une seule forme la rend toujours — c'est le
 * cas du chinois, qui n'a pas de pluriel.
 */
export function pluralForm(template: string, n: number, tag: string): string {
  const shapes = template.split(SEPARATOR)
  if (shapes.length < 2) return shapes[0]!
  const index = new Intl.PluralRules(tag).select(n) === 'one' ? 0 : 1
  return shapes[index] ?? shapes[0]!
}

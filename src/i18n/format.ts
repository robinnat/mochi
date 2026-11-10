/**
 * Text mechanics of the i18n layer: substitution and plural form choice.
 *
 * Separate from `index.ts` because it is pure: no dictionary, no current language, no DOM. It is the part where the
 * rules are subtle (French counts zero as singular, Chinese has a single form), so the one worth testing without
 * simulating a browser.
 */

/** Separator of plural forms in the dictionaries. */
const SEPARATOR = ' | '

/**
 * Replaces `{name}` with its value. A `{name}` with no value stays as is: visible on screen, so easy to spot, while
 * an empty string would look like a simply badly written text.
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
 * Picks the form that fits `n` among those of the template, separated by ` | ` in singular then plural order.
 *
 * `Intl.PluralRules` decides, not an `n === 1`: French puts zero with the singular ("0 animation"), English with the
 * plural ("0 animations"). A single-form template always returns it: that is the case of Chinese, which has no
 * plural.
 */
export function pluralForm(template: string, n: number, tag: string): string {
  const shapes = template.split(SEPARATOR)
  if (shapes.length < 2) return shapes[0]!
  const index = new Intl.PluralRules(tag).select(n) === 'one' ? 0 : 1
  return shapes[index] ?? shapes[0]!
}

import { computed, ref } from '@/ui/dom/reactive'
import { isTheme, type Theme } from './theme'

/** The page-wide theme setting: `light`, `dark`, or `auto` to follow the device (`prefers-color-scheme`). */
export type ThemeSetting = Theme | 'auto'

/**
 * Theme of every Mochi that has no `theme` of its own. `auto` (the default) follows the device: dark when the
 * visitor's system is in dark mode. A page with its own theme switch sets `light` or `dark` here (the site does).
 */
export const currentTheme = ref<ThemeSetting>('auto')

/** The device asks for dark mode. Read once, then kept up to date when the visitor switches. */
const deviceDark = ref(false)
if (typeof matchMedia === 'function') {
  const query = matchMedia('(prefers-color-scheme: dark)')
  deviceDark.value = query.matches
  query.addEventListener?.('change', () => (deviceDark.value = query.matches))
}

/** The device's theme (`prefers-color-scheme`). */
export const deviceTheme = computed<Theme>(() => (deviceDark.value ? 'dark' : 'light'))

/**
 * The theme a Mochi uses: its own `theme` if it is `light` or `dark`; otherwise `currentTheme`, where `auto` gives the
 * device's theme.
 */
export function resolveTheme(own: string | undefined | null): Theme {
  if (own && isTheme(own)) return own
  const page = currentTheme.value
  return page === 'auto' ? deviceTheme.value : page
}

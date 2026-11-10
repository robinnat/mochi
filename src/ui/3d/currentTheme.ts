import { ref } from '@/ui/dom/reactive'
import { DEFAULT_THEME, type Theme } from './theme'

/**
 * Default theme of avatars without a `theme` prop: the site sets it (light, dark or the device's). The app does not
 * touch it, it stays light.
 */
export const currentTheme = ref<Theme>(DEFAULT_THEME)

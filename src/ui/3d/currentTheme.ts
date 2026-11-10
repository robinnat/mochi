import { ref } from '@/ui/dom/reactive'
import { DEFAULT_THEME, type Theme } from './theme'

/**
 * Theme par defaut des avatars qui n'ont pas de prop `theme` : le site le pose (clair, sombre ou
 * celui de l'appareil). L'application ne le touche pas, elle reste en clair.
 */
export const currentTheme = ref<Theme>(DEFAULT_THEME)
